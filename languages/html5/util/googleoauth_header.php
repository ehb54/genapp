<?php
require_once '../vendor/autoload.php';


session_start();

$reg = $_POST[ 'register' ];

if (!isset($_SESSION['first'])) {
  $_SESSION['first'] = $reg;
} 	

$app = json_decode( file_get_contents( "__appconfig__" ) );

$client_id = $app->oauth2->google->client_id;
$client_secret = $app->oauth2->google->client_secret;

$redirect_uri = "http://" . $app->hostname . "/__application__/util/googleoauth.php";  

$client = new Google_Client();
$client->setClientId($client_id);
$client->setClientSecret($client_secret);
$client->setRedirectUri($redirect_uri);


$client->addScope(Google_Service_Oauth2::USERINFO_PROFILE);
$client->addScope(Google_Service_Oauth2::USERINFO_EMAIL);


$service = new Google_Service_Oauth2($client);