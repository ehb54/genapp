'use_strict';

const fs = require('fs');

module.exports = {
    logjobstart: async ( mongodb, query ) => {
        let now = new Date();
        let mobj = {
            _id           : query._uuid
            ,menu         : query.menu
            ,module       : query.module
            ,user         : query.user
            ,directory    : query.directory
            ,directorylog : query.directorylog
            ,when         : [ now ]
            ,start        : now
            ,status       : [ "started" ]
            ,remoteip     : query.remoteip
        };

        if ( query.resource ) {
            mobj.resource = query.resource;
        }

        if ( query.queue ) {
            mobj.queue = query.queue;
        }

        if ( query.wall ) {
            mobj.wall = query.wall;
        }

        if ( query.np ) {
            mobj.np = query.np;
        }

        if ( query.param ) {
            mobj.param = query.param;
        }

        // TODO: we should really check if running maybe check status

        if ( query._clobber ) {
            await mongodb.collection( "jobs" ).replaceOne( { _id: query._uuid }, mobj, { upsert : true, writeConcern: { j : true } } )
                .then( ( res ) => {
                    console.log( "logjobstart replaceOne result:" + JSON.stringify( res ) );
                })
                .catch( ( err ) => {
                    console.log( "logjobstart replaceOne error:" + err.message  );
                    throw err;
                });
        } else {
            await mongodb.collection( "jobs" ).insertOne( mobj, { j : true } )
                .then( ( res ) => {
                    console.log( "logjobstart insertOne result:" + JSON.stringify( res ) );
                })
                .catch( ( err ) => {
                    console.log( "logjobstart insertOne error:" + err.message  );
                    throw err;
                });
        }
    }
    ,
    logjobupdate: async ( mongodb, uuid, status, log_end ) => {
        let now = new Date();
        let errors = "";
        if ( !uuid ) {
            console.log( "logjobupdate: no uuid" );
            errors += "No uuid specified. ";
        }
        if ( !status ) {
            console.log( "logjobupdate: no status" );
            errors += "No status specified. ";
        }
        if ( errors.length ) {
            console.log( "logjobupdate: has errors" );
            throw new Error( "ERROR: logjobupdate:" + errors );
        }

        let update = {
            $push : {
                when    : now
                ,status : status
                }
        };

        if ( log_end ) {
            update.$set = {
                end : now
            }
            await mongodb.collection( "jobs" ).findOne( { _id: uuid } )
                .then( ( doc ) => {
                    if ( !doc ) {
                        throw new Error( "mongodb error: job:" + uuid + " not found" );
                    }
                    if ( doc.status &&
                         doc.status.cancelled ) {
                        // cancelled, nothing more to do
                        console.log( "logjobupdate: cancelled, returning" );
                        return;
                    }
                    if ( !doc.start ) {
                        throw new Error( "no doc.start" );
                    }
                    update.$set.duration = ( now.getTime() - doc.start.getTime() ) * 1e-3;
                    console.log( "logjobupdate: computed duration" );
                })
                .catch( ( err ) => {
                    throw err;
                });
        };

        
        console.log( "logjobupdate: obj: " + JSON.stringify( update ) );

        await mongodb.collection( "jobs" ).update( { _id: uuid }, update, { upsert : true, writeConcern: { j : true } } )
            .then( ( res ) => {
                console.log( "logjobstart insertOne result:" + JSON.stringify( res ) );
            })
            .catch( ( err ) => {
                console.log( "logjobstart insertOne error:" + err.message  );
                throw err;
            });
    }
    ,
    read_appconfig : ( appconfig_file ) => {
        appconfig_file = appconfig_file || '__appconfig__';
        let appconfig = {};

        let appconfig_json = "";
        try {
            appconfig_json = fs.readFileSync( appconfig_file, 'utf8' );
            console.log( appconfig_json );
        } catch (err) {
            console.log( "Could not open appconfig file " + appconfig_file + " : " + err.message );
            process.exit( -101 );
        }

        try {
            appconfig = JSON.parse( appconfig_json );
        } catch (err) {
            console.log( "Could not JSON parse  " + appconfig_file + " : " + err.message );
            process.exit( -102 );
        }

        return appconfig;
    }


};

