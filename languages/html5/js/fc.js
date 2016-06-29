/*jslint white: true, plusplus: true*/
/* assumes: jquery > 1.11.0, jqtree >= 3.0.9, jquery-base64 */

ga.fc = function( id, cb ) {
    var i,
        waits;

    __~debug:fc{console.log( "gc.fc( " + id + " id.decoded " + ( id != "#" ? $.base64.decode( id ) : id ) + " , [cb]() )" );}
    if ( ga.fc.cache[ id ] ) {
        __~debug:fc{console.log( "gc.fc( " + id + " , [cb]() ) cached" );}
        cb( ga.fc.cache[ id ] );
    } else {
        // only one ajax call per id
        if ( !ga.fc.waits[ id ] )
        {
            __~debug:fc{console.log( "gc.fc( " + id + " , [cb]() ) ajax call" );}
            ga.fc.waits[ id ] = [ cb ];
            $.ajax( ga.fc.url + id ).success( function( data ) {
                __~debug:fc{console.log( "gc.fc( " + id + " , [cb]() ) ajax call success" );}
                waits = ga.fc.waits[ id ];
                delete ga.fc.waits[ id ];
                data = $.parseJSON( data );
                ga.fc.cache[ id ] = data;
                
                for ( i = waits.length; i--; )
                {
                    waits[ i ]( data );
                }
            }).error( function( error ) {
                __~debug:fc{console.log( "gc.fc( " + id + " , [cb]() ) ajax call fail" );}
                waits = ga.fc.waits[ id ];
                delete ga.fc.waits[ id ];
                console.log( "ajax error" );
                console.dir( error );
                for ( i = waits.length; i--; )
                {
                    waits[ i ]( "**error**" );
                }
                ga.fc.ajax_error_msg( "ajax get error: " + error.statusText );
            });
        } else {
            __~debug:fc{console.log( "gc.fc( " + id + " , [cb]() ) waiting for another call to respond" );}
            ga.fc.waits[ id ].push( cb );
        }
    }
    return true;
};

ga.fc.clear = function( id ) {
    var i,
        children = ga.fc.children( id );
    __~debug:fc{console.log( "gc.fc.clear( " + id + " )" );}

    for ( i in children ) {
        if ( ga.fc.cache[ i ] ) {
            delete ga.fc.cache[ i ];
        }
    }
    if ( ga.fc.cache[ id ] ) {
        delete ga.fc.cache[ id ];
    }
    for ( i in ga.fc.trees ) {
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

ga.fc.refresh = function( id ) {
    var i;

    __~debug:fc{console.log( "gc.fc.refresh( " + id + " )" );}

    for ( i in ga.fc.trees ) {
        if ( $( i ).length )
        {
            if ( ga.fc.cache[ id ] ) {
                if ( id !== "#" ) {
                    $( i ).jstree( true ).refresh_node( id );
                } else {
                    $( i ).jstree( true ).refresh();
                }
            }
        }
    }
};


ga.fc.delete_node = function( ids ) {
    var i;

    __~debug:fc{console.log( "gc.fc.delete_node( ids.length " + ( ids ? ids.length : "undefined" ) + " )" );}

    if ( !ids.length ) {
        return;
    }
        

    if ( ga.fc.url_delete && ga.fc.url_delete.length !== 0 ) {
        $.ajax({
              url      : ga.fc.url_delete,
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
//                ga.fc.refresh( "#" );
                ga.fc.delete_error_msg( ids, data.error );
            } else {
// we are always clearing the whole tree on delete
//                if ( data.reroot && data.reroot === 1 ) {
                ga.fc.clear( "#" );
//                } else {
//                    for ( i in ga.fc.trees ) {
//                        if ( $( i ).length )
//                        {
//                            console.log( "ga.fc.remove from tree " + i );
//                            console.dir( ids );
//                            $( i ).jstree( true ).delete_node( ids );
//                        }
//                    }
//                }
            }

        }).error( function( error ) {
            console.log( "ajax error" );
            console.dir( error );
//            ga.fc.refresh( "#" );
            ga.fc.ajax_error_msg( "ajax delete error: " + error.statusText );
        });
;
    } else {
        console.log( "ga.fc.delete_node, no url_delete " + ids.join( "," )  );
    }
};

ga.fc.delete_node_message = function( ids ) {
    var msg = "You are about to permanently remove " + ids.length + " file";
//        strip2 = function(str) { return str.substr( 2 ); };    

    if ( !ids.length ) {
        return "Can not remove a directory from here";
    }
    if ( ids.length > 1 ) {
        msg += "s and/or directories";
    } else {
        msg += " or directory";
    }
    msg += " and the contents, including subdirectories, of any directory listed below<p>";

    return msg;
// :<p>" + $.map( $.map( ids.slice( 0, 5 ), $.base64.decode ), strip2 ).join( "<p>" );
//    if ( ids.length > 5 ) {
//        msg += "<p> Note: an additional " + ( ids.length - 5 ) + " entr";
//        if ( ids.length > 6 ) {
//            msg += "ies are not shown. ";
//        } else {
//            msg += "y is not shown. ";
//        }
//    }
//    return msg;
};

ga.fc.delete_node_message_files = function( ids ) {
    return ids.length ? "<div class=\"table-wrapper\"><table><tr><td>" + 
           $.map( $.map( ids, $.base64.decode ), function(str) { return str.substr( 2 ); } )
           .join( "</td></tr><tr><td>" ) + "</td></tr></table></div>" : "";
};

ga.fc.children = function( id, result ) {
    var i,
        idc;
    __~debug:fc{console.log( "gc.fc.children( " + id + " , result.length: " + ( result ? result.length : "undef" ) + " )" );}
    result = result || {};
    if ( ga.fc.cache[ id ] )
    {
        // expand and return all children in the cache
        for ( i = ga.fc.cache[ id ].length; i--; ) {
            if ( ga.fc.cache[ id ][ i ].children ) {
                idc = ga.fc.cache[ id ][ i ].id;
                if ( ga.fc.cache[ idc ] ) {
                   result[ idc ] = true;
                   result = ga.fc.children( idc, result );
                }
            }
        }
    }
    return result;
};   

ga.fc.cache = {};
ga.fc.waits = {};
ga.fc.trees = {};
