#!/usr/bin/php 
<?php

////////////////////////////////////////////////////////////////////
function check_input_dates(&$argument, $split, $Str_type){
if (preg_match ("/^([0-9]{4})-([0-9]{2})-([0-9]{2})$/", $argument, $split)){
   //echo "$split[2], $split[3], $split[1] \n";
 
   if(checkdate($split[2],$split[3],$split[1])){
        //echo "$split[1]-$split[2]-$split[3] \n";
	//echo $argument . "\n";
	return true;
     } else {
        $split = array();
        echo "Date Format Incorrect! \n";
        fwrite(STDOUT, "Enter $Str_type Date (YYYY-MM-DD): ");
        $argument = trim(fgets(STDIN));
	check_input_dates($argument, $split, $Str_type);
     }
   } else {
      $split = array();
      echo "Date Format Incorrect! \n";
      fwrite(STDOUT, "Enter $Str_type Date (YYYY-MM-DD): ");
      $argument = trim(fgets(STDIN));
      check_input_dates($argument, $split, $Str_type);
     }
}
////////////////////////////////////////////////////////////////////

date_default_timezone_set("UTC");
$split1 = array();
$split2 = array();

// input dates
fwrite(STDOUT, "Enter START Date (YYYY-MM-DD): ");
$arg1 = trim(fgets(STDIN));

check_input_dates($arg1, $split1, "START");

fwrite(STDOUT, "Enter END Date (YYYY-MM-DD): ");
$arg2 = trim(fgets(STDIN));

check_input_dates($arg2, $split2, "END");

$start_date = new DateTime($arg1);
$end_date = new DateTime($arg2);

$date_1 = new MongoDate(strtotime($start_date->format("Y-m-d H:i:s")));
$date_2 = new MongoDate(strtotime($end_date->format("Y-m-d H:i:s") ));

//echo $arg1. $arg2 . "\n";

$m = new MongoClient();
$db = $m->selectDB("__application__");

$collection_jobs = $db->jobs;
$collection_users = $db->users;
		 
$cursor_jobs = $collection_jobs->find( array( "when"  => array( '$gte' => $date_1, '$lte' => $date_2 ) , "user" => array( '$exists' => true, '$nin' => [""] ) ) );
$cursor_users = $collection_users->find();

///////////////////////////////////////////////////////////////

$User_array = array();
$possible_status = array();  

foreach ($cursor_users as $obj_users){
   $User_array[$obj_users['name']] = array();
 }

foreach ($cursor_jobs as $obj_jobs) {

  //print_r($obj_jobs);	
	
  $this_user = $obj_jobs['user'];   
  
  $this_when_start = $obj_jobs[ 'when' ][0];
  $this_when_current = end( $obj_jobs[ 'when' ] );
       
  $user_start = $this_when_start->sec + ($this_when_start->usec)*pow(10.0, -6.0 );
  $user_current = $this_when_current->sec + ($this_when_start->usec)*pow(10.0, -6.0 );	
 
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
 
// Output 

foreach ( $User_array as $user => $key ) {
    echo "$user \t";
      foreach ( $possible_status as $status => $null) {
        echo " $status " ;
        if ( array_key_exists( $status, $key ) ) {
           echo $key[ $status ] . "\t";
        } else {
           echo 0 . "\t" ;
        }
      }
      if ( array_key_exists( 'duration', $key ) ){
        echo "total_duration: " . round($key['duration']/3600.0, 2) ;
      } else {
      	  echo 0 . "\t" ;
    }	  	
    echo "\n"; 
}

$m->close();

?>
