<?php

session_start();

$reg = $_POST[ 'register' ];

if (!isset($_SESSION['first'])) {
  $_SESSION['first'] = $reg;
} 		


$app = json_decode( file_get_contents( "__appconfig__" ) );

$client_id = $app->oauth2->globus->client_id;

$client_secret = $app->oauth2->globus->client_secret;

$redirect_uri = "http://" . $app->hostname . "/__application__/util/globusoauth.php";  

$scope = 'openid+email+profile+urn:globus:auth:scope:userportal.xsede.org:all';

$response_type = 'code';	 

