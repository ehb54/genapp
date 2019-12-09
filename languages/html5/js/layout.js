/*jslint white: true, plusplus: true*/
/* assumes: jquery > 1.11.0, jqtree >= 3.0.9, jquery-base64 */

ga.layout = {};

// ----------------------------------------------------------------------------------------------------------
// background
// ----------------------------------------------------------------------------------------------------------
// handles layout 
// ----------------------------------------------------------------------------------------------------------
// summary of data structures
// ----------------------------------------------------------------------------------------------------------
// ga.layout.module.name                          : the module name
// ga.layout.fields[ fieldname ]                  : field data
// ga.layout.fields[ fieldname ].lhtml            : label html
// ga.layout.fields[ fieldname ].dhtml            : data html
// ga.layout.fields[ fieldname ].eval             : eval
// ----------------------------------------------------------------------------------------------------------
// summary of operations
// ----------------------------------------------------------------------------------------------------------
// ga.layout.process                              : prepare layout
// ga.layout.html                                 : return complete html
// ga.layout.buttons                              : return buttons
// ga.layout.eval                                 : return eval bits
// ----------------------------------------------------------------------------------------------------------

ga.layout.process = function ( defaults ) {
    if ( !defaults ||
         !defaults.resource ) {
        console.error( "ga.layout.process() required defaults object argument not specified" );
        return;
    }
    if ( !ga.layout.module ||
         !ga.layout.module.name ) {
        console.error( "ga.layout.process() required ga.layout.module.name set" );
        return;
    }

    var module = ga.layout.module.name;
    if ( !ga.layout.fields[ 'b_submit' ] ) {
        console.error( "layout.js: ga.layout.fields[b_submit] should already be defined" );
        ga.layout.fields[ "b_submit" ] = {};
        ga.layout.fields[ "b_submit" ].lhtml = '<label class=""></label>';
        ga.layout.fields[ "b_submit" ].dhtml = `<button id="${module}_b_submit_button" class="ga-button-submit"><span class="buttontext">Submit</span></button><div id="b_submit_buttonval"></div>`;
    } else {
        ga.layout.fields[ "b_submit" ].dhtml = ga.layout.fields[ "b_submit" ].dhtml.replace( /<button id/, '<button class="ga-button-submit" id' );
    }
// -- submit eval --
    ga.layout.fields[ "b_submit" ].eval  = `
$( "#${module}_b_submit_button" ).click( function( e ) {
    console.log("b_submit");
   e.preventDefault();
   e.returnValue = false;
   $( "#${module}" ).find( ".toclear" ).remove();   
   if ( ${module}_timeout_handler != "unset" ) {
       __~debug:jobtimeout{console.log( "Unsetting previous handler uuid " + ${module}_timeout_handler_uuid );}
       clearTimeout( ${module}_timeout_handler );
       if ( ${module}_timeout_handler_uuid ) {
           ga.ws.unsub( ${module}_timeout_handler_uuid, "${module}" );
       }
       ${module}_timeout_handler = "unset";
   }
   ga.value.resetDefaultValues( "${module}_output", true );
`;
    if ( defaults && defaults.captcha ) {
        ga.layout.fields[ "b_submit" ].eval += `
   ga.captcha( do_${module}_submit, $(this) );
   return false;
`;
    } else {
        ga.layout.fields[ "b_submit" ].eval += `
   return ga.xsede.select( "${defaults.resource}", do_${module}_submit, $(this) );
`;
    }
    ga.layout.fields[ "b_submit" ].eval += `
});
`;
// -- end submit eval

    if ( !ga.layout.fields[ 'b_reset' ] ) {
        console.error( "layout.js: ga.layout.fields[b_reset] should already be defined" );
        ga.layout.fields[ "b_reset" ] = {};
        ga.layout.fields[ "b_reset" ].lhtml = '<label class=""></label>';
        ga.layout.fields[ "b_reset" ].lhtml += '';
        ga.layout.fields[ "b_reset" ].dhtml = `<button id="${module}_b_reset_button" class="ga-button-reset"><span class="buttontext">Reset</span></button><div id="b_reset_buttonval"></div>`;
        ga.layout.fields[ "b_reset" ].dhtml += '';
    } else {
        ga.layout.fields[ "b_reset" ].dhtml = ga.layout.fields[ "b_reset" ].dhtml.replace( /<button id/, '<button class="ga-button-reset" id' );
    }

// -- reset eval --
    ga.layout.fields[ "b_reset" ].eval  = `
$("#${module}_b_reset_button" ).click(function(){
    console.log("b_reset");
    return ${module}_reset();
});`;
// -- end reset eval

    if ( !ga.layout.fields[ `${module}_progress` ] ) {
        ga.layout.fields[ `${module}_progress` ] = {};
        ga.layout.fields[ `${module}_progress` ].lhtml = '';
        ga.layout.fields[ `${module}_progress` ].dhtml = `<span id="${module}_progress"></span>`;
        ga.layout.fields[ `${module}_progress` ].eval = '';
    }

    if ( !ga.layout.fields[ `${module}_output_airavata` ] ) {
        ga.layout.fields[ `${module}_output_airavata` ] = {};
        ga.layout.fields[ `${module}_output_airavata` ].lhtml = '';
        ga.layout.fields[ `${module}_output_airavata` ].dhtml = `<span id="${module}_output_airavata"></span>`;
        ga.layout.fields[ `${module}_output_airavata` ].eval = '';
    }

    if ( !ga.layout.fields[ `${module}_output_msgs` ] ) {
        ga.layout.fields[ `${module}_output_msgs` ] = {};
        ga.layout.fields[ `${module}_output_msgs` ].lhtml = '';
        ga.layout.fields[ `${module}_output_msgs` ].dhtml = `<div id="${module}_output_msgs" class="warning" type="msgs"></div>`;
        ga.layout.fields[ `${module}_output_msgs` ].eval = '';
    }

    if ( !ga.layout.fields[ `${module}_output_textarea` ] ) {
        ga.layout.fields[ `${module}_output_textarea` ] = {};
        ga.layout.fields[ `${module}_output_textarea` ].lhtml = '';
        ga.layout.fields[ `${module}_output_textarea` ].dhtml = `<textarea class="ga-field-output-control" readonly hidden id="${module}_output_textarea"></textarea>`;
        ga.layout.fields[ `${module}_output_textarea` ].eval = '';
    }

    if ( !ga.layout.panel.panels ) {
        console.error( "error JSON contains no panels" );
        return;
    }
    
    ga.layout.setup();
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
//                fclass += `ga-field-${ga.layout.panelfields[panel][i].role}-control `;
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
            __~debug:layout{console.error( `id is ${id}` );}
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

    var myeval = "";

    for ( var i = 0; i < ga.layout.panel.fields.length; ++i ) {
        var id = ga.layout.panel.fields[ i ].id;
        if ( ga.layout.fields[ id ].eval ) {
            myeval += ga.layout.fields[ id ].eval;
        }
    }

    return myeval;
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