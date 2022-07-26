<?php

require_once "os_header.php";

# should also get ip's and issue syncs umount /opt before shutdown (?)

function os_delete( $nodes, $uuid, $project = NULL, $quiet = false ) {
    global $appjson;

    if ( !isset( $project ) ) {
        $project = $appjson->resources->oscluster->properties->project;
    }
#    putenv( "OS_TENANT_NAME=$project" );
#    putenv( "OS_PROJECT_NAME=$project" );
    project_putenv( $project );

    if ( !$quiet ) {
        sendudpmsg( "Deleting virtual cluster nodes" );
    }

    $ids = [];
    for ( $i = 0; $i < $nodes; ++$i ) {
        $ids[] =  
            "${project}-run-" . $uuid . "-" . str_pad( $i, 3, "0", STR_PAD_LEFT );
    }

    $docmd = "";
    
    foreach ( $ids as $v ) {
        $docmd .= "openstack server delete $v &\n";
    }

    $docmd .= "wait\n";
    if ( !$quiet ) {
        sendudptext( $docmd );

        sendudptext( `$docmd` );

        sendudpmsg( "Virtual cluster nodes deleted" );
    } else {
        `$docmd`;
    }
}
