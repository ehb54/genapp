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

$is_admin = true;
if ( isset( $_REQUEST[ "_isadmin" ] ) ) {
    $is_admin = $_REQUEST[ "_isadmin" ] == "true";
}

$no_cancel_notice_msg = false;
if ( isset( $_REQUEST[ "_no_cancel_notice_msg" ] ) ) {
    $no_cancel_notice_msg = $_REQUEST[ "_no_cancel_notice_msg" ] == "true";
}
 
file_put_contents( "/tmp/managejob.txt", "$addout is_admin " . ( $is_admin ? "true" : "false" ) . "\n\n\$_REQUEST:\n" . json_encode( $_REQUEST, JSON_PRETTY_PRINT ) . "\n" );
    
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
        if ( !jobcancel( [ $_REQUEST[ '_jid' ] ], false, $is_admin, $no_cancel_notice_msg ) ) {
            $results[ 'success' ] = "false";
            $results[ 'error' ] = $GLOBALS[ 'lasterror' ];
            echo json_encode( $results );
            exit();
        } else {
            $results[ "success" ] = "true";
            $results[ "successtext" ] = "The job has been canceled";
            echo json_encode( $results );
            exit();
        }
    }
    break;

    case "jobdelete" :
    { 
        require_once "../joblog.php";
        if ( !removejob( $_REQUEST[ '_jid' ], false ) ) {
            $results[ 'success' ] = "false";
            $results[ 'error' ] = $GLOBALS[ 'lasterror' ];
            echo json_encode( $results );
            exit();
        } else {
            $results[ "success" ] = "true";
            $results[ "successtext" ] = "The job has been deleted";
            echo json_encode( $results );
            exit();
        }
    }
    break;

    case "clearlock" :
    { 
        require_once "../joblog.php";
        $fullprojectdir = "__docroot:html5__/__application__/results/users/" . $_REQUEST[ "_logon" ] . "/" . $_REQUEST[ '_jid' ];
        if ( !clearprojectlock( $fullprojectdir, false ) ) {
            $results[ 'success' ] = "false";
            $results[ 'error' ] = $GLOBALS[ 'lasterror' ];
            echo json_encode( $results );
            exit();
        } else {
            $results[ "success" ] = "true";
            $results[ "successtext" ] = "The project lock on project <i>" . $_REQUEST[ '_jid' ] . "</i> has been cleared";
            echo json_encode( $results );
            exit();
        }
    }
    break;

    case "jobdeletemany" :
    { 
        require_once "../joblog.php";
        $num_total   = count( $_REQUEST[ '_jid' ] );
        $num_success = 0;
        $num_fail    = 0;
        $last_fail   = '';

        if ( $num_total == 0 ) {
            $results[ 'success' ] = "false";
            $results[ 'error' ] = "No jobs selected for deletion";
            echo json_encode( $results );
            exit();
        }            

        foreach ( $_REQUEST[ '_jid' ] as $v ) {
            if ( !removejob( $v, false ) ) {
                ++$num_fail;
                $last_fail = $GLOBALS[ 'lasterror' ];
            } else {
                ++$num_success;
            }
        }

        if ( $num_fail == 0 ) {
            $results[ "success" ] = "true";
            $results[ "successtext" ] = "All $num_success jobs deleted";
            echo json_encode( $results );
            exit();
        }
            
        if ( $num_success == 0 ) {
            $results[ "success" ] = "false";
            $results[ 'error' ] = "None of the $num_total jobs deleted<br>Errors:<br>$last_fail";
            echo json_encode( $results );
            exit();
        }
            
        # some jobs deleted & some not
        
        $results[ 'success' ] = "false";
        $results[ 'error' ] = "Only $num_success of $num_total jobs deleted<br>Errors:<br>$last_fail";
        echo json_encode( $results );
        exit();
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
