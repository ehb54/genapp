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

if ( isset( $json->messaging ) &&
     isset( $json->messaging->udphostip ) &&
     isset( $json->messaging->udpport ) ) {
    $GLOBALS['udp'] = new stdClass();
    $GLOBALS['udp']->hostip = $json->messaging->udphostip;
    $GLOBALS['udp']->port   = $json->messaging->udpport;
    $GLOBALS['udp']->socket = socket_create(AF_INET, SOCK_DGRAM, SOL_UDP);
    $GLOBALS['udp']->msg    = Array( "_uuid"    => $id );
}

sendudptext( "jobrun: start\n" );

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

sendudptext( "jobrun: exec:\n$cmd\n" );

$results = exec( $cmd );

sendudptext( "jobrun: exec: returned\n" );

__~debug:runjob{error_log( "jobrun 13\n", 3, "/tmp/php_errors" );}

if ( !$GLOBALS[ 'wascancelled' ] ) {
    $results = str_replace( "__docroot:html5__/__application__/", "", $results );

    sendudptext( "jobrun: writing log file\n" );
    ob_start();
    if ( FALSE === file_put_contents( "${logdir}_stdout_" . $_REQUEST[ '_uuid' ], $results ) ) {
        $cont = ob_get_contents();
        error_log( date( "Y M d H:i:s T", time() ) . " : " .  $argv[ 0 ] . " : error writing _stdout results\n", 3, "/tmp/php_errors" );
    }
    ob_end_clean();
    sendudptext( "jobrun: exec done, logfile: ${logdir}_stdout_" . $_REQUEST[ '_uuid' ] . "\n" );

#-------- verify log exists
    $stdoutfile = "${logdir}_stdout_" . $_REQUEST[ '_uuid' ];
    if ( !is_file( $stdoutfile ) || FALSE === ( $strresults = file_get_contents( $stdoutfile ) ) ) {
        sendudptext("Waiting for results to propagate to $stdoutfile\n" );
        ob_start();
        sendudptext(`ls -l $stdoutfile 2>&1`);
        ob_end_clean();
        
        for ( $i = 0; $i < 20; ++$i ) {
            if ( !is_file( $stdoutfile ) || FALSE === ( $strresults = file_get_contents( $stdoutfile ) ) ) {
                sendudptext("Trying again for results to propagate to $stdoutfile\n" );
                ob_start();
                sendudptext(`ls -l $stdoutfile 2>&1`);
                ob_end_clean();
                sleep( 5 );
            }      
        }        

        if ( !is_file( $stdoutfile ) || FALSE === ( $strresults = file_get_contents( $stdoutfile ) ) ) {
            sendudptext("Warning : no results appear to be propagated to $stdoutfile\n" );
        }
    }

    sendudptext( "jobrun: exec done, logfile found\n" );
}

//__~debug:cancel{error_log( "jobrun.php: return from exec(cmd)\n", 3, "/tmp/mylog" );}
sendudptext( "jobrun: logjobupdate called\n" );
logjobupdate( "finished", true );
__~debug:runjob{error_log( "jobrun 14\n", 3, "/tmp/php_errors" );}
sendudptext( "jobrun: logstoprunning called\n" );
logstoprunning();
__~debug:runjob{error_log( "jobrun 15\n", 3, "/tmp/php_errors" );}

__~seedmelab:url{$seedmecmd="php __docroot:html5__/__application__/seedmelab/syncfilesdirs.php --user " . $GLOBALS['logon']; exec("$seedmecmd >> /tmp/php_errors 2>&1 & echo $!; " );}

if ( !$GLOBALS[ 'wascancelled' ] ) {
    notify( 'finished' );
} else {
    notify( 'canceled' );
}

if ( $checkrunning == 1 )
{
    if ( hasjobcontrol( $id ) ) {
        if( !clearprojectlock( $GLOBALS[ 'getmenumoduledir' ] ) ) {
// error ignored since there may not be job control
//      error_log( date( "Y M d H:i:s T", time() ) . " : " .  $argv[ 0 ] . " : " . $GLOBALS[ 'getmenumoduledir' ] . " : error clearprojectlock " . $GLOBALS[ 'lasterror' ] . "\n", 3, "/tmp/php_errors" );
       }
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
    if ( isset( $GLOBALS[ 'notify' ] ) ) {
        switch( $GLOBALS[ 'notify' ] ) {
            case "email" : {
                if ( $doc = 
                     ga_db_output( 
                         ga_db_findOne( 
                             'users',
                             '',
                             [ "name" => $GLOBALS[ 'logon' ] ] 
                         ) 
                     )
                    ) {
                    if ( $doc[ 'email' ] ) {
                        $app = json_decode( file_get_contents( "__appconfig__" ) );
                        require_once "__docroot:html5__/__application__/ajax/mail.php";
                        $body = "Your job " . $GLOBALS[ 'menu' ] . " : " . $GLOBALS[ 'module' ] . " submitted on " . date( "Y M d H:i:s T", ga_db_date_secs( $GLOBALS[ 'jobstart' ] ) ) . " is now $type.\n"
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

function sendudptext( $text ) {
    __!debug:jobrunudp{return;}

    if ( !isset( $GLOBALS['udp'] ) ) {
        return;
    }

    $GLOBALS['udp']->msg[ '_textarea' ] = $text;

    $json_msg = json_encode( $GLOBALS[ 'udp' ]->msg );

    socket_sendto( $GLOBALS[ 'udp' ]->socket,
                   $json_msg,
                   strlen( $json_msg ),
                   0,
                   $GLOBALS[ 'udp' ]->hostip,
                   $GLOBALS[ 'udp' ]->port );
}    

