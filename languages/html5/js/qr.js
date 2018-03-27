/*jslint white: true, plusplus: true*/
/* assumes: jquery > 1.11.0, jqtree >= 3.0.9, jquery-base64 */

ga.qr               = {};
ga.qr.openq         = {};

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
    __~debug:qr{console.log( "ga.qr.question( " + mod + ", q )" );}
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

    id = q._uuid + "-" + q._msgid;

    qtext += '<form id="' + id + '"><table>';

    for ( i = 0; i < q._question.fields.length; ++i ) {
        tf = q._question.fields[ i ];

        if ( !tf.id ) {
            etext += "No id in field " + i + ". ";
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
                // + $("#__fields:id___msg").html("");
                    + '});'
                    + 'ga.altfile.button( "' + id + '","' + tf.id + '","' + tf.label + '","rfile",function(v){ga.altfile.button.lrfile(v,"' + id + '","' + tf.id + '")});'
                ;
                if ( tf.required ) {
                    qeval += ',"lrfile"';
                }
                // qeval += '$("#' + id + '_button").click( function( e ) {e.preventDefault();e.returnValue = false;});';
                qeval += '$("#' + tf.id + '_button").on("click",function(){return ga.altfile.button.call("' + id + '","' + tf.id + '");});'
                    // __~fields:setinputfromfile{'ga.value.setInputfromFile("#__fields:id__", "__fields:setinputfromfile__", "__fields:setinputfromfileids__", "__moduleid__");' +}
                ;
                __~debug:qr{console.log( "qeval:" );}
                __~debug:qr{console.log( qeval );}
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
                qtext += '<select id="' + tf.id + '" name="' + tf.id + '"' + ifhelp;
                if ( tf.fontfamily ) {
                    qtext += ' style="font-family: ' + tf.fontfamily + ';"';
                }
                if ( tf.size ) {
                    qtext += ' size=' + tf.size;
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
                if ( tf.default ) {
                    qeval += '$("#' + tf.id + ' option[value=\'' + tf.default + '\']").attr("selected", "true");';
                    console.log( "Listbox qeval: " + qeval );
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
                    ,adata : [ q, bid ]
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
                        ,adata : [ q, b.id ]
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
                ,adata  : [ q, "ok" ]
            }
            ,{ 
                id    : "cancel"
                ,label : "Cancel"
                ,cb    : ga.qr.cb
                ,adata  : [ q, "cancel" ]
            }
        ]
        ;
    }

    if ( etext.length ) {
        return ga.qr.rerror( q, etext );
    }

    __~debug:qr{console.log( "qtext:" + qtext );}

    ga.qr.openq[ id ] = "open";

    ga.msg.box( {
        icon : "question.png"
        ,noclose : 1
        ,text : qtext + '<p></p>'
        ,eval : '$("#' + id + '").on("keyup keypress", function(e) { var code = e.keyCode || e.which;  if (code  == 13) { e.preventDefault(); return false; }});' + qeval
        ,buttons : qbuttons
        ,ptext : '<p></p>'
    }, 0, 2 );
}

ga.qr.cb = function( q, result ) {
    __~debug:qr{console.log( "ga.qr.cb( q, result )" );}
    __~debug:qr{console.dir( q );}

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
            return;
        }
            break;
            
        case "timeout" : {
            ga.msg.box( {
                icon : "information.png"
                ,text : "The time for answering a question has expired"
            } );
            delete ga.qr.openq[ id ];
            return;
        }
            break;
            
        default : {
            ga.msg.box( {
                icon : "toast.png"
                ,text : "Internal error, unknown message state"
            } );
            delete ga.qr.openq[ id ];
            return;
        }
            break;
        }                
        delete ga.qr.openq[ id ];
    } else {
        return;
    }
        
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
        //your code here
        // __~debug:qr{console.dir( this );}
        if ( this.dataset &&
             this.dataset.type == "rfile_val" &&
             this.value.length ) {
            console.log( "has rfile" );
            hasfiles = true;
        }
            
        switch ( this.type ) {
            case "text" :
            case "select-one" : 
            r._response[ this.id ] = this.value;
            break;
            case "checkbox" :
            if ( this.checked ) {
                r._response[ this.id ] = true;
            }
            break;
            case "file" :
            __~debug:qr{console.log( "found type file\n")};
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
}

ga.qr.answered = function( mod, q ) {
    __~debug:qr{console.log( "ga.qr.answered( moq, q )" );}
    __~debug:qr{console.dir( q );}
    
    var id;
    if ( q._uuid && q._msgid ) {
        id = q._uuid + "-" + q._msgid;
        if ( ga.qr.openq[ id ] ) {
            ga.qr.openq[ id ] = "answered";
        }
    }
}

ga.qr.timeout = function( mod, q ) {
    __~debug:qr{console.log( "ga.qr.timeout( moq, q )" );}
    __~debug:qr{console.dir( q );}
    var id;
    if ( q._uuid && q._msgid ) {
        id = q._uuid + "-" + q._msgid;
        if ( ga.qr.openq[ id ] ) {
            ga.qr.openq[ id ] = "timeout";
        }
    }
}

ga.qr.rerror = function( q, text ) {
    __~debug:qr{console.log( "ga.qr.rerror( q, " + text + " )" );}
    __~debug:qr{console.dir( q );}
    __~debug:qr{console.dir( data );}
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
    __~debug:qr{console.log( "ga.qr.post( r )" );}
    __~debug:qr{console.dir( r );}
    
    $.ajax({
        url      : ga.qr.url,
        data     :  {
            _window : window.name,
            _data   : r
        },
        dataType : 'json',
        method   : 'POST'
    }).success( function( data ) {
        console.log( "ajax delete done" );
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
    __~debug:qr{console.log( "ga.qr.postfiles( r )" );}

    var id_prog = '#' + id + '_progress';
    var i;

    ga.msg.box( {
        icon : "information.png"
        ,noclose : 1
        ,text : 'Uploading files:<progress id="' + id + '_progress"></progress>'
    });

    var formData =  new FormData( $( "#" + id )[ 0 ]); 

    console.log( "formData values" );

    __~debug:qr{for (var key of formData.keys()){console.log( key + " ->" );console.log( formData.getAll( key ));}console.log( "end of formData values" );}

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
            console.log( "ga.postfiles post done" );
            if ( data.error && data.error.length ) {
                delete ga.qr.openq[ id ];
                ga.qr.rerror( r, "ajax data error: " + data.error );
            } else {
                // process data and extract filenames if ok, continue with ga.qr.post()
                console.log( data );
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
