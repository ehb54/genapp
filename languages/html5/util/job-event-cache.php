<?php

/* Bounded replay journal for versioned GenApp runtime events. */

function ga_job_event_valid( $event ) {
    return is_array( $event )
        && isset( $event[ 'version' ] )
        && intval( $event[ 'version' ] ) === 1
        && isset( $event[ 'run' ] )
        && strlen( strval( $event[ 'run' ] ) )
        && isset( $event[ 'module' ] )
        && strlen( strval( $event[ 'module' ] ) )
        && isset( $event[ 'sequence' ] )
        && intval( $event[ 'sequence' ] ) > 0
        && isset( $event[ 'channel' ] )
        && strlen( strval( $event[ 'channel' ] ) )
        && isset( $event[ 'topic' ] )
        && strlen( strval( $event[ 'topic' ] ) );
}

function ga_job_event_key( $event ) {
    return intval( $event[ 'version' ] ) . "\n"
        . strval( $event[ 'run' ] ) . "\n"
        . strval( $event[ 'module' ] ) . "\n"
        . intval( $event[ 'sequence' ] );
}

function ga_job_event_replayable( $event ) {
    return !is_array( $event )
        || !array_key_exists( 'replay', $event )
        || $event[ 'replay' ] !== false;
}

function ga_job_event_replay_record( $event ) {
    if ( ga_job_event_replayable( $event ) ) {
        return $event;
    }
    return array(
        'version' => intval( $event[ 'version' ] ),
        'run' => strval( $event[ 'run' ] ),
        'module' => strval( $event[ 'module' ] ),
        'sequence' => intval( $event[ 'sequence' ] ),
        'timestamp' => isset( $event[ 'timestamp' ] )
            ? strval( $event[ 'timestamp' ] ) : '',
        'channel' => 'transient',
        'topic' => strval( $event[ 'channel' ] ) . ':'
            . strval( $event[ 'topic' ] ),
        'operation' => 'replace',
        'payload' => array( 'omitted' => true ),
    );
}

function ga_job_event_recovery_anchor_key( $event ) {
    if ( !is_array( $event )
         || !isset( $event[ 'operation' ] )
         || strval( $event[ 'operation' ] ) !== 'snapshot' ) {
        return '';
    }
    return intval( $event[ 'version' ] ) . "\n"
        . strval( $event[ 'run' ] ) . "\n"
        . strval( $event[ 'module' ] ) . "\n"
        . strval( $event[ 'channel' ] ) . "\n"
        . strval( $event[ 'topic' ] );
}

function ga_job_event_trim_count( $events, $max_count ) {
    $max_count = max( 0, intval( $max_count ) );
    if ( $max_count === 0 ) {
        return array();
    }
    if ( count( $events ) <= $max_count ) {
        return $events;
    }

    $latest_anchor_indexes = array();
    foreach ( $events as $index => $event ) {
        $anchor_key = ga_job_event_recovery_anchor_key( $event );
        if ( strlen( $anchor_key ) ) {
            $latest_anchor_indexes[ $anchor_key ] = $index;
        }
    }

    $anchor_indexes = array_values( $latest_anchor_indexes );
    sort( $anchor_indexes, SORT_NUMERIC );
    if ( count( $anchor_indexes ) > $max_count ) {
        $anchor_indexes = array_slice( $anchor_indexes, -$max_count );
    }

    $selected = array_fill_keys( $anchor_indexes, true );
    for ( $index = count( $events ) - 1;
          $index >= 0 && count( $selected ) < $max_count;
          $index-- ) {
        $selected[ $index ] = true;
    }
    ksort( $selected, SORT_NUMERIC );

    $trimmed = array();
    foreach ( array_keys( $selected ) as $index ) {
        $trimmed[] = $events[ $index ];
    }
    return $trimmed;
}

function ga_job_event_trim_bytes( $events, $max_bytes ) {
    $max_bytes = max( 0, intval( $max_bytes ) );
    while ( count( $events )
            && strlen( json_encode( $events ) ) > $max_bytes ) {
        $latest_anchor_indexes = array();
        foreach ( $events as $index => $event ) {
            $anchor_key = ga_job_event_recovery_anchor_key( $event );
            if ( strlen( $anchor_key ) ) {
                $latest_anchor_indexes[ $anchor_key ] = $index;
            }
        }
        $protected = array_fill_keys(
            array_values( $latest_anchor_indexes ),
            true
        );
        $remove_index = null;
        foreach ( $events as $index => $event ) {
            if ( !isset( $protected[ $index ] ) ) {
                $remove_index = $index;
                break;
            }
        }
        if ( $remove_index === null ) {
            $remove_index = 0;
        }
        array_splice( $events, $remove_index, 1 );
    }
    return $events;
}

function ga_job_event_journal(
    $cached_data,
    $incoming_data,
    $max_count = 256,
    $max_bytes = 8388608
) {
    $events_by_key = array();
    $sources = array();

    if ( is_array( $cached_data )
         && isset( $cached_data[ '_job_events' ] )
         && is_array( $cached_data[ '_job_events' ] ) ) {
        $sources[] = $cached_data[ '_job_events' ];
    }
    if ( is_array( $incoming_data )
         && isset( $incoming_data[ '_job_events' ] )
         && is_array( $incoming_data[ '_job_events' ] ) ) {
        $sources[] = $incoming_data[ '_job_events' ];
    }
    if ( is_array( $incoming_data )
         && isset( $incoming_data[ '_job_event' ] ) ) {
        $sources[] = array( $incoming_data[ '_job_event' ] );
    }

    foreach ( $sources as $source ) {
        foreach ( $source as $event ) {
            if ( ga_job_event_valid( $event ) ) {
                $events_by_key[ ga_job_event_key( $event ) ] =
                    ga_job_event_replay_record( $event );
            }
        }
    }

    $events = array_values( $events_by_key );
    usort( $events, function( $left, $right ) {
        $left_sequence = intval( $left[ 'sequence' ] );
        $right_sequence = intval( $right[ 'sequence' ] );
        if ( $left_sequence === $right_sequence ) {
            return strcmp( ga_job_event_key( $left ), ga_job_event_key( $right ) );
        }
        return $left_sequence < $right_sequence ? -1 : 1;
    } );

    $events = ga_job_event_trim_count( $events, $max_count );
    $events = ga_job_event_trim_bytes( $events, $max_bytes );

    return $events;
}
