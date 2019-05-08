'use_strict';

// takes layout from command line and outputs html

ga = {};
ga.layout = {};

const notes = "usage: " +  process.argv[ 1 ] + " inputfile\n\
takes a module html file and extracts ga.layout lines and processes into html\n\
";

const fs = require('fs');

if ( process.argv.length < 3 ) {
    console.log( notes );
    process.exit(-1);
}
inputfile = process.argv[ 2 ];

var inputtext;
try {
    inputtext = fs.readFileSync( inputfile, 'utf8' );
} catch ( err ) {
    console.log( "error reading inputfile: " + err.message );
}

var mylines = inputtext.split("\n");
var evaltxt = "";
for ( var i = 0; i < mylines.length; ++i ) {
    if ( mylines[i].match( /ga\.layout/ ) ) {
        evaltxt += mylines[ i ] + "\n" ;
    }
}

console.error( evaltxt );

eval( evaltxt );

if ( !ga.layout.fields[ 'b_submit' ] ) {
    ga.layout.fields[ "b_submit" ] = {};
    ga.layout.fields[ "b_submit" ].lhtml = '<label class=""></label>';
    ga.layout.fields[ "b_submit" ].dhtml = '<button id="b_submit_button"><span class="buttontext">Submit</span></button><div id="b_submit_buttonval"></div>';
    ga.layout.fields[ "b_submit" ].eval  = '';
}

if ( !ga.layout.fields[ 'b_reset' ] ) {
    ga.layout.fields[ "b_reset" ] = {};
    ga.layout.fields[ "b_reset" ].lhtml = '<label class=""></label>';
    ga.layout.fields[ "b_reset" ].lhtml += '';
    ga.layout.fields[ "b_reset" ].dhtml = '<button id="b_reset_button"><span class="buttontext">Reset</span></button><div id="b_reset_buttonval"></div>';
    ga.layout.fields[ "b_reset" ].dhtml += '';
    ga.layout.fields[ "b_reset" ].eval  = '';
}

// convert ga.layout into html & output

if ( !ga.layout.panel.panels ) {
    console.error( "error JSON contains no panels" );
    process.exit(-202);
}
    
// build parent->child arrays & panel name->position in panel: array object
// var parents = {};

ga.layout.setup = function() {
    ga.layout.children = {};
    ga.layout.panelpos = {};
    for ( var i = 0; i < ga.layout.panel.panels.length; ++i ) {
        var panel = Object.keys( ga.layout.panel.panels[ i ] )[0];
        var parent = ga.layout.panel.panels[ i ][ panel ].parent;
        ga.layout.panelpos[ panel ] = i;
        if ( parent ) {
            // parents[ panel ] = parent;
            ga.layout.children[ parent ] = ga.layout.children[ parent ] || [];
            ga.layout.children[ parent ].push( panel );
        }
    }
    ga.layout.panelfields = {};
    for ( var i = 0; i < ga.layout.panel.fields.length; ++i ) {
        var panel = ga.layout.panel.fields[ i ].layout.parent;
        ga.layout.panelfields[ panel ] = ga.layout.panelfields[ panel ] || [];
        ga.layout.panelfields[ panel ].push( ga.layout.panel.fields[ i ] );
    }
}

// recursively expand the panels

ga.layout.html = function () {
    ga.layout.buttonsused = ga.layout.fields[ 'b_submit' ] || ga.layout.fields[ 'b_reset' ];
    // console.error( "used buttons: " + ga.layout.buttonsused ? "yes" : "no" );
    return ga.layout.thishtml( 'root' );
}

ga.layout.thishtml = function( panel ) {
    var html = "";
    var style = "display:grid";
    if ( ga.layout.panel.panels[ ga.layout.panelpos[ panel ] ][ panel ].gtr ) {
        style += ";grid-template-rows:" + ga.layout.panel.panels[ ga.layout.panelpos[ panel ] ][ panel ].gtr;
    }
    if ( ga.layout.panel.panels[ ga.layout.panelpos[ panel ] ][ panel ].gtc ) {
        style += ";grid-template-columns:" + ga.layout.panel.panels[ ga.layout.panelpos[ panel ] ][ panel ].gtc;
    }
    if ( ga.layout.panel.panels[ ga.layout.panelpos[ panel ] ][ panel ].gr ) {
        style += ";grid-row:" + ga.layout.panel.panels[ ga.layout.panelpos[ panel ] ][ panel ].gr;
    }
    if ( ga.layout.panel.panels[ ga.layout.panelpos[ panel ] ][ panel ].gc ) {
        style += ";grid-column:" + ga.layout.panel.panels[ ga.layout.panelpos[ panel ] ][ panel ].gc;
    }
    if ( ga.layout.panel.panels[ ga.layout.panelpos[ panel ] ][ panel ].gap ) {
        style += ";grid-gap:" + ga.layout.panel.panels[ ga.layout.panelpos[ panel ] ][ panel ].gap;
    }
    if ( ga.layout.panel.panels[ ga.layout.panelpos[ panel ] ][ panel ].align ) {
        style += ";text-align:" + ga.layout.panel.panels[ ga.layout.panelpos[ panel ] ][ panel ].align;
    }
    html += `<div id=ga-panel-${panel} style="${style}">`; // Panel ${panel}`;
    if ( ga.layout.children[ panel ] ) {
        for ( var i = 0; i < ga.layout.children[ panel ].length; ++i ) {
            html += ga.layout.thishtml( ga.layout.children[ panel ][ i ] );
        }
    }
    if ( ga.layout.panelfields[ panel ] ) {
        html += "\n";
        for ( var i = 0; i < ga.layout.panelfields[ panel ].length; ++i ) {
            var lfstyle = "";
            var dfstyle = "";
            var fclass  = "";
            var id = ga.layout.panelfields[ panel ][ i ].id;
            if ( ga.layout.panelfields[ panel ][ i ].role ) {
                fclass += `ga-field-${ga.layout.panelfields[panel][i].role} `;
                if ( !ga.layout.buttonsused &&
                      ga.layout.panelfields[ panel ][ i ].role == 'output' ) {
                    html += ga.layout.buttons();
                }
            }
            if ( ga.layout.panelfields[ panel ][ i ].type ) {
                fclass += `ga-type-${ga.layout.panelfields[panel][i].type} `;
            }
            if ( ga.layout.panelfields[ panel ][ i ].lgr ) {
                lfstyle += "grid-row:" + ga.layout.panelfields[ panel ][ i ].lgr + ";";
            }
            if ( ga.layout.panelfields[ panel ][ i ].lgc ) {
                lfstyle += "grid-column:" + ga.layout.panelfields[ panel ][ i ].lgc + ";";
            }
            if ( ga.layout.panelfields[ panel ][ i ].layout.align ) {
                lfstyle += "text-align:" + ga.layout.panelfields[ panel ][ i ].layout.align + ";";
            }
            if ( ga.layout.panelfields[ panel ][ i ].dgr ) {
                dfstyle += "grid-row:" + ga.layout.panelfields[ panel ][ i ].dgr + ";";
            }
            if ( ga.layout.panelfields[ panel ][ i ].dgc ) {
                dfstyle += "grid-column:" + ga.layout.panelfields[ panel ][ i ].dgc + ";";
            }
            if ( ga.layout.panelfields[ panel ][ i ].layout.align ) {
                dfstyle += "text-align:" + ga.layout.panelfields[ panel ][ i ].layout.align + ";";
            }
            console.error( `id is ${id}` );
            if ( ga.layout.fields[ id ].lhtml && ga.layout.fields[ id ].lhtml.length ) {
                html += `<div id=ga-label-${id} style="${lfstyle}" class="${fclass}">`;
                html +=  ga.layout.fields[ id ].lhtml;
                html += `</div>\n`;
            }
            if ( ga.layout.fields[ id ].dhtml ) {
                html += `<div id=ga-data-${id} style="${dfstyle}" class="${fclass}">`;
                html += ga.layout.fields[ id ].dhtml;
                html += `</div>\n`;
            }
        }
    }

    html += '</div>\n';
    return html;
}
                 
ga.layout.eval = function() {

    var eval = "";

    for ( var i = 0; i < ga.layout.panel.fields.length; ++i ) {
        var id = ga.layout.panel.fields[ i ].id;
        if ( ga.layout.fields[ id ].eval ) {
            eval += ga.layout.fields[ id ].eval;
        }
    }

    // return eval;
    return '';
}

ga.layout.buttons = function() {
    var buttonhtml = "";
    if ( !ga.layout.buttonsused ) {
        for ( var p in ga.layout.buttonhtml ) {
            buttonhtml += `<div id=ga-button-${p} class="ga-button">${ga.layout.buttonhtml[p]}</div>\n`;
        }
    } 
    ga.layout.buttonsused = 1;
    return buttonhtml;
}

ga.layout.setup();

var css = `
.help {
    background-color: rgba(__help_background_color_rgb__, 0.95 );
    color: rgb(__help_text_color_rgb__);
    border-radius: .5em;
    box-shadow: 2px 2px 10px rgba(0, 0, 0, 0.5);
    opacity: 0; /* Make it transparent */
    padding: .5em;
    position: absolute;
    text-decoration: none;
    visibility: hidden; /* and hidden */
    z-index: 10;
}
`;


var html = `
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<style>
${css}
</style>
</head>
<body>
${ga.layout.html()}
${ga.layout.buttons()}
<script>
${ga.layout.eval()}
</script>
</body>
</html>
`;

console.log( html );
