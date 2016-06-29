                
                    
        }
    }else if(event.getSource() instanceof Button){
        Button bt = (Button) event.getSource();
        switch(bt.getId()){
        case "help":
            appState.setHelpOn(!appState.isHelpOn());
            if(appState.isHelpOn()){
                bt.setText("Help On");
            }else{
                bt.setText("Help Off");
            }
            Help.setTooltips(scene, appState.isHelpOn());
        break;