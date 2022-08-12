<?php

global $appjson;

if ( !isset( $appconfig ) ) {
    $appconfig = "__appconfig__";
}

if ( !isset( $appjson ) ) {
    if ( NULL == ( $appjson = json_decode( file_get_contents( $appconfig ) ) ) ) {
        error_exit( "appconfig could not be decoded" );
    }
}

if ( !isset( $secretsfile ) ) {
    $secretsfile = "__secrets__";
}

if ( !$appjson->resources ) {
    error_exit( "resources not defined in appconfig" );
}

if ( !$appjson->resources->oscluster ) {
    error_exit( "resources:oscluster not defined in appconfig" );
}
   
if ( !$appjson->resources->oscluster->properties ) {
    error_exit( "resources:oscluster:properties not defined in appconfig" );
}

if ( !isset( $secrets ) ) {
    if ( NULL == ( $secrets = json_decode( file_get_contents( $secretsfile ) ) ) ) {
        error_exit( "secrets could not be decoded" );
    }
}

## -------------------- set up OS env --------------------

if ( !isset( $appjson->resources->oscluster->properties->region_name ) ) {
    error_exit( "resources:oscluster:properties:region_name not defined in appconfig" );
}

putenv( "OS_REGION_NAME=" . $appjson->resources->oscluster->properties->region_name );

if ( !isset( $appjson->resources->oscluster->properties->api_version ) ) {
    error_exit( "resources:oscluster:properties:api_version not defined in appconfig" );
}

putenv( "OS_IDENTITY_API_VERSION=" . $appjson->resources->oscluster->properties->api_version );

if ( !isset( $appjson->resources->oscluster->properties->auth_url ) ) {
    error_exit( "resources:oscluster:properties:auth_url not defined in appconfig" );
}

putenv( "OS_AUTH_URL=" . $appjson->resources->oscluster->properties->auth_url );

if ( !isset( $appjson->resources->oscluster->properties->auth_type ) ) {
    error_exit( "resources:oscluster:properties:auth_type not defined in appconfig" );
}

putenv( "OS_AUTH_TYPE=" . $appjson->resources->oscluster->properties->auth_type );

if ( !isset( $appjson->resources->oscluster->properties->interface ) ) {
    error_exit( "resources:oscluster:properties:interface not defined in appconfig" );
}

putenv( "OS_INTERFACE=" . $appjson->resources->oscluster->properties->interface );

if ( isset( $appjson->resources->oscluster->properties->project ) ) {
    $project = $appjson->resources->oscluster->properties->project;
}

if ( !isset( $appjson->resources->oscluster->properties->sshuser ) ) {
    error_exit( "resources:oscluster:properties:sshuser not defined in appconfig" );
}

$os_sshuser = $appjson->resources->oscluster->properties->sshuser;

if ( !isset( $appjson->resources->oscluster->properties->sshadmin ) ) {
    error_exit( "resources:oscluster:properties:sshadmin not defined in appconfig" );
}

$os_sshadmin = $appjson->resources->oscluster->properties->sshadmin;

if ( !isset( $appjson->resources->oscluster->properties->sshidentity ) ) {
    error_exit( "resources:oscluster:properties:sshidentity not defined in appconfig" );
}

$os_sshidentity = $appjson->resources->oscluster->properties->sshidentity;

if ( isset( $project ) ) {
    project_putenv( $project );
}

function project_putenv( $project ) {
    global $secrets;

    if ( !isset( $secrets ) ||
         !isset( $secrets->openstack ) ||
         !isset( $secrets->openstack->projects ) ) {
        error_exit( "no secrets->openstack->projects defined in secrets" );
    }
    
    if ( !isset( $secrets->openstack->projects->{$project} ) ) {
        error_exit( "project missing from secrets secrets:openstack:projects:$project $secretfile" );
    }

    if ( !isset( $secrets->openstack->projects->{$project}->id ) ) {
        error_exit( "project id missing from secrets secrets:openstack:projects:project:id $secretfile" );
    }

    if ( !isset( $secrets->openstack->projects->{$project}->secret ) ) {
        error_exit( "project secret missing from secrets secrets:openstack:projects:$project:secret $secretfile" );
    }

    putenv( "OS_APPLICATION_CREDENTIAL_ID=" . $secrets->openstack->projects->{$project}->id );
    putenv( "OS_APPLICATION_CREDENTIAL_SECRET=" . $secrets->openstack->projects->{$project}->secret );
}
