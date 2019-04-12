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
    $aid = isset( $_REQUEST[ '_a' ] ) ? $_REQUEST[ '_a' ] : '';
    $did = isset( $_REQUEST[ '_d' ] ) ? $_REQUEST[ '_d' ] : '';

    require_once "../mail.php";

    if ( ( strlen( $aid ) && strlen( $did ) ) ||
         ( !strlen( $aid ) && !strlen( $did ) ) ) {
        $msg = "invalid approve-deny registration request from ip " . $_REQUEST[ 'REMOTE_ADDR' ];
        error_mail( "[mongodb][__menu:modules:id__.php][r0] $msg" );
        $html .= "Internal error</body></html>";
        echo $html;
        exit();
    }
        
    $app = json_decode( file_get_contents( "__appconfig__" ) );

    $error_msg = "<p>We encountered an internal error with this application.</p><p>The administrators have been notified of the details via email.</p><p>We apologize for any inconvenience.</p>";
    $url = "http://" . $app->hostname . "/__application__/ajax/__menu:id__/__menu:modules:id__.php?_r=$r";

    require_once "__docroot:html5__/__application__/ajax/ga_db_lib.php";

    if ( !ga_db_status( ga_db_open() ) ) {
        $msg = $ga_db_errors . "\n" . "url: $url\n";
        error_mail( "[mongodb][__menu:modules:id__.php][r0] $msg" );
        $html .= "$error_msg</body></html>";
        echo $html;
        exit();
    }
    
    if ( $doc =
         ga_db_output(
             ga_db_findOne( 
                 'users', 
                 '',
                 [ "_id" => ga_db_output( ga_db_Id( $r ) ) ]
             )
         )
        ) {
        if ( strlen( $aid ) && ( !isset( $doc[ 'approvalid' ] ) || $doc[ 'approvalid' ] != $aid ) ) {
            $msg = "invalid approve-deny registration request from ip " . $_REQUEST[ 'REMOTE_ADDR' ];
            error_mail( "[mongodb][__menu:modules:id__.php][r1a] $msg" );
            $html .= "Internal error</body></html>";
            echo $html;
            exit();
        }
        if ( strlen( $did ) && ( !isset( $doc[ 'denyid' ] ) || $doc[ 'denyid' ] != $did ) ) {
            $msg = "invalid approve-deny registration request from ip " . $_REQUEST[ 'REMOTE_ADDR' ];
            error_mail( "[mongodb][__menu:modules:id__.php][r1d] $msg" );
            $html .= "Internal error</body></html>";
            echo $html;
            exit();
        }
            
        $mailmsg = "Your request for an account on http://" . $app->hostname . "/__application__ has been ";
    
        $html .= "<p>User " . $doc['name'] . "'s registration request has been ";
        $update = [];
        if ( strlen( $aid ) ) {
            $update[ '$unset' ] = [ "needsapproval" => "", "approvalid" => "", "denyid" => "" ];
            $update[ '$set' ] = [ "approved" => ga_db_output( ga_db_date() ) ];
            $html .= "<strong>Approved</strong>";
            $mailmsg .= "Approved.  You can now logon.";
        } else {
            $update[ '$unset' ] = [ "approvalid" => "", "denyid" => "" ];
            $update[ '$set' ] = [ "needsapproval" => "denied", "denied" => ga_db_output( ga_db_date() ) ];
            $html .= "<strong>Denied</strong>";
            $mailmsg .= "Denied";
        }
        $html .= ".</p> If you wish to undo this, you must <a href=http://" . $app->hostname . "/__application__>logon</a> and use the Administrator user management module</p>";

        mymail( $doc[ 'email' ], "[__application__][account status update]", $mailmsg );

        if ( !ga_db_status(
                  ga_db_update(
                      'users',
                      '',
                      $update 
                  )
             )
            ) {
            error_mail( "[mongodb][__menu:modules:id__.php][r2] " . $ga_db_errors );
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
