<?php

$info = [];

# get php process & mongo running

$cmd = 'COLUMNS=100000 ps -ef | grep php | grep jobrun  | grep -v grep | awk \'{ print $10 "," $11 }\'';
$ps = preg_split( "/\n/", `$cmd`, -1, PREG_SPLIT_NO_EMPTY );

foreach ( $ps as $v ) {
    preg_match(
        '/^([^,]+),([^,]+)$/'
        , $v
        , $matches
        );

    # print_r ( $matches );
    $uid    = $matches[ 1 ];
    $jid    = $matches[ 2 ];
    if ( !isset( $info[ $jid ]  ) ) {
        $info[ $jid ] = [];
    }
    $info[ $jid ][ "user" ] = $uid;
    $info[ $jid ][ "phpcount" ] = 1;
    $info[ $jid ][ "mongorunning" ] = 0;
}

# connect
try {
     $mongo = new MongoClient(
             __~mongo:url{"__mongo:url__"}
             __~mongo:cafile{,[], [ "context" => stream_context_create([ "ssl" => [ "cafile" => "__mongo:cafile__" ] ] ) ]}
             );
} catch ( Exception $e ) {
    echo "could not connect to mongodb\n";
    exit();
}

# get all running jobs

$mongocoll = $mongo->__application__->running;

$running = $mongocoll->find();

foreach ( $running as $v ) {
    $jid = $v[ '_id' ];
    if ( !isset( $info[ $jid ]  ) ) {
        $info[ $jid ] = [];
        $info[ $jid ][ "phpcount" ] = 0;
    }
    $info[ $jid ][ "mongorunning" ] = 1;
}

$dcmds = "";

foreach ( $info as $k => $v ) {
    if ( $v[ "phpcount" ] && $v[ "mongorunning" ] ) {
        echo "okjob $k\n";
        continue;
    }

    print "$k php:" . $v[ "phpcount" ] . " mongorunning:" . $v[ "mongorunning" ] . "\n";
    $dcmds .= "db.running.remove( { _id:\"$k\" }, { justOne: true } )\n";
}

if ( strlen( $dcmds ) ) {
    print "--------------------\n$dcmds";
} else {
    print "All ok\n";
}

?>
