
    mjson = JSON.parse( '__modulejson__' );

    mobj = {
        _id : "__menu:modules:id__"
        ,executable : mjson.executable
        ,executable_path : "__executable_path:nodeapi__"
    };

    await mongodb.collection( "modules" ).replaceOne( { _id: "__menu:modules:id__" }, mobj, { upsert : true, writeConcern: { j : true } } )
        .then( ( res ) => {
            console.log( "logmodules: added to mongo modules: __menu:modules:id__" );
        })
        .catch( ( err ) => {
            console.log( "logmodules: error adding to mongo modules: __menu:modules:id__ :" + err.message );
            throw err;
        });
