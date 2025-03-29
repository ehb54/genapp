#!/usr/bin/php
<?php

{}

require_once "em_config.php";
require_once "em_common.php";

$em_status = new em_status( true );
echo $em_status->dump( "client dump" );
echo "client read no lock now\n";
$em_status->read_no_lock();

echo "client read lock now\n";
$em_status->read_lock();
echo "client got lock\n";
$em_status->release_lock();


