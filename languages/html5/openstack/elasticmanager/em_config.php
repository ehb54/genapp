<?php

{}

## config

require_once "em_common.php";

define( "EMCONFIG",  "em_config.json" );

if ( !file_exists( EMCONFIG ) ) {
    print "File " . EMCONFIG . " does not exist\n";
    exit;
}

try {
    $emconfig = json_decode( file_get_contents( EMCONFIG ) );
} catch ( Exception $e ) {
    echo $e->getMessage();
    exit -1;
}

if ( !isset( $emconfig->files ) ) {
    error_exit( sprintf( "Error: %s does not have 'files' defined", EMCONFIG ) );
}

if ( !isset( $emconfig->files->state ) ) {
    error_exit( sprintf( "Error: %s does not have 'files:state' defined", EMCONFIG ) );
}    
define( "EMSTATE", $emconfig->files->state );

if ( !isset( $emconfig->files->appconfig ) ) {
    error_exit( sprintf( "Error: %s does not have 'files:appconfig' defined", EMCONFIG ) );
}    
define( "APPCONFIG", $emconfig->files->appconfig );

if ( !isset( $emconfig->files->secrets ) ) {
    error_exit( sprintf( "Error: %s does not have 'files:secrets' defined", EMCONFIG ) );
}    
define( "SECRETS", $emconfig->files->secrets );

if ( !isset( $emconfig->files->lockdir ) ) {
    error_exit( sprintf( "Error: %s does not have 'files:lockdir' defined", EMCONFIG ) );
}    

define( "LOCKDIR", $emconfig->files->lockdir );

## end config
