/*jslint white: true, plusplus: true*/
/* assumes: jquery > 1.11.0, jqtree >= 3.0.9, jquery-base64 */

ga.captcha = function( cb, form ) {
    var msg = "";

    __~debug:captcha{console.log( "ga.captcha()" );}

// get json of captcha and key ( mongo'd )
// assemble msg with image uuencoded
// display and on callback, verify and continue with submit

    $.ajax( { url:ga.captcha.url , data:{ _window: window.name } } ).success( function( data ) {
        __~debug:captcha{console.log( "ga.captcha() success" );}
        data = $.parseJSON( data );
        __~debug:captcha{console.log( "ga.captcha() success id = " + data.id );}
        if ( data.error ) {
            messagebox( {
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
        __~debug:captchahtml{console.log( msg );}
        messagebox( {
            text  : msg
            ,eval  : "resetHoverHelp();$('#sys_captcha').on('keyup keypress', function(e) { var code = e.keyCode || e.which;  if (code  == 13) { e.preventDefault(); return false; }});"
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
        messagebox( {
            icon : "toast.png"
            ,text  : "Error contacting server"
        } );
    });
}

ga.captcha.verify = function( data ) {
    __~debug:captcha{console.log( "ga.captcha.verify()" );}
    __~debug:captcha{console.log( $( "#sys_captcha_text" ).val() );}
    __~debug:captcha{console.log( $( "#sys_captcha_id" ).val() );}

    $.ajax( { url:ga.captcha.url_verify
              ,data:{ 
                  _window  : window.name 
                  ,captcha : $( "#sys_captcha_text" ).val() 
                  ,id      : $( "#sys_captcha_id" ).val() 
              } 
            } ).success( function( vdata ) {
                __~debug:captcha{console.log( "ga.captcha_verify() success" );}
                vdata = $.parseJSON( vdata );
                __~debug:captcha{console.log( "ga.captcha_verify() success id = " + vdata.id );}
                if ( vdata.error ) {
                    messagebox( {
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
            messagebox( {
                icon : "toast.png"
                ,text  : "Error contacting server"
            } );
        });
}
    
