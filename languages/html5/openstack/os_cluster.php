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

function os_cluster_start( $nodes, $uuid, $use_project, $use_flavor ) {
    global $appjson;
    global $os_sshidentity;
    global $os_sshadmin;
    global $os_image;
    global $os_ip;

    # -------------------- set up OS image info --------------------

    if ( isset( $use_project ) && !empty( $use_project ) ) {
        $project = $use_project;
    } else {
        if ( !isset( $appjson->resources->oscluster->properties->project ) ) {
            error_exit( "resources:oscluster:properties:project not defined in appconfig" );
        }
        
        $project = $appjson->resources->oscluster->properties->project;
    }

    project_putenv( $project );

    if ( isset( $use_flavor ) && !empty( $use_flavor ) ) {
        $flavor = $use_flavor;
    } else {
        if ( !isset( $appjson->resources->oscluster->properties->flavor ) ) {
            error_exit( "resources:oscluster:properties:flavor not defined in appconfig" );
        }

        $flavor = $appjson->resources->oscluster->properties->flavor;
    }

    if ( !isset( $appjson->resources->oscluster->properties->baseimage ) ) {
        error_exit( "resources:oscluster:properties:baseimage not defined in appconfig" );
    }

    $baseimage = $appjson->resources->oscluster->properties->baseimage;

    if ( !isset( $appjson->resources->oscluster->properties->key ) ) {
        error_exit( "resources:oscluster:properties:key not defined in appconfig" );
    }

    $key = $appjson->resources->oscluster->properties->key;

    if ( !isset( $appjson->resources->oscluster->properties->secgroup ) ) {
        error_exit( "resources:oscluster:properties:secgroup not defined in appconfig" );
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

# currently sharing same network
#    if ( isset( $appjson->resources->oscluster->properties->network ) ) {
#        $use_network = $appjson->resources->oscluster->properties->network;
#    } else {
#        $use_network = "${project}-api";
#    }

    if ( !isset( $appjson->resources->oscluster->properties->network ) ) {
        error_exit( "resources:oscluster:properties:network not defined in appconfig" );
    }

    $use_network = $appjson->resources->oscluster->properties->network;

#    sendudptext( `openstack server list` );

    $cstrong = true;

    $os_image = [];

    # -------------------- boot instances --------------------

    sendudpmsg( "Booting $nodes virtual cluster node" . ( $nodes > 1 ? "s" : "" ) );

    for ( $i = 0; $i < $nodes; ++$i ) {
            
        $name =  
            "${project}-run-" . $uuid . "-" . str_pad( $i, 3, "0", STR_PAD_LEFT );
        ##        "-run-" . bin2hex( openssl_random_pseudo_bytes ( 16, $cstrong ) );

        $cmd = "openstack server create $name --flavor $flavor --image $baseimage --key-name $key --security-group $secgroup --network $use_network $userdata";
        sendudptext( "$cmd\n" );
        exec( "$cmd 2>&1", $results_array, $cmd_exitCode );
        sendudptext( implode( "\n", $results_array ) . "\n" );
        $results_error = preg_grep( '/ERROR/', $results_array );

        if ( count( $results_error ) || $cmd_exitCode ) {
            sendudpmsg( "Errors found when trying to boot a virtual cluster node" );
            $create_cmd = $cmd;
            $cmd = "";
            if ( count( $os_image ) ) {
                $cmd = "openstack server delete --wait " . implode( ' ', $os_image );
                sendudptext( $cmd );
                sendudpmsg( "Removing successfully booted virtual cluster nodes" );
                sendudptext( `$cmd 2>&1` );
            }
            sendudpmsg( "Errors found when trying to boot a virtual cluster node" );
            if ( isset( $tempfile ) ) {
                unlink( $tempfile );
            }
            error_exit( "Errors found when trying to boot a virtual cluster node.", "command:\n$create_cmd\nreturned:\n" .  implode( "\n", $results_array ) );
        }        

        $os_image[] = $name;
    }

    if ( isset( $tempfile ) ) {
        unlink( $tempfile );
    }

    # -------------------- wait to become active --------------------

    $isactive = [];
    $os_ip = [];

    sendudpmsg( "Checking $nodes virtual cluster node" . ( $nodes > 1 ? "s" : "" ) );

    do {
        $any_booting = false;
        foreach ( $os_image as $v ) {
            if ( array_key_exists( $v, $isactive ) ) {
                continue;
            }
            sendudptext( "checking $v\n" );
            ## probably should be chained to one openstack server list at the start of the loop (?)
            $cmd = "openstack server show $v";
            $results = `$cmd`;
            $resultsarray = explode( "\n", $results );
            $status = array_values( preg_grep( "/ status  /", $resultsarray ) );

            if ( count( $status ) != 1 ) {
                $cmd = "";
                if ( count( $os_image ) ) {
                    $cmd = "openstack server delete --wait " . implode( ' ', $os_image );
                    sendudptext( $cmd );
                    sendudpmsg( "Removing successfully booted virtual cluster nodes" );
                    sendudptext( `$cmd 2>&1` );
                }
                sendudpmsg( "Errors found when trying to boot a virtual cluster node" );
                error_exit( "OpenStack: exactly one status not returned for image ' . $v . '" );
            }

            $this_status_array = preg_split( '/\s+/', $status[ 0 ] );
            foreach ( $this_status_array as $k2 => $v2 ) {
                $this_status = $this_status_array[ 3 ];
                $status_ok = 0;
                switch( $this_status ) {
                    case "ACTIVE" : $status_ok = 1; break;
                    case "BUILD" : $status_ok = 1; break;
                    default : break;
                }
                if ( !$status_ok ) {
                    $cmd = "";
                    if ( count( $os_image ) ) {
                        $cmd = "openstack server delete --wait " . implode( ' ', $os_image );
                        sendudptext( $cmd );
                        sendudpmsg( "Removing successfully booted virtual cluster nodes" );
                        sendudptext( `$cmd 2>&1` );
                    }
                    sendudpmsg( "Errors found when trying to boot a virtual cluster node" );
                    error_exit( "OpenStack: unknown status ' . $this_status . ' received for image ' . $v . '" );
                }
            }

            # sendudptext( "status: " . json_encode( $status, JSON_PRETTY_PRINT ) . "\n" );
            $network = array_values( preg_grep( "/ addresses  /", $resultsarray ) );
            # sendudptext( "network: " . json_encode( $network, JSON_PRETTY_PRINT ) . "\n" );

            if ( $network ) {
                $nets = preg_split( '/\s+/', $network[ 0 ] );
                #foreach ( $nets as $k2 => $v2 ) {
                #    sendudptext( "nets[$k2]=$v2\n" );
                #}
                # strange xxlarge's sometimes get 2 ip's
                array_pop( $nets );
                $os_ip[ $v ] = preg_replace( '/^.*=/', '', array_pop( $nets ) );
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
    foreach ( $os_image as $v ) {
        sendudptext( "$v $os_ip[$v]\n" );
    }

    # -------------------- wait for ssh to open--------------------

    $issshopen = [];

    do {
        $any_notopen = false;
        foreach ( $os_image as $v ) {
            if ( array_key_exists( $v, $issshopen ) ) {
                continue;
            }
            if ( !isset( $os_ip[$v] ) ) {
                sendudptext( "error: $v has no ip address defined\n" );
                exit(-1);
            }
            sendudptext("checking for ssh $v $os_ip[$v]\n" );

            ob_start();
            if ( $fp = fsockopen( $os_ip[$v], 22, $errno, $errstr, 10 ) ) {
                ob_end_clean();
                $issshopen[ $v ] = 1;
                sendudptext( "$os_ip[$v] is open\n" );
                fclose( $fp );                
            } else {
                ob_end_clean();
                $any_notopen = true;
                sendudptext( "$os_ip[$v] ssh not open\n" );
            }
        }
        sleep( 5 );
    } while( $any_notopen );
    
    sendudpmsg( "Nodes all active and ssh open, waiting to go ready" );

    # -------------------- run postssh if present --------------------

    if ( isset( $appjson->resources->oscluster->properties->postssh ) ) {
        foreach ( $os_image as $v ) {
            $cmd = "ssh -i $os_sshidentity -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no $os_sshadmin@$os_ip[$v] -C '" . $appjson->resources->oscluster->properties->postssh . "'";
            `$cmd 2>&1 > /dev/null`;
        }
    }

    # -------------------- check for /tmp/ready --------------------

    $ready = [];

    ## need to postssh and/or other ssh setup working
    $os_ready_sleep_seconds = 5;
    $os_ready_max_wait      = 60;
    $os_ready_time_waiting  = 0;
    $os_ready_ssh_timeout   = 3;
    $any_notready = false;

    do {
        foreach ( $os_image as $v ) {
            if ( array_key_exists( $v, $ready ) ) {
                continue;
            }
            if ( !isset( $os_ip[$v] ) ) {
                sendudptext( "error: $v has no ip address defined\n" );
                exit(-1);
            }
            sendudptext("checking for ready $v $os_ip[$v] time waiting ${os_ready_time_waiting}s\n" );

            ob_start();

            $cmd = "timeout $os_ready_ssh_timeout ssh -i $os_sshidentity -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no $os_sshadmin@$os_ip[$v] 'ls /tmp/ready'";

            $res = `$cmd 2>&1`;

            ob_end_clean();
            
            if ( preg_match( '/^\/tmp\/ready$/m', $res ) ) {
                $ready[ $v ] = 1;
                sendudptext( "$os_ip[$v] is ready\n" );
            } else {
                $any_notready = true;
                sendudptext( "$os_ip[$v] is not ready\n" );
            }
        }
        sleep( $os_ready_sleep_seconds );
        $os_ready_time_waiting += $os_ready_sleep_seconds;
    } while( $any_notready && $os_ready_time_waiting < $os_ready_max_wait );

    if ( $any_notready ) {
        $cmd = "";
        sendudpmsg( "Timeout while waiting for nodes to go ready, removing virtual cluster nodes" );
        if ( count( $os_image ) ) {
            $cmd = "openstack server delete --wait " . implode( ' ', $os_image );
            sendudptext( $cmd );
            sendudpmsg( "Removing successfully booted virtual cluster nodes" );
            sendudptext( `$cmd 2>&1` );
        }
        sendudpmsg( "Timeout while waiting for nodes to go ready" );
        if ( isset( $tempfile ) ) {
            unlink( $tempfile );
        }
        error_exit( "Timeout while waiting for nodes to go ready. Please try again in a short while." ); 
    }       
    
    sendudpmsg( "Nodes all active and ready" );

    foreach ( $os_image as $v ) {
        sendudptext( "$v $os_ip[$v]\n" );
    }
    return '{"clusterips":["' . implode( '","', $os_ip ) . '"]}';
}
