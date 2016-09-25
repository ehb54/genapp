<?php

$notes = 
    "\n" .
    "--------------------\n" .
    "\n" .
    "usage: $argv[0] uuid\n" .
    "deletes cluster\n" .
    "\n";

require_once "os_header.php";

# should also get ip's and issue syncs umount /opt before shutdown (?)

function os_delete( $nodes, $uuid ) {
    global $appjson;

    sendudpmsg( "Deleting virtual cluster nodes" );

    if ( isset( $use_nova_to_get_ids ) ) {
        $cmd = "nova list | grep ' " .  $appjson->resources->oscluster->properties->project . "-run-" . $uuid . "-... ' | awk '{ print $2 }'";

        sendudptext( $cmd . "\n" );

        $results = `$cmd`;
        sendudptext( $results );
        $ids = preg_split( "/\s+/", $results, -1, PREG_SPLIT_NO_EMPTY );
    } else {
        $ids = [];
        for ( $i = 0; $i < $nodes; ++$i ) {
            $ids[] =  
                $appjson->resources->oscluster->properties->project . "-run-" . $uuid . "-" . str_pad( $i, 3, "0", STR_PAD_LEFT );
        }
    }

    $docmd = "";
    
    foreach ( $ids as $v ) {
        $docmd .= "nova delete $v &\n";
    }

    $docmd .= "wait\n";
    sendudptext( $docmd );

    sendudptext( `$docmd` );
    sendudpmsg( "Virtual cluster nodes deleted" );
}
    
?>


