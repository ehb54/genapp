<?php
require_once "Mail.php";

function mymail( $to, $subject, $body )
{
   $json = json_decode( file_get_contents( "__appconfig__" ) );

   $headers = array ('From' => '__application__@' . $json->mail->from,
                     'To' => $to,
                     'Subject' => $subject );

   if ( isset( $json->mail->smtp ) )
   {
       $smtp = Mail::factory('smtp',
               array (
                 'host' => $json->mail->smtp->host,
                 'auth' => true,
                 'username' => $json->mail->smtp->user,
                 'password' => rtrim( base64_decode( $json->mail->smtp->password ) ) ) );
       $mail = $smtp->send( $to, $headers, $body );
       return PEAR::isError( $mail );
   }

   $phpmail = Mail::factory('mail');
   $mail = $phpmail->send( $to, $headers, $body );
   return PEAR::isError( $mail );
}

function error_mail( $body )
{
   return admin_mail( "[__application__][internal error message]", $body );
}

function admin_mail( $subject, $body )
{
   $json = json_decode( file_get_contents( "__appconfig__" ) );

   $to = $json->mail->admin;

   $window = isset( $GLOBALS[ 'window' ] ) ? $GLOBALS[ 'window' ] : "";

   $sysdata = 
     "Login: " . ( isset( $_SESSION[ $window ][ 'logon' ] ) ? $_SESSION[ $window ][ 'logon' ] : 'not logged in or login information not available' ) . "\n" .
     "Remote IP: " . ( isset( $_SERVER[ 'REMOTE_ADDR' ] ) ? $_SERVER[ 'REMOTE_ADDR' ] : "not from an ip" ) . "\n" .
     str_repeat( "-", 40 ) . "\n";

   $body = $sysdata . $body;

   $headers = array ('From' => '__application__@' . $json->mail->from,
                     'To' => $to,
                     'Subject' => $subject );

   if ( isset( $json->mail->smtp ) )
   {
       $smtp = Mail::factory('smtp',
               array (
                 'host' => $json->mail->smtp->host,
                 'auth' => true,
                 'username' => $json->mail->smtp->user,
                 'password' => rtrim( base64_decode( $json->mail->smtp->password ) ) ) );
       $mail = $smtp->send( $to, $headers, $body );
       return PEAR::isError( $mail );
   }

   $phpmail = Mail::factory('mail');
   $mail = $phpmail->send( $to, $headers, $body );
   return PEAR::isError( $mail );
}

function mymail_attach( $to, $subject, $body, $attach, $attachdata )
{
   if ( !count( $attach ) && !count( $attachdata ) )
   {
       return mymail( $to, $subject, $body );
   }

   require_once "Mail/mime.php";

   $json = json_decode( file_get_contents( "__appconfig__" ) );
   $headers = array ('From' => '__application__@' . $json->mail->from,
                     'To' => $to,
                     'Subject' => $subject );
   $mime =
       new Mail_mime(
           array(
               'eol' => "\n"
//               ,'head_charset' => 'utf-8'
//               ,'text_charset' => 'utf-8'
//               ,'html_charset' => 'utf-8'
           )
       );

   $mime->setTXTBody($body);

   if ( count( $attachdata ) ) {
       ob_start();
       foreach ( $attach as $f )
       {
           if ( !$mime->addAttachment( $f, 'text/plain' ) ) {
               $mime->addAttachment( "could not attach $f", 'text/plain', "error-$f", false );
           }
       }
       ob_end_clean();
   }

   if ( count( $attachdata ) ) {
       ob_start();
       foreach ( $attachdata as $d )
       {
           if ( isset( $d[ 'data' ] ) &&
                isset( $d[ 'name' ] ) ) {
               if ( !$mime->addAttachment( $d[ 'data' ], 'text/plain', $d[ 'name' ], false ) ) {
                   $mime->addAttachment( "could not attach data", 'text/plain', $d['name'], false );
               }
           } else {
               $mime->addAttachment( "data data or name not set", 'text/plain', "unknown", false );
           }
       }
       ob_end_clean();
   }

   $body    = $mime->get();
   $headers = $mime->headers($headers);

   if ( isset( $json->mail->smtp ) )
   {
       $smtp = Mail::factory('smtp',
               array (
                 'host' => $json->mail->smtp->host,
                 'auth' => true,
                 'username' => $json->mail->smtp->user,
                 'password' => rtrim( base64_decode( $json->mail->smtp->password ) ) ) );
       $mail = $smtp->send( $to, $headers, $body );
       return PEAR::isError( $mail );
   }

   $phpmail = Mail::factory('mail');
   $mail = $phpmail->send( $to, $headers, $body );
   return PEAR::isError( $mail );
}


?>
