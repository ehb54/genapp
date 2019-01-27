#!/usr/bin/env php
<?php

# check argv etc

$notes = "usage: $argv[0] moduleid jsoninput\n";

$results = [];

if ( $argc != 3 ) {
    $results->error = $notes;
    $results->_status = "failed";
    echo json_encode( $results );
    exit();
}

$module    = $argv[ 1 ];
$jsoninput = json_decode( $argv[2] );

if ( $jsoninput == null ) {
    $results->error = "'abacorun received malformed JSON input.";
    $results->_status = "failed";
    echo json_encode( $results );
    exit();
}

# setup udp/tcp? messaging if available

include "abacolib.php";
# include "mongolib.php";

# gettoken & process

echo gettoken() . "\n";

# register actor

# wait until actor ready

# startexecution

# wait for complete

# delete actor

# return results

