
if ((int)$_SESSION["first"])
{  
   $redirect_uri = ( isset( $app->oauth2->use_https ) ? "https" : "http" ) . "://"  . $app->hostname . "/__application__/". "/?register=1&weloggedinglobus=1&email=$user_email&name=$user_name&username=$user_username&username_split=$user_username_edited";
}
else
{
   $redirect_uri = ( isset( $app->oauth2->use_https ) ? "https" : "http" ) . "://" . $app->hostname . "/__application__/". "/?weloggedinglobus=1&email=$user_email&name=$user_name&username=$user_username&username_split=$user_username_edited";
}	

 header('Location: ' . filter_var($redirect_uri, FILTER_SANITIZE_URL));

unset( $_SESSION[ "first" ] );
}

