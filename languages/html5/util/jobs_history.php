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
        $split = [];
        echo "Date Format Incorrect! \n";
        fwrite(STDOUT, "Enter $Str_type Date (YYYY-MM-DD): ");
        $argument = trim(fgets(STDIN));
	check_input_dates($argument, $split, $Str_type);
     }
   } else {
      $split = [];
      echo "Date Format Incorrect! \n";
      fwrite(STDOUT, "Enter $Str_type Date (YYYY-MM-DD): ");
      $argument = trim(fgets(STDIN));
      check_input_dates($argument, $split, $Str_type);
     }
}
////////////////////////////////////////////////////////////////////

require_once "__docroot:html5__/__application__/ajax/ga_db_lib.php";

$split1 = [];
$split2 = [];

// input dates
if ( isset( $argv[ 1 ] ) ) {
    $arg1 = $argv[ 1 ];
} else {
    fwrite(STDOUT, "Enter START Date (YYYY-MM-DD): ");
    $arg1 = trim(fgets(STDIN));
}

check_input_dates($arg1, $split1, "START");

if ( isset( $argv[ 2 ] ) ) {
    $arg2 = $argv[ 2 ];
} else {
    fwrite(STDOUT, "Enter END Date (YYYY-MM-DD): ");
    $arg2 = trim(fgets(STDIN));
}

check_input_dates($arg2, $split2, "END");

$start_date = new DateTime($arg1);
$end_date = new DateTime($arg2);

$date_1 = ga_db_output( ga_db_date( strtotime( $start_date->format( "Y-m-d H:i:s" ) ) ) );
$date_2 = ga_db_output( ga_db_date( strtotime( $end_date->format( "Y-m-d H:i:s" ) . " +1 day" ) ) );

//echo $arg1. $arg2 . "\n";

ga_db_open( true );
		 
$cursor_jobs = 
    ga_db_output(
        ga_db_find(
            'jobs',
            '',
            [
             "when"  => [
                 '$gte' => $date_1,
                 '$lte' => $date_2 
             ], 
             "user" => [
                 '$exists' => true,
                 '$nin' => [""]
             ]
            ]
        )
    );

$cursor_users = 
    ga_db_output(
        ga_db_find(
            'users'
        )
    );

///////////////////////////////////////////////////////////////

$User_array = [];
$possible_status = [];  

foreach ($cursor_users as $obj_users){
   $User_array[$obj_users['name']] = [];
 }

foreach ($cursor_jobs as $obj_jobs) {

  //print_r($obj_jobs);	
	
  $this_user = $obj_jobs['user'];   

  $obj_jobs['when'] = (array) $obj_jobs['when'];
  $this_when_start = $obj_jobs[ 'when' ][0];
  $this_when_current = end( $obj_jobs[ 'when' ] );
       
  $user_start = ga_db_date_secs( $this_when_start );
  $user_current = ga_db_date_secs( $this_when_current );
 
// Status

   if ( array_key_exists( 'status', $obj_jobs ) ) {
       $obj_jobs['status'] = (array) $obj_jobs['status'];
       $this_status = end( $obj_jobs[ 'status' ] );
   } else {
       $this_status = 'unknown';
   }
   
   if ( ($this_status == 'started' || $this_status == 'running') && 
        !ga_db_output(
            ga_db_find(
                'running',
                '',
                [ "_id" => $obj_jobs['_id'] ]
            )
        )
       ) {
       $this_status = 'failed';
   }
   
   if ( $this_user == "not logged in" ) {
      $this_user = isset( $obj_jobs[ 'remoteip' ] ) ? $obj_jobs[ 'remoteip' ] : "anonymous";
   }
   if ( !isset( $User_array[ $this_user ] ) ) {
      $User_array[ $this_user ] = [];
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
 
// SUs
  if (array_key_exists( 'SUs', $User_array[ $this_user ])){ 
     $User_array[ $this_user ][ 'SUs' ] += ($user_current - $user_start) * ( isset( $obj_jobs['numprocs'] ) ? $obj_jobs['numprocs'] : 1 );
  } else {
     $User_array[ $this_user ][ 'SUs' ]  = ($user_current - $user_start) * ( isset( $obj_jobs['numprocs'] ) ? $obj_jobs['numprocs'] : 1 );
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

    if ( array_key_exists( 'SUs', $key ) ){
        echo "\ttotal_SUs: " . round($key['SUs']/3600.0, 2) ;
    } else {
        echo 0 . "\t" ;
    }	  	

    echo "\n"; 
}

