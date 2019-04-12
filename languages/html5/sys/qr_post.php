<?php
header('Content-type: application/json');

session_start(); 

$window = "";
if ( isset( $_REQUEST[ '_window' ] ) )
{
   $window = $_REQUEST[ '_window' ];
}
if ( !isset( $_SESSION[ $window ] ) )
{
   $_SESSION[ $window ] = array( "logon" => "", "project" => "" );
}

session_write_close();
if ( !sizeof( $_REQUEST ) )
{
    session_write_close();
    $results[ 'error' ] = 'empty request';
    $results[ '_status' ] = 'failed';
    echo (json_encode($results));
    exit();
}

if ( !isset( $_REQUEST[ '_data' ] ) ) {
    $results[ 'error' ] = 'insufficient request';
    $results[ '_status' ] = 'failed';
    echo (json_encode($results));
    exit();
}

$forward = $_REQUEST[ '_data' ];

if ( !isset( $forward[ '_uuid' ] ) ||
     !isset( $forward[ '_msgid' ] ) ||
     !isset( $forward[ '_response' ] )
    ) {
    $results[ 'error' ] = 'insufficient request';
    $results[ '_status' ] = 'failed';
    echo (json_encode($results));
    exit();
}

$app_json = json_decode( file_get_contents( "__appconfig__" ) );

if ( $app_json == NULL ) {
    $results[ 'error' ] = 'invalid or missing appconfig.json';
    $results[ '_status' ] = 'failed';
    echo (json_encode($results));
    exit();
}

if ( !isset( $app_json->messaging ) ) {
    $results[ 'error' ] = 'appconfig missing messaging';
    $results[ '_status' ] = 'failed';
    echo (json_encode($results));
    exit();
}
    
if ( !isset( $app_json->messaging->tcphostip ) ) {
    $results[ 'error' ] = 'appconfig missing messaging:tcphostip';
    $results[ '_status' ] = 'failed';
    echo (json_encode($results));
    exit();
}

if ( !isset( $app_json->messaging->tcprport ) ) {
    $results[ 'error' ] = 'appconfig missing messaging:tcprport';
    $results[ '_status' ] = 'failed';
    echo (json_encode($results));
    exit();
}
    
# send message to 
$fp = fsockopen( $app_json->messaging->tcphostip, 
                 $app_json->messaging->tcprport, 
                 $errno, 
                 $errstr, 
                 30);
if (!$fp) {
    $results[ 'error' ] = 'tcpr error: ' . $errstr;
    $results[ '_status' ] = 'failed';
    echo (json_encode($results));
    exit();
}

fwrite( $fp, json_encode( $forward ) );
fclose( $fp );
$results[ '_status' ] = 'complete';
echo (json_encode($results));
