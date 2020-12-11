/*jslint white: true, plusplus: true*/
/* assumes: jquery > 1.11.0, jqtree >= 3.0.9, jquery-base64 */


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
// ----------------------------------------------------------------------------------------------------------
// summary of operations
// ----------------------------------------------------------------------------------------------------------
// ga.dd.allowDrag                          helper to preventDefault
// ga.dd.drag                               on drag event
// ga.dd.drop                               on drop event - main processing
// ga.dd.drop_intra                         drop for intra processing, called by ga.dd.drop
// ga.dd.reset                              turn on/off dd based upon checkboxes
// ga.dd.seloff                             turn off ga-dd-sel highlighting (remove class)
// ----------------------------------------------------------------------------------------------------------

ga.dd.allowDrop = function (ev) {
    console.log( "ga.dd.allowDrop()" );
    ev.preventDefault();
}

ga.dd.drag = function (ev) {
    console.log( "ga.dd.drag()" );
    ev.dataTransfer.setData("text", ev.target.id);}


ga.dd.drop_intra = function (ev) {
    var from_id                = ev.dataTransfer.getData("text");
    var to_id                  = ev.target.id;

    console.log( `ga.dd.drop_intra() from_id ${from_id} to_id ${to_id}` );

    var from_node_style        = document.getElementById( from_id ).style;
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
    var data = ev.dataTransfer.getData("text");
    console.log( `drop() from:${data} to:${ev.target}` );
    // ev.target.appendChild(document.getElementById(data));
    // ev.target.insertAdjacentHTML("beforebegin",document.getElementById(data).outerHTML);
    // get source parent and pos in panel


    // panels
    var fromNode = document.getElementById(data);
    var fromparentpanel = fromNode.parentNode.id;
    var toparentpanel = ev.target.parentNode.id;
    console.log( `from panel ${fromparentpanel} -> to panel ${toparentpanel}` );
    var samepanel = fromparentpanel == toparentpanel;
    if ( samepanel ) {
        console.log( "same parent panel, simple renumbering" );
    } else {
        console.log( "different parent panels, insertion & dual renumbering" );
    }

    if ( ga.dd.intra ) {
        if ( !samepanel ) {
            console.log( "ga.dd.drop() intra drops only allowed within one panel" );
            return;
        }
        return ga.dd.drop_intra( ev );
    }

    // get from & to label & data coordinates

    var from_id = data.replace( /^ga-[a-z]*-/, '' );
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
    var dds = document.querySelectorAll(".ga-dd");
    if ( ga.dd.on ) {
        for ( var i in dds ) {
            if ( dds.hasOwnProperty( i ) ) {
                console.log( `${dds[i].id} turning on drag` );
                dds[i].draggable     = true;
                dds[i].ondrop        = function(ev){ga.dd.drop(ev)};
                dds[i].ondragover    = function(ev){ga.dd.allowDrop(ev)};
                dds[i].ondragstart   = function(ev){ga.dd.drag(ev)};
                dds[i].oncontextmenu = function(ev){ga.dd.rclick(ev)};
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
                dds[i].classList.remove( "ga-dd-on" );
            }
        }
    }        
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
    var sel = document.querySelectorAll(".ga-dd-sel");
    for ( var i in sel ) {
        if ( sel.hasOwnProperty( i ) ) {
            sel[i].classList.remove( "ga-dd-sel" );
        }
    }
}
ga.dd.menu = function( choice ) {
    console.log( `ga.dd.menu( "${choice}" )` );
    window.onclick = null;
    document.getElementById( "ga-dd-menu" ).style.display="none";
    ga.dd.seloff();
}
