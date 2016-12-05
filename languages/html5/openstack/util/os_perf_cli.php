<?php

$notes = 
    "usage: $argv[0] oscmd-file\n" .
    "takes oscmd-file\n" .
    "starts up oscluster\n" .
    "modifies oscmd info for new uuid and new cluster info\n" .
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

    return sprintf('%08s-%04s-%04x-%04x-%012s', $time_low, $time_mid, $time_hi_and_version, $clock_seq_hi_and_reserved, $node);
} // guid

if ( !isset( $argv[ 1 ] ) ) {
    echo $notes;
    exit;
}

$uuid = guid();
echo "guid is $uuid\n";


if ( FALSE === ( $oscmd = file_get_contents( $argv[1] ) ) ) {
    echo "could not read file $argv[1]\n";
    exit;
}

# --- process file ---

preg_match( 
    '/^ssh \S+ "(?:cd \S+; (\S+)) \'({.*})\'" (2> \S+)$/'
    , $oscmd
    , $matches
    );
#print_r( $matches );

$appId        = $matches[ 1 ];
$json_encoded = stripslashes( $matches[ 2 ] );
$outredirect  = $matches[ 3 ];

# echo print_r( $json_encoded, true ) . "\n";

$json = json_decode( $json_encoded );

# echo json_encode( $json, JSON_PRETTY_PRINT ) . "\n";

$json->uuid = $uuid;

$appconfig = "$json->_osroot/../../appconfig.json";

require_once "os_cluster.php";

# -------------------- create virtual cluster, get ip's --------------------

$result = os_cluster_start( $json->_clusternodecount, $uuid );
echo "result is $result\n";
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

sendudptext( "$cmd\n" );

ob_start();
file_put_contents( $json->_log_directory . "/_oscmd_$uuid", $cmd );
ob_end_clean();

$results = `$cmd`;

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

os_delete( $json->_clusternodecount, $uuid );

sendudpmsg( "" );

echo $results;


?>
