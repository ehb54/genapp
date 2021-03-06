<?php

$notes = "usage: $0 oscmd_file interval-minutes {performance_executable|-} {post-processing-php} 
runs os_perf_cli.php for the oscmd_file every interval-minutes
upon completion
if performance_executable is set, it will be run before the main job in the virtual cluster
if post-processing-php is set and is not '-', it must include a post_processing( \$json, \$results ) function which be called
";

if ( isset( $argv[ 1 ] ) ) {
    $oscmd_file = $argv[ 1 ];
} else {
    echo $notes;
    exit;
}

if ( isset( $argv[ 2 ] ) ) {
    $minutes = $argv[ 2 ];
} else {
    echo $notes;
    exit;
}

if ( FALSE === ( $oscmd = file_get_contents( $oscmd_file ) ) ) {
    echo "could not read file $oscmd_file\n";
    exit;
}

$do_perf = "";

if ( isset( $argv[ 3 ] ) &&
    $argv[ 3 ] != "-" ) {
    $do_perf = $argv[ 3 ];
}

if ( isset( $argv[ 4 ] ) ) {
    require_once $argv[ 4 ];
    if ( !function_exists( 'post_processing' ) ) {
        echo "no post_processing() function defined in $argv[4]\n";
        exit;
    }
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
if ( $json === FALSE || $json === NULL ) {
    echo "error decoding json from $oscmd_file\n";
    exit;
}

while( 1 ) {
    $results = `php os_perf_cli.php $oscmd_file $do_perf`;
    print "$results\n";
    if ( function_exists( 'post_processing' ) ) {
        post_processing( $json, $results );
    }
    print "sleeping ${minutes} minutes\n";
    sleep( 60 * $minutes );
}

?>
