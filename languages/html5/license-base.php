<?php

// modulejson

$modjson = json_decode( '__modulejson__' );

if ( isset( $_REQUEST[ '_r' ] ) ) {
    // no session, just process the request;
    header( 'Content-Type: text/html' );
    $css = <<<'EOT'
<style>
body {
background: rgb( __background_color_rgb__ );
color: rgb( __text_color_rgb__ );
}
</style>
<link rel="shortcut icon" href="../../favicon.ico" type="image/x-icon"/>
EOT;

    $title = '__title__ __version__ : ' . $modjson->label;
    $html = '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>' . "$title</title>$css<body><center><h3>$title</h3></center>";

    $r = $_REQUEST[ '_r' ];

    require_once "../mail.php";

    $app = json_decode( file_get_contents( "__appconfig__" ) );

    $error_msg = "<p>We encountered an internal error with this application.</p><p>The administrators have been notified of the details via email.</p><p>We apologize for any inconvenience.</p>";
    $url = "http://" . $app->hostname . "/__application__/ajax/__menu:id__/__menu:modules:id__.php?_r=$r";

    // check mongo
    try {
        $m = new MongoClient();
    } catch ( Exception $e ) {
        $db_error = "Error connecting to the database. " . $e->getMessage();
        $msg = $db_error . "\n" . "url: $url\n";
        error_mail( "[mongodb][__menu:modules:id__.php][r0] $msg" );
        $html .= "$error_msg</body></html>";
        echo $html;
        exit();
    }

    if ( $doc = $m->__application__->{'licenserequests___menu:modules:id__'}->findOne( array( '$or' => array( array( "_id" => $r ), array( "no" => $r ) ) ) ) ) {
        if ( isset( $doc[ 'msg' ] ) ) {
            $html .= $doc[ 'msg' ];
        }

        // update licenserequests___menu:modules:id__
        $now = new MongoDate();
        if ( $docuser = $m->__application__->license->findOne( array( 'name' => $doc[ 'user' ] ) ) )  {
            if ( 
                isset( $docuser[ "__menu:modules:id__" ] ) &&
                isset( $docuser[ "__menu:modules:id__" ][ "status" ] ) &&
                $docuser[ "__menu:modules:id__" ][ "status" ] != "pending"
                ) {
                $html .= "<p>Note: " . $doc[ 'user' ] . "'s previous license status was <strong>" . $docuser[ "__menu:modules:id__" ][ 'status' ] . "</strong></p>";
            }
        }
        
        if ( $doc[ '_id' ] == $r ) {
            $html .= "<p>User " . $doc[ 'user' ] . "'s __menu:modules:id__ license has been <strong>approved</strong>.</p></body></html>";
            $status = "approved";
        } else {
            if ( $doc[ 'no' ] == $r ) {
                $html .= "<p>User " . $doc[ 'user' ] . "'s __menu:modules:id__ license has been <strong>denied</strong>.</p></body></html>";
            }
            $status = "denied";
        }

        try {
            $m->__application__->{'licenserequests___menu:modules:id__'}->update(
                array( '_id' => $doc[ '_id' ] ),
                array( '$push' => array( "events" => array( "what" => "$status from licensor", "when" => $now, "ip" => isset( $_SERVER[ 'REMOTE_ADDR' ] ) ? $_SERVER[ 'REMOTE_ADDR' ] : "not from an ip" ) ) )
                __~mongojournal{, array("j" => true )} 
                );
        } catch( MongoCursorException $e ) {
            $db_error = "Error updating. " . $e->getMessage();
            error_mail( "[mongodb][__menu:modules:id__.php][r1] " . $db_error );
        }

        // update license collection

        try {
            $m->__application__->license->update(
                array( "name"  => $doc[ 'user' ] ),
                array( 
                    '$set'  => array( "__menu:modules:id__" => array( "status" => $status, "request" => $doc[ 'request' ] ) ),
                    '$push' => array( "__menu:modules:id___events" => array( "what" => "$status from licensor", "when" => $now ) )
                ),
                array( "upsert" => true__~mongojournal{, "j" => true} ) 
                );
        } catch( MongoCursorException $e ) {
            $db_error = "Error updating. " . $e->getMessage();
            error_mail( "[mongodb][__menu:modules:id__.php][r2] " . $db_error );
        }
        echo $html;
        exit();
    }

    $html .= "<p>We could not find a matching request.</p><p>The administrators have been notified of the details via email.</p><p>We apologize for any inconvenience.</p>";
    $msg = "No matching request found, $url\n";
    error_mail( "[__menu:modules:id__.php][r3] " . $msg );
    echo $html;
    exit();
}   
                
header('Content-type: application/json');
# setup php session

session_start();
if (!isset($_SESSION['count'])) {
  $_SESSION['count'] = 0;
} else {
  $_SESSION['count']++;
}

if ( !sizeof( $_REQUEST ) )
{
    session_write_close();
    $msg = "[PHP code received no \$_REQUEST] Possibly total upload file size exceeded limit.\nLimit is currently set to " . ini_get( 'post_max_size' ) . ".\n";
    error_mail( $msg . "Error occured in __menu:id__ __menu:modules:id__.\n" );
    $results = array("error" => $msg . "Please contact the administrators via feedback if you feel this is in error or if you have need to process total file sizes greater than this limit.\n" );
    $results[ '_status' ] = 'failed';
    echo (json_encode($results));
    exit();
}


$do_logoff = 0;

$window = "";
if ( isset( $_REQUEST[ '_window' ] ) )
{
   $window = $_REQUEST[ '_window' ];
}
if ( !isset( $_SESSION[ $window ] ) )
{
   $_SESSION[ $window ] = array( "logon" => "", "project" => "" );
}

$logon = $_REQUEST[ "_logon" ];

if ( isset( $_REQUEST[ "_logon" ] ) && 
   ( !isset( $_SESSION[ $window ][ 'logon' ] ) || $_REQUEST[ "_logon" ] != $_SESSION[ $window ][ 'logon' ] ) ) {
   $do_logoff = 1;
   unset( $_SESSION[ $window ][ 'logon' ] );
   $results[ '_logon' ] = "";
}
session_write_close();

if ( !strlen( $logon ) ) {
   $results[ '_message' ] =
       array( 
           "icon" => "warning.png",
           "text" => "You first logon to request a license"
       );
   $results[ '_status' ] = 'failed';
   echo (json_encode($results));
   exit();
}

if ( !isset( $_REQUEST[ '_uuid' ] ) )
{
    $results[ "error" ] = "No _uuid specified in the request";
    $results[ '_status' ] = 'failed';
    echo (json_encode($results));
    exit();
}

require_once "../mail.php";


// make sure we can store the record in the db

try {
    $m = new MongoClient();
} catch ( Exception $e ) {
    $db_error = "Error connecting to the database. " . $e->getMessage();
    error_mail( "[mongodb][__menu:modules:id__.php][0] " . $db_error );
    $results[ '_status' ]= 'failed';
    $results[ '_message' ] =
        array( 
            "icon" => "toast.png",
            "text" => "Could not connect to the database. This is a server error, please contact the administrators via the feedback tab."
        );
    echo (json_encode($results));
    exit();
}

// create the license request

$coll = $m->__application__->{'licenserequests___menu:modules:id__'};

$cstrong = true;
$keyyes  = bin2hex( openssl_random_pseudo_bytes ( 20, $cstrong ) );
$keyno   = bin2hex( openssl_random_pseudo_bytes ( 20, $cstrong ) );

$now = new MongoDate();

try {
    $coll->insert( 
        Array( 
            '_id'      => $keyyes,
            'no'       => $keyno,
            'events'   => Array( Array( "what" => "request sent", "when" => $now ) ),
            'user'     => $logon,
            'request'  => $_REQUEST,
            'remoteip' => isset( $_SERVER[ 'REMOTE_ADDR' ] ) ? $_SERVER[ 'REMOTE_ADDR' ] : "not from an ip"
        )
        __~mongojournal{, array("j" => true )} );
} catch(MongoCursorException $e) {
    $db_error = "Error inserting. " . $e->getMessage();
    error_mail( "[mongodb][__menu:modules:id__.php][1] " . $db_error );
    $results[ '_status' ]= 'failed';
    $results[ '_message' ] =
        array( 
            "icon" => "toast.png",
            "text" => "Could not update the database. This is a server error, please contact the administrators via the feedback tab."
        );
    echo (json_encode($results));
    exit();
}

// assembly & send the message

require_once "../mail.php";

$to      = "__approvalemail__";
$subject = "[Request][__application__][__label__]";

// build body from modjson fields

$body    = "";

__~debug:licensed{$body .= print_r( $_REQUEST, true ) . "\n" . print_r( $modjson, true ) . "\n";}


$labels = [];
$values = [];
$info   = [];

$maxllen = 0;

$summary_html = "<table>";

foreach ( $modjson->fields as $k => $v ) {
    if ( $v->role == "input" ) {
        if ( $v->type == "info" ) {
            $pos = isset( $v->end ) ? 999999 : count( $labels );
            if ( isset( $info[ $pos ] ) ) {
                $info[ $pos ] .= $v->info . "\n";
            } else {
                $info[ $pos ] = $v->info . "\n";
            }
        } else {
            if ( isset( $_REQUEST[ $v->id ] ) ) {
                $labels[] = $v->label;
                if ( $maxllen < strlen( $v->label ) ) {
                    $maxllen = strlen( $v->label );
                }
                $values[] = $_REQUEST[ $v->id ];
                $summary_html .= "<tr><td>" . end( $labels ) . "</td><td>:</td><td>" . end( $values ) . "</td></tr>";
            }
        }
    }
}

$app = json_decode( file_get_contents( "__appconfig__" ) );

$labels[] = "To approve this request";
$values[] = "http://" . $app->hostname . "/__application__/ajax/__menu:id__/__menu:modules:id__.php?_r=$keyyes";
$summary_html .= "<tr></tr><tr><td>" . end( $labels ) . '</td><td>:</td><td><a href="' . end( $values ) . '">Approve</a></td></tr><tr></tr>';

$info[ count( $labels ) ] = "\n";

$labels[] = "To deny this request";
$values[] = "http://" . $app->hostname . "/__application__/ajax/__menu:id__/__menu:modules:id__.php?_r=$keyno";
$summary_html .= "<tr></tr><tr><td>" . end( $labels ) . '</td><td>:</td><td><a href="' . end( $values ) . '">Deny</a></td></tr>';

$summary_html .= "</table>";

foreach ( $labels as $k => $v ) {
    if ( isset( $info[ $k ] ) ) {
        $body .= $info[ $k ];
        unset( $info[ $k ] );
    }
    $body .= str_pad( $v, $maxllen ) . " : " . $values[ $k ] . "\n";
}

foreach ( $info as $k => $v ) {
    $body .= $v;
}

if ( mymail( $to, $subject, $body ) ) {
    $results[ '_status' ]= 'failed';
    $results[ '_message' ] =
        array( 
            "icon" => "warning.png",
            "text" => "There was a problem trying to send license request email, please try again later.  If this problem persists, please provide feedback using the tab at the right."
        );
} else {
    $results[ '_status' ]= 'complete';
    $results[ '_message' ] =
        array( 
            "icon" => "information.png",
            "text" => "Your license request is being processed."
        );

    // store in mongodb 

    try {
        $coll->update( array( "_id" => $keyyes ), 
                       array( '$set' => array( 'sent' => 'yes', "msg" => $summary_html ) )
                       __~mongojournal{, array("j" => true )} );
    } catch(MongoCursorException $e) {
        $db_error = "Error updating. " . $e->getMessage();
        error_mail( "[mongodb][__menu:modules:id__.php][2] " . $db_error );
    }

    // store in license
    $coll = $m->__application__->license;

    try {
        $coll->update(
            array( "name"  => $logon ),
            array( 
                '$set'  => array( "__menu:modules:id__" => array( "status" => "pending" ) ),
                '$push' => array( "__menu:modules:id___events" => array( "what" => "sent request", "when" => $now ) )
            ),
            array( "upsert" => true__~mongojournal{, "j" => true} ) 
            );
    } catch( MongoCursorException $e ) {
        $db_error = "Error updating. " . $e->getMessage();
        error_mail( "[mongodb][__menu:modules:id__.php][3] " . $db_error );
    }
}

echo json_encode($results);
?>
