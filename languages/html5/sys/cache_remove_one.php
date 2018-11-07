<?php
header('Content-type: application/json');

session_start(); 

$window = "";
if ( isset( $_REQUEST[ '_window' ] ) )
{
   $window = $_REQUEST[ '_window' ];
}
if ( !isset( $_SESSION[ $window ] ) )
{
   $_SESSION[ $window ] = array( "logon" => "", "project" => "" );
}

if ( !isset( $_SESSION[ $window ][ 'logon' ] ) ||
     !isset( $_REQUEST[ '_logon' ] ) )
{
    $results[ 'error' ] .= "Not logged in. ";
    echo (json_encode($results));
    exit();
}

if ( !isset( $_REQUEST[ "_cachedelete" ] ) ||
     !isset( $_REQUEST[ "_uuid" ] ) ) {
    $results[ 'error' ] .= "Malformed request. ";
    echo (json_encode($results));
    exit();
}
    
try {
    $m = new MongoClient(
        __~mongo:url{"__mongo:url__"}
        __~mongo:cafile{,[], [ "context" => stream_context_create([ "ssl" => [ "cafile" => "__mongo:cafile__" ] ] ) ]}
    );
} catch ( Exception $e ) {
    $results[ 'error' ] .= "Could not connect to the db " . $e->getMessage();
    echo (json_encode($results));
    exit();
}

if ( strlen( $_REQUEST[ "_logon" ] ) ) {
    $appconfig = json_decode( file_get_contents( "__appconfig__" ) );
    $ourperms = [];
    if ( isset( $appconfig->restricted ) ) {
        foreach ( $appconfig->restricted as $k => $v ) {
            if ( in_array( $_REQUEST[ "_logon" ], $v ) ) {
                $ourperms[ $k ] = 1;
            }
        }
    }
    if ( !array_key_exists( $_REQUEST[ "_cachedelete" ], $ourperms ) ) {
        $results[ 'error' ] .= "Not authorized";
        echo (json_encode($results));
        exit();
    }        
    
    $coll = $m->__application__->cache;

    try {
        $coll->remove( array( "jobid" => $_REQUEST[ "_uuid" ] ), array( __~mongojournal{"j" => true, }"justOne" => true ) );
    } catch(MongoCursorException $e) {
        $results[ 'error' ] .= "Could not remove request job from cache";
        echo (json_encode($results));
        exit();
    }        

    $results[ 'success' ] = "true";

    __~debug:cache{error_log( "cache_remove_one " . print_r( json_encode( $results ), true ) . "\n", 3, "/tmp/mylog" );}
}

echo (json_encode($results));
?>
