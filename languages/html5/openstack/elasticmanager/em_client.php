#!/usr/bin/php
<?php

{}

require_once "em_config.php";
require_once "em_common.php";
require_once "em_openstack.php";

$em_openstack = new em_openstack( false, EMCONFIG );

$self = __FILE__;

$notes = <<<__EOD

usage: $self {options}

airavata job status messages

    Options

    --help                     : print this information and exit

    --acquire flavor tag       : get an instance and tag it supplementary info
    --release id               : release an instance
    --status                   : print status

__EOD;

$u_argv = $argv;
array_shift( $u_argv ); # first element is program name

$anyargs = false;

while( count( $u_argv ) && substr( $u_argv[ 0 ], 0, 1 ) == "-" ) {
    $anyargs = true;
    switch( $arg = $u_argv[ 0 ] ) {
        case "--help": {
            echo $notes;
            exit;
        }
        case "--acquire" : {
            array_shift( $u_argv );
            if ( count( $u_argv ) < 2 ) {
                error_exit( "ERROR: option '$arg' requires two arguments\n$notes" );
            }
            $acquire     = array_shift( $u_argv );
            $acquire_tag = array_shift( $u_argv );
            break;
        }
        case "--release" : {
            array_shift( $u_argv );
            if ( !count( $u_argv ) ) {
                error_exit( "ERROR: option '$arg' requires an argument\n$notes" );
            }
            $release = array_shift( $u_argv );
            break;
        }
        case "--error" : {
            array_shift( $u_argv );
            if ( !count( $u_argv ) ) {
                error_exit( "ERROR: option '$arg' requires an argument\n$notes" );
            }
            $error = array_shift( $u_argv );
            break;
        }
        case "--status": {
            array_shift( $u_argv );
            $status = true;
            break;
        }
      default:
        error_exit( "\nUnknown option '$u_argv[0]'\n\n$notes" );
    }
}

if ( !$anyargs || count( $u_argv ) ) {
    echo $notes;
    exit;
}

## process commands

if ( isset( $acquire ) && isset( $release ) ) {
    error_exit( "--acquire & --release are mutually exclusive" );
}

if ( isset( $status ) ) {
    echo $em_openstack->status();
}

if ( isset( $acquire ) ) {
    $number = -1;
    $ip     = "";
    
    if ( $em_openstack->acquire( $acquire, $acquire_tag, $number, $ip ) ) {
        ## got one
        echo "$number $ip\n";
        exit( 0 );
    }
    echo "error : could not acquire instance\n";
    exit -1;
}

if ( isset( $release ) ) {
    $em_openstack->release( $release );
    exit( 0 );
}

## only for testing
#   --error id                 : set instance into ERROR state (for testing)

if ( isset( $error ) ) {
    $em_openstack->load_secrets();
    $em_openstack->error_instance( $error );
    exit( 0 );
}
