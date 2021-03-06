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

require_once "__docroot:html5__/__application__/ajax/ga_db_lib.php";
# // connect
if ( ga_db_status( ga_db_open() ) ) {
     # status 
    if ( !ga_db_status(
              ga_db_remove(
                  'session',
                  '',
                  [ '_id' => session_id() ],
                  [ 'justOne' => true ]
              )
         )
        ) {
# TODO log somehow (email?)
#             $results[ 'status' ] .= "Unable to store session id. ";
    }
} else {
# TODO log somehow (email?)
#    $results[ "error" ] = "Could not connect to the db " . $ga_db_errors
#    echo (json_encode($results));
#    exit();
}

session_write_close(); 
$results[ '_logon' ] = "";
$results[ '_project' ] = "";
$results[ '-close' ] = 1;
$results[ '_status' ] = "complete";

echo (json_encode($results));
exit();
