package input;

import java.awt.Desktop;
import java.io.File;
import java.io.IOException;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Set;

import data.*;

import util.Help;

import javafx.beans.value.ChangeListener;
import javafx.beans.value.ObservableValue;
import javafx.event.ActionEvent;
import javafx.event.EventHandler;
import javafx.scene.Node;
import javafx.scene.control.Button;
import javafx.scene.control.CheckBox;
import javafx.scene.control.ComboBox;
import javafx.scene.control.RadioButton;
import javafx.scene.control.TextArea;
import javafx.scene.control.TextField;
import javafx.scene.control.ToggleGroup;
import javafx.scene.layout.HBox;
import javafx.scene.layout.VBox;
import javafx.scene.text.Text;
import javafx.stage.FileChooser;
import javafx.stage.Stage;

public class Input {
    public static HBox getSubmitButton(){
        Button submit = new Button("Submit");
        submit.getStyleClass().add("button");
        Button reset = new Button("Reset to default Values");
        reset.getStyleClass().add("button");
        HBox buttons = new HBox();
        reset.setId("reset");
        submit.setId("submit");
        buttons.getStyleClass().add("input");
        buttons.getChildren().addAll(submit, reset);
        return buttons;
    }
    
    public static boolean isNumeric(String str,String type)
    {
        if(type.equals("integer")){
            return str.matches("-?\\d+");    
        }
        else if(type.equals("float")){
             return str.matches("^[-]?((0|[1-9][0-9]*)(\\.[0-9]+)?|\\.[0-9]+)([eE][+-]?[0-9]+)?$");
//            return str.matches("-?\\d+(\\.\\d+)?"); 
        }else{
            return false;
        }
    }
    
    public static HBox getfloatInputInterface(final HashMap<String, String> data){
        HBox input = new HBox();
        String defaultVal="";
        input.getStyleClass().add("input");
        Text label = new Text(data.get("label"));
        label.getStyleClass().add("label");
        final TextField textField = new TextField();
        textField.setId(data.get("id"));
        if(data.containsKey("default")){
            if(isNumeric(data.get("default"), "float")){
                defaultVal = data.get("default");
            }
        }
        if(data.containsKey("help")){
            boolean help = data.get("isHelpOn").equals("true") ? true : false;
            Help.installTooltip(data.get("help"), textField, help);
        }
        textField.textProperty().addListener(new ChangeListener<String>() {
            @Override public void changed(ObservableValue<? extends String> observable, String oldValue, String newValue) {
                try {
                    float min, max;
                    min = Float.MIN_VALUE;
                    max = Float.MAX_VALUE;
                    if(data.containsKey("min")){
                        if(isNumeric(data.get("min"), "float")){
                            min =Float.parseFloat(data.get("min"));
                        }
                    }
                    if(data.containsKey("max")){
                        if(isNumeric(data.get("max"), "float")){
                            max =Float.parseFloat(data.get("max"));
                        }
                    }
                    
                    if(!newValue.isEmpty() && !(newValue.equals("0")||newValue.equals("0."))){
                        float value = Float.parseFloat(newValue);
                        if(min>value){
                            textField.setText(min+"");
                        }else if(max< value){
                            textField.setText(max+"");
                        }
                        
                    }
               }
               catch (NumberFormatException ex) {
                    textField.setText(oldValue);
               }
            }
        });
        textField.setText(defaultVal);
        input.getChildren().addAll(label, textField);
        return input;
    }
    
    public static HBox getintegerInputInterface(final HashMap<String, String> data){  
        HBox input = new HBox();
        final VBox inputs = new VBox();
        inputs.setSpacing(10);
        final HBox main = new HBox();
        String defaultVal="";
        input.getStyleClass().add("input");
        Text label = new Text(data.get("label"));
        label.getStyleClass().add("label");
        final TextField textField = new TextField();
        textField.setId(data.get("id"));
        if(data.containsKey("default")){
            if(isNumeric(data.get("default"), "integer")){
                defaultVal = data.get("default");
            }
        }
        if(data.containsKey("help")){
            boolean help = data.get("isHelpOn").equals("true") ? true : false;
            Help.installTooltip(data.get("help"), textField, help);
        }
        textField.setText(defaultVal);
        main.getChildren().addAll(label, textField);
        inputs.getChildren().add(main);
        textField.textProperty().addListener(new ChangeListener<String>() {
            @Override public void changed(ObservableValue<? extends String> observable, String oldValue, String newValue) {
                int val=0;
                try {
                    int min, max;
                    min = Integer.MIN_VALUE;
                    max = Integer.MAX_VALUE;
                    if(data.containsKey("min")){
                        if(isNumeric(data.get("min"), "integer")){
                            min =Integer.parseInt(data.get("min"));
                        }
                    }
                    if(data.containsKey("max")){
                        if(isNumeric(data.get("max"), "integer")){
                            max =Integer.parseInt(data.get("max"));
                        }
                    }
                    if(!newValue.isEmpty()){
                        int value = Integer.parseInt(newValue);
                        val = value;
                        if(min>value){
                            textField.setText(min+"");
                            val = min;
                        }else if(max< value){
                            textField.setText(max+"");
                            val = max;
                        }
                        
                    }
               }
               catch (NumberFormatException ex) {
                    textField.setText(oldValue);
                    val = Integer.parseInt(newValue);
               }finally{
                   if(data.containsKey("repeater")){
                       if(data.get("repeater").equals("true")){
                           HashMap<String, String> repeatData = null;
                           Iterator<HashMap<String, String>> it = Repeater.repeater.get(data.get("module")).iterator();
                           while(it.hasNext()){
                               repeatData = it.next();
                               if(repeatData.get("repeat").equals(data.get("id"))){
                                   break;
                               }else {
                                   repeatData = null;
                               }
                           }
                               String id = repeatData.get("id");
                               inputs.getChildren().clear();
                               inputs.getChildren().add(main);
                               repeatData.put("isHelpOn",data.get("isHelpOn"));
                               repeatData.put("module", data.get("module"));
                               while(val>0){
                                   inputs.getChildren().add(Input.getInputInterface(repeatData, null));
                                   val--;
                               }
                           }
                   }
               }
            }
        });
        input.getChildren().add(inputs);
        return input;
    }
    
    public static HBox gettextInputInterface(final HashMap<String, String> data){
        HBox input = new HBox();
        input.getStyleClass().add("input");
        Text label = new Text(data.get("label"));
        label.getStyleClass().add("label");
        final TextField textField = new TextField();
        textField.setId(data.get("id"));
        if(data.containsKey("help")){
            boolean help = data.get("isHelpOn").equals("true") ? true : false;
            Help.installTooltip(data.get("help"), textField, help);
        }
        textField.textProperty().addListener(new ChangeListener<String>() {
            @Override public void changed(ObservableValue<? extends String> observable, String oldValue, String newValue) {
                int max;
                try {   
                    if(data.containsKey("maxlength")){
                       max =Integer.parseInt(data.get("maxlength"));
                    }else{
                        max = Integer.MAX_VALUE;
                    }
                }
                catch (NumberFormatException ex) {
                    max = Integer.MAX_VALUE;
                }
                    if(!newValue.isEmpty()){
                        if(max < newValue.length()){
                            textField.setText(oldValue);
                        }
                        
                    }
               
            }
        });
        input.getChildren().addAll(label, textField);
        return input;
    }
    
    public static HBox getcheckboxInputInterface(final HashMap<String, String> data){
        HBox input = new HBox();
        final VBox inputs = new VBox();
        inputs.setSpacing(10);
        final HBox main = new HBox();
        Boolean defaultVal=false;
        input.getStyleClass().add("input");
        Text label = new Text(data.get("label"));
        label.getStyleClass().add("label");
        final CheckBox checkBox = new CheckBox();
        checkBox.setId(data.get("id"));
        if(data.containsKey("checked")){
            if(data.get("checked").equals("true")||data.get("checked").equals("True")||
                    data.get("checked").equals("TRUE")||data.get("checked").equals("on")){
                defaultVal = true;
            }
        }
        if(data.containsKey("help")){
            boolean help = data.get("isHelpOn").equals("true") ? true : false;
            Help.installTooltip(data.get("help"), checkBox, help);
        }
        checkBox.setSelected(defaultVal);
        main.getChildren().addAll(label, checkBox);
        inputs.getChildren().add(main);
        checkBox.selectedProperty().addListener(new ChangeListener<Boolean>() {
            @Override
            public void changed(ObservableValue<? extends Boolean> observable, Boolean oldValue, Boolean newValue) {
                if(data.containsKey("repeater")){
                    if(data.get("repeater").equals("true")){
                        HashMap<String, String> repeatData = null;
                        Iterator<HashMap<String, String>> it = Repeater.repeater.get(data.get("module")).iterator();
                        while(it.hasNext()){
                            repeatData = it.next();
                            if(repeatData.get("repeat").equals(data.get("id"))){
                                break;
                            }else {
                                repeatData = null;
                            }
                        }
                        if(newValue){
                            repeatData.put("isHelpOn",data.get("isHelpOn"));
                            repeatData.put("module", data.get("module"));
                            inputs.getChildren().add(Input.getInputInterface(repeatData, null));
                            
                        }else{
                            inputs.getChildren().clear();
                            inputs.getChildren().add(main);
                        }
                    }
                }
            }
        });
        input.getChildren().add(inputs);
        return input;
    }
    
    public static HBox getlistboxInputInterface(final HashMap<String, String> data){
        HBox input = new HBox();
        String defaultVal="";
        if(data.containsKey("default")){
                defaultVal = "value_"+data.get("default");
        }
        input.getStyleClass().add("input");
        Text label = new Text(data.get("label"));
        label.getStyleClass().add("label");
        ComboBox<String> cmb = new ComboBox<String>();
        Set<String> keys = data.keySet();
        for (String key : keys) {
            if(key.contains("value_")){
                cmb.getItems().add(data.get(key));
            }
        }
        
        cmb.setValue(data.get(defaultVal));
        input.getChildren().addAll(label, cmb);
        return input;
    }
    
    public static HBox getlrfileInputInterface(final HashMap<String, String> data){
        HBox input = new HBox();
        Boolean defaultVal=false;
        input.getStyleClass().add("input");
        Text label = new Text(data.get("label"));
        label.getStyleClass().add("label");
        final Text fileName = new Text();
        fileName.getStyleClass().add("label");
        final FileChooser fileChooser = new FileChooser();
        
        final Button openButton = new Button("Browse File");
 
        openButton.setOnAction(
            new EventHandler<ActionEvent>() {
                @Override
                public void handle(final ActionEvent e) {
                    File file = fileChooser.showOpenDialog(openButton.getScene().getWindow());
                    fileName.setText(file.getAbsolutePath());
                }
            });
        input.getChildren().addAll(label, openButton, fileName);
        return input;
    }
    public static HBox getrfileInputInterface(final HashMap<String, String> data){
        HBox input = new HBox();
        Boolean defaultVal=false;
        input.getStyleClass().add("input");
        Text label = new Text(data.get("label"));
        label.getStyleClass().add("label");
        final Text fileName = new Text();
        fileName.getStyleClass().add("label");
        final FileChooser fileChooser = new FileChooser();
        
        final Button openButton = new Button("Browse File");
 
        openButton.setOnAction(
            new EventHandler<ActionEvent>() {
                @Override
                public void handle(final ActionEvent e) {
                    File file = fileChooser.showOpenDialog(openButton.getScene().getWindow());
                    fileName.setText(file.getAbsolutePath());
                }
            });
        input.getChildren().addAll(label, openButton, fileName);
        return input;
    }
    public static HBox getradioInputInterface(final HashMap<String, String> data){
        HBox input = new HBox();
        input.setId(data.get("name"));
        Boolean checked=false;
        input.getStyleClass().add("input");
        Text label = new Text(data.get("label"));
        label.getStyleClass().add("label");
        final RadioButton radio = new RadioButton();
        radio.setId(data.get("id"));
        if(data.containsKey("checked")){
            if(data.get("checked").equals("true")||data.get("checked").equals("True")||
                    data.get("checked").equals("TRUE")||data.get("checked").equals("on")){
                checked = true;
            }
        }
        if(data.containsKey("help")){
            boolean help = data.get("isHelpOn").equals("true") ? true : false;
            Help.installTooltip(data.get("help"), radio, help);
        }
        radio.setSelected(checked);
        input.getChildren().addAll(label, radio);
        return input;
    }
    
    public static HBox gettextareaInputInterface(final HashMap<String, String> data){
        HBox input = new HBox();
        input.setId(data.get("name"));
        String defaultText="";
        input.getStyleClass().add("input");
        Text label = new Text(data.get("label"));
        label.getStyleClass().add("label");
        TextArea text = new TextArea();
        text.setId(data.get("id"));
        if(data.containsKey("default")){
                defaultText = data.get("default");
        }
        
        try {
            int row, cols;
            if(data.containsKey("rows")){
                if(isNumeric(data.get("rows"), "integer")){
                    row =Integer.parseInt(data.get("rows"));
                    text.setPrefRowCount(row);
                }
            }
            if(data.containsKey("cols")){
                if(isNumeric(data.get("cols"), "integer")){
                    cols =Integer.parseInt(data.get("cols"));
                    text.setPrefColumnCount(cols);        
                    }
            }
            
       }
       catch (NumberFormatException ex) {
       }
        if(data.containsKey("help")){
            boolean help = data.get("isHelpOn").equals("true") ? true : false;
            Help.installTooltip(data.get("help"), text, help);
        }
        text.setText(defaultText);
        input.getChildren().addAll(label, text);
        return input;
    }
    
    public static void addtoToggleGroup(Node input, Node group){
        RadioButton rb =  (RadioButton) input;
        
        if(group == null){
           
                ToggleGroup tb = new ToggleGroup();
                
                rb.setToggleGroup(tb);
                
        }else {
            HBox hb = (HBox) group;
            RadioButton groupButton = (RadioButton) hb.getChildren().get(1);
            rb.setToggleGroup(groupButton.getToggleGroup());
            
            
        }
    }
    
    public static HBox getInputInterface(HashMap<String, String> data, VBox allElements){
        HBox input = null;
        switch(data.get("type")){
        case "integer":
            input = getintegerInputInterface(data);
            break;
        case "float":
            input = getfloatInputInterface(data);
            break;
        case "checkbox":
            input = getcheckboxInputInterface(data);
            break;
        case "text":
            input = gettextInputInterface(data);
            break;
        case "radio":
            input = getradioInputInterface(data);
            addtoToggleGroup(input.getChildren().get(1), allElements.lookup("#"+data.get("name")));
            break;
        case "listbox":
            input = getlistboxInputInterface(data);
            break;
        case "lrfile":
            input = getlrfileInputInterface(data);
            break;
        case "rfile":
            input = getrfileInputInterface(data);
            break;
        case "textarea":
            input = gettextareaInputInterface(data);
        }
        return input;
    }
    
    private static String getTextFieldInput(Node data){
        String input = "";
        TextField textfield = (TextField) data;
        input = textfield.getText();
        return input;
    }
    
    private static String getCheckBoxInput(Node data){
        String input="";
        CheckBox checkbox = (CheckBox) data;
        if(checkbox.isSelected())
        input = checkbox.isSelected()+"";
        return input;
    }
    
    public static String getInput(Node data){
        String input = null;
        switch(data.getTypeSelector()){
        case "TextField":
            input = getTextFieldInput(data);
            break;
        case "CheckBox":
            input = getCheckBoxInput(data);
            break;
        
        }
        return input;
    }
}