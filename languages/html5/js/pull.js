/*jslint white: true, plusplus: true*/
/* assumes: jquery > 1.11.0, jqtree >= 3.0.9, jquery-base64 */

ga.pull = {};

ga.pull.clearPull = function( repeater ) {
   if ( !repeater || typeof( repeater ) != "string" || repeater.length == 0 || repeater == "#__fields:repeat__" )
   {
      repeater = "";
   }
__~debug:pull{   console.log( "ga.pull.clearPull( " + repeater + " )" );}
   $( "#global_data" ).data( "_pull_json"   + repeater, {} );
   $( "#global_data" ).data( "_pull_update" + repeater, {} );
   $( "#global_data" ).data( "_pull_type"   + repeater, {} );
}

ga.pull.toPull = function( pkg, tag, type, pulltag, repeater ) {
__~debug:pull{   console.log( "ga.pull.toPull( " + pkg + " , " + tag + " , " + type + " , " + pulltag + " , " + repeater + " )" );}
   if ( !repeater || typeof( repeater ) != "string" || repeater.length == 0 || repeater == "#__fields:repeat__" )
   {
      repeater = "";
   }
__~debug:pull{   console.log( "ga.pull.clearPull() topull repeater " + repeater );}
   var gd = $( "#global_data" );
   var tj = gd.data( "_pull_json"   + repeater ) || {};
   var tu = gd.data( "_pull_update" + repeater ) || {};
// for now, just set to 0
   tj[ pulltag ] = 0;
   if ( typeof( tu[ pulltag ] ) != "object" )
   {
      tu[ pulltag ] = {};
   }
__~debug:pull{   console.log( "ga.pull.clearPull() toPull tu before set:" );}
__~debug:pull{   console.log( tu );}
   tu[ pulltag ][ tag ] = type;
__~debug:pull{   console.log( "ga.pull.clearPull() topull tag " + tag );}
   gd.data( "_pull_json"   + repeater, tj );
   gd.data( "_pull_update" + repeater, tu );
__~debug:pull{   console.log( "ga.pull.clearPull() tj: " + tj );}
__~debug:pull{   console.log( "ga.pull.clearPull() tu: " + tu );}
}

ga.pull.doPull = function( repeater ) {
   if ( !repeater || typeof( repeater ) != "string" || repeater.length == 0 || repeater == "#__fields:repeat__" )
   {
      repeater = "";
   }
__~debug:pull{   console.log( "ga.pull.doPull( " + repeater + ")");}
   var gd = $( "#global_data" );
   var s = $( '#_state' );
   var l = s.data( '_logon' );
   if ( l && l.length )
   {
      var tj = gd.data( "_pull_json" + repeater );
      tj[ "_window" ] = window.name;
      tj[ '_logon' ] = l;
__~debug:pull{   console.log( "ga.pull.doPull() tj:" + tj );}
      if ( Object.size( tj ) > 2 )
      {
__~debug:pull{      console.log( "ga.pull.doPull(): has size" );}
         $.getJSON( "ajax/sys_config/sys_pull.php", tj )
         .done( function( data, status, xhr ) {
__~debug:pull{    console.log( "ga.pull.doPull(): ajax done data:" );}
__~debug:pull{    console.log( data );}
            var tu = gd.data( "_pull_update" + repeater );
            $.each(data, function(k, v) {
__~debug:pull{    console.log( "ga.pull.doPull(): " + k + " => " + v );}
__~debug:pull{    console.log( "ga.pull.doPull(): typeof tu[k] " + typeof( tu[ k ] ) );}
               if ( typeof( tu[ k ] ) == "object" )
               {
                  $.each( tu[ k ], function( k2, v2 ) {
__~debug:pull{    console.log( "ga.pull.doPull(): in tu[k]:" + k2 + " => " + v2 );}
                     var t = $( k2 );
                     switch( v2 )
                     {
                        case "checkbox" : 
                         t.prop( "checked", v == "on" ); break;
                        case "text" : 
                         if( t.attr( "data-type" ) == "color" ) {
                             __~debug:spectrum{console.log( "got data-color" );}
                             ga.color.spectrum.val( k2, v );
                         }
                        case "email" : 
                        case "text" : 
                        case "integer" : 
                        case "float" : 
                         t.val( v ); break;
                        case "listbox" : 
                         t.empty();
// setup html for results
__~debug:pull{   console.log( "ga.pull.doPull(): listbox pull'd " + typeof( v ) ); }
__~debug:pull{   console.log( v ); }
                         $.each( v, function( k3, v3 ) {
__~debug:pull{   console.log( "ga.pull.doPull(): listbox append " + v3 ); }
                           t.append($("<option></option>").attr( "value", v3 ).text( v3 ) );
                         });
                         break;
                        case "label" : 
__~debug:pull{   console.log( "ga.pull.doPull(): label for " + k2 ); }
                         t.html( v );
                         break;
                        default : 
                         console.log( "ga.pull.doPull(): not yet" );
                     }
                  });
               }
            });
         })
         .fail( function( xhr, status, errorThrown ) {
__~debug:pull{    console.log( "ga.pull.doPull(): ajax fail" );}
         });
      } else {
__~debug:pull{      console.log( "ga.pull.doPull(): doPull t has NO size" );}
      }
   }
}
