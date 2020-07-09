<?php
require_once "Mail.php";

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\SMTP;
use PHPMailer\PHPMailer\Exception;

function phpmailer_mail( $to, $subject, $body, $attach = NULL, $attachdata = NULL ) {
    $json = json_decode( file_get_contents( "__appconfig__" ) );
    
    if ( !isset( $json->mail->smtp ) ) {
        return false;
    }
        
    if (
        !isset( $json->mail ) ||
        !isset( $json->mail->from ) ||
        !isset( $json->mail->smtp ) ||
        !isset( $json->mail->smtp->host ) ||
        !isset( $json->mail->smtp->user ) ||
        !isset( $json->mail->smtp->password )
        ) {
        return false;
    }

    require '__docroot:html5__/__application__/vendor/phpmailer/phpmailer/src/Exception.php';
    require '__docroot:html5__/__application__/vendor/phpmailer/phpmailer/src/PHPMailer.php';
    require '__docroot:html5__/__application__/vendor/phpmailer/phpmailer/src/SMTP.php';


    $mail = new PHPMailer(true);

    try {
        #Server settings
#        $mail->SMTPDebug = SMTP::DEBUG_SERVER;                     # Enable verbose debug output, comment this line in production
        $mail->isSMTP();                                            # Send using SMTP
        $mail->Host       = $json->mail->smtp->host;                # Set the SMTP server to send through
        if ( $json->mail->smtp->auth ) {
            $mail->SMTPAuth   = true;                               # Enable SMTP authentication
        }
        $mail->Username   = $json->mail->smtp->user;

        $mail->Password   = rtrim( base64_decode( $json->mail->smtp->password ) );     # SMTP password (Google's App Password for Mail)
        if ( $json->mail->smtp->tls ) {
            $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;     # Enable TLS encryption; `PHPMailer::ENCRYPTION_SMTPS` also accepted
        }
        if ( $json->mail->smtp->port ) {
            $mail->Port       = $json->mail->smtp->port;            # TCP port to connect to
        } else {
            $mail->Port       = 25;
        }

        #Recipients

        $mail->setFrom( '__application__@' . $json->mail->from );
        $tos = preg_split( "/\s*(\s|,)\s*/", $to );
        foreach ( $tos as $d ) {
            $mail->addAddress( $d );
        }

        if ( isset( $attach ) && count( $attach ) ) {

            foreach ( $attach as $f ) {
                # $fn = str_replace( '__docroot:html5__/__application__/', '', $f );
                $fn = preg_replace( '/^.*\//', '', $f );
                if ( !$mail->addAttachment( $f, $fn, PHPMailer::ENCODING_BASE64, 'text/plain' ) ) {
                    $mail->addAttachment( "could not attach $fn", "error-$fn" , PHPMailer::ENCODING_BASE64, 'text/plain' );
                }
            }
        }

        if ( isset( $attachdata ) && count( $attachdata ) ) {
            ob_start();
            foreach ( $attachdata as $d ) {
                if ( isset( $d[ 'data' ] ) &&
                     isset( $d[ 'name' ] ) ) {
                    if ( !$mail->addStringAttachment( $d[ 'data' ], $d[ 'name' ], PHPMailer::ENCODING_BASE64, 'text/plain' ) ) {
                        $mail->addStringAttachment( "could not attach data", $d[ 'name' ], PHPMailer::ENCODING_BASE64, 'text/plain', $d['name'] );
                    }
                } else {
                    $mail->addStringAttachment( "data data or name not set", "unknown", PHPMailer::ENCODING_BASE64, 'text/plain' );
                }
            }
            ob_end_clean();
        }

        # Content
        $mail->isHTML(false);                                  # Set email format to HTML
        $mail->Subject = $subject;
        $mail->Body    = $body;
#        $mail->AltBody = $body;

        $mail->send();
        return true;
    } catch (Exception $e) {
        return false;
    }
}

function mymail( $to, $subject, $body )
{
   $json = json_decode( file_get_contents( "__appconfig__" ) );

   $headers = array ('From' => '__application__@' . $json->mail->from,
                     'To' => $to,
                     'Subject' => $subject );

   if ( isset( $json->mail->smtp ) ) {
       return !phpmailer_mail( $to, $subject, $body );
#       $smtp = Mail::factory('smtp',
#               array (
#                 'host' => $json->mail->smtp->host,
#                 'auth' => true,
#                 'username' => $json->mail->smtp->user,
#                 'password' => rtrim( base64_decode( $json->mail->smtp->password ) ) ) );
#       $mail = $smtp->send( $to, $headers, $body );
#       return PEAR::isError( $mail );
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
       return !phpmailer_mail( $to, $subject, $body );
#       $smtp = Mail::factory('smtp',
#               array (
#                 'host' => $json->mail->smtp->host,
#                 'auth' => true,
#                 'username' => $json->mail->smtp->user,
#                 'password' => rtrim( base64_decode( $json->mail->smtp->password ) ) ) );
#       $mail = $smtp->send( $to, $headers, $body );
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

   $json = json_decode( file_get_contents( "__appconfig__" ) );

   if ( isset( $json->mail->smtp ) )
   {
       return !phpmailer_mail( $to, $subject, $body, $attach, $attachdata );
   }
   require_once "Mail/mime.php";

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

#   if ( isset( $json->mail->smtp ) )
#   {
#       $smtp = Mail::factory('smtp',
#               array (
#                 'host' => $json->mail->smtp->host,
#                 'auth' => true,
#                 'username' => $json->mail->smtp->user,
#                 'password' => rtrim( base64_decode( $json->mail->smtp->password ) ) ) );
#       $mail = $smtp->send( $to, $headers, $body );
#       return PEAR::isError( $mail );
#   }

   $phpmail = Mail::factory('mail');
   $mail = $phpmail->send( $to, $headers, $body );
   return PEAR::isError( $mail );
}
