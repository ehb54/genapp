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
    var to_node = ga.dd.pld( ev.target );
    if ( !to_node ) {
        return;
    }
    var to_id = to_node.id;
    ga.dd.seloff();
    if ( ga.dd.intra ) {
        // get panel and only add if same panel as source
        if ( ga.dd.samepanel( ev ) && ga.dd.dragid != to_id ) {
            to_node.classList.add( "ga-dd-sel" );
        }
    } else {
        to_id = to_id.replace( /^ga-[a-z]*-/, '' );
        if ( ga.dd.draggid != to_id ) {
            var to_label_node = document.getElementById( `ga-label-${to_id}` );
            if ( to_label_node ) {
                to_label_node.classList.add( "ga-dd-sel" );
            }
            var to_data_node = document.getElementById( `ga-data-${to_id}` );
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
    var drag_node = ga.dd.pld( ev.target );
    if ( !drag_node ) {
        console.warn( "ga.dd.drag() no draggable layout node found" );
        return;
    }
    ga.dd.dragid      = drag_node.id;
    ga.dd.dragnode    = drag_node;
    ga.dd.dragpanelid = ga.dd.panelid( drag_node );
    ga.dd.draggid     = drag_node.id.replace( /^ga-[a-z]*-/, '' );
    ga.dd.menuoff();
    // in case we want to store in the event
    // ev.dataTransfer.setData("text", ev.target.id);
}

ga.dd.samepanel = function(ev) {
    var target_node = ga.dd.pld( ev.target );
    var target_panelid = ga.dd.panelid( target_node );
    console.log( `ga.dd.samepanel() source panel id ${ga.dd.dragpanelid} target panel id ${target_panelid}` );
    return ga.dd.dragpanelid == target_panelid;
}

ga.dd.panelid = function( node ) {
    if ( !node ) {
        return "";
    }
    var panel = node;
    while ( panel && !panel.classList.contains("ga-dd-panel") ) {
        panel = panel.parentNode;
    }
    return panel && panel.id ? panel.id : "";
}

ga.dd.panelnode = function( node ) {
    while ( node && !node.classList.contains( "ga-dd-panel" ) ) {
        node = node.parentNode;
    }
    return node || null;
}

ga.dd.panelpickoff = function() {
    var sel = document.querySelectorAll( ".ga-dd-panel-pick" );
    for ( var i = 0; i < sel.length; ++i ) {
        sel[i].classList.remove( "ga-dd-panel-pick" );
    }
}

ga.dd.selectpanel = function( ev, explicit_panel ) {
    if ( ev && ev.stopPropagation ) {
        ev.stopPropagation();
    }
    var panel = explicit_panel || ga.dd.panelnode( ev && ev.target ? ev.target : null );
    if ( !panel ) {
        return;
    }
    ga.dd.panelpickoff();
    ga.dd.selectedpanel = panel;
    panel.classList.add( "ga-dd-panel-pick" );
    ga.dd.primitive.status( "Target: " + panel.id.replace( /^ga-panel-/, "" ) );
    ga.dd.panelctl.render();
}

ga.dd.selectfield = function( ev, explicit_id ) {
    if ( ev && ev.stopPropagation ) {
        ev.stopPropagation();
    }
    var node = explicit_id ? null : ga.dd.pld( ev && ev.target ? ev.target : null );
    var id = explicit_id || ( node && node.id ? node.id.replace( /^ga-[a-z]*-/, "" ) : "" );
    if ( !id || !ga.dd.fields || !ga.dd.fields.current || !ga.dd.fields.current[ id ] ) {
        return;
    }
    ga.dd.selectedfield = id;
    ga.dd.pickoff();
    var label = document.getElementById( "ga-label-" + id );
    var data = document.getElementById( "ga-data-" + id );
    if ( label ) {
        label.classList.add( "ga-dd-pick" );
    }
    if ( data ) {
        data.classList.add( "ga-dd-pick" );
    }
    ga.dd.dfield( id );
    ga.dd.panelctl.render();
    ga.dd.renderbottom();
}

ga.dd.panelctl = {};

ga.dd.panelctl.node = function( id ) {
    return document.getElementById( "ga-dd-panel-" + id );
}

ga.dd.panelctl.setselect = function( id, value ) {
    var node = ga.dd.panelctl.node( id );
    if ( !node ) {
        return;
    }
    value = value || "";
    var found = false;
    for ( var i = 0; i < node.options.length; ++i ) {
        if ( node.options[i].value == value ) {
            found = true;
            break;
        }
    }
    node.value = found ? value : "";
}

ga.dd.panelctl.render = function() {
    var panel = ga.dd.selectedpanel && document.body.contains( ga.dd.selectedpanel ) ? ga.dd.selectedpanel : null;
    var idnode = ga.dd.panelctl.node( "id" );
    var fieldnode = ga.dd.panelctl.node( "field-id" );
    if ( fieldnode ) {
        fieldnode.innerHTML = ga.dd.selectedfield ? "Field: " + ga.dd.selectedfield : "No field selected";
    }
    if ( !idnode ) {
        return;
    }
    if ( !panel ) {
        idnode.innerHTML = "No panel selected";
        ga.dd.panelctl.setselect( "cols", "" );
        ga.dd.panelctl.setselect( "rows", "" );
        ga.dd.panelctl.setselect( "align", "" );
        var gapnode = ga.dd.panelctl.node( "gap" );
        if ( gapnode ) {
            gapnode.value = "";
        }
        var collapsiblenode = ga.dd.panelctl.node( "collapsible" );
        var defaultopennode = ga.dd.panelctl.node( "default-open" );
        if ( collapsiblenode ) {
            collapsiblenode.checked = false;
        }
        if ( defaultopennode ) {
            defaultopennode.checked = true;
        }
        return;
    }

    idnode.innerHTML = panel.id.replace( /^ga-panel-/, "" );
    ga.dd.panelctl.setselect( "cols", panel.style.gridTemplateColumns );
    ga.dd.panelctl.setselect( "rows", panel.style.gridTemplateRows );
    ga.dd.panelctl.setselect( "align", panel.style.textAlign );
    var gapnode = ga.dd.panelctl.node( "gap" );
    if ( gapnode ) {
        gapnode.value = panel.style.gap || panel.style.gridGap || "";
    }
    var collapsiblenode = ga.dd.panelctl.node( "collapsible" );
    var defaultopennode = ga.dd.panelctl.node( "default-open" );
    if ( collapsiblenode ) {
        collapsiblenode.checked = panel.dataset.gaCollapsible == "true" || panel.classList.contains( "ga-layout-collapsible" );
    }
    if ( defaultopennode ) {
        defaultopennode.checked = !panel.classList.contains( "ga-layout-default-closed" );
    }
    ga.dd.renderbottom();
}

ga.dd.panelctl.apply = function() {
    var panel = ga.dd.selectedpanel && document.body.contains( ga.dd.selectedpanel ) ? ga.dd.selectedpanel : null;
    if ( !panel ) {
        ga.dd.primitive.status( "Select a panel first.", true );
        return;
    }

    var cols  = ga.dd.panelctl.node( "cols" );
    var rows  = ga.dd.panelctl.node( "rows" );
    var gap   = ga.dd.panelctl.node( "gap" );
    var align = ga.dd.panelctl.node( "align" );
    var collapsible = ga.dd.panelctl.node( "collapsible" );
    var defaultopen = ga.dd.panelctl.node( "default-open" );

    ga.dd.undo.push( "Panel settings" );
    if ( cols && cols.value ) {
        panel.style.gridTemplateColumns = cols.value;
    }
    if ( rows && rows.value ) {
        panel.style.gridTemplateRows = rows.value;
    }
    if ( gap && gap.value ) {
        panel.style.gap = gap.value;
    }
    if ( align && align.value ) {
        panel.style.textAlign = align.value;
    }
    if ( collapsible ) {
        ga.dd.panelctl.setcollapsible( panel, collapsible.checked, !defaultopen || defaultopen.checked );
    }

    ga.dd.moduleinit.update();
    ga.dd.reset();
    ga.dd.selectpanel( { target : panel, stopPropagation : function(){} }, panel );
    ga.dd.primitive.status( "Panel updated: " + panel.id.replace( /^ga-panel-/, "" ) );
}

ga.dd.panelctl.setcollapsible = function( panel, enabled, default_open ) {
    if ( !panel ) {
        return;
    }

    panel.classList.toggle( "ga-layout-collapsible", !!enabled );
    panel.classList.toggle( "ga-layout-default-closed", !!enabled && !default_open );
    panel.dataset.gaCollapsible = enabled ? "true" : "";
    panel.dataset.gaDefaultOpen = default_open ? "true" : "false";

    var button = panel.querySelector( ":scope > .ga-layout-collapse-toggle" );
    if ( !enabled ) {
        if ( button && button.parentNode ) {
            button.parentNode.removeChild( button );
        }
        panel.classList.remove( "ga-layout-collapsed" );
        return;
    }

    if ( !button ) {
        button = document.createElement( "button" );
        button.type = "button";
        button.className = "ga-layout-collapse-toggle";
        button.onclick = function( ev ) {
            return ga.layout.togglepanel( ev, this );
        };
        var drop = panel.querySelector( ":scope > .ga-dd-pid" );
        if ( drop && drop.nextSibling ) {
            panel.insertBefore( button, drop.nextSibling );
        } else {
            panel.insertBefore( button, panel.firstChild );
        }
    }

    panel.classList.toggle( "ga-layout-collapsed", !default_open );
    button.setAttribute( "aria-expanded", default_open ? "true" : "false" );
    button.innerHTML = ( default_open ? "Hide " : "Show " ) + panel.id.replace( /^ga-panel-/, "" );
}

ga.dd.panelctl.movefield = function() {
    var panel = ga.dd.selectedpanel && document.body.contains( ga.dd.selectedpanel ) ? ga.dd.selectedpanel : null;
    if ( !panel ) {
        ga.dd.primitive.status( "Select a target panel first.", true );
        return;
    }
    if ( !ga.dd.selectedfield ) {
        ga.dd.primitive.status( "Select a field first.", true );
        return;
    }

    var label = document.getElementById( "ga-label-" + ga.dd.selectedfield );
    var data = document.getElementById( "ga-data-" + ga.dd.selectedfield );
    if ( !label && !data ) {
        ga.dd.primitive.status( "Selected field is not on this page.", true );
        return;
    }

    ga.dd.undo.push( "Move field to panel" );
    var row = ga.dd.primitive.nextrow( panel );
    if ( label ) {
        label.style.gridRow = row;
        label.style.gridColumn = 1;
        panel.appendChild( label );
    }
    if ( data ) {
        data.style.gridRow = row;
        data.style.gridColumn = label ? 2 : 1;
        panel.appendChild( data );
    }

    ga.dd.moduleinit.update();
    ga.dd.reset();
    ga.dd.selectpanel( { target : panel, stopPropagation : function(){} }, panel );
    ga.dd.selectfield( null, ga.dd.selectedfield );
    ga.dd.primitive.status( "Moved " + ga.dd.selectedfield + " to " + panel.id.replace( /^ga-panel-/, "" ) );
}

ga.dd.undo = {};
ga.dd.undo.stack = [];
ga.dd.undo.limit = 40;

ga.dd.undo.snapshot = function() {
    var snapshot = [];
    var nodes = ga.dd.node && ga.dd.node.mod ? ga.dd.node.mod.querySelectorAll( ".ga-dd-panel, .ga-dd" ) : [];
    for ( var i = 0; i < nodes.length; ++i ) {
        snapshot.push({
            id     : nodes[i].id,
            parent : nodes[i].parentNode && nodes[i].parentNode.id ? nodes[i].parentNode.id : "",
            style  : nodes[i].getAttribute( "style" ) || ""
        });
    }
    return snapshot;
}

ga.dd.undo.push = function( label ) {
    if ( !ga.dd.node || !ga.dd.node.mod ) {
        return;
    }
    ga.dd.undo.stack.push({
        label    : label || "layout change",
        snapshot : ga.dd.undo.snapshot()
    });
    if ( ga.dd.undo.stack.length > ga.dd.undo.limit ) {
        ga.dd.undo.stack.shift();
    }
    ga.dd.undo.render();
}

ga.dd.undo.restore = function() {
    if ( !ga.dd.undo.stack.length ) {
        return;
    }
    var entry = ga.dd.undo.stack.pop();
    var keep = {};
    for ( var i = 0; i < entry.snapshot.length; ++i ) {
        keep[ entry.snapshot[i].id ] = true;
    }
    var current = ga.dd.node && ga.dd.node.mod ? ga.dd.node.mod.querySelectorAll( ".ga-dd-panel, .ga-dd" ) : [];
    for ( var i = current.length - 1; i >= 0; --i ) {
        if ( current[i].id && !keep[ current[i].id ] ) {
            current[i].parentNode.removeChild( current[i] );
        }
    }
    for ( var i = 0; i < entry.snapshot.length; ++i ) {
        var item = entry.snapshot[i];
        var node = document.getElementById( item.id );
        var parent = item.parent ? document.getElementById( item.parent ) : null;
        if ( node ) {
            node.setAttribute( "style", item.style );
            if ( parent && node.parentNode !== parent ) {
                parent.appendChild( node );
            }
        }
    }
    ga.dd.moduleinit.update();
    ga.dd.reset();
    ga.dd.undo.render();
}

ga.dd.undo.render = function() {
    var node = document.getElementById( "ga-dd-undo-count" );
    if ( node ) {
        node.innerHTML = ga.dd.undo.stack.length;
    }
    var leftnode = document.getElementById( "ga-dd-left-undo-count" );
    if ( leftnode ) {
        leftnode.innerHTML = ga.dd.undo.stack.length;
    }
}

ga.dd.drop_intra = function (ev) {
    var from_id                = ga.dd.dragid;
    var to_node                = ga.dd.pld( ev.target );
    if ( !to_node ) {
        console.warn( "ga.dd.drop_intra() no target layout node found" );
        return;
    }
    var to_id                  = to_node.id;

    console.log( `ga.dd.drop_intra() from_id ${from_id} to_id ${to_id}` );

    var from_node_style        = ga.dd.dragnode.style;
    var to_node_style          = to_node.style;

    var from_row               = from_node_style.gridRow;
    var from_col               = from_node_style.gridColumn;
    var to_row                 = to_node_style.gridRow;
    var to_col                 = to_node_style.gridColumn;

    console.log( `ga.dd.drop_intra() from ${from_row},${from_col} to ${to_row},${to_col}` );

    from_node_style.gridRow    = to_row; 
    from_node_style.gridColumn = to_col; 
    to_node_style.gridRow      = from_row; 
    to_node_style.gridColumn   = from_col; 
    ga.dd.moduleinit.update();
}

ga.dd.drop = function (ev) {
    console.log( "ga.dd.drop()" );
    ev.preventDefault();
    ev.stopPropagation();
    console.log( ev );
    ga.dd.seloff();
    var target_node = ga.dd.pld( ev.target );
    if ( !target_node ) {
        console.warn( "ga.dd.drop() no target layout node found" );
        return;
    }
    if ( !ga.dd.dragid || !ga.dd.dragnode ) {
        console.warn( "ga.dd.drop() no active drag source" );
        return;
    }
    console.log( `drop() from:${ga.dd.dragid} to:${target_node.id}` );

    var samepanel = ga.dd.samepanel( ev );

    if ( ga.dd.intra ) {
        if ( !samepanel ) {
            console.log( "ga.dd.drop() intra drops only allowed within one panel" );
            alert( "intra field drops are checked & intra drops are only allowed in the same panel" );
            return;
        }
        ga.dd.undo.push( "intra drop" );
        return ga.dd.drop_intra( ev );
    }

    // get from & to label & data coordinates

    var from_id = ga.dd.draggid;
    var to_id = target_node.id.replace( /^ga-[a-z]*-/, '' );

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
        var empty_panel = ga.dd.panelnode( target_node );
        if ( !empty_panel ) {
            return alert( `drop to nothing from ${from_id} to ${to_id}?` );
        }
        ga.dd.undo.push( "move field to panel" );
        var empty_row = ga.dd.primitive.nextrow( empty_panel );
        if ( from_label_node ) {
            from_label_node_style.gridRow = empty_row;
            from_label_node_style.gridColumn = 1;
            empty_panel.appendChild( from_label_node );
        }
        if ( from_data_node ) {
            from_data_node_style.gridRow = empty_row;
            from_data_node_style.gridColumn = from_label_node ? 2 : 1;
            empty_panel.appendChild( from_data_node );
        }
        ga.dd.selectpanel( { target : empty_panel, stopPropagation : function(){} } );
        ga.dd.moduleinit.update();
        return;
    }

    var label_ok = from_label_node && to_label_node;
    var data_ok  = from_data_node && to_data_node;
    
    console.log( `from label at ${from_label_row},${from_label_col} data at ${from_data_row},${from_data_col}` );
    console.log( `to label at ${to_label_row},${to_label_col} data at ${to_data_row},${to_data_col}` );

    if ( samepanel ) {
        // swap coordinates
        console.log( "same panel coordinate swap" );
        ga.dd.undo.push( "swap fields" );
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
        ga.dd.undo.push( "move field" );
        // step 1 - increment all parent panel elements past to (ugh rows & columns, assume row logic for now)
        // could probably be in its own function
        // simple assumption of numeric rows, could get uglier

        console.log( `drop target node id ${target_node.id}` );
        console.dir( target_node.parentNode.children );
        
        var to_row_int = parseInt( label_ok ? to_label_row : to_data_row );
        if ( label_ok && !data_ok && from_data_node )  {
            // from has data but to doesn't
            to_data_row = to_label_row;
            to_data_col = 1 + +to_label_col;
            data_ok = true;
        } else if ( !label_ok && data_ok && from_label_node )  {
            to_label_row = to_data_row;
            to_label_col = 1 + +to_data_col;
            label_ok = true;
        }

        // perhaps we need to keep going up parents until we have a panel ?
        // classList.contains("ga-dd-panel") ?
        var panelparent = target_node;
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
    ga.dd.moduleinit.update();
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
    var ddspanel = document.getElementsByClassName('ga-dd-panel');
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
                dds[i].onclick       = function(ev){ga.dd.selectfield(ev)};
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
                ddsdrop[i].onclick       = function(ev){ga.dd.selectpanel(ev)};
                // ddsdrop[i].classList.add( "ga-dd-on" );
            }
        }
        for ( var i in ddspanel ) {
            if ( ddspanel.hasOwnProperty( i ) ) {
                ddspanel[i].onclick = function(ev){
                    if ( ev.target === this ) {
                        ga.dd.selectpanel(ev, this);
                    }
                };
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
                dds[i].onclick       = null;
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
                ddsdrop[i].onclick       = null;
                // ddsdrop[i].classList.add( "ga-dd-on" );
            }
        }
        for ( var i in ddspanel ) {
            if ( ddspanel.hasOwnProperty( i ) ) {
                ddspanel[i].onclick = null;
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
        if ( 1 ) { // is_clean ?
            menucmds.innerHTML =
                `<div id="ga-dd-menu-cleanrows" class="ga-dd-menu-e" onclick="ga.dd.menu(\'cleanrows\','${node.id}')" >Remove empty rows </div>`
                + `<div id="ga-dd-menu-cleancols" class="ga-dd-menu-e" onclick="ga.dd.menu(\'cleancols\','${node.id}')" >Shift columns left </div>`
                + `<div id="ga-dd-menu-cleanall" class="ga-dd-menu-e" onclick="ga.dd.menu(\'cleanall\','${node.id}')" >Remove empty rows & shift cols left </div>`
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
    case "cleanrows" :
        console.log( msg_ok );
        ga.dd.clean( arg, {mode:'row'} );
        break;
    case "cleancols" :
        console.log( msg_ok );
        ga.dd.clean( arg, {mode:'col'} );
        break;
    case "cleanall" :
        console.log( msg_ok );
        ga.dd.clean( arg, {mode:'all'} );
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
    ga.dd.node.left        = document.getElementById( "ga-dd-left" );
    ga.dd.node.mod         = document.getElementById( "ga-dd-mod" );
    ga.dd.node.menu        = document.getElementById( "ga-dd-menu" );
    ga.dd.node.gutter      = document.getElementById( "ga-dd-gutter" );
    ga.dd.node.leftmodule  = document.getElementById( "ga-dd-left-module" );
    ga.dd.node.leftstatus  = document.getElementById( "ga-dd-left-status" );

    ga.dd.node.ddctrls.innerHTML =
        `<button class="ga-dd-action" onclick="ga.dd.undo.restore(); return false;">Undo <span id="ga-dd-undo-count">0</span></button><br>`
        + `<input type="checkbox" id="ga-dd-inter" onclick="ga.dd.reset()"><label class="ga-dd-pointer" for="ga-dd-inter"> Intra field drops</label><br>`
        + `<input type="checkbox" id="ga-dd-showfid" onclick="ga.dd.reset()"><label class="ga-dd-pointer" for="ga-dd-showfid"> Show field ids</label><br>`
        + `<input type="checkbox" id="ga-dd-showpid" onclick="ga.dd.reset()"><label class="ga-dd-pointer" for="ga-dd-showpid"> Show panel ids</label><br>`
        + `<input type="checkbox" checked id="ga-dd-showpanel" onclick="ga.dd.reset()"><label class="ga-dd-pointer" for="ga-dd-showpanel"> Show panel backgrounds</label><br>`
        + `<label class="ga-dd-pointer" onclick="ga.dd.menu('iclr')">Invert Designer colors</label><br>`
        + `<label class="ga-dd-pointer" onclick="ga.dd.hv.swap()">Swap designer location</label><br>`
    ;
    if ( ga.dd.node.leftmodule && ga.layout && ga.layout.module ) {
        ga.dd.node.leftmodule.innerHTML = "Module: " + ga.layout.module.name;
    }
    ga.dd.moduleinit();
    ga.dd.hv.init();
    ga.dd.menu.iclr(); // start inverted
    ga.dd.undo.render();
    document.addEventListener( "keydown", ga.dd.keydown );
}

ga.dd.keydown = function( ev ) {
    if ( ( ev.metaKey || ev.ctrlKey ) && ev.key && ev.key.toLowerCase() == "z" ) {
        ev.preventDefault();
        ga.dd.undo.restore();
    }
}

ga.dd.resetgrid = function() {
    console.log( 'ga.dd.resetgrid()' );
    if ( ga.dd.on ) {
        ga.dd.node.grid.style.gridTemplateColumns = ga.dd.prevgtc;
        ga.dd.node.grid.style.gridTemplateRows = ga.dd.prevgtr;
        ga.dd.node.grid.style.gridTemplateAreas = ga.dd.prevgta || "";
        ga.dd.node.grid.classList.remove( "ga-dd-viewonly" );
        ga.dd.node.mod.style.marginLeft = "";
        ga.dd.node.dd.style.display = "block";
        ga.dd.node.left.style.display = "block";
        ga.dd.node.gutter.style.display = "block";
        if ( ga.dd.node && ga.dd.node.dclickd ) {
            ga.dd.dblclick( { target : ga.dd.node.dclickd } );
        }
    } else {
        ga.dd.prevgtc = ga.dd.node.grid.style.gridTemplateColumns;
        ga.dd.prevgtr = ga.dd.node.grid.style.gridTemplateRows;;
        ga.dd.prevgta = ga.dd.node.grid.style.gridTemplateAreas;
        ga.dd.node.grid.style.gridTemplateColumns = "1fr";
        ga.dd.node.grid.style.gridTemplateRows = "1fr";
        ga.dd.node.grid.style.gridTemplateAreas = '"module"';
        ga.dd.node.grid.classList.add( "ga-dd-viewonly" );
        ga.dd.node.mod.style.marginLeft = "0";
        ga.dd.node.dd.style.display = "none";
        ga.dd.node.left.style.display = "none";
        ga.dd.node.gutter.style.display = "none";
        ga.dd.pickoff();
    }
}

ga.dd.primitive = function( kind ) {
    var labels = {
        "panel-stack" : "Panel Stack",
        "two-columns" : "Two Columns",
        "three-columns" : "Three Columns",
        "compact-grid" : "Compact Grid",
        "collapsible-input" : "Collapsible Input",
        "input-field" : "Input Field",
        "output-field" : "Output Field",
        "message-field" : "Message Field"
    };
    if ( /field$/.test( kind ) ) {
        ga.dd.primitive.status( ( labels[ kind ] || kind ) + " needs a module field definition. Move existing fields for now." );
        return;
    }
    ga.dd.primitive.panel( kind, labels[ kind ] || kind );
}

ga.dd.primitive.status = function( msg, is_error ) {
    var status = document.getElementById( "ga-dd-left-status" );
    if ( status ) {
        status.innerHTML = msg;
        status.classList.toggle( "ga-dd-status-error", !!is_error );
    }
}

ga.dd.primitive.target = function() {
    if ( ga.dd.selectedpanel && document.body.contains( ga.dd.selectedpanel ) ) {
        return ga.dd.selectedpanel;
    }
    var node = ga.dd.node && ga.dd.node.dclickd ? ga.dd.node.dclickd : null;
    var nstate = node ? ga.dd.nstate( node ) : {};
    var panel = nstate.panel || document.getElementById( "ga-panel-inputpanel" ) ||
        document.getElementById( "ga-panel-body" ) ||
        document.getElementById( "ga-panel-root" );
    return panel;
}

ga.dd.primitive.nextrow = function( panel ) {
    var maxrow = 0;
    for ( var i = 0; i < panel.children.length; ++i ) {
        var row = parseInt( panel.children[i].style.gridRow || panel.children[i].style.gridRowStart || 0 );
        if ( row > maxrow ) {
            maxrow = row;
        }
    }
    return maxrow + 1;
}

ga.dd.primitive.id = function( prefix ) {
    prefix = prefix || "panel";
    ga.dd.primitive.claimed = ga.dd.primitive.claimed || {};
    var i = 1;
    var id;
    do {
        id = "designer_" + prefix + "_" + i++;
    } while ( document.getElementById( "ga-panel-" + id ) || ga.dd.primitive.claimed[ id ] );
    ga.dd.primitive.claimed[ id ] = true;
    return id;
}

ga.dd.primitive.makepanel = function( id, row, col, rows, cols ) {
    var panel = document.createElement( "div" );
    panel.id = "ga-panel-" + id;
    panel.className = "ga-dd-panel ga-dd-panel-new";
    panel.style.display = "grid";
    panel.style.gridTemplateRows = rows || "auto";
    panel.style.gridTemplateColumns = cols || "1fr";
    panel.style.gridRow = row || 1;
    panel.style.gridColumn = col || "1/-1";
    panel.style.gap = "5px";
    panel.style.textAlign = "left";

    var drop = document.createElement( "div" );
    drop.id = "ga-paneldrop-" + id;
    drop.className = "ga-dd-pid ga-dd-drop";
    drop.innerHTML = 'panel id:"' + id + '"';
    panel.appendChild( drop );

    return panel;
}

ga.dd.primitive.panel = function( kind, label ) {
    var target = ga.dd.primitive.target();
    if ( !target ) {
        ga.dd.primitive.status( "No target panel found.", true );
        return;
    }

    ga.dd.undo.push( "Add " + label );
    ga.dd.primitive.claimed = {};

    var row = ga.dd.primitive.nextrow( target );
    var rootid = ga.dd.primitive.id( kind.replace( /-/g, "_" ) );
    var root;

    if ( kind == "two-columns" || kind == "three-columns" || kind == "compact-grid" ) {
        var cols = kind == "three-columns" ? "1fr 1fr 1fr" : "1fr 1fr";
        var rows = kind == "compact-grid" ? "auto auto" : "auto";
        root = ga.dd.primitive.makepanel( rootid, row, "1/-1", rows, cols );

        var childcount = kind == "three-columns" ? 3 : ( kind == "compact-grid" ? 4 : 2 );
        for ( var i = 0; i < childcount; ++i ) {
            var childid = ga.dd.primitive.id( "slot" );
            var childrow = kind == "compact-grid" ? Math.floor( i / 2 ) + 1 : 1;
            var childcol = kind == "compact-grid" ? ( i % 2 ) + 1 : i + 1;
            var child = ga.dd.primitive.makepanel( childid, childrow, childcol, "auto", "0.4fr 1fr" );
            root.appendChild( child );
        }
    } else if ( kind == "collapsible-input" ) {
        root = ga.dd.primitive.makepanel( rootid, row, "1/-1", "auto", "0.4fr 1fr" );
        ga.dd.panelctl.setcollapsible( root, true, true );
    } else {
        root = ga.dd.primitive.makepanel( rootid, row, "1/-1", "auto", "0.4fr 1fr" );
    }

    target.appendChild( root );
    ga.dd.reset();
    ga.dd.selectpanel( { target : root, stopPropagation : function(){} } );
    ga.dd.moduleinit.update();
    ga.dd.primitive.status( label + " added to " + target.id.replace( /^ga-panel-/, "" ) + "." );
}

ga.dd.html = function( value ) {
    return String( typeof value === "undefined" || value === null ? "" : value )
        .replace( /&/g, "&amp;" )
        .replace( /</g, "&lt;" )
        .replace( />/g, "&gt;" )
        .replace( /"/g, "&quot;" )
        .replace( /'/g, "&#39;" );
}

ga.dd.renderbottom = function() {
    if ( !ga.dd.node ) {
        return;
    }
    ga.dd.warnings = ga.dd.validate();
    ga.dd.renderdetails();
    ga.dd.renderlayout();
    ga.dd.renderjson();
    ga.dd.renderpalette();
}

ga.dd.validate = function() {
    var warnings = [];
    var panels = {};
    var mod = ga.dd.module && ga.dd.module.current ? ga.dd.module.current : null;

    if ( mod && mod.panels ) {
        for ( var i = 0; i < mod.panels.length; ++i ) {
            var id = Object.keys( mod.panels[i] )[0];
            panels[ id ] = true;
        }
    }

    if ( mod && mod.fields ) {
        for ( var j = 0; j < mod.fields.length; ++j ) {
            var field = mod.fields[j];
            var layout = field.layout || {};
            if ( layout.parent && !panels[ layout.parent ] ) {
                warnings.push( "Field " + field.id + " references missing parent panel " + layout.parent + "." );
            }
        }
    }

    var occupied = {};
    var nodes = ga.dd.node && ga.dd.node.mod ? ga.dd.node.mod.querySelectorAll( ".ga-dd" ) : [];
    for ( var k = 0; k < nodes.length; ++k ) {
        var parent = ga.dd.panelid( nodes[k] );
        var row = nodes[k].style.gridRow || "";
        var col = nodes[k].style.gridColumn || "";
        if ( !parent || !row || !col ) {
            continue;
        }
        var key = parent + "|" + row + "|" + col;
        if ( !occupied[ key ] ) {
            occupied[ key ] = [];
        }
        occupied[ key ].push( nodes[k] );
    }

    for ( var cell in occupied ) {
        if ( !occupied.hasOwnProperty( cell ) || occupied[ cell ].length < 2 ) {
            continue;
        }
        var ids = [];
        var has_runtime = false;
        for ( var m = 0; m < occupied[ cell ].length; ++m ) {
            ids.push( occupied[ cell ][m].id.replace( /^ga-(label|data)-/, "" ) );
            has_runtime = has_runtime || occupied[ cell ][m].classList.contains( "ga-dd-runtime" );
        }
        if ( has_runtime ) {
            warnings.push( "Runtime layout collision at " + cell.replace( /\|/g, " " ) + ": " + ids.join( ", " ) + "." );
        }
    }

    return warnings;
}

ga.dd.renderdetails = function() {
    if ( !ga.dd.node.dddetails ) {
        return;
    }
    var panel = ga.dd.selectedpanel && document.body.contains( ga.dd.selectedpanel ) ? ga.dd.selectedpanel : null;
    var field = ga.dd.selectedfield && ga.dd.fields && ga.dd.fields.current ? ga.dd.fields.current[ ga.dd.selectedfield ] : null;
    var html = '<div class="ga-dd-summary">';
    if ( ga.dd.warnings && ga.dd.warnings.length ) {
        html += '<h4>Warnings</h4><ul class="ga-dd-warnings">';
        for ( var w = 0; w < ga.dd.warnings.length; ++w ) {
            html += '<li>' + ga.dd.html( ga.dd.warnings[w] ) + '</li>';
        }
        html += '</ul>';
    }
    html += '<h4>Selection</h4>';
    if ( field ) {
        html += '<div class="ga-dd-kv"><b>Field</b><span>' + ga.dd.html( ga.dd.selectedfield ) + '</span>';
        html += '<b>Label</b><span>' + ga.dd.html( field.label || "" ) + '</span>';
        html += '<b>Role</b><span>' + ga.dd.html( field.role || "" ) + '</span>';
        html += '<b>Type</b><span>' + ga.dd.html( field.type || "" ) + '</span>';
        html += '<b>Owner</b><span>' + ga.dd.html( field.runtime_owned ? "runtime-owned" : "module" ) + '</span>';
        html += '<b>Parent</b><span>' + ga.dd.html( field.layout && field.layout.parent ? field.layout.parent : "" ) + '</span></div>';
    } else if ( panel ) {
        html += '<div class="ga-dd-kv"><b>Panel</b><span>' + ga.dd.html( panel.id.replace( /^ga-panel-/, "" ) ) + '</span>';
        html += '<b>Columns</b><span>' + ga.dd.html( panel.style.gridTemplateColumns || "current" ) + '</span>';
        html += '<b>Rows</b><span>' + ga.dd.html( panel.style.gridTemplateRows || "current" ) + '</span>';
        html += '<b>Gap</b><span>' + ga.dd.html( panel.style.gap || panel.style.gridGap || "" ) + '</span></div>';
    } else {
        html += '<p>Select a field or panel in the live module to inspect it here.</p>';
    }
    html += '</div>';
    ga.dd.node.dddetails.innerHTML = html;
}

ga.dd.renderlayout = function() {
    if ( !ga.dd.node.ddlayout ) {
        return;
    }
    var mod = ga.dd.module && ga.dd.module.current ? ga.dd.module.current : null;
    if ( !mod ) {
        ga.dd.node.ddlayout.innerHTML = '<p>No layout generated yet.</p>';
        return;
    }
    var html = '<div class="ga-dd-summary"><h4>Panels</h4><table class="ga-dd-table"><thead><tr><th>ID</th><th>Parent</th><th>Location</th><th>Size</th><th>Align</th></tr></thead><tbody>';
    for ( var i = 0; i < ( mod.panels || [] ).length; ++i ) {
        var id = Object.keys( mod.panels[i] )[0];
        var p = mod.panels[i][id] || {};
        html += '<tr><td>' + ga.dd.html( id ) + '</td><td>' + ga.dd.html( p.parent || "" ) + '</td><td><code>' + ga.dd.html( JSON.stringify( p.location || "" ) ) + '</code></td><td><code>' + ga.dd.html( JSON.stringify( p.size || "" ) ) + '</code></td><td>' + ga.dd.html( p.align || "" ) + '</td></tr>';
    }
    html += '</tbody></table><h4>Fields</h4><table class="ga-dd-table"><thead><tr><th>ID</th><th>Owner</th><th>Parent</th><th>Label</th><th>Data</th></tr></thead><tbody>';
    for ( var j = 0; j < ( mod.fields || [] ).length; ++j ) {
        var f = mod.fields[j];
        var l = f.layout || {};
        html += '<tr><td>' + ga.dd.html( f.id ) + '</td><td>' + ga.dd.html( f.runtime_owned ? "runtime" : "module" ) + '</td><td>' + ga.dd.html( l.parent || "" ) + '</td><td><code>' + ga.dd.html( JSON.stringify( l.label || "" ) ) + '</code></td><td><code>' + ga.dd.html( JSON.stringify( l.data || "" ) ) + '</code></td></tr>';
    }
    html += '</tbody></table></div>';
    ga.dd.node.ddlayout.innerHTML = html;
}

ga.dd.renderjson = function() {
    if ( !ga.dd.node.ddjson ) {
        return;
    }
    var payload = ga.dd.selectedfield && ga.dd.fields && ga.dd.fields.current && ga.dd.fields.current[ ga.dd.selectedfield ] ?
        ga.dd.fields.current[ ga.dd.selectedfield ] :
        ( ga.dd.module && ga.dd.module.current ? ga.dd.module.current : {} );
    ga.dd.node.ddjson.innerHTML = '<pre>' + ga.dd.html( JSON.stringify( payload, null, 2 ) ) + '</pre>';
}

ga.dd.renderpalette = function() {
    if ( !ga.dd.node.ddpalette ) {
        return;
    }
    var fields = ga.layout && ga.layout.module && ga.layout.module.json ? ga.layout.module.json.fields || [] : [];
    var html = '<div class="ga-dd-summary"><h4>Module Fields</h4><table class="ga-dd-table"><thead><tr><th>ID</th><th>Owner</th><th>Label</th><th>Role</th><th>Type</th></tr></thead><tbody>';
    for ( var i = 0; i < fields.length; ++i ) {
        html += '<tr><td><button class="ga-dd-mini" onclick="ga.dd.selectfield(event,' + JSON.stringify( fields[i].id ) + '); return false;">' + ga.dd.html( fields[i].id ) + '</button></td><td>' + ga.dd.html( fields[i].runtime_owned ? "runtime" : "module" ) + '</td><td>' + ga.dd.html( fields[i].label || "" ) + '</td><td>' + ga.dd.html( fields[i].role || "" ) + '</td><td>' + ga.dd.html( fields[i].type || "" ) + '</td></tr>';
    }
    html += '</tbody></table></div>';
    ga.dd.node.ddpalette.innerHTML = html;
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
    console.log( `ga.dd.dblclick() ev.target.id = ${ev.target.id}` );
    console.log( `ga.dd.dblclick() ga.dd.pickid = ${ga.dd.pickid}` );
    ga.dd.selectfield( ev, ga.dd.pickid );
}
    
ga.dd.tab = function(evt, id) {
    var i, tabcontent, tablinks;
    console.log( `ga.dd.tab( ${id} )` );
    evt.preventDefault();

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
        ga.dd.hv.split.addColumnGutter( ga.dd.hv.gutter, 2 );
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
        ga.dd.hv.split.addColumnGutter( ga.dd.hv.gutter, 2 );
        ga.dd.hv.gs.gridTemplateRows    = "1fr";
        ga.dd.hv.gs.gridTemplateColumns = ga.dd.hv.lastColumns;
        ga.dd.hv.gutter.style.cursor    = "col-resize";
    } else {
        ga.dd.hv.lastColumns = ga.dd.hv.gs.gridTemplateColumns;
        ga.dd.hv.gcl.remove("ga-dd-gridvg");
        ga.dd.hv.gcl.add("ga-dd-gridhg");
        ga.dd.hv.split.removeColumnGutter( 2 );
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

ga.dd.nstate.colmax = function ( nstate ) {
    // compute nstate.colmax[]
    if ( !nstate || !nstate.id ) {
        console.error( 'ga.dd.nstate.colmax() called without a proper value' );
        return;
    }

    console.log( `ga.dd.nstate.colmax( ${nstate.id} )` );
    
    if ( !nstate.cnodes ) {
        console.error( `ga.dd.nstate.colmax( ${nstate.id} ) has empty cnodes` );
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

ga.dd.nstate.gridmap = function ( nstate ) {
    // compute nstate.gridmap
    if ( !nstate || !nstate.id ) {
        console.error( 'ga.dd.nstate.gridmap() called without a proper value' );
        return false;
    }

    console.log( `ga.dd.nstate.gridmap( ${nstate.id} )` );
    
    if ( !nstate.cnodes ) {
        console.error( `ga.dd.nstate.gridmap( ${nstate.id} ) has empty cnodes` );
        return false;
    }

    // setup gridmap
    nstate.gridmap = [];
    for ( var i = 0; i < nstate.cnodes.length; ++i ) {
        var colstart = +nstate.cnodes[i].style.gridColumnStart;
        var colend   = /^\d*$/.test( nstate.cnodes[i].style.gridColumnEnd ) ? nstate.cnodes[i].style.gridColumnEnd : colstart;
        var rowstart = +nstate.cnodes[i].style.gridRowStart;
        var rowend   = /^\d*$/.test( nstate.cnodes[i].style.gridRowEnd ) ? nstate.cnodes[i].style.gridRowEnd : rowstart;
        console.log( `nstate.cnodes[${i}] colstart ${colstart} colend ${colend} rowstart ${rowstart} rowend ${rowend}` );
        for ( var j = rowstart; j <= rowend; ++j ) {
            for ( var k = colstart; k <= colend; ++k ) {
                nstate.gridmap[j]    = nstate.gridmap[j]    || [];
                nstate.gridmap[j][k] = nstate.gridmap[j][k] || [];
                nstate.gridmap[j][k].push( nstate.cnodes[i] );
            }
        }
    }
    return true;
}

ga.dd.nstate.gridmap.check = function( node ) {
    console.log( `ga.dd.nstate.gridmap.check( ${node.id} )` );
    var nstate = ga.dd.nstate( node );
    ga.dd.nstate.gridmap( nstate );

    var maxrow = nstate.gridmap.length;
    var maxcol = nstate.gridmap.reduce( (a,v) => v.length > a ? v.length : a, 0 );

    var outstr = '';
    
    for ( var i = 1; i < maxrow; ++i ) {
        for ( var j = 1; j < maxcol; ++j ) {
            outstr += ( nstate.gridmap[i] && nstate.gridmap[i][j] ? nstate.gridmap[i][j].length : 'X' ) + ' ';
        }
        outstr += '\n';
    }

    console.log( outstr );
}

ga.dd.clean = function ( id, obj ) {
    if ( !id || !obj || !obj.mode ) {
        console.error( 'ga.dd.clean() insufficient arguments' );
        return;
    }
    
    console.log( `ga.dd.clean( ${id}, obj ) obj : ` + JSON.stringify( obj ) );

    var node = document.getElementById( id );

    var nstate = ga.dd.nstate( node );
    if ( !ga.dd.nstate.gridmap( nstate ) ) {
        console.log( `ga.dd.clean( ${node.id}, obj ) : empty panel is by default clean` );
        return;
    }

    ga.dd.undo.push( `clean ${obj.mode}` );

    switch ( obj.mode ) {
    case 'row' :
        {
            for ( var i = 1; i < nstate.gridmap.length; ++i ) {
                if ( !nstate.gridmap[i] ) {
                    ga.dd.clean.rowup( nstate, i );
                }
            }
        }
        break;
    case 'col' :
        {
            for ( var i = 1; i < nstate.gridmap.length; ++i ) {
                if ( nstate.gridmap[i] ) {
                    ga.dd.clean.col( nstate, i );
                }
            }
        }
        break;
    case 'all' :
        {
            for ( var i = 1; i < nstate.gridmap.length; ++i ) {
                if ( nstate.gridmap[i] ) {
                    ga.dd.clean.col( nstate, i );
                }
            }
            for ( var i = 1; i < nstate.gridmap.length; ++i ) {
                if ( !nstate.gridmap[i] ) {
                    ga.dd.clean.rowup( nstate, i );
                }
            }
        }
        break;
    default :
        console.error( `ga.dd.clean() object mode ${obj.node} unknown option` );
        return;
        break;
    }
}

ga.dd.clean.rowup = function( nstate, row ) {
    console.log( `ga.dd.clean.rowup( nstate, ${row} )` );
    // ga.dd.debug = ga.dd.debug || {};
    // ga.dd.debug.lastnstate = nstate;

    var done = {};
    for ( var i = row + 1; i < nstate.gridmap.length; ++i ) {
        if ( nstate.gridmap[i] ) {
            for ( var j = 1; j < nstate.gridmap[i].length; ++j ) {
                if ( nstate.gridmap[i][j] ) {
                    for ( var k = 0; k < nstate.gridmap[i][j].length; ++k ) {
                        if ( nstate.gridmap[i][j][k] && !done[ nstate.gridmap[i][j][k].id ] ) {
                            done[ nstate.gridmap[i][j][k].id ] = true;
                            nstate.gridmap[i][j][k].style.gridRowStart = +nstate.gridmap[i][j][k].style.gridRowStart - 1;
                            nstate.gridmap[i][j][k].style.gridRowEnd   = isNaN( +nstate.gridmap[i][j][k].style.gridRowEnd ) ? nstate.gridmap[i][j][k].style.gridRowEnd : +nstate.gridmap[i][j][k].style.gridRowEnd - 1;
                        }
                    }
                }
            }
        }
    }
    
    // ga.dd.debug.rowupdone = done;
    
    ga.dd.nstate.gridmap( nstate );
}

ga.dd.clean.col = function( nstate, row ) {
    console.log( `ga.dd.clean.col( nstate, ${row} )` );
    // ga.dd.debug = ga.dd.debug || {};
    // ga.dd.debug.lastnstate = nstate;

    var done = {};
    if ( !nstate.gridmap[row] ) {
        return;
    }

    var next_col = 1;

    for ( var j = 1; j < nstate.gridmap[row].length; ++j ) {
        if ( nstate.gridmap[row][j] ) {
            for ( var k = 0; k < nstate.gridmap[row][j].length; ++k ) {
                if ( nstate.gridmap[row][j][k] && !done[ nstate.gridmap[row][j][k].id ] ) {
                    done[ nstate.gridmap[row][j][k].id ] = true;
                    if ( isNaN( +nstate.gridmap[row][j][k].style.gridColumnEnd ) ) {
                        nstate.gridmap[row][j][k].style.gridColumnStart = next_col;
                        ++next_col;
                    } else {
                        var colspan = +nstate.gridmap[row][j][k].style.gridColumnEnd - +nstate.gridmap[row][j][k].style.gridColumnStart;
                        nstate.gridmap[row][j][k].style.gridColumnStart = next_col;
                        nstate.gridmap[row][j][k].style.gridColumnEnd   = next_col + colspan;
                        next_col += colspan;
                    }
                }
            }
        }
    }
    ga.dd.nstate.gridmap( nstate );
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

    ga.dd.undo.push( "move row" );
        
    console.log( `ga.dd.moveele( ${id} ) 1` );
    console.dir( nstate.cnodes );
        
    console.log( `ga.dd.moveele( ${id} ) 2` );
    ga.dd.nstate.colmax( nstate );

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
            ga.dd.nstate.colmax( nstate );
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
    ga.dd.moduleinit.update();
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
    ga.dd.moduleinit.update();
}

ga.dd.moduleinit.update = function() {
    console.log( "ga.dd.moduleinit.update()" );
    var mod = JSON.parse(JSON.stringify(ga.layout.module.json));
    var fields; // to be removed when fields are done, replaced with mod.fields
    [ mod.panels, fields ] = ga.dd.dom2mod();
    // merge fields for now for layout
    // later adjust properties as specified in Details

    for ( var i = 0; i < mod.fields.length; ++i ) {
        if ( !fields[mod.fields[i].id] ) {
            console.error( `ga.dd.moduleinit.update(): fields is missing ${mod.fields[i].id} possible repeater issue` );
        } else {
            mod.fields[ i ].layout = fields[ mod.fields[i].id ].layout;
        }
    }

    ga.dd.module = ga.dd.module || {};
    ga.dd.module.current = mod;

    ga.dd.node.ddmodule.innerHTML =
        '<button class="ga-button-submit" onclick="ga.dd.copymod(); return false;">Copy to clipboard</button>'
        + '<button class="ga-button-submit" onclick="ga.dd.draft.save(); return false;">Save Draft</button>'
        + '<button class="ga-button-submit" onclick="ga.dd.draft.load(); return false;">Load Draft</button>'
        + '<span id="ga-dd-draft-status" class="ga-dd-status"></span>'
        + '<pre id="ga-dd-module-content-clipboard" >' + JSON.stringify( mod, null, 2 ) + '</pre>';
    ga.dd.renderbottom();
}    

ga.dd.draft = {};
ga.dd.draft.url = "ajax/sys_config/sys_layout_designer.php";

ga.dd.draft.moduleid = function() {
    if ( ga.layout && ga.layout.module && ga.layout.module.name ) {
        return ga.layout.module.name;
    }
    if ( ga.layout && ga.layout.module && ga.layout.module.json && ga.layout.module.json.id ) {
        return ga.layout.module.json.id;
    }
    return "module";
}

ga.dd.draft.status = function( msg, is_error ) {
    var node = document.getElementById( "ga-dd-draft-status" );
    if ( node ) {
        node.innerHTML = msg || "";
        node.classList.toggle( "ga-dd-status-error", !!is_error );
    }
    ga.dd.primitive.status( msg || "", is_error );
}

ga.dd.draft.baseRequest = function() {
    return {
        _window : window.name,
        _logon  : $( "#_state" ).data( "_logon" ),
        module  : ga.dd.draft.moduleid()
    };
}

ga.dd.draft.save = function() {
    var req = ga.dd.draft.baseRequest();
    req.action = "save";
    req.layout = JSON.stringify( ga.dd.module.current || {} );
    ga.dd.draft.status( "Saving draft..." );
    $.post( ga.dd.draft.url, req, function( data ) {
        if ( data && data.error ) {
            ga.dd.draft.status( data.error, true );
            return;
        }
        ga.dd.draft.status( data && data.status ? data.status : "Draft saved." );
    }, "json" ).fail( function() {
        ga.dd.draft.status( "Draft save failed.", true );
    });
}

ga.dd.draft.load = function() {
    var req = ga.dd.draft.baseRequest();
    req.action = "load";
    ga.dd.draft.status( "Loading draft..." );
    $.getJSON( ga.dd.draft.url, req, function( data ) {
        if ( data && data.error ) {
            ga.dd.draft.status( data.error, true );
            return;
        }
        if ( data && data.layout ) {
            ga.dd.node.ddjson.innerHTML = '<pre>' + JSON.stringify( data.layout, null, 2 ) + '</pre>';
            if ( ga.dd.draft.apply( data.layout ) ) {
                ga.dd.draft.status( data.status || "Draft loaded." );
            } else {
                ga.dd.draft.status( "Draft loaded into JSON tab, but could not apply to this page.", true );
            }
            return;
        }
        ga.dd.draft.status( "No draft found.", true );
    }).fail( function() {
        ga.dd.draft.status( "Draft load failed.", true );
    });
}

ga.dd.draft.panelmap = function( panels ) {
    var map = {};
    if ( !panels ) {
        return map;
    }
    for ( var i = 0; i < panels.length; ++i ) {
        for ( var id in panels[i] ) {
            if ( panels[i].hasOwnProperty( id ) ) {
                map[ id ] = panels[i][ id ];
            }
        }
    }
    return map;
}

ga.dd.draft.cssrepeat = function( value ) {
    if ( value === undefined || value === null || value === "" ) {
        return "auto";
    }
    if ( value === "full" ) {
        return "1 / -1";
    }
    if ( Array.isArray( value ) ) {
        var parts = [];
        for ( var i = 0; i < value.length; ++i ) {
            parts.push( ga.dd.draft.cssrepeat( value[i] ) );
        }
        return parts.join( " " );
    }
    if ( typeof value == "number" ) {
        return value + "fr";
    }
    return "" + value;
}

ga.dd.draft.cssline = function( value ) {
    if ( value === undefined || value === null || value === "" ) {
        return "auto";
    }
    if ( value === "full" ) {
        return "1 / -1";
    }
    if ( Array.isArray( value ) && value.length == 2 ) {
        if ( value[0] == value[1] ) {
            return value[0];
        }
        return value[0] + " / " + value[1];
    }
    return value;
}

ga.dd.draft.ensurepanel = function( id, spec ) {
    var panel = document.getElementById( "ga-panel-" + id );
    if ( !panel ) {
        panel = ga.dd.primitive.makepanel( id, 1, "1/-1", "auto", "1fr" );
    }

    panel.style.display = "grid";
    if ( spec && spec.size ) {
        panel.style.gridTemplateRows = ga.dd.draft.cssrepeat( spec.size[0] );
        panel.style.gridTemplateColumns = ga.dd.draft.cssrepeat( spec.size[1] );
    }
    if ( spec && spec.location ) {
        panel.style.gridRow = ga.dd.draft.cssline( spec.location[0] );
        panel.style.gridColumn = ga.dd.draft.cssline( spec.location[1] );
    }
    panel.style.gap = spec && spec.gap ? spec.gap : "5px";
    panel.style.textAlign = spec && spec.align ? spec.align : "left";

    var drop = document.getElementById( "ga-paneldrop-" + id );
    if ( !drop ) {
        drop = document.createElement( "div" );
        drop.id = "ga-paneldrop-" + id;
        drop.className = "ga-dd-pid ga-dd-drop";
        drop.innerHTML = 'panel id:"' + id + '"';
        panel.insertBefore( drop, panel.firstChild );
    }

    ga.dd.panelctl.setcollapsible(
        panel,
        !!( spec && ( spec.collapsible === true || spec.collapsible == "true" || spec.collapsible == 1 ) ),
        !( spec && ( spec.default_open === false || spec.default_open == "false" || spec.default_open === 0 ) )
    );

    return panel;
}

ga.dd.draft.applypanels = function( map ) {
    for ( var id in map ) {
        if ( map.hasOwnProperty( id ) ) {
            ga.dd.draft.ensurepanel( id, map[id] );
        }
    }
    for ( var id in map ) {
        if ( map.hasOwnProperty( id ) && map[id].parent ) {
            var panel = document.getElementById( "ga-panel-" + id );
            var parent = document.getElementById( "ga-panel-" + map[id].parent );
            if ( panel && parent && panel.parentNode !== parent ) {
                parent.appendChild( panel );
            }
        }
    }
}

ga.dd.draft.applyfieldpart = function( field, part ) {
    if ( !field || !field.layout || !field.layout[ part ] || !field.layout.parent ) {
        return;
    }
    var node = document.getElementById( "ga-" + part + "-" + field.id );
    var parent = document.getElementById( "ga-panel-" + field.layout.parent );
    if ( !node || !parent ) {
        return;
    }
    if ( node.parentNode !== parent ) {
        parent.appendChild( node );
    }
    node.style.gridRow = ga.dd.draft.cssline( field.layout.location ? field.layout.location[0] : field.layout[ part ][0] );
    node.style.gridColumn = ga.dd.draft.cssline( field.layout[ part ] );
}

ga.dd.draft.applyfields = function( fields ) {
    if ( !fields ) {
        return;
    }
    for ( var i = 0; i < fields.length; ++i ) {
        ga.dd.draft.applyfieldpart( fields[i], "label" );
        ga.dd.draft.applyfieldpart( fields[i], "data" );
    }
}

ga.dd.draft.prunepanels = function( map ) {
    var panels = ga.dd.node && ga.dd.node.mod ? ga.dd.node.mod.querySelectorAll( ".ga-dd-panel" ) : [];
    for ( var i = panels.length - 1; i >= 0; --i ) {
        var id = panels[i].id.replace( /^ga-panel-/, "" );
        if ( !map[ id ] && panels[i].parentNode ) {
            panels[i].parentNode.removeChild( panels[i] );
        }
    }
}

ga.dd.draft.apply = function( layout ) {
    if ( !layout || !layout.panels || !layout.fields || !ga.dd.node || !ga.dd.node.mod ) {
        return false;
    }
    ga.dd.undo.push( "Load draft" );
    var map = ga.dd.draft.panelmap( layout.panels );
    ga.dd.draft.applypanels( map );
    ga.dd.draft.applyfields( layout.fields );
    ga.dd.draft.prunepanels( map );
    ga.dd.moduleinit.update();
    ga.dd.reset();
    return true;
}

ga.dd.copymod = function() {
    console.log( "ga.dd.copymod()" );
    ga.dd.copymod.do( document.getElementById("ga-dd-module-content-clipboard").innerHTML + "\n" );
}

ga.dd.copymod.do = function (textToCopy) {
    console.log( "ga.dd.copymod.do()" );
    // navigator clipboard api needs a secure context (https)
    if (navigator.clipboard && window.isSecureContext) {
        // navigator clipboard api method'
        return navigator.clipboard.writeText(textToCopy);
    } else {
        // text area method
        let textArea = document.createElement("textarea");
        textArea.value = textToCopy;
        // make the textarea out of viewport
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        return new Promise((res, rej) => {
            // here the magic happens
            document.execCommand('copy') ? res() : rej();
            textArea.remove();
        });
    }
}
    
ga.dd.dom2mod = function () {

    console.log( `ga.dd.dom2mod()` );
    // build module json from DOM and current module json
    // see ga.dd.moduleinit for start
    // https://genapp.rocks/wiki/wiki/docs_layout

    // notes:
    //   general : reorder as per original module, esp. for fields
    //   panels:
    //     'label' & 'data' are discarded (implies default values) since each field label & data are explicitly positioned
    //     location 'next' is discarded as explicitly positioned
    
    // panels

    var panels = [];
    var node = ga.dd.node.mod;

    ga.dd.dom2mod.cpanels( document.getElementById( "ga-dd-mod" ), panels );
    // console.log( "panels:\n" + JSON.stringify( panels, null, 2 ) );
    // console.dir( panels );

    // find all fields and update their panel/layout details
    // need to match with original
    var fields = {};

    var fnodes = node.getElementsByClassName( "ga-dd" );
    for ( var i = 0; i < fnodes.length; ++i ) {
        var fnode = fnodes[i];
        if ( !fnode.id ) {
            console.error( "ga.dd.dom2mod() : unexpected: field with class ga-dd has no id" );
            console.dir( fnode );
            continue;
        }
        var uid = fnode.id.replace( /^ga-(label|data)-/, '' );
        var nstate = ga.dd.nstate( fnode );
        fields[ uid ]               = fields[ uid ] || {};
        fields[ uid ].layout        = fields[ uid ].layout || {};
        fields[ uid ].layout.parent = nstate.panel.id.replace( /^ga-panel-/, '' );

        if ( /^ga-label-/.test( fnode.id ) ) {
            fields[ uid ].layout.label = [
                ga.dd.dom2mod.lfix( [
                    ga.dd.dom2mod.repeat( fnode.style.gridRowStart ),
                    ga.dd.dom2mod.repeat( fnode.style.gridRowEnd )
                ] )
                ,ga.dd.dom2mod.lfix( [
                    ga.dd.dom2mod.repeat( fnode.style.gridColumnStart ),
                    ga.dd.dom2mod.repeat( fnode.style.gridColumnEnd )
                ] )
            ];
            continue;
        }
        if ( /^ga-data-/.test( fnode.id ) ) {
            fields[ uid ].layout.data = [
                ga.dd.dom2mod.lfix( [
                    ga.dd.dom2mod.repeat( fnode.style.gridRowStart ),
                    ga.dd.dom2mod.repeat( fnode.style.gridRowEnd )
                ] )
                ,ga.dd.dom2mod.lfix( [
                    ga.dd.dom2mod.repeat( fnode.style.gridColumnStart ),
                    ga.dd.dom2mod.repeat( fnode.style.gridColumnEnd )
                ] )
            ];
            continue;
        }
        console.error( `ga.dd.dom2mod() : unexpected : field ${fnode.id} not ga-data nor ga-label` );
    }

    // add location to fields

    for ( var i in fields ) {
        ga.dd.dom2mod.setloc( fields[i].layout );
    }

    // console.log( JSON.stringify( fields, null, 2 ) );

    return [panels, fields];
}

ga.dd.dom2mod.setloc = function ( field ) {
    // finds data and/or label and puts location at top-left and resets data & label positions
    // console.log( "ga.dd.dom2mod.setloc()" );
    // console.dir( field );
    field.location = [ -1, -1 ];

    // set location top left data
    if ( field.data ) {
        if ( field.data.length != 2 ) {
            console.error( "ga.dd.dom2mod.setloc : field data not length 2" );
            return;
        }
        if ( Array.isArray( field.data[0] ) ) {
            field.location[0] = field.data[0][0];
        } else {
            field.location[0] = field.data[0];
        }
        if ( Array.isArray( field.data[1] ) ) {
            field.location[1] = field.data[1][0];
        } else {
            field.location[1] = field.data[1];
        }
    }

    // set location top left label
    if ( field.label ) {
        if ( field.label.length != 2 ) {
            console.error( "ga.dd.dom2mod.setloc : field label not length 2" );
            return;
        }
        if ( Array.isArray( field.label[0] ) ) {
            if ( field.location[0] < field.label[0][0] ) {
                field.location[0] = field.label[0][0];
            }
        } else {
            if ( field.location[0] < field.label[0] ) {
                field.location[0] = field.label[0];
            }
        }
        if ( Array.isArray( field.label[1] ) ) {
            if ( field.location[1] < field.label[1][0] ) {
                field.location[1] = field.label[1][0];
            }
        } else {
            if ( field.location[1] < field.label[1] ) {
                field.location[1] = field.label[1];
            }
        }
    }
    
    // adjust coordinates of data & labels

    if ( field.data ) {
        if ( Array.isArray( field.data[0] ) ) {
            field.data[0][0] -= field.location[0] - 1;
            field.data[0][1] -= field.location[0] - 1;
        } else {
            field.data[0] -= field.location[0] - 1;
        }
    }
    if ( field.label ) {
        if ( Array.isArray( field.label[0] ) ) {
            field.label[0][0] -= field.location[0] - 1;
            field.label[0][1] -= field.location[0] - 1;
        } else {
            field.label[0] -= field.location[0] - 1;
        }
    }

    // console.dir( field );
    
    return field;
}    

ga.dd.dom2mod.repeat = function ( str ) {
    // expands css style repeats(n,s)
    if ( !/^repeat/.test(str) ) {
        return str;
    }
    var ns = str.replace( /(^repeat\(|\$)/g, '' ).split(",");
    if ( ns.length != 2 ) {
        console.err( `ga.dd.dom2mod.repeat( ${str} ) failed regexp split` );
    }
    return Array(+ns[0]).fill(ns[1].replace(')','').replace( /(^\s+|\s+$)/g, ''));
}
    
ga.dd.dom2mod.sfix = function ( obj ) {
    // special adjustments to map back to expected module layout

    // [ "auto" ] => 1
    if ( Array.isArray(obj) && obj.every((v, i) => v === "auto" ) ) {
        return obj.length;
    }
    // string of fr => array
    if ( typeof obj === 'string' && /^\s*(([0-9.]+fr)\s+)*([0-9.]+fr)\s*$/.test(obj) ) {
        return obj.replace( /(^\s+|fr|\s+$)/g, '' ).split( " " ).map(Number);
    }
    return obj;
}

ga.dd.dom2mod.lfix = function ( obj ) {
    // special adjustments to map back to expected module layout

    if ( !Array.isArray(obj) || obj.length != 2 ) {
        console.error( "ga.dd.dom2mod.lfix() unexpected argument value" );
        return obj;
    }

    // [ 1, -1 ] => "full"
    if ( obj.every((v, i) => v === ["1","-1"][i] ) ) {
        return "full";
    }

    // [ n, "auto" ]
    if ( /^\d+$/.test(obj[0]) && obj[1] === "auto" ) {
        return +obj[0];
    }

    if ( !(obj.every((v, i) => /^-?\d+$/.test( v ) ) ) ) {
        console.error( "ga.dd.dom2mod.lfix() argument array contains non-numeric strings" );
        return obj;
    }

    if ( obj[0] === obj[1] ) {
        return +obj[0];
    }
    return [ +obj[0], +obj[1] ];
}

ga.dd.dom2mod.cpanels = function( node, panels ) {
    var parent = node.classList.contains( "ga-dd-panel" ) ? node.id.replace( /^ga-panel-/, '' ) : null;
    
    for ( var i in node.children ) {
        if ( node.children.hasOwnProperty(i) ) {
            if ( node.children[i].classList.contains( "ga-dd-panel" ) ) {
                var pid = node.children[i].id.replace( /^ga-panel-/, '' );
                var pobj = {};
                pobj[ pid ] = {};
                if ( parent ) {
                    pobj[ pid ].parent   = parent;
                    pobj[ pid ].location = [
                        ga.dd.dom2mod.lfix( [
                            ga.dd.dom2mod.repeat( node.children[i].style.gridRowStart ),
                            ga.dd.dom2mod.repeat( node.children[i].style.gridRowEnd )
                        ] )
                        ,ga.dd.dom2mod.lfix( [
                            ga.dd.dom2mod.repeat( node.children[i].style.gridColumnStart ),
                            ga.dd.dom2mod.repeat( node.children[i].style.gridColumnEnd )
                        ] )
                    ];

                }
                pobj[ pid ].align = node.children[i].style.textAlign;
                pobj[ pid ].gap   = node.children[i].style.gap;
                if ( node.children[i].dataset.gaCollapsible == "true" ||
                     node.children[i].classList.contains( "ga-layout-collapsible" ) ) {
                    pobj[ pid ].collapsible = true;
                    pobj[ pid ].default_open = !node.children[i].classList.contains( "ga-layout-default-closed" );
                }

                // size needs some work, e.g. 1fr 1fr -> 1,1
                // array or not etc
                // validate against original layout
                pobj[ pid ].size  = [
                    ga.dd.dom2mod.sfix( ga.dd.dom2mod.repeat( node.children[i].style.gridTemplateRows ) )
                    ,ga.dd.dom2mod.sfix( ga.dd.dom2mod.repeat( node.children[i].style.gridTemplateColumns ) )
                ];

                panels.push( pobj );

                ga.dd.dom2mod.cpanels( node.children[i], panels );
            }
        }
    }
}

ga.dd.openmodule = function ( moduleid ) {
    if ( !moduleid || !/^[A-Za-z0-9_]+$/.test( moduleid ) ) {
        return false;
    }

    var menuid = null;
    for ( var key in ga.menumodules ) {
        if ( ga.menumodules.hasOwnProperty( key ) && key.match( new RegExp( "/" + moduleid + "$" ) ) ) {
            menuid = key.split( "/" )[0];
            break;
        }
    }

    if ( !menuid ) {
        console.warn( "Designer could not find menu for module '" + moduleid + "'." );
        return false;
    }

    $( "#" + menuid ).trigger( "click" );

    var buttonid = menuid + "_" + moduleid;

    ga.dd.waitfor( function () {
        return $( "#" + buttonid ).length > 0;
    }, function () {
        $( "#" + buttonid ).trigger( "click" );
        ga.dd.waitfor( function () {
            return $( "#" + moduleid ).length > 0 && $( "#ga-dd-on" ).length > 0 && ga.dd && ga.dd.reset;
        }, function () {
            $( "#ga-dd-on" ).prop( "checked", true );
            ga.dd.reset();
        }, 80, 50 );
    }, 80, 50 );

    return true;
}

ga.dd.waitfor = function ( test, done, delay, tries ) {
    delay = delay || 100;
    tries = tries || 50;

    if ( test() ) {
        done();
        return;
    }

    if ( tries < 1 ) {
        return;
    }

    setTimeout( function () {
        ga.dd.waitfor( test, done, delay, tries - 1 );
    }, delay );
}

ga.dd.openfromurl = function () {
    var moduleid = ga.urlparams( "_designer" );
    if ( !moduleid ) {
        return;
    }

    ga.dd.openmodule( decodeURIComponent( moduleid ) );
}

$( function () {
    ga.dd.openfromurl();
} );
    
