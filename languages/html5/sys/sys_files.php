<?php

session_start(); 

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

// $results[ '_status' ] = 'complete';

if ( $is_spec_fc = isset( $_REQUEST[ '_spec' ] ) && $_REQUEST[ '_spec' ] == "fc_cache" )
{
   $is_spec_fc_dir = isset( $_REQUEST[ '_spec_dir' ] ) ? $_REQUEST[ '_spec_dir' ] : base64_encode( "." );
   if ( !strlen( $is_spec_fc_dir ) )
   {
      $is_spec_fc_dir = base64_encode( "." );
   }
}

if ( !isset( $_SESSION[ $window ][ 'logon' ] ) ||  !strlen( $_SESSION[ $window ][ 'logon' ] )) // && !$is_spec_fc )
{
  echo '{}';
//  echo json_encode( $results );
  exit();
}

session_write_close();

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
       $to_delete = preg_replace( '/^\.\//', '', array_map( "base64_decode", explode( ',', $_REQUEST[ '_delete' ] ) ) );
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
//    $patterns = array_map(function ( $str ) { return "/$str/"; }, explode( ":", $_REQUEST[ 'pattern' ] ) );
//    error_log( print_r( $pattern, true ) . "\n", 3, "/tmp/mylog" );
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

    $outerDir = base64_decode( $outerDir64 );
    if ( $outerDir == '.' )
    {
        $outerDir64 = "#";
    }
    if ( $outerDir64 == '#' )
    {
        $outerDir = ".";
    }

    $dirs = array_diff( scandir( $outerDir ), Array( ".", ".." ) );

    foreach( $dirs as $d ) 
    {
        if ( substr( $d, -1 ) != "~" )
        {
           $id = "$outerDir/$d";

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
}

ob_start();
if ( !chdir( $dir ) )
{
  ob_end_clean();
//  echo json_encode( $results );
  echo '{}';
  exit();
}

// $usedir = isset( $_SESSION[ $window ][ 'logon' ] ) ? $_SESSION[ $window ][ 'logon' ] : ".";
$usedir = ( isset( $_SESSION[ $window ][ 'logon' ] ) && strlen( $_SESSION[ $window ][ 'logon' ] ) ) ? $_SESSION[ $window ][ 'logon' ] : ".";
if ( isset( $_REQUEST[ 'project' ] ) )
{
   $usedir .= "/" . $_REQUEST[ 'project' ];
}

if ( $is_spec_fc )
{
   if ( !is_dir( $usedir ) || !chdir( $usedir ) )
   {
     ob_end_clean();
//  echo json_encode( $results );
     echo '{}';
     exit();
   }
   if ( count( $to_delete ) )
   {
       $GLOBALS[ 'dir' ] = $dir;

//       error_log( print_r( $to_delete, true ) . "\n", 3, "/tmp/mylog" );
       $results[ 'projects' ] = get_projects( $to_delete );
       $results[ 'locked' ] = get_projects_locked( $to_delete );
//       error_log( print_r( $results, true ) . "\n", 3, "/tmp/mylog" );

       if ( count( $results[ 'locked' ] ) )
       {
           $results[ "error" ] = "The following projects are locked:<p>" . join( "<p>", $results[ 'locked' ] ) . "<p>Therefore, no files nor directories were deleted<p>If no job is running in this project, you may need to clear the lock in the job manager";
           echo json_encode( $results );   
           exit();
       }

       $dirs      = array();
       $is_dirs   = array();
       $to_delete_new = array();

       // find directories

       foreach ( $to_delete as $file )
       {
           if ( strlen( $file ) &&
                $file != "." &&
                $file != ".." &&
                file_exists( $file ) )
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
               $msg = "file does not exist";
           }
           $results[ $file ] = $msg;
       }

       $to_delete = $to_delete_new;

       // remove anything starting with a directory from to_delete

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

       // check each directory to see if a parent is present

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

       // parent_dirs_used now contains directories to be removed
       
       $remove_dirs = array();

       foreach ( $dirs as $i ) 
       {
           if ( !array_key_exists( $i, $parent_dirs_used ) )
           {
               $remove_dirs[] = $i;
           }
       }

       $remove_dirs_keys = array_flip( $remove_dirs );

       // make all_dirs in backup area
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
       
       //   $results[ "error" ] = "not yet<p>remove dirs<p>" . join( " ", $remove_dirs );;
       $results[ "log" ] = $log;

       error_log( print_r( $results, true ) . "\n", 3, "/tmp/mylog" );

       $do_cmd = 1;
       if ( isset( $do_cmd ) )
       {
          // make backup user directory if need
          $cstrong = true;
          $tmplen = 6;
          // check for bin2hex
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
          $cmd .= "// make needed directories\n";
          foreach ( $dirs_to_make as $to_make => $v )
          {
              $cmd .= "mkdir( \"$deldir/$to_make\" );\n";
          }

          $cmd .= "// move directories\n";

          foreach ( $remove_dirs as $file )
          {
              $cmd .= "rename( \"$file\", \"$deldir/$file\" );\n";
          }

          $cmd .= "// now files\n";
          foreach ( $remove_files as $file )
          {
              $cmd .= "rename( \"$file\", \"$deldir/$file\" );\n";
          }          


          $results[ 'cmd' ] = $cmd;
          error_log( "cmd = " . $cmd . "\n", 3, "/tmp/mylog" );

          // now actually do it
          $do_it = 1;
          if ( $do_it )
          {
              $dosend = array();
              ob_start();

              // make needed directories
              
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

              // move directories

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

                  if ( !rename( $file, "$deldir/$file" ) ) 
                  {
                     $cont = ob_get_contents();
                     ob_end_clean();
                     $results[ "error" ] = "Could not rename $file to $deldir/$file " . $cont;
                     error_mail( "sys_files.php\n" .
                         "during delete move directories\n" .
                             print_r( $results, true ) . "\n" . print_r( error_get_last(), true ));
                     echo (json_encode($results));
                     exit();
                  }
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
                             "since it was moved and we need to recreated it\n" .
                                 print_r( $results, true ) . "\n" . print_r( error_get_last(), true ));
                         echo (json_encode($results));
                         exit();
                      }

                      chmod( $makedir, 0775 );
                  }
                  $dosend[ "reroot" ] = 1;
              }              

              // now move files
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

                  if ( !rename( $file, "$deldir/$file" ) ) 
                  {
                     $cont = ob_get_contents();
                     ob_end_clean();
                     $results[ "error" ] = "Could not rename $file to $deldir/$file " . $cont;
                     error_mail( "sys_files.php\n" .
                         "during delete move file\n" .
                             print_r( $results, true ) . "\n" . print_r( error_get_last(), true ));
                     echo (json_encode($results));
                     exit();
                  }
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
   $usedir = $_SESSION[ $window ][ 'logon' ];
   if ( isset( $_REQUEST[ 'project' ] ) )
   {
      $usedir .= "/" . $_REQUEST[ 'project' ];
   }

   getDirectoryTree( $usedir, 0 );

   // clean up

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
   // print_r( $result_dirs );
}   
ob_end_clean();

echo json_encode( $result_dirs );
