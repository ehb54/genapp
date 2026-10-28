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
             ( !isset( $field->role ) || $field->role === 'input' ) &&
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
                                            $member_index, $path, $project_root,
                                            $transfer_id = null ) {
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
    $entry = array(
        'field' => $coordinate[ 'field' ],
        'index' => $coordinate[ 'index' ],
        'path' => $real_path,
        'identity' => $identity,
    );
    if ( is_string( $transfer_id ) &&
         preg_match( '/^[A-Za-z0-9_-]{1,128}$/', $transfer_id ) ) {
        $entry[ 'transfer_id' ] = $transfer_id;
    }
    $entries[] = $entry;
    return true;
}

function ga_rejected_lrfile_directory() {
    $uid = function_exists( 'posix_geteuid' ) ? posix_geteuid() : getmyuid();
    $directory = rtrim( sys_get_temp_dir(), DIRECTORY_SEPARATOR ) .
                 '/genapp-rejected-lrfiles-' . intval( $uid );
    if ( !is_dir( $directory ) && !@mkdir( $directory, 0700, true ) && !is_dir( $directory ) ) {
        return null;
    }
    clearstatcache( true, $directory );
    $permissions = @fileperms( $directory );
    if ( is_link( $directory ) || !is_dir( $directory ) || $permissions === false ||
         ( $permissions & 0077 ) !== 0 || @fileowner( $directory ) !== intval( $uid ) ) {
        return null;
    }
    return $directory;
}

function ga_rejected_lrfile_receipt_path( $logdir, $uuid ) {
    if ( !is_string( $uuid ) || !preg_match( '/^[A-Za-z0-9_-]+$/', $uuid ) ) {
        return null;
    }
    $root = realpath( $logdir );
    $directory = ga_rejected_lrfile_directory();
    return $root === false || $directory === null ? null :
        $directory . '/' . hash( 'sha256', $root ) . '-' . $uuid . '.json';
}

// Lock files remain in place: unlinking a lock can split cooperating writers.
function ga_lrfile_lock( $key ) {
    $directory = ga_rejected_lrfile_directory();
    if ( $directory === null ) { return false; }
    $path = $directory . '/lock-' . hash( 'sha256', $key );
    if ( is_link( $path ) ) { return false; }
    $handle = @fopen( $path, 'c+b' );
    if ( $handle === false ) { return false; }
    if ( !@chmod( $path, 0600 ) ) { fclose( $handle ); return false; }
    $until = microtime( true ) + 2.0;
    do {
        if ( @flock( $handle, LOCK_EX | LOCK_NB ) ) { return $handle; }
        usleep( 10000 );
    } while ( microtime( true ) < $until );
    fclose( $handle );
    return false;
}

function ga_lrfile_unlock( &$handle ) {
    if ( is_resource( $handle ) ) { @flock( $handle, LOCK_UN ); fclose( $handle ); }
    $handle = false;
}

function ga_lrfile_storage_lock( $root ) {
    $root = realpath( $root );
    if ( $root === false ) { return false; }
    // All generated handlers and jobrun resolve the same authenticated user tree.
    if ( preg_match( '#^(.*?/results/users/[^/]+)(?:/|$)#', $root, $match ) ) {
        $root = $match[1];
    }
    return ga_lrfile_lock( 'storage:' . $root );
}

function ga_lrfile_save_receipt( $path, $receipt, $create = false ) {
    if ( !is_string( $path ) || dirname( $path ) !== ga_rejected_lrfile_directory() ||
         is_link( $path ) ) { return false; }
    $payload = json_encode( $receipt );
    if ( $payload === false ) { return false; }
    if ( $create ) {
        $handle = @fopen( $path, 'x+b' );
        if ( $handle === false ) { return false; }
        $ok = @chmod( $path, 0600 ) && fwrite( $handle, $payload ) === strlen( $payload ) && fflush( $handle );
        fclose( $handle );
        // Keep an incomplete claim on failure; it must not authorize replacement.
        return $ok;
    }
    $temporary = @tempnam( dirname( $path ), '.lrfile-receipt-' );
    if ( $temporary === false ) { return false; }
    $ok = @chmod( $temporary, 0600 ) &&
        @file_put_contents( $temporary, $payload, LOCK_EX ) === strlen( $payload ) &&
        @rename( $temporary, $path );
    if ( !$ok ) { @unlink( $temporary ); }
    return $ok;
}

function ga_claim_rejected_lrfile_receipt( $path ) {
    if ( $path === null ) { return false; }
    $lock = ga_lrfile_lock( 'receipt:' . $path );
    if ( $lock === false ) { return false; }
    if ( !ga_lrfile_save_receipt( $path, array( 'version' => 1, 'uploads' => array() ), true ) ) {
        ga_lrfile_unlock( $lock );
        return false;
    }
    $GLOBALS['ga_lrfile_claims'][$path] = true;
    return $lock;
}

function ga_write_rejected_lrfile_receipt( $receipt_path, $entries ) {
    $claimed = !empty( $GLOBALS['ga_lrfile_claims'][$receipt_path] );
    $ok = ga_lrfile_save_receipt( $receipt_path,
        array( 'version' => 1, 'uploads' => array_values( $entries ) ), !$claimed );
    if ( $ok ) { unset( $GLOBALS['ga_lrfile_claims'][$receipt_path] ); }
    return $ok;
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

function ga_lrfile_coordinates( $coordinates ) {
    if ( !is_array( $coordinates ) ) { return null; }
    $wanted = array();
    foreach ( $coordinates as $coordinate ) {
        if ( is_object( $coordinate ) ) { $coordinate = get_object_vars( $coordinate ); }
        if ( !is_array( $coordinate ) || count( $coordinate ) !== 2 ||
             !isset( $coordinate['field'], $coordinate['index'] ) ||
             !is_string( $coordinate['field'] ) ||
             !preg_match( '/^[A-Za-z][A-Za-z0-9_]*$/', $coordinate['field'] ) ||
             !is_int( $coordinate['index'] ) || $coordinate['index'] < 0 ) { return null; }
        $wanted[$coordinate['field'] . ':' . $coordinate['index']] = true;
    }
    return $wanted;
}

function ga_lrfile_entry_valid( $entry ) {
    if ( !is_array( $entry ) || !isset( $entry['field'], $entry['index'], $entry['path'], $entry['identity'] ) ||
         ga_lrfile_coordinates( array( array( 'field' => $entry['field'], 'index' => $entry['index'] ) ) ) === null ||
         !is_string( $entry['path'] ) || !is_array( $entry['identity'] ) ) { return false; }
    foreach ( array( 'dev', 'ino', 'size', 'ctime', 'mtime' ) as $key ) {
        if ( !isset( $entry['identity'][$key] ) || !is_int( $entry['identity'][$key] ) ) { return false; }
    }
    return true;
}

function ga_lrfile_details( $entry ) {
    return array( 'field' => $entry['field'], 'filename' => basename( $entry['path'] ),
        'size_bytes' => intval( $entry['identity']['size'] ),
        'transfer_id' => isset( $entry['transfer_id'] ) ? $entry['transfer_id'] : '' );
}

// Caller owns the storage lock, including the final identity check and unlink.
function ga_lrfile_remove_one( $entry, $root ) {
    $path = $entry['path'];
    clearstatcache( true, $path );
    if ( !file_exists( $path ) && !is_link( $path ) ) {
        return array( 'outcome' => 'missing', 'failure' => 'file_missing' );
    }
    if ( !ga_rejected_lrfile_path_within_root( $path, $root ) ||
         !ga_rejected_lrfile_identity_matches( $entry['identity'], ga_rejected_lrfile_identity( $path ) ) ) {
        return array( 'outcome' => 'preserved', 'failure' => 'identity_or_root_mismatch' );
    }
    return @unlink( $path ) ? array( 'outcome' => 'deleted', 'failure' => '' ) :
        array( 'outcome' => 'failed', 'failure' => 'unlink_failed' );
}

function ga_remove_receipted_lrfile_uploads( $entries, $project_root, $coordinates = null ) {
    $result = array( 'deleted' => 0, 'skipped' => 0, 'deleted_uploads' => array() );
    $wanted = ga_lrfile_coordinates( $coordinates );
    if ( $wanted === null || !$wanted ) { return $result; }
    $lock = ga_lrfile_storage_lock( $project_root );
    if ( $lock === false ) { $result['skipped'] = count( $entries ); return $result; }
    try {
        foreach ( $entries as $entry ) {
            if ( !ga_lrfile_entry_valid( $entry ) ) { ++$result['skipped']; continue; }
            if ( !isset( $wanted[$entry['field'] . ':' . $entry['index']] ) ) { continue; }
            $outcome = ga_lrfile_remove_one( $entry, $project_root );
            if ( $outcome['outcome'] === 'deleted' ) {
                ++$result['deleted']; $result['deleted_uploads'][] = ga_lrfile_details( $entry );
            } else { ++$result['skipped']; }
        }
    } finally { ga_lrfile_unlock( $lock ); }
    return $result;
}

function ga_cleanup_sassie_rejected_lrfiles( $output, $receipt_path, $project_root,
                                             $before = null, $after = null, $context = array() ) {
    $result = array( 'deleted' => 0, 'skipped' => 0, 'deleted_uploads' => array(), 'pending' => false );
    if ( !is_string( $receipt_path ) || dirname( $receipt_path ) !== ga_rejected_lrfile_directory() ||
         !is_file( $receipt_path ) || is_link( $receipt_path ) ) { return $result; }
    $lock = ga_lrfile_lock( 'receipt:' . $receipt_path );
    if ( $lock === false ) { $result['pending'] = true; return $result; }
    try {
        $receipt = json_decode( @file_get_contents( $receipt_path ), true );
        if ( !is_array( $receipt ) || !isset( $receipt['version'], $receipt['uploads'] ) ||
             $receipt['version'] !== 1 || !is_array( $receipt['uploads'] ) ) {
            $result['pending'] = true; return $result;
        }
        $coordinates = is_object( $output ) && isset( $output->_sassie_rejected_lrfiles )
            ? ga_lrfile_coordinates( $output->_sassie_rejected_lrfiles ) : null;
        if ( $coordinates === null || !$coordinates ) {
            // Never discard pending rejection evidence on a later malformed response.
            if ( empty( $receipt['processing'] ) ) { @unlink( $receipt_path ); }
            else { $result['pending'] = true; }
            return $result;
        }
        if ( !isset( $receipt['processing'] ) ) { $receipt['processing'] = array(); }
        if ( !isset( $receipt['context'] ) ) {
            $receipt['context'] = array();
            foreach ( array( 'username', 'project', 'module' ) as $key ) {
                if ( isset( $context[$key] ) && is_string( $context[$key] ) ) {
                    $receipt['context'][$key] = substr( $context[$key], 0, 512 );
                }
            }
        }
        foreach ( $receipt['uploads'] as $index => $entry ) {
            if ( !ga_lrfile_entry_valid( $entry ) ) { $result['pending'] = true; ++$result['skipped']; continue; }
            $key = $entry['field'] . ':' . $entry['index'];
            if ( !isset( $coordinates[$key] ) && !isset( $receipt['processing'][$index] ) ) { continue; }
            if ( !isset( $receipt['processing'][$index] ) ) { $receipt['processing'][$index] = array(); }
            $state =& $receipt['processing'][$index];
            if ( !isset( $entry['transfer_id'] ) || !is_string( $entry['transfer_id'] ) ||
                 !preg_match( '/^[A-Za-z0-9_-]{1,128}$/', $entry['transfer_id'] ) ) {
                // Stable correlation for older v1 receipts without a transfer ID.
                $entry['transfer_id'] = hash( 'sha256', $receipt_path . ':' . $index );
                $receipt['uploads'][$index]['transfer_id'] = $entry['transfer_id'];
            }
            $details = ga_lrfile_details( $entry );
            if ( !ga_lrfile_save_receipt( $receipt_path, $receipt ) ) { $result['pending'] = true; break; }
            if ( empty( $state['rejection_logged'] ) ) {
                if ( $before !== null && !call_user_func( $before, $details ) ) {
                    $result['pending'] = true; unset( $state ); continue;
                }
                $state['rejection_logged'] = true;
                if ( !ga_lrfile_save_receipt( $receipt_path, $receipt ) ) { $result['pending'] = true; break; }
            }
            if ( !isset( $state['result'] ) ) {
                if ( !empty( $state['intent'] ) ) {
                    // A process may have died after unlink; absence cannot prove deletion.
                    $state['result'] = array( 'outcome' => 'failed', 'failure' => 'cleanup_outcome_uncertain' );
                } else {
                    $storage = ga_lrfile_storage_lock( $project_root );
                    if ( $storage === false ) {
                        $state['result'] = array( 'outcome' => 'failed', 'failure' => 'storage_lock_unavailable' );
                    } else {
                        try {
                            $state['intent'] = true;
                            if ( !ga_lrfile_save_receipt( $receipt_path, $receipt ) ) { $result['pending'] = true; break; }
                            $state['result'] = ga_lrfile_remove_one( $entry, $project_root );
                            if ( !ga_lrfile_save_receipt( $receipt_path, $receipt ) ) { $result['pending'] = true; break; }
                        } finally { ga_lrfile_unlock( $storage ); }
                    }
                }
            }
            if ( !ga_lrfile_save_receipt( $receipt_path, $receipt ) ) { $result['pending'] = true; break; }
            $details = array_merge( $details, $state['result'] );
            if ( empty( $state['outcome_logged'] ) ) {
                $state['outcome_logged'] = $after === null || call_user_func( $after, $details );
                if ( !ga_lrfile_save_receipt( $receipt_path, $receipt ) ) { $result['pending'] = true; break; }
            }
            if ( $details['outcome'] === 'deleted' ) {
                ++$result['deleted']; $result['deleted_uploads'][] = ga_lrfile_details( $entry );
            } else { ++$result['skipped']; $result['pending'] = true; }
            if ( !$state['outcome_logged'] ) { $result['pending'] = true; }
            unset( $state );
        }
        if ( !$result['pending'] && !@unlink( $receipt_path ) ) { $result['pending'] = true; }
    } catch ( \Throwable $error ) {
        $result['pending'] = true;
    } finally { ga_lrfile_unlock( $lock ); }
    return $result;
}
