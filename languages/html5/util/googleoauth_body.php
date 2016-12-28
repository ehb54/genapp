
 if (! isset($_GET['code'])) {
 $auth_url = $client->createAuthUrl();
 	 
 echo filter_var($auth_url, FILTER_SANITIZE_URL);
 
 } else {
   $client->authenticate($_GET['code']);
   $_SESSION['access_token'] = $client->getAccessToken();
   
   $user = $service->userinfo->get();
  
   $username = $user->name;
   $user_id = $user->id;
   $user_email = $user->email;
   $user_link = $user->link;
   $user_picture = $user->picture;

   $username .= '_google';

   if ((int)$_SESSION["first"])
   {    
   	$redirect_uri = "http://" . $app->hostname . "/__application__/". "/?register=1&weloggedingoogle=1&email=$user_email&username=$username";
   }
   else
   {
	$redirect_uri = "http://" . $app->hostname . "/__application__/". "/?weloggedingoogle=1&email=$user_email&username=$username";
   }	

   header('Location: ' . filter_var($redirect_uri, FILTER_SANITIZE_URL));

unset( $_SESSION[ "first" ] );

 }

