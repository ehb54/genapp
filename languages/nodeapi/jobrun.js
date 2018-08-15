'use_strict';

// TODO update mongo job

console.log( "jobrun called: cwd:" + process.cwd() + " json:" + JSON.stringify( process.argv ) );

const stagebase      = "__docroot:nodeapi__";
const mongo_url      = "mongodb://localhost:27017/";
const mongo_db_name  = "__application__"; 

const fs = require('fs');
const util = require('util');
const MongoClient = require('mongodb').MongoClient;
const execSync = require('child_process').execSync;
const apiutil = require('./apiutil.js');

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

if ( !request.jsoninputfile ) {
    console.log( "jobrun: no jsoninputfile found in input" );
    process.exit(-202);
}
    
var appconfig = apiutil.read_appconfig();

var json_input;
try {
    json_input = fs.readFileSync( request.jsoninputfile, 'utf8' );
} catch ( err ) {
    console.log( "error reading jsoninput file : " + err.message );
}

MongoClient.connect( mongo_url, async ( err, db ) => {
    if (err) throw err;
    mongodb = db.db( mongo_db_name );
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
            process.exit(-203);
        });
    
    if ( !job.directory ) {
        console.log( "job " + job._id + " Error: no directory defined in job" );
        process.exit( -204 );
    }

    // lookup job's module in mongo

    let module = {};

    await mongodb.collection("modules").findOne({ _id : job.module } )
        .then( ( doc ) => {
            console.log( "module found " + doc._id );
            module = doc;
        })
        .catch( ( err ) => {
            console.log( "did not find module " + job.module + " Error:" + err.message );
            process.exit( -205 );
        });
    
    if ( !module.executable ||
         !module.executable_path ) {
        console.log( "module " + job.module + " Error: excutable and/or executable path not defined" );
        process.exit( -206 );
    }

    console.log( "found job, module, should be ready to run next" );

    let cmd = module.executable_path + "/" + module.executable;

    const fsaccess = util.promisify( fs.access );
    await fsaccess( cmd, fs.constants.X_OK )
        .then ()
        .catch ( (err) => {
            console.log( cmd + " : not found or not executable" );
            process.exit( -207 );
        });

    cmd = "cd " + job.directory + ";" + cmd + " '" + json_input + "'";
    // TODO write out cmd file with stderr stdout etc
    console.log( "command is <" + cmd + ">" );
    // TODO run command

    // TODO closeout
});
