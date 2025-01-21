/*jslint white: true, plusplus: true*/
/* assumes: jquery > 1.11.0, jqtree >= 3.0.9, jquery-base64 */

ga.button              = {};

ga.button.cbclick = function( cb, mod, id, hook, file ) {
    __~debug:button{console.log( `ga.button.cbclick( ${mod}, ${id}, ${hook}, ${file} ) cb checked:${cb.checked}` );}
    if ( cb.checked ) {
        return ga.button.click( mod, id, hook );
    }
}

ga.button.click = function( mod, id, hook, file, extradata ) {
    __~debug:button{console.log( `ga.button.click( ${mod}, ${id}, ${hook}, ${file}, ${extradata} )` );}

    // validate & use ga.msg (msgbox?) if issues

    var sendobj = {
        _logon    : $( "#_state" ).data( "_logon" )
        ,_window  : window.name
        ,_project : $( "#_state" ).data( "_project" ).length ? $( "#_state" ).data( "_project" ) : "no_project_specified"
        ,hook     : hook
        ,_height : window.screen.height
        ,_width : window.screen.width
    }

    if ( extradata ) {
        if ( extradata == "_allformdata" ) {
            let formdata = new FormData( document.getElementById( `${mod}` ) );
            for ( const [key, value] of formdata ) {
                sendobj[ key ] = value;
            }
        } else {
            if ( document.getElementById( extradata ) ) {
                sendobj[ extradata ] = document.getElementById( extradata ).value;
            } else {
                if ( extradata != "_" + "_fields:hookdata__" ) {
                    sendobj[ extradata ] = `${extradata} no element`;
                }
            }
        }
    }
        
    if ( file && file != '__fields:file__' ) {
        // perhaps "lfile", "rfile" etc, right now, currently lfile
        __~debug:button{console.log( `ga.button.click() - file requested, load and put file in json` );}
        // FileReader requires <input type=file>, so setup a dialog
        switch ( file ) {
        case 'lfile' :
            ga.msg.box(
                {
                    text :
                    '<label for="_get_defaults_input">Choose a file for loading defaults &nbsp;</label>'
                        + '<label class="ga-button-select zeromargin" for="_get_defaults_input">Browse local files</label>'
                        + '<input type="file" id="_get_defaults_input" class="offscreen">'
                    ,eval :
                    "document.getElementById('_get_defaults_input').addEventListener('change', () => { "
                        + "console.log( 'msg box eval change on get_defaults_input' );"
                        + "var sendobj=" + JSON.stringify( sendobj ) + ";"
                        + 'var reader = new FileReader();'
                        + 'reader.onload = (evt) => {'
                        + 'sendobj._filedata = evt.target.result;'
                        + "ga.msg.close( mnum );"
                        + `ga.button.process( "${mod}", sendobj );`
                        + '};'
                        + 'reader.readAsText(document.getElementById("_get_defaults_input").files[0]);'
                        + "} );"
                }
            );
            break;

        case 'rfile' :
            ga.msg.box(
                {
                    text : 'hook rfile type not currently supported'
                }
            );
            break;

        case 'lrfile' :
            ga.qr.question(
                mod
                ,{
                    _uuid : 'na'
                    ,_msgid : 'na'
                    ,_sendobj : JSON.stringify( sendobj )
                    ,_mod     : mod
                    ,_question : {
                        id : `_hook_button_lrfile_mod_${id}`
                        ,title : '<h4>Select a file</h4>'
                        ,icon : 'question.png'
//                        ,grid : {
//                            gap        : "5px"
//                            ,colwidths : [ 3, 1, 3, 6 ]
//                            ,align     : "center"
//                        }
                        ,text : ''
                        // ,buttons : []
                        ,fields : [
                            {
                                id          : "f1"
                                ,type       : "lrfile"
                                ,label      : "Browse local files"
                                ,align      : "center"
                            }
                        ]
                    }
                }
                ,ga.button.cb_lrfile
            )
            break;

        default :
            ga.msg.box(
                {
                    text : `hook unknown choice - ${file}`
                }
            );
            break;
        }

        return;
    }
    
    return ga.button.process( mod, sendobj );
}

ga.button.cb_lrfile = function ( q, bid, v ) {
    __~debug:button{console.log( `ga.button.cb_lrfile( q, '${bid}', ${v} )` );}
    var id = q._uuid + "-" + q._msgid;
    __~debug:button{console.log( `ga.button.cb_lrfile id is ${id}` );}
    __~debug:button{console.dir( q );}

    switch ( bid ) {
    case 'ok' :
        let sendobj = JSON.parse( q._sendobj );
        let mod     = q._mod;
        var faltvalele = document.getElementById( "f1_altval" );
        if ( faltvalele ) {
            let ok = 0;
            __~debug:button{console.log( `faltvalele.innerHTML ${faltvalele.innerHTML}` );}
            if ( /^<i>Local/.test( faltvalele.innerHTML ) ) {
                // local file defined
                __~debug:button{console.log( "matched local" );}
                let fele = document.getElementById( 'f1' );
                if ( fele.files && fele.files.length ) {
                    let fname = fele.files[ 0 ];
                    ok = 1;
                    __~debug:button{console.log( `found local file ${fname}, read and continue processing` );}
                    let reader = new FileReader();
                    reader.onload = (evt) => {
                        sendobj._filedata = evt.target.result;
                        ga.msg.close( 2 );
                        delete ga.qr.openq[ id ];
                        ga.button.process( mod, sendobj );
                    }
                    reader.readAsText( fname );
                }
            }
            if ( /^<i>Server/.test( faltvalele.innerHTML ) ) {
                // server file define
                __~debug:button{console.log( "matched server" );}
                let feles = document.getElementsByClassName( '_hidden_lrfile_sels_f1' );
                if ( feles && feles.length == 1 ) {
                    let fname = atob( feles[0].value );
                    ok = 1;
                    __~debug:button{console.warn( `found server file ${fname}, add to remote for post processing in get_defaults.php` );}
                    sendobj._file_enc_to_load = feles[0].value;
                    ga.button.process( mod, sendobj );
                }
            }
            if ( !ok ) {
                __~debug:button{console.warn( "no file method selected, treating like cancel?" );}
                return;
            }
        } else {
            __~debug:button{console.warn( "no file method selected" );}
            return;
        }
        break;

    case 'cancel' :
        break;

    default :
        ga.msg.box(
            {
                text : `Internal error - unknown button ${bid} returned to ga.button.cb_lrfile`
            }
        );
        break;
    }
    ga.msg.close( 2 );
    delete ga.qr.openq[ id ];
}    

ga.button.process = function( mod, sendobj ) {
    __~debug:button{console.log( `ga.button.process()` );}

    __~debug:button{ga.msg.box( { icon : "information.png",text : "ajax call data:<br><code>" + JSON.stringify( sendobj, null, "&nbsp;" ) + "</code>" } );}

    // disable loader block when debugging as the ajax post/response messageboxes will be blocked
    __!debug:button{ga.loader.show( `button.process.${mod}` );}

    __~debug:button{console.log( "object to send:" );console.dir( sendobj );}
    
    $.post( "ajax/sys/get_defaults.php", sendobj )
        .done( ( data ) => {
            __~debug:button{console.log( "ga.button.click() callback done with data:\n" );}
            __~debug:button{console.dir( data );}
            if ( data.hasOwnProperty( 'error' ) ) {
                ga.loader.hide( `button.process.${mod}` );
                ga.msg.box( { icon : "toast.png"
                              ,text : `Error: ${data.error}` } );
            } else {
                // process normally
                __~debug:button{ga.msg.box( { icon : "information.png",text : "ajax call returned:<br><code>" + JSON.stringify( data, null, "&nbsp;" ) + "</code>" } );}
                // populate fields
                ga.repeat.changeMany( mod, data );
                ga.data.update( mod, data, true );
                ga.loader.hide( `button.process.${mod}` );
            }
        })
        .fail( ( err ) => {
            ga.loader.hide( `button.process.${mod}` );
            console.error( `ga.button.click() failed ${err}\n` );
            ga.msg.box( { icon : "toast.png"
                          ,text : "ajax call to get_defaults.php failed" } );
        })
    ;

    return false;
}

ga.button.disablebuttons = function( mod, disable, msg ) {
    __~debug:button{console.log(`ga.button.disablebuttons('${mod}','` + ( disable ? 'true' : 'false' ) + `' , '${msg}')`);}
    let doc;
    
    doc = document.getElementById(`${mod}_b_submit_button`);
    if ( doc ) {
        __~debug:button{console.log('ga.button.disablebuttons() for doc for submit found');}
        doc.disabled = disable;
    } else {
        __~debug:button{console.log('ga.button.disablebuttons() doc not for submit found');}
    }

    doc = document.getElementById(`${mod}_b_reset_button`);
    if ( doc ) {
        __~debug:button{console.log('ga.button.disablebuttons() doc for reset found');}
        doc.disabled = disable;
    } else {
        __~debug:button{console.log('ga.button.disablebuttons() doc for reset not found');}
    }

    doc = document.getElementById(`${mod}_b_cancel_button`);
    if ( doc ) {
        __~debug:button{console.log('ga.button.disablebuttons() doc for cancel found');}
        doc.disabled = !disable;
    } else {
        __~debug:button{console.log('ga.button.disablebuttons() doc for cancel not found');}
    }
}
