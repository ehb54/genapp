        };

        for (int i=0; i<options.length; i++) {
            VBox.setMargin(options[i], new Insets(0, 0, 0, 8));
            vbox.getChildren().add(options[i]);
        }
        
        MenuBox menubox = new MenuBox(menuButton, vbox);
        menubox.setId("Menu_Box");
        VBox.setVgrow(vbox, Priority.ALWAYS);
        
        return menubox;
    }
    
    private BorderPane getFooter(){
        BorderPane footer = new BorderPane();
        footer.getStyleClass().add("footer");
        Text title = new Text("__footer__");
        title.getStyleClass().add("footer-text");
        footer.setLeft(title);
        return footer;
    }

    private VBox getContent(){
        content = new VBox();
        content.setId("content");
        HBox modules = new HBox();
        modules.setId("module-name");
        VBox page = new VBox();
        page.setId("module-page");
        content.getChildren().addAll(modules, page);
        return content;
    }
    
    private HBox getModuleButtons(String modulesType){
        HBox mods = new HBox();
        mods.setSpacing(5);
        mods.setAlignment(Pos.CENTER);
        List<String> modlueNames = ModulesData.modules.get(modulesType);
        for (String name : modlueNames) {
            Button bt = new Button(name);
            bt.getStyleClass().add("button");
            bt.setId(name);
            bt.setOnMouseClicked(this);
            mods.getChildren().add(bt);
        }
        return mods;
    }

    private HBox addMenuItem(String menuName, String image){
        HBox menuItems = new HBox();
        menuItems.setId(menuName);
        
        menuItems.setOnMouseClicked(this);
        menuItems.getStyleClass().add("menu-item");
        Text menuTitle = new Text(menuName);
        menuTitle.getStyleClass().add("menu-item-text");
        String img = __application__.class.getResource(image).toExternalForm();
        menuItems.setStyle("-fx-background-image: url('"+img+"');");
        StackPane stack = new StackPane();
        Rectangle menuItem = new Rectangle(150, 50);
        menuItem.setFill(Color.TRANSPARENT);
        
        stack.getChildren().addAll(menuItem, menuTitle);
        stack.setAlignment(Pos.CENTER_LEFT);
        menuItems.getChildren().add(stack);
        HBox.setHgrow(stack, Priority.ALWAYS);
        return menuItems;
        
    }

public void setMenuImage(String image){
    HBox hb = (HBox) scene.lookup("#menu-button-box");
    String img = __application__.class.getResource(image).toExternalForm();
    hb.setStyle("-fx-background-image: url('"+img+"');");
}


@Override
public void handle(MouseEvent event) {
    if(event.getSource() instanceof HBox){
        HBox hb = (HBox) event.getSource();
        switch(hb.getId()){
            case "menu-button": 
                MenuBox.ToggleMenuBox(scene.lookup("#Menu_Box"));
                break;
