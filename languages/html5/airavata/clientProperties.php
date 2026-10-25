<?php

$appjson = json_decode( file_get_contents( "__appconfig__" ) );

if ( null === $appjson ) {
    echo "The file __appconfig__ could not be decoded and is likely missing or corrupt\n";
    exit;
}
if ( !property_exists( $appjson, 'resources' ) ) {
    echo "No resources defined in __appconfig__. Fix this issue and try again.\n";
    exit;
}
if ( !property_exists( $appjson->resources, 'airavata' ) ) {
    echo "resources:airavata must be defined in __appconfig__. Fix this issue and try again.\n";
    exit;
}
if ( !property_exists( $appjson->resources->airavata, 'properties' ) ) {
    echo "resources:airavata:properties must be defined in __appconfig__. Fix this issue and try again.\n";
    exit;
}
if ( !property_exists( $appjson->resources->airavata, 'resources' ) ) {
    echo "resources:airavata:resources must be defined in __appconfig__. Fix this issue and try again.\n";
    exit;
}

$properties = $appjson->resources->airavata->properties;

$GLOBALS["GENAPP_APPLICATION"]               = "__application__";

$GLOBALS["AIRAVATA_GATEWAY"]                 = $properties->gateway;
$GLOBALS["AIRAVATA_SERVER"]                  = $properties->server;
$GLOBALS["AIRAVATA_PORT"]                    = $properties->port;
$GLOBALS["AIRAVATA_TIMEOUT"]                 = $properties->timeout;
$GLOBALS["AIRAVATA_GATEWAY_NAME"]            = $properties->gatewayName;
$GLOBALS["AIRAVATA_EMAIL"]                   = $properties->email;
$GLOBALS["AIRAVATA_LOGIN"]                   = $properties->login;
$GLOBALS["AIRAVATA_PROJECT_ACCOUNT"]         = $properties->projectAccount;
$GLOBALS["AIRAVATA_CREDENTIAL_STORE_TOKEN"]  = $properties->credentialStoreToken;
$GLOBALS["AIRAVATA_SCPUSER"]                 = $properties->scpuser;

$GLOBALS["COMPUTE_RESOURCE"]                 = $appjson->resources->airavata->resources;

if ( isset( $appjson->messaging ) &&
     isset( $appjson->messaging->udphostip ) &&
     isset( $appjson->messaging->udpport ) ) {
    $GLOBALS['udp'] = new stdClass();
    $GLOBALS['udp']->hostip = $appjson->messaging->udphostip;
    $GLOBALS['udp']->port   = $appjson->messaging->udpport;
}
?>
