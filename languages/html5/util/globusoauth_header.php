<?php

session_start();

if (!isset($_SESSION['first'])) {
  if (isset($_POST[ 'register' ])) {
        $reg = $_POST[ 'register' ];

        //$_SESSION['first'] = $reg;
   }
   else {
       $reg = 0;
   }

  $_SESSION['first'] = $reg;
}


$app = json_decode( file_get_contents( "__appconfig__" ) );

$client_id = $app->oauth2->globus->client_id;

$client_secret = $app->oauth2->globus->client_secret;

$redirect_uri = ( isset( $app->oauth2->use_https ) ? "https" : "http" ) . "://" . $app->hostname . "/__application__/util/globusoauth.php";  

$scope = 'openid+email+profile+urn:globus:auth:scope:userportal.xsede.org:all';

$response_type = 'code';	 

