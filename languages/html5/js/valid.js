/*jslint white: true, plusplus: true*/
/* assumes: jquery > 1.11.0, jqtree >= 3.0.9, jquery-base64 */

ga.valid = {};

ga.valid.checkMatch = function( tag1, tag2 ) {
__~debug:check{   console.log( "checkMatch " + tag1 + " " + tag2 );}
   if ( $( tag1 ).val() != $( tag2 ).val() )
   {
      $( tag1 + "_msg" ).html( " does not match" );
   } else {
      $( tag1 + "_msg" ).html( "" );
   }
}
    

ga.valid.checkText = function( tag ) {
    var t = $( tag );
    var fieldValue=t.val();
    var ok = 0;
    var pattern = t.attr("pattern");
    var reg = new RegExp(pattern);
    
    
    if (pattern) {
	//console.log("It has pattern: " + pattern);
	
	if ( !reg.test(fieldValue) )
	{
	    //t.val( t.prop( "defaultValue" ) );
	    $( tag + "_msg" ).html(' wrong format');
	}
	else {
	    ok = 1;
	    $( tag + "_msg" ).html("");
	}
    }	
    else {
	//console.log("No pattern!");
	if (!fieldValue) {
	    $( tag + "_msg" ).html(' missing required field');
	}
	else {
	    ok = 1;
	}
    }
    return ok; 
}


ga.valid.checkFloat = function( tag ) {
    __~debug:check{   console.log( "checkfloat " + tag );}
    var t = $( tag );
    var fieldValue=t.val();
    var ok = 0;
    //if ( isNaN( fieldValue ) )
    if ( !fieldValue.match( /^[+-]?\d+(\.\d+)?$/ ) )
    {
	// t.val( t.prop( "defaultValue" ) );                                
	//$( tag + "_msg" ).html( " not a valid floating point number, reset to default" );
	$( tag + "_msg" ).html( " wrong format" );
    } else {
	ok = 1;
        if ( fieldValue < parseFloat ( t.attr( "min" ) ) )
	{ 
            t.val( t.attr( "min" ) );
            $( tag + "_msg" ).html( " value set to minimum allowed" );
	} else {
            if ( fieldValue > parseFloat ( t.attr( "max" ) ) )
            { 
		t.val( t.attr( "max" ) );
		$( tag + "_msg" ).html( " value set to maximum allowed" );
            } else {                                                             
		$( tag + "_msg" ).html( "" );
	    }
	} 
    }
    return ok; 
}

ga.valid.checkInt = function( tag ) {
    __~debug:check{   console.log( "checkint " + tag );}
    var t = $( tag );
    var fieldValue=t.val();
    var ok = 0;

    //if ( isNaN( fieldValue ) )
    if ( !fieldValue.match( /^[+-]?\d+$/ ) )    
    {
	//t.val( t.prop( "defaultValue" ) );
	//$( tag + "_msg" ).html( " not a valid number, reset to default" );
	$( tag + "_msg" ).html( " wrong format" );
    } else {
	ok = 1;
	if ( fieldValue < parseInt ( t.attr( "min" ) ) )
	{ 
            t.val( t.attr( "min" ) );
            $( tag + "_msg" ).html( " value set to minimum allowed" );
	} else {
            if ( fieldValue > parseInt ( t.attr( "max" ) ) )
            { 
		t.val( t.attr( "max" ) );
		$( tag + "_msg" ).html( " value set to maximum allowed" );
            } else {
		if ( parseInt( fieldValue ) != fieldValue )
		{   
                    $( tag + "_msg" ).html( " value rounded to nearset integer" );
                    t.val( parseInt( parseFloat( fieldValue ) + .5 ) );
		} else {
                    $( tag + "_msg" ).html( "" );
		}
            }
	}
    }
    return ok;
}

ga.valid.safeFile = function( tag ) {
   var t = $( tag );
   var fieldValue=t.val();
   if ( !fieldValue.match( "^[a-zA-Z0-9]+([a-zA-Z0-9_\.\-]+|\/[a-zA-Z0-9_\-])+$" ) )
   {
       t.val( t.prop( "defaultValue" ) );
       $( tag + "_msg" ).html( "Not an acceptable filename, reset to default" );
   } else {
       $( tag + "_msg" ).html( "" );
   }
}

ga.valid.checkLrfile = function( tag ) {
__~debug:valid{   console.log( "ga.valid.checkLRfile( " + tag + " )");}
   var t   = $( tag ),
       r   = $( tag + '_altval > i' ),
       msg = $( tag + "_msg" ),
       ok  = 0;
   if ( !t || !t.is(':visible') ) {
       return 1;
   }
   if ( t && t.val() && t.val().length ) {
__~debug:valid{       msg.html( "checkLRfile ok local file:" + t.val() );}
       ok = 1;
   } else {
       if ( r && r.html() && r.html().length && r.html() === "Server" ) {
__~debug:valid{       msg.html( "checkLRfile ok server file:" + r.html() );}
           ok = 1;
       }
   }
   if ( !ok ) {
       msg.html( " missing required field" );
   }
   return ok;
}

ga.valid.checkRpath = function( tag ) {
__~debug:valid{   console.log( "ga.valid.checkRfile( " + tag + " )");}
   var t   = $( tag ),
       r   = $( tag + '_altval > i' ),
       msg = $( tag + "_msg" ),
       ok  = 0;

   if ( !t || !t.is(':visible') ) {
       return 1;
   }
   if ( r && r.html() && r.html().length && r.html() === "Server" ) {
__~debug:valid{       msg.html( "checkRfile ok server file:" + r.html() );}
       ok = 1;
   }
   if ( !ok ) {
       msg.html( " missing required field" );
   }

   return ok;
}

ga.valid.checkRfile = function( tag ) {
__~debug:valid{   console.log( "ga.valid.checkRfile( " + tag + " )");}
   var t   = $( tag ),
       r   = $( tag + '_altval > i' ),
       msg = $( tag + "_msg" ),
       ok  = 0;

   if ( !t || !t.is(':visible') ) {
       return 1;
   }
   if ( r && r.html() && r.html().length && r.html() === "Server" ) {
__~debug:valid{       msg.html( "checkRfile ok server file:" + r.html() );}
       ok = 1;
   }
   if ( !ok ) {
       msg.html( " missing required field" );
   }

   return ok;
}

ga.valid.checksubmit = function( module ) {
   var i,
       ok = 1;
__~debug:valid{   console.log( "ga.valid.checksubmit( " + module + " )" );}
   if ( !ga.altfile.bdata[ module ] && !ga.value.types[ module ]) {
      return 1;
   }

   for ( i in ga.altfile.bdata[ module ] ) {
      if ( ga.altfile.bdata[ module ][ i ].req  ) {
	  //console.log( "ga.altfile.bdata[ module ][ i ].req = " +  ga.altfile.bdata[ module ][ i ].req);
          switch ( ga.altfile.bdata[ module ][ i ].req ) {
              case "lrfile" : ok = ok && ga.valid.checkLrfile( "#" + i ); if ($("#" + i).length && !ga.valid.checkLrfile( "#" + i )) {++ga.fielderrors;} break;
              case "rpath"  : ok = ok && ga.valid.checkRpath ( "#" + i ); if ($("#" + i).length && !ga.valid.checkRpath ( "#" + i )) {++ga.fielderrors;} break;
              case "rfile"  : ok = ok && ga.valid.checkRfile ( "#" + i ); if ($("#" + i).length && !ga.valid.checkRfile ( "#" + i )) {++ga.fielderrors;} break;
              default       : console.log( "ga.valid.checksubmit() unsupported required check " +  ga.altfile.bdata[ module ][ i ].req ); break;
          }
      }
   }
    
    for ( i in ga.value.types[ module ] ) {
	if ( ga.value.types[ module ][ i ].req  ) {
	    //console.log( "ga.value.types[ module ][ i ].req = " +  ga.value.types[ module ][ i ].req);
            switch ( ga.value.types[ module ][ i ].req ) {
	    case "float": 
		if ($("#" + i).length && !ga.valid.checkFloat( "#" + i )) {++ga.fielderrors;}
		break;
	    case "integer": 
		if ($("#" + i).length && !ga.valid.checkInt( "#" + i )) {++ga.fielderrors;}
		break;
	    case "text": 
		if ($("#" + i).length && !ga.valid.checkText( "#" + i )) {++ga.fielderrors;}
		//console.log( "pattern of " + i + ": " + $('#'+i).attr("pattern") );
		//console.log( "text_req Check: " +  ga.valid.checkText( "#" + i ));
		break;	
	    case "file": 
		if ($("#" + i).length && !ga.valid.checkLrfile( "#" + i )) {++ga.fielderrors;}
		break;
	    default: 
		console.log( "ga.valid.checksubmit() unsupported required check " +  ga.value.types[ module ][ i ].req ); break;
		
	    }
	}
    }
    
    if (ga.fielderrors > 0)
    {
   	ok = 0;
    }
    
    //console.log( "ga.fielderrors = " + ga.fielderrors );     
    return ok;
}

ga.valid.showerrormessage = function() {
    messagebox( {
	icon : "warning.png",
	text : "" + ga.fielderrors + " fields are missing or not set correctly!",
	buttons : [
	    { id    : "ok",
	      label : "OK" } ]
    });
    ga.fielderrors = 0;
}

ga.valid.clearerrorcounter = function() {
    ga.fielderrors = 0;
}


ga.airavata = {};
ga.airavata.select = function( defaultresource, select, cb, form ) {
    var a            = ga.airavata.data
        ,msg         = ""
        ,button_info = []
        ,i
        ,key
        ,selecttype
        ,index
    ;
    
    __~debug:airavata{console.log( "ga.airavata.select( " + defaultresource + " , " + select + " )" );}

    if ( ( defaultresource == "__resource__" && !a.defaultresource ) ||
         ( defaultresource != "airavata" && defaultresource != "__resource__" ) ) {
        __~debug:airavata{console.log( "not an airavata resource request" );}
        return "notused";
    }

    if ( !a.resources || !a.resources.length ) {
        messagebox( {
            icon  : "warning.png"
            ,text  : "No resources currently enabled for Airavata submission"
        });
        return "abort";
    }

    if ( a.resources.length == 1 ) {
        __~debug:airavata{console.log( "one resource, returning it" );}
        return Object.keys( a.resources[ index ] )[0];
    }

    selecttype = select != "__airavataselect__" ? select : ( a.select.length ? a.select : "random" );
    __~debug:airavata{console.log( "select type is " + selecttype );}

    switch( selecttype ) {
        case "random" : 
        {
            index = Math.floor( a.resources.length * Math.random() );
            __~debug:airavata{console.log( "random resource " + index )};
            return Object.keys( a.resources[ index ] )[0];
        }
        break;
        case "choose" : 
        {
            button_info.push( {
                id : "submit_module"
                ,label : "Submit"
                ,data  : [ cb, form, a.resources ]
                ,cb    : function( data ) { 
                    __~debug:airavata{console.log( "ga.airavata.select() cb called" );}
                    __~debug:airavata{console.log( Object.keys( data[2][$( "#airavata input[name=selectresource]:checked" ).val() ] )[0] );}
                    data[0]( data[1], Object.keys( data[2][$( "#airavata input[name=selectresource]:checked" ).val() ] )[0] );
                }
            } );
            msg = '<h3>Select a resource compute resource and press submit</h3><form id="airavata"><table>';
            for ( i in a.resources ) {
                for ( key in a.resources[i] ) {
                    msg += '<tr><td><input type="radio" name="selectresource" id="airavata_' + i + '" value="' + i + '"' + ( i==0 ? 'checked="checked"' : '' ) + '></td><td class="hoverhighlight" style="text-align:left"><label for="airavata_' + i + '">' +  a.resources[i][key] + '</label></td></tr>';
                }
            }
            msg += '</table>';

            messagebox( {
                icon     : "question.png"
                ,text    : msg
                ,buttons : button_info
            });
            return "deferred";
        }
        break;
        default :
        {
            messagebox( {
                icon  : "toast.png"
                ,text  : "ga.airavata.select, unknown selectoin type '" + selecttype + "'"
            });
            return "abort";
        }
    }
}

        
    
        
