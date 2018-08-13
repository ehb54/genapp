'use_strict';

const mongo_url      = "mongodb://localhost:27017/";
const mongo_db_name  = "__application__"; 

const MongoClient = require('mongodb').MongoClient;

// global variables
 
var mongodb;

logmodules = async function() {

    var mjson;
    var mobj;
