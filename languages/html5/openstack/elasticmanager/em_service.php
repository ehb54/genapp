#!/usr/bin/php
<?php

{}

require_once "em_config.php";
require_once "em_common.php";
require_once "em_openstack.php";

if ( !file_exists( APPCONFIG ) ) {
    print "File " . APPCONFIG . " does not exist\n";
    exit;
}

try {
    $appconfig = json_decode( file_get_contents( APPCONFIG ) );
} catch ( Exception $e ) {
    echo $e->getMessage();
    exit -1;
}

if ( !file_exists( SECRETS ) ) {
    print "File " . SECRETS . " does not exist\n";
    exit;
}

try {
    $secrets = json_decode( file_get_contents( SECRETS ) );
} catch ( Exception $e ) {
    echo $e->getMessage();
    exit -1;
}

if ( isset( $appconfig->lockdir ) ) {
    $lockdir = $appconfig->lockdir;
} else {
    $lockdir = LOCKDIR;
}

if ( !file_exists( $lockdir ) ) {
    print "Directory $lockdir does not exist\n";
    exit;
}

if ( !is_writeable( $lockdir ) ) {
    print "Directory $lockdir exists but is not writable\n";
    exit;
}

define('LOCK_FILE', "$lockdir/em-service.lock");
define('EXPECTED_CMDLINE', "phpem_service.php" );

## get lock for service

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

if ( !tryLock() ) {
   die( "Already running.\n" );
}
# remove the lock on exit (Control+C doesn't count as 'exit'?)
    

register_shutdown_function( 'unlink', LOCK_FILE );

$em_openstack = new em_openstack( false, EMCONFIG );

function shutdown() {
    global $em_openstack;
    $em_openstack->log( "SHUTDOWN : elastic manager server id $em_openstack->id flavor $em_openstack->flavor" );
    flush_all_digests(); 
}

## doesn't work without signal handler, which still doesn't seem to work

register_shutdown_function( 'shutdown' );

/* signal handler doesn't seem to work as expected
declare(ticks = 1);

function sig_handler($sig) {
    global $em_openstack;

    switch($sig) {
        case SIGTERM:
        echo "caught signal SIGTERM\n";
        $em_openstack->error_exit( "Terminated via signal SIGTERM" );
        exit;
        break;
        case SIGINT:
        echo "caught signal SIGINT\n";
        $em_openstack->error_exit( "Terminated via signal SIGINT" );
        exit;
        break;
        case SIGHUP:
        echo "caught signal SIGHUP\n";
        $em_openstack->error_exit( "Terminated via signal SIGHUP" );
        exit;
        break;
      default: 
        echo "caught signal, ignored\n";
        break;
    }
}

pcntl_signal(SIGINT,  "sig_handler");
pcntl_signal(SIGTERM, "sig_handler");
pcntl_signal(SIGHUP,  "sig_handler");
*/

$em_openstack->server_start();
