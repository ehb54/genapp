/*jslint white: true, plusplus: true*/
/* assumes: jquery > 1.11.0, jqtree >= 3.0.9, jquery-base64 */

ga.repeat               = {};
ga.repeat.data          = {};
ga.repeat.map           = {};
ga.repeat.pairupdateids = {};

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
// ga.repeat.data[ mod ].repeat[ id ].lhtml       : repeat id's lhtml
// ga.repeat.data[ mod ].repeat[ id ].lhtmlr      : repeat id's lhtml modified to ease replacement
// ga.repeat.data[ mod ].repeat[ id ].lhtmlrg     : repeat id's lhtmlr modified to remove label text and grid-column:
// ga.repeat.data[ mod ].repeat[ id ].lhtmls      : repeat id's lhtml structure and label only for table header
// ga.repeat.data[ mod ].repeat[ id ].dhtml       : repeat id's dhtml
// ga.repeat.data[ mod ].repeat[ id ].dhtmlr      : repeat id's dhtml modified to ease replacement
// ga.repeat.data[ mod ].repeat[ id ].dhtmlrg     : repeat id's dhtml as above but also replacement for grid-column:
// ga.repeat.data[ mod ].repeat[ id ].rhtml       : repeat id's rhtml
// ga.repeat.data[ mod ].repeat[ id ].rhtmlr      : repeat id's rhtml modified to ease replacement
// ga.repeat.data[ mod ].repeat[ id ].eval        : repeat id's eval
// ga.repeat.data[ mod ].repeat[ id ].evalr       : repeat id's eval modified to ease replacement
// ga.repeat.data[ mod ].repeat[ id ].refid       : repeat's repeater (as registered in repeatOn)
//
// ga.repeat.data[ mod ].repeater                 : repeater data object
// ga.repeat.data[ mod ].repeater[ id ]           : repeater data object for repeater id
// ga.repeat.data[ mod ].repeater[ id ].type      : repeater type (currently, checkbox, listbox, integer or integerpair)
// ga.repeat.data[ mod ].repeater[ id ].child     : repeater's children (as registered in repeatOn)
// ga.repeat.data[ mod ].repeater[ id ].choice    : repeater's listbox choice
// ga.repeat.data[ mod ].repeater[ id ].value     : repeater's last value
// ga.repeat.data[ mod ].repeater[ id ].layoutr   : repeater's layout.repeats
//
// ga.repeat.pairupdateids                        : for integerpair repeaters, keeps list of target ids that need updating when header value changes
//
// ga.repeat.map                                  : map of original id's to DOM id's of repeats
// ----------------------------------------------------------------------------------------------------------
// summary of operations
// ----------------------------------------------------------------------------------------------------------
// ga.repeat.repeat     : register a repeat
// ga.repeat.repeater   : register a repeater
// ga.repeat.repeatOn   : register a repeat repeater reference
// ga.repeat.children   : return all "children" ( repeats on the repeater)
// ga.repeat.change     : change value of a repeater
// ga.repeat.changeMany : change values of multiple repeaters
// ga.repeat.arrayDefault : check if a default array exists and if so return the array
// ----------------------------------------------------------------------------------------------------------

// get default array if exists
ga.repeat.arrayDefault = function( id, n ) {
    __~debug:repeat{console.log( `ga.repeat.arrayDefault( ${id}, ${n} )` );}

    var obj = ga.layout.module.json.fields.find(o=>o.id===id);
    if ( obj && "default" in obj && Array.isArray( obj.default ) ) {
        if ( typeof n === 'undefined' ) { 
            return obj.default;
        }
        if ( n >= obj.default.length ) {
            n = obj.default.length - 1;
        }
        return obj.default[ n ];
    }
    return null;
}

// register a repeat
// equivalent of ga.repeats.registerRepeat
// initializes the repeat structure & stores the html and eval for a field and returns a placeholder

ga.repeat.repeat = function( mod, id ) {
    __~debug:repeat{console.log( "ga.repeat.repeat( " + mod + " , " + id + " )" );}
    var has_errors = false;
    var ret_val = [`<span id="${id}-label-span"></span>`,`<span id="${id}-span"></span>`];

    ga.repeat.data[ mod ] = ga.repeat.data[ mod ] || {};
    ga.repeat.data[ mod ].repeat = ga.repeat.data[ mod ].repeat || {};
    ga.repeat.data[ mod ].repeat[ id ] = {};
    if ( !ga.layout.fields[ id ] ) {
        console.error( `repeat.js: mod ${mod} id ${id} missing` );
        return ret_val;
    }
    if ( !("lhtml" in ga.layout.fields[ id ] ) ) {
        console.error( `repeat.js: mod ${mod} id ${id} lhtml missing` );
        has_errors = true;
    }
   if ( !( "dhtml" in ga.layout.fields[ id ] ) ) {
        console.error( `repeat.js: mod ${mod} id ${id} dhtml missing` );
        has_errors = true;
    }
    if ( !( "eval" in ga.layout.fields[ id ] ) ) {
        console.error( `repeat.js: mod ${mod} id ${id} eval missing` );
        has_errors = true;
    }
    if ( has_errors ) {
        return ret_val;
    }

    ga.repeat.data[ mod ].repeat[ id ].lhtml   = ga.layout.fields[ id ].lhtml;
    ga.repeat.data[ mod ].repeat[ id ].dhtml   = ga.layout.fields[ id ].dhtml;
    ga.repeat.data[ mod ].repeat[ id ].eval    = ga.layout.fields[ id ].eval;

    if ( ga.layout.fields[ id ].lgc ) {
        ga.repeat.data[ mod ].repeat[ id ].lhtml  = `<div class="ga-repeat" style="grid-column:${ga.layout.fields[id].lgc}">${ga.repeat.data[ mod ].repeat[ id ].lhtml}</div>`;
    }
    if ( ga.layout.fields[ id ].dgc ) {
        ga.repeat.data[ mod ].repeat[ id ].dhtml  = `<div class="ga-repeat" style="grid-column:${ga.layout.fields[id].dgc}">${ga.repeat.data[ mod ].repeat[ id ].dhtml}</div>`;
    }

    if ( !ga.layout.fields[ id ].lgc && !ga.layout.fields[ id ].dgc ) {
        console.warn( `ga.repeat.repeat( ${mod} , ${id} ) : no grid defined` );
    }

    if ( ga.layout.modules[ mod ].fields[ id ].repeats ) {
        ga.repeat.data[ mod ].repeater = ga.repeat.data[ mod ].repeater || {};
        ga.repeat.data[ mod ].repeater[ id ] = ga.repeat.data[ mod ].repeater[ id ] || {};
        ga.repeat.data[ mod ].repeater[ id ].layoutr = ga.layout.modules[ mod ].fields[ id ].repeats;
        __~debug:layoutloc{console.log( `ga.repeat.repeat() usage of style : setting layout for repeat on "${mod}" field "${id}" to ` + JSON.stringify( ga.repeat.data[ mod ].repeater[ id ].layoutr ) );}
    }
    
    // setup div for repeats

    if ( ga.layout.fields[ id ].rhtml ) {
        ga.repeat.data[ mod ].repeat[ id ].rhtml = ga.layout.fields[ id ].rhtml;
        ga.repeat.data[ mod ].repeat[ id ].rhtmlr = 
            ga.repeat.data[ mod ].repeat[ id ].rhtml
            .replace( RegExp( `id=ga-repeater-${id}` ), `id=ga-repeater-%%id%%` )
        ;
    }
        
    ga.repeat.map[ id ] = id;

    // fix up html & eval for easy unconfused replacement

    ga.repeat.data[ mod ].repeat[ id ].lhtmlr = 
        ga.repeat.data[ mod ].repeat[ id ].lhtml
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

    ga.repeat.data[ mod ].repeat[ id ].lhtmlrg = 
        ga.repeat.data[ mod ].repeat[ id ].lhtmlr
        .replace( />[^>]*%%label%%</, '>%%label%%<' )
        .replace( / for=/, ' id=' )
        .replace( /grid-column:\d+/, 'grid-column:%%gridcol%%' )
    ;

    ga.repeat.data[ mod ].repeat[ id ].lhtmls = // grab just relevant table structure and label text
        ga.repeat.data[ mod ].repeat[ id ].lhtml
        .replace( /<td><label.*?>(.*?)<\/label>\s*<\/td>/, "%%td%%$1%%etd%%" )
        .replace( /(<td[^>]*>).*?<\/td>/g, "$1</td>" )
        .replace( /<input[^>]*>/g, "" )
        .replace( /<span[^>]*>.*?<\/span>/g, "" )
        .replace( /\s*id=".*?"\s*/g, "" )
        .replace( "%%td%%", "<td>" )
        .replace( "%%etd%%", "</td>" )
        .replace( "<td></td>", "" )
    ;

    // perhaps more need 'g' here:
    ga.repeat.data[ mod ].repeat[ id ].dhtmlr = 
        ga.repeat.data[ mod ].repeat[ id ].dhtml
        .replace( /<\/label>/, "%%label%%</label>" )
        .replace( RegExp( 'id="' + id + '"' ), 'id="%%id%%"' )
        .replace( RegExp( 'name="' + id, 'g' ), 'name="%%id%%' )
        .replace( RegExp( 'for="' + id + '"' ), 'for="%%id%%"' )
        .replace( RegExp( 'id="' + id + '_msg"' ), 'id="%%id%%_msg"' )
        .replace( RegExp( 'id="' + id + '_tr"' ), 'id="%%id%%_tr"' )
        .replace( RegExp( 'id="' + id + '_button"' ), 'id="%%id%%_button"' )
        .replace( RegExp( '="' + id + '_altval"', 'g' ), '="%%id%%_altval"' )
        .replace( RegExp( 'name="_selaltval_' + id + '"' ), 'name="_selaltval_%%id%%"' )
        .replace( RegExp( 'id="' + id + '-repeater"' ), 'id="%%id%%-repeater"' )
    ;    

    ga.repeat.data[ mod ].repeat[ id ].dhtmlrg =
        ga.repeat.data[ mod ].repeat[ id ].dhtmlr
        .replace( /grid-column:\d+/, 'grid-column:%%gridcol%%' )
    ;

    if ( ga.repeat.arrayDefault( id )
         && / value=".*"/.test( ga.repeat.data[ mod ].repeat[ id ].dhtmlr )
       ) {
        ga.repeat.data[ mod ].repeat[ id ].dhtmlr = ga.repeat.data[ mod ].repeat[ id ].dhtmlr.replace( / value=".*?"/, ' value="%%vectorDefault%%"' );
    }

    __~debug:repeathtmls{console.log( "ga.repeat.repeat( " + mod + " , " + id + " )" );}
    __~debug:repeathtmls{console.log( "--------------------" );}
    __~debug:repeathtmls{console.log( "ga.repeat.repeat() lhtml=" + ga.repeat.data[ mod ].repeat[ id ].lhtml );}
    __~debug:repeathtmls{console.log( "--------------------" );}
    __~debug:repeathtmls{console.log( "ga.repeat.repeat() lhtmls=" + ga.repeat.data[ mod ].repeat[ id ].lhtmls );}
    __~debug:repeathtmls{console.log( "--------------------" );}
    __~debug:repeathtmls{console.log( "ga.repeat.repeat() dhtml=" + ga.repeat.data[ mod ].repeat[ id ].dhtml );}
    __~debug:repeathtmls{console.log( "====================" );}

    ga.repeat.data[ mod ].repeat[ id ].evalr = 
        ga.repeat.data[ mod ].repeat[ id ].eval
        .replace( RegExp( '"#' + id + '"', "g" ), '"#%%id%%"' )
        .replace( RegExp( '"#' + id + ' option', "g" ), '"#%%id%% option' )
        .replace( RegExp( ':' + id + ':', "g" ), ':%%id%%:' )
        .replace( RegExp( '"#' + id + '_msg"', "g" ), '"#%%id%%_msg"' )
        .replace( RegExp( '"' + id + '"', "g" ), '"%%id%%"' )
        .replace( RegExp( '"#' + id + '_button"', "g" ), '"#%%id%%_button"' )
        .replace( RegExp( '"' + id + '_altval"', "g" ), '"%%id%%_altval"' )
        .replace( RegExp( '"#' + id + '_altval"', "g" ), '"#%%id%%_altval"' )
    ;

    __~debug:repeateval{console.log( "ga.repeat.repeat() eval=" + ga.repeat.data[ mod ].repeat[ id ].eval );}
    __~debug:repeateval{console.log( "--------------------" );}
    __~debug:repeateval{console.log( "ga.repeat.repeat() evalr=" + ga.repeat.data[ mod ].repeat[ id ].evalr );}
    __~debug:repeateval{console.log( "====================" );}
    
    return ret_val;
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

    var uid = id.replace( /\-\d*$/, '' ).replace( /^.*-/, '' );
    
    if ( !ga.layout.modules[ mod ].fields[ uid ] ) {
        console.warn( `in ga.repeat.repeater(), missing ga.layout.modules[ ${mod} ].fields[ ${uid} ]` );
    } else {
        ga.repeat.data[ mod ].repeater[ id ].layoutr = ga.layout.modules[ mod ].fields[ uid ].repeats || null;
        __~debug:layoutloc{console.log( `ga.repeat.repeater() usage of style : setting layout for repeater "${mod}" field "${uid}" to ` + JSON.stringify( ga.repeat.data[ mod ].repeater[ uid ].layoutr ) );}
    }
    if ( type == 'integerpair' ) {
        document.getElementById( `ga-repeater-${id}`).style.gridTemplateColumns="1fr auto";
    }
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
        k,
        kh;

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
    case "integerpair" :
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
                __~debug:repeat{console.log( " i " + i + " lhtmlr " + ga.repeat.data[ mod ].repeat[ i ].lhtmlr );}
                __~debug:repeat{console.log( " i " + i + " dhtmlr " + ga.repeat.data[ mod ].repeat[ i ].dhtmlr );}
                __~debug:repeat{console.log( " i " + i + " evalr " + ga.repeat.data[ mod ].repeat[ i ].evalr );}
                add_html += ga.repeat.data[ mod ].repeat[ i ].lhtmlr.replace( /%%id%%/g, k ).replace( "%%label%%", "" );
                add_html += ga.repeat.data[ mod ].repeat[ i ].dhtmlr.replace( /%%id%%/g, k ).replace( "%%label%%", "" );
                if ( ga.repeat.data[ mod ].repeat[ i ].rhtmlr ) {
                    add_html += ga.repeat.data[ mod ].repeat[ i ].rhtmlr.replace( /%%id%%/g, k );
                }
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
                add_html += ga.repeat.data[ mod ].repeat[ i ].lhtmls.replace(/grid-column:(\d+)/, (m , n) => { return "grid-column:" + (parseInt(n)+1).toString()});
            }
        }

        for ( j = 1; j <= val; ++j ) {
            for ( i in children ) {
                k = id + "-" + i + "-" + ( j - 1 );
                ga.repeat.map[ i ] = k;
                __~debug:repeat{console.log( " j " + j + " i " + i + " lhtmlr " + ga.repeat.data[ mod ].repeat[ i ].lhtmlr );}
                __~debug:repeat{console.log( " j " + j + " i " + i + " dhtmlr " + ga.repeat.data[ mod ].repeat[ i ].dhtmlr );}
                __~debug:repeat{console.log( " j " + j + " i " + i + " evalr " + ga.repeat.data[ mod ].repeat[ i ].evalr );}
                if ( !ga.repeat.data[ mod ].repeater[ id ].tableize ) {
                    add_html += ga.repeat.data[ mod ].repeat[ i ].lhtmlr.replace( /%%id%%/g, k ).replace( "%%label%%", "[" + j + "]" ).replace( ga.repeat.data[ mod ].repeater[ id ].tableize ? /<td.*?><label.*?>.*?<\/label><\/td>/ : "", "" );
                }
                add_html += ga.repeat.data[ mod ].repeat[ i ].dhtmlr.replace( /%%id%%/g, k ).replace( "%%label%%", "[" + j + "]" ).replace( ga.repeat.data[ mod ].repeater[ id ].tableize ? /<td.*?><label.*?>.*?<\/label><\/td>/ : "", "" ).replace( "%%vectorDefault%%", ga.repeat.arrayDefault( i , j - 1 ) );
                if ( ga.repeat.data[ mod ].repeat[ i ].rhtmlr ) {
                    add_html += ga.repeat.data[ mod ].repeat[ i ].rhtmlr.replace( /%%id%%/g, k );
                }
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
            __~debug:repeat{console.log( " i " + i + " lhtmlr " + ga.repeat.data[ mod ].repeat[ i ].lhtmlr );}
            __~debug:repeat{console.log( " i " + i + " dhtmlr " + ga.repeat.data[ mod ].repeat[ i ].dhtmlr );}
            __~debug:repeat{console.log( " i " + i + " evalr " + ga.repeat.data[ mod ].repeat[ i ].evalr );}
            add_html += ga.repeat.data[ mod ].repeat[ i ].lhtmlr.replace( /%%id%%/g, k ).replace( "%%label%%", "" );
            add_html += ga.repeat.data[ mod ].repeat[ i ].dhtmlr.replace( /%%id%%/g, k ).replace( "%%label%%", "" );
            if ( ga.repeat.data[ mod ].repeat[ i ].rhtmlr ) {
                add_html += ga.repeat.data[ mod ].repeat[ i ].rhtmlr.replace( /%%id%%/g, k );
            }
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

    case "integerpair" :

        var vals = val.split(",").map( x => parseInt(x) );

        if ( vals.length != 2 ) {
            console.warn( `integerpair vals expected length 2, ${vals.length} found` );
            return false;
        }

        for ( j1 = 1; j1 <= vals[0]; ++j1 ) {
            for ( j2 = 1; j2 <= vals[1]; ++j2 ) {
                for ( i in children ) {
                    k = id + "-" + i + "-" + ( j1 - 1 ) + "-" + ( j2 - 1 );
                    
                    ga.repeat.map[ i ] = k;
                    __~debug:repeat{console.log( " j1 " + j1 + " j2 " + j2 + " i " + i + " lhtmlr " + ga.repeat.data[ mod ].repeat[ i ].lhtmlr );}
                    __~debug:repeat{console.log( " j1 " + j1 + " j2 " + j2 + " i " + i + " dhtmlr " + ga.repeat.data[ mod ].repeat[ i ].dhtmlr );}
                    __~debug:repeat{console.log( " j1 " + j1 + " j2 " + j2 + " i " + i + " evalr " + ga.repeat.data[ mod ].repeat[ i ].evalr );}
                    
                    // label

                    if ( j2 == 1 ) {
                        if ( j1 == 1 ) {
                            for ( j2h = 1; j2h <= vals[1]; ++j2h ) {
                                kh = id + "-" + i + "-colh-" + ( j1 - 1 ) + "-" + ( j2h - 1 );
                                add_html += ga.repeat.data[ mod ].repeat[ i ].lhtmlrg
                                    .replace( /%%id%%/g, kh )
                                    .replace( "%%label%%", ga.repeat.headers( mod, id, 'column', j2h-1 )[0] )
                                    .replace( /%%gridcol%%/, j2h + 1 )
                                ;
                                ga.repeat.headers( mod, id, 'column', j2h-1 )[1].map( v => ga.repeat.setpairupdateids( v, mod, id, kh, 'column', j2h - 1 ) );
                            }
                        }
                        kh = id + "-" + i + "-rowh-" + ( j1 - 1 ) + "-" + ( j2h - 1 );

                        add_html += ga.repeat.data[ mod ].repeat[ i ].lhtmlrg
                            .replace( /%%id%%/g, kh )
                            .replace( "%%label%%", ga.repeat.headers( mod, id, 'row', j1-1 )[0] )
                            .replace( "%%gridcol%%", 1 )
                        ;
                        ga.repeat.headers( mod, id, 'row', j1-1 )[1].map( v => ga.repeat.setpairupdateids( v, mod, id, kh, 'row', j1 - 1 ) );
                    }
                    
                    add_html += ga.repeat.data[ mod ].repeat[ i ].dhtmlrg
                        .replace( /%%id%%/g, k )
                        .replace( "%%label%%", "[" + j1 + "-" + j2 + "]" )
                        .replace( /%%gridcol%%/, j2 + 1 )

                    // .replace( ga.repeat.data[ mod ].repeater[ id ].tableize ? /<td.*?><label.*?>.*?<\/label><\/td>/ : "", "" )
                        .replace( "%%vectorDefault%%", ga.repeat.arrayDefault( i , j - 1 ) )
                    ;
                    
                    if ( ga.repeat.data[ mod ].repeat[ i ].rhtmlr ) {
                        add_html += ga.repeat.data[ mod ].repeat[ i ].rhtmlr.replace( /%%id%%/g, k );
                    }
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
        }
        break;


    default :
        console.warn( "ga.repeat.change( " + mod + " , " + id + " ) type " + ga.repeat.data[ mod ].repeater[ id ].type + " not supported" );
        return false;
        break;
    }

    __~debug:repeat{console.log( "ga.repeat.change( " + mod + " , " + id + " ) add_html " + add_html );}
    __~debug:repeat{console.log( "ga.repeat.change( " + mod + " , " + id + " ) add_eval " + add_eval );}
    __~debug:repeat{console.log( `ga.repeat.change( ${mod} , ${id} ) target tag ga-repeater-${id}` );}

    // $( hid + "-repeater" ).html( add_html );
    $( `#ga-repeater-${id}` ).html( add_html );
    var uid = id.replace( /\-\d*$/, '' ).replace( /^.*-/, '' );
    __~debug:layoutloc{console.log( `ga.repeat.change() usage of style : set for "ga-repeater-${id}" from ga.repeat.data["${mod}"].repeater["${uid}"].layoutr with value ` + JSON.stringify(ga.repeat.data[mod].repeater[uid].layoutr) );}
    
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

    ga.hhelp.reset();
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

ga.repeat.changeMany = function( mod, data ) {
    // hierarchically repeat.change
    // ie. fewest dashes to max dashes

    // build up list of repeaters sorted by number of -, then call ga.data.update
    
    Object.keys( data )
        .filter( k => typeof ga.repeat.data[mod].repeater[k] === 'object' )
        .sort( ( a, b ) => ( a.match(/-/g) || [] ).length > ( b.match(/-/g) || [] ).length )
    // ECMAScript 2015 (ES6) (doesn't seem to work in current Firefox linux, OSX, 2022-09-26)
    //        .map( k => { ga.data.update( mod, { [k] : data[k] }, true ); ga.repeat.change( mod, k ) } ); 
        .map( k => { var obj = {}; obj[k]=data[k]; ga.data.update( mod, obj, true ); ga.repeat.change( mod, k ) } );
    ;
}

ga.repeat.headers = function( mod, id, type, n ) {
    // for integerpair repeaters
    // type is row or column
    // concat values for all headers if exist, o.w. [n]

    if ( 
         !ga.layout.modules[ mod ]
         || !ga.layout.modules[ mod ].json
         || !ga.layout.modules[ mod ].json[ id ]
         || !ga.layout.modules[ mod ].json[ id ].headers
       ) {
        console.warn( `ga.repeat.headers( ${mod}, ${id}, ${type}, ${n} ) - ga.layout.modules[ mod ].json[ id ].headers not defined` );
        return `${type} [${n}]`;
    }

    if ( !ga.layout.modules[ mod ].json[ id ].headers[ type ] ) {
        console.warn( `ga.repeat.headers( ${mod}, ${id}, ${type}, ${n} ) - missing type` );
        return `${type} [${n}]`;
    }

    // get repeat refs

    return [ ga.layout.modules[ mod ].json[ id ].headers[ type ]
             // get repeat refs
             .map( x => `${ga.layout.modules[mod].json[x].repeat}-${x}-${n}` )
             // reduce values
             .reduce( ( a, v ) => a + ( document.getElementById( v ) ? [ document.getElementById( v ).addEventListener( 'change', ga.repeat.headers.update ), document.getElementById( v ).value ][ 1 ] : "?" ) + " ", '' )
             .replace( / *$/, '' )
             ,
             // get repeat refs ids for change events
             ga.layout.modules[ mod ].json[ id ].headers[ type ]
             .map( x => `${ga.layout.modules[mod].json[x].repeat}-${x}-${n}` )
           ]             
             
    ;
}

ga.repeat.headers.update = function( event ) {
    __~debug:repeat{console.log( `ga.repeat.headers.update( event ) id ${event.target.id}` );}
    // find any
    if ( !ga.repeat.pairupdateids[ event.target.id ] ) {
        __~debug:repeat{console.log( `ga.repeat.headers.update( event ) id ${event.target.id} ga.repeat.pairupdateids[ ${event.target.id} not true` );}
        return;
    }

    Object.keys( ga.repeat.pairupdateids[ event.target.id ] )
        .map( mod => {
            __~debug:repeat{console.log( `mod is ${mod}` );}
            Object.keys( ga.repeat.pairupdateids[ event.target.id ][ mod ] )
                .map( id => {
                    __~debug:repeat{console.log( `mod is ${mod} id is ${id}` );}
                    Object.keys( ga.repeat.pairupdateids[ event.target.id ][ mod ][ id ] )
                        .map( k => {
                            __~debug:repeat{console.log( `mod is ${mod} id is ${id} k is ${k}` );}
                            Object.keys( ga.repeat.pairupdateids[ event.target.id ][ mod ][ id ][ k ] )
                                .map( type => {
                                    __~debug:repeat{console.log( `mod is ${mod} id is ${id} k is ${k} type is ${type}` );}
                                    Object.keys( ga.repeat.pairupdateids[ event.target.id ][ mod ][ id ][ k ][ type ] )
                                        .map( v => {
                                            __~debug:repeat{console.log( `mod is ${mod} id is ${id} k is ${k} type is ${type} v is ${v} ` );}
                                            __~debug:repeat{console.log( `fixup id=${k} with ga.repeat.headers( ${mod}, ${id}, ${type}, ${v} )` );}
                                            let e = document.getElementById( k );
                                            if ( e ) { e.innerHTML = ga.repeat.headers( mod, id, type, v )[0]; }
                                        })
                                })
                        })
                })
        })
    ;
}

ga.repeat.setpairupdateids = function( v, mod, id, k, type, n ) {
    ga.repeat.pairupdateids[ v ] = ga.repeat.pairupdateids[ v ] || {};
    ga.repeat.pairupdateids[ v ][ mod ] = ga.repeat.pairupdateids[ v ][ mod ] || {};
    ga.repeat.pairupdateids[ v ][ mod ][ id ] = ga.repeat.pairupdateids[ v ][ mod ][ id ] || {};
    ga.repeat.pairupdateids[ v ][ mod ][ id ][ k ] = ga.repeat.pairupdateids[ v ][ mod ][ id ][ k ] || {};
    ga.repeat.pairupdateids[ v ][ mod ][ id ][ k ][ type ] = ga.repeat.pairupdateids[ v ][ mod ][ id ][ k ][ type ] || {};
    ga.repeat.pairupdateids[ v ][ mod ][ id ][ k ][ type ][ n ] = true;
}

