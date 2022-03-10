/*jslint white: true, plusplus: true*/

if ( !ga ) {
    var ga = {};
}

ga = ga || {};
ga.fdb = ga.fdb || {};

ga.dd = {};
ga.dd.hv = {};

// ----------------------------------------------------------------------------------------------------------
// background
// ----------------------------------------------------------------------------------------------------------
// handles layout 
// ----------------------------------------------------------------------------------------------------------
// summary of data structures
// ----------------------------------------------------------------------------------------------------------
// ga.dd.on                                 true if drag & drop is active (editing is active)
// ga.dd.intra                              true if intra field movements enabled
// ga.dd.dragid
// ga.dd.dragnode
// ga.dd.draggid
// ga.dd.dragpanelid
// ga.dd.fields.original                    field settings for "reset"
// ga.dd.fields.undo                        array for undos?
// ga.dd.fields.current                     current field settings
// ga.dd.node.dd                            node of id=ga-dd-dd   - the designer area
// ga.dd.node.ddlayout                      layout tab contents
// ga.dd.node.dddetails                     details tab contents
// ga.dd.node.ddjson                        json tab contents
// ga.dd.node.ddmodule                      module tab contents
// ga.dd.node.ddpalette                     palette (dictionary) tab contents
// ga.dd.node.grid                          node of id=ga-dd-grid - the parent cssgrid for the module & designer
// ga.dd.node.mod                           node of id=ga-dd-mod  - the module 
// ga.dd.node.menu                          node of id=ga-dd-menu - the contextmenu
// ----------------------------------------------------------------------------------------------------------
// summary of operations
// ----------------------------------------------------------------------------------------------------------
// ga.dd.dragover                           on dragover event
// ga.dd.drag                               on drag event
// ga.dd.dragleave                          on dragleave event
// ga.dd.drop                               on drop event - main processing
// ga.dd.drop_intra                         drop for intra processing, called by ga.dd.drop
// ga.dd.menu                               receives "choice" from menu
// ga.dd.menuoff                            turns off menu
// ga.dd.reset                              turn on/off dd based upon checkboxes
// ga.dd.seloff                             turn off ga-dd-sel highlighting (remove class)
// ga.dd.hv                                 horizontal/vertical split controls
// ----------------------------------------------------------------------------------------------------------

ga.dd.dragover = function (ev) {
    console.log( `ga.dd.dragover() ev.target.id ${ev.target.id}` );
    ev.preventDefault();
    var to_id = ev.target.id;
    ga.dd.seloff();
    if ( ga.dd.intra ) {
        // get panel and only add if same panel as source
        if ( ga.dd.samepanel( ev ) && ga.dd.dragid != to_id ) {
            ev.target.classList.add( "ga-dd-sel" );
        }
    } else {
        to_id = to_id.replace( /^ga-[a-z]*-/, '' );
        if ( ga.dd.draggid != to_id ) {
            document.getElementById( `ga-label-${to_id}` ).classList.add( "ga-dd-sel" );
            document.getElementById( `ga-data-${to_id}` ).classList.add( "ga-dd-sel" );
        }
    }
}

ga.dd.dragleave = function (ev) {
    console.log( "ga.dd.dragLeave()" );
    ga.dd.seloff();
}

ga.dd.drag = function (ev) {
    console.log( `ga.dd.drag() ev.target.id ${ev.target.id}` );
    ga.dd.dragid      = ev.target.id;
    ga.dd.dragnode    = ev.target;
    ga.dd.dragpanelid = ev.target.parentNode.id;
    ga.dd.draggid     = ev.target.id.replace( /^ga-[a-z]*-/, '' );
    ga.dd.menuoff();
    // in case we want to store in the event
    // ev.dataTransfer.setData("text", ev.target.id);
}

ga.dd.samepanel = function(ev) {
    console.log( `ga.dd.samepanel() source parent id ${ga.dd.dragpanelid} target parent id ${ev.target.parentNode.id}` );
    return ga.dd.dragpanelid == ev.target.parentNode.id;
}

ga.dd.drop_intra = function (ev) {
    var from_id                = ga.dd.dragid;
    var to_id                  = ev.target.id;

    console.log( `ga.dd.drop_intra() from_id ${from_id} to_id ${to_id}` );

    var from_node_style        = ga.dd.dragnode.style;
    var to_node_style          = ev.target.style;

    var from_row               = from_node_style.gridRow;
    var from_col               = from_node_style.gridColumn;
    var to_row                 = to_node_style.gridRow;
    var to_col                 = to_node_style.gridColumn;

    console.log( `ga.dd.drop_intra() from ${from_row},${from_col} to ${to_row},${to_col}` );

    from_node_style.gridRow    = to_row; 
    from_node_style.gridColumn = to_col; 
    to_node_style.gridRow      = from_row; 
    to_node_style.gridColumn   = from_col; 
}

ga.dd.drop = function (ev) {
    console.log( "ga.dd.drop()" );
    ev.preventDefault();
    console.log( ev );
    ga.dd.seloff();
    console.log( `drop() from:${ga.dd.dragid} to:${ev.target}` );

    var samepanel = ga.dd.samepanel( ev );

    if ( ga.dd.intra ) {
        if ( !samepanel ) {
            console.log( "ga.dd.drop() intra drops only allowed within one panel" );
            return;
        }
        return ga.dd.drop_intra( ev );
    }

    // get from & to label & data coordinates

    var from_id = ga.dd.draggid;
    var to_id = ev.target.id.replace( /^ga-[a-z]*-/, '' );

    console.log( `element id from ${from_id} to ${to_id}` );

    var from_label_node       = document.getElementById( `ga-label-${from_id}` );
    var from_data_node        = document.getElementById( `ga-data-${from_id}` );
    var to_label_node         = document.getElementById( `ga-label-${to_id}` );
    var to_data_node          = document.getElementById( `ga-data-${to_id}` );

    if ( from_label_node ) {
        var from_label_node_style = from_label_node.style;
        var from_label_row        = from_label_node_style.gridRow;
        var from_label_col        = from_label_node_style.gridColumn;
    }
    if ( from_data_node ) {
        var from_data_node_style  = from_data_node.style;
        var from_data_row         = from_data_node_style.gridRow;
        var from_data_col         = from_data_node_style.gridColumn;
    }
    if ( to_label_node ) {
        var to_label_node_style   = to_label_node.style;
        var to_label_row          = to_label_node_style.gridRow;
        var to_label_col          = to_label_node_style.gridColumn;
    }
    if ( to_data_node ) {
        var to_data_node_style    = to_data_node.style;
        var to_data_row           = to_data_node_style.gridRow;
        var to_data_col           = to_data_node_style.gridColumn;
    }

    // various choices depending on source & destination types
    // cases:
    // from_label_node && from_data_node && to_label_node && to_data_node
    // from_label_node && from_data_node && to_label_node && !to_data_node
    // from_label_node && from_data_node && !to_label_node && to_data_node
    // from_label_node && !from_data_node && to_label_node && to_data_node
    // !from_label_node && from_data_node && to_label_node && to_data_node
    // from_label_node && !from_data_node && to_label_node && to_data_node
    // from_label_node && from_data_node && !to_label_node && !to_data_node
    // from_label_node && !from_data_node && to_label_node && !to_data_node
    // !from_label_node && from_data_node && to_label_node && to_data_node
    // !from_label_node && from_data_node && to_label_node && to_data_node
    // etc
    // eliminate as many cases as possible

    var mode = 0;
    
    if ( !from_label_node && !from_data_node ) {
        return alert( "drag from nothing?" );
    }
    if ( !to_label_node && !to_data_node ) {
        return alert( "drop to nothing?" );
    }

    var label_ok = from_label_node && to_label_node;
    var data_ok  = from_data_node && to_data_node;
    
    console.log( `from label at ${from_label_row},${from_label_col} data at ${from_data_row},${from_data_col}` );
    console.log( `to label at ${to_label_row},${to_label_col} data at ${to_data_row},${to_data_col}` );

    if ( samepanel ) {
        // swap coordinates
        console.log( "same panel coordinate swap" );
        if ( label_ok ) {
            to_label_node_style.gridRow      = from_label_row;
            to_label_node_style.gridColumn   = from_label_col;
            from_label_node_style.gridRow    = to_label_row;
            from_label_node_style.gridColumn = to_label_col;
        }
        if ( data_ok ) {
            to_data_node_style.gridRow       = from_data_row;
            to_data_node_style.gridColumn    = from_data_col;
            from_data_node_style.gridRow     = to_data_row;
            from_data_node_style.gridColumn  = to_data_col;
        }
    } else {
        console.log( "different panels... to do" );
        // step 1 - increment all parent panel elements past to (ugh rows & columns, assume row logic for now)
        // could probably be in its own function
        // simple assumption of numeric rows, could get uglier

        console.log( ev.target.parentNode.id );
        console.dir( ev.target.parentNode.children );
        
        var to_row_int = parseInt( label_ok ? to_label_row : to_data_row );

        for ( i in ev.target.parentNode.children ) {
            if ( ev.target.parentNode.children.hasOwnProperty(i) ) {
                var this_row_int = parseInt( ev.target.parentNode.children[ i ].style.gridRow );
                console.log( `to_row ${to_row_int} this row ${this_row_int} ${ev.target.parentNode.children[i].id}` );
                
                if ( this_row_int >= to_row_int ) {
                    console.log( `adding 1 to gridRow of ${ev.target.parentNode.children[i].id}` );
                    ev.target.parentNode.children[ i ].style.gridRow = this_row_int + 1;
                }
            }

            // step 2 - assign new row cols to source
            // && step 3 - move to parent panel

            if ( label_ok ) {
                from_label_node_style.gridRow    = to_label_row;
                from_label_node_style.gridColumn = to_label_col;
                ev.target.parentNode.appendChild( from_label_node );
            }
            if ( data_ok ) {
                from_data_node_style.gridRow     = to_data_row;
                from_data_node_style.gridColumn  = to_data_col;
                ev.target.parentNode.appendChild( from_data_node );
            }

        }
    }
}

ga.dd.reset = function () {
    console.log( "ga.dd.reset()" );
    ga.dd.on    = document.getElementById( "ga-dd-on"    ).checked;
    ga.dd.intra = document.getElementById( "ga-dd-inter" ).checked;
    console.log( `ga.dd.on ${ga.dd.on} ga.dd.intra ${ga.dd.intra}` );
    // find dragables class ga-dd
    var dds = document.getElementsByClassName('ga-dd');
    if ( ga.dd.on ) {
        for ( var i in dds ) {
            if ( dds.hasOwnProperty( i ) ) {
                console.log( `${dds[i].id} turning on drag` );
                dds[i].draggable     = true;
                dds[i].ondrop        = function(ev){ga.dd.drop(ev)};
                dds[i].ondragover    = function(ev){ga.dd.dragover(ev)};
                dds[i].ondragleave   = function(ev){ga.dd.dragleave(ev)};
                dds[i].ondragstart   = function(ev){ga.dd.drag(ev)};
                dds[i].oncontextmenu = function(ev){ga.dd.rclick(ev)};
                dds[i].ondblclick    = function(ev){ga.dd.dblclick(ev)};
                dds[i].classList.add( "ga-dd-on" );
            }
        }
    } else {
        for ( var i in dds ) {
            if ( dds.hasOwnProperty( i ) ) {
                console.log( `${dds[i].id} turning off drag` );
                dds[i].draggable     = false;
                dds[i].ondrop        = null;
                dds[i].ondragover    = null;
                dds[i].ondragstart   = null;
                dds[i].oncontextmenu = null;
                dds[i].ondragleave   = null;
                dds[i].ondblclick    = null;
                dds[i].classList.remove( "ga-dd-on" );
            }
        }
    }
    ga.dd.resetgrid();
}    

ga.dd.rclick = function( ev ) {
    var ddmenustyle = document.getElementById( "ga-dd-menu" ).style;
    ddmenustyle.display="none";
    console.log( `ga.dd.rclick() ${ev.target.id}` );
    // console.dir( ev );
    if ( ev.which == 3 ) {
        window.onclick = function() {
            ddmenustyle.display="none";
            ga.dd.seloff();
        }
        ga.dd.seloff();
        console.log( "ga.dd.rclick() got a right click" );
        ddmenustyle.left = ev.clientX + "px";
        ddmenustyle.top  = ev.clientY + "px";
        ddmenustyle.display="block";
        ev.preventDefault();
        var from_id = ev.target.id;
        if ( ga.dd.intra ) {
            document.getElementById( from_id ).classList.add( "ga-dd-sel" );
        } else {
            from_id = from_id.replace( /^ga-[a-z]*-/, '' );
            document.getElementById( `ga-label-${from_id}` ).classList.add( "ga-dd-sel" );
            document.getElementById( `ga-data-${from_id}` ).classList.add( "ga-dd-sel" );
        }
    } else {
        console.log( `ga.dd.rclick() got a click - NOT  right click ev.which ${ev.which}` );
    }
}

ga.dd.setup = function() {
}

ga.dd.seloff = function() {
    console.log( "ga.dd.seloff()" );
    var sel = document.querySelectorAll('.ga-dd-sel');
    for ( var i in sel ) {
        if ( sel.hasOwnProperty( i ) ) {
            sel[i].classList.remove( "ga-dd-sel" );
        }
    }
}

ga.dd.menuoff = function() {
    console.log( 'ga.dd.menuoff()' );
    window.onclick = null;
    document.getElementById( "ga-dd-menu" ).style.display="none";
    ga.dd.seloff();
}

ga.dd.menu = function( choice ) {
    var msg = `ga.dd.menu( "${choice}" )`;
    console.log( msg );
    ga.dd.menuoff();

    var msg_ok = `${msg} command code`;
    switch( choice ) {
    case "irowu" :
        console.log( msg_ok );
        break;
    case "irowd" :
        console.log( msg_ok );
        break;
    case "icoll" :
        console.log( msg_ok );
        break;
    case "icolr" :
        console.log( msg_ok );
        break;
    case "iclr" :
        console.log( msg_ok );
        ga.dd.menu.iclr()
        break;
    default:
        console.warn( `ga.dd.menu(): unknown command ${choice}` );
        break;
    }
}

ga.dd.menu.iclr = function() {
    console.log( "ga.dd.menu.iclr()" );
    var sel = document.querySelectorAll('.ga-dd-menu-e');

    if ( ga.dd.node.dd.classList.contains('ga-dd-iclr') ) {
        // turn off
        ga.dd.node.dd.classList.remove( 'ga-dd-iclr' );
        // ga.dd.node.menu.classList.remove( 'ga-dd-iclr' );
        // for ( var i in sel ) {
        //     if ( sel.hasOwnProperty( i ) ) {
        //         sel[i].classList.remove( 'ga-dd-iclr' );
        //     }
        // }
    } else {
        // turn on
        ga.dd.node.dd.classList.add( 'ga-dd-iclr' );
        // ga.dd.node.menu.classList.add( 'ga-dd-iclr' );
        // for ( var i in sel ) {
        //     if ( sel.hasOwnProperty( i ) ) {
        //         sel[i].classList.add( 'ga-dd-iclr' );
        //     }
        // }
    }
}

ga.dd.gridinit = function() {
    console.log( 'ga.dd.gridinit()' );
    ga.dd.node             = ga.dd.node || {};
    ga.dd.node.dd          = document.getElementById( "ga-dd-dd" );
    ga.dd.node.dddetails   = document.getElementById( "ga-dd-details-content" );
    ga.dd.node.ddlayout    = document.getElementById( "ga-dd-layout-content" );
    ga.dd.node.ddjson      = document.getElementById( "ga-dd-json-content" );
    ga.dd.node.ddmodule    = document.getElementById( "ga-dd-module-content" );
    ga.dd.node.ddpalette   = document.getElementById( "ga-dd-palette-content" );
    ga.dd.node.ddctrls     = document.getElementById( "ga-dd-ctrls-content" );
    ga.dd.node.grid        = document.getElementById( "ga-dd-grid" );
    ga.dd.node.mod         = document.getElementById( "ga-dd-mod" );
    ga.dd.node.menu        = document.getElementById( "ga-dd-menu" );

    ga.dd.node.ddctrls.innerHTML =
        `<label class="ga-dd-pointer" for="ga-dd-inter">Intra field drops:</label><input type="checkbox" id="ga-dd-inter" onclick="ga.dd.reset()"><br>`
        + `<label class="ga-dd-pointer" onclick="ga.dd.menu('iclr')">Invert Designer colors</label><br>`
        + `<label class="ga-dd-pointer" onclick="ga.dd.hv.swap()">Swap designer location</label><br>`
    ;
    ga.dd.moduleinit();
    ga.dd.hv.init();
    ga.dd.menu.iclr(); // start inverted
}

ga.dd.resetgrid = function() {
    console.log( 'ga.dd.resetgrid()' );
    if ( ga.dd.on ) {
        ga.dd.node.grid.style.gridTemplateColumns = ga.dd.prevgtc;
        ga.dd.node.grid.style.gridTemplateRows = ga.dd.prevgtr;
        ga.dd.node.dd.style.display = "block";
        if ( ga.dd.node && ga.dd.node.dclickd ) {
            ga.dd.dblclick( { target : ga.dd.node.dclickd } );
        }
    } else {
        ga.dd.prevgtc = ga.dd.node.grid.style.gridTemplateColumns;
        ga.dd.prevgtr = ga.dd.node.grid.style.gridTemplateRows;;
        ga.dd.node.grid.style.gridTemplateColumns = "1fr";
        ga.dd.node.grid.style.gridTemplateRows = "1fr";
        ga.dd.node.dd.style.display = "none";
        ga.dd.pickoff();
    }
}

ga.dd.moduleinit = function() {
    console.log( 'ga.dd.moduleinit()' );
    if ( !ga.layout ||
         !ga.layout.module ||
         !ga.layout.module.json ||
         !ga.layout.module.json.fields
       ) {
        console.warn( 'ga.dd.moduleinit() : ga.layout.module.json.fields is not defined' );
        return;
    }
    
    ga.dd.fields          = {};
    ga.dd.fields.original = {};
    for ( var i in ga.layout.module.json.fields ) {
        if ( !ga.layout.module.json.fields[i].id ) {
            console.warn( `ga.dd.moduleinit() : fields[${i}].id is not defined` );
        }
        ga.dd.fields.original[ ga.layout.module.json.fields[i].id ] = ga.layout.module.json.fields[i];
    }
    ga.dd.fields.current = ga.dd.fields.original;
    ga.dd.node.ddmodule.innerHTML = '<pre>' + JSON.stringify( ga.layout.module.json, null, 2 ) + '</pre>';
}

ga.dd.dfield = function( id ) {
    console.log( `ga.dd.dfield('${id}')` );
    // display in appropriate tab'd content area
    
    if ( !ga.dd.fields.current[ id ] ) {
        console.warn( `ga.dd.dfield('${id}') : no ga.dd.fields.current['${id}']` );
        ga.dd.node.ddjson.innerHTML = "";
        ga.dd.node.dddetails.innerHTML = "";
        return;
    }

    // JSON

    ga.dd.node.ddjson.innerHTML = '<pre>' + JSON.stringify( ga.dd.fields.current[id], null, 2 ) + '</pre>';

    // Details

    // Module
    // could highlight the field

    // Layout

    var type = ga.dd.fields.current[id].type;
    var role = ga.dd.fields.current[id].role;
    var html = '<div style="display:grid;grid-template-columns:1fr 8fr;grid-gap:5px">';
    if ( !ga.fdb.t ||
         !ga.fdb.t[type] ||
         !ga.fdb.t[type][role] ||
         !ga.fdb.t[type][role].attrib ) {
        console.warn( `ga.dd.dfield('${id}') no ga.fdb.t.${type}.${role}.${attrib}` );
        ga.dd.node.dddetails.innerHTML = '';
    } else {
        html += `<div>id</div><div>${id}</div><div>role</div><div>${role}</div><div>type</div><div>${type}</div>`;
        for ( var i in ga.fdb.t[type][role].attrib ) {
            var attrib = ga.fdb.t[type][role].attrib[i];
            var val    = ga.dd.fields.current[id][attrib];
            html += ga.dd.dfihtml( attrib, val );
        }
        // kludge for overflow-y issue
        html += '</div><br>';
        ga.dd.node.dddetails.innerHTML = html;
    }
}

ga.dd.dfihtml = function( attrib, val ) {
    var dmsg = `ga.dd.dfihtml('${attrib}','${val}')`;
    console.log( dmsg );
    // return html string
    if ( !ga.fdb.d ||
         !ga.fdb.d[attrib] ){
        console.warn( `${dmsg}: no ga.fdb.d[${attrib}]` );
        return '';
    }
    var itype = ga.fdb.d[attrib].type;
    console.log( `${dmsg}: itype=${itype}` );

    if ( !val ) {
        val = '';
    }

    var html=`<div><label for='ga-dd-i-${attrib}'>${attrib}</label></div><div>`;
    // var events = `onblur='ga.dd.ichange("${attrib}")' onchange='ga.dd.ichange("${attrib}")'`;
    var events = `onchange='ga.dd.ichange("${attrib}")'`;
    switch( itype ) {
    case "text" :
        html += `<input id='ga-dd-i-${attrib}' type=text value="${val}" size=60 ${events}>`;
        break;
    case "float" :
        html += `<input id='ga-dd-i-${attrib}' type=number value=${val} size=60 ${events}>`;
        break;
    case "checkbox" :
        if ( val == "true" || val == 1 ) {
            html += `<input id='ga-dd-i-${attrib}' type=checkbox checked=true ${events}>`;
        } else {
            html += `<input id='ga-dd-i-${attrib}' type=checkbox ${events}>`;
        }
        break;
    default:
        console.warn( `${dmsg}: itype=${itype} itype not supported` );
    }
    html += '</div>';
    console.log( `${dmsg}: html='${html}'` );
    return html;
}    

ga.dd.pickoff = function () {
    console.log( "ga.dd.pickoff()" );
    var sel = document.querySelectorAll('.ga-dd-pick');
    for ( var i in sel ) {
        if ( sel.hasOwnProperty( i ) ) {
            sel[i].classList.remove( "ga-dd-pick" );
        }
    }
}

ga.dd.ichange = function( attrib ) {
    console.log( `ga.dd.ichange('${attrib}')` );
}
    
ga.dd.dblclick = function( ev ) {
    console.log( 'ga.dd.dblclick()' );
    ga.dd.node.dclickd = ev.target;
    ga.dd.pickid       = ev.target.id.replace( /^ga-[a-z]*-/, '' );
    ga.dd.pickoff();
    console.log( `ga.dd.dblclick() ev.target.id = ${ev.target.id}` );
    console.log( `ga.dd.dblclick() ga.dd.pickid = ${ga.dd.pickid}` );
    var ele;
    ele = document.getElementById( `ga-label-${ga.dd.pickid}` );
    if ( ele ) {
        document.getElementById( `ga-label-${ga.dd.pickid}` ).classList.add( "ga-dd-pick" );
    }
    ele = document.getElementById( `ga-data-${ga.dd.pickid}` );
    if ( ele ) {
        document.getElementById( `ga-data-${ga.dd.pickid}` ).classList.add( "ga-dd-pick" );
    }
    ga.dd.dfield( ga.dd.pickid );
}
    
ga.dd.tab = function(evt, id) {
    var i, tabcontent, tablinks;

    // Get all elements with class="tabcontent" and hide them
    tabcontent = document.getElementsByClassName("ga-dd-tabcontent");
    for (i = 0; i < tabcontent.length; i++) {
        tabcontent[i].style.display = "none";
    }

    // Get all elements with class="tablinks" and remove the class "active"
    tablinks = document.getElementsByClassName("ga-dd-tablinks");
    for (i = 0; i < tablinks.length; i++) {
        tablinks[i].className = tablinks[i].className.replace(" active", "");
    }

    // Show the current tab, and add an "active" class to the button that opened the tab
    document.getElementById(id).style.display = "block";
    evt.currentTarget.className += " active";
} 

ga.dd.hv.init = function() {
    console.log( "ga.dd.hv.init()" );
    ga.dd.hv.grid   = document.getElementById("ga-dd-grid");
    ga.dd.hv.gs     = ga.dd.hv.grid.style;
    ga.dd.hv.gcl    = ga.dd.hv.grid.classList;
    ga.dd.hv.split  = Split( {} );
    ga.dd.hv.gutter = document.getElementById("ga-dd-gutter");

    if ( ga.dd.hv.gcl.contains("ga-dd-gridhg") ) {
        ga.dd.hv.split.addRowGutter( ga.dd.hv.gutter, 1 );
        ga.dd.hv.lastRows            = ga.dd.hv.gs.gridTemplateRows;
        ga.dd.hv.lastColumns         = ga.dd.hv.lastRows;
        ga.dd.hv.gutter.style.cursor = "row-resize";
    } else {
        ga.dd.hv.split.addColumnGutter( ga.dd.hv.gutter, 1 );
        ga.dd.hv.lastColumns         = ga.dd.hv.gs.gridTemplateColumns;
        ga.dd.hv.lastRows            = ga.dd.hv.lastColumns;
        ga.dd.hv.gutter.style.cursor = "col-resize";
    }
}

ga.dd.hv.swap = function() {
    console.log( "ga.dd.hv.swap()" );
    if ( ga.dd.hv.gcl.contains("ga-dd-gridhg") ) {
        ga.dd.hv.lastRows = ga.dd.hv.gs.gridTemplateRows;
        ga.dd.hv.gcl.remove("ga-dd-gridhg");
        ga.dd.hv.gcl.add("ga-dd-gridvg");
        ga.dd.hv.split.removeRowGutter( 1 );
        ga.dd.hv.split.addColumnGutter( ga.dd.hv.gutter, 1 );
        ga.dd.hv.gs.gridTemplateRows    = "1fr";
        ga.dd.hv.gs.gridTemplateColumns = ga.dd.hv.lastColumns;
        ga.dd.hv.gutter.style.cursor    = "col-resize";
    } else {
        ga.dd.hv.lastColumns = ga.dd.hv.gs.gridTemplateColumns;
        ga.dd.hv.gcl.remove("ga-dd-gridvg");
        ga.dd.hv.gcl.add("ga-dd-gridhg");
        ga.dd.hv.split.removeColumnGutter( 1 );
        ga.dd.hv.split.addRowGutter( ga.dd.hv.gutter, 1 );
        ga.dd.hv.gs.gridTemplateColumns = "1fr";
        ga.dd.hv.gs.gridTemplateRows    = ga.dd.hv.lastRows;
        ga.dd.hv.gutter.style.cursor    = "row-resize";
    }
}
