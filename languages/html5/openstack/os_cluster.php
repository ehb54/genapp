<?php

$notes = 
    "\n" .
    "--------------------\n" .
    "\n" .
    "usage: $argv[0] number-of-nodes uuid\n" .
    "starts nodes and returns ip addresses\n" .
    "\n";


if ( !isset( $argv[ 1 ] ) ||
     !isset( $argv[ 2 ] ) ) {
    echo $notes;
    exit;
}

require "os_header.php";
 
// -------------------- set up OS image info --------------------

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
    echo '"error":"resources:oscluster:properties:secgroup not defined in appconfig"}';
    exit;
}

$secgroup = $appjson->resources->oscluster->properties->secgroup;

$userdata = "";
if ( isset( $appjson->resources->oscluster->properties->user_data ) ) {
    echo "userdata is set\n";
    $tempfile = tempnam(sys_get_temp_dir(), "gat" );
    file_put_contents( $tempfile, '#!/bin/bash' . "\n" . $appjson->resources->oscluster->properties->user_data . "\n" );
    $userdata = "--user-data $tempfile";
    echo "userdata $userdata\n";
}

echo `nova list`;

$cstrong = true;

$images = [];

// -------------------- boot instances --------------------

for ( $i = 0; $i < $argv[ 1 ]; ++$i ) {
    
    $name =  
        $appjson->resources->oscluster->properties->project . "-run-" . $argv[ 2 ] . "-" . str_pad( $i, 3, "0", STR_PAD_LEFT );
//        "-run-" . bin2hex( openssl_random_pseudo_bytes ( 16, $cstrong ) );

    $image[] = $name;
    $cmd = "nova boot $name --flavor $flavor --image $baseimage --key-name $key --security-groups $secgroup --nic net-name=${project}-api $userdata";
    print "$cmd\n";
    print `$cmd`;
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
        $network = array_values( preg_grep( "/ network  /", $resultsarray ) );
        echo "network: " . json_encode( $network, JSON_PRETTY_PRINT ) . "\n";

        if ( $network ) {
            $nets = preg_split( '/\s+/', $network[ 0 ] );
            foreach ( $nets as $k2 => $v2 ) {
                print "nets[$k2]=$v2\n";
            }
            $ip[ $v ] = $nets[ 4 ];
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
foreach ( $image as $v ) {
    echo "$v $ip[$v]\n";
}

?>
