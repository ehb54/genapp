<?php

require "os_header_cli.php";

$projects = all_projects();

foreach ( $projects as $project => $v ) {
    putenv( "OS_TENANT_NAME=$project" );
    putenv( "OS_PROJECT_NAME=$project" );

    $cmd = "nova list";

    $results = `$cmd`;
    if ( preg_match( "/$project/m", $results ) ) {
        echo $results;
    }
}

?>
