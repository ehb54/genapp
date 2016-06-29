package airavata;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Map.Entry;

import org.apache.airavata.api.Airavata;
import org.apache.airavata.api.client.AiravataClientFactory;
import org.apache.airavata.model.appcatalog.appdeployment.ApplicationParallelismType;
import org.apache.airavata.model.appcatalog.appinterface.DataType;
import org.apache.airavata.model.appcatalog.appinterface.InputDataObjectType;
import org.apache.airavata.model.appcatalog.appinterface.OutputDataObjectType;
import org.apache.airavata.model.appcatalog.computeresource.ComputeResourceDescription;
import org.apache.airavata.model.appcatalog.computeresource.LOCALSubmission;
import org.apache.airavata.model.appcatalog.computeresource.ResourceJobManager;
import org.apache.airavata.model.appcatalog.computeresource.ResourceJobManagerType;
import org.apache.airavata.model.appcatalog.gatewayprofile.ComputeResourcePreference;
import org.apache.airavata.model.appcatalog.gatewayprofile.GatewayResourceProfile;
import org.apache.airavata.model.error.AiravataClientConnectException;
import org.apache.airavata.model.error.AiravataClientException;
import org.apache.airavata.model.error.AiravataSystemException;
import org.apache.airavata.model.error.InvalidRequestException;
import org.apache.thrift.TException;
import org.json.simple.JSONArray;
import org.json.simple.JSONObject;

import util.AppConfig;

public class Register {
    
    private String THRIFT_SERVER_HOST;
    private int THRIFT_SERVER_PORT;
    private String GATEWAY;
    private JSONObject airvata_properties;
    private JSONArray compute_Resources;
    private Airavata.Client airavataClient;
    private String executablePath;

    public static void main(String[] args) throws AiravataClientConnectException, TException{
       Register registerGenApp = new Register();
       registerGenApp.init();
       registerGenApp.register();

    }
    
    public void register() throws AiravataClientConnectException, InvalidRequestException, AiravataClientException, AiravataSystemException, TException{
        airavataClient = AiravataClientFactory.createAiravataClient(THRIFT_SERVER_HOST, (int) THRIFT_SERVER_PORT);
        addGateway();
        registerComputeResourceHost();
        HashMap<String, HashMap<String, String>> hostIds = getHostIds();
        HashMap<String, List<String>> modules = getUnregisteredModules();
        for(String hostName : modules.keySet()){
          if(modules.get(hostName).size()>0){
              HashMap<String, String> moduleIds = registerApplicationModules(modules.get(hostName));
              registerApplicationDeployments(modules.get(hostName), hostIds.get(hostName), moduleIds);
              registerApplicationInterfaces(modules.get(hostName), moduleIds, hostName);
          }
        }
    }
    
    private void init(){
        airvata_properties = AppConfig.getAiravataProperties();
        THRIFT_SERVER_HOST = (String) airvata_properties.get("server");
        THRIFT_SERVER_PORT = Integer.parseInt((long) airvata_properties.get("port")+"");
        GATEWAY = (String) airvata_properties.get("gateway");
        compute_Resources = AppConfig.getComputeResources();
        executablePath = ModulesUtils.getExecutablePath();
    }
    
    private void addGateway() throws InvalidRequestException, AiravataClientException, AiravataSystemException, TException{
        if(!airavataClient.isGatewayExist(GATEWAY)){
           airavataClient.addGateway(RegisterUtils.createGateway(airvata_properties)); 
        }
    }
    
    private HashMap<String, HashMap<String, String>> getHostIds() throws InvalidRequestException, AiravataClientException, AiravataSystemException, TException {
        List<ComputeResourcePreference> cmrf = airavataClient.getGatewayResourceProfile(GATEWAY).getComputeResourcePreferences();
        Map<String, String> resources = airavataClient.getAllComputeResourceNames();
        List<String> tempIds = new ArrayList<String>();
        final HashMap<String, String> tempDetails = new HashMap<String, String>();
        final HashMap<String, String> executable = new HashMap<String, String>();
        HashMap<String, HashMap<String, String>>hostIds = new HashMap<String, HashMap<String,String>>();

        for (ComputeResourcePreference cmrfResource: cmrf) {
            tempIds.add(cmrfResource.getComputeResourceId());
        }

        for(Object r : compute_Resources) {
            JSONObject resource = (JSONObject) r;
            executable.put((String)resource.get("host"),(String) resource.get("executable"));
        }

        for (String hostId: resources.keySet()) {
           tempDetails.put(hostId, resources.get(hostId));
        }

        for (final String id :tempIds) {
          if(tempDetails.containsKey(id)){
             hostIds.put(tempDetails.get(id), new HashMap<String, String>(){{
                 put("executable", executable.get(tempDetails.get(id)));
                 put("id", id);                        
             }
            });
          }
        }
        return hostIds;
    }
    
    private void registerComputeResourceHost() throws InvalidRequestException, AiravataClientException, AiravataSystemException, TException{
        JSONArray unRegisteredHost = null;
        if(RegisterUtils.isGatewayProfileRegistered(airavataClient, GATEWAY)){
            List<ComputeResourcePreference> cmrf = airavataClient.getGatewayResourceProfile(GATEWAY)
                                                            .getComputeResourcePreferences();
            unRegisteredHost = getUnregisteredHost(cmrf);
        }else{
            unRegisteredHost = compute_Resources;
        }
        for (Object host : unRegisteredHost) {
            JSONObject resourceHost = (JSONObject) host;
            System.out.println("\n #### Registering "+resourceHost.get("host")+" Computational Resource #### \n");
            String hostId = registerHost(resourceHost);
            registerGatewayProfile(hostId);
        }
    }
    
    private JSONArray getUnregisteredHost(List<ComputeResourcePreference> cmrf) throws InvalidRequestException, AiravataClientException, AiravataSystemException, TException{
        Map<String, String> registeredResources = airavataClient.getAllComputeResourceNames(); 
        JSONArray host = new JSONArray();
        for (Object cmr : compute_Resources) {
            JSONObject cmrObj = (JSONObject) cmr;
            
            boolean exist = false;
            Iterator<String> it = registeredResources.keySet().iterator();
            while(it.hasNext()){
                String key = it.next();
                if(registeredResources.get(key).equals(cmrObj.get("host"))){
                      if(cmrf != null){
                        for (ComputeResourcePreference cmResource : cmrf) {
                            if(cmResource.getComputeResourceId().equals(key)){
                                exist = true;
                            }
                        }
                      }
                 }
            }
            if(exist == false){
                host.add(cmrObj);
            }
        }
        return host;
    }
    private String registerHost(JSONObject host) throws InvalidRequestException, AiravataClientException, AiravataSystemException, TException{
                ComputeResourceDescription computeResourceDescription = RegisterUtils.
                        createComputeResourceDescription((String)host.get("host"), (String)host.get("description"), null, null);
                String hostId = airavataClient.registerComputeResource(computeResourceDescription);
                ResourceJobManager resourceJobManager = RegisterUtils.
                        createResourceJobManager(ResourceJobManagerType.FORK, null, null, null);
                LOCALSubmission submission = new LOCALSubmission();
                submission.setResourceJobManager(resourceJobManager);
                String localSubmission = airavataClient.addLocalSubmissionDetails(hostId, 1, submission);
                System.out.println(localSubmission);
                System.out.println(host.get("host")+" Resource Id is " + hostId);
                return hostId;
        
    }
    
    private void registerGatewayProfile(String hostId) throws TException {
        ComputeResourcePreference localhostResourcePreference = RegisterUtils.
                createComputeResourcePreference(hostId, "executable_modules", false, null, null, null, executablePath + "/..");
        GatewayResourceProfile gatewayResourceProfile = new GatewayResourceProfile();
        gatewayResourceProfile.setGatewayID(GATEWAY);
        gatewayResourceProfile.addToComputeResourcePreferences(localhostResourcePreference);
        airavataClient.registerGatewayResourceProfile(gatewayResourceProfile);
    }
    
    private HashMap<String, List<String>> getUnregisteredModules() throws TException{
        HashMap<String, List<String>> unregisteredModules = new HashMap<String, List<String>>();
        List<String> modules = ModulesUtils.getModulesNames();
        Map<String, String> registeredModules = airavataClient.getAllApplicationInterfaceNames(GATEWAY);
        for (Object res : compute_Resources) {
            JSONObject resource = (JSONObject) res;
            unregisteredModules.put((String)resource.get("host"),new ArrayList<String>());
        }
        for (String id:  modules ) {
            int index = 0;
            for (Object res : compute_Resources) {
              JSONObject resource = (JSONObject) res;
              String name = id+"_"+resource.get("host");
              unregisteredModules.get((String)resource.get("host")).add(id) ; 
              index = unregisteredModules.get((String)resource.get("host")).indexOf(id);
              if(registeredModules.containsKey(name)){
                  Map<String, String> appCmrf = airavataClient.getAvailableAppInterfaceComputeResources(name);
                  for (String hostId: appCmrf.keySet()) {
                    if(appCmrf.get(hostId).equals((String)resource.get("host"))){
                        System.out.println(name+" is already registered for "+appCmrf.get(hostId));
                        unregisteredModules.get(appCmrf.get(hostId)).remove(index);
                    }
                  }
              }
            }
        }
        return unregisteredModules;
    }
    
    private HashMap<String, String> registerApplicationModules(List<String> modules) throws TException{
        HashMap<String, String> id = new HashMap<String, String>();
        Iterator<String> modulesIt = modules.iterator();
        while (modulesIt.hasNext()) {
            String module = modulesIt.next();
            id.put(module, airavataClient.registerApplicationModule(GATEWAY, 
                            RegisterUtils.createApplicationModule(module, "1.0", "GenApp"+module+"module")));
            
        }
        return id;
    }
    
    private void registerApplicationDeployments(List<String> modules, HashMap<String, String> hostDetail, HashMap<String, String> moduleIds) throws TException{
        System.out.println("#### Registering Application Deployments ####");
        Iterator<String> moduleName = modules.iterator();
        while (moduleName.hasNext()) {
            String name = moduleName.next();
            String deployId = airavataClient.registerApplicationDeployment(GATEWAY,
                    RegisterUtils.createApplicationDeployment(moduleIds.get(name), hostDetail.get("id"),
                            hostDetail.get("executable") + "/"+name, ApplicationParallelismType.SERIAL, name+" application description"));
            System.out.println("Successfully registered "+name+" application on localhost, application Id = "+deployId);
            
        }
    }
    
    private void registerApplicationInterfaces(List<String> modules, HashMap<String, String> moduleIds, String hostName) {
        Iterator<String> it = modules.iterator();
        while(it.hasNext()){
            try {
                String id = it.next();
                System.out.println("#### Registering "+id+" Interface ####");
                List<String> appModules = new ArrayList<String>();
                appModules.add(moduleIds.get(id));

                InputDataObjectType input1 = RegisterUtils.createAppInput("Input_JSON", "{}",
                        DataType.STRING, null, false, "JSON String", null);

                List<InputDataObjectType> applicationInputs = new ArrayList<InputDataObjectType>();
                applicationInputs.add(input1);

                OutputDataObjectType output1 = RegisterUtils.createAppOutput("JSON_Output",
                        "{}", DataType.STRING);

                List<OutputDataObjectType> applicationOutputs = new ArrayList<OutputDataObjectType>();
                applicationOutputs.add(output1);

                String InterfaceId = airavataClient.registerApplicationInterface(GATEWAY,
                        RegisterUtils.createApplicationInterfaceDescription(id+"_"+hostName , id+" application description",
                                appModules, applicationInputs, applicationOutputs));
                System.out.println(id+" Application Interface Id " + InterfaceId);

            } catch (TException e) {
                e.printStackTrace();
            }
        }

    }

}
