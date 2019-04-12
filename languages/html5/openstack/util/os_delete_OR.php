<?php

$notes = 
    "\n" .
    "--------------------\n" .
    "\n" .
    "usage: $argv[0]\n" .
    "deletes all OR instances\n" .
    "\n";

require "os_header_cli.php";
$projects = all_projects();

$any = 0;

$docmd = "";

foreach ( $projects as $project => $v ) {
#    putenv( "OS_TENANT_NAME=$project" );
    putenv( "OS_PROJECT_NAME=$project" );

    $lines = [];
    exec( "openstack server list --name '.*-run-OR.*' -c ID -f value", $lines );
    echo "checking for OR's state project $project returned " . implode( ' ', $lines ) . "\n";

    if ( count( $lines ) ) {
        $docmd .= "env OS_PROJECT_NAME=$project openstack server delete " . implode( ' ', $lines ) . "\n";
    }
}

if ( !empty( $docmd ) ) {
    echo "$docmd\n";
    echo `$docmd`;
} else {
    echo "no run-OR instances found\n";
}
