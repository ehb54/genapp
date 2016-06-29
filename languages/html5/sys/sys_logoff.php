<?php
header('Content-type: application/json');
session_start(); 
$window = "";
if ( isset( $_REQUEST[ '_window' ] ) )
{
   $window = $_REQUEST[ '_window' ];
}
unset( $_SESSION[ $window ][ 'logon' ] );
$_SESSION[ $window ] = array( "logon" => "", "project" => "" );
session_write_close(); 
$results[ '_logon' ] = "";
$results[ '_project' ] = "";
$results[ '-close' ] = 1;
$results[ '_status' ] = "complete";
echo (json_encode($results));
exit();
?>
