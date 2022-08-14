<?php

{};

header('Content-type: application/json');
session_start(); 

$results[ '_status' ] = 'complete';

if ( !sizeof( $_REQUEST ) ) {
    $results[ "error" ] = "PHP code received no \$_REQUEST?";
    echo (json_encode($results));
    exit();
}

require_once "__docroot:html5__/__application__/ajax/ga_filter.php";

$modjson = json_decode( '__modulejson__' );
#$modjson = [];
$inputs_req = $_REQUEST;
# $validation_inputs = ga_sanitize_validate( $modjson, $inputs_req, '__menu:modules:id__' );

# if ( $validation_inputs[ "output" ] == "failed" ) {
#    $results = array( "error" => $validation_inputs[ "error" ] );
#    #    $results[ '_status' ] = 'failed';
#    #    echo ( json_encode( $results ) );
#    #    exit();
#};

if ( isset( $_REQUEST[ '_window' ] ) ) {
    $window = $_REQUEST[ '_window' ];
}
if ( !isset( $_SESSION[ $window ] ) ) {
    $_SESSION[ $window ] = array( "logon" => "", "project" => "" );
}

$results[ '_status' ] = 'complete';

if ( !isset( $_SESSION[ $window ][ 'logon' ] ) ||
     !isset( $_REQUEST[ '_logon' ] ) ) {
    $results[ '_logon' ] = "";
    echo (json_encode($results));
    exit();
}

if ( $_REQUEST[ '_logon' ] != $_SESSION[ $window ][ 'logon' ] ) {

    require_once "__docroot:html5__/__application__/ajax/ga_db_lib.php";
    $savelogon = $_SESSION[ $window ][ 'logon' ];
    unset( $_SESSION[ $window ][ 'logon' ] );
    session_write_close();
    $results[ '_logon' ] = "";
    $results[ 'error'  ] = 'Possible security violation user mismatch. ';

    ga_db_open( true );

    $now = ga_db_output( ga_db_date() );

    $insert[ 'requestuser' ] = $_REQUEST[ '_logon' ];
    $insert[ 'sessionuser' ] = $savelogon;
    $insert[ 'remoteip'    ] = isset( $_SERVER[ 'REMOTE_ADDR' ] ) ? $_SERVER[ 'REMOTE_ADDR' ] : "not from an ip";
    $insert[ 'when'        ] = $now;

    ga_db_insert( 'security', '', $insert, [], true );

    require_once "../mail.php";
    $json = json_decode( file_get_contents( "__appconfig__" ) );

    mymail( $json->mail->admin, 'security alert __application__', "session timeout or possible security breach attempt on __application__\n" .
            'requestuser: ' . $insert[ 'requestuser' ] . "\n" .
            'sessionuser: ' . $insert[ 'sessionuser' ] . "\n" .
            'remoteip:    ' . $insert[ 'remoteip' ] . "\n" .
            'when:        ' . date('Y-m-d H:i:s', ga_db_date_secs( $insert[ 'when' ] ) ) . " UTC\n" .
            '' );

    echo (json_encode($results));
    exit();
}
session_write_close();

if ( !sizeof( $_REQUEST ) ) {
    $results[ 'error' ] = "PHP code received no \$_REQUEST?";
    echo (json_encode($results));
    exit();
}

## validate / is hook defined etc

function error_exit( $msg ) {
    global $results;
    $results['error'] = $msg;
    echo (json_encode($results));
    exit();
}    


if ( !isset( $_REQUEST['hook'] ) ) {
    error_exit( "Internal error: \$_REQUEST input JSON contained no key 'hook'" );;
}    

## if all ok, assemble json & change to project directory && call defaults handler

$hookexe = "__executable_path:html5__/" . $_REQUEST['hook'];

if ( !file_exists( $hookexe ) ) {
    error_exit( "defaults executable $hookexe not found" );
}

if ( !is_executable( $hookexe ) ) {
    error_exit( "defaults executable $hookexe is not set to be executable" );
}

## temporary file with input object
## run executable

## retrieve results
## rm temp file

## return results

# $results['error'] = "testing get_defaults";
$results['textfield'] = "new value";

__~debug:getdefaults{error_log( "get_defaults: request\n" . print_r( $_REQUEST, true ) . "\n", 3, "/tmp/mylog.get_defaults" );}
__~debug:getdefaults{error_log( "get_defaults: results\n" . print_r( $results, true ) . "\n", 3, "/tmp/mylog.get_defaults" );}
echo (json_encode($results));
exit();

