#!/usr/local/bin/php
<?php

$_REQUEST = json_decode( $argv[ 1 ], true );

$results = [];

if ( !sizeof( $_REQUEST ) ) {
    $results[ 'error' ] = "PHP code received no \$_REQUEST?";
    echo (json_encode($results));
    exit();
}

if ( !isset( $_REQUEST[ '_uuid' ] ) ) {
    $results[ "error" ] = "No _uuid specified in the request";
    echo (json_encode($results));
    exit();
}

$logon = isset( $_REQUEST[ '_logon' ] ) ? $_REQUEST[ '_logon' ] : "";

if ( !isset( $_REQUEST[ 'module' ] ) ) {
    $results[ "error" ] = "No module specified in the request";
    echo (json_encode($results));
    exit();
}

global $module;
$module = $_REQUEST[ 'module' ];

$mj = "__docroot:html5__/__application__/etc/module_$module.php";

if ( !file_exists( $mj ) ) {
    $results[ "error" ] = "No module json information available for $module in $mj";
    echo (json_encode($results));
    exit();
}
    
require_once $mj;

date_default_timezone_set("UTC");

function db_connect( $error_json_exit = false ) {
   global $use_db;
   global $db_errors;

   if ( !isset( $use_db ) ) {
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

global $parse_info;
global $parse_regex;

function build_parse_info( $error_json_exit = false ) {
    global $parse_info;
    global $parse_regex;
    global $module;
    global $parse_msort;

    $parse_info = [];
    $parse_regex = '/^';
    $parse_msort = [];

    foreach ( $GLOBALS[ 'modulejson' ][ $module ]->fields as $v ) {
        if ( isset( $v->role ) &&
             $v->role == "input" &&
//             $v->type != "hidden" &&
             isset( $v->specifiedproject ) ) {
            $this_info = new stdClass();
            $this_info->tag   = $v->specifiedproject;
            $this_info->label = isset( $v->label ) ? $v->label : $v->specifiedproject;
            $parse_info[] = $this_info;
            $parse_regex .= '(|' . $this_info->tag . '([-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?))';
            $parse_msort[ $this_info->tag ] = SORT_ASC;
        }
    }
    $parse_regex .= '$/';
    __~debug:cache{error_log( "parse regex is $parse_regex\n", 3, "/tmp/mylog" );}
}

function extract_parse_info( $tag ) {
    global $parse_regex;
    global $parse_info;

    preg_match( $parse_regex, $tag, $results );

    __~debug:cache{error_log( "extract parse info $tag is\n" . print_r( $results, true ) . "\n", 3, "/tmp/mylog" );}
    $a_results = [];
    if ( count( $results ) ) {
        array_shift( $results );
        for ( $i = 0; $i < count( $results ); $i += 3 ) {
            $val = $results[ $i+1 ] . ( isset( $results[ $i+2 ] ) ? $results[ $i+2 ] : "" );
            if ( !strlen( $val ) ) {
                $val = "-";
            }
            $a_results[ $parse_info[ $i / 3 ]->tag ] = $val;
        }
    }
    return $a_results;
}

function array_msort($array, $cols)
{
    $colarr = array();
    foreach ($cols as $col => $order) {
        $colarr[$col] = array();
        foreach ($array as $k => $row) { $colarr[$col]['_'.$k] = strtolower($row[$col]); }
    }
    $eval = 'array_multisort(';
    foreach ($cols as $col => $order) {
        $eval .= '$colarr[\''.$col.'\'],'.$order.',';
    }
    $eval = substr($eval,0,-1).');';
    eval($eval);
    $ret = array();
    foreach ($colarr as $col => $arr) {
        foreach ($arr as $k => $v) {
            $k = substr($k,1);
            if (!isset($ret[$k])) $ret[$k] = $array[$k];
            $ret[$k][$col] = $array[$k][$col];
        }
    }
    return $ret;
}

function extract_all_parse_info( $tags, $vs ) {
    global $parse_msort;

    $all_results = [];
    foreach ( $tags as $k => $v ) {
        $tmp_v = extract_parse_info( $v );
        array_push( $tmp_v, array( "vs:" => $vs[ $k ] ) );
        $all_results[] = $tmp_v;
    }

    __~debug:cache{error_log( json_encode( $all_results, JSON_PRETTY_PRINT ) . "\n", 3, "/tmp/mylog" );}
    $all_results_sorted = array_msort( $all_results, $parse_msort );
    __~debug:cache{error_log( json_encode( $all_results_sorted, JSON_PRETTY_PRINT ) . "\n", 3, "/tmp/mylog" );}

    return $all_results_sorted;
}

function get_cached( $error_json_exit = false ) {
   global $use_db;
   global $db_errors;
   global $query;
   global $logon;
   global $parse_info;

   build_parse_info();

   $out = "";
   if ( !db_connect( $error_json_exit ) )
   {
       return false;
   }

   if ( empty( $logon ) ) {
       $query = array(
           "module" => $_REQUEST[ 'module' ]
           ,'_id' =>  array( '$regex' => '/_public$' )
           ) ;
   } else {
       $query = array(
           "module" => $_REQUEST[ 'module' ]
           ,'_id' =>  array( '$regex' => '/('. $logon . '|_public)$' )
           ) ;
   }

   $cached = $use_db->__application__->cache->find( $query );

   $html_out = "<table class='padcell'><tr>";
   foreach ( $parse_info as $v ) {
       $html_out .= "<th>" . $v->label . "</th>";
   }

   $html_out .= "<th>Results</th></tr>"; // "view" column

   $count = 0;

   $tags = [];
   $vs   = [];
   foreach ( $cached as $v ) {
       $tags[] = $v[ 'project' ];
       $vs[]   = $v;
   }

   $all_results_sorted = extract_all_parse_info( $tags, $vs );

   foreach ( $all_results_sorted as $v ) {
       $html_out .= "<tr>";
       // $ahref = "<a href=?_switch=" . urlencode( $v2[ 'vs:' ][ 'menu' ] . '/' . $v2[ 'vs:' ][ 'module' ] . '/' . $v2[ 'vs:' ][ 'project' ] . '/' . $v2[ 'vs:' ][ 'jobid' ] ) . ">";
       foreach ( $v as $k2 => $v2 ) {
           if ( $k2 != "vs:" ) {
               // $html_out .= "<td>$ahref$v2</a></td>";
               $html_out .= "<td>$v2</td>";
           } else {
               $html_out .= "<td><a href=?_switch=" . urlencode( $v2[ 'vs:' ][ 'menu' ] . '/' . $v2[ 'vs:' ][ 'module' ] . '/' . $v2[ 'vs:' ][ 'project' ] . '/' . $v2[ 'vs:' ][ 'jobid' ] ) . ">view</a></td></tr>";
           }
       }
       $count++;
   }

   if ( !$count ) {
       return "No previously stored results available";
   }

   $html_out .= "</table>";

   return $html_out;
}

// store global module json and retrieve 
    global $query;

// $results[ 'cached_request' ] = json_encode( $_REQUEST, JSON_PRETTY_PRINT );
// $results[ 'query' ] = json_encode( $query );
$results[ 'outhtml' ] = get_cached();
// $results[ 'modjson' ] = json_encode( $GLOBALS[ 'modulejson' ][ $module ] );
// $results[ 'modjsonfields' ] = json_encode( $GLOBALS[ 'modulejson' ][ $module ]->fields );
echo json_encode( $results );
?>
