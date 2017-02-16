#!/usr/local/bin/php
<?php

$json = json_decode( file_get_contents( "__appconfig__" ) );

$lockdir = "/var/run/genapp";
if ( isset( $json->lockdir ) ) {
    $lockdir = $json->lockdir;
}

// check if already running and register pid
define('LOCK_FILE', "$lockdir/msg-keepalive-" . $json->messaging->zmqport . ".lock");

if ( !tryLock() ) {
   die( "Already running.\n" );
}

# remove the lock on exit (Control+C doesn't count as 'exit'?)
register_shutdown_function( 'unlink', LOCK_FILE );

$context = new ZMQContext();
$zmq_socket = $context->getSocket(ZMQ::SOCKET_PUSH, '__application__ udp keepalive pusher');
$zmq_socket->connect("tcp://" . $json->messaging->zmqhostip . ":" . $json->messaging->zmqport );


$keepalive = isset( $json->messaging->keepalive ) ? $json->messaging->keepalive : 30;

echo "msg_keepalive: interval ${keepalive}s sending ZMQ host:" . $json->messaging->zmqhostip . " port:" . $json->messaging->zmqport . PHP_EOL;

$buf = '{"_uuid":"keepalive"}';

do {
   sleep( $keepalive );
   __~debug:ws{echo "sending keepalive msg" . PHP_EOL;}
   $zmq_socket->send( $buf );
} while( 1 );

function tryLock() {
    # If lock file exists, check if stale.  If exists and is not stale, return TRUE
    # Else, create lock file and return FALSE.

    if (@symlink("/proc/" . getmypid(), LOCK_FILE) !== FALSE) # the @ in front of 'symlink' is to suppress the NOTICE you get if the LOCK_FILE exists
        return true;

    # link already exists
    # check if it's stale
    if (is_link(LOCK_FILE) && !is_dir(LOCK_FILE)) {
        unlink(LOCK_FILE);
        # try to lock again
        return tryLock();
    }

    return false;
}
