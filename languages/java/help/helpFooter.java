}

public static void installTooltip(String text, Node node, boolean isHelpOn){
    Tooltip tp = new Tooltip(text);
    tp.getStyleClass().add("tooltip");
    if(isHelpOn){
        Tooltip.install(node, tp);
    }else{
        Tooltip.uninstall(node, tp);
    }
}


private static void installToolTipForRegisteredModules(String text, Node module, boolean isHelpOn, String name ){
    if(module != null){
        installTooltip(text, module.lookup(name), isHelpOn);
    }
}

}
