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
    var tf;
    var etext = "";
    var id;
    var fid;
    var qbuttons = {};

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
        //  qtext += "<h1>" + q._question.title + "</h1>";
        qtext += q._question.title;
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
            switch ( tf.type ) {
            case "text" : {
                qtext += "<tr><td>";
                if ( tf.label ) {
                    qtext += '<label for="' + tf.id + '">' + tf.label + '</label>';
                }
                qtext += '</td><td><input type="text" id="' + tf.id + '"';
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
                qtext += '></td></tr>';
            }
            break;

            case "checkbox" : {
                qtext += "<tr><td>";
                if ( tf.label ) {
                    qtext += '<label for="' + tf.id + '" class="highlight">' + tf.label + '</label>';
                }
                qtext += '</td><td><input type="checkbox" id="' + tf.id + '"';
                if ( tf.checked ) {
                    qtext += ' checked';
                }
                if ( tf.readonly ) {
                    qtext += ' readonly';
                }
                qtext += '></td></tr>';
            }
            break;

            default : {
                etext += "Unknown or currently unsupported field:type " + tf.fype + ". ";
            }
            break;

            }
        }
    }
    qtext += '</table></form>';

    if ( etext.length ) {
        return ga.qr.rerror( q, etext );
    }

    __~debug:qr{console.log( "qtext:" + qtext );}

    ga.qr.openq[ id ] = "open";
    
    messagebox( {
        icon : "question.png"
        ,text : qtext
        ,eval : '$("#' + id + '").on("keyup keypress", function(e) { var code = e.keyCode || e.which;  if (code  == 13) { e.preventDefault(); return false; }});'
        ,buttons : [
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
    } );
}

ga.qr.cb = function( q, result ) {
    __~debug:qr{console.log( "ga.qr.cb( data )" );}
    __~debug:qr{console.dir( q );}
    __~debug:qr{console.dir( data );}

    var id = q._uuid + "-" + q._msgid;

    if ( ga.qr.openq[ id ] ) {
        switch( ga.qr.openq[ id ] ) {
        case "open" : 
            break;

        case "answered" : {
            messagebox( {
                icon : "information.png"
                ,text : "Question has already been answered in another session"
            } );
            delete ga.qr.openq[ id ];
            return;
        }
            break;
            
        case "timeout" : {
            messagebox( {
                icon : "information.png"
                ,text : "The time for answering a question has expired"
            } );
            delete ga.qr.openq[ id ];
            return;
        }
            break;
            
        default : {
            messagebox( {
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
    // add form values
    $('#' + id + ' *').filter(':input').each(function(){
        //your code here
        __~debug:qr{console.dir( this );}
        switch ( this.type ) {
            case "text" :
            r._response[ this.id ] = this.value;
            break;
            case "checkbox" :
            if ( this.checked ) {
                r._response[ this.id ] = true;
            }
            break;
        }                
    });
    ga.qr.post( r )
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
    messagebox( {
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
            messagebox( {
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
        messagebox( {
            icon : "toast.png",
            text : "ajax error: " + error.statusText,
            buttons : [
                { id    : "ok",
                  label : "OK" } ]
        } );
    });
    ;
}

