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
// connect
try {
     $m = new MongoClient(
         __~mongo:url{"__mongo:url__"}
         __~mongo:cafile{,[], [ "context" => stream_context_create([ "ssl" => [ "cafile" => "__mongo:cafile__" ] ] ) ]}
         );
     # status 
     {
         $msession = $m->__application__->session;
         try {
             $msession->remove( [ "_id" => session_id() ], [ __~mongojournal{"j" => true, }"justOne" => true ] );
         } catch(MongoCursorException $e) {
# TODO log somehow (email?)
#             $results[ 'status' ] .= "Unable to store session id. ";
         }
     }

} catch ( Exception $e ) {
# TODO log somehow (email?)
#    $results[ "error" ] = "Could not connect to the db " . $e->getMessage();
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
?>
