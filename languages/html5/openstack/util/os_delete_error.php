<?php

$notes = 
    "\n" .
    "--------------------\n" .
    "\n" .
    "usage: $argv[0]\n" .
    "deletes any instances in ERROR state\n" .
    "\n";

require "os_header_cli.php";
$projects = all_projects();

$docmd = "";

foreach ( $projects as $project => $v ) {
#    putenv( "OS_TENANT_NAME=$project" );
    putenv( "OS_PROJECT_NAME=$project" );

    $lines = [];
    exec( "openstack server list --name '.*-run-OR.*' --status ERROR -c ID -f value", $lines );
    echo "checking for ERROR state project $project returned " . implode( ' ', $lines ) . "\n";
    if ( count( $lines ) ) {
        $docmd .= "env OS_PROJECT_NAME=$project openstack server delete " . implode( ' ', $lines ) . "\n";
    }
}

if ( !empty( $docmd ) ) {
    echo "$docmd\n";
    echo `$docmd`;
} else {
    echo "no run-OR instances in ERROR state\n";
}
