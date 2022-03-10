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
// ga.layout.module.name                             : the module name
// ga.layout.fields[ fieldname ]                     : field data
// ga.layout.fields[ fieldname ].lhtml               : label html
// ga.layout.fields[ fieldname ].dhtml               : data html
// ga.layout.fields[ fieldname ].eval                : eval
// ga.layout.fields[ fieldname ].{lgr,lgc,dgr,dgc}   : css grid values - stored in ga.layout.slayout
// ga.layout.modules[ module ].fields[ fieldname ]   : layout structure by field name
// ----------------------------------------------------------------------------------------------------------
// summary of operations
// ----------------------------------------------------------------------------------------------------------
// ga.layout.process                              : prepare layout
// ga.layout.html                                 : return complete html
// ga.layout.buttons                              : return buttons
// ga.layout.eval                                 : return eval bits
// ga.layout.init                                 : initial parsing of layout for repeat.js which is called early
// ga.layout.rhtml                                : return rhtml for field
// ga.layout.slayout                              : store css grid values for field ... only for repeat entries
// ----------------------------------------------------------------------------------------------------------

ga.layout.init = function () {
    if ( !ga.layout.module ||
         !ga.layout.module.name ) {
        console.error( "ga.layout.init() error: ga.layout.module.name not defined" );
        return;
    }
    if ( !ga.layout.panel ||
         !ga.layout.panel.fields ) {
        console.error( "ga.layout.init() error: ga.layout.panel.fields not defined" );
        return;
    }

    ga.layout.modules = ga.layout.modules || {};
    ga.layout.modules[ ga.layout.module.name ] = ga.layout.modules[ ga.layout.module.name ] || {};
    ga.layout.modules[ ga.layout.module.name ].fields = {};
    
    for ( var i = 0; i < ga.layout.panel.fields.length; ++i ) {
        ga.layout.modules[ ga.layout.module.name ].fields[ ga.layout.panel.fields[ i ].id ] = ga.layout.panel.fields[ i ].layout;
        __~debug:layoutloc{console.log( `in layout.js:setting layout for ${ga.layout.module.name} field ${ga.layout.panel.fields[i].id} to ` + JSON.stringify( ga.layout.panel.fields[i].layout ) );}
    }
}

ga.layout.slayout = function ( field ) {
    __~debug:layoutloc{console.log( `ga.layout.slayout( ${field} )`);}
    var found = false;
    var pos;
    for ( pos = 0; pos < ga.layout.panel.fields.length; ++pos ) {
        if ( ga.layout.panel.fields[ pos ].id && ga.layout.panel.fields[ pos ].id == field ) {
            found = true;
            break;
        }
    }

    if ( !found ) {
        console.error( `ga.layout.slayout( ${field} ) : field does not exist` );
        return;
    }
    
    if ( ga.layout.panel.fields[ pos ].lgc ) {
        ga.layout.fields[ field ].lgc = ga.layout.panel.fields[ pos ].lgc;
    }
    if ( ga.layout.panel.fields[ pos ].lgr ) {
        ga.layout.fields[ field ].lgr = ga.layout.panel.fields[ pos ].lgr;
    }
    if ( ga.layout.panel.fields[ pos ].dgc ) {
        ga.layout.fields[ field ].dgc = ga.layout.panel.fields[ pos ].dgc;
    }
    if ( ga.layout.panel.fields[ pos ].dgr ) {
        ga.layout.fields[ field ].dgr = ga.layout.panel.fields[ pos ].dgr;
    }
}

ga.layout.rhtml = function ( field ) {
    __~debug:layoutloc{console.log( `ga.layout.rhtml( ${field} )`);}
    var found = false;
    var pos;
    for ( pos = 0; pos < ga.layout.panel.fields.length; ++pos ) {
        if ( ga.layout.panel.fields[ pos ].id && ga.layout.panel.fields[ pos ].id == field ) {
            found = true;
            break;
        }
    }

    var htmlopen = `<div id=ga-repeater-${field}`;
    if ( !found ) {
        console.error( `ga.layout.rhtml( ${field} ) : field does not exist` );
        return `${htmlopen}></div>`;
    }

    if ( !ga.layout.panel.fields[ pos ].rgtr ||
         !ga.layout.panel.fields[ pos ].rgtc ||
         !ga.layout.panel.fields[ pos ].rgr ||
         !ga.layout.panel.fields[ pos ].rgc ) {
        console.error( `ga.layout.rhtml( ${field} ) : field does not have a complete set of tags` );
        return `${htmlopen}></div>`;
    }

    if ( ga.layout.panel.fields[ pos ].repeat ) {
        htmlopen += ` style="display:grid;grid-template-rows:${ga.layout.panel.fields[pos].rgtr};grid-template-columns:${ga.layout.panel.fields[pos].rgtc};grid-column:${ga.layout.panel.fields[pos].rgc}`;
    } else {
        htmlopen += ` style="display:grid;grid-template-rows:${ga.layout.panel.fields[pos].rgtr};grid-template-columns:${ga.layout.panel.fields[pos].rgtc};grid-row:${ga.layout.panel.fields[pos].rgr};grid-column:${ga.layout.panel.fields[pos].rgc}`;
    }
    if ( ga.layout.panel.fields[ pos ].ralign ) {
        htmlopen += `;text-align:${ga.layout.panel[pos].ralign}`;
    }
    htmlopen += '"></div>';
    
    __~debug:layoutloc{console.log( `ga.layout.rhtml( ${field} ) returns "${htmlopen}"`);}
    return htmlopen;
}
    
ga.layout.process = function ( defaults ) {
    if ( !defaults ||
         !defaults.resource ) {
        console.error( "ga.layout.process() required defaults object argument not specified" );
        return;
    }
    if ( !ga.layout.module ||
         !ga.layout.module.name ) {
        console.error( "ga.layout.process() error: ga.layout.module.name not defined" );
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
        // skip repeats
        if ( !/^r-/.test( panel ) ) {
            ga.layout.panelfields[ panel ] = ga.layout.panelfields[ panel ] || [];
            ga.layout.panelfields[ panel ].push( ga.layout.panel.fields[ i ] );
        }
    }
}

// recursively expand the panels

ga.layout.html = function ( designer ) {
    ga.layout.buttonsused = ga.layout.fields[ 'b_submit' ] || ga.layout.fields[ 'b_reset' ];
    // console.error( "used buttons: " + ga.layout.buttonsused ? "yes" : "no" );
    if ( !designer ) {
        return ga.layout.thishtml( 'root', false );
    }
    return `
    <div id="ga-dd-grid" class="ga-dd-gridhg">
      <div id="ga-dd-mod" class="ga-dd-mod">
        <!-- right click menu -->
        <div id="ga-dd-menu" class="ga-dd-menu" role="menu" style="display:none;list-style-type:none" >
          <div id="ga-dd-menu-irowu" class="ga-dd-menu-e" onclick="ga.dd.menu('irowu')" >Insert row above</div>
          <div id="ga-dd-menu-irowd" class="ga-dd-menu-e" onclick="ga.dd.menu('irowd')" >Insert row below</div>
          <div id="ga-dd-menu-icoll" class="ga-dd-menu-e" onclick="ga.dd.menu('icoll')" >Insert column left</div>
          <div id="ga-dd-menu-icolr" class="ga-dd-menu-e" onclick="ga.dd.menu('icolr')" >Insert column right</div>
          <hr>
          <div id="ga-dd-menu-iclr" class="ga-dd-menu-e" onclick="ga.dd.menu('iclr')" >Invert Designer colors</div>
        </div>`
        + ga.layout.thishtml( 'root', designer )
        +
     ` </div><!-- ga-dd-mod -->
      <!-- div for designer controls -->
      <div id="ga-dd-dd" class="ga-dd-dd">
        <div class="ga-dd-tab">
          <button class="ga-dd-tablinks" onclick="ga.dd.tab(event, 'ga-dd-details')">Details</button>
          <button class="ga-dd-tablinks" onclick="ga.dd.tab(event, 'ga-dd-layout')">Layout</button>
          <button class="ga-dd-tablinks" onclick="ga.dd.tab(event, 'ga-dd-json')">JSON</button>
          <button class="ga-dd-tablinks" onclick="ga.dd.tab(event, 'ga-dd-module')">Module</button>
          <button class="ga-dd-tablinks" onclick="ga.dd.tab(event, 'ga-dd-palette')">Dictionary</button>
          <button class="ga-dd-tablinks" onclick="ga.dd.tab(event, 'ga-dd-ctrls')">Controls</button>
        </div>

        <div id="ga-dd-details" class="ga-dd-tabcontent">
          <h3>Details</h3>
          <div id="ga-dd-details-content">
          </div>
        </div>
        <div id="ga-dd-layout" class="ga-dd-tabcontent">
          <h3>Layout</h3>
          <div id="ga-dd-layout-content">
          </div>
        </div>
        <div id="ga-dd-json" class="ga-dd-tabcontent">
          <h3>JSON</h3>
          <div id="ga-dd-json-content">
          </div>
        </div>
        <div id="ga-dd-module" class="ga-dd-tabcontent">
          <h3>Module</h3>
          <div id="ga-dd-module-content">
          </div>
        </div>
        <div id="ga-dd-palette" class="ga-dd-tabcontent">
          <h3>Dictionary</h3>
          <div id="ga-dd-palette-content">
          </div>
        </div>
        <div id="ga-dd-ctrls" class="ga-dd-tabcontent">
          <h3>Controls</h3>
          <div id="ga-dd-ctrls-content">
          </div>
        </div>
        
      </div>
      <div id="ga-dd-gutter" class="ga-dd-gutter">
      </div>
    </div>
`;
}

ga.layout.thishtml = function( panel, designer ) {
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
            html += ga.layout.thishtml( ga.layout.children[ panel ][ i ], designer );
        }
    }
    if ( ga.layout.panelfields[ panel ] ) {
        html += "\n";
        for ( var i = 0; i < ga.layout.panelfields[ panel ].length; ++i ) {
            var lfstyle = "";
            var dfstyle = "";
            var rfstyle = "";
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
                if ( designer ) {
                    fclass += 'ga-dd ';
                }
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
            if ( ga.layout.panelfields[ panel ][ i ].rgtr ||
                 ga.layout.panelfields[ panel ][ i ].rgtc ||
                 ga.layout.panelfields[ panel ][ i ].rgr ||
                 ga.layout.panelfields[ panel ][ i ].rgc ) {
                rfstyle += "display:grid;";
            }
//            if ( ga.layout.panelfields[ panel ][ i ].rgtr ) {
//                rfstyle += "grid-template-rows:" + ga.layout.panelfields[ panel ][ i ].rgtr + ";";
//            }
//            if ( ga.layout.panelfields[ panel ][ i ].rgtc ) {
//                rfstyle += "grid-template-columns:" + ga.layout.panelfields[ panel ][ i ].rgtc + ";";
//            }
//            if ( ga.layout.panelfields[ panel ][ i ].rgr ) {
//                rfstyle += "grid-row:" + ga.layout.panelfields[ panel ][ i ].rgr + ";";
//            }
//            if ( ga.layout.panelfields[ panel ][ i ].rgc ) {
//                rfstyle += "grid-column:" + ga.layout.panelfields[ panel ][ i ].rgc + ";";
//            }
            if ( ga.layout.panelfields[ panel ][ i ].layout.align ) {
                rfstyle += "text-align:" + ga.layout.panelfields[ panel ][ i ].layout.align + ";";
            }
            __~debug:layout{console.error( `id is ${id}` );}
            if ( ga.layout.fields[ id ] ) {
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
                if ( ga.layout.fields[ id ].rhtml ) {
                    //                html += `<div id=ga-repeats-container-${id} style="${rfstyle}">`;
                    html += ga.layout.fields[ id ].rhtml;
                    //                html += `</div>\n`;
                }
            } else {
                console.warn( `ga.layout.thishtml(): ga.layout.fields['${id}'] not defined.` );
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
        if ( ga.layout.fields[ id ] && ga.layout.fields[ id ].eval ) {
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

ga.layout.output_ids = function() {
    var result = [];
    if ( !ga.layout.module || !ga.layout.module.json || !ga.layout.module.json.fields ) {
        return result;
    }
    for ( var f in ga.layout.module.json.fields ) {
        if ( ga.layout.module.json.fields[ f ].role &&
             ga.layout.module.json.fields[ f ].id &&
             ga.layout.module.json.fields[ f ].role == "output" ) {
            result.push( ga.layout.module.json.fields[ f ].id );
        }
    }
    return result;
}
