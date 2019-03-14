<?php
header('Content-type: application/json');
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

if ( isset( $_SESSION[ $window ][ 'project' ] ) )
{
  $results[ '_project' ] = $_SESSION[ $window ][ 'project' ];
} else {
  $results[ '_project' ] = "";
}
if ( isset( $_SESSION[ $window ][ 'logon' ] ) )
{ 
  $GLOBALS[ 'logon' ] = $_SESSION[ $window ][ 'logon' ];
  $results[ '_logon' ] = $_SESSION[ $window ][ 'logon' ];
} else {
  $results[ '_logon' ] = "";
  $results[ '_project' ] = "";
}
session_write_close();

if ( !sizeof( $_REQUEST ) )
{
    $results[ 'error' ] = "PHP code received no \$_REQUEST?";
    $results[ '_status' ] = 'failed';
    echo (json_encode($results));
    exit();
}

if ( !isset( $_REQUEST[ 'text1' ] ) || !strlen( $_REQUEST[ 'text1' ] ) )
{
//    $results[ 'error' ] = "You must provide a non-empty comment to submit feedback";
    $results[ '_message' ] = array( "icon" => "warning.png", "text" => "You must provide a non-empty comment to submit feedback" );
    $results[ '_status' ] = 'failed';
    echo (json_encode($results));
    exit();
}

__~debug:basemylog{error_log( "request\n" . print_r( $_REQUEST, true ) . "\n", 3, "/tmp/mylog" );}

require_once "../mail.php";
date_default_timezone_set( 'UTC' );
$json = json_decode( file_get_contents( "__appconfig__" ) );

$GLOBALS[ 'REMOTE_ADDR' ] = isset( $_SERVER[ 'REMOTE_ADDR' ] ) ? $_SERVER[ 'REMOTE_ADDR' ] : "not from an ip";

// $subject =  gethostname() . "/__application__ " . $_REQUEST[ 'level' ] . " feedback from " . $results[ '_logon' ] . "@" . $GLOBALS[ 'REMOTE_ADDR' ] . ( isset( $results[ '_project' ] ) ? " project " . $results[ '_project' ] : "" );

$subject =  "[" . gethostname() . "/__application__-feedback][" . $_REQUEST[ 'level' ] . "] '" . $_REQUEST[ 'subject' ] . "' " . $_REQUEST[ 'email' ];

$add = 
"\n" .
"subject : " . $_REQUEST[ 'subject' ] . "\n" .
"from    : " . $results[ '_logon' ] . "\n" .
"email   : " . $_REQUEST[ 'email' ] . "\n" .
"level   : " . $_REQUEST[ 'level' ] . "\n------------------------\n" .
$_REQUEST[ 'text1' ]
    ;


$data =
"project   : " . ( isset( $results[ '_project' ] ) ? $results[ '_project' ] : "no_project_specified" ) . "\n" .
"remote ip : " . $GLOBALS[ 'REMOTE_ADDR' ] . "\n" .
"browser   : " . $_REQUEST[ '_navigator' ] . "\n------------------------\n" .
// . "Events    : " . 
$_REQUEST[ '_eventlog' ] . "\n"
;

$ats = array( "json input" => "_args_", "command" => "_cmds_", "output" => "_stdout_", "error output" =>  "_stderr_" ); 

$attach = array();
$attachinfo = "";

$attachdata = array();

if ( isset( $_REQUEST[ 'job1_altval' ] ) && count( $_REQUEST[ 'job1_altval' ] ) ) {
    require_once "../joblog.php";
__~debug:basemylog{error_log( "job1_altval found \n", 3, "/tmp/mylog" );}
    
    foreach ( $_REQUEST[ 'job1_altval' ] as $v ) {
__~debug:basemylog{error_log( "job1_altval checking for $v \n", 3, "/tmp/mylog" );}
        if ( getmenumodule( $v ) ) {
__~debug:basemylog{error_log( "job1_altval $v getmenumodule ok\n", 3, "/tmp/mylog" );}
            $attachinfo .= 
                "related job $v\n" .
                "  module : " . $GLOBALS[ "getmenumodule"        ] . "\n" .
                "  project: " . $GLOBALS[ "getmenumoduleproject" ] . "\n" .
                "  status : " . $GLOBALS[ "getmenumodulestatus"  ] . "\n" ;

            // attach log files

            $logdir = $GLOBALS[ "getmenumodulelogdir"  ];

            
            foreach ( $ats as $k1=>$v1 ) {
                $f = "$logdir/$v1$v";
__~debug:basemylog{error_log( "job1_altval $k1 $v1 $logdir checking $f\n", 3, "/tmp/mylog" );}
                if ( file_exists( $f ) ) {
                    $attachinfo .= "  attach : $k1 as $v1$v\n";
                    $attach[] = $f;
                }
            }
        } else {
            $attachinfo .= 
                "Related job $v information not found in database\n";
__~debug:basemylog{error_log( "job1_altval $v getmenumodule FAILED\n", 3, "/tmp/mylog" );}
        }
        $attachinfo .= "------------------------\n";
    }
    //    $add .= $attachinfo;
    $attachdata[] = 
        array(
            "data" => $attachinfo
            ,"name" => "attachmentsummary.txt" );
}

$attachdata[] = 
    array(
        "data" => $data
        ,"name" => "eventlog.txt" );


if ( mymail_attach(
         $json->mail->feedback,
         $subject,
         $add,
         $attach,
         $attachdata
     ) )
{
    $results[ 'error' ]  = "Could not send email, mail server is down or not accepting requests";
    $results[ '_status' ] = 'failed';
} else {
    $results[ '_status' ] = 'complete';
    $results[ '-close2' ] = 1;
    $results[ '_message' ] = array( 'icon' => 'information.png', 'text' => 'Your feedback has been submitted.  Thank you.' );
}

echo (json_encode($results));
exit();
