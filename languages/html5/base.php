<?php
header('Content-type: application/json');
# setup php session
__~debug:basemylog{error_log( "startup __application__ __menu:id__ __menu:modules:id__\n", 3, "/tmp/mylog" );}
session_start();
if (!isset($_SESSION['count'])) {
  $_SESSION['count'] = 0;
} else {
  $_SESSION['count']++;
}

if ( !sizeof( $_REQUEST ) )
{
    session_write_close();
    require_once "../mail.php";
    $msg = "[PHP code received no \$_REQUEST] Possibly total upload file size exceeded limit.\nLimit is currently set to " . ini_get( 'post_max_size' ) . ".\n";
    error_mail( $msg . "Error occured in __menu:id__ __menu:modules:id__.\n" );
    $results = array("error" => $msg . "Please contact the administrators via feedback if you feel this is in error or if you have need to process total file sizes greater than this limit.\n" );
    $results[ '_status' ] = 'failed';
    echo (json_encode($results));
    exit();
}

$do_logoff = 0;

require_once "__docroot:html5__/__application__/ajax/ga_filter.php";
require_once "__docroot:html5__/__application__/ajax/getports.php";
$modjson = json_decode( '__modulejson__' );
$inputs_req = $_REQUEST;
$validation_inputs = ga_sanitize_validate( $modjson, $inputs_req, '__menu:modules:id__' );

if ( $validation_inputs[ "output" ] == "failed" ) {
    $results = array( "error" => $validation_inputs[ "error" ] );
#    $results[ '_status' ] = 'failed';
#    echo ( json_encode( $results ) );
#    exit();
};

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

$cmd = isset( $_REQUEST[ '_docrootexecutable' ] ) ? "__docroot:html5__/__application__/" . $_REQUEST[ '_docrootexecutable' ] : "__executable_path:html5__/__executable__";
if ( !is_executable( $cmd ) )
{
    $results[ "error" ] = "command not found or not executable $cmd";
    $results[ '_status' ] = 'failed';
    echo (json_encode($results));
    exit();
}

require_once "../joblog.php";

if ( isset( $_REQUEST[ "numproc" ] ) ) {
   $GLOBALS[ 'numproc' ] = $_REQUEST[ "numproc" ];
}
if ( isset( $_REQUEST[ "_xsedeproject" ] ) ) {
   $GLOBALS[ 'xsedeproject' ] = $_REQUEST[ "_xsedeproject" ];
}

$GLOBALS[ 'module'    ] = "__menu:modules:id__";
$GLOBALS[ 'jobweight' ] = floatval( "__jobweight__" );
$GLOBALS[ 'menu'      ] = "__menu:id__";
$GLOBALS[ 'logon'     ] = isset( $_SESSION[ $window ][ 'logon' ] ) ? $_SESSION[ $window ][ 'logon' ] : 'not logged in';
$GLOBALS[ 'project'   ] = isset( $_REQUEST[ '_project' ] ) ? $_REQUEST[ '_project' ] : 'not in a project';
$GLOBALS[ 'command'   ] = $cmd;
$GLOBALS[ 'REMOTE_ADDR' ] = isset( $_SERVER[ 'REMOTE_ADDR' ] ) ? $_SERVER[ 'REMOTE_ADDR' ] : "not from an ip";

// if user based, use alternate directory structure
__~uniquedir{$uniquedir = "__uniquedir__";}

__~nojobcontrol{$nojobcontrol = 1;$GLOBALS[ 'modal' ] = true;}
__~notify{$GLOBALS[ 'notify' ] = "__notify__";}
$bdir = "";

$adir = "__docroot:html5__/__application__";

if ( !isset( $uniquedir ) &&
     isset( $_SESSION[ $window ][ 'logon' ] ) &&
     strlen( $_SESSION[ $window ][ 'logon' ] ) > 1 )
{
   $dir = "__docroot:html5__/__application__/results/users/" . $_SESSION[ $window ][ 'logon' ] . "/";
   $bdir = $dir;
   if ( isset( $_REQUEST[ '_project' ] ) &&
        strlen( $_REQUEST[ '_project' ] ) > 1 )
   {
      $dir .= $_REQUEST[ '_project' ];
   } else {
      $dir .= 'no_project_specified';
   }
   $checkrunning     = $dir;
// connect
   if ( !isset( $nojobcontrol ) )
   {
      ga_db_open( true );
      if ( $doc = 
           ga_db_output(
               ga_db_findOne(
                   'joblock',
                   '',
                   [ 'name' => $checkrunning ]
               )
           )
          ) {
          $results[ 'error' ] = "A job is already running in this project, please wait until it completes or change projects";
          $results[ '_status' ] = 'failed';
          echo (json_encode($results));
          exit();
      }
      if ( !ga_db_status(
                ga_db_insert(
                    'joblock',
                    '',
                    [ "name" => $checkrunning,
                      "jobweight" => $GLOBALS[ 'jobweight' ],
                      "user" => $GLOBALS[ 'logon' ] ]
                )
           )
          ) {
          $results[ 'error' ] = "A job is already running in this project, please wait until it completes or change projects. " . $ga_db_errors;
          $results[ '_status' ] = 'failed';
          echo (json_encode($results));
          exit();
      }
   }
} else {
   do {
       $dir = uniqid( "__docroot:html5__/__application__/results/" );
   } while( file_exists( $dir ) );
}
$GLOBALS[ 'dir' ] = $dir;

$logdir = "$dir__~logdirectory{/__logdirectory__}";
$GLOBALS[ 'logdir' ] = $logdir; 

if ( !file_exists( $dir ) )
{
   ob_start();

   if ( !mkdir( $dir, 0777, true ) )
   {  
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
      $results[ "error" ] .= "Could not create directory " . $dir . " " . $cont;
      $results[ '_status' ] = 'failed';
      echo (json_encode($results));
      exit();
   }
   chmod( $dir, 0775 );
   ob_end_clean();
   $results[ "_fs_clear" ] = "#";
}

if ( !file_exists( $logdir ) )
{
   ob_start();

   if ( !mkdir( $logdir, 0777, true ) )
   {  
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
      $results[ "error" ] .= "Could not create directory " . $logdir . " " . $cont;
      $results[ '_status' ] = 'failed';
      echo (json_encode($results));
      exit();
   }
   chmod( $logdir, 0775 );
   ob_end_clean();
   $results[ "_fs_clear" ] = "#";
}

$_REQUEST[ '_base_directory' ] = $dir;
$_REQUEST[ '_log_directory' ] = $logdir;
$getports = ga_getports( $modjson, $_REQUEST[ '_uuid' ] );
if ( $getports->{'status'} == "success" &&
     isset( $getports->{'_ports'} ) ) {
    $_REQUEST[ '_ports' ] = $getports->{'_ports'};
} else {
    $results[ "error" ] .= "No ports available for streaming services";
    $results[ '_status' ] = 'failed';
    echo (json_encode($results));
    exit();
}    

$app_json = json_decode( file_get_contents( "__appconfig__" ) );

if ( $app_json == NULL ) {
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
    $results[ "_message" ] = [ "icon" => "toast.png",
                               "text" => "<p>There appears to be an error with the appconfig.json file.</p>"
                               . "<p>This is a serious error which should be forwarded to the site administrator.</p>" 
                               . "<p>Do not expect much to work properly until this is fixed.</p>" 
        ];
    $results[ "error" ] .= "appconfig.json is invalid";
    $results[ '_status' ] = 'failed';
    echo (json_encode($results));
    exit();
}   

$_SESSION[ $window ][ 'udphost'         ] = $app_json->messaging->udphostip;
$_SESSION[ $window ][ 'udpport'         ] = $app_json->messaging->udpport;
$_SESSION[ $window ][ 'resources'       ] = $app_json->resources;
$_SESSION[ $window ][ 'resourcedefault' ] = $app_json->resourcedefault;
$_SESSION[ $window ][ 'submitpolicy'    ] = $app_json->submitpolicy;

session_write_close();

if ( isset( $app_json->messaging->tcphostip ) &&
     isset( $app_json->messaging->tcpport ) ) {
    $_REQUEST[ '_tcphost' ] = $app_json->messaging->tcphostip;
    $_REQUEST[ '_tcpport' ] = $app_json->messaging->tcpport;
}

$_REQUEST[ '_udphost' ] =  $_SESSION[ $window ][ 'udphost' ];
$_REQUEST[ '_udpport' ] =  $_SESSION[ $window ][ 'udpport' ];
$_REQUEST[ 'resourcedefault' ] = $_SESSION[ $window ][ 'resourcedefault' ];
$_REQUEST[ '_webroot' ] = "__docroot:html5__";
$_REQUEST[ '_application' ] = "__application__";
$_REQUEST[ '_menu' ]        = "__menu:id__";
$_REQUEST[ '_module' ]      = "__menu:modules:id__";

__~resource{$useresource = "__resource__";}
__~submitpolicy{$submitpolicy = "__submitpolicy__";}

if ( !isset( $submitpolicy ) )
{
   if ( isset( $_SESSION[ $window ][ 'submitpolicy' ] ) &&
        $_SESSION[ $window ][ 'submitpolicy' ] == "login" &&
        ( !isset( $_SESSION[ $window ][ 'logon' ] ) ||
          strlen( $_SESSION[ $window ][ 'logon' ] ) == 0 ) )
   {
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

       $results[ "error" ] .= "You must be logged on to submit";
       $results[ '_status' ] = 'failed';
       echo (json_encode($results));
       exit();
   }
} else {
   if ( $submitpolicy == "login" &&
        ( !isset( $_SESSION[ $window ][ 'logon' ] ) ||
          strlen( $_SESSION[ $window ][ 'logon' ] ) == 0 ) )
   {
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
       
       $results[ "error" ] .= "You must be logged on to submit";
       $results[ '_status' ] = 'failed';
       echo (json_encode($results));
       exit();
   }
}

$cmdprefix = "";

if ( isset( $_SESSION[ $window ][ 'resourcedefault' ] ) &&
     $_SESSION[ $window ][ 'resourcedefault' ] == "disabled" )
{
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
    $results[ "error" ] .= "Job submission is currently disabled";
    $results[ '_status' ] = 'failed';
    echo (json_encode($results));
    exit();
}

if ( isset( $useresource ) &&
     !isset( $_SESSION[ $window ][ 'resources' ]->{ $useresource } ) )
{
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

    $results[ "error" ] .= "module specified resource " . $useresource . " is not defined in appconfig";
    $results[ '_status' ] = 'failed';
    echo (json_encode($results));
    exit();
}

if ( !isset( $_SESSION[ $window ][ 'resources' ]->{ $_SESSION[ $window ][ 'resourcedefault' ] } ) &&
     !isset( $useresource ) )
{
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
    $results[ "error" ] .= "No default resource specified in appconfig and no resource defined in module. This could be the result of an invalid appconfig.json";
    $results[ '_status' ] = 'failed';
    echo (json_encode($results));
    exit();
} else {
   if ( isset( $useresource ) )
   {
      $cmdprefix = $_SESSION[ $window ][ 'resources' ]->{ $useresource };
      $GLOBALS[ 'resource' ] = $useresource;
   } else {
      $cmdprefix = $_SESSION[ $window ][ 'resources' ]->{ $_SESSION[ $window ][ 'resourcedefault' ] };
      $GLOBALS[ 'resource' ] = $_SESSION[ $window ][ 'resourcedefault' ];
   }
   if(isset($cmdprefix->run)){
      $cmdprefix = $cmdprefix->run;
   }
   if ( strlen( $cmdprefix ) > 1 ) {
      $fileargs = 1;
      $cmdprefix = str_replace( "_" . "_application__", "__application__", $cmdprefix );
      $cmdprefix = str_replace( "_" . "_menu:id__", "__menu:id__", $cmdprefix );
      $cmdprefix = str_replace( "_" . "_menu:modules:id__", "__menu:modules:id__", $cmdprefix );
      $cmdprefix = str_replace( "_" . "_rundir__", $dir, $cmdprefix );
   }
}

if ( isset( $app_json->submitblock ) ) {
    __~debug:submitblock{error_log( "base.php submitblock found\n", 3, "/tmp/mylog" );}
    $blocked = 0;
    $bypass = 0;
    $blocked_msg = [];
    if ( isset( $app_json->submitblock->{"all"} ) &&
         isset( $app_json->submitblock->{"all"}->active ) &&
         $app_json->submitblock->{"all"}->active == 1 ) {
        $blocked = 1;
        $blocked_msg = 
            [ "icon" => "warning.png",
              "text" => isset( $app_json->submitblock->{"all"}->text ) 
              ? $app_json->submitblock->{"all"}->text 
              : "Submission of jobs to $k is currently disabled."
            ];
        if ( isset( $app_json->submitblock->{"all"}->allow ) &&
             isset( $app_json->restricted ) &&
             in_array( $app_json->submitblock->{"all"}->allow, $app_json->restricted ) &&
             in_array( $GLOBALS[ 'logon' ], $app_json->restricted->{$app_json->submitblock->{"all"}->allow} ) ) {
            $blocked = 0;
            $bypass = 1;
        }
    } else {
        if ( isset( $app_json->submitblock->{$GLOBALS['resource']} ) &&
             isset( $app_json->submitblock->{$GLOBALS['resource']}->active ) &&
             $app_json->submitblock->{$GLOBALS['resource']}->active == 1 ) {
            $blocked = 1;
            $blocked_msg = 
                [ "icon" => "warning.png",
                  "text" => "<p>" . ( isset( $app_json->submitblock->{$GLOBALS['resource']}->text ) 
                                      ? $app_json->submitblock->{$GLOBALS['resource']}->text 
                                      : ( "Submission of jobs to " . $GLOBALS['resource'] . " is currently disabled." ) ) . "</p>"
                ];
            if (  isset( $app_json->submitblock->{$GLOBALS['resource']}->allow ) &&
                  isset( $app_json->restricted ) &&
                  isset( $app_json->restricted->{ $app_json->submitblock->{$GLOBALS['resource']}->allow } ) &&
                  in_array( $GLOBALS[ 'logon' ], $app_json->restricted->{$app_json->submitblock->{$GLOBALS['resource']}->allow} ) ) {
                $blocked = 0;
                $bypass = 1;
            }
        }                    
    }
    if ( $blocked ) {
        __~debug:submitblock{error_log( "base.php submit block blocked\n", 3, "/tmp/mylog" );}
        $results[ "_message" ] = $blocked_msg;

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
        $results[ '_status' ] = 'failed';
        echo (json_encode($results));
        exit();
    }
    if ( $bypass ) {
        __~debug:submitblock{error_log( "base.php submit block bypassed\n", 3, "/tmp/mylog" );}
        $blocked_msg[ 'text' ] .= "<p>Your permissions allowed submission anyway.</p>";
        $results[ "_message" ] = $blocked_msg;
    }        
} else {
    __~debug:submitblock{error_log( "submitblock not found\n" . json_encode( $app_json, JSON_PRETTY_PRINT ) . "\n", 3, "/tmp/mylog" );}
}
             

__~debug:basemylog{error_log( "cmdprefix $cmdprefix\n", 3, "/tmp/mylog" );}
__~debug:basemylog{error_log( "globals resource " . $GLOBALS['resource'] . "\n", 3, "/tmp/mylog" );}

$org_request = $_REQUEST;

// date_default_timezone_set("UTC");
// $org_request[ '_datetime' ] = date( "Y M d H:i:s T", time() );

function fileerr_msg($code)
{
    switch ($code) {
        case UPLOAD_ERR_INI_SIZE:
            $message = "The uploaded file exceeds the upload_max_filesize directive in php.ini";
            break;
        case UPLOAD_ERR_FORM_SIZE:
            $message = "The uploaded file exceeds the MAX_FILE_SIZE directive that was specified in the HTML form";
            break;
        case UPLOAD_ERR_PARTIAL:
            $message = "The uploaded file was only partially uploaded";
            break;
        case UPLOAD_ERR_NO_FILE:
            $message = "No file was uploaded";
            break;
        case UPLOAD_ERR_NO_TMP_DIR:
            $message = "Missing a temporary folder";
            break;
        case UPLOAD_ERR_CANT_WRITE:
            $message = "Failed to write file to disk";
            break;
        case UPLOAD_ERR_EXTENSION:
            $message = "File upload stopped by extension";
            break;
         default:
            $message = "Unknown upload error";
            break;
    }
    return $message;
} 

__~debug:basemylog{error_log( "request\n" . print_r( $_REQUEST, true ) . "\n", 3, "/tmp/mylog" );}

// special fake _FILES creation for strange bug
if ( !sizeof( $_FILES ) ) {
   $selalt = "_selaltval_";
   $lenselalt = strlen( $selalt );
   $found_selalt = false;
   foreach ( $_REQUEST as $k=>$v ) {
      if ( !strncmp( $k, $selalt, $lenselalt ) ) {
          $found_selalt = true;
          $tmp_key = substr( $k, $lenselalt );
          $_FILES[ $tmp_key ] = json_decode( '{"name":"","type":"","tmp_name":"","error":4,"size":0}', true );
          error_log( "__executable__ no files but found _selaltval_ with key $tmp_key\n", 3, "/tmp/mylog_selalt" );
      }
   }
   if ( $found_selalt ) {
       error_log( "__executable__ request\n" . print_r( $_REQUEST, true ) . "\n", 3, "/tmp/mylog_selalt" );
       error_log( "files\n" . print_r( $_FILES, true ) . "\n", 3, "/tmp/mylog_selalt" );
   }
}

if ( sizeof( $_FILES ) ) {

    $module_json = json_decode( '__modulejson__' );
    $required_files = [];

    if ( isset( $module_json->fields ) ) {
        foreach ( $module_json->fields as $k=>$v ) {
            __~debug:trimfiles{error_log( "module json field $k\n" . print_r( json_encode( $v, JSON_PRETTY_PRINT ), true ) . "\n", 3, "/tmp/mylog" );}
            if ( 
                isset( $v->id )  
                && isset( $v->role )     && $v->role == "input"
                && isset( $v->type )     && substr( $v->type, -4 ) == "file"
                && isset( $v->required ) && strtolower( $v->required ) != "false" ) {
                $required_files[ $v->id ] = 1;
            }
        }
    }
    __~debug:trimfiles{error_log( "required_files:\n" . print_r( json_encode( $required_files, JSON_PRETTY_PRINT ), true ) . "\n", 3, "/tmp/mylog" );}

    // trim missing non-required
    __~debug:trimfiles{error_log( "files:\n" . print_r( json_encode( $_FILES, JSON_PRETTY_PRINT ), true ) . "\n", 3, "/tmp/mylog" );}
    
    foreach ( $_FILES as $k=>$v ) {
        if ( isset( $v[ 'name' ] ) && 
             is_string( $v[ 'name' ] ) && 
             !strlen( $v[ 'name' ] ) && 
             !isset( $required_files[ $k ] ) &&
             ( isset( $_REQUEST[ "_selaltval_$k" ] ) 
               ? !isset( $_REQUEST[ $_REQUEST[ "_selaltval_$k" ] ] ) || empty( $_REQUEST[ $_REQUEST[ "_selaltval_$k" ] ] )
               : 1 )
              ) {
            unset( $_FILES[ $k ] );
        }
    }
    __~debug:trimfiles{error_log( "files after trim:\n" . print_r( json_encode( $_FILES, JSON_PRETTY_PRINT ), true ) . "\n", 3, "/tmp/mylog" );}

   __~debug:basemylog{error_log( "files\n" . print_r( $_FILES, true ) . "\n", 3, "/tmp/mylog" );}
   foreach ( $_FILES as $k=>$v )
   {
      if ( is_array( $v[ 'error' ] ) )
      {
         foreach ( $v[ 'error' ] as $k1=>$v1 )
         {
            if ( $v[ 'error' ][ $k1 ] )
            {
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
                if ( !isset( $results[ "error" ] ) )
                {
                    $results[ "error" ] = "";
                }
                if ( is_string( $v[ 'name' ][ $k1 ] ) && !strlen( $v[ 'name' ][ $k1 ] ) )
                {
                    $results[ "error" ] .= "Missing file input for identifier " . $k;
                } else {
                    $results[ "error" ] .= "Error uploading file " . $v[ 'name' ][ $k1 ] . " Error code:" . $v[ 'error' ][ $k1 ] . " " . fileerr_msg( $v[ 'error' ][ $k1 ] );
                }
                $results[ '_status' ] = 'failed';
                echo (json_encode($results));
                exit();
            }
#            error_log( "move_uploaded_file( " . $v[ 'tmp_name' ][ $k1 ] . ',' .  $dir . '/' . $v[ 'name' ][ $k1 ] . "\n", 3, "/var/tmp/my-errors.log");
            if ( !move_uploaded_file( $v[ 'tmp_name' ][ $k1 ], $dir . '/' . $v[ 'name' ][ $k1 ] ) )
            {
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
                if ( !isset( $results[ "error" ] ) )
                {
                    $results[ "error" ] = "";
                }
                $results[ "error" ] .= "Could not move file " . $v[ 'name' ][ $k1 ];
                $results[ '_status' ] = 'failed';
                echo (json_encode($results));
                exit();
            }
            if ( !isset( $_REQUEST[ $k ] ) || !is_array( $_REQUEST[ $k ] ) )
            {
               $_REQUEST[ $k ] = array();
            }
            $_REQUEST[ $k ][] = $dir . '/' . $v[ 'name' ][ $k1 ];
            if ( !isset( $org_request[ $k ] ) || !is_array( $org_request[ $k ] ) )
            {
               $org_request[ $k ] = array();
            }
            $org_request[ $k ][] = $v[ 'name' ][ $k1 ];
         }
      } else {
         if ( $v[ 'error' ] == 4 &&
              isset( $_REQUEST[ '_selaltval_' . $k ] ) &&
              isset( $_REQUEST[ $_REQUEST[ '_selaltval_' . $k ] ] ) &&
              count( $_REQUEST[ $_REQUEST[ '_selaltval_' . $k ] ] ) == 1 ) 
         {
            $f = $bdir . substr( base64_decode( $_REQUEST[ $_REQUEST[ '_selaltval_' . $k ] ][ 0 ] ), 2 );
            if ( !file_exists( $f ) )
            {
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
                $results[ "error" ] = "Missing file input for identifier " . $k;
                $results[ '_status' ] = 'failed';
                echo (json_encode($results));
                exit();
            }

            if ( !isset( $_REQUEST[ $k ] ) || !is_array( $_REQUEST[ $k ] ) )
            {
               $_REQUEST[ $k ] = array();
            }
            $_REQUEST[ $k ][] = $f;
            unset( $_REQUEST[ $_REQUEST[ '_selaltval_' . $k ] ] );
            unset( $_REQUEST[ '_selaltval_' . $k ] );
         } else {
            if ( $v[ 'error' ] )
            {
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
                if ( !isset( $results[ "error" ] ) )
                {
                    $results[ "error" ] = "";
                }
                if ( is_string( $v[ 'name' ] ) && !strlen( $v[ 'name' ] ) )
                {
                    $results[ "error" ] .= "Missing file input for identifier " . $k;
                } else {
                    $results[ "error" ] .= "Error uploading file " . $v[ 'name' ] . " Error code:" . $v[ 'error' ] . " " . fileerr_msg( $v[ 'error' ] );
                }
                $results[ '_status' ] = 'failed';
                echo (json_encode($results));
                exit();
            }
//         error_log( "move_uploaded_file( " . $v[ 'tmp_name' ] . ',' .  $dir . '/' . $v[ 'name' ] . "\n", 3, "/var/tmp/my-errors.log");
            if ( !move_uploaded_file( $v[ 'tmp_name' ], $dir . '/' . $v[ 'name' ] ) )
            {
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
                $results[ "error" ] .= "Could not move file " . $v[ 'name' ];
                $results[ '_status' ] = 'failed';
                echo (json_encode($results));
                exit();
            }
            if ( !isset( $_REQUEST[ $k ] ) || !is_array( $_REQUEST[ $k ] ) )
            {
               $_REQUEST[ $k ] = array();
            }
            $_REQUEST[ $k ][] = $dir . '/' . $v[ 'name' ];
            if ( !isset( $org_request[ $k ] ) || !is_array( $org_request[ $k ] ) )
            {
               $org_request[ $k ] = array();
            }
            $org_request[ $k ][] = $v[ 'name' ];
         }
      }
   }
}

function only_numerics( $a ) {
    $b = [];
    foreach ( $a as $v ) {
        if ( ctype_digit( $v ) ) {
            $b[] = $v;
        }
    }
    __~debug:basemylog{error_log( "only numerics from:\n" . json_encode( $a, JSON_PRETTY_PRINT ) . "\nto:\n" . json_encode( $b, JSON_PRETTY_PRINT ) . "\n", 3, "/tmp/mylog" );}
    return $b;
}

function last_nonnumeric( $a ) {
    $i = count( $a ) - 1;
    while ( $i >= 0 && ctype_digit( $a[ $i ] ) ) {
        --$i;
    }
    if ( $i < 0 ) {
        error_log( "__application__ __menu:id__ __menu:modules:id__ last_nonnumeric could not find one\n" . json_encode( $a, JSON_PRETTY_PRINT ) . "\n", 3, "/tmp/php_errors" );
        return $a[ 0 ];
    }
    __~debug:basemylog{error_log( "last non numeric from:\n" . json_encode( $a, JSON_PRETTY_PRINT ) . "\n is " . $a[$i] . "\n", 3, "/tmp/mylog" );}
    return $a[ $i ];
}    


if ( sizeof( $_REQUEST ) )
{
    ob_start();
    if ( !file_put_contents( "$logdir/_input_" . $_REQUEST[ '_uuid' ], json_encode( $org_request  ) ) )
    {
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
        $results[ "error" ] .= "Could not write _input file data " . $cont;
        $results[ '_status' ] = 'failed';
        echo (json_encode($results));
        exit();
    }
    ob_end_clean();
    unset( $org_request );

    $decodekeys = preg_grep( '/^_decodepath_/', array_keys( $_REQUEST ) );
__~debug:basemylog{    error_log( "decode keys\n" . print_r( $decodekeys, true ) . "\n", 3, "/tmp/mylog" );}
    foreach ( $decodekeys as $v ) {                      
        $v1 = substr( $v, 12 );
__~debug:basemylog{        error_log( "decode key $v -> $v1\n", 3, "/tmp/mylog" );}
        if ( isset( $_REQUEST[ $v1 ] ) ) {
__~debug:basemylog{            error_log( "is set request $v1\n", 3, "/tmp/mylog" );}
            foreach ( $_REQUEST[ $v1 ] as $k2=>$v2 ) {
__~debug:basemylog{                error_log( "foreach set request $v1: $k2 => $v2\n", 3, "/tmp/mylog" );}
                $_REQUEST[ $v1 ][ $k2 ] = $bdir . substr( base64_decode( $v2 ), 2 );
            }
        } else {
__~debug:basemylog{            error_log( "is NOT set request $v1\n", 3, "/tmp/mylog" );}
        }
    }

    __~debug:basemylog{error_log( "old repeaters __oldrepeaters__ newrepeaters __newrepeaters__\n", 3, "/tmp/mylog" );}
    $keys = preg_grep( "/-/", array_keys( $_REQUEST ) );
    foreach ( $keys as $k => $v ) {
        if ( !preg_match( "/^_/", $v ) ) {
            $a = preg_split( "/-/", $v );
            if ( !__~extendedjsoninputtags{1}0 ) {
                if ( 1 ) {
                    $b = only_numerics( $a );
                    $tag = last_nonnumeric( $a );
                    if ( count( $b ) ) {
                        if ( !isset( $_REQUEST[ $tag ] ) || !is_array( $_REQUEST[ $tag ] ) ) {
                            $_REQUEST[ $tag ] = [];
                        }
                        if ( !is_array( $_REQUEST[ $tag ] ) ) {
                            error_log( "__application__ __menu:id__ __menu:modules:id__ target tag $tag in not an array in request v $v\n" . json_encode( $_REQUEST, JSON_PRETTY_PRINT ) . "\n", 3, "/tmp/php_errors" );
                        } else {
                            $obj = &$_REQUEST[ $tag ];
                            foreach ( $b as $v2 ) {
                                if ( !isset( $obj[ $v2 ] ) ) {
                                    $obj[ $v2 ] = [];
                                }
                                if ( !is_array( $obj[ $v2 ] ) ) {
                                    error_log( "__application__ __menu:id__ __menu:modules:id__ target tag $tag in not an array in request v $v object\n" . json_encode( $obj, JSON_PRETTY_PRINT ) . "\n", 3, "/tmp/php_errors" );
                                    break;
                                }
                                if ( count( $obj ) <= $v2 ) {
                                    __~debug:basemylog{error_log( "for $v ... v2 is $v2 filling upto $v2\n", 3, "/tmp/mylog" );}
                                    $obj += array_fill( 0, $v2 + 1, null );
                                    ksort( $obj );
                                }
                                $obj = &$obj[ $v2 ];
                            }
                            $obj = $_REQUEST[ $v ];
                        }
                    } else {
                        $_REQUEST[ $tag ] = $_REQUEST[ $v ];
                    }
                } else {
                    $i = count( $a ) - 1;
                    $isdigit = ctype_digit( $a[ $i ] );
                    __~debug:basemylog{error_log( "old repeaters style used isdigit=$isdigit i=$i key=" . $a[$i] . " value $v\n", 3, "/tmp/mylog" );}
                    if ( $isdigit && $i > 0 ) {
                        __~debug:basemylog{error_log( "array add $v\n", 3, "/tmp/mylog" );}
                        if ( !is_array( $_REQUEST[ $a[ $i - 1 ] ] ) ) {
                            $_REQUEST[ $a[ $i - 1 ] ] = [];
                        }
                        $_REQUEST[ $a[ $i - 1 ] ][ $a[ $i ] ] = $_REQUEST[ $v ];
                    } else {
                        if ( !$isdigit ) {
                            __~debug:basemylog{error_log( "not array add $v\n", 3, "/tmp/mylog" );}
                            $_REQUEST[ $a[ $i ] ] = $_REQUEST[ $v ];
                        } else {
                            __~debug:basemylog{error_log( "not array add $v and skipped\n", 3, "/tmp/mylog" )};
                        }
                    }
                }
                unset( $_REQUEST[ $v ] );
            } else { // old new way of long tags
                __~debug:basemylog{error_log( "new repeaters style used\n", 3, "/tmp/mylog" );}
                __~debug:basemylog{error_log( "preg_split of $v:\n" . json_encode( $a, JSON_PRETTY_PRINT ) . "\n", 3, "/tmp/mylog" );}
                if ( !isset( $_REQUEST[ $a[ 0 ] ] ) || !is_array( $_REQUEST[ $a[ 0 ] ] ) ) {
                    $_REQUEST[ $a[ 0 ] ] = [];
                }
                $obj = &$_REQUEST[ $a[ 0 ] ];
                for ( $i = 1; $i < count( $a ) - 1; ++$i ) {
                    if ( !isset( $obj[ $a[ $i ] ] ) || !is_array( $obj[ $a[ $i ] ] ) ) {
                        $obj[ $a[ $i ] ] = [];
                    }
                    if ( ctype_digit( $a[ $i ] ) && count( $obj ) <= $a[ $i ] ) {
                        __~debug:basemylog{error_log( "for $v ...\$a[\$i] is $a[$i] filling upto $a[$i]\n", 3, "/tmp/mylog" );}
                        $obj += array_fill( 0, $a[ $i ] + 1, null );
                        ksort( $obj );
                    }
                    $obj = &$obj[ $a[ $i ] ];
                }
                $obj[ $a[ count( $a ) - 1 ] ] = $_REQUEST[ $v ];
                // $_REQUEST[ $a[ 0 ] ][ $a[ 1 ] - 1 ] = $_REQUEST[ $v ];
                unset( $_REQUEST[ $v ] );
            }
        }
    }

    __~debug:basemylog{error_log( "request ready to jsonize\n" . print_r( $_REQUEST, true ) . "\n", 3, "/tmp/mylog" );}
    __~debug:basemylog{error_log( "request in json" . json_encode( $_REQUEST, JSON_PRETTY_PRINT ) . "\n", 3, "/tmp/mylog" );}
    __~sendmodulejson{ $_REQUEST[ "_json" ] = '__modulejson__';}
    $json = json_encode( $_REQUEST );
    $json = str_replace( "'", "_", $json );
    ob_start();
    if ( !chdir( $dir ) )
    {
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
      $results[ "error" ] .= "Could not create directory " . $dir . " " . $cont;
      $results[ '_status' ] = 'failed';
      echo (json_encode($results));
      exit();
    }
    ob_end_clean();
    if ( strlen( $json ) > 129000 ) {
        $fileargs = 1;
        $bigargs = 1;
    }
    if ( isset( $fileargs ) )
    {
      ob_start();
      if (!file_put_contents( "$logdir/_args_" . $_REQUEST[ '_uuid' ], $json ) )
      {
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
         $results[ "error" ] .= "Could not write _args for remote submission " . $cont;
         $results[ '_status' ] = 'failed';
         echo (json_encode($results));
         exit();
      }
      ob_end_clean();
      // this is overriding too much, needs correction
      if ( $cmdprefix == "airavatarun" ||
           $cmdprefix == "oscluster" || 
           substr( $cmdprefix, 0, 5 ) == "abaco" ) {
          $cmd = "$adir/$cmdprefix";
          if ( substr( $cmdprefix, 0, 5 ) != "abaco" ) {
              $cmd .= $cmdprefix == "oscluster" ? " __executable__" : " __menu:modules:id__";
          }
          $cmd .= " '$json'"; 
      } else {
          if ( substr( $cmdprefix, 0, 6 ) == "docker" ) {
              $cmd = "$cmdprefix '$json'";
          } else {
              if ( strlen( $cmdprefix ) ) {
                  $register = "perl $adir/util/ga_regpid_udp.pl __application__ " . 
                      $GLOBALS['resource'] . " " . 
                      $_REQUEST[ '_udphost' ] . " " .
                      $_REQUEST[ '_udpport' ] . " " .
                      $_REQUEST[ '_uuid' ] . " " .
                      '$$';

                  if ( isset( $bigargs ) ) {
                      $cmd = "$cmdprefix '$register;cd $dir;$cmd @$logdir/_args_" . $_REQUEST[ '_uuid' ] . "'";
                  } else {
                      $cmd = "$cmdprefix '$register;cd $dir;$cmd \"\$(< $logdir/_args_" . $_REQUEST[ '_uuid' ] . ")\"'";
                  }                  
              } else {
                  if ( isset( $bigargs ) ) {
                      $cmd = "$cmd @$logdir/_args_" . $_REQUEST[ '_uuid' ];
                  } else {
                      $cmd = "$cmd \"\$(< $logdir/_args_" . $_REQUEST[ '_uuid' ] . ")\"";
                  }
              }
          }
      }
    } else {
      $cmd .= " '$json'";
    }

    $cmd .= " 2> $logdir/_stderr_" . $_REQUEST[ '_uuid' ] . " | head -c50000000";
    __~debug:basemylog{error_log( "\tcmd: <$cmd>\n", 3, "/tmp/mylog" );}

    $cmdfile = "$logdir/_cmds_" . $_REQUEST[ '_uuid' ];

    ob_start();
    if ( !file_put_contents( $cmdfile, $cmd ) )
    {
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
       $results[ "error" ] .= "Could not write _cmds_ for remote submission " . $cont;
       $results[ '_status' ] = 'failed';
       echo (json_encode($results));
       exit();
    }
    ob_end_clean();

    logjobstart(__~cache{ false, "__cache__" });

    $altcmd = "nohup /usr/local/bin/php __docroot:html5__/__application__/util/jobrun.php '" . $GLOBALS[ 'logon' ] . "' " . $_REQUEST[ '_uuid' ] . " " . ( isset( $checkrunning ) ? "1" : "0" ) . " 2>&1 >> /tmp/php_errors &";

//    error_log( "\taltcmd:\n$altcmd\n", 3, "/tmp/mylog" );

    __~debug:runjob{error_log( "base.php exec nohup jobrun\n", 3, "/tmp/php_errors" );}
      
    exec( $altcmd );

    $results[ "_status" ] = "started";
    __~debug:job{$results[ "jobrun" ] = "started";}
    
    if ( $do_logoff == 1 ) {
        $results[ '_logon' ] = "";
    }

    echo json_encode( $results );
    exit;

    if ( isset( $results[ "_fs_clear" ] ) )
    {
        $fsc = $results[ "_fs_clear" ];
        $results = '{"_status":"started"__~debug:job{,"jobrun":"started"},"_fs_clear":"' . $fsc . '"}';
    } else {
        $results = '{"_status":"started"__~debug:job{,"jobrun":"started"}}';
    }
    
    if ( $do_logoff == 1 )
    {   
        $results = substr( trim( $results ), 0, -1 ) . ",\"_logon\":\"\"}";
    }

    echo $results;
    exit;

    $results = exec( $cmd );

    logjobupdate( "finished", true );

    $results = str_replace( "__docroot:html5__/__application__/", "", $results );
    if ( $do_logoff == 1 )
    {   
        $results = substr( trim( $results ), 0, -1 ) + ",\"_logon\":\"\"}";
    }

    ob_start();
    file_put_contents( "$logdir/_stdout_" . $_REQUEST[ '_uuid' ], $results );
    ob_end_clean();

    ob_start();
    $test_json = json_decode( $results );
    if ( $test_json == NULL )
    {   
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

        if ( strlen( $results ) )
        {
            $results[ "error" ] = "Malformed JSON returned from executable $cont";
            if ( strlen( $results ) > 1000 )
            {
                $results[ "executable_returned_end" ] = substr( $results, 0, 450  ) . " .... " . substr( $results, -450 );
                $results[ "notice" ] = "The executable return string was greater than 1000 characters, so only the first 450 and the last 450 are shown above.  Check $logdir/_stdout for the full output";
            } else {
                $results[ "executable_returned" ] = substr( $results, 0, 1000 );
            }
        } else {
            $results[ "error" ] = "Empty JSON returned from executable $cont";
        }

        ob_start();
        $stderr = trim( file_get_contents( "$logdir/_stderr_" . $_REQUEST[ '_uuid' ] ) );
        $cont = ob_get_contents();
        ob_end_clean();
        $results[ "error_output" ] = ( strlen( $stderr ) > 0 ) ? $stderr : "EMPTY";
        if ( strlen( $cont ) )
        {
            $results[ "error_output_issue" ] = "reading _stderr reported $cont";
        }           

        echo (json_encode($results));
        exit();
    }
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
            $test_json[ 'error' ] = "Error removing running project record from database.  This project is now locked. " . $ga_db_errors;
        }
        $results = json_encode( $test_json );
    }
} else {

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
    $results[ "error" ] .= "PHP code received no \$_REQUEST?";
    echo (json_encode($results));
    exit();
}

// cleanup CURRENTLY DISABLED!
if ( sizeof( $_FILES ) )
{
   $files = new RecursiveIteratorIterator(
       new RecursiveDirectoryIterator($dir, RecursiveDirectoryIterator::SKIP_DOTS),
       RecursiveIteratorIterator::CHILD_FIRST
   );

   foreach ($files as $fileinfo) {
      $todo = ($fileinfo->isDir() ? 'rmdir' : 'unlink');
//      $todo( $fileinfo->getRealPath() );
   }
//   rmdir( $dir );
}
echo $results;

