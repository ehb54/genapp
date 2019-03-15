<?php
header('Content-type: application/json');

session_start(); 

$results[ '_status' ] = "complete";

if ( !sizeof( $_REQUEST ) )
{
    $results[ "error" ] = "PHP code received no \$_REQUEST?";
    echo (json_encode($results));
    exit();
}

if ( !isset( $_REQUEST[ "_window" ] ) ) {
    $results[ 'error' ] = "Error in call";
    echo json_encode( $results );
    exit();
}

$window = $_REQUEST[ "_window" ];

if ( !is_string( $_REQUEST[ 'userid' ] ) || 
   strlen( $_REQUEST[ 'userid' ] ) < 3 ||
   strlen( $_REQUEST[ 'userid' ] ) > 30 ||
   !filter_var( $_REQUEST[ 'userid' ], FILTER_VALIDATE_REGEXP, array("options"=>array("regexp"=>'/^[A-Za-z][A-Za-z0-9_]+$/') ) ) )
{
    $results[ "error" ] = "empty or invalid user name";
    echo (json_encode($results));
    exit();
}

$userid = $_REQUEST[ 'userid' ];


#  // FOR GLOBUS&GOOGLE /////
if ( !isset( $_REQUEST[ "globusid" ] ) && !isset( $_REQUEST[ "googleid" ] ) ){  
    if ( !is_string( $_REQUEST[ 'password1' ] ) || strlen( $_REQUEST[ 'password1' ] ) < 10 || strlen( $_REQUEST[ 'password1' ] ) > 100 )
    {
        $results[ "error" ] = "empty or invalid password";
        echo (json_encode($results));
        exit();
    }
}

#  // FOR GLOBUS&GOOGLE /////
if ( !isset( $_REQUEST[ "globusid" ] ) && !isset( $_REQUEST[ "googleid" ] ) ){
    if( $_REQUEST[ 'password1' ] != $_REQUEST[ 'password2' ] )
    {
        $results[ "error" ] = "Passwords do not match";
        echo (json_encode($results));
        exit();
    }
}

$email = filter_var( $_REQUEST[ 'email' ], FILTER_SANITIZE_EMAIL );

if ( !is_string( $email ) || 
   !strlen( $email ) ||
   !filter_var( $email, FILTER_VALIDATE_EMAIL ) )
{
    $results[ "error" ] = "PHP code received empty or invalid email";
    echo (json_encode($results));
    exit();
}

require_once "__docroot:html5__/__application__/ajax/ga_db_lib.php";
$mindate = ga_db_date_add_secs( ga_db_output( ga_db_date() ), -3 * 60 );

ga_db_open( true );

if ( __~enablecaptcha{1}0 ) {
    // check for valid captcha
    if ( !( $doc =
            ga_db_output( 
                ga_db_findOne(
                    'captcha',
                    '',
                    [
                     "window" => $window, 
                     "success" => 1,
                     "time" => [
                         '$gte' => $mindate 
                     ]
                    ]
                )
            )
         )
        ) {
        ga_db_remove( 
            'captcha',
            '',
            [ 
              [ "window" => $window ]
            ] );
        $results[ "error" ] = "Internal error 5401";
        echo (json_encode($results));
        exit();
    }
    ga_db_remove( 
        'captcha',
        '',
        [ 
          [ "window" => $window ]
        ] );
}

# // FOR GLOBUS ///
if ( $doc = 
     ga_db_output( 
         ga_db_findOne(
             'users',
             '',
             [ "name" => $_REQUEST[ 'userid' ] ]
         )
     )
    ) {
    if ( isset( $_REQUEST[ "globusid" ] ) && isset( $doc[ 'globusid' ] ) ) 
    { 
        $results[ 'status' ] = "Globus user id already registered, please try another";
        echo (json_encode($results));
        exit();
    }
}

# // FOR GOOGLE ///

if ( $doc = 
     ga_db_output( 
         ga_db_findOne(
             'users',
             '',
             [ "name" => $_REQUEST[ 'userid' ] ]
         )
     )
    ) {
    if ( isset( $_REQUEST[ "googleid" ] ) && isset( $doc[ 'googleid' ] ) ) 
    { 
        $results[ 'status' ] = "Google user id already registered, please try another";
        echo (json_encode($results));
        exit();
    }
}

if ( $doc = 
     ga_db_output( 
         ga_db_findOne(
             'users',
             '',
             [ "name" => $_REQUEST[ 'userid' ] ]
         )
     )
     && !isset( $_REQUEST[ "globusid" ] )
     && !isset( $_REQUEST[ "googleid" ] ) 
    ) {
    # if ( !isset( $doc['globusid'] ) ||  !isset( $doc['googleid'] )  )
    #  { 	
    $results[ 'status' ] = "User id already registered, please try another ";
    echo (json_encode($results));
    exit();
    #  }
}

# // FOR GLOBUS&GOOGLE ///// 
if ( !isset( $_REQUEST[ "globusid" ] ) && !isset( $_REQUEST[ "googleid" ] ) ) {
    if ( PHP_VERSION_ID < 50500 )
    {
        $pw = crypt( $_REQUEST[ 'password1' ] );
    } else {
        $pw = password_hash( $_REQUEST[ 'password1' ], PASSWORD_DEFAULT );
    }
}

$do_verifyemail     = __~register:verifyemail{1}0;
$do_requireapproval = __~register:requireapproval{1}0;
if ( $do_requireapproval ) {
    $cstrong = true;
    $aid = bin2hex( openssl_random_pseudo_bytes ( 20, $cstrong ) );
    $did = bin2hex( openssl_random_pseudo_bytes ( 20, $cstrong ) );
}

if ( isset( $_REQUEST[ "globusid" ] ) ) {
#  // FOR GLOBUS ///// 
    if ( !ga_db_status(
              ga_db_insert(
                  'users',
                  '',
                  [
                   "name" => $_REQUEST[ 'userid' ]
                   //,"password" => $pw		// FOR GLOBUS /////    
                   ,"email" => $email  
                   ,"globusid" => "yes"                     // FOR GLOBUS /////
                   ,"registered" => ga_db_output( ga_db_date() )
                   ,"registerip" => $_SERVER[ 'REMOTE_ADDR' ]
                   __~register:verifyemail{,"needsemailverification" => "pending"}
                   __~register:requireapproval{,"needsapproval" => "pending"}
                   __~register:requireapproval{,"approvalid" => $aid}
                   __~register:requireapproval{,"denyid" => $did}
                  ]
              )
         )
        ) {
        $results[ 'status' ] = "User id already registered, please try another. " . $ga_db_errors;
        echo (json_encode($results));
        exit();
    }
} else {
    # // FOR GOOGLE /////  
    if ( isset( $_REQUEST[ "googleid" ] ) ){  
        if ( !ga_db_status(
                  ga_db_insert(
                      'users',
                      '',
                      [ 
                        "name" => $_REQUEST[ 'userid' ]
                        //,"password" => $pw		// FOR GOOGLE /////    
                        ,"email" => $email  
                        ,"googleid" => "yes"                     // FOR GOOGLE /////
                        ,"registered" => ga_db_output( ga_db_date() )
                        ,"registerip" => $_SERVER[ 'REMOTE_ADDR' ]
                        __~register:verifyemail{,"needsemailverification" => "pending"}
                        __~register:requireapproval{,"needsapproval" => "pending"}
                        __~register:requireapproval{,"approvalid" => $aid}
                        __~register:requireapproval{,"denyid" => $did}
                      ]
                  )
             )
            ) {
            $results[ 'status' ] = "User id already registered, please try another. " . $ga_db_errors;
            echo (json_encode($results));
            exit();
        } 
    } else {
        if ( !ga_db_status(
                  ga_db_insert(
                      'users',
                      '',
                      [ 
                        "name" => $_REQUEST[ 'userid' ]
                        ,"password" => $pw, "email" => $email
                        ,"registered" => ga_db_output( ga_db_date() )
                        ,"registerip" => $_SERVER[ 'REMOTE_ADDR' ]
                        __~register:verifyemail{,"needsemailverification" => "pending"}
                        __~register:requireapproval{,"needsapproval" => "pending"}
                        __~register:requireapproval{,"approvalid" => $aid}
                        __~register:requireapproval{,"denyid" => $did}
                      ]
                  )
             )
            ) {
            $results[ 'status' ] = "User id already registered, please try another. " . $ga_db_errors;
            echo (json_encode($results));
            exit();
        }
    }
}

$id = '';
if ( $doc = 
     ga_db_output( 
         ga_db_findOne( 'users', '', [ "name" => $_REQUEST[ 'userid' ] ] 
         ) 
     ) 
    ) {
    if ( isset( $doc[ '_id' ] ) ) {
        $id = $doc[ '_id' ];
    }
}
require_once "../mail.php";

$results[ 'status' ] = "User successfully added, you can now login";

if ( $do_verifyemail ) {
    $app = json_decode( file_get_contents( "__appconfig__" ) );
    if ( $do_requireapproval ) {
        $results[ 'status' ] = "User successfully added. An email has been sent, please click the link in the email to verify and begin the approval process";
    } else {
        $results[ 'status' ] = "User successfully added. An email has been sent, please click the link in the email to verify";
    }        
    $body = "Please verify your email address by visiting this link:\n http://" . $app->hostname . "/__application__/ajax/sys_config/sys_register_backend.php?_r=$id";
    mymail( $email, "[__application__][email verify request]", $body );
} else {
    if ( $do_requireapproval ) {
        $app = json_decode( file_get_contents( "__appconfig__" ) );
        $results[ 'status' ] = "User successfully added and awaiting approval";
        $body = "New user requests approval
User     : " . $_REQUEST['userid'] . "
Email    : $email
Remote IP: " . $_SERVER['REMOTE_ADDR'] . "
Approve  : http://" . $app->hostname . "/__application__/ajax/sys_config/sys_approvedeny_backend.php?_a=$aid&_r=$id
Deny     : http://" . $app->hostname . "/__application__/ajax/sys_config/sys_approvedeny_backend.php?_d=$did&_r=$id
";
        
        admin_mail( "[__application__][new user approval request] $email", $body );
    }
}
admin_mail( "[__application__][new user" . ( $do_verifyemail ? " verification request" : "" ) . "] $email", "User: " . $_REQUEST[ 'userid' ] . "\nEmail: $email\n" );

echo (json_encode($results));
exit();
