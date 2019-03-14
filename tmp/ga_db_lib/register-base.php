<?php

// modulejson


$modjson = json_decode( '__modulejson__' );

$do_verifyemail     = __~register:verifyemail{1}0;
$do_requireapproval = __~register:requireapproval{1}0;

$notfoundhtml = "<!DOCTYPE HTML PUBLIC '-//IETF//DTD HTML 2.0//EN'>
<html><head>
<title>404 Not Found</title>
</head><body>
<h1>Not Found</h1>
<p>The requested URL was not found on this server.</p>
</body></html>
";        

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

    require_once "__docroot:html5__/__application__/ajax/ga_db_lib.php";
    // check mongo

    if ( !ga_db_status( ga_db_open() ) ) {
        $msg = $ga_db_errors . "\n" . "url: $url\n";
        error_mail( "[mongodb][__menu:modules:id__.php][r0] $msg" );
        $html .= "$error_msg</body></html>";
        echo $html;
        exit();
    }

    # check userid
        
    if ( $doc =
         ga_db_output( 
             ga_db_findOne( 
                 'users',
                 '',
                 [ "_id" => ga_db_output( ga_db_Id( $r ) ) ]
             )
         )
        ) {
        // probably also verify time ? maybe provide a link to resend the email
        if ( !isset( $doc[ 'needsemailverification' ] ) ||
             $doc[ 'needsemailverification' ] != "pending" ) {
            $html = $notfoundhtml;
        } else {
            $update = [];
            $update[ '$set' ][ 'needsemailverification' ] = "verified";
            
            if ( !ga_db_status(
                      ga_db_update(
                          'users',
                          '',
                          [ "_id" => ga_db_output( ga_db_Id( $r ) ) ],
                          $update
                          )
                      )
                ) {
                $msg = $ga_db_errors . "\n" . "url: $url\n";
                error_mail( "[mongodb][__menu:modules:id__.php][r1] $msg" );
                $html .= "$error_msg</body></html>";
                echo $html;
                exit();
            }
            $html .= "<p>Your email address has been successfully verified</p>";
            if ( $do_requireapproval &&
                 isset( $doc[ 'needsapproval' ] ) ) {
                $id  = $doc[ '_id' ];
                $aid = $doc[ 'approvalid' ];
                $did = $doc[ 'denyid' ];
                $html .= "<p>You must now wait for the administrator to approve your registration request</p>";
                $body = "New user requests approval
                User     : " . $doc[ 'name' ] . "
                Email    : " . $doc[ 'email' ] . "
                Remote IP: " . $_SERVER['REMOTE_ADDR'] . "
                Approve  : http://" . $app->hostname . "/__application__/ajax/sys_config/sys_approvedeny_backend.php?_a=$aid&_r=$id
                Deny     : http://" . $app->hostname . "/__application__/ajax/sys_config/sys_approvedeny_backend.php?_d=$did&_r=$id
                ";
                admin_mail( "[__application__][new user approval request] " . $doc[ 'email' ], $body );
            } else {
                $html .= "<p>You may now <a href='http://$app->hostname/__application__'>logon</a></p>";
                admin_mail( "[__application__][new user verified] $email", "User: " . $doc[ 'name' ] . "\nEmail: " . $doc[ 'email' ] . "\n" );
            }
        }
    } else {
        $html = $notfoundhtml;
    }
    echo $html;
    exit();
}   

$html = $notfoundhtml;
echo $html;
exit();
