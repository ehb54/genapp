/*jslint white: true, plusplus: true*/
/* assumes: jquery > 1.11.0, jqtree >= 3.0.9, jquery-base64 */

ga.license = function( req ) {
    var checks = req.split( ',' ),
        needs = [],
        msg,
        button_info = [],
        i;

    __~debug:license{console.log( "ga.license( " + req + " )" )};

    if ( checks.length ) {
        msg = 
            "<p>Submitting to this module requires " + 
            ( checks.length > 1 ? "approved licenses" : "an approved license" ) 
            + " for <em>" + checks.join( "</em> and <em>" ) + "</em></p>";
    }

    for ( i in checks ) {
        button_info.push( { id : checks[ i ],
                            label : checks[ i ] + " Management",
                            data : checks[ i ],
                            cb : function( data ) { return ga.altfile.button.simplecall( "license", data ); } } );
        __~debug:license{console.log( "ga.license() checking " + checks[ i ] )};
        if ( ga.license.data[ checks[ i ] ] &&
             ga.license.data[ checks[ i ] ][ 'status' ] ) {
            switch ( ga.license.data[ checks[ i ] ][ 'status' ] ) {
            case "approved" :
                __~debug:license{console.log( "ga.license() " + checks[ i ] + "<strong>approved</strong>." )};
                break;
            case "denied" :
                __~debug:license{console.log( "ga.license() " + checks[ i ] + " denied" )};
                msg += "<p>Your license request for <em>" + checks[ i ] + "</em> has been <strong>denied</strong>.</p>";
                needs.push( checks[ i ] );
                break;
            case "pending" :
                __~debug:license{console.log( "ga.license() " + checks[ i ] + " pending" )};
                msg += "<p>Your license request for <em>" + checks[ i ] + "</em> is pending approval.</p>";
                needs.push( checks[ i ] );
                break;
            default :
                console.warn( "ga.license() " + checks[ i ] + " unknown status " + ga.license.data[ checks[ i ] ][ 'status' ] );
                needs.push( checks[ i ] );
                break;
            }
        } else {
            needs.push( checks[ i ] );
        }
    }

    if ( needs.length ) {

        ga.msg.box( {
            icon  : "warning.png",
            text  : msg,
            buttons : button_info
        });
        return false;
    } else {
        return true;
    }
}

ga.license.data = {};

// get licenses for user
ga.license.get = function() {
    __~debug:license{console.log( "ga.license.get()" )};

    ga.license.data = {};

    if ( ga.license.url ) {
        __~debug:license{console.log( "ga.license.get() .getJSON() called" )};

        $.getJSON( 
            ga.license.url,
            {
                tagmode: "any"
                ,format: "json"
                ,_window : window.name
                ,_logon : $( "#_state" ).data( "_logon" )
            } )
            .done( function( data, status, xhr ) {
                __~debug:license{console.log( "ga.license.get() .getJSON done" )};
                if ( data[ 'license' ] ) {
                    ga.license.data = data[ 'license' ];
                }
                if ( data[ 'restricted' ] ) {
                    ga.restricted.show( data[ 'restricted' ] );
                } else {
                    ga.restricted.hideall();
                }
                __~debug:license{console.dir( data );}
            })
            .fail( function( xhr, status, errorThrown ) {
                __~debug:license{console.log( "ga.license.get() .getJSON fail" )};
                console.warn( "could not get license data" );
            });
    } else {
        __~debug:license{console.log( "ga.license.get() no url defined" )};
    }
}
