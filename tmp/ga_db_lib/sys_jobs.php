<?php
session_start(); 

$window = "";
if ( isset( $_REQUEST[ '_window' ] ) )
{
   $window = $_REQUEST[ '_window' ];
}
if ( !isset( $_SESSION[ $window ] ) )
{
   $_SESSION[ $window ] = array( "logon" => "", "project" => "" );
}

// $results[ '_status' ] = 'complete';

if ( !isset( $_SESSION[ $window ][ 'logon' ] ) )
{
  echo '{}';
  exit();
}
session_write_close();

date_default_timezone_set("UTC");

$GLOBALS[ 'logon' ] = $_SESSION[ $window ][ 'logon' ];
$GLOBALS[ 'REMOTE_ADDR' ] = isset( $_SERVER[ 'REMOTE_ADDR' ] ) ? $_SERVER[ 'REMOTE_ADDR' ] : "not from an ip";
require_once "../joblog.php";

function small_string( $s, $count = 1 )
{
   for ( $c = 0; $c < $count; $c++ )
   {
      $s = "<small>$s</small>";
   }
   return $s;
} 

if ( isset( $_REQUEST[ "_asuser" ] ) ) {
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

    if ( !in_array( $GLOBALS[ 'logon' ], $appconfig->restricted->admin ) ) {
        $results[ "error" ] = "not an administrator";
        echo (json_encode($results));
        exit();
    }    
}   

// error_log( "check empty jqgrid_jobs!" );
if ( !jqgrid_jobs( false, isset( $_REQUEST[ "_asuser" ] ) ?  $_REQUEST[ "_asuser" ] : $GLOBALS[ "logon" ] ) )
{
  echo '{}';
  exit;
}

if ( !isset( $_REQUEST[ "_tree" ] ) &&
     !isset( $_REQUEST[ "_asuser" ] ) ) {
   $rows = array();
   foreach ( $GLOBALS[ 'jqgrid_jobs' ] as $job )
   {
       if ( isset( $job["modal"] ) ) {
           continue;
       }

       if ( isset( $job["duration"] ) )
       {
           $duration_o = floatval( $job["duration"] );
           $duration = $duration_o;
           $duration_s = sprintf( $duration > 5 * 60 ? "%.0f" : "%.2f", $duration - 60 * intval( $duration / 60 ) );
           $duration_m = intval( $duration / 60 ) % 60;
           $duration_h = intval( $duration /(60 * 60 ) ) % 24;
           $duration_d = intval( $duration /(24 * 60 * 60 ) );


           $duration = ( $duration_d > 0 ? $duration_d . "d" : "" ) .
                       ( $duration_h > 0 ? $duration_h . "h" : "" ) .
                       ( $duration_m > 0 ? $duration_m . "m" : "" ) .
                       ( $duration_s > 0 ? $duration_s . "s" : "" );
       } else {
           $duration_o = 0.0;
           $duration = "active";
       }

       $project = "not specified";
       if ( isset( $job[ "project" ] ) )
       {
          $project =  $job[ "project" ];
       }
       if ( !strlen( $project ) )
       {
           $project = 'no_project_specified';
       }

       if ( isset( $job[ 'directory' ] ) && isprojectlocked( $job[ 'directory' ] ) )
       {
          if ( !strlen( $project ) )
          {
              $project = 'no_project_specified';
          }
          if ( isset( $job[ 'status' ] ) && count( $job[ 'status' ] ) && end($job[ 'status' ]) != 'failed' && end($job[ 'status' ]) != 'finished' && end($job[ 'status' ]) != 'cancelled'  )
          {
              $project = "<font color='red'>$project</font>";
          } else {
              $project = "<font color='yellow'>$project</font>";
          }
       } else {
          if ( isset( $job[ 'status' ] ) && count( $job[ 'status' ] ) && end($job[ 'status' ]) != 'failed' && end($job[ 'status' ]) != 'finished' && end($job[ 'status' ]) != 'cancelled'  )
          {
              $project = "<font color='green'>$project</font>";
          }
       }

       $endasprogress = 0;
       if ( !isset( $job["end"] ) &&
            cached_progress( $job["_id"] ) )
       {
           $endasprogress = 1;
           $job[ "end" ] = sprintf( "%.1f%%", 100.0 * $GLOBALS[ 'cached_progress' ] );
       }

       $row = array();
       $row[ "id" ] = $job["_id"];
       $row[ "cells" ] = array();
       $row[ "cells" ][] = array( "value" => small_string( $job["menu"] . "/" . $job["module"] ) );
       $row[ "cells" ][] = array( "value" => small_string( $project ) );
       $row[ "cells" ][] = array( "value" => small_string( isset( $job["start"] ) ? date( "Y M d H:i:s T",$job["start"]->sec ): "unknown", 2 ) );
       $row[ "cells" ][] = array( "value" => intval( isset( $job["start"] ) ? $job["start"]->sec : 0 ) );
       if ( $endasprogress )
       {
          $row[ "cells" ][] = array( "value" => small_string( $job["end"], 2 ) );
          $row[ "cells" ][] = array( "value" => intval( 100000 * $GLOBALS[ 'cached_progress' ] ) );
       } else {
          $row[ "cells" ][] = array( "value" => small_string( isset( $job["end"] ) ? date( "Y M d H:i:s T",$job["end"]->sec ) : "", 2 ) );
          $row[ "cells" ][] = array( "value" => intval( isset( $job["end"] ) ? $job["end"]->sec : 0 ) );
       }
       $row[ "cells" ][] = array( "value" => small_string( $duration ) );
       $row[ "cells" ][] = array( "value" => $duration_o );
       $row[ "cells" ][] = array( "value" => small_string( isset( $job["remoteip"] ) ? $job["remoteip"] : "unknown" ) );
       $row[ "cells" ][] = array( "value" => small_string( isset( $job["resource"] ) ? $job["resource"] : "unknown" ) );
       $rows[] = $row;
   }

   $results = array();

   $results["colModel"] = array();
   $index = 0;
   $results["colModel"][] = array( "name" => "module", "index" => "module", "width" => 250, "align" => "center", "jsonmap" => "cells.$index.value" ); $index++;
   $results["colModel"][] = array( "name" => "project", "index" => "project", "width" => 250, "align" => "center", "jsonmap" => "cells.$index.value" ); $index++;
   $results["colModel"][] = array( "name" => "start", "index" => "startnumeric", "width" => 150, "align" => "center", "jsonmap" => "cells.$index.value" ); $index++;
   $results["colModel"][] = array( "name" => "startnumeric", "index" => "startnumeric", "width" => 150, "align" => "center", "jsonmap" => "cells.$index.value", "hidden" => true ); $index++;
   $results["colModel"][] = array( "name" => "end", "index" => "endnumeric", "width" => 150, "align" => "center", "jsonmap" => "cells.$index.value" ); $index++;
   $results["colModel"][] = array( "name" => "endnumeric", "index" => "endnumeric", "width" => 150, "align" => "center", "jsonmap" => "cells.$index.value", "hidden" => true ); $index++;
   $results["colModel"][] = array( "name" => "duration", "index" => "durationnumeric", "width" => 100, "align" => "center", "jsonmap" => "cells.$index.value" ); $index++;
   $results["colModel"][] = array( "name" => "durationnumeric", "index" => "durationnumeric", "width" => 100, "align" => "center", "jsonmap" => "cells.$index.value", "hidden" => true ); $index++;
   $results["colModel"][] = array( "name" => "remoteip", "index" => "remoteip", "width" => 150, "align" => "center", "jsonmap" => "cells.$index.value" ); $index++;
   $results["colModel"][] = array( "name" => "resource", "index" => "resource", "width" => 150, "align" => "center", "jsonmap" => "cells.$index.value" ); $index++;

   $results["colNames"] = array( "Module", "Project", "Start", "Start numeric", "End", "End numeric", "Duration", "Duration numeric", "Remote IP", "Resource" );
   $results["jobgrid"] = array( "outerwrapper" => array( "innerwrapper" => array( "rows" => $rows ) ) );

  echo json_encode( $results );
  exit;
}

if ( isset( $_REQUEST[ "_tree" ] ) ) {
# tree version 
# just return full tree for now?
    __~debug:basemylog{error_log( "request\n" . print_r( $_REQUEST, true ) . "\n", 3, "/tmp/mylog" );}

    $reqkey = $_REQUEST[ "_tree" ];
    __~debug:jc{error_log( "reqkey is " . $reqkey );}

    $result_jobs = array();
    $used_top    = array();
    $used_second = array();
    $used_third  = array();

    foreach ( $GLOBALS[ 'jqgrid_jobs' ] as $job )
    {
        if ( isset( $job["duration"] ) )
        {
            $duration_o = floatval( $job["duration"] );
            $duration = $duration_o;
            $duration_s = sprintf( $duration > 5 * 60 ? "%.0f" : "%.2f", $duration - 60 * intval( $duration / 60 ) );
            $duration_m = intval( $duration / 60 ) % 60;
            $duration_h = intval( $duration /(60 * 60 ) ) % 24;
            $duration_d = intval( $duration /(24 * 60 * 60 ) );
            
            $duration = ( $duration_d > 0 ? $duration_d . "d" : "" ) .
                ( $duration_h > 0 ? $duration_h . "h" : "" ) .
                ( $duration_m > 0 ? $duration_m . "m" : "" ) .
                ( $duration_s > 0 ? $duration_s . "s" : "" );
        } else {
            $duration_o = 0.0;
            $duration = "active";
        }
        $project = "no_project_specified";
        if ( isset( $job[ "project" ] ) && strlen( $job[ "project" ] ) )
        {
            $project =  $job[ "project" ];
        }
        if ( isset( $job[ 'directory' ] ) && isprojectlocked( $job[ 'directory' ] ) )
        {
            if ( isset( $job[ 'status' ] ) && count( $job[ 'status' ] ) && end($job[ 'status' ]) != 'failed' && end($job[ 'status' ]) != 'finished' && end($job[ 'status' ]) != 'cancelled' )
            {
                $project = "<font color='red'>$project</font>";
            } else {
                $project = "<font color='yellow'>$project</font>";
            }
        }
        $endasprogress = 0;
        if ( !isset( $job["end"] ) &&
             cached_progress( $job["_id"] ) )
        {
            $endasprogress = 1;
            $job[ "end" ] = sprintf( "%.1f%%", 100.0 * $GLOBALS[ 'cached_progress' ] );
        }
        
        if ( isset( $job[ "start" ] ) )
        {
            $time = $job[ "start" ]->sec;
            $ym  = date( "Y-m",     $time );
            $d   = date( "d",       $time );
            $hr  = date( "H",       $time );
            $hms = date( "H:i:s T", $time );
        } else {
            $time = 0;
            $ym  = "unknown";
            $d   = "unknown";
            $hr  = "unknown";
        }

        // link to root

            if ( !array_key_exists( $ym, $used_top ) )
        {
            if ( $reqkey === "#" ) {
                array_push( $result_jobs, 
                            array( 
                                "id"       => $ym,
                                "parent"   => "#",
                                "text"     => "<b>$ym</b>",
                                "children" => true,
                                "data"    => array( "time"     => $time )
                            ) );
            }
            $used_top[ $ym ] = 1;
        }

        // link to ym

            $ymd = "$ym-$d";
        if ( !array_key_exists( $ymd, $used_second ) )
        {
            if ( $reqkey === $ym ) {
                array_push( $result_jobs, 
                            array( 
                                "id"       => $ymd,
                                "parent"   => $ym,
                                "text"     => "<b>$d</b>",
                                "children" => true,
                                "data"    => array( "time"     => $time )
                            ) );
            }
            $used_second[ $ymd ] = 1;
        }

        // link to module
            $module = $job["module"];
        $ymdmodule = "$ymd:$module";
        if ( !array_key_exists( $ymdmodule, $used_third ) )
        {
            if ( $reqkey === $ymd ) {
                array_push( $result_jobs, 
                            array( 
                                "id"       => $ymdmodule,
                                "parent"   => $ymd,
                                "text"     => "<b>$module</b>",
                                "children" => true,
                                "data"    => array( "time"     => $time )
                            ) );
            }
            $used_third[ $ymdmodule ] = 1;
        }
        
        if ( $reqkey === $ymdmodule || $reqkey === $job[ "_id" ] ) {
            array_push( $result_jobs, 
                        array( "id"       => $job[ "_id" ],
                               "parent"   => $ymdmodule,
                               "text"     => "<b>$project start: $hms duration: $duration</b>",
                               "data"     => 
                               array( 
                                   "time"     => $time,
                                   "job"      => true
                               )
                        ) );
        }
    }

    __~debug:basemylog{error_log( "sys_jobs: result_jobs\n" . print_r( $result_jobs, true ) . "\n", 3, "/tmp/mylog" );}
    echo json_encode( $result_jobs );
    exit();
}

# _asuser version // new layout

if ( isset( $_REQUEST[ "_asuser" ] ) ) {

    $jobinfo = [];
    $script  = "";

    foreach ( $GLOBALS[ 'jqgrid_jobs' ] as $job ) {
        if ( isset( $job["duration"] ) ) {
            $duration_o = floatval( $job["duration"] );
            $duration = $duration_o;
            $duration_s = sprintf( $duration > 5 * 60 ? "%.0f" : "%.2f", $duration - 60 * intval( $duration / 60 ) );
            $duration_m = intval( $duration / 60 ) % 60;
            $duration_h = intval( $duration /(60 * 60 ) ) % 24;
            $duration_d = intval( $duration /(24 * 60 * 60 ) );
            
            $duration = ( $duration_d > 0 ? $duration_d . "d" : "" ) .
                ( $duration_h > 0 ? $duration_h . "h" : "" ) .
                ( $duration_m > 0 ? $duration_m . "m" : "" ) .
                ( $duration_s > 0 ? $duration_s . "s" : "" );
        } else {
            $duration_o = 0.0;
            $duration = "active";
        }
        $project = "no_project_specified";
        if ( isset( $job[ "project" ] ) && strlen( $job[ "project" ] ) ) {
            $project =  $job[ "project" ];
        }
        $o_project = $project;
        if ( isset( $job[ 'directory' ] ) && isprojectlocked( $job[ 'directory' ] ) ) {
            if ( isset( $job[ 'status' ] ) && count( $job[ 'status' ] ) && end($job[ 'status' ]) != 'failed' && end($job[ 'status' ]) != 'finished' && end($job[ 'status' ]) != 'cancelled' ) {
                $project = "<font color='red'>$project</font>";
            } else {
                $project = "<font color='yellow'>$project</font>";
            }
        }
        $endasprogress = 0;
        if ( !isset( $job["end"] ) &&
             cached_progress( $job["_id"] ) ) {
            $endasprogress = 1;
            $job[ "end" ] = sprintf( "%.1f%%", 100.0 * $GLOBALS[ 'cached_progress' ] );
        }
        
        if ( isset( $job[ "start" ] ) )
        {
            $time = $job[ "start" ]->sec;
            $date  = date( "Y-m-d H:i:s T",     $time );
        } else {
            $time = 0;
            $date = "unknown";
        }
        
        $switchok = isset( $job[ "menu" ] ) && isset( $job[ "module" ] );
            
        $module = isset( $job[ "module" ] ) ? $job[ "module" ] : "";

        $button_add = "";
        if ( $duration == "active" ) {
            $bid = "cancel_" . $job[ '_id' ];
            $button_add = "<button button id=$bid>Cancel</button>";
            $script    .= "$('#$bid').click(function(e){e.preventDefault();e.returnValue=false;ga.admin.ajax.cancel('"
                . $_REQUEST[ '_asuser' ] . "','"
                . $_REQUEST[ '_id' ] . "','"
                . $_REQUEST[ '_manageid' ]
                . "','$module','" 
                . $job[ '_id' ] 
                . "');});";
        }

        $jobinfo[] =
            array( 
                "start"       => $date
                ,"menu"       => isset( $job[ "menu" ] ) ? $job[ "menu" ] : ""
                ,"module"     => isset( $job[ "module" ] ) ? ( $switchok ? ( "<a href=?_reqlogin=1&_switch=" . $job[ "menu" ] . "/" . $job[ "module" ] . "/$o_project/" . $job[ '_id' ] . " target='_blank'>" . $job[ "module" ] . "</a>" ) : $job[ "module" ] ) : ""
                ,"project"    => $project
                ,"duration"   => $duration . $button_add
                ,"processors" => isset( $job[ "numprocs" ] ) ? $job[ "numprocs" ] : ""
            );
    }

    arsort( $jobinfo );
    
    $html_jobinfo = "<table class='padcell'><tr><th>" . implode( "</th><th>", array_keys( $jobinfo[ 0 ] ) ) . "</th></tr>";
    foreach ( $jobinfo as $k => $v ) {
        $html_jobinfo .= "<tr><td>" . implode( "</td><td> ",  $v ) . "</td></tr>";
    }

    $html_jobinfo .= "</table>";
    $html_jobinfo .= "</table><script>$script</script>";

    echo $html_jobinfo;
}

