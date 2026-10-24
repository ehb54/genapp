    process.exit(0);
};

MongoClient.connect( mongo_url ).then( ( client ) => {
    mongodb = client.db( mongo_db_name );
    console.log( "connected to mongo:" + mongo_url );
    logmodules();
}).catch( ( err ) => {
    throw err;
});
