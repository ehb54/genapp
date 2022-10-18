<?php

date_default_timezone_set("UTC");

__~debug:jqgrid{error_log( "sys_managejob.php received ajax request\n" . json_encode( $_REQUEST, JSON_PRETTY_PRINT ) . "\n", 3, "/tmp/mylog" );}

require_once "../mail.php";
require_once "__docroot:html5__/__application__/ajax/ga_db_lib.php";

$results = [];

## check request

if ( !isset( $_REQUEST[ '_logon' ] ) ) {
    $results[ 'success' ] = "false";
    $results[ 'error' ] = "Internal error: Logon info missing";
    echo json_encode( $results );
    exit();
}

if ( !isset( $_REQUEST[ '_cmd' ] ) ) {
    $results[ 'success' ] = "false";
    $results[ 'error' ] = "Internal error: No command received";
    echo json_encode( $results );
    exit();
}

if ( !isset( $_REQUEST[ '_jid' ] ) ) {
    $results[ 'success' ] = "false";
    $results[ 'error' ] = "Internal error: No jid received";
    echo json_encode( $results );
    exit();
}

## check session

$window = "";
if ( isset( $_REQUEST[ '_window' ] ) ) {
    $window = $_REQUEST[ '_window' ];
}

session_start();

if ( isset( $_REQUEST[ "_logon" ] ) && 
     ( !isset( $_SESSION[ $window ][ 'logon' ] ) || $_REQUEST[ "_logon" ] != $_SESSION[ $window ][ 'logon' ] ) ) {
    unset( $_SESSION[ $window ][ 'logon' ] );
    $results[ 'success' ] = "false";
    $results[ 'error' ] = "You must be logged in.";
    echo json_encode( $results );
    exit();
}

session_write_close();

switch( $_REQUEST[ '_cmd' ] ) {
    #        case "clearlock" : {
    #        }
    #        break;

    #        case "removejob" : {
    #        }
    #        break;

    case "jobcancel" :
    { 
        require_once "../joblog.php";
        if ( !jobcancel( [ $_REQUEST[ '_jid' ] ], false, true ) ) {
            $results[ 'success' ] = "false";
            $results[ 'error' ] = $GLOBALS[ 'lasterror' ];
            echo json_encode( $results );
            exit();
        } else {
            $results[ "success" ] = "true";
            echo json_encode( $results );
            exit();
        }
    }
    break;

    default : {
        $results[ 'success' ] = "false";
        $results[ 'error' ] = "Internal error: Unknown command " . $_REQUEST[ '_cmd' ] . " received";
        echo json_encode( $results );
        exit();
    }
    break;
}

$results[ "success" ] = "true";
echo json_encode( $results );
exit();
