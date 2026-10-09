#!/usr/local/bin/php
<?php

$_REQUEST = json_decode( $argv[ 1 ], true );


$results = [];

if ( !sizeof( $_REQUEST ) ) {
    $results[ 'error' ] = "PHP code received no \$_REQUEST?";
    echo (json_encode($results));
    exit();
}

if ( !isset( $_REQUEST[ '_uuid' ] ) ) {
    $results[ "error" ] = "No _uuid specified in the request";
    echo (json_encode($results));
    exit();
}

if ( !isset( $_REQUEST[ '_logon' ] ) ) {
    $results[ "error" ] = "No logon specified in the request";
    echo (json_encode($results));
    exit();
}

$appconfig = json_decode( file_get_contents( "__appconfig__" ) );

if ( !isset( $appconfig->restricted ) ) {
    $results[ "error" ] = "appconfig.json no restrictions defined";
    echo (json_encode($results));
    exit();
}    

if ( !isset( $appconfig->restricted->admin ) ) {
    $results[ "error" ] = "appconfig.json no adminstrators defined";
    echo (json_encode($results));
    exit();
}    

if ( !in_array( $_REQUEST[ '_logon' ], $appconfig->restricted->admin ) ) {
    $results[ "error" ] = "not an administrator";
    echo (json_encode($results));
    exit();
}    

// False checkbox strings must never authorize repair. Reject malformed values.
$fix_value = $_REQUEST['fixerrors'] ?? false;
$fix_errors = is_scalar($fix_value)
    ? filter_var($fix_value, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE)
    : null;
if ($fix_errors === null) {
    echo json_encode(['error' => 'Invalid Fix errors value; no repairs performed.']);
    exit();
}
require_once "__docroot:html5__/__application__/ajax/ga_db_lib.php";

$allresources = array_keys( (array) $appconfig->resources );

$results = [];

if (!ga_db_status(ga_db_open(true))) {
    echo json_encode(['error' => 'Cannot open database; no repairs performed.']);
    exit();
}

function iterator_to_array_if_needed($value) {
    return $value instanceof Traversable ? iterator_to_array($value, false) : (array) $value;
}

function integrity() {
    global $todo;
    global $cmdlineeq;
    global $runningremove;
    global $appsbyid;
    global $pidkill;
    $retval = "";

# -------------- 1st get all apps  --------------

    $apps = [];
    $query = ga_db_find('apps', 'global');
    if (!ga_db_status($query)) {
        echo json_encode(['error' => 'Cannot read application records; no repairs performed.']);
        exit();
    }
    $docs = ga_db_output($query);
    foreach ( $docs as $this_doc ) {
        $apps[] =  $this_doc[ "_id" ];
    }

    foreach ( $apps as $v ) {
        $retval .= "apps $v\n";
    }

# -------------- get all php jobrun ids --------------

    $cmd = "env COLUMNS=1000 ps -ef | grep jobrun.php | grep -v grep | awk '{ print \$2 \":\" \$10 \":\" \$11 }'";

    $results = `$cmd`;
    $phpids = preg_split( "/\n/", $results, -1, PREG_SPLIT_NO_EMPTY );

    $phpidsa = [];
    $allidsa = [];

    foreach ( $phpids as $v ) {
        $results = preg_match( '/^([^:]*):([^:]*):([^:]*)$/', $v, $matches );
        if (!$results || !ctype_digit($matches[1])) continue;
        $pid = $matches[ 1 ];
        $user = $matches[ 2 ];
        $jid = $matches[ 3 ];
        
#        if ( $jid == $_REQUEST[ "_uuid" ] ) {
#            continue;
#        }
        $retval .= "phpid [$v]\n";
        $pids[ $jid ] = $pid;
        $users[ $jid ] = $user;
        $phpidsa[ $jid ] = 1;
        $allidsa[ $jid ] = 1;
    }

# -------------- get all running job ids --------------

    $runningidsa = [];

    foreach ( $apps as $v ) {
        $retval .= "check running apps $v\n";

        $query = ga_db_find('running', $v);
        if (!ga_db_status($query)) {
            echo json_encode(['error' => "Cannot read running records for $v; no repairs performed."]);
            exit();
        }
        $docs = ga_db_output($query);

        $runningids = [];
        foreach ( $docs as $this_doc ) {
            $runningids[] = $this_doc[ "_id" ];
        }

        $retval .= "------------------------------------------------------------\n";

#        if ( isset( $runningids[ $_REQUEST[ "_uuid" ] ] ) ) {
#            unset( $runningids[ $_REQUEST[ "_uuid" ] ] );
#        }

        foreach ( $runningids as $v2 ) {
            $retval .= "runningid $v2\n";
            $runningidsa[ $v2 ] = 1;
            $allidsa[ $v2 ] = 1;
            $appsbyid[ $v2 ] = $v;
        }
    }

    $todo = [];

    $runningremove = [];
    $cmdlineeq = [];
    $pidkill = [];

    foreach ( $allidsa as $k => $v ) {
        $disposition = "";
        if ( isset( $phpidsa[ $k ] ) && isset( $runningidsa[ $k ] ) ) {
            $disposition = "ok $users[$k]";
        } else {
            if ( isset( $phpidsa[ $k ] ) ) {
                $disposition = "kill php";
                if ( !isset( $todo[ $users[ $k ] ] ) ) {
                    $todo[ $users[ $k ] ] = "";
                }
                $todo[ $users[ $k ] ] .= "sudo kill $pids[$k]\n";
                $pidkill[$k] = (int) $pids[$k];
            } else {
                $disposition = "remove running";
                if ( !isset( $users[ $k ] ) ) {
                    $users[ $k ] = "unknown";
                }
                if ( !isset( $todo[ $users[ $k ] ] ) ) {
                    $todo[ $users[ $k ] ] = "";
                }
                $cmdlineeq[ $k ] = "mongo $appsbyid[$k] --eval 'db.running.remove({_id:\"$k\"})'\n";
                $runningremove[] = $k;
            }
        }

        $retval .= "$k $disposition\n";
    }

    foreach ( $todo as $k => $v ) {
        $retval .= "----------------------------------------\n";
        $retval .= "$k\n";
        $retval .= "----------------------------------------\n";
        $retval .= $v;
    }
    return $retval;
}


$results[ '_textarea' ] = integrity();
if ( !count( $pidkill ) && !count( $runningremove ) ) {
    $results[ '_textarea' ] .= "========================================\n";
    $results[ '_textarea' ] .= "All ok\n";
    $results[ '_textarea' ] .= "========================================\n";
    $results[ 'jobintegrityreport' ] = "";
} else {
    if ( $fix_errors ) {
        $results[ '_textarea' ] .= "========================================\n";
        $repair_failures = [];
        foreach ($pidkill as $job_id => $pid) {
            // The diagnostic map contains process ids, not job UUIDs.
            $ok = $pid > 1 && posix_kill($pid, SIGTERM);
            $results['_textarea'] .= "terminate process $pid: " . ($ok ? "requested" : "failed") . "\n";
            if (!$ok) $repair_failures[] = "Could not terminate process $pid";
        }
        foreach ($runningremove as $job_id) {
            $removed = ga_db_remove('running', $appsbyid[$job_id], ['_id' => $job_id]);
            $verified = ga_db_find('running', $appsbyid[$job_id], ['_id' => $job_id]);
            $remaining = ga_db_status($verified) ? iterator_to_array_if_needed(ga_db_output($verified)) : null;
            $ok = ga_db_status($removed) && $remaining !== null && count($remaining) === 0;
            $results['_textarea'] .= "remove running $appsbyid[$job_id] $job_id: " . ($ok ? "verified" : "failed") . "\n";
            if (!$ok) $repair_failures[] = "Could not verify removal of running record $job_id";
        }
        $results['jobintegrityreport'] = count($repair_failures)
            ? 'Errors present; some repairs failed.'
            : (count($pidkill) ? 'Errors present; record repairs verified, process termination requested.' : 'Errors present, fixed.');
        if (count($repair_failures)) $results['error'] = implode("; ", $repair_failures);
    } else {
        $results[ 'jobintegrityreport' ] = "Errors present.\n\n";
        $results[ '_textarea' ] .= "========================================\n";
        $results[ '_textarea' ] .= "Command line fixes posssible:\n";
        $results[ '_textarea' ] .= "========================================\n";

        foreach ( $todo as $k => $v ) {
            $results[ '_textarea' ] .= "$v";
        }
        foreach ( $runningremove as $v ) {
            $results[ '_textarea' ] .= $cmdlineeq[ $v ];
        }
    }
}
    
$results['integrity_details'] = $results['_textarea'];
echo json_encode( $results );

