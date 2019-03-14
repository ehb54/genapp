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

if ( !isset( $_REQUEST[ '_logon' ] ) ) {
    $results[ "error" ] = "No _logon specified in the request";
    echo (json_encode($results));
    exit();
}

if ( !isset( $_REQUEST[ 'interval' ] ) ) {
    $results[ "error" ] = "Insufficient request data";
    echo (json_encode($results));
    exit();
}

$appconfig = json_decode( file_get_contents( "__appconfig__" ) );

if ( !isset( $appconfig->messaging->zmqhostip ) ||
     !isset( $appconfig->messaging->zmqport )   || 
     !isset( $appconfig->restricted )           ||
     !isset( $appconfig->restricted->admin )           
     ) {
    $results[ "error" ] = "appconfig.json missing zmq or admin info";
    echo (json_encode($results));
    exit();
}    

if ( !in_array( $_REQUEST[ '_logon' ], $appconfig->restricted->admin ) ) {
    $results[ "error" ] = "not an administrator";
    echo (json_encode($results));
    exit();
}    

require_once "__docroot:html5__/__application__/ajax/ga_db_lib.php";

$context = new ZMQContext();
$zmq_socket = $context->getSocket(ZMQ::SOCKET_PUSH, '__application__ udp pusher');
$zmq_socket->connect("tcp://" . $appconfig->messaging->zmqhostip . ":" . $appconfig->messaging->zmqport );

function ProcStats( $sys ) {
    global $appconfig;

    $result = array();

    $cmd = $appconfig->resources->{ $sys };
    $ucmd = "head -1 /proc/stat; cat /proc/meminfo; echo cut_here; cat /proc/net/dev";

    if ( strlen( $cmd ) ) {
        $cmd .= " \"$ucmd\"";
    } else {
        $cmd = $ucmd;
    }
    exec( $cmd, $res );

    $a = explode( ' ', array_shift( $res ) );
    if ( is_array( $a ) && count( $a ) > 1 ) {
        array_shift( $a );
        while( count( $a ) > 1 && !$a[ 0 ] ) {
            array_shift( $a );
        }
    }
    $result[ "cpu" ] = $a;

    $res2 = [];
    $restmp = [];
    foreach ( $res as $v ) {
        if ( $v == "cut_here" ) {
            $res2[] = $restmp;
            $restmp = [];
        } else {
            $restmp[] = $v;
        }
    }
    if ( count( $restmp ) ) {
        $res2[] = $restmp;
    }

    // compute mem info
    $tmpmem = array();
    $meminterest = preg_grep( "/^(Mem|Swap)(Free|Total):/", $res2[0] );
    foreach ( $meminterest as $v ) {
        preg_match( "/^(\S+):\s+(\d+)\s+/", $v, $matches );
        if ( count( $matches ) == 3 ) {
            $tmpmem[ $matches[ 1 ] ] = $matches[ 2 ];
        }
    }

    // compute useful bits
    $result[ "mem" ] = array();
    $result[ "mem" ][ "memused" ] = 
        ( 
          isset( $tmpmem[ "MemTotal" ] ) &&
          isset( $tmpmem[ "MemFree" ] ) && 
          $tmpmem[ "MemTotal" ] > 0 
        ) 
        ?
        round( 100.0 * ( $tmpmem[ "MemTotal" ] - $tmpmem[ "MemFree" ] ) / $tmpmem[ "MemTotal" ], 1 )
        :
        100.0
        ;
          
    $result[ "mem" ][ "swapused" ] = 
        ( 
          isset( $tmpmem[ "SwapTotal" ] ) &&
          isset( $tmpmem[ "SwapFree" ] ) && 
          $tmpmem[ "SwapTotal" ] > 0 
        ) 
        ?
        round( 100.0 * ( $tmpmem[ "SwapTotal" ] - $tmpmem[ "SwapFree" ] ) / $tmpmem[ "SwapTotal" ], 1 )
        :
        0.0
        ;
        
    // network

    $net = array_slice( $res2[ 1 ], 2 );    

    $result[ "net" ] = array();

    foreach ( $net as $v ) {
        $thisnet = preg_split( "/\s+/",  strtr( $v, ":", " " ) );
        $if = $thisnet[ 1 ];
        // for sep tx,rx $result[ "net" ][ $if ] = array( $thisnet[ 2 ], $thisnet[ 10 ] );
        $totuse = $thisnet[ 2 ] + $thisnet[ 10 ];
        // skip lo for now
        if ( $totuse > 0 && $if != "lo" ) {
            $result[ "net" ][ $if ] = $totuse;
        }
    }        

    return $result;
}

function UpdateStats( $sys, $init = false ) {
    global $load;
    $load[ $sys ][ "prev" ] = $load[ $sys ][ "this" ];
    $load[ $sys ][ "this" ][ "stats"   ] = ProcStats( $sys );
    $load[ $sys ][ "this" ][ "sum"     ] = array_sum( $load[ $sys ][ "this" ][ "stats" ][ "cpu" ] );
    $load[ $sys ][ "this" ][ "sum012"  ] = array_sum( array_slice( $load[ $sys ][ "this" ][ "stats" ][ "cpu" ], 0, 3  ) );

    if ( !$init ) {
        $total = $load[ $sys ][ "this" ][ "sum" ] - $load[ $sys ][ "prev" ][ "sum" ];

        $load[ $sys ][ "this" ][ "load" ] = round( 100 * 
                                                      ( $load[ $sys ][ "this" ][ "sum012" ] -
                                                        $load[ $sys ][ "prev" ][ "sum012" ] ) 
                                                      / $total, 2 );

        $load[ $sys ][ "this" ][ "iowait"  ] = round( 100 * 
                                                      ( $load[ $sys ][ "this" ][ "stats" ][ "cpu" ][ 4 ] -
                                                        $load[ $sys ][ "prev" ][ "stats" ][ "cpu" ][ 4 ] )
                                                      / $total, 2 );

        foreach ( $load[ $sys ][ "this" ][ "stats" ][ "net" ] as $k => $v ) {
            $load[ $sys ][ "this" ][ "net" ][ $k ] = ( $v - $load[ $sys ][ "prev" ][ "stats" ][ "net" ][ $k ] ) * 1e-6;
        }
    }

    $load[ $sys ][ "this" ][ "memused" ] = $load[ $sys ][ "this" ][ "stats" ][ "mem" ][ "memused" ];
    $load[ $sys ][ "this" ][ "swapused" ] = $load[ $sys ][ "this" ][ "stats" ][ "mem" ][ "swapused" ];

//    echo "prev: " . print_r( $load[ $sys ][ "prev" ], true ) . "\n";
//    echo "this: " . print_r( $load[ $sys ][ "this" ], true ) . "\n";
    
}

$allresources = array_keys( (array) $appconfig->resources );

$plotdata = 
    array(
        "jobhistory" => 
        array( "options" => 
               array( 
                   "xtics" => array()
               )
               ,"data" => 
               array(
                   array( 
                       "lines" => array( "show" => "true", "fill" => "true", "zero" => "true" )
                       ,"data"  => array()
                   )
               )
        )
        ,"load" => 
        array( "options" => 
               array( 
                   "xtics" => array()
                   ,"ymax" => 100
                   ,"legend" => 
                   array( 
                       "container" => "true"
                       ,"backgroundOpacity" => 0.95
                   )
               )
               ,"data" => array()
        )
        ,"iowait" => 
        array( "options" => 
               array( 
                   "xtics" => array()
                   ,"ymax" => 100
                   ,"legend" => 
                   array( 
                       "container" => "true"
                       ,"backgroundOpacity" => 0.95
                   )
               )
               ,"data" => array()
        )
        ,"memused" => 
        array( "options" => 
               array( 
                   "xtics" => array()
                   ,"ymax" => 100
                   ,"legend" => 
                   array( 
                       "container" => "true"
                       ,"backgroundOpacity" => 0.95
                   )
               )
               ,"data" => array()
        )
        ,"swapused" => 
        array( "options" => 
               array( 
                   "xtics" => array()
                   ,"ymax" => 100
                   ,"legend" => 
                   array( 
                       "container" => "true"
                       ,"backgroundOpacity" => 0.95
                   )
               )
               ,"data" => array()
        )
        ,"net" => 
        array( "options" => 
               array( 
                   "xtics" => array()
                   ,"legend" => 
                   array( 
                       "container" => "true"
                       ,"noColumns" => 3
                       ,"backgroundOpacity" => 0.95
                   )
               )
               ,"data" => array()
        )
    );


// init load data
foreach ( $allresources as $v ) {
    foreach ( array( "load", "iowait", "memused", "swapused" ) as $v2 ) {
        $plotdata[ $v2 ][ "data" ][] =
            array( 
                "lines" => array( "show" => "true", "fill" => "true", "zero" => "true" )
                ,"label" => $v
                ,"data"  => array()
            );
    }
}

// need special init for "net" as each has its own set of if

function get_procstats( $init = false ) {
    global $load;
    global $allresources;
    global $plotdata;

    if ( $init ) {
        $load = [];
        foreach ( $allresources as $v ) {
            $load[ $v ] = array( "this" => array() );
        }
    }

    foreach ( $allresources as $v ) {
        UpdateStats( $v, $init );
    }


    if ( $init ) {
        foreach ( $allresources as $v ) {
            foreach ( $load[ $v ][ "this" ][ "stats" ][ "net" ] as $k2 => $v2 ) {
                $plotdata[ "net" ][ "data" ][] =
                    array( 
                        "lines" => array( "show" => "true", "fill" => "true", "zero" => "true" )
                        ,"label" => "$v-$k2"
                        ,"data"  => array()
                        ,"sys"   => $v
                        ,"if"    => $k2
                    );
            }
        }
    }

    // __~debug:jobmonitor{error_log( "get_procstats load[]:\n" . print_r( $load, true ) , 3, "/tmp/mylog" );}
    // __~debug:jobmonitor{error_log( "get_procstats plotdata[]:\n" . print_r( $plotdata, true ) , 3, "/tmp/mylog" );}
}    

// get_runinfo populates runinfo array with job info
// to get more data => add it to the runinfo

function get_runinfo( $error_json_exit = false ) {
   global $appconfig;
   global $runinfo;
   global $nowsecs;
   global $startsecs;
   global $plotdata;
   global $load;
   global $allresources;
   global $interval;

   $runinfo = [];

   if ( !ga_db_status( ga_db_open( $error_json_exit ) ) )
   {
       return false;
   }

   $runs = ga_db_output( ga_db_find( 'running', '' ) );

   $nowsecs = microtime( true );

   get_procstats();

   foreach ( $runs as $v ) {
       $uuid = $v['_id'];
       $job = ga_db_output( ga_db_findOne( 'jobs', '', [ "_id" => $uuid ] ) );
       $pids = $v['pid'];

       $resources = [];

       foreach ( $pids as $k2 => $v2 ) {
           $resources[ $v2['where'] ] = true;
           // later get pid info
           // echo "   where: " . $v2['where'] . " pid: " . $v2['pid'] . " what: " . $v2['what'] . "\n";
           // $cmd = $appconfig->resources->{ $v2['where'] } . " ps --ppid " . $v2['pid'];
           // echo " cmd $cmd\n";
       }

       
       if ( isset( $job["start"] ) ) {
           $duration = floatval( $nowsecs - $job["start"]->sec );
           $duration_s = sprintf( $duration > 1 * 60 ? "%.0f" : "%.1f", $duration - 60 * intval( $duration / 60 ) );
           $duration_m = intval( $duration / 60 ) % 60;
           $duration_h = intval( $duration /(60 * 60 ) ) % 24;
           $duration_d = intval( $duration /(24 * 60 * 60 ) );
           
           $duration = "start";

           $duration = ( $duration_d > 0 ? $duration_d . "d" : "" ) .
               ( $duration_h > 0 ? $duration_h . "h" : "" ) .
               ( $duration_m > 0 ? $duration_m . "m" : "" ) .
               ( $duration_s > 0 ? $duration_s . "s" : "" );
       } else {
           $duration = "active";
       }


       $runinfo[] = 
           array( 
               "module"    => $job[ 'module' ]
               ,"user"      => $job[ 'user' ]
#               "pids"      => $v  [ 'pid' ]
               ,"started"   => isset( $job[ "start" ] ) ? date( "Y M d H:i:s T", $job["start"]->sec ) : "Unknown"
               ,"duration"  => $duration
               ,"resources" => implode( ",", array_keys( $resources ) )
               ,"id"        => $uuid
           );
   }
   $thissecs = round( $nowsecs - $startsecs, 3 );

   $plotdata[ "jobhistory" ][ "data" ][0][ "data" ][] = array( $thissecs, count( $runinfo ) );
   $plotdata[ "jobhistory" ][ "data" ][0][ "data" ] = 
       array_slice(
           $plotdata[ "jobhistory" ][ "data" ][0][ "data" ],
           -$GLOBALS[ 'maxplottimes' ] );

   foreach ( $plotdata[ "load" ][ "data" ] as $k => $v ) {
       // __~debug:jobmonitor{error_log( "load key\n" . $plotdata[ "load" ][ "data" ][ $k ][ "label" ] . "\n", 3, "/tmp/mylog" );}
       // __~debug:jobmonitor{error_log( "load value\n" . $load[ $plotdata[ "load" ][ "data" ][ $k ][ "label" ]][ "this" ][ "load" ] . "\n", 3, "/tmp/mylog" );}
       
       $sys = $plotdata[ "load" ][ "data" ][ $k ][ "label" ];
       foreach ( array( "load", "iowait", "memused", "swapused" ) as $v2 ) {
           $plotdata[ $v2 ][ "data" ][ $k ][ "data" ][] = 
               array( $thissecs, $load[ $sys ][ "this" ][ $v2 ] );
           $plotdata[ $v2 ][ "data" ][ $k ][ "data" ] = 
               array_slice(
                   $plotdata[ $v2 ][ "data" ][ $k ][ "data" ],
                   -$GLOBALS[ 'maxplottimes' ] );

       }
       // __~debug:jobmonitor{error_log( "load data k $k\n" . print_r( $plotdata[ "load" ][ "data" ][ $k ][ "data" ], true )  . "\n", 3, "/tmp/mylog" );}

   }

   foreach ( $plotdata[ "net" ][ "data" ] as $k => $v ) {
       $sys = $plotdata[ "net" ][ "data" ][ $k ][ "sys" ];
       $if  = $plotdata[ "net" ][ "data" ][ $k ][ "if" ];

       $plotdata[ "net" ][ "data" ][ $k ][ "data" ][] = 
           array( $thissecs, $load[ $sys ][ "this" ][ "net" ][ $if ] / $interval );
       $plotdata[ "net" ][ "data" ][ $k ][ "data" ] = 
           array_slice(
               $plotdata[ "net" ][ "data" ][ $k ][ "data" ],
               -$GLOBALS[ 'maxplottimes' ] );
   }

   $ymaxa = [];
   $xticsfull = [];
   foreach ( $plotdata[ "jobhistory" ][ "data" ][0][ "data" ] as $k => $v ) {
       $ymaxa[] = $v[ 1 ];
       $xticsfull[] = array( $v[ 0 ], date( "H:i:s", $v[ 0 ] + $startsecs ) );
   }

   // __~debug:jobmonitor{error_log( "xticsfull[]:\n" . print_r( $xticsfull, true ) , 3, "/tmp/mylog" );}

//   $xtics = [];
   $xticsc = count( $xticsfull );
   if ( $xticsc > $GLOBALS[ 'maxxticsvis' ] ) {
       $addtics = 0;
       if ( $xticsc > $GLOBALS[ 'xminplottime' ] ) {
           $addtics = ( $xticsc - $GLOBALS[ 'xminplottime' ] ) * $GLOBALS[ 'maxxticsvis' ] / $GLOBALS[ 'xminplottime' ];
       }
       $each = round( $xticsc / ( $addtics + $GLOBALS[ 'maxxticsvis' ] ) );
       for ( $i = 0; $i < $xticsc; ++$i ) {
           if ( $i % $each ) {
               $xticsfull[ $i ][ 1 ] = "";
           }
       }
   }
   
//   __~debug:jobmonitor{error_log( "xtics[]:\n" . print_r( $xtics, true ) , 3, "/tmp/mylog" );}

 //   __~debug:jobmonitor{error_log( "xticsfull[] after trim:\n" . print_r( $xticsfull, true ) , 3, "/tmp/mylog" );}

   $plotdata[ "jobhistory" ][ "options" ][ "ymax" ] = max( $ymaxa ) + 1;

   $useminplottime = 0;
   if ( $xticsc > $GLOBALS[ 'xminplottime' ] ) {
       $useminplottime = $plotdata[ "jobhistory" ][ "data" ][0][ "data" ][ $xticsc - $GLOBALS[ 'xminplottime' ] ][ 0 ];
   }

   foreach ( $plotdata as $k => $v ) {
       $plotdata[ $k ][ "options" ][ "xtics" ] = $xticsfull;
       $plotdata[ $k ][ "options" ][ "xmin"  ] = $useminplottime;
   }

   return true;
}

function get_html_runinfo( $error_json_exit = false ) {
    global $runinfo;
    global $html_runinfo;

    $html_runinfo = "No jobs running";
    
    if ( !get_runinfo( $error_json_exit ) ) {
        return false;
    }

    if ( !count( $runinfo ) ) {
        return true;
    }
    
    $html_runinfo = "<table class='padcell'><tr><th>" . implode( "</th><th>", array_keys( $runinfo[ 0 ] ) ) . "</th></tr>";

    foreach ( $runinfo as $k => $v ) {
        $html_runinfo .= "<tr><td>" . implode( "</td><td>",  $v ) . "</td></tr>";
    }        

    $html_runinfo .= "</table>";
}

$results = [];
$results[ '_uuid' ] = $_REQUEST[ '_uuid' ];
$startsecs = microtime( true );

$GLOBALS[ 'maxplottimes' ] = 240;
$GLOBALS[ 'xminplottime' ] = intval( $GLOBALS[ 'maxplottimes' ] / 3 );
$GLOBALS[ 'maxxticsvis' ] = 4;

get_procstats( true );
sleep( 1 );

// run until cancelled

$interval = $_REQUEST[ 'interval' ];

// for ( $i = 0; $i < 3; ++$i ) {
do {
    $nowsecs = microtime( true );
    get_html_runinfo( true );

    $results[ "monitordata" ] = "<p>Last refreshed " . date( "Y M d H:i:s T", $nowsecs ) . "</p>" .  $html_runinfo;

    foreach ( $plotdata as $k => $v ) {
        $results[ $k ] = $v;
    }
    // __~debug:jobmonitor{error_log( print_r( $results, true ) , 3, "/tmp/mylog" );}
    // __~debug:jobmonitor{error_log( json_encode( $results ) . "\n", 3, "/tmp/mylog" );}
    $zmq_socket->send( json_encode( $results ) );
    sleep( $interval );
} while(1);


echo '{"_none":"1"}';

