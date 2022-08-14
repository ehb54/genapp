/*jslint white: true, plusplus: true*/
/* assumes: jquery > 1.11.0, jqtree >= 3.0.9, jquery-base64 */

ga.button              = {};

ga.button.click = function( mod, id, hook, file ) {
    console.log( `ga.button.click( ${mod}, ${id}, ${hook}, ${file})` );

    // validate & use ga.msg (msgbox?) if issues

    sendobj = {
        _logon    : $( "#_state" ).data( "_logon" )
        ,_window  : window.name
        ,_project : $( "#_state" ).data( "_project" )
        ,hook     : hook
    }

    if ( file ) {
        // perhaps "lfile", "rfile" etc, right now, currently lfile
        console.log( `ga.button.click() - file requested, load and put file in json - todo` );
    }

    ga.msg.box( { icon : "information.png"
                  ,text : "ajax call data:<br><code>" + JSON.stringify( sendobj, null, "&nbsp;" ) + "</code>" } );

    $.getJSON( "ajax/sys/get_defaults.php", sendobj )
        .done( ( data ) => {
            console.log( "ga.button.click() callback done with data:\n" );
            console.dir( data );
            if ( data.error ) {
                ga.msg.box( { icon : "toast.png"
                              ,text : `ajax call to get_defaults.php failed<br>Error: ${data.error}` } );
            } else {
                // process normally
                ga.msg.box( { icon : "information.png"
                              ,text : "ajax call returned:<br><code>" + JSON.stringify( data, null, "&nbsp;" ) + "</code>" } );
            }
        })
        .fail( () => {
            console.error( "ga.button.click() failed\n" );
            ga.msg.box( { icon : "toast.png"
                          ,text : "ajax call to get_defaults.php failed" } );
        })
    ;

    return false;
}

