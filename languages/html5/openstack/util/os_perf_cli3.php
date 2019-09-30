<?php

$notes = 
    "usage: $argv[0] oscmd-file modify-json {performance_executable|-}\n" .
    "takes oscmd-file\n" .
    "starts up oscluster\n" .
    "modifies oscmd info with modify-json\n" .
    "modifies oscmd info for new uuid and new cluster info\n" .
    "optionally runs performance executable first\n" .
    "runs job\n" .
    "deletes oscluster\n" .
    "extracts results\n" .
    "adds to mongo\n" .
    "";

$noudptext = true;

function sendudpmsg( $s ) {
    fwrite( STDERR,  "msg: $s\n" );
}

function sendudptext( $s) {
    global $noudptext;
    if ( $noudptext ) {
        return;
    }
    fwrite( STDERR, "text: $s\n" );
}

function guid()
{
    $randomString = openssl_random_pseudo_bytes(16);
    $time_low = bin2hex(substr($randomString, 0, 4));
    $time_mid = bin2hex(substr($randomString, 4, 2));
    $time_hi_and_version = bin2hex(substr($randomString, 6, 2));
    $clock_seq_hi_and_reserved = bin2hex(substr($randomString, 8, 2));
    $node = bin2hex(substr($randomString, 10, 6));

    /**
     * Set the four most significant bits (bits 12 through 15) of the
     * time_hi_and_version field to the 4-bit version number from
     * Section 4.1.3.
     * @see http://tools.ietf.org/html/rfc4122#section-4.1.3
    */
    $time_hi_and_version = hexdec($time_hi_and_version);
    $time_hi_and_version = $time_hi_and_version >> 4;
    $time_hi_and_version = $time_hi_and_version | 0x4000;

    /**
     * Set the two most significant bits (bits 6 and 7) of the
     * clock_seq_hi_and_reserved to zero and one, respectively.
     */
    $clock_seq_hi_and_reserved = hexdec($clock_seq_hi_and_reserved);
    $clock_seq_hi_and_reserved = $clock_seq_hi_and_reserved >> 2;
    $clock_seq_hi_and_reserved = $clock_seq_hi_and_reserved | 0x8000;

    return sprintf('%08s-%04s-%04x-%04x-%012s', "OR" . substr( $time_low, -6 ), $time_mid, $time_hi_and_version, $clock_seq_hi_and_reserved, $node);
} // guid

if ( !isset( $argv[ 1 ] ) ) {
    echo $notes;
    exit;
}

if ( !isset( $argv[ 2 ] ) ) {
    echo $notes;
    exit;
}

$modify_json = json_decode( $argv[ 2 ] );

if ( isset( $argv[ 3 ] ) ) {
    $perf_exe = $argv[ 3 ];
    if ( !is_executable( $perf_exe ) ) {
        echo "performance executable $perf_exe is not executable\n";
        exit;
    }
}
        
$uuid = guid();
sendudpmsg( "guid is $uuid" );

if ( FALSE === ( $oscmd = file_get_contents( $argv[1] ) ) ) {
    echo "could not read file $argv[1]\n";
    exit;
}

# --- process file ---

preg_match( 
    '/^.*ssh \S+ "(?:cd \S+; (\S+)) \'({.*})\'" (2> \S+)$/'
    , $oscmd
    , $matches
    );
#print_r( $matches );

$appId        = $matches[ 1 ];
$json_encoded = stripslashes( $matches[ 2 ] );
$outredirect  = $matches[ 3 ];

# echo print_r( $json_encoded, true ) . "\n";

$json = json_decode( $json_encoded );

$appconfig = "$json->_osroot/../../appconfig.json";

require_once "os_cluster.php";

# echo json_encode( $json, JSON_PRETTY_PRINT ) . "\n";

# modify json with optional mods

$json->_uuid = $uuid;
foreach( $modify_json as $k => $v ) {
    sendudptext( "modify json $k => $v" );
    $json->{ $k } = $v;
}

# recompute nodes

if ( !isset( $json->numproc ) || empty( $json->numproc ) ) {
    echo '{"error":"Number of processors not defined."}';
    exit;
}

$GLOBALS['NP'] = $json->numproc;

if ( 
    ( isset( $json->os_ppn ) ||
      isset( $json->os_flavor ) ||
      isset( $json->os_nodes ) ) &&
    !( isset( $json->os_ppn ) &&
       isset( $json->os_flavor ) &&
       isset( $json->os_nodes ) ) ) {
    echo '{"error":"module json error: os_ppn, os_flavor & os_nodes must either be set all together or not at all"}';
    exit;
}

if ( isset( $json->os_flavor ) ) {
    $use_flavor   = str_replace( "_", ".", $json->os_flavor );
    $ppn          = $json->os_ppn;
    $nc           = $json->os_nodes;
} else {
    if ( !isset( $appjson->resources->oscluster->properties->flavor ) ) {
        echo '{"error":"resources:oscluster:properties:flavor not defined in appconfig"}';
        exit;
    }
    $use_flavor = $appjson->resources->oscluster->properties->flavor;

    if ( !isset( $appjson->resources->oscluster->properties->ppn ) ) {
        echo '{"error":"PPNs not defined in appconfig for this flavor."}';
        exit;
    }
    $ppn = $appjson->resources->oscluster->properties->ppn;

    $nc = ceil( $json->numproc / $ppn );
}

if ( !isset( $appjson->resources->oscluster->properties->flavors ) ||
     !isset( $appjson->resources->oscluster->properties->flavors->{ $use_flavor } ) ) {
    echo '{"error":"selected flavor ' . $use_flavor . ' not in appconfig flavors list"}';
    exit;
}

$flavor_ppn = $appjson->resources->oscluster->properties->flavors->{ $use_flavor };

sendudptext( "ppn is $ppn" );
sendudptext( "flavor_ppn is $flavor_ppn" );

if ( !isset( $json->_uuid ) ) {
    echo '{"error":"no _uuid defined in json input."}';
    exit;
}

$uuid = $json->_uuid;

$GLOBALS['NC'] = $nc;
$json->_clusternodecount = $GLOBALS[ "NC" ];
$json->_clusterppn = $ppn;

unset( $json->_udphost );
unset( $json->_udpport );

# -------------------- create virtual cluster, get ip's --------------------

$xsedeproject = isset( $json->_xsedeproject ) ? $json->_xsedeproject : NULL;

$result = os_cluster_start( $json->_clusternodecount, $uuid, $xsedeproject, $use_flavor );
sendudpmsg( "result is $result" );
$result_json = json_decode( $result );
sendudptext( $result );
if ( isset( $result_json->error ) ) {
    echo $result;
    exit;
}
sendudptext( json_encode( $result_json, JSON_PRETTY_PRINT ) );
$json->_clusterips = $result_json->clusterips;
$json->_clusteripsjoined = implode( ",", $result_json->clusterips );
$json->_clusterhostfile = "hostfile-$uuid.txt";
$tmp_slots = " slots=" . $appjson->resources->oscluster->properties->ppn;
$hostfiletext = implode( "$tmp_slots\n", $result_json->clusterips ) . "$tmp_slots\n";
ob_start();
file_put_contents( "$json->_base_directory/$json->_clusterhostfile", $hostfiletext );
ob_end_clean();

sendudptext( "json with clusters:\n" . json_encode( $json, JSON_PRETTY_PRINT ) . "\n" );
sendudptext( "hostfiletext:\n$hostfiletext\n" );

# -------------------- optionally run performance test ------------------------

if ( isset( $perf_exe ) ) {
    sendudpmsg( "Running performance test" );
    $perf_json = $json;
    $perf_json->timeout = 30;
    $perf_cmd =
        "ssh " 
        . $result_json->clusterips[0] 
        . " \"cd " 
        . $json->_base_directory
        . "; $perf_exe '" 
        . str_replace( '"', '\"', json_encode( $json ) ) 
        . "'\""
        . ' 2> '
        . $json->_log_directory
        . "/_os_perf_stderr_$uuid"
        ;

    sendudptext( "$perf_cmd\n" );

    ob_start();
    file_put_contents( $json->_log_directory . "/_os_perf_cmd_$uuid", $perf_cmd );
    ob_end_clean();
    
    $perf_results = `$perf_cmd`;

#    sendudptext( "perf_results - pre replace:\n" . $perf_results );

    if ( empty( $perf_results ) &&
         file_exists( $json->_log_directory . "/_os_perf_stderr_$uuid" ) &&
         filesize( $json->_log_directory . "/_os_perf_stderr_$uuid" ) != 0 
        ) {
        $tmp_perf_results = [];
        $tmp_perf_results[ "error" ] = file_get_contents( $json->_log_directory . "/_os_perf_stderr_$uuid" );
        $perf_results = json_encode( $tmp_perf_results );
    }

    $perf_results = str_replace( "__docrootactual:html5__", "__docroot:html5__/__application__", $perf_results );

    sendudptext( "performance results - post replace:\n" . $perf_results );
}        

# -------------------- run job ------------------------

sendudpmsg( "Running job" );

$cmd = 
    "ssh " 
    . $result_json->clusterips[0] 
    . " \"cd " 
    . $json->_base_directory
    . "; $appId '" 
    . str_replace( '"', '\"', json_encode( $json ) ) 
    . "'\""
    . ' 2> '
    . $json->_log_directory
    . "/_os_stderr_$uuid"
    ;

if ( isset( $json->cmd_timeout ) ) {
   $cmd = "timeout $json->cmd_timeout $cmd";
}

sendudptext( "$cmd\n" );

ob_start();
file_put_contents( $json->_log_directory . "/_oscmd_$uuid", $cmd );
ob_end_clean();

# $results = `$cmd`;
unset( $output );
$retval = 0;
exec( $cmd, $output, $retval );
$results = implode( $output );
if ( $retval == 124 ) { # timed out
   $results = '{"error":"command timed out after ' . $json->cmd_timeout . '"}';
}

#    sendudptext( "results - pre replace:\n" . $results );

if ( empty( $results ) &&
     file_exists( $json->_log_directory . "/_os_stderr_$uuid" ) &&
     filesize( $json->_log_directory . "/_os_stderr_$uuid" ) != 0 
    ) {
    $tmp_results = [];
    $tmp_results[ "error" ] = file_get_contents( $json->_log_directory . "/_os_stderr_$uuid" );
    $results = json_encode( $tmp_results );
}

$results = str_replace( "__docrootactual:html5__", "__docroot:html5__/__application__", $results );

sendudptext( "results - post replace:\n" . $results );

# -------------------- clean up virtual cluster --------------------

$cmd = "";
foreach ( $result_json->clusterips as $ip ) {
    $cmd .= "ssh root@$ip 'sync; sudo umount /opt' &\n";
}
$cmd .= "wait\n";
sendudptext( $cmd );
$syncres = `$cmd 2>&1`;
sendudptext( $syncres );

# -------------------- remove virtual cluster --------------------
sendudpmsg( "Remove virtual cluster" );

os_delete( $json->_clusternodecount, $uuid, $xsedeproject );

sendudpmsg( "" );

echo $results;
