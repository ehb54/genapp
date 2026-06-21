/*jslint white: true, plusplus: true*/

ga.dynamicOutput = {};
ga.dynamicOutput.registry = {};
ga.dynamicOutput.instances = {};

ga.dynamicOutput.register = function(mod, config) {
    ga.dynamicOutput.registry[ mod ] = ga.dynamicOutput.registry[ mod ] || {};
    ga.dynamicOutput.instances[ mod ] = ga.dynamicOutput.instances[ mod ] || {};
    ga.dynamicOutput.instances[ mod ][ config.id ] = ga.dynamicOutput.instances[ mod ][ config.id ] || {};
    ga.dynamicOutput.registry[ mod ][ config.id ] = config;
};

ga.dynamicOutput.escape = function(value) {
    return String(value === undefined || value === null ? "" : value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
};

ga.dynamicOutput.safeId = function(value) {
    value = String(value === undefined || value === null ? "" : value);
    return /^[A-Za-z]\w*$/.test(value) ? value : "";
};

ga.dynamicOutput.items = function(config, payload) {
    var raw = Array.isArray(payload) ? payload : payload && payload.items,
        items = [],
        i,
        item,
        id;

    if ( !Array.isArray(raw) ) {
        raw = [];
    }

    for ( i = 0; i < raw.length && i < config.max; i++ ) {
        item = raw[ i ] || {};
        id = ga.dynamicOutput.safeId( item.id ) || config.idprefix + "_" + ( i + 1 );
        id = ga.dynamicOutput.safeId( id );
        if ( id ) {
            items.push( {
                id    : id,
                label : item.label || config.label + " " + ( i + 1 ),
                value : item.value !== undefined ? item.value : item.data
            } );
        }
    }
    return items;
};

ga.dynamicOutput.create = function(mod, groupId, item) {
    var config = ga.dynamicOutput.registry[ mod ][ groupId ],
        instances = ga.dynamicOutput.instances[ mod ][ groupId ],
        group = $( "#" + groupId ),
        type = config.type,
        outtype = type == "html" ? "div" : type,
        rowId = item.id + "_dynamicoutput_row",
        html;

    if ( instances[ item.id ] ) {
        return;
    }

    html = '<div id="' + rowId + '" class="ga-dynamic-output-instance">'
        + '<label for="' + item.id + '">' + ga.dynamicOutput.escape( item.label ) + '</label>';

    switch ( type ) {
    case "html":
        html += '<div id="' + item.id + '" type="' + outtype + '"></div>';
        break;
    case "plotly":
        html += '<div id="' + item.id + '" name="' + item.id + '" type="' + outtype + '"></div>';
        break;
    default:
        return;
    }

    html += '</div>';
    group.append( html );
    instances[ item.id ] = true;
    ga.value.setLastValue( mod + "_output", "#" + item.id );
    ga.value.extra_resets( item.id );
};

ga.dynamicOutput.remove = function(mod, groupId, id) {
    var instances = ga.dynamicOutput.instances[ mod ][ groupId ];
    $( "#" + id ).remove();
    $( "#" + id + "_dynamicoutput_row" ).remove();
    $( "#global_data" ).removeData( mod + "_output:#" + id + ":last_value" );
    $( "#global_data" ).removeData( mod + "_output:#" + id + ":default_value" );
    if ( ga.value.extra_resets.data ) {
        delete ga.value.extra_resets.data[ id ];
    }
    delete instances[ id ];
};

ga.dynamicOutput.update = function(mod, groupId, payload) {
    var config = ga.dynamicOutput.registry[ mod ] && ga.dynamicOutput.registry[ mod ][ groupId ],
        instances,
        items,
        active = {},
        childData = {},
        replace,
        i,
        id;

    if ( !config ) {
        return;
    }

    instances = ga.dynamicOutput.instances[ mod ][ groupId ];
    items = ga.dynamicOutput.items( config, payload );
    replace = !payload || payload.replace !== false;

    for ( i = 0; i < items.length; i++ ) {
        ga.dynamicOutput.create( mod, groupId, items[ i ] );
        active[ items[ i ].id ] = true;
        childData[ items[ i ].id ] = items[ i ].value;
    }

    if ( replace ) {
        for ( id in instances ) {
            if ( instances.hasOwnProperty( id ) && !active[ id ] ) {
                ga.dynamicOutput.remove( mod, groupId, id );
            }
        }
    }

    if ( items.length ) {
        ga.data.update( mod, childData );
    }
};

ga.dynamicOutput.resetGroup = function(mod, groupId) {
    var instances = ga.dynamicOutput.instances[ mod ] && ga.dynamicOutput.instances[ mod ][ groupId ],
        ids = [],
        id,
        i;

    if ( !instances ) {
        return;
    }
    for ( id in instances ) {
        if ( instances.hasOwnProperty( id ) ) {
            ids.push( id );
        }
    }
    for ( i = 0; i < ids.length; i++ ) {
        ga.dynamicOutput.remove( mod, groupId, ids[ i ] );
    }
};

ga.dynamicOutput.resetByPkgTag = function(pkg, tag) {
    var mod = pkg.replace( /_output$/, "" ),
        groupId = tag.replace( /^#/, "" );

    ga.dynamicOutput.resetGroup( mod, groupId );
};
