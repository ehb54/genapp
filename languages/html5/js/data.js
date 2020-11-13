/*jslint white: true, plusplus: true*/
/* assumes: jquery > 1.11.0, jqtree >= 3.0.9, jquery-base64 */

ga.data = {};
ga.data.nofcrefresh = {};

// play with tooltips upon hover
function showTooltip(x, y, content, bg_color) {
        $('<div id="rtooltip">' + content + '</div>').css({
            'position' : 'absolute',
	    'top'      : y + 5,
	    'left'     : x + 5,
            'border'   : '1px solid #181616',
            'padding'  : '2px',
            'background-color' : bg_color,
	    'color'    : 'white'
        }).appendTo( "body" );
    }


// apply the data to the screen output, return an object with job_status

ga.data.dataURLtoFile = function(dataurl, filename) {
    var arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1],
        bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
    while(n--){
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, {type:mime});
}

ga.data.create_image_htmltocanvas = function(k) {
    __~debug:canvas{console.log( "create_image_htmltocanvas()" );}
    if ( $( "#" + k  + "_savetofile" ).length )
    {
	//var a = document.getElementById(k + "_savetofile");
	
	var combined = $("#" + k + "_div");
	//html2canvas( match.get(0), {
	html2canvas( combined.get(0), {
	    background: "#ffffff",
	    //width     : 600,
	    onrendered: function (canvas) {
		var image = canvas.toDataURL("image/png").replace("image/png", "image/octet-stream"); 
		
		//a.href = image;
		//a.download = "plot.png";
		//$("#" + k  + "_savetofile").removeClass( "hidden" );

		//var link = "<a href=\"" + v + "\" target=\"_blank\">" + v.split( '/' ).pop() + "</a>";
		var link = "<a href=\"" + image + "\" target=\"_blank\" download=\"plot.png\">" + "plot.png" + "</a>";
		//console.log("link: " + link);
		$("#" + k  + "_savetofile_link").html( link );
	    }
	});
    }
}

ga.data.create_image = function(k, plot) {
    __~debug:canvas{console.log( "create_image()" );}
    if ( $( "#" + k  + "_savetofile" ).length )
    {
	var a = document.getElementById(k + "_savetofile");
	
	var canvas = plot.getCanvas();
	//canvas_merged = replotChartAsCanvas(match, v.data, ga.value.get.plot2d.plot_options( htag, v.options ));
	var image = canvas.toDataURL("image/png").replace("image/png", "image/octet-stream"); 
	var file = ga.data.dataURLtoFile(image, 'plot.png');
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
        mod_out             = mod,
        hmod_out            = "#" + mod_out,
        jqmod_out           = $( hmod_out ),
        mod_out2            = mod + "_output",
        hmod_out2           = "#" + mod_out2,
        jqmod_out2           = $( hmod_out2 ),
        retobj              = {},
        hmod_out_msgs       = hmod_out2 + "_" + "msgs",
        jqhmod_out_msgs     = $( hmod_out_msgs ),
        htag,
        jqhtag,
        savekey,
        tlink,
        thtml,
        t,
        jsmolfile,
        match,
        t2;

__~debug:data{    console.log( "ga.data.update( " + mod + " , " + data + " )" );}
__~debug:data{    console.log( "ga.data.update() hmod_out_msgs " + hmod_out_msgs );} 
__~debug:getinput{    console.log( "ga.data.update() hmod_out_msgs " + hmod_out_msgs );} 

//    if ( !msging_f ) {
//      __~debug:data{console.log( "ga.data.update() msging_f defined" );}
//      // clear when not messaged (i.e. job is complete)
//      ga.progress.clear( mod, 'data.js 1' );
//      jqhmod_out_msgs.text( "" );
//    }

    var has_handler = ga.layout.handler && ga.layout.handler[ mod ];

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
            if ( has_handler &&
                 ga.layout.handler[ mod ][ k ] &&
                 ga.layout.handler[ mod ][ k ].setval ) {
                ga.layout.handler[ mod ][ k ].setval( v );
            }
            switch ( match.attr( "type" ) )
            {
	    case "plot3d" :
	    case "plotly" :
		htag = "#" + k;
                __~debug:plotly{console.log( "Plotly v:" + JSON.stringify( v ) );}
		// v.layout = $.extend( {}, v.layout, {showlegend: false } );
		
		ga.plot3dglobal     = v.layout;
		ga.dataplot3dglobal = v.data;
		ga.plotted3d[ mod ] = 0;
		
		__~debug:plotly{console.log("Plotly JSON Options: " + JSON.stringify(v.layout));}
		__~debug:plotly{console.log("plotly JSON Data: " + JSON.stringify(v.data));}

		if ( $( htag  + "_showcollapse" ).length )
		{
		    $(htag + "_showcollapse").removeClass( "hidden" );
		}
		
		//if(!ga.showcollapse3d)
		//{
		Plotly.newPlot(k, v.data, v.layout);
		//}
		if ( ga.showcollapse3d[ mod ] )
		{
		    ga.plotted3d[ mod ] = 1;
		    $(  htag  + "_showcollapse" ).trigger( "click" );
		}
		savekey = mod_out + ":#" + k + ":last_value";
                $( "#global_data" ).data( savekey , v ); 
		break;
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
		    
		    //console.dir(ga.value.get.plot2d.plot_options( htag, v.options ));

		    plot = $.plot( htag, v.data, ga.value.get.plot2d.plot_options( htag, v.options ) );

		    // play with tooltip response upon hover //////////////////////////////////////////
		    if ( ga.customtooltips[ mod ] ) 
		    {
			var previousPoint = null;
			$( htag ).bind("plothover", function (event, pos, item) {
			    if (item) {
				if (previousPoint != item.dataIndex) {
				    previousPoint = item.dataIndex;
				    
				    $("#rtooltip").remove();
				    var x = item.datapoint[0].toFixed(2),
				    y = item.datapoint[1].toFixed(2);
				    
				    if (item.series.tooltips.length) //specific for Rotdif's 'rdata' for residues...
				    {
					showTooltip(item.pageX, item.pageY, item.series.tooltips[item.dataIndex], item.series.color );
					//alert(item.series.rdata);
				    }
				}
			    }
			    else {
				$("#rtooltip").remove();
				//$("#tooltip").hide();
			    previousPoint = null;
			    }
			});
		    }
		    // END of tooltip response /////////////////////////////////////////////////////
		    
		} else {
                    plot = $.plot( htag, v,  ga.value.get.plot2d.plot_options( htag ) );
                }

		if ( $( htag  + "_savetofile" ).length )
		{
		    $(htag + "_savetofile").removeClass( "hidden" );
		}
		    
		if ( $( htag  + "_changescalex" ).length )
		{
		    $(htag + "_changescalex").removeClass( "hidden" );
		    if (v.options.xscale == "log")
		    {
			$(htag + "_changescalex_message").html("X-log");
		    }
		    else
		    {
			$(htag + "_changescalex_message").html("X-lin");
		    }
		}

		if ( $( htag  + "_changescaley" ).length )
		{
		    $(htag + "_changescaley").removeClass( "hidden" );
		    if (v.options.yscale == "log")
		    {
			$(htag + "_changescaley_message").html("Y-log");
		    }
		    else
		    {
			$(htag + "_changescaley_message").html("Y-lin");
		    }
		}

		if ( $( htag  + "_showcollapse" ).length )
		{
		    $(htag + "_showcollapse").removeClass( "hidden" );
		    $(htag).show();
		    ga.plotted2d[ mod ]=1;
		    $(  htag  + "_showcollapse" ).trigger( "click" );
		}

		//ga.data.create_image_htmltocanvas(k);
		//ga.data.create_image(k, plot);

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
            case "bokeh" : 
                __~debug:bokeh{console.log( "ga.data.update() type: bokeh v is " );console.log( v );}
                // strip header, process eval & html
                ga.bokeh.render( mod, k, v );
                break;

            case "ngl" : 
                ga.value.nglshow( mod_out, k, v );
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
                            ga.msg.box( v );
                        }
                        if ( k == "_question" )
                        { 
                            // could probably just send data._question==v, data._uuid & data._msgid
                            ga.qr.question( mod, data );
                        }
                        if ( k == "_question_answered" )
                        { 
                            // could probably just send data._question==v, data._uuid & data._msgid
                            ga.qr.answered( mod, data );
                        }
                        if ( k == "_question_timeout" )
                        { 
                            // could probably just send data._question==v, data._uuid & data._msgid
                            ga.qr.timeout( mod, data );
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
                            ga.data.textarea( hmod_out2, v );
                        }
                        if ( k == "_airavata" )
                        { 
                            __~debug:airavata{console.log( "ga.data.update() airavata msg in msging " + v );}
                            ga.data.airavata( hmod_out2, v );
                        }
                        if ( k == "_status" )
                        { 
                            if ( v == "complete" ) {
                                msging_f( msg_id, 0, 0 );
                            }
                        }
                        if ( k == "_progress" )
                        { 
                            __~debug:progress{console.log( "ga.data.update() _progress is now " + v );}
                            ga.progress( mod, v );
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
                            ga.data.textarea( hmod_out2, v );
                        }
                        if ( k == "_airavata" )
                        { 
                            __~debug:airavata{console.log( "ga.data.update() airavata msg in msging " + v );}
                            ga.data.airavata( hmod_out2, v );
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
                        if ( k == "_progress" )
                        { 
                            __~debug:progress{console.log( "ga.data.update() _progress is now " + v );}
                            ga.progress( mod, v );
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
//    ga.progress.clear( mod, 'data.js 2' );
    if ( state_changed )
    {
        syncState();
    }
    if ( do_close )
    {
        ga.msg.close( 1 );
    }
    if ( do_close2 )
    {
        ga.msg.close( 2 );
    }
    return retobj;
};

ga.data.textarea = function( hmod_out, v ) {
    console.log( `ga.data.textarea hmod_out = ${hmod_out}` );
    
    var hmod_out_textarea   = hmod_out + "_textarea";
    var mod_out = hmod_out.replace( /^#/, '' );
    var mod_out_textarea = mod_out + "_textarea"; 

    console.log( `ga.data.textarea hmod_out_textarea = ${hmod_out_textarea}` );

    var jqhmod_out_textarea = $( hmod_out_textarea );
    var isatend = ( jqhmod_out_textarea[0].scrollHeight - jqhmod_out_textarea[0].scrollTop === jqhmod_out_textarea[0].clientHeight );

    __~debug:textareascroll{console.log( "current scrolltop " + jqhmod_out_textarea.scrollTop() + " scrollheight " + jqhmod_out_textarea[0].scrollHeight );}
    __~debug:textareascroll{console.log( "isatend " + ( isatend ? "true" : "false" ) );}

    if ( !v ) {
        v = '';
    }

__~debug:textarea{    console.log( "ga.data.textarea( " + hmod_out + " , " + v + " )" );}
    if ( jqhmod_out_textarea.is( ":hidden" ) ) {
__~debug:textarea{    console.log( "ga.data.textarea( " + hmod_out + " , " + v + " ) show" );}
        document.getElementById( mod_out_textarea ).removeAttribute("hidden")
        document.getElementById( mod_out_textarea ).removeAttribute("style")
//        jqhmod_out_textarea.show();
//        $( hmod_out_textarea + "_label" ).show(); 
        var mod_lbl = document.getElementById( mod_out_textarea + "_label" );
        if ( mod_lbl ) {
            mod_lbl.removeAttribute( "hidden" );
            mod_lbl.removeAttribute( "style" );
        }
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
