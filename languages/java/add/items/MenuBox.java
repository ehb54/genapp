package items;

import states.ApplicationStates;
import javafx.animation.Animation;
import javafx.animation.Transition;
import javafx.event.ActionEvent;
import javafx.event.EventHandler;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.input.MouseEvent;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;
import javafx.util.Duration;

public class MenuBox extends VBox implements EventHandler<MouseEvent>{
    public HBox getMenuButton() { return menuButton; }
    private final HBox menuButton;

    public MenuBox(HBox menuButton , Node... nodes) {

      this.menuButton = menuButton;
      this.setPrefWidth(ApplicationStates.MENU_BOX_WIDTH);
      this.setMinWidth(0);
      setAlignment(Pos.CENTER);
      getChildren().addAll(nodes);

      menuButton.setOnMouseClicked(this);
    }

    @Override
    public void handle(MouseEvent arg0) {
        ToggleMenuBox(this);
    }
    
    public static void ToggleMenuBox(final Node node){
        final Animation hideSidebar = new Transition() {
            { setCycleDuration(Duration.millis(250)); }
            protected void interpolate(double frac) {
              final double curWidth = ApplicationStates.MENU_BOX_WIDTH * (1.0 - frac);
              ((Region) node).setPrefWidth(curWidth);
              node.setTranslateX(-ApplicationStates.MENU_BOX_WIDTH + curWidth);
            }
          };
          hideSidebar.onFinishedProperty().set(new EventHandler<ActionEvent>() {
            @Override public void handle(ActionEvent actionEvent) {
              node.setVisible(false);
            }
          });
  
          final Animation showSidebar = new Transition() {
            { setCycleDuration(Duration.millis(250)); }
            protected void interpolate(double frac) {
              final double curWidth = ApplicationStates.MENU_BOX_WIDTH * frac;
              ((Region) node).setPrefWidth(curWidth);
              node.setTranslateX(-ApplicationStates.MENU_BOX_WIDTH + curWidth);
            }
          };
  
          if (showSidebar.statusProperty().get() == Animation.Status.STOPPED && hideSidebar.statusProperty().get() == Animation.Status.STOPPED) {
            if (node.isVisible()) {
              hideSidebar.play();
            } else {
              node.setVisible(true);
              showSidebar.play();
            }
          }
    }
}

