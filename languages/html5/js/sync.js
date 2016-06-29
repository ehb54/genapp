/*jslint white: true, plusplus: true*/
/* assumes: jquery > 1.11.0, jqtree >= 3.0.9, jquery-base64 */

// create or join a sync group
ga.sync = function( pkg, mod, sync ) {
    __~debug:sync{console.log( "ga.sync( " + pkg + " , " + mod + " , " + sync + " )" );}
    var i,
    jqt = $( "#" + mod ),
    jqo;

    // does one already exist in DOM, if so, set our val to it
    if ( jqt &&
         ga.sync.data &&
         ga.sync.data[ pkg ] &&
         ga.sync.data[ pkg ][ sync ] ) {
        ga.sync.data[ pkg ][ sync ][ mod ] = true;
        for ( i in ga.sync.data[ pkg ][ sync ] ) {
            if ( i != mod ) {
                jqo = $( "#" + i );
                if ( jqo && $.isNumeric( jqo.val() ) ) {
                    __~debug:sync{console.log( "ga.sync( " + pkg + " , " + mod + " , " + sync + " ) setting to preexisting " + i );}
                    jqt.val( jqo.val() );
                    jqt.change();
                    return;
                }
            }
        }
        if ( ga.sync.data[ pkg ][ sync ]._lastval &&
             $.isNumeric( ga.sync.data[ pkg ][ sync ]._lastval ) )
        {
            __~debug:sync{console.log( "ga.sync( " + pkg + " , " + mod + " , " + sync + " ) setting to preexisting _lastval " + ga.sync.data[ pkg ][ sync ]._lastval);}
            jqt.val( ga.sync.data[ pkg ][ sync ]._lastval );
            jqt.change();
            return;
        }
        __~debug:sync{console.log( "ga.sync( " + pkg + " , " + mod + " , " + sync + " ) preexisting but nothing found in DOM to set from" );}
        return;
    }        
    ga.sync.data = ga.sync.data || {};
    ga.sync.data[ pkg ] = ga.sync.data[ pkg ] || {};
    ga.sync.data[ pkg ][ sync ] = ga.sync.data[ pkg ][ sync ] || {};
    ga.sync.data[ pkg ][ sync ][ mod ] = true;
}

// when a value changes, also set the others in the sync group
ga.sync.change = function( pkg, mod, sync ) {
    var i,
    jqt = $( "#" + mod ),
    jqtv,
    jqo;
    __~debug:sync{console.log( "ga.sync.change( " + pkg + " , " + mod + " , " + sync + " )" );}

    if ( !( jqt &&
            $.isNumeric( jqt.val() ) &&
            ga.sync.data &&
            ga.sync.data[ pkg ] &&
            ga.sync.data[ pkg ][ sync ] ) ) {
        // nothing to do
        __~debug:sync{console.log( "ga.sync.change( " + pkg + " , " + mod + " , " + sync + " ) return empty" );}
        return;
    }
    __~debug:sync{console.log( "ga.sync.change( " + pkg + " , " + mod + " , " + sync + " ) setting last val to " + jqt.val() );}
    ga.sync.data[ pkg ][ sync ]._lastval = jqt.val();
    for ( i in ga.sync.data[ pkg ][ sync ] ) {
        if ( i != mod ) {
            jqo = $( "#" + i );
            if ( jqo && jqo.val() != jqt.val() ) {
                __~debug:sync{console.log( "ga.sync.change( " + pkg + " , " + mod + " , " + sync + " ) sync to " + i );}
                jqo.val( jqt.val() );
                jqo.change();
            }
        }
    }
}
    
ga.sync.reset = function( pkg ) {
    var i;
    __~debug:sync{console.log( "ga.sync.reset( " + pkg + " )" );}

    if ( !( ga.sync.data &&
            ga.sync.data[ pkg ] ) ) {
        __~debug:sync{console.log( "ga.sync.reset( " + pkg + " ) nothing to reset" );}
        return;
    }

    for ( i in ga.sync.data[ pkg ] ) {
        __~debug:sync{console.log( "ga.sync.reset( " + pkg + " ) checking ga.sync.data[ " + pkg + " ][ " +  i  + " ]" );}
        if ( ga.sync.data[ pkg ][ i ]._lastval ) {
            __~debug:sync{console.log( "ga.sync.reset( " + pkg + " ) deleting ga.sync.data[ " + pkg + " ][ " +  i  + " ]._lastval" );}
            delete ga.sync.data[ pkg ][ i ]._lastval;
        }
        __~debug:sync{else { console.log( "ga.sync.reset( " + pkg + " ) checking ga.sync.data[ " + pkg + " ][ " +  i  + " ] no ._lastval" );} }
    }
}

