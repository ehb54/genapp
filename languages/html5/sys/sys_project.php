<?php
header('Content-type: application/json');

session_name( strtoupper( preg_replace('/[^a-zA-Z0-9_]+/', '_', "GENAPP___application__" ) ) ); session_start();
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

if ( $_REQUEST[ '_logon' ] != $_SESSION[ $window ][ 'logon' ] )
{
    $results[ '_logon' ] = "";
    $results[ 'error' ] .= "Possible security violation user mismatch. ";
    echo (json_encode($results));
    exit();
}

## set project

if ( !isset( $_REQUEST['_project'] ) ) {
    echo '{"error":"nothing to do"}';
    exit();
}

$project = $_REQUEST[ '_project' ];
if ( !preg_match( '/^[a-zA-Z0-9_]+$/', $project ) )
{
    echo '{"error":"Invalid project name"}';
    exit();
}

if ( $project != 'no_project_specified' )
{
    require_once "../joblog.php";
    $active_projects = active_project_names( $_SESSION[ $window ][ 'logon' ], true );
    if ( $active_projects === false )
    {
        echo '{"error":"Could not verify active projects"}';
        exit();
    }
    if ( !in_array( $project, $active_projects, true ) )
    {
        echo json_encode( array(
            'status' => 'project unavailable',
            'project_available' => false,
            '_project' => isset( $_SESSION[ $window ][ 'project' ] ) ? $_SESSION[ $window ][ 'project' ] : 'no_project_specified'
        ) );
        exit();
    }
}

$_SESSION[ $window ][ 'project' ] = $project;
echo json_encode( array( 'status' => 'ok', 'project_available' => true, '_project' => $project ) );
exit();
