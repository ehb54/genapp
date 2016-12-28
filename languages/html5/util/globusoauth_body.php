
 if (! isset($_GET['code'])) {
 $auth_url = "https://auth.globus.org/v2/oauth2/authorize?client_id=$client_id&redirect_uri=$redirect_uri&scope=$scope&response_type=$response_type";
 //header('Location: ' . filter_var($auth_url, FILTER_SANITIZE_URL));
 echo filter_var($auth_url, FILTER_SANITIZE_URL);
 }
 else 
 {
   $code = $_GET['code'];
   $url = 'https://auth.globus.org/v2/oauth2/token';

   $sPD = array('grant_type' => 'authorization_code', 'redirect_uri' => $redirect_uri, 'code' => $code, 'client_id' => $client_id);
 
   $options_post = array(
    'http' => array(
            'method'  => 'POST',
	    'header'  => array ('Content-type: application/x-www-form-urlencoded'
	    	      	        ,'Authorization: Basic '. base64_encode("$client_id:$client_secret")
				),   
	    'content' => http_build_query($sPD)
           )
    ); 

   $context  = stream_context_create($options_post);
   $result = file_get_contents($url, false, $context);
  
   $res_json = json_decode($result, true);
 
   var_dump($result);
   echo "<br><br>";
   echo ($res_json['other_tokens']['0']['access_token']);     

////////// Access token to get Globus's user profile  /////////////////////////////////////////

  $url_token = 'https://auth.globus.org/v2/oauth2/userinfo';

  $options_use_token = array(
    'http' => array(
            'method'  => 'POST',
	    'header'  => array( 'Authorization: Bearer ' .  $res_json['access_token'] )	    
           )
  ); 

  $context_use_token  = stream_context_create($options_use_token);
  $result_use_token   = file_get_contents($url_token, false, $context_use_token);

  echo "<br>";
  echo "<br>";
  var_dump ($result_use_token);

  $res_json_use_token = json_decode($result_use_token, true);

  $user_email = $res_json_use_token['email'];
  $user_name  = $res_json_use_token['name'];
  $sub_id     = $res_json_use_token['sub'];

///// v2/api/identities resources ////////////////////////////////////

$url_token_id = "https://auth.globus.org/v2/api/identities/" . "$sub_id";


$options_use_token_id = array(
    'http' => array(
            'method'  => 'GET',
	    'header'  => array( 'Authorization: Bearer ' .  $res_json['access_token'] )	    
           )
 ); 

$context_use_token_id  = stream_context_create($options_use_token_id);
$result_use_token_id   = file_get_contents($url_token_id, false, $context_use_token_id);

echo "<br>";
echo "<br>";
var_dump ($result_use_token_id);

$res_json_use_token_id = json_decode($result_use_token_id, true);

echo "<br>";
echo "<br>";
var_dump ($res_json_use_token_id);

echo "<br>";
echo "<br>";

$user_username = $res_json_use_token_id['identity']['username'];

$user_username_edited = str_replace('@', '_', $user_username);
$user_username_edited = str_replace('.', '_', $user_username_edited);
$user_username_edited .= '_globus';		      
$user_username_split = explode("@", $user_username);
echo ( $user_username_split[0] );


/////////// Access token (other tokens) to get XSEDE profile info ///////////////////////////////
$url_token_xsede = 'https://userportal.xsede.org';                //

  $options_use_token_xsede = array(
    'http' => array(
            'method'  => 'POST',
	    'header'  => array( 'Authorization: Bearer ' .  $res_json['other_tokens']['0']['access_token'] )
           )
 ); 

$context_use_token_xsede  = stream_context_create($options_use_token_xsede);
$result_use_token_xsede   = file_get_contents($url_token_xsede, false, $context_use_token);

//////////////////////////////////////////////////////////////////////////////////////////////////////


