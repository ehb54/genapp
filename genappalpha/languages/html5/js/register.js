/*jslint white: true, plusplus: true*/
/* assumes: jquery > 1.11.0, jqtree >= 3.0.9, jquery-base64 */

ga.register = function( req ) {
    var checks = req.split( ',' ),
        needs = [],
        msg,
        button_info = [],
        i;

    __~debug:register{console.log( "ga.register( " + req + " )" )};

    if ( checks.length ) {
        msg = 
            "<p>Submitting to this module requires " + 
            ( checks.length > 1 ? "approved registers" : "an approved register" ) 
            + " for <em>" + checks.join( "</em> and <em>" ) + "</em></p>";
    }

    for ( i in checks ) {
        button_info.push( { id : checks[ i ],
                            label : checks[ i ] + " Management",
                            data : checks[ i ],
                            cb : function( data ) { return ga.altfile.button.simplecall( "register", data ); } } );
        __~debug:register{console.log( "ga.register() checking " + checks[ i ] )};
        if ( ga.register.data[ checks[ i ] ] &&
             ga.register.data[ checks[ i ] ][ 'status' ] ) {
            switch ( ga.register.data[ checks[ i ] ][ 'status' ] ) {
            case "approved" :
                __~debug:register{console.log( "ga.register() " + checks[ i ] + "<strong>approved</strong>." )};
                break;
            case "denied" :
                __~debug:register{console.log( "ga.register() " + checks[ i ] + " denied" )};
                msg += "<p>Your register request for <em>" + checks[ i ] + "</em> has been <strong>denied</strong>.</p>";
                needs.push( checks[ i ] );
                break;
            case "pending" :
                __~debug:register{console.log( "ga.register() " + checks[ i ] + " pending" )};
                msg += "<p>Your register request for <em>" + checks[ i ] + "</em> is pending approval.</p>";
                needs.push( checks[ i ] );
                break;
            default :
                console.warn( "ga.register() " + checks[ i ] + " unknown status " + ga.register.data[ checks[ i ] ][ 'status' ] );
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

ga.register.data = {};

// get registers for user
ga.register.get = function() {
    __~debug:register{console.log( "ga.register.get()" )};

    ga.register.data = {};

    if ( ga.register.url ) {
        __~debug:register{console.log( "ga.register.get() .getJSON() called" )};

        $.getJSON( 
            ga.register.url,
            {
                tagmode: "any"
                ,format: "json"
                ,_window : window.name
                ,_logon : $( "#_state" ).data( "_logon" )
            } )
            .done( function( data, status, xhr ) {
                __~debug:register{console.log( "ga.register.get() .getJSON done" )};
                if ( data[ 'register' ] ) {
                    ga.register.data = data[ 'register' ];
                }
                if ( data[ 'restricted' ] ) {
                    ga.restricted.show( data[ 'restricted' ] );
                } else {
                    ga.restricted.hideall();
                }
                __~debug:register{console.dir( data );}
            })
            .fail( function( xhr, status, errorThrown ) {
                __~debug:register{console.log( "ga.register.get() .getJSON fail" )};
                console.warn( "could not get register data" );
            });
    } else {
        __~debug:register{console.log( "ga.register.get() no url defined" )};
    }
}
