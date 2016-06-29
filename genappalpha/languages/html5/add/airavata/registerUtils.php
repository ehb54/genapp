<?php

$GLOBALS['THRIFT_ROOT'] = 'lib/Thrift/';
require_once $GLOBALS['THRIFT_ROOT'] . 'Transport/TTransport.php';
require_once $GLOBALS['THRIFT_ROOT'] . 'Transport/TBufferedTransport.php';
require_once $GLOBALS['THRIFT_ROOT'] . 'Transport/TSocket.php';
require_once $GLOBALS['THRIFT_ROOT'] . 'Protocol/TProtocol.php';
require_once $GLOBALS['THRIFT_ROOT'] . 'Protocol/TBinaryProtocol.php';
require_once $GLOBALS['THRIFT_ROOT'] . 'Exception/TException.php';
require_once $GLOBALS['THRIFT_ROOT'] . 'Exception/TApplicationException.php';
require_once $GLOBALS['THRIFT_ROOT'] . 'Exception/TProtocolException.php';
require_once $GLOBALS['THRIFT_ROOT'] . 'Exception/TTransportException.php';
require_once $GLOBALS['THRIFT_ROOT'] . 'Base/TBase.php';
require_once $GLOBALS['THRIFT_ROOT'] . 'Type/TType.php';
require_once $GLOBALS['THRIFT_ROOT'] . 'Type/TMessageType.php';
require_once $GLOBALS['THRIFT_ROOT'] . 'Factory/TStringFuncFactory.php';
require_once $GLOBALS['THRIFT_ROOT'] . 'StringFunc/TStringFunc.php';
require_once $GLOBALS['THRIFT_ROOT'] . 'StringFunc/Core.php';

$GLOBALS['AIRAVATA_ROOT'] = 'lib/Airavata/';
require_once $GLOBALS['AIRAVATA_ROOT'] . 'API/Airavata.php';
require_once $GLOBALS['AIRAVATA_ROOT'] . 'Model/AppCatalog/AppDeployment/Types.php';
require_once $GLOBALS['AIRAVATA_ROOT'] . 'Model/AppCatalog/ComputeResource/Types.php';
require_once $GLOBALS['AIRAVATA_ROOT'] . 'Model/AppCatalog/AppInterface/Types.php';
require_once $GLOBALS['AIRAVATA_ROOT'] . 'Model/AppCatalog/GatewayProfile/Types.php';
require_once $GLOBALS['AIRAVATA_ROOT'] . 'Model/Workspace/Types.php';
require_once $GLOBALS['AIRAVATA_ROOT'] . 'API/Error/Types.php';

require_once 'lib/AiravataClientFactory.php';
require_once 'modulesUtils.php';
require_once 'clientProperties.php';

use Airavata\API\Error\AiravataClientException;
use Airavata\API\Error\AiravataSystemException;
use Airavata\API\Error\InvalidRequestException;
use Airavata\Client\AiravataClientFactory;
use Thrift\Protocol\TBinaryProtocol;
use Thrift\Transport\TBufferedTransport;
use Thrift\Transport\TSocket;
use Airavata\API\AiravataClient;
use Thrift\Exception\TTransportException;
use Thrift\Exception\TProtocolException;
use Thrift\Exception\TException;
use Airavata\Model\AppCatalog\ComputeResource\ComputeResourceDescription;
use Airavata\Model\AppCatalog\ComputeResource\ResourceJobManager;
use Airavata\Model\AppCatalog\ComputeResource\ResourceJobManagertype;
use Airavata\Model\AppCatalog\ComputeResource\CloudJobSubmission;
use Airavata\Model\AppCatalog\ComputeResource\LOCALSubmission;
use Airavata\Model\AppCatalog\ComputeResource\SSHJobSubmission;
use Airavata\Model\AppCatalog\ComputeResource\MonitorMode;
use Airavata\Model\AppCatalog\ComputeResource\ProviderName;
use Airavata\Model\AppCatalog\ComputeResource\UNICOREJobSubmission;
use Airavata\Model\AppCatalog\ComputeResource\SecurityProtocol;
use Airavata\Model\AppCatalog\ComputeResource\BatchQueue;
use Airavata\Model\AppCatalog\ComputeResource\FileSystems;
use Airavata\Model\AppCatalog\ComputeResource\JobSubmissionProtocol;
use Airavata\Model\AppCatalog\ComputeResource\JobSubmissionInterface;
use Airavata\Model\AppCatalog\ComputeResource\DataMovementInterface;
use Airavata\Model\AppCatalog\ComputeResource\DataMovementProtocol;
use Airavata\Model\AppCatalog\ComputeResource\SCPDataMovement;
use Airavata\Model\AppCatalog\ComputeResource\GridFTPDataMovement;
use Airavata\Model\AppCatalog\ComputeResource\LocalDataMovement;
use Airavata\Model\AppCatalog\ComputeResource\UNICOREDataMovement;
use Airavata\Model\AppCatalog\AppDeployment\ApplicationModule;
use Airavata\Model\AppCatalog\AppDeployment\ApplicationDeploymentDescription;
use Airavata\Model\AppCatalog\AppDeployment\ApplicationParallelismType;
use Airavata\Model\AppCatalog\AppDeployment\SetEnvPaths;
use Airavata\Model\AppCatalog\AppInterface\InputDataObjectType;
use Airavata\Model\AppCatalog\AppInterface\OutputDataObjectType;
use Airavata\Model\AppCatalog\AppInterface\DataType;
use Airavata\Model\AppCatalog\AppInterface\ApplicationInterfaceDescription;
use Airavata\Model\AppCatalog\GatewayProfile\GatewayResourceProfile;
use Airavata\Model\AppCatalog\GatewayProfile\ComputeResourcePreference;
use Airavata\Model\Workspace\Gateway;

# airavata test functions


function dashline() {
    echo str_repeat( "-", 80 ) . "\n";
}

function jsondump( $title, $obj ) {
    echo "$title:\n";
    dashline();
    echo json_encode( $obj, JSON_PRETTY_PRINT ) . "\n";
    dashline();
}

function airavata_reset( $server, $gatewayId, $port = null, $full_reset = null ) {
# reset the gateway to current

    if ( !isset( $server ) ) {
        fwrite( STDERR, "Error: registerUtils: airavata_reset() must define server\n" );
        exit(254);
    }

    if ( !isset( $gatewayId ) ) {
        fwrite( STDERR, "Error: registerUtils: airavata_reset() must define gatewayId\n" );
        exit(254);
    }

    if ( $port === null ) {
        $port = $GLOBALS['AIRAVATA_PORT'];
    }

    if ( $full_reset !== null ) {
        if ( $full_reset !== "FULL_RESET" ) {
            fwrite( STDERR, "Error: registerUtils: airavata_reset() improper attempt to clear all cr\n" );
            exit(254);
        }
        $full_reset = true;
    } else {
        $full_reset = false;
    }

    echo "Attempting to reset gateway $gatewayId on server $server on thrift port $port\n";
    
    $transport = new TSocket( $server, $port );
    $transport->setSendTimeout($GLOBALS['AIRAVATA_TIMEOUT']);
    $transport->setRecvTimeout($GLOBALS['AIRAVATA_TIMEOUT']);
    $protocol = new TBinaryProtocol($transport);

    try {
        $transport->open();
        $airavataclient = new AiravataClient( $protocol );
        echo "Transport open.\nAiratava server version " . $airavataclient->getAPIVersion() . "\n";
        dashline();
        if ( $airavataclient->isGatewayExist( $gatewayId ) ) {

            # loop thru anything specific to this gateway and delete

            $agcr  = $airavataclient->getAllGatewayComputeResources();
            $agcrp = null;
            try {
                $agcrp = $airavataclient->getAllGatewayComputeResourcePreferences( $gatewayId );
            } 
            catch (\Exception $e) {
            }

            $aam   = $airavataclient->getAllAppModules( $gatewayId );
            $aad   = $airavataclient->getAllApplicationDeployments( $gatewayId );
            $aain  = $airavataclient->getAllApplicationInterfaceNames( $gatewayId );
            $aai   = $airavataclient->getAllApplicationInterfaces( $gatewayId );

            jsondump( "allApplicationInterfaces", $aai );

            foreach ( $aai as $v ) {
                echo "deleteApplicationInterface( $v->applicationInterfaceId )\n";
                $airavataclient->deleteApplicationInterface( $v->applicationInterfaceId );
            }

            jsondump( "allApplicationDeployments", $aad );
            foreach ( $aad as $v ) {
                echo "deleteApplicationDeployment( $v->appDeploymentId )\n";
                $airavataclient->deleteApplicationDeployment( $v->appDeploymentId );
            }

            jsondump( "allAppModules", $aam );
            foreach ( $aam as $v ) {
                echo "deleteApplicationModule( $v->appModuleId )\n";
                $airavataclient->deleteApplicationModule( $v->appModuleId );
            }

            jsondump( "allGatewayComputeResources", $agcr );
            jsondump( "allGatewayComputeResourcePreferences", $agcrp );

            $resource_managers_to_delete = [];

            if ( $agcrp !== null ) {
                foreach ( $agcrp as $v ) {
                    echo "deleteGatewayComputeResourcePreference( $gatewayId, $v->computeResourceId )\n";
                    $airavataclient->deleteGatewayComputeResourcePreference( $gatewayId, $v->computeResourceId );
                    $cr = $airavataclient->getComputeResource( $v->computeResourceId );
                    $k = $v->computeResourceId;
                    foreach( $cr->jobSubmissionInterfaces as $jsi ) {
                        jsondump( "jsi",  $jsi );
                        $sub = null;
                        switch( $jsi->jobSubmissionProtocol ) {
                            case JobSubmissionProtocol::LOCAL :
                                jsondump( "local jobsubmission protocol for $k", $sub = $airavataclient->getLocalJobSubmission( $jsi->jobSubmissionInterfaceId ) );
                            break;
                            case JobSubmissionProtocol::SSH :
                                jsondump( "ssh jobsubmission protocol for $k", $sub = $airavataclient->getSSHJobSubmission( $jsi->jobSubmissionInterfaceId ) );
                            break;
                            case JobSubmissionProtocol::UNICORE :
                                jsondump( "unicore jobsubmission protocol for $k", $sub = $airavataclient->getUNICOREJobSubmission( $jsi->jobSubmissionInterfaceId ) );
                            break;
                            case JobSubmissionProtocol::CLOUD :
                                jsondump( "cloud jobsubmission protocol for $k", $sub = $airavataclient->getCloudJobSubmission( $jsi->jobSubmissionInterfaceId ) );
                            break;
                            default :
                                echo "Unknown job submission protocol $jsi->jobSubmisisonProtocol\n";
                            break;
                        }
                        if ( $sub !== null ) {
                            jsondump( '$sub', $sub );
                            if ( 
                                isset( $sub->resourceJobManager) &&
                                isset( $sub->resourceJobManager->resourceJobManagerId  ) ) {
                                echo "queue resource manager to delete " .  $sub->resourceJobManager->resourceJobManagerId . "\n";
                                $resource_managers_to_delete[] = $sub->resourceJobManager->resourceJobManagerId;
                            } else {
                                echo "not set\n";
                            }
                        }

                        echo "deleting job submission interface $jsi->jobSubmissionInterfaceId\n";
                        $airavataclient->deleteJobSubmissionInterface( $k, $jsi->jobSubmissionInterfaceId );
                    }
                    echo "deleteComputeResource( $v->computeResourceId )\n";
                    $airavataclient->deleteComputeResource( $v->computeResourceId );
                }
            }

            # now delete any resource managers
            foreach ( $resource_managers_to_delete as $v ) {
                echo "deleteing resource manager $v - not active ... key violation on undeleteable *protocol*_submission tables (recommend thrift delete methods for this)\n";
#                $airavataclient->deleteResourceJobManager( $v );
            }

            jsondump( "allApplicationInterfaceNames", $aain );

            # delete the gateway

            echo "deleting the gateway resource profile\n";
            $airavataclient->deleteGatewayResourceProfile( $gatewayId );

            echo "deleting the gateway\n";
            $airavataclient->deleteGateway( $gatewayId );
        } else {
            echo "Gateway does not exist\n";
        }

        if ( $full_reset ) {
            echo "clearing all compute resources\n";
            $acrn = $airavataclient->getAllComputeResourceNames();
            foreach ( $acrn as $k => $v ) {
                jsondump( "computeResource $k", $airavataclient->getComputeResource( $k ) );
                $airavataclient->deleteComputeResource( $k );
            }
        }

        $transport->close();
    } 

    catch (InvalidRequestException $ire)
    {
        echo 'InvalidRequestException: ' . $ire->getMessage() . "\n";
    }
    catch (AiravataClientException $ace)
    {
        echo 'Airavata System Exception: ' . $ace->getMessage() . "\n";
    }
    catch (AiravataSystemException $ase)
    {
        echo 'Airavata System Exception: ' . $ase->getMessage() . "\n";
    }
    catch(TException $tx)
    {
        echo 'There is some connection problem, please check if airavata is runnig properly and try again later' . "\n";
    }
    catch (\Exception $e)
    {
        echo 'Exception: ' . $e->getMessage() . "\n";
    }
}

function airavata_dump( $server = null, $port = null ) {

# get airavata info and echo

    if ( $server === null ) {
        $server = $GLOBALS['AIRAVATA_SERVER'];
    }

    if ( $port === null ) {
        $port = $GLOBALS['AIRAVATA_PORT'];
    }

    dashline();
    echo "appconfig.json properties loaded in clientProperties.php:\n";
    dashline();

    echo "AIRAVATA_GATEWAY                  " . $GLOBALS["AIRAVATA_GATEWAY"] . "\n";
    echo "AIRAVATA_SERVER                   " . $GLOBALS["AIRAVATA_SERVER"] . "\n";
    echo "AIRAVATA_PORT                     " . $GLOBALS["AIRAVATA_PORT"] . "\n";
    echo "AIRAVATA_TIMEOUT                  " . $GLOBALS["AIRAVATA_TIMEOUT"] . "\n";
    echo "AIRAVATA_GATEWAY_NAME             " . $GLOBALS["AIRAVATA_GATEWAY_NAME"] . "\n";
    echo "AIRAVATA_EMAIL                    " . $GLOBALS["AIRAVATA_EMAIL"] . "\n";
    echo "AIRAVATA_LOGIN                    " . $GLOBALS["AIRAVATA_LOGIN"] . "\n";
    echo "AIRAVATA_PROJECT_ACCOUNT          " . $GLOBALS["AIRAVATA_PROJECT_ACCOUNT"] . "\n";
    echo "AIRAVATA_CREDENTIAL_STORE_TOKEN   " . $GLOBALS["AIRAVATA_CREDENTIAL_STORE_TOKEN"] . "\n";
    jsondump( "COMPUTE_RESOURCE",  $GLOBALS["COMPUTE_RESOURCE"] );

    $transport = new TSocket( $server, $port );
    $transport->setSendTimeout($GLOBALS['AIRAVATA_TIMEOUT']);
    $transport->setRecvTimeout($GLOBALS['AIRAVATA_TIMEOUT']);
    $protocol = new TBinaryProtocol($transport);
    try {
        $transport->open();
        $airavataclient = new AiravataClient( $protocol );
        echo "Transport open.\nAiratava server version " . $airavataclient->getAPIVersion() . "\n";
        dashline();
        jsondump( "allGateways",                            $airavataclient->getAllGateways() );
        jsondump( "allComputeResourceNames",                $acrn = $airavataclient->getAllComputeResourceNames() );
        foreach ( $acrn as $k => $v ) {
            jsondump( "computeResource $k", $cr = $airavataclient->getComputeResource( $k ) );
            dumpAllJSIs( $airavataclient, $cr->jobSubmissionInterfaces );
            dumpAllDMIs( $airavataclient, $cr->dataMovementInterfaces );
        }

        jsondump( "allGatewayComputeResources",             $gCRs = $airavataclient->getAllGatewayComputeResources() );
        foreach ($gCRs as $gCr) {
            dashline();
            echo "For gateway $gCr->gatewayID\n";
            dashline();
            jsondump( "allGatewayComputeResourcePreferences", $airavataclient->getAllGatewayComputeResourcePreferences( $gCr->gatewayID ) );
            jsondump( "allAppModules", $airavataclient->getAllAppModules( $gCr->gatewayID ) );
            jsondump( "allApplicationDeployments", $airavataclient->getAllApplicationDeployments( $gCr->gatewayID ) );
            jsondump( "allApplicationInterfaceNames", $ain = $airavataclient->getAllApplicationInterfaceNames( $gCr->gatewayID ) );
            jsondump( "allApplicationInterfaces", $airavataclient->getAllApplicationInterfaces( $gCr->gatewayID ) );
            foreach( $ain as $v ) {
                jsondump( "avaliable application interfaces compute resources for $v", $airavataclient->getAvailableAppInterfaceComputeResources( $v ) );
            }
        }        
        exit();

        if ( !$airavataclient->isGatewayExist( $gatewayId ) ) {
            echo "Gateway does not exist\n";
            exit();
        } 

        echo "Gateway exists\n";
        $gCRs = $airavataclient->getAllGatewayComputeResources();
        echo json_encode( $gCRs, JSON_PRETTY_PRINT ) . "\n";
        $transport->close();
    } 
    catch (InvalidRequestException $ire)
    {
        echo 'InvalidRequestException: ' . $ire->getMessage() . "\n";
    }
    catch (AiravataClientException $ace)
    {
        echo 'Airavata System Exception: ' . $ace->getMessage() . "\n";
    }
    catch (AiravataSystemException $ase)
    {
        echo 'Airavata System Exception: ' . $ase->getMessage() . "\n";
    }
    catch(TException $tx)
    {
        echo 'There is some connection problem, please check if airavata is runnig properly and try again later' . "\n";
    }
    catch (\Exception $e)
    {
        echo 'Exception: ' . $e->getMessage() . "\n";
    }
}

#airavata functions
function register(){
    global $compute_resources;

    $gatewayId = $GLOBALS['AIRAVATA_GATEWAY'];
    $transport = new TSocket($GLOBALS['AIRAVATA_SERVER'], $GLOBALS['AIRAVATA_PORT']);
    $transport->setSendTimeout($GLOBALS['AIRAVATA_TIMEOUT']);
    $transport->setRecvTimeout($GLOBALS['AIRAVATA_TIMEOUT']);
    $protocol = new TBinaryProtocol($transport);
    try{
        $transport->open();
        $airavataclient = new AiravataClient($protocol);

        # setup additional globals

        $compute_resources                = [];
        foreach ( $GLOBALS['COMPUTE_RESOURCE'] as $v ) {
            $compute_resources[ $v->host ] = $v;
        }

        jsondump( '$compute_resources', $compute_resources );

        # -----------------------
        # verify gateway
        # -----------------------

        if(!$airavataclient->isGatewayExist($gatewayId)){
            echo "gateway does not exist\n";
            $gateway = new Gateway();
            $gateway->gatewayId = $gatewayId;
            $gateway->gatewayName = "GenApp_GateWay";
            $gateway->domain = $GLOBALS['AIRAVATA_SERVER'];
            $gateway->emailAddress = $GLOBALS['AIRAVATA_EMAIL'];
            $airavataclient->addGateway($gateway);
            registerComputeResourceHost($airavataclient, $GLOBALS['COMPUTE_RESOURCE']);
        } else {
            echo "gateway exists\n";
            # update gateway if needed
            $gateway = $airavataclient->getGateway( $gatewayId );
            $do_update = 0;
            if ( $gateway->gatewayName != "GenApp_GateWay" ) {
                $do_update = 1;
                $gateway->gatewayName = "GenApp_GateWay";
            }
            if ( $gateway->domain != $GLOBALS['AIRAVATA_SERVER'] ) {
                $do_update = 1;
                $gateway->domain = $GLOBALS['AIRAVATA_SERVER'];
            }
            if ( $gateway->emailAddress != $GLOBALS['AIRAVATA_EMAIL'] ) {
                $do_update = 1;
                $gateway->emailAddress = $GLOBALS['AIRAVATA_EMAIL'];
            }
            if ( $do_update == 1 ) {
                echo "updating the gateway to reflect new appconfig parameters\n";
                $airavataclient->updateGateway( $gatewayId, $gateway );
            }
        }
        
        $our_hostids = syncComputeProfiles( $airavataclient, $gatewayId );

# replaced with syncComputeProfiles
#            if(isGatewayRegistered($airavataclient, $gatewayId)){
#                echo "gateway is registered\n";
#                $cmrf = $airavataclient
#                    ->getGatewayResourceProfile($gatewayId)
#                    ->computeResourcePreferences;
#                registerComputeResourceHost($airavataclient, getUnRegisteredHost($airavataclient, $cmrf));
#            } else {
#                echo "gateway is not registered\n";
#                registerComputeResourceHost($airavataclient, $GLOBALS['COMPUTE_RESOURCE']);
#            }
#        }

        syncModules( $airavataclient, $gatewayId, $our_hostids );

# replaced with syncModules
#        $hostIds = getHostIds($airavataclient, $gatewayId);
#        $registeredModules = getRegisteredModules($airavataclient, $gatewayId);
#        $modulesHost = getUnregisteredModules($airavataclient, $registeredModules);
#        foreach ($modulesHost as $hostName => $modules) {
#            jsondump( "modules", $modules );
#            if(!empty($modules)){
#                if ( !isset( $hostIds[ $hostName ][ 'executable' ] ) || 
#                     !strlen( $hostIds[ $hostName ][ 'executable' ] ) ) {
#                    echo "Error: appconfig.json:resources:airavata:resources:executable not defined for $hostName, this resource will not be registered\n";
#                } else {
#                    if(!empty($modules)){
#                        $moduleids = registerApplicationModule($gatewayId, $airavataclient, $modules);
#                        registerApplicationDeployments($gatewayId, $airavataclient, $moduleids, $modules, $hostIds[$hostName]);
#                        registerApplicationInterfaces($gatewayId, $airavataclient, $moduleids, $modules, $hostName);
#                    }
#                }
#            }
#        }
        $transport->close();
    } 
    catch (InvalidRequestException $ire)
    {
        echo 'InvalidRequestException: ' . $ire->getMessage() . "\n";
    }
    catch (AiravataClientException $ace)
    {
        echo 'Airavata System Exception: ' . $ace->getMessage() . "\n";
    }
    catch (AiravataSystemException $ase)
    {
        echo 'Airavata System Exception: ' . $ase->getMessage() . "\n";
    }
    catch(TException $tx)
    {
        echo 'There is some connection problem, please check if airavata is runnig properly and try again later' . "\n";
    }
    catch (\Exception $e)
    {
        echo 'Exception: ' . $e->getMessage() . "\n";
    }
}

function isGatewayRegistered($client, $gatewayId){
    $gCRs = $client->getAllGatewayComputeResources();
    $exist = false;
    foreach ($gCRs as $gCr) {
        if($gCr->gatewayID === $gatewayId){
            $exist = true;
        }
    }
    return $exist;
}


function getRegisteredModules($client, $gatewayId){
    return $client->getAllApplicationInterfaceNames($gatewayId);    
}

function syncModules( $client, $gatewayId, $cr_hostids ) {
# sync up modules
    $aam  = $client->getAllAppModules               ( $gatewayId );
    $aad  = $client->getAllApplicationDeployments   ( $gatewayId );
    $aain = $client->getAllApplicationInterfaceNames( $gatewayId );
    $aai  = $client->getAllApplicationInterfaces    ( $gatewayId );
    $acrn = $client->getAllComputeResourceNames     ();

    jsondump( "allappmodules", $aam );
    jsondump( "allapplicationdeployments", $aad );
    jsondump( "allapplicationinterfacenames", $aain );
    jsondump( "allapplicationinterface", $aai );
    jsondump( "allComputeResourceNames", $acrn );

    $our_modules = getModulesNames();
    $our_modules_flip = array_flip( $our_modules );

    jsondump( "our_modules", $our_modules );

    # ------------------------------
    # sync modules
    # ------------------------------

    $module_ids           = [];
    $module_ids_indexed   = [];
    $module_ids_to_delete = [];
    $modules_to_add       = [];

    # first, get registered ids and remove any that are not used or duplicates

    foreach ( $aam as $v ) {
        $module_name = $v->appModuleName;
        $module_id   = $v->appModuleId;
        if ( array_key_exists( $module_name,  $our_modules_flip ) ) {
            # this is a valid module
            # have we seen it yet ?
            if ( array_key_exists( $module_name, $module_ids ) ) {
                # ok, it is a dup, delete it
                $module_ids_to_delete[] = $module_id;
            } else {
                # save the id
                $module_ids[ $module_name ] = $module_id;
            }
        } else {
            # not our module, delete it
            $module_ids_to_delete[] = $module_id;
        }
    } 

    # second, see if any of our modules weren't found

    foreach ( $our_modules as $v ) {
        if ( !array_key_exists( $v, $module_ids ) ) {
            $modules_to_add[] = $v;
        }
    }

    jsondump( "module_ids_to_delete", $module_ids_to_delete );
    jsondump( "modules_to_add"      , $modules_to_add       );

    # delete modules

    foreach ( $module_ids_to_delete as $v ) {
        echo "deleting unused or duplicate module $v\n";
        $client->deleteApplicationModule( $v );
    }

    # add the modules and get ids for them

    foreach ( $modules_to_add as $v ) {
        echo "registering new module $v\n";
        $module_ids[ $v ] = 
            $client->registerApplicationModule( $gatewayId,
                                                createApplicationModule( $v, "1.0", $v . " description" ) );
    }

    foreach ( $module_ids as $v ) {
        $module_ids_indexed[] = $v;
    }

    # $module_ids_flip = array_flip( $module_ids );

    # ------------------------------
    # sync application interfaces
    # ------------------------------

    $app_interface_per_module = true;

    if ( $app_interface_per_module ) {
        # one application interface per module

        $app_interface_ids           = [];

        $app_interface_ids_to_delete = [];
        $app_interface_ids           = [];
        $app_interfaces_to_update    = [];
        $app_interfaces_to_add       = [];

        foreach ( $aai as $v ) {
            if ( array_key_exists( $v->applicationName , $module_ids ) ) {
                echo "application interfaces exists for known module $v->applicationName\n";
                $this_module_id_array = array( $module_ids[ $v->applicationName ] );
                if ( $v->applicationModules != $this_module_id_array ) {
                    echo "application interface update required for module $v->applicationName\n";
                    $v->applicationModules = $this_module_id_array;
                    $app_interfacess_to_update[ $v->applicationInterfaceId ] = $v;
                } else {
                    echo "application interface no change for module $v->applicationName\n";
                }
                $app_interface_ids[ $v->applicationName ] = $v->applicationInterfaceId;
            } else {
                echo "application interface to delete for module $v->applicationName\n";
                $app_interface_ids_to_delete[] = $v->applicationInterfaceId;
            }
        }        

        foreach( $module_ids as $k => $v ) {
            if ( !array_key_exists( $k, $app_interface_ids ) ) {
                $app_interfaces_to_add[] = $k;
            }
        }

        jsondump( "app_interfaces_to_update",      $app_interfaces_to_update    );
        jsondump( "app_interfaces_ids_to_delete",  $app_interface_ids_to_delete );
        jsondump( "app_interfaces_to_add",         $app_interfaces_to_add       );

        
        # delete unneeded application interfaces

        foreach ( $app_interface_ids_to_delete as $v ) {
            echo "deleting unused application interface $v\n";
            $client->deleteApplicationInterface( $v );
        }
        
        # update application interfacess
        foreach ( $app_interfaces_to_update as $k => $v ) {
            $client->updateApplicationInterface( $k, $v );
        }

        # add application interfaces
        foreach ( $app_interfaces_to_add as $v ) {
            $id = $client->registerApplicationInterface( 
                $gatewayId,
                createApplicationInterfaceDescription(
                    $v,
                    $v,
                    array( $module_ids[ $v ] ),
                    array (
                        createAppInput(
                            "Input_JSON",
                            "{}",
                            DataType::STRING,
                            null,
                            false,
                            "JSON String",
                            null
                        )
                    ),
                    array ( 
                        createAppOutput(
                            "JSON_Output",
                            "{}", 
                            DataType::STRING
                        )
                    )
                )
                );
            echo "application interface $id for $v created\n";
        }                
    } else {
        # one application interface to rule them all

        $app_interface_name          = "genapp_json";
        $app_interface_id            = "unknown";

        $app_interface_ids_to_delete = [];
        $app_interface_update        = false;
        $app_interface_add           = true;
        
        foreach ( $aai as $v ) {
            if ( $v->applicationName == $app_interface_name ) {
                $app_interface_add    = false;
                if ( $v->applicationModules != $module_ids_indexed ) {
#                jsondump( "test - app modules", $v->applicationModules );
#                jsondump( "test - module_ids_indexed" , $module_ids_indexed );

                    $app_interface_update = true;
                    $app_interface_id     = $v->applicationInterfaceId;
                }
            } else {
                # not ours
                $app_interface_ids_to_delete[] = $v->applicationInterfaceId;
            }       
        }

        jsondump( "app_interface_ids_to_delete", $app_interface_ids_to_delete );
        echo "update " . ( $app_interface_update ? "true" : "false" ) . "\n";
        echo "add "    . ( $app_interface_add    ? "true" : "false" ) . "\n";
        
        # delete app interfaces

        foreach ( $app_interface_ids_to_delete as $v ) {
            echo "deleting unused or duplicate application interface $v\n";
            $client->deleteApplicationInterface( $v );
        }

        if ( $app_interface_add || $app_interface_update ) {
            $app_interface = 
                createApplicationInterfaceDescription(
                    $app_interface_name,
                    $app_interface_name,
                    $module_ids_indexed,
                    array ( 
                        createAppInput(
                            "Input_JSON",
                            "{}",
                            DataType::STRING,
                            null,
                            false,
                            "JSON String",
                            null
                        )
                    ),
                    array ( 
                        createAppOutput(
                            "JSON_Output",
                            "{}", 
                            DataType::STRING
                        )
                    )
                );
            if ( $app_interface_add ) {
                echo "adding application interface $app_interface_name\n";
                $app_interface_id = $client->registerApplicationInterface( $gatewayId, $app_interface );
                echo "interface id $app_interface_id\n";
            } 
            if ( $app_interface_update ) {
                echo "updating application interface $app_interface_name $app_interface_id\n";
                $client->updateApplicationInterface( $app_interface_id, $app_interface );
            }
        }
    }

    # ------------------------------
    # sync application deployments
    # ------------------------------

    # need deployment per compute resource per module

    $app_deployment_names = [];

    # build up existing "names" as "compute_resource_id:module_id"

    foreach ( $cr_hostids as $hostid ) {
        foreach ( $module_ids as $k => $v ) {
            $app_deployment_names[ "$hostid:$v" ] = $k;
        }
    }        

    jsondump( "app_deployment_names", $app_deployment_names );

    $app_deployment_ids_to_delete     = [];
    $app_deployments_to_add           = [];
    $app_deployments_to_update        = [];
    $app_deployment_ids               = [];

    # build up compute ressources by compute resource id

    global $compute_resources;

    # first, get registered ids and remove any that are unused 

    foreach ( $aad as $v ) {
        $name = "$v->computeHostId:$v->appModuleId";
        $hostName = $acrn[ $v->computeHostId ];
        if ( array_key_exists( $hostName, $compute_resources ) ) {
            if ( !array_key_exists( 'executable', $compute_resources[ $hostName ] ) ) {
                fwrite( STDERR, "ERROR: appconfig.json:resources:airavata:resources:executable not defined for $hostName.\n" );
                $epath = "not_defined";
            } else {
                $epath = $compute_resources[$hostName]->executable;
            }
        } else {
            $epath = "not_defined";
        }

        if ( array_key_exists( $name, $app_deployment_names ) ) {
            // echo "valid application deployment $name\n";
            # save the id
            $app_deployment_ids[ $name ] = $module_id;

            # check for changes
            # notice: when we add more configuratin fields effecting deployment, we need to add them here
            $do_update = false;
            if ( $v->executablePath != $epath . "/" . $app_deployment_names[ $name ] ) {
                $v->executablePath = $epath . "/" . $app_deployment_names[ $name ];
                $do_update = true;
            } 

            if ( $do_update ) {
                echo "application deployment $name will be updated\n";
                $app_deployments_to_update[ $v->appDeploymentId ] = $v;
            } else {
                echo "valid application deployment $name exists\n";
            }
        } else {
            $app_deployment_ids_to_delete[] = $v->appDeploymentId;
        }
    }

    # second, see if any of our application deployments weren't found

    foreach ( $app_deployment_names as $k => $v ) {
        if ( !array_key_exists( $k, $app_deployment_ids ) ) {
            $app_deployments_to_add[] = $k;
        }
    }

    jsondump( "app_deployment_ids"          , $app_deployment_ids           );
    jsondump( "app_deployments_to_add"      , $app_deployments_to_add       );
    jsondump( "app_deployments_to_update"   , $app_deployments_to_update    );
    jsondump( "app_deployment_ids_to_delete", $app_deployment_ids_to_delete );

    # delete unneeded application deployments

    foreach ( $app_deployment_ids_to_delete as $v ) {
        echo "deleting unused application deployment $v\n";
        $client->deleteApplicationDeployment( $v );
    }
    
    # update application deployments
    foreach ( $app_deployments_to_update as $k => $v ) {
        $client->updateApplicationDeployment( $k, $v );
    }

    # add application deployments
    foreach ( $app_deployments_to_add as $v ) {
        $tmp = explode( ':', $v );
        if ( count( $tmp ) != 2 ) {
            fwrite( STDERR, "Error: registerUtils: syncModules() error splitting deployment id $v\nDid a module or system name contain a colon ':' ?\n" );
            exit( 254 );
        }
        $compute_host_id = $tmp[ 0 ];
        $app_module_id   = $tmp[ 1 ];
        $module_name     = $app_deployment_names[ $v ];
        
#        echo "add module name: $module_name\n    compute host id: $compute_host_id\n    app module id: $app_module_id to deployments\n";

        $hostName = $acrn[ $compute_host_id ];
        if ( !array_key_exists( 'executable', $compute_resources[ $hostName ] ) ) {
            fwrite( STDERR, "ERROR: appconfig.json:resources:airavata:resources:executable not defined for $hostName.\n" );
            $epath = "not_defined";
        } else {
            $epath = $compute_resources[$hostName]->executable;
        }

        $id = $client->registerApplicationDeployment( 
            $gatewayId,
            createApplicationDeployment( 
                $app_module_id,
                $compute_host_id,
                $epath . "/" . $module_name,
                ApplicationParallelismType::SERIAL,
                $module_name . " application description"
            )
            );
        echo "application deployment $id for $module_name on $compute_host_id created\n";
    }                

    exit;
}

function getUnregisteredModules($client,$registeredModules){
  $unregisteredModules = array();
  $unregisteredModulesForHost = array();
  $modules = getModulesNames();
  $modules_flip = array_flip( $modules );
  foreach ($GLOBALS['COMPUTE_RESOURCE'] as $resource) {
      $unregisteredModules[$resource->host] =  array();
  }
  jsondump( "getunregisteredmodules modules", $modules );
  jsondump( "getunregisteredmodules modules_flip", $modules_flip );
  foreach ($modules as $index => $id) {
      foreach ($GLOBALS['COMPUTE_RESOURCE'] as $resource) {
        $name = $id."_".$resource->host;
        $unregisteredModules[$resource->host][] = $id ;     
        if(isset($registeredModules[$name])){
            foreach ($client->getAvailableAppInterfaceComputeResources($name) as $hostId => $hostName) {
              if($hostName == $resource->host){
                  echo $name." is already registered for $hostName \n";
                  unset($unregisteredModules[$hostName][$index]);  
              }
              echo "hostid $hostId hostname $hostName\n";
            }
        }

      }
  }
  return $unregisteredModules;
}

function ourResourceManagerToEnum( $resourcemanager ) {
    switch( $resourcemanager ) {
        case "fork"   : return ResourceJobManagerType::FORK;  break;
        case "pbs"    : return ResourceJobManagerType::PBS;   break;
        case "slurm"  : return ResourceJobManagerType::SLURM; break;
        case "lsf"    : return ResourceJobManagerType::LSF;   break;
        case "uge"    : return ResourceJobManagerType::UGE;   break;
        default       : fwrite( STDERR, "Error: ourResourceManagerToEnum: unknown resource manager $resourcemanager\n" ); exit(254); break;
    }
# should never get here

    return 0;
}

function ourJobSubmissionProtocolToEnum( $jsp ) {
    switch( $jsp ) {
        case "local"   : return JobSubmissionProtocol::LOCAL;   break;
        case "ssh"     : return JobSubmissionProtocol::SSH;     break;
        case "unicore" : return JobSubmissionProtocol::UNICORE; break;
        case "cloud"   : return JobSubmissionProtocol::CLOUD;   break;
        default       : fwrite( STDERR, "Error: ourJobSubmissionProtocolToEnum: unknown job submission protocol $jsp\n" ); exit(254); break;
    }
# should never get here
    return 0;
}

function ourDataMovementProtocolToEnum( $dmp ) {
    switch( $dmp ) {
        case "local"                   : return DataMovementProtocol::LOCAL;                   break;
        case "scp"                     : return DataMovementProtocol::SCP;                     break;
        case "sftp"                    : return DataMovementProtocol::SFTP;                    break;
        case "gridftp"                 : return DataMovementProtocol::GridFTP;                 break;
        case "unicore_storage_service" : return DataMovementProtocol::UNICORE_STORAGE_SERVICE; break;

        default       : fwrite( STDERR, "Error: ourDataMovementProtocolToEnum: unknown data movement protocol $dmp\n" ); exit(254); break;
    }
# should never get here
    return 0;
}


# --- Job Submission Interfaces

function dumpAllJSIs( $client, $jsilist ) {
    if ( is_array( $jsilist ) ) {
        foreach ( $jsilist as $jsi ) {
            jsondump( "job submission interface $jsi->jobSubmissionInterfaceId", getJobSubmissionInterface( $client, $jsi ) );
        }
    }
}

function getJobSubmissionInterface( $client, $jsi ) {
    switch( $jsi->jobSubmissionProtocol ) {
        case JobSubmissionProtocol::LOCAL   : return $client->getLocalJobSubmission  ( $jsi->jobSubmissionInterfaceId ); break;
        case JobSubmissionProtocol::SSH     : return $client->getSSHJobSubmission    ( $jsi->jobSubmissionInterfaceId ); break;
        case JobSubmissionProtocol::UNICORE : return $client->getUNICOREJobSubmission( $jsi->jobSubmissionInterfaceId ); break;
        case JobSubmissionProtocol::CLOUD   : return $client->getCloudJobSubmission  ( $jsi->jobSubmissionInterfaceId ); break;
        default       : fwrite( STDERR, "getJobSubmissionInterface unknown job submission protocol $jsi->JobSubmissionProtocol\n" ); exit(254); break;
    }
# should never get here
    return 0;
}

function addJobSubmissionInterface( $client, $hostId, $jsp, $jobsubmission ) {
    if ( !array_key_exists( 'resourcemanager', $jobsubmission ) ) {
        fwrite( STDERR, "Error: addJobSubmissionInterface: 'resourcemanager' not defined for job submission $jsp on host $hosstId\n" );
        exit( 254 );
        break;
    }        

    $rm = createResourceJobManager( 
        ourResourceManagerToEnum( $jobsubmission->resourcemanager )
        ,null
        , isset( $jobsubmission->jobmanagerbinpath  ) ? $jobsubmission->jobmanagerbinpath  : null
        , isset( $jobsubmission->jobmanagercommands ) ? $jobsubmission->jobmanagercommands : null
        );

    switch( $jsp ) {
        case JobSubmissionProtocol::LOCAL :
        {

            $submission = new LOCALSubmission();
            $submission->resourceJobManager = $rm;
            $localSubmission = $client->addLocalSubmissionDetails( 
                $hostId
                ,isset( $jobsubmission->priority ) ? $jobsubmission->priority : 0
                ,$submission 
                );
            echo "registered ".$localSubmission."\n";
        }
        break;
        case JobSubmissionProtocol::SSH :
        {
            $submission = new SSHJobSubmission();
            $submission->resourceJobManager = $rm;
            $submission->securityProtocol   = SecurityProtocol::SSH_KEYS;
            $submission->monitorMode        = MonitorMode::POLL_JOB_MANAGER;
            $sshSubmission = $client->addSSHJobSubmissionDetails(
                $hostId
                ,isset( $jobsubmission->priority ) ? $jobsubmission->priority : 0
                ,$submission 
                );
            echo "registered ".$sshSubmission."\n";
        }
        break;
        case JobSubmissionProtocol::UNICORE :
        {
            echo "error: unicore job submission not currently supported\n";
            exit(254);
            $submission = new UNICOREJobSubmission();
            $submission->resourceJobManager = $rm;
            $submission->securityProtocol   = SecurityProtocol::SSH_KEYS;
            $submission->unicoreEndPointURL = "not setup";
            $unicoreSubmission = $client->addUNICOREJobSubmissionDetails(
                $hostId
                ,isset( $jobsubmission->priority ) ? $jobsubmission->priority : 0
                ,$submission 
                );
            echo "registered ".$unicoreSubmission."\n";
        }
        break;
        case JobSubmissionProtocol::CLOUD :
        {
            echo "error: cloud job submission not currently supported\n";
            exit(254);
            $submission = new CloudJobSubmission();
            $submission->resourceJobManager = $rm;
            $submission->securityProtocol   = SecurityProtocol::SSH_KEYS;
            $submission->nodeId             = "not setup";
            $submission->executableType     = "not setup";
            $submission->providerName       = ProviderName::EC2;
            $cloudSubmission = $client->addCloudJobSubmissionDetails(
                $hostId
                ,isset( $jobsubmission->priority ) ? $jobsubmission->priority : 0
                ,$submission 
                );
            echo "registered ".$cloudSubmission."\n";
        }
        break;
        default :
        {
            fwrite( STDERR, "Error: registerUtils: registerHost() unknown submission type $jsp\n" );
            exit(254);
        }
        break;
    }   
}    

# --- data movement interfaces

function dumpAllDMIs( $client, $dmilist ) {
    if ( is_array( $dmilist ) ) {
        foreach ( $dmilist as $dmi ) {
            jsondump( "data movement interface $dmi->dataMovementInterfaceId", getDataMovementInterface( $client, $dmi ) );
        }
    }
}

function getDataMovementInterface( $client, $dmi ) {
    switch( $dmi->dataMovementProtocol ) {
        case DataMovementProtocol::LOCAL                   : return $client->getLocalDataMovement  ( $dmi->dataMovementInterfaceId ); break;
        case DataMovementProtocol::SCP                     : return $client->getSCPDataMovement    ( $dmi->dataMovementInterfaceId ); break;
        case DataMovementProtocol::SFTP                    : return $client->getSFTPDataMovement   ( $dmi->dataMovementInterfaceId ); break;
        case DataMovementProtocol::GridFTP                 : return $client->getGridFTPDataMovement( $dmi->dataMovementInterfaceId ); break;
        case DataMovementProtocol::UNICORE_STORAGE_SERVICE : return $client->getUnicoreDataMovement( $dmi->dataMovementInterfaceId ); break;

        default       : fwrite( STDERR, "getDataMovementInterface unknown data movement protocol $dmi->dataMovementProtocol\n" ); exit(254); break;
    }
# should never get here
    return 0;
}

function createDataMovementInterface( $dmip, $dmi ) {
    // jsondump( "create dmi dmi", $dmi );

    switch( $dmip ) {
        case DataMovementProtocol::LOCAL                   : {
            $move = new LocalDataMovement();
            return $move;
        }
        break;

        case DataMovementProtocol::SCP                     : {
            $move = new SCPDataMovement();
            $move->securityProtocol       = SecurityProtocol::SSH_KEYS;
            $move->alternativeSCPHostName = isset( $dmi->scphost ) ? $dmi->scphost : "";
            $move->sshPort                = isset( $dmi->sshport ) ? $dmi->sshport : 0;
            return $move;
        }
        break;
            
        case DataMovementProtocol::SFTP                    : {
            fwrite( STDERR, "SFTP data movement unsupported\n" ); exit(254); break;            
        }
        break;

        case DataMovementProtocol::GridFTP                 : {
            $move = new GridFTPDataMovement();
            $move->securityProtocol       = SecurityProtocol::SSH_KEYS;
            $move->gridFTPEndPoints       = isset( $dmi->endpoints ) ? $dmi->endpoints : [];
            return $move;
        }
        break;

        case DataMovementProtocol::UNICORE_STORAGE_SERVICE : {
            $move = new UNICOREDataMovement();
            $move->securityProtocol       = SecurityProtocol::SSH_KEYS;
            $move->unicoreEndPointURL     = isset( $dmi->endpoint ) ? $dmi->endpoint : "";
            return $move;
        }
        break;

        default       : fwrite( STDERR, "addDataMovementInterface :  unknown data movement protocol $dmip\n" ); exit(254); break;

    }
}

function updateDataMovementInterface( $client, $dmip, $dmi ) {
    $dmi_id = $dmi->dataMovementInterfaceId;
    jsondump( "update DMI dmi:", $dmi );
    switch( $dmip ) {
        case DataMovementProtocol::LOCAL                   : $client->updateLocalDataMovementDetails  ( $dmi_id, $dmi ); break;
        case DataMovementProtocol::SCP                     : $client->updateSCPDataMovementDetails    ( $dmi_id, $dmi ); break;
        case DataMovementProtocol::GridFTP                 : $client->updateGridFTPDataMovementDetails( $dmi_id, $dmi ); break;
        case DataMovementProtocol::UNICORE_STORAGE_SERVICE : $client->updateUNICOREDataMovementDetails( $dmi_id, $dmi ); break;

        case DataMovementProtocol::SFTP                    : fwrite( STDERR, "SFTP data movement unsupported by airavata thrift\n" ); exit(254); break;
        default       : fwrite( STDERR, "addDataMovementInterface :  unknown data movement protocol $dmip\n" ); exit(254); break;
    }
}


function addDataMovementInterface( $client, $hostId, $dmip, $dmi ) {
    $move = createDataMovementInterface( $dmip, $dmi );

    switch( $dmip ) {
        case DataMovementProtocol::LOCAL                   : $client->addLocalDataMovementDetails  ( $hostId, isset( $dmi->priority ) ? $dmi->priority : 0, $move ); break;
        case DataMovementProtocol::SCP                     : $client->addSCPDataMovementDetails    ( $hostId, isset( $dmi->priority ) ? $dmi->priority : 0, $move ); break;
        case DataMovementProtocol::GridFTP                 : $client->addGridFTPDataMovementDetails( $hostId, isset( $dmi->priority ) ? $dmi->priority : 0, $move ); break;
        case DataMovementProtocol::UNICORE_STORAGE_SERVICE : $client->addUNICOREDataMovementDetails( $hostId, isset( $dmi->priority ) ? $dmi->priority : 0, $move ); break;

        case DataMovementProtocol::SFTP                    :  fwrite( STDERR, "SFTP data movement unsupported\n" ); exit(254); break;             break;
        default       : fwrite( STDERR, "addDataMovementInterface :  unknown data movement protocol $dmip\n" ); exit(254); break;

    }
}

# register host

function registerHost($client, $resource){
    $hostName = $resource->host;
    $resourceDesc = createComputeResourceDescription( $hostName, $resource->description, null, null);
    jsondump( "registerHost: resourceDesc", $resourceDesc );
    $hostId = $client->registerComputeResource($resourceDesc);
    jsondump( "getcomputeresource", $client->getComputeResource( $hostId ) );
#    $client->updateComputeResource( $hostId, $resourceDesc );
#    jsondump( "getcomputeresource after update", $client->getComputeResource( $hostId ) );
    
#    $resourceJobManager = createResourceJobManager(ResourceJobManagerType::FORK, null, null, null);
    global $compute_resources;

    if ( array_key_exists( 'jobsubmission', $compute_resources[ $hostName ] ) ) {
        foreach ( $compute_resources[ $hostName ]->jobsubmission as $k => $v ) {
            addJobSubmissionInterface( $client, $hostId, ourJobSubmissionProtocolToEnum( $k ), $v );
        }
    }

    return $hostId;
}

# returns array of used hostids
function syncComputeProfiles( $client, $gatewayId ) {
# sync $GLOBALS[ 'COMPUTE_RESOURCE' ] with gateway profile

    $acrn  = $client->getAllComputeResourceNames();
    $agcrp = $client->getAllGatewayComputeResourcePreferences( $gatewayId );

# build up array with of compute resource host names

    $handled_hosts = [];
    $our_hostids   = [];

    global $compute_resources;

    $existing_hostids = [];

    # remember the last one

    foreach( $acrn as $k => $v ) {
        $existing_hostids[ $v ] = $k;
    }

    foreach ( $agcrp as $v ) {
        $id = $v->computeResourceId;
        $n = $acrn[$v->computeResourceId];

        if ( isset( $compute_resources[$n] ) ) {
            $our_hostids[ $n ] = $id;
            $our_resource_preference = ourResourceToResourcePreference( $id, $compute_resources[$n] );
            if ( $v == $our_resource_preference ) {
               echo "no change to gateway compute resource preference $id\n";
            } else {
                echo "updating gateway compute resource preference $id\n";
                $client->updateGatewayComputeResourcePreference( $gatewayId, $id, $our_resource_preference );
            }
            // echo "--! id is $id n is $n\n";
            $cr = $client->getComputeResource( $id );
            $our_cr = createComputeResourceDescription( $n, $compute_resources[ $n ]->description, null, null );
            $our_cr->computeResourceId       = $cr->computeResourceId;
            // $our_cr->jobSubmissionInterfaces = $cr->jobSubmissionInterfaces;
            // $our_cr->dataMovementInterfaces  = $cr->dataMovementInterfaces;
            // jsondump( "cr", $cr );
            // jsondump( "our_cr", $our_cr );
            
            if ( true || $cr != $our_cr ) {
                echo "updating compute resource description $id\n";
                $client->updateComputeResource( $id, $our_cr );

                # fix up batch queues (one would think updateComputeResource would do this, but it doesn't

                $obqs = [];

                if ( array_key_exists( 'batchQueues', $our_cr ) && is_array( $our_cr->batchQueues ) ) {
                    foreach ( $our_cr->batchQueues as $obq ) {
                        $obqs[ $obq->queueName ] = $obq;
                    }
                }

                if ( array_key_exists( 'batchQueues', $cr ) && is_array( $cr->batchQueues ) ) {
                    foreach ( $cr->batchQueues as $bq ) {
                        if ( !array_key_exists( $bq->queueName, $obqs ) ) {
                            echo "deleting batch queue $bq->queueName\n";
                            $client->deleteBatchQueue( $id, $bq->queueName );
                        }
                    }
                }
                
                # fix up job submission interfaces

                $our_jsi = isset( $compute_resources[ $n ]->jobsubmission ) ? $compute_resources[ $n ]->jobsubmission : [];
                // jsondump( '$our_jsi', $our_jsi );

                $our_protocols = [];
                foreach ( $our_jsi as $k2 => $v2 ) {
                    $our_protocols[ ourJobSubmissionProtocolToEnum( $k2 ) ] = $v2;
                }

                // jsondump( '$our_protocols', $our_protocols );
                // jsondump( '$cr->jobSubmissionInterfaces', $cr->jobSubmissionInterfaces );

                # 1st match protocol with our selected protocols, add & delete as needed
                # if exists already, dig into details and update as needed

                foreach ( $cr->jobSubmissionInterfaces as $cr_jsi ) {
                    $jsi_id = $cr_jsi->jobSubmissionInterfaceId;
                    $jsi_p  = $cr_jsi->jobSubmissionProtocol;

                    if ( array_key_exists( $jsi_p, $our_protocols ) ) {
                        // echo "we have interface $jsi_p, to dig in to verify details\n";
                        $sub = getJobSubmissionInterface( $client, $cr_jsi );
                        //  jsondump( "job submission details for $jsi_id", $sub );

                        $rjm      = $sub->resourceJobManager;
                        $rjm_id   = $rjm->resourceJobManagerId;
                        
                        $update   = false;

                        $updating = "updating resource job manager $rjm_id new";

                        if ( $rjm->resourceJobManagerType != ourResourceManagerToEnum( $our_protocols[ $jsi_p ]->resourcemanager ) ) {
                            $rjm->resourceJobManagerType = ourResourceManagerToEnum( $our_protocols[ $jsi_p ]->resourcemanager );
                            $updating .=  " type '$rjm->resourceJobManagerType'";
                            $update   = true;
                        }
                        
                        if ( !array_key_exists( 'jobmanagerbinpath',  $our_protocols[ $jsi_p ] ) ) {
                            $our_protocols[ $jsi_p ]->jobmanagerbinpath  = null;
                        }

                        if ( $rjm->jobManagerBinPath != $our_protocols[ $jsi_p ]->jobmanagerbinpath ) {
                            $rjm->jobManagerBinPath = $our_protocols[ $jsi_p ]->jobmanagerbinpath;
                            $updating .=  " job manager bin path '$rjm->jobManagerBinPath'";
                            $update    = true;
                        }
                        
                        if ( !array_key_exists( 'jobmanagercommands',  $our_protocols[ $jsi_p ] ) ) {
                            $our_protocols[ $jsi_p ]->jobmanagercommands  = [];
                        }

                        if ( $rjm->jobManagerCommands != $our_protocols[ $jsi_p ]->jobmanagercommands ) {
                            $rjm->jobManagerCommands = $our_protocols[ $jsi_p ]->jobmanagercommands;
                            $updating .=  " job manager commands '" . implode( "','", $rjm->jobManagerCommands ) . "'";
                            $update    = true;
                        }

                        if ( $update ) {
                            echo "$updating\n";
                            $client->updateResourceJobManager( $rjm_id, $rjm );
                            // jsondump( "after update, job submission details for $jsi_id", getJobSubmissionInterface( $client, $cr_jsi ) );
                        } else {
                            echo "resource job manager $rjm_id ok\n";
                        }
                        
                        unset( $our_protocols[ $jsi_p ] );
                    } else {
                        echo "delete job submission interface $jsi_id with protocol $jsi_p\n";
                        $client->deleteJobSubmissionInterface( $id, $jsi_id );
                    }
                } // job submission interfaces

                foreach ( $our_protocols as $k2 => $v2 ) {
                    echo "add protocol $k2\n";
                    addJobSubmissionInterface( $client, $id, $k2, $v2 );
                }

                # fix up data movement interfaces

                $our_dmi = isset( $compute_resources[ $n ]->datamovement ) ? $compute_resources[ $n ]->datamovement : [];
                // jsondump( '$our_dmi', $our_dmi );

                $our_movements = [];
                foreach ( $our_dmi as $k2 => $v2 ) {
                    $our_movements[ ourDataMovementProtocolToEnum( $k2 ) ] = $v2;
                }

                # 1st match data movement with our selected movements, add & delete as needed
                # if exists already, dig into details and update as needed

                if ( is_array( $cr->dataMovementInterfaces ) ) {
                    foreach ( $cr->dataMovementInterfaces as $cr_dmi ) {
                        $dmi_id = $cr_dmi->dataMovementInterfaceId;
                        $dmi_p  = $cr_dmi->dataMovementProtocol;

                        if ( array_key_exists( $dmi_p, $our_movements ) ) {
                            // echo "we have interface $dmi_p, to dig in to verify details\n";
                            $move = getDataMovementInterface( $client, $cr_dmi );

                            $our_move = createDataMovementInterface( $dmi_p, $our_movements[ $dmi_p ] );
                            jsondump( "our data movement details for $dmi_id", $our_move );

                            $our_move->dataMovementInterfaceId = $move->dataMovementInterfaceId;

                            if ( $move != $our_move ) {
                                echo "updating data movement interface $dmi_id\n";
                                updateDataMovementInterface( $client, $dmi_p, $our_move );
                            }
                            unset( $our_movements[ $dmi_p ] );
                        } else {
                            echo "delete data movement interface $dmi_id with protocol $dmi_p\n";
                            $client->deleteDataMovementInterface( $id, $dmi_id );
                        }
                    } // foreach data movement interfaces
                } // if is_array data movement interfaces

                foreach ( $our_movements as $k2 => $v2 ) {
                    echo "add data movement $k2\n";
                    addDataMovementInterface( $client, $id, $k2, $v2 );
                }
            } // $cr != $our_cr

        } else {
            echo "deleting unknown gateway compute resource preference $id\n";
            $client->deleteGatewayComputeResourcePreference( $gatewayId, $id );
        }

        $handled_hosts[ $n ] = true;
    } 

# add non-handled hosts

    foreach ( $compute_resources as $k => $v ) {
        if ( array_key_exists( $k, $handled_hosts ) ) {
            continue;
        }
        echo "new host $k\n";
        # do we have an id
        $id = "unknown";
        if ( array_key_exists( $k, $existing_hostids ) ) {
            echo "compute resource id exists\n";
            $id = $existing_hostids[ $k ];
        } else {
            echo "registering compute resource, getting new id\n";
            $id = registerHost( $client, $v );
        }

        $our_resource_preference = ourResourceToResourcePreference( $id, $v );
        echo "adding gateway compute resource preference $id\n";
        $client->addGatewayComputeResourcePreference( $gatewayId, $id, $our_resource_preference );

        $our_hostids[ $k ] = $id;
    }

    return $our_hostids;
}
    
function ourResourceToResourcePreference( $hostId, $resourceHost ) {
   $resourcePreference                                 = new ComputeResourcePreference();
   $resourcePreference->computeResourceId              = $hostId;
   $resourcePreference->overridebyAiravata             = isset( $resourceHost->overridebyairavata ) ?  true                            : false;
   $resourcePreference->loginUserName                  = isset( $resourceHost->loginuser          ) ?  $resourceHost->loginuser        : null;
   $resourcePreference->preferredJobSubmissionProtocol = isset( $resourceHost->submitprotocol     ) ?  ourJobSubmissionProtocolToEnum( $resourceHost->submitprotocol   ) : null;
   $resourcePreference->preferredDataMovementProtocol  = isset( $resourceHost->datamoveprotocol   ) ?  ourDataMovementProtocolToEnum ( $resourceHost->datamoveprotocol ) : null;
   $resourcePreference->preferredBatchQueue            = isset( $resourceHost->queue              ) ?  $resourceHost->queue            : null;
   $resourcePreference->scratchLocation                = isset( $resourceHost->scratch            ) ?  $resourceHost->scratch          : null;
   $resourcePreference->allocationProjectNumber        = isset( $resourceHost->projectid          ) ?  $resourceHost->projectid        : null;
   return $resourcePreference;
}

# deprecated
function registerComputeResourceHost($client, $host){
    foreach ($host as $key => $resourceHost) {
        echo "## Registering for $resourceHost->host ##\n";
        $id = registerHost($client, $resourceHost);
        registerGateWayProfile($client, $id, $resourceHost );
    }
}

# deprecated
function registerGateWayProfile($client, $hostId, $resourceHost ){
   $gatewayId = $GLOBALS['AIRAVATA_GATEWAY'];
   $user      = $GLOBALS['AIRAVATA_LOGIN'];

   $resourcePreference                                 = new ComputeResourcePreference();
   $resourcePreference->computeResourceId              = $hostId;
   $resourcePreference->overridebyAiravata             = isset( $resourceHost->overridebyairavata ) ?  true                            : false;
   $resourcePreference->loginUserName                  = isset( $resourceHost->loginuser          ) ?  $resourceHost->loginuser        : null;
   $resourcePreference->preferredJobSubmissionProtocol = isset( $resourceHost->submitprotocol     ) ?  ourJobSubmissionProtocolToEnum( $resourceHost->submitprotocol )  : null;
   $resourcePreference->preferredDataMovementProtocol  = isset( $resourceHost->datamoveprotocol   ) ?  ourDataMovementProtocolToEnum( $resourceHost->datamoveprotocol ) : null;
   $resourcePreference->preferredBatchQueue            = isset( $resourceHost->queue              ) ?  $resourceHost->queue            : null;
   $resourcePreference->scratchLocation                = isset( $resourceHost->scratch            ) ?  $resourceHost->scratch          : null;
   $resourcePreference->allocationProjectNumber        = isset( $resourceHost->projectid          ) ?  $resourceHost->projectid        : null;

   $resourceList   = array();
   $resourceList[] = $resourcePreference;

   $gatewayProfile                              = new GatewayResourceProfile();
   $gatewayProfile->gatewayID                   = $gatewayId;
   $gatewayProfile->computeResourcePreferences  = $resourceList;

   $client->registerGatewayResourceProfile($gatewayProfile);
}

function getUnRegisteredHost($client, $cmrf){
  $resources = $client->getAllComputeResourceNames();
  $host = array();
  foreach ($GLOBALS["COMPUTE_RESOURCE"] as $cmr) {
    $exist = 0;
    foreach ($resources as $key => $value) {
       if($value == $cmr->host){
          foreach ($cmrf as $index => $cmrfResource) {
             if($cmrfResource->computeResourceId == $key){
                unset($resources[$key]);
                unset($cmrf[$index]);
                $exist = 1; 
             }
          }
       }
    }
       if($exist == 0){
          $host[] = $cmr;
       }
  }
    return $host;
}

function getHostIds($client, $gatewayId) {
    $cmrf = $client->getGatewayResourceProfile($gatewayId)->computeResourcePreferences;
    $resources = $client->getAllComputeResourceNames();
    $tempIds = array();
    $tempDetails = array();
    $executable = array();
    $hostIds = array();

    foreach ($cmrf as $cmrfResource) {
        $tempIds[] = $cmrfResource->computeResourceId;
    }

    foreach ($GLOBALS['COMPUTE_RESOURCE'] as $resource) {
        $executable[$resource->host] = $resource->executable;
    }

    foreach ($resources as $hostId => $hostName) {
       $tempDetails[$hostId] = $hostName;
    }

    foreach ($tempIds as $id) {
      if( isset($tempDetails[$id]) && isset( $executable[$tempDetails[$id]] ) ) {
         $hostIds[$tempDetails[$id]] = array(
                  'id' => $id,
                  'executable' => $executable[$tempDetails[$id]]);
      }
    }
    return $hostIds;
}

function createComputeResourceDescription($hostName, $hostDesc, $hostAliases, $ipAddresses) {
    global $compute_resources;

    if ( array_key_exists( 'enabled', $compute_resources[ $hostName ] ) ) {
        if ( $compute_resources[ $hostName ]->enabled == true ) {
            echo "enabled is true\n";
        } else {
            echo "enabled is false\n";
        }
    } else {
        echo "enabled key does not exist\n";
    }

    $host = new ComputeResourceDescription();
    $host->hostName              = $hostName;
    $host->resourceDescription   = $hostDesc;
    $host->ipAddresses           = $ipAddresses;
    $host->hostAliases           = $hostAliases;
    $host->enabled               = 
        array_key_exists( 'enabled', $compute_resources[ $hostName ] ) ?
        $compute_resources[ $hostName ]->enabled == true : true;
    $host->fileSystems           = [];

//   $host->fileSystems[ FileSystems::HOME ]    = "/my/home";
//   $host->fileSystems[ FileSystems::SCRATCH ] = "/my/scratch";

    # setup up queues -> need to be added to appconfig.json

    $host->batchQueues     = [];

    if ( array_key_exists( 'batchqueues', $compute_resources[ $hostName ] ) ) {
        foreach ( $compute_resources[ $hostName ]->batchqueues as $v )
        {
            $bq                      = new BatchQueue();
            $bq->queueName           = isset( $v->name )           ? $v->name           : "unknown";
            $bq->queueDescription    = isset( $v->description )    ? $v->description    : $v->name . " no description specified";
            $bq->maxRunTime          = isset( $v->maxruntime )     ? $v->maxruntime     : 0;
            $bq->maxNodes            = isset( $v->maxnodes )       ? $v->maxnodes       : 0;
            $bq->maxProcessors       = isset( $v->maxprocessors )  ? $v->maxprocessors  : 0;
            $bq->maxJobsInQueue      = isset( $v->maxjobsinqueue ) ? $v->maxjobsinqueue : 0;
            $bq->maxMemory           = isset( $v->maxmemory )      ? $v->maxmemory      : 0;
            $host->batchQueues[]     = $bq;
        }
    }

    $host->maxMemoryPerNode      = 0;
    
    jsondump( '$host', $host );

    return $host;
}

function createResourceJobManager( $resourceJobManagerType, 
                                   $pushMonitoringEndpoint,
                                   $jobManagerBinPath,
                                   $jobManagerCommands ) {
        $resourceJobManager = new ResourceJobManager();
        $resourceJobManager->resourceJobManagerType = $resourceJobManagerType;
        $resourceJobManager->pushMonitoringEndpoint = $pushMonitoringEndpoint;
        $resourceJobManager->jobManagerBinPath  = $jobManagerBinPath;
        $resourceJobManager->jobManagerCommands = $jobManagerCommands;
        return $resourceJobManager;
    }

function registerApplicationModule($gatewayId, $client, $modules){
  $moduleids = array();
  foreach($modules as $module){
        $moduleids[$module] = $client->registerApplicationModule($gatewayId,
          createApplicationModule($module, "1.0", $module." description"));
  }
  return $moduleids;
}

function createApplicationModule($appModuleName, $appModuleVersion, $appModuleDescription) {
        $module = new ApplicationModule();
        $module->appModuleDescription = $appModuleDescription;
        $module->appModuleName = $appModuleName;
        $module->appModuleVersion = $appModuleVersion;
        return $module;
}

function registerApplicationDeployments($gatewayId, $client, $moduleIds, $moduleNames, $host){
        echo "#### Registering Application Deployments on Localhost ####\n";
        foreach ($moduleNames as $name) {
            $deployId = $client->registerApplicationDeployment($gatewayId, 
                createApplicationDeployment($moduleIds[$name], $host["id"],
                    $host["executable"]."/".$name, ApplicationParallelismType::SERIAL, 
                    $name+" application description"));
            echo "Successfully registered ".$name." application on localhost, application Id = ".$deployId."\n";
        }
}

function createApplicationDeployment($appModuleId, $computeResourceId, $executablePath,
                              $parallelism, $appDeploymentDescription) {
        $deployment = new ApplicationDeploymentDescription();
//      deployment.setIsEmpty(false);
        $deployment->appDeploymentDescription = $appDeploymentDescription;
        $deployment->appModuleId              = $appModuleId;
        $deployment->computeHostId            = $computeResourceId;
        $deployment->executablePath           = $executablePath;
        $deployment->parallelism              = $parallelism;
        $envPaths = new SetEnvPaths();
        $envPaths->name = "HI";
        $envPaths->value = "THERE";
        jsondump( "envPaths", $envPaths );
        $deployment->setEnvironment           = array( $envPaths );
        return $deployment;
}

function registerApplicationInterfaces($gatewayId, $client, $moduleIds, $moduleNames, $hostName) {
    foreach ($moduleNames as $module) {
        echo "#### Registering ".$module." Interface ####\n";
        $appModules = array();
        $appModules[] = $moduleIds[$module];

        $input = createAppInput("Input_JSON", "{}",
                DataType::STRING, null, false, "JSON String", null);

        $applicationInputs = array();
        $applicationInputs[] = $input;

        $output = createAppOutput("JSON_Output","{}", DataType::STRING);
    $applicationOutputs = array();
        $applicationOutputs[] = $output;

        $InterfaceId = $client->registerApplicationInterface($gatewayId, 
                 createApplicationInterfaceDescription($module."_".$hostName , $module." application description",
                        $appModules, $applicationInputs, $applicationOutputs));
        echo $module." Application Interface Id ".$InterfaceId."\n";

    }
}

function createAppInput($inputName, $value, $type,
            $applicationArgument, $stdIn, $description, $metadata) {
        $input = new InputDataObjectType();
        if (isset($inputName)) $input->name = $inputName;
        if (isset($value)) $input->value = $value;
        if (isset($type)) $input->type = $type;
        if (isset($applicationArgument)) $input->applicationArgument = $applicationArgument;
        if (isset($description)) $input->userFriendlyDescription = $description;
        $input->standardInput = $stdIn;
        $input->requiredToAddedToCommandLine = true;
        if (isset($metadata)) $input->metaData = $metadata;
        return $input;
}

function createAppOutput($inputName, $value, $type) {
        $outputDataObjectType = new OutputDataObjectType();
        if (isset($inputName)) $outputDataObjectType->name = $inputName;
        if (isset($value)) $outputDataObjectType->value = $value;
        if (isset($type)) $outputDataObjectType->type = $type;
        $outputDataObjectType->dataMovement = true;
        $outputDataObjectType->location = "";
        return $outputDataObjectType;
}

function createApplicationInterfaceDescription($applicationName, $applicationDescription, 
                                  $applicationModules, $applicationInputs, $applicationOutputs) {
        $applicationInterfaceDescription = new ApplicationInterfaceDescription();

        $applicationInterfaceDescription->applicationName = $applicationName;
        $applicationInterfaceDescription->applicationInterfaceId = $applicationName;
        if (isset($applicationDescription)) 
          $applicationInterfaceDescription->applicationDescription = $applicationDescription;
        if (isset($applicationModules)) 
          $applicationInterfaceDescription->applicationModules = $applicationModules;
        if (isset($applicationInputs)) 
          $applicationInterfaceDescription->applicationInputs = $applicationInputs;
        if (isset($applicationOutputs)) 
          $applicationInterfaceDescription->applicationOutputs = $applicationOutputs;

        return $applicationInterfaceDescription;
    }

?>
