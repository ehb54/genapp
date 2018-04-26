/*jslint white: true, plusplus: true*/
/* assumes: jquery > 1.11.0, jqtree >= 3.0.9, jquery-base64 */

ga.valuen = {};
ga.valuen.data = {};
ga.valuen.html = {};
ga.valuen.dflt = {};
ga.valuen.dflt.data = {};
ga.valuen.dflt.html = {};
ga.valuen.lastload = "";

// restore data to form

ga.valuen.restore = function( form, data, html ) {
    var hform = "#" + form,
        jqhform = $( hform ),
        els = jqhform.find(':input').get(),
        repeaters = {},
        repeaters_added,
        i;

    data = data || ga.valuen.data[ form ];
    html = html || ga.valuen.html[ form ];

    __~debug:valuen{console.log( "ga.valuen.restore( " + form + " )" );}

    if ( !data ) {
        // console.warn( "ga.valuen.restore( " + form + " ) no data" );
        return;
    }
    // if ( !html ) {
    // // console.warn( "ga.valuen.restore( " + form + " ) no html" );
    // return;
    //}

    $( hform + " .field_msg" ).empty();

    // add repeaters repeatedly until no more unassigned repeaters exist
    
    do {
        repeaters_added = false;
        $.each(els, function() {
            var i,
            names,
            $this = $( this ),
            val,
            found
            ;

            if ( $this.attr( "data-repeater" ) &&
                 !repeaters[ this.name ] ) {
                __~debug:valuen{console.log( "ga.valuen.restore() repeater newly found: name " + this.name + "  nodename " + this.nodeName + " type " + this.type );}
                repeaters[ this.name ] = true;

                if ( this.name && 
                     ( data[ this.name ] ||
                       /checkbox|radio/i.test( this.type ) )
                   ) {
                    names = data[ this.name ];
                    if( /checkbox|radio/i.test( this.type ) ) { 
                        val = $this.val();
                        found = false;
                        if ( names ) {
                            for( i = 0; i < names.length; i++ ) {
                                if( names[ i ] == val ) {
                                    found = true;
                                    break;
                                }
                            }
                        }
                        $this.prop( "checked", found );
                        __~debug:valuen{console.log( "ga.valuen.restore() repeater setting value on " + this.name + " type " + this.type + " to " + ( found ? "true" : "false" ) );}
                    } else {
                        $this.val( names[ 0 ] );
                        __~debug:valuen{console.log( "ga.valuen.restore() repeater setting value on " + this.name + " type " + this.type + " to " + names[ 0 ] );}
                    }
                    // probably need to update repeaters at this point
                    repeaters_added = true;
                    ga.repeat.change( form, this.name, true );
                    __~debug:valuen{console.log( "ga.valuen.restore() repeater found, so reget the form" );}
                    els = jqhform.find(':input').get();
                    return false;  // "break" equivalent for jquery's $.each
                } else {
                    if ( !data[ this.name ] && 
                         !/checkbox|radio/i.test( this.type ) ) {
                        console.warn( "ga.valuen.restore() no data found for repeater setting value on " + this.name + " type " + this.type + " to " + names[ 0 ] );
                    }
                }
            }
        });
    } while ( repeaters_added );

    // everything else

    $.each(els, function() {
        var i,
            names,
            $this,
            val,
            found,
            typetype,
            typenames
            ;
        __~debug:valuen{console.log( "ga.valuen.restore() checking: name " + this.name + "  nodename " + this.nodeName + " type " + this.type + " id " + this.id);}
        if ( this.name && 
             !repeaters[ this.name ] ) {
            $this = $( this );
            if ( ( data[ this.name ] ||
                   /checkbox|radio/i.test( this.type ) ) &&
                 !/button/i.test( this.nodeName )
               ) {
                names = data[ this.name ];
                if( /checkbox|radio/i.test( this.type ) ) { 
                    val = $this.val();
                    found = false;
                    if ( names ) {
                        for( i = 0; i < names.length; i++ ) {
                            if( names[ i ] == val ) {
                                found = true;
                                break;
                            }
                        }
                    }
                    $this.prop( "checked", found );
                    __~debug:valuen{console.log( "ga.valuen.restore() setting value on " + this.name + " type " + this.type + " to " + ( found ? "true" : "false" ) );}
                } else {
                    if ( this.type === "file" ) {
                        if ( names[ 0 ] ) {
                            $( "#" + this.id + "_msg" ).html( " " + names[ 0 ] + " please reload manually (programmatic setting of local files disallowed by browser security)" );
                        } else {
                            $this.val( "" );
                        }
                    } else {
                        $this.val( names[ 0 ] );
                    }
                    __~debug:valuen{console.log( "ga.valuen.restore() setting value on " + this.name + " type " + this.type + " to " + names[ 0 ] );}
                }
            } else {
                if ( /button/i.test( this.nodeName ) &&
                     ( typetype = $this.attr( "data-type" ) ) ) {
                    __~debug:valuen{console.log( "ga.valuen.restore() found named button " + this.name + " data-type " + typetype );}
                    typenames = ga.altfile.button.getnames( this.id, typetype );
                    if ( typenames ) {
                        for ( i = 0; i < typenames.length; ++i ) {
                            __~debug:valuen{console.log( "ga.valuen.restore() type name " + typenames[ i ] );}
                            if ( data[ typenames[ i ] ] ) {
                                __~debug:valuen{console.log( "ga.valuen.restore() type name " + typenames[ i ] + " found in data, now need to add html" );}
                                ga.altfile.button.addhtml( form, this.id, typetype, data[ typenames[ i ] ] );
                            }
                        }
                    }   
                }
            }    
        }
    });

    // set html

    for ( i in html ) {
        __~debug:valuen{console.log( "ga.valuen.restore() setting html on " + i );}
        $( "#" + i ).html( html[ i ] );
    };
}

// restore data to form from dflts

ga.valuen.restore.dflt = function( form ) {
    return ga.valuen.restore( form, ga.valuen.dflt.data[ form ], ga.valuen.dflt.html[ form ] );
}

// save data from form and optionally store as dflt

ga.valuen.save = function( form, asdflt ) {
    var els = $( "#" + form ).find(':input').get();
        data = {},
        html = {};
    __~debug:valuen{console.log( "ga.valuen.save( " + form + " )" );}

    // ga.valuen.data[ form ] = {};
    // ga.valuen.html[ form ] = {};

    $.each( els, function() {
        var tjq = $( this ),
            namenotdisabled = this.name && !this.disabled,
            idadd = tjq.attr( "data-add" );

        __~debug:valuend{console.log( "trying: name " + this.name + "  nodename " + this.nodeName + " type " + this.type + " val " + $( this ).val() );}
        if ( namenotdisabled ) {
            if ( this.checked
                 || /select|textarea/i.test( this.nodeName )
                 || /file|email|number|text|hidden|password/i.test( this.type )
               ) {
                if( data[ this.name ] == undefined ){
                    data[ this.name ] = [];
                }
                data[ this.name ].push( tjq.val() );
                __~debug:valuen{console.log( "ga.valuen.save() valued: name " + this.name + "  nodename " + this.nodeName + " type " + this.type + " val " + tjq.val() );}
            }
            if ( idadd ) {
                __~debug:valuen{console.log( "ga.valuen.save() add: name " + idadd + " val " + $( "#" + idadd ).html() );}
                if( html[ idadd ] == undefined ){
                    html[ idadd ] = [];
                }
                html[ idadd ].push( $( "#" + idadd ).html() );
            }                
        }
    });

    if ( asdflt ) {
        ga.valuen.dflt.data[ form ] = data;
        ga.valuen.dflt.html[ form ] = html;
    } else {
        ga.valuen.data[ form ] = data;
        ga.valuen.html[ form ] = html;
    }
}

// take input data and put on form

ga.valuen.input = function( form, data ) {
    __~debug:valuen{console.log( "ga.valuen.input( " + form + " , " + " [data] )" );}
    var hform = "#" + form,
        jqhform = $( hform ),
        els = jqhform.find(':input').get(),
        repeaters = {},
        repeaters_added,
        i;

//    $.each( data, function(k, v) {
//        console.log( "ga.valuen.input() k " + k + " v " + v );
//    });

    __~debug:valuen{console.log( "ga.valuen.input( " + form + " )" );}

    if ( !data ) {
        console.warn( "ga.valuen.input( " + form + " ) no data" );
        return;
    }

    // add repeaters repeatedly until no more unassigned repeaters exist
    
    do {
        repeaters_added = false;
        $.each(els, function() {
            var i,
            names,
            $this = $( this ),
            val,
            found
            ;

            if ( $this.attr( "data-repeater" ) &&
                 !repeaters[ this.name ] ) {
                __~debug:valuen{console.log( "ga.valuen.input() repeater newly found: name " + this.name + "  nodename " + this.nodeName + " type " + this.type );}
                repeaters[ this.name ] = true;

                if ( this.name && 
                     ( data[ this.name ] ||
                       /checkbox|radio/i.test( this.type ) )
                   ) {
                    names = data[ this.name ];
                    if ( Object.prototype.toString.call(names) !== '[object Array]' ) {
                        names = [ names ];
                    }
                    if( /checkbox|radio/i.test( this.type ) ) { 
                        val = $this.val();
                        found = false;
                        if ( names ) {
                            for( i = 0; i < names.length; i++ ) {
                                if( names[ i ] == val ) {
                                    found = true;
                                    break;
                                }
                            }
                        }
                        $this.prop( "checked", found );
                        __~debug:valuen{console.log( "ga.valuen.input() repeater setting value on " + this.name + " type " + this.type + " to " + ( found ? "true" : "false" ) );}
                    } else {
                        $this.val( names[ 0 ] );
                        __~debug:valuen{console.log( "ga.valuen.input() repeater setting value on " + this.name + " type " + this.type + " to " + names[ 0 ] );}
                    }
                    // probably need to update repeaters at this point
                    repeaters_added = true;
                    ga.repeat.change( form, this.name, true );
                    __~debug:valuen{console.log( "ga.valuen.input() repeater found, so reget the form" );}
                    els = jqhform.find(':input').get();
                    return false;  // "break" equivalent for jquery's $.each
                } else {
                    if ( !data[ this.name ] && 
                         !/checkbox|radio/i.test( this.type ) ) {
                        console.warn( "ga.valuen.input() no data found for repeater setting value on " + this.name + " type " + this.type + " to " + names[ 0 ] );
                    }
                }
            }
        });
    } while ( repeaters_added );

    // everything else

    $.each(els, function() {
        var i,
            names,
            $this,
            val,
            found,
            typetype,
            typenames
            ;
        __~debug:valuen{console.log( "ga.valuen.input() checking: name " + this.name + "  nodename " + this.nodeName + " type " + this.type + " id " + this.id);}
        if ( this.name && 
             !repeaters[ this.name ] ) {
            $this = $( this );
            if ( ( data[ this.name ] ||
                   /checkbox|radio/i.test( this.type ) ) &&
                 !/button/i.test( this.nodeName )
               ) {
                names = data[ this.name ];
                if ( Object.prototype.toString.call(names) !== '[object Array]' ) {
                    names = [ names ];
                }
                if( /checkbox|radio/i.test( this.type ) ) { 
                    val = $this.val();
                    found = false;
                    if ( names ) {
                        for( i = 0; i < names.length; i++ ) {
                            if( names[ i ] == val ) {
                                found = true;
                                break;
                            }
                        }
                    }
                    $this.prop( "checked", found );
                    __~debug:valuen{console.log( "ga.valuen.input() setting value on " + this.name + " type " + this.type + " to " + ( found ? "true" : "false" ) );}
                } else {
                    if ( this.type === "file" ) {
                        if ( names[ 0 ] ) {
                            $( "#" + this.id + "_msg" ).html( " " + names[ 0 ] + " please reload manually (programmatic setting of local files disallowed by browser security)" );
                        }
                    } else {
                        $this.val( names[ 0 ] );
                    }
                    __~debug:valuen{console.log( "ga.valuen.input() setting value on " + this.name + " type " + this.type + " to " + names[ 0 ] );}
                }
            } else {
                if ( /button/i.test( this.nodeName ) &&
                     ( typetype = $this.attr( "data-type" ) ) ) {
                    __~debug:valuen{console.log( "ga.valuen.input() found named button " + this.name + " data-type " + typetype );}
                    typenames      = ga.altfile.button.getnames     ( this.id, typetype );
                    typenamesinput = ga.altfile.button.getnamesinput( this.id, typetype );
                    if ( typenames ) {
                        for ( i = 0; i < typenames.length; ++i ) {
                            __~debug:valuen{console.log( "ga.valuen.input() type name " + typenames[ i ] );}
                            if ( data[ typenamesinput[ i ] ] ) {
                                __~debug:valuen{console.log( "ga.valuen.input() type name " + typenames[ i ] + " found in data, now need to add html" );}
                                ga.altfile.button.addhtml( form, this.id, typetype, data[ typenamesinput[ i ] ] );
                            }
                        }
                    }   
                }
            }    
        }
    });

    $.each( data, function(k, v) {
        var jqk;
        if ( /^_html_/.test( k ) ) {
            k = k.replace( /^_html_/, "" );
            if ( jqk = $( "#" + k ) ) {
                jqk.html( v );
            }
        }
//        if ( k == "_datetime" ) {
//            jqhform.prepend( "<span class='removeme'><p><i>Reattached from job submitted at " + v + " </i></p></span>" );
//        }
    });
}

ga.valuen.addhtml = function( form ) {
    var jqhform = $( "#" + form ),
        els = jqhform.find(':input').get(),
        add = "";

    __~debug:valuen{console.log( "ga.valuen.addhtml( " + form + " )" );}

    $.each( els, function() {
        var tjq = $( this ),
            namenotdisabled = this.name && !this.disabled,
            idadd = tjq.attr( "data-add" );

        if ( namenotdisabled ) {
            if ( idadd ) {
                __~debug:valuen{console.log( "ga.valuen.addhtml() add: name " + idadd + " val " + $( "#" + idadd ).html() );}
                add += '<input type="hidden" name="_html_' + idadd + '" value="' +  $( "#" + idadd ).html() + '">';
            }                
        }
    });

    __~debug:valuen{console.log( "ga.valuen.addhtml() add html " + add );}

    jqhform.append( add );
}

ga.valuen.reset = function() {
    ga.valuen.data = {};
    ga.valuen.html = {};
    ga.valuen.dflt = {};
    ga.valuen.dflt.data = {};
    ga.valuen.dflt.html = {};
    ga.valuen.lastload = "";
}    
