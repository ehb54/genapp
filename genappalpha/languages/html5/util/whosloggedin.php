#!/usr/local/bin/php 
<?php

$app = json_decode( file_get_contents( "__appconfig__" ) );
$path = $app->phpsessionpath;

//$path = "/var/lib/php5";


// IF latest session file needed ... //////////////////////////////////////
//$latest_ctime = 0;
//$latest_filename = '';    
//$d = dir($path);
//while (false !== ($entry = $d->read())) {
//  $filepath = "{$path}/{$entry}";
//    if (is_file($filepath) && filectime($filepath) > $latest_ctime) {
//    $latest_ctime = filectime($filepath);
//    $latest_filename = $entry;
//  }
//}
//if (0 === strpos($latest_filename, 'sess')) 
//{
//  $latest_filename_array = explode("_", $latest_filename);
//  $sessid = end($latest_filename_array);
//
//  session_id($sessid);
//}
//session_start(); 
//echo "List of currently logged in users: \n";
//echo "--------------------------------\n";
//echo "User" . "\t" . "Application" . "\n";
//echo "--------------------------------\n";
//
//foreach ($_SESSION as $key=>$val){
//if (isset($val["logon"]) && isset($val["app"]))
//  {
//     echo $val["logon"] . "\t" . $val["app"] . "\n";
//  }
//}
////////////////////////////////////////////////////////////////////////////

$path_sess = $path . "/sess_*";
$files = glob($path_sess);
$users = array();
$apps  = array();

//IF loop over sessions via regex() ////////////////////////////////////////
foreach($files as $file) 
{
  $i = 0;	
  $data = file_get_contents($file);	
  $arr = explode(";",$data);
      
  //var_dump($arr);	 
  foreach($arr as $el) 
  { 
    ++$i;
    if (strpos($el, '"logon"') !== false)
      {
         $is_matched_1 = preg_match('/"(.+?)"/', $arr[$i], $matches_1);
	 if ($is_matched_1)
	   {
	     $users[] = $matches_1[0];
           }  
      }  
    if (strpos($el, '"app"') !== false)
      {
	 $is_matched_2 = preg_match('/"(.+?)"/', $arr[$i], $matches_2);
	 if ($is_matched_2)
	   {
	     $apps[] = $matches_2[0];
           }
      }  
  } 
}

//IF loop over sessions via regex() /////////////////////////////////////////////
//foreach($files as $file) 
//{
//  $file_array = explode("_", $file);
//  $sessid = end($file_array);
//     
//  //echo $sessid . "\n"; 
//
//  session_id($sessid);
//  session_start();
//
//  foreach ($_SESSION as $key=>$val){
//  if (isset($val["logon"]) && isset($val["app"]))
//     {
//        $users[] = $val['logon'];
//	$apps[] = $val['app'];
//	//echo $val["logon"] . "\t" . $val["app"] . "\n";
//     }	
//  } 
// session_commit();
//}
////////////////////////////////////////////////////////////////////////////////

echo "\nList of currently logged in users: \n";
echo "--------------------------------\n";
echo "User" . "\t\t" . "Application" . "\n";
echo "--------------------------------\n";

foreach ($users as $index => $value){
  echo $users[$index] . "\t\t" . $apps[$index] . "\n";
}

?>
