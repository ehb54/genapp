<?php
header('Content-type: application/json');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

session_name( strtoupper( preg_replace('/[^a-zA-Z0-9_]+/', '_', "GENAPP___application__" ) ) ); session_start();

require_once "__docroot:html5__/__application__/ajax/ga_filter.php";

$modjson = (object)[
    "fields" => [
        (object)[ "id" => "action", "type" => "text", "pattern" => "^(save|load|status)$" ],
        (object)[ "id" => "module", "type" => "text", "pattern" => "^[A-Za-z0-9_.-]+$" ]
    ]
];
$inputs_req = $_REQUEST;
unset( $inputs_req[ "layout" ] );
$validation_inputs = ga_sanitize_validate( $modjson, $inputs_req, 'sys_layout_designer' );

if ( $validation_inputs[ "output" ] == "failed" ) {
    echo json_encode( [ "error" => $validation_inputs[ "error" ] ] );
    exit();
}

$window = "";
if ( isset( $_REQUEST[ '_window' ] ) ) {
    $window = $_REQUEST[ '_window' ];
}
if ( !isset( $_SESSION[ $window ] ) ) {
    $_SESSION[ $window ] = array( "logon" => "", "project" => "" );
}

if ( !isset( $_SESSION[ $window ][ 'logon' ] ) ||
     !strlen( $_SESSION[ $window ][ 'logon' ] ) ) {
    echo json_encode( [ "error" => "not logged in" ] );
    exit();
}

$logon = $_SESSION[ $window ][ 'logon' ];
session_write_close();

$appconfig = json_decode( file_get_contents( "__appconfig__" ) );
if ( !$appconfig || !isset( $appconfig->restricted ) ) {
    echo json_encode( [ "error" => "designer requires appconfig restricted users" ] );
    exit();
}

$allowed = false;
foreach ( [ "admin", "designer" ] as $group ) {
    if ( isset( $appconfig->restricted->{$group} ) &&
         in_array( $logon, $appconfig->restricted->{$group} ) ) {
        $allowed = true;
        break;
    }
}

if ( !$allowed ) {
    echo json_encode( [ "error" => "not authorized for layout designer" ] );
    exit();
}

$action = isset( $_REQUEST[ "action" ] ) ? $_REQUEST[ "action" ] : "";
$module = isset( $_REQUEST[ "module" ] ) ? $_REQUEST[ "module" ] : "";
$module = preg_replace( "/[^a-zA-Z0-9_.-]+/", "_", $module );
if ( !strlen( $module ) ) {
    echo json_encode( [ "error" => "missing module" ] );
    exit();
}

$draft_dir = "__docroot:html5__/__application__/results/layout_drafts";
if ( !is_dir( $draft_dir ) && !mkdir( $draft_dir, 0775, true ) ) {
    echo json_encode( [ "error" => "could not create layout draft directory" ] );
    exit();
}

$draft_file = $draft_dir . "/" . $module . ".json";

switch ( $action ) {
case "save":
    if ( !isset( $_REQUEST[ "layout" ] ) ) {
        echo json_encode( [ "error" => "missing layout" ] );
        exit();
    }
    $layout = json_decode( $_REQUEST[ "layout" ] );
    if ( json_last_error() !== JSON_ERROR_NONE ) {
        echo json_encode( [ "error" => "layout is not valid JSON" ] );
        exit();
    }
    $draft = [
        "module" => $module,
        "updated_by" => $logon,
        "updated_at" => gmdate( "c" ),
        "layout" => $layout
    ];
    if ( file_put_contents( $draft_file, json_encode( $draft, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES ) ) === false ) {
        echo json_encode( [ "error" => "could not write layout draft" ] );
        exit();
    }
    echo json_encode( [ "status" => "Draft saved.", "module" => $module ] );
    exit();

case "load":
    if ( !is_file( $draft_file ) ) {
        echo json_encode( [ "status" => "No draft found.", "module" => $module ] );
        exit();
    }
    $draft = json_decode( file_get_contents( $draft_file ) );
    if ( json_last_error() !== JSON_ERROR_NONE ) {
        echo json_encode( [ "error" => "stored draft is not valid JSON" ] );
        exit();
    }
    echo json_encode( $draft );
    exit();

default:
    echo json_encode( [
        "status" => "Layout designer endpoint ready.",
        "module" => $module,
        "actions" => [ "save", "load" ]
    ] );
    exit();
}
?>
