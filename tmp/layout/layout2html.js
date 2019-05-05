'use_strict';

// takes layout from command line and outputs html

ga = {};
ga.grid = {};

const notes = "usage: " +  process.argv[ 1 ] + " inputfile\n\
converts json in inputfile to css and outputs it\n\
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


var json = {};
try {
    json = JSON.parse( inputtext );
} catch (err) {
    console.error( "error JSON parsing inputfile: " + err );
    process.exit(-201);
}

// convert json into html & output

if ( !json.panels ) {
    console.error( "error JSON contains no panels" );
    process.exit(-202);
}
    
// build parent->child arrays & panel name->position in panel: array object
// var parents = {};

var children = {};
var panelpos = {};
for ( var i = 0; i < json.panels.length; ++i ) {
    var panel = Object.keys( json.panels[ i ] )[0];
    var parent = json.panels[ i ][ panel ].parent;
    panelpos[ panel ] = i;
    if ( parent ) {
        // parents[ panel ] = parent;
        children[ parent ] = children[ parent ] || [];
        children[ parent ].push( panel );
    }
}

var panelfields = {};
for ( var i = 0; i < json.fields.length; ++i ) {
    var panel = json.fields[ i ].layout.parent;
    panelfields[ panel ] = panelfields[ panel ] || [];
    panelfields[ panel ].push( json.fields[ i ] );
}

// recursively expand the panels

ga.grid.thishtml = function( panel ) {
    var html = "";
    var style = "display:grid";
    if ( json.panels[ panelpos[ panel ] ][ panel ].gtr ) {
        style += ";grid-template-rows:" + json.panels[ panelpos[ panel ] ][ panel ].gtr;
    }
    if ( json.panels[ panelpos[ panel ] ][ panel ].gtc ) {
        style += ";grid-template-columns:" + json.panels[ panelpos[ panel ] ][ panel ].gtc;
    }
    if ( json.panels[ panelpos[ panel ] ][ panel ].gr ) {
        style += ";grid-row:" + json.panels[ panelpos[ panel ] ][ panel ].gr;
    }
    if ( json.panels[ panelpos[ panel ] ][ panel ].gc ) {
        style += ";grid-column:" + json.panels[ panelpos[ panel ] ][ panel ].gc;
    }
    if ( json.panels[ panelpos[ panel ] ][ panel ].align ) {
        style += ";text-align:" + json.panels[ panelpos[ panel ] ][ panel ].align;
    }
    html += `<div id=ga-panel-${panel} style="${style}">`; // Panel ${panel}`;
    if ( children[ panel ] ) {
        for ( var i = 0; i < children[ panel ].length; ++i ) {
            html += ga.grid.thishtml( children[ panel ][ i ] );
        }
    }
    if ( panelfields[ panel ] ) {
        for ( var i = 0; i < panelfields[ panel ].length; ++i ) {
            var lfstyle = "";
            var dfstyle = "";
            var id = panelfields[ panel ][ i ].id;
            if ( panelfields[ panel ][ i ].lgr ) {
                lfstyle += "grid-row:" + panelfields[ panel ][ i ].lgr + ";";
            }
            if ( panelfields[ panel ][ i ].lgc ) {
                lfstyle += "grid-column:" + panelfields[ panel ][ i ].lgc + ";";
            }
            if ( panelfields[ panel ][ i ].layout.align ) {
                lfstyle += "text-align" + panelfields[ panel ][ i ].layout.align + ";";
            }
            if ( panelfields[ panel ][ i ].dgr ) {
                dfstyle += "grid-row:" + panelfields[ panel ][ i ].dgr + ";";
            }
            if ( panelfields[ panel ][ i ].dgc ) {
                dfstyle += "grid-column:" + panelfields[ panel ][ i ].dgc + ";";
            }
            if ( panelfields[ panel ][ i ].layout.align ) {
                dfstyle += "text-align" + panelfields[ panel ][ i ].layout.align + ";";
            }
            html += `<div id=ga-label-${id} style="${lfstyle}">label-${id}</div>
<div id=ga-data-${id} style="${dfstyle}">data-${id}</div>
`;
        }
    }

    html += '</div>\n';
    return html;
}
                 
var html = `<html lang="en">
<head>
<meta charset="utf-8"/>
</head>
<body>
${ga.grid.thishtml('root')}
</body>
</html>
`;

console.log( html );



