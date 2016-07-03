#!/usr/bin/php 
<?php

$_REQUEST = json_decode( $argv[ 1 ], true);

//echo json_encode($_REQUEST);

$results = [];

if ( !sizeof( $_REQUEST ) ) {
    $results[ 'error' ] = "PHP code received no \$_REQUEST?";
    echo (json_encode($results));
    exit();
}

if ( !isset( $_REQUEST[ '_uuid' ] ) ) {
    $results[ "error" ] = "No _uuid specified in the request";
    echo (json_encode($results));
    exit();
}

if ( !isset( $_REQUEST[ '_logon' ] ) ) {
    $results[ "error" ] = "No _logon specified in the request";
    echo (json_encode($results));
    exit();
}

$appconfig = json_decode( file_get_contents( "__appconfig__" ) );

if ( !isset( $appconfig->restricted ) ) {
    $results[ "error" ] = "appconfig.json no restrictions defined";
    echo (json_encode($results));
    exit();
}

if ( !isset( $appconfig->restricted->admin ) ) {
    $results[ "error" ] = "appconfig.json no adminstrators defined";
    echo (json_encode($results));
    exit();
}

if ( !in_array( $_REQUEST[ '_logon' ], $appconfig->restricted->admin ) ) {
    $results[ "error" ] = "not an administrator";
    echo (json_encode($results));
    exit();
}

///////////////////////////////////////////////////////////////////////////////////

date_default_timezone_set("UTC");

$arg1 = $_REQUEST['input1'];
$arg2 = $_REQUEST['input2'];      


function check_dates($argument){
$split = array();
if (preg_match ("/^([0-9]{4})-([0-9]{2})-([0-9]{2})$/", $argument, $split)){
    
   if(checkdate($split[2],$split[3],$split[1])){
   	return true;
     } else {
        return false; 
     }
   } else {
     return false;	    
   }
}


if ( !check_dates($arg1) || !check_dates($arg2) ) {
    $results[ 'error' ] = "Incorrect Date Format!";
    echo (json_encode($results));
    exit();
}


$start_date = new DateTime($arg1);
$end_date = new DateTime($arg2);

$date_1 = new MongoDate(strtotime($start_date->format("Y-m-d H:i:s")));
$date_2 = new MongoDate(strtotime($end_date->format("Y-m-d H:i:s") ));

//echo $arg1. $arg2 . "\n";

$m = new MongoClient();
$db = $m->selectDB("__application__");

$collection_jobs = $db->jobs;
$collection_users = $db->users;
		 
//$cursor_jobs = $collection_jobs->find( array( "when"  => array( '$gte' => $date_1, '$lte' => $date_2 ) , "user" => array( '$exists' => true, '$nin' => [""] ) ) );

$cursor_jobs = $collection_jobs->find( array ( "user" => array( '$exists' => true, '$nin' => [""] )));

$cursor_users = $collection_users->find();

///////////////////////////////////////////////////////////////

$User_array = array();
$possible_status = array();  

foreach ($cursor_users as $obj_users){
   $User_array[$obj_users['name']] = array();
}

foreach ($cursor_jobs as $obj_jobs) {

  $this_user = $obj_jobs['user'];   

  $this_when_start = $obj_jobs[ 'when' ][0];
  $this_when_current = end( $obj_jobs[ 'when' ] );
       
  $user_start = $this_when_start->sec + ($this_when_start->usec)*pow(10.0, -6.0 );
  $user_current = $this_when_current->sec + ($this_when_current->usec)*pow(10.0, -6.0 );	

  if ( $db->users->find( array ( "user" => array( "name" => $this_user ) ) ) ){

    if (date(DATE_ISO8601, $user_start) >= $start_date->format(DATE_ISO8601) && date(DATE_ISO8601, $user_current) <= $end_date->format(DATE_ISO8601)){
  
      // Status
    
       if ( array_key_exists( 'status', $obj_jobs ) ) {
       	  $this_status = end( $obj_jobs[ 'status' ] );
       } else {
           $this_status = 'unknown';
       }
       
       if ( ($this_status == 'started' || $this_status == 'running') && !$db->running->find(array("_id" => $obj_jobs['_id']))  ){
           $this_status = 'failed';
       }
       
        
       if ( array_key_exists( $this_status, $User_array[ $this_user ]) )   {
          $User_array[ $this_user ][ $this_status  ] ++;
       } else {
          $User_array[ $this_user ][ $this_status  ] = 1;
       }
    
       $possible_status[ $this_status ] = 1;     
    
       // Duration
    
       if (array_key_exists( 'duration', $User_array[ $this_user ])){ 
            $User_array[ $this_user ][ 'duration' ] += ($user_current - $user_start);
         } else {
            $User_array[ $this_user ][ 'duration' ]  = ($user_current - $user_start);
         }
       }
   }
}


$cursor_users1 = $collection_users->find();

//$cursor_users->rewind();
$cursor_users1->sort( array( "name" => 1 ) );

$i=0;
foreach ( $cursor_users1 as $v ) {
    $name = $v[ 'name' ];
    $userinfo[] =
        array(
            "name"             => $name
            ,"email"           => "<a class='title' href='mailto:" . $v[ 'email' ] . "'>" . $v[ 'email' ] . "</a>"
	    ,"duration (h)"    => array_key_exists( 'duration', $User_array[ $name ]) ? round($User_array[ $name ][ 'duration' ] /3600, 3) : 0
        );
	foreach ( $possible_status as $status => $null) {
	    if ( array_key_exists( $status, $User_array[ $name ] ) ) {
	       $userinfo[$i][ $status ] = $User_array[ $name ][ $status ];
	    } else {
	       $userinfo[$i][ $status ] = 0;
	      }
 	}
	++$i;
}


// HTML Table//////
$html_userinfo = "<table class='padcell'><tr><th>" . implode( "</th><th>", array_keys( $userinfo[ 0 ] ) ) . "</th></tr>";

foreach ( $userinfo as $k => $v ) {
$html_userinfo .= "<tr><td>" . implode( "</td><td> ",  $v ) . "</td></tr>";
}

$html_userinfo .= "</table>";


// Old Output /////////////////////////////////////////////

//$html_userinfo = "<table class='padcell'>";
//foreach ( $User_array as $user => $key ) {
//    $html_userinfo .= "<tr><td>" . $user  . "</td>";
//      foreach ( $possible_status as $status => $null) {
//        $html_userinfo .= "<td>" . $status . "</td>";
//	if ( array_key_exists( $status, $key ) ) {
//           $html_userinfo .=  "<td>" . $key[ $status] . "</td>"; 
//	   } else {
//           $html_userinfo .= "<td>" . 0 . "</td>";
//	   }
//      }
//      if ( array_key_exists( 'duration', $key ) ){
//       $html_userinfo .= "<td> total_duration (h): " . round($key['duration']/3600.0, 2) . "</td>" ; 
//       }  else {
//           $html_userinfo .= "<td>" . 0 . "</td>";
//      }
//    $html_userinfo .= "</tr>";
//}
//$html_userinfo .= "</table>";
///////////////////////////////////////////////////////////////

$results = [];

$results[ 'jobshisreport' ] = $html_userinfo;

echo json_encode( $results );

?>