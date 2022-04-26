/*jslint white: true, plusplus: true*/
/* assumes: jquery > 1.11.0, jqtree >= 3.0.9, jquery-base64 */

var ga = {};
ga.tmp = {};

ga.multistage = {};
ga.stages = {};
ga.stagesdefault = {};
ga.currentstage = 0;

//ga.fielderrors = 0;
//ga.customtooltips = 0;
//ga.showcollapse3d = 0;
//ga.showcollapse2d = 0;

ga.fielderrors    = {};  
ga.customtooltips = {};
ga.showcollapse3d = {};
ga.plotted3d      = {};
ga.showcollapse2d = {};
ga.plotted2d      = {};

//ga.firstplotted3d = 0;



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

    var size = 0, key;
    for (key in obj) {
        if (obj.hasOwnProperty(key)) size++;
    }

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
    
    ga.restricted.ids[ group ] = ga.restricted.ids[ group ] || []; 
    ga.restricted.ids[ group ].push( menu );
}

ga.restricted.hideall = function() {
    var i;
    
    ga.restricted.data = {};
    for ( i in ga.restricted.ids ) {
        
        $( ga.restricted.ids[ i ].join() ).hide();
    }
}

ga.restricted.show = function( restricted ) {
    var i;
    
    for ( i in restricted ) {
        ga.restricted.data[ restricted[ i ] ] = 1;
        if ( ga.restricted.ids[ restricted[ i ] ] ) {
            $( ga.restricted.ids[ restricted[ i ] ].join() ).show();
        }
    }
}

ga.specproj = function( id,  value ) {
    
    var t = {};
    t.id = id;
    t.value = value;
    ga.specproj.data.push( t );
}
    
ga.specproj.data = [];

ga.specproj.clear = function() {
    
    ga.specproj.data = [];
}

ga.specproj.gname = function() {
    var i, add, name = "", tval;
    
    
    for ( i in ga.specproj.data ) {
        if ( ga.specproj.data.hasOwnProperty( i ) ) {
            tval = $( ga.specproj.data[ i ].value ).val();
            if ( tval == parseFloat( tval ) ) {
                tval = parseFloat( tval );
            }
            add = ga.specproj.data[ i ].id + tval;
            name += add.replace( /[^A-z0-9.-]+/g, "_" );
            
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
    
    ga.loader.jqtag = jqtag;
    ga.loader.delay = delay;
};

ga.loader.timeout = null;

ga.loader.startshow = function() {
    
    if ( ga.loader.timeout ) {
        clearTimeout( ga.loader.timeout );
        ga.loader.timeout = null;
        $( ga.loader.jqtag ).show();
    } else {
        
        $( ga.loader.jqtag ).hide();
    }
}

ga.loader.hide = function() {
    
    if ( ga.loader.timeout ) {
        clearTimeout( ga.loader.timeout );
        ga.loader.timeout = null;
    }
    
    $( ga.loader.jqtag ).hide();
}

ga.loader.show = function() {
    
    if ( ga.loader.timeout ) {
        clearTimeout( ga.loader.timeout );
    }
    ga.loader.timeout = setTimeout( ga.loader.startshow(), ga.loader.delay );
}

ga.menumodules = [];

// group

ga.group = {};

ga.group.set = function( data ) {
    
    ga.group.all = data;
}

ga.group.setuser = function( data ) {
    
    var k;
    ga.group.user = data;
    ga.group.userhas = {};
    for ( k in ga.group.user ) {
        ga.group.userhas[ ga.group.user[ k ] ] = 1;
    }
    ga.group.show();
}

ga.group.inputhtml = function( tag ) {
    
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
    

    return result;
}        

ga.group.addmenu = function( group, menu ) {
    
    ga.group.menuids[ group ] = ga.group.menuids[ group ] || []; 
    ga.group.menuids[ group ].push( menu );
}

ga.group.hideall = function() {
    var i;
    
    for ( i in ga.group.menuids ) {
        
        $( ga.group.menuids[ i ].join() ).hide();
    }
}

ga.group.show = function() {
    var i;
    
    ga.group.hideall();
    for ( i in ga.group.userhas ) {
        
        if ( ga.group.menuids[ i ] ) {
            
            $( ga.group.menuids[ i ].join() ).show();
        }
    }
    if ( ga.group.menuids[ "login" ] ) {
        
        $( ga.group.menuids[ "login" ].join() ).show();
    }
}

ga.browser = function() {
    var sUsrAg = navigator.userAgent;

    ga.browser.type     = "unknown";
    ga.browser.prefix   = "";
    ga.browser.gradient = false;
    ga.browser.clrpkr   = false;
    ga.browser.version  = "unknown";

    if(sUsrAg.indexOf("Version") > -1) {
        ga.browser.version    = /Version\/([^ ]*)/.exec( sUsrAg )[1];
        ga.browser.majversion = /Version\/([\d]*)/.exec( sUsrAg )[1];
    }

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
    

    switch( cachefound ) {
    case "notify" : 
        {               
            if ( ga.restricted.data[ cachedelete ] ) {
                ga.msg.box( {
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
                ga.msg.box( { icon:"information.png", text:"Showing previously computed results." } );
            }
        }
        break;
    case "askrecompute" : 
        if ( ga.restricted.data[ cachedelete ] ) {
            ga.msg.box( {
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
            ga.msg.box( {
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
                ga.msg.box( {
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
    
    // maybe ga.msg.box to confirm delete of cached results
    ga.msg.box( {
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
                ;
                if ( data[ 'success' ] == "true" ) {
                    ga.msg.box( { icon : "information.png",
                                  text : "Previously computed results cleared" } );
                } else {
                    ga.msg.box( { icon : "toast.png",
                                  text : data[ 'error' ] } );
                }
                
            })
            .fail( function( xhr, status, errorThrown ) {
                ;
                console.warn( "could not clear cache data" );
                ga.msg.box( { icon : "toast.png",
                              text : "Error: server failed to clear cached entry" } );
            });
    } else {
        ga.msg.box( { icon : "toast.png",
                      text : "Internal error: no url defined for cache clear" } );
    }
}

ga.trytilltrue = function( testeval, doeval, maxtries, timeout ) {
    ;
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

    ga.msg.box( msg );
}

ga.login.verify.resend = function () {
    
    var form = $( "#sys_login" );
    if ( !form ) {
        return ga.msg.box( { icon : "toast.png", text: "Internal error: form missing" } );
    }
    form.append( '<input type="hidden" name="_resendverify" class="toclear">' );
    do_sys_login_submit( form );
}

ga.login.verify.change = function () {
    
    return ga.msg.box( {
        icon : "question.png"
        ,text : '<center><label  class="header3 ">Change email address</label></center><form id="_changeemail"><table><tr><td><label for="_changeemail1">Email address </label></td><td><input type="email" name="_changeemail1" id="_changeemail1" required size="50" class="help_link"><span class="help">Enter a valid email address.  This will be required if you forget your password.  Otherwise, you will have to create a new account lose access to your projects</span><span id="_changeemail1_msg" class="warning field_msg" > </span></td></tr><tr><td><label for="_changeemail2">Repeat email address </label></td><td><input type="email" name="_changeemail2" id="_changeemail2" required size="50" class="help_link"><span class="help">Enter a valid email address.  This will be required if you forget your password.  Otherwise, you will have to create a new account lose access to your projects</span><span id="_changeemail2_msg" class="warning field_msg" > </span></td></tr></table></form><script>$( "#_changeemail1" ).keypress( function() { $( "#_changeemail1_msg" ).empty();});$( "#_changeemail2" ).keypress( function() { $( "#_changeemail2_msg" ).empty();});$( "#_changeemail2" ).blur( function() { ga.valid.checkMatch( "#_changeemail2", "#_changeemail1" ); } );ga.hhelp.set();</script>'
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
    
    var form = $( "#sys_login" );
    if ( !form ) {
        return ga.msg.box( { icon : "toast.png", text: "Internal error: form missing" } );
    }
// window to input email 2x to verify
    form.append( '<input type="hidden" name="_resendverify" class="toclear">' );
    form.append( '<input type="hidden" name="_changeemail" class="toclear">' );
    form.append( '<input type="hidden" name="_changeemail1" value="' + $( "#_changeemail1" ).val() + '" class="toclear">' );
    form.append( '<input type="hidden" name="_changeemail2" value="' + $( "#_changeemail2" ).val() + '" class="toclear">' );
    do_sys_login_submit( form );
}

ga.login.verify.cancel = function () {
    
    var form = $( "#sys_login" );
    if ( !form ) {
        return ga.msg.box( { icon : "toast.png", text: "Internal error: form missing" } );
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

    ga.msg.box( msg );
}

ga.login.approve.resend = function () {
    
    var form = $( "#sys_login" );
    if ( !form ) {
        return ga.msg.box( { icon : "toast.png", text: "Internal error: form missing" } );
    }
    form.append( '<input type="hidden" name="_resendapprove" class="toclear">' );
    do_sys_login_submit( form );
}

ga.login.approve.cancel = function () {
    
    var form = $( "#sys_login" );
    if ( !form ) {
        return ga.msg.box( { icon : "toast.png", text: "Internal error: form missing" } );
    }
    form.append( '<input type="hidden" name="_cancel" class="toclear">' );
    do_sys_login_submit( form );
}

ga.admin = {};
ga.admin.ajax = function ( cmd, name, id, manageid, jid ) {
    
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
            ,_jid         : jid
        } )
        .done( function( data, status, xhr ) {
            ;
            // required to remove the shebang (#!) 1st line of the script
            data = JSON.parse( data.replace( /^\s*[\r\n]/gm, '' ).split( /\r?\n/)[1]);
            if ( data[ 'success' ] == "true" ) {
                // ga.msg.box( { icon : "information.png",
                // text : "system user management command returned success" } );
            } else {
                ga.msg.box( { icon : "toast.png",
                              text : data[ 'error' ] ? data[ 'error' ] : "unknown error"  } );
            }
            
            if ( data[ '_submitid' ] ) {
                $( "#" + data[ '_submitid' ] ).trigger( "click" );
            }
        })
        .fail( function( xhr, status, errorThrown ) {
            ;
            ga.msg.box( { icon : "toast.png",
                          text : "Error: system user management backend command failed to run: " + errorThrown } );
        });
}

ga.admin.ajax.remove = function ( cmd, name, id, manageid ) {
    ga.msg.box( {
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
    ga.msg.box( {
        icon  : "admin.png"
        ,text  : 
            'Enter the group for user ' + 
            name +
            '<form id="sys_musergrp">' +
            '<input id="sys_musergrp_text" class="help_link" type="text" size="25" value="' + users_group + '">' +
            '<span class="help">Enter a group for this user, then press ok or cancel</span>' +
            '</form>'
        ,eval  : "ga.hhelp.reset();$('#sys_musergrp').on('keyup keypress', function(e) { var code = e.keyCode || e.which;  if (code  == 13) { e.preventDefault(); return false; }});"
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
            ;
            // required to remove the shebang (#!) 1st line of the script
            data = JSON.parse( data.replace( /^\s*[\r\n]/gm, '' ).split( /\r?\n/)[1]);
            if ( data[ 'success' ] == "true" ) {
                // ga.msg.box( { icon : "information.png",
                // text : "system user management command returned success" } );
            } else {
                ga.msg.box( { icon : "toast.png",
                              text : data[ 'error' ] ? data[ 'error' ] : "unknown error"  } );
            }
            
            if ( data[ '_submitid' ] ) {
                $( "#" + data[ '_submitid' ] ).trigger( "click" );
            }
        })
        .fail( function( xhr, status, errorThrown ) {
            ;
            ga.msg.box( { icon : "toast.png",
                          text : "Error: system user management backend command failed to run: " + errorThrown } );
        });
}

ga.admin.ajax.jobview = function ( cmd, name, id, manageid ) {
    
    $( "#configbody" ).load( "etc/userjob.html", function() {
        $("#jobtext_label").html( "Jobs for " + name );
        $.ajax( { url:ga.jc.url , data:{ _window: window.name, _asuser: name, _id : id, _manageid : manageid } } ).success( function( data ) {
            $("#seluserjobs").html( data );
        }).error( function( error ) {
            $("#seluserjobs").html( "error:" + data );
        });
    });
    $( ".modalDialog" ).addClass( "modalDialog_on" );
}

ga.admin.ajax.cancel = function ( name, id, manageid, module, jid ) {
    
    ga.msg.box( {
        icon  : "admin.png"
        ,text  : "Are you sure you want to cancel this '" + module + "' job belonging to " + name + " ?"
        ,buttons : [
            { 
                id    : "yes"
                ,label : "Yes, cancel the job"
                ,cb    : ga.admin.ajax.cancel.cb
                ,adata  : [ name, id, manageid, jid ]
            }
            ,{
                id    : "no",
                label : "No"
            }
        ]
    } );
}

ga.admin.ajax.cancel.cb = function ( name, id, manageid, jid ) {
    
    $( ".modalDialog" ).removeClass( "modalDialog_on" );
    ga.admin.ajax( "jobcancel", name, id, manageid, jid );
}

ga.extrahidden = function( moduleid ) {
    
    if ( !ga.set.data[ "extrahidden" ] ||
         !ga.set.data[ "extrahidden" ][ moduleid ] ) {
        
        return;
    }

    var jqmod = $( "#" + moduleid ),
    i,
    html = "";

    for ( i in ga.set.data[ "extrahidden" ][ moduleid ] ) {
        html +='<input type="hidden" name="' + i + '" value="' + ga.set.data[ "extrahidden" ][ moduleid ][ i ] + '">';
    }

    

    jqmod.append( html );
    
    delete ga.set.data[ "extrahidden" ][ moduleid ];
}

ga.hhelp = {};

// resetHoverHelp() -> ga.hhelp.reset()
// setHoverHelp() -> ga.hhelp.set()

ga.hhelp.reset = function() {
    
   if ( $( "#global_data" ).data( "hoverhelp" ) ||
        $( "#global_data" ).data( "hoverhelp" ) != 0 )
   {
       $( ".help_link" ).removeClass( "help_link_on" );
       $( ".help_link" ).addClass( "help_link_on" );
   }
   $( ".help" ).css( { 'background-color' : ga.colors.makeRGBstr( ga.colors.background ) } );
}

ga.hhelp.set = function() {
    
    
   if ( !$( "#global_data" ).data( "hoverhelp" ) ||
        $( "#global_data" ).data( "hoverhelp" ) == 0 )
   {
       
       $( ".help_link" ).removeClass( "help_link_on" );
       $( "#hoverhelp" ).html( "Help off" );
   } else {
       
       $( ".help_link" ).addClass( "help_link_on" );
       $( "#hoverhelp" ).html( "Help on" );
   }
}

ga.progress = function( mod, val, valmax ) {
  
  if ( !$(`#${mod}_progress`).html().length ) {
     ga.progress.set( mod );
  }
  

  if ( valmax ) {
    val = val / valmax;
  }

  if ( ga.bootstrap ) {
     
     document.getElementById(`${mod}_upload_progressbar`).style.width = (100*val).toString() + "%";
  } else {
     
     $(`#${mod}_progress progress`).attr({value:val,max:1});
  }
}

ga.progress.set = function( mod, prefix ) {
  
  prefix = prefix ? `${prefix}:` : '';
  $(`#${mod}_progress`).html( prefix +
    ga.bootstrap ? `<div class="progress"><div id="${mod}_upload_progressbar" class="progress-bar" role="progressbar" style="width:0%"></div></div>` : '<progress></progress>'
  );
  
}

ga.progress.clear = function( mod, msg ) {
  
  $(`#${mod}_progress`).empty();
}  
/*jslint white: true, plusplus: true*/
/* assumes: jquery > 1.11.0, jqtree >= 3.0.9, jquery-base64 */

ga.colors = function( colors ) {
    
    ga.colors.background = ga.colors.makeRGB( colors.background );
    ga.colors.text       = ga.colors.makeRGB( colors.text );
};

ga.colors.makeRGBstr = function( color ) {
    return "rgb(" + ga.colors.makeRGB( color ) + ")";
}

ga.colors.makeRGB = function( color ) {
    
    var res;
    if ( /\d{1,3},\s*\d{1,3},\s*\d{1,3}$/.test( color ) ) {
        
        return color;
    }

    res = ga.color.toRGB( color );

    
    
    return res.r + "," + res.g + "," + res.b;
}

ga.plot_options = function () {
    var textcolor = "rgb( " + ga.colors.text + " )",
        retobj = {
            font : {
                color : textcolor
            },
            grid : {
                hoverable: false
		//, backgroundColor: "white"
            },
            xaxis : {
                color : "gray",
                lineWidth : 0.5,
                font : {
                    color : textcolor
                }
            },
            yaxis : {
                color : "gray",
                lineWidth : 0.5,
                font : {
                    color : textcolor
                }
            },
            lines: { 
                lineWidth : 1.0
            },
            zoom: {
                interactive: false
            },
            pan: {
                interactive: false
            }
        };

    return retobj;
};

ga.color = function( colors ) {
    
    ga.color.data = colors;
    ga.colors( colors.body );
    ga.color.apply();
}

ga.color.defaults = function( colors ) {
    
    ga.browser();
    ga.color.defaults.data = colors;
    ga.color( colors );
}

ga.color.toRGB = function( color ) {
    
    var r, g, b, re;

    if ( color.slice( 0, 1 ) === "#" ) { 
        // adjust help background color
        b = parseInt( color.slice( 1 ), 16 );
        g = parseInt( b / 256 );
        b -= g * 256;
        r = parseInt( g / 256 );
        g -= r * 256;

        
        return { r:r, b:b, g:g };
    }

    

    bits = /^rgb\(\s*(\d{1,3}),\s*(\d{1,3}),\s*(\d{1,3})\s*\)$/.exec( color );
    if ( bits ) {
        r = parseInt( bits[ 1 ] );
        g = parseInt( bits[ 2 ] );
        b = parseInt( bits[ 3 ] );
    } else {
        r = 128;
        g = 128;
        b = 128;
    }

    return { r:r, b:b, g:g };
}

ga.color.apply = function() {
    var i
        ,jq
        ,r, g, b
        ,r0, g0, b0
        ,tmp
    ;

    

    if ( !ga.directives.data || !ga.directives.data[ "usercolors" ] ||
         /^(off|0|false)$/.test( ga.directives.data[ "usercolors" ] ) ) {
        
        return;
    }

    for ( i in ga.color.data ) {
        if ( ga.color.data.hasOwnProperty( i ) ) {
            
            if ( jq = $( i ) ) {
                jq.css( ga.color.data[ i ] );
            }
        }
    }

    $( ".sidebar ul li, .title" )
        .css( "color", ga.color.data.body.color )
        .hover( function() { $(this).css( "color", ga.color.defaults.data.hovercolor.color );}, 
                function() { $(this).css( "color", ga.color.data.body.color );} )
    ;

    $( ".svgmenu" )
        .css( { "color" : ga.color.data.body.color, "stroke" : ga.color.data.body.color } )
        .hover( function() { $(this).css( { "color" : ga.color.defaults.data.hovercolor.color, "stroke" : ga.color.defaults.data.hovercolor.color } ) },
                function() { $(this).css( { "color" : ga.color.data.body.color, "stroke" : ga.color.data.body.color } ) } )
    ;

    if ( ga.color.data.body.background.slice( 0, 1 ) === "#" ) { 
        // adjust help background color
        b = parseInt( ga.color.data.body.background.slice( 1 ), 16 );
        g = parseInt( b / 256 );
        b -= g * 256;
        r = parseInt( g / 256 );
        g -= r * 256;

        r += r > 128 ? -20 : 20;
        g += g > 128 ? -20 : 20;
        b += b > 128 ? -20 : 20;

        

        $( ".help,.coord" )
            .css( { background : "rgba(" + r + "," + g + "," + b + ",0.8)",
                    color      : ga.color.data.body.color } )
        ;
    } else {
        $( ".help,.coord" )
            .css( { background : ga.color.data[ ".help" ].background,
                    color      : ga.color.data[ ".help" ].color } )
        ;
    }

    if ( ga.color.data.body.color.slice( 0, 1 ) === "#" ) {
        // adjust header colors
        b = parseInt( ga.color.data.body.color.slice( 1 ), 16 );
        g = parseInt( b / 256 );
        b -= g * 256;
        r = parseInt( g / 256 );
        g -= r * 256;

        r0 = r;
        g0 = g;
        b0 = b;
        
        r += r > 128 ? -12 : 12;
        g += g > 128 ? -12 : 12;
        b += b > 128 ? -12 : 12;

        $( ".header1" ).css( { color : "rgb(" + r + "," + g + "," + b + ")" } );

        r += r > 128 ? -12 : 12;
        g += g > 128 ? -12 : 12;
        b += b > 128 ? -12 : 12;

        $( ".header2" ).css( { color : "rgb(" + r + "," + g + "," + b + ")" } );

        r += r > 128 ? -12 : 12;
        g += g > 128 ? -12 : 12;
        b += b > 128 ? -12 : 12;

        $( ".header3" ).css( { color : "rgb(" + r + "," + g + "," + b + ")" } );

        r += r > 128 ? -12 : 12;
        g += g > 128 ? -12 : 12;
        b += b > 128 ? -12 : 12;

        $( ".header4" ).css( { color : "rgb(" + r + "," + g + "," + b + ")" } );

        r += r > 128 ? -12 : 12;
        g += g > 128 ? -12 : 12;
        b += b > 128 ? -12 : 12;

        $( "hr" ).css( { color : "rgb(" + r + "," + g + "," + b + ")" } );

        // links
        {
            r = r0;
            g = g0;
            b = b0;

            g += g > 128 ? -75 : 75;
            ga.cssrule.kill('a:link');
            tmp = ga.cssrule.add( 'a:link' );
            tmp.style.color = "rgb(" + r + "," + g + "," + b + ")";
            g = g0;

            b += b > 128 ? -75 : 75;
            r += r > 128 ? -75 : 75;
            ga.cssrule.kill('a:visited');
            tmp = ga.cssrule.add( 'a:visited' );
            tmp.style.color = "rgb(" + r + "," + g + "," + b + ")";
            b = b0;
            r = r0;

            r += r > 128 ? -75 : 75;
            ga.cssrule.kill('a:active');
            tmp = ga.cssrule.add( 'a:active' );
            tmp.style.color = "rgb(" + r + "," + g + "," + b + ")";

        }
    } else {
        $( ".header1" ).css( { color : ga.color.data[ ".header1" ] ? ga.color.data[ ".header1" ].color : ga.color.data.body.color } );
        $( ".header2" ).css( { color : ga.color.data[ ".header2" ] ? ga.color.data[ ".header2" ].color : ga.color.data.body.color } );
        $( ".header3" ).css( { color : ga.color.data[ ".header3" ] ? ga.color.data[ ".header3" ].color : ga.color.data.body.color } );
        $( ".header4" ).css( { color : ga.color.data[ ".header4" ] ? ga.color.data[ ".header4" ].color : ga.color.data.body.color } );
    }

    // modals

    $( ".modalDialog > div, .modalDialog2 > div, .modalDialog3 > div, .modalDialog4 > div" )
    .css( { background : ( ga.browser.gradient 
                           ? ga.browser.prefix + "linear-gradient(" + ga.color.data.body.background + ", #222)"
                           : ga.color.data.body.background ) } );



}

ga.color.reset = function() {
    
    ga.color( ga.color.defaults.data );
}

ga.color.spectrum = function( id ) {
    if ( ga.browser.clrpkr ) {
        return;
    }
    $( id ).on('change.spectrum', function( e, color ) { console.log( "hi spectrum" + id ); $( id ).val( color.toHexString() );  } );
}

ga.color.spectrum.val = function( id, val ) {
    if ( ga.browser.clrpkr ) {
        return;
    }

    if ( val ) {
        
        $( id ).spectrum( { color: val } );
        return;
    }
    return $( id ).spectrum( 'get' ).toHexString();
}
/*jslint white: true, plusplus: true*/
/* assumes: ga, jquery > 1.11.0, jqtree >= 3.0.9, jquery-base64 */


ga.event = function ( menu, module, action ) {

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


    for ( ; j < l ; j++ ) {
        result += ga.event.log[ j ].menu + " " + ga.event.log[ j ].module + " " + ga.event.log[ j ].action + " " + ga.event.log[ j ].when.toUTCString() + "\n";
    }


    return result;
}

    

    


/*jslint white: true, plusplus: true*/
/* assumes: jquery > 1.11.0, jqtree >= 3.0.9, jquery-base64 */

ga.fc = function( id, cb ) {
    var i,
        waits;

    
    if ( ga.fc.cache[ id ] ) {
        
        cb( ga.fc.cache[ id ] );
    } else {
        // only one ajax call per id
        if ( !ga.fc.waits[ id ] )
        {
            
            ga.fc.waits[ id ] = [ cb ];
            $.ajax( ga.fc.url + id ).success( function( data ) {
                
                waits = ga.fc.waits[ id ];
                delete ga.fc.waits[ id ];
                data = $.parseJSON( data );
                ga.fc.cache[ id ] = data;
                
                for ( i = waits.length; i--; )
                {
                    waits[ i ]( data );
                }
            }).error( function( error ) {
                
                waits = ga.fc.waits[ id ];
                delete ga.fc.waits[ id ];
                console.log( "ajax error" );
                console.dir( error );
                for ( i = waits.length; i--; )
                {
                    waits[ i ]( "**error**" );
                }
                ga.fc.ajax_error_msg( "ajax get error: " + error.statusText );
            });
        } else {
            
            ga.fc.waits[ id ].push( cb );
        }
    }
    return true;
};

ga.fc.clear = function( id ) {
    var i,
        children = ga.fc.children( id );
    

    for ( i in children ) {
        if ( ga.fc.cache[ i ] ) {
            delete ga.fc.cache[ i ];
        }
    }
    if ( ga.fc.cache[ id ] ) {
        delete ga.fc.cache[ id ];
    }
    for ( i in ga.fc.trees ) {
        if ( $( i ).length )
        {
            if ( id !== "#" ) {
                $( i ).jstree( true ).refresh_node( id );
            } else {
                $( i ).jstree( true ).refresh();
            }
        }
    }
};

ga.fc.refresh = function( id ) {
    var i;

    

    for ( i in ga.fc.trees ) {
        if ( $( i ).length )
        {
            if ( ga.fc.cache[ id ] ) {
                if ( id !== "#" ) {
                    $( i ).jstree( true ).refresh_node( id );
                } else {
                    $( i ).jstree( true ).refresh();
                }
            }
        }
    }
};


ga.fc.delete_node = function( ids ) {
    var i;

    

    if ( !ids.length ) {
        return;
    }
        

    if ( ga.fc.url_delete && ga.fc.url_delete.length !== 0 ) {
        $.ajax({
              url      : ga.fc.url_delete,
              data     :  {
                            _window : window.name,
                           _spec   : "fc_cache",
                           _delete : ids.join( ',' )
                         },
              dataType : 'json',
              method   : 'POST'
            }).success( function( data ) {
            console.log( "ajax delete done" );
//            console.dir( data );
            if ( data.error && data.error.length ) {
//                ga.fc.refresh( "#" );
                ga.fc.delete_error_msg( ids, data.error );
            } else {
// we are always clearing the whole tree on delete
//                if ( data.reroot && data.reroot === 1 ) {
                ga.fc.clear( "#" );
//                } else {
//                    for ( i in ga.fc.trees ) {
//                        if ( $( i ).length )
//                        {
//                            console.log( "ga.fc.remove from tree " + i );
//                            console.dir( ids );
//                            $( i ).jstree( true ).delete_node( ids );
//                        }
//                    }
//                }
            }

        }).error( function( error ) {
            console.log( "ajax error" );
            console.dir( error );
//            ga.fc.refresh( "#" );
            ga.fc.ajax_error_msg( "ajax delete error: " + error.statusText );
        });
;
    } else {
        console.log( "ga.fc.delete_node, no url_delete " + ids.join( "," )  );
    }
};

ga.fc.delete_node_message = function( ids ) {
    var msg = "You are about to permanently remove " + ids.length + " file";
//        strip2 = function(str) { return str.substr( 2 ); };    

    if ( !ids.length ) {
        return "Can not remove a directory from here";
    }
    if ( ids.length > 1 ) {
        msg += "s and/or directories";
    } else {
        msg += " or directory";
    }
    msg += " and the contents, including subdirectories, of any directory listed below<p>";

    return msg;
// :<p>" + $.map( $.map( ids.slice( 0, 5 ), $.base64.decode ), strip2 ).join( "<p>" );
//    if ( ids.length > 5 ) {
//        msg += "<p> Note: an additional " + ( ids.length - 5 ) + " entr";
//        if ( ids.length > 6 ) {
//            msg += "ies are not shown. ";
//        } else {
//            msg += "y is not shown. ";
//        }
//    }
//    return msg;
};

ga.fc.delete_node_message_files = function( ids ) {
    return ids.length ? "<div class=\"table-wrapper\"><table><tr><td>" + 
           $.map( $.map( ids, $.base64.decode ), function(str) { return str.substr( 2 ); } )
           .join( "</td></tr><tr><td>" ) + "</td></tr></table></div>" : "";
};

ga.fc.children = function( id, result ) {
    var i,
        idc;
    
    result = result || {};
    if ( ga.fc.cache[ id ] )
    {
        // expand and return all children in the cache
        for ( i = ga.fc.cache[ id ].length; i--; ) {
            if ( ga.fc.cache[ id ][ i ].children ) {
                idc = ga.fc.cache[ id ][ i ].id;
                if ( ga.fc.cache[ idc ] ) {
                   result[ idc ] = true;
                   result = ga.fc.children( idc, result );
                }
            }
        }
    }
    return result;
};   

ga.fc.cache = {};
ga.fc.waits = {};
ga.fc.trees = {};
/*jslint white: true, plusplus: true*/
/* assumes: jquery > 1.11.0, jqtree >= 3.0.9, jquery-base64 */

ga.jc = function( id, cb ) {
    var i,
        waits;

    ;

    if ( ga.jc.cache[ id ] ) {
        cb( ga.jc.cache[ id ] );
    } else {
        // only one ajax call per id
        if ( !ga.jc.waits[ id ] )
        {
            ga.jc.waits[ id ] = [ cb ];
            $.ajax( { url:ga.jc.url , data:{ _tree:id, _window: window.name } } ).success( function( data ) {
                waits = ga.jc.waits[ id ];
                delete ga.jc.waits[ id ];
                data = $.parseJSON( data );
                ga.jc.cache[ id ] = data;
                
                for ( i = waits.length; i--; )
                {
                    waits[ i ]( data );
                }
            }).error( function( error ) {
                waits = ga.jc.waits[ id ];
                delete ga.jc.waits[ id ];
                console.log( "ajax error" );
                console.dir( error );
                for ( i = waits.length; i--; )
                {
                    waits[ i ]( "**error**" );
                }
                ga.jc.ajax_error_msg( "ajax get error: " + error.statusText );
            });
        } else {
            ga.jc.waits[ id ].push( cb );
        }
    }
    return true;
};

ga.jc.clear_leaf = function( id ) {
;
    var i,
        any_contain = 0,
        node;

// does any tree currently have the node ?
    for ( i in ga.jc.trees ) {
        if ( $( i ).length )
        {
            node = $( i ).jstree( true ).get_node( id );
            if ( node ) {
                any_contain = 1;
                break;
            }
        }
    }

    any_contain ? ga.jc.clear( node.parent ) : ga.jc.clear( "#" );
}

ga.jc.clear = function( id ) {
    var i,
        children = ga.jc.children( id );

    for ( i in children ) {
        if ( ga.jc.cache[ i ] ) {
            delete ga.jc.cache[ i ];
        }
    }
    if ( ga.jc.cache[ id ] ) {
        delete ga.jc.cache[ id ];
    }
    for ( i in ga.jc.trees ) {
        if ( $( i ).length )
        {
            if ( id !== "#" ) {
                $( i ).jstree( true ).refresh_node( id );
            } else {
                $( i ).jstree( true ).refresh();
            }
        }
    }
};

ga.jc.refresh = function( id ) {
    var i;

    for ( i in ga.jc.trees ) {
        if ( $( i ).length )
        {
            if ( ga.jc.cache[ id ] ) {
                if ( id !== "#" ) {
                    $( i ).jstree( true ).refresh_node( id );
                } else {
                    $( i ).jstree( true ).refresh();
                }
            }
        }
    }
};


ga.jc.delete_node = function( ids ) {
    var i;

    if ( !ids.length ) {
        return;
    }
        

    if ( ga.jc.url_delete && ga.jc.url_delete.length !== 0 ) {
        $.ajax({
              url      : ga.jc.url_delete,
              data     :  {
                            _window : window.name,
                           _spec   : "fc_cache",
                           _delete : ids.join( ',' )
                         },
              dataType : 'json',
              method   : 'POST'
            }).success( function( data ) {
            console.log( "ajax delete done" );
//            console.dir( data );
            if ( data.error && data.error.length ) {
//                ga.jc.refresh( "#" );
                ga.jc.delete_error_msg( ids, data.error );
            } else {
// we are always clearing the whole tree on delete
//                if ( data.reroot && data.reroot === 1 ) {
                ga.jc.clear( "#" );
//                } else {
//                    for ( i in ga.jc.trees ) {
//                        if ( $( i ).length )
//                        {
//                            console.log( "ga.jc.remove from tree " + i );
//                            console.dir( ids );
//                            $( i ).jstree( true ).delete_node( ids );
//                        }
//                    }
//                }
            }

        }).error( function( error ) {
            console.log( "ajax error" );
            console.dir( error );
//            ga.jc.refresh( "#" );
            ga.jc.ajax_error_msg( "ajax delete error: " + error.statusText );
        });
;
    } else {
        console.log( "ga.jc.delete_node, no url_delete " + ids.join( "," )  );
    }
};

ga.jc.delete_node_message = function( ids ) {
    var msg = "You are about to permanently remove " + ids.length + " job";

    if ( ids.length > 1 ) {
        msg += "s";
    }
    return msg;
};

ga.jc.delete_node_message_files = function( ids ) {
    return ids.length ? "<div class=\"table-wrapper\"><table><tr><td>" + 
           $.map( $.map( ids, $.base64.decode ), function(str) { return str.substr( 2 ); } )
           .join( "</td></tr><tr><td>" ) + "</td></tr></table></div>" : "";
};

ga.jc.children = function( id, result ) {
    var i,
        idc;
    result = result || {};
    if ( ga.jc.cache[ id ] )
    {
        // expand and return all children in the cache
        for ( i = ga.jc.cache[ id ].length; i--; ) {
            if ( ga.jc.cache[ id ][ i ].children ) {
                idc = ga.jc.cache[ id ][ i ].id;
                if ( ga.jc.cache[ idc ] ) {
                   result[ idc ] = true;
                   result = ga.jc.children( idc, result );
                }
            }
        }
    }
    return result;
};   

ga.jc.cache = {};
ga.jc.waits = {};
ga.jc.trees = {};
/*jslint white: true, plusplus: true*/
/* assumes: jquery > 1.11.0, jqtree >= 3.0.9, jquery-base64 */

ga.altfile = function( module, idfile, idref ) {

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


   $( ms + " ._hidden_altfiles" ).remove();
   $( ms + " ._hidden_buttonvals" ).remove();

   if ( ga.altfile.data[ module ] ) {
      for ( i in ga.altfile.data[ module ] ) {

         add += '<input type="hidden" name="_selaltval_' + i + '" value="' + ga.altfile.data[ module ][ i ] + '" class="_hidden_altfiles">';
      }
   }

   if ( ga.altfile.bdata[ module ] ) {
      for ( i in ga.altfile.bdata[ module ] ) {

         add += '<input type="hidden" name="' + i + '" value="' + ga.altfile.bdata[ module ][ i ].val + '" class="_hidden_buttonvals">';
      }
   }

   if ( add.length ) {
      $( ms ).append( add );
   }
};

ga.altfile.button = function( module, id, text, call, cb, required ) {

   ga.altfile.bdata[ module ] = ga.altfile.bdata[ module ] || {};
   ga.altfile.bdata[ module ][ id ] = {};
   ga.altfile.bdata[ module ][ id ].val = {};
   ga.altfile.bdata[ module ][ id ].text = text;
   ga.altfile.bdata[ module ][ id ].call = call;  // the name of the sys module to call
   ga.altfile.bdata[ module ][ id ].cb = cb;      // the callback called upon 'submit' cb of the module
   ga.altfile.bdata[ module ][ id ].req = required || 0;
}

ga.altfile.button.value = function( module, id, val ) {

   ga.altfile.bdata[ module ][ id ].val = val;
}

ga.altfile.button.call = function( module, id ) {
   var tmp;

   if ( ga.altfile.bdata[ module ][ id ].call.length ) {
       tmp = $( '#_state' ).data( '_logon' );
       if ( !tmp || !tmp.length ) {
           ga.msg.box( {
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
    
    $( "#configbody" ).load( "ajax/" + module + "/" + id + ".html", function() {
        
    });
    ga.repeats.save();
    $( ".modalDialog" ).addClass( "modalDialog_on" );
    return false;
}

ga.altfile.button.cb = function() {
    
    ga.msg.close( 1 );
}

ga.altfile.button.lrfile = function( treeid, module, id ) {
  var r      = [],
      hmod   = "#" + module,
      hid    = "#" + id,
      add    = "",
      hclass = "_hidden_lrfile_sels_" + id;


  $( hmod + " ." + hclass ).remove();
  $.each( $(treeid).jstree("get_checked", true), function() {

     if ( !this.children.length ) {
       add += '<input type="hidden" name="' + id + '_altval[]" value="' + this.id + '" class="' + hclass + '" data-type="rfile_val">';
         r.push( $.base64.decode( this.id ).substr( 2 ) );
     }
  });

  if ( r.length ) {
      
     $( hid + "_altval").html( "<i>Server</i>: " + r );
     $( hid + "_msg").empty();
     $( hid ).val("");
     $( hmod ).append( add );

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


  $( hmod + " ." + hclass ).remove();
  $.each( s.get_top_checked(true), function() {
 
     if ( !s.is_leaf( this ) ) {
       add += '<input type="hidden" name="' + id + '[]" value="' + this.id + '" class="' + hclass + '">' +
              '<input type="hidden" name="_decodepath_' + id + '" class="' + hclass + '">';
       r.push( $.base64.decode( this.id ).substr( 2 ) );
     }
  });

  if ( r.length ) {
     $( hid + "_altval").html( "<i>Server</i>: " + r );
     $( hid + "_msg").empty();
     $( hid ).val("");
     $( hmod ).append( add );

  }
}

ga.altfile.button.rfile = function( treeid, module, id ) {
  var r      = [],
      hmod   = "#" + module,
      hid    = "#" + id,
      add    = "",
      hclass = "_hidden_rfile_sels_" + id,
      s      = $(treeid).jstree(true);


  $( hmod + " ." + hclass ).remove();
  $.each( $(treeid).jstree("get_checked", true), function() {

     if ( !this.children.length ) {
       add += '<input type="hidden" name="' + id + '_altval[]" value="' + this.id + '" class="' + hclass + '" data-type="rfile_val">';
       r.push( $.base64.decode( this.id ).substr( 2 ) );
     }
  });

  if ( r.length ) {
     $( hid + "_altval").html( "<i>Server</i>: " + r );
     $( hid + "_msg").empty();
     $( hid ).val("");
     $( hmod ).append( add );

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


  $( hmod + " ." + hclass ).remove();
  $.each( $(treeid).jstree("get_checked", true), function() {

     if ( !this.children.length ) {
       add += '<input type="hidden" name="' + id + '_altval[]" value="' + this.id + '" class="' + hclass + '">';
       r+="<tr><td>" + this.parent +":" + this.text + "</td></tr>";
     }
  });

  if ( r.length ) {
     $( hid + "_altval").html( "<table>" + r + "</table>" );
     $( hid + "_msg").empty();
     $( hid ).val("");
     $( hmod ).append( add );

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
    
    
}

/*jslint white: true, plusplus: true*/
/* assumes: jquery > 1.11.0, jqtree >= 3.0.9, jquery-base64 */

ga.valid = {};

ga.valid.checkMatch = function( tag1, tag2 ) {

   if ( $( tag1 ).val() != $( tag2 ).val() )
   {
      $( tag1 + "_msg" ).html( " does not match" );
   } else {
      $( tag1 + "_msg" ).empty();
   }
}
    
ga.valid.checkText = function( tag ) {
    var t = $( tag );
    var fieldValue=t.val();
    var ok = 0;
    var pattern = t.attr("pattern");
    var reg = new RegExp(pattern);
    
    
    if (pattern) {
	//console.log("It has pattern: " + pattern);
	
	if ( !reg.test(fieldValue) )
	{
	    //t.val( t.prop( "defaultValue" ) );
            if ( fieldValue.length || t.prop( "required" ) ) {
	        $( tag + "_msg" ).html( " wrong format" );
            } else {
                ok = 1;
            }
	}
	else {
	    ok = 1;
	    $( tag + "_msg" ).empty();
	}
    }	
    else {
	//console.log("No pattern!");
	if (!fieldValue && t.prop( "required" ) ) {
	    $( tag + "_msg" ).html(' missing required field');
	}
	else {
	    ok = 1;
	}
    }
    return ok; 
}

ga.valid.checkFloat = function( tag ) {
    
    var t = $( tag );
    var fieldValue=t.val();
    var ok = 0;
    //if ( isNaN( fieldValue ) ) 
    //if ( !fieldValue.match( /^[+-]?\d+(\.\d+)?$/ ) )
    
    if ( !fieldValue.match( /^-?(([1-9][0-9]*)|(0))?([.][0-9]+)?([eE][-+]?[0-9]+)?$/ ) )
    {
	// t.val( t.prop( "defaultValue" ) );                                
	//$( tag + "_msg" ).html( " not a valid floating point number, reset to default" );
        if ( fieldValue.length || t.prop( "required" ) ) {
	    $( tag + "_msg" ).html( " wrong format" );
        } else {
            ok = 1;
        }
    } else {
	ok = 1;
        if ( fieldValue < parseFloat ( t.attr( "min" ) ) )
	{ 
            t.val( t.attr( "min" ) );
            $( tag + "_msg" ).html( " value set to minimum allowed" );
	} else {
            if ( fieldValue > parseFloat ( t.attr( "max" ) ) )
            { 
		t.val( t.attr( "max" ) );
		$( tag + "_msg" ).html( " value set to maximum allowed" );
            } else {                                                             
		$( tag + "_msg" ).empty();
	    }
	} 
    }
    return ok; 
}

ga.valid.checkInt = function( tag ) {
    
    var t = $( tag );
    var fieldValue=t.val();
    var ok = 0;

    //if ( isNaN( fieldValue ) )
    //if ( !fieldValue.match( /^[+-]?\d+$/ ) )    
    if ( !fieldValue.match( /^-?((0)|([1-9][0-9]*))$/ ) )    
    {
	//t.val( t.prop( "defaultValue" ) );
	//$( tag + "_msg" ).html( " not a valid number, reset to default" );
        if ( fieldValue.length || t.prop( "required" ) ) {
	    $( tag + "_msg" ).html( " wrong format" );
        } else {
            ok = 1;
        }
    } else {
	ok = 1;
	if ( fieldValue < parseInt ( t.attr( "min" ) ) )
	{ 
            t.val( t.attr( "min" ) );
            $( tag + "_msg" ).html( " value set to minimum allowed" );
	} else {
            if ( fieldValue > parseInt ( t.attr( "max" ) ) )
            { 
		t.val( t.attr( "max" ) );
		$( tag + "_msg" ).html( " value set to maximum allowed" );
            } else {
		if ( parseInt( fieldValue ) != fieldValue )
		{   
                    $( tag + "_msg" ).html( " value rounded to nearset integer" );
                    t.val( parseInt( parseFloat( fieldValue ) + .5 ) );
		} else {
                    $( tag + "_msg" ).empty();
		}
            }
	}
    }
    return ok;
}

ga.valid.safeFile = function( tag ) {
   var t = $( tag );
   var fieldValue=t.val();
   if ( !fieldValue.match( "^[a-zA-Z0-9]+([a-zA-Z0-9_\.\-]+|\/[a-zA-Z0-9_\-])+$" ) )
   {
       t.val( t.prop( "defaultValue" ) );
       $( tag + "_msg" ).html( "Not an acceptable filename, reset to default" );
   } else {
       $( tag + "_msg" ).empty();
   }
}

ga.valid.checkLrfile = function( tag ) {

   var t   = $( tag ),
       r   = $( tag + '_altval > i' ),
       msg = $( tag + "_msg" ),
       ok  = 0;
   if ( !t || !t.is(':visible') ) {
       return 1;
   }
   if ( t && t.val() && t.val().length ) {

       ok = 1;
   } else {
       if ( r && r.html() && r.html().length && r.html() === "Server" ) {

           ok = 1;
       }
   }
   if ( !ok ) {
       msg.html( " missing required field" );
   }
   return ok;
}

ga.valid.checkRpath = function( tag ) {

   var t   = $( tag ),
       r   = $( tag + '_altval > i' ),
       msg = $( tag + "_msg" ),
       ok  = 0;

   if ( !t || !t.is(':visible') ) {
       return 1;
   }
   if ( r && r.html() && r.html().length && r.html() === "Server" ) {

       ok = 1;
   }
   if ( !ok ) {
       msg.html( " missing required field" );
   }

   return ok;
}

ga.valid.checkRfile = function( tag ) {

   var t   = $( tag ),
       r   = $( tag + '_altval > i' ),
       msg = $( tag + "_msg" ),
       ok  = 0;

   if ( !t || !t.is(':visible') ) {
       return 1;
   }
   if ( r && r.html() && r.html().length && r.html() === "Server" ) {

       ok = 1;
   }
   if ( !ok ) {
       msg.html( " missing required field" );
   }

   return ok;
}

ga.valid.checksubmit = function( module ) {
   var i,
       ok = 1;

   if ( !ga.altfile.bdata[ module ] && !ga.value.types[ module ]) {
      return 1;
   }

   ga.valid.clearerrorcounter( module );
    
   for ( i in ga.altfile.bdata[ module ] ) {
      if ( ga.altfile.bdata[ module ][ i ].req  ) {
	  //console.log( "ga.altfile.bdata[ module ][ i ].req = " +  ga.altfile.bdata[ module ][ i ].req);
          switch ( ga.altfile.bdata[ module ][ i ].req ) {
              case "lrfile" : ok = ok && ga.valid.checkLrfile( "#" + i ); if ($("#" + i).length && !ga.valid.checkLrfile( "#" + i )) {++ga.fielderrors[module];} break;
              case "rpath"  : ok = ok && ga.valid.checkRpath ( "#" + i ); if ($("#" + i).length && !ga.valid.checkRpath ( "#" + i )) {++ga.fielderrors[module];} break;
              case "rfile"  : ok = ok && ga.valid.checkRfile ( "#" + i ); if ($("#" + i).length && !ga.valid.checkRfile ( "#" + i )) {++ga.fielderrors[module];} break;
              default       : console.log( "ga.valid.checksubmit() unsupported required check " +  ga.altfile.bdata[ module ][ i ].req ); break;
          }
      }
   }
    
    for ( i in ga.value.types[ module ] ) {
	if ( ga.value.types[ module ][ i ].req  ) {
	    //console.log( "ga.value.types[ module ][ i ].req = " +  ga.value.types[ module ][ i ].req);
            switch ( ga.value.types[ module ][ i ].req ) {
	    case "float": 
		if ($("#" + i).length && !ga.valid.checkFloat( "#" + i )) {++ga.fielderrors[module];}
		break;
	    case "integer": 
		if ($("#" + i).length && !ga.valid.checkInt( "#" + i )) {++ga.fielderrors[module];}
		break;
	    case "text": 
		if ($("#" + i).length && !ga.valid.checkText( "#" + i )) {++ga.fielderrors[module];} 
		//console.log( "pattern of " + i + ": " + $('#'+i).attr("pattern") );
		//console.log( "text_req Check: " +  ga.valid.checkText( "#" + i ));
		break;	
	    case "file": 
		if ($("#" + i).length && !ga.valid.checkLrfile( "#" + i )) {++ga.fielderrors[module];}
		break;
	    default: 
		console.log( "ga.valid.checksubmit() unsupported required check " +  ga.value.types[ module ][ i ].req ); break;
		
	    }
	}
    }
    
    if (ga.fielderrors[module] > 0)
    {
   	ok = 0;
    }
    
    //console.log( "ga.fielderrors = " + ga.fielderrors[module] );     
    return ok;
}

ga.valid.showerrormessage = function( module ) {
    ga.msg.box( {
	icon : "warning.png",
	text : "" + ga.fielderrors[ module ] + " fields are missing or not set correctly!",
	buttons : [
	    { id    : "ok",
	      label : "OK" } ]
    });
    ga.fielderrors[ module ] = 0;
}

ga.valid.clearerrorcounter = function( module ) {
    ga.fielderrors[ module ] = 0;
}


ga.airavata = {};
ga.airavata.select = function( defaultresource, select, cb, form ) {
    var a            = ga.airavata.data
        ,msg         = ""
        ,button_info = []
        ,i
        ,key
        ,selecttype
        ,index
    ;
    
    

    if ( ( defaultresource == "__resource__" && !a.defaultresource ) ||
         ( defaultresource != "airavata" && defaultresource != "__resource__" ) ) {
        
        return "notused";
    }

    if ( !a.resources || !a.resources.length ) {
        ga.msg.box( {
            icon  : "warning.png"
            ,text  : "No resources currently enabled for Airavata submission"
        });
        return "abort";
    }

    if ( a.resources.length == 1 ) {
        
        return Object.keys( a.resources[ index ] )[0];
    }

    selecttype = select != "__airavataselect__" ? select : ( a.select.length ? a.select : "random" );
    

    switch( selecttype ) {
        case "random" : 
        {
            index = Math.floor( a.resources.length * Math.random() );
            ;
            // bug: index is undefined
            return Object.keys( a.resources[ index ] )[0];
        }
        break;
        case "choose" : 
        {
            button_info.push( {
                id : "submit_module"
                ,label : "Submit"
                ,data  : [ cb, form, a.resources ]
                ,cb    : function( data ) { 
                    
                    
                    data[0]( data[1], Object.keys( data[2][$( "#airavata input[name=selectresource]:checked" ).val() ] )[0] );
                }
            } );
            msg = '<h3>Select a compute resource and press submit</h3><form id="airavata"><table>';
            for ( i in a.resources ) {
                for ( key in a.resources[i] ) {
                    msg += '<tr><td><input type="radio" name="selectresource" id="airavata_' + i + '" value="' + i + '"' + ( i==0 ? 'checked="checked"' : '' ) + '></td><td class="hoverhighlight" style="text-align:left"><label for="airavata_' + i + '">' +  a.resources[i][key] + '</label></td></tr>';
                }
            }
            msg += '</table>';

            ga.msg.box( {
                icon     : "question.png"
                ,text    : msg
                ,buttons : button_info
            });
            return "deferred";
        }
        break;
        default :
        {
            ga.msg.box( {
                icon  : "toast.png"
                ,text  : "ga.airavata.select, unknown selection type '" + selecttype + "'"
            });
            return "abort";
        }
    }
}
        
ga.resource = {};

ga.xsede = {};

ga.resource.xsedeprojecttokeys = function() {
    var i;
    ga.resource.xsedepkeys = {};
    for ( i in ga.resource.xsedeproject ) {
        ga.resource.xsedepkeys[ ga.resource.xsedeproject[ i ] ] = 1;
    }
}

ga.xsede.select = function( defaultresource, cb, form ) {
    var a        = ga.xsede.data
        ,resource = defaultresource == "__resource__" ? ga.resource.defaultval : defaultresource    
        ,msg         = ""
        ,button_info = []
        ,i
        ,key
    ;
    
    

    delete ga.xsede.useproject;

    if ( !ga.resource.xsedeproject || !( resource in ga.resource.xsedepkeys ) ) {
        
        return cb( form );
    }

    if ( !a || !a.length ) {
        ga.msg.box( {
            icon  : "warning.png"
            ,text  : "No XSEDE projects currently defined.  Create one under the user configuration button at the top right."
        });
        return "abort";
    }

    if ( a.length == 1 ) {
        
        ga.xsede.useproject = a[ 0 ];
        return cb( form );
    }

    button_info.push( {
        id : "submit_xsedeproject"
        ,label : "Submit"
        ,data  : [ cb, form, a ]
        ,cb    : function( data ) { 
            ga.xsede.useproject = data[2][$( "#xsedeproject input[name=selectxsedeproject]:checked" ).val() ];
            
            data[0]( data[1] );
        }
    } );
    msg = '<h3>Select an XSEDE project and press submit</h3><form id="xsedeproject"><table>';
    for ( i in a ) {
        msg += '<tr><td><input type="radio" name="selectxsedeproject" id="xsedeproject_' + i + '" value="' + i + '"' + ( i==0 ? 'checked="checked"' : '' ) + '></td><td class="hoverhighlight" style="text-align:left"><label for="xsedeproject_' + i + '">' +  a[i] + '</label></td></tr>';
    }
    msg += '</table>';

    ga.msg.box( {
        icon     : "question.png"
        ,text    : msg
        ,buttons : button_info
    });
    return "deferred";
}
/*jslint white: true, plusplus: true*/
/* assumes: jquery > 1.11.0, jqtree >= 3.0.9, jquery-base64 */

ga.value = {};
ga.value.settings = {};

ga.value.checkFloatIntOK = function( tag, value ) {
    var t = $( tag );
     
    if ( isNaN( value[0] ) )
    {
	t.val( t.prop( "defaultValue" ) );
	
	return false;
	
    } else {
	if (t.data('type') == "float")
	{
	    if ( value[0] < parseFloat ( t.attr( "min" ) ) )
	    { 
		
		value.splice(0, value.length)
		value.push( t.attr( "min" ) );
	    } else {
		if ( value[0] > parseFloat ( t.attr( "max" ) ) )
		{ 
		    
		    value.splice(0, value.length)
		    value.push( t.attr( "max" ) );
		} else {
		    $( tag + "_msg" ).empty();
		}
	    }
	}
	else
	{
	    if ( t.data('type') == "integer" )
	    {   
		if ( value[0] < parseInt ( t.attr( "min" ) ) )
		{ 
		    
		    value.splice(0, value.length)
		    value.push( t.attr( "min" ) );
		} else {
		    if ( value[0] > parseInt ( t.attr( "max" ) ) )
		    { 
			
			value.splice(0, value.length)
			value.push( t.attr( "max" ) );
		    } else {
			if ( parseInt( value[0] ) != value[0])
			{			
			    
			    var temp_int = value[0]; 
			    value.splice(0, value.length);
			    value.push( parseInt( parseFloat( temp_int ) + .5 ) );
			} else {
			    $( tag + "_msg" ).empty();
			}
		    }
		}
	    }
	}
    }
    return true;
}


ga.value.sethiddenfields = function(multistage, mod){
var ids_array = [], i;
    
    $.each(multistage[mod], function(k, v) {
	$.each(v, function(k, v) {
	  //console.log(v);
	  ids_array.push(v); 
	});    
    });
    ids_array = ga.repeat.map.convert( ids_array );

    for (i=0; i < ids_array.length; i++) {
	if ( $("#" + ids_array[i]).data("repeater") )
	{
	    //console.log("Repeater's ID: " + ids_array[i]);
	    $("#" + ids_array[i] + "-repeater").hide();
	}
	$('#' + ids_array[i] + ', label[for=' + ids_array[i] + ']').hide();  
    }
}

ga.value.showfields = function(multistage, mod, stages, currentstage){
var ids_array = [], i;
    
    $.each(multistage[mod], function(k, v) {
	console.log(k);

	if( k == stages[currentstage]) {
	    
	    $.each(v, function(k, v) {
		console.log(v);
		ids_array.push(v); 
	    });
	}	
	
    });
    for (i=0; i < ids_array.length; i++) {
	if ( $("#" + ids_array[i]).data("repeater") )
	{
	    //console.log("Repeater's ID: " + ids_array[i]);
	    $("#" + ids_array[i] + "-repeater").show();
	}
	$('#' + ids_array[i] + ', label[for=' + ids_array[i] + ']').show();  
    }
}

ga.value.modifyformdata =  function(multistage, mod, formData, stages, currentstage){
var ids_array = [],
    i,
    j,
    children,
    t;
   
    console.log(stages);
    $.each(multistage[mod], function(k, v) {
	console.log(k);
	
	if(jQuery.inArray(k, stages) !== -1) {
	    
	  $.each(v, function(k, v) {
	    //console.log(v);
	    ids_array.push(v); 
	  });
	}
    });
    ids_array = ga.repeat.map.convert( ids_array );

    for (i=0; i < ids_array.length; i++) {
	if ( $("#" + ids_array[i]).data("repeater") )
	{
           //ga.repeat.change(mod, ids_array[i]);
	   children = ga.repeat.children( mod, ids_array[i] );
	   
	   for ( j in children ) {         
               t = ids_array[i] + "-" + j; // For CHECKBOXES for now... 
	   	//console.log(t);
	       formData.delete( t );
	   }
	}
	formData.delete( ids_array[i] );  
    }
    formData.append( "currentstage" , ga.stages[mod][currentstage]  );  
}



ga.value.processInputfromFiles = function (text, mode, ids_array, mod){
    var lines = text.trim().split(/[\r\n]+/g);
    var linesContent = [];
    var cumulativeContent = 0;

    ids_array = ga.repeat.map.convert( ids_array );

    for (var i=0; i<lines.length; i++)
    {
	var line_separated = lines[i].trim().split(/\s+/);
	cumulativeContent += line_separated.length;
	linesContent.push(cumulativeContent);
    }
    
    //var elements = text.trim().split(/\s+/);
    var elements = [];
    var contrastrepel = [];
    var dissolrepel = [];
    var unitrepel_1 = [];
    var unitrepel_2 = [];
    var repeat_hash_init = [];
    var repeat_hash = [];
    var lineNumberErr = 0;
    
    switch (mode)
    {
    case "whitespace_formulchcompost":
	var lines_formulchcontrast  = [];
	for (var i=0; i<lines.length; i++)
	{
	    var line_split = lines[i].split('#')[0];
	    
	    //line_split.trim();                            // simple trim does not work..
	    line_split = line_split.replace(/\s{2,}/g, ' ');
	    line_split = line_split.replace(/\t/g, ' ');
	    line_split = line_split.toString().trim().replace(/(\r\n|\n|\r)/g,"");
	    //console.log ("The line is: " + line_split);
	
	    lines_formulchcontrast.push(line_split);
	}
	var repeater_start_1 = parseInt(lines_formulchcontrast[1]);
	
	var item;
	for (var i=0; i < lines_formulchcontrast.length; i++)
	{
	    if ( (i > 2) && (i < 3 + repeater_start_1) )
	    {
		item = lines_formulchcontrast[i].trim().split(/\s+/);
		for (var k=0; k < item.length; k++)
		{		    
		    contrastrepel.push(item[k]);
		}
		continue;
	    }
	    //console.log ("Elements: " + lines_formulchcontrast[i]);
	    elements.push(lines_formulchcontrast[i]);
	}

	//console.log("Size of Contrast: " + contrastrepel.length);
	repeat_hash.push(contrastrepel); 


	for (var i=0; i < ids_array.length; i++) {
	    switch ( $("#" + ids_array[i]).attr("type") )
	    {
	    case "text":
		var reg = new RegExp($("#" + ids_array[i]).attr("pattern"));
		if ( !reg.test(elements[i]) )
		{
		    
		    ga.msg.box( {
			icon : "warning.png",
			text : "Wrong format of the input file! Input value on the line #" + lineNumberErr + " is not a valid number. Options are: [Integer | Float point number | Number with exponent]. Check your input file",
			buttons : [
			    { id    : "ok",
			      label : "OK" } ]
		    });
		    return;
		}
		break;
	    case "number":
		var value = [elements[i]];
		//console.log( "Number: " +  elements[i]);
		if ( !( ga.value.checkFloatIntOK("#" + ids_array[i], value) ) )
		{
		    ga.msg.box( {
			icon : "warning.png",
			text : "Wrong format of the input file! Input value on the line #" + lineNumberErr + " is not a valid number. Options are: [Integer | Float point number | Number with exponent]. Check your input file",
			buttons : [
			    { id    : "ok",
			      label : "OK" } ]
		    });
		    return;	
		}
		else
		{
		    elements[i] = value[0];
		    //console.log( "Number is: " +  elements[i]);
		}
		break;	
	    default:
		ga.msg.box( {
		    icon : "warning.png",
		    text : "Selected input type is currently not supported. Contact the developer",
		    buttons : [
			{ id    : "ok",
			  label : "OK" } ]
		});
		return;
		break;
	    }
	}
	break;	

    case "whitespace_formulchrg":
    case "whitespace_formulchcontrast":
    	var lines_formulchcontrast  = [];
	for (var i=0; i<lines.length; i++)
	{
	    var line_split = lines[i].split('#')[0];
	    
	    //line_split.trim();                            // simple trim does not work..
	    line_split = line_split.replace(/\s{2,}/g, ' ');
	    line_split = line_split.replace(/\t/g, ' ');
	    line_split = line_split.toString().trim().replace(/(\r\n|\n|\r)/g,"");
	    //console.log ("The line is: " + line_split);
	
	    lines_formulchcontrast.push(line_split);
	}
		
	var repeater_start_1 = parseInt(lines_formulchcontrast[1]);
	var repeater_start_2 = parseInt(lines_formulchcontrast[ 2 + repeater_start_1 ] );
	var repeater_start_3 = parseInt(lines_formulchcontrast[ 5 + repeater_start_1 + repeater_start_2 ]);
	var repeater_start_4 = parseInt(lines_formulchcontrast[ 9 + repeater_start_1 + repeater_start_2 + repeater_start_3]);

	var item;
	for (var i=0; i < lines_formulchcontrast.length; i++)
	{
	    if ( (i > 1) && (i < 2 + repeater_start_1) )
	    {
		item = lines_formulchcontrast[i].trim().split(/\s+/);
		for (var k=0; k < item.length; k++)
		{		    
		    contrastrepel.push(item[k]);
		}
		continue;
	    }
	    if ( (i > 2 + repeater_start_1) && (i < 3 + repeater_start_1 + repeater_start_2) ) 
	    {
		item = lines_formulchcontrast[i].trim().split(/\s+/);
		//for (var k=0; k < item.length; k++)
		//{		    
		//    dissolrepel.push(item[k]);
		//}
		dissolrepel.push(item[1]);
		dissolrepel.push(item[2]);
		dissolrepel.push(item[0]);
		dissolrepel.push(item[3]);
		continue;
	    }
	    if ( (i > 5 + repeater_start_1 + repeater_start_2) && (i < 6 + repeater_start_1 + repeater_start_2 + repeater_start_3) ) 
	    {
		item = lines_formulchcontrast[i].trim().split(/\s+/);
		//for (var k=0; k < item.length; k++)
		//{		    
		//    unitrepel_1.push(item[k]);
		//}
		unitrepel_1.push(item[1]);
		unitrepel_1.push(item[2]);
		unitrepel_1.push(item[0]);
		unitrepel_1.push(item[3]);
		continue;
	    }
	    if ( (i > 8 + repeater_start_1 + repeater_start_2 + repeater_start_3) && (i < 9 + repeater_start_1 + repeater_start_2 + repeater_start_3 + repeater_start_4) ) 
	    {
		item = lines_formulchcontrast[i].trim().split(/\s+/);
		//for (var k=0; k < item.length; k++)
		//{		    
		//    unitrepel_2.push(item[i]);
		//}
		unitrepel_2.push(item[1]);
		unitrepel_2.push(item[2]);
		unitrepel_2.push(item[0]);
		unitrepel_2.push(item[3]);
		continue;
	    }	    
	    //console.log ("Elements: " + lines_formulchcontrast[i]);
	    elements.push(lines_formulchcontrast[i]);
	}

	//console.log("Size of Contrast: " + contrastrepel.length);
	repeat_hash_init.push(contrastrepel);
	repeat_hash_init.push(dissolrepel);
	repeat_hash_init.push(unitrepel_1);
	repeat_hash_init.push(unitrepel_2);

	//console.log ("Size of Hash INIT array: " + repeat_hash_init.length);
	var rep_counter_check = 0;
	//for (var i=0; i < elements.length; i++) {

	//console.log("Ids_array: " + ids_array.length);
	for (var i=0; i < ids_array.length; i++) {
	    if ( !$("#" + ids_array[i]).length )
	    {
		rep_counter_check++;
		continue;
	    }
	    if ( $("#" + ids_array[i]).data("repeater") )
	    {
		repeat_hash.push(repeat_hash_init[rep_counter_check]);
		//console.log ("Size of Hash array: " + repeat_hash.length + "; repeter #: " + rep_counter_check );
		rep_counter_check++;
	    }
	    

	    //console.log("ID: " + ids_array[i] + ";  Type: " + $("#" + ids_array[i]).attr("type") );
	    //console.log("ID: " + ids_array[i] + ";  Length: " + $("#" + ids_array[i]).length );
	    
	    switch ( $("#" + ids_array[i]).attr("type") )
	    {
	    case "text":
		var reg = new RegExp($("#" + ids_array[i]).attr("pattern"));
		if ( !reg.test(elements[i]) )
		{
		    
		    ga.msg.box( {
			icon : "warning.png",
			text : "Wrong format of the input file! Input value on the line #" + lineNumberErr + " is not a valid number. Options are: [Integer | Float point number | Number with exponent]. Check your input file",
			buttons : [
			    { id    : "ok",
			      label : "OK" } ]
		    });
		    return;
		}
		break;
	    case "number":
		var value = [elements[i]];
		//console.log( "Number: " +  elements[i]);
		if ( !( ga.value.checkFloatIntOK("#" + ids_array[i], value) ) )
		{
		    ga.msg.box( {
			icon : "warning.png",
			text : "Wrong format of the input file! Input value on the line #" + lineNumberErr + " is not a valid number. Options are: [Integer | Float point number | Number with exponent]. Check your input file",
			buttons : [
			    { id    : "ok",
			      label : "OK" } ]
		    });
		    return;	
		}
		else
		{
		    elements[i] = value[0];
		    //console.log( "Number is: " +  elements[i]);
		}
		break;	
	    default:
		ga.msg.box( {
		    icon : "warning.png",
		    text : "Selected input type is currently not supported. Contact the developer",
		    buttons : [
			{ id    : "ok",
			  label : "OK" } ]
		});
		return;
		break;
	    }
	}
	break;
    case "whitespaceseparated":
    case "whitespaceseparated_reverselogic":

	elements = text.trim().split(/\s+/);
	
	

	if (elements.length == ids_array.length)
	{
	    for (var i=0; i < elements.length; i++) {
		for (var j=0; j < linesContent.length; j++)
		{
		    if ( i+1 <= linesContent[j] ){
			lineNumberErr = j + 1;
			break;
		    }
		}
		
		
		
		switch ( $("#" + ids_array[i]).attr("type") )
		{
		case "checkbox":
		    var options = "^(0|1|n|y|true|false|t|f|yes|no)$"; 
		    var reg = new RegExp(options);
		    if ( !reg.test(elements[i].toLowerCase()) )
		    {
			
			ga.msg.box( {
			    icon : "warning.png",
			    text : "Wrong format of the input file! Checkbox input value on the line #" + lineNumberErr + " is not valid. Options are: [1 | 0 | yes | no | true | false | t | f | T | F | y | n | Y | N ]. Check your input file",
			    buttons : [
				{ id    : "ok",
				  label : "OK" } ]
			});
			return;
		    }
		    break;
		case "number":
		    var value = [elements[i]];
		    if ( !( ga.value.checkFloatIntOK("#" + ids_array[i], value) ) )
		    {
			ga.msg.box( {
			    icon : "warning.png",
			    text : "Wrong format of the input file! Input value on the line #" + lineNumberErr + " is not a valid number. Options are: [Integer | Float point number | Number with exponent]. Check your input file",
			    buttons : [
				{ id    : "ok",
				  label : "OK" } ]
			});
			return;	
		    }
		    else
		    {
			elements[i] = value[0];
		    }
		    break;			    
		case "text":
		    var reg = new RegExp($("#" + ids_array[i]).attr("pattern"));
		    if ( !reg.test(elements[i]) )
		    {
			
			ga.msg.box( {
			    icon : "warning.png",
			    text : "Wrong format of the input file! Input value on the line #" + lineNumberErr + " is not a valid number. Options are: [Integer | Float point number | Number with exponent]. Check your input file",
			    buttons : [
				{ id    : "ok",
				  label : "OK" } ]
			});
			return;
		    }
		    break;
		default:
		    ga.msg.box( {
			icon : "warning.png",
			text : "Selected input type is currently not supported. Contact the developer",
			buttons : [
			    { id    : "ok",
			      label : "OK" } ]
		    });
		    return;
		    break;
		}
	    }
	}
	else
	{
	    ga.msg.box( {
		icon : "warning.png",
		text : "Wrong format of the input file! Number of parameters is inconsistent with the model chosen. Check your parameter file",
		buttons : [
		    { id    : "ok",
		      label : "OK" } ]
	    });
	    return;
	}
	break;
    default:
	ga.msg.box( {
	    icon : "warning.png",
	    text : "Selected file parsing mode is currently not supported. Contact the developer",
	    buttons : [
		{ id    : "ok",
		  label : "OK" } ]
	});
	return;
	break;
    }
    
    /// Filling the values form file /////////////////////////////////////////
    
    //console.log("NUMBER elements array: " + elements.length + "; #ids: " + ids_array.length);
    var repeater_counter=0;
    for (var i=0; i < elements.length; i++) {
	switch ( $("#" + ids_array[i]).attr("type") )
	{
	case "checkbox" :
	    if (mode.indexOf('reverselogic') >= 0)
	    {
		switch ( elements[i].toLowerCase() )
		{
		case "0":
		case "false":
		case "f":
		case "n":
		case "no":
		    $("#" + ids_array[i]).prop( "checked", true );
		    break;
		case "1":
		case "true":
		case "t":
		case "yes":
		case "y":
		case "r":
		    $("#" + ids_array[i]).prop( "checked", false ); 
		    break;
		}
	    }
	    else
	    {
		switch ( elements[i].toLowerCase() )
		{
		case "0":
		case "false":
		case "f":
		case "n":
		case "no":
		    $("#" + ids_array[i]).prop( "checked", false );
		    break;
		case "1":
		case "true":
		case "t":
		case "yes":
		case "y":
		case "r":
		    $("#" + ids_array[i]).prop( "checked", true ); 
		    break;		
		}
	    }
	    
	default:
	    //
	    $("#" + ids_array[i]).val(elements[i]);
	    $("#" + ids_array[i]).prop( "defaultValue", elements[i]);
	    break;
	}
	if ( $("#" + ids_array[i]).data("repeater") )
	{
	    ga.repeat.change(mod,ids_array[i]);
	    // get children
	    children = ga.repeat.children( mod, ids_array[i] );
	    var val = $("#" + ids_array[i]).val();
	    
	    var curr_repeat = 0;
	    var current_child_for_given_rep = 0;
	    for ( j = 1; j <= val; ++j)
	    {
		current_child_for_given_rep = 0;
		for ( t in children ) 
		{
		    var repeat_value = repeat_hash[repeater_counter][curr_repeat];
		    k = ids_array[i] + "-" + t + "-" + ( j - 1 );
		    ++current_child_for_given_rep;
		   
		    if ((mode == "whitespace_formulchrg" || mode == "whitespace_formulchcompost") && current_child_for_given_rep==1)
			continue;
		    if (mode == "whitespace_formulchcompost" && current_child_for_given_rep==2)
		    {
			//console.log("checkbox: " + repeat_value.toLowerCase());
			if (repeat_value.toLowerCase() == "r")
			    $("#" + k).prop( "checked", true );
			if (repeat_value.toLowerCase() == "f")
			    $("#" + k).prop( "checked", false );
			curr_repeat++;
		     	continue;
		    }
		    if (mode == "whitespace_formulchcompost" && current_child_for_given_rep==5)
		    {
			curr_repeat++;
		     	continue;
		    }
		    //console.log( "child's ids: " + k + "; Child's type: " +  $("#" + k).attr("type"));
		    //$("#" + k).val("Test Value");
		    $("#" + k).val(repeat_value);
		    curr_repeat++;
		}
	    }
	    ga.repeat.change(mod,ids_array[i]);
	    repeater_counter++;
	    //}
	    // break;
	}
    }
}


ga.value.input = {}

ga.value.setInputForRFile = function(module, tag, id, mode, ids) {
    ga.value.input[ module ]          = ga.value.input[ module ] || {};
    ga.value.input[ module ][id]      = {};
    ga.value.input[ module ][id].id   = id;
    ga.value.input[ module ][id].tag  = tag;
    ga.value.input[ module ][id].mode = mode;
    ga.value.input[ module ][id].ids  = ids;

}

ga.value.types = {}

ga.value.registerid = function(module, id, label, required) {
    ga.value.types[ module ]          = ga.value.types[ module ] || {};
    ga.value.types[ module ][id]      = {};
    ga.value.types[ module ][id].id   = id;
    ga.value.types[ module ][id].label = label;
    ga.value.types[ module ][id].req  = required || 0;
}



ga.value.setInputfromRFile = function(path, mode, ids, mod){ 
    var ids_array = ids.split(',');
    var username = $( '#_state' ).data('_logon');
    var actual_path = 'results/users/' + username + '/' + path;
    
    
    
    $.get(actual_path, function(text){
	
	ga.value.processInputfromFiles(text, mode, ids_array, mod);
	
    }, "text");
}


ga.value.setInputfromFile = function( tag, mode, ids, mod ) {
    $(tag).hide();
       
    var ids_array = ids.split(',');
    $(tag).change( function(e) {
	var file = $( tag )[0].files[0];
	
	//console.log ("Module from setformfile: " + mod);
	var reader = new FileReader();
	
	reader.onload = function(evt) {
            var text = evt.target.result;
	    
	    ga.value.processInputfromFiles(text, mode, ids_array, mod);
	    
	}
	reader.readAsText(file);
    })
}
		

ga.value.setLastValue = function( pkg, tag, defval ) {
    var tl = pkg + ":" + tag + ":last_value";
    var dv = pkg + ":" + tag + ":default_value";
    var t = $( tag );
    var p2d;
    if ( !/_output$/.test( pkg ) ) {
        return false;
    }

    if ( $( "#global_data" ).data( tl ) == undefined ) {
        switch( t.attr( "type" ) )
        {
            case "checkbox" :
            case "radio" :
                $( "#global_data" ).data( tl, t.is( ":checked") );
                $( "#global_data" ).data( dv, t.is( ":checked") ); break;
            case "div" : 
            case "msgs" : 
                $( "#global_data" ).data( tl, t.html() ); 
                $( "#global_data" ).data( dv, t.html() );
                break;
            case "plot3d" :
            case "plotly" :
	    
	        var tag_s = tag;
	        tag_s = tag_s.replace(/^#/, "");
	    
	        Plotly.newPlot(tag_s,[],{});
	        Plotly.purge(tag_s);
	        break;
	    case "plot2d" :
               
               
               break;
	    case "ngl" :
               ga.ngl.clear( tl, tag );
               break;
            case "bokeh" :
               
               
               ga.bokeh.renderdata( pkg, tag.replace( /^#/, "" ) );
               break;
            case "filelink" :
            case "filelinkm" :
                $( "#global_data" ).data( tl, $( tag + "_filelink" ).html() );

                break;

            default : 
                      if ( defval )
                      {

                         t.val( defval );
                      }                         

                      $( "#global_data" ).data( tl, t.val() );
                      $( "#global_data" ).data( dv, t.val() );
                      break;
        }
    } else {
        switch( t.attr( "type" ) )
        {
            case "checkbox": 
            case "radio": 
                   t.prop( "checked", $( "#global_data" ).data( tl ) ); break;
            case "div" : 
            case "msgs" : t.html( $( "#global_data" ).data( tl ) ); break;
            case "atomicstructure" : 
                  var stag = tag.replace( /^#/, "" );

                  if ( $( "#global_data" ).data( tl ) ) {

                      _jmol_info[ stag ].script = $( "#global_data" ).data( tl );

                      t.html(Jmol.getAppletHtml( "jmolApplet" + stag,  _jmol_info[ stag ] ) );

                  } else {

                      t.empty();
                  }
                  break;

            case "plot2d" : 


                     p2d = gd.data( tl );
                     if ( p2d.data ) {
                         ga.value.set.plot2d( tag, p2d.options );
                         t.plot( p2d.data, ga.value.get.plot2d.plot_options( tag, p2d.options ) );
                     } else {
                         t.plot( p2d, ga.value.get.plot2d.plot_options( tag ) );
                     }
                     break;
            case "plot3d" : 
            case "plotly" : 
            
                     var ptly = gd.data( tl );
                     if ( ptly.data ) {
	                 Plotly.plot(tag.replace( /^#/, "" ), ptly.data, ptly.layout);
                     }
                     break;
            case "bokeh" : 
                    
                    
                     break;
            case "ngl" : 
                var ngld = gd.data( tl );
                if ( ngld ) {
                    ga.value.nglshow( pkg, tag.replace(/^#/, ""), ngld );
                }
                break;
            case "filelink" : 
            case "filelinkm" : 
                     $( tag + "_filelink" ).html( $( "#global_data" ).data( tl ) );
                     break;
            default: 

            
            t.val( $( "#global_data" ).data( tl ) );
            break;
        }
    }
}

ga.value.saveLastValue = function( pkg, tag ) {
   var t = $( tag );

   switch( t.attr( "type" ) )
   {
       case "file" :  return; break;
       case "checkbox" :
       case "radio" :
                     $( "#global_data" ).data( pkg + ":" + tag + ":last_value", t.is( ":checked") ); break;
       case "div" :
       case "msgs" : $( "#global_data" ).data( pkg + ":" + tag + ":last_value", t.html() ); break;
       case "plot2d" : 

                       break;
       case "bokeh" : 
            
            break;
       case "filelink" : 
       case "filelinkm" : 
                     $( "#global_data" ).data( pkg + ":" + tag + ":last_value", $( tag + "_filelink" ).html() ); 
                     break;
       case "atomicstructure" : 
                     var stag = tag.replace( /^#/, "" );

                     if ( _jmol_info && _jmol_info[ stag ] && _jmol_info[ stag ].length ) {

                         $( "#global_data" ).data( pkg + ":" + tag + ":last_value", _jmol_info[ stag ].script ); 
                     } else {

                         $( "#global_data" ).data( pkg + ":" + tag + ":last_value", "" ); 
                     }
                     break;
       default: $( "#global_data" ).data( pkg + ":" + tag + ":last_value", t.val() ); break;
   }


}

ga.value.saveLastValues = function( pkg ) {

   $( "#" + pkg + " :input" ).each(function() {

      ga.value.saveLastValue( pkg, "#" + $( this ).attr( "id" ) );
   });
}

ga.value.resetDefaultValue = function( pkg, tag ) {

    
   var t = $( tag );
   var tl;


   if(  t.prop( "tagName" ) == 'SELECT' ) {
    t.val( $( "#global_data" ).data( pkg + ":" + tag + ":default_value" ) );
   } else {
      switch( t.attr( "type" ) )
      {
          case "ngl" : {
              tl = pkg + ":" + tag + ":last_value"; 
              ga.ngl.clear( tl, tag );

//              tl = pkg + ":" + tag + ":last_value"; 
//              if ( ga.stage[ tl ] ) {
//                  ga.stage[ tl ].dispose();
//                  delete ga.stage[ tl ];
//              }
//              $( tag + "_plot" ).empty(); 
//              $( "#global_data" ).removeData( tl ); 
          }
          break;

          case "file" :  return; break;
          case "checkbox" : 
                        $( "#global_data" ).removeData( pkg + ":" + tag + ":repeat:count" );

          case "radio" : 
                        t.prop( "checked", $( "#global_data" ).data( pkg + ":" + tag + ":default_value" ) ); break;
          case "div" :
          case "msgs" : t.html( $( "#global_data" ).data( pkg + ":" + tag + ":default_value" ) ); 
                        break;
          case "filelink" :
          case "filelinkm" :
                        $( tag + "_filelink" ).html( " " );
                        break;
          case "plot2d" : 

	                console.log( "ga.value.resetDefaultValue() plot2d, t is " + tag );
                        $( "#global_data" ).data( pkg + ":" + tag + ":last_value", [[]] );
                        ga.value.clear.plot2d( tag );
                        t.plot( [[]], ga.value.get.plot2d.plot_options( tag ) ); 
	                //if (ga.showcollapse2d)
	               if($( tag + "_showcollapse" ).length)
	                {
			    $( tag + "_div").hide(); 
			    
			    if( $( tag + "_savetofile").length )
			    {
				$( tag + "_savetofile").hide();
				$( tag + "_savetofile_link").hide();
			    } 
			    if( $( tag + "_changescalex").length )
			    {
				$( tag + "_changescalex").hide();
				$( tag + "_changescalex_message").hide();
			    } 
			    if( $( tag + "_changescaley").length )
			    {
				$( tag + "_changescaley").hide();
				$( tag + "_changescaley_message").hide();
		            }
			    if ( $( tag + "_showcollapse" ).length )
			    {
				$(tag + "_showcollapse").addClass( "hidden" );
			    }
			}
                        break;
          case "bokeh" :
              
              ga.bokeh.reset( pkg, tag.replace( /^#/, "" ) );
              break;
	  case "plot3d" :
	  case "plotly" :
	      console.log( "reset default value for plot3d: " + tag );
	      Plotly.purge(tag.replace( /^#/, "" ));
	      if ( $( tag + "_showcollapse" ).length )
		{
		    $(tag + "_showcollapse").addClass( "hidden" );
		}
	      break;
          case "image" : 
          
          t.empty();
          break;
          case "video" : 
          
          t.empty();
          break;

          case "atomicstructure" : 
                        var stag = tag.replace( /^#/, "" );

                        $( "#global_data" ).data( pkg + ":" + tag + ":last_value", "" );
                        $( tag ).empty();
                        break;
          default: t.val( t.attr( "value" ) ); break;
      }
   }
   ga.value.saveLastValue( pkg, tag );
   $( tag + "_msg" ).empty();
}

ga.value.resetDefaultValues = function( pkg, msgs ) {
    
    
    var i,
    hmod_textarea;
    if ( !/_output$/.test( pkg ) ) {
        return false;
    }

    $( "#" + pkg + " :input" ).each(function() {
        ga.value.resetDefaultValue( pkg, "#" + $( this ).attr( "id" ) );
    });
    ga.sync.reset( pkg );
    for ( i in ga.value.extra_resets.data ) 
    {
        
        ga.value.resetDefaultValue( pkg, "#" + i );
    }
    if ( msgs ) {
        ga.value.resetDefaultValue( pkg, "#" + pkg + "_msgs" );
        hmod_textarea = "#" + pkg + "_textarea";
        ga.value.resetDefaultValue( pkg, hmod_textarea );
        $( hmod_textarea ).hide();
        $( hmod_textarea + "_label" ).hide();
    }
}

ga.value.extra_resets = function( id ) {
    
    
    ga.value.extra_resets.data = ga.value.extra_resets.data || {};
    ga.value.extra_resets.data[ id ] = 1;
}

ga.value.extra_resets.clear = function() {
    
    
    ga.value.extra_resets.data = {};
}
    
ga.value.setLastValueOutput = function( mod ) {

    var hmod            = "#" + mod,
        hmod_textarea   = hmod + "_textarea",
        jqhmod_textarea = $( hmod_textarea );

    ga.value.setLastValue( mod, hmod + "_msgs" );
    ga.value.setLastValue( mod, hmod_textarea );
    if ( jqhmod_textarea.val() ) {

        jqhmod_textarea.show();
        $( hmod_textarea + "_label" ).show(); 
        jqhmod_textarea.height( parseFloat( jqhmod_textarea.prop( 'scrollHeight' ) ) + 
                                parseFloat( jqhmod_textarea.css ( 'borderTopWidth' ) ) + 
                                parseFloat( jqhmod_textarea.css ( 'borderBottomWidth' ) ) );
    } else {

        jqhmod_textarea.hide();
        $( hmod_textarea + "_label" ).hide();
    }
}
    
ga.value.get = {};
ga.value.set = {};
ga.value.clear = {};

ga.value.set.plot2d = function( tag, options ) {

    var tagtitle  = tag + "_title",
        tagxlabel = tag + "_xlabel",
        tagylabel = tag + "_ylabel";





    $( tagtitle  ).html( options.title  ? options.title  : "");
    $( tagxlabel ).html( options.xlabel ? options.xlabel : "");
    $( tagylabel ).html( options.ylabel ? options.ylabel : "");
}

ga.value.clear.plot2d = function( tag ) {

    var tagtitle  = tag + "_title",
        tagxlabel = tag + "_xlabel",
        tagylabel = tag + "_ylabel";
        tagxy     = tag + "_xy";

    $( tagtitle  ).empty();
    $( tagxlabel ).empty();
    $( tagylabel ).empty();
    $( tagxy     ).empty();
}


ga.value.set.plot2d.pan = function( tag, value ) {

    ga.value.settings[ tag ] = ga.value.settings[ tag ] || {};
    ga.value.settings[ tag ].pan = value ? true : false;
}

ga.value.set.plot2d.zoom = function( tag, value, pkg ) {

    var tagtitle  = tag + "_title",
        tagxlabel = tag + "_xlabel",
        tagylabel = tag + "_ylabel";
        tagxy     = tag + "_xy";

    ga.value.settings[ tag ] = ga.value.settings[ tag ] || {};
    ga.value.settings[ tag ].zoom = value ? true : false;
    if ( value ) {
       ga.value.settings[ tag ].pkg = pkg;

       $( tag + "_title," + tag + "_xlabel," + tag + "_ylabel," + tag + "_xy" )
            .on("click", ga.value.set.plot2d.zoom.click );
    }
}

ga.value.set.plot2d.pkg = function( pkg, tag ) {


    ga.value.settings[ tag ] = ga.value.settings[ tag ] || {};
    ga.value.settings[ tag ].pkg = pkg;
    $( tag + "_title," + tag + "_xlabel," + tag + "_ylabel," + tag + "_xy" )
        .on("click", ga.value.set.plot2d.reset );
}

ga.value.set.plot2d.reset = function( event ) {
    var id = "#" + event.target.id.replace( /(_title|_xlabel|_ylabel|_xy)$/, "" );
    event.preventDefault();

    ga.value.setLastValue( ga.value.settings[ id ].pkg, id );
}

ga.value.set.plot2d.hover = function( tag, value ) {

    ga.value.settings[ tag ] = ga.value.settings[ tag ] || {};
    ga.value.settings[ tag ].hover = value ? true : false;
}

ga.value.set.plot2d.selzoom = function( tag, value ) {

    ga.value.settings[ tag ] = ga.value.settings[ tag ] || {};
    ga.value.settings[ tag ].selzoom = value ? true : false;
}

ga.value.set.plot2d.backgroundcolor = function( tag, value ) {

    ga.value.settings[ tag ] = ga.value.settings[ tag ] || {};
    ga.value.settings[ tag ].backgroundcolor = value;
}

ga.value.get.plot2d = {};
ga.value.get.plot2d.plot_options = function( tag, options ) {


    var plot_options = ga.plot_options();
    if ( ga.value.settings[ tag ].backgroundcolor ) {
        plot_options.grid = { backgroundColor : ga.value.settings[ tag ].backgroundcolor };
    }
        
    if ( ga.value.settings[ tag ].selzoom ) {
        plot_options.selection = { mode : "xy" };
    }
        
    if ( options ) {
        if ( options.grid ) {
            plot_options.grid = $.extend( {}, plot_options.grid, options.grid );
        }
        if ( options.selection ) {
            plot_options.selection = $.extend( {}, plot_options.selection, options.selection );
        }
    }

    plot_options.pan.interactive  = ga.value.settings[ tag ].pan   ? true : false;
    plot_options.zoom.interactive = ga.value.settings[ tag ].zoom  ? true : false;
    plot_options.grid.hoverable   = ga.value.settings[ tag ].hover ? true : false;

    if ( options ) {
        if ( options.legend ) {
            plot_options.legend           = options.legend;
            
            if ( options.legend.container ) {
                plot_options.legend.container = $( tag + "_legend" );
            }
        }
        if ( options.xmin ) {
            plot_options.xaxis.min        = options.xmin;
        }
        if ( options.xmax ) {
            plot_options.xaxis.max        = options.xmax;
        }
        if ( options.xscale ) {
            switch ( options.xscale ) {
                case "log" :
                plot_options.xaxis.transform        = function(v) { return v > 0 ? Math.log( v ) : 1e-99; };
                plot_options.xaxis.inverseTransform = function(v) { return Math.exp( v ); };
                plot_options.xaxis.tickFormatter    = ga.value.plot2d.ticformatter;
                break;
                default : 
                console.log( "ga.value.get.plot2d.plot_options( " + tag + " , options ) has unsupported xscale of " + options.xscale );
                break;
            }
        }
        if ( options.xtics ) {
            plot_options.xaxis.ticks = options.xtics;
        }
        if ( options.ymin ) {
            plot_options.yaxis.min        = options.ymin;
            
        }
        if ( options.ymax ) {
            plot_options.yaxis.max        = options.ymax;
            
        }
        if ( options.yscale ) {
            switch ( options.yscale ) {
                case "log" :
                plot_options.yaxis.transform        = function(v) { return v > 0 ? Math.log( v ) : 1e-99; };
                plot_options.yaxis.inverseTransform = function(v) { return Math.exp( v ); };
                plot_options.yaxis.tickFormatter    = ga.value.plot2d.ticformatter;
                break;
                default : 
                console.log( "ga.value.get.plot2d.plot_options( " + tag + " , options ) has unsupported yscale of " + options.yscale );
                break;
            }
        }
        if ( options.ytics ) {
            plot_options.yaxis.ticks = options.ytics;
        }
    }

    return plot_options;
}
        
ga.value.plot2d = {};
ga.value.plot2d.zstack = {};

ga.value.plot2d.zstack.reset = function( tag ) {
    
    ga.value.plot2d.stack = ga.value.plot2d.stack || {};
    ga.value.plot2d.stack[ tag ] = [];
    ga.value.plot2d.waspush = ga.value.plot2d.waspush || {};
    ga.value.plot2d.waspush[ tag ] = false;
}

ga.value.plot2d.zstack.dopop = function( tag ) {
    
    ga.value.plot2d.waspush = ga.value.plot2d.waspush || {};
    if ( ga.value.plot2d.stack[ tag ] && 
         ga.value.plot2d.stack[ tag ].length ) {
        if ( ga.value.plot2d.waspush[ tag ] ) {
            ga.value.plot2d.stack[ tag ].pop();
        }
        ga.value.plot2d.waspush[ tag ] = false;
        return ga.value.plot2d.stack[ tag ].pop();
    }
    return false;
}

ga.value.plot2d.zstack.dopush = function( tag, value ) {
    
    ga.value.plot2d.stack = ga.value.plot2d.stack || {};
    ga.value.plot2d.stack[ tag ] = ga.value.plot2d.stack[ tag ] || [];
    ga.value.plot2d.stack[ tag ].push( value );

    ga.value.plot2d.waspush = ga.value.plot2d.waspush || {};
    ga.value.plot2d.waspush[ tag ] = true;
}

ga.value.plot2d.toFP = function( val, dec ) {
    if ( dec > 0 ) {

        return val.toFixed( dec );
    }
    if ( val.toString().length > 6 ) {

        return val.toExponential( 3 ).replace( /0+e/, 'e' ).replace( /\.e/, 'e' );
    }

    return val.toFixed( 0 );
}

ga.value.plot2d.ticformatter = function formatter(val, axis) {
    var tval;
    if ( !axis._ehb || val <= axis.min ) {

        axis._ehb       = {};
        axis._ehb.pv    = val;
        axis._ehb.min   = Math.min( axis.min, axis.max );
        axis._ehb.max   = Math.max( axis.min, axis.max );
        axis._ehb.tmin  = axis.options.transform( axis._ehb.min );
        axis._ehb.tmax  = axis.options.transform( axis._ehb.max );
        axis._ehb.tmaxr = 1 / axis._ehb.tmax;
        axis._ehb.rnge  = axis._ehb.max - axis._ehb.min;
        return ga.value.plot2d.toFP( val, axis.tickDecimals );
    }

//    if ( val >= axis.max ) {
//        return ga.value.plot2d.toFP( val, axis.tickDecimals );
//    }

    if ( !axis._ehb.snd ) {
        axis._ehb.snd = true;
        axis._ehb.sndv = val;
        axis._ehb.ptd = ( axis.options.transform( val ) - axis._ehb.tmin ) * axis._ehb.tmaxr;

        return ga.value.plot2d.toFP( val, axis.tickDecimals );
    }

    if ( !axis._ehb.tr ) {
        axis._ehb.tr  = 2 * Math.abs( (val - axis._ehb.sndv ) ) / axis._ehb.rnge;
        axis._ehb.ptd = Math.abs( axis.options.transform( val ) - axis._ehb.tmin ) * axis._ehb.tmaxr;

        return ga.value.plot2d.toFP( val, axis.tickDecimals );
    }

    tval = ( axis.options.transform( val ) - axis._ehb.tmin ) * axis._ehb.tmaxr;



    if ( Math.min( Math.abs( tval - axis._ehb.ptd ), 1 - tval ) >= axis._ehb.tr )
    {

        axis._ehb.ptd = tval;
        return ga.value.plot2d.toFP( val, axis.tickDecimals );
    }



    return "";
};

ga.ngl = {};

ga.ngl.types = [
    "backbone"
    ,"ball+stick"
//    ,"base"
    ,"cartoon"
    ,"contact"
//    ,"crossing"
    ,"helixorient"
    ,"hyperball"
    ,"label"
    ,"licorice"
    ,"line"
    ,"point"
    ,"ribbon"
    ,"rocket"
    ,"rope"
    ,"spacefill"
    ,"surface"
    ,"trace"
    ,"tube"
];

// ga.ngl.types = [
//    "cartoon"
//    ,"spacefill"
//];

ga.ngl.clear = function ( tl, tid ) {
    if ( ga.ngl[ tl ] ) {
        if ( ga.ngl[ tl ].stage ) {
            ga.ngl[ tl ].stage.dispose();
        }
        delete ga.ngl[ tl ];
    }
    $( tid + "_plot" ).empty();
    $( tid + "_buttons" ).empty();
    $( "#global_data" ).removeData( tl );
}

ga.value.nglshow = function( mod, id, v ) {
    
    var tid = "#" + id;
    ga.ngl = ga.ngl || {};
    var savekey = mod + ":" + tid + ":last_value";
    ga.ngl.clear( savekey, tid );
    if ( v.loadname ) {
        if ( !v.loadparams ) {
            v.loadparams = {};
        }
        if ( !v.representation ) {
            v.representation = "cartoon";
        }
        ga.ngl[ savekey ] = {};
        ga.ngl[ savekey ].stage = new NGL.Stage( id + "_plot" );
        ga.ngl[ savekey ].stage.loadFile( v.loadname, v.loadparams ).then( function (component) {
            ga.ngl[ savekey ].component = component;
            ga.ngl[ savekey ].reps = {};
            ga.ngl[ savekey ].reps[ v.representation ] = component.addRepresentation( v.representation );
            // provide a "good" view of the structure
            component.autoView();
            
            var al = ga.ngl.types.length;
            var htmladd = "";
            var evaladd = "";
            for ( var i = 0; i < al; ++i ) {
                htmladd += '<button id="' + ga.ngl.types[ i ].replace( '+', '' ) + '">' + ga.ngl.types[ i ] + '</button>';
                evaladd += '$("#' + ga.ngl.types[ i ].replace( '+', '' ) + '").on("click", function() { var sk = ga.ngl["' + savekey + '"]; var comp = sk.component; var crep = sk.reps["' + ga.ngl.types[ i ] + '"]; if ( comp && crep ) { comp.removeRepresentation( crep ); delete sk.reps["' + ga.ngl.types[ i ] + '"]; } else { sk.reps["' + ga.ngl.types[ i ] + '"] = comp.addRepresentation("' + ga.ngl.types[ i ] + '");} return false; });';
            }
            $( tid + "_buttons" ).html( htmladd );
            
            eval ( evaladd );
        });
        $( "#global_data" ).data( savekey , v ); 
    }
    ga.value.extra_resets( id );
}    
/*jslint white: true, plusplus: true*/
/* assumes: jquery > 1.11.0, jqtree >= 3.0.9, jquery-base64 */

ga.pull = {};

ga.pull.clearPull = function( repeater ) {
   if ( !repeater || typeof( repeater ) != "string" || repeater.length == 0 || repeater == "#__fields:repeat__" )
   {
      repeater = "";
   }

   $( "#global_data" ).data( "_pull_json"   + repeater, {} );
   $( "#global_data" ).data( "_pull_update" + repeater, {} );
   $( "#global_data" ).data( "_pull_type"   + repeater, {} );
}

ga.pull.toPull = function( pkg, tag, type, pulltag, repeater ) {

   if ( !repeater || typeof( repeater ) != "string" || repeater.length == 0 || repeater == "#__fields:repeat__" )
   {
      repeater = "";
   }

   var gd = $( "#global_data" );
   var tj = gd.data( "_pull_json"   + repeater ) || {};
   var tu = gd.data( "_pull_update" + repeater ) || {};
// for now, just set to 0
   tj[ pulltag ] = 0;
   if ( typeof( tu[ pulltag ] ) != "object" )
   {
      tu[ pulltag ] = {};
   }


   tu[ pulltag ][ tag ] = type;

   gd.data( "_pull_json"   + repeater, tj );
   gd.data( "_pull_update" + repeater, tu );


}

ga.pull.doPull = function( repeater ) {
   if ( !repeater || typeof( repeater ) != "string" || repeater.length == 0 || repeater == "#__fields:repeat__" )
   {
      repeater = "";
   }

   var gd = $( "#global_data" );
   var s = $( '#_state' );
   var l = s.data( '_logon' );
   if ( l && l.length )
   {
      var tj = gd.data( "_pull_json" + repeater );
      tj[ "_window" ] = window.name;
      tj[ '_logon' ] = l;

      if ( Object.size( tj ) > 2 )
      {

         $.getJSON( "ajax/sys_config/sys_pull.php", tj )
         .done( function( data, status, xhr ) {


            var tu = gd.data( "_pull_update" + repeater );
            $.each(data, function(k, v) {


               if ( typeof( tu[ k ] ) == "object" )
               {
                  $.each( tu[ k ], function( k2, v2 ) {

                     var t = $( k2 );
                     switch( v2 )
                     {
                        case "checkbox" : 
                         t.prop( "checked", v == "on" ); break;
                        case "text" : 
                         if( t.attr( "data-type" ) == "color" ) {
                             
                             ga.color.spectrum.val( k2, v );
                         }
                        case "email" : 
                        case "integer" : 
                        case "float" : 
                         t.val( v ); break;
                        case "listbox" : 
                         t.empty();
// setup html for results


                         $.each( v, function( k3, v3 ) {

                           t.append($("<option></option>").attr( "value", v3 ).text( v3 ) );
                         });
                         break;
                        case "label" : 

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

         });
      } else {

      }
   } else {
// for no login
      var tj = gd.data( "_pull_json" + repeater );
      tj[ "_window" ] = window.name;

      if ( Object.size( tj ) > 1 )
      {

         $.getJSON( "ajax/sys_config/sys_pull.php", tj )
         .done( function( data, status, xhr ) {


            var tu = gd.data( "_pull_update" + repeater );
            $.each(data, function(k, v) {


               if ( typeof( tu[ k ] ) == "object" )
               {
                  $.each( tu[ k ], function( k2, v2 ) {

                     var t = $( k2 );
                     switch( v2 )
                     {
                        case "checkbox" : 
                         t.prop( "checked", v == "on" ); break;
                        case "text" : 
                         if( t.attr( "data-type" ) == "color" ) {
                             
                             ga.color.spectrum.val( k2, v );
                         }
                        case "email" : 
                        case "integer" : 
                        case "float" : 
                         t.val( v ); break;
                        case "listbox" : 
                         t.empty();
// setup html for results


                         $.each( v, function( k3, v3 ) {

                           t.append($("<option></option>").attr( "value", v3 ).text( v3 ) );
                         });
                         break;
                        case "label" : 

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

         });
      } else {

      }
   }
}
/*jslint white: true, plusplus: true*/
/* assumes: jquery > 1.11.0, jqtree >= 3.0.9, jquery-base64 */

ga.repeats = {};

ga.repeats.cache            = {};
ga.repeats.cache._jmol_info = {};
ga.repeats.cache.specproj   = [];

ga.repeats.save = function() {
    
    ga.repeats.cache._jmol_info = _jmol_info || {};
    ga.repeats.cache.specproj   = ga.specproj.data || [];
};

ga.repeats.restore = function() {
    
    _jmol_info = ga.repeats.cache._jmol_info;
    ga.specproj.data = ga.repeats.cache.specproj;
};
/*jslint white: true, plusplus: true*/
/* assumes: jquery > 1.11.0, jqtree >= 3.0.9, jquery-base64 */

ga.repeat               = {};
ga.repeat.data          = {};
ga.repeat.map           = {};

// ----------------------------------------------------------------------------------------------------------
// background
// ----------------------------------------------------------------------------------------------------------
// repeat and repeaters are identified by DOM id's of the element
// a repeat is an element that is dependent on a repeater
// a repeater is an element that has dependent repeats
// an element can be both a repeat (dependent on an element) and a repeater (has dependent repeats)
// ----------------------------------------------------------------------------------------------------------
// summary of data structures
// ----------------------------------------------------------------------------------------------------------
// ga.repeat.data[ mod ]                          : the module specific data object 
//
// ga.repeat.data[ mod ].repeat                   : repeat data object 
// ga.repeat.data[ mod ].repeat[ id ]             : repeat data object for repeat id 
// ga.repeat.data[ mod ].repeat[ id ].lhtml       : repeat id's lhtml
// ga.repeat.data[ mod ].repeat[ id ].lhtmlr      : repeat id's lhtml modified to ease replacement
// ga.repeat.data[ mod ].repeat[ id ].lhtmls      : repeat id's lhtml structure and label only for table header
// ga.repeat.data[ mod ].repeat[ id ].dhtml       : repeat id's dhtml
// ga.repeat.data[ mod ].repeat[ id ].dhtmlr      : repeat id's dhtml modified to ease replacement
// ga.repeat.data[ mod ].repeat[ id ].rhtml       : repeat id's rhtml
// ga.repeat.data[ mod ].repeat[ id ].rhtmlr      : repeat id's rhtml modified to ease replacement
// ga.repeat.data[ mod ].repeat[ id ].eval        : repeat id's eval
// ga.repeat.data[ mod ].repeat[ id ].evalr       : repeat id's eval modified to ease replacement
// ga.repeat.data[ mod ].repeat[ id ].refid       : repeat's repeater (as registered in repeatOn)
//
// ga.repeat.data[ mod ].repeater                 : repeater data object
// ga.repeat.data[ mod ].repeater[ id ]           : repeater data object for repeater id
// ga.repeat.data[ mod ].repeater[ id ].type      : repeater type (currently, checkbox, listbox or integer)
// ga.repeat.data[ mod ].repeater[ id ].child     : repeater's children (as registered in repeatOn)
// ga.repeat.data[ mod ].repeater[ id ].choice    : repeater's listbox choice
// ga.repeat.data[ mod ].repeater[ id ].value     : repeater's last value
// ga.repeat.data[ mod ].repeater[ id ].layoutr   : repeater's layout.repeats
//
// ga.repeat.map                                  : map of original id's to DOM id's of repeats
// ----------------------------------------------------------------------------------------------------------
// summary of operations
// ----------------------------------------------------------------------------------------------------------
// ga.repeat.repeat   : register a repeat
// ga.repeat.repeater : register a repeater
// ga.repeat.repeatOn : register a repeat repeater reference
// ga.repeat.children : return all "children" ( repeats on the repeater)
// ga.repeat.change   : change value of a repeater
// ----------------------------------------------------------------------------------------------------------


// register a repeat
// equivalent of ga.repeats.registerRepeat
// initializes the repeat structure & stores the html and eval for a field and returns a placeholder

ga.repeat.repeat = function( mod, id ) {
    
    var has_errors = false;
    var ret_val = [`<span id="${id}-label-span"></span>`,`<span id="${id}-span"></span>`];

    ga.repeat.data[ mod ] = ga.repeat.data[ mod ] || {};
    ga.repeat.data[ mod ].repeat = ga.repeat.data[ mod ].repeat || {};
    ga.repeat.data[ mod ].repeat[ id ] = {};
    if ( !ga.layout.fields[ id ] ) {
        console.error( `repeat.js: mod ${mod} id ${id} missing` );
        return ret_val;
    }
    if ( !("lhtml" in ga.layout.fields[ id ] ) ) {
        console.error( `repeat.js: mod ${mod} id ${id} lhtml missing` );
        has_errors = true;
    }
    if ( !( "dhtml" in ga.layout.fields[ id ] ) ) {
        console.error( `repeat.js: mod ${mod} id ${id} dhtml missing` );
        has_errors = true;
    }
    if ( !( "eval" in ga.layout.fields[ id ] ) ) {
        console.error( `repeat.js: mod ${mod} id ${id} eval missing` );
        has_errors = true;
    }
    if ( has_errors ) {
        return ret_val;
    }

    ga.repeat.data[ mod ].repeat[ id ].lhtml   = ga.layout.fields[ id ].lhtml;
    ga.repeat.data[ mod ].repeat[ id ].dhtml   = ga.layout.fields[ id ].dhtml;
    ga.repeat.data[ mod ].repeat[ id ].eval    = ga.layout.fields[ id ].eval;

    if ( ga.layout.fields[ id ].lgc ) {
        ga.repeat.data[ mod ].repeat[ id ].lhtml  = `<div style="grid-column:${ga.layout.fields[id].lgc}">${ga.repeat.data[ mod ].repeat[ id ].lhtml}</div>`;
    }
    if ( ga.layout.fields[ id ].dgc ) {
        ga.repeat.data[ mod ].repeat[ id ].dhtml  = `<div style="grid-column:${ga.layout.fields[id].dgc}">${ga.repeat.data[ mod ].repeat[ id ].dhtml}</div>`;
    }

    if ( !ga.layout.fields[ id ].lgc && !ga.layout.fields[ id ].dgc ) {
        console.warn( `ga.repeat.repeat( ${mod} , ${id} ) : no grid defined` );
    }

    if ( ga.layout.modules[ mod ].fields[ id ].repeats ) {
        ga.repeat.data[ mod ].repeater = ga.repeat.data[ mod ].repeater || {};
        ga.repeat.data[ mod ].repeater[ id ] = ga.repeat.data[ mod ].repeater[ id ] || {};
        ga.repeat.data[ mod ].repeater[ id ].layoutr = ga.layout.modules[ mod ].fields[ id ].repeats;
        
    }
    
    // setup div for repeats

    if ( ga.layout.fields[ id ].rhtml ) {
        ga.repeat.data[ mod ].repeat[ id ].rhtml = ga.layout.fields[ id ].rhtml;
        ga.repeat.data[ mod ].repeat[ id ].rhtmlr = 
            ga.repeat.data[ mod ].repeat[ id ].rhtml
            .replace( RegExp( `id=ga-repeater-${id}` ), `id=ga-repeater-%%id%%` )
        ;
    }
        
    ga.repeat.map[ id ] = id;

    // fix up html & eval for easy unconfused replacement

    ga.repeat.data[ mod ].repeat[ id ].lhtmlr = 
        ga.repeat.data[ mod ].repeat[ id ].lhtml
        .replace( /<\/label>/, "%%label%%</label>" )
        .replace( RegExp( 'id="' + id + '"' ), 'id="%%id%%"' )
        .replace( RegExp( 'name="' + id ), 'name="%%id%%' )
        .replace( RegExp( 'for="' + id + '"' ), 'for="%%id%%"' )
        .replace( RegExp( 'id="' + id + '_msg"' ), 'id="%%id%%_msg"' )
        .replace( RegExp( 'id="' + id + '_tr"' ), 'id="%%id%%_tr"' )
        .replace( RegExp( 'id="' + id + '_button"' ), 'id="%%id%%_button"' )
        .replace( RegExp( '="' + id + '_altval"', 'g' ), '="%%id%%_altval"' )
        .replace( RegExp( 'name="_selaltval_' + id + '"' ), 'name="_selaltval_%%id%%"' )
        .replace( RegExp( 'id="' + id + '-repeater"' ), 'id="%%id%%-repeater"' )
    ;    

    ga.repeat.data[ mod ].repeat[ id ].lhtmls = // grab just relevant table structure and label text
        ga.repeat.data[ mod ].repeat[ id ].lhtml
        .replace( /<td><label.*?>(.*?)<\/label>\s*<\/td>/, "%%td%%$1%%etd%%" )
        .replace( /(<td[^>]*>).*?<\/td>/g, "$1</td>" )
        .replace( /<input[^>]*>/g, "" )
        .replace( /<span[^>]*>.*?<\/span>/g, "" )
        .replace( /\s*id=".*?"\s*/g, "" )
        .replace( "%%td%%", "<td>" )
        .replace( "%%etd%%", "</td>" )
        .replace( "<td></td>", "" )
    ;

    // perhaps more need 'g' here:
    ga.repeat.data[ mod ].repeat[ id ].dhtmlr = 
        ga.repeat.data[ mod ].repeat[ id ].dhtml
        .replace( /<\/label>/, "%%label%%</label>" )
        .replace( RegExp( 'id="' + id + '"' ), 'id="%%id%%"' )
        .replace( RegExp( 'name="' + id, 'g' ), 'name="%%id%%' )
        .replace( RegExp( 'for="' + id + '"' ), 'for="%%id%%"' )
        .replace( RegExp( 'id="' + id + '_msg"' ), 'id="%%id%%_msg"' )
        .replace( RegExp( 'id="' + id + '_tr"' ), 'id="%%id%%_tr"' )
        .replace( RegExp( 'id="' + id + '_button"' ), 'id="%%id%%_button"' )
        .replace( RegExp( '="' + id + '_altval"', 'g' ), '="%%id%%_altval"' )
        .replace( RegExp( 'name="_selaltval_' + id + '"' ), 'name="_selaltval_%%id%%"' )
        .replace( RegExp( 'id="' + id + '-repeater"' ), 'id="%%id%%-repeater"' )
    ;    

    
    
    
    
    
    
    
    

    ga.repeat.data[ mod ].repeat[ id ].evalr = 
        ga.repeat.data[ mod ].repeat[ id ].eval
        .replace( RegExp( '"#' + id + '"', "g" ), '"#%%id%%"' )
        .replace( RegExp( '"#' + id + ' option', "g" ), '"#%%id%% option' )
        .replace( RegExp( ':' + id + ':', "g" ), ':%%id%%:' )
        .replace( RegExp( '"#' + id + '_msg"', "g" ), '"#%%id%%_msg"' )
        .replace( RegExp( '"' + id + '"', "g" ), '"%%id%%"' )
        .replace( RegExp( '"#' + id + '_button"', "g" ), '"#%%id%%_button"' )
        .replace( RegExp( '"' + id + '_altval"', "g" ), '"%%id%%_altval"' )
        .replace( RegExp( '"#' + id + '_altval"', "g" ), '"#%%id%%_altval"' )
    ;

    
    
    
    
    
    return ret_val;
}

// add a repeat repeater reference
// equivalent of ga.repeats.addRepeat 
// the repeat should already exist

ga.repeat.repeatOn = function( mod, id, refid ) {
    
    var rxcolon = /^(.*):(.*)$/,
        rxcolonval = rxcolon.exec( refid ),
        refbase,
        refchoice
    ;

    refid = refid.replace( ':', '-' );

    ga.repeat.data[ mod ].repeater = ga.repeat.data[ mod ].repeater || {};
    ga.repeat.data[ mod ].repeater[ refid ] = ga.repeat.data[ mod ].repeater[ refid ] || {};
    ga.repeat.data[ mod ].repeater[ refid ].child = ga.repeat.data[ mod ].repeater[ refid ].child || [];
    ga.repeat.data[ mod ].repeater[ refid ].child.push( id );
    ga.repeat.data[ mod ].repeat[ id ].refid = refid;

    if ( rxcolonval ) {
        refbase   = rxcolonval[ 1 ];
        refchoice = rxcolonval[ 2 ];
        

        ga.repeat.data[ mod ].repeater[ refbase ] = ga.repeat.data[ mod ].repeater[ refbase ] || {};
        ga.repeat.data[ mod ].repeater[ refbase ].child = ga.repeat.data[ mod ].repeater[ refbase ].child || [];
        ga.repeat.data[ mod ].repeater[ refbase ].choice = ga.repeat.data[ mod ].repeater[ refbase ].choice || [];
        ga.repeat.data[ mod ].repeater[ refbase ].child.push( id );
        ga.repeat.data[ mod ].repeater[ refbase ].choice.push( refchoice );
    }
        
}

// add a repeater
// no exact equivalent in ga.repeats, this was encapsulated in various updateRepeats

ga.repeat.repeater = function( mod, id, type, tableize ) {
    
    ga.repeat.data[ mod ] = ga.repeat.data[ mod ] || {};
    ga.repeat.data[ mod ].repeater = ga.repeat.data[ mod ].repeater || {};
    ga.repeat.data[ mod ].repeater[ id ] = ga.repeat.data[ mod ].repeater[ id ] || {};
    ga.repeat.data[ mod ].repeater[ id ].type = type;
    if ( tableize &&
         tableize != "__fields:tableize__" &&
         !/^(off|false)$/i.test( tableize ) ) {
        ga.repeat.data[ mod ].repeater[ id ].tableize = 1;
        
    }
    

    var uid = id.replace( /\-\d*$/, '' ).replace( /^.*-/, '' );
    
    if ( !ga.layout.modules[ mod ].fields[ uid ] ) {
        console.warn( `in ga.repeat.repeater(), missing ga.layout.modules[ ${mod} ].fields[ ${uid} ]` );
    } else {
        ga.repeat.data[ mod ].repeater[ id ].layoutr = ga.layout.modules[ mod ].fields[ uid ].repeats || null;
        
    }
}

// return all children

ga.repeat.children = function( mod, id, result ) {
    var i;

    

    result = result || {};

    if ( !ga.repeat.data[ mod ] || 
         !ga.repeat.data[ mod ].repeater || 
         !ga.repeat.data[ mod ].repeater[ id ] ) {
        
        return result;
    }

    if ( !ga.repeat.data[ mod ].repeater[ id ].child ) {
        
        return result;
    }

    for ( i = 0; i < ga.repeat.data[ mod ].repeater[ id ].child.length; ++i ) {
        // for ( i in ga.repeat.data[ mod ].repeater[ id ].child ) {
        
        result[ ga.repeat.data[ mod ].repeater[ id ].child[ i ] ] = true;
        if ( ga.repeat.data[ mod ].repeater[ i ] ) {
            result = ga.repeat.children( mod, i, result );
        }
    }
    return result;
}

// change
// quasi equivalent in ga.repeats in updateRepeats{,Cb,Lb}

ga.repeat.change = function( mod, id, init ) {
    var val,
    child_repeaters = [],
    hid = "#" + id,
    jqhid = $( hid ),
    children,
    add_html = "",
    add_eval = "",
    tid,
    i,
    j,
    k;

    
    if ( !ga.repeat.data[ mod ] || 
         !ga.repeat.data[ mod ].repeater || 
         !ga.repeat.data[ mod ].repeater[ id ] ) {
        
        return false;
    }

    if ( !jqhid.length ) {
        
	//console.log("ga.repeat.change( " + mod + " , " + id + " ) id does not currently exist in DOM" );
        return false;
    }

    // get value of repeater
    switch ( ga.repeat.data[ mod ].repeater[ id ].type ) {
    case "checkbox" : 
        val = jqhid.prop( "checked" ) ? 1 : 0;
        break;
        
    case "integer" :
    case "listbox" :
        val = jqhid.val();
	//console.log("Value:  " + val );
        break;

    default :
        console.warn( "ga.repeat.change( " + mod + " , " + id + " ) type " + ga.repeat.data[ mod ].repeater[ id ].type + " not supported" );
        return false;
        break;
    }

    // has the value changed ?

    if ( !init && ga.repeat.data[ mod ].repeater[ id ].value === val ) {
        
        return false;
    }
    
    

    // get children
    children = ga.repeat.children( mod, id );

    

    // build up add_html & add_eval

    switch ( ga.repeat.data[ mod ].repeater[ id ].type ) {
    case "checkbox" : 
        if ( val ) {
            for ( i in children ) {
                k = id + "-" + i;
                ga.repeat.map[ i ] = k;
                
                
                
                add_html += ga.repeat.data[ mod ].repeat[ i ].lhtmlr.replace( /%%id%%/g, k ).replace( "%%label%%", "" );
                add_html += ga.repeat.data[ mod ].repeat[ i ].dhtmlr.replace( /%%id%%/g, k ).replace( "%%label%%", "" );
                if ( ga.repeat.data[ mod ].repeat[ i ].rhtmlr ) {
                    add_html += ga.repeat.data[ mod ].repeat[ i ].rhtmlr.replace( /%%id%%/g, k );
                }
                add_eval += ga.repeat.data[ mod ].repeat[ i ].evalr.replace( /%%id%%/g, k );
                if ( ga.repeat.data[ mod ].repeater[ i ] ) {
                    
                    if ( !ga.repeat.data[ mod ].repeater[ k ] ) {
                        ga.repeat.data[ mod ].repeater[ k ] = jQuery.extend( {}, ga.repeat.data[ mod ].repeater[ i ] );
                    }
                    child_repeaters.push( k );
                    if ( ga.repeat.data[ mod ].repeater[ k ].value ) {
                        delete ga.repeat.data[ mod ].repeater[ k ].value;
                    }
                }
            }
        }
        break;

    case "integer" :

        if ( ga.repeat.data[ mod ].repeater[ id ].tableize && val > 0 ) {
            for ( i in children ) {
                add_html += ga.repeat.data[ mod ].repeat[ i ].lhtmls;
            }
        }

        for ( j = 1; j <= val; ++j ) {
            for ( i in children ) {
                k = id + "-" + i + "-" + ( j - 1 );
                ga.repeat.map[ i ] = k;
                
                
                
                add_html += ga.repeat.data[ mod ].repeat[ i ].lhtmlr.replace( /%%id%%/g, k ).replace( "%%label%%", "[" + j + "]" ).replace( ga.repeat.data[ mod ].repeater[ id ].tableize ? /<td.*?><label.*?>.*?<\/label><\/td>/ : "", "" );
                add_html += ga.repeat.data[ mod ].repeat[ i ].dhtmlr.replace( /%%id%%/g, k ).replace( "%%label%%", "[" + j + "]" ).replace( ga.repeat.data[ mod ].repeater[ id ].tableize ? /<td.*?><label.*?>.*?<\/label><\/td>/ : "", "" );
                if ( ga.repeat.data[ mod ].repeat[ i ].rhtmlr ) {
                    add_html += ga.repeat.data[ mod ].repeat[ i ].rhtmlr.replace( /%%id%%/g, k );
                }
                add_eval += ga.repeat.data[ mod ].repeat[ i ].evalr.replace( /%%id%%/g, k );
                if ( ga.repeat.data[ mod ].repeater[ i ] ) {
                    
                    if ( !ga.repeat.data[ mod ].repeater[ k ] ) {
                        ga.repeat.data[ mod ].repeater[ k ] = jQuery.extend( {}, ga.repeat.data[ mod ].repeater[ i ] );
                    }
                    child_repeaters.push( k );
                    if ( ga.repeat.data[ mod ].repeater[ k ].value ) {
                        delete ga.repeat.data[ mod ].repeater[ k ].value;
                    }
                }
            }
        }
        break;

    case "listbox" :
        
        tid = id.replace( /-[0-9]+$/, "" ).replace( /^(.*)-([A-ZA-z0-9_]*)$/, "$2" ) + "-" + val;

        j = id + "-" + val;

        
        children = ga.repeat.children( mod, tid );
        

        for ( i in children ) {
            k = j + "-" + i;
            ga.repeat.map[ i ] = k;
            
            
            
            add_html += ga.repeat.data[ mod ].repeat[ i ].lhtmlr.replace( /%%id%%/g, k ).replace( "%%label%%", "" );
            add_html += ga.repeat.data[ mod ].repeat[ i ].dhtmlr.replace( /%%id%%/g, k ).replace( "%%label%%", "" );
            if ( ga.repeat.data[ mod ].repeat[ i ].rhtmlr ) {
                add_html += ga.repeat.data[ mod ].repeat[ i ].rhtmlr.replace( /%%id%%/g, k );
            }
            add_eval += ga.repeat.data[ mod ].repeat[ i ].evalr.replace( /%%id%%/g, k );
            if ( ga.repeat.data[ mod ].repeater[ i ] ) {
                
                if ( !ga.repeat.data[ mod ].repeater[ k ] ) {
                    ga.repeat.data[ mod ].repeater[ k ] = jQuery.extend( {}, ga.repeat.data[ mod ].repeater[ i ] );
                }
                child_repeaters.push( k );
                if ( ga.repeat.data[ mod ].repeater[ k ].value ) {
                    delete ga.repeat.data[ mod ].repeater[ k ].value;
                }
            }
        }
        break;

    default :
        console.warn( "ga.repeat.change( " + mod + " , " + id + " ) type " + ga.repeat.data[ mod ].repeater[ id ].type + " not supported" );
        return false;
        break;
    }

    
    
    

    // $( hid + "-repeater" ).html( add_html );
    $( `#ga-repeater-${id}` ).html( add_html );
    var uid = id.replace( /\-\d*$/, '' ).replace( /^.*-/, '' );
    
    
    eval( add_eval );

    ga.repeat.data[ mod ].repeater[ id ].value = val;

    for ( i = 0 ; i < child_repeaters.length; ++i ) {
        
	//console.log( "ga.repeat.change( " + mod + " , " + id + " ) child_repeater " + child_repeaters[ i ] );
        ga.repeat.change( mod, child_repeaters[ i ], init );
    }

    if ( $( "#global_data" ).data( "_pull_json#" + id ) ) {
        
        ga.pull.doPull( "#" + id );
    }
    

    ga.hhelp.reset();
}

ga.repeat.map.convert = function( ids_array ) {
    var i,
    result = [];

    

    for ( i = 0; i < ids_array.length; ++i ) {
        result[ i ] = ga.repeat.map[ ids_array[ i ] ] || ids_array[ i ];
    }

    
    return result;
}
/*jslint white: true, plusplus: true*/
/* assumes: jquery > 1.11.0, jqtree >= 3.0.9, jquery-base64 */

// ga.hide provides hider functionality to hide a field based upon checkbox status, this is used primarily for the login "forgot password" to remove the password box

ga.hide = function( module, id ) {

    ga.hide.data = ga.hide.data || {};
    ga.hide.data[ module ] = ga.hide.data[ module ] || {};
    ga.hide.data[ module ][ id ] = ga.hide.data[ module ][ id ] || {};
    ga.hide.data[ module ][ id ].active = 1;


};

ga.hide.data = {};

ga.hide.update = function( module, id ) {

    var i;

    if ( !ga.hide.data[ module ] || !ga.hide.data[ module ][ id ] ) {
        console.log( "ga.hide.update( " + module + " , " + id + " ) error, hider has not been defined" );
        return;
    }

    if ( !ga.hide.data[ module ][ id ].hides ) {
        console.log( "ga.hide.update( " + module + " , " + id + " ) error, no hides attached to this hider" );
        return;
    }

    if ( $( id ).prop( 'checked' ) ) {
        for ( i in ga.hide.data[ module ][ id ].hides ) {

            $( i + "-itd" ).html(" ");
            $( i ).hide();
        } 
    } else {
        for ( i in ga.hide.data[ module ][ id ].hides ) {

            $( i + "-itd" ).html( ga.hide.data[ module ][ id ].hides[ i ] );
            $( i ).show();
        } 
    }
// fix up help
    ga.hhelp.set();
    ga.hhelp.reset();

}

ga.hide.add = function( module, id, hiderid ) {

    ga.hide.data = ga.hide.data || {};
    ga.hide.data[ module ] = ga.hide.data[ module ] || {};
    ga.hide.data[ module ][ hiderid ] = ga.hide.data[ module ][ hiderid ] || {};
    ga.hide.data[ module ][ hiderid ].hides = ga.hide.data[ module ][ hiderid ].hides || {};
    ga.hide.data[ module ][ hiderid ].hides[ id ] = $( id + "-itd" ).html();


};

// hideifnot is helpful for removing fields if a directive is not set
// this is currently supported for types/checkbox.input & types/listbox.input, but could easily be extended by adding the fields:hideifnot tag to other input elements
// note: it also requires a registry of directives (currently done in base_header.html using ga.directives

ga.directives = function( directive, value ) {
    
    ga.directives.data = ga.directives.data || {};
    ga.directives.data[ directive ] = value;
}

ga.hideifnot = function( id, directive ) {
    
    if ( ga.directives.data &&
         ga.directives.data[ directive ] &&
         !/^(off|false|0$)/.test( ga.directives.data[ directive ].toLowerCase() ) ) {
        
        return;
    }
    $( id ).hide();
}

/*jslint white: true, plusplus: true*/
/* assumes: jquery > 1.11.0, jqtree >= 3.0.9, jquery-base64 */

ga.data = {};
ga.data.nofcrefresh = {};

// play with tooltips upon hover
function showTooltip(x, y, content, bg_color) {
        $('<div id="rtooltip">' + content + '</div>').css({
            'position' : 'absolute',
	    'top'      : y + 5,
	    'left'     : x + 5,
            'border'   : '1px solid #181616',
            'padding'  : '2px',
            'background-color' : bg_color,
	    'color'    : 'white'
        }).appendTo( "body" );
    }


// apply the data to the screen output, return an object with job_status

ga.data.dataURLtoFile = function(dataurl, filename) {
    var arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1],
        bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
    while(n--){
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, {type:mime});
}

ga.data.create_image_htmltocanvas = function(k) {
    
    if ( $( "#" + k  + "_savetofile" ).length )
    {
	//var a = document.getElementById(k + "_savetofile");
	
	var combined = $("#" + k + "_div");
	//html2canvas( match.get(0), {
	html2canvas( combined.get(0), {
	    background: "#ffffff",
	    //width     : 600,
	    onrendered: function (canvas) {
		var image = canvas.toDataURL("image/png").replace("image/png", "image/octet-stream"); 
		
		//a.href = image;
		//a.download = "plot.png";
		//$("#" + k  + "_savetofile").removeClass( "hidden" );

		//var link = "<a href=\"" + v + "\" target=\"_blank\">" + v.split( '/' ).pop() + "</a>";
		var link = "<a href=\"" + image + "\" target=\"_blank\" download=\"plot.png\">" + "plot.png" + "</a>";
		//console.log("link: " + link);
		$("#" + k  + "_savetofile_link").html( link );
	    }
	});
    }
}

ga.data.create_image = function(k, plot) {
    
    if ( $( "#" + k  + "_savetofile" ).length )
    {
	var a = document.getElementById(k + "_savetofile");
	
	var canvas = plot.getCanvas();
	//canvas_merged = replotChartAsCanvas(match, v.data, ga.value.get.plot2d.plot_options( htag, v.options ));
	var image = canvas.toDataURL("image/png").replace("image/png", "image/octet-stream"); 
	var file = ga.data.dataURLtoFile(image, 'plot.png');
	a.href = URL.createObjectURL(file);
	$("#" + k  + "_savetofile").removeClass( "hidden" );
    }
}

ga.data.update = function( mod, data, msging_f, msg_id ) {
    var output_msgs_cleared = 0,
        appended            = 0,
        state_changed       = 0,
        do_close            = 0,
        do_close2           = 0,
        mod_out             = mod,
        hmod_out            = "#" + mod_out,
        jqmod_out           = $( hmod_out ),
        mod_out2            = mod + "_output",
        hmod_out2           = "#" + mod_out2,
        jqmod_out2           = $( hmod_out2 ),
        retobj              = {},
        hmod_out_msgs       = hmod_out2 + "_" + "msgs",
        jqhmod_out_msgs     = $( hmod_out_msgs ),
        htag,
        jqhtag,
        savekey,
        tlink,
        thtml,
        t,
        jsmolfile,
        match,
        t2;


 
 

//    if ( !msging_f ) {
//      
//      // clear when not messaged (i.e. job is complete)
//      ga.progress.clear( mod, 'data.js 1' );
//      jqhmod_out_msgs.text( "" );
//    }

    var has_handler = ga.layout.handler && ga.layout.handler[ mod ];

    $.each(data, function(k, v) {
        
        

        match = jqmod_out.find( "#" + k );
        if ( match.length )
        {
            if ( !output_msgs_cleared )
            {
                jqhmod_out_msgs.text( "" );
                output_msgs_cleared = 1;
            }
            if ( has_handler &&
                 ga.layout.handler[ mod ][ k ] &&
                 ga.layout.handler[ mod ][ k ].setval ) {
                ga.layout.handler[ mod ][ k ].setval( v );
            }
            switch ( match.attr( "type" ) )
            {
	    case "plot3d" :
	    case "plotly" :
		htag = "#" + k;
                
		// v.layout = $.extend( {}, v.layout, {showlegend: false } );
		
		ga.plot3dglobal     = v.layout;
		ga.dataplot3dglobal = v.data;
		ga.plotted3d[ mod ] = 0;
		
		
		

		if ( $( htag  + "_showcollapse" ).length )
		{
		    $(htag + "_showcollapse").removeClass( "hidden" );
		}
		
		//if(!ga.showcollapse3d)
		//{
		Plotly.newPlot(k, v.data, v.layout);
		//}
		if ( ga.showcollapse3d[ mod ] )
		{
		    ga.plotted3d[ mod ] = 1;
		    $(  htag  + "_showcollapse" ).trigger( "click" );
		}
		savekey = mod_out + ":#" + k + ":last_value";
                $( "#global_data" ).data( savekey , v ); 
		break;
            case "plot2d" : 
                
                htag = "#" + k;
		var image;
		var file;
		var plot;

                ga.value.plot2d.zstack.reset( htag );
		
                if ( v.data ) {
                    ga.value.set.plot2d( htag, v.options );
                    

		    //ga.pl = ga.value.get.plot2d.plot_options( htag, v.options );

		    ga.plotglobal     = v.options;
		    ga.dataplotglobal = v.data;
		    //console.dir(ga.pl );
		    
		    //console.dir(ga.value.get.plot2d.plot_options( htag, v.options ));

		    plot = $.plot( htag, v.data, ga.value.get.plot2d.plot_options( htag, v.options ) );

		    // play with tooltip response upon hover //////////////////////////////////////////
		    if ( ga.customtooltips[ mod ] ) 
		    {
			var previousPoint = null;
			$( htag ).bind("plothover", function (event, pos, item) {
			    if (item) {
				if (previousPoint != item.dataIndex) {
				    previousPoint = item.dataIndex;
				    
				    $("#rtooltip").remove();
				    var x = item.datapoint[0].toFixed(2),
				    y = item.datapoint[1].toFixed(2);
				    
				    if (item.series.tooltips.length) //specific for Rotdif's 'rdata' for residues...
				    {
					showTooltip(item.pageX, item.pageY, item.series.tooltips[item.dataIndex], item.series.color );
					//alert(item.series.rdata);
				    }
				}
			    }
			    else {
				$("#rtooltip").remove();
				//$("#tooltip").hide();
			    previousPoint = null;
			    }
			});
		    }
		    // END of tooltip response /////////////////////////////////////////////////////
		    
		} else {
                    plot = $.plot( htag, v,  ga.value.get.plot2d.plot_options( htag ) );
                }

		if ( $( htag  + "_savetofile" ).length )
		{
		    $(htag + "_savetofile").removeClass( "hidden" );
		}
		    
		if ( $( htag  + "_changescalex" ).length )
		{
		    $(htag + "_changescalex").removeClass( "hidden" );
		    if (v.options.xscale == "log")
		    {
			$(htag + "_changescalex_message").html("X-log");
		    }
		    else
		    {
			$(htag + "_changescalex_message").html("X-lin");
		    }
		}

		if ( $( htag  + "_changescaley" ).length )
		{
		    $(htag + "_changescaley").removeClass( "hidden" );
		    if (v.options.yscale == "log")
		    {
			$(htag + "_changescaley_message").html("Y-log");
		    }
		    else
		    {
			$(htag + "_changescaley_message").html("Y-lin");
		    }
		}

		if ( $( htag  + "_showcollapse" ).length )
		{
		    $(htag + "_showcollapse").removeClass( "hidden" );
		    $(htag).show();
		    ga.plotted2d[ mod ]=1;
		    $(  htag  + "_showcollapse" ).trigger( "click" );
		}

		//ga.data.create_image_htmltocanvas(k);
		//ga.data.create_image(k, plot);

                if ( ga.value.settings[ htag ].selzoom || 
                     ( v.options && v.options.selection && v.options.selection.mode && v.options.selection.mode == "xy" ) ) {
		    $( htag )
                        .on("plotselected", 
                            {
                                htag : htag
                                ,data : v.data ? v.data : v
                                ,options : v.data ? ga.value.get.plot2d.plot_options( htag, v.options ) : ga.value.get.plot2d.plot_options( htag )
                            },
                            function ( e, ranges ) {
                                
		                // clamp the zooming to prevent eternal zoom

		                if (ranges.xaxis.to - ranges.xaxis.from < 0.00001) {
			            ranges.xaxis.to = ranges.xaxis.from + 0.00001;
		                }

		                if (ranges.yaxis.to - ranges.yaxis.from < 0.00001) {
			            ranges.yaxis.to = ranges.yaxis.from + 0.00001;
		                }

		                // do the zooming

                                ga.value.plot2d.zstack.dopush( e.data.htag, ranges );

		                $.plot( e.data.htag, e.data.data, 
				        $.extend(true, {}, e.data.options, {
				            xaxis: { min: ranges.xaxis.from, max: ranges.xaxis.to },
				            yaxis: { min: ranges.yaxis.from, max: ranges.yaxis.to }
				        })
			              );
				//create_image(k);
		            })
                        .on('contextmenu',
                            {
                                htag : htag
                                ,data : v.data ? v.data : v
                                ,options : v.data ? ga.value.get.plot2d.plot_options( htag, v.options ) : ga.value.get.plot2d.plot_options( htag )
                            },
                            function(e) {
                                e.preventDefault();
                                
                                var ranges = ga.value.plot2d.zstack.dopop( e.data.htag );
                                if ( ranges ) {
		                     $.plot( e.data.htag, e.data.data, 
				             $.extend(true, {}, e.data.options, {
				                 xaxis: { min: ranges.xaxis.from, max: ranges.xaxis.to },
				                 yaxis: { min: ranges.yaxis.from, max: ranges.yaxis.to }
				             })
			                   );
                                } else {
		                    $.plot( e.data.htag, e.data.data, e.data.options );
                                }
				//create_image(k);
                            });
                }
		
		savekey = mod_out + ":#" + k + ":last_value";
                $( "#global_data" ).data( savekey , v ); 
                break;
            case "bokeh" : 
                
                // strip header, process eval & html
                ga.bokeh.render( mod, k, v );
                break;

            case "ngl" : 
                ga.value.nglshow( mod_out, k, v );
                break;

            case "atomicstructure" : 
                //                               Jmol.setDocument( 0 );
                savekey = mod_out + ":#" + k + ":last_value";
                if ( v.file ) {
                    jsmolfile = v.file;
                } else {
                    jsmolfile = v;
                }
                
                _jmol_info[ k ].script =
                    'set background [' + ga.colors.background + ']; set zoomlarge false;set echo top center;echo loading ' + jsmolfile.split( '/' ).pop() + ';refresh;load "' + jsmolfile + '";';
                if ( ga.set( mod + ":jsmoladd" ) ) {
                    _jmol_info[ k ].script += ga.set( mod + ":jsmoladd" );
                }
                if ( v.script ) {
                    _jmol_info[ k ].script += ";" + v.script;
                }
                
                //                               Jmol.getApplet("jmol", _jmol_info[ k ]);

                $( "#global_data" ).data( savekey , _jmol_info[ k ].script ); 
                $("#" + k ).html(Jmol.getAppletHtml( "jmolApplet" + k, _jmol_info[ k ] ));

                break;
            case "checkbox" : 
            case "radio" : 
                match.prop( "checked", true ); 
                break;
            case "div" :  
                match.html( v );
                break;
            case "video" : 
                jqhtag = $( "#" + k );
                thtml = "<video ";
                if ( jqhtag.attr( "data-width" ) ) {
                    thtml += ' width="' +  jqhtag.attr( "data-width" ) + '"';
                }
                if ( jqhtag.attr( "data-height" ) ) {
                    thtml += ' height="' +  jqhtag.attr( "data-height" ) + '"';
                }
                thtml += ' controls>';
                thtml += '<source src="' + v +'.mp4" type="video/mp4" /><source src="' + v +'.webm" type="video/webm" />';
                thtml += '</video>';
                
                jqhtag.html( thtml );
                break;
            case "image" : 
                jqhtag = $( "#" + k );
                thtml = "<img ";
                if ( jqhtag.attr( "data-width" ) ) {
                    thtml += ' width="' +  jqhtag.attr( "data-width" ) + '"';
                }
                if ( jqhtag.attr( "data-height" ) ) {
                    thtml += ' height="' +  jqhtag.attr( "data-height" ) + '"';
                }
                thtml += ' src="' + v + '">';
                
                jqhtag.html( thtml );
                break;
            case "filelink" : 
                tlink = "<a href=\"" + v + "\" target=\"_blank\">" + v.split( '/' ).pop() + "</a>";
                savekey = mod_out + ":#" + k + ":last_value";
                $( "#global_data" ).data( savekey , tlink );
                $( "#" + k + "_filelink" ).html( tlink );
                break;
            case "filelinkm" : 
                savekey = mod_out + ":#" + k + ":last_value";
                tlink = "";
                $.each( v, function( k2, v2 ) {
                    tlink += "<a href=\"" + v2 + "\" target=\"_blank\">" + v2.split( '/' ).pop() + "</a> ";
                } );
                $( "#global_data" ).data( savekey , tlink );
                $( "#" + k + "_filelink" ).html( tlink );
                break;
            default :
                if ( $( "#global_data" ).data( "_append:" + mod_out + "_" + k ) )
                {
                    match.val( match.val() + "\n" + v );
                    match.height( parseFloat( match.prop( 'scrollHeight' ) + parseFloat( match.css("borderTopWidth") ) + parseFloat( match.css("borderBottomWidth") ) ) );
                } else {
                    match.val( v );
                }
                break;
            }
        } else {
            if ( msging_f ) {
                if ( k.charAt( 0 ) == "_" ) {
                    if ( !/^_fs_/.test( k ) || !ga.data.nofcrefresh[ mod ] ) {
                        if ( k == "_iframe" ) {
                            ga.data.iframe( v );
                        }
                        if ( k == "_message" )
                        { 
                            ga.msg.box( v );
                        }
                        if ( k == "_question" )
                        { 
                            // could probably just send data._question==v, data._uuid & data._msgid
                            ga.qr.question( mod, data );
                        }
                        if ( k == "_question_answered" )
                        { 
                            // could probably just send data._question==v, data._uuid & data._msgid
                            ga.qr.answered( mod, data );
                        }
                        if ( k == "_question_timeout" )
                        { 
                            // could probably just send data._question==v, data._uuid & data._msgid
                            ga.qr.timeout( mod, data );
                        }
                        if ( /^_getinput/.test( k ) )
                        { 
                            
                            
                            if ( k == "_getinput" ) {
                                ga.valuen.input( mod, v );
                            }
                        }
                        if ( k == "_textarea" )
                        { 
                            
                            ga.data.textarea( hmod_out2, v );
                        }
                        if ( k == "_airavata" )
                        { 
                            
                            ga.data.airavata( hmod_out2, v );
                        }
                        if ( k == "_status" )
                        { 
                            if ( v == "complete" ) {
                                msging_f( msg_id, 0, 0 );
                            }
                        }
                        if ( k == "_progress" )
                        { 
                            
                            ga.progress( mod, v );
                        }
                    }
                } else {
                    if ( !appended )
                    {
                        jqhmod_out_msgs.append( "<p>Unexpected results:</p>" );
                        appended = 1;
                    }
                    jqhmod_out_msgs.append( "<p>" + k + " => " + v + "</p>" );
                }
            } else {
                if ( k.charAt( 0 ) == "_" ) {
                    if ( !/^_fs_/.test( k ) || !ga.data.nofcrefresh[ mod ] ) {
                        $( "#_state" ).data( k, v );
                        state_changed = 1;
                        if ( k == "_status" )
                        { 
                            
                            retobj.job_status = v;
                        }
                        if ( /^_getinput/.test( k ) )
                        { 
                            
                            
                            if ( k == "_getinput" ) {
                                ga.valuen.input( mod, v );
                            }
                        }
                        if ( k == "_textarea" )
                        { 
                            
                            ga.data.textarea( hmod_out2, v );
                        }
                        if ( k == "_airavata" )
                        { 
                            
                            ga.data.airavata( hmod_out2, v );
                        }
                        if ( k == "_loginverify" )
                        { 
                            
                            ga.login.verify( v );
                        }
                        if ( k == "_loginapprove" )
                        { 
                            
                            ga.login.approve( v );
                        }
                        if ( k == "_progress" )
                        { 
                            
                            ga.progress( mod, v );
                        }
                    }
                } else {
                    if ( k == "-close" )
                    {
                        do_close = 1;
                    } else {
                        if ( k == "-close2" )
                        {
                            do_close2 = 1;
                        } else {
                            if ( !appended )
                            {
                                jqhmod_out_msgs.text( "" );
                                jqhmod_out_msgs.append( "<p>Unexpected results:</p>" );
                                appended = 1;
                                output_msgs_cleared = 1;
                            }
                            jqhmod_out_msgs.append( "<p>" + k + " => " + v + "</p>" );
                        }
                    }
                }
            }
        }
    });
    ga.value.saveLastValues( mod_out );
    ga.value.saveLastValue( mod_out, hmod_out_msgs );
//    ga.progress.clear( mod, 'data.js 2' );
    if ( state_changed )
    {
        syncState();
    }
    if ( do_close )
    {
        ga.msg.close( 1 );
    }
    if ( do_close2 )
    {
        ga.msg.close( 2 );
    }
    return retobj;
};

ga.data.textarea = function( hmod_out, v ) {
    console.log( `ga.data.textarea hmod_out = ${hmod_out}` );
    
    var hmod_out_textarea   = hmod_out + "_textarea";
    var mod_out = hmod_out.replace( /^#/, '' );
    var mod_out_textarea = mod_out + "_textarea"; 

    console.log( `ga.data.textarea hmod_out_textarea = ${hmod_out_textarea}` );

    var jqhmod_out_textarea = $( hmod_out_textarea );
    var isatend = ( jqhmod_out_textarea[0].scrollHeight - jqhmod_out_textarea[0].scrollTop === jqhmod_out_textarea[0].clientHeight );

    
    

    if ( !v ) {
        v = '';
    }


    if ( jqhmod_out_textarea.is( ":hidden" ) ) {

        document.getElementById( mod_out_textarea ).removeAttribute("hidden")
        document.getElementById( mod_out_textarea ).removeAttribute("style")
//        jqhmod_out_textarea.show();
//        $( hmod_out_textarea + "_label" ).show(); 
        var mod_lbl = document.getElementById( mod_out_textarea + "_label" );
        if ( mod_lbl ) {
            mod_lbl.removeAttribute( "hidden" );
            mod_lbl.removeAttribute( "style" );
        }
    }

    if ( v.substr( 0, 10 ) == "__reset__\n" ) {
        jqhmod_out_textarea.val( v.substr( 10 ) );
    } else {
        jqhmod_out_textarea.val( jqhmod_out_textarea.val() + v );
    }
    if ( !ga.set( "textarea:rows" ) ) {

        jqhmod_out_textarea.height( parseFloat( jqhmod_out_textarea.prop( 'scrollHeight' ) ) + 
                                    parseFloat( jqhmod_out_textarea.css ( 'borderTopWidth' ) ) + 
                                    parseFloat( jqhmod_out_textarea.css ( 'borderBottomWidth' ) ) );
    } else {
        if ( !ga.data.textarea.h[ hmod_out ] ) {
            ga.data.textarea.h[ hmod_out ] = parseFloat( jqhmod_out_textarea.prop( 'clientHeight' ) ) + 
                parseFloat( jqhmod_out_textarea.css ( 'borderTopWidth' ) ) + 
                parseFloat( jqhmod_out_textarea.css ( 'borderBottomWidth' ) );
            
        } else {
            jqhmod_out_textarea.height( ga.data.textarea.h[ hmod_out ] );
            
        }
    }
    
    if ( isatend ) {
        jqhmod_out_textarea.scrollTop( jqhmod_out_textarea[0].scrollHeight );
    }
};

ga.data.textarea.h = {};
    
ga.data.airavata = function( hmod_out, v ) {
    var hmod_out_airavata   = hmod_out + "_airavata",
        jqhmod_out_airavata = $( hmod_out_airavata );


    if ( jqhmod_out_airavata.is( ":hidden" ) ) {
        jqhmod_out_airavata.show();
    }
        
    jqhmod_out_airavata.html( v );
}

ga.data.iframe = function( v ) {
    
    

    
    
    document.getElementById( v.id ).src = `http://${window.location.hostname}:${v.port}`;
}
/*jslint white: true, plusplus: true*/
/* assumes: jquery > 1.11.0, jqtree >= 3.0.9, jquery-base64 */

// create or join a sync group
ga.sync = function( pkg, mod, sync ) {
    
    var i,
    jqt = $( "#" + mod ),
    jqo;

    // does one already exist in DOM, if so, set our val to it
    if ( jqt &&
         ga.sync.data &&
         ga.sync.data[ pkg ] &&
         ga.sync.data[ pkg ][ sync ] ) {
        ga.sync.data[ pkg ][ sync ][ mod ] = true;
        for ( i in ga.sync.data[ pkg ][ sync ] ) {
            if ( i != mod ) {
                jqo = $( "#" + i );
                if ( jqo && $.isNumeric( jqo.val() ) ) {
                    
                    jqt.val( jqo.val() );
                    jqt.change();
                    return;
                }
            }
        }
        if ( ga.sync.data[ pkg ][ sync ]._lastval &&
             $.isNumeric( ga.sync.data[ pkg ][ sync ]._lastval ) )
        {
            
            jqt.val( ga.sync.data[ pkg ][ sync ]._lastval );
            jqt.change();
            return;
        }
        
        return;
    }        
    ga.sync.data = ga.sync.data || {};
    ga.sync.data[ pkg ] = ga.sync.data[ pkg ] || {};
    ga.sync.data[ pkg ][ sync ] = ga.sync.data[ pkg ][ sync ] || {};
    ga.sync.data[ pkg ][ sync ][ mod ] = true;
}

// when a value changes, also set the others in the sync group
ga.sync.change = function( pkg, mod, sync ) {
    var i,
    jqt = $( "#" + mod ),
    jqtv,
    jqo;
    

    if ( !( jqt &&
            $.isNumeric( jqt.val() ) &&
            ga.sync.data &&
            ga.sync.data[ pkg ] &&
            ga.sync.data[ pkg ][ sync ] ) ) {
        // nothing to do
        
        return;
    }
    
    ga.sync.data[ pkg ][ sync ]._lastval = jqt.val();
    for ( i in ga.sync.data[ pkg ][ sync ] ) {
        if ( i != mod ) {
            jqo = $( "#" + i );
            if ( jqo && jqo.val() != jqt.val() ) {
                
                jqo.val( jqt.val() );
                jqo.change();
            }
        }
    }
}
    
ga.sync.reset = function( pkg ) {
    var i;
    

    if ( !( ga.sync.data &&
            ga.sync.data[ pkg ] ) ) {
        
        return;
    }

    for ( i in ga.sync.data[ pkg ] ) {
        
        if ( ga.sync.data[ pkg ][ i ]._lastval ) {
            
            delete ga.sync.data[ pkg ][ i ]._lastval;
        }
        
    }
}

/*jslint white: true, plusplus: true*/
/* assumes: jquery > 1.11.0, jqtree >= 3.0.9, jquery-base64 */

ga.valuen = {};
ga.valuen.data = {};
ga.valuen.html = {};
ga.valuen.dflt = {};
ga.valuen.dflt.data = {};
ga.valuen.dflt.html = {};
ga.valuen.lastload = "";

// restore data to form

ga.valuen.restore = function( form, data, html ) {
    var hform = "#" + form,
        jqhform = $( hform ),
        els = jqhform.find(':input').get(),
        repeaters = {},
        repeaters_added,
        i;

    data = data || ga.valuen.data[ form ];
    html = html || ga.valuen.html[ form ];

    

    if ( !data ) {
        // console.warn( "ga.valuen.restore( " + form + " ) no data" );
        return;
    }
    // if ( !html ) {
    // // console.warn( "ga.valuen.restore( " + form + " ) no html" );
    // return;
    //}

    $( hform + " .field_msg" ).empty();

    // add repeaters repeatedly until no more unassigned repeaters exist
    
    do {
        repeaters_added = false;
        $.each(els, function() {
            var i,
            names,
            $this = $( this ),
            val,
            found
            ;

            if ( $this.attr( "data-repeater" ) &&
                 !repeaters[ this.name ] ) {
                
                repeaters[ this.name ] = true;

                if ( this.name && 
                     ( data[ this.name ] ||
                       /checkbox|radio/i.test( this.type ) )
                   ) {
                    names = data[ this.name ];
                    if( /checkbox|radio/i.test( this.type ) ) { 
                        val = $this.val();
                        found = false;
                        if ( names ) {
                            for( i = 0; i < names.length; i++ ) {
                                if( names[ i ] == val ) {
                                    found = true;
                                    break;
                                }
                            }
                        }
                        $this.prop( "checked", found );
                        
                    } else {
                        $this.val( names[ 0 ] );
                        
                    }
                    // probably need to update repeaters at this point
                    repeaters_added = true;
                    ga.repeat.change( form, this.name, true );
                    
                    els = jqhform.find(':input').get();
                    return false;  // "break" equivalent for jquery's $.each
                } else {
                    if ( !data[ this.name ] && 
                         !/checkbox|radio/i.test( this.type ) ) {
                        console.warn( "ga.valuen.restore() no data found for repeater setting value on " + this.name + " type " + this.type + " to " + names[ 0 ] );
                    }
                }
            }
        });
    } while ( repeaters_added );

    // everything else

    $.each(els, function() {
        var i,
            names,
            $this,
            val,
            found,
            typetype,
            typenames
            ;
        
        if ( this.name && 
             !repeaters[ this.name ] ) {
            $this = $( this );
            if ( ( data[ this.name ] ||
                   /checkbox|radio/i.test( this.type ) ) &&
                 !/button/i.test( this.nodeName )
               ) {
                names = data[ this.name ];
                if( /checkbox|radio/i.test( this.type ) ) { 
                    val = $this.val();
                    found = false;
                    if ( names ) {
                        for( i = 0; i < names.length; i++ ) {
                            if( names[ i ] == val ) {
                                found = true;
                                break;
                            }
                        }
                    }
                    $this.prop( "checked", found );
                    
                } else {
                    if ( this.type === "file" ) {
                        if ( names[ 0 ] ) {
                            $( "#" + this.id + "_msg" ).html( " " + names[ 0 ] + " please reload manually (programmatic setting of local files disallowed by browser security)" );
                        } else {
                            $this.val( "" );
                        }
                    } else {
                        $this.val( names[ 0 ] );
                    }
                    
                }
            } else {
                if ( /button/i.test( this.nodeName ) &&
                     ( typetype = $this.attr( "data-type" ) ) ) {
                    
                    typenames = ga.altfile.button.getnames( this.id, typetype );
                    if ( typenames ) {
                        for ( i = 0; i < typenames.length; ++i ) {
                            
                            if ( data[ typenames[ i ] ] ) {
                                
                                ga.altfile.button.addhtml( form, this.id, typetype, data[ typenames[ i ] ] );
                            }
                        }
                    }   
                }
            }    
        }
    });

    // set html

    for ( i in html ) {
        
        $( "#" + i ).html( html[ i ] );
    };
}

// restore data to form from dflts

ga.valuen.restore.dflt = function( form ) {
    return ga.valuen.restore( form, ga.valuen.dflt.data[ form ], ga.valuen.dflt.html[ form ] );
}

// save data from form and optionally store as dflt

ga.valuen.save = function( form, asdflt ) {
    var els = $( "#" + form ).find(':input').get();
        data = {},
        html = {};
    

    // ga.valuen.data[ form ] = {};
    // ga.valuen.html[ form ] = {};

    $.each( els, function() {
        var tjq = $( this ),
            namenotdisabled = this.name && !this.disabled,
            idadd = tjq.attr( "data-add" );

        
        if ( namenotdisabled ) {
            if ( this.checked
                 || /select|textarea/i.test( this.nodeName )
                 || /file|email|number|text|hidden|password/i.test( this.type )
               ) {
                if( data[ this.name ] == undefined ){
                    data[ this.name ] = [];
                }
                data[ this.name ].push( tjq.val() );
                
            }
            if ( idadd ) {
                
                if( html[ idadd ] == undefined ){
                    html[ idadd ] = [];
                }
                html[ idadd ].push( $( "#" + idadd ).html() );
            }                
        }
    });

    if ( asdflt ) {
        ga.valuen.dflt.data[ form ] = data;
        ga.valuen.dflt.html[ form ] = html;
    } else {
        ga.valuen.data[ form ] = data;
        ga.valuen.html[ form ] = html;
    }
}

// take input data and put on form

ga.valuen.input = function( form, data ) {
    
    var hform = "#" + form,
        jqhform = $( hform ),
        els = jqhform.find(':input').get(),
        repeaters = {},
        repeaters_added,
        i;

//    $.each( data, function(k, v) {
//        console.log( "ga.valuen.input() k " + k + " v " + v );
//    });

    

    if ( !data ) {
        console.warn( "ga.valuen.input( " + form + " ) no data" );
        return;
    }

    // add repeaters repeatedly until no more unassigned repeaters exist
    
    do {
        repeaters_added = false;
        $.each(els, function() {
            var i,
            names,
            $this = $( this ),
            val,
            found
            ;

            if ( $this.attr( "data-repeater" ) &&
                 !repeaters[ this.name ] ) {
                
                repeaters[ this.name ] = true;

                if ( this.name && 
                     ( data[ this.name ] ||
                       /checkbox|radio/i.test( this.type ) )
                   ) {
                    names = data[ this.name ];
                    if ( Object.prototype.toString.call(names) !== '[object Array]' ) {
                        names = [ names ];
                    }
                    if( /checkbox|radio/i.test( this.type ) ) { 
                        val = $this.val();
                        found = false;
                        if ( names ) {
                            for( i = 0; i < names.length; i++ ) {
                                if( names[ i ] == val ) {
                                    found = true;
                                    break;
                                }
                            }
                        }
                        $this.prop( "checked", found );
                        
                    } else {
                        $this.val( names[ 0 ] );
                        
                    }
                    // probably need to update repeaters at this point
                    repeaters_added = true;
                    ga.repeat.change( form, this.name, true );
                    
                    els = jqhform.find(':input').get();
                    return false;  // "break" equivalent for jquery's $.each
                } else {
                    if ( !data[ this.name ] && 
                         !/checkbox|radio/i.test( this.type ) ) {
                        console.warn( "ga.valuen.input() no data found for repeater setting value on " + this.name + " type " + this.type + " to " + names[ 0 ] );
                    }
                }
            }
        });
    } while ( repeaters_added );

    // everything else

    $.each(els, function() {
        var i,
            names,
            $this,
            val,
            found,
            typetype,
            typenames
            ;
        
        if ( this.name && 
             !repeaters[ this.name ] ) {
            $this = $( this );
            if ( ( data[ this.name ] ||
                   /checkbox|radio/i.test( this.type ) ) &&
                 !/button/i.test( this.nodeName )
               ) {
                names = data[ this.name ];
                if ( Object.prototype.toString.call(names) !== '[object Array]' ) {
                    names = [ names ];
                }
                if( /checkbox|radio/i.test( this.type ) ) { 
                    val = $this.val();
                    found = false;
                    if ( names ) {
                        for( i = 0; i < names.length; i++ ) {
                            if( names[ i ] == val ) {
                                found = true;
                                break;
                            }
                        }
                    }
                    $this.prop( "checked", found );
                    
                } else {
                    if ( this.type === "file" ) {
                        if ( names[ 0 ] ) {
                            $( "#" + this.id + "_msg" ).html( " " + names[ 0 ] + " please reload manually (programmatic setting of local files disallowed by browser security)" );
                        }
                    } else {
                        $this.val( names[ 0 ] );
                    }
                    
                }
            } else {
                if ( /button/i.test( this.nodeName ) &&
                     ( typetype = $this.attr( "data-type" ) ) ) {
                    
                    typenames      = ga.altfile.button.getnames     ( this.id, typetype );
                    typenamesinput = ga.altfile.button.getnamesinput( this.id, typetype );
                    if ( typenames ) {
                        for ( i = 0; i < typenames.length; ++i ) {
                            
                            if ( data[ typenamesinput[ i ] ] ) {
                                
                                ga.altfile.button.addhtml( form, this.id, typetype, data[ typenamesinput[ i ] ] );
                            }
                        }
                    }   
                }
            }    
        }
    });

    $.each( data, function(k, v) {
        var jqk;
        if ( /^_html_/.test( k ) ) {
            k = k.replace( /^_html_/, "" );
            if ( jqk = $( "#" + k ) ) {
                jqk.html( v );
            }
        }
//        if ( k == "_datetime" ) {
//            jqhform.prepend( "<span class='removeme'><p><i>Reattached from job submitted at " + v + " </i></p></span>" );
//        }
    });
}

ga.valuen.addhtml = function( form ) {
    var jqhform = $( "#" + form ),
        els = jqhform.find(':input').get(),
        add = "";

    

    $.each( els, function() {
        var tjq = $( this ),
            namenotdisabled = this.name && !this.disabled,
            idadd = tjq.attr( "data-add" );

        if ( namenotdisabled ) {
            if ( idadd ) {
                
                add += '<input type="hidden" name="_html_' + idadd + '" value="' +  $( "#" + idadd ).html() + '">';
            }                
        }
    });

    

    jqhform.append( add );
}

ga.valuen.reset = function() {
    ga.valuen.data = {};
    ga.valuen.html = {};
    ga.valuen.dflt = {};
    ga.valuen.dflt.data = {};
    ga.valuen.dflt.html = {};
    ga.valuen.lastload = "";
}    
/*jslint white: true, plusplus: true*/
/* assumes: jquery > 1.11.0, jqtree >= 3.0.9, jquery-base64 */

ga.license = function( req ) {
    var checks = req.split( ',' ),
        needs = [],
        msg,
        button_info = [],
        i;

    ;

    if ( checks.length ) {
        msg = 
            "<p>Submitting to this module requires " + 
            ( checks.length > 1 ? "approved licenses" : "an approved license" ) 
            + " for <em>" + checks.join( "</em> and <em>" ) + "</em></p>";
    }

    for ( i in checks ) {
        button_info.push( { id : checks[ i ],
                            label : checks[ i ] + " Management",
                            data : checks[ i ],
                            cb : function( data ) { return ga.altfile.button.simplecall( "license", data ); } } );
        ;
        if ( ga.license.data[ checks[ i ] ] &&
             ga.license.data[ checks[ i ] ][ 'status' ] ) {
            switch ( ga.license.data[ checks[ i ] ][ 'status' ] ) {
            case "approved" :
                ;
                break;
            case "denied" :
                ;
                msg += "<p>Your license request for <em>" + checks[ i ] + "</em> has been <strong>denied</strong>.</p>";
                needs.push( checks[ i ] );
                break;
            case "pending" :
                ;
                msg += "<p>Your license request for <em>" + checks[ i ] + "</em> is pending approval.</p>";
                needs.push( checks[ i ] );
                break;
            default :
                console.warn( "ga.license() " + checks[ i ] + " unknown status " + ga.license.data[ checks[ i ] ][ 'status' ] );
                needs.push( checks[ i ] );
                break;
            }
        } else {
            needs.push( checks[ i ] );
        }
    }

    if ( needs.length ) {

        ga.msg.box( {
            icon  : "warning.png",
            text  : msg,
            buttons : button_info
        });
        return false;
    } else {
        return true;
    }
}

ga.license.data = {};

// get licenses for user
ga.license.get = function() {
    ;

    ga.license.data = {};

    if ( ga.license.url ) {
        ;

        $.getJSON( 
            ga.license.url,
            {
                tagmode: "any"
                ,format: "json"
                ,_window : window.name
                ,_logon : $( "#_state" ).data( "_logon" )
            } )
            .done( function( data, status, xhr ) {
                ;
                if ( data[ 'license' ] ) {
                    ga.license.data = data[ 'license' ];
                }
                if ( data[ 'restricted' ] ) {
                    ga.restricted.show( data[ 'restricted' ] );
                } else {
                    ga.restricted.hideall();
                }
                
            })
            .fail( function( xhr, status, errorThrown ) {
                ;
                console.warn( "could not get license data" );
            });
    } else {
        ;
    }
}
/*jslint white: true, plusplus: true*/
/* assumes: jquery > 1.11.0, jqtree >= 3.0.9, jquery-base64 */

ga.captcha = function( cb, form ) {
    var msg = "";

    

// get json of captcha and key ( mongo'd )
// assemble msg with image uuencoded
// display and on callback, verify and continue with submit

    $.ajax( { url:ga.captcha.url , data:{ _window: window.name } } ).success( function( data ) {
        
        data = $.parseJSON( data );
        
        if ( data.error ) {
            ga.msg.box( {
                icon : "toast.png"
                ,text  : data.error
            } );
            return;
        }
            
        msg = 
            '<img src="data:image/png;base64,' + data.captcha + '">' +
            '<form id="sys_captcha">' +
            '<label for="sys_captcha_text">Verify </label>' + 
            '<input id="sys_captcha_text" class="help_link" type="text" maxlength="6" size="6" required>' +
            '<span class="help">Enter the 6 character alphanumeric code shown in the image and then press submit</span>' +
            '<input id="sys_captcha_id" type="hidden" value="' + data.id + '">' +
            '</form>'
        ;
        
        ga.msg.box( {
            text  : msg
            ,eval  : "ga.hhelp.reset();$('#sys_captcha').on('keyup keypress', function(e) { var code = e.keyCode || e.which;  if (code  == 13) { e.preventDefault(); return false; }});"
            ,buttons : [
                { 
                    id    : "submit"
                    ,label : "Submit"
                    ,cb    : ga.captcha.verify
                    ,data  : { 
                        cb   : cb
                        ,data : form
                    }
                }
            ]
        } );
    }).error( function( error ) {
        ga.msg.box( {
            icon : "toast.png"
            ,text  : "Error contacting server"
        } );
    });
}

ga.captcha.verify = function( data ) {
    
    
    

    $.ajax( { url:ga.captcha.url_verify
              ,data:{ 
                  _window  : window.name 
                  ,captcha : $( "#sys_captcha_text" ).val() 
                  ,id      : $( "#sys_captcha_id" ).val() 
              } 
            } ).success( function( vdata ) {
                
                vdata = $.parseJSON( vdata );
                
                if ( vdata.error ) {
                    ga.msg.box( {
                        icon : "toast.png"
                        ,text  : vdata.error
                    } );
                    return;
                }
                if ( vdata.success ) {
                    data.cb( data.data );
                } else {
                    return ga.captcha( data.cb, data.data );
                }
           })
        .error( function( error ) {
            ga.msg.box( {
                icon : "toast.png"
                ,text  : "Error contacting server"
            } );
        });
}
    
/*jslint white: true, plusplus: true*/
/* assumes: jquery > 1.11.0, jqtree >= 3.0.9, jquery-base64 */

ga.register = function( req ) {
    var checks = req.split( ',' ),
        needs = [],
        msg,
        button_info = [],
        i;

    ;

    if ( checks.length ) {
        msg = 
            "<p>Submitting to this module requires " + 
            ( checks.length > 1 ? "approved registers" : "an approved register" ) 
            + " for <em>" + checks.join( "</em> and <em>" ) + "</em></p>";
    }

    for ( i in checks ) {
        button_info.push( { id : checks[ i ],
                            label : checks[ i ] + " Management",
                            data : checks[ i ],
                            cb : function( data ) { return ga.altfile.button.simplecall( "register", data ); } } );
        ;
        if ( ga.register.data[ checks[ i ] ] &&
             ga.register.data[ checks[ i ] ][ 'status' ] ) {
            switch ( ga.register.data[ checks[ i ] ][ 'status' ] ) {
            case "approved" :
                ;
                break;
            case "denied" :
                ;
                msg += "<p>Your register request for <em>" + checks[ i ] + "</em> has been <strong>denied</strong>.</p>";
                needs.push( checks[ i ] );
                break;
            case "pending" :
                ;
                msg += "<p>Your register request for <em>" + checks[ i ] + "</em> is pending approval.</p>";
                needs.push( checks[ i ] );
                break;
            default :
                console.warn( "ga.register() " + checks[ i ] + " unknown status " + ga.register.data[ checks[ i ] ][ 'status' ] );
                needs.push( checks[ i ] );
                break;
            }
        } else {
            needs.push( checks[ i ] );
        }
    }

    if ( needs.length ) {

        ga.msg.box( {
            icon  : "warning.png",
            text  : msg,
            buttons : button_info
        });
        return false;
    } else {
        return true;
    }
}

ga.register.data = {};

// get registers for user
ga.register.get = function() {
    ;

    ga.register.data = {};

    if ( ga.register.url ) {
        ;

        $.getJSON( 
            ga.register.url,
            {
                tagmode: "any"
                ,format: "json"
                ,_window : window.name
                ,_logon : $( "#_state" ).data( "_logon" )
            } )
            .done( function( data, status, xhr ) {
                ;
                if ( data[ 'register' ] ) {
                    ga.register.data = data[ 'register' ];
                }
                if ( data[ 'restricted' ] ) {
                    ga.restricted.show( data[ 'restricted' ] );
                } else {
                    ga.restricted.hideall();
                }
                
            })
            .fail( function( xhr, status, errorThrown ) {
                ;
                console.warn( "could not get register data" );
            });
    } else {
        ;
    }
}
/*jslint white: true, plusplus: true*/
/* assumes: jquery > 1.11.0 */

ga.calc               = {};
ga.calc.data          = {};

// ----------------------------------------------------------------------------------------------------------
// background
// ----------------------------------------------------------------------------------------------------------
// calc provides field calculation based upon other fields
// ----------------------------------------------------------------------------------------------------------
// summary of data structures
// ----------------------------------------------------------------------------------------------------------
// ga.calc.data[ mod ]                          : the module specific data object 
// ga.calc.data[ mod ].calc                     : calc data object 
// ga.calc.data[ mod ].calc[ id ]               : calc data object for an id
// ga.calc.data[ mod ].calc[ id ].calc          : calc data object's calc info
// ga.calc.data[ mod ].calc[ id ].tokens        : calc data object's calc info as an array
// ga.calc.data[ mod ].calc[ id ].dependents    : calc data object's dependents (field ids) as an array
// ga.calc.data[ mod ].calc[ id ].tree          : calc data object's tree structure
// ----------------------------------------------------------------------------------------------------------
// summary of operations
// ----------------------------------------------------------------------------------------------------------
// ga.calc.register    : register a calculated field
// ga.calc.tokens      : convert calc string to tokens
// ga.calc.dependents  : trim tokens array to dependent variables
// ga.calc.depthofdeps : computes depth of dependents to make sure there are no circular variable references
// ga.calc.install     : install change handlers
// ga.calc.process     : update field
// ga.calc.parensub    : utility routine used internally to extract a () section of the calc
// ga.calc.mktree      : converts a calc array to a tree structure
// ga.calc.arraytovals : utility routine used internally to convert strings to numeric values
// ga.calc.evaltree    : evaluates a tree structure
// ----------------------------------------------------------------------------------------------------------

// regexp and general routines

ga.calc.str_atom_numeric         = "(?:(?:-?[1-9][0-9]*)|(?:-?0))?(?:[.][0-9]+)?(?:[eE][-+]?[0-9]+)?";
ga.calc.str_atom_id              = "[A-Za-z][A-Za-z0-9_:]*";
ga.calc.str_function             = "(?:abs\\(|acos\\(|asin\\(|atan\\(|atan2\\(|ceil\\(|cos\\(|exp\\(|floor\\(|log\\(|max\\(|min\\(|pow\\(|random\\(|round\\(|sin\\(|sqrt\\(|tan\\(|-)";
ga.calc.str_function_paren       = "(?:abs\\(|acos\\(|asin\\(|atan\\(|atan2\\(|ceil\\(|cos\\(|exp\\(|floor\\(|log\\(|max\\(|min\\(|pow\\(|random\\(|round\\(|sin\\(|sqrt\\(|tan\\()";
ga.calc.str_function_no_paren    = "-";
ga.calc.str_binary               = "[-,+*/^]";
ga.calc.str_open_paren           = "\\(";
ga.calc.str_close_paren          = "\\)";
ga.calc.str_paren                = "[()]";

ga.calc.is_atom_numeric          = RegExp( "^" + ga.calc.str_atom_numeric         + "$" );
ga.calc.is_atom_id               = RegExp( "^" + ga.calc.str_atom_id              + "$" );
ga.calc.is_function              = RegExp( "^" + ga.calc.str_function             + "$" );
ga.calc.is_function_paren        = RegExp( "^" + ga.calc.str_function_paren       + "$" );
ga.calc.is_function_no_paren     = RegExp( "^" + ga.calc.str_function_no_paren    + "$" );
ga.calc.is_binary                = RegExp( "^" + ga.calc.str_binary               + "$" );
ga.calc.is_open_paren            = RegExp( "^" + ga.calc.str_open_paren           + "$" );
ga.calc.is_close_paren           = RegExp( "^" + ga.calc.str_close_paren          + "$" );
ga.calc.is_paren                 = RegExp( "^" + ga.calc.str_paren                + "$" );

ga.calc.is_atom                  = RegExp( "^(" + ga.calc.str_atom_id + "|" + ga.calc.str_atom_numeric + ")$" );

ga.calc.inc_paren                = RegExp( "^(" + ga.calc.str_paren + "|" + ga.calc.str_function_paren + ")$" );

ga.calc.precedence = 
    { 
        "^" : 4,
        "*" : 5,
        "/" : 5,
        "+" : 6,
        "-" : 6,
        "," : 8
    }
;

// register a calculated field
ga.calc.register = function( mod, id, calc ) {
    

    ga.calc.data[ mod ] = ga.calc.data[ mod ] || {};
    ga.calc.data[ mod ].calc = ga.calc.data[ mod ].calc || {};
    ga.calc.data[ mod ].calc[ id ] = {};
    ga.calc.data[ mod ].calc[ id ].calc = calc;
    ga.calc.data[ mod ].calc[ id ].tokens = ga.calc.tokens( calc );
    if ( ga.calc.data[ mod ].calc[ id ].tokens._error ) {
        ga.msg.box( { 
            icon: "toast.png",
            text: "Module field calc internal error (tokens): " + ga.calc.data[ mod ].calc[ id ].tokens._error + " in calc field id " + id
        } );
        return;
    }

    ga.calc.repeatertokens( mod, id );

    ga.calc.data[ mod ].calc[ id ].dependents = ga.calc.dependents( mod, id );
    
    if ( ga.calc.depthofdeps( mod, id ) > 99 ) {
        ga.msg.box( {
            icon: "toast.png",
            text: "Module field calc internal error: maximum recursion depth found in calc field id " + id
        } );
        return;
    }
    ga.calc.data[ mod ].calc[ id ].tree = ga.calc.mktree( ga.calc.data[ mod ].calc[ id ].tokens );
    if ( ga.calc.data[ mod ].calc[ id ].tree._error ) {
        ga.msg.box( { 
            icon: "toast.png",
            text: "Module field calc internal error (tree): " + ga.calc.data[ mod ].calc[ id ].tree._error + " in calc field id " + id
        } );
        return;
    }

    ga.calc.install( mod, id );
}

// check if id is repeater and if so, replace tokens
ga.calc.repeatertokens = function( mod, id ) {
    
    var a,
        orgid,
        prefix,
        suffix;

    if ( !/-/.test( id ) ) {
        return;
    }

    

    // find original id

    a = id.split( "-" );

    if ( /\d+/.test( a[ a.length - 1 ] ) ) {
        prefix = a.slice( 0, a.length - 2 ).join( ":" ) + ":"
        orgid  = a[ a.length - 2 ];
        suffix = ":" + a[ a.length - 1 ];
    } else {
        prefix = a.slice( 0, a.length - 1 ).join( ":" ) + ":";
        orgid  = a[ a.length - 1 ];
        suffix = "";
    }
        
    
    
    
    
    for ( i in ga.calc.data[ mod ].calc[ id ].tokens ) {
        // is an atom id and does it not already exist in the dom ?
        if ( ga.calc.is_atom_id.test( ga.calc.data[ mod ].calc[ id ].tokens[ i ] ) &&
             !$( "#" + ga.calc.data[ mod ].calc[ id ].tokens[ i ] ).length ) {
            // then replace with repeater version

            ga.calc.data[ mod ].calc[ id ].tokens[ i ] =
                prefix + ga.calc.data[ mod ].calc[ id ].tokens[ i ] + suffix;
            
        }
    }
}
    
// check calc depth of dependent variables
ga.calc.depthofdeps = function( mod, id, depth ) {
    
    var i, 
        childdepth,
        maxchilddepth = 0;

    depth = depth || 0;

    if ( ga.calc.data[ mod ].calc[ id ].dependents ) {
        depth++;
    }

    if ( depth > 99 ) {
        return depth;
    }

    for ( i = 0; i < ga.calc.data[ mod ].calc[ id ].dependents.length; ++i ) {
        
        if ( ga.calc.data[ mod ].calc[ ga.calc.data[ mod ].calc[ id ].dependents[ i ] ] ) {
            
            childdepth = ga.calc.depthofdeps( mod, ga.calc.data[ mod ].calc[ id ].dependents[ i ], depth );
            if ( maxchilddepth < childdepth ) {
                maxchilddepth = childdepth;
            }
        }
    }

    depth += maxchilddepth;

    return depth;
}

// get dependent variables
ga.calc.dependents = function( mod, id ) {
    
    var i,
        dependents = []
    ;

    for ( i in ga.calc.data[ mod ].calc[ id ].tokens ) {
        
        if ( ga.calc.is_atom_id.test( ga.calc.data[ mod ].calc[ id ].tokens[ i ] ) ) {
            dependents.push( ga.calc.data[ mod ].calc[ id ].tokens[ i ] );
        }
    }
    

    return dependents;
}

// install change handlers
ga.calc.install = function( mod, id ) {
    
    var i;
    for ( i in ga.calc.data[ mod ].calc[ id ].dependents ) {
        $( "#" + ga.calc.data[ mod ].calc[ id ].dependents[ i ].replace( /:/g, "-" ) ).on( "change", function() { ga.calc.process( mod, id ); } );
    }
}

// update field
ga.calc.process = function( mod, id ) {
    
    var result = ga.calc.evaltree( jQuery.extend( true, {}, ga.calc.data[ mod ].calc[ id ].tree ) );

    if ( result._error ) {
        ga.msg.box( { 
            icon: "toast.png",
            text: "Module field calc internal error: " + result._error + " in calc field id " + id
        } );
        return;
    }

    // convert to exponential format ?
    // if ( result.constructor === Array ) {
    // for ( var i = 0; i < result.length; ++i ) {
    // result[ i ] = result[ i ].toExponential( 8 );
    // } else {
    // result = result.toExponential( 8 );
    // }

    $( "#" + id ).val( result ).trigger( "change" );
}

// convert calc string into a token list
ga.calc.tokens = function( calc ) {
    
    var tokens = [],
        new_tokens,
        last_is_atom = [],

        tokenize            = RegExp( "^(" + ga.calc.str_function_paren + "|" + ga.calc.str_atom_id + "|" + ga.calc.str_paren + "|" + ga.calc.str_atom_numeric + "|" + ga.calc.str_function_no_paren + ")" ),
        tokenize_after_atom = RegExp( "^(" + ga.calc.str_binary + "|" + ga.calc.str_close_paren + ")" ),

        maxtokens = 500,
        tokensleft = maxtokens;

    ;

    calc = calc.replace( /\s+/g, "" );

    last_is_atom.push( 0 );

    do {
        

        if ( last_is_atom.length > 0 && last_is_atom[ last_is_atom.length - 1 ] ) {
            
            new_tokens = tokenize_after_atom.exec( calc );
            if ( !new_tokens ) {
                return { _error : "Invalid token found " + calc };
                break;
            }
            if ( ga.calc.is_close_paren.test( new_tokens[ 0 ] ) ) {
                if ( !last_is_atom.length ) {
                    return { _error : "Invalid closing parenthesis " + calc };
                    break;
                }
                last_is_atom.pop();
                last_is_atom.pop();
                last_is_atom.push( 1 );
            } else {
                last_is_atom[ last_is_atom.length - 1 ] = 0;
            }
        } else {
            
            new_tokens = tokenize.exec( calc );
            if ( !new_tokens ) {
                return { _error : "Invalid token found " + calc };
                break;
            }
            if ( ga.calc.is_atom.test( new_tokens[ 0 ] ) ) {
                last_is_atom[last_is_atom.length - 1 ] = 1;
            } else { 
                if ( ga.calc.is_open_paren.test( new_tokens[ 0 ] ) ) {
                    last_is_atom.push( 0 );
                } else {
                    if ( ga.calc.is_close_paren.test( new_tokens[ 0 ] ) ) {
                        if ( !last_is_atom.length ) {
                            return { _error : "Invalid closing parenthesis " + calc };
                            break;
                        }
                        last_is_atom.pop();
                        last_is_atom.pop();
                        last_is_atom.push( 1 );
                    } else {
                        if ( ga.calc.is_function_paren.test( new_tokens[ 0 ] ) ) {
                            last_is_atom.push( 0 );
                        }
                    }
                }
            }
        }

        

        calc = calc.substring( new_tokens[ 0 ].length );
        tokens.push( new_tokens[ 0 ] );

    } while ( new_tokens && new_tokens.length && calc.length && --tokensleft > 0 );
            

    
    

    if ( tokensleft <= 0 ) {
        return { _error : "maximum token limit of " + maxtokens + " reached" };
    }

    return tokens;
}

// --- parensub, return a subarray past the first paren and upto (not including ) the last matching paren ---
ga.calc.parensub = function( a ) {
    var parencount = 1,
        result = { a : [] };

    for ( var i = 1; i < a.length; ++i ) {
        if ( a[ i ] == ")" ) {
            parencount--;
            if ( parencount == 0 ) {
                result.newofs = i;
                return result;
            }
        }

        result.a.push( a[ i ] );
            
        if ( /\($/.test( a[ i ] ) ) {
            parencount++;
        }
    }

    return { _error : "Closing parenthesis error" };
}

// --- build tree ---

ga.calc.mktree = function( a, obj ) {
    obj = obj;
    var args = [],
        op = null,
        tmp,
        paren
    ;

    // console.log( "a.length " + a.length );

    for ( var i = 0; i < a.length; ++i ) {
        token = a[ i ];
        // console.log( "this pos " + i + " token " + token ); 
        if ( ga.calc.is_function_paren.test( token ) ) {
            // console.log( "function paren test" );
            tmp = ga.calc.parensub( a.slice( i ) );
            if ( tmp._error ) {
                return tmp;
            }
            i += tmp.newofs;
            token = { op : token, args : [ tmp = ga.calc.mktree( tmp.a ) ] };
            paren = 1;
            if ( tmp._error ) {
                return tmp;
            }
        } else {
            if ( ga.calc.is_open_paren.test( token ) ) {
                // console.log( "open paren test" );
                tmp = ga.calc.parensub( a.slice( i ) );
                if ( tmp._error ) {
                    return tmp;
                }
                i += tmp.newofs;
                token = ga.calc.mktree( tmp.a );
                if ( token._error ) {
                    return token;
                }
                paren = 1;
            } else {
                // console.log( "no paren test" );
                paren = 0;
            }
        }

        if ( paren || ga.calc.is_atom.test( token ) ) {
            // console.log( "paren or is atom test" );
            args.push( token );
            if ( op ) {
                if ( obj ) {
                    if ( ga.calc.precedence[ op ] < ga.calc.precedence[ obj.op ] ) {
                        // then replace 2nd arg
                        console.log( "replace 2nd arg" );
                        obj.args[ 1 ] = { op : op, args : [ obj.args[ 1 ], token ] };
                    } else {
                        console.log( "replace parent object" );
                        // replace parent object
                        obj = { op : op, args : [ obj, token ] };
                    }
                } else {
                    obj = { op : op, args : args };
                    op = null;
                    args = [];
                }
                // console.log( "continue1" );
                continue;
            }
        } else {
            if ( ga.calc.is_binary.test( token ) ) {
                // console.log( "op is binary, op now " + token );
                op = token;
                // console.log( "continue2" );
                continue;
            } else {
                // console.log( "op is not binary, op still " + op );
            }
        }
    }
            
    if ( !obj && args.length ) {
        obj = { op : "()", args : args };
    }
        
            
    // console.log( "return mktree : " + util.inspect( obj, false, null ) );

    return obj;
}    

// --- eval tree ---

ga.calc.arraytovals = function ( a ) {
    var i;
    if ( a.constructor === Array ) {
        for ( i = 0; i < a.length; ++i ) {
            a[ i ] = Number( ga.calc.is_atom_id.test( a[ i ] ) ? $( "#" + a[ i ].replace( /:/g, "-" ) ).val() : a[ i ] );
        }
    } else {
        a = Number( ga.calc.is_atom_id.test( a ) ? $( "#" + a.replace( /:/g, "-" ) ).val() : a );
    }
    return a;
}

ga.calc.evaltree = function( obj ) {
    var result,
        twoargs,
        arg0array,
        arg1array,
        anyarray,
        botharray,
        minlenarray,
        maxlenarray,
        arg0minlen,
        scalararg,
        hasargs = 1,
        i
    ;

    // console.log( "ga.calc.evaltree entry object: " + util.inspect( obj, false, null ) );

    if ( !obj ) {
        return { _error : "no object in ga.calc.evaltree" };
    }

    if ( obj._error ) {
        return obj;
    }

    if ( !obj.op ) {
        return { _error : "no op in object in ga.calc.evaltree" };
    }

    if ( !obj.args ) {
        return { _error : "no args in object in ga.calc.evaltree" };
    }

    if ( obj.args.length < 1 || obj.args.length > 2 ) {
        return { _error : "args incorrect length in object in ga.calc.evaltree" };
    }

    twoargs = obj.args.length == 2;

    if ( twoargs && typeof obj.args[ 1 ] == "undefined" ) {
        twoargs = 0;
    }

    if ( typeof obj.args[ 0 ] == "undefined" ) {
        hasargs = 0;
    }

    if ( hasargs && obj.args[ 0 ].op ) {
        obj.args[ 0 ] = ga.calc.evaltree( obj.args[ 0 ] );
    }

    if ( twoargs && obj.args[ 1 ].op ) {
        obj.args[ 1 ] = ga.calc.evaltree( obj.args[ 1 ] );
    }

    if ( hasargs ) {
        obj.args[ 0 ] = ga.calc.arraytovals( obj.args[ 0 ] );

        if ( twoargs ) {
            obj.args[ 1 ] = ga.calc.arraytovals( obj.args[ 1 ] );
        }
    }

    arg0array = hasargs && obj.args[ 0 ].constructor === Array;
    if ( twoargs ) {
        arg1array = obj.args[ 1 ].constructor === Array;
        anyarray  = arg0array || arg1array;
        botharray = arg0array && arg1array;
        if ( botharray ) {
            if ( obj.args[ 0 ].length < obj.args[ 1 ].length ) {
                minlenarray = obj.args[ 0 ];
                maxlenarray = obj.args[ 1 ];
                arg0minlen = 1;
            } else {
                minlenarray = obj.args[ 1 ];
                maxlenarray = obj.args[ 0 ];
                arg0minlen = 0;
            }            
        } else {
            if ( anyarray ) {
                maxlenarray = obj.args[ arg0array ? 0 : 1 ];
                scalararg   = obj.args[ arg0array ? 1 : 0 ];
            }
        }
    }

    // console.log( "arg0array " + arg0array + " arg1array " + arg1array );

    switch ( obj.op ) {
        case "," : {
            result = arg0array ? obj.args[ 0 ] : [ obj.args[ 0 ] ];
            if ( twoargs && typeof obj.args[ 1 ] != "undefined" ) {
                result = result.concat( arg1array ? obj.args[ 1 ] : [ obj.args[ 1 ] ] );
            }
        }
        break;

        case "()" : {
            if ( twoargs ) {
                result = arg0array ? obj.args[ 0 ] : [ obj.args[ 0 ] ];
                if ( twoargs && obj.args[ 1 ] ) {
                    result = result.concat( arg1array ? obj.args[ 1 ] : [ obj.args[ 1 ] ] );
                }
            } else {
                result = obj.args[ 0 ];
            }
        }
        break;

        case "+" : {
            if ( !twoargs ) {
                return { _error : "operator : " + obj.op + " is binary and only has one argument" };
                break;
            }
            if ( anyarray ) {
                result = maxlenarray;
                if ( botharray ) {
                    for ( i = 0; i < minlenarray.length; ++i ) {
                        result[ i ] += minlenarray[ i ];
                    }
                } else {
                    for ( i = 0; i < maxlenarray.length; ++i ) {
                        result[ i ] += scalararg;
                    }
                }
            } else {
                result = obj.args[ 0 ] + obj.args[ 1 ];
            }
        }
        break;

        case "*" : {
            if ( !twoargs ) {
                return { _error : "operator : " + obj.op + " is binary and only has one argument" };
                break;
            }
            if ( anyarray ) {
                result = maxlenarray;
                if ( botharray ) {
                    for ( i = 0; i < minlenarray.length; ++i ) {
                        result[ i ] *= minlenarray[ i ];
                    }
                } else {
                    for ( i = 0; i < maxlenarray.length; ++i ) {
                        result[ i ] *= scalararg;
                    }
                }
            } else {
                result = obj.args[ 0 ] * obj.args[ 1 ];
            }
        }
        break;

        // not symmeteric ops

        case "-" : {
            if ( !twoargs ) {
                return { _error : "operator : " + obj.op + " is binary and only has one argument" };
                break;
            }
            if ( anyarray ) {
                if ( botharray ) {
                    result = obj.args[ 0 ];
                    for ( i = 0; i < minlenarray.length; ++i ) {
                        result[ i ] -= obj.args[ 1 ][ i ];
                    }
                    if ( arg0minlen ) {
                        for ( i = obj.args[ 0 ].length; i < obj.args[ 1 ].length; ++i ) {
                            result.push( -obj.args[ 1 ][ i ] );
                        }
                    } else {
                        for ( i = obj.args[ 1 ].length; i < obj.args[ 0 ].length; ++i ) {
                            result.push( obj.args[ 0 ][ i ] );
                        }
                    }
                } else {
                    if ( arg0array ) {
                        result = obj.args[ 0 ];
                        for ( i = 0; i < obj.args[ 0 ].length; ++i ) {
                            result[ i ] -= obj.args[ 1 ];
                        }
                    } else {
                        result = [];
                        for ( i = 0; i < obj.args[ 1 ].length; ++i ) {
                            result.push( obj.args[ 0 ] - obj.args[ 1 ][ i ] );
                        }
                    }
                }
            } else {
                result = obj.args[ 0 ] - obj.args[ 1 ];
            }
        }
        break;

        case "/" : {
            if ( !twoargs ) {
                return { _error : "operator : " + obj.op + " is binary and only has one argument" };
                break;
            }
            if ( anyarray ) {
                if ( botharray ) {
                    result = obj.args[ 0 ];
                    for ( i = 0; i < minlenarray.length; ++i ) {
                        result[ i ] /= obj.args[ 1 ][ i ];
                    }
                    if ( arg0minlen ) {
                        for ( i = obj.args[ 0 ].length; i < obj.args[ 1 ].length; ++i ) {
                            result.push( 0 );
                        }
                    } else {
                        for ( i = obj.args[ 1 ].length; i < obj.args[ 0 ].length; ++i ) {
                            result.push( obj.args[ 0 ][ i ] / 0 );
                        }
                    }
                } else {
                    if ( arg0array ) {
                        result = obj.args[ 0 ];
                        for ( i = 0; i < obj.args[ 0 ].length; ++i ) {
                            result[ i ] /= obj.args[ 1 ];
                        }
                    } else {
                        result = [];
                        for ( i = 0; i < obj.args[ 1 ].length; ++i ) {
                            result.push( obj.args[ 0 ] / obj.args[ 1 ][ i ] );
                        }
                    }
                }
            } else {
                result = obj.args[ 0 ] / obj.args[ 1 ];
            }
        }
        break;

        case "^" : {
            if ( !twoargs ) {
                return { _error : "operator : " + obj.op + " is binary and only has one argument" };
                break;
            }
            if ( anyarray ) {
                if ( botharray ) {
                    result = obj.args[ 0 ];
                    for ( i = 0; i < minlenarray.length; ++i ) {
                        result[ i ] = Math.pow( result[ i ], obj.args[ 1 ][ i ] );
                    }
                    if ( arg0minlen ) {
                        for ( i = obj.args[ 0 ].length; i < obj.args[ 1 ].length; ++i ) {
                            result.push( 0 );
                        }
                    } else {
                        for ( i = obj.args[ 1 ].length; i < obj.args[ 0 ].length; ++i ) {
                            result.push( 1 );
                        }
                    }
                } else {
                    if ( arg0array ) {
                        result = obj.args[ 0 ];
                        for ( i = 0; i < obj.args[ 0 ].length; ++i ) {
                            result[ i ] = pow( result[ i ], obj.args[ 1 ] );
                        }
                    } else {
                        result = [];
                        for ( i = 0; i < obj.args[ 1 ].length; ++i ) {
                            result.push( pow( obj.args[ 0 ],  obj.args[ 1 ][ i ] ) );
                        }
                    }
                }
            } else {
                result = Math.pow( obj.args[ 0 ], obj.args[ 1 ] );
            }
        }
        break;

        // std math functions with one argument

        case "abs(" : {
            if ( twoargs ) {
                return { _error : "operator : " + obj.op + " has 2 arguments but only accepts one" };
                break;
            }
            result = obj.args[ 0 ];
            if ( arg0array ) {
                for ( i = 0; i < result.length; ++i ) {
                    result[ i ] = Math.abs( result[ i ] );
                }
            } else {
                result = Math.abs( obj.args[ 0 ] );
            }
        }
        break;

        case "acos(" : {
            if ( twoargs ) {
                return { _error : "operator : " + obj.op + " has 2 arguments but only accepts one" };
                break;
            }
            result = obj.args[ 0 ];
            if ( arg0array ) {
                for ( i = 0; i < result.length; ++i ) {
                    result[ i ] = Math.acos( result[ i ] );
                }
            } else {
                result = Math.acos( obj.args[ 0 ] );
            }
        }
        break;

        case "asin(" : {
            if ( twoargs ) {
                return { _error : "operator : " + obj.op + " has 2 arguments but only accepts one" };
                break;
            }
            result = obj.args[ 0 ];
            if ( arg0array ) {
                for ( i = 0; i < result.length; ++i ) {
                    result[ i ] = Math.asin( result[ i ] );
                }
            } else {
                result = Math.asin( obj.args[ 0 ] );
            }
        }
        break;

        case "atan(" : {
            if ( twoargs ) {
                return { _error : "operator : " + obj.op + " has 2 arguments but only accepts one" };
                break;
            }
            result = obj.args[ 0 ];
            if ( arg0array ) {
                for ( i = 0; i < result.length; ++i ) {
                    result[ i ] = Math.atan( result[ i ] );
                }
            } else {
                result = Math.atan( obj.args[ 0 ] );
            }
        }
        break;

        case "ceil(" : {
            if ( twoargs ) {
                return { _error : "operator : " + obj.op + " has 2 arguments but only accepts one" };
                break;
            }
            result = obj.args[ 0 ];
            if ( arg0array ) {
                for ( i = 0; i < result.length; ++i ) {
                    result[ i ] = Math.ceil( result[ i ] );
                }
            } else {
                result = Math.ceil( obj.args[ 0 ] );
            }
        }
        break;

        case "cos(" : {
            if ( twoargs ) {
                return { _error : "operator : " + obj.op + " has 2 arguments but only accepts one" };
                break;
            }
            result = obj.args[ 0 ];
            if ( arg0array ) {
                for ( i = 0; i < result.length; ++i ) {
                    result[ i ] = Math.cos( result[ i ] );
                }
            } else {
                result = Math.cos( obj.args[ 0 ] );
            }
        }
        break;

        case "exp(" : {
            if ( twoargs ) {
                return { _error : "operator : " + obj.op + " has 2 arguments but only accepts one" };
                break;
            }
            result = obj.args[ 0 ];
            if ( arg0array ) {
                for ( i = 0; i < result.length; ++i ) {
                    result[ i ] = Math.exp( result[ i ] );
                }
            } else {
                result = Math.exp( obj.args[ 0 ] );
            }
        }
        break;

        case "floor(" : {
            if ( twoargs ) {
                return { _error : "operator : " + obj.op + " has 2 arguments but only accepts one" };
                break;
            }
            result = obj.args[ 0 ];
            if ( arg0array ) {
                for ( i = 0; i < result.length; ++i ) {
                    result[ i ] = Math.floor( result[ i ] );
                }
            } else {
                result = Math.floor( obj.args[ 0 ] );
            }
        }
        break;

        case "log(" : {
            if ( twoargs ) {
                return { _error : "operator : " + obj.op + " has 2 arguments but only accepts one" };
                break;
            }
            result = obj.args[ 0 ];
            if ( arg0array ) {
                for ( i = 0; i < result.length; ++i ) {
                    result[ i ] = Math.log( result[ i ] );
                }
            } else {
                result = Math.log( obj.args[ 0 ] );
            }
        }
        break;

        case "random(" : {
            if ( twoargs ) {
                return { _error : "operator : " + obj.op + " has 2 arguments but only accepts one" };
                break;
            }
            result = obj.args[ 0 ];
            if ( arg0array ) {
                for ( i = 0; i < result.length; ++i ) {
                    result[ i ] = Math.random();
                }
            } else {
                result = Math.random();
            }
        }
        break;

        case "round(" : {
            if ( twoargs ) {
                return { _error : "operator : " + obj.op + " has 2 arguments but only accepts one" };
                break;
            }
            result = obj.args[ 0 ];
            if ( arg0array ) {
                for ( i = 0; i < result.length; ++i ) {
                    result[ i ] = Math.round( result[ i ] );
                }
            } else {
                result = Math.round( obj.args[ 0 ] );
            }
        }
        break;

        case "sin(" : {
            if ( twoargs ) {
                return { _error : "operator : " + obj.op + " has 2 arguments but only accepts one" };
                break;
            }
            result = obj.args[ 0 ];
            if ( arg0array ) {
                for ( i = 0; i < result.length; ++i ) {
                    result[ i ] = Math.sin( result[ i ] );
                }
            } else {
                result = Math.sin( obj.args[ 0 ] );
            }
        }
        break;

        case "sqrt(" : {
            if ( twoargs ) {
                return { _error : "operator : " + obj.op + " has 2 arguments but only accepts one" };
                break;
            }
            result = obj.args[ 0 ];
            if ( arg0array ) {
                for ( i = 0; i < result.length; ++i ) {
                    result[ i ] = Math.sqrt( result[ i ] );
                }
            } else {
                result = Math.sqrt( obj.args[ 0 ] );
            }
        }
        break;

        case "tan(" : {
            if ( twoargs ) {
                return { _error : "operator : " + obj.op + " has 2 arguments but only accepts one" };
                break;
            }
            result = obj.args[ 0 ];
            if ( arg0array ) {
                for ( i = 0; i < result.length; ++i ) {
                    result[ i ] = Math.tan( result[ i ] );
                }
            } else {
                result = Math.tan( obj.args[ 0 ] );
            }
        }
        break;

        // multi arg ops
        case "max(" : {
            if ( twoargs ) {
                return { _error : "operator : " + obj.op + " has 2 arguments but only accepts one" };
                break;
            }
            result = arg0array ? Math.max.apply( null, obj.args[ 0 ] ) : obj.args[ 0 ];
        }
        break;

        case "min(" : {
            if ( twoargs ) {
                return { _error : "operator : " + obj.op + " has 2 arguments but only accepts one" };
                break;
            }
            result = arg0array ? Math.min.apply( null, obj.args[ 0 ] ) : obj.args[ 0 ];
        }
        break;
            
        // 2 arg ops

        case "atan2(" : {
            if ( twoargs ) {
                return { _error : "operator : " + obj.op + " has 2 arguments but only accepts one" };
                break;
            }

            if ( !arg0array ) {
                return { _error : "operator : " + obj.op + "  needs the first argument to be an even sized array" };
                break;
            }
            result = [];
            for ( i = 0; i < obj.args[ 0 ].length; i += 2 ) {
                result.push( Math.atan2( obj.args[ 0 ][ i ], obj.args[ 0 ][ i + 1 ] ) );
            }
        }
        break;

        case "pow(" : {
            if ( twoargs ) {
                return { _error : "operator : " + obj.op + " has 2 arguments but only accepts one" };
                break;
            }

            if ( !arg0array ) {
                return { _error : "operator : " + obj.op + "  needs the first argument to be an even sized array" };
                break;
            }
            result = [];
            for ( i = 0; i < obj.args[ 0 ].length; i += 2 ) {
                result.push( Math.pow( obj.args[ 0 ][ i ], obj.args[ 0 ][ i + 1 ] ) );
            }
            if ( result.length == 1 ) {
                result = result[ 0 ];
            }
        }
        break;
        
        default : {
            return { _error : "operator : " + obj.op + " unknown or unsupported" };
        } break;
    }
    // console.log( "ga.calc.evaltree result: " + util.inspect( result, false, null ) );
    return result;
}
/*jslint white: true, plusplus: true*/
/* assumes: jquery > 1.11.0, jqtree >= 3.0.9, jquery-base64 */

ga.bokeh = {};
ga.bokeh.data = {};

ga.bokeh.getdata = function( tag, scriptin ) {
    
    var result = {};
    var lines = scriptin.split( /\r?\n/ );
    var ll = lines.length;
    
    var i;
    var mode = 0;
    var tmp;

    // ignore upto <body>

    for ( i = 0; i < ll; ++i ) {
        if ( !mode &&
             lines[ i ].indexOf( "var docs_json =" ) === -1 ) {
            continue;
        }
        if ( !mode ) {
            mode = 1;
            result.docs_json = $.parseJSON( lines[ i ].replace( /^\s*var\s+docs_json\s+=\s+/, "" ).replace( /(^'|('|);$)/g, "" ) );
            
            continue;
        }
        if ( mode == 1 ) {
            if ( lines[ i ].indexOf( "var render_items =" ) === -1 ) {
                continue;
            }
            result.render_items = $.parseJSON( lines[ i ].replace( /^\s*var\s+render_items\s+=\s+/, "" ).replace( /;$/, "" ) );
            
            return result;
        }
    }
    
    return result;
}

ga.bokeh.render = function( mod, tag, v ) {
    
    var bokehresult = ga.bokeh.getdata( tag, v );
    
    mod = mod + "_output";
    ga.bokeh.savedata( mod, tag, bokehresult );
    ga.bokeh.renderdata( mod, tag );
}

ga.bokeh.renderdata = function( mod, tag ) {
    
    var i, len, str = "";
    var use_id;
    if ( ga.bokeh.data[ mod ] && ga.bokeh.data[ mod ][ tag ] && ga.bokeh.data[ mod ][ tag ].docs_json && ga.bokeh.data[ mod ][ tag ].render_items ) {
        len = ga.bokeh.data[ mod ][ tag ].render_items.length;
        for ( i = 0; i < len; ++i ) {
            use_id = ga.bokeh.data[ mod ][ tag ].render_items[ i ].elementid;
            if ( !use_id ) {
                c = 0;
                for ( k in ga.bokeh.data[ mod ][ tag ].render_items[ i ].roots ) {
                    if ( ga.bokeh.data[ mod ][ tag ].render_items[ i ].roots.hasOwnProperty( k ) ) {
                        use_id = ga.bokeh.data[ mod ][ tag ].render_items[ i ].roots[ k ];
                    }
                    ++c;
                }
                if ( c > 1 ) {
                    console.error( `ga.bokeh.renderdata( ${mod}, ${tag} ) - no bokeh more than one doc id` )
                }
            }
            if ( !use_id ) {
                console.error( `ga.bokeh.renderdata( ${mod}, ${tag} ) - no bokeh doc id found` )
            }
            str += '<div class="bk-root"><div class="bk-plotdiv" id="' + use_id + '"></div></div>';
        }
        $( "#" + tag ).html( str );
        Bokeh.embed.embed_items( ga.bokeh.data[ mod ][ tag ].docs_json, ga.bokeh.data[ mod ][ tag ].render_items );
    }
}

ga.bokeh.savedata = function( mod, tag, bokehresult ) {
    
    ga.bokeh.data[ mod ] = ga.bokeh.data[ mod ] || {};
    ga.bokeh.data[ mod ][ tag ] = bokehresult;
}

ga.bokeh.reset = function( mod, tag ) {
    
    if ( !ga.bokeh.data[ mod ] || !ga.bokeh.data[ mod ][ tag ] ) {
        return;
    }
    ga.bokeh.data[ mod ][ tag ] = {};
    $( "#" + tag ).empty();
}
/*jslint white: true, plusplus: true*/
/* assumes: jquery > 1.11.0, jqtree >= 3.0.9, jquery-base64 */

// grid layout functions

ga.grid             = {};

ga.grid.rc = function ( r_start, c_start, r_end, c_end ) {
    var out = "";

    if ( r_start && r_end && r_start < r_end - 1 ) {
        out += "grid-row-start:" + r_start + ";grid-row-end:" + r_end + ";";
    } else {
        if ( r_start ) {
            out += "grid-row:" + r_start + ";";
        }
    }

    if ( c_start && c_end && c_start < c_end - 1 ) {
        out += "grid-column-start:" + c_start + ";grid-column-end:" + c_end + ";";
    } else {
        if ( c_start ) {
            out += "grid-column:" + c_start + ";";
        }
    }
    return out;
}

ga.grid.rcs = function ( r_start, c_start, r_end, c_end ) {
    return 'style="' + ga.grid.rc( r_start, c_start, r_end, c_end ) + '"';
}

ga.grid.drcs = function ( r_start, c_start, r_end, c_end, style, cls) {
    style = style || "";
    style += ga.grid.rc( r_start, c_start, r_end, c_end );
    if ( cls ) {
        return '<div class="' + cls + '" style="' + style + '">';
    } else {
        return '<div style="' + style + '">';
    }
}

ga.grid.init = function () {
    return { row: 0, col: 1 };
}

ga.grid.newrow = function ( ref ) {
    ref.row++;
    ref.col = 1;
}

ga.grid.next = function( ref, field, style, cls ) {
    

    var col_start;
    var col_end;
    var row_end;
    var retval;
    
    ref = ref || { row: 1, col: 1 };

    if ( field ) {
        ref.col = field[ 0 ] ? field[ 0 ] : ref.col;
        col_end = field[ 1 ] ? field[ 1 ] + ref.col : ref.col;
        ref.row = field[ 2 ] ? field[ 2 ] : ref.row;
        row_end = field[ 3 ] ? field[ 3 ] + ref.row : ref.row;
    } else {
        col_end = ref.col;
        row_end = ref.row;
    }

    col_start = ref.col;
    ref.col = col_end + 1;
    return ga.grid.drcs( ref.row, col_start, row_end, col_end, style, cls );
}

ga.grid.nextstyle = function( ref, field, style ) {
    var col_start;
    var col_end;
    var row_end;
    var retval;
    style = style || "";
    
    ref = ref || { row: 1, col: 1 };

    if ( field ) {
        ref.col = field[ 0 ] ? field[ 0 ] : ref.col;
        col_end = field[ 1 ] ? field[ 1 ] + ref.col : ref.col;
        ref.row = field[ 2 ] ? field[ 2 ] : ref.row;
        row_end = field[ 3 ] ? field[ 3 ] + ref.row : ref.row;
    } else {
        col_end = ref.col;
        row_end = ref.row;
    }

    col_start = ref.col;
    ref.col = col_end + 1;
    return ga.grid.rc( ref.row, col_start, row_end, col_end, style ) + style;
}
/*jslint white: true, plusplus: true*/
/* assumes: jquery > 1.11.0, jqtree >= 3.0.9, jquery-base64 */

ga.qr               = {};
ga.qr.openq         = {};
ga.qr.msgtext       = {};

// ----------------------------------------------------------------------------------------------------------
// background
// ----------------------------------------------------------------------------------------------------------
//
// ----------------------------------------------------------------------------------------------------------
// summary of data structures
// ----------------------------------------------------------------------------------------------------------
// ga.qr.openq      : map of open messages
// ----------------------------------------------------------------------------------------------------------
// summary of operations
// ----------------------------------------------------------------------------------------------------------
// ga.qr.question   : entry point for asking a question
// ga.qr.post       : post reponse via ajax
// ga.qr.postfiles  : postfiles is called if files (local or remote) present. This function uploads the files.
// ga.qr.cb         : callback from question
// ga.qr.rerror     : return error
// ga.qr.answered   : question response acknowledged (could have been a simultaneously attached session)
// ga.qr.timeout    : question response timeout
// ----------------------------------------------------------------------------------------------------------


ga.qr.question = function( mod, q ) {
    
    // the text will need assembling as html from the q itself
    var qtext = "";
    var r = {};
    var i;
    var j;
    var tf;
    var etext = "";
    var qeval = "";
    var id;
    var fid;
    var qbuttons = [];
    var b;
    var usedids = {};
    var ifhelp;
    var ifhhelp;
    var helpspan;
    var gridcss;
    var gridref;
    var align;

    // initial error checking

    if ( !q._uuid ) {
        etext += "no _uuid in received data. ";
    }

    if ( !q._msgid ) {
        etext += "no _msgid in received data. ";
    }

    if ( !q._question ) {
        etext += "no _question in received data. ";
    }
        
    if ( !q._question.fields ) {
        etext += "no _question:fields in received data. ";
    }

    if ( etext.length ) {
        return ga.qr.rerror( q, etext );
    }

    // build the form

    if ( q._question.title ) {
        qtext += "<h3>" + q._question.title + "</h3>";
    }

    if ( q._question.text ) {
        qtext += q._question.text;
    }

    if ( q._question.timeouttext ) {
        ga.qr.msgtext.timeout = q._question.timeouttext;
    }

    id = q._uuid + "-" + q._msgid;

    if ( q._question.grid ) {

        ga.grid.align = ga.grid.align || "left";
        gridcss = "display:grid;grid-gap:";
        gridref = ga.grid.init();

        if ( typeof q._question.grid === 'object' ) {
            if ( !q._question.grid.colwidths ) {
                etext += " _question:grid specified, but it is not a number and colwidths not defined.";
            } else {
                if ( typeof q._question.grid.colwidths !== "object" ) {
                    etext += " _question:grid:colwidths specified, but it is not an array.";
                }
            }
                
            if ( etext.length ) {
                return ga.qr.rerror( q, etext );
            }

            if ( q._question.grid.gap ) {
                gridcss += q._question.grid.gap;
            } else {
                gridcss += "10px";
            }

            gridcss += ";grid-template-columns:";

            for ( i = 0; i < q._question.grid.colwidths.length; ++i ) {
                gridcss += q._question.grid.colwidths[ i ] + "fr ";
            }
        } else {
            gridcss += "10px;grid-template-columns:auto ";
            if ( q._question.grid < 2 ) {
                q._question.grid = 2;
            }
            for ( i = 1; i < q._question.grid; ++i ) {
                gridcss += " auto";
            }
        }            
        gridcss += ";";
            
        qtext += '<form id="' + id + '" style="' + gridcss + '">';

        row_start = 0;

        for ( i = 0; i < q._question.fields.length; ++i ) {

            tf = q._question.fields[ i ];

            if ( !tf.id ) {
                etext += "No id in field " + i + ". ";
            }

            if ( !/^[A-Za-z][A-Za-z0-9_]*$/.test( tf.id ) ) {
                etext += "Invalid id for field " + i + ' with id value "' + tf.id + '". Only alpha in first character and alphanumeric and underscores subsequently allowed.';
            }

            if ( !tf.type ) {
                etext += "No type in field " + i + ". ";
            }
            

            if ( tf.id && tf.type ) {
                align = "text-align:" + ( tf.grid && tf.grid.align ? tf.grid.align : ga.grid.align ) + ";";

                if ( usedids[tf.id] ) {
                    etext += "Duplicate id in _question fields:" + tf.id + ". ";
                }
                usedids[tf.id] = 1;
                
                if ( tf.help ) {
                    ifhelp = ' class="help_link"';
                    ifhhelp = ' class="highlight help_link"'; 
                    help_span = '<span class="help">' + tf.help + '</span>';
                } else {
                    ifhelp = '';
                    ifhhelp = ' class="highlight"';
                    help_span = '';
                }

                switch ( tf.type ) {
                case "label" : {
                    ga.grid.newrow( gridref );
                    qtext += ga.grid.next( gridref, tf.grid ? tf.grid.label : null, align ) + '<label' + ifhelp+ '>';
                    if ( tf.label ) {
                        qtext += tf.label;
                    }
                    qtext += '</label>' + help_span + '</div>';
                }
                    break;

                    // for files we are going to have to have a file server (php) which receives the file for the user and coordinates with
                    // the msg server? or wait until the file is uploaded to send ?
                    // let's get the button up first

                case "file" : {
                    ga.grid.newrow( gridref );
                    if ( tf.label ) {
                        qtext += ga.grid.next( gridref, tf.grid ? tf.grid.label : null, align ) + '<label for="' + tf.id + '"' + ifhelp + '>' + tf.label + '</label></div>';
                    }
                    qtext += ga.grid.next( gridref, tf.grid ? tf.grid.data : null, align ) + '<input type="file" id="' + tf.id + '" name="' + tf.id + '[]"' + ifhelp;
                    if ( tf.required ) {
                        qtext += ' required';
                    }
                    if ( tf.multiple ) {
                        qtext += ' multiple';
                    }
                    if ( tf.accept ) {
                        qtext += ' accept="' + tf.accept + '"';
                    }
                    qtext += '>' + help_span + '</div>';
                }
                    break;

                case "lrfile" : {
                    ga.grid.newrow( gridref );
                    if ( tf.label ) {
                        qtext += ga.grid.next( gridref, tf.grid ? tf.grid.label : null, align ) + '<label for="' + tf.id + '"' + ifhelp + '>' + tf.label + '</label></div>';
                    }
                    qtext += ga.grid.next( gridref, tf.grid ? tf.grid.data : null, align ) + '<input type="file" id="' + tf.id + '" name="' + tf.id + '[]" data-add="' + tf.id + '_altval"' + ifhelp;
                    if ( tf.required ) {
                        qtext += ' required';
                    }
                    if ( tf.multiple ) {
                        qtext += ' multiple';
                    }
                    if ( tf.accept ) {
                        qtext += ' accept="' + tf.accept + '"';
                    }
                    qtext += '>'
                        + help_span
                        + ' or <button id="' + tf.id + '_button" name="' + tf.id + '_button" data-type="lrfile"' + ifhelp 
                        + '><span class="buttontext">Browse server</span></button>'
                        + help_span 
                        + '<span id="' + tf.id + '_altval"></span>'
                        + '<input type="hidden" name="_selaltval_' + tf.id + '" value="' + tf.id + '_altval"</input>'
                        + '</div>'
                    ;
                    qeval += 'ga.altfile("' + id + '","' + tf.id + '","' + tf.id + '_altval" );'
                        + '$( "#' + id + '" ).change( function(){ $( "#' + tf.id + '_altval" ).html( "<i>Local</i>: " + $( "#' + tf.id + '" ).val().replace(/^C:.fakepath./,""));'
                    // + $("#__fields:id___msg").empty();
                        + '});'
                        + 'ga.altfile.button( "' + id + '","' + tf.id + '","' + tf.label + '","rfile",function(v){ga.altfile.button.lrfile(v,"' + id + '","' + tf.id + '")}';
                    ;
                    if ( tf.required ) {
                        qeval += ',"lrfile"';
                    }
                    qeval += ');';
                    // qeval += '$("#' + id + '_button").click( function( e ) {e.preventDefault();e.returnValue = false;});';
                    qeval += '$("#' + tf.id + '_button").on("click",function(){return ga.altfile.button.call("' + id + '","' + tf.id + '");});'
                    // 
                    ;
                    
                    
                }
                    break;


                case "text" : {
                    ga.grid.newrow( gridref );
                    if ( tf.label ) {
                        qtext += ga.grid.next( gridref, tf.grid ? tf.grid.label : null, align ) + '<label for="' + tf.id + '"' + ifhelp + '>' + tf.label + '</label></div>';
                    }
                    qtext += ga.grid.next( gridref, tf.grid ? tf.grid.data : null, align ) + '<input type="text" id="' + tf.id + '" name="' + tf.id + '"' + ifhelp;
                    if ( tf.required ) {
                        qtext += ' required';
                    }
                    if ( tf.readonly ) {
                        qtext += ' readonly';
                    }
                    if ( tf['default'] ) {
                        qtext += ' value="' + tf['default'] + '"';
                    }
                    if ( tf.pattern ) {
                        qtext += ' pattern="' + tf.pattern + '"';
                    }
                    if ( tf.maxlength ) {
                        qtext += ' maxlength="' + tf.maxlength + '"';
                    }
                    if ( tf.size ) {
                        qtext += ' size="' + tf.size + '"';
                    }
                    qtext += '>' + help_span + '</div>';
                }
                    break;

                case "integer" : {
                    ga.grid.newrow( gridref );
                    if ( tf.label ) {
                        qtext += ga.grid.next( gridref, tf.grid ? tf.grid.label : null, align ) + '<label for="' + tf.id + '"' + ifhelp + '>' + tf.label + '</label></div>';
                    }
                    qtext += ga.grid.next( gridref, tf.grid ? tf.grid.data : null, align ) + '<input type="number" id="' + tf.id + '" step="1" name="' + tf.id + '"' + ifhelp;
                    if ( tf.required ) {
                        qtext += ' required';
                    }
                    if ( tf.readonly ) {
                        qtext += ' readonly';
                    }
                    if ( tf['default'] ) {
                        qtext += ' value="' + tf['default'] + '"';
                    }
                    if ( tf.pattern ) {
                        qtext += ' pattern="' + tf.pattern + '"';
                    }
                    if ( tf.min ) {
                        qtext += ' min="' + tf.min + '"';
                    }
                    if ( tf.max ) {
                        qtext += ' max="' + tf.max + '"';
                    }
                    qtext += '>' + help_span + '</div>';
                }
                    break;

                case "float" : {
                    ga.grid.newrow( gridref );
                    if ( tf.label ) {
                        qtext += ga.grid.next( gridref, tf.grid ? tf.grid.label : null, align ) + '<label for="' + tf.id + '"' + ifhelp + '>' + tf.label + '</label></div>';
                    }
                    qtext += ga.grid.next( gridref, tf.grid ? tf.grid.data : null, align ) + '<input type="number" id="' + tf.id + '" name="' + tf.id + '"' + ifhelp;
                    if ( tf.required ) {
                        qtext += ' required';
                    }
                    if ( tf.readonly ) {
                        qtext += ' readonly';
                    }
                    if ( tf.required ) {
                        qtext += ' required';
                    }
                    if ( tf['default'] ) {
                        qtext += ' value="' + tf['default'] + '"';
                    }
                    if ( tf.pattern ) {
                        qtext += ' pattern="' + tf.pattern + '"';
                    }
                    if ( tf.step ) {
                        qtext += ' step="' + tf.step + '"';
                    }
                    if ( tf.min ) {
                        qtext += ' min="' + tf.min + '"';
                    }
                    if ( tf.max ) {
                        qtext += ' max="' + tf.max + '"';
                    }
                    qtext += '>' + help_span + '</div>';
                }
                    break;

                case "textarea" : {
                    ga.grid.newrow( gridref );
                    if ( tf.label ) {
                        qtext += ga.grid.next( gridref, tf.grid ? tf.grid.label : null, align ) + '<label for="' + tf.id + '"' + ifhelp + '>' + tf.label + '</label></div>';
                    }
                    qtext += ga.grid.next( gridref, tf.grid ? tf.grid.data : null, align ) + '<textarea id="' + tf.id + '" name="' + tf.id + '"' + ifhelp;
                    if ( tf.required ) {
                        qtext += ' required';
                    }
                    // if ( tf.readonly ) {
                    // always readonly for now
                    qtext += ' readonly';
                    // }
                    if ( tf.fontfamily ) {
                        qtext += ' style="font-family: ' + tf.fontfamily + ';"';
                    }
                    if ( tf.cols ) {
                        qtext += ' cols=' + tf.cols;
                    }
                    if ( tf.rows ) {
                        qtext += ' rows=' + tf.rows;
                    }
                    qtext += ">";
                    if ( tf['default'] ) {
                        qtext += tf['default'];
                    }
                    qtext += '</textarea>' + help_span + '</div>';
                }
                    break;

                case "checkbox" : {
                    ga.grid.newrow( gridref );
                    if ( tf.label ) {
                        qtext += ga.grid.next( gridref, tf.grid ? tf.grid.label : null, align ) + '<label for="' + tf.id + '"' + ifhelp + '>' + tf.label + '</label></div>';
                    }
                    qtext += ga.grid.next( gridref, tf.grid ? tf.grid.data : null, align ) + '<input type="checkbox" id="' + tf.id + '" name="' + tf.id + '"' + ifhelp;
                    if ( tf.checked ) {
                        qtext += ' checked';
                    }
                    if ( tf.readonly ) {
                        qtext += ' readonly';
                    }
                    qtext += '>' + help_span + '</div>';
                }
                    break;

                case "listbox" : {
                    ga.grid.newrow( gridref );
                    if ( tf.header ) {
                        if ( tf.label ) {
                            ga.grid.next( gridref, tf.grid ? tf.grid.label : null );
                        }
                        qtext += '<div style="';
                        if ( tf.fontfamily || tf.fontsize ) {
                            if ( tf.fontfamily ) {
                                qtext += 'font-family:' + tf.fontfamily + ';';
                            }
                            if ( tf.fontsize ) {
                                qtext += 'font-size:' + tf.fontsize + ';';
                            }
                        }
                        qtext += ga.grid.nextstyle( gridref, tf.grid ? tf.grid.data : null, align );
                        qtext += '"';
                        if( tf.width ) {
                            tf.header = tf.header.padEnd( tf.width );
                        }
                        tf.header = tf.header.replace( / /g, '&nbsp;' );
                        
                        qtext += '>' + tf.header + '</div>';
                        ga.grid.newrow( gridref );
                    }
                    if ( tf.label ) {
                        qtext += ga.grid.next( gridref, tf.grid ? tf.grid.label : null, align ) + '<label for="' + tf.id + '"' + ifhelp + '>' + tf.label + '</label></div>';
                    }
                    qtext += ga.grid.next( gridref, tf.grid ? tf.grid.data : null, align ) + '<select class="ga-field-input-control" id="' + tf.id + '" name="' + tf.id + '"' + ifhelp;
                    if ( tf.required ) {
                        qtext += ' required';
                    }
                    if ( tf.fontfamily ) {
                        qtext += ' style="font-family: ' + tf.fontfamily + ';"';
                    }
                    if ( tf.size ) {
                        qtext += ' size=' + tf.size;
                    }
                    if ( tf.multiple ) {
                        qtext += ' multiple';
                    }
                    qtext += '>';
                    if ( !tf.values ) {
                        etext += "No values for listbox " + tf.id + ". ";
                        break;
                    }
                    if ( tf.returns ) {
                        if ( tf.returns && tf.returns.length != tf.values.length ) {
                            etext += "Listbox values length (" + tf.values.length + ") does not equal return length (" + tf.returns.length + ") for listbox " + tf.id + ". ";
                            break;
                        }
                        for ( j = 0; j < tf.values.length; ++j ) {
                            qtext += '<option value="' + tf.returns[ j ] + '">' + tf.values[ j ].replace( / /g, '\&nbsp' ) + '</option>';
                        }
                    } else {
                        for ( j = 0; j < tf.values.length; ++j ) {
                            qtext += '<option value="' + j + '">' + tf.values[ j ].replace( / /g, '\&nbsp' ) + '</option>';
                        }
                    }
                    if ( tf['default'] ) {
                        qeval += '$("#' + tf.id + ' option[value=\'' + tf['default'] + '\']").attr("selected", "true");';
                        
                    }
                    qtext += '</select>' + help_span + '</div>';
                }
                    break;

                default : {
                    etext += "Unknown or currently unsupported field:type " + tf.type + ". ";
                }
                    break;

                }
            }
        }
        qtext += '</form>';
    } else {
        qtext += '<form id="' + id + '"><table>';

        for ( i = 0; i < q._question.fields.length; ++i ) {
            tf = q._question.fields[ i ];

            if ( !tf.id ) {
                etext += "No id in field " + i + ". ";
            }

            if ( !/^[A-Za-z][A-Za-z0-9_]*$/.test( tf.id ) ) {
                etext += "Invalid id for field " + i + ' with id value "' + tf.id + '". Only alpha in first character and alphanumeric and underscores subsequently allowed.';
            }

            if ( !tf.type ) {
                etext += "No type in field " + i + ". ";
            }
            
            if ( tf.id && tf.type ) {
                if ( usedids[tf.id] ) {
                    etext += "Duplicate id in _question fields:" + tf.id + ". ";
                }
                usedids[tf.id] = 1;
                
                if ( tf.help ) {
                    ifhelp = ' class="help_link"';
                    ifhhelp = ' class="highlight help_link"'; 
                    help_span = '<span class="help">' + tf.help + '</span>';
                } else {
                    ifhelp = '';
                    ifhhelp = ' class="highlight"';
                    help_span = '';
                }

                switch ( tf.type ) {
                case "label" : {
                    qtext += '<tr><td colspan=2><label' + ifhelp+ '>';
                    if ( tf.label ) {
                        qtext += tf.label;
                    }
                    qtext += '</label>' + help_span + '</td></tr>';
                }
                    break;

                    // for files we are going to have to have a file server (php) which receives the file for the user and coordinates with
                    // the msg server? or wait until the file is uploaded to send ?
                    // let's get the button up first

                case "file" : {
                    qtext += "<tr><td>";
                    if ( tf.label ) {
                        qtext += '<label for="' + tf.id + '"' + ifhelp + '>' + tf.label + '</label>';
                    }
                    qtext += '</td><td><input type="file" id="' + tf.id + '" name="' + tf.id + '[]"' + ifhelp;
                    if ( tf.required ) {
                        qtext += ' required';
                    }
                    if ( tf.multiple ) {
                        qtext += ' multiple';
                    }
                    if ( tf.accept ) {
                        qtext += ' accept="' + tf.accept + '"';
                    }
                    qtext += '>' + help_span + '</td></tr>';
                }
                    break;

                case "lrfile" : {
                    qtext += "<tr><td>";
                    if ( tf.label ) {
                        qtext += '<label for="' + tf.id + '"' + ifhelp + '>' + tf.label + '</label>';
                    }
                    qtext += '</td><td>'
                        + '<input type="file" id="' + tf.id + '" name="' + tf.id + '[]" data-add="' + tf.id + '_altval"' + ifhelp;
                    if ( tf.required ) {
                        qtext += ' required';
                    }
                    if ( tf.multiple ) {
                        qtext += ' multiple';
                    }
                    if ( tf.accept ) {
                        qtext += ' accept="' + tf.accept + '"';
                    }
                    qtext += '>'
                        + help_span
                        + ' or <button id="' + tf.id + '_button" name="' + tf.id + '_button" data-type="lrfile"' + ifhelp 
                        + '><span class="buttontext">Browse server</span></button>'
                        + help_span 
                        + '</td><td><span id="' + tf.id + '_altval"></td></span>'
                        + '<input type="hidden" name="_selaltval_' + tf.id + '" value="' + tf.id + '_altval"</input>'
                        + '</td></tr>'
                    ;
                    qeval += 'ga.altfile("' + id + '","' + tf.id + '","' + tf.id + '_altval" );'
                        + '$( "#' + id + '" ).change( function(){ $( "#' + tf.id + '_altval" ).html( "<i>Local</i>: " + $( "#' + tf.id + '" ).val().replace(/^C:.fakepath./,""));'
                    // + $("#__fields:id___msg").empty();
                        + '});'
                        + 'ga.altfile.button( "' + id + '","' + tf.id + '","' + tf.label + '","rfile",function(v){ga.altfile.button.lrfile(v,"' + id + '","' + tf.id + '")}';
                    ;
                    if ( tf.required ) {
                        qeval += ',"lrfile"';
                    }
                    qeval += ');';
                    // qeval += '$("#' + id + '_button").click( function( e ) {e.preventDefault();e.returnValue = false;});';
                    qeval += '$("#' + tf.id + '_button").on("click",function(){return ga.altfile.button.call("' + id + '","' + tf.id + '");});'
                    // 
                    ;
                    
                    
                }
                    break;


                case "text" : {
                    qtext += "<tr><td>";
                    if ( tf.label ) {
                        qtext += '<label for="' + tf.id + '"' + ifhelp + '>' + tf.label + '</label>';
                    }
                    qtext += '</td><td><input type="text" id="' + tf.id + '" name="' + tf.id + '"' + ifhelp;
                    if ( tf.required ) {
                        qtext += ' required';
                    }
                    if ( tf.readonly ) {
                        qtext += ' readonly';
                    }
                    if ( tf['default'] ) {
                        qtext += ' value="' + tf['default'] + '"';
                    }
                    if ( tf.pattern ) {
                        qtext += ' pattern="' + tf.pattern + '"';
                    }
                    if ( tf.maxlength ) {
                        qtext += ' maxlength="' + tf.maxlength + '"';
                    }
                    if ( tf.size ) {
                        qtext += ' size="' + tf.size + '"';
                    }
                    qtext += '>' + help_span + '</td></tr>';
                }
                    break;

                case "integer" : {
                    qtext += "<tr><td>";
                    if ( tf.label ) {
                        qtext += '<label for="' + tf.id + '"' + ifhelp + '>' + tf.label + '</label>';
                    }
                    qtext += '</td><td><input type="number" id="' + tf.id + '" step="1" name="' + tf.id + '"' + ifhelp;
                    if ( tf.required ) {
                        qtext += ' required';
                    }
                    if ( tf.readonly ) {
                        qtext += ' readonly';
                    }
                    if ( tf['default'] ) {
                        qtext += ' value="' + tf['default'] + '"';
                    }
                    if ( tf.pattern ) {
                        qtext += ' pattern="' + tf.pattern + '"';
                    }
                    if ( tf.min ) {
                        qtext += ' min="' + tf.min + '"';
                    }
                    if ( tf.max ) {
                        qtext += ' max="' + tf.max + '"';
                    }
                    qtext += '>' + help_span + '</td></tr>';
                }
                    break;

                case "float" : {
                    qtext += "<tr><td>";
                    if ( tf.label ) {
                        qtext += '<label for="' + tf.id + '"' + ifhelp + '>' + tf.label + '</label>';
                    }
                    qtext += '</td><td><input type="number" id="' + tf.id + '" name="' + tf.id + '"' + ifhelp;
                    if ( tf.required ) {
                        qtext += ' required';
                    }
                    if ( tf.readonly ) {
                        qtext += ' readonly';
                    }
                    if ( tf.required ) {
                        qtext += ' required';
                    }
                    if ( tf['default'] ) {
                        qtext += ' value="' + tf['default'] + '"';
                    }
                    if ( tf.pattern ) {
                        qtext += ' pattern="' + tf.pattern + '"';
                    }
                    if ( tf.step ) {
                        qtext += ' step="' + tf.step + '"';
                    }
                    if ( tf.min ) {
                        qtext += ' min="' + tf.min + '"';
                    }
                    if ( tf.max ) {
                        qtext += ' max="' + tf.max + '"';
                    }
                    qtext += '>' + help_span + '</td></tr>';
                }
                    break;

                case "textarea" : {
                    qtext += "<tr><td>";
                    if ( tf.label ) {
                        qtext += '<label for="' + tf.id + '"' + ifhelp + '>' + tf.label + '</label>';
                    }
                    qtext += '</td><td><textarea id="' + tf.id + '" name="' + tf.id + '"' + ifhelp;
                    if ( tf.required ) {
                        qtext += ' required';
                    }
                    // if ( tf.readonly ) {
                    // always readonly for now
                    qtext += ' readonly';
                    // }
                    if ( tf.fontfamily ) {
                        qtext += ' style="font-family: ' + tf.fontfamily + ';"';
                    }
                    if ( tf.cols ) {
                        qtext += ' cols=' + tf.cols;
                    }
                    if ( tf.rows ) {
                        qtext += ' rows=' + tf.rows;
                    }
                    qtext += ">";
                    if ( tf['default'] ) {
                        qtext += tf['default'];
                    }
                    qtext += '</textarea>' + help_span + '</td></tr>';
                }
                    break;

                case "checkbox" : {
                    qtext += "<tr><td>";
                    if ( tf.label ) {
                        qtext += '<label for="' + tf.id + '"' + ifhhelp + '>' + tf.label + '</label>';
                    }
                    qtext += '</td><td><input type="checkbox" id="' + tf.id + '" name="' + tf.id + '"' + ifhelp;
                    if ( tf.checked ) {
                        qtext += ' checked';
                    }
                    if ( tf.readonly ) {
                        qtext += ' readonly';
                    }
                    qtext += '>' + help_span + '</td></tr>';
                }
                    break;

                case "listbox" : {
                    if ( tf.header ) {
                        qtext += '<tr><td colspan=2';
                        if ( tf.fontfamily || tf.fontsize ) {
                            qtext += ' style="';
                            if ( tf.fontfamily ) {
                                qtext += 'font-family:' + tf.fontfamily + ';';
                            }
                            if ( tf.fontsize ) {
                                qtext += 'font-size:' + tf.fontsize + ';';
                            }
                            qtext += '"';
                        }
                        if( tf.width ) {
                            tf.header = tf.header.padEnd( tf.width );
                        }
                        tf.header = tf.header.replace( / /g, '&nbsp;' );
                        
                        qtext += '>' + tf.header + '</td></tr>';
                    }
                    qtext += "<tr><td>";
                    if ( tf.label ) {
                        qtext += '<label for="' + tf.id + '"' + ifhhelp + '>' + tf.label + '</label>';
                    }
                    qtext += '</td>';
                    if ( tf.size && tf.size > 1 ) {
                        qtext += '</tr><tr><td colspan=2>';
                    } else {
                        qtext += '<td>';
                    }
                    qtext += '<select class="ga-field-input-control" id="' + tf.id + '" name="' + tf.id + '"' + ifhelp;
                    if ( tf.required ) {
                        qtext += ' required';
                    }
                    if ( tf.fontfamily ) {
                        qtext += ' style="font-family: ' + tf.fontfamily + ';"';
                    }
                    if ( tf.size ) {
                        qtext += ' size=' + tf.size;
                    }
                    if ( tf.multiple ) {
                        qtext += ' multiple';
                    }
                    qtext += '>';
                    if ( !tf.values ) {
                        etext += "No values for listbox " + tf.id + ". ";
                        break;
                    }
                    if ( tf.returns ) {
                        if ( tf.returns && tf.returns.length != tf.values.length ) {
                            etext += "Listbox values length (" + tf.values.length + ") does not equal return length (" + tf.returns.length + ") for listbox " + tf.id + ". ";
                            break;
                        }
                        for ( j = 0; j < tf.values.length; ++j ) {
                            qtext += '<option value="' + tf.returns[ j ] + '">' + tf.values[ j ].replace( / /g, '\&nbsp' ) + '</option>';
                        }
                    } else {
                        for ( j = 0; j < tf.values.length; ++j ) {
                            qtext += '<option value="' + j + '">' + tf.values[ j ].replace( / /g, '\&nbsp' ) + '</option>';
                        }
                    }
                    if ( tf['default'] ) {
                        qeval += '$("#' + tf.id + ' option[value=\'' + tf['default'] + '\']").attr("selected", "true");';
                        
                    }
                    qtext += '</select>' + help_span + '</td></tr>';
                }
                    break;

                default : {
                    etext += "Unknown or currently unsupported field:type " + tf.type + ". ";
                }
                    break;

                }
            }
        }
        qtext += '</table></form>';
    }

    // maybe add qtext, qeval to adata for cb so that the msg can be redone ?
    // or push required into messagebox (ugh)

    if ( q._question.buttons &&
         q._question.buttons.length ) {
        for ( i = 0; i < q._question.buttons.length; ++i ) {
            b = q._question.buttons[ i ];
            switch ( typeof b ) {
                case "string" : 
                bid = b.replace(/\W/g, '').toLowerCase();
                if ( usedids[bid] ) {
                    etext += "Duplicate id in _question fields & buttons:" + bid + ". ";
                }
                usedids[bid] = 1;

                qbuttons.push( {
                    id : bid
                    ,label : b
                    ,cb    : ga.qr.cb
                    ,adata : [ q, bid, b.skiprequired ? 0 : 1 ]
                } );
                break;

                case "object" : 
                if ( !b.id ) {
                    if ( b.label ) {
                        b.id = b.label.replace(/\W/g, '').toLowerCase();
                    }
                }
                        
                if ( !b.id ) {
                    etext += "Buttons array object entry " + ( i + 1 ) + " does not have an id. ";
                } else {
                    if ( usedids[b.id] ) {
                        etext += "Duplicate id in _question fields & buttons:" + b.id + ". ";
                    }
                    usedids[b.id] = 1;
                    if ( b.id != b.id.replace(/\W/g, '') ) {
                        etext += "Buttons array object entry " + ( i + 1 ) + " id is not pure alphanumeric. ";
                    }
                }
                        
                if ( !b.label ) {
                    etext += "Buttons array object entry " + ( i + 1 ) + " does not have a label. ";
                }
                if ( !etext.length ) {
                    qbuttons.push( {
                        id : b.id
                        ,label : b.label
                        ,cb    : ga.qr.cb
                        ,adata : [ q, b.id, b.skiprequired ? 0 : 1 ]
                    } );
                    if ( b.help ) {
                        qbuttons[ qbuttons.length - 1 ].help = b.help;
                    }
                    break;
                };
                break;
            default :
                etext += "Buttons array entry " + ( i + 1 ) + " unknown type: " + typeof b + ". ";
                break;
            }
        }
    } else {
        bid = "ok";
        if ( usedids[bid] ) {
            etext += "Duplicate id in _question fields & buttons:" + bid + ". ";
        }
        usedids[bid] = 1;
        bid = "cancel";
        if ( usedids[bid] ) {
            etext += "Duplicate id in _question fields & buttons:" + bid + ". ";
        }
        usedids[bid] = 1;
        qbuttons = [
            { 
                id    : "ok"
                ,label : "OK"
                ,cb    : ga.qr.cb
                ,adata  : [ q, "ok", 1 ]
            }
            ,{ 
                id    : "cancel"
                ,label : "Cancel"
                ,cb    : ga.qr.cb
                ,adata  : [ q, "cancel", 0 ]
            }
        ]
        ;
    }

    if ( etext.length ) {
        return ga.qr.rerror( q, etext );
    }

    

    ga.qr.openq[ id ] = "open";

    ga.msg.box( {
        icon : q._question.icon ? q._question.icon : "question.png"
        ,noclose : 1
        ,closeif : 1
        ,text : qtext + '<p></p>'
        ,eval : '$("#' + id + '").on("keyup keypress", function(e) { var code = e.keyCode || e.which;  if (code  == 13) { e.preventDefault(); return false; }});' + qeval
        ,buttons : qbuttons
        ,ptext : '<p></p>'
    }, 0, 2 );
}

ga.qr.cb = function( q, result, required ) {
    
    

    var id = q._uuid + "-" + q._msgid;

    if ( ga.qr.openq[ id ] ) {
        switch( ga.qr.openq[ id ] ) {
        case "open" : 
            break;

        case "answered" : {
            ga.msg.box( {
                icon : "information.png"
                ,text : "Question has already been answered in another session"
            } );
            delete ga.qr.openq[ id ];
            return true;
        }
            break;
            
        case "timeout" : {
            ga.msg.box( {
                icon : "information.png"
                ,text : ga.qr.msgtext.timeout ? ga.qr.msgtext.timeout : "The time for answering a question has expired"
            } );
            delete ga.qr.openq[ id ];
            return true;
        }
            break;
            
        default : {
            ga.msg.box( {
                icon : "toast.png"
                ,text : "Internal error, unknown message state"
            } );
            delete ga.qr.openq[ id ];
            return true;
        }
            break;
        }                
    } else {
        ga.msg.box( {
            icon : "warning.png"
            ,text : q._question.requiredmsg ? q._question.requiredmsg : "Not all required fields have been entered."
        });
        return true;
    }
        
    // check if required fields missing
    if ( required ) {
        var missing_required = false;
        $('#' + id + ' *').filter(':input').each(function(){
            if ( this.required ) {
                
                var do_switch = true;
                if ( this.dataset &&
                     this.dataset.type == "rfile_val" &&
                     this.value.length ) {
                    
                    do_switch = false;
                } 

                if ( do_switch ) {
                    switch ( this.type ) {
                    case "text" :
                    case "number" :
                    case "select-one" : 
                        if ( !this.value.length ) {
                            
                            missing_required = true;
                        }
                        break;
                    case "select-multiple" : 
                        if ( !($( "#" + this.id ).val() || []).length() ) {
                            
                            missing_required = true;
                        }
                        break;
                    case "file" :
                        if ( this.files.length == 0 ) {
                            missing_required = true;
                        }
                        break;
                    }
                }
            }
        });

        if ( missing_required ) {
            ga.msg.box( {
                icon : "warning.png"
                ,text : q._question.requiredmsg ? q._question.requiredmsg : "Not all required fields have been entered."
                } );
            return false;
        }
    }
    delete ga.qr.openq[ id ];

    // r needs _uuid, _msgid and assembled response info
    var r = {};
    r._uuid = q._uuid;
    r._msgid = parseFloat( q._msgid );
    r._response = {};
    r._response.button = result;
    if ( q._question && q._question.id ) {
        r._response.id = q._question.id;
    }

    var hasfiles = false;
    // add form values
    // console.dir( $('#' + id + ' *') );
    $('#' + id + ' *').filter(':input').each(function(){
        // 
        if ( this.dataset &&
             this.dataset.type == "rfile_val" &&
             this.value.length ) {
            
            hasfiles = true;
        }
            
        switch ( this.type ) {
            case "text" :
            case "number" :
            case "select-one" : 
            r._response[ this.id ] = this.value;
            break;
            case "select-multiple" : 
            r._response[ this.id ] = $( "#" + this.id ).val() || [];
            break;
            case "checkbox" :
            if ( this.checked ) {
                r._response[ this.id ] = true;
            }
            break;
            case "file" :
            ;
            if ( this.files.length == 0 ) {
                this.remove();
            } else {
                hasfiles = true;
            }
            break;
        }                
    });

    if ( hasfiles ) {
        ga.qr.postfiles( id, r );
    } else {
        ga.qr.post( r )
    }
    return true;
}

ga.qr.answered = function( mod, q ) {
    
    
    
    var id;
    if ( q._uuid && q._msgid ) {
        id = q._uuid + "-" + q._msgid;
        if ( ga.qr.openq[ id ] ) {
            ga.qr.openq[ id ] = "answered";
        }
    }
}

ga.qr.timeout = function( mod, q ) {
    
    
    var id;
    if ( q._uuid && q._msgid ) {
        id = q._uuid + "-" + q._msgid;
        if ( ga.qr.openq[ id ] ) {
            ga.qr.openq[ id ] = "timeout";
        }
    }
}

ga.qr.rerror = function( q, text ) {
    
    
    
    // r needs _uuid, _msgid and assembled response info
    var r = {};
    r._uuid = q._uuid;
    r._msgid = parseFloat( q._msgid );
    r._response = {};
    r._response.error = text;
    if ( q._question && q._question.id ) {
        r._response.id = q._question.id;
    }
    ga.qr.post( r )
    ga.msg.box( {
        icon : "toast.png",
        text : text
    });
}

ga.qr.post = function( r ) {
    
    
    
    $.ajax({
        url      : ga.qr.url,
        data     :  {
            _window : window.name,
            _data   : r
        },
        dataType : 'json',
        method   : 'POST'
    }).success( function( data ) {
        
        if ( data.error && data.error.length ) {
            ga.msg.box( {
                icon : "toast.png",
                text : "ajax data error: " + data.error,
                buttons : [
                    { id    : "ok",
                      label : "OK" } ]
            } );
        }
    }).error( function( error ) {
        console.log( "ajax error" );
        console.dir( error );
        ga.msg.box( {
            icon : "toast.png",
            text : "ajax error: " + error.statusText,
            buttons : [
                { id    : "ok",
                  label : "OK" } ]
        } );
    });
    ;
}

ga.qr.postfiles = function( id, r ) {
    

    var id_prog = '#' + id + '_progress';
    var i;

    ga.msg.box( {
        icon : "information.png"
        ,noclose : 1
        ,text : 'Uploading files:<progress id="' + id + '_progress"></progress>'
    });

    var formData =  new FormData( $( "#" + id )[ 0 ]); 

    

    

    formData.append( "_window", window.name );
    formData.append( "_logon", $( "#_state" ).data( "_logon" ) );
    formData.append( "_uuid", r._uuid );

    $.ajax( {
        dataType: "json"
        ,cache:false
        //             timeout:3000,  // for testing
        ,type:"POST"
        ,url:"ajax/sys/uploader.php"
        ,data: formData
        ,xhr: function() {  // Custom XMLHttpRequest
            var myXhr = $.ajaxSettings.xhr();
            if(myXhr.upload){ // Check if upload property exists
                myXhr.upload.addEventListener('progress',
                                              function(e) {
                                                  if(e.lengthComputable){
                                                      $( id_prog ).attr({value:e.loaded,max:e.total});
                                                  } }
                                              //                     progressHandlingFunction
                                              , false);
            }
            return myXhr;
        },
        contentType: false,
        processData: false
    } )
        .success( function( data ) {
            ga.msg.close( 3 );
            
            if ( data.error && data.error.length ) {
                delete ga.qr.openq[ id ];
                ga.qr.rerror( r, "ajax data error: " + data.error );
            } else {
                // process data and extract filenames if ok, continue with ga.qr.post()
                
                if ( data.files ) {
                    for ( var i in data.files ) {
                        if ( data.files.hasOwnProperty( i ) ) {
                            r[ i ] = data.files[ i ];
                        }
                    }
                }
                ga.qr.post( r );
            }
        })
        .error( function( error ) {
            ga.msg.close( 3 );
            console.log( "ajax error" );
            console.dir( error );
            delete ga.qr.openq[ id ];
            ga.qr.rerror( r, "ajax error: " + error.statusText );
        });
    ;
}
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
   if ( m.icon && m.icon != "noicon.png")
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
              tmp = tmp + '<td><button id="_mbb_' + m.buttons[ i ].id + '" class="help_link ga-button-submit">' + m.buttons[ i ].label + '</button><span class="help">' + m.buttons[ i ].help + '</span></td>';
          } else {
              tmp = tmp + '<td><button id="_mbb_' + m.buttons[ i ].id + '" class="ga-button-submit">' + m.buttons[ i ].label + '</button></td>';
          }
      }
      tmp = tmp + "</tr></table><center>";
       
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
                  $( "#_mbb_" + m.buttons[ i ].id ).off().one( "click" , m.buttons[ i ], function( event ) {  event.data.cb( event.data.data ); ga.msg.close( mnum ); } );
              }
          } else {
              $( "#_mbb_" + m.buttons[ i ].id ).off().one( "click" , m.buttons[ i ], function( event ) {  ga.msg.close( mnum ); } );
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
    
    if ( mnum < 4 &&
         !$( "#closeModal" + mnum ).hasClass( "modalClose" ) ) {
        $( "#closeModal" + mnum ).addClass( "modalClose" ).html( "X" );
    }

    switch( mnum ) {
        case 1 : ga.msg.close1(); break;
        case 2 : ga.msg.close2(); break;
        case 3 : ga.msg.close3(); break;
        case 4 : ga.msg.close4(); break;
        default : console_warn( "ga.msg.close called with unknown modal number " + mnum ); break;
    }
}

ga.msg.clicks = function() {
    
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
    
    
   conn = new ab.Session( ws 
      , function() {            // Once the connection has been established
          $(".wsstatus").css( "color", "green" );
          
          ga.event( "global", "ws messaging", "connection established" );
          $( '#_state' ).data( "_wssession", conn );

          ga.ws.sub( "keepalive", ga.ws.alive, "keepalive" );
        }
      , function() {            // When the connection is closed
            $(".wsstatus").css( "color", "red" );
          
            if ( gd.data( "_unload" ) == 0 ) {
                
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

    
}        

ga.ws.alive = function() {
    
}

ga.ws.sub = function( vuuid, onevent, moduleid ) {
    
   if ( moduleid in ga.ws.subd )
   {
       
      ga.ws.unsub( ga.ws.subd[ moduleid ], moduleid );
   }
    
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
    
   if ( moduleid in ga.ws.subd )
   {
       
      delete ga.ws.subd[ moduleid ];
   } else {
       
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
/*jslint white: true, plusplus: true*/
/* assumes: jquery > 1.11.0, jqtree >= 3.0.9, jquery-base64 */

ga.layout = {};

// ----------------------------------------------------------------------------------------------------------
// background
// ----------------------------------------------------------------------------------------------------------
// handles layout 
// ----------------------------------------------------------------------------------------------------------
// summary of data structures
// ----------------------------------------------------------------------------------------------------------
// ga.layout.module.name                             : the module name
// ga.layout.fields[ fieldname ]                     : field data
// ga.layout.fields[ fieldname ].lhtml               : label html
// ga.layout.fields[ fieldname ].dhtml               : data html
// ga.layout.fields[ fieldname ].eval                : eval
// ga.layout.fields[ fieldname ].{lgr,lgc,dgr,dgc}   : css grid values - stored in ga.layout.slayout
// ga.layout.modules[ module ].fields[ fieldname ]   : layout structure by field name
// ----------------------------------------------------------------------------------------------------------
// summary of operations
// ----------------------------------------------------------------------------------------------------------
// ga.layout.process                              : prepare layout
// ga.layout.html                                 : return complete html
// ga.layout.buttons                              : return buttons
// ga.layout.eval                                 : return eval bits
// ga.layout.init                                 : initial parsing of layout for repeat.js which is called early
// ga.layout.rhtml                                : return rhtml for field
// ga.layout.slayout                              : store css grid values for field ... only for repeat entries
// ----------------------------------------------------------------------------------------------------------

ga.layout.init = function () {
    if ( !ga.layout.module ||
         !ga.layout.module.name ) {
        console.error( "ga.layout.init() error: ga.layout.module.name not defined" );
        return;
    }
    if ( !ga.layout.panel ||
         !ga.layout.panel.fields ) {
        console.error( "ga.layout.init() error: ga.layout.panel.fields not defined" );
        return;
    }

    ga.layout.modules = ga.layout.modules || {};
    ga.layout.modules[ ga.layout.module.name ] = ga.layout.modules[ ga.layout.module.name ] || {};
    ga.layout.modules[ ga.layout.module.name ].fields = {};
    
    for ( var i = 0; i < ga.layout.panel.fields.length; ++i ) {
        ga.layout.modules[ ga.layout.module.name ].fields[ ga.layout.panel.fields[ i ].id ] = ga.layout.panel.fields[ i ].layout;
        
    }
}

ga.layout.slayout = function ( field ) {
    
    var found = false;
    var pos;
    for ( pos = 0; pos < ga.layout.panel.fields.length; ++pos ) {
        if ( ga.layout.panel.fields[ pos ].id && ga.layout.panel.fields[ pos ].id == field ) {
            found = true;
            break;
        }
    }

    if ( !found ) {
        console.error( `ga.layout.slayout( ${field} ) : field does not exist` );
        return;
    }
    
    if ( ga.layout.panel.fields[ pos ].lgc ) {
        ga.layout.fields[ field ].lgc = ga.layout.panel.fields[ pos ].lgc;
    }
    if ( ga.layout.panel.fields[ pos ].lgr ) {
        ga.layout.fields[ field ].lgr = ga.layout.panel.fields[ pos ].lgr;
    }
    if ( ga.layout.panel.fields[ pos ].dgc ) {
        ga.layout.fields[ field ].dgc = ga.layout.panel.fields[ pos ].dgc;
    }
    if ( ga.layout.panel.fields[ pos ].dgr ) {
        ga.layout.fields[ field ].dgr = ga.layout.panel.fields[ pos ].dgr;
    }
}

ga.layout.rhtml = function ( field ) {
    
    var found = false;
    var pos;
    for ( pos = 0; pos < ga.layout.panel.fields.length; ++pos ) {
        if ( ga.layout.panel.fields[ pos ].id && ga.layout.panel.fields[ pos ].id == field ) {
            found = true;
            break;
        }
    }

    var htmlopen = `<div id=ga-repeater-${field}`;
    if ( !found ) {
        console.error( `ga.layout.rhtml( ${field} ) : field does not exist` );
        return `${htmlopen}></div>`;
    }

    if ( !ga.layout.panel.fields[ pos ].rgtr ||
         !ga.layout.panel.fields[ pos ].rgtc ||
         !ga.layout.panel.fields[ pos ].rgr ||
         !ga.layout.panel.fields[ pos ].rgc ) {
        console.error( `ga.layout.rhtml( ${field} ) : field does not have a complete set of tags` );
        return `${htmlopen}></div>`;
    }

    if ( ga.layout.panel.fields[ pos ].repeat ) {
        htmlopen += ` style="display:grid;grid-template-rows:${ga.layout.panel.fields[pos].rgtr};grid-template-columns:${ga.layout.panel.fields[pos].rgtc};grid-column:${ga.layout.panel.fields[pos].rgc}`;
    } else {
        htmlopen += ` style="display:grid;grid-template-rows:${ga.layout.panel.fields[pos].rgtr};grid-template-columns:${ga.layout.panel.fields[pos].rgtc};grid-row:${ga.layout.panel.fields[pos].rgr};grid-column:${ga.layout.panel.fields[pos].rgc}`;
    }
    if ( ga.layout.panel.fields[ pos ].ralign ) {
        htmlopen += `;text-align:${ga.layout.panel[pos].ralign}`;
    }
    htmlopen += '"></div>';
    
    
    return htmlopen;
}
    
ga.layout.process = function ( defaults ) {
    if ( !defaults ||
         !defaults.resource ) {
        console.error( "ga.layout.process() required defaults object argument not specified" );
        return;
    }
    if ( !ga.layout.module ||
         !ga.layout.module.name ) {
        console.error( "ga.layout.process() error: ga.layout.module.name not defined" );
        return;
    }

    var module = ga.layout.module.name;
    if ( !ga.layout.fields[ 'b_submit' ] ) {
        console.error( "layout.js: ga.layout.fields[b_submit] should already be defined" );
        ga.layout.fields[ "b_submit" ] = {};
        ga.layout.fields[ "b_submit" ].lhtml = '<label class=""></label>';
        ga.layout.fields[ "b_submit" ].dhtml = `<button id="${module}_b_submit_button" class="ga-button-submit"><span class="buttontext">Submit</span></button><div id="b_submit_buttonval"></div>`;
    } else {
        ga.layout.fields[ "b_submit" ].dhtml = ga.layout.fields[ "b_submit" ].dhtml.replace( /<button id/, '<button class="ga-button-submit" id' );
    }
// -- submit eval --
    ga.layout.fields[ "b_submit" ].eval  = `
$( "#${module}_b_submit_button" ).click( function( e ) {
    console.log("b_submit");
   e.preventDefault();
   e.returnValue = false;
   $( "#${module}" ).find( ".toclear" ).remove();   
   if ( ${module}_timeout_handler != "unset" ) {
       
       clearTimeout( ${module}_timeout_handler );
       if ( ${module}_timeout_handler_uuid ) {
           ga.ws.unsub( ${module}_timeout_handler_uuid, "${module}" );
       }
       ${module}_timeout_handler = "unset";
   }
   ga.value.resetDefaultValues( "${module}_output", true );
`;
    if ( defaults && defaults.captcha ) {
        ga.layout.fields[ "b_submit" ].eval += `
   ga.captcha( do_${module}_submit, $(this) );
   return false;
`;
    } else {
        ga.layout.fields[ "b_submit" ].eval += `
   return ga.xsede.select( "${defaults.resource}", do_${module}_submit, $(this) );
`;
    }
    ga.layout.fields[ "b_submit" ].eval += `
});
`;
// -- end submit eval

    if ( !ga.layout.fields[ 'b_reset' ] ) {
        console.error( "layout.js: ga.layout.fields[b_reset] should already be defined" );
        ga.layout.fields[ "b_reset" ] = {};
        ga.layout.fields[ "b_reset" ].lhtml = '<label class=""></label>';
        ga.layout.fields[ "b_reset" ].lhtml += '';
        ga.layout.fields[ "b_reset" ].dhtml = `<button id="${module}_b_reset_button" class="ga-button-reset"><span class="buttontext">Reset</span></button><div id="b_reset_buttonval"></div>`;
        ga.layout.fields[ "b_reset" ].dhtml += '';
    } else {
        ga.layout.fields[ "b_reset" ].dhtml = ga.layout.fields[ "b_reset" ].dhtml.replace( /<button id/, '<button class="ga-button-reset" id' );
    }

// -- reset eval --
    ga.layout.fields[ "b_reset" ].eval  = `
$("#${module}_b_reset_button" ).click(function(){
    console.log("b_reset");
    return ${module}_reset();
});`;
// -- end reset eval

    if ( !ga.layout.fields[ `${module}_progress` ] ) {
        ga.layout.fields[ `${module}_progress` ] = {};
        ga.layout.fields[ `${module}_progress` ].lhtml = '';
        ga.layout.fields[ `${module}_progress` ].dhtml = `<span id="${module}_progress"></span>`;
        ga.layout.fields[ `${module}_progress` ].eval = '';
    }

    if ( !ga.layout.fields[ `${module}_output_airavata` ] ) {
        ga.layout.fields[ `${module}_output_airavata` ] = {};
        ga.layout.fields[ `${module}_output_airavata` ].lhtml = '';
        ga.layout.fields[ `${module}_output_airavata` ].dhtml = `<span id="${module}_output_airavata"></span>`;
        ga.layout.fields[ `${module}_output_airavata` ].eval = '';
    }

    if ( !ga.layout.fields[ `${module}_output_msgs` ] ) {
        ga.layout.fields[ `${module}_output_msgs` ] = {};
        ga.layout.fields[ `${module}_output_msgs` ].lhtml = '';
        ga.layout.fields[ `${module}_output_msgs` ].dhtml = `<div id="${module}_output_msgs" class="warning" type="msgs"></div>`;
        ga.layout.fields[ `${module}_output_msgs` ].eval = '';
    }

    if ( !ga.layout.fields[ `${module}_output_textarea` ] ) {
        ga.layout.fields[ `${module}_output_textarea` ] = {};
        ga.layout.fields[ `${module}_output_textarea` ].lhtml = '';
        ga.layout.fields[ `${module}_output_textarea` ].dhtml = `<textarea class="ga-field-output-control" readonly hidden id="${module}_output_textarea"></textarea>`;
        ga.layout.fields[ `${module}_output_textarea` ].eval = '';
    }

    if ( !ga.layout.panel.panels ) {
        console.error( "error JSON contains no panels" );
        return;
    }
    
    ga.layout.setup();
}

// build parent->child arrays & panel name->position in panel: array object
// var parents = {};

ga.layout.setup = function() {
    ga.layout.children = {};
    ga.layout.panelpos = {};
    for ( var i = 0; i < ga.layout.panel.panels.length; ++i ) {
        var panel = Object.keys( ga.layout.panel.panels[ i ] )[0];
        var parent = ga.layout.panel.panels[ i ][ panel ].parent;
        ga.layout.panelpos[ panel ] = i;
        if ( parent ) {
            // parents[ panel ] = parent;
            ga.layout.children[ parent ] = ga.layout.children[ parent ] || [];
            ga.layout.children[ parent ].push( panel );
        }
    }

    ga.layout.panelfields = {};
    for ( var i = 0; i < ga.layout.panel.fields.length; ++i ) {
        var panel = ga.layout.panel.fields[ i ].layout.parent;
        // skip repeats
        if ( !/^r-/.test( panel ) ) {
            ga.layout.panelfields[ panel ] = ga.layout.panelfields[ panel ] || [];
            ga.layout.panelfields[ panel ].push( ga.layout.panel.fields[ i ] );
        }
    }
}

// recursively expand the panels

ga.layout.html = function ( designer ) {
    ga.layout.buttonsused = ga.layout.fields[ 'b_submit' ] || ga.layout.fields[ 'b_reset' ];
    // console.error( "used buttons: " + ga.layout.buttonsused ? "yes" : "no" );
    if ( !designer ) {
        return ga.layout.thishtml( 'root', false );
    }
    return `
    <div id="ga-dd-grid" class="ga-dd-grid">
      <div id="ga-dd-mod" class="ga-dd-mod">
        <!-- right click menu -->
        <div id="ga-dd-menu" class="ga-dd-menu" role="menu" style="display:none;list-style-type:none" >
          <div id="ga-dd-menu-irowu" class="ga-dd-menu-e" onclick="ga.dd.menu('irowu')" >Insert row above</div>
          <div id="ga-dd-menu-irowd" class="ga-dd-menu-e" onclick="ga.dd.menu('irowd')" >Insert row below</div>
          <div id="ga-dd-menu-icoll" class="ga-dd-menu-e" onclick="ga.dd.menu('icoll')" >Insert column left</div>
          <div id="ga-dd-menu-icolr" class="ga-dd-menu-e" onclick="ga.dd.menu('icolr')" >Insert column right</div>
          <hr>
          <div id="ga-dd-menu-iclr" class="ga-dd-menu-e" onclick="ga.dd.menu('iclr')" >Invert Designer colors</div>
        </div>`
        + ga.layout.thishtml( 'root', designer )
        +
     ` </div><!-- ga-dd-mod -->
      <!-- div for designer controls -->
      <div id="ga-dd-dd" class="ga-dd-dd">
        <div class="ga-dd-tab">
          <button class="ga-dd-tablinks" onclick="ga.dd.tab(event, 'ga-dd-details')">Details</button>
          <button class="ga-dd-tablinks" onclick="ga.dd.tab(event, 'ga-dd-layout')">Layout</button>
          <button class="ga-dd-tablinks" onclick="ga.dd.tab(event, 'ga-dd-json')">JSON</button>
          <button class="ga-dd-tablinks" onclick="ga.dd.tab(event, 'ga-dd-palette')">Dictionary</button>
          <button class="ga-dd-tablinks" onclick="ga.dd.tab(event, 'ga-dd-ctrls')">Controls</button>
        </div>

        <div id="ga-dd-details" class="ga-dd-tabcontent">
          <h3>Details</h3>
          <div id="ga-dd-details-content">
          </div>
        </div>
        <div id="ga-dd-layout" class="ga-dd-tabcontent">
          <h3>Layout</h3>
          <div id="ga-dd-layout-content">
          </div>
        </div>
        <div id="ga-dd-json" class="ga-dd-tabcontent">
          <h3>JSON</h3>
          <div id="ga-dd-json-content">
          </div>
        </div>
        <div id="ga-dd-palette" class="ga-dd-tabcontent">
          <h3>Dictionary</h3>
          <div id="ga-dd-palette-content">
          </div>
        </div>
        <div id="ga-dd-ctrls" class="ga-dd-tabcontent">
          <h3>Controls</h3>
          <div id="ga-dd-ctrls-content">
          </div>
        </div>
        
      </div>
      <div class="ga-dd-vertical-gutter">
      </div>
    </div>
`;
}

ga.layout.thishtml = function( panel, designer ) {
    var html = "";
    var style = "display:grid";
    if ( ga.layout.panel.panels[ ga.layout.panelpos[ panel ] ][ panel ].gtr ) {
        style += ";grid-template-rows:" + ga.layout.panel.panels[ ga.layout.panelpos[ panel ] ][ panel ].gtr;
    }
    if ( ga.layout.panel.panels[ ga.layout.panelpos[ panel ] ][ panel ].gtc ) {
        style += ";grid-template-columns:" + ga.layout.panel.panels[ ga.layout.panelpos[ panel ] ][ panel ].gtc;
    }
    if ( ga.layout.panel.panels[ ga.layout.panelpos[ panel ] ][ panel ].gr ) {
        style += ";grid-row:" + ga.layout.panel.panels[ ga.layout.panelpos[ panel ] ][ panel ].gr;
    }
    if ( ga.layout.panel.panels[ ga.layout.panelpos[ panel ] ][ panel ].gc ) {
        style += ";grid-column:" + ga.layout.panel.panels[ ga.layout.panelpos[ panel ] ][ panel ].gc;
    }
    if ( ga.layout.panel.panels[ ga.layout.panelpos[ panel ] ][ panel ].gap ) {
        style += ";grid-gap:" + ga.layout.panel.panels[ ga.layout.panelpos[ panel ] ][ panel ].gap;
    }
    if ( ga.layout.panel.panels[ ga.layout.panelpos[ panel ] ][ panel ].align ) {
        style += ";text-align:" + ga.layout.panel.panels[ ga.layout.panelpos[ panel ] ][ panel ].align;
    }
    html += `<div id=ga-panel-${panel} style="${style}">`; // Panel ${panel}`;
    if ( ga.layout.children[ panel ] ) {
        for ( var i = 0; i < ga.layout.children[ panel ].length; ++i ) {
            html += ga.layout.thishtml( ga.layout.children[ panel ][ i ], designer );
        }
    }
    if ( ga.layout.panelfields[ panel ] ) {
        html += "\n";
        for ( var i = 0; i < ga.layout.panelfields[ panel ].length; ++i ) {
            var lfstyle = "";
            var dfstyle = "";
            var rfstyle = "";
            var fclass  = "";
            var id = ga.layout.panelfields[ panel ][ i ].id;
            if ( ga.layout.panelfields[ panel ][ i ].role ) {
//                fclass += `ga-field-${ga.layout.panelfields[panel][i].role}-control `;
                if ( !ga.layout.buttonsused &&
                      ga.layout.panelfields[ panel ][ i ].role == 'output' ) {
                    html += ga.layout.buttons();
                }
            }
            if ( ga.layout.panelfields[ panel ][ i ].type ) {
                fclass += `ga-type-${ga.layout.panelfields[panel][i].type} `;
                if ( designer ) {
                    fclass += 'ga-dd ';
                }
            }
            if ( ga.layout.panelfields[ panel ][ i ].lgr ) {
                lfstyle += "grid-row:" + ga.layout.panelfields[ panel ][ i ].lgr + ";";
            }
            if ( ga.layout.panelfields[ panel ][ i ].lgc ) {
                lfstyle += "grid-column:" + ga.layout.panelfields[ panel ][ i ].lgc + ";";
            }
            if ( ga.layout.panelfields[ panel ][ i ].layout.align ) {
                lfstyle += "text-align:" + ga.layout.panelfields[ panel ][ i ].layout.align + ";";
            }
            if ( ga.layout.panelfields[ panel ][ i ].dgr ) {
                dfstyle += "grid-row:" + ga.layout.panelfields[ panel ][ i ].dgr + ";";
            }
            if ( ga.layout.panelfields[ panel ][ i ].dgc ) {
                dfstyle += "grid-column:" + ga.layout.panelfields[ panel ][ i ].dgc + ";";
            }
            if ( ga.layout.panelfields[ panel ][ i ].layout.align ) {
                dfstyle += "text-align:" + ga.layout.panelfields[ panel ][ i ].layout.align + ";";
            }
            if ( ga.layout.panelfields[ panel ][ i ].rgtr ||
                 ga.layout.panelfields[ panel ][ i ].rgtc ||
                 ga.layout.panelfields[ panel ][ i ].rgr ||
                 ga.layout.panelfields[ panel ][ i ].rgc ) {
                rfstyle += "display:grid;";
            }
//            if ( ga.layout.panelfields[ panel ][ i ].rgtr ) {
//                rfstyle += "grid-template-rows:" + ga.layout.panelfields[ panel ][ i ].rgtr + ";";
//            }
//            if ( ga.layout.panelfields[ panel ][ i ].rgtc ) {
//                rfstyle += "grid-template-columns:" + ga.layout.panelfields[ panel ][ i ].rgtc + ";";
//            }
//            if ( ga.layout.panelfields[ panel ][ i ].rgr ) {
//                rfstyle += "grid-row:" + ga.layout.panelfields[ panel ][ i ].rgr + ";";
//            }
//            if ( ga.layout.panelfields[ panel ][ i ].rgc ) {
//                rfstyle += "grid-column:" + ga.layout.panelfields[ panel ][ i ].rgc + ";";
//            }
            if ( ga.layout.panelfields[ panel ][ i ].layout.align ) {
                rfstyle += "text-align:" + ga.layout.panelfields[ panel ][ i ].layout.align + ";";
            }
            
            if ( ga.layout.fields[ id ] ) {
                if ( ga.layout.fields[ id ].lhtml && ga.layout.fields[ id ].lhtml.length ) {
                    html += `<div id=ga-label-${id} style="${lfstyle}" class="${fclass}">`;
                    html +=  ga.layout.fields[ id ].lhtml;
                    html += `</div>\n`;
                }
                if ( ga.layout.fields[ id ].dhtml ) {
                    html += `<div id=ga-data-${id} style="${dfstyle}" class="${fclass}">`;
                    html += ga.layout.fields[ id ].dhtml;
                    html += `</div>\n`;
                }
                if ( ga.layout.fields[ id ].rhtml ) {
                    //                html += `<div id=ga-repeats-container-${id} style="${rfstyle}">`;
                    html += ga.layout.fields[ id ].rhtml;
                    //                html += `</div>\n`;
                }
            } else {
                console.warn( `ga.layout.thishtml(): ga.layout.fields['${id}'] not defined.` );
            }
        }
    }

    html += '</div>\n';
    return html;
}
                 
ga.layout.eval = function() {

    var myeval = "";

    for ( var i = 0; i < ga.layout.panel.fields.length; ++i ) {
        var id = ga.layout.panel.fields[ i ].id;
        if ( ga.layout.fields[ id ] && ga.layout.fields[ id ].eval ) {
            myeval += ga.layout.fields[ id ].eval;
        }
    }

    return myeval;
}

ga.layout.buttons = function() {
    var buttonhtml = "";
    if ( !ga.layout.buttonsused ) {
        for ( var p in ga.layout.buttonhtml ) {
            buttonhtml += `<div id=ga-button-${p} class="ga-button">${ga.layout.buttonhtml[p]}</div>\n`;
        }
    } 
    ga.layout.buttonsused = 1;
    return buttonhtml;
}

ga.layout.output_ids = function() {
    var result = [];
    if ( !ga.layout.module || !ga.layout.module.json || !ga.layout.module.json.fields ) {
        return result;
    }
    for ( var f in ga.layout.module.json.fields ) {
        if ( ga.layout.module.json.fields[ f ].role &&
             ga.layout.module.json.fields[ f ].id &&
             ga.layout.module.json.fields[ f ].role == "output" ) {
            result.push( ga.layout.module.json.fields[ f ].id );
        }
    }
    return result;
}
