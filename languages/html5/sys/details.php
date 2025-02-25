<?php

{};

## builds detail string for mongo insert

function debug_json_to_file( $msg, $obj, $file = "/tmp/details.log" ) {
    file_put_contents( $file, "$msg:\n" . json_encode( $obj, JSON_PRETTY_PRINT ) . "\n", FILE_APPEND );
}

function debug_msg_to_file( $msg, $file = "/tmp/details.log" ) {
    file_put_contents( $file, "$msg\n", FILE_APPEND );
}

function details( $request, $modulejson ) {
    # debug_json_to_file( "request", $request );
    # debug_json_to_file( "module", $modulejson );

    $out = [];

    foreach ( $modulejson->fields as $v ) {
        if ( isset( $v->details )
             && isset( $request[ $v->id ] ) ) {
            # debug_msg_to_file( "get details for $v->id" );
            $thisout = "";
            if ( isset( $v->details->prefix ) ) {
                $thisout .= $v->details->prefix;
            }
            if ( isset( $v->details->valuemap )
                && isset( $v->details->valuemap->{$request[$v->id]} ) ) {
                # debug_msg_to_file( "valuemap exists for $v->id" );
                $thisout .= $v->details->valuemap->{$request[$v->id]};
            } else {
                $thisout .= $request[ $v->id ];
            }
            if ( isset( $v->details->suffix ) ) {
                $thisout .= $v->details->suffix;
            }
            if ( isset( $v->details->position ) ) {
                # debug_msg_to_file( sprintf( "position %d found for $v->id", $v->details->position ) );
                if ( !isset( $out[ $v->details->position ] ) ) {
                    $out[ $v->details->position ] = "";
                }
                $out[ $v->details->position ] .= $thisout;
            } else {
                $out[] = $thisout;
            }
        }
    }

    ksort( $out, SORT_NUMERIC );

    # debug_json_to_file( "out", $out );

    $result = implode( "", $out );
    # debug_msg_to_file( "details are '$result'" );
    if ( strlen( $result ) ) {
        $GLOBALS[ 'details' ] = $result;
    } else {
        unset( $GLOBALS[ 'details' ] );
    }
    return $result;
}
