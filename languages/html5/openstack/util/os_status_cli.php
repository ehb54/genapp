<?php

require "os_header_cli.php";

$projects = all_projects();

foreach ( $projects as $project => $v ) {
    print "project $project\n";
    project_putenv( $project );

    $cmd = "openstack server list -c ID -c Name -c Status -c Networks";

    $results = `$cmd`;
    if ( preg_match( "/$project/m", $results ) ) {
        echo $results;
    }
}
