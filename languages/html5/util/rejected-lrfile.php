<?php

/* Ownership receipt and narrow cleanup for SASSIE-rejected lrfile uploads. */

function ga_rejected_lrfile_fields( $module_json ) {
    $fields = array();
    if ( !is_object( $module_json ) || !isset( $module_json->fields ) ||
         !is_array( $module_json->fields ) ) {
        return $fields;
    }
    foreach ( $module_json->fields as $field ) {
        if ( is_object( $field ) && isset( $field->id, $field->type ) &&
             $field->type === 'lrfile' &&
             preg_match( '/^[A-Za-z][A-Za-z0-9_]*$/', $field->id ) ) {
            $fields[ $field->id ] = true;
        }
    }
    return $fields;
}

function ga_rejected_lrfile_coordinate( $module_json, $upload_key, $member_index = 0 ) {
    if ( !is_string( $upload_key ) ||
         filter_var( $member_index, FILTER_VALIDATE_INT ) === false ||
         intval( $member_index ) < 0 ) {
        return null;
    }
    foreach ( ga_rejected_lrfile_fields( $module_json ) as $field => $_unused ) {
        if ( $upload_key === $field ) {
            return array( 'field' => $field, 'index' => intval( $member_index ) );
        }
        if ( preg_match( '/(?:^|-)' . preg_quote( $field, '/' ) . '-([0-9]+)$/',
                         $upload_key, $matches ) ) {
            return array( 'field' => $field, 'index' => intval( $matches[ 1 ] ) );
        }
    }
    return null;
}

function ga_rejected_lrfile_path_within_root( $path, $root ) {
    $real_root = realpath( $root );
    $real_path = realpath( $path );
    return $real_root !== false && $real_path !== false &&
           dirname( $real_path ) === $real_root;
}

function ga_rejected_lrfile_identity( $path ) {
    clearstatcache( true, $path );
    if ( is_link( $path ) || !is_file( $path ) ) {
        return null;
    }
    $stat = @lstat( $path );
    if ( $stat === false ) {
        return null;
    }
    return array(
        'dev' => intval( $stat[ 'dev' ] ),
        'ino' => intval( $stat[ 'ino' ] ),
        'size' => intval( $stat[ 'size' ] ),
        'ctime' => intval( $stat[ 'ctime' ] ),
        'mtime' => intval( $stat[ 'mtime' ] ),
    );
}

function ga_record_rejected_lrfile_upload( &$entries, $module_json, $upload_key,
                                            $member_index, $path, $project_root ) {
    $coordinate = ga_rejected_lrfile_coordinate(
        $module_json, $upload_key, $member_index );
    if ( $coordinate === null ||
         !ga_rejected_lrfile_path_within_root( $path, $project_root ) ) {
        return false;
    }
    $real_path = realpath( $path );
    $identity = ga_rejected_lrfile_identity( $real_path );
    if ( $identity === null ) {
        return false;
    }
    $entries[] = array(
        'field' => $coordinate[ 'field' ],
        'index' => $coordinate[ 'index' ],
        'path' => $real_path,
        'identity' => $identity,
    );
    return true;
}

function ga_rejected_lrfile_receipt_path( $logdir, $uuid ) {
    if ( !is_string( $uuid ) || !preg_match( '/^[A-Za-z0-9_-]+$/', $uuid ) ) {
        return null;
    }
    $real_logdir = realpath( $logdir );
    if ( $real_logdir === false ) {
        return null;
    }
    $effective_uid = function_exists( 'posix_geteuid' )
        ? posix_geteuid() : getmyuid();
    $receipt_directory = rtrim( sys_get_temp_dir(), DIRECTORY_SEPARATOR ) .
                         DIRECTORY_SEPARATOR . 'genapp-rejected-lrfiles-' .
                         intval( $effective_uid );
    if ( !is_dir( $receipt_directory ) &&
         !@mkdir( $receipt_directory, 0700, true ) ) {
        return null;
    }
    clearstatcache( true, $receipt_directory );
    $receipt_permissions = @fileperms( $receipt_directory );
    $receipt_owner = @fileowner( $receipt_directory );
    if ( is_link( $receipt_directory ) || !is_dir( $receipt_directory ) ||
         $receipt_permissions === false ||
         ( $receipt_permissions & 0077 ) !== 0 ||
         $receipt_owner !== intval( $effective_uid ) ) {
        return null;
    }
    $namespace = hash( 'sha256', $real_logdir );
    return $receipt_directory . DIRECTORY_SEPARATOR . $namespace . '-' .
           $uuid . '.json';
}

function ga_write_rejected_lrfile_receipt( $receipt_path, $entries ) {
    if ( !count( $entries ) ) {
        return true;
    }
    $directory = dirname( $receipt_path );
    $temporary = @tempnam( $directory, '.lrfile-receipt-' );
    if ( $temporary === false ) {
        return false;
    }
    $payload = json_encode( array( 'version' => 1, 'uploads' => array_values( $entries ) ) );
    $written = $payload !== false &&
               @file_put_contents( $temporary, $payload, LOCK_EX ) === strlen( $payload ) &&
               @chmod( $temporary, 0600 ) && @rename( $temporary, $receipt_path );
    if ( !$written && file_exists( $temporary ) ) {
        @unlink( $temporary );
    }
    return $written;
}

function ga_rejected_lrfile_identity_matches( $expected, $actual ) {
    if ( !is_array( $expected ) || !is_array( $actual ) ) {
        return false;
    }
    foreach ( array( 'dev', 'ino', 'size', 'ctime', 'mtime' ) as $key ) {
        if ( !array_key_exists( $key, $expected ) ||
             intval( $expected[ $key ] ) !== intval( $actual[ $key ] ) ) {
            return false;
        }
    }
    return true;
}

function ga_remove_receipted_lrfile_uploads( $entries, $project_root, $coordinates = null ) {
    $deleted = 0;
    $skipped = 0;
    $wanted = null;
    if ( is_array( $coordinates ) ) {
        $wanted = array();
        foreach ( $coordinates as $coordinate ) {
            if ( is_object( $coordinate ) ) {
                $coordinate = get_object_vars( $coordinate );
            }
            if ( is_array( $coordinate ) &&
                 isset( $coordinate[ 'field' ], $coordinate[ 'index' ] ) &&
                 is_string( $coordinate[ 'field' ] ) &&
                 preg_match( '/^[A-Za-z][A-Za-z0-9_]*$/', $coordinate[ 'field' ] ) &&
                 is_int( $coordinate[ 'index' ] ) && $coordinate[ 'index' ] >= 0 ) {
                $wanted[ $coordinate[ 'field' ] . ':' . $coordinate[ 'index' ] ] = true;
            }
        }
    }
    foreach ( $entries as $entry ) {
        if ( !is_array( $entry ) || !isset( $entry[ 'field' ], $entry[ 'index' ],
                                             $entry[ 'path' ], $entry[ 'identity' ] ) ) {
            ++$skipped;
            continue;
        }
        $key = $entry[ 'field' ] . ':' . $entry[ 'index' ];
        if ( $wanted !== null && !isset( $wanted[ $key ] ) ) {
            continue;
        }
        $path = $entry[ 'path' ];
        if ( !is_string( $path ) ||
             !ga_rejected_lrfile_path_within_root( $path, $project_root ) ||
             !ga_rejected_lrfile_identity_matches(
                 $entry[ 'identity' ], ga_rejected_lrfile_identity( $path ) ) ) {
            ++$skipped;
            continue;
        }
        if ( @unlink( $path ) ) {
            ++$deleted;
        } else {
            ++$skipped;
        }
    }
    return array( 'deleted' => $deleted, 'skipped' => $skipped );
}

function ga_cleanup_sassie_rejected_lrfiles( $output, $receipt_path, $project_root ) {
    if ( !is_file( $receipt_path ) ) {
        return array( 'deleted' => 0, 'skipped' => 0 );
    }
    if ( !is_object( $output ) || !isset( $output->_sassie_rejected_lrfiles ) ||
         !is_array( $output->_sassie_rejected_lrfiles ) ) {
        @unlink( $receipt_path );
        return array( 'deleted' => 0, 'skipped' => 0 );
    }
    $receipt = json_decode( @file_get_contents( $receipt_path ), true );
    if ( !is_array( $receipt ) || !isset( $receipt[ 'version' ], $receipt[ 'uploads' ] ) ||
         $receipt[ 'version' ] !== 1 || !is_array( $receipt[ 'uploads' ] ) ) {
        @unlink( $receipt_path );
        return array( 'deleted' => 0, 'skipped' => 1 );
    }
    $result = ga_remove_receipted_lrfile_uploads(
        $receipt[ 'uploads' ], $project_root, $output->_sassie_rejected_lrfiles );
    @unlink( $receipt_path );
    return $result;
}
