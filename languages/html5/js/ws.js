/*jslint white: true, plusplus: true*/
/* assumes: jquery > 1.11.0, jqtree >= 3.0.9, jquery-base64 */

ga.ws = {};
ga.ws.subd = [];

// previously defined moved here:
// setMsging() -> ga.ws.set()
// keepalive() -> ga.ws.alive()
// subd_msging[] -> ga.ws.subd[]
// unsubmsging() -> ga.ws.unsub()

ga.ws.set = function() {
    __~debug:ws{console.log( 'ga.ws.set() called' );}
   var ws = $( "#_state" ).data( "_ws" );
   if ( !ws )
   {
      console.log( "ga.ws.set: ws not defined" );
      return;
   }

   var conn = $( '#_state' ).data( "_wssession" );
   if ( conn && conn.isOpen )
   {
      console.log( "ga.ws.set: connection is already open" );
      return;
   }
    
    __~debug:ws{console.log( 'ga.ws.set trying new session' );}
   conn = new ab.Session( ws 
      , function() {            // Once the connection has been established
          $(".wsstatus").css( "color", "green" );
          __~debug:ws{console.log( 'ga.ws.set: connection established' );}
          ga.event( "global", "ws messaging", "connection established" );
          $( '#_state' ).data( "_wssession", conn );
__~debug:ws{          console.log('websocket opened');}
          ga.ws.sub( "keepalive", ga.ws.alive, "keepalive" );
        }
      , function() {            // When the connection is closed
            $(".wsstatus").css( "color", "red" );
          __~debug:ws{console.warn('ga.ws.set connection closed');}
            if ( gd.data( "_unload" ) == 0 ) {
                __~debug:ws{ console.warn('resubing');}
                return ga.ws.set();
            } else {
               console.log( "ws connection closed on unload of page" );
            }
//            {
//              ga.event( "global", "ws messaging", "connection failed" );
//            ga.msg.box( { icon: "toast.png",
//                         text: "WebSocket messaging failed to " + ws + "<p>Your firewall may be blocking external access to port " + ws.replace( /^.*:/g, '') + " or the WebSocket server is down.<p>This results in a crippled experience with no messaging.",
//                         buttons : [ { id : "ok", label : "OK" } ] });
//            }
        }
      , {                       // Additional parameters, we're ignoring the WAMP sub-protocol for older browsers
            'skipSubprotocolCheck': true,
            'maxRetries': 60,
            'retryDelay': 2000
        }
    );

    __~debug:ws{console.log( 'ga.ws.set end' );}
}        

ga.ws.alive = function() {
    __~debug:ws{console.log( "ga.ws.alive received: " + Date().toLocaleString() );}
}

ga.ws.sub = function( vuuid, onevent, moduleid ) {
    __~debug:msg{console.log( "ga.ws.sub: called " + moduleid + " " + vuuid );}
   if ( moduleid in ga.ws.subd )
   {
       __~debug:msg{console.log( "ga.ws.sub: calling ga.ws.unsub for " + moduleid + " " + ga.ws.subd[ moduleid ] );}
      ga.ws.unsub( ga.ws.subd[ moduleid ], moduleid );
   }
    __~debug:msg{console.log( "ga.ws.sub: added to ga.ws.subd: " + moduleid + " " + vuuid );}
   ga.ws.subd[ moduleid ] = vuuid;

   var ws = $( "#_state" ).data( "_ws" );
   if ( !ws )
   {
      console.log( "ga.ws.sub: ws not defined" );
      return;
   }

   var conn = $( '#_state' ).data( "_wssession" );
   if ( !conn )
//   if ( conn && !conn.isOpen )
   {
      console.log( "ga.ws.sub: connection is not open" );
      return;
   }

   conn.subscribe( vuuid, onevent );
// this doesn't work:
// .then( function( subscription ) { $( '#_state' ).data( "_wssub:" + vuuid, subscription ) } );
}

ga.ws.unsub = function( vuuid, moduleid ) {
    __~debug:msg{console.log( "ga.ws.unsub: called " + moduleid + " " + vuuid );}
   if ( moduleid in ga.ws.subd )
   {
       __~debug:msg{console.log( "ga.ws.unsub: found and deleting " + moduleid + " " + ga.ws.subd[ moduleid ] );}
      delete ga.ws.subd[ moduleid ];
   } else {
       __~debug:msg{console.log( "ga.ws.unsub: not found so not unsubscribing" );}
      return;
   }
   var ws = $( "#_state" ).data( "_ws" );
   if ( !ws )
   {
      console.log( "ga.ws.sub: ws not defined" );
      return;
   }

   var conn = $( '#_state' ).data( "_wssession" );
   if ( !conn )
//   if ( conn && !conn.isOpen )
   {
      console.log( "ga.ws.sub: connection is not open" );
      return;
   }

   conn.unsubscribe( vuuid );
   $( '#_state' ).data( "_wssub:" + vuuid, null );
}

ga.ws.generic = function( vuuid, data ) {
   console.log( 'ga.ws.generic ' + vuuid + ' : ' + data.json);
}
