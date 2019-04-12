#!/usr/local/bin/php
<?php

if ( $argv[ 1 ][ 0 ] == '@' ) {
    $_REQUEST = json_decode( file_get_contents( substr( $argv[ 1 ], 1 ) ), true );
} else {
    $_REQUEST = json_decode( $argv[ 1 ], true );
}

__~debug:filemanager{error_log( print_r( $_REQUEST, true ) , 3, "/tmp/mylog" );}

if ( !sizeof( $_REQUEST ) )
{
    $result[ 'error' ] = "PHP code received no \$_REQUEST?";
    echo (json_encode($result));
    exit();
}

if ( isset( $_REQUEST[ 'refresh' ] ) )
{
  $result[ "_fs_refresh" ] = "#";
  echo (json_encode($result));
  exit();
}

date_default_timezone_set("UTC");

if ( !isset( $_REQUEST[ '_logon' ] ) || !strlen( $_REQUEST[ '_logon' ] ) )
{
    $result[ 'error' ] = "PHP code received no \$_REQUEST";
    echo (json_encode($result));
    exit();
}
$logon = $_REQUEST[ '_logon' ];

function expand_dir( $dir ) {

   $result = array();

   $cdir = array_diff( scandir( $dir ), array('..', '.') );

   foreach ($cdir as $key => $value)
   {
       $f = $dir . DIRECTORY_SEPARATOR . $value;
       if ( is_dir( $f ) )
       {
           $result = array_merge( $result,  expand_dir( $f ) );
       }
       else
       {
           $result[ $f ] = true;
       }
   }
  
   return $result;
};

if ( isset( $_REQUEST[ '_udphost' ] ) &&
     isset( $_REQUEST[ '_udpport' ] ) &&
     isset( $_REQUEST[ '_uuid' ] )
    ) {
    $udp_socket = socket_create(AF_INET, SOCK_DGRAM, SOL_UDP);
    $udpmsg = Array( "_uuid"    => $_REQUEST[ '_uuid' ] );
}

function unique_file_list( $filelist ) {
// take an base64 array of list, make a set (values as array keys), find any directories and fully expand
    $uniq = array();
    foreach ( $filelist as $v ) {
        $v = base64_decode( $v );
        $uniq[ $v ] = true;
        if ( is_dir( $v ) )
        {
            $uniq = array_merge( $uniq, expand_dir( $v ) );
        }
    }
    return $uniq;
};

if ( !isset( $_REQUEST[ 'compression' ] ) )
{
    $result[ 'error' ] = "No compression method received?";
    echo (json_encode($result));
    exit();
}
        
if ( !isset( $_REQUEST[ 'selectedfiles' ] ) )
{
  $result[ 'notice' ] = "No files selected";
  echo (json_encode($result));
  exit();
}

$userdir = "results/users/$logon/";
$dir     = "__docroot:html5__/__application__/$userdir";

// change into the user directory

ob_start();
if ( !chdir( $dir ) )
{
  $cont = ob_get_contents();
  ob_end_clean();
  $result[ "error" ] = "could not change to directory " . $dir . " " . $cont;
  echo (json_encode($result));
  exit();
}
ob_end_clean();

if ( isset( $udpmsg ) ) {
    $udpmsg[ "status" ] = "<i>Collecting file information. Depending on the number of files discovered, collecting this information could take a minute or more per 100k files.</i>";
    $json_msg = json_encode( $udpmsg );
    
    socket_sendto( $udp_socket,
                   $json_msg,
                   strlen( $json_msg ),
                   0,
                   $_REQUEST[ '_udphost' ],
                   $_REQUEST[ '_udpport' ] );
}

$selfiles = array_keys( unique_file_list( $_REQUEST[ 'selectedfiles' ] ) );

if ( $_REQUEST[ 'compression' ] == "no" )
{
// simply create a set of links 
   $result[ 'outfiles' ] = array();
   foreach ( $selfiles as  $v )
   {
   //       $v =  base64_decode( $v );
       if ( !is_dir( "$dir$v" ) )
       {
           if ( !file_exists( "$dir$v" ) )
           {
              if ( isset( $result[ 'missing files' ] ) )
              {
                  $result[ 'missing files' ] .= " $v";
              } else {
                  $result[ 'missing files' ] = $v;
              }
           } else {
              array_push( $result[ 'outfiles' ], "$userdir$v" );
           }
       }
   }
   $result[ "status" ] = "";
   echo json_encode( $result );
   exit();
}

// make an array of files

$outfiles = array();

// $preg_remove_user = '/^' . $_SESSION[ $window ][ 'logon' ] . '\//';

foreach ( $selfiles as  $v )
// foreach ( $_REQUEST[ 'selectedfiles' ] as $k => $v )
{
    //  $v =  base64_decode( $v );
    if ( !is_dir( "$dir$v" ) )
    {
        if ( !file_exists( "$dir$v" ) )
        {
           if ( isset( $result[ 'missing files' ] ) )
           {
               $result[ 'missing files' ] .= " $v";
           } else {
               $result[ 'missing files' ] = $v;
           }
        } else {
//           array_push( $outfiles, preg_replace( $preg_remove_user, "", $v ) );
           array_push( $outfiles, $v );
        }
    }
}

if ( !count( $outfiles ) )
{
   $result[ "status" ] = "";
   $result[ 'error' ] = 'no existing files found';
   echo json_encode( $result );
   exit();
}

$pkgname = "__application___${logon}_" . date( "YmdHisT", time() );

// setup the command

$cmd = "";
switch( $_REQUEST[ 'compression' ] )
{
   case "tar" :
      $cmd = "tar cf ";
      $suffix = ".tar";
      $add = " -T -";
      break;
   case "gz" :
      $cmd = "tar zcf ";
      $suffix = ".tar.gz";
      $add = " -T -";
      break;
   case "bz2" :
      $cmd = "tar jcf ";
      $suffix = ".tar.bz2";
      $add = " -T -";
      break;
   case "xz" :
      $cmd = "tar Jcf ";
      $suffix = ".tar.xz";
      $add = " -T -";
      break;
   case "zip" :
      $cmd = "xargs -d '\\n' zip";
      $suffix = ".zip";
      $add = " -@";
      break;
   default :
      $result[ "error" ] = "unsupported compression method " . $_REQUEST[ 'compression' ];
      $result[ "status" ] = "";
      echo (json_encode($result));
      exit();
}

$odir = $_REQUEST[ '_base_directory' ];

$target = $odir . "/" . $pkgname . $suffix;

$filelist = $odir . "/_file_list";

ob_start();
if ( false === file_put_contents( $filelist, join( "\n", $outfiles ) . "\n" ) )
{
   $cont = ob_get_contents();
   ob_end_clean();
   $result[ "status" ] = "";
   $result[ "error" ] = "could not create write filenames " . $filelist . " " . $cont;
   echo (json_encode($result));
   exit();
}
ob_end_clean();

// instead write outfiles to file in $odir and cat | xargs...

if ( isset( $udpmsg ) ) {
    $udpmsg[ "status" ] = "<i>starting " . $_REQUEST[ 'compression' ] . " compression of selected files</i>";
    $json_msg = json_encode( $udpmsg );
    
    socket_sendto( $udp_socket,
                   $json_msg,
                   strlen( $json_msg ),
                   0,
                   $_REQUEST[ '_udphost' ],
                   $_REQUEST[ '_udpport' ] );
}

$cmd = "cat $filelist | $cmd $target $add";

switch ( $pid = pcntl_fork() ) {
    case -1 : {
        $result[ "status" ] = "";
        $result[ error ] = "Server error: unable to create process";
        break;
    }

    case 0 : {
        ob_start();
        exec ( $cmd );
        $cont = ob_get_contents();
        ob_end_clean();
        if ( strlen( $cont ) ) {
            $result[ 'archiving reported' ] = $cont;
        }
        exit;
        break;
    }        

    default : {
        $count = 0;
        $sz = 0;
        foreach ( $outfiles as $v ) {
            $stat = stat( $v );
            $sz += $stat[ 'size' ];
        }
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
        $totsz = "$sz $sx";

        if ( !pcntl_waitpid( $pid, $status, WNOHANG ) ) {
            do {
                $res = pcntl_waitpid( $pid, $status, WNOHANG );
                if ( $udpmsg && !$res && !( ++$count % 5 ) ) {
                    clearstatcache();
                    $stat = stat( $target );
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

                    $udpmsg[ "status" ] = "<i>" . $_REQUEST[ 'compression' ] . " compression of files totaling $totsz is currently $sz $sx</i>";
                    $json_msg = json_encode( $udpmsg );
                    
                    socket_sendto( $udp_socket,
                                   $json_msg,
                                   strlen( $json_msg ),
                                   0,
                                   $_REQUEST[ '_udphost' ],
                                   $_REQUEST[ '_udpport' ] );
                }
                if ( !$res ) {
                    sleep( 1 );
                }
            } while( !$res );
        }
        break;
    }        
}

clearstatcache();
$stat = stat( $target );
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

$result[ 'status' ] = "<i>Completed: " . $_REQUEST[ 'compression' ] . " compression of files totaling $totsz resulted in a file of $sz $sx</i>";
$result[ 'outfiles' ] = array( str_replace( "__docroot:html5__/__application__/", "", $target ) );

// $result[ 'outfile_tag' ] = $result[ 'outfiles' ][ 0 ];
echo json_encode( $result );
