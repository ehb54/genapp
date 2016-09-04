/*jslint white: true, plusplus: true*/
/* assumes: jquery > 1.11.0, jqtree >= 3.0.9, jquery-base64 */

ga.colors = function( colors ) {
    
    ga.colors.background = ga.colors.makeRGB( colors.background );
    ga.colors.text       = ga.colors.makeRGB( colors.text );
};

ga.colors.makeRGB = function( color ) {
    __~debug:color{console.log( "ga.colors.makeRGB( " + color + " )" );}
    var res;
    if ( /\d{1,3},\s*\d{1,3},\s*\d{1,3}$/.test( color ) ) {
        __~debug:color{console.log( "ga.colors.makeRGB() ok as is" );}
        return color;
    }

    res = ga.color.toRGB( color );

    __~debug:color{console.log( "ga.colors.makeRGB() processed to " + res.r + "," + res.g + "," + res.b );}
    
    return res.r + "," + res.g + "," + res.b;
}

ga.plot_options = function () {
    var textcolor = "rgb( " + ga.colors.text + " )",
        retobj = {
            font : {
                color : textcolor
            },
            grid : {
                hoverable: false
		//, backgroundColor: "white"
            },
            xaxis : {
                color : "gray",
                lineWidth : 0.5,
                font : {
                    color : textcolor
                }
            },
            yaxis : {
                color : "gray",
                lineWidth : 0.5,
                font : {
                    color : textcolor
                }
            },
            lines: { 
                lineWidth : 1.0
            },
            zoom: {
                interactive: false
            },
            pan: {
                interactive: false
            }
        };

    return retobj;
};

ga.color = function( colors ) {
    __~debug:color{console.log( "ga.colors()" ); console.log( colors );}
    ga.color.data = colors;
    ga.colors( colors.body );
    ga.color.apply();
}

ga.color.defaults = function( colors ) {
    __~debug:color{console.log( "ga.colors.default() " ); console.log( colors );}
    ga.browser();
    ga.color.defaults.data = colors;
    ga.color( colors );
}

ga.color.toRGB = function( color ) {
    __~debug:color{console.log( "ga.color.toRGB( " + color + " )" );}
    var r, g, b, re;

    if ( color.slice( 0, 1 ) === "#" ) { 
        // adjust help background color
        b = parseInt( color.slice( 1 ), 16 );
        g = parseInt( b / 256 );
        b -= g * 256;
        r = parseInt( g / 256 );
        g -= r * 256;

        __~debug:color{console.log( "ga.color.toRGB( " + color + " ) got #" );}
        return { r:r, b:b, g:g };
    }

    __~debug:color{console.log( "ga.color.toRGB( " + color + " ) got rgb()" );}

    bits = /^rgb\(\s*(\d{1,3}),\s*(\d{1,3}),\s*(\d{1,3})\s*\)$/.exec( color );
    if ( bits ) {
        r = parseInt( bits[ 1 ] );
        g = parseInt( bits[ 2 ] );
        b = parseInt( bits[ 3 ] );
    } else {
        r = 128;
        g = 128;
        b = 128;
    }

    return { r:r, b:b, g:g };
}

ga.color.apply = function() {
    var i
        ,jq
        ,r, g, b
        ,r0, g0, b0
        ,tmp
    ;

    __~debug:color{console.log( "ga.colors.apply()" );}

    if ( !ga.directives.data || !ga.directives.data[ "usercolors" ] ||
         /^(off|0|false)$/.test( ga.directives.data[ "usercolors" ] ) ) {
        __~debug:color{console.log( "ga.colors.apply() skipped" );}
        return;
    }

    for ( i in ga.color.data ) {
        if ( ga.color.data.hasOwnProperty( i ) ) {
            __~debug:color{console.log( "ga.color.apply() " + i ); console.log( ga.color.data[ i ] );}
            if ( jq = $( i ) ) {
                jq.css( ga.color.data[ i ] );
            }
        }
    }

    $( ".sidebar ul li, .title" )
        .css( "color", ga.color.data.body.color )
        .hover( function() { $(this).css( "color", ga.color.defaults.data.hovercolor.color );}, 
                function() { $(this).css( "color", ga.color.data.body.color );} )
    ;

    $( ".svgmenu" )
        .css( { "color" : ga.color.data.body.color, "stroke" : ga.color.data.body.color } )
        .hover( function() { $(this).css( { "color" : ga.color.defaults.data.hovercolor.color, "stroke" : ga.color.defaults.data.hovercolor.color } ) },
                function() { $(this).css( { "color" : ga.color.data.body.color, "stroke" : ga.color.data.body.color } ) } )
    ;

    if ( ga.color.data.body.background.slice( 0, 1 ) === "#" ) { 
        // adjust help background color
        b = parseInt( ga.color.data.body.background.slice( 1 ), 16 );
        g = parseInt( b / 256 );
        b -= g * 256;
        r = parseInt( g / 256 );
        g -= r * 256;

        r += r > 128 ? -20 : 20;
        g += g > 128 ? -20 : 20;
        b += b > 128 ? -20 : 20;

        __~debug:color{console.log( "helprgb " + "rgba(" + r + "," + g + "," + b + ",0.8)" );}

        $( ".help,.coord" )
            .css( { background : "rgba(" + r + "," + g + "," + b + ",0.8)",
                    color      : ga.color.data.body.color } )
        ;
    } else {
        $( ".help,.coord" )
            .css( { background : ga.color.data[ ".help" ].background,
                    color      : ga.color.data[ ".help" ].color } )
        ;
    }

    if ( ga.color.data.body.color.slice( 0, 1 ) === "#" ) {
        // adjust header colors
        b = parseInt( ga.color.data.body.color.slice( 1 ), 16 );
        g = parseInt( b / 256 );
        b -= g * 256;
        r = parseInt( g / 256 );
        g -= r * 256;

        r0 = r;
        g0 = g;
        b0 = b;
        
        r += r > 128 ? -12 : 12;
        g += g > 128 ? -12 : 12;
        b += b > 128 ? -12 : 12;

        $( ".header1" ).css( { color : "rgb(" + r + "," + g + "," + b + ")" } );

        r += r > 128 ? -12 : 12;
        g += g > 128 ? -12 : 12;
        b += b > 128 ? -12 : 12;

        $( ".header2" ).css( { color : "rgb(" + r + "," + g + "," + b + ")" } );

        r += r > 128 ? -12 : 12;
        g += g > 128 ? -12 : 12;
        b += b > 128 ? -12 : 12;

        $( ".header3" ).css( { color : "rgb(" + r + "," + g + "," + b + ")" } );

        r += r > 128 ? -12 : 12;
        g += g > 128 ? -12 : 12;
        b += b > 128 ? -12 : 12;

        $( ".header4" ).css( { color : "rgb(" + r + "," + g + "," + b + ")" } );

        r += r > 128 ? -12 : 12;
        g += g > 128 ? -12 : 12;
        b += b > 128 ? -12 : 12;

        $( "hr" ).css( { color : "rgb(" + r + "," + g + "," + b + ")" } );

        // links
        {
            r = r0;
            g = g0;
            b = b0;

            g += g > 128 ? -75 : 75;
            ga.cssrule.kill('a:link');
            tmp = ga.cssrule.add( 'a:link' );
            tmp.style.color = "rgb(" + r + "," + g + "," + b + ")";
            g = g0;

            b += b > 128 ? -75 : 75;
            r += r > 128 ? -75 : 75;
            ga.cssrule.kill('a:visited');
            tmp = ga.cssrule.add( 'a:visited' );
            tmp.style.color = "rgb(" + r + "," + g + "," + b + ")";
            b = b0;
            r = r0;

            r += r > 128 ? -75 : 75;
            ga.cssrule.kill('a:active');
            tmp = ga.cssrule.add( 'a:active' );
            tmp.style.color = "rgb(" + r + "," + g + "," + b + ")";

        }
    } else {
        $( ".header1" ).css( { color : ga.color.data[ ".header1" ] ? ga.color.data[ ".header1" ].color : ga.color.data.body.color } );
        $( ".header2" ).css( { color : ga.color.data[ ".header2" ] ? ga.color.data[ ".header2" ].color : ga.color.data.body.color } );
        $( ".header3" ).css( { color : ga.color.data[ ".header3" ] ? ga.color.data[ ".header3" ].color : ga.color.data.body.color } );
        $( ".header4" ).css( { color : ga.color.data[ ".header4" ] ? ga.color.data[ ".header4" ].color : ga.color.data.body.color } );
    }

    // modals

    $( ".modalDialog > div, .modalDialog2 > div, .modalDialog3 > div, .modalDialog4 > div" )
    .css( { background : ( ga.browser.gradient 
                           ? ga.browser.prefix + "linear-gradient(" + ga.color.data.body.background + ", #222)"
                           : ga.color.data.body.background ) } );



}

ga.color.reset = function() {
    __~debug:color{console.log( "ga.colors.reset()" );}
    ga.color( ga.color.defaults.data );
}

ga.color.spectrum = function( id ) {
    if ( ga.browser.clrpkr ) {
        return;
    }
    $( id ).on('change.spectrum', function( e, color ) { console.log( "hi spectrum" + id ); $( id ).val( color.toHexString() );  } );
}

ga.color.spectrum.val = function( id, val ) {
    if ( ga.browser.clrpkr ) {
        return;
    }

    if ( val ) {
        __~debug:spectrum{console.log( "ga.color.spectrum.val( " + id + " , " + val + " )" );}
        $( id ).spectrum( { color: val } );
        return;
    }
    return $( id ).spectrum( 'get' ).toHexString();
}
