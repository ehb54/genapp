'use_strict';

console.log( "jobrun called: cwd:" + process.cwd() + " json:" + JSON.stringify( process.argv ) );

const stagebase      = "__docroot:nodeapi__";
const mongo_url      = "mongodb://localhost:27017/";
const mongo_db_name  = "__application__"; 

const fs = require('fs');
const util = require('util');
const MongoClient = require('mongodb').MongoClient;
const execSync = require('child_process').execSync;
const apiutil = require('./apiutil.js');
const { spawn }     = require('child_process');

var request = {};
try {
    request = JSON.parse( process.argv[ 2 ] );
} catch (err) {
    console.log( "jobrun: error parsing json input string: " + err );
    process.exit(-201);
}

if ( !request._uuid ) {
    console.log( "jobrun: no _uuid found in input" );
    process.exit(-202);
}

// _uuid becomes part of file and directory paths; allow only a safe, non-traversing name
if ( !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test( request._uuid ) ) {
    console.log( "jobrun: _uuid has an unexpected format" );
    process.exit(-202);
}

if ( !request.jsoninputfile ) {
    console.log( "jobrun: no jsoninputfile found in input" );
    process.exit(-202);
}

// var org_request = request;

var appconfig = apiutil.read_appconfig();

var json_input;
try {
    json_input = fs.readFileSync( request.jsoninputfile, 'utf8' );
} catch ( err ) {
    console.log( "error reading jsoninput file : " + err.message );
}

async function error_exit( id, message ) {
    console.log( message );

    await apiutil.logjobupdate( mongodb, request._uuid, "finished", true )
        .catch( ( err ) => {
            console.log( "logjobupdate error:" + err.message );
        });
    
    process.exit( id );
}

MongoClient.connect( mongo_url ).then( async ( client ) => {
    mongodb = client.db( mongo_db_name );
    console.log( "connected to mongo:" + mongo_url );

    // lookup job in mongo

    let job = {};

    await mongodb.collection("jobs").findOne({ _id : request._uuid } )
        .then( ( doc ) => {
            console.log( "found job " + doc._id );
            job = doc;
        })
        .catch( ( err ) => {
            console.log( "did not find job " + request._uuid + " Error:" + err.message );
            process.exit( -203 );
        });
    
    if ( !job.directory ) {
        return error_exit( -204, "job " + job._id + " Error: no directory defined in job" );
    }

    // lookup job's module in mongo

    let module = {};

    await mongodb.collection("modules").findOne({ _id : job.module } )
        .then( ( doc ) => {
            console.log( "module found " + doc._id );
            module = doc;
        })
        .catch( ( err ) => {
            return error_exit( -205, "did not find module " + job.module + " Error:" + err.message );
        });
    
    if ( !module.executable ||
         !module.executable_path ) {
        return error_exit( -206, "module " + job.module + " Error: excutable and/or executable path not defined" );
    }

    console.log( "found job, module, should be ready to run next" );

    let cmd = module.executable_path + "/" + module.executable;

    const fsaccess = util.promisify( fs.access );
    await fsaccess( cmd, fs.constants.X_OK )
        .then ()
        .catch ( (err) => {
            return error_exit( -207, cmd + " : not found or not executable" );
        });

    // fix up json_input, write as _args

    try {
        json_obj = JSON.parse( json_input );
    } catch ( err ) {
        return error_exit( -208, `Error parsing JSON input: ${err.message}` );
    }

    json_obj._uuid           = request._uuid;
    json_obj._base_directory = job.directory;
    json_obj._log_directory  = job.directorylog;

    if ( appconfig.messaging &&
         appconfig.messaging.udphostip &&
         appconfig.messaging.udpport ) {
        console.log( "udp defined" );
        json_obj._udphostip = appconfig.messaging.udphostip;
        json_obj._udpport   = appconfig.messaging.udpport;
    }

    json_input = JSON.stringify( json_obj );

    try {
        let argslog = job.directorylog + "/_args_" + request._uuid;
        console.log( "argslog is " + argslog );
        fs.writeFileSync( argslog, json_input );
    } catch ( err ) {
        return error_exit( -208, `Error creating argslog file ${argslog} : ${err.message}` );
    }

    let stderrfile  = `${job.directorylog}/_stderr_${request._uuid}`;
    let stdout_file = `${job.directorylog}/_stdout_${request._uuid}`;

    // Run the module's executable directly, with no shell. The JSON input is passed as a single argv
    // element, so no value in it can be parsed as a shell command, redirection or separate word. An
    // optional module.exec_prefix (an array, e.g. a scheduler, nice, or a cpu-pinning wrapper) runs in
    // front of the executable; its words come from the module definition, never from the request.
    let argv = Array.isArray( module.exec_prefix ) ? module.exec_prefix.slice() : [];
    argv.push( cmd );
    argv.push( json_input );

    try {
        let cmdlog = job.directorylog + "/_cmds_" + request._uuid;
        console.log( "cmdlog is " + cmdlog );
        fs.writeFileSync( cmdlog, JSON.stringify( argv ) + "\n" );
    } catch ( err ) {
        return error_exit( -208, "Error creating cmd file " + cmdlog + " : " + err.message );
    }

    console.log( "argv is " + JSON.stringify( argv ) );

    await apiutil.logjobupdate( mongodb, request._uuid, "running", false )
        .catch( ( err ) => {
            return error_exit( -208, "logjobupdate error:" + err.message );
        });

    let outfd, errfd;
    try {
        outfd = fs.openSync( stdout_file, 'w' );
        errfd = fs.openSync( stderrfile, 'w' );
    } catch ( err ) {
        return error_exit( -210, `Error creating output files : ${err.message}` );
    }

    // cap captured stdout at the former 'head -c' limit
    const maxout = 50000000;
    let written  = 0;

    const child = spawn( argv[ 0 ], argv.slice( 1 ),
                         {
                             cwd : job.directory
                             ,stdio : [ 'ignore', 'pipe', errfd ]
                         }
                       );

    child.stdout.on( 'data', ( chunk ) => {
        if ( written >= maxout ) {
            return;
        }
        if ( written + chunk.length > maxout ) {
            chunk = chunk.slice( 0, maxout - written );
        }
        try {
            fs.writeSync( outfd, chunk );
        } catch ( err ) {
            console.log( "error writing stdout file: " + err.message );
        }
        written += chunk.length;
    });

    child.on( 'error', ( err ) => {
        try { fs.closeSync( outfd ); } catch ( e ) {}
        try { fs.closeSync( errfd ); } catch ( e ) {}
        return error_exit( -209, `Error running ${cmd} : ${err.message}` );
    });

    child.on( 'close', async ( code ) => {
        try { fs.closeSync( outfd ); } catch ( e ) {}
        try { fs.closeSync( errfd ); } catch ( e ) {}
        if ( code ) {
            console.log( `${cmd} exited with code ${code}` );
        }
        await apiutil.logjobupdate( mongodb, request._uuid, "finished", true )
            .catch( ( err ) => {
                return error_exit( -211, "logjobupdate upon finish error:" + err.message );
            });
        // the open client keeps this process alive: close it, so the job's runner exits
        await client.close();
    });
}).catch( ( err ) => {
    throw err;
});
