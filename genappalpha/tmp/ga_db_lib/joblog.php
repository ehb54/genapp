<?php

require_once "__docroot:html5__/__application__/ajax/ga_db_lib.php";

function logjobstart( $error_json_exit = false, $cache = "" )
{
   global $ga_db_errors;

   if ( !ga_db_status( ga_db_open( $error_json_exit ) ) ) {
       return false;
   }

   $now = ga_db_output( ga_db_date() );

   $insert[ '_id'          ] = $_REQUEST[ '_uuid'    ];
   $insert[ 'menu'         ] = $GLOBALS[ 'menu'      ];
   $insert[ 'module'       ] = $GLOBALS[ 'module'    ];
   $insert[ 'project'      ] = $GLOBALS[ 'project'   ];
   $insert[ 'user'         ] = $GLOBALS[ 'logon'     ];
   $insert[ 'directory'    ] = $GLOBALS[ 'dir'       ];
   $insert[ 'directorylog' ] = $GLOBALS[ 'logdir'    ];
   $insert[ 'command'      ] = $GLOBALS[ 'command'   ];
   $insert[ 'resource'     ] = $GLOBALS[ 'resource'  ];
   $insert[ 'jobweight'    ] = $GLOBALS[ 'jobweight' ];
   if ( isset( $GLOBALS[ "numproc" ] ) ) {
       $insert[ 'numprocs'    ] = $GLOBALS[ 'numproc' ];
   }
   if ( isset( $GLOBALS[ "xsedeproject" ] ) ) {
       $insert[ 'xsedeproject'  ] = $GLOBALS[ 'xsedeproject' ];
   }
   $insert[ 'when'         ] = Array( $now );
   $insert[ 'start'        ] = $now;
   $insert[ 'status'       ] = Array( "started" );
   $insert[ 'remoteip'     ] = $GLOBALS[ 'REMOTE_ADDR' ];
   if ( !empty( $cache ) ) {
      $insert[ 'cache'     ] = $cache;
   }
   if ( isset( $GLOBALS[ 'modal' ] ) && $GLOBALS[ 'modal' ] ) {
       $insert[ 'modal' ] = true;
   }
   if ( isset( $GLOBALS[ 'notify' ] ) && $GLOBALS[ 'notify' ] ) {
       $insert[ 'notify' ] = $GLOBALS[ 'notify' ];
   }
   
   if ( !ga_db_status(
             ga_db_insert(
                 'jobs', 
                 '', 
                 $insert, 
                 [], 
                 $error_json_exit ) 
        )
       ) {
      if ( $error_json_exit )
      {
         $results[ 'error' ] = $ga_db_errors;
         $results[ '_status' ] = 'complete';
         echo (json_encode($results));
         exit();
      }
      return false;
   }
   return true;
}   

function logjobupdate( $status, $log_end = false, $error_json_exit = false, $uuid = false )
{
   global $ga_db_errors;

   $GLOBALS['wascancelled'] = false;

   if ( !ga_db_status( ga_db_open( $error_json_exit ) ) ) {
       return false;
   }

   $now = ga_db_output( ga_db_date() );
   $uuid = $uuid ? $uuid : $_REQUEST[ '_uuid' ];
   __~debug:cancel{error_log( "joblogupdate( $status,.. ) uuid: $uuid\n", 3, "/tmp/mylog" );}

   $update[ '$push' ][ 'when'    ] = $now;
   $update[ '$push' ][ 'status'  ] = $status;
   if ( $log_end )
   {
       $update[ '$set' ][ 'end' ] = $now;
       if ( $doc = ga_db_output(
                ga_db_findOne( 
                    'jobs',
                    '',
                    [ '_id' => $uuid ],
                    [], 
                    $error_json_exit 
                ) 
            ) 
           ) {
           if ( in_array( "cancelled", $doc[ 'status' ] ) ) {
               __~debug:cancel{error_log( "joblogupdate( $status,.. ) skipping end since cancelled uuid: $uuid\n", 3, "/tmp/mylog" );}
               $GLOBALS['wascancelled'] = true;
               return true;
           }
           $update[ '$set' ][ 'duration' ] = ga_db_date_secs_diff( $now, $doc[ 'start' ] );
       }
   }
   __~debug:cancel{error_log( "joblogupdate( $status,.. ) uuid: $uuid\n", 3, "/tmp/mylog" );}

   if ( !ga_db_status( 
             ga_db_update(
                 'jobs', 
                 '', 
                 [ '_id' => $uuid ], 
                 $update, 
                 [], 
                 $error_json_exit
             ) 
        ) 
       ) {
      if ( $error_json_exit )
      {
         $results[ 'error' ] = $ga_db_errors;
         $results[ '_status' ] = 'complete';
         echo (json_encode($results));
         exit();
      }
      return false;
   }
   return true;
}

function logcache( $uuid, $error_json_exit = false ) {
    __~debug:cache{error_log( "joblog logcache " . $GLOBALS[ 'cache' ] . " module is " . $GLOBALS[ 'module' ] . " job id is " . $uuid .  "\n", 3, "/tmp/php_errors" );}
    global $ga_db_errors;

    if ( !ga_db_status( ga_db_open( $error_json_exit ) ) ) {
        return false;
    }      

    $now = ga_db_output( ga_db_date() );
    
    $key = $GLOBALS[ 'module' ] . "/" . $GLOBALS[ "getmenumoduleproject" ] . "/" . ( $GLOBALS[ 'cache' ] == "public" ? "_public" : $GLOBALS[ 'logon' ] );

    $update[ '_id'          ] = $key;
    $update[ 'jobid'        ] = $uuid;
    $update[ 'module'       ] = $GLOBALS[ 'module' ];
    $update[ 'menu'         ] = $GLOBALS[ 'menu' ];
    $update[ 'project'      ] = $GLOBALS[ "getmenumoduleproject" ];

    if ( !ga_db_status( 
              ga_db_update( 
                  'cache',
                  '',
                  [ '_id' => $key ],
                  $update,
                  [ "upsert" => true ],
                  $error_json_exit 
              ) 
         ) 
        ) {
      if ( $error_json_exit )
      {
         $results[ 'error' ] = $ga_db_errors;
         $results[ '_status' ] = 'complete';
         echo (json_encode($results));
         exit();
      }
      return false;
   }
   return true;
}

function cache_check( $key, $error_json_exit = false ) {
    __~debug:cache{error_log( "joblog cache_check key $key\n", 3, "/tmp/php_errors" );}

    if ( !ga_db_status( ga_db_open( $error_json_exit ) ) ) {
        return false;
    }      

    if ( $doc = 
         ga_db_output( 
             ga_db_findOne(
                 'cache',
                 '',
                 [ '_id' => "$key/_public" ],
                 [],
                 $error_json_exit
             ) 
         )
        ) {
        __~debug:cache{error_log( "joblog cache_check found uuid " . $doc[ 'jobid' ] . "\n", 3, "/tmp/php_errors" );}
        $GLOBALS[ "cached_uuid" ] = $doc[ "jobid" ];
        return true;
    } 
    if ( $doc = 
         ga_db_output(
             ga_db_findOne(
                 'cache',
                 '',
                 [ "_id" => "$key/" . $GLOBALS[ 'logon' ] ],
                 [],
                 $error_json_exit
             )
         )
        ) {
        __~debug:cache{error_log( "joblog cache_check found uuid " . $doc[ 'jobid' ] . "\n", 3, "/tmp/php_errors" );}
        $GLOBALS[ "cached_uuid" ] = $doc[ "jobid" ];
        return true;
    } 
    return false;
}

function jqgrid_jobs( $error_json_exit = false, $user = NULL )
{
   if ( !ga_db_status( ga_db_open( $error_json_exit ) ) ) {
       return false;
   }      

   if ( $GLOBALS[ 'jqgrid_jobs' ] = 
        ga_db_output( 
            ga_db_find( 
                'jobs',
                '',
                [ "user" => is_null( $user ) ? $GLOBALS[ 'logon' ] : $user, "deleted" => [ '$exists' => false ] ],
                [],
                $error_json_exit
            ) 
        ) 
       ) {
       return true;
   }
   return false;
}

function isprojectlocked( $checkproject,  $error_json_exit = false )
{
   if ( !ga_db_status( ga_db_open( $error_json_exit ) ) ) {
       return false;
   }      

   if ( $doc = ga_db_output(
            ga_db_findOne(
                'joblock',
                '',
                [ 'name' => $checkproject ],
                [],
                $error_json_exit
            ) 
        )
       ) {
       return true;
   }
   return false;
}

function getprojectdir( $jobid,  $error_json_exit = false )
{
   if ( !ga_db_status( ga_db_open( $error_json_exit ) ) ) {
       return false;
   }      

   if ( $doc = ga_db_output( 
            ga_db_findOne(
                'jobs',
                '',
                [ "_id" => $jobid, "user" => $GLOBALS[ 'logon' ] ],
                [],
                $error_json_exit 
            ) 
        ) 
       ) {
      if ( isset( $doc[ 'directory' ] ) )
      {
         $GLOBALS[ "getprojectdir" ] = $doc[ 'directory' ];
         $GLOBALS[ "getprojectlogdir" ] = isset( $doc[ 'directorylog' ] ) ? $doc[ 'directorylog' ] : $doc[ 'directory' ];
         return true;
      }
      return false;
   }
   return false;
}

function getmenumodule( $jobid,  $error_json_exit = false )
{
   if ( !ga_db_status( ga_db_open( $error_json_exit ) ) ) {
       return false;
   }      

   // reset user to check if cached module & has permissions ?

   // if ( $doc = ga_db_output( ga_db_findOne( 'jobs', '', [ "_id" => $jobid, "user" => $GLOBALS[ 'logon' ] ], [], $error_json_exit ) ) ) {
   if ( $doc = ga_db_output(
            ga_db_findOne(
                'jobs',
                '',
                [ "_id" => $jobid ],
                [],
                $error_json_exit
            )
        )
       ) {
      if ( isset( $doc[ 'menu' ] ) && isset( $doc[ 'module' ] ) )
      {
         $GLOBALS[ "getmenumodule"        ] = $doc[ 'menu' ] . "/" . $doc[ 'module' ];
         $GLOBALS[ "getmenumoduleproject" ] = ( isset( $doc[ 'project'      ] ) && strlen( $doc[ 'project'       ] ) ) ? $doc[ 'project' ] : 'no_project_specified';
         $GLOBALS[ "getmenumoduledir"     ] = ( isset( $doc[ 'directory'    ] ) && strlen( $doc[ 'directory'     ] ) ) ? $doc[ 'directory' ] : '_no_project_dir_';
         $GLOBALS[ "getmenumodulelogdir"  ] = ( isset( $doc[ 'directorylog' ] ) && strlen( $doc[ 'directorylog'  ] ) ) ? $doc[ 'directorylog' ] : $GLOBALS[ "getmenumoduledir" ];
         $GLOBALS[ "getmenumodulestatus"  ] = ( isset( $doc[ 'status'       ] ) && count ( $doc[ 'status'        ] ) ) ? end($doc[ 'status' ] ) : '';
         $GLOBALS[ "wascancelled"         ] = $GLOBALS[ "getmenumodulestatus"  ] == "cancelled";
         $GLOBALS[ "cache"                ] =  isset( $doc[ 'cache' ] ) ? $doc[ 'cache' ] : "";
         $GLOBALS[ "module"               ] = $doc[ 'module' ];
         $GLOBALS[ "menu"                 ] = $doc[ 'menu' ];
         $GLOBALS[ "jobweight"            ] = isset( $doc[ 'jobweight' ] ) ? $doc[ 'jobweight' ] : 0;
         $GLOBALS[ "jobstart"             ] = $doc[ 'start' ];
         if ( isset( $doc[ 'notify' ] ) ) {
             $GLOBALS[ "notify"    ] = $doc[ 'notify' ];
         }
         if ( ( isset( $doc[ 'user' ] ) && $doc[ 'user' ] == $GLOBALS[ 'logon' ] ) ||
              $GLOBALS[ "cache" ] == "public"  ) {
             return true;
         } else {
             $appjson = json_decode( file_get_contents( "__appconfig__" ) );
             if ( !isset( $appjson->restricted ) ||
                  !isset( $appjson->restricted->admin ) ||
                  !in_array( $GLOBALS[ 'logon' ], $appjson->restricted->admin ) ) {
                 return false;
             }    
             return true;
         }
      }
      return false;
   }
   return false;
}

function clearprojectlock( $projectdir,  $error_json_exit = false )
{
   global $ga_db_errors;

   $GLOBALS[ 'lasterror' ] = "";
   $GLOBALS[ 'lastnotice' ] = "";

   $dk = end( explode( "/", $projectdir ) );
   if ( !isprojectlocked( $projectdir, $error_json_exit ) )
   {
      $GLOBALS[ 'lastnotice' ] = "Project '$dk' is not locked. ";
      return false;
   }

   if ( !ga_db_status(
             ga_db_remove(
                 'joblock',
                 '',
                 [ "name" => $projectdir ],
                 [ 'justOne' => true ],
                 $error_json_exit
             ) 
        )
       ) {
       if ( isprojectlocked( $projectdir, $error_json_exit ) )
       {
           $GLOBALS[ 'lasterror' ] = "Could not remove lock on project '$dk'. " . $ga_db_errors;
       } else {
           $GLOBALS[ 'lastnotice' ] = "Project '$dk' is no longer locked. " . $ga_db_errors;
           return true;
       }
   }
   return true;
}

function removejob( $jobid, $error_json_exit = false )
{
    global $ga_db_errors;

    $GLOBALS[ 'lasterror' ] = "";

    if ( !ga_db_status( ga_db_open( $error_json_exit ) ) ) {
        $GLOBALS[ 'lasterror' ] = $ga_db_errors;
        return false;
    }

    $now = ga_db_output( ga_db_date() );

    $update[ '$set' ][ 'deleted'    ] = true;
    if ( !ga_db_status(
              ga_db_update(
                  'jobs',
                  '',
                  [ '_id' => $jobid ],
                  $update,
                  [],
                  $error_json_exit
              )
         )
        ) {
        if ( $error_json_exit )
        {
            $results[ 'error' ] = $ga_db_errors;
            $results[ '_status' ] = 'complete';
            echo (json_encode($results));
            exit();
        }
        return false;
    }

    if ( null !== 
         ga_db_output(
             ga_db_findOne(
                 'cache',
                 '',
                 [ 'jobid' => $jobid ],
                 [],
                 $error_json_exit
             )
         )
        ) {
        if ( !ga_db_status(
                  ga_db_remove(
                      'cache',
                      '',
                      [ "jobid" => $jobid ],
                      [],
                      $error_json_exit
                  )
             )
            ) {
            if ( $error_json_exit )
            {
                $results[ 'error' ] = $ga_db_errors;
                $results[ '_status' ] = 'complete';
                echo (json_encode($results));
                exit();
            }
            return false;
        }
    }
    return true;
}

function cached_msg( $jobid,  $error_json_exit = false )
{
   global $ga_db_errors;

   $GLOBALS[ 'lasterror' ] = "";
   $GLOBALS[ 'cached_msg' ] = "";

   if ( !ga_db_status( ga_db_open( $error_json_exit ) ) ) {
      $GLOBALS[ 'lasterror' ] = $ga_db_errors;
      return false;
   }

   if ( $doc = 
        ga_db_output(
            ga_db_findOne(
                'cache',
                'msgs',
                [ '_id' => $jobid ],
                [],
                $error_json_exit
            )
        )
       ) {
       $GLOBALS[ 'cached_msg' ] = $doc[ 'data' ];
       return true;
   } else {
       return false;
   }
}   

function cached_progress( $jobid,  $error_json_exit = false )
{
   global $ga_db_errors;

   $GLOBALS[ 'lasterror' ] = "";
   $GLOBALS[ 'cached_progress' ] = "";

   if ( !ga_db_status( ga_db_open( $error_json_exit ) ) ) {
      $GLOBALS[ 'lasterror' ] = $ga_db_errors;
      return false;
   }

   if ( $doc =
        ga_db_output(
            ga_db_findOne(
                'cache',
                'msgs',
                [ '_id' => $jobid ],
                [],
                $error_json_exit
            )
        )
       ) {
      $json = json_decode( $doc[ 'data' ], true );
      if ( isset( $json[ '_progress' ] ) )
      {
         $GLOBALS[ 'cached_progress' ] = $json[ '_progress' ];
         return true;
      }
   }
   return false;
}

// take an array of files and extract the project directories
function get_projects( $files, $error_json_exit = false )
{
    $uniq = array_flip( preg_replace( '/\/.*/', '', $files ) );
    $base = $GLOBALS[ 'dir' ] . $GLOBALS[ 'logon' ] . "/";
    $result = array();
    foreach ( $uniq as $k => $v )
    {
        $result[] = $base . $k;
    }
    return $result;   
}

function get_projects_locked( $files, $error_json_exit = false )
{
    $uniq = array_flip( preg_replace( '/\/.*/', '', $files ) );
    $base = $GLOBALS[ 'dir' ] . $GLOBALS[ 'logon' ] . "/";
    $result = array();
    foreach ( $uniq as $k => $v )
    {
        $projdir = $base . $k;
        if ( isprojectlocked( $projdir, $error_json_exit ) )
        {
            $result[] = $k;
        }
    }
    return $result;
}

function totalweight( $error_json_exit = false ) {
    global $ga_db_errors;
    __~debug:jobweight{error_log( "totalweight() called:\n", 3, "/tmp/mylog" );}

    if ( !isset( $GLOBALS[ 'logon' ] ) ) {
        return 0;
    }

    $GLOBALS[ 'lasterror' ] = "";

    if ( !ga_db_status( ga_db_open( $error_json_exit ) ) ) {
        $GLOBALS[ 'lasterror' ] = $ga_db_errors;
        return false;
    }

    if ( $doc =
         ga_db_output(
             ga_db_command(
                 '',
                 [
                  'aggregate' => 'joblock',
                  'pipeline' =>
                  [ [ '$match' =>  [ 'user' => $GLOBALS[ 'logon' ] ] ], [ '$group' => [ '_id' =>  '', 'totalweight' => [ '$sum' => '$jobweight' ] ] ], [ '$project' => [ '_id' => 0, 'totalweight' => '$totalweight' ] ] ]
                 ],
                 [], 
                 $error_json_exit
             )
         )
        ) {
        __~debug:jobweight{error_log( "totalweight() returns:\n" . json_encode( $doc, JSON_PRETTY_PRINT ), 3, "/tmp/mylog" );}
        if ( isset( $doc[ 'result' ] ) &&
             isset( $doc[ 'result' ][ 0 ] ) &&
             isset( $doc[ 'result' ][ 0 ][ 'totalweight' ] ) ) {
            return $doc[ 'result' ][ 0 ][ 'totalweight' ];
        }
    }

    return 0;
}

function logrunning( $error_json_exit = false ) {
    global $ga_db_errors;

    $GLOBALS[ 'lasterror' ] = "";

    if ( !ga_db_status( ga_db_open( $error_json_exit ) ) ) {
        $GLOBALS[ 'lasterror' ] = $ga_db_errors;
        return false;
    }

    if ( !( $doc = 
            ga_db_output(
                ga_db_findOne(
                    'apps',
                    'global',
                    [ '_id' => "__application__" ],
                    [],
                    $error_json_exit 
                ) 
            )
         )
        ) {
        if ( !ga_db_status(
                  ga_db_insert(
                      'apps',
                      'global',
                      [ '_id' => "__application__" ],
                      [],
                      $error_json_exit
                  )
             )
            ) {
            if ( $error_json_exit )
            {
                $results[ 'error' ] .= $ga_db_errors;
                $results[ '_status' ] = 'complete';
                echo (json_encode($results));
                exit();
            }
            return false;
        }
    }

    $set_array = [ '$push' => [ "pid" => [ "where" => "local", "pid" => getmypid(), "what" => "parent" ] ] ];

    if ( __~xsedeproject{1}0 && 
         $doc = ga_db_output(
             ga_db_findOne(
                 'jobs',
                 '',
                 [ "_id" => $_REQUEST[ '_uuid' ], "user" => $GLOBALS[ 'logon' ] ],
                 [ 'xsedeproject' => 1 ],
                 $error_json_exit
             )
         )
        ) {
        $set_array[ '$set' ] = array( "xsedeproject" =>  $doc[ 'xsedeproject' ] );
    }

    if ( !ga_db_status(
              ga_db_update(
                  'running',
                  '', 
                  [ '_id' => $_REQUEST[ '_uuid' ], "user" => $GLOBALS[ 'logon' ] ],
                  $set_array,
                  [ "upsert" => true ],
                  $error_json_exit
              )
         )
        ) {
        $GLOBALS[ 'lasterror' ]  = "Error updating. " . $ga_db_errors;
        return false;
    }

    return true;
}

function logrunningresource( $uuid, $resource, $nodes, $nodesppn, $error_json_exit = false ) {
    global $ga_db_errors;

    $GLOBALS[ 'lasterror' ] = "";

    if ( !ga_db_status( ga_db_open( $error_json_exit ) ) ) {
        $GLOBALS[ 'lasterror' ] = $ga_db_errors;
        return false;
    }

    if ( __~xsedeproject{1}0 && 
         $doc = ga_db_output(
             ga_db_findOne(
                 'jobs',
                 '',
                 [ "_id" => $uuid ],
                 [ 'xsedeproject' => 1 ],
                 $error_json_exit
             )
         )
        ) {

         $update = [];
         $update[ "_id" ] = "__application__:$resource:" . $doc[ 'xsedeproject' ];

         if ( !ga_db_status( 
                   ga_db_update(
                       'appresourceproject', 
                       'global', 
                       $update, 
                       $update, 
                       [ "upsert" => true ], 
                       $error_json_exit
                   ) 
              )
             ) {
             $GLOBALS[ 'lasterror' ]  = "Error updating. " . $ga_db_errors;
             return false;
         }
    }

    if ( !ga_db_status( 
              ga_db_update(
                  'running', 
                  '', 
                  [ "_id" => $uuid ],
                  [ '$set' => [ "resource" => $resource
                                ,"nodes"   => intval( $nodes )
                                ,"nodeppn" => intval( $nodesppn ) ] ],
                  [ "upsert" => true ], 
                  $error_json_exit
                  
              )
         )
        ) {
        $GLOBALS[ 'lasterror' ]  = "Error updating. " . $ga_db_errors;
        return false;
    }

    if ( !ga_db_status( 
              ga_db_update(
                  'jobs', 
                  '',
                  [ "_id" => $uuid ],
                  [ '$set' => [ "numprocs" => intval( $nodes * $nodesppn )
                                ,"nodes"   => intval( $nodes )
                                ,"nodeppn" => intval( $nodesppn ) ] ],
                  [ "upsert" => true ], 
                  $error_json_exit
              )
         )
        ) {
        $GLOBALS[ 'lasterror' ]  = "Error updating. " . $ga_db_errors;
        return false;
    }

    return true;
}

function logstoprunning( $error_json_exit = false, $uuid = false ) {
    global $ga_db_errors;

    $GLOBALS[ 'lasterror' ] = "";

    if ( !ga_db_status( ga_db_open( $error_json_exit ) ) ) {
        $GLOBALS[ 'lasterror' ] = $ga_db_errors;
        return false;
    }

   if ( !ga_db_status(
             ga_db_remove(
                 'running',
                 '',
                 [ "_id" => $uuid ? $uuid : $_REQUEST[ '_uuid' ] ],
                 [ "justOne" => true  ],
                 $error_json_exit 
             )
        )
       ) {
        $GLOBALS[ 'lasterror' ]  = "Error updating. " . $ga_db_errors;
        return false;
    }

    return true;
}

function jobcancel( $jobs, $error_json_exit = false, $is_admin = false ) {
    __~debug:cancel{error_log( "jobcancel() called with jobs of " . print_r( $jobs, true ), 3, "/tmp/mylog" );}

    $GLOBALS[ 'lasterror' ] = "";
    $GLOBALS[ 'lastnotice' ] = "";

    global $ga_db_errors;

    $appconfig = "__appconfig__";
    $appjsona = json_decode( file_get_contents( $appconfig ), true );
    if ( !isset( $appjsona[ 'resources' ] ) ) {
        $GLOBALS[ 'lasterror' ] = "Internal error: could not find resource configuration information in appconfig.json";
        require_once "mail.php";
        error_mail( "[joblog.php jobcancel()] " . $GLOBALS[ 'lasterror' ] );
        return false;
    }
        
    if ( !ga_db_status( ga_db_open( $error_json_exit ) ) ) {
        $GLOBALS[ 'lasterror' ] = $ga_db_errors;
        return false;
    }

    $context = new ZMQContext();
    $zmq_socket = $context->getSocket(ZMQ::SOCKET_PUSH, '__application__ udp pusher');
    $zmq_socket->connect("tcp://" . $appjsona['messaging']['zmqhostip'] . ":" . $appjsona['messaging']['zmqport'] );

    // $udp_socket = socket_create(AF_INET, SOCK_DGRAM, SOL_UDP);

    $runs =
        ga_db_output( 
            ga_db_find( 
                'running',
                '',
                [ "_id" => [ '$in' => $jobs ] ],
                [],
                $error_json_exit
            )
        );

    $fjobs = array_flip( $jobs );
    $projectdirs  = array();
    $tokillparent = array();
    $tokill       = array();
    $kjobs        = array();

    foreach ( $runs as $v ) {
       $uuid = $v['_id'];
       $job = 
           ga_db_output( 
               ga_db_findOne(
                   'jobs',
                   '',
                   [ "_id" => $uuid ],
                   [],
                   $error_json_exit 
               )
           );
       $pids = $v['pid'];
       if ( isset( $v['xsedeproject'] ) ) {
           $xsedeproject = $v['xsedeproject'];
       } else {
           unset( $xsedeproject );
       }

       foreach ( $pids as $k2 => $v2 ) {
           if ( $v2['pid'] < 2 ) {
               require_once "mail.php";
               error_mail( "[joblog.php jobcancel()] invalid pid for kill! " . $v2[ 'pid' ] );
           } else {
               $where = $v2['where'];
               if ( $v2['what'] == "parent" ) {
                   if ( !isset( $tokillparent[ $where ] ) ) {
                       $tokillparent[ $where ] = array( $v2[ 'pid' ] );
                   } else {
                       $tokillparent[ $where ][] = $v2[ 'pid' ];
                   }
               } else {
                   if ( !isset( $tokill[ $where ] ) ) {
                       $tokill[ $where ] = array( $v2[ 'pid' ] );
                   } else {
                       $tokill[ $where ][] = $v2[ 'pid' ];
                   }
               }
           }
       }
       unset( $fjobs[ $uuid ] );
       $kjobs[ $uuid ] = true;
       // send messages also if running about "cancelled"
       // also manually clear job locks and push update to jobs as in jobrun.php

       if ( !logjobupdate( "cancelled", true, $error_json_exit, $uuid ) ) {
           __~debug:cancel{error_log( "jobcancel() $uuid logjobupdate error $ga_db_errors\n", 3, "/tmp/mylog" );}
       }
       logstoprunning( false, $uuid );

       $specmsg = false;

       $cancel_notice = "This job has been cancelled by " . ( $is_admin ? "administrator" : "user" ) . " request";

       if ( isset( $v[ 'resource' ] ) ) {
           if ( $v[ 'resource' ] == "openstack" &&
                isset( $v[ 'nodes' ] ) ) {
               require_once "__docroot:html5__/__application__/openstack/os_delete.php";
               os_delete( $v[ 'nodes' ], $uuid, isset( $xsedeproject ) ? $xsedeproject : $project, true );
               $specmsg = true;
               $zmq_socket->send( json_encode( array( "_uuid" => $uuid,
                                                      "Notice" => $cancel_notice,
                                                      "_cancel" => "true",
                                                      "_status" => "cancelled",
                                                      "_airavata" => ""
                                               ) ) );

           }
       }

       if ( !$specmsg ) {
           $zmq_socket->send( json_encode( array( "_uuid" => $uuid,
                                                  "Notice" => $cancel_notice,
                                                  "_cancel" => "true",
                                                  "_status" => "cancelled" ) ) );
       }

       // $jsonmsg = json_encode( array( "_uuid" => $uuid,
       //                               "Notice" => $cancel_notice,
       //                               "_status" => "cancelled" ) );
       
       // socket_sendto( $udp_socket, $jsonmsg, strlen( $jsonmsg ), 0, $appjsona['messaging'][ 'udphostip' ], $appjsona['messaging']['udpport'] );

       if ( getprojectdir( $uuid ) ) {
           $projectdirs[ $GLOBALS[ 'getprojectdir' ] ] = true;
       }
    }

    foreach ( $tokill as $k => $v ) {
        if ( !isset( $appjsona[ 'resources' ][ $k ] ) ) {
            $GLOBALS[ 'lasterror' ] .= "Resource $k missing from resource configuration information in appconfig.json";
            require_once "mail.php";
            error_mail( "[joblog.php jobcancel()] " . $GLOBALS[ 'lasterror' ] );
        } else {
            $kill = $appjsona[ 'resources' ][ $k ] . " __docroot:html5__/__application__/util/ga_killprocs.pl __docroot:html5__/__application__/log $k all " . implode( ' ', $v );
            __~debug:cancel{error_log( "jobcancel() $ " . $kill . " 2>&1\n", 3, "/tmp/mylog" );}
            ob_start();
            exec( $kill, $execout );
            __~debug:cancel{error_log( "jobcancel() kill output: " . implode( "\n", $execout ) . "\n", 3, "/tmp/mylog" );}
            ob_end_clean();
        }
    }   

    foreach ( $tokillparent as $k => $v ) {
        if ( !isset( $appjsona[ 'resources' ][ $k ] ) ) {
            $GLOBALS[ 'lasterror' ] .= "Resource $k missing from resource configuration information in appconfig.json";
            require_once "mail.php";
            error_mail( "[joblog.php jobcancel()] " . $GLOBALS[ 'lasterror' ] );
        } else {
            $kill = $appjsona[ 'resources' ][ $k ] . " __docroot:html5__/__application__/util/ga_killprocs.pl __docroot:html5__/__application__/log $k child " . implode( ' ', $v );
            __~debug:cancel{error_log( "jobcancel() $ " . $kill . " 2>&1\n", 3, "/tmp/mylog" );}
            ob_start();
            exec( $kill, $execout );
            __~debug:cancel{error_log( "jobcancel() kill children output: " . implode( "\n", $execout ) . "\n", 3, "/tmp/mylog" );}
            ob_end_clean();
        }
    }   

    // cancel anyway
    foreach ( $fjobs as $k => $v ) {
        $uuid = $k;
        __~debug:cancel{error_log( "jobcancel() try for $uuid\n", 3, "/tmp/mylog" );}
        if ( !logjobupdate( "cancelled", true, $error_json_exit, $uuid ) ) {
            __~debug:cancel{error_log( "jobcancel() $uuid logjobupdate error $ga_db_errors\n", 3, "/tmp/mylog" );}
        }
    }

    foreach ( $projectdirs as $k => $v ) {
        clearprojectlock( $k );
    }

    $msgs = count( $kjobs ) ? ( "Job id" . ( count( $kjobs ) > 1 ? "s " : " " ) . implode( ",", array_keys( $kjobs ) ) . " cancelled." ) : "";
    $msgs .= count( $fjobs ) ? ( "\nNotice; Job id" . ( count( $fjobs ) > 1 ? "s " : " " ) . implode( ",", array_keys( $fjobs ) ) . " not identified as running, but cancelled anyway." ) : "";

    $GLOBALS[ 'lastnotice' ] = $msgs;
    return true;
}
