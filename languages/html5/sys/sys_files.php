<?php

session_name( strtoupper( preg_replace('/[^a-zA-Z0-9_]+/', '_', "GENAPP___application__" ) ) ); session_start();

require_once "__docroot:html5__/__application__/ajax/ga_filter.php";

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
   $GLOBALS[ 'window' ] = $window;
}
if ( !isset( $_SESSION[ $window ] ) )
{
   $_SESSION[ $window ] = array( "logon" => "", "project" => "" );
}

## $results[ '_status' ] = 'complete';

if ( $is_spec_fc = isset( $_REQUEST[ '_spec' ] ) && $_REQUEST[ '_spec' ] == "fc_cache" )
{
   $is_spec_fc_dir = isset( $_REQUEST[ '_spec_dir' ] ) ? $_REQUEST[ '_spec_dir' ] : base64_encode( "." );
   if ( !strlen( $is_spec_fc_dir ) )
   {
      $is_spec_fc_dir = base64_encode( "." );
   }
}

if ( !isset( $_SESSION[ $window ][ 'logon' ] ) ||  !strlen( $_SESSION[ $window ][ 'logon' ] )) ## && !$is_spec_fc )
{
  echo '{}';
##  echo json_encode( $results );
  exit();
}

function debug_json( $msg, $obj ) {
    return $msg . ":\n" . json_encode( $obj, JSON_PRETTY_PRINT ) . "\n";
}

## File Manager receives identifiers from a browser.  Base64 only transports a
## value; it is not authorization to address a path outside the authenticated
## user's result tree.
function ga_file_manager_relative_path( $encoded, $allow_root = false )
{
    if ( !is_string( $encoded ) || !strlen( $encoded ) ) {
        return false;
    }
    $path = base64_decode( $encoded, true );
    if ( $path === false || strpos( $path, "\0" ) !== false ||
         strpos( $path, '\\' ) !== false || preg_match( '#^/#', $path ) ) {
        return false;
    }
    $path = preg_replace( '#^\./#', '', $path );
    if ( $allow_root && ( $path === '' || $path === '.' ) ) {
        return '';
    }
    if ( !strlen( $path ) || preg_match( '#(^|/)\.{1,2}(/|$)#', $path ) ||
         preg_match( '#//|/$#', $path ) ) {
        return false;
    }
    foreach ( explode( '/', $path ) as $component ) {
        if ( !preg_match( '/^[A-Za-z0-9][A-Za-z0-9._ -]*$/', $component ) ) {
            return false;
        }
    }
    return $path;
}

function ga_file_manager_path_is_within( $path, $root )
{
    return $path == $root || strpos( $path, $root . DIRECTORY_SEPARATOR ) === 0;
}

function ga_file_manager_resolve_path( $root, $relative, $allow_root = false )
{
    if ( !is_string( $root ) || !is_string( $relative ) ||
         ( !$allow_root && !strlen( $relative ) ) ) {
        return false;
    }
    $path = $root . ( strlen( $relative ) ? DIRECTORY_SEPARATOR . $relative : '' );
    $resolved = realpath( $path );
    if ( $resolved === false || !ga_file_manager_path_is_within( $resolved, $root ) ) {
        return false;
    }
    $cursor = $root;
    foreach ( strlen( $relative ) ? explode( '/', $relative ) : array() as $component ) {
        $cursor .= DIRECTORY_SEPARATOR . $component;
        if ( is_link( $cursor ) ) {
            return false;
        }
    }
    return $resolved;
}

function ga_file_manager_copy_tree( $source, $target )
{
    if ( is_link( $source ) ) {
        return false;
    }
    if ( is_file( $source ) ) {
        return copy( $source, $target );
    }
    if ( !is_dir( $source ) || !mkdir( $target, 0775, true ) ) {
        return false;
    }
    foreach ( array_diff( scandir( $source ), array( '.', '..' ) ) as $name ) {
        if ( !ga_file_manager_copy_tree( $source . DIRECTORY_SEPARATOR . $name, $target . DIRECTORY_SEPARATOR . $name ) ) {
            return false;
        }
    }
    return true;
}

function ga_file_manager_remove_tree( $path )
{
    if ( is_link( $path ) ) {
        return false;
    }
    if ( is_file( $path ) ) {
        return unlink( $path );
    }
    if ( !is_dir( $path ) ) {
        return false;
    }
    foreach ( array_diff( scandir( $path ), array( '.', '..' ) ) as $name ) {
        if ( !ga_file_manager_remove_tree( $path . DIRECTORY_SEPARATOR . $name ) ) {
            return false;
        }
    }
    return rmdir( $path );
}

function ga_file_manager_move( $source, $target )
{
    if ( rename( $source, $target ) ) {
        return true;
    }
    if ( !ga_file_manager_copy_tree( $source, $target ) ) {
        if ( file_exists( $target ) ) {
            ga_file_manager_remove_tree( $target );
        }
        return false;
    }
    if ( ga_file_manager_remove_tree( $source ) ) {
        return true;
    }
    ga_file_manager_remove_tree( $target );
    return false;
}

function ga_file_manager_restore_moves( $deldir, $paths )
{
    $errors = array();
    foreach ( array_reverse( $paths ) as $path ) {
        if ( file_exists( "$deldir/$path" ) && !ga_file_manager_move( "$deldir/$path", $path ) ) {
            $errors[] = $path;
        }
    }
    return $errors;
}

$to_delete = array();

if ( isset( $_REQUEST[ '_delete' ] ) )
{
   if ( !isset( $_SESSION[ $window ][ 'logon' ] ) || !strlen( $_SESSION[ $window ][ 'logon' ] ) )
   {
       echo '{error:"not logged in"}';
       exit();
   }
   $GLOBALS[ 'logon' ] = $_SESSION[ $window ][ 'logon' ];

   if ( strlen( $_REQUEST[ '_delete' ] ) )
   {
      foreach ( explode( ',', $_REQUEST[ '_delete' ] ) as $encoded ) {
          $path = ga_file_manager_relative_path( $encoded );
          if ( $path === false ) {
              echo '{"error":"Invalid File Manager path"}';
              exit();
          }
          $to_delete[] = $path;
      }
   }

   if ( !count( $to_delete ) )
   {
       echo '{"error":"Delete requested with no files"}';
       exit();
   }
}

date_default_timezone_set("UTC");

$result_dirs = array();

$no_pattern = !isset( $_REQUEST[ 'pattern' ] );

if ( !$no_pattern )
{
##    $patterns = array_map(function ( $str ) { return "/$str/"; }, explode( ":", $_REQUEST[ 'pattern' ] ) );
##    error_log( print_r( $pattern, true ) . "\n", 3, "/tmp/mylog" );
    $pattern = "/" . $_REQUEST[ 'pattern' ] . "/i";
}

$refd_dirs = array();
$pos_dirs = array();

function getDirectoryTree( $outerDir, $depth ) {
    global $result_dirs;
    global $refd_dirs;
    global $pos_dirs;
    global $pattern;
    global $no_pattern;

    $dirs = array_diff( scandir( $outerDir ), Array( ".", ".." ) );

    foreach( $dirs as $d ) 
    {
        if ( substr( $d, -1 ) != "~" )
        {
           $id = "$outerDir/$d";

           if ( is_link( $id ) )
           {
               continue;
           }

           if( is_dir( $id ) )
           {
               $b64od = ( $depth == 0 ? "#" : base64_encode( $outerDir ) );
               $refd_dirs[ $b64od ] = 1;
               $b64d = base64_encode( $id );
               $pos_dirs[ $b64d ] = count( $result_dirs );
               
               array_push( $result_dirs, array( "id"     => $b64d,
                                                "parent" => $b64od,
                                                "text"   => "<b>$d</b>"
                                                ) );
               getDirectoryTree( $id, $depth + 1 );
           } else {
               if ( $no_pattern || preg_match( $pattern, $d ) )
               {
                  $stat = stat( $outerDir."/".$d );

                  $sz = $stat[ 'size' ];
                  $sx = 'b';
                  if ( $sz > 1024 )
                  { 
                      $sz /= 1024;
                      $sx = "Kb";
                      if ( $sz > 1024 )
                      { 
                          $sz /= 1024;
                          $sx = "Mb";
                          if ( $sz >= 1024 )
                          { 
                              $sz /= 1024;
                              $sx = "Gb";
                              if ( $sz >= 1024 )
                              { 
                                  $sz /= 1024;
                                  $sx = "Tb";
                                  if ( $sz >= 1024 )
                                  { 
                                      $sz /= 1024;
                                      $sx = "Pb";
                                  }
                              }
                          }
                      }
                      $sz = round( $sz, 2 );
                   }
    
                   $ss = "<b>$d</b> | <i>$sz$sx</i> | " . date( "Y M d H:i:s T", $stat[ 'mtime' ] ) . " ";

                   $b64od = ( $depth == 0 ? "#" : base64_encode( $outerDir ) );
                   $refd_dirs[ $b64od ] = 1;

                   array_push( $result_dirs, array( "id"     => base64_encode( $id ),
                                                    "parent" => $b64od,
                                                    "text"   => $ss
                                                    ) );
               }
            }
        }
    }
}

function getDirectory( $outerDir64 ) {
    global $result_dirs;
    global $refd_dirs;
    global $pos_dirs;
    global $pattern;
    global $no_pattern;

    $relative = $outerDir64 == '#'
        ? '' : ga_file_manager_relative_path( $outerDir64, true );
    if ( $relative === false ) {
        return;
    }
    $outerDir = strlen( $relative ) ? "./$relative" : ".";
    if ( $outerDir64 == '#' ) {
        $outerDir64 = '#';
    }

    $dirs = array_diff( scandir( $outerDir ), Array( ".", ".." ) );

    foreach( $dirs as $d ) 
    {
        if ( substr( $d, -1 ) != "~" )
        {
           $id = "$outerDir/$d";

           if ( is_link( $id ) )
           {
               continue;
           }

           if( is_dir( $id ) )
           {
               $refd_dirs[ $outerDir64 ] = 1;
               $b64d = base64_encode( $id );
               $pos_dirs[ $b64d ] = count( $result_dirs );
               
               array_push( $result_dirs, array( "id"       => $b64d,
                                                "parent"   => $outerDir64,
                                                "children" => true,
                                                "text"     => "<b>$d</b>"
                                                ) );
           } else {
               if ( $no_pattern || preg_match( $pattern, $d ) )
               {
                  $stat = stat( $outerDir."/".$d );

                  $sz = $stat[ 'size' ];
                  $sx = 'b';
                  if ( $sz > 1024 )
                  { 
                      $sz /= 1024;
                      $sx = "Kb";
                      if ( $sz > 1024 )
                      { 
                          $sz /= 1024;
                          $sx = "Mb";
                          if ( $sz >= 1024 )
                          { 
                              $sz /= 1024;
                              $sx = "Gb";
                              if ( $sz >= 1024 )
                              { 
                                  $sz /= 1024;
                                  $sx = "Tb";
                                  if ( $sz >= 1024 )
                                  { 
                                      $sz /= 1024;
                                      $sx = "Pb";
                                  }
                              }
                          }
                      }
                      $sz = round( $sz, 2 );
                   }
    
                   $ss = "<b>$d</b> | <i>$sz$sx</i> | " . date( "Y M d H:i:s T", $stat[ 'mtime' ] ) . " ";

                   $refd_dirs[ $outerDir64 ] = 1;

                   array_push( $result_dirs, array( "id"     => base64_encode( $id ),
                                                    "parent" => $outerDir64,
                                                    "text"   => $ss
                                                    ) );
               }
            }
        }
    }
}

$dir = "__docroot:html5__/__application__/results/users/";

if ( $is_spec_fc &&  count( $to_delete ) )
{
    require '../joblog.php';
    require '../mail.php';
    $active_project_names = active_project_names( $_SESSION[ $window ][ 'logon' ], true );
    if ( $active_project_names === false )
    {
        echo '{"error":"Could not verify active projects"}';
        exit();
    }
}

ob_start();
if ( !chdir( $dir ) )
{
  ob_end_clean();
##  echo json_encode( $results );
  echo '{}';
  exit();
}

$users_root = realpath( $dir );
$user_root = realpath( $dir . ( isset( $_SESSION[ $window ][ 'logon' ] ) ? $_SESSION[ $window ][ 'logon' ] : '' ) );
if ( $users_root === false || $user_root === false || !is_dir( $user_root ) ||
     !ga_file_manager_path_is_within( $user_root, $users_root ) || is_link( $user_root ) || !chdir( $user_root ) )
{
  ob_end_clean();
  echo '{"error":"Could not access File Manager user directory"}';
  exit();
}

## $usedir = isset( $_SESSION[ $window ][ 'logon' ] ) ? $_SESSION[ $window ][ 'logon' ] : ".";
$usedir = ".";
if ( isset( $_REQUEST[ 'project' ] ) )
{
   if ( !preg_match( '/^[A-Za-z0-9_]+$/', $_REQUEST[ 'project' ] ) ||
        !is_dir( "./" . $_REQUEST[ 'project' ] ) || is_link( "./" . $_REQUEST[ 'project' ] ) )
   {
      ob_end_clean();
      echo '{"error":"Invalid File Manager project"}';
      exit();
   }
   $usedir = "./" . $_REQUEST[ 'project' ];
}

if ( $is_spec_fc )
{
   if ( !is_dir( $usedir ) || !chdir( $usedir ) )
   {
     ob_end_clean();
##  echo json_encode( $results );
     echo '{}';
     exit();
   }
   if ( count( $to_delete ) )
   {
       $GLOBALS[ 'dir' ] = $dir;

##       error_log( print_r( $to_delete, true ) . "\n", 3, "/tmp/mylog" );
       $results[ 'projects' ] = get_projects( $to_delete );
       $results[ 'locked' ] = get_projects_locked( $to_delete );
##       error_log( print_r( $results, true ) . "\n", 3, "/tmp/mylog" );

       if ( count( $results[ 'locked' ] ) )
       {
           $results[ "error" ] = "The following projects are locked:<p>" . join( "<p>", $results[ 'locked' ] ) . "<p>Therefore, no files nor directories were deleted<p>If no job is running in this project, you may need to clear the lock in the job manager";
           echo json_encode( $results );   
           exit();
       }

       $dirs      = array();
       $is_dirs   = array();
       $to_delete_new = array();

       ## find directories

       foreach ( $to_delete as $file )
       {
           if ( strlen( $file ) &&
                ga_file_manager_resolve_path( $user_root, $file ) !== false )
           {
               if ( is_dir( $file ) )
               {
                   $is_dirs[ $file ] = 1;
                   $msg = "directory";
                   $dirs[] = $file;
                } else {
                   $msg = "regular file";
               }
               $to_delete_new[] = $file;
           } else {
               $msg = "file does not exist or is outside the File Manager directory";
               $results[ $file ] = $msg;
               $results[ "error" ] = "No files or directories were removed because one selected path is unavailable or invalid";
               echo json_encode( $results );
               exit();
           }
           $results[ $file ] = $msg;
       }

       $to_delete = $to_delete_new;

       ## A selected, registered top-level directory is a user project root.
       ## Nested directories and unregistered top-level directories remain
       ## ordinary file-manager removals.  The browser's tree depth is not an
       ## authority for this lifecycle decision.
       $deleted_project_roots = array();
       foreach ( $to_delete as $file )
       {
           if ( array_key_exists( $file, $is_dirs ) &&
                strpos( $file, '/' ) === false &&
                $file != 'no_project_specified' &&
                in_array( $file, $active_project_names, true ) )
           {
               $deleted_project_roots[] = $file;
           }
       }

       ## remove anything starting with a directory from to_delete

       $dont_use = array();
       
       foreach ( $to_delete as $file )
       {
           foreach ( $dirs as $ddir )
           {
               if ( !strncmp( $file, $ddir, strlen( $ddir ) ) )
               {
                   $dont_use[ $file ] = 1;
               }
           }
       }
       
       $remove_files       = array();

       foreach ( $to_delete as $file )
       {
           if ( !array_key_exists( $file, $dont_use ) &&
                !array_key_exists( $file, $is_dirs) )
           {
               $remove_files[] = $file;
           }
       }

       ## check each directory to see if a parent is present

       $dirs_keys = array_flip( $dirs );

       $parent_dirs_used = array();

       foreach ( $dirs as $i ) 
       {
           $up_one = $i;
           do {
               $prev   = $up_one;
               $up_one = dirname( $up_one );
               if ( $prev == $up_one || $up_one == "." )
               {
                   break;
               }
               if ( array_key_exists( $up_one, $dirs_keys ) )
               {
                   $parent_dirs_used[$i] = 1;
                   break;
               }
           } while( 1 );
       }

       ## parent_dirs_used now contains directories to be removed
       
       $remove_dirs = array();

       foreach ( $dirs as $i ) 
       {
           if ( !array_key_exists( $i, $parent_dirs_used ) )
           {
               $remove_dirs[] = $i;
           }
       }

       $remove_dirs_keys = array_flip( $remove_dirs );

       ## make all_dirs in backup area
       $dirs_to_make = array();

       $log = "";
       foreach ( $remove_files as $file )
       {
           if ( array_key_exists( $file, $is_dirs ) && !array_key_exists( $file, $remove_dirs_keys ) )
           {
               $dirs_to_make[ $file ] = 1;
               $log .= "$file dirs to make case 1\n";
           } else {
               $up_one = dirname( $file );
               if ( $up_one != $file && $up_one != "." && !array_key_exists( $up_one, $is_dirs ) && !array_key_exists( $up_one, $remove_dirs_keys ) )
               {
                   $dirs_to_make[ $up_one ] = 1;
                   $log .= "$file dirs to make case 2\n";
               }
           }
       }        
       
       $results[ "to_delete" ] = $to_delete;
       $results[ "remove_files" ] = $remove_files;
       $results[ "remove_dirs" ] = $remove_dirs;
       $results[ "dirs_to_make" ] = $dirs_to_make;
       $results[ "dirs_keys" ] = $dirs_keys;
       $results[ "parent_dirs_used" ] = $parent_dirs_used;
       
       ##   $results[ "error" ] = "not yet<p>remove dirs<p>" . join( " ", $remove_dirs );;
       $results[ "log" ] = $log;

       error_log( print_r( $results, true ) . "\n", 3, "/tmp/mylog" );

       $do_cmd = 1;
       if ( isset( $do_cmd ) )
       {
          ## make backup user directory if need
          $cstrong = true;
          $tmplen = 6;
          ## check for bin2hex
          $uniq = bin2hex( openssl_random_pseudo_bytes ( $tmplen, $cstrong ) );
          if ( strlen( $uniq ) != $tmplen * 2 )
          {
              $results[ "error" ] = "Internal error: bin2hex not working for creating temporary area<p>A message is being sent to the server administrators";
              error_mail( "sys_files.php\n" .
                          "deldir $deldir\n" .
                          "uniq $uniq expected length " . ( $tmplen * 2 ) . ", actual " . strlen( $uniq ) . "\n" . 
                          $results[ "error" ] );
              echo (json_encode($results));
              exit();
          }

          $deldir = "__docroot:html5__/__application__/deleted/users/" . $GLOBALS[ 'logon' ] . "/" . $uniq;
          $tries = 0;
          while ( file_exists( $deldir ) )
          {
              $deldir = "__docroot:html5__/__application__/deleted/users/" . $GLOBALS[ 'logon' ] . "/" . bin2hex( openssl_random_pseudo_bytes ( 6, $cstrong ) );
              if ( ++$tries > 100 )
              {
                  $results[ "error" ] = "Internal error: over 100 tries to make a random directory<p>A message is being sent to the server administrators";
                  error_mail( "sys_files.php\n" .
                              "deldir $deldir\n" .
                              $results[ "error" ] );
                  echo (json_encode($results));
                  exit();
              }
          }       
          ob_start();

          if ( !mkdir( $deldir, 0777, true ) )
          {  
             $cont = ob_get_contents();
             ob_end_clean();
             $results[ "error" ] = "Could not create directory " . $deldir . " " . $cont;
             error_mail( "sys_files.php\n" .
                         "during delete mkdir\n" .
                         $results[ "error" ] );
             echo (json_encode($results));
             exit();
          }
          chmod( $deldir, 0775 );
          ob_end_clean();

          $cmd = "";
          $cmd .= "## make needed directories\n";
          foreach ( $dirs_to_make as $to_make => $v )
          {
              $cmd .= "mkdir( \"$deldir/$to_make\" );\n";
          }

          $cmd .= "## move directories\n";

          foreach ( $remove_dirs as $file )
          {
              $cmd .= "rename( \"$file\", \"$deldir/$file\" );\n";
          }

          $cmd .= "## now files\n";
          foreach ( $remove_files as $file )
          {
              $cmd .= "rename( \"$file\", \"$deldir/$file\" );\n";
          }          


          $results[ 'cmd' ] = $cmd;
          error_log( "cmd = " . $cmd . "\n", 3, "/tmp/mylog" );

          ## now actually do it
          
          ## to debug:
          ##  set directives:debug:deletefile2file to store in /tmp/delete.log & do not process
          ## ** or **
          ##  set directives:debug:deletefile2email to send via email & do not process
          ## ** or **
          ##  set directives:debug:deletefile to store in /tmp/delete.log & continue processing

          $debug_to_email = 0;
          __~debug:deletefile2email{$debug_to_email = 1;}
          if ( $debug_to_email ) {
              $results[ "error" ] = "Debugging on, nothing removed, email sent";
              error_mail( "sys_files.php\n" .
                          "Debugging information\n" .
                          print_r( $results, true ) . "\n" . print_r( error_get_last(), true ));
              echo (json_encode($results));
              exit();
          }

          $debug_to_file = 0;
          __~debug:deletefile2file{$debug_to_file = 1;}
          if ( $debug_to_file ) {
              error_log( debug_json( "sys_files.php - debug\n", $results ) . "\ncmd:\n" . $results[ 'cmd' ] . "\n", 3, "/tmp/delete.log" );
              $results[ "error" ] = "Debugging on, nothing removed, cmds saved";
              echo (json_encode($results));
              exit();
          }

          $debug_file = 0;
          __~debug:deletefile{$debug_file = 1;}
          if ( $debug_file ) {
              error_log( debug_json( "sys_files.php - debug\n", $results ) . "\ncmd:\n" . $results[ 'cmd' ] . "\n", 3, "/tmp/delete.log" );
          }

          $do_it = 1;
          if ( $do_it )
          {
              $dosend = array();
              $moved_paths = array();
              ob_start();

              ## make needed directories
              
              foreach ( $dirs_to_make as $to_make => $v )
              {
                  $makedir = "$deldir/$to_make";
                  if ( !mkdir( $makedir, 0777, true ) )
                  {  
                     $cont = ob_get_contents();
                     ob_end_clean();
                     $results[ "error" ] = "Could not create directory " . $makedir . " " . $cont;
                     error_mail( "sys_files.php\n" .
                         "during delete make needed directories mkdir\n" .
                             print_r( $results, true ) . "\n" . print_r( error_get_last(), true ));
                     echo (json_encode($results));
                     exit();
                  }
                  chmod( $makedir, 0775 );
              }

              ## move directories

              foreach ( $remove_dirs as $file )
              {
                  $target = dirname( "$deldir/$file" );
                  if ( !is_dir( $target ) )
                  {
                      $makedir = $target;
                      if ( !mkdir( $makedir, 0777, true ) )
                      {  
                         $cont = ob_get_contents();
                         ob_end_clean();
                         $results[ "error" ] = "Could not create directory " . $makedir . " " . $cont;
                         error_mail( "sys_files.php\n" .
                             "during delete make needed directories mkdir\n" .
                                 print_r( $results, true ) . "\n" . print_r( error_get_last(), true ));
                         echo (json_encode($results));
                         exit();
                      }

                      chmod( $makedir, 0775 );
                  }

                  if ( !ga_file_manager_move( $file, "$deldir/$file" ) )
                  {
                     $cont = ob_get_contents();
                     ob_end_clean();
                     $restore_errors = ga_file_manager_restore_moves( $deldir, $moved_paths );
                     $results[ "error" ] = "Could not move $file to $deldir/$file " . $cont;
                     if ( count( $restore_errors ) ) {
                         $results[ "error" ] .= " Administrator recovery is required for: " . join( ', ', $restore_errors );
                     }
                     error_mail( "sys_files.php\n" .
                                 "during delete move directories\n" .
                                 print_r( $results, true ) . "\n" . print_r( error_get_last(), true ));
                     echo (json_encode($results));
                     exit();
                  }
                  $moved_paths[] = $file;
              }

              $usernps = $dir . $GLOBALS[ 'logon' ] . "/no_project_specified";
              if ( !file_exists( $usernps ) )
              {
                  $target = $usernps;
                  if ( !is_dir( $target ) )
                  {
                      $makedir = $target;
                      if ( !mkdir( $makedir, 0777, true ) )
                      {  
                         $cont = ob_get_contents();
                         ob_end_clean();
                         $results[ "error" ] = "Could not create directory " . $makedir . " " . $cont;
                         error_mail( "sys_files.php\n" .
                             "since it was moved and we need to recreate it\n" .
                                 print_r( $results, true ) . "\n" . print_r( error_get_last(), true ));
                         echo (json_encode($results));
                         exit();
                      }

                      chmod( $makedir, 0775 );
                  }
                  $dosend[ "reroot" ] = 1;
              }              

              ## now move files
              foreach ( $remove_files as $file )
              {
                  $target = dirname( "$deldir/$file" );
                  if ( !is_dir( $target ) )
                  {
                      $makedir = $target;
                      if ( !mkdir( $makedir, 0777, true ) )
                      {  
                         $cont = ob_get_contents();
                         ob_end_clean();
                         $results[ "error" ] = "Could not create directory " . $makedir . " " . $cont;
                         error_mail( "sys_files.php\n" .
                             "during delete make needed directories mkdir\n" .
                                 print_r( $results, true ) . "\n" . print_r( error_get_last(), true ));
                         echo (json_encode($results));
                         exit();
                      }

                      chmod( $makedir, 0775 );
                  }

                  if ( !ga_file_manager_move( $file, "$deldir/$file" ) )
                  {
                     $cont = ob_get_contents();
                     ob_end_clean();
                     $restore_errors = ga_file_manager_restore_moves( $deldir, $moved_paths );
                     $results[ "error" ] = "Could not rename $file to $deldir/$file " . $cont;
                     if ( count( $restore_errors ) ) {
                         $results[ "error" ] .= " Administrator recovery is required for: " . join( ', ', $restore_errors );
                     }
                     error_mail( "sys_files.php\n" .
                         "during delete move file\n" .
                             print_r( $results, true ) . "\n" . print_r( error_get_last(), true ));
                     echo (json_encode($results));
                     exit();
                  }
                  $moved_paths[] = $file;
              }

              ## A deleted directory must not leave a replayable job behind in
              ## its retained log directory.  The deletion token lets a later
              ## rollback undo only the records changed by this request.
              $invalidated_job_ids = job_saved_path_is_removed(
                  $GLOBALS[ 'logon' ], $remove_dirs, $uniq, true );
              if ( $invalidated_job_ids === false )
              {
                  $restore_errors = array();
                  $restore_errors = ga_file_manager_restore_moves( $deldir, $moved_paths );
                  $results[ 'error' ] = count( $restore_errors )
                      ? "Could not record removed job files; administrator recovery is required for: " . join( ', ', $restore_errors )
                      : "Could not record removed job files; the selected files were restored.";
                  echo json_encode( $results );
                  exit();
              }

              if ( count( $deleted_project_roots ) )
              {
                  if ( !remove_active_projects( $GLOBALS[ 'logon' ], $deleted_project_roots, true ) )
                  {
                      restore_job_saved_paths( $invalidated_job_ids, $uniq, true );
                      $restore_errors = array();
                      $restore_errors = ga_file_manager_restore_moves( $deldir, $moved_paths );
                      $results[ 'error' ] = count( $restore_errors )
                          ? "Could not remove project records; project directories requiring administrator recovery: " . join( ', ', $restore_errors )
                          : "Could not remove project records; project directories were restored.";
                      echo json_encode( $results );
                      exit();
                  }

                  ## PHP sessions are shared by browser windows.  Do not leave
                  ## another window pointed at an active project identity that
                  ## was just deleted.
                  foreach ( $_SESSION as $session_window => &$session_state )
                  {
                      if ( is_array( $session_state ) &&
                           isset( $session_state[ 'logon' ] ) &&
                           $session_state[ 'logon' ] == $GLOBALS[ 'logon' ] &&
                           isset( $session_state[ 'project' ] ) &&
                           in_array( $session_state[ 'project' ], $deleted_project_roots, true ) )
                      {
                          $session_state[ 'project' ] = 'no_project_specified';
                      }
                  }
                  unset( $session_state );
                  $dosend[ 'deleted_projects' ] = $deleted_project_roots;
                  $dosend[ '_project' ] = isset( $_SESSION[ $window ][ 'project' ] )
                      ? $_SESSION[ $window ][ 'project' ] : 'no_project_specified';
              }
              ob_end_clean();

              echo json_encode( $dosend );
              exit();
          }                
       }
       $results[ "error" ] = "not yet";
       echo json_encode( $results );   
       exit();
   } else {
       getDirectory( $is_spec_fc_dir );
   }
} else {
   getDirectoryTree( $usedir, 0 );

   ## clean up

   $any_unset = 0;
   foreach ( $pos_dirs as $k=>$v )
   {
      if ( !isset( $refd_dirs[ $k ] ) )
      {
         if ( $no_pattern )
         {
            $result_dirs[ $v ][ "text" ] .= " <i> empty directory</i>";
         } else {
            unset( $result_dirs[ $v ] );
            $any_unset = 1;
         }
      }
   }
   if ( $any_unset )
   {
      $result_dirs = array_values( $result_dirs );
   }
   ## print_r( $result_dirs );
}   
ob_end_clean();

echo json_encode( $result_dirs );
