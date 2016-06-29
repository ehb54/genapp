package airavata;

import java.util.Iterator;
import java.util.List;
import java.util.Map;

import org.apache.airavata.api.Airavata;
import org.apache.airavata.model.appcatalog.appdeployment.ApplicationDeploymentDescription;
import org.apache.airavata.model.appcatalog.appdeployment.ApplicationModule;
import org.apache.airavata.model.appcatalog.appdeployment.ApplicationParallelismType;
import org.apache.airavata.model.appcatalog.appinterface.ApplicationInterfaceDescription;
import org.apache.airavata.model.appcatalog.appinterface.DataType;
import org.apache.airavata.model.appcatalog.appinterface.InputDataObjectType;
import org.apache.airavata.model.appcatalog.appinterface.OutputDataObjectType;
import org.apache.airavata.model.appcatalog.computeresource.ComputeResourceDescription;
import org.apache.airavata.model.appcatalog.computeresource.DataMovementProtocol;
import org.apache.airavata.model.appcatalog.computeresource.JobManagerCommand;
import org.apache.airavata.model.appcatalog.computeresource.JobSubmissionProtocol;
import org.apache.airavata.model.appcatalog.computeresource.ResourceJobManager;
import org.apache.airavata.model.appcatalog.computeresource.ResourceJobManagerType;
import org.apache.airavata.model.appcatalog.gatewayprofile.ComputeResourcePreference;
import org.apache.airavata.model.appcatalog.gatewayprofile.GatewayResourceProfile;
import org.apache.airavata.model.error.AiravataClientException;
import org.apache.airavata.model.error.AiravataSystemException;
import org.apache.airavata.model.error.InvalidRequestException;
import org.apache.airavata.model.workspace.Gateway;
import org.apache.thrift.TException;
import org.json.simple.JSONObject;

public class RegisterUtils {
    public static Gateway createGateway(JSONObject properties){
        Gateway gateway = new Gateway();
        gateway.setGatewayId((String) properties.get("gateway"));
        gateway.setGatewayName((String) properties.get("gatewayName"));
        gateway.setDomain((String) properties.get("server"));
        gateway.setEmailAddress((String) properties.get("email"));
        return gateway;
    }
    
    public static boolean isGatewayProfileRegistered(Airavata.Client client, String gatewayId){
       boolean exists = false;
       try {
        List<GatewayResourceProfile> resourceProfiles = client.getAllGatewayComputeResources();
        Iterator<GatewayResourceProfile> profiles = resourceProfiles.iterator();
        while(profiles.hasNext()){
            if(profiles.next().getGatewayID().equals(gatewayId)){
                exists = true;
                return exists;
            }
        }
        } catch (InvalidRequestException e) {
            // TODO Auto-generated catch block
            e.printStackTrace();
        } catch (AiravataClientException e) {
            // TODO Auto-generated catch block
            e.printStackTrace();
        } catch (AiravataSystemException e) {
            // TODO Auto-generated catch block
            e.printStackTrace();
        } catch (TException e) {
            // TODO Auto-generated catch block
            e.printStackTrace();
        }
       return exists;
    }
    
    public static ComputeResourceDescription createComputeResourceDescription(
            String hostName, String hostDesc, List<String> hostAliases, List<String> ipAddresses) {
        ComputeResourceDescription host = new ComputeResourceDescription();
        host.setHostName(hostName);
        host.setResourceDescription(hostDesc);
        host.setIpAddresses(ipAddresses);
        host.setHostAliases(hostAliases);
        return host;
    }

    public static ResourceJobManager createResourceJobManager(
            ResourceJobManagerType resourceJobManagerType, String pushMonitoringEndpoint, String jobManagerBinPath,
            Map<JobManagerCommand, String> jobManagerCommands) {
        ResourceJobManager resourceJobManager = new ResourceJobManager();
        resourceJobManager.setResourceJobManagerType(resourceJobManagerType);
        resourceJobManager.setPushMonitoringEndpoint(pushMonitoringEndpoint);
        resourceJobManager.setJobManagerBinPath(jobManagerBinPath);
        resourceJobManager.setJobManagerCommands(jobManagerCommands);
        return resourceJobManager;
    }
    
    public static ComputeResourcePreference
        createComputeResourcePreference(String computeResourceId, String allocationProjectNumber,
                                        boolean overridebyAiravata, String preferredBatchQueue,
                                        JobSubmissionProtocol preferredJobSubmissionProtocol,
                                        DataMovementProtocol preferredDataMovementProtocol,
                                        String scratchLocation) {
        ComputeResourcePreference computeResourcePreference = new ComputeResourcePreference();
        computeResourcePreference.setComputeResourceId(computeResourceId);
        computeResourcePreference.setOverridebyAiravata(overridebyAiravata);
        computeResourcePreference.setAllocationProjectNumber(allocationProjectNumber);
        computeResourcePreference.setPreferredBatchQueue(preferredBatchQueue);
        computeResourcePreference.setPreferredDataMovementProtocol(preferredDataMovementProtocol);
        computeResourcePreference.setPreferredJobSubmissionProtocol(preferredJobSubmissionProtocol);
        computeResourcePreference.setScratchLocation(scratchLocation);
        return computeResourcePreference;
    }
    
    public static ApplicationModule createApplicationModule(String appModuleName, 
                                        String appModuleVersion, String appModuleDescription) {
            ApplicationModule module = new ApplicationModule();
            module.setAppModuleDescription(appModuleDescription);
            module.setAppModuleName(appModuleName);
            module.setAppModuleVersion(appModuleVersion);
            return module;
    }
    
    public static ApplicationDeploymentDescription createApplicationDeployment(
                             String appModuleId, String computeResourceId, String executablePath,
                             ApplicationParallelismType parallelism, String appDeploymentDescription) {
             ApplicationDeploymentDescription deployment = new ApplicationDeploymentDescription();
             deployment.setAppDeploymentDescription(appDeploymentDescription);
             deployment.setAppModuleId(appModuleId);
             deployment.setComputeHostId(computeResourceId);
             deployment.setExecutablePath(executablePath);
             deployment.setParallelism(parallelism);
             return deployment;
     }
    
    public static InputDataObjectType createAppInput(String inputName, String value, DataType type,
                                String applicationArgument, boolean stdIn, String description, String metadata) {
        InputDataObjectType input = new InputDataObjectType();
        if (inputName != null) input.setName(inputName);
        if (value != null) input.setValue(value);
        if (type != null) input.setType(type);
        if (applicationArgument != null) input.setApplicationArgument(applicationArgument);
        if (description != null) input.setUserFriendlyDescription(description);
        input.setStandardInput(stdIn);
        if (metadata != null) input.setMetaData(metadata);
        return input;
    }

    public static OutputDataObjectType createAppOutput(String inputName, String value, DataType type) {
        OutputDataObjectType outputDataObjectType = new OutputDataObjectType();
        if (inputName != null) outputDataObjectType.setName(inputName);
        if (value != null) outputDataObjectType.setValue(value);
        if (type != null) outputDataObjectType.setType(type);
        return outputDataObjectType;
    }

    public static ApplicationInterfaceDescription createApplicationInterfaceDescription(String applicationName, 
                        String applicationDescription, List<String> applicationModules,
                        List<InputDataObjectType> applicationInputs,List<OutputDataObjectType>applicationOutputs) {
    
    ApplicationInterfaceDescription applicationInterfaceDescription = new ApplicationInterfaceDescription();
    
    applicationInterfaceDescription.setApplicationName(applicationName);
    applicationInterfaceDescription.setApplicationInterfaceId(applicationName);
    if (applicationDescription != null) applicationInterfaceDescription.setApplicationDescription(applicationDescription);
    if (applicationModules != null) applicationInterfaceDescription.setApplicationModules(applicationModules);
    if (applicationInputs != null) applicationInterfaceDescription.setApplicationInputs(applicationInputs);
    if (applicationOutputs != null) applicationInterfaceDescription.setApplicationOutputs(applicationOutputs);
    
    return applicationInterfaceDescription;
    }

}
