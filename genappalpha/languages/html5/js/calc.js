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
// ga.calc.register   : register a calculated field
// ga.calc.tokens     : convert calc string to tokens
// ga.calc.dependents : trim tokens array to dependent variables
// ga.calc.install    : install change handlers
// ga.calc.process    : update field
// ga.calc.parensub   : utility routine used internally to extract a () section of the calc
// ga.calc.mktree     : converts a calc array to a tree structure
// ga.calc.arraytovals: utility routine used internally to convert strings to numeric values
// ga.calc.evaltree   : evaluates a tree structure
// ----------------------------------------------------------------------------------------------------------

// regexp and general routines

ga.calc.str_atom_numeric         = "(?:(?:-?[1-9][0-9]*)|(?:-?0))?(?:[.][0-9]+)?(?:[eE][-+]?[0-9]+)?";
ga.calc.str_atom_id              = "[A-Za-z][A-Za-z0-9_]*";
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
    __~debug:calc{console.log( "ga.calc.register( " + mod + " , " + id + " , " + calc + " )" );}

    ga.calc.data[ mod ] = ga.calc.data[ mod ] || {};
    ga.calc.data[ mod ].calc = ga.calc.data[ mod ].calc || {};
    ga.calc.data[ mod ].calc[ id ] = {};
    ga.calc.data[ mod ].calc[ id ].calc = calc;
    ga.calc.data[ mod ].calc[ id ].tokens = ga.calc.tokens( calc );
    if ( ga.calc.data[ mod ].calc[ id ].tokens._error ) {
        messagebox( { 
            icon: "toast.png",
            text: ga.calc.data[ mod ].calc[ id ].tokens._error + " in calc field id " + id
        } );
        return;
    }
    ga.calc.data[ mod ].calc[ id ].dependents = ga.calc.dependents( mod, id );
    ga.calc.data[ mod ].calc[ id ].tree = ga.calc.mktree( ga.calc.data[ mod ].calc[ id ].tokens );
    __~debug:calcdeps{console.log( "ga.calc.register() dependent depth is " + ga.calc.depthofdeps( mod, id ) );}
    if ( ga.calc.depthofdeps( mod, id ) > 99 ) {
        messagebox( {
            icon: "toast.png",
            text: "Module field calc internal error: maximum recursion depth found in calc field id " + id
        } );
        return;
    }

    ga.calc.install( mod, id );
}

// check calc depth of dependent variables
ga.calc.depthofdeps = function( mod, id, depth ) {
    __~debug:calcdeps{console.log( "ga.calc.depthofdeps( " + mod + " , " + id + " , " + depth + " )" );}
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
        __~debug:calcdeps{console.log( "ga.calc.depthofdeps() checking for dep " +  ga.calc.data[ mod ].calc[ id ].dependents[ i ] );}
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
    __~debug:calcdeps{console.log( "ga.calc.dependents( " + mod + " , " + id + " )" );}
    var i,
        dependents = []
    ;

    for ( i in ga.calc.data[ mod ].calc[ id ].tokens ) {
        __~debug:calcdeps{console.log( "ga.calc.dependents() i = " + i + " val " + ga.calc.data[ mod ].calc[ id ].tokens[ i ] );}
        if ( ga.calc.is_atom_id.test( ga.calc.data[ mod ].calc[ id ].tokens[ i ] ) ) {
            dependents.push( ga.calc.data[ mod ].calc[ id ].tokens[ i ] );
        }
    }
    __~debug:calcdeps{console.log( "ga.calc.dependents() dependent vars are " );console.dir( dependents );}

    return dependents;
}

// install change handlers
ga.calc.install = function( mod, id ) {
    __~debug:calc{console.log( "ga.calc.install( " + mod + " , " + id + " )" );}
    var i;
    for ( i in ga.calc.data[ mod ].calc[ id ].dependents ) {
        $( "#" + ga.calc.data[ mod ].calc[ id ].dependents[ i ] ).on( "change", function() { ga.calc.process( mod, id ); } );
    }
}

// update field
ga.calc.process = function( mod, id ) {
    __~debug:calc{console.log( "ga.calc.process( " + mod + " , " + id + " )" );}
    var result = ga.calc.evaltree( jQuery.extend( true, {}, ga.calc.data[ mod ].calc[ id ].tree ) );

    // tmp = Number( ga.calc.is_atom_id.test( token ) ? $( "#" + ga.calc.data[ mod ].calc[ id ].tokens[ i ] ).val() : token );

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
    __~debug:calc{console.log( "ga.calc.tokens( " + calc + " )" );}
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
        __~debug:calc{console.log( "last_is_atom length " + last_is_atom.length + " value " + last_is_atom[ last_is_atom.length - 1 ] );}

        if ( last_is_atom.length > 0 && last_is_atom[ last_is_atom.length - 1 ] ) {
            __~debug:calc{console.log( "tokenize after atom" );}
            new_tokens = tokenize_after_atom.exec( calc );
            if ( !new_tokens ) {
                console.warn( "invalid token found " + calc );
                break;
            }
            if ( ga.calc.is_close_paren.test( new_tokens[ 0 ] ) ) {
                if ( !last_is_atom.length ) {
                    console.warn( "invalid closing parenthesis " + calc );
                    break;
                }
                last_is_atom.pop();
            } else {
                last_is_atom[ last_is_atom.length - 1 ] = 0;
            }
        } else {
            __~debug:calc{console.log( "tokenize" );}
            new_tokens = tokenize.exec( calc );
            if ( !new_tokens ) {
                console.warn( "invalid token found " + calc );
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
                            console.warn( "invalid closing parenthesis " + calc );
                            break;
                        }
                        last_is_atom.pop();
                    } else {
                        if ( ga.calc.is_function_paren.test( new_tokens[ 0 ] ) ) {
                            last_is_atom.push( 0 );
                        }
                    }
                }
            }
        }

        __~debug:calc{console.log( "ga.calc.tokens() new token: " + new_tokens[ 0 ] );}

        calc = calc.substring( new_tokens[ 0 ].length );
        tokens.push( new_tokens[ 0 ] );

    } while ( new_tokens && new_tokens.length && calc.length && --tokensleft > 0 );
            

    __~debug:calc{console.log( "tokens follow" );}
    __~debug:calc{console.dir( tokens );}

    if ( tokensleft <= 0 ) {
        return { "_error" : "Module field calc internal error: maximum token limit of " + maxtokens + " reached" };
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

    console.warn( "closing paren error" );
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
            i += tmp.newofs;
            token = { op : token, args : [ ga.calc.mktree( tmp.a ) ] };
            paren = 1;
        } else {
            if ( ga.calc.is_open_paren.test( token ) ) {
                // console.log( "open paren test" );
                tmp = ga.calc.parensub( a.slice( i ) );
                i += tmp.newofs;
                token = ga.calc.mktree( tmp.a );
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
            a[ i ] = Number( ga.calc.is_atom_id.test( a[ i ] ) ? $( "#" + a[ i ] ).val() : a[ i ] );
        }
    } else {
        a = Number( ga.calc.is_atom_id.test( a ) ? $( "#" + a ).val() : a );
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
        console.warn( "no object in ga.calc.evaltree" );
        return result;
    }

    if ( !obj.op ) {
        console.warn( "no op in object in ga.calc.evaltree" );
        return result;
    }

    if ( !obj.args ) {
        console.warn( "no args in object in ga.calc.evaltree" );
        return result;
    }

    if ( obj.args.length < 1 || obj.args.length > 2 ) {
        console.warn( "args incorrect length in object in ga.calc.evaltree" );
        return result;
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
                console.warn( "operator : " + obj.op + " is binary and only has one argument" );
                result = obj.args[ 0 ];
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
                console.warn( "operator : " + obj.op + " is binary and only has one argument" );
                result = obj.args[ 0 ];
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
                console.warn( "operator : " + obj.op + " is binary and only has one argument" );
                result = obj.args[ 0 ];
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
                console.warn( "operator : " + obj.op + " is binary and only has one argument" );
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
                console.warn( "operator : " + obj.op + " is binary and only has one argument" );
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
                console.warn( "operator : " + obj.op + " has 2 arguments but only accepts one" );
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
                console.warn( "operator : " + obj.op + " has 2 arguments but only accepts one" );
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
                console.warn( "operator : " + obj.op + " has 2 arguments but only accepts one" );
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
                console.warn( "operator : " + obj.op + " has 2 arguments but only accepts one" );
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
                console.warn( "operator : " + obj.op + " has 2 arguments but only accepts one" );
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
                console.warn( "operator : " + obj.op + " has 2 arguments but only accepts one" );
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
                console.warn( "operator : " + obj.op + " has 2 arguments but only accepts one" );
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
                console.warn( "operator : " + obj.op + " has 2 arguments but only accepts one" );
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
                console.warn( "operator : " + obj.op + " has 2 arguments but only accepts one" );
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
                console.warn( "operator : " + obj.op + " has 2 arguments but only accepts one" );
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
                console.warn( "operator : " + obj.op + " has 2 arguments but only accepts one" );
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
                console.warn( "operator : " + obj.op + " has 2 arguments but only accepts one" );
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
                console.warn( "operator : " + obj.op + " has 2 arguments but only accepts one" );
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
                console.warn( "operator : " + obj.op + " has 2 arguments but only accepts one" );
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
                console.warn( "operator : " + obj.op + " has 2 arguments but only accepts one" );
                break;
            }
            result = arg0array ? Math.max.apply( null, obj.args[ 0 ] ) : obj.args[ 0 ];
        }
        break;

        case "min(" : {
            if ( twoargs ) {
                console.warn( "operator : " + obj.op + " has 2 arguments but only accepts one" );
                break;
            }
            result = arg0array ? Math.min.apply( null, obj.args[ 0 ] ) : obj.args[ 0 ];
        }
        break;
            
        // 2 arg ops

        case "atan2(" : {
            if ( twoargs ) {
                console.warn( "operator : " + obj.op + " has 2 arguments but only accepts one" );
                break;
            }

            if ( !arg0array ) {
                console.warn( "operator : " + obj.op + " needs the first argument to be an even sized array" );
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
                console.warn( "operator : " + obj.op + " has 2 arguments but only accepts one" );
                break;
            }

            if ( !arg0array ) {
                console.warn( "operator : " + obj.op + " needs the first argument to be an even sized array" );
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
            console.warn( "currently unsupported op " + obj.op );
        } break;
    }
    // console.log( "ga.calc.evaltree result: " + util.inspect( result, false, null ) );
    return result;
}
