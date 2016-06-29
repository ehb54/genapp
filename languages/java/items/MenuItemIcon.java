package items;

import javafx.event.EventHandler;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.input.MouseEvent;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.StackPane;
import javafx.scene.paint.Color;
import javafx.scene.shape.Rectangle;

public class MenuItemIcon extends HBox implements EventHandler<MouseEvent>{
    private Rectangle icon,line1,line2,line3;
    public MenuItemIcon(){
        StackPane stack = new StackPane();
        icon = new Rectangle(30,24);
        icon.setFill(Color.TRANSPARENT);

        line1 = new Rectangle(30, 3);
        line1.setFill(Color.rgb(__text_color_rgb__));
        line1.setArcHeight(6);
        line1.setArcWidth(6);
        
        line2 = new Rectangle(30, 3);
        line2.setFill(Color.rgb(__text_color_rgb__));
        line2.setArcHeight(6);
        line2.setArcWidth(6);
        
        line3 = new Rectangle(30, 3);
        line3.setFill(Color.rgb(__text_color_rgb__));
        line3.setArcHeight(6);
        line3.setArcWidth(6);
        icon.setOnMouseEntered(this);
        icon.setOnMouseExited(this);
        line1.setOnMouseEntered(this);
        line1.setOnMouseExited(this);
        line2.setOnMouseEntered(this);
        line2.setOnMouseExited(this);
        line3.setOnMouseEntered(this);
        line3.setOnMouseExited(this);

        
        stack.getChildren().addAll(icon,line1, line2, line3);
        stack.setAlignment(Pos.CENTER_LEFT);
        StackPane.setMargin(line2, new Insets(18, 0, 0, 0));
        StackPane.setMargin(line3, new Insets(-18, 0, 0, 0));
        this.getChildren().add(stack);
        HBox.setHgrow(stack, Priority.ALWAYS);
    }
    
    @Override
    public void handle(MouseEvent event) {
        if(event.getEventType() == MouseEvent.MOUSE_ENTERED){
            line1.setFill(Color.rgb(__select_color_rgb__));
            line2.setFill(Color.rgb(__select_color_rgb__));
            line3.setFill(Color.rgb(__select_color_rgb__));
        }else if(event.getEventType() == MouseEvent.MOUSE_EXITED){
                line1.setFill(Color.rgb(__text_color_rgb__));
                line2.setFill(Color.rgb(__text_color_rgb__));
                line3.setFill(Color.rgb(__text_color_rgb__));
        }
        
    }
}