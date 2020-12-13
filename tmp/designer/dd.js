/*jslint white: true, plusplus: true*/


var ga = {};
ga.dd = {};

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

    var from_label_node_style = from_label_node.style;
    var from_data_node_style  = from_data_node.style;
    var to_label_node_style = document.getElementById( `ga-label-${to_id}` ).style;
    var to_data_node_style  = document.getElementById( `ga-data-${to_id}` ).style;
    

    var from_label_row = from_label_node_style.gridRow;
    var from_label_col = from_label_node_style.gridColumn;
    var from_data_row = from_data_node_style.gridRow;
    var from_data_col = from_data_node_style.gridColumn;

    var to_label_row = to_label_node_style.gridRow;
    var to_label_col = to_label_node_style.gridColumn;
    var to_data_row = to_data_node_style.gridRow;
    var to_data_col = to_data_node_style.gridColumn;

    console.log( `from label at ${from_label_row},${from_label_col} data at ${from_data_row},${from_data_col}` );
    console.log( `to label at ${to_label_row},${to_label_col} data at ${to_data_row},${to_data_col}` );

    if ( samepanel ) {
        // swap coordinates
        console.log( "same panel coordinate swap" );
        to_label_node_style.gridRow    = from_label_row;
        to_label_node_style.gridColumn = from_label_col;
        to_data_node_style.gridRow     = from_data_row;
        to_data_node_style.gridColumn  = from_data_col;
        from_label_node_style.gridRow    = to_label_row;
        from_label_node_style.gridColumn = to_label_col;
        from_data_node_style.gridRow     = to_data_row;
        from_data_node_style.gridColumn  = to_data_col;
        
    } else {
        console.log( "different panels... to do" );
        // step 1 - increment all parent panel elements past to (ugh rows & columns, assume row logic for now)
        // could probably be in its own function
        // simple assumption of numeric rows, could get uglier

        console.log( ev.target.parentNode.id );
        console.dir( ev.target.parentNode.children );
        
        var to_row_int = parseInt( to_label_row );

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
            from_label_node_style.gridRow    = to_label_row;
            from_label_node_style.gridColumn = to_label_col;
            from_data_node_style.gridRow     = to_data_row;
            from_data_node_style.gridColumn  = to_data_col;

            // step 3 - move to parent panel
            ev.target.parentNode.appendChild( from_label_node );
            ev.target.parentNode.appendChild( from_data_node );
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
        ga.dd.node.menu.classList.remove( 'ga-dd-iclr' );
        for ( var i in sel ) {
            if ( sel.hasOwnProperty( i ) ) {
                sel[i].classList.remove( 'ga-dd-iclr' );
            }
        }
    } else {
        // turn on
        ga.dd.node.dd.classList.add( 'ga-dd-iclr' );
        ga.dd.node.menu.classList.add( 'ga-dd-iclr' );
        for ( var i in sel ) {
            if ( sel.hasOwnProperty( i ) ) {
                sel[i].classList.add( 'ga-dd-iclr' );
            }
        }
    }
}

ga.dd.gridinit = function() {
    console.log( 'ga.dd.gridinit()' );
    ga.dd.node             = ga.dd.node || {};
    ga.dd.node.dd          = document.getElementById( "ga-dd-dd" );
    ga.dd.node.dddetails   = document.getElementById( "ga-dd-details-content" );
    ga.dd.node.ddlayout    = document.getElementById( "ga-dd-layout-content" );
    ga.dd.node.ddjson      = document.getElementById( "ga-dd-json-content" );
    ga.dd.node.ddpalette   = document.getElementById( "ga-dd-palette-content" );
    ga.dd.node.grid        = document.getElementById( "ga-dd-grid" );
    ga.dd.node.mod         = document.getElementById( "ga-dd-mod" );
    ga.dd.node.menu        = document.getElementById( "ga-dd-menu" );
    Split({
        columnGutters: [{
            track: 1,
            element: document.querySelector('.ga-dd-vertical-gutter'),
        }]
    });
    ga.dd.moduleinit();
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
    

    // Layout

    var type = ga.dd.fields.current[id].type;
    var role = ga.dd.fields.current[id].role;
    var html;
    if ( !ga.fdb ||
         !ga.fdb[type] ||
         !ga.fdb[type][role] ||
         !ga.fdb[type][role].attrib ) {
        console.warn( `ga.dd.dfield('${id}') no ga.fdb.${type}.${role}.${attrib}` );
        ga.dd.node.dddetails.innerHTML = '';
    } else {
        html = `id : ${id}<br>role : ${role}<br>type : ${type}<br>`;
        for ( var i in ga.fdb[type][role].attrib ) {
            var attrib = ga.fdb[type][role].attrib[i];
            var val    = ga.dd.fields.current[id][attrib];
            html += `${attrib} : `
            if ( val ) {
                html += ga.dd.fields.current[id][attrib];
            }
            html += '<br>';    
        }
        ga.dd.node.dddetails.innerHTML = html;
    }
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
    
ga.dd.dblclick = function( ev ) {
    console.log( 'ga.dd.dblclick()' );
    ga.dd.node.dclickd = ev.target;
    ga.dd.pickid       = ev.target.id.replace( /^ga-[a-z]*-/, '' );
    ga.dd.pickoff();
    document.getElementById( `ga-label-${ga.dd.pickid}` ).classList.add( "ga-dd-pick" );
    document.getElementById( `ga-data-${ga.dd.pickid}` ).classList.add( "ga-dd-pick" );
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

