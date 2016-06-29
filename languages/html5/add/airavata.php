<?php

# $debug = true;

$GLOBALS['THRIFT_ROOT'] = 'airavata/lib/Thrift/';
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

$GLOBALS['AIRAVATA_ROOT'] = 'airavata/lib/Airavata/';
require_once $GLOBALS['AIRAVATA_ROOT'] . 'API/Airavata.php';
require_once $GLOBALS['AIRAVATA_ROOT'] . 'Model/AppCatalog/AppInterface/Types.php';
require_once $GLOBALS['AIRAVATA_ROOT'] . 'Model/Workspace/Types.php';
require_once $GLOBALS['AIRAVATA_ROOT'] . 'Model/Workspace/Experiment/Types.php';
require_once $GLOBALS['AIRAVATA_ROOT'] . 'API/Error/Types.php';

require_once 'airavata/lib/AiravataClientFactory.php';
require_once 'airavata/clientProperties.php';

use Airavata\API\Error\AiravataClientException;
use Airavata\API\Error\AiravataSystemException;
use Airavata\API\Error\InvalidRequestException;
use Airavata\Client\AiravataClientFactory;
use Thrift\Protocol\TBinaryProtocol;
use Thrift\Transport\TBufferedTransport;
use Thrift\Transport\TSocket;
use Airavata\API\AiravataClient;
use Airavata\Model\Workspace\Project;
use Airavata\Model\Workspace\Experiment\Experiment;
use Airavata\Model\Workspace\Experiment\UserConfigurationData;
use Airavata\Model\Workspace\Experiment\ComputationalResourceScheduling;
use Airavata\API\Error\ExperimentNotFoundException;
use Airavata\Model\Workspace\Experiment\ExperimentState;
use Airavata\Model\Workspace\Experiment\JobState;
use Thrift\Exception\TTransportException;
use Thrift\Exception\TException;
use Airavata\Model\AppCatalog\AppInterface\InputDataObjectType;
use Airavata\Model\AppCatalog\AppInterface\OutputDataObjectType;
use Airavata\Model\AppCatalog\AppInterface\DataType;

function dashline() {
    echo str_repeat( "-", 80 ) . "\n";
}

function jsondump( $title, $obj ) {
    global $debug;
    if ( isset( $debug ) && $debug ) {
        echo "$title:\n";
        dashline();
        echo json_encode( $obj, JSON_PRETTY_PRINT ) . "\n";
        dashline();
    }
}

function echo_if_debug( $str ) {
    global $debug;
    if ( isset( $debug ) && $debug ) {
        echo $str;
    }
}

function sendudpmsg( $status ) {
    global $debug;
    if ( $debug ) {
        echo "sendudpmsg: $status\n";
        return;
    }

    if ( !isset( $GLOBALS['udp'] ) ) {
        return;
    }

    $GLOBALS['udp']->msg[ '_airavata' ] = empty( $status ) ? "" : "Airavata: $status<hr>";

    $json_msg = json_encode( $GLOBALS[ 'udp' ]->msg );

    socket_sendto( $GLOBALS[ 'udp' ]->socket,
                   $json_msg,
                   strlen( $json_msg ),
                   0,
                   $GLOBALS[ 'udp' ]->hostip,
                   $GLOBALS[ 'udp' ]->port );
}    

function createProject($projectName){
    $transport = new TSocket($GLOBALS['AIRAVATA_SERVER'], $GLOBALS['AIRAVATA_PORT']);
    $transport->setRecvTimeout($GLOBALS['AIRAVATA_TIMEOUT']);
    $transport->setSendTimeout($GLOBALS['AIRAVATA_TIMEOUT']);
    $gatewayId = $GLOBALS['AIRAVATA_GATEWAY'];
    $owner = $GLOBALS['AIRAVATA_LOGIN'];
    $protocol = new TBinaryProtocol($transport);
    try
    {
        $transport->open();
        $airavataclient = new AiravataClient($protocol);
        $project = new Project();
        $project->owner = $owner;
        $project->name = $projectName;
        $projId = $airavataclient->createProject($gatewayId, $project);
        $outputData = array();

        if ($projId)
        {
            $outputData["ProjectId"] = $projId;
            // return json_encode($output);
        }
        else
        {
            $outputData["error"] = 'Failed to create project.';
        }

        $transport->close();
    }
    catch (InvalidRequestException $ire)
    {
        $outputData["error"] = 'InvalidRequestException: ' . $ire->getMessage();
    }
    catch (AiravataClientException $ace)
    {
        $outputData["error"] = 'Airavata System Exception: ' . $ace->getMessage();
    }
    catch (AiravataSystemException $ase)
    {
        $outputData["error"] = 'Airavata System Exception: ' . $ase->getMessage();
    }
    catch(TException $tx)
    {
        $outputData["error"] = 'Exception: ' . $tx->getMessage();
    }
    catch (\Exception $e)
    {
        $outputData["error"] = 'Exception: ' . $e->getMessage();
    }
    return json_encode($outputData);
}


function createExperiment($expName, $projId, $appId, $inp){
    echo_if_debug( "createExperiment name $expName projId $projId appId $appId\n" );
    $transport = new TSocket($GLOBALS['AIRAVATA_SERVER'], $GLOBALS['AIRAVATA_PORT']);
    $transport->setRecvTimeout($GLOBALS['AIRAVATA_TIMEOUT']);
    $transport->setSendTimeout($GLOBALS['AIRAVATA_TIMEOUT']);
    $protocol = new TBinaryProtocol($transport);
    try
    {
        $transport->open();
        $airavataclient = new AiravataClient($protocol);
        # does module exist
        try {
            $appModule = $airavataclient->getApplicationInterface( $appId );
        }
        catch (AiravataSystemException $ase)
        {
            $outputData["error"] = 'It appears that this module is not registered with the Airavata server.\nAiravata System Exception: ' . $ase->getMessage();
            echo json_encode($outputData);
            exit;
        }
        catch(TException $tx)
        {
            $outputData["error"] = 'Exception: ' . $tx->getMessage();
            echo json_encode($outputData);
            exit;
        }
        catch (\Exception $e)
        {
            $outputData["error"] = 'Exception: ' . $e->getMessage();
            echo json_encode($outputData);
            exit;
        }
            
        jsondump( "appModule", $appModule );

        /* Experiment input and output data. */
        $input = new InputDataObjectType();
        $input->name = "input";
        $input->value = $inp;
        // $input->applicationArgument = $inp;
        $input->type = DataType::STRING;
        $input->requiredToAddedToCommandLine = true;
        $exInputs = array($input);
        $output = new OutputDataObjectType();
        $output->name = "output";
        $output->value = "";
        $output->dataMovement = true;
        $output->type = DataType::STDOUT;
        //        $output->location = "";
        $err = new OutputDataObjectType();
        $err->name = "output_err";
        $err->value = "";
        $err->type = DataType::STDERR;
        $err->dataMovement = true;
        //        $err->location = "";
        $exOutputs = array($output,$err);

        /* Create Experiment: needs to update using unique project ID. */
        $user = $GLOBALS['AIRAVATA_LOGIN'];
        $host = $GLOBALS['AIRAVATA_SERVER'];
        // $cmrHost = getRandomResource();
        $cmrHost = $GLOBALS['SPECIFIED_RESOURCE'];
        $GLOBALS["RESOURCE_HOST"] = $cmrHost->host;
        // $appId.="_".$GLOBALS["RESOURCE_HOST"];
        // $hostname = $airavataconfig['AIRAVATA_SERVER_ALIAS'];

        $gatewayId = $GLOBALS['AIRAVATA_GATEWAY'];
        $proAccount = $GLOBALS['AIRAVATA_PROJECT_ACCOUNT'];
        $exp_name = $expName;
        $proj = $projId;

        $experiment = new Experiment();
        $experiment->projectID = $proj;
        $experiment->userName = $user;
        $experiment->name = $exp_name;
        $experiment->description = "$exp_name description";
        $experiment->applicationId = $appId;
        $experiment->experimentInputs = $exInputs;
        $experiment->experimentOutputs = $exOutputs;
        $computeResources = $airavataclient->getAvailableAppInterfaceComputeResources($appId);
        echo_if_debug( "gatewayId $gatewayId appId $appId\n" );

        jsondump( '$computeResources', $computeResources );
        jsondump( 'getApplicationInterface', $airavataclient->getApplicationInterface( $appId ) );
        if(isset($computeResources) && !empty($computeResources)){
            echo_if_debug( "computeresources set\n" );

            foreach ($computeResources as $key => $value) {
                echo_if_debug( "next computeResource $key $value looking for $cmrHost->host\n" );
                if($value == $cmrHost->host){
                    $cmRST = new ComputationalResourceScheduling();
                    $cmRST->resourceHostId = $key;
//                    $cmRST->computationalProjectAccount = $proAccount;
                    $cmRST->nodeCount = 1;
                    $cmRST->numberOfThreads = 1;
                    $cmRST->queueName = isset( $cmrHost->queue ) ? $cmrHost->queue : "default";
                    $cmRST->totalCPUCount = 1;
                    $cmRST->wallTimeLimit = 30;
                    $cmRST->jobStartTime = 0;
                    $cmRST->totalPhysicalMemory = 1;
                    $userConfigurationData = new UserConfigurationData();
                    $userConfigurationData->airavataAutoSchedule = 0;
                    $userConfigurationData->overrideManualScheduledParams = 0;
                    $userConfigurationData->computationalResourceScheduling = $cmRST;
                    jsondump( '$userConfigurationData', $userConfigurationData );
                    $experiment->userConfigurationData = $userConfigurationData;
                    jsondump( '$experiment', $experiment );
                }
            }
        } else {
            echo_if_debug( "computeresources NOT set\n" );
            jsondump( "allcomputeresourcenames", $airavataclient->getAllComputeResourceNames() );
            $outputData["error"] = "No enabled compute resources available for this module";
            return json_encode($outputData);
        }

        $outputData = array();
        $expId = $airavataclient->createExperiment($gatewayId,$experiment);
        $transport->close();

        jsondump( "experiment", $experiment );

        if ($expId)
        {
            $outputData["ExperimentId"] = $expId;
        }
        else
        {
            $outputData["error"] = 'Experiment Not Created';
        }
    }
    catch (InvalidRequestException $ire)
    {
        $outputData["error"] = 'InvalidRequestException: ' . $ire->getMessage();
    }
    catch (AiravataClientException $ace)
    {
        $outputData["error"] = 'Airavata System Exception: ' . $ace->getMessage();
    }
    catch (AiravataSystemException $ase)
    {
        $outputData["error"] = 'Airavata System Exception: ' . $ase->getMessage();
    }
    catch(TException $tx)
    {
        $outputData["error"] = 'Exception: ' . $tx->getMessage();
    }
    catch (\Exception $e)
    {
        $outputData["error"] = 'Exception: ' . $e->getMessage();
    }
    return json_encode($outputData);
}

function launchExperiment( $expId){
    $token = $GLOBALS['AIRAVATA_CREDENTIAL_STORE_TOKEN'];
    $transport = new TSocket($GLOBALS['AIRAVATA_SERVER'], $GLOBALS['AIRAVATA_PORT']);
    $transport->setSendTimeout($GLOBALS['AIRAVATA_TIMEOUT']);
    $transport->setRecvTimeout($GLOBALS['AIRAVATA_TIMEOUT']);
    $protocol = new TBinaryProtocol($transport);
    try
    {
        $transport->open();
        $airavataclient = new AiravataClient($protocol);
        $airavataclient->launchExperiment($expId, $token);
        $transport->close();
        $outputData = array();
        $outputData["isExperimentLaunched"] = true;
    }
    catch (InvalidRequestException $ire)
    {
        $outputData["error"] = 'InvalidRequestException: ' . $ire->getMessage();
    }
    catch (AiravataClientException $ace)
    {
        $outputData["error"] = 'Airavata System Exception: ' . $ace->getMessage();
    }
    catch (AiravataSystemException $ase)
    {
        $outputData["error"] = 'Airavata System Exception: ' . $ase->getMessage();
    }
    catch(TException $tx)
    {
        $outputData["error"] = 'Exception: ' . $tx->getMessage();
    }
    catch (\Exception $e)
    {
        $outputData["error"] = 'Exception: ' . $e->getMessage();
    }
    return json_encode($outputData);
}

function getOutput( $expId)
{
    $transport = new TSocket($GLOBALS['AIRAVATA_SERVER'], $GLOBALS['AIRAVATA_PORT']);
    $transport->setSendTimeout($GLOBALS['AIRAVATA_TIMEOUT']);
    $protocol = new TBinaryProtocol($transport);
    $errors = array(
     'CANCELED' => "The compute resource reported the job was cancelled",
     'SUSPENDED' => "The compute resource reported the job was suspended",
     'FAILED' => "The compute resource reported the job failed"
        );

    try
    {
        $airavataclient = new AiravataClient($protocol);
        $transport->open();

        # fall back time with state change reset to minimize polling

        $timeout = 2;
        $last_status = "";

        while(($status=get_experiment_status($airavataclient, $expId))!="COMPLETED"){
            sendudpmsg( "$status on " . $GLOBALS[ "RESOURCE_HOST" ] );
            if(isset($errors[$status])){
              $transport->close();
              return "{\"error\":\"".$errors[$status]."\"}";
              exit();
            }
            echo_if_debug( "timeout now $timeout\n" );
            if ( $last_status != $status ) {
                $last_status = $status;
                $timeout = 2;
                sleep( $timeout );
            } else {
                sleep( $timeout );
                if ( $timeout < 32 )
                {
                    $timeout *= 2;
                } else {
                    $timeout = 32;
                }
            }
        }
        $outputs =  $airavataclient->getExperimentOutputs($expId);
        $transport->close();
        $outputData = array();
        jsondump( "outputs", $outputs );
        # get stdout
        if( empty( $outputs[0]->value ) ) {
            if ( $outputs[0]->dataMovement ) {
                $outputData["error"] = "no standard output retrieved\n";
            } else {
                $outputData["output"] = "{'_empty':1}";
            }
        } else {
            if ( $outputs[0]->dataMovement ) {
                $cmd = "ssh " .  $GLOBALS['AIRAVATA_SCPUSER'] . '@' . $GLOBALS['AIRAVATA_SERVER'] . " cat " . $outputs[0]->value;
                echo_if_debug( "$cmd\n" );
                $cmd_out = [];
                $cmd_ret = 0;
                exec( $cmd . " 2>&1", $cmd_out, $cmd_ret );
                if ( $cmd_ret ) {
                    $outputData["error"] = "could not retrieve results file " . $outputs[0]->value . " from airavata server.  Are ssh keys properly setup?";
                } else {
                    if ( count( $cmd_out ) == 1 ) {
                        $outputData["output"] = $cmd_out[0];
                    } else {
                        $outputData["output"] = "{'_empty':1}";
                        if ( count( $cmd_out ) > 1 ) {
                            $outputData["error"] = "error in results file " . $outputs[0]->value . " from airavata server. multiple lines " . count( $cmd_out ) . " returned";
                        } else {
                            $outputData["error"] = "error in results file " . $outputs[0]->value . " from airavata server. empty standard output returned";
                        }
                    }
                }
            } else {
                $outputData["output"] = $outputs[0]->value;
            }
        }
            
        # get stderr
        if( empty( $outputs[1]->value ) ) {
            if ( $outputs[1]->dataMovement ) {
                $outputData["error"] = "no standard error output retrieved\n";
            }
        } else {
            if ( $outputs[1]->dataMovement ) {
                $cmd = "ssh " .  $GLOBALS['AIRAVATA_SCPUSER'] . '@' . $GLOBALS['AIRAVATA_SERVER'] . " cat " . $outputs[1]->value;
                echo_if_debug( "$cmd\n" );
                $cmd_out = [];
                $cmd_ret = 0;
                exec( $cmd . " 2>&1", $cmd_out, $cmd_ret );
                if ( $cmd_ret ) {
                    if ( !isset( $outputData[ "error" ] ) ) {
                        $outputData[ "error" ] = "";
                    } else {
                        $outputData[ "error" ] .= "\n";
                    }
                    $outputData["error"] .= "could not retrieve standard error  file " . $outputs[1]->value . " from airavata server. Are ssh keys properly setup?";
                } else {
                    if ( !empty( $cmd_out ) ) {
                        if ( !isset( $outputData[ "error" ] ) ) {
                            $outputData[ "error" ] = "";
                        } else {
                            $outputData[ "error" ] .= "\n";
                        }
                        $outputData["error"] .= implode( "\n", $cmd_out );
                    }
                }
            } else {
                if ( !isset( $outputData[ "error" ] ) ) {
                    $outputData[ "error" ] = "";
                } else {
                    $outputData[ "error" ] .= "\n";
                }
                $outputData["error"] = $outputs[1]->value;
            }
        }

        if ( false ) {
            if( !empty( $outputs[0]->value ) ) {
                $out = json_decode($outputs[0]->value);
                $out->Computational_Host = $GLOBALS["RESOURCE_HOST"]; 
                $outputData["output"] = json_encode($out);
            } else {
                $outputData["error"] = $outputs[1]->value;
            }
        }

    }
    catch (InvalidRequestException $ire)
    {
        $outputData["error"] = 'InvalidRequestException: ' . $ire->getMessage();
    }
    catch (AiravataClientException $ace)
    {
        $outputData["error"] = 'Airavata System Exception: ' . $ace->getMessage();
    }
    catch (AiravataSystemException $ase)
    {
        $outputData["error"] = 'Airavata System Exception: ' . $ase->getMessage();
    }
    catch(TException $tx)
    {
        $outputData["error"] = 'Exception: ' . $tx->getMessage();
    }
    catch (ExperimentNotFoundException $enf)
    {
        $outputData["error"] = 'ExperimentNotFoundException: ' . $enf->getMessage();
    }
    catch (TTransportException $tte)
    {
        $outputData["error"] = 'TTransportException: ' . $tte->getMessage();
    }
    catch (\Exception $e)
    {
        $outputData["error"] = 'Exception: ' . $e->getMessage();
    }
    return json_encode($outputData);


}

function get_experiment_status($client, $expId)
{
    global $prev_status;
    try
    {
        $outputData = array();
        $experimentStatus = $client->getExperimentStatus($expId);
        jsondump( '$experimentStatus', $experimentStatus );
        if ( $experimentStatus->experimentState == ExperimentState::EXECUTING ) {
            $jobstatus = $client->getJobStatuses( $expId );
            if ( count( $jobstatus ) ) {
                foreach ( $jobstatus as $v ) {
                    $jobstatusname = JobState::$__names[ $v->jobState ];
                }
                jsondump( '$jobstatusname', $jobstatusname );
            } else {
                return "INITIALIZING";
            }
            jsondump( '$jobstatus', $jobstatus );
            if ( $jobstatusname == "UNKNOWN" && !empty( $prev_status ) ) {
                $jobstatusname = "UNKNOWN [last known status was $prev_status]";
            } else {
                $prev_status = $jobstatusname;
            }
            return $jobstatusname;
        }
        return ExperimentState::$__names[$experimentStatus->experimentState];
    }
    catch (InvalidRequestException $ire)
    {
        $outputData["error"] = 'InvalidRequestException: ' . $ire->getMessage();
    }
    catch (AiravataClientException $ace)
    {
        $outputData["error"] = 'Airavata System Exception: ' . $ace->getMessage();
    }
    catch (AiravataSystemException $ase)
    {
        $outputData["error"] = 'Airavata System Exception: ' . $ase->getMessage();
    }
    catch(TException $tx)
    {
        $outputData["error"] = 'Exception: ' . $tx->getMessage();
    }
    catch (ExperimentNotFoundException $enf)
    {
        $outputData["error"] = 'ExperimentNotFoundException: ' . $enf->getMessage();
    }
    catch (TTransportException $tte)
    {
        $outputData["error"] = 'TTransportException: ' . $tte->getMessage();
    }
    catch (\Exception $e)
    {
        $outputData["error"] = 'Exception: ' . $e->getMessage();
    }
    echo json_encode($outputData);
    exit;
}

function getRandomResource(){
    $resources = [];
    foreach ( $GLOBALS["COMPUTE_RESOURCE"] as $v ) {
        if ( !isset( $v->enabled ) || $v->enabled == true ) {
            $resources[] = $v;
        }
    }
    $size = sizeof($resources);
    return $resources[rand(0, $size-1)];
}

function getSpecifiedResource( $resource ){
    foreach ( $GLOBALS["COMPUTE_RESOURCE"] as $v ) {
        if ( isset($v->host) && $v->host == $resource ) {
            if ( !isset( $v->enabled ) || $v->enabled == true ) {
                return $v;
            } else {
                echo "{'error':'Specified Airavata resource $resource is not enabled.'}";
                exit;
            }                
        }            
    }
    echo "{'error':'Specified Airavata resource $resource is not defined.'}";
    exit;
}

?>
