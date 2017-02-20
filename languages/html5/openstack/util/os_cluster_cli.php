<?php

$notes = 
    "\n" .
    "--------------------\n" .
    "\n" .
    "usage: $argv[0] project number-of-nodes uuid {appconfig}\n" .
    "starts nodes and returns ip addresses\n" .
    "optionally uses named appconfig file\n" .
    "\n";

require "os_header_cli.php";

$notes .= "Known projects: " . implode( " ", array_keys( all_projects() ) ) . "\n";

if ( !isset( $argv[ 1 ] ) ||
     !isset( $argv[ 2 ] ) ||
     !isset( $argv[ 3 ] ) ) {
    echo $notes;
    exit;
}

if ( isset( $argv[ 4 ] ) ) {
   $appconfig = $argv[ 4 ];
}


$project = $argv[ 1 ];

putenv( "OS_TENANT_NAME=$project" );
putenv( "OS_PROJECT_NAME=$project" );

 
// -------------------- set up OS image info --------------------

if ( !isset( $json->resources->oscluster->properties->flavor ) ) {
    echo "error: resources:oscluster:properties:flavor not defined in appconfig\n";
    exit;
}

$flavor = $json->resources->oscluster->properties->flavor;

if ( !isset( $json->resources->oscluster->properties->baseimage ) ) {
    echo "error: resources:oscluster:properties:baseimage not defined in appconfig\n";
    exit;
}

$baseimage = $json->resources->oscluster->properties->baseimage;

if ( !isset( $json->resources->oscluster->properties->key ) ) {
    echo "error: resources:oscluster:properties:key not defined in appconfig\n";
    exit;
}

$key = $json->resources->oscluster->properties->key;

if ( !isset( $json->resources->oscluster->properties->secgroup ) ) {
    echo "error: resources:oscluster:properties:secgroup not defined in appconfig\n";
    exit;
}

$secgroup = $json->resources->oscluster->properties->secgroup;

$userdata = "";
if ( isset( $json->resources->oscluster->properties->user_data ) ) {
    echo "userdata is set\n";
    $tempfile = tempnam(sys_get_temp_dir(), "gat" );
    file_put_contents( $tempfile, '#!/bin/bash' . "\n" . $json->resources->oscluster->properties->user_data . "\n" );
    $userdata = "--user-data $tempfile";
    echo "userdata $userdata\n";
}

if ( isset( $json->resources->oscluster->properties->network ) ) {
    $use_network = $json->resources->oscluster->properties->network;
} else {
    $use_network = "${project}-api";
}

echo `nova list`;

$cstrong = true;

$image = [];

// -------------------- boot instances --------------------

for ( $i = 0; $i < $argv[ 2 ]; ++$i ) {
    
    $name =  
        "${project}-run-" . $argv[ 3 ] . "-" . str_pad( $i, 3, "0", STR_PAD_LEFT );
//        "-run-" . bin2hex( openssl_random_pseudo_bytes ( 16, $cstrong ) );

    $cmd = "nova boot $name --flavor $flavor --image $baseimage --key-name $key --security-groups $secgroup --nic net-name=$use_network $userdata";
    print "$cmd\n";
    $results = `$cmd 2>&1`;
    print $results;
    $results_array = preg_split( '/\n/m', $results );
    echo "results_array:\n" . print_r( $results_array, true ) . "\n";
    $results_error = preg_grep( '/ERROR/', $results_array );
    echo "results_error:\n" . print_r( $results_error, true ) . "\n";
    if ( count( $results_error ) ) {
        $cmd = "";
        if ( count( $image ) ) {
            foreach ( $image as $v ) {
                $cmd .= "nova delete $v &\n";
            }
            $cmd .= "wait\n";

            echo $cmd;
            echo `$cmd`;
        }
        echo '{"error":"OpenStack:' . implode( "<p>OpenStack:", $results_error ) . '"}';
        exit;
    }        
    $image[] = $name;
}

if ( isset( $tempfile ) ) {
    unlink( $tempfile );
}

// -------------------- wait to become active --------------------

$isactive = [];
$ip = [];


do {
    $any_booting = false;
    foreach ( $image as $v ) {
        if ( array_key_exists( $v, $isactive ) ) {
            continue;
        }
        echo "checking $v\n";
        // probably should be chained to one nova list at the start of the loop
        $cmd = "nova show $v";
        $results = `$cmd`;
        $resultsarray = explode( "\n", $results );
        $status = array_values( preg_grep( "/ status  /", $resultsarray ) );

        echo "status: " . json_encode( $status, JSON_PRETTY_PRINT ) . "\n";
        if ( count( $status ) != 1 ) {
            $cmd = "";
            if ( count( $image ) ) {
                foreach ( $image as $v2 ) {
                    $cmd .= "nova delete $v2 &\n";
                }
                $cmd .= "wait\n";

                echo $cmd;
                echo `$cmd`;
            }
            echo '{"error":"OpenStack: exactly one status not returned for image ' . $v . '"}';
            exit;
        }
        $this_status_array = preg_split( '/\s+/', $status[ 0 ] );
        foreach ( $this_status_array as $k2 => $v2 ) {
            print "this_status_array[$k2]=$v2\n";
            $this_status = $this_status_array[ 3 ];
            $status_ok = 0;
            switch( $this_status ) {
                case "ACTIVE" : $status_ok = 1; break;
                case "BUILD" : $status_ok = 1; break;
                default : break;
            }
            if ( !$status_ok ) {
                $cmd = "";
                if ( count( $image ) ) {
                    foreach ( $image as $v2 ) {
                        $cmd .= "nova delete $v2 &\n";
                    }
                    $cmd .= "wait\n";

                    echo $cmd;
                    echo `$cmd`;
                }
                echo '{"error":"OpenStack: unknown status ' . $this_status . ' received for image ' . $v . '"}';
                exit;
            }
        }

        $network = array_values( preg_grep( "/ network  /", $resultsarray ) );
        echo "network: " . json_encode( $network, JSON_PRETTY_PRINT ) . "\n";

        if ( $network ) {
            $nets = preg_split( '/\s+/', $network[ 0 ] );
            array_pop( $nets );
            foreach ( $nets as $k2 => $v2 ) {
                print "nets[$k2]=$v2\n";
            }
            $ip[ $v ] = array_pop( $nets );
        }

        if ( $status &&
             strpos( $status[ 0 ], "ACTIVE" ) ) {
            $isactive[ $v ] = 1;
        } else {
            $any_booting = true;
            echo "$v still booting\n";
        }
    }
} while( $any_booting );

echo "all active\n";
foreach ( $image as $v ) {
    echo "$v $ip[$v]\n";
}

// -------------------- wait for ssh to open--------------------

$issshopen = [];

do {
    $any_notopen = false;
    foreach ( $image as $v ) {
        if ( array_key_exists( $v, $issshopen ) ) {
            continue;
        }
        if ( !isset( $ip[$v] ) ) {
            echo "error: $v has no ip address defined\n";
            exit(-1);
        }
        echo "checking for ssh $v $ip[$v]\n";


        ob_start();
        if ( fsockopen( $ip[$v], 22, $errno, $errstr, .5 ) ) {
            ob_end_clean();
            $issshopen[ $v ] = 1;
            print "$ip[$v] is open\n";
        } else {
            ob_end_clean();
            $any_notopen = true;
            echo "$v still booting\n";
        }

    }
    sleep( 5 );
} while( $any_notopen );
            
echo "all ssh active\n";

# -------------------- run postssh if present --------------------

if ( isset( $json->resources->oscluster->properties->postssh ) ) {
    foreach ( $image as $v ) {
        $cmd = "ssh root@$ip[$v] -C '" . $json->resources->oscluster->properties->postssh . "'";
        echo "running: $cmd\n";
        echo `$cmd`;
    }
}


foreach ( $image as $v ) {
    echo "$v $ip[$v]\n";
}

?>
