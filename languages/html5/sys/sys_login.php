<?php
header('Content-type: application/json');

session_start(); 
session_regenerate_id(true); 

$results[ '_status' ] = "complete";
$results[ '_project' ] = "";

if ( !sizeof( $_REQUEST ) )
{
    $results[ "error" ] = "PHP code received no \$_REQUEST?";
    echo (json_encode($results));
    exit();
}

if ( isset( $_REQUEST[ '_window' ] ) )
{
   $window = $_REQUEST[ '_window' ];
}
if ( !isset( $_SESSION[ $window ] ) )
{
   $_SESSION[ $window ] = array( "logon" => "", "project" => "" );
}

if ( !is_string( $_REQUEST[ 'userid' ] ) || 
   strlen( $_REQUEST[ 'userid' ] ) < 3 ||
   strlen( $_REQUEST[ 'userid' ] ) > 30 ||
   !filter_var( $_REQUEST[ 'userid' ], FILTER_VALIDATE_REGEXP, array("options"=>array("regexp"=>'/^[A-Za-z][A-Za-z0-9_]+$/') ) ) )
{
    $results[ "error" ] = "empty or invalid user name";
    echo (json_encode($results));
    exit();
}

__~debug:basemylog{error_log( "request\n" . print_r( $_REQUEST, true ) . "\n", 3, "/tmp/mylog" );}

$userid = $_REQUEST[ 'userid' ];

if ( isset( $_REQUEST[ 'forgotpassword' ] ) &&
     $_REQUEST[ 'forgotpassword' ] === "on" )
{
    unset( $_REQUEST[ 'password' ] );
} else {
    if ( !isset( $_REQUEST[ 'password' ] ) || 
         !is_string( $_REQUEST[ 'password' ] ) || 
         strlen( $_REQUEST[ 'password' ] ) < 10 || 
         strlen( $_REQUEST[ 'password' ] ) > 100 )
    {
        $results[ "error" ] = "empty or invalid password";
        echo (json_encode($results));
        exit();
    }
    $pw = $_REQUEST[ 'password' ];
}

// connect
try {
     $m = new MongoClient();
} catch ( Exception $e ) {
    $results[ "error" ] = "Could not connect to the db " . $e->getMessage();
    echo (json_encode($results));
    exit();
}
  
$loginok = 0;

$coll = $m->__application__->users;

$results[ 'status' ] = "User not found or incorrect password";
if ( isset( $pw ) && $doc = $coll->findOne( array( "name" => $userid ) ) )
{
   if ( PHP_VERSION_ID < 50500 )
   {
      if ( crypt( $pw, $doc[ 'password' ]) == $doc[ 'password' ] )
      {
         $loginok = 1;
      }
   } else {
      if ( password_verify ( $pw , $doc[ 'password' ] ) )
      {  
         $loginok = 1;
      }
   }
}

$addstat = "";
$did_expiretime              = 0;
$did_expiretimes             = 0;
$did_lastfailedloginattempts = 0;
$now = new MongoDate();

if ( isset( $doc[ 'expiretime' ] ) )
{
   if ( $now > $doc[ 'expiretime' ] )
   {
      $did_expiretime = 1;
   }
}

if ( isset( $doc[ 'expiretimes' ] ) )
{
   if ( $doc[ 'expiretimes' ] <= 0 )
   {
      $did_expiretimes = 1;
   }
}

if ( isset( $doc[ 'lastfailedloginattempts' ] ) )
{
   if ( $doc[ 'lastfailedloginattempts' ] > 4 )
   {
      $did_lastfailedloginattempts = 1;
   }
}

if ( $loginok == 1 && $did_expiretime )
{
    $addstat .= "Password time expired, ";
    $_REQUEST[ 'forgotpassword' ] = "on";
    $loginok = 0;
}

if ( $loginok == 1 && $did_expiretimes )
{
    $addstat .= "Password times used expired, ";
    $_REQUEST[ 'forgotpassword' ] = "on";
    $loginok = 0;
}

if ( $did_lastfailedloginattempts )
{
    $addstat .= "Too many failed login attempts. ";
    $_REQUEST[ 'forgotpassword' ] = "on";
    $loginok = 0;
}

if ( isset( $doc[ "needsemailverification" ] ) &&
     $doc[ "needsemailverification" ] != "verified"
    ) {
    $results[ 'status' ] = "You must first verify your email address";
    $results[ "_message" ] = 
       array( 
           "icon"  => "information.png"
           ,"text" => $results[ 'status' ]
       );
   echo json_encode( $results );
   exit();
} else {
    if ( isset( $doc[ "needsapproval" ] ) ) {
        if ( $doc[ "needsapproval" ] == "denied" ) {
            $results[ "status" ] = "Your account request has been denied";
        } else {
            $results[ "status" ] = "Your account request is pending approval";
        }
        $results[ "_message" ] = 
            array( 
                "icon"  => "information.png"
                ,"text" => $results[ 'status' ]
            );
        echo json_encode( $results );
        exit();
    }
}

if ( $loginok == 1 )
{
   if ( isset( $doc[ 'expiretime' ] ) || isset( $doc[ 'expiretimes' ] ) )
   {
      $addstat = 'This password will expire.  Please change the password (click the top right configuration icon). ';
   } else {
      $results[ '-close' ] = 1;
   }

   $update[ '$set' ] = array(
                              "lastlogin" => $now,
                              "lastloginip" => $_SERVER[ 'REMOTE_ADDR' ]
                             );
   $update[ '$unset' ] = array(
                                "lastfailedloginattempts" => 0
                              );
   if ( isset( $doc[ 'expiretimes' ] ) )
   {
       $update[ '$inc' ] = array( "expiretimes" => -1 );
   }

   try {
     $coll->update( array( "name" => $userid ), 
                    $update__~mongojournal{, array("j" => true )} );
   } catch(MongoCursorException $e) {
      $results[ 'error' ]  = "Error updating the database. " . $e->getMessage();
      $results[ 'status' ] = $addstat . "Unable to update user record";
      unset( $results[ '-close' ] );
      echo (json_encode($results));
      exit();
   }

   $results[ 'status' ] = $addstat . "Login successful";
   $results[ '_logon' ] = $userid;
   $_SESSION[ $window ][ 'logon' ] = $userid;
   $_SESSION[ $window ][ 'app'   ] = "__application__";
   session_commit();

   if ( isset( $doc[ "groups" ] ) ) {
       $results[ "_usergroups" ] = $doc[ "groups" ];
   } else {
       $results[ "_usergroups" ] = [];
   }
   if ( __~usercolors{1}0 && isset( $doc[ "color" ] ) ) {
       $results[ "_color" ] = $doc[ "color" ];
   }

} else {
   if ( isset( $_REQUEST[ 'forgotpassword' ] ) &&
        $_REQUEST[ 'forgotpassword' ] == "on" )
   {
      $doc = $coll->findOne( array( "name" => $userid ) );

      if ( isset( $doc[ 'email' ] ) ) {
          $email = filter_var( $doc[ 'email' ], FILTER_SANITIZE_EMAIL );
      }

      if ( !is_string( $email ) || 
           !strlen( $email ) ||
           !filter_var( $email, FILTER_VALIDATE_EMAIL ) )
      {
         $results[ 'status' ] = $addstat . 'Could not find valid email address associated with this user';
      } else {
// update password
         $newpw = base_convert(rand(783641640, 28211099074), 10, 36) . base_convert(rand(78364164096, 2821109907455), 10, 36);

         if ( PHP_VERSION_ID < 50500 )
         {
           $doc[ 'password' ] = crypt( $newpw );
         } else {
           $doc[ 'password' ] = password_hash( $newpw, PASSWORD_DEFAULT );
         }

         $expires = new MongoDate();
         $expires->sec += 60 * 60;

         $update[ '$set' ] = array(
                                  "lastforgotlogin" => $now,
                                  "lastforgotloginip" => isset( $_SERVER[ 'REMOTE_ADDR' ] ) ? $_SERVER[ 'REMOTE_ADDR' ] : "not from an ip",
                                  "password" => $doc[ 'password' ], 
                                  "expiretimes" => 1, 
                                  "expiretime" => $expires
                                  );

         $update[ '$unset' ] = array(
                                    "lastfailedloginattempts" => 0
                                    );
         try {
            $coll->update( array( "name" => $userid ),
                           $update__~mongojournal{, array("j" => true )} );
         } catch(MongoCursorException $e) {
            $results[ 'error' ]  = "Error updating the database." . $e->getMessage();
            $results[ 'status' ] = $addstat . "Unable to reset password";
            echo (json_encode($results));
            unset( $results[ '-close' ] );
            exit();
         }
 
         require_once "../mail.php";
         $body = "Now: " . $newpw . "\nExpires in one hour or one use\nPlease change after login";

         if ( mymail( $email, 'reminder', $body ) )
         {
            $results[ 'error' ]  = "Could not send email, mail server is down or not accepting requests";
            $results[ 'status' ] = $addstat . "Unable to login or send password email";
         } else {
            $results[ 'status' ] = $addstat . "Check your registered email address";
         }
      }
   } else {
      $update[ '$set' ] = array(
                                "lastfailedlogin" => $now,
                                "lastfailedloginip" => $_SERVER[ 'REMOTE_ADDR' ]
                                );
      if ( isset( $doc[ 'lastfailedloginattempts' ] ) )
      {
         $update[ '$inc' ][ 'lastfailedloginattempts' ] = 1;
      } else {
         $update[ '$set' ][ 'lastfailedloginattempts' ] = 1;
      }
      try {
         $coll->update( array( "name" => $userid ),
                        $update__~mongojournal{, array("j" => true )} );
      } catch(MongoCursorException $e) {
         $results[ 'error' ]  = "Error updating the database. " . $e->getMessage();
         echo (json_encode($results));
         exit();
      }
   }
}

# $results[ 'sessionid' ] = session_id();
echo (json_encode($results));
exit();
?>
