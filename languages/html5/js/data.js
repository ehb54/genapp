/*jslint white: true, plusplus: true*/
/* assumes: jquery > 1.11.0, jqtree >= 3.0.9, jquery-base64 */

ga.data = {};
ga.data.nofcrefresh = {};

// apply the data to the screen output, return an object with job_status


function dataURLtoFile(dataurl, filename) {
    var arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1],
        bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
    while(n--){
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, {type:mime});
}

function create_image_htmltocanvas(k) {
    if ( $( "#" + k  + "_savetofile" ).length )
    {
	var a = document.getElementById(k + "_savetofile");
	
	var combined = $("#" + k + "_div");
	//html2canvas( match.get(0), {
	html2canvas( combined.get(0), {
	    background: "#ffffff",
	    //width     : 600,
	    onrendered: function (canvas) {
		image = canvas.toDataURL("image/png").replace("image/png", "image/octet-stream"); 
		//console.log("tag: " + htag + "_savetofile" + "  Image: " + image);
		//file = dataURLtoFile(image, 'plot.png');
		//a.href = URL.createObjectURL(file);
		a.href = image;
		$("#" + k  + "_savetofile").removeClass( "hidden" );
	    }
	});
    }
}

function create_image(k, plot) {
    if ( $( "#" + k  + "_savetofile" ).length )
    {
	var a = document.getElementById(k + "_savetofile");
	
	var canvas = plot.getCanvas();
	//canvas_merged = replotChartAsCanvas(match, v.data, ga.value.get.plot2d.plot_options( htag, v.options ));
	var image = canvas.toDataURL("image/png").replace("image/png", "image/octet-stream"); 
	var file = dataURLtoFile(image, 'plot.png');
	a.href = URL.createObjectURL(file);
	$("#" + k  + "_savetofile").removeClass( "hidden" );
    }
}

ga.data.update = function( mod, data, msging_f, msg_id ) {
    var output_msgs_cleared = 0,
        appended            = 0,
        state_changed       = 0,
        do_close            = 0,
        do_close2           = 0,
        mod_out             = mod + "_output",
        hmod_out            = "#" + mod_out,
        jqmod_out           = $( hmod_out ),
        retobj              = {},
        hmod_out_msgs       = hmod_out + "_" + "msgs",
        jqhmod_out_msgs     = $( hmod_out_msgs ),
        htag,
        jqhtag,
        savekey,
        tlink,
        thtml,
        t,
        jsmolfile,
        match;

__~debug:data{    console.log( "ga.data.update( " + mod + " , " + data + " )" );}
__~debug:data{    console.log( "ga.data.update() hmod_out_msgs " + hmod_out_msgs );} 
__~debug:getinput{    console.log( "ga.data.update() hmod_out_msgs " + hmod_out_msgs );} 

    if ( msging_f ) {
__~debug:data{    console.log( "ga.data.update() msging_f defined" );}
        $( "#" + mod + "_progress" ).html( "" );
        jqhmod_out_msgs.text( "" );
    }

    $.each(data, function(k, v) {
        __~debug:data{console.log( "ga.data.update() k " + k + " v " + v );}
        __~debug:getinput{if ( /^_getinput/.test( k ) ) {console.log( "ga.data.update, found _getinput" );}}

        match = jqmod_out.find( "#" + k );
        if ( match.length )
        {
            if ( !output_msgs_cleared )
            {
                jqhmod_out_msgs.text( "" );
                output_msgs_cleared = 1;
            }
            switch ( match.attr( "type" ) )
            {
            case "plot2d" : 
                __~debug:plottwod{console.log( "ga.data.update v is " );console.dir( v );}
                htag = "#" + k;
		var image;
		var file;
		var plot;

                ga.value.plot2d.zstack.reset( htag );
		
                if ( v.data ) {
                    ga.value.set.plot2d( htag, v.options );
                    __~debug:plottwod{console.log( "ga.data.update processed plot options is " );console.dir( ga.value.get.plot2d.plot_options( htag, v.options ) );}

		    //ga.pl = ga.value.get.plot2d.plot_options( htag, v.options );

		    ga.plotglobal     = v.options;
		    ga.dataplotglobal = v.data;
		    //console.dir(ga.pl );
		    
		    plot = $.plot( htag, v.data, ga.value.get.plot2d.plot_options( htag, v.options ) );
		} else {
                    plot = $.plot( htag, v,  ga.value.get.plot2d.plot_options( htag ) );
                }

		if ( $( htag  + "_changescale" ).length )
		{
		    $(htag + "_changescale").removeClass( "hidden" );
		}

		create_image_htmltocanvas(k);
		//create_image(k, plot);

                if ( ga.value.settings[ htag ].selzoom || 
                     ( v.options && v.options.selection && v.options.selection.mode && v.options.selection.mode == "xy" ) ) {
		    $( htag )
                        .on("plotselected", 
                            {
                                htag : htag
                                ,data : v.data ? v.data : v
                                ,options : v.data ? ga.value.get.plot2d.plot_options( htag, v.options ) : ga.value.get.plot2d.plot_options( htag )
                            },
                            function ( e, ranges ) {
                                
		                // clamp the zooming to prevent eternal zoom

		                if (ranges.xaxis.to - ranges.xaxis.from < 0.00001) {
			            ranges.xaxis.to = ranges.xaxis.from + 0.00001;
		                }

		                if (ranges.yaxis.to - ranges.yaxis.from < 0.00001) {
			            ranges.yaxis.to = ranges.yaxis.from + 0.00001;
		                }

		                // do the zooming

                                ga.value.plot2d.zstack.dopush( e.data.htag, ranges );

		                $.plot( e.data.htag, e.data.data, 
				        $.extend(true, {}, e.data.options, {
				            xaxis: { min: ranges.xaxis.from, max: ranges.xaxis.to },
				            yaxis: { min: ranges.yaxis.from, max: ranges.yaxis.to }
				        })
			              );
				//create_image(k);
		            })
                        .on('contextmenu',
                            {
                                htag : htag
                                ,data : v.data ? v.data : v
                                ,options : v.data ? ga.value.get.plot2d.plot_options( htag, v.options ) : ga.value.get.plot2d.plot_options( htag )
                            },
                            function(e) {
                                e.preventDefault();
                                __~debug:zstack{console.log( "contextmenu called on " + e.data.htag );}
                                var ranges = ga.value.plot2d.zstack.dopop( e.data.htag );
                                if ( ranges ) {
		                     $.plot( e.data.htag, e.data.data, 
				             $.extend(true, {}, e.data.options, {
				                 xaxis: { min: ranges.xaxis.from, max: ranges.xaxis.to },
				                 yaxis: { min: ranges.yaxis.from, max: ranges.yaxis.to }
				             })
			                   );
                                } else {
		                    $.plot( e.data.htag, e.data.data, e.data.options );
                                }
				//create_image(k);
                            });
                }
		
		
		

		
                savekey = mod_out + ":#" + k + ":last_value";
                $( "#global_data" ).data( savekey , v ); 
                break;
            case "atomicstructure" : 
                //                               Jmol.setDocument( 0 );
                savekey = mod_out + ":#" + k + ":last_value";
                if ( v.file ) {
                    jsmolfile = v.file;
                } else {
                    jsmolfile = v;
                }
                __~debug:jsmol{console.log("jsmolfile is " + jsmolfile);}
                _jmol_info[ k ].script =
                    'set background [' + ga.colors.background + ']; set zoomlarge false;set echo top center;echo loading ' + jsmolfile.split( '/' ).pop() + ';refresh;load "' + jsmolfile + '";';
                if ( ga.set( mod + ":jsmoladd" ) ) {
                    _jmol_info[ k ].script += ga.set( mod + ":jsmoladd" );
                }
                if ( v.script ) {
                    _jmol_info[ k ].script += ";" + v.script;
                }
                __~debug:jsmol{console.log( "jsmol script is " + _jmol_info[ k ].script );}
                //                               Jmol.getApplet("jmol", _jmol_info[ k ]);
__~debug:values{        console.log( "ga.data.update() atomic structure jmol script before: " + _jmol_info[ k ].script );}
                $( "#global_data" ).data( savekey , _jmol_info[ k ].script ); 
                $("#" + k ).html(Jmol.getAppletHtml( "jmolApplet" + k, _jmol_info[ k ] ));
__~debug:values{        console.log( "ga.data.update() atomic structure jmol script after: " + _jmol_info[ k ].script );}
                break;
            case "checkbox" : 
            case "radio" : 
                match.prop( "checked", true ); 
                break;
            case "div" :  
                match.html( v );
                break;
            case "video" : 
                jqhtag = $( "#" + k );
                thtml = "<video ";
                if ( jqhtag.attr( "data-width" ) ) {
                    thtml += ' width="' +  jqhtag.attr( "data-width" ) + '"';
                }
                if ( jqhtag.attr( "data-height" ) ) {
                    thtml += ' height="' +  jqhtag.attr( "data-height" ) + '"';
                }
                thtml += ' controls>';
                thtml += '<source src="' + v +'.mp4" type="video/mp4" /><source src="' + v +'.webm" type="video/webm" />';
                thtml += '</video>';
                __~debug:video{console.log( "video: thtml " + thtml );}
                jqhtag.html( thtml );
                break;
            case "image" : 
                jqhtag = $( "#" + k );
                thtml = "<img ";
                if ( jqhtag.attr( "data-width" ) ) {
                    thtml += ' width="' +  jqhtag.attr( "data-width" ) + '"';
                }
                if ( jqhtag.attr( "data-height" ) ) {
                    thtml += ' height="' +  jqhtag.attr( "data-height" ) + '"';
                }
                thtml += ' src="' + v + '">';
                __~debug:image{console.log( "image: thtml " + thtml );}
                jqhtag.html( thtml );
                break;
            case "filelink" : 
                tlink = "<a href=\"" + v + "\" target=\"_blank\">" + v.split( '/' ).pop() + "</a>";
                savekey = mod_out + ":#" + k + ":last_value";
                $( "#global_data" ).data( savekey , tlink );
                $( "#" + k + "_filelink" ).html( tlink );
                break;
            case "filelinkm" : 
                savekey = mod_out + ":#" + k + ":last_value";
                tlink = "";
                $.each( v, function( k2, v2 ) {
                    tlink += "<a href=\"" + v2 + "\" target=\"_blank\">" + v2.split( '/' ).pop() + "</a> ";
                } );
                $( "#global_data" ).data( savekey , tlink );
                $( "#" + k + "_filelink" ).html( tlink );
                break;
            default :
                if ( $( "#global_data" ).data( "_append:" + mod_out + "_" + k ) )
                {
                    match.val( match.val() + "\n" + v );
                    match.height( parseFloat( match.prop( 'scrollHeight' ) + parseFloat( match.css("borderTopWidth") ) + parseFloat( match.css("borderBottomWidth") ) ) );
                } else {
                    match.val( v );
                }
                break;
            }
        } else {
            if ( msging_f ) {
                if ( k.charAt( 0 ) == "_" ) {
                    if ( !/^_fs_/.test( k ) || !ga.data.nofcrefresh[ mod ] ) {
                        if ( k == "_message" )
                        { 
                            messagebox( v );
                        }
                        if ( /^_getinput/.test( k ) )
                        { 
                            __~debug:getinput{console.log( "found " + k + " in msging" );}
                            __~debug:getinput{if ( k == "_getinputerror" ) { console.log( "_getinputerror " + v );} }
                            if ( k == "_getinput" ) {
                                ga.valuen.input( mod, v );
                            }
                        }
                        if ( k == "_textarea" )
                        { 
                            __~debug:textarea{console.log( "ga.data.update() textarea msg in msging " + v );}
                            ga.data.textarea( hmod_out, v );
                        }
                        if ( k == "_airavata" )
                        { 
                            __~debug:airavata{console.log( "ga.data.update() airavata msg in msging " + v );}
                            ga.data.airavata( hmod_out, v );
                        }
                        if ( k == "_status" )
                        { 
                            __~debug:job{console.log( "ga.data.update() msg status is now " + v );}
                            if ( v == "complete" ) {
                                msging_f( msg_id, 0, 0 );
                            }
                        }
                    }
                } else {
                    if ( !appended )
                    {
                        jqhmod_out_msgs.append( "<p>Unexpected results:</p>" );
                        appended = 1;
                    }
                    jqhmod_out_msgs.append( "<p>" + k + " => " + v + "</p>" );
                }
            } else {
                if ( k.charAt( 0 ) == "_" ) {
                    if ( !/^_fs_/.test( k ) || !ga.data.nofcrefresh[ mod ] ) {
                        $( "#_state" ).data( k, v );
                        state_changed = 1;
                        if ( k == "_status" )
                        { 
                            __~debug:job{console.log( "ga.data.update() status is now " + v );}
                            retobj.job_status = v;
                        }
                        if ( /^_getinput/.test( k ) )
                        { 
                            __~debug:getinput{console.log( "found " + k + " NOT in msging" );}
                            __~debug:getinput{if ( k == "_getinputerror" ) { console.log( "_getinputerror " + v );} }
                            if ( k == "_getinput" ) {
                                ga.valuen.input( mod, v );
                            }
                        }
                        if ( k == "_textarea" )
                        { 
                            __~debug:textarea{console.log( "ga.data.update() textarea msg " + v );}
                            ga.data.textarea( hmod_out, v );
                        }
                        if ( k == "_airavata" )
                        { 
                            __~debug:airavata{console.log( "ga.data.update() airavata msg in msging " + v );}
                            ga.data.airavata( hmod_out, v );
                        }
                        if ( k == "_loginverify" )
                        { 
                            __~debug:loginverify{console.log( "ga.data.update() loginverify options found " + v );}
                            ga.login.verify( v );
                        }
                        if ( k == "_loginapprove" )
                        { 
                            __~debug:loginapprove{console.log( "ga.data.update() approve options found " + v );}
                            ga.login.approve( v );
                        }
                    }
                } else {
                    if ( k == "-close" )
                    {
                        do_close = 1;
                    } else {
                        if ( k == "-close2" )
                        {
                            do_close2 = 1;
                        } else {
                            if ( !appended )
                            {
                                jqhmod_out_msgs.text( "" );
                                jqhmod_out_msgs.append( "<p>Unexpected results:</p>" );
                                appended = 1;
                                output_msgs_cleared = 1;
                            }
                            jqhmod_out_msgs.append( "<p>" + k + " => " + v + "</p>" );
                        }
                    }
                }
            }
        }
    });
    ga.value.saveLastValues( mod_out );
    ga.value.saveLastValue( mod_out, hmod_out_msgs );
    $( hmod_out + '_progress' ).html( "" );
    if ( state_changed )
    {
        syncState();
    }
    if ( do_close )
    {
        closeModal();
    }
    if ( do_close2 )
    {
        closeModal2();
    }
    return retobj;
};

ga.data.textarea = function( hmod_out, v ) {
    var hmod_out_textarea   = hmod_out + "_textarea",
        jqhmod_out_textarea = $( hmod_out_textarea );
        isatend = ( jqhmod_out_textarea[0].scrollHeight - jqhmod_out_textarea[0].scrollTop === jqhmod_out_textarea[0].clientHeight );

    __~debug:textareascroll{console.log( "current scrolltop " + jqhmod_out_textarea.scrollTop() + " scrollheight " + jqhmod_out_textarea[0].scrollHeight );}
    __~debug:textareascroll{console.log( "isatend " + ( isatend ? "true" : "false" ) );}

__~debug:textarea{    console.log( "ga.data.textarea( " + hmod_out + " , " + v + " )" );}
    if ( jqhmod_out_textarea.is( ":hidden" ) ) {
__~debug:textarea{    console.log( "ga.data.textarea( " + hmod_out + " , " + v + " ) show" );}
        jqhmod_out_textarea.show();
        $( hmod_out_textarea + "_label" ).show(); 
    }

    if ( v.substr( 0, 10 ) == "__reset__\n" ) {
        jqhmod_out_textarea.val( v.substr( 10 ) );
    } else {
        jqhmod_out_textarea.val( jqhmod_out_textarea.val() + v );
    }
    if ( !ga.set( "textarea:rows" ) ) {
__~debug:textarea{    console.log( "ga.data.textarea( " + hmod_out + " , " + v + " ) height set to " + ( parseFloat( jqhmod_out_textarea.prop( 'scrollHeight' ) ) + parseFloat( jqhmod_out_textarea.css ( 'borderTopWidth' ) ) + parseFloat( jqhmod_out_textarea.css ( 'borderBottomWidth' ) ) ) );}
        jqhmod_out_textarea.height( parseFloat( jqhmod_out_textarea.prop( 'scrollHeight' ) ) + 
                                    parseFloat( jqhmod_out_textarea.css ( 'borderTopWidth' ) ) + 
                                    parseFloat( jqhmod_out_textarea.css ( 'borderBottomWidth' ) ) );
    } else {
        if ( !ga.data.textarea.h[ hmod_out ] ) {
            ga.data.textarea.h[ hmod_out ] = parseFloat( jqhmod_out_textarea.prop( 'clientHeight' ) ) + 
                parseFloat( jqhmod_out_textarea.css ( 'borderTopWidth' ) ) + 
                parseFloat( jqhmod_out_textarea.css ( 'borderBottomWidth' ) );
            __~debug:textarea{console.log( "ga.data.textarea setting STORED height to " + ga.data.textarea.h[ hmod_out ] );}
        } else {
            jqhmod_out_textarea.height( ga.data.textarea.h[ hmod_out ] );
            __~debug:textarea{console.log( "ga.data.textarea setting height to " + ga.data.textarea.h[ hmod_out ] );}
        }
    }
    __~debug:textareascroll{console.log( "after append scrolltop " + jqhmod_out_textarea.scrollTop() + " scrollheight " + jqhmod_out_textarea[0].scrollHeight );}
    if ( isatend ) {
        jqhmod_out_textarea.scrollTop( jqhmod_out_textarea[0].scrollHeight );
    }
};

ga.data.textarea.h = {};
    
ga.data.airavata = function( hmod_out, v ) {
    var hmod_out_airavata   = hmod_out + "_airavata",
        jqhmod_out_airavata = $( hmod_out_airavata );

__~debug:airavata{    console.log( "ga.data.airavata( " + hmod_out + " , " + v + " )" );}
    if ( jqhmod_out_airavata.is( ":hidden" ) ) {
        jqhmod_out_airavata.show();
    }
        
    jqhmod_out_airavata.html( v );
}
