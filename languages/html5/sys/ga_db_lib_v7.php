<?php
/*
 * Library to call mongodb( not mongo ) in php 7.x 
 * based on vendor 
 * Date: Mar-18-2019

========================== DB functions ==================================================
  ga_db_lib            | php 5 mongo                     |  php 7 mongodb
------------------------------------------------------------------------------------------
  ga_db_status         | Return '_status' of ga_db method| Return '_status' of ga_db method
  ga_db_output         | Return 'output' of ga_db method | Return 'output' of ga_db method

  ga_db_date_secs      | $date->sec + $date->usec*1.0e-6 |  
  ga_db_date_add_secs  | $date->sec + floor($seconds)    |
  ga_db_date_secs_diff | $date1->sec - $date2->sec       |

  ga_db_open           | new MongoClient()               | new MongoDB\Client() 
  ga_db_fineOne        | findeOne()                      | findOne()
  ga_db_count          | count()                         | count()
  ga_db_save           | save()                          | insertOne() or replaceOne() 
  ga_db_command        | command()                       | MongoDB\Driver\command()
  ga_db_find           | find()                          | find()
  ga_db_insert         | insert()                        | insertMany() if $array has nested arrays or insertOne() if not    
  ga_db_update         | update()                        | updateOne() 
  ga_db_remove         | remove()                        | deleteOne if php5 code has option ["justOne" => 1]. Otherwise, use deleteMany()
  ga_db_distinct       | distinc()                       | distinct()
  ga_db_date           | new MongoDate()                 | new MongoDB\BSON\UTCDateTime() 
  ga_db_Id             | new MongoId()                   | new MongoDB\BSON\ObjectId( ) 

                      
============================= utility =====================================================
                       usage                             | return
-------------------------------------------------------------------------------------------
$status = ga_db_status( $results )                       | $status = success/failed (character)
$output = ga_db_output( $results )                       | $output = $results[ "output" ] (array) 

$date = ga_db_date_add_secs( $mongodate, $seconds = 0 )  | $date = mongo date object (object) 
$secs = ga_db_date_secs_diff( $mongodate1, $mongodate2 ) | $secs = difference between mongo dates (float)
$secs = ga_db_date_secs( $mongodate ) | $secs = second (float)

============================= mongo methods =================================================

$results = ga_db_open( $error_json_exit = false ) 
$results = ga_db_findOne( $coll, $appname = "__application__", $query, $projection = [], $options = [], $error_json_exit = false ) 
$results = ga_db_count( $coll, $appname = "__application__", $query, $options = [], $error_json_exit = false ) 
$results = ga_db_save( $coll, $appname = "__application__", $document, $options = [], $error_json_exit = false ) 
$results = ga_db_command( $appname = "__application__", $command, $options = [], $error_json_exit = false ) 
$results = ga_db_find( $coll, $appname = "__application__", $query = [], $projection = [], $options = [], $error_json_exit = false )
$results = ga_db_insert( $coll, $appname = "__application__", $insert, $options = [], $error_json_exit = false ) 
$results = ga_db_update( $coll, $appname = "__application__", $criteria, $update, $options = [], $error_json_exit = false )  
$results = ga_db_remove($coll, $appname = "__application__", $criteria, $options = [], $error_json_exit = false ) 
$results = ga_db_distinct( $coll, $appname = "__application__", $key, $query, $error_json_exit = false ) 
$results = ga_db_date( $tstamp = '', $error_json_exit = false ) 
$results = ga_db_Id( $datastring, $error_json_exit = false ) 

$results = array (
           "output": cursor(find), 
                     array of interest (findOne, distinct), 
                     date object(MongoDate), 
                     id object(MongoId),
                     array of results (insert, update, remove)
           "_status": "success" or "failed",
           "error": error message
           )

===========================================================================================
*/

require '__docroot:html5__/__application__/vendor/autoload.php'; // include Composer's autoloader

date_default_timezone_set("UTC");

global $ga_db_errors;

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
    // time in seconds
    $oldtime = $mongodate->toDateTime()->format('U.u');
    $oldtime += floor( $seconds );
    // timstamp should be in milliseconds
    $newdate = ga_db_output( ga_db_date( $oldtime*1000 ) ); 
    return $newdate;
}

function ga_db_date_secs_diff( $mongodate1, $mongodate2 ) {
# return difference of dates in decimal seconds 
    return ga_db_date_secs( $mongodate1 ) - ga_db_date_secs( $mongodate2 );
}

function ga_db_date_secs( $mongodate ) {
# return date as decimal seconds
    $newsec = $mongodate->toDateTime()->format('U.u');
    return $newsec;
}

function ga_db_open( $error_json_exit = false ) {
    global $ga_db_mongo;
    global $ga_db_errors;

    $results = [];
    $results[ '_status' ] = 'success';

    if ( !isset( $ga_db_mongo ) ) {
       try {
           $ga_db_mongo = new MongoDB\Client(
               __~mongo:url{"__mongo:url__"}
               __~mongo:cafile{,[], [ "context" => stream_context_create([ "ssl" => [ "cafile" => "__mongo:cafile__" ] ] ) ]}
           );
           $results[ '_status' ] = 'success';
       } catch ( Exception $e ) {
           $db_errors = "Error connecting to db " . $e->getMessage();
           $results[ 'error' ] = $db_errors;
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

function ga_db_findOne( $coll, $appname = "__application__", $query, $projection = [], $options = [], $error_json_exit = false ) {
    if ( isset( $ga_db_log_file ) ) {
        error_log( date('m/d/Y h:i:s a', time() ) . "\n" . "ga_db_findOne( $coll, $appname,\n" . "\$query = " . json_encode( $query, JSON_PRETTY_PRINT )  . "\n" . "\$projection = " . json_encode( $projection ) . "\n" . "\$error_json_exit = ".( $error_json_exit ? "true" : "false" ) . ") =\n", 3, $ga_db_log_file );
   }

    global $ga_db_mongo;
    global $ga_db_errors;

//  Note 'sort' was a method in the old php 5 mongo. Now it is included in $options. 
//  We can add more keys if necessary. 

    $options_key = [ 'sort', 'skip', 'limit', 'collation' ];
    $options_findOne = [ 'projection' => $projection ];

    foreach ( $options_key as $v ) {
        if ( isset( $options[ $v ] ) ) {
            array_push( $options_findOne, [ $v => $options[v] ] );
        }
    }

    if ( !strlen( $appname ) ) {
        $appname = "__application__";
    }

    $results = [];
    try {
        $results[ "output" ] = $ga_db_mongo->$appname->$coll->findOne( $query,  $options_findOne );
        $results[ '_status' ] = 'success';
    } catch ( MongoDB\Exception\UnsupportedException $e ) {
        $db_errors = "Error finding " .  $e->getMessage();
        $results[ "error" ] = $db_errors;
        $results[ '_status' ] = 'failed';
         if ( $error_json_exit )
         {
            echo (json_encode($results));
            exit();
         }
    } catch ( MongoDB\Exception\InvalidArgumentException $e ) {
        $db_errors = "Error finding " .  $e->getMessage();
        $results[ "error" ] = $db_errors;
        $results[ '_status' ] = 'failed';
         if ( $error_json_exit )
         {
            echo (json_encode($results));
            exit();
         }
    } catch ( MongoDB\Exception\RuntimeException $e ) {
        $db_errors = "Error finding " .  $e->getMessage();
        $results[ "error" ] = $db_errors;
        $results[ '_status' ] = 'failed';
         if ( $error_json_exit )
         {
            echo (json_encode($results));
            exit();
         }
    }
    if ( isset( $debug ) ) {
        error_log( json_encode( $results ) . "\n", 3, $ga_db_log_file );
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
        error_log( json_decode( $results, JSON_PRETTY_PRINT ) . "\n", 3, $ga_db_log_file );
    }
    return $results;
}

function ga_db_save( $coll, $appname = "__application__", $document, $options = [], $error_json_exit = false ) {
// maintain the original mongo save() method 
// if $document exists use insertOne() else replaceOne()
// note this method is slow 
  
    if ( isset( $ga_db_log_file ) ) {
        error_log( date('m/d/Y h:i:s a', time() ) . " ga_db_save( $coll, $appname,\n" . json_encode( $document, JSON_PRETTY_PRINT ) . "\n" . json_encode( $options, JSON_PRETTY_PRINT ) . "\n" . ( $error_json_exit ? "true" : "false" ) . ") =\n", 3, $ga_db_log_file );
    }
    global $ga_db_mongo;
    global $ga_db_errors;
    if ( !strlen( $appname ) ) {
        $appname = "__application__";
    }

    $results = [];
    $run_insert = false;

    if ( isset ( $document[ "_id" ] ) ) {
        $count_id = ga_db_output( ga_db_count( $coll, $appname, [ "_id" => $document[ "_id" ] ] ) );
//        echo ( "number of doc with _id in query = ". $count_id . "\n" );
        if ( $count_id ) {
            $run_insert = false;
        } else {
            $run_insert = true;
        }
    } else {
        $run_insert = true;
    }
 
    try {
        if ( $run_insert ) {
            $results[ "output" ] = $ga_db_mongo->$appname->$coll->insertOne( $document, $options )->getInsertedId();
            $results[ '_status' ] = 'success';
//            echo ("run insetOne \n" );
        } else {
            $replacement = [];
//            echo ( json_encode($document, JSON_PRETTY_PRINT). "\n" ); 
            foreach ( $document as $v => $w) {
//                echo ( $v . "   ".  $w . "   \n" );
                if ( $v === "_id" ) {
                    $filter = [ $v => $w ];
                } else {
                    $replacement[ $v ] =  $w  ;
                }
            }
//            echo ("run updateOne \n" );
            $update = [];
            $update[ '$set' ] = $replacement;
//            echo (JSON_encode($update, JSON_PRETTY_PRINT )."\n" );
            $options[ 'upsert' ] = true;
            $results[ "output" ] = ga_db_output( ga_db_update( $coll, $appname, $filter, $update, $options ) );
            $results[ '_status' ] = 'success';
        }
    } catch ( Exception $e ) {
        $ga_db_errors = "Could not work save method of db " .  $e->getMessage();
        $results[ "error" ] = $ga_db_errors;
        $results[ '_status' ] = 'failed';
        if ( $error_json_exit )
        {
            echo (json_encode($results));
            exit();
        }
    } catch ( MongoDB\Exception\InvalidArgumentException  $e ) {
        $db_errors = "Error inserting " .  $e->getMessage();
        $results[ "error" ] = $db_errors;
        $results[ '_status' ] = 'failed';
         if ( $error_json_exit )
         {
            echo (json_encode($results));
            exit();
         }
    } catch ( MongoDB\Driver\Exception\BulkWriteException  $e ) {
        $db_errors = "Error inserting " .  $e->getMessage();
        $results[ "error" ] = $db_errors;
        $results[ '_status' ] = 'failed';
         if ( $error_json_exit )
         {
            echo (json_encode($results));
            exit();
         }
    } catch ( MongoDB\Driver\Exception\RuntimeException  $e ) {
        $db_errors = "Error inserting " .  $e->getMessage();
        $results[ "error" ] = $db_errors;
        $results[ '_status' ] = 'failed';
         if ( $error_json_exit )
         {
            echo (json_encode($results));
            exit();
         }
    } catch ( MongoDB\Exception\UnsupportedException  $e ) {
        $db_errors = "Error updating db " .  $e->getMessage();
        $results[ 'error' ] = $db_errors;
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
        $cmd = new \MongoDB\Driver\Command( $command );
         $results[ "output" ] = $ga_db_mongo->executeCommand( $appname, $cmd );       
//        $results[ "output" ] = $ga_db_mongo->$appname->command( $command, $options );
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
    } catch ( MongoDB\Exception\InvalidArgumentException $e ) {
        $db_errors = "Error removing " .  $e->getMessage();
        $results[ 'error' ] = $db_errors;
        $results[ '_status' ] = 'failed';
         if ( $error_json_exit )
         {
            echo (json_encode($results));
            exit();
         }
    } catch ( MongoDB\Driver\Exception\RuntimeException $e ) {
        $db_errors = "Error removing " .  $e->getMessage();
        $results[ 'error' ] = $db_errors;
        $results[ '_status' ] = 'failed';
         if ( $error_json_exit )
         {
            echo (json_encode($results));
            exit();
         }
    }


    if ( isset( $debug ) ) {
        error_log( json_decode( $results, JSON_PRETTY_PRINT ) . "\n", 3, $ga_db_log_file );
    }
    return $results;
}

function ga_db_find( $coll, $appname = "__application__", $query = [], $projection = [], $options = [],  $error_json_exit = false ) {
    if ( isset( $ga_db_log_file ) ) {
        error_log( date('m/d/Y h:i:s a', time() ) . "\n" . "ga_db_find( $coll, $appname,\n" . "\$query = " . json_encode( $query, JSON_PRETTY_PRINT )  . "\n" . "\$projection = " . json_encode( $projection ) . "\n" . "\$error_json_exit = ".( $error_json_exit ? "true" : "false" ) . ") =\n", 3, $ga_db_log_file );
   }

    global $ga_db_mongo;
    global $ga_db_errors;
    if ( !strlen( $appname ) ) {
        $appname = "__application__";
    }

//  Note 'sort' was a method in the old php 5 mongo. Now it is included in $options. 
//  We can add more keys if necessary. 
    $options_key = [ 'sort', 'skip', 'limit', 'collation' ];
    $options_find = [ 'projection' => $projection ];

    foreach ( $options_key as $v ) {
        if ( isset( $options[ $v ] ) ) {
            array_push( $options_find, [ $v => $options[$v] ] );
        }
    }

    $results = [];
    try {
        $results[ "output" ] = $ga_db_mongo->$appname->$coll->find( $query, $options_find );
        $results[ '_status' ] = 'success';
    } catch ( MongoDB\Exception\UnsupportedException $e ) {
        $db_errors = "Error finding " .  $e->getMessage();
        $results[ "error" ] = $db_errors;
        $results[ '_status' ] = 'failed';
         if ( $error_json_exit )
         {
            echo (json_encode($results));
            exit();
         }
    } catch ( MongoDB\Exception\InvalidArgumentException $e ) {
        $db_errors = "Error finding " .  $e->getMessage();
        $results[ "error" ] = $db_errors;
        $results[ '_status' ] = 'failed';
         if ( $error_json_exit )
         {  
            echo (json_encode($results));
            exit();
         }
    } catch ( MongoDB\Exception\RuntimeException $e ) {
        $db_errors = "Error finding " .  $e->getMessage();
        $results[ "error" ] = $db_errors;
        $results[ '_status' ] = 'failed';
         if ( $error_json_exit )
         {
            echo (json_encode($results));
            exit();
         }
    }

    if ( isset( $debug ) ) {
        error_log( json_encode( $results ) . "\n", 3, $ga_db_log_file );
    }
    return $results;
}

function ga_db_insert( $coll, $appname = "__application__", $insert, $options = [], $error_json_exit = false ) {
//  return inserted Id(s) as $results[ "output" ]

    if ( isset( $ga_db_log_file ) ) {
        error_log( date('m/d/Y h:i:s a', time() ) . "\n" . "ga_db_insert( $coll, $appname,\n" . "\$insert = " . json_encode( $insert, JSON_PRETTY_PRINT )  . "\n" . "\$options = " . json_encode( $options ) . "\n" . "\$error_json_exit = ".( $error_json_exit ? "true" : "false" ) . ") =\n", 3, $ga_db_log_file );
   }

    global $ga_db_mongo;
    global $ga_db_errors;

    if ( !strlen( $appname ) ) {
        $appname = "__application__"; 
    }

    __~mongojournal{$options[ 'j' ] = true;}
    __~mongojournal{$options[ 'WriteConcern' ] = [ "j" => true ];}

    $insertMany_flag = false;
 
    foreach ( $insert as $key => $val ) {
        if ( is_array($val) ) {
            $insertMany_flag = true;            
        }
    }

    $results = []; 
    try {
	if ($insertMany_flag) {
	    $results[ 'output' ] = $ga_db_mongo->$appname->$coll->insertMany( $insert, $options )->getInsertedIds();
            echo ( "called insertMany \n" );
	} else {
            $results[ 'output' ] = $ga_db_mongo->$appname->$coll->insertOne( $insert, $options )->getInsertedId();
            echo ( "called insertOne \n" );
	}	
        $results[ '_status' ] = 'success';
    } catch ( Exception  $e ) {
        $db_errors = "Error inserting " .  $e->getMessage();
        $results[ "error" ] = $db_errors;
        $results[ '_status' ] = 'failed';
         if ( $error_json_exit )
         {
            echo (json_encode($results));
            exit();
         }
    } catch ( MongoDB\Exception\InvalidArgumentException  $e ) {
        $db_errors = "Error inserting " .  $e->getMessage();
        $results[ "error" ] = $db_errors;
        $results[ '_status' ] = 'failed';
         if ( $error_json_exit )
         {
            echo (json_encode($results));
            exit();
         }
    } catch ( MongoDB\Driver\Exception\BulkWriteException  $e ) {
        $db_errors = "Error inserting " .  $e->getMessage();
        $results[ "error" ] = $db_errors;
        $results[ '_status' ] = 'failed';
         if ( $error_json_exit )
         {
            echo (json_encode($results));
            exit();
         }
    } catch ( MongoDB\Driver\Exception\RuntimeException  $e ) {
        $db_errors = "Error inserting " .  $e->getMessage();
        $results[ "error" ] = $db_errors;
        $results[ '_status' ] = 'failed';
         if ( $error_json_exit )
         {
            echo (json_encode($results));
            exit();
         }
    }

    if ( isset( $debug ) ) {
        error_log( json_encode( $results ) . "\n", 3, $ga_db_log_file );
    }

    return $results;
}

function ga_db_update( $coll, $appname = "__application__", $criteria, $update, $options = [], $error_json_exit = false ) { 
// use updateOne()

    if ( isset( $ga_db_log_file ) ) {
        error_log( date('m/d/Y h:i:s a', time() ) . "\n" . "ga_db_updateOne( $coll, $appname,\n" . "\$criteria = " . json_encode( $criteria, JSON_PRETTY_PRINT )  . "\n" ."\$update = " . json_encode( $update, JSON_PRETTY_PRINT )  . "\n" . "\$options = " . json_encode( $options ) . "\n" . "\$error_json_exit = ".( $error_json_exit ? "true" : "false" ) . ") =\n", 3, $ga_db_log_file );
   }

    global $ga_db_mongo;
    global $db_errors;
    if ( !strlen( $appname ) ) {
        $appname = "__application__";
    }

    __~mongojournal{$options[ 'j' ] = true;}
    __~mongojournal{$options[ 'WriteConcern' ] = [ "j" => true ];}

    $results = [];

    try {
        $results[ 'output' ] = $ga_db_mongo->$appname->$coll->updateOne( $criteria, $update, $options);
        $results[ '_status' ] = 'success'; 
    } catch ( MongoDB\Exception\UnsupportedException  $e ) {
        $db_errors = "Error updating db " .  $e->getMessage();
        $results[ 'error' ] = $db_errors;
        $results[ '_status' ] = 'failed';
         if ( $error_json_exit )
         {  
            echo (json_encode($results));
            exit();
         }
    } catch ( MongoDB\Exception\InvalidArgumentException $e ) {
        $db_errors = "Error updating db " .  $e->getMessage();
        $results[ 'error' ] = $db_errors;
        $results[ '_status' ] = 'failed';
         if ( $error_json_exit )
         {
            echo (json_encode($results));
            exit();
         }
    } catch ( MongoDB\Driver\Exception\BulkWriteException $e ) {
        $db_errors = "Error updating db " .  $e->getMessage();
        $results[ 'error' ] = $db_errors;
        $results[ '_status' ] = 'failed';
         if ( $error_json_exit )
         {
            echo (json_encode($results));
            exit();
         }
    } catch ( MongoDB\Driver\Exception\RuntimeException $e ) {
        $db_errors = "Error updating db " .  $e->getMessage();
        $results[ 'error' ] = $db_errors;
        $results[ '_status' ] = 'failed';
         if ( $error_json_exit )
         {
            echo (json_encode($results));
            exit();
         }
    }

    if ( isset( $debug ) ) {
        error_log( json_encode( $results ) . "\n", 3, $ga_db_log_file );
    }

    return $results;
}

function ga_db_remove( $coll, $appname = "__application__", $criteria, $options = [], $error_json_exit = false ) {
// if $options[ "justOne" ] === true use deleteOne(), otherwise deleteMany()

    if ( isset( $ga_db_log_file ) ) {
        error_log( date('m/d/Y h:i:s a', time() ) . "\n" . "ga_db_remove( $coll, $appname,\n" . "\$criteria = " . json_encode( $criteria, JSON_PRETTY_PRINT )  . "\n" . "\$options = " . json_encode( $options ) . "\n" . "\$error_json_exit = ".( $error_json_exit ? "true" : "false" ) . ") =\n", 3, $ga_db_log_file );
   }

    global $ga_db_mongo;
    global $db_errors;
    if ( !strlen( $appname ) ) {
        $appname = "__application__";
    }

    $results = [];

    __~mongojournal{$options[ 'j' ] = true;}
    __~mongojournal{$options[ 'WriteConcern' ] = [ "j" => true ];}

    try {

        if ( isset( $options[ "justOne" ] ) ) {
            if ( $options[ "justOne" ] ) {
                $results[ 'output' ] = $ga_db_mongo->$appname->$coll->deleteOne( $criteria, $options );
                $results[ '_status' ] = 'success';
            } else {
                $results[ 'output' ] = $ga_db_mongo->$appname->$coll->deleteMany( $criteria, $options );
                $results[ '_status' ] = 'success'; 
            }
         } else {
            $results[ 'output' ] = $ga_db_mongo->$appname->$coll->deleteMany( $criteria, $options );
            $results[ '_status' ] = 'success';

         }
    } catch ( MongoDB\Exception\UnsupportedException $e ) {
        $db_errors = "Error removing " .  $e->getMessage();
        $results[ 'error' ] = $db_errors;
        $results[ '_status' ] = 'failed';
         if ( $error_json_exit )
         {  
            echo (json_encode($results));
            exit();
         }
    } catch ( MongoDB\Exception\InvalidArgumentException $e ) {
        $db_errors = "Error removing " .  $e->getMessage();
        $results[ 'error' ] = $db_errors;
        $results[ '_status' ] = 'failed';
         if ( $error_json_exit )
         {
            echo (json_encode($results));
            exit();
         }
    } catch ( MongoDB\Driver\Exception\BulkWriteException $e ) {
        $db_errors = "Error removing " .  $e->getMessage();
        $results[ 'error' ] = $db_errors;
        $results[ '_status' ] = 'failed';
         if ( $error_json_exit )
         {
            echo (json_encode($results));
            exit();
         }
    } catch ( MongoDB\Driver\Exception\RuntimeException $e ) {
        $db_errors = "Error removing " .  $e->getMessage();
        $results[ 'error' ] = $db_errors;
        $results[ '_status' ] = 'failed';
         if ( $error_json_exit )
         {
            echo (json_encode($results));
            exit();
         }
    }

    if ( isset( $debug ) ) {
        error_log( json_encode( $results ) . "\n", 3, $ga_db_log_file );
    }

    return $results;
}

function ga_db_distinct( $coll, $appname = "__application__", $key, $query, $options = [], $error_json_exit = false ) {

    if ( isset( $ga_db_log_file ) ) {
        error_log( date('m/d/Y h:i:s a', time() ) . "\n" . "ga_db_distinct( $coll, $appname,\n" . "\$key = " . json_encode( $key, JSON_PRETTY_PRINT )  . "\n" . "\$query = " . json_encode( $query, JSON_PRETTY_PRINT )  . "\n" ."\$options = " . json_encode( $options ) . "\n" . "\$error_json_exit = ".( $error_json_exit ? "true" : "false" ) . ") =\n", 3, $ga_db_log_file );
   }

    global $ga_db_mongo;
    global $ga_db_errors;
    if ( !strlen( $appname ) ) {
        $appname = "__application__";
    }
    $results = [];
    try {
        $results[ "output" ] = $ga_db_mongo->$appname->$coll->distinct( $key, $query, $options );
        $results[ '_status' ] = 'success';
    } catch ( MongoDB\Exception\UnexpectedValueException $e ) {
        $db_errors = "Error finding the distinct values " .  $e->getMessage();
        $results[ "error" ] = $db_errors;
        $results[ '_status' ] = 'failed';
         if ( $error_json_exit )
         {  
            echo (json_encode($results));
            exit();
         }
    } catch ( MongoDB\Exception\UnsupportedException $e ) {
        $db_errors = "Error finding the distinct values " .  $e->getMessage();
        $results[ "error" ] = $db_errors;
        $results[ '_status' ] = 'failed';
         if ( $error_json_exit )
         {
            echo (json_encode($results));
            exit();
         }
    } catch ( MongoDB\Exception\InvalidArgumentException $e ) {
        $db_errors = "Error finding the distinct values " .  $e->getMessage();
        $results[ "error" ] = $db_errors;
        $results[ '_status' ] = 'failed';
         if ( $error_json_exit )
         {
            echo (json_encode($results));
            exit();
         }
    } catch ( MongoDB\Driver\Exception\RuntimeException $e ) {
        $db_errors = "Error finding the distinct values " .  $e->getMessage();
        $results[ "error" ] = $db_errors;
        $results[ '_status' ] = 'failed';
         if ( $error_json_exit )
         {
            echo (json_encode($results));
            exit();
         }
    }

    if ( isset( $debug ) ) {
        error_log( json_encode( $results ) . "\n", 3, $ga_db_log_file );
    }

    return $results;
}

function ga_db_date( $tstamp='', $error_json_exit = false ) {
// MongoDate class
    global $ga_db_mongo;
    global $db_errors;

    $results = [];
    try {
        if ( !is_bool($tstamp) ) {
            if ( !strlen($tstamp) ) {
                $results[ "output" ]  = new MongoDB\BSON\UTCDateTime();
                $results[ '_status' ] = 'success';
            } else {
                $results[ "output" ]  = new MongoDB\BSON\UTCDateTime($tstamp);
                $results[ '_status' ] = 'success';
            }
        }
    } catch ( Exception $e ) {
        $db_errors = "Error calling db Id " .  $e->getMessage();
        $results[ "error" ] = $db_errors;
        $results[ '_status' ] = 'failed';
         if ( $error_json_exit )
         {
            echo (json_encode($results));
            exit();
         }
    } catch ( MongoDB\Exception\InvalidArgumentException $e ) {
        $db_errors = "Error finding the distinct values " .  $e->getMessage();
        $results[ "error" ] = $db_errors;
        $results[ '_status' ] = 'failed';
         if ( $error_json_exit )
         {
            echo (json_encode($results));
            exit();
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
        $results[ "output" ] = new MongoDB\BSON\ObjectId( $datastring );
        $results[ '_status' ] = 'success';
    } catch ( Exception $e ) {
        $db_errors = "Error calling db Id " .  $e->getMessage();
        $results[ "error" ] = $db_errors;
        $results[ '_status' ] = 'failed';
         if ( $error_json_exit )
         {
            echo (json_encode($results));
            exit();
         }
    }  catch ( MongoDB\Exception\InvalidArgumentException $e ) {
        $db_errors = "Error finding the distinct values " .  $e->getMessage();
        $results[ "error" ] = $db_errors;
        $results[ '_status' ] = 'failed';
         if ( $error_json_exit )
         {
            echo (json_encode($results));
            exit();
         }
    }

    return $results;
}
