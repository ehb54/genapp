#!/usr/local/bin/php
<?php

date_default_timezone_set("UTC");

if ( isset( $_REQUEST ) && count( $_REQUEST ) ) {
    handle_request();
}

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
           if ( $v[ 'name' ] != $_REQUEST[ '_logon' ] ) {
               if ( isset( $v[ 'needsemailverification' ] ) &&
                    $v[ 'needsemailverification' ] == "pending" ) {
                   $thisbuttons[] = "Resend email verification";
                   $tagline .= "Awaiting email verification. ";
               }
               if ( isset( $v[ 'needsapproval' ] ) ) {
                   if ( $v[ 'needsapproval' ] == 'denied' ) {
                       $thisbuttons[] = "Approve";
                       $thisbuttons[] = "Remove";
                       $tagline .= "Previously denied. ";
                   }
                   if ( $v[ 'needsapproval' ] == 'pending' ) {
                       $thisbuttons[] = "Approve";
                       $thisbuttons[] = "Deny";
                       $tagline .= "Awaiting approval. ";
                   }
               }
               if ( isset( $v[ 'suspended' ] ) ) {
                   $thisbuttons[] = "Activate";
                   $tagline .= "Account suspended. ";
               } else {
                   $thisbuttons[] = "Suspend";
               }
               
               $thisbuttons[] = "Remove";
           }

           $buttons = "";
           $script  = "";

           $uid = $v[ '_id' ];

           foreach ( $thisbuttons as $v2 ) {
               $cmd = str_replace( ' ', '_', strtolower( $v2 ) );
               $id = "_usermanage_${cmd}_${name}";
               $buttons .= "<button id='$id'>$v2</button> ";
               if ( $cmd == "remove" ) {
                   $usecmd = "ga.admin.ajax.remove";
               } else {
                   $usecmd = "ga.admin.ajax";
               }
               $script .= "$('#$id').click(function(e){e.preventDefault();e.returnValue=false;${usecmd}('$cmd','$name','$uid','$manageid');});";
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

$results[ 'sysuserreport' ] = "<p>Server time " . date( "Y M d H:i:s T", $nowsecs ) . "</p>" . "<p>User count " . count( $userinfo[ 'data' ] ) . "</p>" . $html_userinfo;

echo json_encode( $results );

function handle_request() {
    global $use_db;
    global $db_errors;

    // stuff for request handling
    __~debug:admin{error_log( "sys_manageusers.php received ajax request\n" . json_encode( $_REQUEST, JSON_PRETTY_PRINT ) . "\n", 3, "/tmp/mylog" );}

    require_once "../mail.php";

    $results = [];

    // check request

    if ( !isset( $_REQUEST[ '_logon' ] ) ) {
        $results[ 'success' ] = "false";
        $results[ 'error' ] = "Internal error: Logon info missing";
        echo json_encode( $results );
        exit();
    }

    if ( !isset( $_REQUEST[ '_cmd' ] ) ) {
        $results[ 'success' ] = "false";
        $results[ 'error' ] = "Internal error: No command received";
        echo json_encode( $results );
        exit();
    }

    if ( !isset( $_REQUEST[ '_manageid' ] ) ) {
        $results[ 'success' ] = "false";
        $results[ 'error' ] = "Internal error: No management id received";
        echo json_encode( $results );
        exit();
    }

    if ( !isset( $_REQUEST[ '_id' ] ) ) {
        $results[ 'success' ] = "false";
        $results[ 'error' ] = "Internal error: No id received";
        echo json_encode( $results );
        exit();
    }

    if ( !isset( $_REQUEST[ '_name' ] ) ) {
        $results[ 'success' ] = "false";
        $results[ 'error' ] = "Internal error: No name received";
        echo json_encode( $results );
        exit();
    }

    // check session

    $window = "";
    if ( isset( $_REQUEST[ '_window' ] ) ) {
        $window = $_REQUEST[ '_window' ];
    }

    session_start();

    if ( isset( $_REQUEST[ "_logon" ] ) && 
         ( !isset( $_SESSION[ $window ][ 'logon' ] ) || $_REQUEST[ "_logon" ] != $_SESSION[ $window ][ 'logon' ] ) ) {
        unset( $_SESSION[ $window ][ 'logon' ] );
        $results[ 'success' ] = "false";
        $results[ 'error' ] = "You must be logged in.";
        echo json_encode( $results );
        exit();
    }

    session_write_close();

    $app = json_decode( file_get_contents( "__appconfig__" ) );
    if ( !isset( $app->restricted->admin ) ) {
        $results[ 'success' ] = "false";
        $results[ "error" ] = "appconfig.json no adminstrators defined";
        echo (json_encode($results));
        exit();
    }    
    
    if ( !isset( $app->restricted->admin ) ) {
        $results[ 'success' ] = "false";
        $results[ "error" ] = "appconfig.json no adminstrators defined";
        echo (json_encode($results));
        exit();
    }    

    if ( !in_array( $_REQUEST[ '_logon' ], $app->restricted->admin ) ) {
        $results[ 'success' ] = "false";
        $results[ "error" ] = "You are not an administrator";
        echo (json_encode($results));
        exit();
    }    

    // validate doc
    
    if ( !db_connect() ) {
        $results[ 'success' ] = "false";
        $results[ 'error' ] = "Database error: $db_connect";
        echo json_encode( $results );
        exit();
    }

    // does user exist?

    if ( !$doc = $use_db->__application__->users->findOne( [ "_id" => new MongoId( $_REQUEST[ '_id' ] ) ] ) ) {
        $results[ 'success' ] = "false";
        $results[ 'error' ] = "User id not found";
        echo json_encode( $results );
        exit();
    }

    // validate consistency

    if ( $doc[ 'name' ] != $_REQUEST[ '_name' ] ) {
        $results[ 'success' ] = "false";
        $results[ 'error' ] = "Incorrect name. Are you trying to hack this system?";
        echo json_encode( $results );
        exit();
    }
    
    if ( !isset( $doc[ 'manageid' ] ) ) {
        $results[ 'success' ] = "false";
        $results[ 'error' ] = "No manage id found, Please try again.";
        echo json_encode( $results );
        exit();
    }

    if ( $doc[ 'manageid' ] != $_REQUEST[ '_manageid' ] ) {
        $results[ 'success' ] = "false";
        $results[ 'error' ] = "Manage id has changed.  Someone else could have modified the status. Please try again.";
        echo json_encode( $results );
        exit();
    }
    
    $cstrong = true;
    $newmanageid = bin2hex( openssl_random_pseudo_bytes ( 20, $cstrong ) );

    switch( $_REQUEST[ '_cmd' ] ) {
        case "remove" : {
            $mailuser = "Your account on http://" . $app->hostname . "/__application__ has been Removed.";
            // remove history and data files or prevent if they exist ?
            $remove = [ "_id" => new MongoId( $_REQUEST[ "_id" ] ) ];
            $removejobs = 1;
            $removedata = 1;
        }
        break;

        case "approve" : {
            $mailuser = "Your request for an account on http://" . $app->hostname . "/__application__ has been Approved.";
            if ( isset( $doc[ 'needsemailverification' ] ) ) {
                $mailuser .= "\nPlease verify your email address by visiting this link:\n http://" . $app->hostname . "/__application__/ajax/sys_config/sys_register_backend.php?_r=" . $doc[ '_id' ];
            } else {
                $mailuser .= "\nYou can now logon.";
            }
            $update = [ 
                '$unset' => [ 
                    "needsapproval" => ""
                    ,"approvalid" => ""
                    ,"denyid" => "" 
                ],
                '$set'   => [
                    "approved" => new MongoDate() 
                ] 
                ];
        }
        break;

        case "deny" : {
            $mailuser = "Your request for an account on http://" . $app->hostname . "/__application__ has been Denied";
            $update = [
                '$unset' => [ 
                    "approvalid" => ""
                    ,"denyid" => "" 
                ],
                '$set' => [
                    "needsapproval" => "denied"
                    ,"denied" => new MongoDate() 
                ]
                ];
        }
        break;

        case "suspend" : {
            $mailuser = "Your account on http://" . $app->hostname . "/__application__ has been Suspended";
            $update = [ 
                '$set' => [
                    'suspended' => new MongoDate(),
                    'manageid' => $newmanageid 
                ] 
                ];
        }
        break;

        case "activate" : {
            $mailuser = "Your account on http://" . $app->hostname . "/__application__ has been Activated";
            $update = [ 
                '$unset' => [ 
                    'suspended' => 1 
                ],
                '$set'   => [ 
                    'manageid' => $newmanageid 
                ] 
                ];
        }
        break;

        case "resend_email_verification" : {
            $mailuser = "Please verify your email address by visiting this link:\n http://" . $app->hostname . "/__application__/ajax/sys_config/sys_register_backend.php?_r=" . $doc[ '_id' ];
            $mailsubject = "[__application__][email verify request]";
        }
        break;

        default : {
            $results[ 'success' ] = "false";
            $results[ 'error' ] = "Internal error: Unknown command " . $_REQUEST[ '_cmd' ] . " received";
            echo json_encode( $results );
            exit();
        }
        break;
    }

    if ( isset( $update ) ) {
        $update[ '$push' ] =
            [
             "admin" => [
                 "event" => $_REQUEST[ '_cmd' ]
                 ,"at"   => new MongoDate()
                 ,"by"   => $_REQUEST[ '_logon' ]
                 ,"ip"   => isset( $_SERVER['REMOTE_ADDR'] ) ?  $_SERVER['REMOTE_ADDR'] : "no server remote addr"
             ]
            ];
                          
        try {
            $use_db->__application__->users->update( [ "_id" => new MongoId( $_REQUEST[ '_id' ] ) ],
                                                     $update__~mongojournal{, array("j" => true )} );
        } catch(MongoCursorException $e) {
            $results[ 'success' ] = "false";
            $results[ 'error' ] = "Database error: $db_connect";
            echo json_encode( $results );
            exit();
        }
    }

    if ( isset( $remove ) ) {
        try {
            $use_db->__application__->users->remove( $remove__~mongojournal{, array("j" => true )} );
        } catch(MongoCursorException $e) {
            $results[ 'success' ] = "false";
            $results[ 'error' ] = "Database error: $db_connect";
            echo json_encode( $results );
            exit();
        }
        if ( isset( $removejobs ) ) {
            try {
                $use_db->__application__->jobs->remove( [ "user" => $doc[ 'name' ] ]__~mongojournal{, array("j" => true )} );
            } catch(MongoCursorException $e) {
                $results[ 'success' ] = "false";
                $results[ 'error' ] = "Database error: $db_connect";
                echo json_encode( $results );
                exit();
            }
        }
        if ( isset( $removedata ) ) {
            $dir = "__docroot:html5__/__application__/results/users/" . $doc[ 'name' ];
            if ( file_exists( $dir ) ) {
                $cstrong = true;
                $tmplen = 6;
                $uniq = bin2hex( openssl_random_pseudo_bytes ( $tmplen, $cstrong ) );
                $deldir = "__docroot:html5__/__application__/removed/$uniq/" . $doc[ 'name' ];
                $tries = 0;
                while ( file_exists( $deldir ) ) {
                    $uniq = bin2hex( openssl_random_pseudo_bytes ( $tmplen, $cstrong ) );
                    $deldir = "__docroot:html5__/__application__/removed/$uniq/" . $doc[ 'name' ];
                    if ( ++$tries > 100 ) {
                        $results[ "error" ] = "Internal error: over 100 tries to make a random directory<p>A message is being sent to the server administrators";
                        $results[ 'success' ] = "false";
                        error_mail( "sys_manageusers.php\n" .
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
                    $results[ 'success' ] = "false";
                    $results[ "error" ] = "Could not create directory " . $deldir . " " . $cont;
                    error_mail( "sys_files.php\n" .
                                "during delete mkdir\n" .
                                $results[ "error" ] );
                    echo (json_encode($results));
                    exit();
                }
                chmod( $deldir, 0775 );
                ob_end_clean();
                $cmd = "mv $dir $deldir 2>&1 > /dev/null";
                __~debug:admin{error_log( "sys_manageusers.php mv results command: $cmd\n", 3, "/tmp/mylog" );}
                `$cmd`;
            } else {
                __~debug:admin{error_log( "sys_manageusers.php no results in $dir\n", 3, "/tmp/mylog" );}
            }
        }
    }


    if ( isset( $mailuser ) ) {
        mymail( $doc[ 'email' ], isset( $mailsubject ) ? $mailsubject : "[__application__][account status update]", $mailuser );
    }

    $results[ "success" ] = "true";
    __~debug:admin{error_log( "sys_manageusers.php sending results\n" . json_encode( $results, JSON_PRETTY_PRINT ) . "\n", 3, "/tmp/mylog" );}
    __~debug:admin{error_log( "sys_manageusers.php sending results as json string:\n" . json_encode( $results ) . "\n", 3, "/tmp/mylog" );}
    $results[ "_submitid" ] = "sys_manage_users_submit";
    echo json_encode( $results );
    exit();
}

?>