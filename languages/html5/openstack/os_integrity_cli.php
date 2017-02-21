<?php

require "os_header_cli.php";

# -------------- 1st get all apps & projects --------------

$cmd = "echo 'db.appresourceproject.find()' | mongo global | grep openstack";
$results = `$cmd`;
$results = preg_replace( '/^{ "_id" : "/m', '', $results );
$results = preg_replace( '/" }$/m', '', $results );
$lines = preg_split( "/\n/", $results, -1, PREG_SPLIT_NO_EMPTY );

# echo $results;

$apps = [];
$projects = [];

foreach ( $lines as $v ) {
    $results = preg_match( '/^([^:]*):([^:]*):([^:]*)$/', $v, $matches );
    if ( strlen( $matches[ 1 ] ) ) {
        $apps    [ $matches[ 1 ] ] = 1;
    }
    if ( strlen( $matches[ 3 ] ) ) {
        $projects[ $matches[ 3 ] ] = 1;
    }
}

# print_r( $apps );
# print_r( $projects );

# -------------- get all nova data --------------

$results = "";

foreach ( $projects as $project => $v ) {
    putenv( "OS_TENANT_NAME=$project" );
    putenv( "OS_PROJECT_NAME=$project" );

    $cmd = "nova list | grep ' ${project}-run-........-....-....-....-............-... ' ";

    $results .= `$cmd`;
}

echo $results;

$lines = [];

$info = [];
$lines = preg_split( "/\n/", $results, -1, PREG_SPLIT_NO_EMPTY );
# print_r( $lines );
    
foreach ( $lines as $v ) {
    foreach ( $projects as $project => $v2 ) {
        
        preg_match(
            '/^\s*\|\s*(\S+)\s+'
            . '\|\s+' . $project . '-run-(........-....-....-....-............)-(...)\s+'
            . '\|\s+(\S+)\s+'
            . '\|\s+(\S+)\s+'
            . '\|\s+(\S+)\s+'
            . '\|(?:\s+.*=(\S+)|())\s+'
            . '/'
            , $v
            , $matches
            );
        
        if ( count( $matches ) ) {
            
            # print_r( $matches );
            $vmid   = $matches[ 1 ];
            $jid    = $matches[ 2 ];
            $vmno   = $matches[ 3 ];
            $ivmno  = intval( $matches[ 3 ] );
            $status = $matches[ 4 ];
            $state  = $matches[ 5 ];
            $power  = $matches[ 6 ];
            $ip     = $matches[ 7 ];
            
            if ( !isset( $info[ $jid ] ) ) {
                $info[ $jid ] = [];
            }
            
            if ( !isset( $info[ $jid ][ $ivmno ] ) ) {
                $info[ $jid ][ $ivmno ] = [];
            }
            
            $info[ $jid ][ $vmno ][ "vmid" ]   = $vmid;
            $info[ $jid ][ $vmno ][ "vmname" ] = "$project-$vmid-$vmno";
            $info[ $jid ][ $vmno ][ "status" ] = $status;
            $info[ $jid ][ $vmno ][ "state" ]  = $state;
            $info[ $jid ][ $vmno ][ "power" ]  = $power;
            $info[ $jid ][ $vmno ][ "ip" ]     = $ip;
        }
    }
}

# echo json_encode( $info, JSON_PRETTY_PRINT );

# -------------- get php process --------------

$ps = preg_split( "/\n/", `COLUMNS=100000 ps -ef | grep php`, -1, PREG_SPLIT_NO_EMPTY );

# print_r( $ps );

foreach ( $info as $k => $v ) {
    $phpmatch = preg_grep( "/$k/", $ps );
    #    print "checking $k\n";
    #    print_r( $phpmatch );
    #    print "count for $k " . count( $phpmatch ) . "\n";
    $info[ $k ][ "phpcount" ] = count( $phpmatch );
    $info[ $k ][ "mongorunning" ] = 0;
}

# -------------- mongo running --------------
# connect
try {
     $mongo = new MongoClient();
} catch ( Exception $e ) {
    echo "could not connect to mongodb\n";
    exit();
}

foreach ( $apps as $app => $v ) {

    $mongocoll = $mongo->$app->running;

    foreach ( $info as $k => $v ) {
        $phpmatch = preg_grep( "/$k/", $ps );
        #    print "checking $k\n";
        #    print_r( $phpmatch );
        #    print "count for $k " . count( $phpmatch ) . "\n";
        $info[ $k ][ "mongorunning" ] += $mongocoll->findOne( array( "_id" => $k ) ) ? 1 : 0;
    }
}

# print json_encode( $info, JSON_PRETTY_PRINT );

# -------------- check results --------------

$dcmds = "";

foreach ( $info as $k => $v ) {
    if ( $v[ "phpcount" ] && $v[ "mongorunning" ] ) {
        continue;
    }

    print "$k php:" . $v[ "phpcount" ] . " mongorunning:" . $v[ "mongorunning" ] . "\n";
    $dcmds .= "php os_delete_cli.php $k\n";
}

if ( strlen( $dcmds ) ) {
    print "--------------------\n$dcmds";
} else {
    print "All ok\n";
}

?>
