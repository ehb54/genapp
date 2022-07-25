<?php

global $appjson;

if ( !isset( $appconfig ) ) {
    $appconfig = "__appconfig__";
}

if ( !isset( $appjson ) ) {
    if ( NULL == ( $appjson = json_decode( file_get_contents( $appconfig ) ) ) ) {
        echo '{"error":"appconfig could not be decoded"}';
        exit;
    }
}

if ( !isset( $secretsfile ) ) {
    $secretsfile = "__secrets__";
}

if ( !$appjson->resources ) {
    echo '{"error":"resources not defined in appconfig"}';
    exit;
}

if ( !$appjson->resources->oscluster ) {
    echo '{"error":"resources:oscluster not defined in appconfig"}';
    exit;
}
   
if ( !$appjson->resources->oscluster->properties ) {
    echo '"error":"resources:oscluster:properties not defined in appconfig"}';
    exit;
}

if ( !isset( $secrets ) ) {
    if ( NULL == ( $secrets = json_decode( file_get_contents( $secretsfile ) ) ) ) {
        echo '{"error":"secrets could not be decoded"}';
        exit;
    }
}

## -------------------- set up OS env --------------------

if ( !isset( $json->resources->oscluster->properties->region_name ) ) {
    echo '{"error":"resources:oscluster:properties:region_name not defined in appconfig"}';
    exit;
}

putenv( "OS_REGION_NAME=" . $json->resources->oscluster->properties->region_name );

if ( !isset( $json->resources->oscluster->properties->api_version ) ) {
    echo '{"error::"resources:oscluster:properties:api_version not defined in appconfig"}';
    exit;
}

putenv( "OS_IDENTITY_API_VERSION=" . $json->resources->oscluster->properties->api_version );

if ( !isset( $json->resources->oscluster->properties->auth_url ) ) {
    echo '{"error":"resources:oscluster:properties:auth_url not defined in appconfig"}';
    exit;
}

putenv( "OS_AUTH_URL=" . $json->resources->oscluster->properties->auth_url );

if ( !isset( $json->resources->oscluster->properties->auth_type ) ) {
    echo '{"error:"resources:oscluster:properties:auth_type not defined in appconfig"}';
    exit;
}

putenv( "OS_AUTH_TYPE=" . $json->resources->oscluster->properties->auth_type );

if ( !isset( $json->resources->oscluster->properties->interface ) ) {
    echo '{"error":"resources:oscluster:properties:interface not defined in appconfig"}';
    exit;
}

putenv( "OS_INTERFACE=" . $json->resources->oscluster->properties->interface );

if ( !isset( $appjson->resources->oscluster->properties->user ) ) {
    echo '{"error":"resources:oscluster:properties:user not defined in appconfig"}';
    exit;
}

if ( isset( $json->resources->oscluster->properties->project ) ) {
    $project = $json->resources->oscluster->properties->project;
}

if ( !isset( $json->resources->oscluster->properties->sshuser ) ) {
    echo "error: resources:oscluster:properties:sshuser not defined in appconfig\n";
    exit;
}

$os_sshuser = $json->resources->oscluster->properties->sshuser;

if ( !isset( $json->resources->oscluster->properties->sshidentity ) ) {
    echo "error: resources:oscluster:properties:sshidentity not defined in appconfig\n";
    exit;
}

$os_sshidentity = $json->resources->oscluster->properties->sshidentity;

if ( isset( $project ) ) {
    project_putenv( $project );
}

function project_putenv( $project ) {
    global $secrets;

    if ( !isset( $secrets ) ||
         !isset( $secrets->openstack ) ||
         !isset( $secrets->openstack->projects ) ) {
        echo '{"error":"no secrets->openstack->projects defined in secrets"}';
        exit;
    }
    
    if ( !isset( $secrets->openstack->projects->{$project} ) ) {
        echo '{"error":"project missing from secrets secrets:openstack:projects:$project $secretfile"}';
        exit;
    }

    if ( !isset( $secrets->openstack->projects->{$project}->id ) ) {
        echo '{"error":"project id missing from secrets secrets:openstack:projects:project:id $secretfile"}';
        exit;
    }

    if ( !isset( $secrets->openstack->projects->{$project}->secret ) ) {
        echo '{"error":"project secret missing from secrets secrets:openstack:projects:$project:secret $secretfile"}';
        exit;
    }

    putenv( "OS_APPLICATION_CREDENTIAL_ID=" . $secrets->openstack->projects->{$project}->id );
    putenv( "OS_APPLICATION_CREDENTIAL_SECRET=" . $secrets->openstack->projects->{$project}->secret );
}
