#!/usr/bin/php
<?php

{}

## no require_once: this reads the log, it should keep working when the manager
## itself is broken

## em_openstack.php logs in UTC, so read them back in UTC

date_default_timezone_set( 'UTC' );

$emdir = realpath( dirname( __FILE__ ) );

if ( $emdir === false ) {
    print "could not resolve the elastic manager directory\n";
    exit( 1 );
}

chdir( $emdir );

$self = basename( __FILE__ );

$notes = <<<__EOD

usage: php $self {options}

report on the elastic manager log: who held what, for how long, and how long
they waited to get it

    Options

    --help              : print this information and exit

    --held              : slots the log shows as still held, with age. this is
                          where the history lives for slots acquired before
                          acquired_at existed in the state file
    --sessions          : every acquire, when it was released, wait and hold time
    --summary           : totals, hold time distribution, queue waits, churn
    --events            : the parsed log lines themselves
    --problems          : WARNING and ERROR lines only

    --since <when>      : only entries at or after <when>. anything strtotime
                          understands: "2026-07-01", "-3 days", "yesterday"
    --slot <n>          : only this slot, may be repeated
    --tag <substring>   : only sessions whose tag contains this
    --limit <n>         : cap rows printed per section
    --log <file>        : read this file instead of the one em_config.json names

    More than one report may be given. With no options this prints help and
    does nothing.

    A release logged by an operator running --release by hand looks exactly
    like one from a finished job, so a long hold is visible here but the
    reason for its ending is not.

__EOD;

$u_argv = $argv;
array_shift( $u_argv );

$reports = [];
$slots   = [];
$since   = 0;
$tag     = "";
$limit   = 0;
$logfile = "";
$anyargs = false;

function fail( $msg ) {
    echo "ERROR: $msg\n";
    exit( 1 );
}

while( count( $u_argv ) && substr( $u_argv[ 0 ], 0, 1 ) == "-" ) {
    $anyargs = true;

    switch( $arg = $u_argv[ 0 ] ) {
        case "--help" : {
            echo $notes;
            exit;
        }
        case "--held" :
        case "--sessions" :
        case "--summary" :
        case "--events" :
        case "--problems" : {
            array_shift( $u_argv );
            $reports[ substr( $arg, 2 ) ] = true;
            break;
        }
        case "--since" : {
            array_shift( $u_argv );
            if ( !count( $u_argv ) ) {
                fail( "option '$arg' requires an argument\n$notes" );
            }
            $what = array_shift( $u_argv );
            if ( ( $since = strtotime( $what ) ) === false ) {
                fail( "could not understand '--since $what'" );
            }
            break;
        }
        case "--slot" : {
            array_shift( $u_argv );
            if ( !count( $u_argv ) ) {
                fail( "option '$arg' requires an argument\n$notes" );
            }
            $slots[] = array_shift( $u_argv );
            break;
        }
        case "--tag" : {
            array_shift( $u_argv );
            if ( !count( $u_argv ) ) {
                fail( "option '$arg' requires an argument\n$notes" );
            }
            $tag = array_shift( $u_argv );
            break;
        }
        case "--limit" : {
            array_shift( $u_argv );
            if ( !count( $u_argv ) ) {
                fail( "option '$arg' requires an argument\n$notes" );
            }
            $limit = intval( array_shift( $u_argv ) );
            break;
        }
        case "--log" : {
            array_shift( $u_argv );
            if ( !count( $u_argv ) ) {
                fail( "option '$arg' requires an argument\n$notes" );
            }
            $logfile = array_shift( $u_argv );
            break;
        }
      default :
        fail( "unknown option '$u_argv[0]'\n$notes" );
    }
}

## nothing without being asked

if ( !$anyargs || count( $u_argv ) || !count( $reports ) ) {
    echo $notes;
    exit;
}

## ---------------- locate the log ----------------

$cfg = file_exists( "em_config.json" ) ? json_decode( file_get_contents( "em_config.json" ) ) : null;

if ( !strlen( $logfile ) ) {
    if ( !isset( $cfg->logfile ) ) {
        fail( "em_config.json missing or has no logfile, name the log with --log" );
    }

    $logfile = $cfg->logfile;
}

## acquire() polls every sleep:acquire_wait seconds and only sleeps when it
## found nothing idle, so a gap that long means the request really did queue.
## anything shorter is just the cost of starting php and taking the state lock.

$queue_wait = isset( $cfg->sleep->acquire_wait ) ? $cfg->sleep->acquire_wait : 15;

if ( substr( $logfile, 0, 1 ) != "/" ) {
    $logfile = "$emdir/$logfile";
}

if ( !file_exists( $logfile ) ) {
    fail( "log $logfile does not exist" );
}

## ---------------- parse ----------------

function dur( $s ) {
    if ( $s < 0 ) {
        return "?";
    }
    if ( $s < 60 ) {
        return sprintf( "%ds", $s );
    }
    if ( $s < 3600 ) {
        return sprintf( "%dm%02ds", intdiv( $s, 60 ), $s % 60 );
    }
    if ( $s < 86400 ) {
        return sprintf( "%dh%02dm", intdiv( $s, 3600 ), intdiv( $s % 3600, 60 ) );
    }
    return sprintf( "%dd%02dh", intdiv( $s, 86400 ), intdiv( $s % 86400, 3600 ) );
}

$events   = [];
$unparsed = 0;
$lines    = 0;

$fh = fopen( $logfile, "r" );

if ( !$fh ) {
    fail( "could not read $logfile" );
}

while ( ( $line = fgets( $fh ) ) !== false ) {
    $line = rtrim( $line, "\r\n" );

    if ( !strlen( trim( $line ) ) ) {
        continue;
    }

    ++$lines;

    if ( !preg_match( '/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) - (.*)$/', $line, $m ) ) {
        ++$unparsed;
        continue;
    }

    $e = (object)[
        "ts"    => strtotime( $m[ 1 ] . " UTC" )
        ,"when" => $m[ 1 ]
        ,"type" => "other"
        ,"slot" => ""
        ,"tag"  => ""
        ,"msg"  => $m[ 2 ]
        ];

    $msg = $m[ 2 ];

    ## the grant line is the request line plus a suffix, so test it first

    if ( preg_match( '/^em_client\.php : acquire flavor (\S+) tag (.*), acquired (\d+) ip (\S+)$/', $msg, $g ) ) {
        $e->type = "grant";
        $e->tag  = $g[ 2 ];
        $e->slot = $g[ 3 ];
    } else if ( preg_match( '/^em_client\.php : acquire flavor (\S+) tag (.*)$/', $msg, $g ) ) {
        $e->type = "request";
        $e->tag  = $g[ 2 ];
    } else if ( preg_match( '/^em_client\.php : release (\d+)$/', $msg, $g ) ) {
        $e->type = "release";
        $e->slot = $g[ 1 ];
    } else if ( preg_match( '/^(shelve|unshelve|launch|delete) (\d+)$/', $msg, $g ) ) {
        $e->type = $g[ 1 ];
        $e->slot = $g[ 2 ];
    } else if ( preg_match( '/^STARTUP/', $msg ) ) {
        $e->type = "startup";
    } else if ( preg_match( '/^SHUTDOWN/', $msg ) ) {
        $e->type = "shutdown";
    } else if ( preg_match( '/^WARNING: /', $msg ) ) {
        $e->type = "warning";
    } else if ( preg_match( '/^ERROR/', $msg ) ) {
        $e->type = "error";
    }

    $events[] = $e;
}

fclose( $fh );

if ( $since ) {
    $events = array_values( array_filter( $events, function( $e ) use ( $since ) {
        return $e->ts >= $since;
    } ) );
}

if ( !count( $events ) ) {
    echo "no log entries in range\n";
    exit;
}

## ---------------- build sessions ----------------

$waits    = [];   ## tag => [ request ts, ... ] awaiting a grant
$open     = [];   ## slot => session still held
$sessions = [];
$orphans  = [];   ## releases with no acquire seen in this window
$ungranted = [];  ## requests that never got a grant

foreach ( $events as $e ) {

    if ( $e->type == "request" ) {
        $waits[ $e->tag ][] = $e->ts;
        continue;
    }

    if ( $e->type == "grant" ) {
        $wait = null;

        if ( isset( $waits[ $e->tag ] ) && count( $waits[ $e->tag ] ) ) {
            $wait = $e->ts - array_shift( $waits[ $e->tag ] );
        }

        ## a grant on a slot already open means the release was never logged

        if ( isset( $open[ $e->slot ] ) ) {
            $open[ $e->slot ]->end  = null;
            $open[ $e->slot ]->note = "no release logged";
            $sessions[] = $open[ $e->slot ];
        }

        $open[ $e->slot ] = (object)[
            "slot"   => $e->slot
            ,"tag"   => $e->tag
            ,"start" => $e->ts
            ,"end"   => null
            ,"wait"  => $wait
            ,"note"  => ""
            ];
        continue;
    }

    if ( $e->type == "release" ) {
        if ( isset( $open[ $e->slot ] ) ) {
            $open[ $e->slot ]->end = $e->ts;
            $sessions[] = $open[ $e->slot ];
            unset( $open[ $e->slot ] );
        } else {
            $orphans[] = $e;
        }
    }
}

foreach ( $waits as $t => $list ) {
    foreach ( $list as $ts ) {
        $ungranted[] = (object)[ "tag" => $t, "ts" => $ts ];
    }
}

$held = array_values( $open );

usort( $sessions, function( $a, $b ) { return $a->start - $b->start; } );
usort( $held,     function( $a, $b ) { return $a->start - $b->start; } );

## ---------------- filters ----------------

$filter = function( $s ) use ( $slots, $tag ) {
    if ( count( $slots ) && !in_array( $s->slot, $slots ) ) {
        return false;
    }
    if ( strlen( $tag ) && strpos( $s->tag, $tag ) === false ) {
        return false;
    }
    return true;
};

$sessions_f = array_values( array_filter( $sessions, $filter ) );
$held_f     = array_values( array_filter( $held, $filter ) );

## cap() keeps the most recent rows and says so, a silent truncation here would
## read as "that is all there is"

function cap( $rows, $limit ) {
    if ( $limit > 0 && count( $rows ) > $limit ) {
        echo sprintf( "  ... %d earlier rows not shown, --limit %d\n", count( $rows ) - $limit, $limit );
        return array_slice( $rows, -$limit );
    }
    return $rows;
}

$now = time();

echo sprintf( "log     : %s\n", $logfile );
echo sprintf( "window  : %s .. %s (%d entries%s)\n\n"
              ,$events[ 0 ]->when
              ,$events[ count( $events ) - 1 ]->when
              ,count( $events )
              ,$unparsed ? ", $unparsed unparsed" : "" );

## ---------------- held ----------------

if ( isset( $reports[ "held" ] ) ) {
    echo "still held, no release logged:\n\n";

    if ( !count( $held_f ) ) {
        echo "  none\n\n";
    } else {
        echo sprintf( "  %-5s %-20s %-9s %s\n", "slot", "acquired (UTC)", "age", "tag" );
        foreach ( cap( $held_f, $limit ) as $s ) {
            echo sprintf( "  %-5s %-20s %-9s %s\n"
                          ,$s->slot
                          ,date( 'Y-m-d H:i:s', $s->start )
                          ,dur( $now - $s->start )
                          ,$s->tag );
        }
        echo "\n";
    }
}

## ---------------- sessions ----------------

if ( isset( $reports[ "sessions" ] ) ) {
    echo "sessions:\n\n";

    if ( !count( $sessions_f ) && !count( $held_f ) ) {
        echo "  none\n\n";
    } else {
        echo sprintf( "  %-5s %-20s %-20s %-8s %-9s %s\n"
                      ,"slot", "acquired (UTC)", "released (UTC)", "wait", "held", "tag" );

        $rows = array_merge( $sessions_f, $held_f );
        usort( $rows, function( $a, $b ) { return $a->start - $b->start; } );

        foreach ( cap( $rows, $limit ) as $s ) {
            echo sprintf( "  %-5s %-20s %-20s %-8s %-9s %s%s\n"
                          ,$s->slot
                          ,date( 'Y-m-d H:i:s', $s->start )
                          ,$s->end ? date( 'Y-m-d H:i:s', $s->end ) : "-- still held --"
                          ,$s->wait === null ? "-" : dur( $s->wait )
                          ,dur( ( $s->end ? $s->end : $now ) - $s->start )
                          ,$s->tag
                          ,strlen( $s->note ) ? "  [$s->note]" : "" );
        }
        echo "\n";
    }
}

## ---------------- summary ----------------

if ( isset( $reports[ "summary" ] ) ) {
    $counts = [];

    foreach ( $events as $e ) {
        $counts[ $e->type ] = isset( $counts[ $e->type ] ) ? $counts[ $e->type ] + 1 : 1;
    }

    function n( $counts, $k ) {
        return isset( $counts[ $k ] ) ? $counts[ $k ] : 0;
    }

    function pct( $sorted, $p ) {
        if ( !count( $sorted ) ) {
            return 0;
        }
        return $sorted[ (int) floor( $p * ( count( $sorted ) - 1 ) ) ];
    }

    $holds = [];
    foreach ( $sessions as $s ) {
        if ( $s->end ) {
            $holds[] = $s->end - $s->start;
        }
    }
    sort( $holds );

    $waited = [];
    foreach ( array_merge( $sessions, $held ) as $s ) {
        if ( $s->wait !== null && $s->wait >= $queue_wait ) {
            $waited[] = $s->wait;
        }
    }
    sort( $waited );

    $granted = n( $counts, "grant" );

    echo "summary:\n\n";

    echo sprintf( "  daemon      %d startup, %d shutdown\n", n( $counts, "startup" ), n( $counts, "shutdown" ) );

    echo sprintf( "  acquires    %d requested, %d granted, %d never granted\n"
                  ,n( $counts, "request" ), $granted, count( $ungranted ) );

    echo sprintf( "  queue wait  %d granted at once, %d queued past %ss%s\n"
                  ,$granted - count( $waited )
                  ,count( $waited )
                  ,$queue_wait
                  ,count( $waited )
                   ? sprintf( ": median %s, longest %s", dur( pct( $waited, 0.5 ) ), dur( end( $waited ) ) )
                   : "" );

    echo sprintf( "  releases    %d, %d with no acquire in this window\n"
                  ,n( $counts, "release" ), count( $orphans ) );

    echo sprintf( "  still held  %d\n", count( $held ) );

    echo count( $holds )
        ? sprintf( "  hold time   n=%d  min %s  median %s  p90 %s  max %s\n"
                   ,count( $holds ), dur( $holds[ 0 ] ), dur( pct( $holds, 0.5 ) )
                   ,dur( pct( $holds, 0.9 ) ), dur( end( $holds ) ) )
        : "  hold time   no completed sessions\n";

    echo sprintf( "  pool churn  launch %d, shelve %d, unshelve %d, delete %d\n"
                  ,n( $counts, "launch" ), n( $counts, "shelve" )
                  ,n( $counts, "unshelve" ), n( $counts, "delete" ) );

    echo sprintf( "  problems    %d warning, %d error\n\n"
                  ,n( $counts, "warning" ), n( $counts, "error" ) );
}

## ---------------- events ----------------

if ( isset( $reports[ "events" ] ) ) {
    $rows = array_values( array_filter( $events, function( $e ) use ( $slots, $tag ) {
        if ( count( $slots ) && !in_array( $e->slot, $slots ) ) {
            return false;
        }
        if ( strlen( $tag ) && strpos( $e->msg, $tag ) === false ) {
            return false;
        }
        return true;
    } ) );

    echo "events:\n\n";

    foreach ( cap( $rows, $limit ) as $e ) {
        echo sprintf( "  %s  %-9s %-4s %s\n", $e->when, $e->type, $e->slot, $e->msg );
    }
    echo "\n";
}

## ---------------- problems ----------------

if ( isset( $reports[ "problems" ] ) ) {
    $rows = array_values( array_filter( $events, function( $e ) {
        return $e->type == "warning" || $e->type == "error";
    } ) );

    echo "problems:\n\n";

    if ( !count( $rows ) ) {
        echo "  none\n\n";
    } else {
        foreach ( cap( $rows, $limit ) as $e ) {
            echo sprintf( "  %s  %s\n", $e->when, $e->msg );
        }
        echo "\n";
    }
}
