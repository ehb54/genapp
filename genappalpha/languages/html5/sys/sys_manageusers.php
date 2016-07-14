#!/usr/local/bin/php
<?php

$_REQUEST = json_decode( $argv[ 1 ], true );

$results = [];

if ( !sizeof( $_REQUEST ) ) {
    $results[ 'error' ] = "PHP code received no \$_REQUEST?";
    echo (json_encode($results));
    exit();
}

if ( !isset( $_REQUEST[ '_uuid' ] ) ) {
    $results[ "error" ] = "No _uuid specified in the request";
    echo (json_encode($results));
    exit();
}

if ( !isset( $_REQUEST[ '_logon' ] ) ) {
    $results[ "error" ] = "No _logon specified in the request";
    echo (json_encode($results));
    exit();
}

$appconfig = json_decode( file_get_contents( "__appconfig__" ) );

if ( !isset( $appconfig->restricted ) ) {
    $results[ "error" ] = "appconfig.json no restrictions defined";
    echo (json_encode($results));
    exit();
}    

if ( !isset( $appconfig->restricted->admin ) ) {
    $results[ "error" ] = "appconfig.json no adminstrators defined";
    echo (json_encode($results));
    exit();
}    

if ( !in_array( $_REQUEST[ '_logon' ], $appconfig->restricted->admin ) ) {
    $results[ "error" ] = "not an administrator";
    echo (json_encode($results));
    exit();
}    

date_default_timezone_set("UTC");

function db_connect( $error_json_exit = false ) {
   global $use_db;
   global $db_errors;

   if ( !isset( $use_db ) ) {
      try {
         $use_db = new MongoClient();
      } catch ( Exception $e ) {
         $db_errors = "Could not connect to the db " . $e->getMessage();
         if ( $error_json_exit )
         {
            $results = array( "error" => $db_errors );
            $results[ '_status' ] = 'complete';
            echo (json_encode($results));
            exit();
         }
         return false;
      }
   }

   return true;
}

function get_userinfo( $error_json_exit = false ) {
   global $use_db;
   global $db_errors;
   global $appconfig;
   global $userinfo;
   global $nowsecs;

   $userinfo = [];
   $userinfo[ 'data'    ] = [];
   $userinfo[ 'buttons' ] = [];
   $userinfo[ 'script'  ] = [];
   $userinfo[ 'tagline' ] = [];

   if ( !db_connect( $error_json_exit ) )
   {
       return false;
   }

   $nowsecs = microtime( true );

   $runcount = [];

   $runs = $use_db->__application__->running->find();
   foreach ( $runs as $v ) {
       $uuid = $v['_id'];
       $job = $use_db->__application__->jobs->findOne( array( "_id" => $uuid ), array( "user" => 1 ) );
       $name = $job[ 'user' ];
       if ( !isset( $runcount[ $name ] ) ) {
           $runcount[ $name ] = 1;
       } else {
           $runcount[ $name ]++;
       }
   }

   $users = $use_db->__application__->users->find();

   $users->sort( array( "name" => 1 ) );

   foreach ( $users as $v ) {
       $name = $v[ 'name' ];
       if ( substr( $name, 0, strlen( "_canceled" ) ) != "_canceled" ) {
           $userinfo['data'][] = 
               array( 
                   "name"                => $name
                   ,"email"              => "<a class='title' href='mailto:" . $v[ 'email' ] . "'>" . $v[ 'email' ] . "</a>"
                   ,"projects"           => count( $v[ 'project' ] )
                   ,"last-login"         => isset( $v["lastlogin"] ) ? date( "Y M d H:i T",$v["lastlogin"]->sec ) : ""
                   ,"registered"         => isset( $v["registered"] ) ? date( "Y M d H:i T",$v["registered"]->sec ) : ""
                   ,"jobs-not-removed"   => $use_db->__application__->jobs->count( array( "user" => $name ) )
                   ,"running"            => isset( $runcount[ $name ] ) ? $runcount[ $name ] : 0
                   ,"admin"              => in_array( $v[ 'name' ], $appconfig->restricted->admin ) ? "yes" : ""
               );

           if ( !isset( $v[ 'manageid' ] ) ) {
               $cstrong = true;
               $manageid = bin2hex( openssl_random_pseudo_bytes ( 20, $cstrong ) );
               $update = [];
               $update[ '$set' ] = [];
               $update[ '$set' ][ 'manageid' ] = $manageid;
               try {
                   $use_db->__application__->users->update( array( "_id" => new MongoId( $v[ "_id" ] ) ), 
                                  $update,
                                  array( "upsert" => true__~mongojournal{, "j" => true} ) );
               } catch(MongoCursorException $e) {
                   $db_errors = "Error updating the database in logcache(). " . $e->getMessage();
                   $results[ 'error' ] = $db_errors;
                   $results[ '_status' ] = 'failed';
                   echo (json_encode($results));
                   exit();
               }               
           } else {
               $manageid = $v[ 'manageid' ];
           }

           $tagline = "";

           $thisbuttons = [];
           if ( isset( $v[ 'needsapproval' ] ) ) {
               if ( $v[ 'needsapproval' ] == 'denied' ) {
                   $thisbuttons[] = "Approve";
                   $thisbuttons[] = "Remove";
                   $tagline .= "Previously denied. ";
               }
               if ( $v[ 'needsapproval' ] == 'pending' ) {
                   if ( isset( $v[ 'needsemailverification' ] ) ) {
                       $thisbuttons[] = "Approve";
                       $thisbuttons[] = "Deny";
                       $tagline .= "Awaiting email verification. ";
                   }
               }
               $thisbuttons[] = "Remove";
           } else {
               $thisbuttons[] = "Remove";
               $thisbuttons[] = "Suspend";
           }

           $buttons = "";
           $script  = "";

           $uid = $v[ '_id' ];

           foreach ( $thisbuttons as $v2 ) {
               $cmd = str_replace( ' ', '_', strtolower( $v2 ) );
               $id = "_usermanage_${cmd}_${name}";
               $buttons .= "<button id='$id'>$v2</button> ";
               $script .= "$('#$id').click(function(e){e.preventDefault();e.returnValue=false;ga.admin.ajax('$cmd','$name','$uid','$manageid');});";
           }
           $userinfo['buttons'][] = $buttons;
           $userinfo['script'][]  = $script;
           $userinfo['tagline'][] = $tagline;
       }
   }
   return true;
}

function get_html_userinfo( $error_json_exit = false ) {
    global $userinfo;
    global $html_userinfo;

    $html_userinfo = "No users found";
    
    if ( !get_userinfo( $error_json_exit ) ) {
        return false;
    }

    if ( !count( $userinfo ) ) {
        return true;
    }
    
    $span = count( $userinfo['data'][ 0 ] );

    $html_userinfo = "<table class='padcell'><tr><th>" . implode( "</th><th>", array_keys( $userinfo['data'][ 0 ] ) ) . "</th></tr><tr><td colspan=$span><hr></td></tr>";

    $script = '';

    foreach ( $userinfo['data'] as $k => $v ) {
        $html_userinfo .= "<tr><td>" . implode( "</td><td> ",  $v ) . "</td></tr>";
        if ( isset( $userinfo[ 'buttons' ][ $k ] ) ) {
//            $html_userinfo .= "<tr><td style='align:left' colspan=" . count( $v ) . ">" . $userinfo['buttons'][ $k ] . "</td></tr>";
            $html_userinfo .= "<tr><td><strong>" . trim( $userinfo[ 'tagline' ][ $k ] ) . "</strong></td><td>" . $userinfo['buttons'][ $k ] . "</td></tr><tr><td colspan=$span><hr></td></tr>";
            $script .= isset( $userinfo[ 'script' ][ $k ] ) ? $userinfo[ 'script' ][ $k ] : '';
        }
    }        

    $html_userinfo .= "</table><script>$script</script>";
    __~debug:basemylog{error_log( "manageusers output:\n$html_userinfo\n", 3, "/tmp/mylog" );}
}

$results = [];

get_html_userinfo( true );

$results[ 'sysuserreport' ] = "<p>Server time " . date( "Y M d H:i:s T", $nowsecs ) . "</p>" . "<p>User count " . count( $userinfo[ 'data ' ] ) . "</p>" . $html_userinfo;

echo json_encode( $results );
?>
