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

// -------------------- set up OS env --------------------

if ( !isset( $appjson->resources->oscluster->properties->domain ) ) {
    echo '{"error":"resources:oscluster:properties:domain not defined in appconfig"}';
    exit;
}

putenv( "OS_TENANT_DOMAIN_NAME=" . $appjson->resources->oscluster->properties->domain );
putenv( "OS_PROJECT_DOMAIN_NAME=" . $appjson->resources->oscluster->properties->domain );
putenv( "OS_USER_DOMAIN_NAME=" . $appjson->resources->oscluster->properties->domain );


// if ( !isset( $json->resources->oscluster->properties->project ) ) {
//    echo "error: resources:oscluster:properties:project not defined in appconfig\n";
//    exit;
// }

if ( isset( $json->resources->oscluster->properties->project ) ) {
    putenv( "OS_TENANT_NAME=" . $json->resources->oscluster->properties->project );
    putenv( "OS_PROJECT_NAME=" . $json->resources->oscluster->properties->project );

    $project = $json->resources->oscluster->properties->project;
}

if ( !isset( $appjson->resources->oscluster->properties->user ) ) {
    echo '{"error":"resources:oscluster:properties:user not defined in appconfig"}';
    exit;
}

putenv( "OS_USERNAME=" . $appjson->resources->oscluster->properties->user );

if ( !isset( $appjson->resources->oscluster->properties->password ) ) {
    echo '{"error":"resources:oscluster:properties:password not defined in appconfig"}';
    exit;
}

putenv( "OS_PASSWORD=" . $appjson->resources->oscluster->properties->password );

if ( !isset( $appjson->resources->oscluster->properties->api_version ) ) {
    echo '{"error":"resources:oscluster:properties:api_version not defined in appconfig"}';
    exit;
}

putenv( "OS_IDENTITY_API_VERSION=" . $appjson->resources->oscluster->properties->api_version );

if ( !isset( $appjson->resources->oscluster->properties->auth_url ) ) {
    echo '{"error":"resources:oscluster:properties:auth_url not defined in appconfig"}';
    exit;
}

putenv( "OS_AUTH_URL=" . $appjson->resources->oscluster->properties->auth_url );
?>
