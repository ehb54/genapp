<?php
header('Content-type: application/json');

session_start(); 
global $results;
$results[ 'error' ] = "";
$results[ '_status' ] = 'complete';

require_once "__docroot:html5__/__application__/ajax/ga_filter.php";
$modjson = json_decode( '__modulejson__' );
$inputs_req = $_REQUEST;
$validation_inputs = ga_sanitize_validate( $modjson, $inputs_req, '__menu:modules:id__' );

if ( $validation_inputs[ "output" ] == "failed" ) {
    $results = array( "error" => $validation_inputs[ "error" ] );
#    $results[ '_status' ] = 'failed';
#    echo ( json_encode( $results ) );
#    exit();
};

$window = "";
if ( isset( $_REQUEST[ '_window' ] ) )
{
   $window = $_REQUEST[ '_window' ];
}
if ( !isset( $_SESSION[ $window ] ) )
{
   $_SESSION[ $window ] = array( "logon" => "", "project" => "" );
}

if ( !isset( $_SESSION[ $window ][ 'logon' ] ) ||
     !isset( $_REQUEST[ '_logon' ] ) )
{
    $results[ '_logon' ] = "";
    $results[ 'error' ] .= "Not logged in. ";
    echo (json_encode($results));
    exit();
}

## set project

if ( !isset( $_REQUEST['_project'] ) ) {
    echo '{"error":"nothing to do"}';
    exit();
}

$_SESSION[ $window ][ 'project' ] = $_REQUEST[ '_project' ];
echo '{"status":"ok"}';
exit();    


