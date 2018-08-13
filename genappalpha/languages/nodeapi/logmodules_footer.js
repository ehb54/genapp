    process.exit(0);
};

MongoClient.connect( mongo_url, ( err, db ) => {
    if (err) throw err;
    mongodb = db.db( mongo_db_name );
    console.log( "connected to mongo:" + mongo_url );
    logmodules();
});
