/*jslint white: true, plusplus: true*/
/* assumes: jquery > 1.11.0, jqtree >= 3.0.9, jquery-base64 */

ga.msg              = {};

ga.msg.box = function( m, force, mnum ) {
   mnum = mnum || 3;
    __~debug:msgbox{console.log( 'ga.msg.box() mnum:' + mnum );}

   if ( !force )
   {
      if ( $( ".modalDialog" + mnum ).hasClass( "modalDialog" + mnum + "_on" ) )
      {
          var ws = $( "#_state" ).data( "__msgs" );
          if ( !ws || (ws && ( Object.prototype.toString.call( ws ) != '[object Array]' ) ) )
          {
             ws = [];
          }
          ws.push( m );
          $( "#_state" ).data( "__msgs",  ws );
          return;
      }
   }
   if ( m.icon )
   {
      $( "#configbody" + mnum ).html( "<table style='width:95%;vertical-align:middle'><tr><td style='width:10%'><img src='pngs/" + m.icon + "' width=40px></td><td style='text-align:center'>" + m.text + "</td></tr></table>" );
   } else {
      $( "#configbody" + mnum ).html( "<center>" + m.text + "</center>" );
   }

   if ( m.noclose ) {
       if ( $( "#closeModal" + mnum ).hasClass( "modalClose" ) ) {
           $( "#closeModal" + mnum ).removeClass( "modalClose" ).empty();
       }
   } else {
       if ( mnum < 4 &&
            !$( "#closeModal" + mnum ).hasClass( "modalClose" ) ) {
           $( "#closeModal" + mnum ).addClass( "modalClose" ).html( "X" );
       }
   }

   if ( m.buttons ) {
      tmp = "<center><table><tr>";
      for ( i = 0; i < m.buttons.length; i++ ) {
          if ( m.buttons[ i ].help ) {
              tmp = tmp + '<td><button id="_mbb_' + m.buttons[ i ].id + '" class="help_link">' + m.buttons[ i ].label + '</button><span class="help">' + m.buttons[ i ].help + '</span></td>';
          } else {
              tmp = tmp + '<td><button id="_mbb_' + m.buttons[ i ].id + '">' + m.buttons[ i ].label + '</button></td>';
          }
      }
      tmp = tmp + "</tr></table><center>";
       __~debug:msgbox{console.log( 'm buttons' + tmp );}
      $( "#configbody" + mnum ).append( tmp );
      for ( i = 0; i < m.buttons.length; i++ ) {
          if ( m.buttons[ i ].cb ) {
              if ( m.buttons[ i ].adata ) {
                  switch( m.buttons[ i ].adata.length ) {
                  case 2 :
                      if ( m.closeif ) {
                          $( "#_mbb_" + m.buttons[ i ].id ).off().on( "click" , m.buttons[ i ], function( event ) { if ( event.data.cb( event.data.adata[ 0 ], event.data.adata[ 1 ] ) ) { ga.msg.close( mnum ); } } );
                      } else {
                          $( "#_mbb_" + m.buttons[ i ].id ).off().one( "click" , m.buttons[ i ], function( event ) { event.data.cb( event.data.adata[ 0 ], event.data.adata[ 1 ] ); ga.msg.close( mnum ); } );
                      }
                      break;
                  case 3 :
                      if ( m.closeif ) {
                          $( "#_mbb_" + m.buttons[ i ].id ).off().on( "click" , m.buttons[ i ], function( event ) { if ( event.data.cb( event.data.adata[ 0 ], event.data.adata[ 1 ], event.data.adata[ 2 ] ) ) { ga.msg.close( mnum ); } } );
                      } else {
                          $( "#_mbb_" + m.buttons[ i ].id ).off().one( "click" , m.buttons[ i ], function( event ) { event.data.cb( event.data.adata[ 0 ], event.data.adata[ 1 ],  event.data.adata[ 2 ]  ); ga.msg.close( mnum ); } );
                      }
                      break;
                  case 4 :
                      $( "#_mbb_" + m.buttons[ i ].id ).off().one( "click" , m.buttons[ i ], function( event ) { event.data.cb( event.data.adata[ 0 ], event.data.adata[ 1 ],  event.data.adata[ 2 ], event.data.adata[ 3 ] ); ga.msg.close( mnum ); } );
                      break;
                  case 5 :
                      $( "#_mbb_" + m.buttons[ i ].id ).off().one( "click" , m.buttons[ i ], function( event ) { event.data.cb( event.data.adata[ 0 ], event.data.adata[ 1 ],  event.data.adata[ 2 ], event.data.adata[ 3 ],  event.data.adata[ 4 ] ); ga.msg.close( mnum ); } )
                      break;
                  case 6 :
                      $( "#_mbb_" + m.buttons[ i ].id ).off().one( "click" , m.buttons[ i ], function( event ) { event.data.cb( event.data.adata[ 0 ], event.data.adata[ 1 ],  event.data.adata[ 2 ], event.data.adata[ 3 ],  event.data.adata[ 4 ], event.data.adata[ 5 ] ); ga.msg.close( mnum ); } )
                      break;
                  default : 
                      console.warn( "in ga.msg.box unsupported number of adata arguments " + m.buttons[ i ].adata.length )
                      break;
                  }
              } else {
                  $( "#_mbb_" + m.buttons[ i ].id ).off().one( "click" , m.buttons[ i ], function( event ) { __~debug:fc{console.log( "you callback clicked " + event.data.label );} event.data.cb( event.data.data ); ga.msg.close( mnum ); } );
              }
          } else {
              $( "#_mbb_" + m.buttons[ i ].id ).off().one( "click" , m.buttons[ i ], function( event ) { __~debug:fc{console.log( "you clicked " + event.data.label );} ga.msg.close( mnum ); } );
          }
      }
   }      
   if ( m.ptext ) {
      $( "#configbody" + mnum ).append( m.ptext );
   }
   if ( m.eval ) {
      eval( m.eval );
   }
   ga.repeats.save();
   ga.hhelp.reset();
   $( ".modalDialog" + mnum ).addClass( "modalDialog" + mnum + "_on" );
}

ga.msg.close1 = function() {
   ga.repeats.restore();
   $( ".modalDialog" ).removeClass( "modalDialog_on" );
   setTimeout(function(){
       $( "#configbody" ).empty();
   }, 400);
   if ( ga.usesplash ) {
       setTimeout(function() { splashlogin() }, 500 );
   }
}

ga.msg.close2 = function() {
   ga.repeats.restore();
   $( ".modalDialog2" ).removeClass( "modalDialog2_on" );
   $( "#configbody2" ).empty();
//   setTimeout(function(){
//       $( "#configbody2" ).empty();
//   }, 400);
   if ( ga.usesplash ) {
       setTimeout(function() { splashlogin() }, 500 );
   }
}

ga.msg.close3 = function() {
   ga.repeats.restore();
   $( ".modalDialog3" ).removeClass( "modalDialog3_on" );
   $( "#configbody3" ).empty();
   var ws = $( "#_state" ).data( "__msgs" );
   if ( ws && ws.length )
   {
       __~debug:msg{console.log( "popping message" );}
       var m = ws.shift();
       $( "#_state" ).data( "__msgs", ws );
       ga.msg.box( m, 1 );
   }
   if ( ga.usesplash ) {
       setTimeout(function() { splashlogin() }, 500 );
   }
}

ga.msg.close4 = function() {
    ga.repeats.restore();
    $( ".modalDialog4" ).removeClass( "modalDialog4_on" );
    $( "#configbody4" ).empty();
    if ( ga.frontpageurl && !ga.apprun ) {
        ga.frontpage( ga.frontpageurl ); 
    } else  { 
        ga.apprun = 0;
        if ( ga.usesplash ) {
            setTimeout(function() { splashlogin() }, 500 );
        }
    }
}

ga.msg.close = function( mnum ) {
    __~debug:msgbox{console.log( 'ga.msg.close() mnum:' + mnum );}
    switch( mnum ) {
        case 1 : ga.msg.close1(); break;
        case 2 : ga.msg.close2(); break;
        case 3 : ga.msg.close3(); break;
        case 4 : ga.msg.close4(); break;
        default : console_warn( "ga.msg.close called with unknown modal number " + mnum ); break;
    }
}

ga.msg.clicks = function() {
    __~debug:msgbox{console.log( 'ga.msg.clicks()' );}
    $( "#closeModal" ).click( function() {
        ga.msg.close( 1 );
    });

    $( "#closeModal2" ).click( function() {
        ga.msg.close( 2 );
    });

    $( "#closeModal3" ).click( function() {
        ga.msg.close( 3 );
    });

    $( "#closeModal4" ).click( function() {
        ga.msg.close( 4 );
    });
}
