/*jslint white: true, plusplus: true*/
/* assumes: jquery > 1.11.0, jqtree >= 3.0.9, jquery-base64 */

ga.util = {};

// temp for testing

ga.util.jaa = function( e, newtab ) {
    // attach
    __~debug:jqgrid{console.log( `ga.util.jaa( ${e.parentElement.parentElement.id} )` );}
    return false;
}

ga.util.jac = function( e ) {
    // cancel
    __~debug:jqgrid{console.log( `ga.util.jac( ${e.parentElement.parentElement.id} )` );}
    return false;
}

ga.util.jad = function( e ) {
    // delete
    __~debug:jqgrid{console.log( `ga.util.jad( ${e.parentElement.parentElement.id} )` );}
    return false;
}

ga.util.jau = function( e ) {
    // unlock
    __~debug:jqgrid{console.log( `ga.util.jau( ${e.parentElement.parentElement.id} )` );}
    return false;
}

/* utilities for jqgrid */

ga.util.jqgrid = {};

ga.util.jqgrid.data = {};

ga.util.jqgrid.setup = function( mod, id, url ) {
    __~debug:jqgrid{console.log( `ga.util.jqgrid.setup( ${mod}, ${id}, ${url}` )};
    ga.util.jqgrid.data[mod] = ga.util.jqgrid.data[mod] || {};

    // *** distasteful to have hard coded ids, need to add ids here if we extend the job manager search criteria or pass individually in the relevant .input 

    ga.util.jqgrid.data[mod][ id ] =
        {
            url : url
            ,module  : "module"
            ,project : "project"
            ,running : "running"
        }
    ;
}

ga.util.jqgrid.load = function( mod, id ) {
    __~debug:jqgrid{console.log( `ga.util.jqgrid.load( ${mod}, ${id})` )};

    $.ajax({
        type: 'GET',
        url: `${ga.util.jqgrid.data[mod][id].url}?_window=${window.name}`,
        data: '',
        dataType: 'json',
        success: function(result) {
            var $grid = $(`#${id}`);
            var cbColModel;
            var idsOfSelectedRows = [];
            $grid.jqGrid({
                rowNum: 999999,
                datatype: 'jsonstring',
                datastr: result.jobgrid.outerwrapper,
                colNames: result.colNames,
                colModel: result.colModel,
                jsonReader: {
                    root: 'innerwrapper.rows',
                    repeatitems: false
                },
                gridview: true,
                height: 'auto',
                viewrecords: true,
                loadonce: true,
                loadComplete: function() {
                    console.log('jqgrid loadcomplete');
                    console.log(`rows ${this.rows.length}`);
                }
            });
            $('#cb_' + $grid[0].id).hide();
            $('#jqgh_' + $grid[0].id + '_cb').addClass('ui-jqgrid-sortable');
            cbColModel = $grid.jqGrid('getColProp', 'cb');
            cbColModel.sortable = true;
            cbColModel.sorttype = function(value, item) {
                return 'cb' in item && item.cb ? 1 : 0;
            };
            // not sure why this doesn't work under "loadComplete:"
            ga.util.jqgrid.filter( mod, id );
        }
    });
}

ga.util.jqgrid.saveparams = function( mod, id ) {
    __~debug:jqgrid{console.log( `ga.util.jqgrid.saveparams( ${mod}, ${id})` )};
    var $grid = $( `#${id}` );
    ga.util.jqgrid.data[mod][id].params =
        {
            sortname: $grid.jqGrid( 'getGridParam', 'sortname' )
            ,sortorder: $grid.jqGrid( 'getGridParam', 'sortorder' )
        }
    ;
}

ga.util.jqgrid.reload = function( mod, id ) {
    __~debug:jqgrid{console.log( `ga.util.jqgrid.reload( ${mod}, ${id})` )};
    var $grid = $( `#${id}` );
    ga.util.jqgrid.saveparams( mod, id );
    $grid.jqGrid('GridUnload');
    ga.util.jqgrid.load( mod, id );
}

// ga.util.jqgrid.filter = function( jqgridid, runningid, moduleid, projectid ) {
ga.util.jqgrid.filter = function( mod, id ) {
    __~debug:jqgrid{console.log( `ga.util.jqgrid.filter( ${mod}, ${id} )` );}

    var all        = "*all*";
    var projectval = document.getElementById( ga.util.jqgrid.data[mod][id].project ).value;
    var moduleval  = document.getElementById( ga.util.jqgrid.data[mod][id].module ).value;
    var runningval = document.getElementById( ga.util.jqgrid.data[mod][id].running ).checked;
    __~debug:jqgrid{var runstr = runningval ? "true" : "false";}
    __~debug:jqgrid{console.log( `ga.util.jqgrid.filter() running '${runstr}'  moduleval '${moduleval}'  projectval '${projectval}'` );}

    if ( projectval == all &&
         moduleval  == all &&
         !runningval ) {
        __~debug:jqgrid{console.log( `ga.util.jqgrid.filter() no filters, resetting grid` );}
        $(`#${id}`).jqGrid("setGridParam", { postData: { filters: {} },search: false }).trigger("reloadGrid" );
        return;
    }
    
    // reset grid
    var grid = $(`#${id}`);
    grid.jqGrid('setGridParam',{search:false});
    var postData = grid.jqGrid('getGridParam','postData');
    $.extend(postData,{filters:""});
    
    rules = [];
    
    if ( projectval != all ) {
        rules.push( { field: ga.util.jqgrid.data[mod][id].project, op: "cn", data: `>${projectval}<` } );
    }
    if ( moduleval != all ) {
        rules.push( { field: ga.util.jqgrid.data[mod][id].module, op: "cn", data: `/${moduleval}<` } );
    }
    if ( runningval ) {
        rules.push( { field: "duration", op: "cn", data: `>active<` } );
    }

    __~debug:jqgrid{console.dir(rules);}

    // add running rule (needs first mod to grid data

    if ( ga.util.jqgrid.data[mod][id].params ) {
        grid.jqGrid("setGridParam", ga.util.jqgrid.data[mod][id].params );
    };

    grid.jqGrid("setGridParam", {
        postData: {
            filters: {
                groupOp : "AND",
                rules   : rules
            }
        },
        search : true
    }).trigger( "reloadGrid" );
}

