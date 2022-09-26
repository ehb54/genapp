/*jslint white: true, plusplus: true*/
/* assumes: jquery > 1.11.0, jqtree >= 3.0.9, jquery-base64 */

ga.button              = {};

ga.button.cbclick = function( cb, mod, id, hook, file ) {
    console.log( `ga.button.cbclick( ${mod}, ${id}, ${hook}, ${file} ) cb checked:${cb.checked}` );
    if ( cb.checked ) {
        return ga.button.click( mod, id, hook );
    }
}

ga.button.click = function( mod, id, hook, file ) {
    console.log( `ga.button.click( ${mod}, ${id}, ${hook}, ${file})` );

    // validate & use ga.msg (msgbox?) if issues

    var sendobj = {
        _logon    : $( "#_state" ).data( "_logon" )
        ,_window  : window.name
        ,_project : $( "#_state" ).data( "_project" )
        ,hook     : hook
    }

    if ( file ) {
        // perhaps "lfile", "rfile" etc, right now, currently lfile
        console.log( `ga.button.click() - file requested, load and put file in json - todo` );
        // FileReader requires <input type=file>, so setup a dialog
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
        return;
    }
    return ga.button.process( mod, sendobj );
}

ga.button.process = function( mod, sendobj ) {
    console.log( `ga.button.process()` );

    __~debug:getdefaults{ga.msg.box( { icon : "information.png",text : "ajax call data:<br><code>" + JSON.stringify( sendobj, null, "&nbsp;" ) + "</code>" } );}

    $.post( "ajax/sys/get_defaults.php", sendobj )
        .done( ( data ) => {
            __~debug:getdefaults{console.log( "ga.button.click() callback done with data:\n" );}
            __~debug:getdefaults{console.dir( data );}
            if ( data.hasOwnProperty( 'error' ) ) {
                ga.msg.box( { icon : "toast.png"
                              ,text : `ajax call to get_defaults.php failed<br>Error: ${data.error}` } );
            } else {
                // process normally
                __~debug:getdefaults{ga.msg.box( { icon : "information.png",text : "ajax call returned:<br><code>" + JSON.stringify( data, null, "&nbsp;" ) + "</code>" } );}
                // populate fields
                ga.repeat.changeMany( mod, data );
                ga.data.update( mod, data, true );
            }
        })
        .fail( ( err ) => {
            console.error( `ga.button.click() failed ${err}\n` );
            ga.msg.box( { icon : "toast.png"
                          ,text : "ajax call to get_defaults.php failed" } );
        })
    ;

    return false;
}

