#!/usr/local/bin/php
<?php

$json = json_decode( file_get_contents( "__appconfig__" ) );

$lockdir = "/var/run/genapp";
if ( isset( $json->lockdir ) ) {
    $lockdir = $json->lockdir;
}

// check if already running and register pid
define('LOCK_FILE', "$lockdir/msg-udp-" . $json->messaging->zmqport . ".lock");
define('EXPECTED_CMDLINE', "phpmsg-udpserver.php" );

if ( !tryLock() ) {
   die( "Already running.\n" );
}

# remove the lock on exit (Control+C doesn't count as 'exit'?)
register_shutdown_function( 'unlink', LOCK_FILE );

$context = new ZMQContext();
$zmq_socket = $context->getSocket(ZMQ::SOCKET_PUSH, '__application__ udp pusher');
$zmq_socket->connect("tcp://" . $json->messaging->zmqhostip . ":" . $json->messaging->zmqport );

$udp_socket = socket_create(AF_INET, SOCK_DGRAM, SOL_UDP);
socket_bind($udp_socket, $json->messaging->udphostip, $json->messaging->udpport );

echo "msg_udpserver: listening UDP host:" . $json->messaging->udphostip . " UDP port:" . $json->messaging->udpport . " sending ZMQ host:" . $json->messaging->zmqhostip . " port:" . $json->messaging->zmqport . PHP_EOL;

do {
   $from = '';
   $port = 0;
   socket_recvfrom($udp_socket, $buf, 65535, 0, $from, $port);
   $buf = str_replace( "__docroot:html5__/__application__/", "", $buf );
__~debug:ws{   echo "Received $buf from remote address $from and remote port $port" . PHP_EOL;}
   $zmq_socket->send( $buf );
} while( 1 );

function tryLock() {
    # If lock file exists, check if stale.  If exists and is not stale, return TRUE
    # Else, create lock file and return FALSE.

    if (@symlink("/proc/" . getmypid(), LOCK_FILE) !== FALSE) # the @ in front of 'symlink' is to suppress the NOTICE you get if the LOCK_FILE exists
    {   
        return true;
    }

    # link already exists
    # check if it's stale
    $isstale = false;

    if ( is_link(LOCK_FILE) ) {
        echo "is_link(" . LOCK_FILE . ") true\n";
        if ( ( $link = readlink( LOCK_FILE ) ) === FALSE ) {
            $isstale = true;
            echo "is stale 1\n";
        }
    } else {
        $isstale = true;
        echo "is stale 2\n";
    }

    if ( !$isstale && is_dir( $link ) ) {
        # make sure the cmdline exists & matches expected
        $cmdline_file = $link . "/cmdline";
        echo "cmdline_file = $cmdline_file\n";
        if ( ($cmdline = file_get_contents( $cmdline_file )) === FALSE ) {
            echo "could not get contents of $cmdline_file\n";
            $isstale = true;
            echo "is stale 3\n";
        } else {
            # remove nulls
            $cmdline = str_replace("\0", "", $cmdline);
            if ( $cmdline != EXPECTED_CMDLINE ) {
                echo "unexpected contents of $cmdline_file\n";
                $isstale = true;
                echo "is stale 4 \n";
            }
        }
    }            
        
    if (is_link(LOCK_FILE) && !is_dir(LOCK_FILE)) {
        $isstale = true;
    }

    if ( $isstale ) {
        unlink(LOCK_FILE);
        # try to lock again
        return tryLock();
    }
    return false;
}
