<?php

function setupcomm( $jsoninput ) {
    $appconfig = "__appconfig__";
    if ( NULL == ( $appjson = json_decode( file_get_contents( $appconfig ) ) ) ) {
        echo '{"error":"appconfig could not be decoded"}';
        exit;
    }

    if ( !isset( $jsoninput->_uuid ) ) {
        echo '{"error":"commlib:setupcomm no _uuid found in jsoninput"}';
        exit;
    }

    if ( isset( $appjson->messaging ) &&
         isset( $appjson->messaging->udphostip ) &&
         isset( $appjson->messaging->udpport ) ) {
        $GLOBALS[ 'udp' ] = (object) [];
        $GLOBALS[ 'udp' ]->hostip = $appjson->messaging->udphostip;
        $GLOBALS[ 'udp' ]->port   = $appjson->messaging->udpport;
        $GLOBALS[ 'udp' ]->socket = socket_create(AF_INET, SOCK_DGRAM, SOL_UDP);
        $GLOBALS[ 'udp' ]->msg    = [ "_uuid"    => $jsoninput->_uuid ];
    }
}

function sendudpmsg( $tag, $status ) {
    if ( !isset( $GLOBALS[ 'udp' ] ) ) {
        return;
    }

    $msg = $GLOBALS[ 'udp' ]->msg;

    $msg[ '_airavata' ] = empty( $status ) ? "" : "$tag: $status<hr>";

    $json_msg = json_encode( $msg );

    socket_sendto( $GLOBALS[ 'udp' ]->socket,
                   $json_msg,
                   strlen( $json_msg ),
                   0,
                   $GLOBALS[ 'udp' ]->hostip,
                   $GLOBALS[ 'udp' ]->port );
}    

function sendudptext( $text ) {
    if ( !isset( $GLOBALS[ 'udp' ] ) ) {
        return;
    }

    $msg = $GLOBALS[ 'udp' ]->msg;

    $msg[ '_textarea' ] = $text;

    $json_msg = json_encode( $msg );

    socket_sendto( $GLOBALS[ 'udp' ]->socket,
                   $json_msg,
                   strlen( $json_msg ),
                   0,
                   $GLOBALS[ 'udp' ]->hostip,
                   $GLOBALS[ 'udp' ]->port );
}    
