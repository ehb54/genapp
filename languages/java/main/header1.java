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
