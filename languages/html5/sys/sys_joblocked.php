<?php

session_start(); 
$window = "";
if ( isset( $_REQUEST[ '_window' ] ) )
{
   $window = $_REQUEST[ '_window' ];
}

$cachecheck = "";
if ( isset( $_REQUEST[ '_cache_module' ] ) )
{
   $cachecheck = $_REQUEST[ '_cache_module' ];
}

if ( isset( $_REQUEST[ '_jobweight' ] ) )
{
   $jobweight = $_REQUEST[ '_jobweight' ];
}

if ( !isset( $_SESSION[ $window ] ) )
{
   $_SESSION[ $window ] = array( "logon" => "", "project" => "" );
}

if ( !isset( $_SESSION[ $window ][ 'udpport' ] ) ||
     !isset( $_SESSION[ $window ][ 'udphost' ] ) || 
     !isset( $_SESSION[ $window ][ 'resources' ] ) ||
     !isset( $_SESSION[ $window ][ 'submitpolicy' ] ) )
{
   $appjson = json_decode( file_get_contents( "__appconfig__" ) );
   $_SESSION[ $window ][ 'udphost'         ] = $appjson->messaging->udphostip;
   $_SESSION[ $window ][ 'udpport'         ] = $appjson->messaging->udpport;
   $_SESSION[ $window ][ 'resources'       ] = $appjson->resources;
   $_SESSION[ $window ][ 'resourcedefault' ] = $appjson->resourcedefault;
   $_SESSION[ $window ][ 'submitpolicy'    ] = $appjson->submitpolicy;
}

$policy = $_SESSION[ $window ][ 'submitpolicy' ];

session_write_close();

if ( isset( $_REQUEST[ '_submitpolicy' ] ) )
{
   $policy = $_REQUEST[ '_submitpolicy' ];
}

if ( !isset( $_SESSION[ $window ][ 'logon' ] ) ||
     !strlen( $_SESSION[ $window ][ 'logon' ] ) )
{
  if ( $policy != "all" )
  {
     echo '2';
  } else {
     echo '0';
  }
  exit();
}

$GLOBALS[ 'logon' ] = $_SESSION[ $window ][ 'logon' ];

require_once "../joblog.php";

$GLOBALS[ 'project' ] = isset( $_SESSION[ $window ][ 'project' ] ) &&
                        strlen( $_SESSION[ $window ][ 'project' ] ) ? 
                        $_SESSION[ $window ][ 'project' ] : "no_project_specified";

$dir = "__docroot:html5__/__application__/results/users/" . $_SESSION[ $window ][ 'logon' ] . "/" . $GLOBALS[ 'project' ];

$locked = isprojectlocked( $dir );

if ( !empty( $cachecheck ) && cache_check( $cachecheck ) ) {
    __~debug:cache{error_log( "sys_joblocked cache_check for $cachecheck gave uuid " . $GLOBALS[ "cached_uuid" ] . "\n", 3, "/tmp/php_errors" );}
   echo $GLOBALS[ "cached_uuid" ];
   exit;
}

__~debug:lock{error_log( "project is " . $GLOBALS[ 'project' ] . " logon in " . $GLOBALS[ 'logon' ] . "\n", 3, "/tmp/mylog" );}

if ( $locked )
{
   echo '1';
} else {
    if ( isset( $jobweight ) && $jobweight ) {
        $totalweight = totalweight() + $jobweight;
        __~debug:jobweight{error_log( "jobweight active, so checking job limits, this job weighs $jobweight and total is $totalweight\n", 3, "/tmp/mylog" );}
        if ( !isset( $appjson ) ) {
            $appjson = json_decode( file_get_contents( "__appconfig__" ) );
        }
        if ( !isset( $appjson->joblimits ) ) {
            __~debug:jobweight{error_log( "jobweight active, but no joblimits in appconfig.json\n", 3, "/tmp/mylog" );}
            echo '0';
            exit();
        }
        $limit = isset( $appjson->joblimits->default ) 
            ? ( $appjson->joblimits->default == "unlimited" ? 
                9e99 
                : $appjson->joblimits->default )
            : 0;

        __~debug:jobweight{error_log( "jobweight active, default limit $limit\n", 3, "/tmp/mylog" );}
        if ( isset( $appjson->joblimits->users ) &&
             isset( $appjson->joblimits->users->{ $GLOBALS[ 'logon' ] } ) ) {
            $limit = $appjson->joblimits->users->{ $GLOBALS[ 'logon' ] } == "unlimited" 
                ? 9e99 
                : $appjson->joblimits->users->{ $GLOBALS[ 'logon' ] };
            __~debug:jobweight{error_log( "jobweight active, user specific limit $limit\n", 3, "/tmp/mylog" );}
        } else {
            if ( isset( $appjson->joblimits->restricted ) &&
                 isset( $appjson->restricted ) ) {
                __~debug:jobweight{error_log( "jobweight active, found restricted job weights\n", 3, "/tmp/mylog" );}
                foreach ( $appjson->restricted as $k => $v ) {
                    __~debug:jobweight{error_log( "jobweight active, found key restricted key $k\n", 3, "/tmp/mylog" );}
                    if ( in_array( $GLOBALS[ 'logon' ], $v ) ) {
                        __~debug:jobweight{error_log( "jobweight active, user " . $GLOBALS['logon'] . " is in restricted list for key $k\n", 3, "/tmp/mylog" );}
                        if ( array_key_exists( $k, $appjson->joblimits->restricted ) ) {
                            __~debug:jobweight{error_log( "jobweight active, user " . $GLOBALS['logon'] . " is in restricted list for key $k and joblimits are specified for this restricted key\n", 3, "/tmp/mylog" );}
                            $testlimit = 
                                $appjson->joblimits->restricted->{ $k } == "unlimited" 
                                ? 9e99
                                : $appjson->joblimits->restricted->{ $k };
                            __~debug:jobweight{error_log( "jobweight active, user " . $GLOBALS['logon'] . " is in restricted list for key $k and joblimits are specified for this restricted key, testlimit is $testlimit\n", 3, "/tmp/mylog" );}
                            if ( $limit < $testlimit ) {
                                __~debug:jobweight{error_log( "jobweight active, user " . $GLOBALS['logon'] . " is in restricted list for key $k and joblimits are specified for this restricted key, testlimit is $testlimit, and is greater than previous limit $limit, so setting it\n", 3, "/tmp/mylog" );}
                                $limit = $testlimit;
                            }
                        }
                    }
                }
            }
        }

        __~debug:jobweight{error_log( "jobweight active, final totalweight $totalweight, limit $limit\n", 3, "/tmp/mylog" );}
        if ( $totalweight > $limit ) {
            __~debug:jobweight{error_log( "jobweight active, rejecting job\n", 3, "/tmp/mylog" );}
            echo "Your job limit ($limit) would be exceeded by submitting this job.  Please wait until your other jobs finish or cancel them in the job manager";
            exit();
        }
    } else {
        __~debug:jobweight{error_log( "jobweight NOT active\n", 3, "/tmp/mylog" );}
    }
    echo '0';
}

exit();
?>
