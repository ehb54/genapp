import java.util.HashMap;
import java.util.List;
import data.ModulesData;
import states.ApplicationStates;
import items.MenuBox;
import items.MenuItemIcon;
import javafx.application.Application;
import javafx.event.EventHandler;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.Scene;
import javafx.scene.control.Button;
import javafx.scene.control.ScrollPane;
import javafx.scene.control.Tooltip;
import javafx.scene.image.Image;
import javafx.scene.input.MouseEvent;
import javafx.scene.layout.BorderPane;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.StackPane;
import javafx.scene.layout.VBox;
import javafx.scene.paint.Color;
import javafx.scene.shape.Rectangle;
import javafx.scene.text.Text;
import javafx.stage.Screen;
import javafx.stage.Stage;
import util.Help;

public class __application__ extends Application implements EventHandler<MouseEvent>{
    
    private Scene scene;
    private static ApplicationStates appState;
    private HBox menuButton;
    private VBox content;
    private static HashMap<String, VBox> modules;
    
    public static void main(String[] args) {
        appState = new ApplicationStates();
        modules = new HashMap<String, VBox>();
        launch(__application__.class, args);
    }
    
    @Override
    public void start(Stage stage) {
        ScrollPane main = new ScrollPane();
        main.getStyleClass().add("scrollpane");
        BorderPane border = new BorderPane();
        main.setContent(border);
        border.setTop(getHeader());
        border.setLeft(getMenuBox());
        border.setCenter(getContent());
        border.setBottom(getFooter());
        border.setPrefSize(Screen.getPrimary().getVisualBounds().getWidth()-20,
                            Screen.getPrimary().getVisualBounds().getHeight()-20);

        border.getStyleClass().add("main");
        scene = new Scene(main);      
        scene.getStylesheets().add(__application__.class.getResource("css/main.css").toExternalForm());
        stage.setMaximized(true);
        stage.setScene(scene);
        stage.setTitle("__application__");
        stage.getIcons().add(new Image(__application__.class.getResource("favicon.ico").toExternalForm()));
        stage.show();
        Help.setTooltips(scene, appState.isHelpOn());
    }

    private BorderPane getHeader(){
        BorderPane head = new BorderPane();
        head.getStyleClass().add("header");
        Text title = new Text("__title__");
        title.getStyleClass().add("title");
        Button help = new Button("Help On");
        help.setId("help");
        help.setOnMouseClicked(this);
        menuButton = new MenuItemIcon();
        menuButton.setId("menu-button");
        HBox hb = new HBox();
        hb.getStyleClass().add("menu-button-box");
        hb.setId("menu-button-box");
        hb.setPrefSize(110, 50);
        hb.getChildren().add(menuButton);
        head.setLeft(hb);
        head.setCenter(title);
        head.setRight(help);
        return head;
    }

    private MenuBox getMenuBox() {
        
        VBox vbox = new VBox();
        vbox.getStyleClass().addAll("pane", "vbox");
        
        HBox options[] = new HBox[] {
        addMenuItem("Tools", "pngs/tools.png"),
        addMenuItem("Build", "pngs/build.png"),
        addMenuItem("Interact", "pngs/interact.png"),
        addMenuItem("Simulate", "pngs/simulate.png"),
        addMenuItem("Calculate", "pngs/calculate.png"),
        addMenuItem("Analyze", "pngs/analyze.png")
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
            case "Tools":
                setMenuImage("pngs/tools.png");
                MenuBox.ToggleMenuBox(scene.lookup("#Menu_Box"));
                content.getChildren().set(0, getModuleButtons("Tools"));
                content.getChildren().set(1, new VBox());
                break;
            case "Build":
                setMenuImage("pngs/build.png");
                MenuBox.ToggleMenuBox(scene.lookup("#Menu_Box"));
                content.getChildren().set(0, getModuleButtons("Build"));
                content.getChildren().set(1, new VBox());
                break;
            case "Interact":
                setMenuImage("pngs/interact.png");
                MenuBox.ToggleMenuBox(scene.lookup("#Menu_Box"));
                content.getChildren().set(0, getModuleButtons("Interact"));
                content.getChildren().set(1, new VBox());
                break;
            case "Simulate":
                setMenuImage("pngs/simulate.png");
                MenuBox.ToggleMenuBox(scene.lookup("#Menu_Box"));
                content.getChildren().set(0, getModuleButtons("Simulate"));
                content.getChildren().set(1, new VBox());
                break;
            case "Calculate":
                setMenuImage("pngs/calculate.png");
                MenuBox.ToggleMenuBox(scene.lookup("#Menu_Box"));
                content.getChildren().set(0, getModuleButtons("Calculate"));
                content.getChildren().set(1, new VBox());
                break;
            case "Analyze":
                setMenuImage("pngs/analyze.png");
                MenuBox.ToggleMenuBox(scene.lookup("#Menu_Box"));
                content.getChildren().set(0, getModuleButtons("Analyze"));
                content.getChildren().set(1, new VBox());
                break;
                
                    
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
