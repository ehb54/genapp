#!/usr/local/bin/php
<?php

# -------------- 1st get all apps  --------------

$cmd = "echo 'db.apps.find()' | mongo global | grep '{'";

$results = `$cmd`;
$results = preg_replace( '/^{ "_id" : "/m', '', $results );
$results = preg_replace( '/" }$/m', '', $results );
$apps = preg_split( "/\n/", $results, -1, PREG_SPLIT_NO_EMPTY );

# echo $results;

foreach ( $apps as $v ) {
    echo "apps $v\n";
}

# -------------- get all php jobrun ids --------------

$cmd = "env COLUMNS=1000 ps -ef | grep jobrun.php | grep -v grep | awk '{ print \$2 \":\" \$10 \":\" \$11 }'";

$results = `$cmd`;
$phpids = preg_split( "/\n/", $results, -1, PREG_SPLIT_NO_EMPTY );

$phpidsa = [];
$allidsa = [];

foreach ( $phpids as $v ) {
    echo "phpid $v\n";
    $results = preg_match( '/^([^:]*):([^:]*):([^:]*)$/', $v, $matches );
    $pid = $matches[ 1 ];
    $user = $matches[ 2 ];
    $jid = $matches[ 3 ];
    
    $pids[ $jid ] = $pid;
    $users[ $jid ] = $user;
    $phpidsa[ $jid ] = 1;
    $allidsa[ $jid ] = 1;
}

# -------------- get all running job ids --------------

$runningidsa = [];

foreach ( $apps as $v ) {
    echo "apps $v\n";
    $cmd = "echo 'db.running.find( {}, { _id:1 })' | mongo $v | grep '{'";
    $results = `$cmd`;
    $results = preg_replace( '/^{ "_id" : "/m', '', $results );
    $results = preg_replace( '/" }$/m', '', $results );
    echo "running:\n";
    echo $results;
    echo "------------------------------------------------------------\n";
    $runningids = preg_split( "/\n/", $results, -1, PREG_SPLIT_NO_EMPTY );
    foreach ( $runningids as $v2 ) {
        echo "runningid $v2\n";
        $runningidsa[ $v2 ] = 1;
        $allidsa[ $v2 ] = 1;
        $appsbyid[ $v2 ] = $v;
    }
}

$todo = [];

foreach ( $allidsa as $k => $v ) {
    $disposition = "";
    if ( isset( $phpidsa[ $k ] ) && isset( $runningidsa[ $k ] ) ) {
        $disposition = "ok $users[$k]";
    } else {
        if ( isset( $phpidsa[ $k ] ) ) {
            $disposition = "kill php";
            if ( !isset( $todo[ $users[ $k ] ] ) ) {
                $todo[ $users[ $k ] ] = "";
            }
            $todo[ $users[ $k ] ] .= "sudo kill $pids[$k]\n";
        } else {
            $disposition = "remove running";
            if ( !isset( $users[ $k ] ) ) {
                $users[ $k ] = "unknown";
            }
            if ( !isset( $todo[ $users[ $k ] ] ) ) {
                $todo[ $users[ $k ] ] = "";
            }
            $todo[ $users[ $k ] ] .= "mongo $appsbyid[$k] --eval 'db.running.remove({_id:\"$k\"})'\n";
        }
    }

    echo "$k $disposition\n";
}

foreach ( $todo as $k => $v ) {
    echo "----------------------------------------\n";
    echo "$k\n";
    echo "----------------------------------------\n";
    echo $v;
}

?>
