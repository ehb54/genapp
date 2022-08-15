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

if ( !strlen( $_SESSION[ $window ][ 'logon' ] ) ) {
    error_exit( "You must be logged on to utilize this feature" );
}

## setup for running code

if ( !isset( $_REQUEST[ '_project' ] ) ) {
    error_exit( "No project specified" );
}

$dir = "__docroot:html5__/__application__/results/users/" . $_SESSION[ $window ][ 'logon' ];

$project = $_REQUEST[ '_project' ];

if ( !isset( $_REQUEST[ '_project' ] ) ) {
    error_exit( "No project specified" );
}

if ( !strlen( $project ) ) {
    $project = "no_project_specified";
}

if ( !preg_match( '/^[a-zA-Z0-9]+[a-zA-Z0-9_]+$/', $project ) ) {
    error_exit( "Invalid project specified" );
}

## setup directory 

$rdir = "$dir/$project";
if ( !is_dir( $rdir ) ) {
    ob_start();
    mkdir( $rdir, 0660, true );
    ob_end_clean();
}

if ( !is_dir( $rdir ) ) {
    error_exit( "Could not create directory" );
}

chdir( $rdir );

## temporary file with input object

$tempfile = tempnam( $rdir, "_defaults_tmp_" );

if ( file_put_contents( $tempfile, json_encode( $_REQUEST ) ) === FALSE ) {
    error_exit( "Internal error: unable to write data" );
}

## run executable

exec( "$hookexe < $tempfile 2> /dev/null", $hookresults, $status );
if ( $status ) {
    error_exit( "default hook " + $_REQUEST['hook'] + " failed" );
}
    
## rm temp file
unlink( $tempfile );

## retrieve results

$hookresultsstring    = implode( '', $hookresults );
if ( NULL === ( $hookresultsjson = json_decode( $hookresultsstring ) ) ) {
    error_exit( "default hook " + $_REQUEST['hook'] + " returned invalid JSON" );
}

echo json_encode( $hookresultsjson );
exit;
    



