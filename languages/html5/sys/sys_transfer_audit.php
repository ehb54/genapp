<?php

session_name( strtoupper( preg_replace('/[^a-zA-Z0-9_]+/', '_', "GENAPP___application__" ) ) );
session_start();
require_once __DIR__ . '/ga_audit.php';

function ga_transfer_deny( $reason, $context = array() ) {
    $context[ 'outcome' ] = 'denied';
    $context[ 'failure' ] = $reason;
    ga_file_transfer_audit( 'download_denied', $context );
    http_response_code( 403 );
    header( 'Content-Type: text/plain; charset=utf-8' );
    echo "Download denied.\n";
    exit();
}

$window = isset( $_GET[ 'window' ] ) ? (string) $_GET[ 'window' ] : '';
$username = isset( $_SESSION[ $window ][ 'logon' ] )
    ? (string) $_SESSION[ $window ][ 'logon' ] : '';
$project = isset( $_SESSION[ $window ][ 'project' ] )
    ? (string) $_SESSION[ $window ][ 'project' ] : '';
$target = isset( $_GET[ 'target' ] ) ? ltrim( (string) $_GET[ 'target' ], '/' ) : '';
$transfer_id = ga_audit_transfer_id();
$context = array(
    'transfer_id' => $transfer_id,
    'username' => $username,
    'project' => $project
);

if ( !strlen( $username ) || !strlen( $target ) ) {
    ga_transfer_deny( 'missing_authenticated_user_or_target', $context );
}

$application_root = realpath( dirname( dirname( __DIR__ ) ) );
$resolved = ga_audit_resolve_user_result( $application_root, $username, $target );
if ( $resolved === false ) {
    ga_transfer_deny( 'target_missing_or_invalid', $context );
}

$relative = substr( $resolved, strlen( $application_root ) + 1 );
$context[ 'filename' ] = basename( $resolved );
$context[ 'relative_path' ] = $relative;
$context[ 'size_bytes' ] = filesize( $resolved );
$context[ 'outcome' ] = 'requested';
ga_file_transfer_audit( 'download_requested', $context );

$segments = array_map( 'rawurlencode', explode( '/', $relative ) );
$location = '../../' . implode( '/', $segments ) . '?ga_transfer_id=' . rawurlencode( $transfer_id );
session_write_close();
header( 'Cache-Control: no-store' );
header( 'Location: ' . $location, true, 302 );
exit();
