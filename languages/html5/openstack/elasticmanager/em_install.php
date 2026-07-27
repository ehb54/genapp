#!/usr/bin/php
<?php

{}

## no require_once on purpose: this tool has to keep working when the files it
## installs are the broken ones

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

hot install elastic manager files from a git ref: validate, back up, then
replace by rename so a concurrent em_client.php can never read a partial file

    Options

    --help              : print this information and exit

    --ref <ref>         : git ref to install from (default origin/php7designer)
    --fetch             : git fetch origin before comparing
    --diff              : show pending changes and their restart impact, then exit
    --install           : install pending changes
    --only <file>       : restrict to one file, may be repeated
    --force             : allow an em_config.json identity change, see below
    --rollback          : restore the most recent backup set
    --backups           : list backup sets

    One of --diff, --install, --rollback or --backups must be given. With no
    action this prints help and does nothing.

    Restart impact is reported per file. Nothing here restarts the daemon; when
    a restart is needed the command is printed.

    An em_config.json change to project, id or a flavor name is refused without
    --force. reload_state() finds instances by a name built from those three, so
    changing any of them makes every tracked instance unmatchable and drops it
    from the state file, including instances currently in use.

    Every incoming file is syntax checked before anything is replaced, so a bad
    commit is refused with the running copy untouched. After installing,
    em_client.php --status is run as a check; if that fails the whole set is
    rolled back automatically, because a broken em_openstack.php breaks acquire
    and release for every running job.

__EOD;

## scope drives what the operator has to do after installing a given file

$em_scope = [
    "em_client.php"     => "client"
    ,"em_openstack.php" => "shared"
    ,"em_common.php"    => "shared"
    ,"em_mail.php"      => "shared"
    ,"em_config.php"    => "shared"
    ,"em_service.php"   => "daemon"
    ,"em_config.json"   => "config"
    ,"em_start.sh"      => "standalone"
    ,"em_test.php"      => "standalone"
    ,"em_test_mail.php" => "standalone"
    ,"em_install.php"   => "standalone"
    ];

$em_scope_notes = [
    "client"      => "hot, applies to the next em_client.php run"
    ,"shared"     => "hot for em_client.php, the running daemon keeps its loaded copy until restarted"
    ,"daemon"     => "no effect until the daemon is restarted"
    ,"config"     => "no effect until the daemon is restarted, config is read once at startup"
    ,"standalone" => "no effect on the running system"
    ];

function fail( $msg ) {
    echo "ERROR: $msg\n";
    exit( 1 );
}

function run( $cmd, &$code = null ) {
    $out = [];
    exec( "$cmd 2>&1", $out, $code );
    return $out;
}

## git() runs from $gitdir, which becomes the repo root once we know it.
## pathspecs resolve relative to git's cwd, so they must be root relative there.

$gitdir = $emdir;

function git( $args, &$code = null ) {
    global $gitdir;
    return run( "git -C " . escapeshellarg( $gitdir ) . " $args", $code );
}

## validate() - syntax check by file type, returns "" when ok.
## the type comes from $name, not $path: $path is a staging file whose name
## carries a pid suffix, so its own extension is meaningless

function validate( $path, $name ) {
    $ext = pathinfo( $name, PATHINFO_EXTENSION );

    switch( $ext ) {
        case "php" : {
            $out = run( "php -l " . escapeshellarg( $path ), $code );
            return $code ? implode( "\n", $out ) : "";
        }
        case "json" : {
            json_decode( file_get_contents( $path ) );
            return json_last_error() == JSON_ERROR_NONE ? "" : json_last_error_msg();
        }
        case "sh" : {
            $out = run( "bash -n " . escapeshellarg( $path ), $code );
            return $code ? implode( "\n", $out ) : "";
        }
    }
    return "";
}

## git_mode() - permissions the ref says this file should have

function git_mode( $ref, $path ) {
    $out = git( "ls-tree " . escapeshellarg( $ref ) . " -- " . escapeshellarg( $path ) );
    return ( count( $out ) && substr( $out[ 0 ], 0, 6 ) == "100755" ) ? 0755 : 0644;
}

## service_pid() - the daemon holds its lock as a symlink to /proc/<pid>

function service_pid() {
    if ( !file_exists( "em_config.json" ) ) {
        return false;
    }

    $cfg = json_decode( file_get_contents( "em_config.json" ) );

    if ( !isset( $cfg->files->lockdir ) ) {
        return false;
    }

    $lock = $cfg->files->lockdir . "/em-service.lock";

    if ( !is_link( $lock ) || ( $link = readlink( $lock ) ) === false ) {
        return false;
    }

    return preg_match( '#/proc/(\d+)#', $link, $m ) ? $m[ 1 ] : false;
}

## pool_summary() - what the pool is doing right now, for restart timing

function pool_summary() {
    global $emdir;

    if ( !file_exists( "em_config.json" ) ) {
        return "em_config.json not readable, pool state unknown";
    }

    $cfg = json_decode( file_get_contents( "em_config.json" ) );

    if ( !isset( $cfg->files->state ) ) {
        return "em_config.json does not define files:state, pool state unknown";
    }

    $statefile = $cfg->files->state;

    if ( substr( $statefile, 0, 1 ) != "/" ) {
        $statefile = "$emdir/$statefile";
    }

    if ( !file_exists( $statefile ) ) {
        return "no state file yet";
    }

    ## read only, no lock: this is a report, not a decision the daemon acts on

    $state = json_decode( file_get_contents( $statefile ) );

    if ( !isset( $state ) ) {
        return "state file is not valid json";
    }

    $in_use  = [];
    $pending = [];

    foreach ( (array) $state as $k => $v ) {
        if ( isset( $v->use_status ) && $v->use_status == "in use" ) {
            $in_use[] = $k;
        }
        if ( isset( $v->status ) && ( $v->status == "BUILD" || $v->status == "SHELVING" ) ) {
            $pending[] = $k;
        }
    }

    return sprintf( "%d in use [%s], %d mid operation [%s]"
                    ,count( $in_use ), implode( ",", $in_use )
                    ,count( $pending ), implode( ",", $pending )
        );
}

## restore_set() - put a backup set back, same atomic rename as install

function restore_set( $dir ) {
    global $emdir;

    $restored = [];

    foreach ( array_diff( scandir( $dir ), [ ".", ".." ] ) as $f ) {
        $src = "$dir/$f";
        $tmp = "$emdir/$f.rollback." . getmypid();

        if ( !copy( $src, $tmp ) ) {
            fail( "could not stage $f for rollback" );
        }

        chmod( $tmp, fileperms( $src ) & 0777 );

        if ( !rename( $tmp, "$emdir/$f" ) ) {
            @unlink( $tmp );
            fail( "could not restore $f" );
        }

        $restored[] = $f;
    }

    return $restored;
}

## config_identity() - the three fields reload_state() builds instance names from

function config_identity( $file ) {
    $cfg = json_decode( file_get_contents( $file ) );

    if ( !isset( $cfg ) ) {
        return false;
    }

    return [
        "project"  => isset( $cfg->project ) ? $cfg->project : "?"
        ,"id"      => isset( $cfg->id )      ? $cfg->id      : "?"
        ,"flavors" => isset( $cfg->flavors ) ? implode( ",", array_keys( (array) $cfg->flavors ) ) : "?"
        ];
}

$u_argv = $argv;
array_shift( $u_argv );

$ref     = "origin/php7designer";
$only    = [];
$action  = "";
$fetch   = false;
$force   = false;

while( count( $u_argv ) && substr( $u_argv[ 0 ], 0, 1 ) == "-" ) {
    switch( $arg = $u_argv[ 0 ] ) {
        case "--help" : {
            echo $notes;
            exit;
        }
        case "--ref" : {
            array_shift( $u_argv );
            if ( !count( $u_argv ) ) {
                fail( "option '$arg' requires an argument\n$notes" );
            }
            $ref = array_shift( $u_argv );
            break;
        }
        case "--only" : {
            array_shift( $u_argv );
            if ( !count( $u_argv ) ) {
                fail( "option '$arg' requires an argument\n$notes" );
            }
            $only[] = basename( array_shift( $u_argv ) );
            break;
        }
        case "--fetch" : {
            array_shift( $u_argv );
            $fetch = true;
            break;
        }
        case "--force" : {
            array_shift( $u_argv );
            $force = true;
            break;
        }
        case "--diff" :
        case "--install" :
        case "--rollback" :
        case "--backups" : {
            array_shift( $u_argv );
            if ( strlen( $action ) ) {
                fail( "'--$action' and '$arg' are mutually exclusive" );
            }
            $action = substr( $arg, 2 );
            break;
        }
      default :
        fail( "unknown option '$u_argv[0]'\n$notes" );
    }
}

if ( count( $u_argv ) ) {
    fail( "unexpected argument '$u_argv[0]'\n$notes" );
}

## no action without being asked for one, not even a read only one

if ( !strlen( $action ) ) {
    echo $notes;
    exit;
}

$backuproot = ( getenv( "HOME" ) ? getenv( "HOME" ) : $emdir ) . "/.em_install_backups";

## ---------------- backups ----------------

if ( $action == "backups" || $action == "rollback" ) {
    $sets = is_dir( $backuproot ) ? array_diff( scandir( $backuproot, SCANDIR_SORT_DESCENDING ), [ ".", ".." ] ) : [];

    ## skip empty sets so --rollback cannot pick one and silently restore nothing

    $sets = array_filter( $sets, function( $s ) use ( $backuproot ) {
        return is_dir( "$backuproot/$s" ) && count( array_diff( scandir( "$backuproot/$s" ), [ ".", ".." ] ) );
    } );

    if ( !count( $sets ) ) {
        echo "no backup sets under $backuproot\n";
        exit;
    }

    if ( $action == "backups" ) {
        echo "backup sets under $backuproot:\n";
        foreach ( $sets as $s ) {
            $files = array_diff( scandir( "$backuproot/$s" ), [ ".", ".." ] );
            echo sprintf( "  %s  %s\n", $s, implode( " ", $files ) );
        }
        exit;
    }

    $latest = reset( $sets );
    echo "rolling back from $backuproot/$latest\n";

    foreach ( restore_set( "$backuproot/$latest" ) as $f ) {
        echo "  restored $f\n";
    }

    echo "\nrolled back. pool: " . pool_summary() . "\n";
    exit;
}

## ---------------- diff / install ----------------

git( "rev-parse --git-dir", $code );

if ( $code ) {
    fail( "$emdir is not inside a git clone, cannot install from a ref" );
}

if ( $fetch ) {
    echo "fetching origin...\n";
    $out = git( "fetch origin", $code );
    if ( $code ) {
        fail( "git fetch failed:\n" . implode( "\n", $out ) );
    }
}

## accept a bare branch name for a remote branch, the way git checkout does.
## git rev-parse does not do that on its own, so try origin/<ref> too

$resolved = "";

foreach ( [ $ref, "origin/$ref" ] as $try ) {
    git( "rev-parse --verify " . escapeshellarg( "$try^{commit}" ), $code );

    if ( !$code ) {
        $resolved = $try;
        break;
    }
}

if ( !strlen( $resolved ) ) {
    fail( $fetch
          ? "ref '$ref' not found after fetching, tried '$ref' and 'origin/$ref'"
          : "ref '$ref' not found as '$ref' or 'origin/$ref', try --fetch" );
}

$ref = $resolved;

## capture the prefix while git is still running from $emdir, then move it to
## the repo root for everything after

$prefix = git( "rev-parse --show-prefix" );
$prefix = count( $prefix ) && strlen( $prefix[ 0 ] ) ? rtrim( $prefix[ 0 ], "/" ) . "/" : "";

$toplevel = git( "rev-parse --show-toplevel" );

if ( count( $toplevel ) && is_dir( $toplevel[ 0 ] ) ) {
    $gitdir = $toplevel[ 0 ];
}

foreach ( $only as $f ) {
    if ( !isset( $em_scope[ $f ] ) ) {
        fail( "'$f' is not an elastic manager file" );
    }
}

$changed = [];

foreach ( array_keys( $em_scope ) as $f ) {
    if ( count( $only ) && !in_array( $f, $only ) ) {
        continue;
    }

    git( "diff --quiet " . escapeshellarg( $ref ) . " -- " . escapeshellarg( "$prefix$f" ), $code );

    if ( $code == 1 ) {
        $changed[] = $f;
    }
}

echo "ref     : $ref (" . trim( implode( "", git( "rev-parse --short " . escapeshellarg( $ref ) ) ) ) . ")\n";
echo "dir     : $emdir\n";
echo "pool    : " . pool_summary() . "\n\n";

if ( !count( $changed ) ) {
    echo "nothing to install, all files match the ref\n";
    exit;
}

echo "pending changes:\n\n";

$scopes_seen = [];

foreach ( $changed as $f ) {
    $scope = $em_scope[ $f ];
    $scopes_seen[ $scope ] = true;
    echo sprintf( "  %-18s %-11s %s\n", $f, "[$scope]", $em_scope_notes[ $scope ] );
}

echo "\n";

## identity guard on em_config.json

$identity_change = false;

if ( in_array( "em_config.json", $changed ) ) {
    $tmp = "$emdir/em_config.json.check." . getmypid();
    system( "git -C " . escapeshellarg( $gitdir ) . " show " . escapeshellarg( "{$ref}:{$prefix}em_config.json" ) . " > " . escapeshellarg( $tmp ) . " 2>/dev/null", $code );

    $now = config_identity( "$emdir/em_config.json" );
    $new = $code ? false : config_identity( $tmp );

    @unlink( $tmp );

    if ( $now === false || $new === false ) {
        echo "WARNING: could not compare em_config.json identity fields\n\n";
    } else {
        foreach ( $now as $k => $v ) {
            if ( $v !== $new[ $k ] ) {
                $identity_change = true;
                echo sprintf( "IDENTITY CHANGE: em_config.json %s '%s' -> '%s'\n", $k, $v, $new[ $k ] );
            }
        }
        if ( $identity_change ) {
            echo "\n  reload_state() matches instances by a name built from project, id and\n"
                . "  flavor. Installing this drops every tracked instance from the state file\n"
                . "  on the next daemon reconcile, including any in use, and leaves the VMs\n"
                . "  running untracked. Drain the pool first.\n\n";
        }
    }
}

if ( $action == "diff" ) {
    foreach ( $changed as $f ) {
        ## -R so the diff reads working tree -> ref, the direction install applies

        $d = git( "diff -R --no-color " . escapeshellarg( $ref ) . " -- " . escapeshellarg( "$prefix$f" ) );

        echo str_repeat( "-", 72 ) . "\n";
        if ( count( $d ) ) {
            echo implode( "\n", $d ) . "\n";
        }
    }
    echo str_repeat( "-", 72 ) . "\n";
    echo "\nthis was a dry run, use --install to apply\n";
    exit;
}

if ( $identity_change && !$force ) {
    fail( "refusing to install an em_config.json identity change without --force" );
}

## ---------------- install ----------------

## stage and validate every file before replacing any of them, so one bad file
## cannot leave a set half applied

$staged = [];

function discard_staged() {
    global $staged;
    foreach ( $staged as $t ) {
        @unlink( $t );
    }
}

foreach ( $changed as $f ) {

    ## stage next to the target so the replace is a same filesystem rename

    $tmp = "$emdir/$f.new." . getmypid();

    system( "git -C " . escapeshellarg( $gitdir ) . " show " . escapeshellarg( "{$ref}:{$prefix}{$f}" ) . " > " . escapeshellarg( $tmp ) . " 2>/dev/null", $code );

    if ( $code ) {
        discard_staged();
        @unlink( $tmp );
        fail( "could not read $f from $ref, nothing replaced" );
    }

    if ( strlen( $err = validate( $tmp, $f ) ) ) {
        discard_staged();
        @unlink( $tmp );
        fail( "$f from $ref does not validate, nothing replaced:\n$err" );
    }

    chmod( $tmp, git_mode( $ref, "$prefix$f" ) );

    $staged[ $f ] = $tmp;
}

$stamp     = date( 'Ymd-His' );
$backupdir = "$backuproot/$stamp";

if ( !is_dir( $backupdir ) && !mkdir( $backupdir, 0700, true ) ) {
    discard_staged();
    fail( "could not create backup directory $backupdir" );
}

echo "backing up to $backupdir\n\n";

foreach ( $staged as $f => $tmp ) {
    if ( file_exists( "$emdir/$f" ) && !copy( "$emdir/$f", "$backupdir/$f" ) ) {
        discard_staged();
        fail( "could not back up $f, nothing replaced" );
    }
}

$installed = [];

foreach ( $staged as $f => $tmp ) {
    if ( !rename( $tmp, "$emdir/$f" ) ) {
        discard_staged();
        fail( "could not replace $f"
              . ( count( $installed ) ? ", already replaced " . implode( " ", $installed ) . ", roll back with php $self --rollback" : ", nothing replaced" ) );
    }

    $installed[] = $f;
    echo "  installed $f\n";
}

## ---------------- post install check ----------------

echo "\nchecking em_client.php still runs...\n";

$out = run( "php " . escapeshellarg( "$emdir/em_client.php" ) . " --status", $code );

if ( $code || !count( preg_grep( '/needed idle/', $out ) ) ) {
    echo "\nFAILED: em_client.php --status did not run cleanly after install\n\n";
    echo implode( "\n", array_slice( $out, 0, 20 ) ) . "\n\n";

    ## acquire and release are broken for as long as this stands, so undo it
    ## rather than leaving it for someone to notice

    echo "rolling back automatically:\n";

    foreach ( restore_set( $backupdir ) as $f ) {
        echo "  restored $f\n";
    }

    $out = run( "php " . escapeshellarg( "$emdir/em_client.php" ) . " --status", $code );

    if ( !$code && count( preg_grep( '/needed idle/', $out ) ) ) {
        echo "\nrolled back, em_client.php works again. nothing was installed.\n\n";
    } else {
        echo "\nROLLBACK DID NOT RESTORE A WORKING em_client.php, INTERVENE NOW.\n";
        echo "backup set: $backupdir\n\n";
    }

    exit( 1 );
}

echo "  ok\n\n";

## ---------------- what is left to do ----------------

$needs_restart = array_intersect( [ "daemon", "config" ], array_keys( $scopes_seen ) );
$has_shared    = isset( $scopes_seen[ "shared" ] );

echo "installed " . count( $installed ) . " file" . ( count( $installed ) == 1 ? "" : "s" ) . " from $ref\n";
echo "backup   : $backupdir\n";
echo "rollback : php $self --rollback\n\n";

if ( count( $needs_restart ) ) {
    echo "A DAEMON RESTART IS REQUIRED for these changes to take effect:\n";
    foreach ( $changed as $f ) {
        if ( in_array( $em_scope[ $f ], [ "daemon", "config" ] ) ) {
            echo "  $f\n";
        }
    }
    echo "\npool: " . pool_summary() . "\n";
    echo "\nin use slots keep their bookkeeping across a restart, reload_state() only\n"
        . "rewrites status for instances it still matches. acquire and release keep\n"
        . "working while the daemon is down, only rebalancing pauses. Prefer a moment\n"
        . "with nothing mid operation. To restart:\n\n";

    if ( ( $pid = service_pid() ) !== false ) {
        echo "  kill $pid\n";
    } else {
        echo "  ## daemon pid not readable from the lock file, find it by hand\n";
        echo "  pkill -f 'php em_service.php'\n";
    }

    echo "  cd $emdir && ./em_start.sh\n\n";
} else if ( $has_shared ) {
    echo "No restart needed for the running daemon to stay correct. It keeps its\n"
        . "loaded copy and will pick these up whenever it is next restarted.\n\n";
} else {
    echo "No restart needed.\n\n";
}
