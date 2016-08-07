/*jslint white: true, plusplus: true*/
/* assumes: jquery > 1.11.0, jqtree >= 3.0.9, jquery-base64 */

ga.value = {};
ga.value.settings = {};

ga.value.checkFloatIntOK = function( tag, value ) {
    var t = $( tag );
    __~debug:values{   console.log( "Start check_float_int:  " );} 
    if ( isNaN( value[0] ) )
    {
	t.val( t.prop( "defaultValue" ) );
	__~debug:values{   console.log( "checkfloat: Tag -  " + tag + "; Value - " + value[0] + ":: false!!" );}
	return false;
	
    } else {
	if (t.data('type') == "float")
	{
	    if ( value[0] < parseFloat ( t.attr( "min" ) ) )
	    { 
		__~debug:values{   console.log( "checkfloat: Less than MIN - reducing " + value[0] + " to " + t.attr( "min" ));}
		value.splice(0, value.length)
		value.push( t.attr( "min" ) );
	    } else {
		if ( value[0] > parseFloat ( t.attr( "max" ) ) )
		{ 
		    __~debug:values{   console.log( "checkfloat: More than MAX - reducing " + value[0] + " to " + t.attr( "max" ));}
		    value.splice(0, value.length)
		    value.push( t.attr( "max" ) );
		} else {
		    $( tag + "_msg" ).html( "" );
		}
	    }
	}
	else
	{
	    if ( t.data('type') == "integer" )
	    {   
		if ( value[0] < parseInt ( t.attr( "min" ) ) )
		{ 
		    __~debug:values{   console.log( "checkint: Less than MIN - reducing " + value[0] + " to " + t.attr( "min" ));}
		    value.splice(0, value.length)
		    value.push( t.attr( "min" ) );
		} else {
		    if ( value[0] > parseInt ( t.attr( "max" ) ) )
		    { 
			__~debug:values{   console.log( "checkint: More than MAX - reducing " + value[0] + " to " + t.attr( "max" ));}
			value.splice(0, value.length)
			value.push( t.attr( "max" ) );
		    } else {
			if ( parseInt( value[0] ) != value[0])
			{			
			    __~debug:values{   console.log( "INTEGER: rounding " + value[0] + " to " +  parseInt( parseFloat( value[0] ) + .5 )); }
			    var temp_int = value[0]; 
			    value.splice(0, value.length);
			    value.push( parseInt( parseFloat( temp_int ) + .5 ) );
			} else {
			    $( tag + "_msg" ).html( "" );
			}
		    }
		}
	    }
	}
    }
    return true;
}


ga.value.processInputfromFiles = function (text, mode, ids_array, mod){
    var lines = text.trim().split(/[\r\n]+/g);
    var linesContent = [];
    var cumulativeContent = 0;

    ids_array = ga.repeat.map.convert( ids_array );

    for (var i=0; i<lines.length; i++)
    {
	var line_separated = lines[i].trim().split(/\s+/);
	cumulativeContent += line_separated.length;
	linesContent.push(cumulativeContent);
    }
    
    //var elements = text.trim().split(/\s+/);
    var elements = [];
    var contrastrepel = [];
    var dissolrepel = [];
    var unitrepel_1 = [];
    var unitrepel_2 = [];
    var repeat_hash = [];
    var lineNumberErr = 0;
    
    switch (mode)
    {
    case "whitespace_formulchcompost":
	var lines_formulchcontrast  = [];
	for (var i=0; i<lines.length; i++)
	{
	    var line_split = lines[i].split('#')[0];
	    
	    //line_split.trim();                            // simple trim does not work..
	    line_split = line_split.replace(/\s{2,}/g, ' ');
	    line_split = line_split.replace(/\t/g, ' ');
	    line_split = line_split.toString().trim().replace(/(\r\n|\n|\r)/g,"");
	    //console.log ("The line is: " + line_split);
	
	    lines_formulchcontrast.push(line_split);
	}
	var repeater_start_1 = parseInt(lines_formulchcontrast[1]);
	
	var item;
	for (var i=0; i < lines_formulchcontrast.length; i++)
	{
	    if ( (i > 2) && (i < 3 + repeater_start_1) )
	    {
		item = lines_formulchcontrast[i].trim().split(/\s+/);
		for (var k=0; k < item.length; k++)
		{		    
		    contrastrepel.push(item[k]);
		}
		continue;
	    }
	    //console.log ("Elements: " + lines_formulchcontrast[i]);
	    elements.push(lines_formulchcontrast[i]);
	}

	//console.log("Size of Contrast: " + contrastrepel.length);
	repeat_hash.push(contrastrepel); 
	for (var i=0; i < ids_array.length; i++) {
	    switch ( $("#" + ids_array[i]).attr("type") )
	    {
	    case "text":
		var reg = new RegExp($("#" + ids_array[i]).attr("pattern"));
		if ( !reg.test(elements[i]) )
		{
		    __~debug:values{ console.log( "Achtung!!! " +  elements[i]); }
		    messagebox( {
			icon : "warning.png",
			text : "Wrong format of the input file! Input value on the line #" + lineNumberErr + " is not a valid number. Options are: [Integer | Float point number | Number with exponent]. Check your input file",
			buttons : [
			    { id    : "ok",
			      label : "OK" } ]
		    });
		    return;
		}
		break;
	    case "number":
		var value = [elements[i]];
		//console.log( "Number: " +  elements[i]);
		if ( !( ga.value.checkFloatIntOK("#" + ids_array[i], value) ) )
		{
		    messagebox( {
			icon : "warning.png",
			text : "Wrong format of the input file! Input value on the line #" + lineNumberErr + " is not a valid number. Options are: [Integer | Float point number | Number with exponent]. Check your input file",
			buttons : [
			    { id    : "ok",
			      label : "OK" } ]
		    });
		    return;	
		}
		else
		{
		    elements[i] = value[0];
		    console.log( "Number is: " +  elements[i]);
		}
		break;	
	    default:
		messagebox( {
		    icon : "warning.png",
		    text : "Selected input type is currently not supported. Contact the developer",
		    buttons : [
			{ id    : "ok",
			  label : "OK" } ]
		});
		return;
		break;
	    }
	}
	break;	

    case "whitespace_formulchrg":
    case "whitespace_formulchcontrast":
    	var lines_formulchcontrast  = [];
	for (var i=0; i<lines.length; i++)
	{
	    var line_split = lines[i].split('#')[0];
	    
	    //line_split.trim();                            // simple trim does not work..
	    line_split = line_split.replace(/\s{2,}/g, ' ');
	    line_split = line_split.replace(/\t/g, ' ');
	    line_split = line_split.toString().trim().replace(/(\r\n|\n|\r)/g,"");
	    //console.log ("The line is: " + line_split);
	
	    lines_formulchcontrast.push(line_split);
	}
		
	var repeater_start_1 = parseInt(lines_formulchcontrast[1]);
	var repeater_start_2 = parseInt(lines_formulchcontrast[ 2 + repeater_start_1 ] );
	var repeater_start_3 = parseInt(lines_formulchcontrast[ 5 + repeater_start_1 + repeater_start_2 ]);
	var repeater_start_4 = parseInt(lines_formulchcontrast[ 9 + repeater_start_1 + repeater_start_2 + repeater_start_3]);

	var item;
	for (var i=0; i < lines_formulchcontrast.length; i++)
	{
	    if ( (i > 1) && (i < 2 + repeater_start_1) )
	    {
		item = lines_formulchcontrast[i].trim().split(/\s+/);
		for (var k=0; k < item.length; k++)
		{		    
		    contrastrepel.push(item[k]);
		}
		continue;
	    }
	    if ( (i > 2 + repeater_start_1) && (i < 3 + repeater_start_1 + repeater_start_2) ) 
	    {
		item = lines_formulchcontrast[i].trim().split(/\s+/);
		//for (var k=0; k < item.length; k++)
		//{		    
		//    dissolrepel.push(item[k]);
		//}
		dissolrepel.push(item[1]);
		dissolrepel.push(item[2]);
		dissolrepel.push(item[0]);
		dissolrepel.push(item[3]);
		continue;
	    }
	    if ( (i > 5 + repeater_start_1 + repeater_start_2) && (i < 6 + repeater_start_1 + repeater_start_2 + repeater_start_3) ) 
	    {
		item = lines_formulchcontrast[i].trim().split(/\s+/);
		//for (var k=0; k < item.length; k++)
		//{		    
		//    unitrepel_1.push(item[k]);
		//}
		unitrepel_1.push(item[1]);
		unitrepel_1.push(item[2]);
		unitrepel_1.push(item[0]);
		unitrepel_1.push(item[3]);
		continue;
	    }
	    if ( (i > 8 + repeater_start_1 + repeater_start_2 + repeater_start_3) && (i < 9 + repeater_start_1 + repeater_start_2 + repeater_start_3 + repeater_start_4) ) 
	    {
		item = lines_formulchcontrast[i].trim().split(/\s+/);
		//for (var k=0; k < item.length; k++)
		//{		    
		//    unitrepel_2.push(item[i]);
		//}
		unitrepel_2.push(item[1]);
		unitrepel_2.push(item[2]);
		unitrepel_2.push(item[0]);
		unitrepel_2.push(item[3]);
		continue;
	    }	    
	    //console.log ("Elements: " + lines_formulchcontrast[i]);
	    elements.push(lines_formulchcontrast[i]);
	}

	//console.log("Size of Contrast: " + contrastrepel.length);
	repeat_hash.push(contrastrepel);
	repeat_hash.push(dissolrepel);
	repeat_hash.push(unitrepel_1);
	repeat_hash.push(unitrepel_2);

	//for (var i=0; i < elements.length; i++) {
	for (var i=0; i < ids_array.length; i++) {
	    switch ( $("#" + ids_array[i]).attr("type") )
	    {
	    case "text":
		var reg = new RegExp($("#" + ids_array[i]).attr("pattern"));
		if ( !reg.test(elements[i]) )
		{
		    __~debug:values{ console.log( "Achtung!!! " +  elements[i]); }
		    messagebox( {
			icon : "warning.png",
			text : "Wrong format of the input file! Input value on the line #" + lineNumberErr + " is not a valid number. Options are: [Integer | Float point number | Number with exponent]. Check your input file",
			buttons : [
			    { id    : "ok",
			      label : "OK" } ]
		    });
		    return;
		}
		break;
	    case "number":
		var value = [elements[i]];
		//console.log( "Number: " +  elements[i]);
		if ( !( ga.value.checkFloatIntOK("#" + ids_array[i], value) ) )
		{
		    messagebox( {
			icon : "warning.png",
			text : "Wrong format of the input file! Input value on the line #" + lineNumberErr + " is not a valid number. Options are: [Integer | Float point number | Number with exponent]. Check your input file",
			buttons : [
			    { id    : "ok",
			      label : "OK" } ]
		    });
		    return;	
		}
		else
		{
		    elements[i] = value[0];
		    console.log( "Number is: " +  elements[i]);
		}
		break;	
	    default:
		messagebox( {
		    icon : "warning.png",
		    text : "Selected input type is currently not supported. Contact the developer",
		    buttons : [
			{ id    : "ok",
			  label : "OK" } ]
		});
		return;
		break;
	    }
	}
	break;
    case "whitespaceseparated":
    case "whitespaceseparated_reverselogic":

	elements = text.trim().split(/\s+/);
	__~debug:values{ console.log("Lengths of params and ids: " + elements.length + " " + ids_array.length); }
	__~debug:values{ console.log("Number of lines: " + lines.length + "  Last line: " + lines[lines.length-1]);}

	if (elements.length == ids_array.length)
	{
	    for (var i=0; i < elements.length; i++) {
		for (var j=0; j < linesContent.length; j++)
		{
		    if ( i+1 <= linesContent[j] ){
			lineNumberErr = j + 1;
			break;
		    }
		}
		
		__~debug:values{ console.log("Line # containing element " + i + " is: "  + lineNumberErr); }
		
		switch ( $("#" + ids_array[i]).attr("type") )
		{
		case "checkbox":
		    var options = "^(0|1|n|y|true|false|t|f|yes|no)$"; 
		    var reg = new RegExp(options);
		    if ( !reg.test(elements[i].toLowerCase()) )
		    {
			__~debug:values{ console.log( "Achtung!!! " +  elements[i]); }
			messagebox( {
			    icon : "warning.png",
			    text : "Wrong format of the input file! Checkbox input value on the line #" + lineNumberErr + " is not valid. Options are: [1 | 0 | yes | no | true | false | t | f | T | F | y | n | Y | N ]. Check your input file",
			    buttons : [
				{ id    : "ok",
				  label : "OK" } ]
			});
			return;
		    }
		    break;
		case "number":
		    var value = [elements[i]];
		    if ( !( ga.value.checkFloatIntOK("#" + ids_array[i], value) ) )
		    {
			messagebox( {
			    icon : "warning.png",
			    text : "Wrong format of the input file! Input value on the line #" + lineNumberErr + " is not a valid number. Options are: [Integer | Float point number | Number with exponent]. Check your input file",
			    buttons : [
				{ id    : "ok",
				  label : "OK" } ]
			});
			return;	
		    }
		    else
		    {
			elements[i] = value[0];
		    }
		    break;			    
		case "text":
		    var reg = new RegExp($("#" + ids_array[i]).attr("pattern"));
		    if ( !reg.test(elements[i]) )
		    {
			__~debug:values{ console.log( "Achtung!!! " +  elements[i]); }
			messagebox( {
			    icon : "warning.png",
			    text : "Wrong format of the input file! Input value on the line #" + lineNumberErr + " is not a valid number. Options are: [Integer | Float point number | Number with exponent]. Check your input file",
			    buttons : [
				{ id    : "ok",
				  label : "OK" } ]
			});
			return;
		    }
		    break;
		default:
		    messagebox( {
			icon : "warning.png",
			text : "Selected input type is currently not supported. Contact the developer",
			buttons : [
			    { id    : "ok",
			      label : "OK" } ]
		    });
		    return;
		    break;
		}
	    }
	}
	else
	{
	    messagebox( {
		icon : "warning.png",
		text : "Wrong format of the input file! Number of parameters is inconsistent with the model chosen. Check your parameter file",
		buttons : [
		    { id    : "ok",
		      label : "OK" } ]
	    });
	    return;
	}
	break;
    default:
	messagebox( {
	    icon : "warning.png",
	    text : "Selected file parsing mode is currently not supported. Contact the developer",
	    buttons : [
		{ id    : "ok",
		  label : "OK" } ]
	});
	return;
	break;
    }
    
    /// Filling the values form file /////////////////////////////////////////
    
    //console.log("NUMBER elements array: " + elements.length + "; #ids: " + ids_array.length);
    var repeater_counter=0;
    for (var i=0; i < elements.length; i++) {
	switch ( $("#" + ids_array[i]).attr("type") )
	{
	case "checkbox" :
	    if (mode.indexOf('reverselogic') >= 0)
	    {
		switch ( elements[i].toLowerCase() )
		{
		case "0":
		case "false":
		case "f":
		case "n":
		case "no":
		    $("#" + ids_array[i]).prop( "checked", true );
		    break;
		case "1":
		case "true":
		case "t":
		case "yes":
		case "y":
		case "r":
		    $("#" + ids_array[i]).prop( "checked", false ); 
		    break;
		}
	    }
	    else
	    {
		switch ( elements[i].toLowerCase() )
		{
		case "0":
		case "false":
		case "f":
		case "n":
		case "no":
		    $("#" + ids_array[i]).prop( "checked", false );
		    break;
		case "1":
		case "true":
		case "t":
		case "yes":
		case "y":
		case "r":
		    $("#" + ids_array[i]).prop( "checked", true ); 
		    break;		
		}
	    }
	    
	default:
	    //__~debug:values{ console.log(" pattern: " + $("#" + ids_array[i]).attr("pattern") ); }
	    $("#" + ids_array[i]).val(elements[i]);
	    $("#" + ids_array[i]).prop( "defaultValue", elements[i]);
	    break;
	}
	if ( $("#" + ids_array[i]).data("repeater") )
	{
	    ga.repeat.change(mod,ids_array[i]);
	    // get children
	    children = ga.repeat.children( mod, ids_array[i] );
	    var val = $("#" + ids_array[i]).val();
	    
	    var curr_repeat = 0;
	    var current_child_for_given_rep = 0;
	    for ( j = 1; j <= val; ++j)
	    {
		current_child_for_given_rep = 0;
		for ( t in children ) 
		{
		    var repeat_value = repeat_hash[repeater_counter][curr_repeat];
		    k = ids_array[i] + "-" + t + "-" + ( j - 1 );
		    ++current_child_for_given_rep;
		   
		    if ((mode == "whitespace_formulchrg" || mode == "whitespace_formulchcompost") && current_child_for_given_rep==1)
			continue;
		    if (mode == "whitespace_formulchcompost" && current_child_for_given_rep==2)
		    {
			//console.log("checkbox: " + repeat_value.toLowerCase());
			if (repeat_value.toLowerCase() == "r")
			    $("#" + k).prop( "checked", true );
			if (repeat_value.toLowerCase() == "f")
			    $("#" + k).prop( "checked", false );
			curr_repeat++;
		     	continue;
		    }
		    if (mode == "whitespace_formulchcompost" && current_child_for_given_rep==5)
		    {
			curr_repeat++;
		     	continue;
		    }
		    //console.log( "child's ids: " + k + "; Child's type: " +  $("#" + k).attr("type"));
		    //$("#" + k).val("Test Value");
		    $("#" + k).val(repeat_value);
		    curr_repeat++;
		}
	    }
	    ga.repeat.change(mod,ids_array[i]);
	    repeater_counter++;
	    //}
	    // break;
	}
    }
}


ga.value.input = {}

ga.value.setInputForRFile = function(module, tag, id, mode, ids) {
    ga.value.input[ module ]          = ga.value.input[ module ] || {};
    ga.value.input[ module ][id]      = {};
    ga.value.input[ module ][id].id   = id;
    ga.value.input[ module ][id].tag  = tag;
    ga.value.input[ module ][id].mode = mode;
    ga.value.input[ module ][id].ids  = ids;

}

ga.value.types = {}

ga.value.registerid = function(module, id, label, required) {
    ga.value.types[ module ]          = ga.value.types[ module ] || {};
    ga.value.types[ module ][id]      = {};
    ga.value.types[ module ][id].id   = id;
    ga.value.types[ module ][id].label = label;
    ga.value.types[ module ][id].req  = required || 0;
}


ga.value.setInputfromRFile = function(path, mode, ids, mod){ 
    var ids_array = ids.split(',');
    var username = $( '#_state' ).data('_logon');
    var actual_path = 'results/users/' + username + '/' + path;
    __~debug:values{console.log( "Path is: " + actual_path ); }
    __~debug:values{console.log ("Mode: " + mode ); }
    __~debug:values{console.log ("List_ids: " + ids ); }
    $.get(actual_path, function(text){
	
	ga.value.processInputfromFiles(text, mode, ids_array, mod);
	
    }, "text");
}


ga.value.setInputfromFile = function( tag, mode, ids, mod ) {
    $(tag).hide();
       
    var ids_array = ids.split(',');
    $(tag).change( function(e) {
	var file = $( tag )[0].files[0];
	__~debug:values{ console.log("tag: " + tag + " mode: " + mode + " ids: " + ids_array[0] + " file: " + file); }
	//console.log ("Module from setformfile: " + mod);
	var reader = new FileReader();
	
	reader.onload = function(evt) {
            var text = evt.target.result;
	    
	    ga.value.processInputfromFiles(text, mode, ids_array, mod);
	    
	}
	reader.readAsText(file);
    })
}
		

ga.value.setLastValue = function( pkg, tag, defval ) {
    var tl = pkg + ":" + tag + ":last_value";
    var dv = pkg + ":" + tag + ":default_value";
    var t = $( tag );
    var p2d;
    if ( !/_output$/.test( pkg ) ) {
        return false;
    }
__~debug:values{   console.log( "ga.value.setLastValue() pkg:" + pkg + " tag:" + tag + " type:" + t.attr( "type" ) + " tagName:" + t.prop( "tagName" ) + " value:" + t.val() );}
    if ( $( "#global_data" ).data( tl ) == undefined ) {
        switch( t.attr( "type" ) )
        {
            case "checkbox" :
            case "radio" :
                $( "#global_data" ).data( tl, t.is( ":checked") );
                $( "#global_data" ).data( dv, t.is( ":checked") ); break;
            case "div" : 
            case "msgs" : 
                $( "#global_data" ).data( tl, t.html() ); 
                $( "#global_data" ).data( dv, t.html() );
                break;
            case "plot2d" :
__~debug:values{ console.log( "ga.value.setLastValue() on undefined plot2d not yet: " + tl ); }
__~debug:plottwod{ console.log( "ga.value.setLastValue() on undefined plot2d not yet: " + tl ); }
                           break;
            case "filelink" :
            case "filelinkm" :
                $( "#global_data" ).data( tl, $( tag + "_filelink" ).html() );
__~debug:values{                console.log( "ga.value.setLastValue() done filelink on setLastValue" );}
                break;

            default : 
                      if ( defval )
                      {
__~debug:values{                console.log( "ga.value.setLastValue() default value set: " + defval );}
                         t.val( defval );
                      }                         
__~debug:values{            console.log( "ga.value.setLastValue() default attrib val: " + t.val() );}
                      $( "#global_data" ).data( tl, t.val() );
                      $( "#global_data" ).data( dv, t.val() );
                      break;
        }
    } else {
        switch( t.attr( "type" ) )
        {
            case "checkbox": 
            case "radio": 
                   t.prop( "checked", $( "#global_data" ).data( tl ) ); break;
            case "div" : 
            case "msgs" : t.html( $( "#global_data" ).data( tl ) ); break;
            case "atomicstructure" : 
                  var stag = tag.replace( /^#/, "" );
__~debug:values{                     console.log( "ga.value.setLastValue() atomic structure global tag " + stag + " data tag " + tl );}
                  if ( $( "#global_data" ).data( tl ) ) {
__~debug:values{        console.log( "ga.value.setLastValue() atomic structure global data found tag " + stag );}
                      _jmol_info[ stag ].script = $( "#global_data" ).data( tl );
__~debug:values{        console.log( "ga.value.setLastValue() atomic structure jmol script: " + _jmol_info[ stag ].script );}
                      t.html(Jmol.getAppletHtml( "jmolApplet" + stag,  _jmol_info[ stag ] ) );
__~debug:values{        console.log( "ga.value.setLastValue() atomic structure jmol getAppletHtml finished" );}
                  } else {
__~debug:values{        console.log( "ga.value.setLastValue() atomic structure global data NOT found for tag " + stag );}
                      t.html("");
                  }
                  break;

            case "plot2d" : 
__~debug:values{                     console.log( "ga.value.setLastValue() on plot2d trying" );}
__~debug:plottwod{                     console.log( "ga.value.setLastValue() plot2d" );}
                     p2d = gd.data( tl );
                     if ( p2d.data ) {
                         ga.value.set.plot2d( tag, p2d.options );
                         t.plot( p2d.data, ga.value.get.plot2d.plot_options( tag, p2d.options ) );
                     } else {
                         t.plot( p2d, ga.value.get.plot2d.plot_options( tag ) );
                     }
                     break;
            case "filelink" : 
            case "filelinkm" : 
                     $( tag + "_filelink" ).html( $( "#global_data" ).data( tl ) );
                     break;
            default: 
__~debug:values{    console.log( "ga.value.setLastValue() default tl " + tl + "  data(tl) " + $( "#global_data" ).data( tl ) );}
            
            t.val( $( "#global_data" ).data( tl ) );
            break;
        }
    }
}

ga.value.saveLastValue = function( pkg, tag ) {
   var t = $( tag );
__~debug:values{   console.log( "ga.value.saveLastValue() pkg:" + pkg + " tag:" + tag + " type:" + t.attr( "type" ) + " value:" + t.val() );}
   switch( t.attr( "type" ) )
   {
       case "file" : __~debug:values{ console.log( "ga.value.saveLastValue() file set is insecure, skipped" );} return; break;
       case "checkbox" :
       case "radio" :
                     $( "#global_data" ).data( pkg + ":" + tag + ":last_value", t.is( ":checked") ); break;
       case "div" :
       case "msgs" : $( "#global_data" ).data( pkg + ":" + tag + ":last_value", t.html() ); break;
       case "plot2d" : 
__~debug:values{ console.log( "ga.value.saveLastValue() on plot2d not yet" );  }
                       break;
       case "filelink" : 
       case "filelinkm" : 
                     $( "#global_data" ).data( pkg + ":" + tag + ":last_value", $( tag + "_filelink" ).html() ); 
                     break;
       case "atomicstructure" : 
                     var stag = tag.replace( /^#/, "" );
__~debug:values{ console.log( "ga.value.saveLastValue() saving atomic structure html from tag " + stag );  }
                     if ( _jmol_info && _jmol_info[ stag ] && _jmol_info[ stag ].length ) {
__~debug:values{ console.log( "ga.value.saveLastValue() atomic structure _jmol_info found for tag " + stag );}
                         $( "#global_data" ).data( pkg + ":" + tag + ":last_value", _jmol_info[ stag ].script ); 
                     } else {
__~debug:values{ console.log( "ga.value.saveLastValue() atomic structure _jmol_info NOT found for tag " + stag );}
                         $( "#global_data" ).data( pkg + ":" + tag + ":last_value", "" ); 
                     }
                     break;
       default: $( "#global_data" ).data( pkg + ":" + tag + ":last_value", t.val() ); break;
   }
__~debug:values{   console.log( "ga.value.saveLastValue() t is " + pkg + ":" + tag + ":last_value" );}
__~debug:values{   console.log( "ga.value.saveLastValue() " + $( "#global_data" ).data( pkg + ":" + tag + ":last_value" ) );}
}

ga.value.saveLastValues = function( pkg ) {
__~debug:values{   console.log( "ga.value.saveLastValues( " + pkg + " )" );}
   $( "#" + pkg + " :input" ).each(function() {
__~debug:values{   console.log( "ga.value.saveLastValues( " + pkg + " ) for " + $( this ).attr( "id" ) );}
      ga.value.saveLastValue( pkg, "#" + $( this ).attr( "id" ) );
   });
}

ga.value.resetDefaultValue = function( pkg, tag ) {
__~debug:values{   console.log( "ga.value.resetDefaultValue( " + pkg + " , " + tag + " )" );}
   var t = $( tag );
__~debug:values{   console.log( "ga.value.resetDefaultValue() type:" + t.attr( "type" ) );}
__~debug:values{   console.log( "ga.value.resetDefaultValue() tagname:" + t.prop( "tagName" ) );}
   if(  t.prop( "tagName" ) == 'SELECT' ) {
    t.val( $( "#global_data" ).data( pkg + ":" + tag + ":default_value" ) );
   } else {
      switch( t.attr( "type" ) )
      {
          case "file" : __~debug:values{console.log( "ga.value.resetDefaultValue() file set is insecure, skipped" );} return; break;
          case "checkbox" : 
                        $( "#global_data" ).removeData( pkg + ":" + tag + ":repeat:count" );
__~debug:values{                         console.log( "ga.value.resetDefaultValue() removeData: " + pkg + ":" + tag + ":repeat:count" );}
          case "radio" : 
                        t.prop( "checked", $( "#global_data" ).data( pkg + ":" + tag + ":default_value" ) ); break;
          case "div" :
          case "msgs" : t.html( $( "#global_data" ).data( pkg + ":" + tag + ":default_value" ) ); 
                        break;
          case "filelink" :
          case "filelinkm" :
                        $( tag + "_filelink" ).html( " " );
                        break;
          case "plot2d" : 
__~debug:plottwod{                     console.log( "ga.value.resetDefaultValue() plot2d" );}
                        $( "#global_data" ).data( pkg + ":" + tag + ":last_value", [[]] );
                        ga.value.clear.plot2d( tag );
                        t.plot( [[]], ga.value.get.plot2d.plot_options( tag ) ); break;
                        break;
          case "image" : 
          __~debug:image{console.log( "reset default value for image" );}
          t.html("");
          break;
          case "video" : 
          __~debug:video{console.log( "reset default value for video" );}
          t.html("");
          break;

          case "atomicstructure" : 
                        var stag = tag.replace( /^#/, "" );
__~debug:values{                         console.log( "ga.value.resetDefaultValue() atomic structure " + pkg + ":" + tag + ":last_value" );}
                        $( "#global_data" ).data( pkg + ":" + tag + ":last_value", "" );
                        $( tag ).html("");
                        break;
          default: t.val( t.attr( "value" ) ); break;
      }
   }
   ga.value.saveLastValue( pkg, tag );
   $( tag + "_msg" ).html("");
}

ga.value.resetDefaultValues = function( pkg, msgs ) {
__~debug:values{   console.log( "ga.value.resetDefautValues( " + pkg + " )" );}
    var i,
    hmod_textarea;
    if ( !/_output$/.test( pkg ) ) {
        return false;
    }

    $( "#" + pkg + " :input" ).each(function() {
        ga.value.resetDefaultValue( pkg, "#" + $( this ).attr( "id" ) );
    });
    ga.sync.reset( pkg );
    for ( i in ga.value.extra_resets.data ) 
    {
        __~debug:values{     console.log( "ga.value.resetDefaultValues() extra_resets " + i );}
        ga.value.resetDefaultValue( pkg, "#" + i );
    }
    if ( msgs ) {
        ga.value.resetDefaultValue( pkg, "#" + pkg + "_msgs" );
        hmod_textarea = "#" + pkg + "_textarea";
        ga.value.resetDefaultValue( pkg, hmod_textarea );
        $( hmod_textarea ).hide();
        $( hmod_textarea + "_label" ).hide();
    }
}

ga.value.extra_resets = function( id ) {
__~debug:values{     console.log( "ga.value.extra_resets( " + id + " )" );}
    ga.value.extra_resets.data = ga.value.extra_resets.data || {};
    ga.value.extra_resets.data[ id ] = 1;
}

ga.value.extra_resets.clear = function() {
__~debug:values{     console.log( "ga.value.extra_resets.clear()" );}
    ga.value.extra_resets.data = {};
}
    

ga.value.setLastValueOutput = function( mod ) {
__~debug:values{     console.log( "ga.value.setLastValueOutput( " + mod + " )" );}
    var hmod            = "#" + mod,
        hmod_textarea   = hmod + "_textarea",
        jqhmod_textarea = $( hmod_textarea );

    ga.value.setLastValue( mod, hmod + "_msgs" );
    ga.value.setLastValue( mod, hmod_textarea );
    if ( jqhmod_textarea.val() ) {
__~debug:values{     console.log( "ga.value.setLastValueOutput() show textarea" );}
        jqhmod_textarea.show();
        $( hmod_textarea + "_label" ).show(); 
        jqhmod_textarea.height( parseFloat( jqhmod_textarea.prop( 'scrollHeight' ) ) + 
                                parseFloat( jqhmod_textarea.css ( 'borderTopWidth' ) ) + 
                                parseFloat( jqhmod_textarea.css ( 'borderBottomWidth' ) ) );
    } else {
__~debug:values{     console.log( "ga.value.setLastValueOutput() hide textarea" );}
        jqhmod_textarea.hide();
        $( hmod_textarea + "_label" ).hide();
    }
}
    
ga.value.get = {};
ga.value.set = {};
ga.value.clear = {};

ga.value.set.plot2d = function( tag, options ) {
__~debug:plottwod{ console.log( "ga.value.set.plot2d( " + tag + " , " + options + " )" );}
    var tagtitle  = tag + "_title",
        tagxlabel = tag + "_xlabel",
        tagylabel = tag + "_ylabel";

__~debug:plottwod{ console.log( "ga.value.set.plot2d() title  is " + options.title );}
__~debug:plottwod{ console.log( "ga.value.set.plot2d() xlabel is " + options.xlabel );}
__~debug:plottwod{ console.log( "ga.value.set.plot2d() ylabel is " + options.ylabel );}

    $( tagtitle  ).html( options.title  ? options.title  : "");
    $( tagxlabel ).html( options.xlabel ? options.xlabel : "");
    $( tagylabel ).html( options.ylabel ? options.ylabel : "");
}

ga.value.clear.plot2d = function( tag ) {
__~debug:plottwod{ console.log( "ga.value.clear.plot2d( " + tag + " )" );}
    var tagtitle  = tag + "_title",
        tagxlabel = tag + "_xlabel",
        tagylabel = tag + "_ylabel";
        tagxy     = tag + "_xy";

    $( tagtitle  ).html("");
    $( tagxlabel ).html("");
    $( tagylabel ).html("");
    $( tagxy     ).html("");
}


ga.value.set.plot2d.pan = function( tag, value ) {
__~debug:plottwod{ console.log( "ga.value.set.plot2d.pan( " + tag + " , " + value + " )" );}
    ga.value.settings[ tag ] = ga.value.settings[ tag ] || {};
    ga.value.settings[ tag ].pan = value ? true : false;
}

ga.value.set.plot2d.zoom = function( tag, value, pkg ) {
__~debug:plottwod{ console.log( "ga.value.set.plot2d.zoom( " + tag + " , " + value + " )" );}
    var tagtitle  = tag + "_title",
        tagxlabel = tag + "_xlabel",
        tagylabel = tag + "_ylabel";
        tagxy     = tag + "_xy";

    ga.value.settings[ tag ] = ga.value.settings[ tag ] || {};
    ga.value.settings[ tag ].zoom = value ? true : false;
    if ( value ) {
       ga.value.settings[ tag ].pkg = pkg;

       $( tag + "_title," + tag + "_xlabel," + tag + "_ylabel," + tag + "_xy" )
            .on("click", ga.value.set.plot2d.zoom.click );
    }
}

ga.value.set.plot2d.pkg = function( pkg, tag ) {
__~debug:plottwod{ console.log( "ga.value.set.plot2d.pkg( " + pkg + " , " + tag + " )" );}

    ga.value.settings[ tag ] = ga.value.settings[ tag ] || {};
    ga.value.settings[ tag ].pkg = pkg;
    $( tag + "_title," + tag + "_xlabel," + tag + "_ylabel," + tag + "_xy" )
        .on("click", ga.value.set.plot2d.reset );
}

ga.value.set.plot2d.reset = function( event ) {
    var id = "#" + event.target.id.replace( /(_title|_xlabel|_ylabel|_xy)$/, "" );
    event.preventDefault();
__~debug:plottwod{ console.log( "ga.value.set.plot2d.reset() pkg " + ga.value.settings[ id ].pkg + " id " + id );}
    ga.value.setLastValue( ga.value.settings[ id ].pkg, id );
}

ga.value.set.plot2d.hover = function( tag, value ) {
__~debug:plottwod{ console.log( "ga.value.set.plot2d.hover( " + tag + " , " + value + " )" );}
    ga.value.settings[ tag ] = ga.value.settings[ tag ] || {};
    ga.value.settings[ tag ].hover = value ? true : false;
}

ga.value.get.plot2d = {};
ga.value.get.plot2d.plot_options = function( tag, options ) {
__~debug:plottwod{ console.log( "ga.value.get.plot2d.plot_options( " + tag + " )" );}

    var plot_options = ga.plot_options();

    plot_options.pan.interactive  = ga.value.settings[ tag ].pan   ? true : false;
    plot_options.zoom.interactive = ga.value.settings[ tag ].zoom  ? true : false;
    plot_options.grid.hoverable   = ga.value.settings[ tag ].hover ? true : false;

    if ( options ) {
        if ( options.legend ) {
            plot_options.legend           = options.legend;
            __~debug:plottwod{console.log( "ga.value.get.plot2d.plot_options( " + tag + " , options ) has legend" );}
            if ( options.legend.container ) {
                plot_options.legend.container = $( tag + "_legend" );
            }
        }
        if ( options.xmin ) {
            plot_options.xaxis.min        = options.xmin;
        }
        if ( options.xmax ) {
            plot_options.xaxis.max        = options.xmax;
        }
        if ( options.xscale ) {
            switch ( options.xscale ) {
                case "log" :
                plot_options.xaxis.transform        = function(v) { return v > 0 ? Math.log( v ) : 1e-99; };
                plot_options.xaxis.inverseTransform = function(v) { return Math.exp( v ); };
                plot_options.xaxis.tickFormatter    = ga.value.plot2d.ticformatter;
                break;
                default : 
                console.log( "ga.value.get.plot2d.plot_options( " + tag + " , options ) has unsupported xscale of " + options.xscale );
                break;
            }
        }
        if ( options.xtics ) {
            plot_options.xaxis.ticks = options.xtics;
        }
        if ( options.ymin ) {
            plot_options.yaxis.min        = options.ymin;
            __~debug:plottwod{console.log( "ga.value.get.plot2d.plot_options( " + tag + " , options ) has ymin of " + options.ymin );}
        }
        if ( options.ymax ) {
            plot_options.yaxis.max        = options.ymax;
            __~debug:plottwod{console.log( "ga.value.get.plot2d.plot_options( " + tag + " , options ) has ymax of " + options.ymax );}
        }
        if ( options.yscale ) {
            switch ( options.yscale ) {
                case "log" :
                plot_options.yaxis.transform        = function(v) { return v > 0 ? Math.log( v ) : 1e-99; };
                plot_options.yaxis.inverseTransform = function(v) { return Math.exp( v ); };
                plot_options.yaxis.tickFormatter    = ga.value.plot2d.ticformatter;
                break;
                default : 
                console.log( "ga.value.get.plot2d.plot_options( " + tag + " , options ) has unsupported yscale of " + options.yscale );
                break;
            }
        }
        if ( options.ytics ) {
            plot_options.yaxis.ticks = options.ytics;
        }
    }

    return plot_options;
}
        
ga.value.plot2d = {};
ga.value.plot2d.toFP = function( val, dec ) {
    if ( dec > 0 ) {
__~debug:fp{    console.log( "FP val " + val + " dec " + dec + " tofixed " + val.toFixed( dec ) );}
        return val.toFixed( dec );
    }
    if ( val.toString().length > 6 ) {
__~debug:fp{    console.log( "FP val " + val + " dec " + dec + " toPrecision " + val.toExponential( 3 ) );}
        return val.toExponential( 3 ).replace( /0+e/, 'e' ).replace( /\.e/, 'e' );
    }
__~debug:fp{    console.log( "FP val " + val + " dec " + dec + " toFixed dropout " + val.toFixed( 0 ) );}
    return val.toFixed( 0 );
}

ga.value.plot2d.ticformatter = function formatter(val, axis) {
    var tval;
    if ( !axis._ehb || val <= axis.min ) {
__~debug:plottics{        console.log( "ticformatter initialized val " + val + " min " + axis.min + " max " + axis.max);}
        axis._ehb       = {};
        axis._ehb.pv    = val;
        axis._ehb.min   = Math.min( axis.min, axis.max );
        axis._ehb.max   = Math.max( axis.min, axis.max );
        axis._ehb.tmin  = axis.options.transform( axis._ehb.min );
        axis._ehb.tmax  = axis.options.transform( axis._ehb.max );
        axis._ehb.tmaxr = 1 / axis._ehb.tmax;
        axis._ehb.rnge  = axis._ehb.max - axis._ehb.min;
        return ga.value.plot2d.toFP( val, axis.tickDecimals );
    }

//    if ( val >= axis.max ) {
//        return ga.value.plot2d.toFP( val, axis.tickDecimals );
//    }

    if ( !axis._ehb.snd ) {
        axis._ehb.snd = true;
        axis._ehb.sndv = val;
        axis._ehb.ptd = ( axis.options.transform( val ) - axis._ehb.tmin ) * axis._ehb.tmaxr;
__~debug:plottics{        console.log( "ticformatter snd plotted" );}
        return ga.value.plot2d.toFP( val, axis.tickDecimals );
    }

    if ( !axis._ehb.tr ) {
        axis._ehb.tr  = 2 * Math.abs( (val - axis._ehb.sndv ) ) / axis._ehb.rnge;
        axis._ehb.ptd = Math.abs( axis.options.transform( val ) - axis._ehb.tmin ) * axis._ehb.tmaxr;
__~debug:plottics{        console.log( "ticformatter tr set tr " + axis._ehb.tr + " ptd " + axis._ehb.ptd );}
        return ga.value.plot2d.toFP( val, axis.tickDecimals );
    }

    tval = ( axis.options.transform( val ) - axis._ehb.tmin ) * axis._ehb.tmaxr;

__~debug:plotticsx{    var tmp = Math.min( Math.abs( tval - axis._ehb.ptd ), 1 - tval );}

    if ( Math.min( Math.abs( tval - axis._ehb.ptd ), 1 - tval ) >= axis._ehb.tr )
    {
__~debug:plottics{    console.log( "tr " + axis._ehb.tr + " tval " + tval + " ptd " + axis._ehb.ptd + " tmp " + tmp + " plotted diff " + Math.min( Math.abs( tval - axis._ehb.ptd ), 1 - tval ) );}
        axis._ehb.ptd = tval;
        return ga.value.plot2d.toFP( val, axis.tickDecimals );
    }

__~debug:plotticsx{    console.log( "tr " + axis._ehb.tr + " tval " + tval + " ptd " + axis._ehb.ptd + " tmp " + tmp + " skipped" );}

    return "";
};
