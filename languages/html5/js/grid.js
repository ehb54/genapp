/*jslint white: true, plusplus: true*/
/* assumes: jquery > 1.11.0, jqtree >= 3.0.9, jquery-base64 */

// grid layout functions

ga.grid             = {};

ga.grid.rc = function ( r_start, c_start, r_end, c_end ) {
    var out = "";

    if ( r_start && r_end && r_start < r_end - 1 ) {
        out += "grid-row-start:" + r_start + ";grid-row-end:" + r_end + ";";
    } else {
        if ( r_start ) {
            out += "grid-row:" + r_start + ";";
        }
    }

    if ( c_start && c_end && c_start < c_end - 1 ) {
        out += "grid-column-start:" + c_start + ";grid-column-end:" + c_end + ";";
    } else {
        if ( c_start ) {
            out += "grid-column:" + c_start + ";";
        }
    }
    return out;
}

ga.grid.rcs = function ( r_start, c_start, r_end, c_end ) {
    return 'style="' + ga.grid.rc( r_start, c_start, r_end, c_end ) + '"';
}

ga.grid.drcs = function ( r_start, c_start, r_end, c_end, style, cls) {
    style = style || "";
    style += ga.grid.rc( r_start, c_start, r_end, c_end );
    if ( cls ) {
        return '<div class="' + cls + '" style="' + style + '">';
    } else {
        return '<div style="' + style + '">';
    }
}

ga.grid.init = function () {
    return { row: 0, col: 1 };
}

ga.grid.newrow = function ( ref ) {
    ref.row++;
    ref.col = 1;
}

ga.grid.next = function( ref, field, style, cls ) {
    __~debug:qrgrid{console.log( "ga.grid.next(" + JSON.stringify( ref ) + " , " + JSON.stringify( field ) +  " )" );}

    var col_start;
    var col_end;
    var row_end;
    var retval;
    
    ref = ref || { row: 1, col: 1 };

    if ( field ) {
        ref.col = field[ 0 ] ? field[ 0 ] : ref.col;
        col_end = field[ 1 ] ? field[ 1 ] + ref.col : ref.col;
        ref.row = field[ 2 ] ? field[ 2 ] : ref.row;
        row_end = field[ 3 ] ? field[ 3 ] + ref.row : ref.row;
    } else {
        col_end = ref.col;
        row_end = ref.row;
    }

    col_start = ref.col;
    ref.col = col_end + 1;
    return ga.grid.drcs( ref.row, col_start, row_end, col_end, style, cls );
}

ga.grid.nextstyle = function( ref, field, style ) {
    var col_start;
    var col_end;
    var row_end;
    var retval;
    style = style || "";
    
    ref = ref || { row: 1, col: 1 };

    if ( field ) {
        ref.col = field[ 0 ] ? field[ 0 ] : ref.col;
        col_end = field[ 1 ] ? field[ 1 ] + ref.col : ref.col;
        ref.row = field[ 2 ] ? field[ 2 ] : ref.row;
        row_end = field[ 3 ] ? field[ 3 ] + ref.row : ref.row;
    } else {
        col_end = ref.col;
        row_end = ref.row;
    }

    col_start = ref.col;
    ref.col = col_end + 1;
    return ga.grid.rc( ref.row, col_start, row_end, col_end, style ) + style;
}
