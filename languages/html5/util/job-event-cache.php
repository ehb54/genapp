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

    $max_count = max( 0, intval( $max_count ) );
    if ( $max_count === 0 ) {
        $events = array();
    } else if ( count( $events ) > $max_count ) {
        $events = array_slice( $events, -$max_count );
    }

    $max_bytes = max( 0, intval( $max_bytes ) );
    while ( count( $events )
            && strlen( json_encode( $events ) ) > $max_bytes ) {
        array_shift( $events );
    }

    return $events;
}
