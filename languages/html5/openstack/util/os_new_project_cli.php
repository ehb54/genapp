<?php

$notes = "usage: $0 project
adds security group sshlocalall to project if it does not exist
";

if ( !isset( $argv[ 1 ] ) ) {
   echo $notes;
   exit;
}

require "os_header_cli.php";

$project = $argv[ 1 ];
putenv( "OS_TENANT_NAME=$project" );
putenv( "OS_PROJECT_NAME=$project" );

$cmd = "nova secgroup-list 2>&1";
$results = `$cmd`;

if ( preg_match( "/ERROR/m", $results ) ) {
    echo "Errors detected\n";
    exit;
} 


if ( preg_match( "/ sshlocalall /m", $results ) ) {
    echo "project $project already has secgroup sshlocalall\n";
    exit;
} 

echo "adding sshlocalall to $project secgroup rules\n";
$cmd = 'nova secgroup-create sshlocalall "ssh & icmp enabled, all local ports open"
    nova secgroup-add-rule sshlocalall tcp 22 22 0.0.0.0/0
    nova secgroup-add-rule sshlocalall tcp 1 65535 10.0.0.0/8
    nova secgroup-add-rule sshlocalall udp 1 65535 10.0.0.0/8
    nova secgroup-add-rule sshlocalall icmp -1 -1 0.0.0.0/0
';
print $cmd;
print `$cmd`;

?>
