/*jslint white: true, plusplus: true*/
/* assumes: jquery > 1.11.0, jqtree >= 3.0.9, jquery-base64 */

ga.msg              = {};

ga.msg.box = function( m, force, mnum ) {
   mnum = mnum || 3;

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

   if ( m.buttons ) {
      tmp = "<center><table><tr>";
      for ( i = 0; i < m.buttons.length; i++ ) {
          tmp = tmp + '<td><button id="_mbb_' + m.buttons[ i ].id + '">' + m.buttons[ i ].label + '</button></td>';
      }
      tmp = tmp + "</tr></table><center>";
       __~debug:mb{console.log( 'm buttons' + tmp );}
      $( "#configbody" + mnum ).append( tmp );
      for ( i = 0; i < m.buttons.length; i++ ) {
          if ( m.buttons[ i ].cb ) {
              if ( m.buttons[ i ].adata ) {
                  switch( m.buttons[ i ].adata.length ) {
                  case 2 :
                      $( "#_mbb_" + m.buttons[ i ].id ).off().one( "click" , m.buttons[ i ], function( event ) { event.data.cb( event.data.adata[ 0 ], event.data.adata[ 1 ] ); closeaModal( mnum ); } );
                      break;
                  case 3 :
                      $( "#_mbb_" + m.buttons[ i ].id ).off().one( "click" , m.buttons[ i ], function( event ) { event.data.cb( event.data.adata[ 0 ], event.data.adata[ 1 ],  event.data.adata[ 2 ]  ); closeaModal( mnum ); } );
                      break;
                  case 4 :
                      $( "#_mbb_" + m.buttons[ i ].id ).off().one( "click" , m.buttons[ i ], function( event ) { event.data.cb( event.data.adata[ 0 ], event.data.adata[ 1 ],  event.data.adata[ 2 ], event.data.adata[ 3 ] ); closeaModal( mnum ); } );
                      break;
                  case 5 :
                      $( "#_mbb_" + m.buttons[ i ].id ).off().one( "click" , m.buttons[ i ], function( event ) { event.data.cb( event.data.adata[ 0 ], event.data.adata[ 1 ],  event.data.adata[ 2 ], event.data.adata[ 3 ],  event.data.adata[ 4 ] ); closeaModal( mnum ); } )
                      break;
                  case 6 :
                      $( "#_mbb_" + m.buttons[ i ].id ).off().one( "click" , m.buttons[ i ], function( event ) { event.data.cb( event.data.adata[ 0 ], event.data.adata[ 1 ],  event.data.adata[ 2 ], event.data.adata[ 3 ],  event.data.adata[ 4 ], event.data.adata[ 5 ] ); closeaModal( mnum ); } )
                      break;
                  default : 
                      console.warn( "in ga.msg.box unsupported number of adata arguments " + m.buttons[ i ].adata.length )
                      break;
                  }
              } else {
                  $( "#_mbb_" + m.buttons[ i ].id ).off().one( "click" , m.buttons[ i ], function( event ) { __~debug:fc{console.log( "you callback clicked " + event.data.label );} event.data.cb( event.data.data ); closeaModal( mnum ); } );
              }
          } else {
              $( "#_mbb_" + m.buttons[ i ].id ).off().one( "click" , m.buttons[ i ], function( event ) { __~debug:fc{console.log( "you clicked " + event.data.label );} closeaModal( mnum ); } );
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
   $( ".modalDialog" + mnum ).addClass( "modalDialog" + mnum + "_on" );
}

