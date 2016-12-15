/*jslint white: true, plusplus: true*/
/* assumes: jquery > 1.11.0, jqtree >= 3.0.9, jquery-base64 */

ga.altfile = function( module, idfile, idref ) {
__~debug:altfile{   console.log( "ga.altfile( " + module + " , " + idfile + " , " + idref + ")" );}
    ga.altfile.data[ module ] = ga.altfile.data[ module ] || {};
    ga.altfile.data[ module ][ idfile ] = idref;
};

ga.altfile.data  = {};
ga.altfile.bdata = {};

ga.altfile.list = function( module ) {
    var i;
    if ( !ga.altfile.data[ module ] ) {
        console.log( "module:" + module + " Empty" );
        return;
    }

    for ( i in ga.altfile.data[ module ] ) {
        console.log( "module:" + module + " idfile:" + i + " idref:" + ga.altfile.data[ module ][ i ] );
    }
};

ga.altfile.listall = function() {
    var i;
    if ( !ga.altfile.data ) {
        console.log( "ga.altfile:no modules" );
        return;
    }

    for ( i in ga.altfile.data ) {
        ga.altfile.list( i );
    }
};
    
ga.altfile.test = function() {
  ga.altfile( "module1", "field1", "ref1" );
   ga.altfile( "module1", "field2", "ref2" );
   ga.altfile( "module2", "field3", "ref3" );
   ga.altfile.listall();
};

ga.altfile.add = function( module ) {
   var i,
       add = "",
       ms = "#" + module;
__~debug:altfile{   console.log( "ga.altfile.add:" + module );}

   $( ms + " ._hidden_altfiles" ).remove();
   $( ms + " ._hidden_buttonvals" ).remove();

   if ( ga.altfile.data[ module ] ) {
      for ( i in ga.altfile.data[ module ] ) {
__~debug:altfile{         console.log( "module:" + module + " idfile:" + i + " idref:" + ga.altfile.data[ module ][ i ] );}
         add += '<input type="hidden" name="_selaltval_' + i + '" value="' + ga.altfile.data[ module ][ i ] + '" class="_hidden_altfiles">';
      }
   }

   if ( ga.altfile.bdata[ module ] ) {
      for ( i in ga.altfile.bdata[ module ] ) {
__~debug:altfile{         console.log( "button module:" + module + " id:" + i + " val:" + ga.altfile.bdata[ module ][ i ].val );}
         add += '<input type="hidden" name="' + i + '" value="' + ga.altfile.bdata[ module ][ i ].val + '" class="_hidden_buttonvals">';
      }
   }
__~debug:altfile{   console.log( "add: " + add );}
   if ( add.length ) {
      $( ms ).append( add );
   }
};

ga.altfile.button = function( module, id, text, call, cb, required ) {
__~debug:altfile{   console.log( "ga.altfile.button registered module:" + module + " id:" + id + " call:" + call + " req " + required );}
   ga.altfile.bdata[ module ] = ga.altfile.bdata[ module ] || {};
   ga.altfile.bdata[ module ][ id ] = {};
   ga.altfile.bdata[ module ][ id ].val = {};
   ga.altfile.bdata[ module ][ id ].text = text;
   ga.altfile.bdata[ module ][ id ].call = call;  // the name of the sys module to call
   ga.altfile.bdata[ module ][ id ].cb = cb;      // the callback called upon 'submit' cb of the module
   ga.altfile.bdata[ module ][ id ].req = required || 0;
}

ga.altfile.button.value = function( module, id, val ) {
__~debug:altfile{   console.log( "ga.altfile.button.value  module:" + module + " id:" + id + " val:" + val );}
   ga.altfile.bdata[ module ][ id ].val = val;
}

ga.altfile.button.call = function( module, id ) {
   var tmp;
__~debug:altfile{   console.log( "ga.altfile.button.call  module:" + module + " id:" + id + " load:" + "etc/" + ga.altfile.bdata[ module ][ id ].call + ".html" );}
   if ( ga.altfile.bdata[ module ][ id ].call.length ) {
       tmp = $( '#_state' ).data( '_logon' );
       if ( !tmp || !tmp.length ) {
           messagebox( {
               icon : "warning.png",
               text : "You must login to browse server information",
               buttons : [
                 { id    : "ok",
                   label : "OK" } ]
            });
       } else {
          $( "#configbody" ).load( "etc/" + ga.altfile.bdata[ module ][ id ].call + ".html", function() {
// ok, this is saving the last call back, but modals are singleton, so it *should* be ok
              ga.altfile.bdata[ ga.altfile.bdata[ module ][ id ].call ] = {};
              ga.altfile.bdata[ ga.altfile.bdata[ module ][ id ].call ].cb = ga.altfile.bdata[ module ][ id ].cb;
__~debug:altfile{              console.log( "load complete, now set #" + ga.altfile.bdata[ module ][ id ].call + "text to value " +  ga.altfile.bdata[ module ][ id ].text );}
              $( "#" + ga.altfile.bdata[ module ][ id ].call + "text_label" ).text( ga.altfile.bdata[ module ][ id ].text );
          });
          ga.repeats.save();
          $( ".modalDialog" ).addClass( "modalDialog_on" );
       }
   } else {
     ga.altfile.bdata[ module ][ id ].cb("cb");
   }
   return false;
}

ga.altfile.button.simplecall = function( module, id ) {
    var tmp;
    __~debug:altfile{console.log( "ga.altfile.button.simplecall( " + module + " , " + id + " ) load:" + "ajax/" + module + "/" + id + ".html" );}
    $( "#configbody" ).load( "ajax/" + module + "/" + id + ".html", function() {
        __~debug:altfile{console.log( "ga.altfile.button.simplecall() callback\n" );}
    });
    ga.repeats.save();
    $( ".modalDialog" ).addClass( "modalDialog_on" );
    return false;
}

ga.altfile.button.cb = function() {
__~debug:altfile{   console.log( "ga.altfile.button.cb" );}
    closeModal();
}

ga.altfile.button.lrfile = function( treeid, module, id ) {
  var r      = [],
      hmod   = "#" + module,
      hid    = "#" + id,
      add    = "",
      hclass = "_hidden_lrfile_sels_" + id;

__~debug:altfile{  console.log( "ga.altfile.button.lrfile treeid " + treeid + " module " + hmod + " id " + hid + " hclass " + hclass );}
  $( hmod + " ." + hclass ).remove();
  $.each( $(treeid).jstree("get_checked", true), function() {
__~debug:altfile{  console.log( "ga.altfile.button.lrfile() .each this.id " + this.id + " decoded " + $.base64.decode( this.id ) + " this.children.length " + this.children.length );}
     if ( !this.children.length ) {
       add += '<input type="hidden" name="' + id + '_altval[]" value="' + this.id + '" class="' + hclass + '">';
         r.push( $.base64.decode( this.id ).substr( 2 ) );
     }
  });

  if ( r.length ) {
__~debug:altfile{     console.log( "filename:" + r ); }      
     $( hid + "_altval").html( "<i>Server</i>: " + r );
     $( hid + "_msg").html( "" );
     $( hid ).val("");
     $( hmod ).append( add );
__~debug:altfile{     console.log( "added: " + add );}
      if (ga.value.input[module] && ga.value.input[ module ][id])
      {
	  var mode = ga.value.input[ module ][id].mode;
	  var ids  = ga.value.input[ module ][id].ids;
	  ga.value.setInputfromRFile(r, mode, ids);
      }

  }
}
   
ga.altfile.button.rpath = function( treeid, module, id ) {
  var r      = [],
      hmod   = "#" + module,
      hid    = "#" + id,
      add    = "",
      hclass = "_hidden_rpath_sels_" + id,
      s      = $(treeid).jstree(true);

__~debug:altfile{  console.log( "ga.altfile.button.rpath treeid " + treeid + " module " + hmod + " id " + hid + " hclass " + hclass );}
  $( hmod + " ." + hclass ).remove();
  $.each( s.get_top_checked(true), function() {
 __~debug:altfile{  console.log( "ga.altfile.button.rpath() .each this.id " + this.id + " decoded " + $.base64.decode( this.id ) + " s.is_leaf(this) " + s.is_leaf(this) );}
     if ( !s.is_leaf( this ) ) {
       add += '<input type="hidden" name="' + id + '[]" value="' + this.id + '" class="' + hclass + '">' +
              '<input type="hidden" name="_decodepath_' + id + '" class="' + hclass + '">';
       r.push( $.base64.decode( this.id ).substr( 2 ) );
     }
  });

  if ( r.length ) {
     $( hid + "_altval").html( "<i>Server</i>: " + r );
     $( hid + "_msg").html( "" );
     $( hid ).val("");
     $( hmod ).append( add );
__~debug:altfile{     console.log( "added: " + add );}
  }
}

ga.altfile.button.rfile = function( treeid, module, id ) {
  var r      = [],
      hmod   = "#" + module,
      hid    = "#" + id,
      add    = "",
      hclass = "_hidden_rfile_sels_" + id,
      s      = $(treeid).jstree(true);

__~debug:altfile{  console.log( "ga.altfile.button.rfile treeid " + treeid + " module " + hmod + " id " + hid + " hclass " + hclass );}
  $( hmod + " ." + hclass ).remove();
  $.each( $(treeid).jstree("get_checked", true), function() {
__~debug:altfile{  console.log( "ga.altfile.button.rfile() .each this.id " + this.id + " decoded " + $.base64.decode( this.id ) + " this.children.length " + this.children.length );}
     if ( !this.children.length ) {
       add += '<input type="hidden" name="' + id + '_altval[]" value="' + this.id + '" class="' + hclass + '">';
       r.push( $.base64.decode( this.id ).substr( 2 ) );
     }
  });

  if ( r.length ) {
     $( hid + "_altval").html( "<i>Server</i>: " + r );
     $( hid + "_msg").html( "" );
     $( hid ).val("");
     $( hmod ).append( add );
__~debug:altfile{     console.log( "added: " + add );}
      if (ga.value.input[module] && ga.value.input[ module ][id])
      {
	  var mode = ga.value.input[ module ][id].mode;
	  var ids  = ga.value.input[ module ][id].ids;
	  ga.value.setInputfromRFile(r, mode, ids);
      }
  }
}

ga.altfile.button.job = function( treeid, module, id ) {
  var r      = "",
      hmod   = "#" + module,
      hid    = "#" + id,
      add    = "",
      hclass = "_hidden_job_sels_" + id,
      s      = $(treeid).jstree(true);

__~debug:altfile{  console.log( "ga.altfile.button.job treeid " + treeid + " module " + hmod + " id " + hid + " hclass " + hclass );}
  $( hmod + " ." + hclass ).remove();
  $.each( $(treeid).jstree("get_checked", true), function() {
__~debug:altfile{  console.log( "ga.altfile.button.job() .each this.id " + this.id + " this.children.length " + this.children.length );}
     if ( !this.children.length ) {
       add += '<input type="hidden" name="' + id + '_altval[]" value="' + this.id + '" class="' + hclass + '">';
       r+="<tr><td>" + this.parent +":" + this.text + "</td></tr>";
     }
  });

  if ( r.length ) {
     $( hid + "_altval").html( "<table>" + r + "</table>" );
     $( hid + "_msg").html( "" );
     $( hid ).val("");
     $( hmod ).append( add );
__~debug:altfile{     console.log( "added: " + add );}
  }
}

// ga.altfile.test();

ga.altfile.button.getnames = function( id, type ) {
    var r = [];
    switch( type ) {
    case "rpath" :
        r.push( id + '[]' );
        // r.push( '_decodepath_' + id );
        break;
    case "rfile" :
        r.push( id + '_altval[]' );
        break;
    case "lrfile" :
        id = id.replace( /_button$/, "" );
        r.push( id + '_altval[]' );
        break;
    default :
        console.warn( "ga.altfile.button.getnames( " + id + " , " + type + " )" );
        break;
    }
    return r;
}

ga.altfile.button.getnamesinput = function( id, type ) {
    var r = [];
    switch( type ) {
    case "rpath" :
        r.push( id );
        // r.push( '_decodepath_' + id );
        break;
    case "rfile" :
        r.push( id + '_altval' );
        break;
    case "lrfile" :
        id = id.replace( /_button$/, "" );
        r.push( id + '_altval' );
        break;
    default :
        console.warn( "ga.altfile.button.getnames( " + id + " , " + type + " )" );
        break;
    }
    return r;
}


// this should probably be moved to load and not added at the end
ga.altfile.button.addhtml = function( mod, id, type, vals ) {
    var add = "",
        hclass;

    __~debug:altfile{console.log( "ga.altfile.button.addhtml( " + mod + " , " + id + " , " + type + " , " + vals[ 0 ] + " ) " );}
    __~debug:valuen{console.log( "ga.altfile.button.addhtml( " + mod + " , " + id + " , " + type + " , " + vals[ 0 ] + " ) " );}

    switch( type ) {
    case "rpath" :
        hclass = "_hidden_rpath_sels_" + id;
        add += '<input type="hidden" name="' + id + '[]" value="' + vals[ 0 ] + '" class="' + hclass + '">' +
               '<input type="hidden" name="_decodepath_' + id + '" class="' + hclass + '">';
        break;
    case "rfile" :
        hclass = "_hidden_rfile_sels_" + id,
        add += '<input type="hidden" name="' + id + '_altval[]" value="' + vals[ 0 ] + '" class="' + hclass + '">';
        break;
    case "lrfile" :
        id = id.replace( /_button$/, "" );
        hclass = "_hidden_lrfile_sels_" + id;
        add += '<input type="hidden" name="' + id + '_altval[]" value="' + vals[ 0 ] + '" class="' + hclass + '">';
        break;
    default :
        console.warn( "ga.altfile.button.getnames( " + id + " , " + type + " )" );
        break;
    }
    $( "#" + mod ).append( add );
    __~debug:altfile{console.log( "ga.altfile.button.addhtml() add " + add );}
    __~debug:valuen{console.log( "ga.altfile.button.addhtml() add " + add );}
}

