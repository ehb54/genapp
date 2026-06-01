/*jslint white: true, plusplus: true*/
/* assumes: ga, jquery > 1.11.0 */

ga.panel = {};

ga.panel.root = function( module ) {
    return $( "#" + module + "_input_area" );
}

ga.panel.findId = function( root, id ) {
    return root.find( "*" ).filter( function() {
        return this.id == id;
    }).first();
}

ga.panel.init = function( module, layout ) {
    if ( !layout || !layout.panels ) {
        return;
    }

    var root = ga.panel.root( module );

    ga.panel.state = ga.panel.state || {};
    ga.panel.ui = ga.panel.ui || {};
    ga.panel.state[ module ] = ga.panel.state[ module ] || {};
    ga.panel.ui[ module ] = ga.panel.ui[ module ] || {};

    for ( var i = 0; i < layout.panels.length; ++i ) {
        var panel = Object.keys( layout.panels[ i ] )[ 0 ];
        var paneldef = layout.panels[ i ][ panel ] || {};
        var ui = paneldef.ui || {};

        if ( panel == "root" || !ui.collapsible ) {
            continue;
        }

        var panelElement = ga.panel.findId( root, "ga-panel-" + panel );
        var summaryElement = ga.panel.findId( root, "ga-panel-summary-" + panel );
        if ( !panelElement.length || !summaryElement.length ) {
            continue;
        }

        ga.panel.state[ module ][ panel ] = panelElement.hasClass( "ga-panel-collapsed" ) ? "collapsed" : "expanded";
        ga.panel.ui[ module ][ panel ] = ui;
        ga.panel.update( module, panel );
        ga.panel.summary( module, panel, ui );
    }

    root
        .off( "click.ga-panel" )
        .on( "click.ga-panel", ".ga-panel-toggle", function() {
            ga.panel.toggle( module, $( this ).data( "ga-panel" ) );
        });
}

ga.panel.toggle = function( module, panel ) {
    var state = ga.panel.state &&
        ga.panel.state[ module ] &&
        ga.panel.state[ module ][ panel ] == "collapsed" ? "expanded" : "collapsed";

    ga.panel.set( module, panel, state );
}

ga.panel.set = function( module, panel, state ) {
    ga.panel.state = ga.panel.state || {};
    ga.panel.state[ module ] = ga.panel.state[ module ] || {};
    ga.panel.state[ module ][ panel ] = state == "collapsed" ? "collapsed" : "expanded";
    if ( ga.panel.ui && ga.panel.ui[ module ] && ga.panel.ui[ module ][ panel ] ) {
        ga.panel.summary( module, panel, ga.panel.ui[ module ][ panel ] );
    }
    ga.panel.update( module, panel );
}

ga.panel.expandForValidation = function( module ) {
    if ( !ga.panel.state || !ga.panel.state[ module ] ) {
        return;
    }

    for ( var panel in ga.panel.state[ module ] ) {
        if ( !Object.prototype.hasOwnProperty.call( ga.panel.state[ module ], panel ) ) {
            continue;
        }
        if ( ga.panel.state[ module ][ panel ] == "collapsed" ) {
            ga.panel.set( module, panel, "expanded" );
        }
    }
}

ga.panel.update = function( module, panel ) {
    var collapsed = ga.panel.state &&
        ga.panel.state[ module ] &&
        ga.panel.state[ module ][ panel ] == "collapsed";
    var root = ga.panel.root( module );
    var button = ga.panel.findId( root, "ga-panel-summary-" + panel ).find( ".ga-panel-toggle" );

    ga.panel.findId( root, "ga-panel-" + panel ).toggleClass( "ga-panel-collapsed", collapsed );
    button.attr( "aria-expanded", collapsed ? "false" : "true" );
    button.find( ".ga-panel-toggle-icon" ).text( collapsed ? "[+]" : "[-]" );
}

ga.panel.summary = function( module, panel, ui ) {
    var summary = [];

    if ( ui.summary_fields && ui.summary_fields.length ) {
        for ( var i = 0; i < ui.summary_fields.length; ++i ) {
            var field = ga.panel.fieldSummary( module, ui.summary_fields[ i ] );
            if ( field ) {
                summary.push( field );
            }
        }
    }

    ga.panel.findId( ga.panel.root( module ), "ga-panel-summary-text-" + panel ).text( summary.length ? summary.join( " | " ) : "" );
}

ga.panel.fieldSummary = function( module, field ) {
    var meta = ga.layout &&
        ga.layout.module &&
        ga.layout.module.name &&
        ga.layout.modules &&
        ga.layout.modules[ ga.layout.module.name ] &&
        ga.layout.modules[ ga.layout.module.name ].json ?
        ga.layout.modules[ ga.layout.module.name ].json[ field ] : null;
    var label = meta && meta.label ? meta.label : field;
    var input = ga.panel.findId( $( "#" + module ), field );
    var value = "";

    if ( !input.length ) {
        return "";
    }

    if ( input.is( ":password" ) ) {
        value = input.val() ? "[set]" : "";
    } else if ( input.is( ":checkbox" ) ) {
        value = input.prop( "checked" ) ? "yes" : "no";
    } else if ( input.is( ":file" ) ) {
        value = input.val().replace( /^C:\\fakepath\\/i, "" );
    } else {
        value = input.val();
    }

    if ( value === undefined || value === null || value === "" ) {
        return "";
    }

    return label + ": " + value;
}
