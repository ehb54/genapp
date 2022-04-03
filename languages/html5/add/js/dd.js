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
// ga.dd.pid                                turns panel ids on/off
// ga.dd.fid                                turns field ids on/off
// ga.dd.panel                              turns panel backgrounds on/off
// ga.dd.ninfo                              returns structure of node state, e.g. type, panel parent etc, any fields/labels
// ----------------------------------------------------------------------------------------------------------
// summary of DOM classes
// ----------------------------------------------------------------------------------------------------------
//
// "static" classes
//
// ga-dd                                    all elements that can be dragged or dropped
// ga-dd-drop                               all elements that can be dropped to
// ga-dd-grid                               parent
// ga-dd-mod                                module area
// ga-dd-menu                               right-click menu
// ga.dd.menu-e                             menu links (onclick events)
// ga-dd-dd                                 designer area
// ga-dd-dd-tab                             the designer area tabs
// ga-dd-dd-tablinks                        the designer area tab buttons to drigger events in ga.dd.tab()
// ga-dd-dd-tabcontent                      the designer area content
// ga-dd-gutter                             gutter for designer
// ga-dd-fid                                field id with data or label tag
// ga-dd-pid                                panel id
//
// "dynamic" classes (added or removed based upon state/actions)
//
// ga-dd-on                                 toggles on all elements with class ga-dd (dragable/dropable)
// ga-dd-sel                                identifies selected elements when dragover
// ga-dd-fid-on                             toggles field ids on
// ga-dd-pid-on                             toggles panel ids on (ga.dd.pid())

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
            var to_label_node = document.getElementById( `ga-label-${to_id}` );
            if ( to_label_node ) {
                to_label_node.classList.add( "ga-dd-sel" );
            }
            var to_data_node = document.getElementById( `ga-label-${to_id}` );
            if ( to_data_node ) {
                to_data_node.classList.add( "ga-dd-sel" );
            }
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
            alert( "intra field drops are checked & intra drops are only allowed in the same panel" );
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
    
    // var to_empty_panel = 0;
    
    if ( !from_label_node && !from_data_node ) {
        return alert( "drag from nothing?" );
    }
    if ( !to_label_node && !to_data_node ) {
        // is it to a panel?
        return alert( `drop to nothing from ${from_id} to ${to_id}?` );
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

        console.log( `drop parent node id ${ev.target.parentNode.id}` );
        console.dir( ev.target.parentNode.children );
        
        var to_row_int = parseInt( label_ok ? to_label_row : to_data_row );

        // perhaps we need to keep going up parents until we have a panel ?
        // classList.contains("ga-dd-panel") ?
        var panelparent = ev.target;
        while ( panelparent && !panelparent.classList.contains("ga-dd-panel") ) {
            panelparent = panelparent.parentNode;
        }
       
        for ( i in panelparent.children ) {
            if ( panelparent.children.hasOwnProperty(i) ) {
                var this_row_int = parseInt( panelparent.children[ i ].style.gridRow );
                console.log( `to_row ${to_row_int} this row ${this_row_int} ${panelparent.children[i].id}` );
                
                if ( this_row_int >= to_row_int ) {
                    console.log( `adding 1 to gridRow of ${panelparent.children[i].id}` );
                    panelparent.children[ i ].style.gridRow = this_row_int + 1;
                }
            }

            // step 2 - assign new row cols to source
            // && step 3 - move to parent panel

            if ( label_ok ) {
                from_label_node_style.gridRow    = to_label_row;
                from_label_node_style.gridColumn = to_label_col;
                panelparent.appendChild( from_label_node );
            }
            if ( data_ok ) {
                from_data_node_style.gridRow     = to_data_row;
                from_data_node_style.gridColumn  = to_data_col;
                panelparent.appendChild( from_data_node );
            }

        }
    }
}

ga.dd.reset = function () {
    console.log( "ga.dd.reset()" );
    ga.dd.on        = document.getElementById( "ga-dd-on"        ).checked;
    ga.dd.intra     = document.getElementById( "ga-dd-inter"     ).checked;
    ga.dd.showpid   = document.getElementById( "ga-dd-showpid"   ).checked;
    ga.dd.showfid   = document.getElementById( "ga-dd-showfid"   ).checked;
    ga.dd.showpanel = document.getElementById( "ga-dd-showpanel" ).checked;

    // console.log( `ga.dd.on ${ga.dd.on} ga.dd.intra ${ga.dd.intra}` );
    // find dragables class ga-dd
    var dds     = document.getElementsByClassName('ga-dd');
    var ddsdrop = document.getElementsByClassName('ga-dd-drop');
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
        for ( var i in ddsdrop ) {
            if ( ddsdrop.hasOwnProperty( i ) ) {
                console.log( `${ddsdrop[i].id} turning on drop` );
                ddsdrop[i].ondrop        = function(ev){ga.dd.drop(ev)};
                ddsdrop[i].ondragover    = function(ev){ga.dd.dragover(ev)};
                ddsdrop[i].ondragleave   = function(ev){ga.dd.dragleave(ev)};
                ddsdrop[i].oncontextmenu = function(ev){ga.dd.rclick(ev)};
                ddsdrop[i].ondblclick    = function(ev){ga.dd.dblclick(ev)};
                // ddsdrop[i].classList.add( "ga-dd-on" );
            }
        }
        ga.dd.pid  (ga.dd.showpid);
        ga.dd.fid  (ga.dd.showfid);
        ga.dd.panel(ga.dd.showpanel);
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
        for ( var i in ddsdrop ) {
            if ( ddsdrop.hasOwnProperty( i ) ) {
                console.log( `${ddsdrop[i].id} turning off drop` );
                ddsdrop[i].ondrop        = null;
                ddsdrop[i].ondragover    = null;
                ddsdrop[i].ondragleave   = null; 
                ddsdrop[i].oncontextmenu = null;
                ddsdrop[i].ondblclick    = null;
                // ddsdrop[i].classList.add( "ga-dd-on" );
            }
        }
        ga.dd.pid(0);
        ga.dd.fid(0);
        ga.dd.panel(0);
    }
    ga.dd.resetgrid();
}    

ga.dd.setmenuinfo = function ( node ) {
    console.log( `ga.dd.setmenuinfo() ${node}` );

    var menuinfo = document.getElementById( "ga-dd-menu-info" );
    menuinfo.innerHTML = 'unknown';

    var nstate   = ga.dd.nstate( node );

    // panels
    if ( node.classList.contains( "ga-dd-pid" ) ) {
        menuinfo.innerHTML =
            `id: "${nstate.panel.id}"`
            + `<br><label onclick="ga.dd.editpgrid('${nstate.panel.id}')">label: panel rows: ${nstate.panel.style.gridTemplateRows}; columns: ${nstate.panel.style.gridTemplateColumns}</label>`
        ;
        return;
    }

    menuinfo.innerHTML =
        `id: "${node.id}"`;

    if ( nstate.label && nstate.label.style ) {
        menuinfo.innerHTML +=
            `<br><label onclick="ga.dd.editfgrid('${nstate.label.id}')">label: grid pos: ${nstate.label.style.gridRow}; ${nstate.label.style.gridColumn}</label>`
        ;
    }
    if ( nstate.data && nstate.data.style ) {
        menuinfo.innerHTML +=
            `<br><label onclick="ga.dd.editfgrid('${nstate.data.id}')">data: grid pos: ${nstate.data.style.gridRow}; ${nstate.data.style.gridColumn}</label>`
        ;
    }

    if ( nstate.data || nstate.label ) {
        var menucmds = document.getElementById( "ga-dd-menu-cmds" );
        menucmds.innerHTML =
            `<div id="ga-dd-menu-drop" class="ga-dd-menu-e" onclick="ga.dd.menu(\'drop\','${node.id}')" >Drop to row below</div>`
            + menucmds.innerHTML
        ;
        if ( ( nstate.data && nstate.data.style.gridRow > 1 ) ||
             ( nstate.label && nstate.label.style.gridRow > 1 ) ) {
            menucmds.innerHTML =
                `<div id="ga-dd-menu-join" class="ga-dd-menu-e" onclick="ga.dd.menu(\'join\','${node.id}')" >Join to row above</div>`
                + menucmds.innerHTML
            ;
        }

    }
}

ga.dd.rclick = function( ev ) {
    var ddmenustyle = document.getElementById( "ga-dd-menu" ).style;
    ddmenustyle.display="none";
    var pld_node = ga.dd.pld( ev.target );
    console.log( `ga.dd.rclick( ${ev.target.id} ) pld node ${pld_node}` );

    // console.dir( ev );
    if ( ev.which == 3 && pld_node ) {
        window.onclick = function() {
            ddmenustyle.display="none";
            ga.dd.seloff();
        }
        ga.dd.seloff();
        console.log( "ga.dd.rclick() got a right click" );
        var ddmenucmds = document.getElementById( "ga-dd-menu-cmds" );
        ddmenucmds.innerHTML = 
            '<div id="ga-dd-menu-irowu" class="ga-dd-menu-e" onclick="ga.dd.menu(\'irowu\')" >Insert row above</div>'
            + '<div id="ga-dd-menu-irowd" class="ga-dd-menu-e" onclick="ga.dd.menu(\'irowd\')" >Insert row below</div>'
            + '<div id="ga-dd-menu-icoll" class="ga-dd-menu-e" onclick="ga.dd.menu(\'icoll\')" >Insert column left</div>'
            + '<div id="ga-dd-menu-icolr" class="ga-dd-menu-e" onclick="ga.dd.menu(\'icolr\')" >Insert column right</div>'
        ;

        ddmenustyle.left = ev.clientX + "px";
        ddmenustyle.top  = ev.clientY + "px";
        ddmenustyle.display="block";
        ev.preventDefault();
        var from_id = pld_node.id;
        if ( ga.dd.intra ) {
            document.getElementById( from_id ).classList.add( "ga-dd-sel" );
        } else {
            from_id = from_id.replace( /^ga-[a-z]*-/, '' );
            var from_label_node = document.getElementById( `ga-label-${from_id}` );
            if ( from_label_node ) {
                from_label_node.classList.add( "ga-dd-sel" );
            }
            var from_data_node = document.getElementById( `ga-data-${from_id}` );
            if ( from_data_node ) {
                from_data_node.classList.add( "ga-dd-sel" );
            }
        }
        ga.dd.setmenuinfo( pld_node );
    } else {
        console.log( `ga.dd.rclick() got a click - NOT right click ev.which ${ev.which} or NOT pld_node` );
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

ga.dd.menu = function( choice, arg ) {
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
    case "join" :
        console.log( msg_ok );
        ga.dd.moveele( arg, {rowadjust:-1} );
        break;
    case "drop" :
        console.log( msg_ok );
        ga.dd.moveele( arg, {rowadjust:1} );
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
        `<input type="checkbox" id="ga-dd-inter" onclick="ga.dd.reset()"><label class="ga-dd-pointer" for="ga-dd-inter"> Intra field drops</label><br>`
        + `<input type="checkbox" checked id="ga-dd-showfid" onclick="ga.dd.reset()"><label class="ga-dd-pointer" for="ga-dd-showfid"> Show field ids</label><br>`
        + `<input type="checkbox" checked id="ga-dd-showpid" onclick="ga.dd.reset()"><label class="ga-dd-pointer" for="ga-dd-showpid"> Show panel ids</label><br>`
        + `<input type="checkbox" checked id="ga-dd-showpanel" onclick="ga.dd.reset()"><label class="ga-dd-pointer" for="ga-dd-showpanel"> Show panel backgrounds</label><br>`
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

ga.dd.fid = function ( state ) {
    console.log( "ga.dd.fid()" );
    // toggle elements with class
    // find dragables class ga-dd
    var fids = document.getElementsByClassName('ga-dd-fid');
    if ( fids === 'undefined' ) {
        console.log( "ga.dd.fid() no fids" );
        return;
    }
    if ( typeof state !== 'undefined' ? !state : fids[0].classList.contains("ga-dd-fid-on") ) {
        for ( var i in fids ) {
            if ( fids.hasOwnProperty( i ) ) {
                // console.log( `ga.dd.fid() removing property ${i}` );
                fids[i].classList.remove( "ga-dd-fid-on" );
            }
        }
    } else {
        for ( var i in fids ) {
            if ( fids.hasOwnProperty( i ) ) {
                // console.log( `ga.dd.fid() adding property ${i}` );
                fids[i].classList.add( "ga-dd-fid-on" );
            }
        }
    }
}        

ga.dd.pid = function ( state ) {
    console.log( "ga.dd.pid()" );
    // toggle elements with class
    // find dragables class ga-dd
    var pids = document.getElementsByClassName('ga-dd-pid');
    if ( pids === 'undefined' ) {
        console.log( "ga.dd.pid() no pids" );
        return;
    }

    if ( typeof state !== 'undefined' ? !state : pids[0].classList.contains("ga-dd-pid-on") ) {
        for ( var i in pids ) {
            if ( pids.hasOwnProperty( i ) ) {
                // console.log( `ga.dd.pid() removing property ${i}` );
                pids[i].classList.remove( "ga-dd-pid-on" );
            }
        }
    } else {
        for ( var i in pids ) {
            if ( pids.hasOwnProperty( i ) ) {
                // console.log( `ga.dd.pid() adding property ${i}` );
                pids[i].classList.add( "ga-dd-pid-on" );
            }
        }
    }
}

ga.dd.panel = function ( state ) {
    console.log( "ga.dd.panel()" );
    // toggle elements with class
    // find dragables class ga-dd
    var panels = document.getElementsByClassName('ga-dd-panel');
    if ( panels === 'undefined' ) {
        console.log( "ga.dd.panel() no panels" );
        return;
    }

    if ( typeof state !== 'undefined' ? !state : panels[0].classList.contains("ga-dd-panel-on") ) {
        for ( var i in panels ) {
            if ( panels.hasOwnProperty( i ) ) {
                // console.log( `ga.dd.panel() removing property ${i}` );
                panels[i].classList.remove( "ga-dd-panel-on" );
                panels[i].style["background-image"] = "none";
            }
        }
    } else {
        var ofs = 0;
        for ( var i in panels ) {
            if ( panels.hasOwnProperty( i ) ) {
                // console.log( `ga.dd.panel() adding property ${i}` );
                panels[i].classList.add( "ga-dd-panel-on" );
                // var tmpx = ga.dd.panel.bgs[ ofs++ % ga.dd.panel.bgs.length ];
                panels[i].style["background-image"] = ga.dd.panel.bgs[ ofs++ % ga.dd.panel.bgs.length ];
                // console.log( `ga.dd.panel() adding property ${i} style bgi (should be ` + ga.dd.panel.bgs[ (ofs - 1 ) % ga.dd.panel.bgs.length ] + ')' +  panels[i].style["background-image"] );
            }
        }
    }
}
    
ga.dd.panel.bgs = [
//    "repeating-conic-gradient(midnightblue 8%,darkslategrey 20%)"
    "repeating-conic-gradient(#000020 5%, darkslategrey 20%)"
    ,"repeating-conic-gradient(#002000 6%, darkslategrey 20%)"
    ,"repeating-conic-gradient(#200000 7%, darkslategrey 20%)"
    ,"repeating-conic-gradient(#200020 8%, darkslategrey 20%)"
    ,"repeating-conic-gradient(#202000 9%, darkslategrey 20%)"
    ,"repeating-conic-gradient(#202020 10%, darkslategrey 20%)"
    ,"repeating-conic-gradient(#000000 11%, darkslategrey 20%)"
    ,"repeating-conic-gradient(#000020 12%, darkslategrey 20%)"
    ,"repeating-conic-gradient(#002000 13%, darkslategrey 20%)"
    ,"repeating-conic-gradient(#200000 14%, darkslategrey 20%)"
    ,"repeating-conic-gradient(#200020 15%, darkslategrey 20%)"
    ,"repeating-conic-gradient(#202000 16%, darkslategrey 20%)"
    ,"repeating-conic-gradient(#202020 17%, darkslategrey 20%)"
    ,"repeating-conic-gradient(#000000 18%, darkslategrey 20%)"
    // ,"repeating-linear-gradient(midnightblue, darkgrey 10%, black 20%)"
    // ,"repeating-radial-gradient(mediumseagreen, darkgrey 10%, black 20%)"
    // ,"conic-gradient(darkolivegreen,black,darkolivegreen)"
    // ,"linear-gradient(dimgrey,black,dimgrey)"
    // ,"radial-gradient(purple,black,cyan)"
];

ga.dd.pld = function ( node ) {
    // finds closest panel, label or data associated with node
    console.log( `ga.dd.pld( ${node.id} )` );

    var result = {};
    
    result = node;
    while ( result && !result.classList.contains("ga-dd-panel") && !result.classList.contains("ga-dd") ) {
        result = result.parentNode;
    }
    return result;
}

ga.dd.nstate = function ( node ) {
    console.log( `ga.dd.nstate( ${node.id} )` );

    var result = {};

    result.panel = node;
    while ( result.panel && !result.panel.classList.contains("ga-dd-panel") ) {
        result.panel = result.panel.parentNode;
    }

    if ( !result.panel || result.panel === 'undefined' ) {
        console.log( "ga.dd.nstate() no panel found" );
        return result;
    }
    
    result.id     = node.id.replace( /^ga-[a-z]*-/, '' );

    result.cnodes = result.panel.getElementsByClassName( "ga-dd" );
    result.label  = document.getElementById( `ga-label-${result.id}` );
    result.data   = document.getElementById( `ga-data-${result.id}` );

    return result;
}

ga.dd.nstate.gridinfo = function ( nstate ) {
    if ( !nstate || !nstate.id ) {
        console.error( 'ga.dd.nstate() called without a proper value' );
        return;
    }

    console.log( `ga.dd.nstate( ${nstate.id} )` );
    
    if ( !nstate.cnodes ) {
        console.error( `ga.dd.nstate( ${nstate.id} ) has empty cnodes` );
        return;
    }

    // compute last columns for each row
    nstate.colmax = [];
    for ( var i = 0; i < nstate.cnodes.length; ++i ) {
        var colend   = /^\d*$/.test( nstate.cnodes[i].style.gridColumnEnd ) ? nstate.cnodes[i].style.gridColumnEnd : +nstate.cnodes[i].style.gridColumn;
        var rowstart = +nstate.cnodes[i].style.gridRowStart;
        var rowend   = /^\d*$/.test( nstate.cnodes[i].style.gridRowEnd ) ? nstate.cnodes[i].style.gridRowEnd : rowstart;
        console.log( `nstate.cnodes[${i}] colend ${colend} rowend ${rowend}` );
        for ( var j = rowstart; j <= rowend; ++j ) {
            nstate.colmax[j] = nstate.colmax[j] || 0;
            if ( nstate.colmax[j] < colend ) {
                nstate.colmax[j] = colend;
            }
        }
    }
}


ga.dd.editpgrid = function( pid ) {
    console.log( `ga.dd.editpgrid( ${pid} )` );

    // panel edit

}

ga.dd.editfgrid = function( fid ) {
    console.log( `ga.dd.editfgrid( ${fid} )` );

    // field edit
}

ga.dd.etype = function ( id ) {
    return id.replace( /^ga-/, '' ).replace( /-.*$/, '' );
}

ga.dd.moveele = function ( id, options ) {
    console.log( `ga.dd.moveele( ${id} )` );
    var from_node = document.getElementById( id );
    if ( !from_node ) {
        console.error( `ga.dd.moveele( ${id} ) id=$id not found in DOM` );
        return;
    }
    
    var nstate = ga.dd.nstate( from_node );

    if ( !nstate.cnodes ) {
        console.error( `ga.dd.moveele( ${id} ) no nodes found in panel` );
        return;
    }

    if ( !options || !options.rowadjust ) {
        console.error( `ga.dd.moveele( ${id} ) requires options:rowadjust` );
        return;
    }
        
    console.log( `ga.dd.moveele( ${id} ) 1` );
    console.dir( nstate.cnodes );
        
    console.log( `ga.dd.moveele( ${id} ) 2` );
    ga.dd.nstate.gridinfo( nstate );

    console.log( `ga.dd.moveele( ${id} ) 3` );
    console.dir( nstate.colmax );

    if ( nstate.label && ( !ga.dd.intra || ga.dd.etype( id ) == 'label' ) ) {
        var label_col_start    = +nstate.label.style.gridColumnStart;
        var label_col_end_auto = nstate.label.style.gridColumnEnd == 'auto';

        if ( !label_col_end_auto ) {
            var label_col_length = +nstate.label.style.gridColumnEnd - +nstate.label.style.gridColumnStart;
        }

        var label_rowstart    = +nstate.label.style.gridRowStart;
        var label_rowend_auto = nstate.label.style.gridRowEnd == 'auto';
        if ( !label_rowend_auto ) {
            var label_row_length = +nstate.label.style.gridRowEnd - +nstate.label.style.gridRowStart;
        }
        console.log( `ga.dd.moveele( ${id} ) rowstart ${label_rowstart} ${label_row_length}` );
        
        var label_new_row      = label_rowstart + options.rowadjust;
        var label_new_col      = ( nstate.colmax[label_new_row] ? nstate.colmax[label_new_row] : 0 ) + 1;

        nstate.label.style.gridRowStart   = label_new_row;
        if ( !label_rowend_auto ) {
            nstate.label.style.gridRowEnd = label_new_row + label_row_length;
        }

        nstate.label.style.gridColumnStart   = label_new_col;
        if ( !label_col_end_auto ) {
            nstate.label.style.gridColumnEnd = label_new_col + data_col_length;
        }

        // recompute grid info if data
        if ( nstate.data ) {
            ga.dd.nstate.gridinfo( nstate );
        }
    }

    if ( nstate.data && ( !ga.dd.intra || ga.dd.etype( id ) == 'data' )) {
        var data_col_start    = +nstate.data.style.gridColumnStart;
        var data_col_end_auto = nstate.data.style.gridColumnEnd == 'auto';
        if ( !data_col_end_auto ) {
            var data_col_length = +nstate.data.style.gridColumnEnd - +nstate.data.style.gridColumnStart;
        }

        var data_rowstart    = +nstate.data.style.gridRowStart;
        var data_rowend_auto = nstate.data.style.gridRowEnd == 'auto';
        if ( !data_rowend_auto ) {
            var data_row_length = +nstate.data.style.gridRowEnd - +nstate.data.style.gridRowStart;
        }
        
        var data_new_row      = data_rowstart + options.rowadjust;
        var data_new_col      = ( nstate.colmax[data_new_row] ? nstate.colmax[data_new_row] : 0 ) + 1;

        nstate.data.style.gridRowStart   = data_new_row;
        if ( !data_rowend_auto ) {
            nstate.data.style.gridRowEnd = data_new_row + data_row_length;
        }

        nstate.data.style.gridColumnStart   = data_new_col;
        if ( !data_col_end_auto ) {
            nstate.data.style.gridColumnEnd = data_new_col + data_col_length;
        }
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


ga.dd.dom2mod = function () {
    console.log( `ga.dd.dom2mod()` );
    // build module json from DOM and current module json
    // see ga.dd.moduleinit for start
    // https://genapp.rocks/wiki/wiki/docs_layout

    // perhaps first get panels

    // id ga-dd-mod ... ga-dd-panels below
    // not sure if there is a nice selector, perhaps traverse the "ga-dd-mod" element's children
    // recursive setup seems right
    // ga.dd.dom2mod.cpanels( parentnode, panels ) ?
    
    var panels = {};
    var node = ga.dd.node.mod;

    ga.dd.dom2mod.cpanels( document.getElementById( "ga-dd-mod" ), panels );
    console.log( "panels:\n" + JSON.stringify( panels, null, 2 ) );
    console.dir( panels );
}

ga.dd.dom2mod.cpanels = function( node, panels ) {
    
    var parent = node.classList.contains( "ga-dd-panel" ) ? node.id.replace( /^ga-panel-/, '' ) : null;
    
    for ( var i in node.children ) {
        if ( node.children.hasOwnProperty(i) ) {
            if ( node.children[i].classList.contains( "ga-dd-panel" ) ) {
                var pid = node.children[i].id.replace( /^ga-panel-/, '' );
                panels[ pid ] = {};
                if ( parent ) {
                    panels[ pid ].parent = parent;
                }
                ga.dd.dom2mod.cpanels( node.children[i], panels );
            }
        }
    }
}

    
