package util;

import java.io.FileReader;

import org.json.simple.JSONArray;
import org.json.simple.JSONObject;
import org.json.simple.parser.JSONParser;

public class AppConfig {

    public static JSONObject getAppConfig(){
        JSONObject appConfig = null;
        JSONParser parser = new JSONParser();
        try {        
             appConfig = (JSONObject) parser.parse(new FileReader("__appconfig__"));
        
        } catch (Exception e) {
            e.printStackTrace();
        }
        return appConfig;
    }
    
    
    public static boolean runAiravata(){
        boolean airavata = false;
        JSONObject config = getAppConfig();
        String resource = (String) config.get("resourcedefault");
        if(resource.equals("airavata")){
            JSONObject jsonResource = (JSONObject) config.get("resources");
            if(jsonResource.containsKey(resource)){
                JSONObject airavataProp = (JSONObject) jsonResource.get(resource);
                String run = (String) airavataProp.get("run");
                if(run.equals("airavatarun")){
                    airavata = true;
                }
            }
        }
        return airavata;
    }
    
    public static JSONObject getAiravataProperties(){
        JSONObject properties = null;
        JSONObject config = getAppConfig();
        String resource = (String) config.get("resourcedefault");
        if(resource.equals("airavata")){
            JSONObject jsonResource = (JSONObject) config.get("resources");
            if(jsonResource.containsKey(resource)){
                JSONObject airavata = (JSONObject) jsonResource.get(resource);
                properties = (JSONObject) airavata.get("properties");
            }
        }
        return properties;
    }
    
    public static JSONArray getComputeResources(){
        JSONArray computeResource = null;
        JSONObject config = getAppConfig();
        String resource = (String) config.get("resourcedefault");
        if(resource.equals("airavata")){
            JSONObject jsonResource = (JSONObject) config.get("resources");
            if(jsonResource.containsKey(resource)){
                JSONObject airavata = (JSONObject) jsonResource.get(resource);
                computeResource = (JSONArray) airavata.get("resources");
            }
        }
        return computeResource;
    }

}