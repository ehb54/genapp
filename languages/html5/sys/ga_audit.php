<?php

// Generic, opt-in security audit events for generated GenApp applications.
// This helper must never make an application request fail.

function ga_audit_config() {
    static $config = null;
    if ( $config !== null ) {
        return $config;
    }
    $config = array();
    $decoded = @json_decode( @file_get_contents( "__appconfig__" ), true );
    if ( is_array( $decoded ) && isset( $decoded[ 'audit' ] ) &&
         is_array( $decoded[ 'audit' ] ) ) {
        $config = $decoded[ 'audit' ];
    }
    return $config;
}

function ga_file_transfer_audit_enabled() {
    $config = ga_audit_config();
    return !empty( $config[ 'enabled' ] ) && !empty( $config[ 'file_transfers' ] );
}

function ga_audit_safe_value( $value, $maximum = 512 ) {
    if ( is_bool( $value ) || is_int( $value ) || is_float( $value ) ) {
        return $value;
    }
    if ( !is_string( $value ) ) {
        return null;
    }
    $value = preg_replace( '/[\x00-\x1f\x7f]+/', ' ', $value );
    return substr( $value, 0, $maximum );
}

function ga_audit_transfer_id() {
    try {
        return bin2hex( random_bytes( 16 ) );
    } catch ( Exception $error ) {
        return hash( 'sha256', uniqid( '', true ) . mt_rand() );
    }
}

function ga_audit_resolve_user_result( $application_root, $username, $target ) {
    if ( !is_string( $application_root ) || !is_string( $username ) ||
         !is_string( $target ) || !strlen( $username ) ) {
        return false;
    }
    $target = ltrim( $target, '/' );
    $required_prefix = 'results/users/' . $username . '/';
    if ( strpos( $target, $required_prefix ) !== 0 ) {
        return false;
    }
    $root = realpath( $application_root );
    $user_root = realpath( $application_root . '/results/users/' . $username );
    $resolved = realpath( $application_root . '/' . $target );
    if ( $root === false || $user_root === false || $resolved === false ||
         strpos( $resolved, $user_root . DIRECTORY_SEPARATOR ) !== 0 ||
         !is_file( $resolved ) ) {
        return false;
    }
    return $resolved;
}

function ga_file_transfer_audit( $event, $details = array() ) {
    if ( !ga_file_transfer_audit_enabled() ) {
        return false;
    }
    try {
        $allowed = array(
            'transfer_id', 'username', 'project', 'module', 'field',
            'filename', 'relative_path', 'size_bytes', 'outcome', 'failure'
        );
        $record = array(
            'schema'       => 'genapp.file_transfer.v1',
            'timestamp'    => gmdate( 'c' ),
            'application'  => '__application__',
            'event'        => ga_audit_safe_value( $event, 64 ),
            'source_ip'    => isset( $_SERVER[ 'REMOTE_ADDR' ] )
                ? ga_audit_safe_value( $_SERVER[ 'REMOTE_ADDR' ], 64 ) : ''
        );
        foreach ( $allowed as $key ) {
            if ( array_key_exists( $key, $details ) ) {
                $value = ga_audit_safe_value( $details[ $key ] );
                if ( $value !== null ) {
                    $record[ $key ] = $value;
                }
            }
        }
        $message = 'GENAPP_AUDIT ' . json_encode( $record,
            JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE );
        $config = ga_audit_config();
        if ( isset( $config[ 'destination' ] ) &&
             strtolower( $config[ 'destination' ] ) === 'syslog' ) {
            @openlog( 'genapp', LOG_PID, LOG_AUTH );
            @syslog( LOG_INFO, $message );
            @closelog();
        } else {
            @error_log( $message );
        }
        return true;
    } catch ( Exception $error ) {
        return false;
    }
}
