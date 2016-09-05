/*jslint white: true, plusplus: true*/
/* assumes: jquery > 1.11.0, jqtree >= 3.0.9, jquery-base64 */

ga.repeat               = {};
ga.repeat.data          = {};
ga.repeat.map           = {};

// ----------------------------------------------------------------------------------------------------------
// background
// ----------------------------------------------------------------------------------------------------------
// repeat and repeaters are identified by DOM id's of the element
// a repeat is an element that is dependent on a repeater
// a repeater is an element that has dependent repeats
// an element can be both a repeat (dependent on an element) and a repeater (has dependent repeats)
// ----------------------------------------------------------------------------------------------------------
// summary of data structures
// ----------------------------------------------------------------------------------------------------------
// ga.repeat.data[ mod ]                          : the module specific data object 
//
// ga.repeat.data[ mod ].repeat                   : repeat data object 
// ga.repeat.data[ mod ].repeat[ id ]             : repeat data object for repeat id 
// ga.repeat.data[ mod ].repeat[ id ].html        : repeat id's html
// ga.repeat.data[ mod ].repeat[ id ].htmlr       : repeat id's html modified to ease replacement
// ga.repeat.data[ mod ].repeat[ id ].htmls       : repeat id's html structure and label only for table header
// ga.repeat.data[ mod ].repeat[ id ].eval        : repeat id's eval
// ga.repeat.data[ mod ].repeat[ id ].evalr       : repeat id's eval modified to ease replacement
// ga.repeat.data[ mod ].repeat[ id ].refid       : repeat's repeater (as registered in repeatOn)
//
// ga.repeat.data[ mod ].repeater                 : repeater data object
// ga.repeat.data[ mod ].repeater[ id ]           : repeater data object for repeater id
// ga.repeat.data[ mod ].repeater[ id ].type      : repeater type (currently, checkbox, listbox or integer)
// ga.repeat.data[ mod ].repeater[ id ].child     : repeater's children (as registered in repeatOn)
// ga.repeat.data[ mod ].repeater[ id ].choice    : repeater's listbox choice
// ga.repeat.data[ mod ].repeater[ id ].value     : repeater's last value
//
// ga.repeat.map                                  : map of original id's to DOM id's of repeats
// ----------------------------------------------------------------------------------------------------------
// summary of operations
// ----------------------------------------------------------------------------------------------------------
// ga.repeat.repeat   : register a repeat
// ga.repeat.repeater : register a repeater
// ga.repeat.repeatOn : register a repeat repeater reference
// ga.repeat.children : return all "children" ( repeats on the repeater)
// ga.repeat.change   : change value of a repeater
// ----------------------------------------------------------------------------------------------------------


// register a repeat
// equivalent of ga.repeats.registerRepeat
// initializes the repeat structure & stores the html and eval for a field and returns a placeholder

ga.repeat.repeat = function( mod, id, html, this_eval ) {
    __~debug:repeat{console.log( "ga.repeat.repeat( " + mod + " , " + id + " , html , eval )" );}

    ga.repeat.data[ mod ] = ga.repeat.data[ mod ] || {};
    ga.repeat.data[ mod ].repeat = ga.repeat.data[ mod ].repeat || {};
    ga.repeat.data[ mod ].repeat[ id ] = {};
    ga.repeat.data[ mod ].repeat[ id ].html = html;
    ga.repeat.data[ mod ].repeat[ id ].eval = this_eval;

    ga.repeat.map[ id ] = id;

    // fix up html & eval for easy unconfused replacement

    ga.repeat.data[ mod ].repeat[ id ].htmlr = 
        html
        .replace( /<\/label>/, "%%label%%</label>" )
        .replace( RegExp( 'id="' + id + '"' ), 'id="%%id%%"' )
        .replace( RegExp( 'name="' + id ), 'name="%%id%%' )
        .replace( RegExp( 'for="' + id + '"' ), 'for="%%id%%"' )
        .replace( RegExp( 'id="' + id + '_msg"' ), 'id="%%id%%_msg"' )
        .replace( RegExp( 'id="' + id + '_tr"' ), 'id="%%id%%_tr"' )
        .replace( RegExp( 'id="' + id + '_button"' ), 'id="%%id%%_button"' )
        .replace( RegExp( '="' + id + '_altval"', 'g' ), '="%%id%%_altval"' )
        .replace( RegExp( 'name="_selaltval_' + id + '"' ), 'name="_selaltval_%%id%%"' )
        .replace( RegExp( 'id="' + id + '-repeater"' ), 'id="%%id%%-repeater"' )
    ;    

    ga.repeat.data[ mod ].repeat[ id ].htmls = // grab just relevant table structure and label text
        html
        .replace( /<td><label.*?>(.*?)<\/label>\s*<\/td>/, "%%td%%$1%%etd%%" )
        .replace( /(<td[^>]*>).*?<\/td>/g, "$1</td>" )
        .replace( /<input[^>]*>/g, "" )
        .replace( /<span[^>]*>.*?<\/span>/g, "" )
        .replace( /\s*id=".*?"\s*/g, "" )
        .replace( "%%td%%", "<td>" )
        .replace( "%%etd%%", "</td>" )
        .replace( "<td></td>", "" )
    ;
            
    __~debug:repeathtmls{console.log( "ga.repeat.repeat( " + mod + " , " + id + " , html , eval )" );}
    __~debug:repeathtmls{console.log( "--------------------" );}
    __~debug:repeathtmls{console.log( "ga.repeat.repeat() html=" + html );}
    __~debug:repeathtmls{console.log( "--------------------" );}
    __~debug:repeathtmls{console.log( "ga.repeat.repeat() htmls=" + ga.repeat.data[ mod ].repeat[ id ].htmls );}
    __~debug:repeathtmls{console.log( "====================" );}

    ga.repeat.data[ mod ].repeat[ id ].evalr = 
        this_eval 
        .replace( RegExp( '"#' + id + '"', "g" ), '"#%%id%%"' )
        .replace( RegExp( '"#' + id + ' option', "g" ), '"#%%id%% option' )
        .replace( RegExp( ':' + id + ':', "g" ), ':%%id%%:' )
        .replace( RegExp( '"#' + id + '_msg"', "g" ), '"#%%id%%_msg"' )
        .replace( RegExp( '"' + id + '"', "g" ), '"%%id%%"' )
        .replace( RegExp( '"#' + id + '_button"', "g" ), '"#%%id%%_button"' )
        .replace( RegExp( '"' + id + '_altval"', "g" ), '"%%id%%_altval"' )
        .replace( RegExp( '"#' + id + '_altval"', "g" ), '"#%%id%%_altval"' )
    ;

    __~debug:repeateval{console.log( "ga.repeat.repeat() eval=" + this_eval );}
    __~debug:repeateval{console.log( "--------------------" );}
    __~debug:repeateval{console.log( "ga.repeat.repeat() evalr=" + ga.repeat.data[ mod ].repeat[ id ].evalr );}
    __~debug:repeateval{console.log( "====================" );}
    
    return '<tr><td></td><td><span id="' + id + '-span"></span></td></tr>';
}

// add a repeat repeater reference
// equivalent of ga.repeats.addRepeat 
// the repeat should already exist

ga.repeat.repeatOn = function( mod, id, refid ) {
    __~debug:repeat{console.log( "ga.repeat.repeatOn( " + mod + " , " + id + " , " + refid + " )" );}
    var rxcolon = /^(.*):(.*)$/,
        rxcolonval = rxcolon.exec( refid ),
        refbase,
        refchoice
    ;

    refid = refid.replace( ':', '-' );

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

ga.repeat.repeater = function( mod, id, type, tableize ) {
    __~debug:repeat{console.log( "ga.repeat.repeater( " + mod + " , " + id + " , " + type + " , " + tableize + " )" );}
    ga.repeat.data[ mod ] = ga.repeat.data[ mod ] || {};
    ga.repeat.data[ mod ].repeater = ga.repeat.data[ mod ].repeater || {};
    ga.repeat.data[ mod ].repeater[ id ] = ga.repeat.data[ mod ].repeater[ id ] || {};
    ga.repeat.data[ mod ].repeater[ id ].type = type;
    if ( tableize &&
         tableize != "__fields:tableize__" &&
         !/^(off|false)$/i.test( tableize ) ) {
        ga.repeat.data[ mod ].repeater[ id ].tableize = 1;
        __~debug:repeattableize{console.log( "ga.repeat.repeater( " + mod + " , " + id + " , " + type + " , " + tableize + " ) tabelize on" );}
    }
    __~debug:repeattableize{else {console.log( "ga.repeat.repeater( " + mod + " , " + id + " , " + type + " , " + tableize + " ) tabelize off" );}}
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
    tid,
    i,
    j,
    k;

    __~debug:repeat{console.log( "ga.repeat.change( " + mod + " , " + id + " )" );}
    if ( !ga.repeat.data[ mod ] || 
         !ga.repeat.data[ mod ].repeater || 
         !ga.repeat.data[ mod ].repeater[ id ] ) {
        __~debug:repeat{console.warn( "ga.repeat.change( " + mod + " , " + id + " ) no repeater found" );}
        return false;
    }

    if ( !jqhid.length ) {
        __~debug:repeat{console.log( "ga.repeat.change( " + mod + " , " + id + " ) id does not currently exist in DOM" );}
	//console.log("ga.repeat.change( " + mod + " , " + id + " ) id does not currently exist in DOM" );
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
	//console.log("Value:  " + val );
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
                k = id + "-" + i;
                ga.repeat.map[ i ] = k;
                __~debug:repeat{console.log( " i " + i + " htmlr " + ga.repeat.data[ mod ].repeat[ i ].htmlr );}
                __~debug:repeat{console.log( " i " + i + " evalr " + ga.repeat.data[ mod ].repeat[ i ].evalr );}
                add_html += ga.repeat.data[ mod ].repeat[ i ].htmlr.replace( /%%id%%/g, k ).replace( "%%label%%", "" );
                add_eval += ga.repeat.data[ mod ].repeat[ i ].evalr.replace( /%%id%%/g, k );
                if ( ga.repeat.data[ mod ].repeater[ i ] ) {
                    __~debug:repeat{console.log( "child repeater " + k );}
                    if ( !ga.repeat.data[ mod ].repeater[ k ] ) {
                        ga.repeat.data[ mod ].repeater[ k ] = jQuery.extend( {}, ga.repeat.data[ mod ].repeater[ i ] );
                    }
                    child_repeaters.push( k );
                    if ( ga.repeat.data[ mod ].repeater[ k ].value ) {
                        delete ga.repeat.data[ mod ].repeater[ k ].value;
                    }
                }
            }
        }
        break;

    case "integer" :

        if ( ga.repeat.data[ mod ].repeater[ id ].tableize && val > 0 ) {
            for ( i in children ) {
                add_html += ga.repeat.data[ mod ].repeat[ i ].htmls;
            }
        }

        for ( j = 1; j <= val; ++j ) {
            for ( i in children ) {
                k = id + "-" + i + "-" + ( j - 1 );
                ga.repeat.map[ i ] = k;
                __~debug:repeat{console.log( " j " + j + " i " + i + " htmlr " + ga.repeat.data[ mod ].repeat[ i ].htmlr );}
                __~debug:repeat{console.log( " j " + j + " i " + i + " evalr " + ga.repeat.data[ mod ].repeat[ i ].evalr );}
                add_html += ga.repeat.data[ mod ].repeat[ i ].htmlr.replace( /%%id%%/g, k ).replace( "%%label%%", "[" + j + "]" ).replace( ga.repeat.data[ mod ].repeater[ id ].tableize ? /<td.*?><label.*?>.*?<\/label><\/td>/ : "", "" );
                add_eval += ga.repeat.data[ mod ].repeat[ i ].evalr.replace( /%%id%%/g, k );
                if ( ga.repeat.data[ mod ].repeater[ i ] ) {
                    __~debug:repeat{console.log( "child repeater " + k );}
                    if ( !ga.repeat.data[ mod ].repeater[ k ] ) {
                        ga.repeat.data[ mod ].repeater[ k ] = jQuery.extend( {}, ga.repeat.data[ mod ].repeater[ i ] );
                    }
                    child_repeaters.push( k );
                    if ( ga.repeat.data[ mod ].repeater[ k ].value ) {
                        delete ga.repeat.data[ mod ].repeater[ k ].value;
                    }
                }
            }
        }
        break;

    case "listbox" :
        
        tid = id.replace( /-[0-9]+$/, "" ).replace( /^(.*)-([A-ZA-z0-9_]*)$/, "$2" ) + "-" + val;

        j = id + "-" + val;

        __~debug:repeat{console.log( "ga.repeat.change listbox, j is " + j + " val is " + val + " tid " + tid );}
        children = ga.repeat.children( mod, tid );
        __~debug:repeat{for ( i in children ) { console.log( "ga.repeat.change( " + mod + " , " + id + " ) select child " + i );} }

        for ( i in children ) {
            k = j + "-" + i;
            ga.repeat.map[ i ] = k;
            __~debug:repeat{console.log( " i " + i + " htmlr " + ga.repeat.data[ mod ].repeat[ i ].htmlr );}
            __~debug:repeat{console.log( " i " + i + " evalr " + ga.repeat.data[ mod ].repeat[ i ].evalr );}
            add_html += ga.repeat.data[ mod ].repeat[ i ].htmlr.replace( /%%id%%/g, k ).replace( "%%label%%", "" );
            add_eval += ga.repeat.data[ mod ].repeat[ i ].evalr.replace( /%%id%%/g, k );
            if ( ga.repeat.data[ mod ].repeater[ i ] ) {
                __~debug:repeat{console.log( "child repeater " + k );}
                if ( !ga.repeat.data[ mod ].repeater[ k ] ) {
                    ga.repeat.data[ mod ].repeater[ k ] = jQuery.extend( {}, ga.repeat.data[ mod ].repeater[ i ] );
                }
                child_repeaters.push( k );
                if ( ga.repeat.data[ mod ].repeater[ k ].value ) {
                    delete ga.repeat.data[ mod ].repeater[ k ].value;
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
	//console.log( "ga.repeat.change( " + mod + " , " + id + " ) child_repeater " + child_repeaters[ i ] );
        ga.repeat.change( mod, child_repeaters[ i ], init );
    }

    if ( $( "#global_data" ).data( "_pull_json#" + id ) ) {
        __~debug:pull{console.log( "ga.repeat.change() found pull json for id " + id );}
        ga.pull.doPull( "#" + id );
    }
    __~debug:pull{else { console.log( "ga.repeat.change() did not find pull json for id " + id );} }

    resetHoverHelp();
}

ga.repeat.map.convert = function( ids_array ) {
    var i,
    result = [];

    __~debug:repeatmap{console.log( "ga.repeat.map.convert from " + ids_array.join( "," ) );}

    for ( i = 0; i < ids_array.length; ++i ) {
        result[ i ] = ga.repeat.map[ ids_array[ i ] ] || ids_array[ i ];
    }

    __~debug:repeatmap{console.log( "ga.repeat.map.convert to   " + result.join( "," ) );}
    return result;
}
