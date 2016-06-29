/*jslint white: true, plusplus: true*/
/* assumes: ga, jquery > 1.11.0, jqtree >= 3.0.9, jquery-base64 */


ga.event = function ( menu, module, action ) {
__~debug:event{    console.log( "ga.event( " + menu + "," + "module" + "," + action );}
    ga.event.log.push( {
        menu   : menu,
        module : module,
        action : action,
        when   : new Date()
    });
}

ga.event.log = [];

ga.event.list = function() {
    var j=0,
        l = ga.event.log.length,
        now = new Date(),
        result = "Client Date/Time is " + now.toUTCString() + "\n";

__~debug:event{    console.log( "ga.event.list() has " + l + " events:" );}
    for ( ; j < l ; j++ ) {
        result += ga.event.log[ j ].menu + " " + ga.event.log[ j ].module + " " + ga.event.log[ j ].action + " " + ga.event.log[ j ].when.toUTCString() + "\n";
    }

__~debug:event{    console.log( "ga.event.list() result: " + result );}
    return result;
}

    

    


