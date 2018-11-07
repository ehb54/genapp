<?php

date_default_timezone_set("UTC");

$appconfig = json_decode( file_get_contents( "__appconfig__" ), true );

function db_connect( $error_json_exit = false )
{
   global $use_db;
   global $db_errors;

   if ( !isset( $use_db ) )
   {
      try {
         $use_db = new MongoClient(
             __~mongo:url{"__mongo:url__"}
             __~mongo:cafile{,[], [ "context" => stream_context_create([ "ssl" => [ "cafile" => "__mongo:cafile__" ] ] ) ]}
         );
      } catch ( Exception $e ) {
         $db_errors = "Could not connect to the db " . $e->getMessage();
         if ( $error_json_exit )
         {
            $results = array( "error" => $db_errors );
            $results[ '_status' ] = 'complete';
            echo (json_encode($results));
            exit();
         }
         return false;
      }
   }

   return true;
}


function listrunning( $error_json_exit = false )
{
   global $use_db;
   global $db_errors;
   global $appconfig;

   if ( !db_connect( $error_json_exit ) )
   {
       return false;
   }

   $runs = $use_db->__application__->running->find();

   foreach ( $runs as $v ) {
       $uuid = $v['_id'];
       $job = $use_db->__application__->jobs->findOne( array( "_id" => $uuid ) );
       $pids = $v['pid'];
       echo "id:" . $job['_id'] . " module: " . $job['module'] . " user: " . $job['user'] . " started: " . date( "Y M d H:i:s T",$job["start"]->sec ) . "\n";
       foreach ( $pids as $k2 => $v2 ) {
           echo "   where: " . $v2['where'] . " pid: " . $v2['pid'] . " what: " . $v2['what'] . "\n";

           $cmd = $appconfig[ 'resources' ][ $v2['where'] ] . " ps --ppid " . $v2['pid'];
           echo " cmd $cmd\n";
       }
   }
}

listrunning();

?>



