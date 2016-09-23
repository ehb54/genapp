<?php

$appconfig = "__appconfig__";

if ( NULL == ( $json = json_decode( file_get_contents( $appconfig ) ) ) ) {
    echo "error: appconfig could not be decoded\n";
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

// -------------------- set up OS env --------------------

if ( !isset( $json->resources->oscluster->properties->domain ) ) {
    echo "error: resources:oscluster:properties:domain not defined in appconfig\n";
    exit;
}

putenv( "OS_TENANT_DOMAIN_NAME=" . $json->resources->oscluster->properties->domain );
putenv( "OS_PROJECT_DOMAIN_NAME=" . $json->resources->oscluster->properties->domain );
putenv( "OS_USER_DOMAIN_NAME=" . $json->resources->oscluster->properties->domain );

if ( !isset( $json->resources->oscluster->properties->project ) ) {
    echo "error: resources:oscluster:properties:project not defined in appconfig\n";
    exit;
}

putenv( "OS_TENANT_NAME=" . $json->resources->oscluster->properties->project );
putenv( "OS_PROJECT_NAME=" . $json->resources->oscluster->properties->project );

$project = $json->resources->oscluster->properties->project;

if ( !isset( $json->resources->oscluster->properties->user ) ) {
    echo "error: resources:oscluster:properties:user not defined in appconfig\n";
    exit;
}

putenv( "OS_USERNAME=" . $json->resources->oscluster->properties->user );

if ( !isset( $json->resources->oscluster->properties->password ) ) {
    echo "error: resources:oscluster:properties:password not defined in appconfig\n";
    exit;
}

putenv( "OS_PASSWORD=" . $json->resources->oscluster->properties->password );

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
?>
