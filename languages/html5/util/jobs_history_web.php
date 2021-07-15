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

require_once "__docroot:html5__/__application__/ajax/ga_db_lib.php";

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
$end_date->add(new DateInterval('P1D'));

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

$User_array = array();
$possible_status = array();  

foreach ($cursor_users as $obj_users){
   $User_array[$obj_users['name']] = array();
}

$add_users = [];
$totals    = [];

foreach ($cursor_jobs as $obj_jobs) {

  $this_user = $obj_jobs['user'];   

  $this_when_start = $obj_jobs[ 'when' ][0];

  $obj_jobs['when'] = (array) $obj_jobs['when'];
  $this_when_current = end( $obj_jobs[ 'when' ] );
       
  $user_start = ga_db_date_secs( $this_when_start );
  $user_current = ga_db_date_secs( $this_when_current );

  if ( array_key_exists( 'status', $obj_jobs ) ) {
      $obj_jobs['status'] = (array) $obj_jobs['status'];
      $this_status = end( $obj_jobs[ 'status' ] );
  } else {
      $this_status = 'unknown';
  }

  if ( $this_status == 'running' ) {
      $user_current = time();
  }

  if (date(DATE_ISO8601, $user_start) >= $start_date->format(DATE_ISO8601) && date(DATE_ISO8601, $user_current) <= $end_date->format(DATE_ISO8601)){
        
      // Status
      
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
          $add_users[] = $this_user;
      } 
      
      if ( array_key_exists( $this_status, $User_array[ $this_user ]) )   {
          $User_array[ $this_user ][ $this_status  ] ++;
      } else {
          $User_array[ $this_user ][ $this_status  ] = 1;
      }

      if ( array_key_exists( $this_status, $totals) )   {
          $totals[ $this_status  ] ++;
      } else {
          $totals[ $this_status  ] = 1;
      }
      
      $possible_status[ $this_status ] = 1;     
      
      // Duration
      
      if (array_key_exists( 'duration', $User_array[ $this_user ])){ 
          $User_array[ $this_user ][ 'duration' ] += ($user_current - $user_start);
      } else {
          $User_array[ $this_user ][ 'duration' ]  = ($user_current - $user_start);
      }
      if (array_key_exists( 'duration', $totals ) ){ 
          $totals[ 'duration' ] += ($user_current - $user_start);
      } else {
          $totals[ 'duration' ]  = ($user_current - $user_start);
      }

      // SUs
      
      if (array_key_exists( 'SUs', $User_array[ $this_user ])){ 
          $User_array[ $this_user ][ 'SUs' ] += ($user_current - $user_start) * ( isset( $obj_jobs['numprocs'] ) ? $obj_jobs['numprocs'] : 1 );
      } else {
          $User_array[ $this_user ][ 'SUs' ]  = ($user_current - $user_start) * ( isset( $obj_jobs['numprocs'] ) ? $obj_jobs['numprocs'] : 1 );
      }
      if (array_key_exists( 'SUs', $totals ) ){ 
          $totals[ 'SUs' ] += ($user_current - $user_start) * ( isset( $obj_jobs['numprocs'] ) ? $obj_jobs['numprocs'] : 1 );
      } else {
          $totals[ 'SUs' ]  = ($user_current - $user_start) * ( isset( $obj_jobs['numprocs'] ) ? $obj_jobs['numprocs'] : 1 );
      }
  }
}

$cursor_users1 =
    ga_db_output(
        ga_db_find(
            'users'
        )
    );

$final_users = [];
foreach ( $cursor_users1 as $v ) {
   $final_users[ $v['name' ] ] = $v;
}

foreach ( $add_users as $v ) {
   $final_users[ $v ] = [];
   $final_users[ $v ][ 'name' ]  = $v;
   $final_users[ $v ][ 'email' ] = "anonymous";
}
ksort( $final_users );

$totals_info = 
    array(
        "name"             => "<strong>Totals</strong>"
        ,"group"           => "<hr>"
        ,"email"           => "<hr>"
        ,"duration (h)"    => array_key_exists( 'duration', $totals ) ? round( $totals[ 'duration' ] /3600, 3) : 0
        ,"SUs"             => array_key_exists( 'SUs', $totals ) ? round( $totals[ 'SUs' ] /3600, 0) : 0
    );

foreach ( $possible_status as $status => $null) {
    if ( array_key_exists( $status, $totals ) ) {
        $totals_info[ $status ] = $totals[ $status ];
    } else {
        $totals_info[ $status ] = 0;
    }
}

$i=0;

$group_totals = [];

foreach ( $final_users as $v ) {
    $name = $v[ 'name' ];
    $group = isset( $v[ 'group' ] ) ? $v[ 'group' ] : "";
    $userinfo[] =
        array(
            "name"             => $name
            ,"group"           => $group
            ,"email"           => $v[ 'email' ] == "anonymous" ? "anonymous" : ( "<a class='title' href='mailto:" . $v[ 'email' ] . "'>" . $v[ 'email' ] . "</a>" )
	    ,"duration (h)"    => array_key_exists( 'duration', $User_array[ $name ]) ? round($User_array[ $name ][ 'duration' ] /3600, 3) : 0
	    ,"SUs"             => array_key_exists( 'SUs', $User_array[ $name ]) ? round($User_array[ $name ][ 'SUs' ] /3600, 0) : 0
        );
    foreach ( $possible_status as $status => $null) {
        if ( array_key_exists( $status, $User_array[ $name ] ) ) {
            $userinfo[$i][ $status ] = $User_array[ $name ][ $status ];
        } else {
            $userinfo[$i][ $status ] = 0;
        }
    }

    if ( !isset( $group_totals[ $group ] ) ) {
        $group_totals[ $group ] = 
            array( 
                "name"             => "<strong>Sub-totals</strong>"
                ,"group"           => $group
                ,"email"           => "<hr>"
                ,"duration (h)"    => $userinfo[ $i ][ "duration (h)" ]
                ,"SUs"             => $userinfo[ $i ][ "SUs"          ]
            );

        foreach ( $possible_status as $status => $null) {
            if ( array_key_exists( $status, $User_array[ $name ] ) ) {
                $group_totals[ $group ][ $status ] = $User_array[ $name ][ $status ];
            } else {
                $group_totals[ $group ][ $status ] = 0;
            }
        }

    } else {
        $group_totals[ $group ][ "duration (h)" ] += $userinfo[ $i ][ "duration (h)" ];
        $group_totals[ $group ][ "SUs"          ] += $userinfo[ $i ][ "SUs"          ];

        foreach ( $possible_status as $status => $null) {
            if ( array_key_exists( $status, $User_array[ $name ] ) ) {
                $group_totals[ $group ][ $status ] += $User_array[ $name ][ $status ];
            }
        }
    }        

    ++$i;
}


// HTML Table//////
$html_userinfo = "<table class='padcell'><tr><th>" . implode( "</th><th>", array_keys( $userinfo[ 0 ] ) ) . "</th></tr>";
$html_userinfo .= "<tr><td>" . implode( "</td><td> ",  $totals_info ) . "</td></tr>";

foreach ( $group_totals as $k => $v ) {
    $html_userinfo .= "<tr><td>" . implode( "</td><td> ",  $v ) . "</td></tr>";
}

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
