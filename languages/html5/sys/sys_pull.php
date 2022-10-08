<?php
header('Content-type: application/json');
session_start(); 

$results[ '_status' ] = 'complete';

if ( !sizeof( $_REQUEST ) )
{
    $results[ "error" ] = "PHP code received no \$_REQUEST?";
    echo (json_encode($results));
    exit();
}

require_once "__docroot:html5__/__application__/ajax/ga_filter.php";

$modjson = json_decode( '__modulejson__' );
#$modjson = [];
$inputs_req = $_REQUEST;
$validation_inputs = ga_sanitize_validate( $modjson, $inputs_req, '__menu:modules:id__' );

if ( $validation_inputs[ "output" ] == "failed" ) {
    $results = array( "error" => $validation_inputs[ "error" ] );
#    $results[ '_status' ] = 'failed';
#    echo ( json_encode( $results ) );
#    exit();
};

if ( isset( $_REQUEST[ '_window' ] ) )
{
   $window = $_REQUEST[ '_window' ];
}
if ( !isset( $_SESSION[ $window ] ) )
{
   $_SESSION[ $window ] = array( "logon" => "", "project" => "" );
}

$results[ '_status' ] = 'complete';

if ( !isset( $_SESSION[ $window ][ 'logon' ] ) ||
     !isset( $_REQUEST[ '_logon' ] ) )
{
    $results[ '_logon' ] = "";
    if ( isset( $_REQUEST[ 'datetime' ] ) )
    {
       date_default_timezone_set("UTC");
       $results[ 'datetime' ] = date( "Y M d H:i:s T", time() );
    }
    echo (json_encode($results));
    exit();
}

require_once "__docroot:html5__/__application__/ajax/ga_db_lib.php";

if ( $_REQUEST[ '_logon' ] != $_SESSION[ $window ][ 'logon' ] )
{
   $savelogon = $_SESSION[ $window ][ 'logon' ];
   unset( $_SESSION[ $window ][ 'logon' ] );
   session_write_close();
   $results[ '_logon' ] = "";
   $results[ 'error'  ] = 'Possible security violation user mismatch. ';

   ga_db_open( true );

   $now = ga_db_output( ga_db_date() );

   $insert[ 'requestuser' ] = $_REQUEST[ '_logon' ];
   $insert[ 'sessionuser' ] = $savelogon;
   $insert[ 'remoteip'    ] = isset( $_SERVER[ 'REMOTE_ADDR' ] ) ? $_SERVER[ 'REMOTE_ADDR' ] : "not from an ip";
   $insert[ 'when'        ] = $now;

   ga_db_insert( 'security', '', $insert, [], true );

   require_once "../mail.php";
   $json = json_decode( file_get_contents( "__appconfig__" ) );

   mymail( $json->mail->admin, 'security alert __application__', "session timeout or possible security breach attempt on __application__\n" .
           'requestuser: ' . $insert[ 'requestuser' ] . "\n" .
           'sessionuser: ' . $insert[ 'sessionuser' ] . "\n" .
           'remoteip:    ' . $insert[ 'remoteip' ] . "\n" .
           'when:        ' . date('Y-m-d H:i:s', ga_db_date_secs( $insert[ 'when' ] ) ) . " UTC\n" .
           '' );

   echo (json_encode($results));
   exit();
}
session_write_close();

if ( !sizeof( $_REQUEST ) )
{
    $results[ 'error' ] = "PHP code received no \$_REQUEST?";
    echo (json_encode($results));
    exit();
}

ga_db_open( true );

if ( $doc = ga_db_output( ga_db_findOne( 'users', '', [ "name" => $_SESSION[ $window ][ 'logon' ] ] ) ) ) {
// get all keys in request, look in db and join results
   $any_results = 0;
   foreach ( $_REQUEST as $k=>$v )
   {
      if ( $k[ 0 ] != '_' )
      {
//         echo "k is " . $k . "\n";
//         echo "v is of type: " . gettype( $v ) . "\n";
//         print_r( $v );
//         echo "\n---\n";
//         echo "doc[$k] is of type " . gettype( $doc[ $k ] ) . "\n";
//         print_r( $doc[ $k ] );
//         echo "\n---\n";
         if ( is_scalar( $v ) || is_string( $v ) )
         {        
            $any_results = 1;
            if ( isset( $doc[ $k ] ) &&
                 $v == 0 &&
                 is_object( $doc[ $k ] ) )
            
            {
               foreach ( $doc[ $k ] as $k2=>$v2 )
               {
                  foreach ( $doc[ $k ][ $k2 ] as $k3=>$v3 )
                  {
                     if ( !isset( $keyed[ $k3 ] ) )
                     {
                        $results[ $k ][]       = $k3;
                        $keyed[ $k3 ] = 1;
                     }
                  }
               }
            } else {
               if ( isset( $doc[ $k ] ) ) {
                   $results[ $k ] = $doc[ $k ];
               } else {
                   $ke = explode( ":", $k );
                   
                   $kedoc = $doc;
                   $keok = 1;

                   while ( count( $ke ) ) {
                       if ( !isset( $kedoc[ $ke[ 0 ] ] ) ) {
                           $keok = 0;
                           break;
                       }
                       $kedoc = $kedoc[ array_shift( $ke ) ];
                   }
                   
                   if ( $keok && $kedoc ) {
                       $results[ $k ] = $kedoc;
                   } else {
                       // special handling
                       switch ( $k ) {
                           case "color:body:color" :
                               $results[ $k ] = rgbtohex( "__text_color_rgb__" );
                           break;
                           case "color:body:background" :
                               $results[ $k ] = rgbtohex( "__background_color_rgb__" );
                           break;
                           default :
                               $results[ $k ] = "";
                           break;
                       } 
                   }
               }
            }
         } else {
            if ( is_array( $v ) || is_object( $v ) )
            {
               $any_results = 1;
               foreach ( $v as $k1=>$v1 )
               {
//                  echo "k1 is " . $k1 . "\n";
//                  echo "v1 is of type: " . gettype( $v1 ) . "\n";
//                  print_r( $v1 );
//                  echo "\n---\n";
                  foreach ( $doc[ $k ] as $k2=>$v2 )
                  {
//                     echo "doc[ $k ][ $k2 ] is of type " . gettype( $doc[ $k ][ $k2 ] ) . "\n";
                     foreach ( $doc[ $k ][ $k2 ] as $k3=>$v3 )
                     {
//                        echo "k3 $k3\n";
                        if ( !isset( $keyed[ $k3 ] ) )
                        {
                           $results[ $k ][]       = $k3;
                           $keyed[ $k3 ] = 1;
                        }
                        $results[ "$k:$k1" ][] = $v3[ $k1 ];
                     }
                  }
               }
            }
         }
      }
   }
   if ( $any_results == 0 )
   {
      $results[ 'error' ] = "Nothing requested";
   }
} else {
   $results[ 'error' ] = "Could not find user " . $_SESSION[ $window ][ 'logon' ] . " in db";
}

if ( isset( $_REQUEST[ '_users' ] ) )
{
   $query[ 'visible' ][ '$in' ] = array( "on" );
   $query[ 'name'    ][ '$ne' ] = $_SESSION[ $window ][ 'logon' ];
   $results[ '_users' ] = ga_db_output( ga_db_distinct( 'users', '', 'name', $query ) );
}

if ( isset( $_REQUEST[ 'datetime' ] ) )
{
   date_default_timezone_set("UTC");
   $results[ 'datetime' ] = date( "Y M d H:i:s T", time() );
}

if ( isset( $_REQUEST[ 'module' ] ) ) {
    $results[ 'module' ] = ga_db_output( ga_db_distinct( 'jobs', '', 'module', [ 'user' => $_SESSION[ $window ][ 'logon' ] ] ) );
}

if ( isset( $results[ 'project' ] ) ) {
   if ( !is_array( $results[ 'project' ] ) ) {
       $results[ 'project' ] = array();
   }
   if ( !in_array( "no_project_specified", $results[ 'project' ] ) )
   {
       $results[ 'project' ][] = "no_project_specified";
   }
   sort( $results['project'], SORT_NATURAL );
}

if ( isset( $results[ 'xsedeproject' ] ) ) {
   sort( $results['xsedeproject'], SORT_NATURAL );
}

function rgbtohex( $rgb ) {
    $colors = explode( ",", $rgb );
    return "#" . str_pad( dechex( ( $colors[ 0 ] * 256  + $colors[ 1 ] ) * 256 + $colors[ 2 ] ), 6, "0", STR_PAD_LEFT );
}

__~debug:basemylog{error_log( "syspull: request\n" . print_r( $_REQUEST, true ) . "\n", 3, "/tmp/mylog.syspull" );}
__~debug:basemylog{error_log( "syspull: results\n" . print_r( $results, true ) . "\n", 3, "/tmp/mylog.syspull" );}
echo (json_encode($results));
exit();

