#!/usr/bin/php
<?php

{}

require_once "em_common.php";

$reps = 50;

for ( $i = 1; $i <= $reps; ++$i  ) {
    echo "rep $i of $reps...\n";

    $run_for = rand( 60, 600 );
    $sleep_for = rand( 60, 600 );

    $cmd = "php em_client.php --acquire m3.tiny";

    echo "$cmd\n";
    $res = explode( " ", trim( run_cmd( $cmd ) ) );

    $id = $res[0];
    $ip = $res[1];
    echo "got server with id $id, ip $ip\n";

    echo "sleep $run_for [s]\n";
    sleep( $run_for );

    $cmd = "php os_client.php --release $id";
    
    echo "$cmd\n";
    $res = run_cmd( $cmd );

    echo "sleep $sleep_for [s]\n";
    sleep( $sleep_for );
}

    
    
