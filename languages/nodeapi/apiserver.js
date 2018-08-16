'use_strict';

// user defines

// should read appconfig to get this info

const stagebase      = "__docroot:nodeapi__";
const mongo_url      = "mongodb://localhost:27017/";
const mongo_db_name  = "__application__"; 
var appconfig;
var listen_port;
var listen_host;

// system defines

const fs             = require('fs');
const express        = require('express');
const fileUpload     = require('express-fileupload');
const bodyParser     = require('body-parser');

const app            = express();
const util           = require('util');
const MongoClient    = require('mongodb').MongoClient;
const url            = require('url');
const bcrypt         = require('bcrypt');
const saltRounds     = 10;
const validator      = require('validator');
const requestIp      = require('request-ip');
const apiutil        = require('./apiutil.js');
const { spawn }      = require('child_process');

// global variables
 
var mongodb;

// utility routines

const p_fs_mkdir     = util.promisify( fs.mkdir );
const p_fs_stat      = util.promisify( fs.stat );
const p_fs_access    = util.promisify( fs.access );
const p_fs_writeFile = util.promisify( fs.writeFile );

async function mkdir( path ) {
    // try to make
    await p_fs_mkdir( path )
        .catch( () => {
        });

    await p_fs_stat( path )
        .then( ( stats ) => {
            if ( !stats.isDirectory() ) {
                throw new Error( "ERROR: not a directory '" + path + "'" );
            }
        })
        .catch ( ( error ) =>  {
            throw error;
        });
        
    return p_fs_access( path, fs.constants.R_OK | fs.constants.W_OK );
}

async function mkuserdir( name ) {
    return mkdir( stagebase + "/" + name );
}

async function mkuserjobdir( name, id ) {
    await mkuserdir( name ).catch( ( err ) => { throw err; } );
    return mkdir( stagebase + "/" + name + "/" + id );
};

// mkuserjobdir( "emre", "jobtest1" ).catch( ( err ) => {
//     console.log( "err in calling mkuserjobdir:" + err.message );
// })

// return;

// Server bits

var writeend = function( res, robj ) {
    res.write( JSON.stringify( robj ) );
    res.end();
}

app.use( fileUpload({
    limits: { fileSize: 50 * 1024 * 1024 } // 50M
//    limits: { fileSize: 10 * 1024 } // 10K
}));

app.use( requestIp.mw() );

app.use( bodyParser.raw() );

var req_ip = function( req ) {
//    console.dir( req );
//    console.log( req.connection.remoteAddress );
//    console.log( req.socket.remoteAddress );
//    console.log( req.connection.socket.remoteAddress );
//    console.log( req.info.remoteAddress );
//    console.log( req.clientIp );

    return req.clientIp;

//    return 
//    ( req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'].split(',').pop() : 0 ) || 
//        req.connection.remoteAddress || 
//        req.socket.remoteAddress || 
//        req.connection.socket.remoteAddress;
}

app.get( '/useradd', ( req, res ) => {
    // TODO make async, remove callback hell

    let ip = req_ip( req );

    console.log( "ip:" + ip );
    console.log( "useradd" );
    console.log( req.url );
    let q = url.parse( req.url, true );
    console.log( JSON.stringify( q ) );
    console.log( q.pathname );
    console.log( q.search );
    let query = q.query;
    console.log( JSON.stringify( query ) );

    let robj = {};
    if ( !query.email ||
         !query.user ||
         !query.pw ) {
        robj.error = "useradd: incorrect format";
        return writeend( res, robj );
    }
    if ( !validator.isEmail( query.email ) ) {
        robj.error = "useradd: incorrect email format";
        return writeend( res, robj );
    }

    mongodb.collection("users").findOne({ name : query.user }, ( err, result ) => {
        if ( err ) {
            robj.error = err;
            writeend( res, robj );
        } else {
            if ( result ) {
                console.log( result );
                console.log( "already exists" );
                robj.info = "already exists";
                writeend( res, robj );
            } else {
                // try to add
                bcrypt.hash( query.pw, saltRounds, ( err, hash ) => {
                    console.log( "hashed: " + hash );
                    mongodb.collection("users").insert( { 
                        name : query.user
                        ,password : hash
                        ,email : query.email
//                        ,registered : new Date( Date.now() ).toISOString()
                        ,registered : new Date()
                        ,registerip : ip 
                    }, ( err, result ) => 
                        {
                            if ( err ) {
                                console.log( "useradd err: " + err );
                                robj.error = err;
                            } else {
                                console.log( "useradd ok: " + JSON.stringify( result ) );
                                robj.info = "User " + query.user + " added";
                                console.log( "useradd set robj.info" );
                            }
                            console.log( "useradd writeend: " + JSON.stringify( result ) );
                            console.log( "robj:" + JSON.stringify( robj ) );
                            writeend( res, robj );
                            console.log( "useradd after writeend" );
                        } );
                    
                    
                    // now we have ip, name, encrypted pw, add to mongo users
                    
                    // if(bcrypt.compareSync('somePassword', hash)) {
                    // Passwords match
                    //    } else {
                    // Passwords don't match
                    //}
                });
            }
        }
    });
});    

app.get( '/userstatus', ( req, res ) => {
    // TODO make async, remove minor callback hell for consistency

    let ip = req_ip( req );

    console.log( "userstatus" );
    console.log( req.url );
    let q = url.parse( req.url, true );
    console.log( JSON.stringify( q ) );
    console.log( q.pathname );
    console.log( q.search );
    let query = q.query;
    console.log( JSON.stringify( query ) );

    let robj = {};
    console.log( "userstatus" );
    if ( !query.user ) {
        robj.error = "userstatus: incorrect format";
        return writeend( res, robj );
    }
    
    mongodb.collection("users").findOne({ name : query.user }, function(err, result) {
        if ( err ) {
            robj.error = err;
        } else {
            if ( result ) {
                console.log( result );
                robj.info = "found";
                robj.name = result.name;
                robj.email = result.email;
                robj.pw = result.password;
                console.log( "found" );
            } else {
                robj.info = "not found";
                console.log( "not found" );
            }
        }
        writeend( res, robj );
    });
});    

app.post( '/jobsubmit', async ( req, res ) => {
    let ip = req_ip( req );

    console.log( req.url );
    let q = url.parse( req.url, true );
    console.log( JSON.stringify( q ) );
    console.log( q.pathname );
    console.log( q.search );
    let query = q.query;
    console.log( JSON.stringify( query ) );
    
    let robj = {};
    if ( 
        !query.user ||
            !query.pw ||
            !query.id ||
            !query._uuid ||
            !query.module 
    ) {
        robj.error = "submitjob: incorrect format";
        return writeend( res, robj );
    }

    let dobj = {};

    // check user
    await mongodb.collection("users").findOne({ name : query.user } )
        .then( ( doc ) => {
            console.log( "found user " + doc.name );
            dobj.found = true;
            dobj.hash = doc.password;
        })
        .catch( ( err ) => {
            console.log( "did not find user " + query.user + " Error:" + err.message );
            robj.error = "Incorrect password or user not found";
        });
    
    if ( robj.error ) {
        return writeend( res, robj );
    }

    // check pw
    await bcrypt.compare( query.pw, dobj.hash )
        .then( ( res ) => {
            if ( !res ) {
                robj.error = "Incorrect password or user not found.";
            } // else pw ok
        })
        .catch( ( err ) => {
            robj.error = "Error:" + err.message;
        });

    // delete pw as not needed any longer
    delete query.pw;

    if ( robj.error ) {
        return writeend( res, robj );
    }

    // check module
    await mongodb.collection("modules").findOne({ _id : query.module } )
        .then( ( doc ) => {
            console.log( "found module " + doc._id );
        })
        .catch( ( err ) => {
            console.log( "did not find module " + query.module + " Error:" + err.message );
            robj.error = "Module not defined";
        });
    
    if ( robj.error ) {
        return writeend( res, robj );
    }

    // setup job dir and stage files

    let jobdir = stagebase + "/" + query.user + "/" + query.id;

    query.directory = jobdir;

    await mkuserjobdir( query.user, query.id )
        .catch( ( err ) => {
            robj.err = err.message;
        });

    if ( robj.error ) {
        return writeend( res, robj );
    }

    let logdir = "__logdirectory__";
    logdir.replace( "_" + "_logdirectory__", "" );
    if ( logdir.length ) {
        logdir = "/" + logdir;
    }
    query.directorylog = jobdir + logdir;
    await mkdir( query.directorylog )
        .catch( ( err ) => {
            robj.err = err.message;
        });

    if ( robj.error ) {
        return writeend( res, robj );
    }

    // handle files

    if ( req.files ) {
        let keys = Object.keys( req.files );
        console.log( "found files keys = " + JSON.stringify( keys ) );
        for ( let thisfile in req.files ) {
            if ( req.files[thisfile].truncated ) {
                robj.error = "file upload " + thisfile + " over size limit.";
                return writeend( res, robj );
            }
            console.log( "moving thisfile = " + thisfile );
            let p_mv  = util.promisify( req.files[ thisfile ].mv );
            await p_mv( jobdir + "/" + thisfile ).catch( ( err ) => {
                robj.error = "file mv " + thisfile + " error:" + err.message;
            });
            if ( robj.error ) {
                return writeend( res, robj );
            }
            // console.log( JSON.stringify( req.files[thisfile] ) );
        }
    }

    // handle body - json input

    let json_input = "";

    if ( req.body && req.body.text ) {
        console.log( "found request body text found = " + req.body.text );
        json_input = req.body.text;
        let json_input_obj = {};
        try {
            json_input_obj = JSON.parse( json_input );
        } catch ( err ) {
            robj.error = "Invalid JSON : " + err.message;
        }
        json_input_obj._uuid = query._uuid;
        // TODO: add other variables ... _basedir etc or in jobrun.js?  
        // we could also add the ._uuid in jobrun.js .... perhaps a better place to avoid the stringify below?
        json_input = JSON.stringify( json_input_obj );
    }

    if ( robj.error ) {
        return writeend( res, robj );
    }

    // write args regardless if empty or not

    let argslog = query.directorylog + "/_args_" + query._uuid;
    await p_fs_writeFile( argslog, json_input )
        .catch( ( err ) => {
            robj.error = "Error creating log file " + argslog + " : " + err.message;
        })

    if ( robj.error ) {
        return writeend( res, robj );
    }

    // open logout file for spawn'd process

    // TODO: move to log directory _log_+uuid
    const logoutfile = "./logfile";

    console.log( "trying to open logoutfile" );
    const p_fs_open = util.promisify( fs.open );
    const [ logout, logerr ] = await Promise.all( [ p_fs_open( logoutfile, 'a' ), p_fs_open( logoutfile, 'a' ) ] )
        .catch( ( err ) => {
            robj.error = "Error creating log file for monitor:" + err.message;
        })

    console.log( "return from await Promise.all for logoutfile" );

    if ( robj.error ) {
        return writeend( res, robj );
    }

    // log job start in mongo 
    query.remoteip = ip;

    await apiutil.logjobstart( mongodb, query )
        .then( ( res ) => {
            console.log( "logjobstart return:" + JSON.stringify( res ) );
        })
        .catch( ( err ) => {
            console.log( "logjobstart error:" + err.message );
            robj.error = "logjobstart error:" + err.message;
        });

    if ( robj.error ) {
        return writeend( res, robj );
    }

    await apiutil.logjobupdate( mongodb, query._uuid, "finished", true )
        .catch( ( err ) => {
            console.log( "logjobupdate error:" + err.message );
            robj.error = "logjobupdate error:" + err.message;
        });


    // all ok so far, spawn new process handler

    try {
        const subprocess = 
            spawn( 'node',
                   [ 
                       __dirname + '/jobrun.js'
                       ,JSON.stringify(
                           {
                               _uuid : query._uuid
                               ,jsoninputfile : argslog
                           }
                       ) 
                   ],
                   {
                       detatched : true
                       ,stdio : [ 'ignore', logout, logerr ]
                   }
                 );
        subprocess.on( 'error', err => {
            console.log( "subprocess error: " + err.message );
        });
        subprocess.unref();
    } catch ( err ) {
        console.log( "spawn error: " + err.message );
    }
        

    robj.error = "submitjob not fully implemented";
    writeend( res, robj );
});


app.get( /.*/, ( req, res ) => res.send( '{"error":"unknown"}' ));

// get appconfig

appconfig = apiutil.read_appconfig();

if ( !appconfig.nodeapi ) {
    console.log( appconfig_file + " missing 'nodeapi' information" );
    process.exit( -103 );
}

if ( !appconfig.nodeapi.listen ) {
    console.log( appconfig_file + " missing 'nodeapi:listen' information" );
    process.exit( -104 );
}

if ( !appconfig.nodeapi.listen.host ) {
    console.log( appconfig_file + " missing 'nodeapi:listen:host' information" );
    process.exit( -105 );
}

if ( !appconfig.nodeapi.listen.port ) {
    console.log( appconfig_file + " missing 'nodeapi:listen:port' information" );
    process.exit( -106 );
}

if ( !appconfig.nodeapi.listen.host.length ) {
    console.log( appconfig_file + " empty 'nodeapi:listen:host' information" );
    process.exit( -107 );
}

if ( isNaN( appconfig.nodeapi.listen.port ) ) {
    console.log( appconfig_file + " incorrect 'nodeapi:listen:port' information" );
    process.exit( -108 );
}

if ( appconfig.nodeapi.listen.port < 1 || appconfig.nodeapi.listen.port > 65535 ) {
    console.log( appconfig_file + " invalid value for 'nodeapi:listen:port'" );
    process.exit( -109 );
}

listen_host = appconfig.nodeapi.listen.host;
listen_port = appconfig.nodeapi.listen.port;

// setup stage (SYNC - ok, since it is before startup of server)

try {
    let stats = fs.statSync( stagebase );
    if ( !stats.isDirectory() ) {
        console.log( 'stage directory "' + stagebase + '" exists but is not a directory!' );
        return;
    }
    console.log( 'stage directory "' + stagebase + '" exists and is a directory' );
    try {
        fs.accessSync( stagebase, fs.constants.R_OK | fs.constants.W_OK );
        console.log( 'stage directory "' + stagebase + '" exists and is readable & writeable' );
    } catch ( err ) {
        console.log( 'stage directory "' + stagebase + '" exists and is NOT readable & writeable' );
        return;
    }
} catch (err) {
    console.log( 'stage directory "' + stagebase + '" does not exist, try to create' );
    try {
        fs.mkdirSync( stagebase );
    } catch ( err ) {
        console.log( 'error trying to create stage directory "' + stagebase + '"');
        throw err;
    }
    // make certain we have access!
    try {
        fs.accessSync( stagebase, fs.constants.R_OK | fs.constants.W_OK );
        console.log( 'stage directory "' + stagebase + '" exists and is readable & writeable' );
    } catch ( err ) {
        console.log( 'stage directory "' + stagebase + '" exists and is NOT readable & writeable' );
        throw err;
    }
}

// startup services:

MongoClient.connect( mongo_url, ( err, db ) => {
    if (err) throw err;
    mongodb = db.db( mongo_db_name );
    console.log( "connected to mongo:" + mongo_url );
    app.listen( listen_port, listen_host, () => console.log('Listening on host:' + listen_host + ' port:' + listen_port ) );
});
