#!/usr/local/bin/php
<?php

define( "SLEEPTIME", 10 );

$json = json_decode( file_get_contents( "__appconfig__" ) );

$lockdir = "/var/run/genapp";
if ( isset( $json->lockdir ) ) {
    $lockdir = $json->lockdir;
}

if ( !file_exists( $lockdir ) ) {
    print "Directory $lockdir does not exist\n";
    exit;
}

if ( !is_writeable( $lockdir ) ) {
    print "Directory $lockdir exists but is not writable\n";
    exit;
}

global $lock;
$lock = array();

$lock[ "udp"       ]  = "$lockdir/msg-udp-"       . $json->messaging->zmqport . ".lock";
$lock[ "ws"        ]  = "$lockdir/msg-ws-"        . $json->messaging->zmqport . ".lock";
$lock[ "tcp"       ]  = "$lockdir/msg-tcp-"       . $json->messaging->zmqport . ".lock";
$lock[ "keepalive" ]  = "$lockdir/msg-keepalive-" . $json->messaging->zmqport . ".lock";

global $cmd;
$cmd = array();

$cmd[ "udp"       ] = "msg-udpserver.php";
$cmd[ "ws"        ] = "msg-wsserver.php";
$cmd[ "tcp"       ] = "msg-tcpserver";
$cmd[ "keepalive" ] = "msg-keepalive.php";

function stop() {
    global $lock;

    echo "stopping services...\n";

    clearstatcache();

    foreach ( $lock as $k => $v ) {
        if ( file_exists( $v ) ) {
            if ( is_link( $v ) ) {
                $link = readlink ( $v );

                $pid = substr( $link, 6 );
            } else {
                $pid = rtrim( file_get_contents( $v ) );
                $link = "/proc/$pid";
            }

            if ( file_exists( $link ) ) {
                posix_kill( $pid, SIGTERM );
            }
        }
    }
    sleep( SLEEPTIME );

    clearstatcache();

    $remaining = 0;
    foreach ( $lock as $k => $v ) {
        if ( file_exists( $v ) ) {
            if ( is_link( $v ) ) {
                $link = readlink ( $v );

                $pid = substr( $link, 6 );
            } else {
                $pid = rtrim( file_get_contents( $v ) );
                $link = "/proc/$pid";
            }

            if ( file_exists( $link ) ) {
                $remaining++;
                posix_kill( $pid, SIGKILL );
            }
        }
    }

    if ( $remaining ) {
        sleep( SLEEPTIME );
    }
}

function start() {
    global $cmd;
    echo "starting services...\n";

    $run = "__docroot:html5__/__application__/util/ws_start.sh";
    exec( "nohup $run > /dev/null 2>&1&" );
    sleep( SLEEPTIME );
}

function status( $doprint = true ) {
    global $lock;
    if ( $doprint ) {
        echo "Service  PID    Status\n";
    }

    $running = 0;

    clearstatcache();

    foreach ( $lock as $k => $v ) {
        $status = "not running";
        $pid = "";

        if ( file_exists( $v ) ) {
            if ( is_link( $v ) ) {
                $link = readlink ( $v );

                $pid = substr( $link, 6 );
            } else {
                $pid = rtrim( file_get_contents( $v ) );
                $link = "/proc/$pid";
            }

            if ( file_exists( $link ) ) {
                $status = "running";
                $running++;
            } else {
                $pid = "";
            }
        }

        if ( $doprint ) {
            printf( "%-9s %-6s $status\n", $k, $pid );
        }
    }
    return $running;
}

if ( !isset( $argv[ 1 ] ) ) {
    echo "usage: services.php {status|stop|start|restart}\n";
    exit;
}

switch( $argv[ 1 ] ) {
    case "stop" : {
        if ( status( false ) ) {
            stop();
        } else {
            echo "no services are currently running\n";
        }
        status();
        exit;
    }

    case "restart" : {
        if ( status( false ) ) {
            stop();
        } else {
            echo "services are not currently all running\n";
        }
        start();
        system( "__docroot:html5__/__application__/util/services.php status" );
        // status();
        exit;
    }

    case "start" : {
        if ( status( false ) == count( $lock ) ) {
            echo "all services are already running\n";
        } else {
            start();
        }
        status();
        exit;
    }

    case "status" :
    default : {
        status();
        exit;
    }
}

