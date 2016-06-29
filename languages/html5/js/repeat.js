/*jslint white: true, plusplus: true*/
/* assumes: jquery > 1.11.0, jqtree >= 3.0.9, jquery-base64 */

ga.repeat               = {};
ga.repeat.data          = {};

// register a repeat
// equivalent of ga.repeats.registerRepeat
// initializes the repeat structure & stores the html and eval for a field and returns a placeholder

ga.repeat.repeat = function( mod, id, html, this_eval  ) {
    __~debug:repeat{console.log( "ga.repeat.repeat( " + mod + " , " + id + " , html , eval )" );}

    ga.repeat.data[ mod ] = ga.repeat.data[ mod ] || {};
    ga.repeat.data[ mod ].repeat = ga.repeat.data[ mod ].repeat || {};
    ga.repeat.data[ mod ].repeat[ id ] = {};
    ga.repeat.data[ mod ].repeat[ id ].html = html;
    ga.repeat.data[ mod ].repeat[ id ].eval = this_eval;

    // fix up html & eval for easy unconfused replacement

    ga.repeat.data[ mod ].repeat[ id ].htmlr = 
        html
        .replace( /<\/label>/, "%%label%%</label>" )
        .replace( RegExp( 'id="' + id + '"' ), 'id="%%id%%"' )
        .replace( RegExp( 'name="' + id ), 'name="%%id%%' )
        .replace( RegExp( 'for="' + id + '"' ), 'for="%%id%%"' )
        .replace( RegExp( 'id="' + id + '_msg"' ), 'id="%%id%%_msg"' )
        .replace( RegExp( 'id="' + id + '_button"' ), 'id="%%id%%_button"' )
        .replace( RegExp( '="' + id + '_altval"', 'g' ), '="%%id%%_altval"' )
        .replace( RegExp( 'name="_selaltval_' + id + '"' ), 'name="_selaltval_%%id%%"' )
    ;    

    ga.repeat.data[ mod ].repeat[ id ].evalr = 
        this_eval 
        .replace( RegExp( '"#' + id + '"', "g" ), '"#%%id%%"' )
        .replace( RegExp( ':' + id + ':', "g" ), ':%%id%%:' )
        .replace( RegExp( '"#' + id + '_msg"', "g" ), '"#%%id%%_msg"' )
        .replace( RegExp( '"' + id + '"', "g" ), '"%%id%%"' )
        .replace( RegExp( '"#' + id + '_button"', "g" ), '"#%%id%%_button"' )
        .replace( RegExp( '"' + id + '_altval"', "g" ), '"%%id%%_altval"' )
        .replace( RegExp( '"#' + id + '_altval"', "g" ), '"#%%id%%_altval"' )
    ;

    
    return '<tr><td></td><td><span id="' + id + '-span"></span></td></tr>';
}

// add a repeat repeater reference
// equivalent of ga.repeats.addRepeat 
// the repeat should already exist

ga.repeat.repeatOn = function( mod, id, refid  ) {
    __~debug:repeat{console.log( "ga.repeat.repeatOn( " + mod + " , " + id + " , " + refid + " )" );}
    var rxcolon = /^(.*):(.*)$/,
        rxcolonval = rxcolon.exec( refid ),
        refbase,
        refchoice
    ;

    ga.repeat.data[ mod ].repeater = ga.repeat.data[ mod ].repeater || {};
    ga.repeat.data[ mod ].repeater[ refid ] = ga.repeat.data[ mod ].repeater[ refid ] || {};
    ga.repeat.data[ mod ].repeater[ refid ].child = ga.repeat.data[ mod ].repeater[ refid ].child || [];
    ga.repeat.data[ mod ].repeater[ refid ].child.push( id );
    ga.repeat.data[ mod ].repeat[ id ].refid = refid;

    if ( rxcolonval ) {
        refbase   = rxcolonval[ 1 ];
        refchoice = rxcolonval[ 2 ];
        __~debug:repeat{console.log( "ga.repeat.repeatOn( " + mod + " , " + id + " , " + refid + " ) found select choices base " + refbase + " choice " + refchoice );}

        ga.repeat.data[ mod ].repeater[ refbase ] = ga.repeat.data[ mod ].repeater[ refbase ] || {};
        ga.repeat.data[ mod ].repeater[ refbase ].child = ga.repeat.data[ mod ].repeater[ refbase ].child || [];
        ga.repeat.data[ mod ].repeater[ refbase ].choice = ga.repeat.data[ mod ].repeater[ refbase ].choice || [];
        ga.repeat.data[ mod ].repeater[ refbase ].child.push( id );
        ga.repeat.data[ mod ].repeater[ refbase ].choice.push( refchoice );
    }
        
}

// add a repeater
// no exact equivalent in ga.repeats, this was encapsulated in various updateRepeats

ga.repeat.repeater = function( mod, id, type ) {
    __~debug:repeat{console.log( "ga.repeat.repeater( " + mod + " , " + id + " , " + type + " )" );}
    ga.repeat.data[ mod ] = ga.repeat.data[ mod ] || {};
    ga.repeat.data[ mod ].repeater = ga.repeat.data[ mod ].repeater || {};
    ga.repeat.data[ mod ].repeater[ id ] = ga.repeat.data[ mod ].repeater[ id ] || {};
    ga.repeat.data[ mod ].repeater[ id ].type = type;
}

// return all children

ga.repeat.children = function( mod, id, result ) {
    var i;

    __~debug:repeat{console.log( "ga.repeat.children( " + mod + " , " + id + " , result )" );}

    result = result || {};

    if ( !ga.repeat.data[ mod ] || 
         !ga.repeat.data[ mod ].repeater || 
         !ga.repeat.data[ mod ].repeater[ id ] ) {
        __~debug:repeat{console.warn( "ga.repeat.children( " + mod + " , " + id + " ) no repeater found" );}
        return result;
    }

    if ( !ga.repeat.data[ mod ].repeater[ id ].child ) {
        __~debug:repeat{console.warn( "ga.repeat.children( " + mod + " , " + id + " ) no children found" );}
        return result;
    }

    for ( i = 0; i < ga.repeat.data[ mod ].repeater[ id ].child.length; ++i ) {
        // for ( i in ga.repeat.data[ mod ].repeater[ id ].child ) {
        __~debug:repeat{console.log( "ga.repeat.children() repeat child " + i + " for mod " + mod + " for id " + id );}
        result[ ga.repeat.data[ mod ].repeater[ id ].child[ i ] ] = true;
        if ( ga.repeat.data[ mod ].repeater[ i ] ) {
            result = ga.repeat.children( mod, i, result );
        }
    }
    return result;
}

// change
// quasi equivalent in ga.repeats in updateRepeats{,Cb,Lb}

ga.repeat.change = function( mod, id, init ) {
    var val,
    child_repeaters = [],
    hid = "#" + id,
    jqhid = $( hid ),
    children,
    add_html = "",
    add_eval = "",
    i,
    j;

    __~debug:repeat{console.log( "ga.repeat.change( " + mod + " , " + id + " )" );}
    if ( !ga.repeat.data[ mod ] || 
         !ga.repeat.data[ mod ].repeater || 
         !ga.repeat.data[ mod ].repeater[ id ] ) {
        __~debug:repeat{console.warn( "ga.repeat.change( " + mod + " , " + id + " ) no repeater found" );}
        return false;
    }

    if ( !jqhid.length ) {
        __~debug:repeat{console.log( "ga.repeat.change( " + mod + " , " + id + " ) id does not currently exist in DOM" );}
        return false;
    }

    // get value of repeater
    switch ( ga.repeat.data[ mod ].repeater[ id ].type ) {
    case "checkbox" : 
        val = jqhid.prop( "checked" ) ? 1 : 0;
        break;
        
    case "integer" :
    case "listbox" :
        val = jqhid.val();
        break;

    default :
        console.warn( "ga.repeat.change( " + mod + " , " + id + " ) type " + ga.repeat.data[ mod ].repeater[ id ].type + " not supported" );
        return false;
        break;
    }

    // has the value changed ?

    if ( !init && ga.repeat.data[ mod ].repeater[ id ].value === val ) {
        __~debug:repeat{console.log( "ga.repeat.change( " + mod + " , " + id + " ) val " + val + " is the same as before" );}
        return false;
    }
    
    __~debug:repeat{console.log( "ga.repeat.change( " + mod + " , " + id + " ) previous value " + ga.repeat.data[ mod ].repeater[ id ].value + " val " + val );}

    // get children
    children = ga.repeat.children( mod, id );

    __~debug:repeat{ for ( i in children ) { console.log( "ga.repeat.change( " + mod + " , " + id + " ) child " + i );} }

    // build up add_html & add_eval

    switch ( ga.repeat.data[ mod ].repeater[ id ].type ) {
    case "checkbox" : 
        if ( val ) {
            for ( i in children ) {
                add_html += ga.repeat.data[ mod ].repeat[ i ].html;
                add_eval += ga.repeat.data[ mod ].repeat[ i ].eval;
                if ( ga.repeat.data[ mod ].repeater[ i ] ) {
                    __~debug:repeat{console.log( "child repeater " + i );}
                    child_repeaters.push( i );
                    if ( ga.repeat.data[ mod ].repeater[ i ].value ) {
                        delete ga.repeat.data[ mod ].repeater[ i ].value;
                    }
                }
            }
        }
        break;

    case "integer" :

        for ( j = 1; j <= val; ++j ) {
            for ( i in children ) {
                __~debug:repeat{console.log( " j " + j + " i " + i + " html " + ga.repeat.data[ mod ].repeat[ i ].htmlr );}
                __~debug:repeat{console.log( " j " + j + " i " + i + " eval " + ga.repeat.data[ mod ].repeat[ i ].evalr );}
                add_html += ga.repeat.data[ mod ].repeat[ i ].htmlr.replace( /%%id%%/g, i + "-" + j ).replace( "%%label%%", "[" + j + "]" );
                add_eval += ga.repeat.data[ mod ].repeat[ i ].evalr.replace( /%%id%%/g, i + "-" + j );
                if ( ga.repeat.data[ mod ].repeater[ i ] ) {
                    __~debug:repeat{console.log( "child repeater " + i );}
                    child_repeaters.push( i );
                    if ( ga.repeat.data[ mod ].repeater[ i ].value ) {
                        delete ga.repeat.data[ mod ].repeater[ i ].value;
                    }
                }
            }
        }
        break;

    case "listbox" :
        
        j = id + ":" + val;

        children = ga.repeat.children( mod, j );
        __~debug:repeat{ for ( i in children ) { console.log( "ga.repeat.change( " + mod + " , " + id + " ) select child " + i );} }

        for ( i in children ) {
            add_html += ga.repeat.data[ mod ].repeat[ i ].html;
            add_eval += ga.repeat.data[ mod ].repeat[ i ].eval;
            if ( ga.repeat.data[ mod ].repeater[ i ] ) {
                __~debug:repeat{console.log( "child repeater " + i );}
                child_repeaters.push( i );
                if ( ga.repeat.data[ mod ].repeater[ i ].value ) {
                    delete ga.repeat.data[ mod ].repeater[ i ].value;
                }
            }
        }
        break;

    default :
        console.warn( "ga.repeat.change( " + mod + " , " + id + " ) type " + ga.repeat.data[ mod ].repeater[ id ].type + " not supported" );
        return false;
        break;
    }

    if ( !/^<tr>/.test( add_html ) &&
         /<\/tr>$/.test( add_html ) ) {
        add_html = "<tr>" + add_html;
    }

    __~debug:repeat{console.log( "ga.repeat.change( " + mod + " , " + id + " ) add_html " + add_html );}
    __~debug:repeat{console.log( "ga.repeat.change( " + mod + " , " + id + " ) add_eval " + add_eval );}
    __~debug:repeat{console.log( "ga.repeat.change( " + mod + " , " + id + " ) target tag " + hid + "-repeater" );}

    $( hid + "-repeater" ).html( add_html );
    eval( add_eval );

    ga.repeat.data[ mod ].repeater[ id ].value = val;

    for ( i = 0 ; i < child_repeaters.length; ++i ) {
        __~debug:repeat{console.log( "ga.repeat.change( " + mod + " , " + id + " ) child_repeater " + child_repeaters[ i ] );}
        ga.repeat.change( mod, child_repeaters[ i ], init );
    }

    if ( $( "#global_data" ).data( "_pull_json#" + id ) ) {
        __~debug:pull{console.log( "ga.repeat.change() found pull json for id " + id );}
        ga.pull.doPull( "#" + id );
    }
    __~debug:pull{else { console.log( "ga.repeat.change() did not find pull json for id " + id );} }

    resetHoverHelp();
}
