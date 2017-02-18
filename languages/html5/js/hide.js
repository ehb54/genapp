/*jslint white: true, plusplus: true*/
/* assumes: jquery > 1.11.0, jqtree >= 3.0.9, jquery-base64 */

// ga.hide provides hider functionality to hide a field based upon checkbox status, this is used primarily for the login "forgot password" to remove the password box

ga.hide = function( module, id ) {
__~debug:hide{   console.log( "ga.hide( " + module + " , " + id + " )" );}
    ga.hide.data = ga.hide.data || {};
    ga.hide.data[ module ] = ga.hide.data[ module ] || {};
    ga.hide.data[ module ][ id ] = ga.hide.data[ module ][ id ] || {};
    ga.hide.data[ module ][ id ].active = 1;

__~debug:hide{   console.log( "ga.hide( " + module + " , " + id + " ) hider added" );}
};

ga.hide.data = {};

ga.hide.update = function( module, id ) {
__~debug:hide{    console.log( "ga.hide.update( " + module + " , " + id + " )" );}
    var i;

    if ( !ga.hide.data[ module ] || !ga.hide.data[ module ][ id ] ) {
        console.log( "ga.hide.update( " + module + " , " + id + " ) error, hider has not been defined" );
        return;
    }

    if ( !ga.hide.data[ module ][ id ].hides ) {
        console.log( "ga.hide.update( " + module + " , " + id + " ) error, no hides attached to this hider" );
        return;
    }

    if ( $( id ).prop( 'checked' ) ) {
        for ( i in ga.hide.data[ module ][ id ].hides ) {
__~debug:hide{    console.log( "ga.hide.update( " + module + " , " + id + " ) hiding " + i );}
            $( i + "-itd" ).html(" ");
            $( i ).hide();
        } 
    } else {
        for ( i in ga.hide.data[ module ][ id ].hides ) {
__~debug:hide{    console.log( "ga.hide.update( " + module + " , " + id + " ) showing " + i );}
            $( i + "-itd" ).html( ga.hide.data[ module ][ id ].hides[ i ] );
            $( i ).show();
        } 
    }
// fix up help
    setHoverHelp();
__~debug:hide{    console.log( "ga.hide.update( " + module + " , " + id + " ) returns" );}
}

ga.hide.add = function( module, id, hiderid ) {
__~debug:hide{   console.log( "ga.hide.add( " + module + " , " + id + " , " + hiderid + " )" );}
    ga.hide.data = ga.hide.data || {};
    ga.hide.data[ module ] = ga.hide.data[ module ] || {};
    ga.hide.data[ module ][ hiderid ] = ga.hide.data[ module ][ hiderid ] || {};
    ga.hide.data[ module ][ hiderid ].hides = ga.hide.data[ module ][ hiderid ].hides || {};
    ga.hide.data[ module ][ hiderid ].hides[ id ] = $( id + "-itd" ).html();
__~debug:hide{   console.log( "ga.hide.add() html is " + ga.hide.data[ module ][ hiderid ].hides[ id ] );}
__~debug:hide{   console.log( "ga.hide.add( " + module + " , " + id + " , " + hiderid + " ) hide added" );}
};

// hideifnot is helpful for removing fields if a directive is not set
// this is currently supported for types/checkbox.input & types/listbox.input, but could easily be extended by adding the fields:hideifnot tag to other input elements
// note: it also requires a registry of directives (currently done in base_header.html using ga.directives

ga.directives = function( directive, value ) {
    __~debug:directives{console.log( "ga.directives( " + directive + " , " + value + " )" );}
    ga.directives.data = ga.directives.data || {};
    ga.directives.data[ directive ] = value;
}

ga.hideifnot = function( id, directive ) {
    __~debug:directives{console.log( "ga.hideifnot( " + id + " , " + directive + " )" );}
    if ( ga.directives.data &&
         ga.directives.data[ directive ] &&
         !/^(off|false|0$)/.test( ga.directives.data[ directive ].toLowerCase() ) ) {
        __~debug:directives{console.log( "ga.hideifnot() skipped" );}
        return;
    }
    $( id ).hide();
}

