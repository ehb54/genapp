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
 * ga_db_command -> command()
 * ga_db_save -> save()
 
=================== Usage ===============================

ga_db_open( $error_json_exit );
$results = ga_db_findOne( $coll, $appname, $query, $projection, $options, $error_json_exit );
$results = ga_db_find( $coll, $appname, $query, $projection, $options, $error_json_exit );
$results = ga_db_insert( $coll, $appname, $insert, $options, $error_json_exit );
$results = ga_db_update( $coll, $appname, $criteria, $update, $options, $error_json_exit );
$results = ga_db_remove( $coll, $appname, $criteria, $options, $error_json_exit );
$results = ga_db_distinct( $coll, $appname, $key, $query, $error_json_exit );
$results = ga_db_date( $tstamp, $error_json_exit );
$results = ga_db_Id( $datastring, $error_json_exit );
$results = ga_db_command( $appname, $command, $options, $error_json_exit );
$results = ga_db_count( $coll, $appname, $query, $options, $error_json_exit );
$results = ga_db_save( $coll, $appname, $document, $options, $error_json_exit );

================ Usage utility routines ===========

bool  = ga_db_status( $results );
obj   = ga_db_output( $results );
date  = ga_db_add_secs( $date, $seconds );
float = ga_db_date_secs_diff( $date1, $date2 );
float = ga_db_date_secs( $date );

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

date_default_timezone_set("UTC");

global $ga_db_errors;

# utility routines

function ga_db_status( $results ) {
    return $results[ '_status' ] === 'success';
}

function ga_db_output( $results ) {
    return $results[ 'output' ];
}

function ga_db_date_add_secs( $mongodate, $seconds = 0 ) {
# add seconds to date / only integer values allowed
    if ( $seconds != intval( $seconds ) ) {
        echo "Fractional seconds not allowed for ga_db_date_add_secs\n";
        exit();
    }        
    $newdate = clone $mongodate;
    $newdate->sec += floor( $seconds );
    return $newdate;
}

function ga_db_date_secs_diff( $mongodate1, $mongodate2 ) {
# return difference of dates in decimal seconds 
    return ga_db_date_secs( $mongodate1 ) - ga_db_date_secs( $mongodate2 );
}

function ga_db_date_secs( $mongodate ) {
# return date as decimal seconds
    return $mongodate->sec + $mongodate->usec * 1.0e-6;
}

# ga_db main routines

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

# uncomment below to log
# $ga_db_log_file = "/tmp/my_log_file"; # or whereever

if ( isset( $ga_db_log_file ) ) {
    date_default_timezone_get();
}

function ga_db_findOne( $coll, $appname = "__application__", $query, $projection = [], $options = [], $error_json_exit = false ) {
    if ( isset( $ga_db_log_file ) ) {
        error_log( date('m/d/Y h:i:s a', time() ) . " ga_db_findOne( $coll, $appname,\n" . json_encode( $query, JSON_PRETTY_PRINT ) . "\n" . json_encode( $projection, JSON_PRETTY_PRINT ) . "\n" . ( $error_json_exit ? "true" : "false" ) . ") =\n", 3, $ga_db_log_file );
    }
    global $ga_db_mongo;
    global $ga_db_errors;
    if ( !strlen( $appname ) ) {
        $appname = "__application__";
    }
    $results = [];
    try {
        $results[ "output" ] = $ga_db_mongo->$appname->$coll->findOne( $query, $projection );
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
    if ( isset( $debug ) ) {
        error_log( json_encode( $results, JSON_PRETTY_PRINT ) . "\n", 3, $ga_db_log_file );
    }
    return $results;
}

function ga_db_count( $coll, $appname = "__application__", $query, $options = [], $error_json_exit = false ) {
    if ( isset( $ga_db_log_file ) ) {
        error_log( date('m/d/Y h:i:s a', time() ) . " ga_db_count( $coll, $appname,\n" . json_encode( $query, JSON_PRETTY_PRINT ) . "\n" . json_encode( $options, JSON_PRETTY_PRINT ) . "\n" . ( $error_json_exit ? "true" : "false" ) . ") =\n", 3, $ga_db_log_file );
    }
    global $ga_db_mongo;
    global $ga_db_errors;
    if ( !strlen( $appname ) ) {
        $appname = "__application__";
    }
    $results = [];
    try {
        $results[ "output" ] = $ga_db_mongo->$appname->$coll->count( $query, $options );
        $results[ '_status' ] = 'success';
    } catch ( Exception $e ) {
        $ga_db_errors = "Could not work count method of db " .  $e->getMessage();
        $results[ "error" ] = $ga_db_errors;
        $results[ '_status' ] = 'failed';
        if ( $error_json_exit )
        {
            echo (json_encode($results));
            exit();
        }
    }
    if ( isset( $debug ) ) {
        error_log( json_encode( $results, JSON_PRETTY_PRINT ) . "\n", 3, $ga_db_log_file );
    }
    return $results;
}

function ga_db_save( $coll, $appname = "__application__", $document, $options = [], $error_json_exit = false ) {
    if ( isset( $ga_db_log_file ) ) {
        error_log( date('m/d/Y h:i:s a', time() ) . " ga_db_save( $coll, $appname,\n" . json_encode( $document, JSON_PRETTY_PRINT ) . "\n" . json_encode( $options, JSON_PRETTY_PRINT ) . "\n" . ( $error_json_exit ? "true" : "false" ) . ") =\n", 3, $ga_db_log_file );
    }
    global $ga_db_mongo;
    global $ga_db_errors;
    if ( !strlen( $appname ) ) {
        $appname = "__application__";
    }
    $results = [];
    try {
        $results[ "output" ] = $ga_db_mongo->$appname->$coll->save( $document, $options );
        $results[ '_status' ] = 'success';
    } catch ( Exception $e ) {
        $ga_db_errors = "Could not work save method of db " .  $e->getMessage();
        $results[ "error" ] = $ga_db_errors;
        $results[ '_status' ] = 'failed';
        if ( $error_json_exit )
        {
            echo (json_encode($results));
            exit();
        }
    }
    if ( isset( $debug ) ) {
        error_log( json_encode( $results, JSON_PRETTY_PRINT ) . "\n", 3, $ga_db_log_file );
    }
    return $results;
}

function ga_db_command( $appname = "__application__", $command, $options = [], $error_json_exit = false ) {
    if ( isset( $ga_db_log_file ) ) {
        error_log( date('m/d/Y h:i:s a', time() ) . " ga_db_command( $appname,\n" . json_encode( $command, JSON_PRETTY_PRINT ) . "\n" . json_encode( $options, JSON_PRETTY_PRINT ) . "\n" . ( $error_json_exit ? "true" : "false" ) . ") =\n", 3, $ga_db_log_file );
    }
    global $ga_db_mongo;
    global $ga_db_errors;
    if ( !strlen( $appname ) ) {
        $appname = "__application__";
    }
    $results = [];
    try {
        $results[ "output" ] = $ga_db_mongo->$appname->command( $command, $options );
        $results[ '_status' ] = 'success';
    } catch ( Exception $e ) {
        $ga_db_errors = "Error using command method of db " .  $e->getMessage();
        $results[ "error" ] = $ga_db_errors;
        $results[ '_status' ] = 'failed';
         if ( $error_json_exit )
         {
            echo (json_encode($results));
            exit();
         }
    }
    if ( isset( $debug ) ) {
        error_log( json_encode( $results, JSON_PRETTY_PRINT ) . "\n", 3, $ga_db_log_file );
    }
    return $results;
}

function ga_db_find( $coll, $appname = "__application__", $query = [], $projection = [], $options = [], $error_json_exit = false ) {
    global $ga_db_mongo;
    global $ga_db_errors;
    if ( !strlen( $appname ) ) {
        $appname = "__application__";
    }
    $results = [];
    try {
        $results[ "output" ] = $ga_db_mongo->$appname->$coll->find( $query, $projection );
        $results[ '_status' ] = 'success';
        if ( isset( $options[ 'sort' ] ) ) {
            $results[ 'output' ]->sort( $options[ 'sort' ] );
        }
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

function ga_db_date( $tstamp = '', $error_json_exit = false ) {
    global $ga_db_mongo;
    global $ga_db_errors;

    $results = [];
    if ( strlen($tstamp) ) { 
        $results[ "output" ]  = new MongoDate($tstamp);
        $results[ '_status' ] = 'success';
    } else {
        $results[ "output" ]  = new MongoDate();
        $results[ '_status' ] = 'success';
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

