package util;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;

import org.json.simple.JSONObject;

import javafx.scene.control.ProgressBar;
import javafx.scene.layout.VBox;

import states.ApplicationStates;

public class JobRun implements Runnable{
    public String JOB_STATE = null;
    private VBox outputs, inputs;
    private String[] command;
    private JSONObject data;
    public JobRun(JSONObject data, VBox outputs, VBox inputs){
        JOB_STATE = ApplicationStates.JOB_STATES[0];
        this.outputs = outputs;
        this.inputs = inputs;
        this.data = data;
        command = new String[]{
                "/bin/sh",
                "-c",
                data.get("cmds")+"",
        };
    }
    
    public static String readInputStream(InputStream input) throws IOException{
        String fileData = "";
        BufferedReader reader = new BufferedReader(new InputStreamReader(input));
        String line = null;
        while ((line = reader.readLine()) != null) {
           fileData +=line;
        }
        return fileData;
    }
    
    @Override
    public void run() {
        ProgressBar pbar = (ProgressBar) inputs.lookup("#progress");
        try {
            ProcessBuilder pb = new ProcessBuilder(command);
            Process p = pb.start();
                
                JSONObject json = HandleResult.getJSON(readInputStream(p.getInputStream()));
                HandleResult.wrtieFile(json+"", data.get("base_dir")+"/_output_"+data.get("uuid"));
                HandleResult.setOutput(outputs, json);
                pbar.setVisible(false);

        } catch (IOException e) {
            pbar.setVisible(false);
            e.printStackTrace();
            System.out.println("Error file not found");
        }
        
    }
    
}
