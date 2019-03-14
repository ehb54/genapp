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

require_once "__docroot:html5__/__application__/ajax/ga_db_lib.php";

function get_userinfo( $error_json_exit = false ) {
   global $appconfig;
   global $userinfo;
   global $nowsecs;

   $userinfo = [];

   if ( !ga_db_status( ga_db_open( $error_json_exit ) ) )
   {
       return false;
   }

   $nowsecs = microtime( true );

   $runcount = [];

   $runs = ga_db_output(
       ga_db_find( 
           'running',
           ''
       )
       );
   foreach ( $runs as $v ) {
       $uuid = $v['_id'];
       $job = 
           ga_db_output(
               ga_db_findOne(
                   'jobs',
                   '',
                   [ "_id" => $uuid ],
                   [ "user" => 1 ]
               )
           );
       $name = $job[ 'user' ];
       if ( !isset( $runcount[ $name ] ) ) {
           $runcount[ $name ] = 1;
       } else {
           $runcount[ $name ]++;
       }
   }

   $users = 
       ga_db_output( 
           ga_db_find(
               'users',
               ''
           )
       );

   $users->sort( array( "name" => 1 ) );

   foreach ( $users as $v ) {
       $name = $v[ 'name' ];
       if ( substr( $name, 0, strlen( "_canceled" ) ) != "_canceled" ) {
           $userinfo[] = 
               array( 
                   "name"                => $name
                   ,"email"              => "<a class='title' href='mailto:" . $v[ 'email' ] . "'>" . $v[ 'email' ] . "</a>"
                   ,"projects"           => count( $v[ 'project' ] )
                   ,"last-login"         => isset( $v["lastlogin"] ) ? date( "Y M d H:i T",$v["lastlogin"]->sec ) : ""
                   ,"registered"         => isset( $v["registered"] ) ? date( "Y M d H:i T",$v["registered"]->sec ) : ""
                   ,"jobs-not-removed"   => ga_db_output( ga_db_count( 'jobs', '', [ "user" => $name ] ) )
                   ,"running"            => isset( $runcount[ $name ] ) ? $runcount[ $name ] : 0
                   ,"admin"              => in_array( $v[ 'name' ], $appconfig->restricted->admin ) ? "yes" : ""
               );
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
    
    $html_userinfo = "<table class='padcell'><tr><th>" . implode( "</th><th>", array_keys( $userinfo[ 0 ] ) ) . "</th></tr>";

    foreach ( $userinfo as $k => $v ) {
        $html_userinfo .= "<tr><td>" . implode( "</td><td> ",  $v ) . "</td></tr>";
    }        

    $html_userinfo .= "</table>";
}

$results = [];

get_html_userinfo( true );

$results[ 'sysuserreport' ] = "<p>Server time " . date( "Y M d H:i:s T", $nowsecs ) . "</p>" . "<p>User count " . count( $userinfo ) . "</p>" . $html_userinfo;

echo json_encode( $results );
