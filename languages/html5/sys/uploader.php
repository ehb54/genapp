<?php
header('Content-type: application/json');
# setup php session

session_start();
if (!isset($_SESSION['count'])) {
  $_SESSION['count'] = 0;
} else {
  $_SESSION['count']++;
}

if ( !sizeof( $_REQUEST ) ) {
    session_write_close();
    require_once "../mail.php";
    $msg = "[PHP code received no \$_REQUEST] Possibly total upload file size exceeded limit.\nLimit is currently set to " . ini_get( 'post_max_size' ) . ".\n";
    error_mail( $msg . "Error occured in simulate energy.\n" );
    $results = array("error" => $msg . "Please contact the administrators via feedback if you feel this is in error or if you have need to process total file sizes greater than this limit.\n" );
    $results[ '_status' ] = 'failed';
    echo (json_encode($results));
    exit();
}

require_once "__docroot:html5__/__application__/ajax/ga_filter.php";
$modjson = array();
$inputs_req = $_REQUEST;
$validation_inputs = ga_sanitize_validate( $modjson, $inputs_req, 'uploader' );

if ( $validation_inputs[ "output" ] == "failed" ) {
    $results = array( "error" => $validation_inputs[ "error" ] );
#    $results[ '_status' ] = 'failed';
#    echo ( json_encode( $results ) );
#    exit();
};

$do_logoff = 0;

$window = "";
if ( isset( $_REQUEST[ '_window' ] ) ) {
   $window = $_REQUEST[ '_window' ];
}

if ( !isset( $_SESSION[ $window ] ) ) {
   $_SESSION[ $window ] = array( "logon" => "", "project" => "" );
}

if ( isset( $_REQUEST[ "_logon" ] ) && 
   ( !isset( $_SESSION[ $window ][ 'logon' ] ) || $_REQUEST[ "_logon" ] != $_SESSION[ $window ][ 'logon' ] ) ) {
   $do_logoff = 1;
   unset( $_SESSION[ $window ][ 'logon' ] );
   $results[ '_logon' ] = "";
   echo '{"error":"Internal state error"}';
   exit();
}

$GLOBALS[ 'logon' ] = isset( $_SESSION[ $window ][ 'logon' ] ) ? $_SESSION[ $window ][ 'logon' ] : 'not logged in';

if ( !isset( $_REQUEST[ '_uuid' ] ) )
{
    $results[ "error" ] = "No _uuid specified in the request";
    $results[ '_status' ] = 'failed';
    echo (json_encode($results));
    exit();
}

$org_request = $_REQUEST;

function fileerr_msg($code) {
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
          error_log( "uploader no files but found _selaltval_ with key $tmp_key\n", 3, "/tmp/umylog" );
      }
   }
   if ( $found_selalt ) {
       error_log( "uploader request\n" . print_r( $_REQUEST, true ) . "\n", 3, "/tmp/umylog" );
       error_log( "files\n" . print_r( $_FILES, true ) . "\n", 3, "/tmp/umylog" );
   }
}

if ( !sizeof( $_FILES ) ) {
   echo '{"error":"No files specified"}';
   exit();
}

require_once "../joblog.php";

if ( !getprojectdir( $_REQUEST[ '_uuid' ] ) ) {
   echo '{"error":"No db directory found for job:' . $_REQUEST[ '_uuid' ] . '"}';
   exit();
}
   
$dir = $GLOBALS[ "getprojectdir" ] . "/uploads";
$project = $GLOBALS[ "getprojectdirproject" ];

if ( !file_exists( $dir ) ) {
   ob_start();

   if ( !mkdir( $dir, 0777, true ) )
   {  
      $cont = ob_get_contents();
      ob_end_clean();
      $results[ "error" ] .= "Could not create directory " . $dir . " " . $cont;
      echo (json_encode($results));
      exit();
   }
   chmod( $dir, 0775 );
   ob_end_clean();
   $results[ "_fs_clear" ] = "#";
}


$adir = "__docroot:html5__/__application__";

if ( isset( $_SESSION[ $window ][ 'logon' ] ) &&
     strlen( $_SESSION[ $window ][ 'logon' ] ) > 1 ) {
    $bdir = "__docroot:html5__/__application__/results/users/" . $_SESSION[ $window ][ 'logon' ] . "/";
} else {
    $bdir = "";
}

if ( sizeof( $_FILES ) ) {

#    $module_json = json_decode( '__modulejson__' );
#    $required_files = [];

#    if ( isset( $module_json->fields ) ) {
#        foreach ( $module_json->fields as $k=>$v ) {
#            if ( 
#                isset( $v->id )  
#                && isset( $v->role )     && $v->role == "input"
#                && isset( $v->type )     && substr( $v->type, -4 ) == "file"
#                && isset( $v->required ) && strtolower( $v->required ) != "false" ) {
#                $required_files[ $v->id ] = 1;
#            }
#        }
#    }
#    __~debug:uploader{error_log( "required_files:\n" . print_r( json_encode( $required_files, JSON_PRETTY_PRINT ), true ) . "\n", 3, "/tmp/umylog" );}

#    // trim missing non-required
#    __~debug:uploader{error_log( "files:\n" . print_r( json_encode( $_FILES, JSON_PRETTY_PRINT ), true ) . "\n", 3, "/tmp/umylog" );}
    
#    foreach ( $_FILES as $k=>$v ) {
#        if ( isset( $v[ 'name' ] ) && 
#             is_string( $v[ 'name' ] ) && 
#             !strlen( $v[ 'name' ] ) && 
#             !isset( $required_files[ $k ] ) &&
#             ( isset( $_REQUEST[ "_selaltval_$k" ] ) 
#               ? !isset( $_REQUEST[ $_REQUEST[ "_selaltval_$k" ] ] ) || empty( $_REQUEST[ $_REQUEST[ "_selaltval_$k" ] ] )
#               : 1 )
#              ) {
#            unset( $_FILES[ $k ] );
#        }
#    }
#    __~debug:uploader{error_log( "files after trim:\n" . print_r( json_encode( $_FILES, JSON_PRETTY_PRINT ), true ) . "\n", 3, "/tmp/umylog" );}

   __~debug:uploadermylog{error_log( "files\n" . print_r( $_FILES, true ) . "\n", 3, "/tmp/umylog" );}
   foreach ( $_FILES as $k=>$v )
   {
      if ( is_array( $v[ 'error' ] ) )
      {
         foreach ( $v[ 'error' ] as $k1=>$v1 )
         {
            if ( $v[ 'error' ][ $k1 ] )
            {
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
            if ( file_exists( $dir . '/' . $v[ 'name' ][ $k1 ] ) ) {
                __~debug:uploadermylog{error_log( "going to move, but dest exists\n", 3, "/tmp/umylog" );}
                $fbase = $v[ 'name' ][ $k1 ];
                $ext = 1;
                $fname = pathinfo( $fbase, PATHINFO_FILENAME );
                $fext = pathinfo( $fbase, PATHINFO_EXTENSION );
                if ( !empty( $fext ) ) {
                    $fext = '.' . $fext;
                }
                while ( file_exists( $dir . '/' . $fname . '-' . $ext . $fext ) ) {
                    $ext++;
                }
                $v[ 'name' ][ $k1 ] = $fname . '-' . $ext . $fext;
            }
            __~debug:uploadermylog{error_log( "move_uploaded_file( " . $v[ 'tmp_name' ][ $k1 ] . ',' .  $dir . '/' . $v[ 'name' ][ $k1 ] . "\n", 3, "/tmp/umylog");}
            if ( !move_uploaded_file( $v[ 'tmp_name' ][ $k1 ], $dir . '/' . $v[ 'name' ][ $k1 ] ) )
            {
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
               $results[ "error" ] = "Missing file input for identifier " . $k;
               $results[ '_status' ] = 'failed';
               echo (json_encode($results));
               exit();
            }

            # copy file & set name properly for assembly in returned files

            $fbase = basename( $f );

            if ( !( $f === $dir . '/' . $fbase ) ) { # no need to copy the same file
                if ( file_exists( $dir . '/' . $fbase ) ) {
                    __~debug:uploadermylog{error_log( "going to copy, but dest exists\n", 3, "/tmp/umylog" );}
                    $ext = 1;
                    $fname = pathinfo( $fbase, PATHINFO_FILENAME );
                    $fext = pathinfo( $fbase, PATHINFO_EXTENSION );
                    if ( !empty( $fext ) ) {
                        $fext = '.' . $fext;
                    }
                    while ( file_exists( $dir . '/' . $fname . '-' . $ext . $fext ) ) {
                        $ext++;
                    }
                    $fbase = $fname . '-' . $ext . $fext;
                }
                __~debug:uploadermylog{error_log( "copy( " . $f . ',' .  $dir . '/' . $fbase . "\n", 3, "/tmp/umylog");}
                if ( !copy( $f, $dir . '/' . $fbase ) ) {
                    $results[ "error" ] = "Error copying file " . $fbase;
                    $results[ '_status' ] = 'failed';
                    echo (json_encode($results));
                    exit();
                }
            } else {
                __~debug:uploadermylog{error_log( "same file - skipped copy( " . $f . ',' .  $dir . '/' . $fbase . "\n", 3, "/tmp/umylog");}
            }
            
            if ( !isset( $org_request[ $k ] ) || !is_array( $org_request[ $k ] ) )
            {
                $org_request[ $k ] = array();
            }
            $org_request[ $k ][] = $fbase;

            unset( $_REQUEST[ $_REQUEST[ '_selaltval_' . $k ] ] );
            unset( $_REQUEST[ '_selaltval_' . $k ] );
         } else {
            if ( $v[ 'error' ] )
            {
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
            if ( file_exists( $dir . '/' . $v[ 'name' ] ) ) {
                __~debug:uploadermylog{error_log( "going to move, but dest exists\n", 3, "/tmp/umylog" );}
                $fbase = $v[ 'name' ];
                $ext = 1;
                $fname = pathinfo( $fbase, PATHINFO_FILENAME );
                $fext = pathinfo( $fbase, PATHINFO_EXTENSION );
                if ( !empty( $fext ) ) {
                    $fext = '.' . $fext;
                }
                while ( file_exists( $dir . '/' . $fname . '-' . $ext . $fext ) ) {
                    $ext++;
                }
                $v[ 'name' ] = $fname . '-' . $ext . $fext;
            }
            __~debug:uploadermylog{error_log( "move_uploaded_file( " . $v[ 'tmp_name' ] . ',' .  $dir . '/' . $v['name'] . "\n", 3, "/tmp/umylog");}

            if ( !move_uploaded_file( $v[ 'tmp_name' ], $dir . '/' . $v[ 'name' ] ) )
            {
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
    __~debug:uploadermylog{error_log( "only numerics from:\n" . json_encode( $a, JSON_PRETTY_PRINT ) . "\nto:\n" . json_encode( $b, JSON_PRETTY_PRINT ) . "\n", 3, "/tmp/umylog" );}
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
    __~debug:uploadermylog{error_log( "last non numeric from:\n" . json_encode( $a, JSON_PRETTY_PRINT ) . "\n is " . $a[$i] . "\n", 3, "/tmp/umylog" );}
    return $a[ $i ];
}    

__~debug:uploadermylog{error_log( "last non numeric from:\n" . json_encode( $a, JSON_PRETTY_PRINT ) . "\n is " . $a[$i] . "\n", 3, "/tmp/umylog" );}

$results = [];
foreach ( $_FILES as $k=>$v ) {
    if ( !$results[ 'files' ] ) {
        $results[ 'files' ] = [];
    }
    $results[ 'files' ][ $k ] = $org_request[ $k ];
    foreach ( $results[ 'files' ][ $k ] as $k2=>$v2 ) {
        $results[ 'files' ][ $k ][ $k2 ] = "uploads/$v2";
    }
}

echo (json_encode($results));
