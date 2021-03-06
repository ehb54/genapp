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
$projects = all_projects();

$docmd = "";

foreach ( $projects as $project => $v ) {
#    putenv( "OS_TENANT_NAME=$project" );
    putenv( "OS_PROJECT_NAME=$project" );

    $cmd = "openstack server list | grep ' ${project}-run-" . $argv[ 1 ] . "-... ' | awk '{ print $2 }'";
    # echo $cmd . "\n";
    $results = `$cmd`;
    $ids = preg_split( "/\s+/", $results, -1, PREG_SPLIT_NO_EMPTY );

    $padded = 0;

    foreach ( $ids as $v ) {
        if ( !$padded ) {
            $docmd .= "export OS_PROJECT_NAME=$project\n";
            $padded = 1;
        }
        $docmd .= "openstack server delete $v &\n";
    }
}

$docmd .= "wait\n";

echo $docmd;

echo `$docmd`;
echo "instances removed\n"; 
?>


