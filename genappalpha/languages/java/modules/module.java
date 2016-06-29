package modules;

import data.__menu:modules:id___data;

import util.JobRun;
import input.Input;
import output.Output;
import java.util.HashMap;
import util.HandleResult;
import javafx.scene.Node;
import java.util.Iterator;
import java.io.IOException;
import javafx.scene.text.Text;
import javafx.scene.layout.HBox;
import javafx.scene.layout.VBox;
import javafx.event.EventHandler;
import org.json.simple.JSONObject;
import javafx.scene.control.Button;
import javafx.scene.input.MouseEvent;
import javafx.scene.control.ProgressBar;

public class __menu:modules:id__ extends VBox implements EventHandler<MouseEvent>{
    private VBox inputBox, outputBox;
    private boolean isHelpOn;

    public __menu:modules:id__(boolean isHelpOn){
        this.isHelpOn = isHelpOn;
        this.getStyleClass().add("module");
        inputBox = setInputs();
        outputBox = setOutputs();
        outputBox.getStyleClass().addAll("outputBox", "outputs");
        inputBox.getStyleClass().add("inputs");
        this.setId("__menu:modules:id___module");
        this.getChildren().addAll(inputBox, outputBox);
    }
    
    private VBox setInputs(){
        VBox inputs = new VBox();
        for (HashMap<String, String> data : __menu:modules:id___data.input) {
            data.put("isHelpOn", isHelpOn+"");
            data.put("module", "__menu:modules:id___data");
            HBox input = Input.getInputInterface(data, inputs);
            inputs.getChildren().add(input);    
        }
        HBox bt = Input.getSubmitButton();
        Iterator<Node> btIt = bt.getChildren().iterator();
        while(btIt.hasNext()){
            btIt.next().setOnMouseClicked(this);
        }
        inputs.getChildren().add(bt);
        ProgressBar pbar = new ProgressBar();
        pbar.setProgress(-1);
        pbar.setId("progress");
        pbar.setVisible(false);
        inputs.getChildren().add(pbar);
        return inputs;
    }
    
    private VBox setOutputs(){
        VBox output = new VBox();
        HBox errorBox = new HBox();
        Text error = new Text("");
        error.getStyleClass().add("error");
        error.setId("error");
        errorBox.getChildren().add(error);
        errorBox.setId("errorBox");
        output.getChildren().add(errorBox);
        for (HashMap<String, String> data : __menu:modules:id___data.output) {
            HBox out = Output.getOutput(data);
            output.getChildren().add(out);    
        }
        return output;
    }

    @Override
    public void handle(MouseEvent event) {
        Button bt = (Button) event.getSource();
        switch(bt.getId()){
        case "submit":
            JSONObject data;
            ProgressBar pb = (ProgressBar) inputBox.lookup("#progress");
            pb.setVisible(true);
            try {
                data = HandleResult.prepareToRun("__menu:modules:id___","__executable_path:java__/","__menu:modules:id__",inputBox);
                JobRun jb = new JobRun(data, outputBox, inputBox);
                Thread jobThread = new Thread(jb);
                jobThread.start();
            } catch (IOException e) {
                pb.setVisible(false);
                e.printStackTrace();
            }catch(SecurityException e){
                pb.setVisible(false);
                e.printStackTrace();
            }
            break;
        case "reset":
            break;
        
        }
        
    }
    
}