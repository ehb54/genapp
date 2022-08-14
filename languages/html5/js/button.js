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

    $.getJSON( "ajax/sys/get_defaults.php", sendobj )
        .done( ( data ) => {
            console.log( "ga.button.click() callback done with data:\n" );
            console.dir( data );
        })
        .fail( () => {
            console.error( "ga.button.click() failed\n" );
        })
    ;

    return false;
}

