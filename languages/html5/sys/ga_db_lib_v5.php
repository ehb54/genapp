<?php
/*
 * Library to call mongo php 5.x 

================== DB functions ========================

 * ga_db_open -> new MongoClient()
 * ga_db_fineOne -> findeOne()
 * ga_db_find -> find()
 * ga_db_insert -> insert()
 * ga_db_update -> update()
 * ga_db_remove -> remove()
 * ga_db_distinct -> distinc()
 * ga_db_selectDB -> selectDB() : Removed
 * ga_db_date -> new MongoDate()
 * ga_db_Id -> new MongoId() 
 
=================== Usage ===============================

ga_db_open( $error_json_exit );
$results = ga_db_findOne( $coll, $appname, $query, $fields, $options , $error_json_exit );
$results = ga_db_find( $coll, $appname, $query, $fields, $error_json_exit );
$results = ga_db_insert( $coll, $appname, $insert, $options, $error_json_exit );
$results = ga_db_update( $coll, $appname, $criteria, $update, $options, $error_json_exit );
$results = ga_db_remove( $coll, $appname, $criteria, $options, $error_json_exit );
$results = ga_db_distinct( $coll, $appname, $key, $query, $error_json_exit );
$results = ga_db_date( $tstamp, $error_json_exit );
$results = ga_db_Id( $datastring, $error_json_exit );

=================== Return ===============================

$results = array (
           "output": cursor(find), 
                     array of interest (findOne, distinct), 
                     date object(MongoDate), 
                     id object(MongoId),
                     array of results (insert, update, remove)
           "_status": "success" or "failed",
           "error": error message
           )

==========================================================
*/

global $ga_db_errors;

function ga_db_status( $results ) {
    return $results[ '_status' ] === 'success';
}

function ga_db_output( $results ) {
    return $results[ 'output' ];
}

function ga_db_open( $error_json_exit = false ) {
    global $ga_db_mongo;
    global $ga_db_errors;

    $results = [];
    $results[ '_status' ] = 'success';

    if ( !isset( $ga_db_mongo ) ) {
       try {
           $ga_db_mongo = new MongoClient(
               __~mongo:url{"__mongo:url__"}
               __~mongo:cafile{,[], [ "context" => stream_context_create([ "ssl" => [ "cafile" => "__mongo:cafile__" ] ] ) ]}
           );
           $results[ '_status' ] = 'success';
       } catch ( Exception $e ) {
           $ga_db_errors = "Could not connect to the db " . $e->getMessage();
           $results[ 'error' ] = $ga_db_errors;
           $results[ '_status' ] = 'failed';
           if ( $error_json_exit )
           {
               echo (json_encode($results));
               exit();
           }
       }
    }
    return $results;
}

function ga_db_findOne( $coll, $appname = "__application__", $query, $fields = [], $error_json_exit = false ) {
    global $ga_db_mongo;
    global $ga_db_errors;
    if ( !strlen( $appname ) ) {
        $appname = "__application__";
    }
    $results = [];
    try {
        $results[ "output" ] = $ga_db_mongo->$appname->$coll->findOne( $query, $fields );
        $results[ '_status' ] = 'success';
    } catch ( Exception $e ) {
        $ga_db_errors = "Could not work findOne method of db " .  $e->getMessage();
        $results[ "error" ] = $ga_db_errors;
        $results[ '_status' ] = 'failed';
         if ( $error_json_exit )
         {
            echo (json_encode($results));
            exit();
         }
    }
    return $results;
}

function ga_db_find( $coll, $appname = "__application__", $query, $fields = [], $error_json_exit = false ) {
    global $ga_db_mongo;
    global $ga_db_errors;
    if ( !strlen( $appname ) ) {
        $appname = "__application__";
    }
    $results = [];
    try {
        $results[ "output" ] = $ga_db_mongo->$appname->$coll->find( $query, $fields );
        $results[ '_status' ] = 'success';
    } catch ( MongoCursorException $e ) {
        $ga_db_errors = "Could not work with find method of db " .  $e->getMessage();
        $results[ 'error' ] = $ga_db_errors;
        $results[ '_status' ] = 'failed';

        if ( $error_json_exit )
        {
            echo (json_encode($results));
            exit();
        }
    }
    return $results;
}

function ga_db_insert( $coll, $appname = "__application__", $insert, $options = [], $error_json_exit = false ) {
    global $ga_db_mongo;
    global $ga_db_errors;
    if ( !strlen( $appname ) ) {
        $appname = "__application__"; 
    }
    $results = []; 
    __~mongojournal{$options[ 'j' ] = true;}
    __~mongojournal{$options[ 'writeConcern' ] = [ "j" => true ];}
    try {
        $results[ 'output' ] = $ga_db_mongo->$appname->$coll->insert( $insert, $options );
        $results[ '_status' ] = 'success';
    } catch ( MongoException $e ) {
        $ga_db_errors = "Error inserting " .  $e->getMessage();
        $results[ 'error' ] = $ga_db_errors;
        $results[ '_status' ] = 'failed';
        if ( $error_json_exit ) {
            echo (json_encode($results));
            exit();
        }
    }
    return $results;
//  For PHP7, insertOne() or insertMany()
}

function ga_db_update( $coll, $appname = "__application__", $criteria, $update, $options = [], $error_json_exit = false ) { 
    global $ga_db_mongo;
    global $ga_db_errors;
    if ( !strlen( $appname ) ) {
        $appname = "__application__";
    }
    $results = [];
    __~mongojournal{$options[ 'j' ] = true;}
    __~mongojournal{$options[ 'writeConcern' ] = [ "j" => true ];}
    try {
        $results[ 'output' ] = $ga_db_mongo->$appname->$coll->update( $criteria, $update, $options);
        $results[ '_status' ] = 'success'; 
    } catch ( MongoCursorException $e ) {
        $ga_db_errors = "Could not update the db " .  $e->getMessage();
        $results[ 'error' ] = $ga_db_errors;
        $results[ '_status' ] = 'failed';
         if ( $error_json_exit )
         {  
            echo (json_encode($results));
            exit();
         }
    }
    return $results;
}

function ga_db_remove($coll, $appname = "__application__", $criteria, $options = [], $error_json_exit = false ) {
    global $ga_db_mongo;
    global $ga_db_errors;
    if ( !strlen( $appname ) ) {
        $appname = "__application__";
    }
    $results = [];
    __~mongojournal{$options[ 'j' ] = true;}
    __~mongojournal{$options[ 'writeConcern' ] = [ "j" => true ];}
    try {
        $results[ 'output' ] = $ga_db_mongo->$appname->$coll->remove( $criteria, $options );
        $results[ '_status' ] = 'success';
    } catch ( MongocursorException $e ) {
        $ga_db_errors = "Could not update the db " .  $e->getMessage();
        $results[ 'error' ] = $ga_db_errors;
        $results[ '_status' ] = 'failed';
         if ( $error_json_exit )
         {  
            echo (json_encode($results));
            exit();
         }
    }
    return $results;
}

function ga_db_distinct( $coll, $appname = "__application__", $key, $query, $error_json_exit = false ) {
   global $ga_db_mongo;
   global $ga_db_errors;
    if ( !strlen( $appname ) ) {
        $appname = "__application__";
    }
    $results = [];
    try {
        $results[ "output" ] = $ga_db_mongo->$appname->$coll->distinct( $key, $query );
        $results[ '_status' ] = 'success';
    } catch ( Exception $e ) {
        $ga_db_errors = "Could not work distinct method of db " .  $e->getMessage();
        $results[ "error" ] = $ga_db_errors;
        $results[ '_status' ] = 'failed';
         if ( $error_json_exit )
         {  
            echo (json_encode($results));
            exit();
         }
    }
    return $results;
}

function ga_db_date( $tstamp, $error_json_exit = false ) {
// MongoDate class
    global $ga_db_mongo;
    global $ga_db_errors;

    $results = [];
    if ( !is_bool($tstamp) ) {
        if ( !strlen($tstamp) ) { 
            $results[ "output" ]  = new MongoDate();
            $results[ '_status' ] = 'success';
        } else {
            $results[ "output" ]  = new MongoDate($tstamp);
            $results[ '_status' ] = 'success';
        }
    }  
    return $results;
}


function ga_db_Id( $datastring, $error_json_exit = false ) {
// MongoID class
    global $ga_db_mongo;
    global $ga_db_errors;

    $results = [];
    try {
        $results[ "output" ] = new MongoId( $datastring );
        $results[ '_status' ] = 'success';
    } catch ( Exception $e ) {
        $ga_db_errors = "Could not call MongoId class " .  $e->getMessage();
        $results[ "error" ] = $ga_db_errors;
        $results[ '_status' ] = 'failed';
         if ( $error_json_exit )
         {
            echo (json_encode($results));
            exit();
         }
    }
    return $results;
}

/*
function ga_db_CursorException() {
    
}
*/

