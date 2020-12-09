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
// ----------------------------------------------------------------------------------------------------------
// summary of operations
// ----------------------------------------------------------------------------------------------------------
// ga.dd.allowDrag                          helper to preventDefault
// ga.dd.drag                               on drag event
// ga.dd.drop                               on drop event - main processing
// ga.dd.reset                              turn on/off dd based upon checkboxes
// ----------------------------------------------------------------------------------------------------------

ga.dd.allowDrop = function (ev) {
    console.log( "ga.dd.allowDrop()" );
    ev.preventDefault();
}

ga.dd.drag = function (ev) {
    console.log( "ga.dd.drag()" );
    ev.dataTransfer.setData("text", ev.target.id);
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
    ga.dd.inter = document.getElementById( "ga-dd-inter" ).checked;
    console.log( `ga_dd_on ${ga.dd.on} ga_inter_on ${ga.dd.inter}` );
    // find dragables class ga-dd
    var dds = document.querySelectorAll(".ga-dd");
    if ( ga.dd.on ) {
        for ( var i in dds ) {
            if ( dds.hasOwnProperty( i ) ) {
                console.log( `${dds[i].id} turning on drag` );
                dds[i].draggable   = true;
                dds[i].ondrop      = function(ev){ga.dd.drop(ev)};
                dds[i].ondragover  = function(ev){ga.dd.allowDrop(ev)};
                dds[i].ondragstart = function(ev){ga.dd.drag(ev)};
                dds[i].classList.add( "ga-nus" );
            }
        }
    } else {
        for ( var i in dds ) {
            if ( dds.hasOwnProperty( i ) ) {
                console.log( `${dds[i].id} turning off drag` );
                dds[i].draggable   = false;
                dds[i].ondrop      = null;
                dds[i].ondragover  = null;
                dds[i].ondragstart = null;
                dds[i].classList.remove( "ga-nus" );
            }
        }
    }        
}    
