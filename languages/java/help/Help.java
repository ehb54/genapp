package util;

import javafx.scene.Node;
import javafx.scene.Scene;
import javafx.scene.control.Tooltip;

public class Help {

    public static void setTooltips(Scene scene, boolean isHelpOn){
        installTooltip("__menu__",scene.lookup("#menu-button"), isHelpOn);
        installTooltip("__help__",scene.lookup("#help"), isHelpOn);
        