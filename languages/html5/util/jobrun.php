<?php
__~debug:runjob{error_log( "jobrun start\n", 3, "/tmp/php_errors" );}
function shutdown() {
    posix_kill(posix_getpid(), SIGHUP);
    sleep(1);
    posix_kill(posix_getpid(), SIGTERM);
}

// Do some initial processing

// Switch over to daemon mode.

if ($pid = pcntl_fork())
    return;     // Parent

// ob_end_clean(); // Discard the output buffer and close

fclose(STDIN);  // Close all of the standard
fclose(STDOUT); // file descriptors as we
fclose(STDERR); // are running as a daemon.

register_shutdown_function('shutdown');

if (posix_setsid() < 0)
    return;

if ($pid = pcntl_fork())
    return;     // Parent 

__~debug:runjob{error_log( "jobrun 1\n", 3, "/tmp/php_errors" );}
date_default_timezone_set("UTC");
$logdir = "__~logdirectory{__logdirectory__/}";

if ( __~providesremoteaddr{0 && }isset( $_SERVER[ 'REMOTE_ADDR' ] ) )
{
    error_log( date( "Y M d H:i:s T", time() ) . " : " .  $argv[ 0 ] . " : called with a REMOTE_ADDR\n", 3, "/tmp/php_errors" );
    exit;
}

$cc = 1 + 3; // logon, id, checkrunning

// it might be one less, that's if no login is specified

__~debug:runjob{error_log( "jobrun 2\n", 3, "/tmp/php_errors" );}
if ( $argc < $cc - 1 || $argc > $cc )
{
    error_log( date( "Y M d H:i:s T", time() ) . " : " .  $argv[ 0 ] . " : incorrect number of arguments $argc != $cc\n", 3, "/tmp/php_errors" );
    exit;
}

$pos = 0;

$GLOBALS[ 'logon' ] = ( $argc == $cc ) ? $argv[ ++$pos ] : "";
$id = $argv[ ++$pos ];
$_REQUEST[ '_uuid' ] = $id;
$checkrunning = $argv[ ++$pos ];

__~debug:runjob{error_log( "jobrun 3\n", 3, "/tmp/php_errors" );}
require_once "__docroot:html5__/__application__/ajax/joblog.php";

if ( !getmenumodule( $id ) )
{
    error_log( date( "Y M d H:i:s T", time() ) . " : " .  $argv[ 0 ] . " : could not find job $id in database\n", 3, "/tmp/php_errors" );
    exit;
}

__~debug:runjob{error_log( "jobrun 4\n", 3, "/tmp/php_errors" );}
ob_start();
if ( FALSE === ( $cmd = file_get_contents( "${logdir}_cmds_$id" ) ) )
{
   $cont = ob_get_contents();
   ob_end_clean();
   error_log( date( "Y M d H:i:s T", time() ) . " : " .  $argv[ 0 ] . " : _cmds_$id missing : $cont\n", 3, "/tmp/php_errors" );
   exit;
}

__~debug:runjob{error_log( "jobrun 5\n", 3, "/tmp/php_errors" );}
$json = json_decode( file_get_contents( "__appconfig__" ) );
__~debug:runjob{error_log( "jobrun 6\n", 3, "/tmp/php_errors" );}
$context = new ZMQContext();
__~debug:runjob{error_log( "jobrun 7\n", 3, "/tmp/php_errors" );}
$zmq_socket = $context->getSocket(ZMQ::SOCKET_PUSH, '__application__ udp pusher');
__~debug:runjob{error_log( "jobrun 8\n", 3, "/tmp/php_errors" );}
$zmq_socket->connect("tcp://" . $json->messaging->zmqhostip . ":" . $json->messaging->zmqport );

__~debug:runjob{error_log( "jobrun 9\n", 3, "/tmp/php_errors" );}
logjobupdate( "running" );
__~debug:runjob{error_log( "jobrun 10\n", 3, "/tmp/php_errors" );}
$zmq_socket->send( '{"_uuid":"' . $id . '","_status":"running"__~debug:job{,"jobrun":"running"}}' );

__~debug:runjob{error_log( "jobrun 11\n", 3, "/tmp/php_errors" );}
logrunning();
__~debug:runjob{error_log( "jobrun 12\n", 3, "/tmp/php_errors" );}

// $GLOBALS[ 'jobstart' ] = new MongoDate();

$results = exec( $cmd );

__~debug:runjob{error_log( "jobrun 13\n", 3, "/tmp/php_errors" );}
//__~debug:cancel{error_log( "jobrun.php: return from exec(cmd)\n", 3, "/tmp/mylog" );}
logjobupdate( "finished", true );
__~debug:runjob{error_log( "jobrun 14\n", 3, "/tmp/php_errors" );}
logstoprunning();
__~debug:runjob{error_log( "jobrun 15\n", 3, "/tmp/php_errors" );}



if ( !$GLOBALS[ 'wascancelled' ] ) {
    $results = str_replace( "__docroot:html5__/__application__/", "", $results );

    ob_start();
    if ( FALSE === file_put_contents( "${logdir}_stdout_" . $_REQUEST[ '_uuid' ], $results ) ) {
        $cont = ob_get_contents();
        error_log( date( "Y M d H:i:s T", time() ) . " : " .  $argv[ 0 ] . " : error writing _stdout results\n", 3, "/tmp/php_errors" );
    }
    ob_end_clean();
    notify( 'finished' );
} else {
    notify( 'canceled' );
}

if ( $checkrunning == 1 )
{
    if( !clearprojectlock( $GLOBALS[ 'getmenumoduledir' ] ) ) {
// error ignored since there may not be job control
//      error_log( date( "Y M d H:i:s T", time() ) . " : " .  $argv[ 0 ] . " : " . $GLOBALS[ 'getmenumoduledir' ] . " : error clearprojectlock " . $GLOBALS[ 'lasterror' ] . "\n", 3, "/tmp/php_errors" );
   }
}

if ( !$GLOBALS[ 'wascancelled' ] ) {
    $zmq_socket->send( '{"_uuid":"' . $id . '","_status":"complete"__~debug:job{,"jobrun":"finished"}}' );
    __~debug:cache{error_log( "jobrun atend: project is " . $GLOBALS[ "getmenumoduleproject" ] . "\n", 3, "/tmp/php_errors" );}
    if ( !empty( $GLOBALS[ 'cache' ] ) ) {
        __~debug:cache{error_log( "jobrun cache enabled as " . $GLOBALS[ 'cache' ] . " module is " . $GLOBALS[ 'module' ] . " job id is " . $id .  "\n", 3, "/tmp/php_errors" );}
        logcache( $id );
    }
}


function notify( $type ) {
    global $use_db;
    if ( isset( $GLOBALS[ 'notify' ] ) ) {
        switch( $GLOBALS[ 'notify' ] ) {
            case "email" : {
                $coll = $use_db->__application__->users;
                if ( $doc = $coll->findOne( [ "name" => $GLOBALS[ 'logon' ] ] ) ) {
                    if ( $doc[ 'email' ] ) {
                        $app = json_decode( file_get_contents( "__appconfig__" ) );
                        require_once "__docroot:html5__/__application__/ajax/mail.php";
                        $body = "Your job " . $GLOBALS[ 'menu' ] . " : " . $GLOBALS[ 'module' ] . " submitted on " . date( "Y M d H:i:s T", $GLOBALS[ 'jobstart' ]->sec ) . " is now $type.\n"
                            . "Job ID: " . $_REQUEST[ '_uuid' ] . "\n"
                            ;
                        if ( $type == "finished" ) {
                            $body .= 
                                "Access your results:\n"
                                . "http://" . $app->hostname . "/__application__/?_reqlogin=1&_switch=" . $GLOBALS[ 'getmenumodule' ] . "/" . $GLOBALS[ 'getmenumoduleproject' ] . "/" . $_REQUEST[ '_uuid' ]
                                ;
                        }
                        mymail( $doc[ 'email' ], "[__application__][" . $GLOBALS[ 'menu' ] . ":" . $GLOBALS[ 'module' ] . "][$type]", $body );
                    }
                }
            }
            break;
            default : {
                 error_mail( "jobrun", "unknown notify selection " . $GLOBALS[ 'notify' ] );
            }             
            break;
        }
    }
}
