<?php

$appconfig  = isset( $GLOBALS[ 'appconfig' ] ) ? $GLOBALS[ 'appconfig' ] : "appconfig.json";
$secretfile = isset( $GLOBALS[ 'secrets' ] ) ? $GLOBALS[ 'secrets' ] : "secrets.json";

if ( NULL == ( $json = json_decode( file_get_contents( $appconfig ) ) ) ) {
    echo "error: appconfig could not be decoded\n";
    exit;
}
   
if ( NULL == ( $secrets = json_decode( file_get_contents( $secretfile ) ) ) ) {
    echo "error: $secretfile could not be decoded\n";
    exit;
}
   
if ( !$json->resources ) {
    echo "error: resources not defined in appconfig\n";
    exit;
}

if ( !$json->resources->oscluster ) {
    echo "error: resources:oscluster not defined in appconfig\n";
    exit;
}
   
if ( !$json->resources->oscluster->properties ) {
    echo "error: resources:oscluster:properties not defined in appconfig\n";
    exit;
}

## -------------------- set up OS env --------------------

if ( !isset( $json->resources->oscluster->properties->region_name ) ) {
    echo "error: resources:oscluster:properties:region_name not defined in appconfig\n";
    exit;
}

putenv( "OS_REGION_NAME=" . $json->resources->oscluster->properties->region_name );

if ( !isset( $json->resources->oscluster->properties->api_version ) ) {
    echo "error: resources:oscluster:properties:api_version not defined in appconfig\n";
    exit;
}

putenv( "OS_IDENTITY_API_VERSION=" . $json->resources->oscluster->properties->api_version );

if ( !isset( $json->resources->oscluster->properties->auth_url ) ) {
    echo "error: resources:oscluster:properties:auth_url not defined in appconfig\n";
    exit;
}

putenv( "OS_AUTH_URL=" . $json->resources->oscluster->properties->auth_url );

if ( !isset( $json->resources->oscluster->properties->auth_type ) ) {
    echo "error: resources:oscluster:properties:auth_type not defined in appconfig\n";
    exit;
}

putenv( "OS_AUTH_TYPE=" . $json->resources->oscluster->properties->auth_type );

if ( !isset( $json->resources->oscluster->properties->interface ) ) {
    echo "error: resources:oscluster:properties:interface not defined in appconfig\n";
    exit;
}

putenv( "OS_INTERFACE=" . $json->resources->oscluster->properties->interface );


if ( !isset( $json->resources->oscluster->properties->sshuser ) ) {
    echo "error: resources:oscluster:properties:sshuser not defined in appconfig\n";
    exit;
}

$os_sshuser = $json->resources->oscluster->properties->sshuser;

if ( !isset( $json->resources->oscluster->properties->sshadmin ) ) {
    echo "error: resources:oscluster:properties:sshadmin not defined in appconfig\n";
    exit;
}

$os_sshadmin = $json->resources->oscluster->properties->sshadmin;

if ( !isset( $json->resources->oscluster->properties->sshidentity ) ) {
    echo "error: resources:oscluster:properties:sshidentity not defined in appconfig\n";
    exit;
}

$os_sshidentity = $json->resources->oscluster->properties->sshidentity;

function all_projects() {
    $cmd = "echo 'db.appresourceproject.find()' | mongo global | grep openstack";
    $results = `$cmd`;
    $results = preg_replace( '/^{ "_id" : "/m', '', $results );
    $results = preg_replace( '/" }$/m', '', $results );
    $lines = preg_split( "/\n/", $results, -1, PREG_SPLIT_NO_EMPTY );

    $projects = [];

    foreach ( $lines as $v ) {
        $results = preg_match( '/^([^:]*):([^:]*):([^:]*)$/', $v, $matches );
        if ( strlen( $matches[ 3 ] ) ) {
            $projects[ $matches[ 3 ] ] = 1;
        }
    }
    return $projects;
}

function project_putenv( $project ) {
    global $secrets;
    global $secretfile;
    global $cli_secrets;

    if ( !isset( $secrets ) ||
         !isset( $secrets->openstack ) ||
         !isset( $secrets->openstack->projects ) ) {
        echo "error: no secrets->openstack->projects defined in $secretfile\n";
        exit;
    }
    
    if ( !isset( $secrets->openstack->projects->{$project} ) ) {
        echo "error: project missing from secrets secrets:openstack:projects:$project $secretfile\n";
        exit;
    }

    if ( !isset( $secrets->openstack->projects->{$project}->id ) ) {
        echo "error: project id missing from secrets secrets:openstack:projects:project:id $secretfile\n";
        exit;
    }

    if ( !isset( $secrets->openstack->projects->{$project}->secret ) ) {
        echo "error: project secret missing from secrets secrets:openstack:projects:$project:secret $secretfile\n";
        exit;
    }

    putenv( "OS_APPLICATION_CREDENTIAL_ID=" . $secrets->openstack->projects->{$project}->id );
    putenv( "OS_APPLICATION_CREDENTIAL_SECRET=" . $secrets->openstack->projects->{$project}->secret );

    $cli_secrets =
        "OS_APPLICATION_CREDENTIAL_ID=" . $secrets->openstack->projects->{$project}->id 
        . " OS_APPLICATION_CREDENTIAL_SECRET=\"" . $secrets->openstack->projects->{$project}->secret . "\" "
        ;
}
