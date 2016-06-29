package airavata;

import java.util.ArrayList;
import java.util.List;

public class ModulesUtils {

    public static String getExecutablePath(){
        return "__executable_path:java__";
    }
    
    public static List<String> getModulesNames(){
        List<String> modules = new ArrayList<String>();
