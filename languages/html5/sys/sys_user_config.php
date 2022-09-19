<?php
header('Content-type: application/json');

session_start(); 
global $results;
$results[ 'error' ] = "";
$results[ '_status' ] = 'complete';

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
}
if ( !isset( $_SESSION[ $window ] ) )
{
   $_SESSION[ $window ] = array( "logon" => "", "project" => "" );
}

require_once "__docroot:html5__/__application__/ajax/ga_db_lib.php";
$now =ga_db_output( ga_db_date() );

if ( !isset( $_SESSION[ $window ][ 'logon' ] ) ||
     !isset( $_REQUEST[ '_logon' ] ) )
{
    $results[ '_logon' ] = "";
    $results[ 'error' ] .= "Not logged in. ";
    echo (json_encode($results));
    exit();
}

$appconfig = json_decode( file_get_contents( "__appconfig__" ) );

if ( $_REQUEST[ '_logon' ] != $_SESSION[ $window ][ 'logon' ] )
{
   $savelogon = $_SESSION[ $window ][ 'logon' ];
   unset( $_SESSION[ $window ][ 'logon' ] );
   $results[ '_logon' ] = "";
   $results[ 'error'  ] = 'Possible security violation user mismatch. ';

   ga_db_open( true );

   $insert[ 'requestuser' ] = $_REQUEST[ '_logon' ];
   $insert[ 'sessionuser' ] = $savelogon;
   $insert[ 'remoteip'    ] = isset( $_SERVER[ 'REMOTE_ADDR' ] ) ? $_SERVER[ 'REMOTE_ADDR' ] : "not from an ip";
   $insert[ 'when'        ] = $now;

   if ( !ga_db_status(
             ga_db_insert(
                 'security',
                 '',
                 $insert
                 )
        )
       ) {
       $results[ 'error' ] .= "Error updating the database. " . $ga_db_errors ;
       exit();
   }

   require_once "../mail.php";
   // $json = json_decode( file_get_contents( "__appconfig__" ) );

   mymail( $appconfig->mail->admin, 'security alert __application__', "session timeout or possible security breach attempt on __application__\n" .
           'requestuser: ' . $insert[ 'requestuser' ] . "\n" .
           'sessionuser: ' . $insert[ 'sessionuser' ] . "\n" .
           'remoteip:    ' . $insert[ 'remoteip' ] . "\n" .
           'when:        ' . date('Y-m-d H:i:s', ga_db_date_secs( $insert[ 'when' ] ) ) . " UTC\n" .
           '' );
   echo (json_encode($results));
   exit();
}

if ( !sizeof( $_REQUEST ) )
{
    $results[ 'error' ] = "PHP code received no \$_REQUEST?";
    echo (json_encode($results));
    exit();
}

ga_db_open( true );

$results[ 'status' ] = "";

$do_update = 0;

if ( $doc =
     ga_db_output(
         ga_db_findOne( 
             'users',
             '',
             [ "name" => $_SESSION[ $window ][ 'logon' ] ]
         )
     )
    ) {
   if ( isset( $_REQUEST[ 'newproject' ] ) &&
        $_REQUEST[ 'newproject' ] == "on" )
   {
      if ( !preg_match( '/^[a-zA-Z0-9_]+$/', $_REQUEST[ 'newproject-newprojectname' ] ) )
      {
          $results[ "error" ] .= "Invalid new project name.  It must contain only letters, numbers and underscores";
      } else {
          # check for duplicate
          $addok = 1;
          if ( isset( $doc[ 'project' ] ) ) {
              foreach ( $doc[ 'project' ] as $v ) {
                  foreach ( $v as $k2 => $v2 ) {
                      if ( $k2 == $_REQUEST[ 'newproject-newprojectname' ] ) {
                          $addok = 0;
                          break;
                      }
                  }
                  if ( !$addok ) {
                      break;
                  }
              }
          }

          if ( !$addok ) {
              $results[ "error" ] .= "Project name already exists.";
          } else {
              $update[ '$push' ][ 'project' ] = array( 
                  $_REQUEST[ 'newproject-newprojectname' ] => array( 
                      'desc'    => $_REQUEST[ 'newproject-newprojectdesc' ], 
                      'created' => $now 
                  ) 
                  );
              $results[ 'status' ] .= "Adding project " . $_REQUEST[ 'newproject-newprojectname' ] . ". ";
              $results[ '_project' ] = $_REQUEST[ 'newproject-newprojectname' ];
              $results[ 'status' ] .= "Current project is now " . $results[ '_project' ] . ". ";
              $_SESSION[ $window ][ 'project' ] = $results[ '_project' ];
              $do_update = 1;
          }
      }
   } else {
      if ( ( isset( $_REQUEST[ 'project' ] ) &&
            ( !isset( $_REQUEST[ '_project' ] ) ||
               $_REQUEST[ '_project' ] != $_REQUEST[ 'project' ] ) ) ||
           ( !isset( $_REQUEST[ 'project' ] ) && isset( $_REQUEST[ '_project' ] ) ) )
      {
         $results[ '_project' ] = $_REQUEST[ 'project' ];
         $results[ 'status' ] .= "Current project is now " . $results[ '_project' ] . ". ";
         $_SESSION[ $window ][ 'project' ] = $results[ '_project' ];
      }
   }

   if ( isset( $_REQUEST[ 'newxsedeproject' ] ) &&
        $_REQUEST[ 'newxsedeproject' ] == "on" )
   {
      if ( !preg_match( '/^[-a-zA-Z0-9]+$/', $_REQUEST[ 'newxsedeproject-newxsedeprojectid' ] ) )
      {
          $results[ "error" ] .= "Invalid new ACCESS project name.  It must contain only letters, numbers and dashes";
      } else {
          # check for duplicate
          $addok = 1;
          if ( isset( $doc[ 'xsedeproject' ] ) ) {
              foreach ( $doc[ 'xsedeproject' ] as $v ) {
                  foreach ( $v as $k2 => $v2 ) {
                      if ( $k2 == $_REQUEST[ 'newxsedeproject-newxsedeprojectid' ] ) {
                          $addok = 0;
                          break;
                      }
                  }
                  if ( !$addok ) {
                      break;
                  }
              }
          }

          if ( !$addok ) {
              $results[ "error" ] .= "ACCESS project id already exists.";
          } else {
              $update[ '$push' ][ 'xsedeproject' ] = array( 
                  $_REQUEST[ 'newxsedeproject-newxsedeprojectid' ] => array( 
                      'created' => $now 
                  ) 
                  );
              $results[ 'status' ] .= "Adding ACCESS project id " . $_REQUEST[ 'newxsedeproject-newxsedeprojectid' ] . ". ";
              $do_update = 1;
              $xsedeadd = 1;
          }
      }
   }

   if ( isset( $_REQUEST[ 'visible' ] ) &&
        $_REQUEST[ 'visible' ] == 'on' &&
        ( !isset( $doc[ 'visible' ] ) ||
          $doc[ 'visible' ] != 'on' ) )
   {
       $update[ '$set' ][ 'visible' ] = 'on';
       $results[ 'status' ] .= "Your user is now visible to other logged in users. ";
       $do_update = 1;
   }

   if ( ( !isset( $_REQUEST[ 'visible' ] ) ||
          $_REQUEST[ 'visible' ] != 'on' ) &&
        isset( $doc[ 'visible' ] ) &&
        $doc[ 'visible' ] == 'on' )
   {
       $update[ '$unset' ][ 'visible' ] = 1;
       $results[ 'status' ] .= "Your user is NOT visible to other logged in users. ";
       $do_update = 1;
   }

   if ( isset( $_REQUEST[ 'changepassword' ] ) &&
        $_REQUEST[ 'changepassword' ] == "on" )
   {
      $ok_to_update = 0;
      $pw = $_REQUEST[ 'changepassword-password' ];

      if ( PHP_VERSION_ID < 50500 )
      {
         if ( crypt( $pw, $doc[ 'password' ]) == $doc[ 'password' ] )
         {
            $ok_to_update = 1;
         }
      } else {
         if ( password_verify ( $pw , $doc[ 'password' ] ) )
         {  
            $ok_to_update = 1;
         }
      }
      if ( $ok_to_update != 1 )
      {
         $results[ "error" ] .= "Current password incorrect. ";
      }

      if ( !is_string( $_REQUEST[ 'changepassword-password1' ] ) || strlen( $_REQUEST[ 'changepassword-password1' ] ) < 10 || strlen( $_REQUEST[ 'changepassword-password1' ] ) > 100 )
      {
         $results[ "error" ] .= "Empty or invalid new password. ";
         $ok_to_update = 0;
      }

      if( $_REQUEST[ 'changepassword-password1' ] != $_REQUEST[ 'changepassword-password2' ] )
      {
         $results[ 'error' ] .= "Passwords do not match. ";
         $ok_to_update = 0;
      }

      if ( $ok_to_update == 1 )
      {
         if ( PHP_VERSION_ID < 50500 )
         {
            $pw = crypt( $_REQUEST[ 'changepassword-password1' ] );
         } else {
            $pw = password_hash( $_REQUEST[ 'changepassword-password1' ], PASSWORD_DEFAULT );
         }

         $update[ '$set' ][ 'password' ]           = $pw;
         $update[ '$set' ][ 'passwordchangewhen' ] = $now;
         $update[ '$set' ][ 'passwordchangeip'   ] = isset( $_SERVER[ 'REMOTE_ADDR' ] ) ? $_SERVER[ 'REMOTE_ADDR' ] : "not from an ip";

         $update[ '$unset' ][ 'lastfailedloginattempts' ] = 0;
         $update[ '$unset' ][ 'expiretime'              ] = 0;
         $update[ '$unset' ][ 'expiretimes'             ] = 0;

         require_once "../mail.php";
         date_default_timezone_set( 'UTC' );
         // $json = json_decode( file_get_contents( "__appconfig__" ) );

         mymail( $doc[ 'email' ] , 'password change notice __application__', "Your password has been changed\n" .
                 'remoteip:    ' . $update[ '$set' ][ 'passwordchangeip' ] . "\n" .
                 'when:        ' . date('Y-m-d H:i:s', ga_db_date_secs( $update[ '$set' ][ 'passwordchangewhen' ] ) ) . " UTC\n" .
                 "\n" . 'If you do not recognize this change please forward this email with a comment to ' . $appconfig->mail->admin . "\n" .
                 '' );

         $results[ 'status' ] .= "Changing password. ";
         $do_update = 1;
      }
   }

   if ( isset( $_REQUEST[ 'changeemail' ] ) &&
        $_REQUEST[ 'changeemail' ] == "on" )
   {
      $ok_to_update = 0;

      $email1 = filter_var( $_REQUEST[ 'changeemail-email1' ], FILTER_SANITIZE_EMAIL );
      $email2 = filter_var( $_REQUEST[ 'changeemail-email2' ], FILTER_SANITIZE_EMAIL );

      if ( $email1 == $email2 )
      {
         if ( $email1 == $doc[ 'email' ] )
         {
             $results[ 'error' ] .= "Email address change request but it is not changed. ";
         } else {
            $ok_to_update = 1;
         }
      } else {
         $results[ 'error' ] .= "Email addresses do not match. ";
      }

      if ( $ok_to_update == 1 )
      {
         $update[ '$set' ][ 'email' ]           = $email1;
         $update[ '$set' ][ 'emailchangewhen' ] = $now;
         $update[ '$set' ][ 'emailchangeip'   ] = $_SERVER[ 'REMOTE_ADDR' ];

         $update[ '$push' ][ 'previousemail'  ] = $doc[ 'email' ];

         require_once "../mail.php";
         date_default_timezone_set( 'UTC' );
         // $json = json_decode( file_get_contents( "__appconfig__" ) );

         mymail( $doc[ 'email' ] , 'email change notice __application__', "Your email address has been changed\n" .
                 'new email:   ' . $email1 . "\n" .
                 'remoteip:    ' . $update[ '$set' ][ 'emailchangeip' ] . "\n" .
                 'when:        ' . date('Y-m-d H:i:s', ga_db_date_secs( $update[ '$set' ][ 'emailchangewhen' ] ) ) . " UTC\n" .
                 "\n" . 'If you do not recognize this change please forward this email with a comment to ' . $appconfig->mail->admin . "\n" .
                 '' );

         admin_mail( "[__application__][new email address] $email1", "User: " . $_REQUEST[ '_logon' ] . "\nEmail: $email1\n" );

         $results[ 'status' ] .= "Changing email address to ${email1}. ";
         $do_update = 1;
      }
   }

   // group membership, check appconfig for groups, then compare with user info and request to add, change or delete groups
   
   if ( isset( $appconfig->groups ) ) {
       // make array of valid user groups and those requested
       $user_groups           = [];
       $user_groups_requested = [];
       $set_groups            = [];

       __~debug:group{error_log( "groups from appconfig:\n" . json_encode( $appconfig->groups, JSON_PRETTY_PRINT ) . "\n", 3, "/tmp/mylog" );}
       foreach ( $appconfig->groups as $k => $v ) {
           __~debug:group{error_log( "group loop k $k:\n" . json_encode( $v, JSON_PRETTY_PRINT ) . "\n", 3, "/tmp/mylog" );}
           if ( isset( $v->userconfig ) && $v->userconfig ) {
               __~debug:group{error_log( "group loop k $k has userconfig\n", 3, "/tmp/mylog" );}
               $user_groups[ $k ] = "_setgroup_groups_$k";
               if ( isset( $_REQUEST[ $user_groups[ $k ] ] ) ) {
                   $user_groups_requested[ $k ] = 1;
                   $set_groups[]                = $k;
               }
           }
       }
       sort( $set_groups );

       // check doc for groups
       $user_current_groups = [];

       $org_groups = [];

       if ( isset( $doc[ 'groups' ] ) ) {
           __~debug:group{error_log( "user groups found:\n" . json_encode( $doc[ 'groups' ], JSON_PRETTY_PRINT ) . "\n", 3, "/tmp/mylog" );}
           // loop thru and push to $set_groups
           foreach ( $doc[ 'groups' ] as $k => $v ) {
               $org_groups[] = $v;
               __~debug:group{error_log( "user groups found k $k v:\n" . json_encode( $v, JSON_PRETTY_PRINT ) . "\n", 3, "/tmp/mylog" );}
           }
       }

       sort( $org_groups );

       __~debug:group{error_log( "usergroups from appconfig:\n" . json_encode( $user_groups, JSON_PRETTY_PRINT ) . "\n", 3, "/tmp/mylog" );}
       __~debug:group{error_log( "requested groups from user config:\n" . json_encode( $user_groups_requested, JSON_PRETTY_PRINT ) . "\n", 3, "/tmp/mylog" );}
       __~debug:group{error_log( "user current groups:\n" . json_encode( $user_current_groups, JSON_PRETTY_PRINT ) . "\n", 3, "/tmp/mylog" );}
       __~debug:group{error_log( "org_groups:\n" . json_encode( $org_groups, JSON_PRETTY_PRINT ) . "\n", 3, "/tmp/mylog" );}
       __~debug:group{error_log( "set_groups:\n" . json_encode( $set_groups, JSON_PRETTY_PRINT ) . "\n", 3, "/tmp/mylog" );}

       if ( $set_groups != $org_groups ) {
           __~debug:group{error_log( "updating groups\n", 3, "/tmp/mylog" );}
           $update[ '$set' ][ 'groups' ] = $set_groups;
           $results[ 'status' ] .= "Updating group membership. ";
           $results[ '_usergroups' ] = $set_groups;
           $do_update = 1;
       } else {
           __~debug:group{error_log( "not updating groups\n", 3, "/tmp/mylog" );}
       }
   }
   if ( isset( $_REQUEST[ "updatecolors" ] ) ) {
       if ( cmp_colors() ) {
           update_colors();

           if ( !isset( $doc[ "color" ] ) ||
                $doc[ "color" ] != $results[ "_color" ] ) {
               $update[ '$set' ][ 'color' ] = $results[ "_color" ];
               $do_update = 1;
               $results[ 'status' ] .= "Updating colors. ";
           }
       } else {
           $results[ 'error' ] .= "Text and background Colors are too similiar. ";
       }
   }

   if ( $do_update )
   {
       if ( !ga_db_status( 
                 ga_db_update(
                     'users',
                     '',
                     [ "name" => $_SESSION[ $window ][ 'logon' ] ],
                     $update
                     )
            )
           ) {
         $results[ 'error' ]  .= "Error updating the database. " . $ga_db_errors;
         $results[ 'status' ] .= "Unable to update user record. ";
         echo (json_encode($results));
         exit();
      }
      $results[ 'status' ] .= "Update ok.";

   } else {
      if ( strlen( $results[ 'status' ] ) == 0 )
      {
         $results[ 'status' ] .= "Nothing to update.";
      }
   }
} 

function cmp_colors() {
    $txtr = "0x" . substr( $_REQUEST[ "updatecolors-colortext" ], 1, 2 );
    $txtg = "0x" . substr( $_REQUEST[ "updatecolors-colortext" ], 3, 2 );
    $txtb = "0x" . substr( $_REQUEST[ "updatecolors-colortext" ], 5, 2 );
    $bdyr = "0x" . substr( $_REQUEST[ "updatecolors-colorbg" ], 1, 2 );
    $bdyg = "0x" . substr( $_REQUEST[ "updatecolors-colorbg" ], 3, 2 );
    $bdyb = "0x" . substr( $_REQUEST[ "updatecolors-colorbg" ], 5, 2 );

    return ( abs( $txtr - $bdyr ) + 
             abs( $txtg - $bdyg ) + 
             abs( $txtb - $bdyb ) ) > 200;
}

function update_colors() {
    global $results;
    $results[ '_color' ] = [];
    $results[ '_color' ][ "body"   ] = [];
    $results[ '_color' ][ "body"   ][ "background" ] = $_REQUEST[ "updatecolors-colorbg" ];
    $results[ '_color' ][ "body"   ][ "color"      ] = $_REQUEST[ "updatecolors-colortext" ];
    $results[ '_color' ][ "body"   ][ "text"       ] = $_REQUEST[ "updatecolors-colortext" ];
    $results[ '_color' ][ "footer" ] = [];
    $results[ '_color' ][ "footer"   ][ "background" ] = $_REQUEST[ "updatecolors-colorbg" ];
}

if ( isset( $xsedeadd ) ) {
    if ( $doc =
         ga_db_output( 
             ga_db_findOne(
                 'users',
                 '',
                 [ "name" => $_SESSION[ $window ][ 'logon' ] ],
                 [ "xsedeproject" => 1 ]
             )
         )
        ) {
        if ( isset( $doc[ 'xsedeproject' ] ) ) {
            $results[ '_xsedeproject' ] = [];
            foreach ( $doc[ 'xsedeproject' ] as $v ) {
                foreach ( $v as $k2 => $v2 ) {
                    $results[ '_xsedeproject' ][] = $k2;
                }
            }
        }
    }
}

if ( strlen( trim( $results[ 'error' ] ) ) == 0 )
{
   unset( $results[ 'error' ] );
}

echo (json_encode($results));
exit();
