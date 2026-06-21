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

ga.dynamicOutput.truthy = function(value) {
    return value === true || /^(1|true|on|yes)$/i.test( String( value ) );
};

ga.dynamicOutput.attr = function(name, value) {
    if ( value === undefined || value === null || String( value ) === "" ) {
        return "";
    }
    return " " + name + '="' + ga.dynamicOutput.escape( value ) + '"';
};

ga.dynamicOutput.childType = function(config) {
    switch ( config.type ) {
    case "html":
        return "div";
    case "file":
        return ga.dynamicOutput.truthy( config.multiple ) ? "filelinkm" : "filelink";
    default:
        return config.type;
    }
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

ga.dynamicOutput.childHtml = function(config, id) {
    var type = config.type,
        outtype = ga.dynamicOutput.childType( config ),
        style = "",
        html = "";

    switch ( type ) {
    case "html":
    case "image":
    case "video":
    case "bokeh":
    case "plotly":
    case "plot3d":
        return '<div id="' + id + '" name="' + id + '" type="' + outtype + '"'
            + ga.dynamicOutput.attr( "data-width", config.width )
            + ga.dynamicOutput.attr( "data-height", config.height )
            + '></div>';
    case "matplotlib":
        return '<iframe id="' + id + '" name="' + id + '" type="matplotlib" src=""'
            + ga.dynamicOutput.attr( "frameborder", config.border )
            + ga.dynamicOutput.attr( "height", config.height ? config.height + "px" : "" )
            + ga.dynamicOutput.attr( "width", config.width ? config.width + "px" : "" )
            + '></iframe>';
    case "ngl":
        style = ( config.width ? "width:" + config.width + ";" : "" )
            + ( config.height ? "height:" + config.height + ";" : "" );
        return '<div id="' + id + '" type="ngl"></div>'
            + '<div id="' + id + '_plot"' + ga.dynamicOutput.attr( "style", style ) + '></div>'
            + '<div id="' + id + '_buttons"></div>';
    case "atomicstructure":
        return '<div id="' + id + '" type="atomicstructure"></div>'
            + '<div id="_jmol_panel_' + id + '"></div>';
    case "file":
        return '<div id="' + id + '" type="' + outtype + '" readonly>'
            + '<span id="' + id + '_filelink"></span></div>';
    case "textarea":
        return '<textarea name="' + id + '" id="' + id + '"'
            + ga.dynamicOutput.attr( "rows", config.rows )
            + ga.dynamicOutput.attr( "cols", config.cols )
            + ' readonly></textarea>';
    case "text":
    case "email":
        return '<input type="' + type + '" name="' + id + '" id="' + id + '" readonly'
            + ga.dynamicOutput.attr( "size", config.size )
            + '>';
    case "integer":
    case "float":
        return '<input type="number" name="' + id + '" id="' + id + '" readonly'
            + ga.dynamicOutput.attr( "size", config.size )
            + '>';
    case "progress":
        if ( ga.bootstrap ) {
            return '<div class="progress"><div id="' + id + '" class="progress-bar" type="progress" role="progressbar" style="width:0%"></div></div>';
        }
        return '<progress name="' + id + '" id="' + id + '" value="0"'
            + ga.dynamicOutput.attr( "max", config.maxvalue )
            + ' type="progress"></progress>';
    case "plot2d":
        style = ( config.width ? "width:" + config.width + ";" : "" );
        html = '<div id="' + id + '_div"' + ga.dynamicOutput.attr( "style", style ) + '>'
            + '<p><table class="help_link"><tr><td></td><td id="' + id + '_title" style="text-align:center"></td><td id="' + id + '_xy" class="coord"></td></tr>'
            + '<tr><td id="' + id + '_ylabel" style="text-align:center"></td><td id="' + id + '" type="plot2d" class="plot2ddef"'
            + ga.dynamicOutput.attr( "style", ( config.width ? "width:" + config.width + ";" : "" ) + ( config.height ? "height:" + config.height : "" ) )
            + '></td><td id="' + id + '_legend"></td></tr>'
            + '<tr><td></td><td id="' + id + '_xlabel" style="text-align:center"></td><td></td></tr></table></p></div>';
        if ( ga.dynamicOutput.truthy( config.savetofile ) ) {
            html += '<table cellpadding="10" style="margin-bottom:5px"><tr><td><button id="' + id + '_savetofile" type="button" class="hidden">Download .png file:</button></td><td><span id="' + id + '_savetofile_link" style="color:black;"></span></td></tr></table>';
        }
        if ( ga.dynamicOutput.truthy( config.changescalex ) ) {
            html += '<table cellpadding="10"><tr><td><button id="' + id + '_changescalex" type="button" class="hidden">Change X-axis Scale: Log/Lin</button></td><td><span id="' + id + '_changescalex_message" style="color:green;"></span></td></tr></table>';
        }
        if ( ga.dynamicOutput.truthy( config.changescaley ) ) {
            html += '<table cellpadding="10"><tr><td><button id="' + id + '_changescaley" type="button" class="hidden">Change Y-axis Scale: Log/Lin</button></td><td><span id="' + id + '_changescaley_message" style="color:green;"></span></td></tr></table>';
        }
        if ( ga.dynamicOutput.truthy( config.showcollapse ) ) {
            html += '<table cellpadding="10"><tr><td><button id="' + id + '_showcollapse" type="button" class="hidden">Show 2D plot</button></td><td><span id="' + id + '_showcollapse_message" style="color:green;"></span></td></tr></table>';
        }
        return html;
    default:
        return "";
    }
};

ga.dynamicOutput.setup = function(mod, groupId, id) {
    var config = ga.dynamicOutput.registry[ mod ][ groupId ],
        htag = "#" + id;

    switch ( config.type ) {
    case "textarea":
        if ( ga.dynamicOutput.truthy( config.append ) ) {
            $( "#global_data" ).data( "_append:" + mod + "_output_" + id, 1 );
        }
        break;
    case "progress":
        ga.layout.handler = ga.layout.handler || {};
        ga.layout.handler[ mod ] = ga.layout.handler[ mod ] || {};
        ga.layout.handler[ mod ][ id ] = {};
        ga.layout.handler[ mod ][ id ].setval = function(val) {
            var ele = document.getElementById( id );
            if ( ele && ele.style ) {
                ele.style.width = ( 100 * val ).toString() + "%";
            }
        };
        break;
    case "plot2d":
        $.plot( $( htag ), [[]], gd.data( "_plot_options" ) );
        ga.value.set.plot2d.pan( htag, ga.dynamicOutput.truthy( config.pan ) ? 1 : 0 );
        ga.value.set.plot2d.zoom( htag, ga.dynamicOutput.truthy( config.zoom ) ? 1 : 0 );
        ga.value.set.plot2d.hover( htag, ga.dynamicOutput.truthy( config.hover ) ? 1 : 0 );
        ga.value.set.plot2d.selzoom( htag, ga.dynamicOutput.truthy( config.selzoom ) ? 1 : 0 );
        if ( config.backgroundcolor ) {
            ga.value.set.plot2d.backgroundcolor( htag, config.backgroundcolor );
        }
        ga.value.set.plot2d.pkg( mod + "_output", htag );
        if ( ga.dynamicOutput.truthy( config.savetofile ) ) {
            $( htag + "_savetofile" ).click( function() { ga.data.create_image_htmltocanvas( id ); } );
        }
        if ( ga.dynamicOutput.truthy( config.customtooltips ) ) {
            ga.customtooltips[ mod ] = 1;
        }
        if ( ga.dynamicOutput.truthy( config.showcollapse ) ) {
            ga.showcollapse2d[ mod ] = 1;
            $( htag ).hide();
        }
        break;
    case "atomicstructure":
        if ( config.jsmoladd ) {
            ga.set( mod + ":jsmoladd", config.jsmoladd + ";" );
        }
        if ( typeof _jmol_info === "undefined" ) {
            _jmol_info = {};
        }
        _jmol_info[ id ] = {
            disableJ2SLoadMonitor : true,
            disableInitialConsole : true,
            use                   : "HTML5",
            j2sPath               : "j2s",
            isSigned              : false,
            addSelectionOptions   : false,
            readyFunction         : null,
            defaultModel          : null,
            debug                 : false
        };
        if ( config.width ) {
            _jmol_info[ id ].width = config.width;
        }
        if ( config.height ) {
            _jmol_info[ id ].height = config.height;
        }
        break;
    }
    ga.value.setLastValue( mod + "_output", htag );
    ga.value.extra_resets( id );
};

ga.dynamicOutput.cleanup = function(mod, groupId, id) {
    var config = ga.dynamicOutput.registry[ mod ][ groupId ],
        htag = "#" + id;

    switch ( config.type ) {
    case "plotly":
    case "plot3d":
        if ( typeof Plotly !== "undefined" && Plotly.purge ) {
            Plotly.purge( id );
        }
        break;
    case "plot2d":
        if ( ga.value.clear && ga.value.clear.plot2d ) {
            ga.value.clear.plot2d( htag );
        }
        break;
    case "bokeh":
        if ( ga.bokeh && ga.bokeh.reset ) {
            ga.bokeh.reset( mod + "_output", id );
        }
        break;
    case "ngl":
        if ( ga.ngl && ga.ngl.clear ) {
            ga.ngl.clear( mod + "_output:#" + id + ":last_value", htag );
        }
        break;
    case "atomicstructure":
        if ( typeof _jmol_info !== "undefined" ) {
            delete _jmol_info[ id ];
        }
        break;
    case "textarea":
        $( "#global_data" ).removeData( "_append:" + mod + "_output_" + id );
        break;
    case "progress":
        if ( ga.layout.handler[ mod ] ) {
            delete ga.layout.handler[ mod ][ id ];
        }
        break;
    }
};

ga.dynamicOutput.helperIds = function(config, id) {
    switch ( config.type ) {
    case "file":
        return [ id + "_filelink" ];
    case "plot2d":
        return [
            id + "_div",
            id + "_title",
            id + "_xy",
            id + "_ylabel",
            id + "_legend",
            id + "_xlabel",
            id + "_savetofile",
            id + "_savetofile_link",
            id + "_changescalex",
            id + "_changescalex_message",
            id + "_changescaley",
            id + "_changescaley_message",
            id + "_showcollapse",
            id + "_showcollapse_message"
        ];
    case "ngl":
        return [ id + "_plot", id + "_buttons" ];
    case "atomicstructure":
        return [ "_jmol_panel_" + id ];
    default:
        return [];
    }
};

ga.dynamicOutput.create = function(mod, groupId, item) {
    var config = ga.dynamicOutput.registry[ mod ][ groupId ],
        instances = ga.dynamicOutput.instances[ mod ][ groupId ],
        group = $( "#" + groupId ),
        rowId = item.id + "_dynamicoutput_row",
        child,
        html;

    if ( instances[ item.id ] ) {
        return;
    }

    html = '<div id="' + rowId + '" class="ga-dynamic-output-instance">'
        + '<label for="' + item.id + '">' + ga.dynamicOutput.escape( item.label ) + '</label>';

    child = ga.dynamicOutput.childHtml( config, item.id );
    if ( !child ) {
        return;
    }
    html += child;

    html += '</div>';
    group.append( html );
    instances[ item.id ] = true;
    ga.dynamicOutput.setup( mod, groupId, item.id );
};

ga.dynamicOutput.remove = function(mod, groupId, id) {
    var config = ga.dynamicOutput.registry[ mod ][ groupId ],
        instances = ga.dynamicOutput.instances[ mod ][ groupId ],
        helpers = ga.dynamicOutput.helperIds( config, id ),
        i;

    ga.dynamicOutput.cleanup( mod, groupId, id );
    $( "#" + id ).remove();
    for ( i = 0; i < helpers.length; i++ ) {
        $( "#" + helpers[ i ] ).remove();
    }
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
