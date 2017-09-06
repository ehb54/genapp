/*jslint white: true, plusplus: true*/
/* assumes: jquery > 1.11.0, jqtree >= 3.0.9, jquery-base64 */

ga.bokeh = {};
ga.bokeh.data = {};

ga.bokeh.getdata = function( tag, scriptin ) {
    __~debug:bokeh{console.log( "ga.bokeh.getdata( " + tag + " , html )" );}
    var result = {};
    var lines = scriptin.split( /\r?\n/ );
    var ll = lines.length;
    __~debug:bokeh{console.log( "ga.bokeh.getdata(): lines " + ll );}
    var i;
    var mode = 0;
    var tmp;

    // ignore upto <body>

    for ( i = 0; i < ll; ++i ) {
        if ( !mode &&
             lines[ i ].indexOf( "var docs_json =" ) === -1 ) {
            continue;
        }
        if ( !mode ) {
            mode = 1;
            result.docs_json = $.parseJSON( lines[ i ].replace( /^\s*var\s+docs_json\s+=\s+/, "" ).replace( /;$/, "" ) );
            __~debug:bokeh{console.log( "ga.bokeh.getdata() found docs_json:");console.dir( result.docs_json );}
            continue;
        }
        if ( mode == 1 ) {
            if ( lines[ i ].indexOf( "var render_items =" ) === -1 ) {
                continue;
            }
            result.render_items = $.parseJSON( lines[ i ].replace( /^\s*var\s+render_items\s+=\s+/, "" ).replace( /;$/, "" ) );
            __~debug:bokeh{console.log( "ga.bokeh.getdata() found render_items:");console.dir( result.render_items );}
            return result;
        }
    }
    __~debug:bokeh{console.log( "ga.bokeh.getdata() fallout error!" );}
    return result;
}

ga.bokeh.render = function( mod, tag, v ) {
    __~debug:bokeh{console.log( "ga.bokeh.render( " + mod + " , " + tag + " , bokehresult )" );}
    var bokehresult = ga.bokeh.getdata( tag, v );
    __~debug:bokeh{console.log( "bokehresult:" ); console.dir( bokehresult );}
    mod = mod + "_output";
    ga.bokeh.savedata( mod, tag, bokehresult );
    ga.bokeh.renderdata( mod, tag );
}

ga.bokeh.renderdata = function( mod, tag ) {
    __~debug:bokeh{console.log( "ga.bokeh.renderdata( " + mod + " , " + tag + " )" );}
    // probably want to loop through the render items...
    if ( ga.bokeh.data[ mod ] && ga.bokeh.data[ mod ][ tag ] && ga.bokeh.data[ mod ][ tag ].docs_json && ga.bokeh.data[ mod ][ tag ].render_items ) {
        $( "#" + tag ).html( '<div class="bk-root"><div class="bk-plotdiv" id="' + ga.bokeh.data[ mod ][ tag ].render_items[ 0 ].elementid + '"></div></div>' );
        Bokeh.embed.embed_items( ga.bokeh.data[ mod ][ tag ].docs_json, ga.bokeh.data[ mod ][ tag ].render_items );
    }
}


ga.bokeh.savedata = function( mod, tag, bokehresult ) {
    __~debug:bokeh{console.log( "ga.bokeh.savedata( " + mod + " , " + tag + " , bokehresult )" );}
    ga.bokeh.data[ mod ] = ga.bokeh.data[ mod ] || {};
    ga.bokeh.data[ mod ][ tag ] = bokehresult;
}

ga.bokeh.reset = function( mod, tag ) {
    __~debug:bokeh{console.log( "ga.bokeh.reset( " + mod + " , " + tag + " )" );}
    ga.bokeh.data[ mod ] = ga.bokeh.data[ mod ] || {};
    ga.bokeh.data[ mod ][ tag ] = {};
    $( "#" + tag ).html("");
}
