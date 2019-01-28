#!/usr/bin/env php
<?php

# user config

$debug = 1;
$debug_to_file = 1;

# end user config

# check argv etc

$notes = "usage: $argv[0] jsoninput\n";

$results = (object) [];

if ( $argc != 2 ) {
    $results->error = $notes;
    $results->_status = "failed";
    echo json_encode( $results );
    exit;
}

$jsoninput = json_decode( $argv[ 1 ] );

if ( $jsoninput == null ) {
    $results->error = "'abacorun received malformed JSON input.";
    $results->_status = "failed";
    echo json_encode( $results );
    exit;
}

if (
    !isset( $jsoninput->_menu ) ||
    !isset( $jsoninput->_module ) ||
    !isset( $jsoninput->_uuid ) 
    ) {
    $results->error = "'abacorun JSON input missing _menu, _module and/or _uuid definitions.";
    $results->_status = "failed";
    echo json_encode( $results );
    exit;
}

function error_handler( $results ) {
    # if UDP/TCP messaging defined, message appropriately
    echo json_encode( $results );
    sendudpmsg( "ABACO", "Error" );
    exit;
}    

function debug_msg( $msg, $level = 1 ) {
    global $debug;
    global $debug_to_file;
    # possibly udp this
    $out = "";
    if ( isset( $debug ) && $debug >= $level ) {
        if ( is_object( $msg ) ) {
            $out .= json_encode( $msg, JSON_PRETTY_PRINT );
        } else {
            $out .= $msg;
        }
        $out .= "\n";
        if ( $debug_to_file ) {
            error_log( $out, 3, "/tmp/abacorun.log" );
        } else {
            echo $out;
        }
    }
}    

# setup udp/tcp? messaging if available

include "abacolib.php";
include "__docroot:html5__/__application__/util/commlib.php";

setupcomm( $jsoninput );
sendudpmsg( "ABACO", "Starting" );
# gettoken & process

$tokens = json_decode( gettoken() );
if ( $tokens->_status != "success" ) {
    $results->error = "gettoken failed:$tokens->error";
    $results->_status = "failed";
    error_handler( $results );
}   
sendudpmsg( "ABACO", "Got token" );

debug_msg( "token is $tokens->access_token" );
debug_msg( "token expires in $tokens->expires_in" );

# register actor

$cname = container_name( $jsoninput->_menu, $jsoninput->_module );
debug_msg( "container name is $cname" );

$register = json_decode( registoractor( $tokens->access_token, $cname, $jsoninput->_uuid ) );
if ( $register->_status != "success" ) {
    $results->error = "register failed:$register->error";
    $results->_status = "failed";
    error_handler( $results );
}   
$actorid = $register->result->id;
sendudpmsg( "ABACO", "Actor registered" );

debug_msg( "actorid is $actorid" );

# wait until actor ready
# TOASK : better if not POLLED, possible to message status?
# TOASK : what are the possible "status"'s besides "READY", "SUBMITTED" ?
do {
    debug_msg( "sleeping 5 seconds" );
    sleep( 5 );
    $actorstatus = json_decode( getactor( $tokens->access_token, $actorid ) );
    debug_msg( $actorstatus );
    if ( $actorstatus->_status != "success" ) {
        $results->error = "register failed:$actorstatus->error";
        $results->_status = "failed";
        error_handler( $results );
    }   
} while ( $actorstatus->result->status != "READY" );
sendudpmsg( "ABACO", "Actor ready" );

# startexecution

$execution = json_decode( startexecution( $tokens->access_token, $actorid, $argv[ 1 ] ) );
if ( $execution->_status != "success" ) {
    $results->error = "execution failed:$execution->error";
    $results->_status = "failed";
    error_handler( $results );
}   
sendudpmsg( "ABACO", "Execution started" );

$execid = $execution->result->executionId;
debug_msg( "execid is $execid" );
debug_msg( $execution );

# wait for complete

do {
    debug_msg( "sleeping 5 seconds" );
    sleep( 5 );
    $execresults = json_decode( getexecution( $tokens->access_token, $actorid, $execid ) );
    debug_msg( $execresults );
    if ( $execresults->_status != "success" ) {
        $results->error = "register failed:$execresults->error";
        $results->_status = "failed";
        error_handler( $results );
    }   
} while ( $execresults->result->status == "SUBMITTED" );
sendudpmsg( "ABACO", "Execution complete" );

# get logs

$log = json_decode( getlog( $tokens->access_token, $actorid, $execid ) );
debug_msg( $log );
if ( $execution->_status != "success" ) {
    $results->error = "getlog failed:$log->error";
    $results->_status = "failed";
    error_handler( $results );
}   
sendudpmsg( "ABACO", "Logs received" );

# delete actor

$deleteresults = json_decode( deleteactor( $tokens->access_token, $actorid ) );
debug_msg( $deleteresults );
if ( $deleteresults->_status != "success" ) {
    $results->error = "register failed:$deleteresults->error";
    $results->_status = "failed";
    error_handler( $results );
}   
sendudpmsg( "ABACO", "" );

# return results

$results = json_decode( $log->result->logs );
$results->_status = "success";
echo json_encode( $results );
