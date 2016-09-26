<?php

$notes = 
    "\n" .
    "--------------------\n" .
    "\n" .
    "usage: $argv[0] number-of-nodes uuid\n" .
    "starts nodes and returns ip addresses\n" .
    "\n";

require_once "os_header.php";
require_once "os_delete.php";

function os_cluster_start( $nodes, $uuid ) {
    global $appjson;

    # -------------------- set up OS image info --------------------

    if ( !isset( $appjson->resources->oscluster->properties->project ) ) {
        echo '{"error":"resources:oscluster:properties:project not defined in appconfig"}';
        exit;
    }

    $project = $appjson->resources->oscluster->properties->project;

    if ( !isset( $appjson->resources->oscluster->properties->flavor ) ) {
        echo '{"error":"resources:oscluster:properties:flavor not defined in appconfig"}';
        exit;
    }

    $flavor = $appjson->resources->oscluster->properties->flavor;

    if ( !isset( $appjson->resources->oscluster->properties->baseimage ) ) {
        echo '{"error":"resources:oscluster:properties:baseimage not defined in appconfig"}';
        exit;
    }

    $baseimage = $appjson->resources->oscluster->properties->baseimage;

    if ( !isset( $appjson->resources->oscluster->properties->key ) ) {
        echo '{"error":"resources:oscluster:properties:key not defined in appconfig"}';
        exit;
    }

    $key = $appjson->resources->oscluster->properties->key;

    if ( !isset( $appjson->resources->oscluster->properties->secgroup ) ) {
        echo '{"error":"resources:oscluster:properties:secgroup not defined in appconfig"}';
        exit;
    }

    $secgroup = $appjson->resources->oscluster->properties->secgroup;

    $userdata = "";
    if ( isset( $appjson->resources->oscluster->properties->user_data ) ) {
        sendudptext( "userdata is set\n" );
        $tempfile = tempnam( ".", "_os_temp" );
        file_put_contents( $tempfile, '#!/bin/bash' . "\n" . $appjson->resources->oscluster->properties->user_data . "\n" );
        $userdata = "--user-data $tempfile";
        sendudptext( "userdata $userdata\n" );
    }

#    sendudptext( `nova list` );

    $cstrong = true;

    $images = [];

    # -------------------- boot instances --------------------

    for ( $i = 0; $i < $nodes; ++$i ) {
            
        $name =  
            $appjson->resources->oscluster->properties->project . "-run-" . $uuid . "-" . str_pad( $i, 3, "0", STR_PAD_LEFT );
        //        "-run-" . bin2hex( openssl_random_pseudo_bytes ( 16, $cstrong ) );

        $image[] = $name;
        $cmd = "nova boot $name --flavor $flavor --image $baseimage --key-name $key --security-groups $secgroup --nic net-name=${project}-api $userdata";
        sendudptext( "$cmd\n" );
        sendudptext( `$cmd` );
    }

    if ( isset( $tempfile ) ) {
        unlink( $tempfile );
    }

    # -------------------- wait to become active --------------------

    $isactive = [];
    $ip = [];

    sendudpmsg( "Booting $nodes virtual cluster node" . ( $nodes > 1 ? "s" : "" ) );

    do {
        $any_booting = false;
        foreach ( $image as $v ) {
            if ( array_key_exists( $v, $isactive ) ) {
                continue;
            }
            sendudptext( "checking $v\n" );
            // probably should be chained to one nova list at the start of the loop
                $cmd = "nova show $v";
            $results = `$cmd`;
            $resultsarray = explode( "\n", $results );
            $status = array_values( preg_grep( "/ status  /", $resultsarray ) );

            # sendudptext( "status: " . json_encode( $status, JSON_PRETTY_PRINT ) . "\n" );
            $network = array_values( preg_grep( "/ network  /", $resultsarray ) );
            # sendudptext( "network: " . json_encode( $network, JSON_PRETTY_PRINT ) . "\n" );

            if ( $network ) {
                $nets = preg_split( '/\s+/', $network[ 0 ] );
                #foreach ( $nets as $k2 => $v2 ) {
                #    sendudptext( "nets[$k2]=$v2\n" );
                #}
                $ip[ $v ] = $nets[ 4 ];
            }

            if ( $status &&
                 strpos( $status[ 0 ], "ACTIVE" ) ) {
                $isactive[ $v ] = 1;
            } else {
                $any_booting = true;
                sendudptext( "$v still booting\n" );
            }
        }
    } while( $any_booting );

    sendudpmsg( "Nodes all active, waiting for ssh to open" );
    sendudptext( "all active\n" );
    foreach ( $image as $v ) {
        sendudptext( "$v $ip[$v]\n" );
    }

    # -------------------- wait for ssh to open--------------------

    $issshopen = [];

    do {
        $any_notopen = false;
        foreach ( $image as $v ) {
            if ( array_key_exists( $v, $issshopen ) ) {
                continue;
            }
            if ( !isset( $ip[$v] ) ) {
                sendudptext( "error: $v has no ip address defined\n" );
                exit(-1);
            }
            sendudptext("checking for ssh $v $ip[$v]\n" );


            ob_start();
            if ( fsockopen( $ip[$v], 22, $errno, $errstr, .5 ) ) {
                ob_end_clean();
                $issshopen[ $v ] = 1;
                sendudptext( "$ip[$v] is open\n" );
            } else {
                ob_end_clean();
                $any_notopen = true;
                sendudptext( "$ip[$v] ssh not open\n" );
            }
        }
        sleep( 5 );
    } while( $any_notopen );
    
    sendudpmsg( "Nodes all active and ssh open, waiting to go ready" );

    # -------------------- check for /tmp/ready --------------------

    $ready = [];

    do {
        $any_notready = false;
        foreach ( $image as $v ) {
            if ( array_key_exists( $v, $ready ) ) {
                continue;
            }
            if ( !isset( $ip[$v] ) ) {
                sendudptext( "error: $v has no ip address defined\n" );
                exit(-1);
            }
            sendudptext("checking for ready $v $ip[$v]\n" );

            ob_start();

            $cmd = "ssh $ip[$v] 'ls /tmp/ready'";

            $res = `$cmd 2>&1`;

            if ( preg_match( '/^\/tmp\/ready$/m', $res ) ) {
                $ready[ $v ] = 1;
                sendudptext( "$ip[$v] is ready\n" );
            } else {
                $any_notready = true;
                sendudptext( "$ip[$v] is not ready\n" );
            }
        }
        sleep( 5 );
    } while( $any_notready );
    
    sendudpmsg( "Nodes all active and ready" );

    foreach ( $image as $v ) {
        sendudptext( "$v $ip[$v]\n" );
    }
    return '{"clusterips":["' . implode( '","', $ip ) . '"]}';
}
?>
