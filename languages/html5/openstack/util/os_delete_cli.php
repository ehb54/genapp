<?php

$notes = 
    "\n" .
    "--------------------\n" .
    "\n" .
    "usage: $argv[0] uuid\n" .
    "deletes cluster\n" .
    "\n";

if ( !isset( $argv[ 1 ] ) ) {
    echo $notes;
    exit;
}

require "os_header_cli.php";

// should also get ip's and issue syncs umount /opt before shutdown (?)

$cmd = "nova list | grep ' " .  $json->resources->oscluster->properties->project . "-run-" . $argv[ 1 ] . "-... ' | awk '{ print $2 }'";

echo $cmd . "\n";
$results = `$cmd`;
echo $results;

$ids = preg_split( "/\s+/", $results, -1, PREG_SPLIT_NO_EMPTY );

$docmd = "";

foreach ( $ids as $v ) {
    $docmd .= "nova delete $v &\n";
}

$docmd .= "wait\n";

echo $docmd;

echo `$docmd`;
echo "instances removed\n"; 
?>


