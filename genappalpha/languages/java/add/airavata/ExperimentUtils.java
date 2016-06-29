package airavata;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Map.Entry;
import java.util.Random;

import org.apache.airavata.api.Airavata;
import org.apache.airavata.api.client.AiravataClientFactory;
import org.apache.airavata.model.appcatalog.appinterface.DataType;
import org.apache.airavata.model.appcatalog.appinterface.InputDataObjectType;
import org.apache.airavata.model.appcatalog.appinterface.OutputDataObjectType;
import org.apache.airavata.model.error.AiravataClientConnectException;
import org.apache.airavata.model.util.ExperimentModelUtil;
import org.apache.airavata.model.util.ProjectModelUtil;
import org.apache.airavata.model.workspace.Project;
import org.apache.airavata.model.workspace.experiment.ComputationalResourceScheduling;
import org.apache.airavata.model.workspace.experiment.Experiment;
import org.apache.airavata.model.workspace.experiment.ExperimentState;
import org.apache.airavata.model.workspace.experiment.ExperimentStatus;
import org.apache.airavata.model.workspace.experiment.UserConfigurationData;
import org.apache.thrift.TException;
import org.json.simple.JSONArray;
import org.json.simple.JSONObject;
import org.json.simple.parser.JSONParser;
import org.json.simple.parser.ParseException;

import util.AppConfig;

public class ExperimentUtils {
    private String THRIFT_SERVER_HOST;
    private int THRIFT_SERVER_PORT;
    private String DEFAULT_GATEWAY;
    private String OWNER;
    private String TOKEN;
    private String PROJECT_ACCOUNT_NAME;
    private Airavata.Client airavataClient;
    private String RESOURCE_HOST;
    
    public ExperimentUtils() throws AiravataClientConnectException{
        init();
        CreateAiravataClient();
    }
    
    private void init(){
        
        JSONObject airvata_properties = AppConfig.getAiravataProperties();
        THRIFT_SERVER_HOST = (String) airvata_properties.get("server");
        THRIFT_SERVER_PORT = Integer.parseInt((long) airvata_properties.get("port")+"");
        DEFAULT_GATEWAY = (String) airvata_properties.get("gateway");
        OWNER = (String) airvata_properties.get("login");
        TOKEN = (String) airvata_properties.get("credentialStoreToken");
        PROJECT_ACCOUNT_NAME = (String) airvata_properties.get("projectAccount");
    }
    
   public void CreateAiravataClient() throws AiravataClientConnectException{
       airavataClient = AiravataClientFactory.createAiravataClient(THRIFT_SERVER_HOST, (int) THRIFT_SERVER_PORT);
   }
   
   public String CreateProject(String projectName) throws TException{
       Project project = ProjectModelUtil.createProject(projectName, OWNER, "GenApp module test project");
       return airavataClient.createProject(DEFAULT_GATEWAY, project);
   }
   
   public String CreateExperiment(String expName, String projectId, String appId, String inputJson) throws TException{
       List<InputDataObjectType> exInputs = new ArrayList<InputDataObjectType>();
       InputDataObjectType input = new InputDataObjectType();
       input.setName("json_input");
       input.setType(DataType.STRING);
       input.setValue(inputJson);
       exInputs.add(input);
       List<OutputDataObjectType> exOut = new ArrayList<OutputDataObjectType>();
       OutputDataObjectType output = new OutputDataObjectType();
       output.setName("output_json");
       output.setType(DataType.STDOUT);
       output.setValue("");
       exOut.add(output);
       JSONObject cmrs = getRandomResource();
       RESOURCE_HOST = (String) cmrs.get("host");
       appId+="_"+RESOURCE_HOST;
       Experiment genAppExperiment =
               ExperimentModelUtil.createSimpleExperiment(projectId, OWNER, expName, "GenApp Module Experiment", appId, exInputs);
       genAppExperiment.setExperimentOutputs(exOut);
       Map<String, String> cmrf = airavataClient.getAvailableAppInterfaceComputeResources(appId);
           String host = (String) cmrs.get("host");
           String hostId = getKeyFromValue(cmrf, host);
           if(cmrf.containsValue(host)){
               ComputationalResourceScheduling scheduling = ExperimentModelUtil.createComputationResourceScheduling(
                       hostId, 1, 1, 1, "normal", 30, 0, 1, PROJECT_ACCOUNT_NAME);
            scheduling.setResourceHostId(hostId);
            UserConfigurationData userConfigurationData = new UserConfigurationData();
            userConfigurationData.setAiravataAutoSchedule(false);
            userConfigurationData.setOverrideManualScheduledParams(false);
            userConfigurationData.setComputationalResourceScheduling(scheduling);
            genAppExperiment.setUserConfigurationData(userConfigurationData);
           }
       
       return airavataClient.createExperiment(DEFAULT_GATEWAY, genAppExperiment);
   }
   
   public void launchExperiment(String expId) throws TException{
       airavataClient.launchExperiment(expId, "");
   }
   
   public String getOutput(String expId) throws TException, InterruptedException, ParseException{
       ExperimentState state = null;
       int waitTime = 1;
       while(!(state = getExperimentState(expId)).equals(ExperimentState.COMPLETED)){
           if(state.equals(ExperimentState.CANCELED) 
                   || state.equals(ExperimentState.SUSPENDED) 
                   || state.equals(ExperimentState.FAILED)){
       
             return "{\"error\": \""+state+"\"}";
           }
           Thread.sleep(waitTime);
           waitTime++;
       }
       JSONParser parser = new JSONParser();
       JSONObject out = (JSONObject) parser.parse(airavataClient.getExperimentOutputs(expId).get(0).getValue());
       out.put("Computational_Host", RESOURCE_HOST);
       return out.toJSONString();
   }
   
   public ExperimentState getExperimentState(String expId) throws TException{
       ExperimentStatus status = airavataClient.getExperimentStatus(expId);
       return status.getExperimentState();
   }
   
   private String getKeyFromValue(Map<String, String> map, String value){
       String key = null;
       Iterator<Entry<String, String>> it = map.entrySet().iterator();
       while(it.hasNext()){
           Entry<String, String> set = it.next();
           if(set.getValue().equals(value)){
               key = set.getKey();
               break;
           }
       }
       return key;
   }
   
   private JSONObject getRandomResource(){
       JSONArray cmrs = AppConfig.getComputeResources();
       Random rn = new Random();
       int no = Math.abs(rn.nextInt())%cmrs.size();
       return (JSONObject)cmrs.get(Math.abs(no));
   }

}
