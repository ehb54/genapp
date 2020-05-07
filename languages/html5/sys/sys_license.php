<?php
header('Content-type: application/json');

session_start(); 

require_once "__docroot:html5__/__application__/ajax/ga_filter.php";

$modjson = [];
$inputs_req = $_REQUEST;
$validation_inputs = ga_sanitize_validate( $modjson, $inputs_req, 'sys_licence' );

if ( $validation_inputs[ "output" ] == "failed" ) {
    $results = array( "error" => $validation_inputs[ "error" ] );
#    $results[ '_status' ] = 'failed';
#    echo ( json_encode( $results ) );
#    exit();
};
#
#
$window = "";
if ( isset( $_REQUEST[ '_window' ] ) )
{
   $window = $_REQUEST[ '_window' ];
}
if ( !isset( $_SESSION[ $window ] ) )
{
   $_SESSION[ $window ] = array( "logon" => "", "project" => "" );
}

session_write_close();

if ( !isset( $_SESSION[ $window ][ 'logon' ] ) ||
     !isset( $_REQUEST[ '_logon' ] ) )
{
    $results[ 'error' ] .= "Not logged in. ";
    echo (json_encode($results));
    exit();
}

require_once "__docroot:html5__/__application__/ajax/ga_db_lib.php";

ga_db_open( true );

if ( $doc = 
     ga_db_output(
         ga_db_findOne( 'license', '', [ "name" => $_SESSION[ $window ][ 'logon' ] ] 
         ) 
     ) 
    ) {
    $results[ 'license' ] = $doc;
} else {
    $results[ 'license' ] = (object)array();
}

if ( strlen( $_REQUEST[ "_logon" ] ) ) {
    $appconfig = json_decode( file_get_contents( "__appconfig__" ) );
    if ( isset( $appconfig->restricted ) ) {
        $results[ "restricted" ] = [];
        foreach ( $appconfig->restricted as $k => $v ) {
            if ( in_array( $_REQUEST[ "_logon" ], $v ) ) {
                array_push( $results[ "restricted" ],  $k );
            }
        }
    }
    __~debug:restricted{error_log( "sys_license " . print_r( json_encode( $results ), true ) . "\n", 3, "/tmp/mylog" );}
}

echo (json_encode($results));

