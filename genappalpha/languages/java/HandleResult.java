package util;

import input.Input;

import java.io.BufferedWriter;
import java.io.File;
import java.io.FileWriter;
import java.io.IOException;
import java.util.Iterator;

import javafx.scene.Node;
import javafx.scene.layout.HBox;
import javafx.scene.layout.VBox;
import javafx.scene.text.Text;

import org.json.simple.JSONObject;
import org.json.simple.parser.JSONParser;


import output.Output;


public class HandleResult {
    public static String uniqid(String prefix)
    {
        long time = System.currentTimeMillis();
        String uniqid = "";
        uniqid = String.format("%s%08x%05x", prefix, time/1000, time);        
        return uniqid ;
    }
    
    public static void createDirectory(String location) throws SecurityException{
         File theDir = new File(location);
         boolean test=true;
         if (!theDir.exists()) {
             System.out.println("creating directory: "+location);
             boolean result = false;
    
                 test = theDir.mkdirs();
                 theDir.setReadable(true);
                 theDir.setWritable(true);
                 theDir.setExecutable(true);
                 result = true;       
             if(result) {    
                 
                    System.out.println(test);
                    System.out.println("file: "+theDir.exists());
                    System.out.println("file: "+theDir.getPath());
                
             }
         }
        
    }
    
    public static void wrtieFile(String content, String fileName) throws IOException{
            File file = new File(fileName);
 
            if (!file.exists()) {
                file.createNewFile();
            }
 
            FileWriter fw = new FileWriter(file.getAbsoluteFile());
            BufferedWriter bw = new BufferedWriter(fw);
            bw.write(content);
            bw.close();
 
    }
    
   public static JSONObject getInputJSON(VBox input){
        JSONObject json = new JSONObject();
        Iterator<Node> inputIt = input.getChildren().iterator();
        while(inputIt.hasNext()){
            Node node = inputIt.next();
            if(node instanceof HBox){
            HBox inp = (HBox) node;
            if(inp.getChildren().size() > 1){
            Node nd = inp.getChildren().get(1);
                if(nd.getId() != "reset" && nd.getId() != "submit")
                json.put(nd.getId(), Input.getInput(nd));
            }else if(inp.getChildren().size() == 1){
                Node nd = inp.getChildren().get(0);
                if(nd instanceof VBox){
                    json.putAll(getInputJSON((VBox) nd));
                }
            }
          }
            
        }
        return json;
    }
    
    public static void setOutput(VBox output, JSONObject jsonObject){
        Iterator<Node> outIt = output.getChildren().iterator();
        System.out.println(jsonObject);
        while(outIt.hasNext()){
            HBox hb = (HBox) outIt.next();
            if(hb.getChildren().size() > 1){
                if(jsonObject.containsKey(hb.getChildren().get(1).getId())){
                    Output.setOutput(hb.getChildren().get(1),jsonObject.get(hb.getChildren().get(1).getId()));
                    jsonObject.remove(hb.getChildren().get(1).getId());
                }
            }
        }
        Iterator<String> keys = jsonObject.keySet().iterator();
        String out = "";
        while(keys.hasNext()){
            String key = keys.next();
            out = out+"\n"+key+" => "+jsonObject.get(key);
        }
        
        HBox errorBox = (HBox)output.getChildren().get(0);
        Text errorOut = (Text)errorBox.getChildren().get(0);
        errorOut.setText(out);
    }
    
    public static JSONObject getJSON(String string){
        JSONObject json;
        JSONParser parser = new JSONParser();
        try {        
           json = (JSONObject) parser.parse(string);
       } catch (Exception e) {
           json = new JSONObject();
           json.put("error", string);
       }
        return json;

    }
    
    public static JSONObject prepareToRun(String id,String path, String module, VBox inputBox) throws IOException, SecurityException{
        String cmds;
        JSONObject json = new JSONObject();
        String uuid = HandleResult.uniqid(id);
        String base_dir = "__docroot:java__/__application___java/"+uuid;
        JSONObject args = getInputJSON(inputBox);
        createDirectory(base_dir);
        args.put("_uuid", uuid);
        args.put("_base_directory", base_dir);
        args.put("_log_directory", base_dir);
        if(AppConfig.runAiravata()){
            args.put("resourcedefault", "airavata");
            cmds = "java -cp \".:lib/*\" airavata.LaunchExperiment "+module+" '"+args+"'";
        }else{
            cmds = path+module+" '"+args+"'";            
            args.put("resourcedefault", "");
        }
        cmds = cmds+" 2> "+base_dir+"/_stderr_"+uuid+" | head -c50000000";
        json.put("uuid", uuid);
        json.put("base_dir", base_dir);
        json.put("cmds", cmds);
        
        HandleResult.wrtieFile(json+"", base_dir+"/_args_"+uuid);
        HandleResult.wrtieFile(json+"", base_dir+"/_inputs_"+uuid);
        HandleResult.wrtieFile(cmds, base_dir+"/_cmds_"+uuid);
        return json;
    }

}