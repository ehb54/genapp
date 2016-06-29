package output;

import java.io.BufferedReader;
import java.io.File;
import java.io.IOException;
import java.io.InputStreamReader;
import java.util.HashMap;
import java.util.Iterator;

import org.json.simple.JSONArray;
import org.json.simple.JSONObject;

import util.HandleResult;

import javafx.application.Platform;
import javafx.event.Event;
import javafx.event.EventHandler;
import javafx.scene.Node;
import javafx.scene.Parent;
import javafx.scene.Scene;
import javafx.scene.chart.LineChart;
import javafx.scene.chart.NumberAxis;
import javafx.scene.chart.XYChart;
import javafx.scene.control.CheckBox;
import javafx.scene.control.RadioButton;
import javafx.scene.control.TextArea;
import javafx.scene.control.TextField;
import javafx.scene.input.MouseEvent;
import javafx.scene.layout.HBox;
import javafx.scene.layout.VBox;
import javafx.scene.text.Text;
import javafx.stage.Stage;

public class Output {
    private static HBox getTextFieldOutputInterface(HashMap<String, String> data){
        HBox output = new HBox();
        output.getStyleClass().add("output");
        Text outTitle = new Text(data.get("label"));
        outTitle.getStyleClass().add("label");
        TextField textField = new TextField();
        textField.setId(data.get("id"));
        textField.setDisable(true);
        output.getChildren().addAll(outTitle, textField);
        return output;
    }
    
    private static HBox getcheckboxOutputInterface(HashMap<String, String> data){
        HBox input = new HBox();
        input.getStyleClass().add("input");
        Text label = new Text(data.get("label"));
        label.getStyleClass().add("label");
        final CheckBox checkBox = new CheckBox();
        checkBox.setId(data.get("id"));
        checkBox.setDisable(true);
        input.getChildren().addAll(label, checkBox);
        return input;
    }
    
    private static HBox getradioOutputInterface(final HashMap<String, String> data){
        HBox input = new HBox();
        input.setId(data.get("name"));
        input.getStyleClass().add("input");
        Text label = new Text(data.get("label"));
        label.getStyleClass().add("label");
        final RadioButton radio = new RadioButton();
        radio.setId(data.get("id"));
        radio.setDisable(true);
        input.getChildren().addAll(label, radio);
        return input;
    }
    
    
    
    private static HBox gettextareaOutputInterface(final HashMap<String, String> data){
        HBox input = new HBox();
        input.setId(data.get("name"));
        input.getStyleClass().add("input");
        Text label = new Text(data.get("label"));
        label.getStyleClass().add("label");
        TextArea text = new TextArea();
        text.setId(data.get("id"));
        text.setDisable(true);
        input.getChildren().addAll(label, text);
        return input;
    }
    
    private static HBox getplot2dOutputInterface(final HashMap<String, String> data){
        HBox input = new HBox();
        input.setId(data.get("name"));
        input.getStyleClass().add("input");
        Text label = new Text(data.get("label"));
        label.getStyleClass().add("label");
        
        NumberAxis xAxis = new NumberAxis();
        NumberAxis yAxis = new NumberAxis();
        LineChart<Number,Number> lineChart = 
                new LineChart<Number,Number>(xAxis,yAxis);
        lineChart.setAlternativeColumnFillVisible(true);
        lineChart.setAlternativeRowFillVisible(true);
        lineChart.setTitle("Plot 2d");
        lineChart.setId(data.get("id"));
  
        input.getChildren().addAll(label, lineChart);
        return input;
    }
    
    private static HBox getAtomicstructureInterface(final HashMap<String, String> data){
        HBox input = new HBox();
        input.setId(data.get("name"));
        input.getStyleClass().add("input");
        Text label = new Text(data.get("label"));
        label.getStyleClass().add("label");
        VBox fileOut = new VBox();
        fileOut.setId(data.get("id"));
        Text file = new Text("");
        file.getStyleClass().add("link");
        file.setId("atomicstructure");
        fileOut.getChildren().add(file);
        input.getChildren().addAll(label, fileOut);
        return input;
    }
    
    private static HBox getFileOutputInterface(final HashMap<String, String> data){
        HBox input = new HBox();
        input.setId(data.get("name"));
        input.getStyleClass().add("input");
        Text label = new Text(data.get("label"));
        label.getStyleClass().add("label");
        VBox fileOut = new VBox();
        fileOut.setId(data.get("id"));
        Text file = new Text("");
        file.getStyleClass().add("link");
        file.setId("file");
        fileOut.getChildren().add(file);
        input.getChildren().addAll(label, fileOut);
        return input;
    }
    
    public static HBox getOutput(HashMap<String, String> data){
        HBox output = null;
        switch(data.get("type")){
        case "integer":
            output = getTextFieldOutputInterface(data);
            break;
        case "float":
            output = getTextFieldOutputInterface(data);
            break;
        case "checkbox":
            output = getcheckboxOutputInterface(data);
            break;
        case "text":
            output = getTextFieldOutputInterface(data);
            break;
        case "radio":
            output = getradioOutputInterface(data);
            break;
        case "textarea":
            output = gettextareaOutputInterface(data);
            break;
        case "plot2d":
            output = getplot2dOutputInterface(data);
            break;
        case "file":
            output = getFileOutputInterface(data);
            break;
        case "atomicstructure":
            output = getAtomicstructureInterface(data);
        }
        return output;
    }
    
    public static void setOutput(Node nd, Object output){
        switch(nd.getTypeSelector()){
        case "TextField":
                setTextFieldOutput((TextField) nd, output.toString());
            break;
        case "LineChart":
                setPlod2dOutput((LineChart<Number, Number>) nd, (JSONArray)output);
            break;
        case "RadioButton":
                setRadioOutput((RadioButton) nd);
            break;
        case "CheckBox":
                setCheckBoxOutput((CheckBox) nd);
            break;
        case "TextArea":
            setTextAreaOutput((TextArea) nd, (String) output);
            break;
        case "VBox":
            VBox vb = (VBox) nd;
            Node subnd = vb.getChildren().get(0);
            switch (subnd.getId()) {
            case "file":
                setFileOutput((Text) subnd, (String) output);
                break;

            case "atomicstructure":
                setAtomicStructureOutput((Text) subnd, (String) output);
                break;
            }
            break;
        
        }
    }

    private static void setFileOutput(Text nd, final String output) {
        String temp[] = output.split("/");
        nd.setText(temp[temp.length-1]);
        nd.setOnMouseClicked(new EventHandler<MouseEvent>() {

            @Override
            public void handle(MouseEvent event) {
                    try {
                        String helper = "vi";
                        if(helper == "vi"){
                            helper = "gedit";
                        }
                        ProcessBuilder pb = new ProcessBuilder(new String[]{
                                "/bin/sh",
                                "-c",
                                helper+" "+output
                        });
                        Process p;
                        p = pb.start();
                    } catch (IOException e) {
                        // TODO Auto-generated catch block
                        e.printStackTrace();
                    }
                   
            }
        });
    }
    
    private static void setAtomicStructureOutput(Text nd, final String output) {
        String temp[] = output.split("/");
        nd.setText(temp[temp.length-1]);
        nd.setOnMouseClicked(new EventHandler<MouseEvent>() {

            @Override
            public void handle(MouseEvent event) {
                    try {
                        String helper = "rasmol";
                        ProcessBuilder pb = new ProcessBuilder(new String[]{
                                "/bin/sh",
                                "-c",
                                helper+" "+output
                        });
                        Process p;
                        p = pb.start();
                    } catch (IOException e) {
                        // TODO Auto-generated catch block
                        e.printStackTrace();
                    }
                   
            }
        });
    }
    
    private static void setTextFieldOutput(TextField nd, String output) {
        nd.setText(output);        
    }
    
    private static void setRadioOutput(RadioButton nd) {
        nd.setSelected(true);        
    }
    
    private static void setCheckBoxOutput(CheckBox nd) {
        nd.setSelected(true);        
    }
    
    private static void setTextAreaOutput(TextArea nd, String output) {
        nd.setText(output);       
    }
    
    private static void setPlod2dOutput(final LineChart<Number, Number> chart, JSONArray out){
        JSONObject data = (JSONObject) out.get(0);
        JSONArray dataArr = (JSONArray) data.get("data");
        Iterator<JSONArray> itData = dataArr.iterator();
        final XYChart.Series series = new XYChart.Series();
        series.setName("Plot 2d");
        while(itData.hasNext()){
            JSONArray point = itData.next();
            series.getData().add(new XYChart.Data((Number)point.get(0), (Number)point.get(1)));
           
        }
       Platform.runLater(new Runnable() {
           @Override
            public void run() {
                chart.getData().clear();
                chart.getData().add(series);
            }
       });
    }
}
