        case "__menu:modules:label__":
			   	if(modules.containsKey("__menu:modules:id__")){
	                content.getChildren().set(1, modules.get("__menu:modules:id__"));
	            }else{
		            VBox __menu:modules:id___module = new __menu:modules:id__(appState.isHelpOn());
	                modules.put("__menu:modules:id__", __menu:modules:id___module);
	    	        content.getChildren().set(1, __menu:modules:id___module);
	            }
	            break;

