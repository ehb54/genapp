/*jslint white: true, plusplus: true*/
/* assumes: jquery > 1.11.0, jqtree >= 3.0.9, jquery-base64 */

ga.util = {};


/* utilities for jqgrid */

ga.util.jqgrid = {};

ga.util.jqgrid.filter = function( jqgridid, runningid, moduleid, projectid ) {
    __~debug:jqgrid{console.log( `ga.util.jqgrid.filter( ${jqgridid}, ${runningid}, ${moduleid}, ${projectid}` );}

    var all        = "*all*";
    var projectval = document.getElementById( projectid ).value;
    var moduleval  = document.getElementById( moduleid ).value;
    var runningval = document.getElementById( runningid ).checked;
    __~debug:jqgrid{var runstr = runningval ? "true" : "false";}
    __~debug:jqgrid{console.log( `ga.util.jqgrid.filter() running '${runstr}'  moduleval '${moduleval}'  projectval '${projectval}'` );}

    if ( projectval == all &&
         moduleval  == all &&
         !runningval ) {
        __~debug:jqgrid{console.log( `ga.util.jqgrid.filter() no filters, resetting grid` );}
        $(`#${jqgridid}`).jqGrid("setGridParam", { postData: { filters: {} },search: false }).trigger("reloadGrid" );
        return;
    }
    
    rules = [];
    
    if ( projectval != all ) {
        rules.push( { field: projectid, op: "cn", data: `>${projectval}<` } );
    }
    if ( moduleval != all ) {
        rules.push( { field: moduleid, op: "cn", data: `/${moduleval}<` } );
    }

    // add running rule (needs first mod to grid data

    $(`#${jqgridid}`).jqGrid("setGridParam", {
        postData: {
            filters: {
                groupOp : "AND",
                rules   : rules
            }
        },
        search : true
    }).trigger( "reloadGrid" );
}

