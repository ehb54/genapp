<?php

require "os_header_cli.php";

$cmd = "nova list | grep ' " .  $json->resources->oscluster->properties->project . "-run-........-....-....-....-............-... ' ";

$results = `$cmd`;
echo $results;

$info = [];
echo `echo "db.running.find()" | mongo __application__`;

$lines = preg_split( "/\n/", $results, -1, PREG_SPLIT_NO_EMPTY );
// print_r( $lines );

foreach ( $lines as $v ) {

    preg_match(
        '/^\s*\|\s*(\S+)\s+'
        . '\|\s+' . $json->resources->oscluster->properties->project . '-run-(........-....-....-....-............)-(...)\s+'
        . '\|\s+(\S+)\s+'
        . '\|\s+(\S+)\s+'
        . '\|\s+(\S+)\s+'
        . '\|(?:\s+.*=(\S+)|())\s+'
        . '/'
        , $v
        , $matches
        );

//    print_r( $matches );
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
    $info[ $jid ][ $vmno ][ "vmname" ] = $json->resources->oscluster->properties->project . "-$vmid-$vmno";
    $info[ $jid ][ $vmno ][ "status" ] = $status;
    $info[ $jid ][ $vmno ][ "state" ]  = $state;
    $info[ $jid ][ $vmno ][ "power" ]  = $power;
    $info[ $jid ][ $vmno ][ "ip" ]     = $ip;
}


// get php process & mongo running

$ps = preg_split( "/\n/", `ps -ef | grep php`, -1, PREG_SPLIT_NO_EMPTY );

// print_r( $ps );

// connect
try {
     $mongo = new MongoClient();
} catch ( Exception $e ) {
    echo "could not connect to mongodb\n";
    exit();
}

$mongocoll = $mongo->__application__->running;

foreach ( $info as $k => $v ) {
    $phpmatch = preg_grep( "/$k/", $ps );
//    print "checking $k\n";
//    print_r( $phpmatch );
//    print "count for $k " . count( $phpmatch ) . "\n";
    $info[ $k ][ "phpcount" ] = count( $phpmatch );
    $info[ $k ][ "mongorunning" ] = $mongocoll->findOne( array( "_id" => $k ) ) ? 1 : 0;
}

// print json_encode( $info, JSON_PRETTY_PRINT );

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
