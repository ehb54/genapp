<?php

{};

header('Content-type: application/json');
session_name( strtoupper( preg_replace('/[^a-zA-Z0-9_]+/', '_', "GENAPP___application__" ) ) ); session_start();

$results = array( '_status' => 'complete' );

function action_error_exit( $msg ) {
    global $results;
    $results['error'] = $msg;
    echo json_encode($results);
    exit();
}

if ( !sizeof( $_REQUEST ) ) {
    action_error_exit( "PHP code received no \$_REQUEST?" );
}

require_once "__docroot:html5__/__application__/ajax/ga_filter.php";

$modjson = json_decode( '__modulejson__', true );
if ( !is_array( $modjson ) ) {
    action_error_exit( "Internal error: unable to parse module JSON for action endpoint" );
}

if ( !isset( $_REQUEST[ '_window' ] ) ) {
    action_error_exit( "Internal error: no window specified" );
}
$window = $_REQUEST[ '_window' ];
if ( !isset( $_SESSION[ $window ] ) ) {
    $_SESSION[ $window ] = array( "logon" => "", "project" => "" );
}

if ( !isset( $_SESSION[ $window ][ 'logon' ] ) ||
     !isset( $_REQUEST[ '_logon' ] ) ) {
    $results[ '_logon' ] = "";
    echo json_encode($results);
    exit();
}

if ( $_REQUEST[ '_logon' ] != $_SESSION[ $window ][ 'logon' ] ) {
    $results[ '_logon' ] = "";
    $results[ 'error'  ] = 'Possible security violation user mismatch.';
    echo json_encode($results);
    exit();
}

if ( !strlen( $_SESSION[ $window ][ 'logon' ] ) ) {
    action_error_exit( "You must be logged on to utilize this feature" );
}

if ( !isset( $_REQUEST[ '_action' ] ) ||
     !preg_match( '/^[a-zA-Z0-9_]+$/', $_REQUEST[ '_action' ] ) ) {
    action_error_exit( "Internal error: invalid action id" );
}

$action_id = $_REQUEST[ '_action' ];
$action = null;
if ( isset( $modjson[ 'fields' ] ) && is_array( $modjson[ 'fields' ] ) ) {
    foreach ( $modjson[ 'fields' ] as $field ) {
        if ( isset( $field[ 'type' ] ) && $field[ 'type' ] == 'action' &&
             isset( $field[ 'id' ] ) && $field[ 'id' ] == $action_id ) {
            $action = $field;
            break;
        }
    }
}

if ( !is_array( $action ) ) {
    action_error_exit( "Internal error: action '$action_id' is not defined for this module" );
}

if ( !isset( $action[ 'executable' ] ) ||
     !preg_match( '/^[a-zA-Z0-9][a-zA-Z0-9_.\/-]*$/', $action[ 'executable' ] ) ||
     strpos( $action[ 'executable' ], '..' ) !== false ) {
    action_error_exit( "Internal error: action '$action_id' has no valid executable" );
}

$actionexe = "__executable_path:html5__/" . $action[ 'executable' ];
if ( !file_exists( $actionexe ) ) {
    action_error_exit( "action executable $actionexe not found" );
}
if ( !is_executable( $actionexe ) ) {
    action_error_exit( "action executable $actionexe is not set to be executable" );
}

if ( !isset( $_REQUEST[ '_project' ] ) ) {
    action_error_exit( "No project specified" );
}

$dir = "__docroot:html5__/__application__/results/users/" . $_SESSION[ $window ][ 'logon' ];
$project = $_REQUEST[ '_project' ];
if ( !strlen( $project ) ) {
    $project = "no_project_specified";
}
if ( !preg_match( '/^[a-zA-Z0-9]+[a-zA-Z0-9_]+$/', $project ) ) {
    action_error_exit( "Invalid project specified" );
}

$rdir = "$dir/$project";
if ( !is_dir( $rdir ) ) {
    ob_start();
    mkdir( $rdir, 0775, true );
    ob_end_clean();
}
if ( !is_dir( $rdir ) ) {
    action_error_exit( "Could not create project directory" );
}

$action_dir = "$rdir/_actions/__moduleid__/$action_id";
if ( !is_dir( $action_dir ) ) {
    ob_start();
    mkdir( $action_dir, 0775, true );
    ob_end_clean();
}
if ( !is_dir( $action_dir ) ) {
    action_error_exit( "Could not create action directory" );
}

$_REQUEST[ '_action_workdir' ] = $action_dir;
$_REQUEST[ '_module' ] = "__moduleid__";
$payload = json_encode( $_REQUEST );

$descriptors = array(
    0 => array( "pipe", "r" ),
    1 => array( "pipe", "w" ),
    2 => array( "pipe", "w" )
);

$process = proc_open( $actionexe, $descriptors, $pipes, $action_dir );
if ( !is_resource( $process ) ) {
    action_error_exit( "Unable to start action executable" );
}

fwrite( $pipes[0], $payload );
fclose( $pipes[0] );
stream_set_blocking( $pipes[1], false );
stream_set_blocking( $pipes[2], false );

$stdout = '';
$stderr = '';
$started = time();
$timeout = isset( $action[ 'timeout' ] ) && intval( $action[ 'timeout' ] ) > 0 ? intval( $action[ 'timeout' ] ) : 30;
$exitcode = 0;

while ( true ) {
    $status = proc_get_status( $process );
    $stdout .= stream_get_contents( $pipes[1] );
    $stderr .= stream_get_contents( $pipes[2] );
    if ( !$status[ 'running' ] ) {
        $exitcode = isset( $status[ 'exitcode' ] ) ? $status[ 'exitcode' ] : 0;
        break;
    }
    if ( time() - $started > $timeout ) {
        proc_terminate( $process );
        action_error_exit( "action $action_id exceeded timeout of $timeout seconds" );
    }
    usleep( 100000 );
}

$stdout .= stream_get_contents( $pipes[1] );
$stderr .= stream_get_contents( $pipes[2] );
fclose( $pipes[1] );
fclose( $pipes[2] );
proc_close( $process );

if ( $exitcode ) {
    action_error_exit( "action $action_id failed" . ( strlen( $stderr ) ? ": " . substr( $stderr, 0, 500 ) : "" ) );
}

$action_results = json_decode( $stdout, true );
if ( !is_array( $action_results ) ) {
    action_error_exit( "action $action_id returned invalid JSON<br>" . substr( $stdout, 0, 1000 ) );
}

if ( !isset( $action_results[ 'status' ] ) ) {
    $action_results[ 'status' ] = 'pass';
}

echo json_encode( $action_results );
exit();
