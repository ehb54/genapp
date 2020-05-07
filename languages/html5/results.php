<?php
header('Content-type: application/json');
# setup php session
session_start();
if (!isset($_SESSION['count'])) {
  $_SESSION['count'] = 0;
} else {
  $_SESSION['count']++;
}

$results = array();

if ( !sizeof( $_REQUEST ) )
{
    $results[ "error" ] = "PHP code received no \$_REQUEST?";
    $results[ '_status' ] = 'failed';
    echo (json_encode($responseVar));
    exit();
}

require_once "__docroot:html5__/__application__/ajax/ga_filter.php";
$modjson = array();
$inputs_req = $_REQUEST;
$validation_inputs = ga_sanitize_validate( $modjson, $inputs_req, 'get_results' );

if ( $validation_inputs[ "output" ] == "failed" ) {
    $results = array( "error" => $validation_inputs[ "error" ] );
#    $results[ '_status' ] = 'failed';
#    echo ( json_encode( $results ) );
#    exit();
};

$do_logoff = 0;

$window = "";
if ( isset( $_REQUEST[ '_window' ] ) )
{
   $window = $_REQUEST[ '_window' ];
}
if ( !isset( $_SESSION[ $window ] ) )
{
   $_SESSION[ $window ] = array( "logon" => "", "project" => "" );
}

if ( isset( $_REQUEST[ "_logon" ] ) && 
     ( !isset( $_SESSION[ $window ][ 'logon' ] ) || $_REQUEST[ "_logon" ] != $_SESSION[ $window ][ 'logon' ] ) ) {
   $do_logoff = 1;
   if ( isset( $_SESSION[ $window ][ 'logon' ] ) ) {
      unset( $_SESSION[ $window ][ 'logon' ] );
   }
   $results[ '_logon' ] = "";
}

if ( !isset( $_REQUEST[ "_logon" ] ) ) {
   unset( $_SESSION[ $window ][ 'logon' ] );
   $results[ '_logon' ] = "";
}

if ( !isset( $_REQUEST[ '_uuid' ] ) )
{
    $results[ "error" ] = "No _uuid specified in the request";
    $results[ '_status' ] = 'failed';
    echo (json_encode($results));
    exit();
}

$getinput = isset( $_REQUEST[ '_getinput' ] ) && $_REQUEST[ '_getinput' ] == "true";

__~debug:getinput{error_log( "in results.php getinput is " . ( $getinput ? "true" : "false" ) . "\n", 3, "/tmp/mylog" );}

$GLOBALS[ 'logon' ] = isset( $_SESSION[ $window ][ 'logon' ] ) ? $_SESSION[ $window ][ 'logon' ] : 'not logged in';
require_once "joblog.php";

$id = $_REQUEST[ '_uuid' ];

if ( !getmenumodule( $id ) )
{
   $results[ 'error' ] = "Could not find job id $id";
   $results[ '_status' ] = 'failed';
   echo (json_encode($results));
   exit();
}

$results[ '_fs_refresh' ] = $GLOBALS[ "getmenumoduleproject" ];

$dir    = $GLOBALS[ 'getmenumoduledir' ];
$logdir = $GLOBALS[ 'getmenumodulelogdir' ];

// if ( isprojectlocked( $dir ) )
// {
//    $results[ '_status' ] = 'running';
// __~debug:job{   $results[ 'jobstatus' ] = 'running';}
//    echo (json_encode($results));
//    exit();
// }

if ( $GLOBALS[ "getmenumodulestatus" ] != 'finished' &&
     $GLOBALS[ "getmenumodulestatus" ] != 'completed' &&
     $GLOBALS[ "getmenumodulestatus" ] != 'cancelled' &&
     $GLOBALS[ "getmenumodulestatus" ] != 'failed' )
{
    __~debug:getinput{error_log( "in results.php running status\n", 3, "/tmp/mylog" );}
    $use_cached_msg = false;
    if ( isset( $_REQUEST[ '_getlastmsg' ] ) &&
         $_REQUEST[ '_getlastmsg' ] == 1 ) {
        __~debug:job{$results[ "notice_lastmsg" ] = 'getlastmsg is on';}
        if ( cached_msg( $id ) ) {
            $use_cached_msg = true;
            __~debug:getinput{error_log( "in results.php use_cached_msg set true\n", 3, "/tmp/mylog" );}
        }
    }

    if ( $getinput ) {
        __~debug:getinput{error_log( "in results.php getinput is set in running status\n", 3, "/tmp/mylog" );}
        $getinputerror = false;
        ob_start();
        if ( !is_file("$logdir/_input_$id") || FALSE === ( $getinputdata = file_get_contents( "$logdir/_input_$id" ) ) ) {
            $cont = ob_get_contents();
            ob_end_clean();
            $getinputerror    = true;
            $getinputerrormsg = "$logdir/_input_$id error $cont";
        }
        ob_end_clean();
        if ( $use_cached_msg ) {
            __~debug:getinput{error_log( "in results.php getinput setting results to cached_msg\n", 3, "/tmp/mylog" );}
            $results = json_decode( $GLOBALS[ 'cached_msg' ], true );
        }
        if ( $getinputerror ) {
            $results[ "_getinputerror" ] = $getinputerrormsg;
        } else {
            $results[ "_getinput" ] = json_decode( $getinputdata );
        }
        if ( $use_cached_msg ) {
            __~debug:getinput{error_log( "in results.php exiting with input and cached_msg\n", 3, "/tmp/mylog" );}
            echo (json_encode($results));
            exit();
        }               
    }   

    if ( $use_cached_msg ) {
        __~debug:getinput{error_log( "in results.php exiting with cached_msg\n", 3, "/tmp/mylog" );}
        echo( $GLOBALS[ 'cached_msg' ] );
        exit();
    }

    $results[ '_status' ] = 'running';
    __~debug:job{$results[ 'jobstatus' ] = 'running';}
    echo (json_encode($results));
    exit();
}

$wascancelled = $GLOBALS[ "getmenumodulestatus" ] == 'cancelled';
// get the results and return

// possibly merge cached 
$has_cached = false;
if ( isset( $_REQUEST[ '_getlastmsg' ] ) &&
     $_REQUEST[ '_getlastmsg' ] == 1 )
{
__~debug:job{      $results[ "notice_lastmsg" ] = 'getlastmsg is on';}
   $has_cached = cached_msg( $id );
   if ( $has_cached ) {
       $cache_json = json_decode( $GLOBALS[ 'cached_msg' ], true );
       if ( $cache_json == NULL ) {
           $has_cached = false;
       }
   }
}

ob_start();
if ( !is_dir( $dir ) || !chdir( $dir ) )
{
   $cont = ob_get_contents();
   ob_end_clean();
   $results[ "error" ] = "Could not change to directory " . $dir . " " . $cont;
   $results[ '_status' ] = 'failed';
   echo (json_encode($results));
   exit();
}

if ( !$wascancelled ) {
    ob_start();
    if ( !is_file("$logdir/_stdout_$id") || FALSE === ( $strresults = file_get_contents( "$logdir/_stdout_$id" ) ) ) {
       sleep( 1 );
    }      
    if ( !is_file("$logdir/_stdout_$id") || FALSE === ( $strresults = file_get_contents( "$logdir/_stdout_$id" ) ) ) {
       sleep( 2 );
    }      
    if ( !is_file("$logdir/_stdout_$id") || FALSE === ( $strresults = file_get_contents( "$logdir/_stdout_$id" ) ) ) {
       sleep( 5 );
    }      
    if ( !is_file("$logdir/_stdout_$id") || FALSE === ( $strresults = file_get_contents( "$logdir/_stdout_$id" ) ) ) {
        $cont = ob_get_contents();
        ob_end_clean();
        $results[ "error" ] = "output results not found " . $dir . " " . $cont;
        $results[ '_status' ] = 'failed';
        echo (json_encode($results));
        exit();
    }
    ob_end_clean();
}

if ( $getinput ) {
    $getinputerror = false;
    ob_start();
    if ( !is_file("$logdir/_input_$id") || FALSE === ( $getinputdata = file_get_contents( "$logdir/_input_$id" ) ) )
    {
        $cont = ob_get_contents();
        ob_end_clean();
        $getinputerror    = true;
        $getinputerrormsg = "$logdir/_input_$id error $cont";
    }
    ob_end_clean();
}   

ob_start();
$test_json = json_decode( $wascancelled ? "{}" : $strresults, true );

if ( !$wascancelled && $test_json == NULL ) {
    $cont = ob_get_contents();
    ob_end_clean();
    if ( isset( $checkrunning ) )
    {
        if ( !ga_db_status(
                  ga_db_remove(
                      'joblock',
                      '',
                      [ "name" => $checkrunning ],
                      [ 'justOne' => true ]
                  ) 
             )
            ) {
            $results[ 'error' ] = "Error removing running project record from database.  This project is now locked. " . $ga_db_errors;
        }
    }

    if ( strlen( $strresults ) ) {
        $results[ "error" ] = "Malformed JSON returned from executable $cont";
        if ( strlen( $strresults ) > 1000 )
        {
            $results[ "executable_returned_end" ] = substr( $strresults, 0, 450  ) . " .... " . substr( $strresults, -450 );
            $results[ "notice" ] = "The executable return string was greater than 1000 characters, so only the first 450 and the last 450 are shown above.  Check $logdir/_stdout for the full output";
        } else {
            $results[ "executable_returned" ] = substr( $strresults, 0, 1000 );
        }
    } else {
        $results[ "error" ] = "Empty JSON returned from executable $cont";
    }

    ob_start();
    $stderr = trim( is_file( "$logdir/_stderr_$id" ) ? file_get_contents( "$logdir/_stderr_$id" ) : "Missing standard error output file" );
    $cont = ob_get_contents();
    ob_end_clean();
    $results[ "error_output" ] = ( strlen( $stderr ) > 0 ) ? $stderr : "EMPTY";
    if ( strlen( $cont ) ) {
        $results[ "error_output_issue" ] = "reading _stderr reported $cont";
    }           
    $results[ '_status' ] = 'failed';
    if ( $getinput ) {
        if ( $getinputerror ) {
            $results[ "_getinputerror" ] = $getinputerrormsg;
        } else {
            $results[ "_getinput" ] = json_decode( $getinputdata );
        }
    }
    echo (json_encode($results));
    exit();
} else {
   ob_end_clean();
   if ( $has_cached ) {
        $test_json = array_merge( $cache_json, $test_json );
   }
   if ( $getinput ) {
       if ( $getinputerror ) {
           $test_json[ "_getinputerror" ] = $getinputerrormsg;
       } else {
           $test_json[ "_getinput" ] = json_decode( $getinputdata );
       }
   }
   $test_json[ '_status' ] = $wascancelled ? 'cancelled' : 'complete';
   $test_json[ '_fs_refresh' ] = $results[ "_fs_refresh" ];
   __~debug:job{$test_json[ 'hidude' ] = $test_json[ '_status' ];}
   
   __~debug:basemylog{error_log( "result to return\n" . print_r( $test_json, true ) . "\n", 3, "/tmp/mylog" );}
   echo json_encode( $test_json );
   exit;
}
// never gets here
echo (json_encode($results));
