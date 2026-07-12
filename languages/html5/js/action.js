/*jslint white: true, plusplus: true*/

ga.action = {};

ga.action.escapeHtml = function( value ) {
    return String( value )
        .replace( /&/g, "&amp;" )
        .replace( /</g, "&lt;" )
        .replace( />/g, "&gt;" )
        .replace( /"/g, "&quot;" )
        .replace( /'/g, "&#039;" );
};

ga.action.collect = function( mod, id, actiondata ) {
    let sendobj = {
        _action  : id
        ,_logon  : $( "#_state" ).data( "_logon" )
        ,_window : window.name
        ,_project : $( "#_state" ).data( "_project" ).length ? $( "#_state" ).data( "_project" ) : "no_project_specified"
        ,_height : window.screen.height
        ,_width : window.screen.width
    };

    if ( actiondata == "_allformdata" ) {
        let formdata = new FormData( document.getElementById( `${mod}` ) );
        for ( const [key, value] of formdata ) {
            sendobj[ key ] = value;
        }
        return sendobj;
    }

    if ( actiondata && actiondata != "_" + "_fields:actiondata__" ) {
        actiondata.split( "," ).map( item => item.trim() ).filter( item => item.length ).forEach( item => {
            let ele = document.getElementById( item );
            sendobj[ item ] = ele ? ele.value : `${item} no element`;
        } );
    }

    return sendobj;
};

ga.action.click = function( mod, id, actiondata ) {
    __~debug:button{console.log( `ga.action.click( ${mod}, ${id}, ${actiondata} )` );}
    ga.loader.show( `action.click.${mod}.${id}` );

    $.post( `ajax/action/${mod}.php`, ga.action.collect( mod, id, actiondata ) )
        .done( ( data ) => {
            ga.loader.hide( `action.click.${mod}.${id}` );
            ga.action.process( mod, id, data );
        } )
        .fail( ( err ) => {
            ga.loader.hide( `action.click.${mod}.${id}` );
            console.error( `ga.action.click() failed ${err}\n` );
            ga.msg.box( { icon : "toast.png", text : "ajax call to action endpoint failed" } );
        } )
    ;

    return false;
};

ga.action.process = function( mod, id, data ) {
    if ( !data ) {
        ga.msg.box( { icon : "toast.png", text : "Action returned no data" } );
        return;
    }

    if ( data.hasOwnProperty( "error" ) ) {
        ga.msg.box( { icon : "toast.png", text : `Error: ${ga.action.escapeHtml( data.error )}` } );
        return;
    }

    if ( data.fields ) {
        ga.action.setFields( mod, data.fields );
    }

    if ( Array.isArray( data.actions ) ) {
        data.actions.forEach( action => ga.action.applyAction( mod, action ) );
    }

    if ( data.summary ) {
        let icon = data.status == "fail" ? "warning.png" : data.status == "warning" ? "warning.png" : "information.png";
        ga.msg.box( { icon : icon, text : ga.action.escapeHtml( data.summary ) } );
    }

    $( `#${id}_actionval` ).text( data.status || "complete" );
};

ga.action.applyAction = function( mod, action ) {
    if ( !action || !action.action ) {
        return;
    }

    switch ( action.action ) {
    case "set_fields":
        ga.action.setFields( mod, action.fields || {} );
        break;

    case "clear_fields":
        ( action.fields || [] ).forEach( field => {
            let ele = document.getElementById( field );
            if ( ele ) {
                ele.value = "";
                $( ele ).trigger( "change" );
            }
        } );
        break;

    case "message":
    case "dialog":
        ga.msg.box( {
            icon : action.level == "warning" ? "warning.png" : "information.png"
            ,text : ga.action.escapeHtml( action.text || "" )
        } );
        break;

    default:
        console.warn( `Unknown GenApp action response '${action.action}'` );
        break;
    }
};

ga.action.setFields = function( mod, fields ) {
    ga.repeat.changeMany( mod, fields );
    ga.data.update( mod, fields, true );
    Object.keys( fields ).forEach( key => {
        let ele = document.getElementById( key );
        if ( ele ) {
            $( ele ).trigger( "change" );
        }
    } );
    ga.repeat.headers.updateall();
};
