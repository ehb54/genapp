<?php

const GA_SUBMISSION_UPLOAD_MANIFEST_VERSION = 1;

function ga_submission_upload_manifest_path( $log_directory, $uuid )
{
    return rtrim( $log_directory, '/' ) . '/_submission_uploads_' .
        hash( 'sha256', (string) $uuid ) . '.json';
}

function ga_submission_upload_path_is_within( $path, $root )
{
    $path = rtrim( $path, '/' );
    $root = rtrim( $root, '/' );
    return $path === $root || strpos( $path, $root . '/' ) === 0;
}

function ga_submission_upload_base_name( $submitted_name )
{
    $base_name = basename( str_replace( "\\", '/', (string) $submitted_name ) );
    if ( $base_name === '' || $base_name === '.' || $base_name === '..' ) {
        return false;
    }
    return $base_name;
}

function ga_submission_upload_identity( $path, $project_root )
{
    clearstatcache( true, $path );
    $root = realpath( $project_root );
    $resolved_path = realpath( $path );
    $metadata = lstat( $path );
    if ( $root === false || $resolved_path === false || $metadata === false ||
         is_link( $path ) || !is_file( $path ) ||
         !ga_submission_upload_path_is_within( $resolved_path, $root ) ) {
        return false;
    }
    return array(
        'path' => $resolved_path,
        'device' => (int) $metadata[ 'dev' ],
        'inode' => (int) $metadata[ 'ino' ],
        'size' => (int) $metadata[ 'size' ],
    );
}

function ga_submission_upload_identity_matches( $identity, $expected )
{
    return is_array( $identity ) && is_array( $expected ) &&
        isset( $identity[ 'device' ], $identity[ 'inode' ], $identity[ 'size' ],
               $expected[ 'device' ], $expected[ 'inode' ], $expected[ 'size' ] ) &&
        (int) $identity[ 'device' ] === (int) $expected[ 'device' ] &&
        (int) $identity[ 'inode' ] === (int) $expected[ 'inode' ] &&
        (int) $identity[ 'size' ] === (int) $expected[ 'size' ];
}

function ga_remove_submission_upload_if_owned( $path, $identity, $project_root )
{
    $current = ga_submission_upload_identity( $path, $project_root );
    return ga_submission_upload_identity_matches( $current, $identity ) && @unlink( $path );
}

function ga_submission_upload_staging_directory( $directory )
{
    $root = realpath( $directory );
    if ( $root === false || !is_dir( $root ) ) {
        return false;
    }

    for ( $attempt = 0; $attempt < 100; ++$attempt ) {
        try {
            $token = bin2hex( random_bytes( 16 ) );
        } catch ( Exception $exception ) {
            $token = hash( 'sha256', uniqid( '', true ) . ':' . getmypid() . ':' . $attempt );
        }
        $staging_directory = $root . '/.ga-upload-stage-' . $token;
        if ( @mkdir( $staging_directory, 0700 ) ) {
            return $staging_directory;
        }
    }
    return false;
}

function ga_publish_submission_upload( $staged_path, $directory, $submitted_name )
{
    $base_name = ga_submission_upload_base_name( $submitted_name );
    if ( $base_name === false ) {
        return false;
    }

    $extension = pathinfo( $base_name, PATHINFO_EXTENSION );
    $stem = pathinfo( $base_name, PATHINFO_FILENAME );
    $suffix = $extension === '' ? '' : '.' . $extension;
    for ( $number = 0; $number < 100000; ++$number ) {
        $name = $number === 0 ? $base_name : $stem . '-' . $number . $suffix;
        $candidate = rtrim( $directory, '/' ) . '/' . $name;
        if ( @link( $staged_path, $candidate ) ) {
            return $candidate;
        }
        clearstatcache( true, $candidate );
        if ( !file_exists( $candidate ) && !is_link( $candidate ) ) {
            return false;
        }
    }
    return false;
}

function ga_record_submission_upload( $log_directory, $uuid, $field, $path, $project_root, $expected_identity = null )
{
    $root = realpath( $project_root );
    $identity = ga_submission_upload_identity( $path, $project_root );
    if ( $root === false || $identity === false ||
         ( $expected_identity !== null &&
           !ga_submission_upload_identity_matches( $identity, $expected_identity ) ) ) {
        return false;
    }

    $manifest_path = ga_submission_upload_manifest_path( $log_directory, $uuid );
    if ( is_link( $manifest_path ) ) {
        return false;
    }
    $handle = fopen( $manifest_path, 'c+' );
    if ( $handle === false || !flock( $handle, LOCK_EX ) ) {
        if ( $handle !== false ) {
            fclose( $handle );
        }
        return false;
    }

    $contents = stream_get_contents( $handle );
    $manifest = $contents === '' ? array() : json_decode( $contents, true );
    if ( !is_array( $manifest ) ) {
        $manifest = array();
    }
    if ( !isset( $manifest[ 'uploads' ] ) || !is_array( $manifest[ 'uploads' ] ) ) {
        $manifest = array(
            'version' => GA_SUBMISSION_UPLOAD_MANIFEST_VERSION,
            'uuid' => (string) $uuid,
            'project_root' => $root,
            'uploads' => array(),
            'cleanup' => array(),
        );
    }
    if ( !isset( $manifest[ 'project_root' ] ) || $manifest[ 'project_root' ] !== $root ) {
        flock( $handle, LOCK_UN );
        fclose( $handle );
        return false;
    }

    $manifest[ 'uploads' ][] = array(
        'field' => (string) $field,
        'path' => $identity[ 'path' ],
        'device' => $identity[ 'device' ],
        'inode' => $identity[ 'inode' ],
        'size' => $identity[ 'size' ],
    );

    rewind( $handle );
    $written = ftruncate( $handle, 0 ) &&
        fwrite( $handle, json_encode( $manifest, JSON_PRETTY_PRINT ) . "\n" ) !== false &&
        fflush( $handle );
    flock( $handle, LOCK_UN );
    fclose( $handle );
    if ( $written ) {
        @chmod( $manifest_path, 0600 );
    }
    return $written;
}

function ga_accept_submission_upload( $temporary_path, $submitted_name, $field,
                                      $directory, $log_directory, $uuid )
{
    $staging_directory = ga_submission_upload_staging_directory( $directory );
    if ( $staging_directory === false ) {
        return array( 'ok' => false, 'error' => 'staging-directory-failed' );
    }

    $staged_path = $staging_directory . '/upload';
    $published_path = false;
    $identity = false;
    try {
        if ( !move_uploaded_file( $temporary_path, $staged_path ) ) {
            return array( 'ok' => false, 'error' => 'upload-move-failed' );
        }
        $identity = ga_submission_upload_identity( $staged_path, $directory );
        if ( $identity === false ) {
            return array( 'ok' => false, 'error' => 'staged-identity-failed' );
        }

        $published_path = ga_publish_submission_upload(
            $staged_path, $directory, $submitted_name );
        if ( $published_path === false ) {
            return array( 'ok' => false, 'error' => 'atomic-publish-failed' );
        }
        $published_identity = ga_submission_upload_identity( $published_path, $directory );
        if ( !ga_submission_upload_identity_matches( $published_identity, $identity ) ) {
            ga_remove_submission_upload_if_owned( $published_path, $identity, $directory );
            return array( 'ok' => false, 'error' => 'published-identity-mismatch' );
        }
        if ( !ga_record_submission_upload(
                 $log_directory, $uuid, $field, $published_path, $directory, $identity ) ) {
            ga_remove_submission_upload_if_owned( $published_path, $identity, $directory );
            return array( 'ok' => false, 'error' => 'ownership-record-failed' );
        }
        return array( 'ok' => true, 'path' => $published_path );
    } finally {
        if ( $identity !== false ) {
            ga_remove_submission_upload_if_owned( $staged_path, $identity, $directory );
        } elseif ( is_file( $staged_path ) && !is_link( $staged_path ) ) {
            @unlink( $staged_path );
        }
        @rmdir( $staging_directory );
    }
}

function ga_cleanup_submission_uploads( $log_directory, $uuid, $project_root )
{
    $manifest_path = ga_submission_upload_manifest_path( $log_directory, $uuid );
    $root = realpath( $project_root );
    if ( $root === false || !is_file( $manifest_path ) || is_link( $manifest_path ) ) {
        return array( 'removed' => array(), 'refused' => array(), 'manifest' => $manifest_path );
    }

    $handle = fopen( $manifest_path, 'r+' );
    if ( $handle === false || !flock( $handle, LOCK_EX ) ) {
        if ( $handle !== false ) {
            fclose( $handle );
        }
        return array( 'removed' => array(), 'refused' => array( 'manifest-lock-failed' ), 'manifest' => $manifest_path );
    }

    $manifest = json_decode( stream_get_contents( $handle ), true );
    $removed = array();
    $refused = array();
    if ( !is_array( $manifest ) ||
         !isset( $manifest[ 'project_root' ] ) ||
         $manifest[ 'project_root' ] !== $root ||
         !isset( $manifest[ 'uploads' ] ) || !is_array( $manifest[ 'uploads' ] ) ) {
        $refused[] = 'invalid-manifest';
    } else {
        foreach ( $manifest[ 'uploads' ] as $entry ) {
            $path = isset( $entry[ 'path' ] ) ? $entry[ 'path' ] : '';
            if ( !is_string( $path ) || $path === '' ) {
                $refused[] = 'missing-path';
                continue;
            }
            if ( !file_exists( $path ) && !is_link( $path ) ) {
                continue;
            }
            $identity = ga_submission_upload_identity( $path, $root );
            if ( !ga_submission_upload_identity_matches( $identity, $entry ) ) {
                $refused[] = $path;
                continue;
            }
            if ( unlink( $path ) ) {
                $removed[] = $path;
            } else {
                $refused[] = $path;
            }
        }
    }

    if ( is_array( $manifest ) ) {
        if ( !isset( $manifest[ 'cleanup' ] ) || !is_array( $manifest[ 'cleanup' ] ) ) {
            $manifest[ 'cleanup' ] = array();
        }
        $manifest[ 'cleanup' ][] = array(
            'time_utc' => gmdate( 'c' ),
            'removed' => $removed,
            'refused' => $refused,
        );
        rewind( $handle );
        ftruncate( $handle, 0 );
        fwrite( $handle, json_encode( $manifest, JSON_PRETTY_PRINT ) . "\n" );
        fflush( $handle );
    }
    flock( $handle, LOCK_UN );
    fclose( $handle );

    return array( 'removed' => $removed, 'refused' => $refused, 'manifest' => $manifest_path );
}

function ga_cleanup_input_validation_uploads( $terminal_output, $log_directory, $uuid, $project_root )
{
    $decoded = is_string( $terminal_output ) ? json_decode( $terminal_output, true ) : $terminal_output;
    if ( !is_array( $decoded ) ||
         !isset( $decoded[ '_failure_class' ] ) ||
         $decoded[ '_failure_class' ] !== 'input_validation' ) {
        return false;
    }
    return ga_cleanup_submission_uploads( $log_directory, $uuid, $project_root );
}
