#!/usr/bin/php 
<?php

$app = json_decode( file_get_contents( "__appconfig__" ) );
$path = $app->phpsessionpath;

//$path = "/var/lib/php5/";

$latest_ctime = 0;
$latest_filename = '';    

$d = dir($path);

while (false !== ($entry = $d->read())) {
  $filepath = "{$path}/{$entry}";
    if (is_file($filepath) && filectime($filepath) > $latest_ctime) {
    $latest_ctime = filectime($filepath);
    $latest_filename = $entry;
  }
}


if (0 === strpos($latest_filename, 'sess')) 
{
  $latest_filename_array = explode("_", $latest_filename);
  $sessid = end($latest_filename_array);

  session_id($sessid);
}

session_start(); 

echo "List of currently logged in users: \n";
echo "--------------------------------\n";
echo "User" . "\t" . "Application" . "\n";
echo "--------------------------------\n";

foreach ($_SESSION as $key=>$val){
if (isset($val["logon"]) && isset($val["app"]))
  {
     echo $val["logon"] . "\t" . $val["app"] . "\n";
  }
}

//var_dump($_SESSION);


?>