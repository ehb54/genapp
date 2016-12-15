/*jslint white: true, plusplus: true*/
/* assumes: jquery > 1.11.0, jqtree >= 3.0.9, jquery-base64 */

var ga = {};
ga.tmp = {};

ga.fielderrors = 0;

// extend jstree for singleselect & conditional select plugins:

(function ($, undefined) {
  "use strict";
  $.jstree.defaults.conditionalselect = function () { return true; };
  $.jstree.plugins.conditionalselect = function (options, parent) {
    this.activate_node = function (obj, e) {
      if(this.settings.conditionalselect.call(this, this.get_node(obj))) {
        parent.activate_node.call(this, obj, e);
      }
    };
  };
  $.jstree.plugins.singleselect = function (options, parent) {
    this.activate_node = function (obj, e) {
      if(this.is_leaf( obj )) {
        parent.activate_node.call(this, obj, e);
      }
    };
  };
  $.jstree.plugins.selectonlyleaf = function (options, parent) {
    this.activate_node = function (obj, e) {
      if(this.is_leaf( obj )) {
        parent.activate_node.call(this, obj, e);
      }
    };
  };
  $.jstree.plugins.singleselectpath = function (options, parent) {
    this.activate_node = function (obj, e) {
      if(!this.is_leaf( obj )) {
        parent.activate_node.call(this, obj, e);
      }
    };
  };
  $.jstree.plugins.selectnoleaf = function (options, parent) {
    this.activate_node = function (obj, e) {
      if(!this.is_leaf( obj )) {
        parent.activate_node.call(this, obj, e);
      }
    };
  };
  $.jstree.defaults.sort = function (a,b) {
      return this.get_node( a ).data.time < this.get_node( b ).data.time ? 1 : -1;
  };
})(jQuery);

RegExp.quote = function(str) {
   return str.replace(/([.?*+^$[\]\\(){}|-])/g, "\\$1");
};

Object.size = function(obj) {
__~debug:pull{   console.log( "object.size called" )}
    var size = 0, key;
    for (key in obj) {
        if (obj.hasOwnProperty(key)) size++;
    }
__~debug:pull{   console.log( "object.size size " + size )}
    return size;
};


ga.set = function( param, value ) {
    if ( value ) {
        ga.set.data[ param ] = value;
    }
    return ga.set.data[ param ];
}

ga.set.data = {};

ga.restricted = {};

ga.restricted.add = function( group, menu ) {
    __~debug:restricted{console.log( "ga.restricted.add( " + group + " , " + menu + " )" );}
    ga.restricted.ids[ group ] = ga.restricted.ids[ group ] || []; 
    ga.restricted.ids[ group ].push( menu );
}

ga.restricted.hideall = function() {
    var i;
    __~debug:restricted{console.log( "ga.restricted.hideall()" );}
    ga.restricted.data = {};
    for ( i in ga.restricted.ids ) {
        __~debug:restricted{console.log( "ga.restricted.hideall " + ga.restricted.ids[ i ].join() );}
        $( ga.restricted.ids[ i ].join() ).hide();
    }
}

ga.restricted.show = function( restricted ) {
    var i;
    __~debug:restricted{console.log( "ga.restricted.show( " + restricted.join() + " )" );}
    for ( i in restricted ) {
        ga.restricted.data[ restricted[ i ] ] = 1;
        if ( ga.restricted.ids[ restricted[ i ] ] ) {
            $( ga.restricted.ids[ restricted[ i ] ].join() ).show();
        }
    }
}

ga.specproj = function( id,  value ) {
    __~debug:specproj{console.log( "ga.specproj( " + id + " , " + value + " )");}
    var t = {};
    t.id = id;
    t.value = value;
    ga.specproj.data.push( t );
}
    
ga.specproj.data = [];

ga.specproj.clear = function() {
    __~debug:specproj{console.log( "ga.specproj.clear" );}
    ga.specproj.data = [];
}

ga.specproj.gname = function() {
    var i, add, name = "", tval;
    __~debug:specproj{console.log( "ga.specproj.name" );}
    
    for ( i in ga.specproj.data ) {
        if ( ga.specproj.data.hasOwnProperty( i ) ) {
            tval = $( ga.specproj.data[ i ].value ).val();
            if ( tval == parseFloat( tval ) ) {
                tval = parseFloat( tval );
            }
            add = ga.specproj.data[ i ].id + tval;
            name += add.replace( /[^A-z0-9.-]+/g, "_" );
            __~debug:specproj{console.log( "ga.specproj.name() add = " + add + " name = " + name );}
        }
    }
    return name;
}
        
ga.urlparams = function( sParam ) {
    var sURLVariables = window.location.search.substring(1).split('&');
    for (var i = 0; i < sURLVariables.length; i++) {
        var sParameterName = sURLVariables[i].split('=');
        if (sParameterName[0] == sParam) {
            return sParameterName[1];
        }
    }
}

ga.frontpage = function( url ) {
    $( 'html' ).load( url );
}

ga.loader = function( jqtag, delay ) {
    __~debug:loader{console.log( "ga.loader( " + delay + " , " + jqtag + " )" );}
    ga.loader.jqtag = jqtag;
    ga.loader.delay = delay;
};

ga.loader.timeout = null;

ga.loader.startshow = function() {
    __~debug:loader{console.log( "ga.loader.startshow tag is " + ga.loader.jqtag );}
    if ( ga.loader.timeout ) {
        clearTimeout( ga.loader.timeout );
        ga.loader.timeout = null;
        $( ga.loader.jqtag ).show();
    } else {
        __~debug:loader{console.log( "ga.loader.startshow hiding" );}
        $( ga.loader.jqtag ).hide();
    }
}

ga.loader.hide = function() {
    __~debug:loader{console.log( "ga.loader.hide tag is " + ga.loader.jqtag );}
    if ( ga.loader.timeout ) {
        clearTimeout( ga.loader.timeout );
        ga.loader.timeout = null;
    }
    __~debug:loader{console.log( "ga.loader.hide hiding" );}
    $( ga.loader.jqtag ).hide();
}

ga.loader.show = function() {
    __~debug:loader{console.log( "ga.loader.show tag is " + ga.loader.jqtag );}
    if ( ga.loader.timeout ) {
        clearTimeout( ga.loader.timeout );
    }
    ga.loader.timeout = setTimeout( ga.loader.startshow(), ga.loader.delay );
}

ga.menumodules = [];

// group

ga.group = {};

ga.group.set = function( data ) {
    __~debug:group{console.log( "ga.group.set() data is" ); console.dir( data );}
    ga.group.all = data;
}

ga.group.setuser = function( data ) {
    __~debug:group{console.log( "ga.group.setuser() data is" ); console.dir( data );}
    var k;
    ga.group.user = data;
    ga.group.userhas = {};
    for ( k in ga.group.user ) {
        ga.group.userhas[ ga.group.user[ k ] ] = 1;
    }
    ga.group.show();
}

ga.group.inputhtml = function( tag ) {
    __~debug:group{console.log( "ga.group.inputhtml( " + tag + " )" );}
    var result = "",
        k,
        id;

    ga.group.activeids = {};

    if ( !ga.group.all ) {
        return result;
    }

    // loop thru available group and create cbs for each group

    for ( k in ga.group.all ) {
        if ( ga.group.all[k][ "userconfig" ] ) {
            id = "_setgroup_" + tag + "_" + k;
            __~debug:group{console.log( "ga.group.inputhtml() group " + k + " has value " + ga.group.all[k] );}
            result += 
            '<tr><td><label for="' + id + '" class="highlight">'
                + ( ga.group.all[k]["label"] ? ga.group.all[k]["label"] : k )
                + '</label></td><td><input type="checkbox" name="' + id + '" id="' + id + '"'
                + ( ga.group.userhas[k] ? ' checked' : '' )
                + ( ga.group.all[k]["help"] ? ' class="help_link"><span class="help">' + ga.group.all[k]["help"] + '</span' : '' )
                + '></td></tr>'
            ;
            ga.group.activeids[ k ] = id;
        }
    }
    __~debug:group{console.log( "ga.group.inputhtml() result is" + result );}

    return result;
}        

ga.group.addmenu = function( group, menu ) {
    __~debug:group{console.log( "ga.group.addmenu( " + group + " , " + menu + " )" );}
    ga.group.menuids[ group ] = ga.group.menuids[ group ] || []; 
    ga.group.menuids[ group ].push( menu );
}

ga.group.hideall = function() {
    var i;
    __~debug:group{console.log( "ga.group.hideall()" );}
    for ( i in ga.group.menuids ) {
        __~debug:group{console.log( "ga.group.hideall " + ga.group.menuids[ i ].join() );}
        $( ga.group.menuids[ i ].join() ).hide();
    }
}

ga.group.show = function() {
    var i;
    __~debug:group{console.log( "ga.group.show()" );}
    ga.group.hideall();
    for ( i in ga.group.userhas ) {
        __~debug:group{console.log( "ga.group.show() userhas " + i );}
        if ( ga.group.menuids[ i ] ) {
            __~debug:group{console.log( "ga.group.show() menuids exists " + i );}
            $( ga.group.menuids[ i ].join() ).show();
        }
    }
    if ( ga.group.menuids[ "login" ] ) {
        __~debug:group{console.log( "ga.group.show() menuids exists " + "login" );}
        $( ga.group.menuids[ "login" ].join() ).show();
    }
}

ga.browser = function() {
    var sUsrAg = navigator.userAgent;

    ga.browser.type     = "unknown";
    ga.browser.prefix   = "";
    ga.browser.gradient = false;
    ga.browser.clrpkr   = false;

    if(sUsrAg.indexOf("Chrome") > -1) {
        ga.browser.type     = "chrome";
        ga.browser.prefix   = "-webkit-";
        ga.browser.gradient = true;
        ga.browser.clrpkr   = true;
    } else if (sUsrAg.indexOf("Safari") > -1) {
        ga.browser.type = "safari";
        ga.browser.prefix   = "-webkit-";
        ga.browser.gradient = true;
    } else if (sUsrAg.indexOf("Opera") > -1) {
        ga.browser.type = "opera";
        ga.browser.prefix   = "-o-";
        ga.browser.gradient = true;
        ga.browser.clrpkr   = true;
    } else if (sUsrAg.indexOf("Firefox") > -1) {
        ga.browser.type = "mozilla";
        ga.browser.prefix   = "-moz-";
        ga.browser.gradient = true;
        ga.browser.clrpkr   = true;
    } else if (sUsrAg.indexOf("MSIE") > -1) {
        ga.browser.type = "msie";
        ga.browser.prefix   = "";
        ga.browser.gradient = true;
    }
    __~debug:browser{console.log( "ga.browser.type is " + ga.browser.type );}
}

ga.cssrule = {};

ga.cssrule.get = function (ruleName, deleteFlag) {               // Return requested style obejct
   ruleName=ruleName.toLowerCase();                       // Convert test string to lower case.
   if (document.styleSheets) {                            // If browser can play with stylesheets
      for (var i=0; i<document.styleSheets.length; i++) { // For each stylesheet
         var styleSheet=document.styleSheets[i];          // Get the current Stylesheet
         var ii=0;                                        // Initialize subCounter.
         var cssRule=false;                               // Initialize cssRule. 
         do {                                             // For each rule in stylesheet
            if (styleSheet.cssRules) {                    // Browser uses cssRules?
               cssRule = styleSheet.cssRules[ii];         // Yes --Mozilla Style
            } else {                                      // Browser usses rules?
               cssRule = styleSheet.rules[ii];            // Yes IE style. 
            }                                             // End IE check.
            if (cssRule)  {                               // If we found a rule...
               if (cssRule.selectorText &&
                   cssRule.selectorText.toLowerCase()==ruleName) { //  match ruleName?
                  if (deleteFlag=='delete') {             // Yes.  Are we deleteing?
                     if (styleSheet.cssRules) {           // Yes, deleting...
                        styleSheet.deleteRule(ii);        // Delete rule, Moz Style
                     } else {                             // Still deleting.
                        styleSheet.removeRule(ii);        // Delete rule IE style.
                     }                                    // End IE check.
                     return true;                         // return true, class deleted.
                  } else {                                // found and not deleting.
                     return cssRule;                      // return the style object.
                  }                                       // End delete Check
               }                                          // End found rule name
            }                                             // end found cssRule
            ii++;                                         // Increment sub-counter
         } while (cssRule)                                // end While loop
      }                                                   // end For loop
   }                                                      // end styleSheet ability check
   return false;                                          // we found NOTHING!
}                                                         // end getCSSRule 

ga.cssrule.kill = function (ruleName) {                          // Delete a CSS rule   
   return ga.cssrule.get(ruleName,'delete');                  // just call getCSSRule w/delete flag.
}                                                         // end killCSSRule

ga.cssrule.add = function (ruleName) {                           // Create a new css rule
   if (document.styleSheets) {                            // Can browser do styleSheets?
      if (!ga.cssrule.get(ruleName)) {                        // if rule doesn't exist...
         if (document.styleSheets[0].addRule) {           // Browser is IE?
            document.styleSheets[0].addRule(ruleName, null,0);      // Yes, add IE style
         } else {                                         // Browser is IE?
            document.styleSheets[0].insertRule(ruleName+' { }', 0); // Yes, add Moz style.
         }                                                // End browser check
      }                                                   // End already exist check.
   }                                                      // End browser ability check.
   return ga.cssrule.get(ruleName);                           // return rule we just created.
} 

ga.cache = {};

ga.cache.msg = function( cachefound, cachedelete, cb_get_results, cb_do_submit, uuid, $form, airavataresource ) {
    __~debug:cache{console.log( "ga.cache.msg( " + cachefound + " , " + cachedelete + " , cb_get_results , cb_do_sumbit , " + uuid + " , $form , " + airavataresource + " )" );}

    switch( cachefound ) {
    case "notify" : 
        {               
            if ( ga.restricted.data[ cachedelete ] ) {
                messagebox( {
                    icon  : "question.png"
                    ,text  : "Show or clear previously computed results."
                    ,buttons : [
                        { 
                            id    : "showcached"
                            ,label : "Show previously computed results"
                            ,cb    : cb_get_results
                            ,adata  : [ uuid, 0, 1, 1 ]
                        }
                        ,{ 
                            id    : "clear"
                            ,label : "Clear cached result"
                            ,cb    : ga.cache.clear
                            ,adata  : [ uuid, cachedelete ]
                        }
                        ,{
                            id    : "cancel",
                            label : "Cancel"
                        }
                    ]
                } );
                return;
            } else {
                messagebox( { icon:"information.png", text:"Showing previously computed results." } );
            }
        }
        break;
    case "askrecompute" : 
        if ( ga.restricted.data[ cachedelete ] ) {
            messagebox( {
                icon  : "question.png"
                ,text  : "Previously computed results are available."
                ,buttons : [
                    { 
                        id    : "showcached"
                        ,label : "Show previously computed results"
                        ,cb    : cb_get_results
                        ,adata  : [ uuid, 0, 1, 1 ]
                    }
                    ,{ 
                        id    : "recompute"
                        ,label : "Recompute results"
                        ,cb    : cb_do_submit
                        ,adata  : [ $form, airavataresource, 1 ]
                    }
                    ,{ 
                        id    : "clear"
                        ,label : "Clear cached result"
                        ,cb    : ga.cache.clear
                        ,adata  : [ uuid, cachedelete ]
                    }
                    ,{
                        id    : "cancel",
                        label : "Cancel"
                    }
                ]
            } );
        } else {
            messagebox( {
                icon  : "question.png"
                ,text  : "Previously computed results are available."
                ,buttons : [
                    { id    : "showcached"
                      ,label : "Show previously computed results"
                      ,cb    : cb_get_results
                      ,adata  : [ uuid, 0, 1, 1 ]
                    }
                    ,{ id    : "recompute"
                       ,label : "Recompute results"
                       ,cb    : cb_do_submit
                       ,adata  : [ $form, airavataresource, 1 ]
                     }
                    ,{ id    : "cancel",
                       label : "Cancel"
                     }
                ]
            } );
        }
        return;
        break;
    default: 
        {               
            if ( ga.restricted.data[ cachedelete ] ) {
                messagebox( {
                    icon  : "question.png"
                    ,text  : "Show or clear previously computed results."
                    ,buttons : [
                        { 
                            id    : "showcached"
                            ,label : "Show previously computed results"
                            ,cb    : cb_get_results
                            ,adata  : [ uuid, 0, 1, 1 ]
                        }
                        ,{ 
                            id    : "clear"
                            ,label : "Clear cached result"
                            ,cb    : ga.cache.clear
                            ,adata  : [ uuid, cachedelete ]
                        }
                        ,{
                            id    : "cancel",
                            label : "Cancel"
                        }
                    ]
                } );
                return;
            }
        }
        break;
    }
    cb_get_results( uuid, 0, 1, 1 );
    return;
}
        
ga.cache.clear = function( uuid, cachedelete ) {
    __~debug:cache{ console.log( "ga.cache.clear( " + uuid + " , " + cachedelete + " )" );}
    // maybe messagebox to confirm delete of cached results
    messagebox( {
        icon  : "admin.png"
        ,text  : "Are you sure you want to permanently remove this previously computed result?"
        ,buttons : [
            { 
                id    : "clear"
                ,label : "Clear cached result"
                ,cb    : ga.cache.doclear
                ,adata  : [ uuid, cachedelete ]
            }
            ,{
                id    : "cancel",
                label : "Cancel"
            }
        ]
    } );
}

ga.cache.doclear = function( uuid, cachedelete ) {
    __~debug:cache{ console.log( "ga.cache.doclear( " + uuid + " , " + cachedelete + " )" );}
    // ajax call to clear
    if ( ga.cache.url_clear ) {
        $.getJSON( 
            ga.cache.url_clear,
            {
                tagmode       : "any"
                ,format       : "json"
                ,_window      : window.name
                ,_logon       : $( "#_state" ).data( "_logon" )
                ,_uuid        : uuid
                ,_cachedelete : cachedelete
            } )
            .done( function( data, status, xhr ) {
                __~debug:cache{console.log( "ga.cache.doclear() .getJSON done" )};
                if ( data[ 'success' ] == "true" ) {
                    messagebox( { icon : "information.png",
                                  text : "Previously computed results cleared" } );
                } else {
                    messagebox( { icon : "toast.png",
                                  text : data[ 'error' ] } );
                }
                __~debug:cache{console.dir( data );}
            })
            .fail( function( xhr, status, errorThrown ) {
                __~debug:cache{console.log( "ga.cache.doclear() .getJSON fail" )};
                console.warn( "could not clear cache data" );
                messagebox( { icon : "toast.png",
                              text : "Error: server failed to clear cached entry" } );
            });
    } else {
        messagebox( { icon : "toast.png",
                      text : "Internal error: no url defined for cache clear" } );
    }
}

ga.trytilltrue = function( testeval, doeval, maxtries, timeout ) {
    __~debug:trytilltrue{ console.log( "trytilltrue( '" + testeval + "' , '" + doeval + " , " + maxtries + " , " + timeout + " ) called" )};
    if ( eval( testeval ) ) {
        return eval( doeval );
    }
    maxtries--;
    if ( maxtries < 0 ) {
        console.warn( "ga.trytilltrue failed ... to many tries" );
        return;
    }
    return setTimeout( ga.trytilltrue, timeout, testeval, doeval, maxtries, timeout );
}

ga.login = {};

ga.login.verify = function( data ) {
    var msg = { text : data.text || "You must verify your email address." };

    if ( data.useroptions ) {
        if ( data.useroptions.resend ) {
            msg.buttons = msg.buttons || [];
            msg.buttons.push( { 
                id : "resend"
                ,label : "Resend the verification email"
                ,cb : ga.login.verify.resend
            } );
        }
        if ( data.useroptions.resend ) {
            msg.buttons = msg.buttons || [];
            msg.buttons.push( { 
                id : "changeaddress"
                ,label : "Change your email address and resend the verification" 
                ,cb : ga.login.verify.change
            } );
        }
        if ( data.useroptions.cancel ) {
            msg.buttons = msg.buttons || [];
            msg.buttons.push( {
                id : "cancelregistration"
                ,label : "Cancel your registration" 
                ,cb    : ga.login.verify.cancel
            } );
        }
    }                                

    messagebox( msg );
}

ga.login.verify.resend = function () {
    __~debug:loginverify{console.log( "ga.login.verify.resend()" );}
    var form = $( "#sys_login" );
    if ( !form ) {
        return messagebox( { icon : "toast.png", text: "Internal error: form missing" } );
    }
    form.append( '<input type="hidden" name="_resendverify" class="toclear">' );
    do_sys_login_submit( form );
}

ga.login.verify.change = function () {
    __~debug:loginverify{console.log( "ga.login.verify.change()" );}
    return messagebox( {
        icon : "question.png"
        ,text : '<center><label  class="header3 ">Change email address</label></center><form id="_changeemail"><table><tr><td><label for="_changeemail1">Email address </label></td><td><input type="email" name="_changeemail1" id="_changeemail1" required size="50" class="help_link"><span class="help">Enter a valid email address.  This will be required if you forget your password.  Otherwise, you will have to create a new account lose access to your projects</span><span id="_changeemail1_msg" class="warning field_msg" > </span></td></tr><tr><td><label for="_changeemail2">Repeat email address </label></td><td><input type="email" name="_changeemail2" id="_changeemail2" required size="50" class="help_link"><span class="help">Enter a valid email address.  This will be required if you forget your password.  Otherwise, you will have to create a new account lose access to your projects</span><span id="_changeemail2_msg" class="warning field_msg" > </span></td></tr></table></form><script>$( "#_changeemail1" ).keypress( function() { $( "#_changeemail1_msg" ).html( "" );});$( "#_changeemail2" ).keypress( function() { $( "#_changeemail2_msg" ).html( "" );});$( "#_changeemail2" ).blur( function() { ga.valid.checkMatch( "#_changeemail2", "#_changeemail1" ); } );setHoverHelp();</script>'
        ,buttons : [ 
            { 
                id     : "_changeemailbutton"
                ,label : "Submit"
                ,cb    : ga.login.verify.change.doit
            }
            ,{
                id     : "_changeemailcancel"
                ,label : "Cancel"
            }
        ]
    } );
}

ga.login.verify.change.doit = function () {
    __~debug:loginverify{console.log( "ga.login.verify.change.doit()" );}
    var form = $( "#sys_login" );
    if ( !form ) {
        return messagebox( { icon : "toast.png", text: "Internal error: form missing" } );
    }
// window to input email 2x to verify
    form.append( '<input type="hidden" name="_resendverify" class="toclear">' );
    form.append( '<input type="hidden" name="_changeemail" class="toclear">' );
    form.append( '<input type="hidden" name="_changeemail1" value="' + $( "#_changeemail1" ).val() + '" class="toclear">' );
    form.append( '<input type="hidden" name="_changeemail2" value="' + $( "#_changeemail2" ).val() + '" class="toclear">' );
    do_sys_login_submit( form );
}

ga.login.verify.cancel = function () {
    __~debug:loginverify{console.log( "ga.login.verify.cancel()" );}
    var form = $( "#sys_login" );
    if ( !form ) {
        return messagebox( { icon : "toast.png", text: "Internal error: form missing" } );
    }
    form.append( '<input type="hidden" name="_cancel" class="toclear">' );
    do_sys_login_submit( form );
}

ga.login.approve = function( data ) {
    var msg = { text : data.text || "Your registration is pending approval." };

    if ( data.useroptions ) {
        if ( data.useroptions.resend ) {
            msg.buttons = msg.buttons || [];
            msg.buttons.push( { 
                id : "resend"
                ,label : "Resend the approval request"
                ,cb : ga.login.approve.resend
            } );
        }
        if ( data.useroptions.cancel ) {
            msg.buttons = msg.buttons || [];
            msg.buttons.push( {
                id : "cancelregistration"
                ,label : "Cancel your registration request" 
                ,cb    : ga.login.approve.cancel
            } );
        }
    }                                

    messagebox( msg );
}

ga.login.approve.resend = function () {
    __~debug:loginapprove{console.log( "ga.login.approve.resend()" );}
    var form = $( "#sys_login" );
    if ( !form ) {
        return messagebox( { icon : "toast.png", text: "Internal error: form missing" } );
    }
    form.append( '<input type="hidden" name="_resendapprove" class="toclear">' );
    do_sys_login_submit( form );
}

ga.login.approve.cancel = function () {
    __~debug:loginapprove{console.log( "ga.login.approve.cancel()" );}
    var form = $( "#sys_login" );
    if ( !form ) {
        return messagebox( { icon : "toast.png", text: "Internal error: form missing" } );
    }
    form.append( '<input type="hidden" name="_cancel" class="toclear">' );
    do_sys_login_submit( form );
}

ga.admin = {};
ga.admin.ajax = function ( cmd, name, id, manageid ) {
    __~debug:admin{console.log( "ga.admin.ajax( " + cmd + " , " + name + " , " + id + " , " + manageid + " )" );}
    $.get( 
        ga.admin.ajax.url
        ,{
            tagmode       : "any"
            ,format       : "json"
            ,_window      : window.name
            ,_logon       : $( "#_state" ).data( "_logon" )
            ,_cmd         : cmd
            ,_name        : name
            ,_id          : id
            ,_manageid    : manageid
        } )
        .done( function( data, status, xhr ) {
            __~debug:admin{console.log( "ga.admin.ajax() .getJSON done" )};
            // required to remove the shebang (#!) 1st line of the script
            data = JSON.parse( data.split( /\r?\n/)[1]);
            if ( data[ 'success' ] == "true" ) {
                // messagebox( { icon : "information.png",
                // text : "system user management command returned success" } );
            } else {
                messagebox( { icon : "toast.png",
                              text : data[ 'error' ] ? data[ 'error' ] : "unknown error"  } );
            }
            __~debug:admin{console.dir( data );}
            if ( data[ '_submitid' ] ) {
                $( "#" + data[ '_submitid' ] ).trigger( "click" );
            }
        })
        .fail( function( xhr, status, errorThrown ) {
            __~debug:admin{console.log( "ga.admin.ajax() .getJSON fail: " + errorThrown )};
            messagebox( { icon : "toast.png",
                          text : "Error: system user management backend command failed to run: " + errorThrown } );
        });
}

ga.admin.ajax.remove = function ( cmd, name, id, manageid ) {
    messagebox( {
        icon  : "admin.png"
        ,text  : "Are you sure you want to permanently remove this user, all of their job history and their stored data?"
        ,buttons : [
            { 
                id    : "yes"
                ,label : "Yes, remove this user"
                ,cb    : ga.admin.ajax
                ,adata  : [ cmd, name, id, manageid ]
            }
            ,{
                id    : "cancel",
                label : "Cancel"
            }
        ]
    } );
}

ga.admin.ajax.group = function ( cmd, name, id, manageid, users_group ) {
    messagebox( {
        icon  : "admin.png"
        ,text  : 
            'Enter the group for user ' + 
            name +
            '<form id="sys_musergrp">' +
            '<input id="sys_musergrp_text" class="help_link" type="text" size="25" value="' + users_group + '">' +
            '<span class="help">Enter a group for this user, then press ok or cancel</span>' +
            '</form>'
        ,eval  : "resetHoverHelp();$('#sys_musergrp').on('keyup keypress', function(e) { var code = e.keyCode || e.which;  if (code  == 13) { e.preventDefault(); return false; }});"
        ,buttons : [
            { 
                id    : "ok"
                ,label : "Ok"
                ,cb    : ga.admin.ajax.group.cb
                ,adata  : [ cmd, name, id, manageid ]
            }
            ,{
                id    : "cancel",
                label : "Cancel"
            }
        ]
    } );
}

ga.admin.ajax.group.cb = function ( cmd, name, id, manageid, form ) {
    __~debug:admin{console.log( "ga.admin.ajax.group.cb( " + cmd + " , " + name + " , " + id + " , " + manageid + " )" );}
    __~debug:admin{console.log( "ga.admin.ajax.group.cb() sys_musergrp_text is " + $( "#sys_musergrp_text" ).val() );}
    $.get( 
        ga.admin.ajax.url
        ,{
            tagmode       : "any"
            ,format       : "json"
            ,_window      : window.name
            ,_logon       : $( "#_state" ).data( "_logon" )
            ,_cmd         : cmd
            ,_name        : name
            ,_id          : id
            ,_manageid    : manageid
            ,_group       : $( "#sys_musergrp_text" ).val()
        } )
        .done( function( data, status, xhr ) {
            __~debug:admin{console.log( "ga.admin.ajax.group.cb() .getJSON done" )};
            // required to remove the shebang (#!) 1st line of the script
            data = JSON.parse( data.split( /\r?\n/)[1]);
            if ( data[ 'success' ] == "true" ) {
                // messagebox( { icon : "information.png",
                // text : "system user management command returned success" } );
            } else {
                messagebox( { icon : "toast.png",
                              text : data[ 'error' ] ? data[ 'error' ] : "unknown error"  } );
            }
            __~debug:admin{console.dir( data );}
            if ( data[ '_submitid' ] ) {
                $( "#" + data[ '_submitid' ] ).trigger( "click" );
            }
        })
        .fail( function( xhr, status, errorThrown ) {
            __~debug:admin{console.log( "ga.admin.ajax.group.cb() .getJSON fail: " + errorThrown )};
            messagebox( { icon : "toast.png",
                          text : "Error: system user management backend command failed to run: " + errorThrown } );
        });
}

ga.admin.ajax.jobview = function ( cmd, name, id, manageid ) {
    __~debug:admin{console.log( "ga.admin.ajax.jobview( " + cmd + " , " + name + " , " + id + " , " + manageid + " )" );}
    $( "#configbody" ).load( "etc/userjob.html", function() {
        $("#jobtext_label").html( "Jobs for " + name );
        $.ajax( { url:ga.jc.url , data:{ _window: window.name, _asuser: name } } ).success( function( data ) {
            $("#seluserjobs").html( data );
        }).error( function( error ) {
            $("#seluserjobs").html( "error:" + data );
        });
    });
    $( ".modalDialog" ).addClass( "modalDialog_on" );
}

ga.extrahidden = function( moduleid ) {
    __~debug:extrahidden{console.log( "ga.extrahidden( " + moduleid + " )" );}
    if ( !ga.set.data[ "extrahidden" ] ||
         !ga.set.data[ "extrahidden" ][ moduleid ] ) {
        __~debug:extrahidden{console.log( "ga.extrahidden( " + moduleid + " ) nothing extra" );}
        return;
    }

    var jqmod = $( "#" + moduleid ),
    i,
    html = "";

    for ( i in ga.set.data[ "extrahidden" ][ moduleid ] ) {
        html +='<input type="hidden" name="' + i + '" value="' + ga.set.data[ "extrahidden" ][ moduleid ][ i ] + '">';
    }

    __~debug:extrahidden{console.log( "ga.extrahidden( " + moduleid + " ) appending:\n" + html );}

    jqmod.append( html );
    
    delete ga.set.data[ "extrahidden" ][ moduleid ];
}
