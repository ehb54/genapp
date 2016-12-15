/*jslint white: true, plusplus: true*/
/* assumes: jquery > 1.11.0, jqtree >= 3.0.9, jquery-base64 */

ga.jc = function( id, cb ) {
    var i,
        waits;

    __~debug:jc{console.log( "ga.jc( " + id + " )" );};

    if ( ga.jc.cache[ id ] ) {
        cb( ga.jc.cache[ id ] );
    } else {
        // only one ajax call per id
        if ( !ga.jc.waits[ id ] )
        {
            ga.jc.waits[ id ] = [ cb ];
            $.ajax( { url:ga.jc.url , data:{ _tree:id, _window: window.name } } ).success( function( data ) {
                waits = ga.jc.waits[ id ];
                delete ga.jc.waits[ id ];
                data = $.parseJSON( data );
                ga.jc.cache[ id ] = data;
                
                for ( i = waits.length; i--; )
                {
                    waits[ i ]( data );
                }
            }).error( function( error ) {
                waits = ga.jc.waits[ id ];
                delete ga.jc.waits[ id ];
                console.log( "ajax error" );
                console.dir( error );
                for ( i = waits.length; i--; )
                {
                    waits[ i ]( "**error**" );
                }
                ga.jc.ajax_error_msg( "ajax get error: " + error.statusText );
            });
        } else {
            ga.jc.waits[ id ].push( cb );
        }
    }
    return true;
};

ga.jc.clear_leaf = function( id ) {
__~debug:jc{   console.log( "ga.jc.clear_leaf( " + id + " )" );};
    var i,
        any_contain = 0,
        node;

// does any tree currently have the node ?
    for ( i in ga.jc.trees ) {
        if ( $( i ).length )
        {
            node = $( i ).jstree( true ).get_node( id );
            if ( node ) {
                any_contain = 1;
                break;
            }
        }
    }
__~debug:jc{   console.log( "ga.jc.clear_leaf any_contain: " + any_contain );}
    any_contain ? ga.jc.clear( node.parent ) : ga.jc.clear( "#" );
}

ga.jc.clear = function( id ) {
    var i,
        children = ga.jc.children( id );

    for ( i in children ) {
        if ( ga.jc.cache[ i ] ) {
            delete ga.jc.cache[ i ];
        }
    }
    if ( ga.jc.cache[ id ] ) {
        delete ga.jc.cache[ id ];
    }
    for ( i in ga.jc.trees ) {
        if ( $( i ).length )
        {
            if ( id !== "#" ) {
                $( i ).jstree( true ).refresh_node( id );
            } else {
                $( i ).jstree( true ).refresh();
            }
        }
    }
};

ga.jc.refresh = function( id ) {
    var i;

    for ( i in ga.jc.trees ) {
        if ( $( i ).length )
        {
            if ( ga.jc.cache[ id ] ) {
                if ( id !== "#" ) {
                    $( i ).jstree( true ).refresh_node( id );
                } else {
                    $( i ).jstree( true ).refresh();
                }
            }
        }
    }
};


ga.jc.delete_node = function( ids ) {
    var i;

    if ( !ids.length ) {
        return;
    }
        

    if ( ga.jc.url_delete && ga.jc.url_delete.length !== 0 ) {
        $.ajax({
              url      : ga.jc.url_delete,
              data     :  {
                            _window : window.name,
                           _spec   : "fc_cache",
                           _delete : ids.join( ',' )
                         },
              dataType : 'json',
              method   : 'POST'
            }).success( function( data ) {
            console.log( "ajax delete done" );
//            console.dir( data );
            if ( data.error && data.error.length ) {
//                ga.jc.refresh( "#" );
                ga.jc.delete_error_msg( ids, data.error );
            } else {
// we are always clearing the whole tree on delete
//                if ( data.reroot && data.reroot === 1 ) {
                ga.jc.clear( "#" );
//                } else {
//                    for ( i in ga.jc.trees ) {
//                        if ( $( i ).length )
//                        {
//                            console.log( "ga.jc.remove from tree " + i );
//                            console.dir( ids );
//                            $( i ).jstree( true ).delete_node( ids );
//                        }
//                    }
//                }
            }

        }).error( function( error ) {
            console.log( "ajax error" );
            console.dir( error );
//            ga.jc.refresh( "#" );
            ga.jc.ajax_error_msg( "ajax delete error: " + error.statusText );
        });
;
    } else {
        console.log( "ga.jc.delete_node, no url_delete " + ids.join( "," )  );
    }
};

ga.jc.delete_node_message = function( ids ) {
    var msg = "You are about to permanently remove " + ids.length + " job";

    if ( ids.length > 1 ) {
        msg += "s";
    }
    return msg;
};

ga.jc.delete_node_message_files = function( ids ) {
    return ids.length ? "<div class=\"table-wrapper\"><table><tr><td>" + 
           $.map( $.map( ids, $.base64.decode ), function(str) { return str.substr( 2 ); } )
           .join( "</td></tr><tr><td>" ) + "</td></tr></table></div>" : "";
};

ga.jc.children = function( id, result ) {
    var i,
        idc;
    result = result || {};
    if ( ga.jc.cache[ id ] )
    {
        // expand and return all children in the cache
        for ( i = ga.jc.cache[ id ].length; i--; ) {
            if ( ga.jc.cache[ id ][ i ].children ) {
                idc = ga.jc.cache[ id ][ i ].id;
                if ( ga.jc.cache[ idc ] ) {
                   result[ idc ] = true;
                   result = ga.jc.children( idc, result );
                }
            }
        }
    }
    return result;
};   

ga.jc.cache = {};
ga.jc.waits = {};
ga.jc.trees = {};
