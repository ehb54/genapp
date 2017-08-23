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
    $results[ "error" ] = "No _logon specified in the request";
    echo (json_encode($results));
    exit();
}

$appconfig = json_decode( file_get_contents( "/home/ehb/demo/appconfig.json" ) );

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

date_default_timezone_set("UTC");

function db_connect( $error_json_exit = false ) {
   global $use_db;
   global $db_errors;

   if ( !isset( $use_db ) ) {
      try {
         $use_db = new MongoClient();
      } catch ( Exception $e ) {
         $db_errors = "Could not connect to the db " . $e->getMessage();
         if ( $error_json_exit )
         {
            $results = array( "error" => $db_errors );
            $results[ '_status' ] = 'complete';
            echo (json_encode($results));
            exit();
         }
         return false;
      }
   }

   return true;
}

$allresources = array_keys( (array) $appconfig->resources );

$results = [];

db_connect( true );

function integrity() {
    global $use_db;
    global $db_errors;
    global $todo;
    global $cmdlineeq;
    global $runningremove;
    global $appsbyid;
    global $pidkill;
    $retval = "";

# -------------- 1st get all apps  --------------

    $apps = [];
    $docs = $use_db->global->apps->find();
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

        $docs = $use_db->{$v}->running->find();

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
                $pidkill[] = $k;
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
    if ( $_REQUEST[ "fixerrors" ] ) {
        $results[ '_textarea' ] .= "========================================\n";
        foreach ( $pidkill as $v ) {
            $results[ '_textarea' ] .= "posix_kill( $v )";
            posix_kill( $v, SIGTERM );
        }
        foreach ( $runningremove as $v ) {
            $results[ '_textarea' ] .= "mongo remove $appsbyid[$v] $v\n";
            $use_db->{$appsbyid[$v]}->running->remove( [ "_id" => $v ] );
        }
            
        $results[ '_textarea' ] .= "========================================\n";
        $results[ 'jobintegrityreport' ] = "Errors present, fixed.";
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
    
echo json_encode( $results );

?>
