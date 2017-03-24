<?php

$notes = "usage: $0 control-json
runs os_perf_cli.php as described in the control json
";

if ( isset( $argv[ 1 ] ) ) {
    $control_json_file = $argv[ 1 ];
} else {
    echo $notes;
    exit;
}

if ( FALSE === ( $control_json_contents = file_get_contents( $control_json_file ) ) ) {
    echo "could not read file $control_json_file\n";
    exit;
}

$control_json = json_decode( $control_json_contents );

if ( $control_json == NULL ) {
    echo "could not decode $control_json_file\n";
    exit;
}

if ( !isset( $control_json->oscmd ) ) {
    echo "required field control_json:oscmd not set.\n";
    exit;
}
    
$oscmd_file = $control_json->oscmd;
if ( FALSE === ( $oscmd = file_get_contents( $oscmd_file ) ) ) {
    echo "could not read file $oscmd_file\n";
    exit;
}

if ( !isset( $control_json->repeat ) ) {
    echo "required field control_json:repeat not set.\n";
    exit;
}

$minutes = $control_json->repeat;

echo "repeat every $minutes minutes\n";

$do_perf = "";

if ( isset( $control_json->prerun ) ) {
    $do_perf = $control_json->prerun;
    echo "$do_perf will be run before every job\n";
}

if ( isset( $control_json->postproc ) ) {
    require_once $control_json->postproc;
    if ( !function_exists( 'post_processing' ) ) {
        echo "no post_processing() function defined in $control_json->postproc\n";
        exit;
    }
}
    
if ( !isset( $control_json->run ) ) {
    echo "required field control_json:run not set.\n";
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
if ( $json === FALSE || $json === NULL ) {
    echo "error decoding json from $oscmd_file\n";
    exit;
}

if ( !isset( $json->_base_directory ) ) {
    echo "error: $oscmd_file's json does not have _base_directory defined\n";
    exit;
}

$basedir = $json->_base_directory;

while( 1 ) {

    if ( isset( $control_json->cacheemails ) ) {
        $cacheemails = $control_json->cacheemails;
        `rm -f $cacheemails 2> /dev/null`;
        if ( !isset( $control_json->sendcacheemail ) ) {
            echo "control_json:cacheemails is set but not control_json:sendcacheemail\n";
            exit;
        }
        if ( !isset( $control_json->mailhdr ) ) {
            echo "control_json:cacheemails is set but not control_json:mailhdr\n";
            exit;
        }
    } else {
        $cacheemails = NULL;
    }
    
    foreach ( $control_json->run as $v ) {
        # modify oscmd json and produce temporary new oscmd file
        echo "----------------------------------------\n";
        echo json_encode( $v, JSON_PRETTY_PRINT ) . "\n";
        if ( !isset( $v->tag ) ) {
            echo "error no tag defined for this run\n";
            exit;
        }
        $tag = $v->tag;
        if ( isset( $v->prerun ) ) {
            $cmd = "(cd $basedir;$v->prerun)\n";
        }
        $cmd .= "php os_perf_cli2.php $oscmd_file '" . ( isset( $v->modify ) ? json_encode( $v->modify ) : "{}" ) . "' $do_perf\n";
        echo "cmd is $cmd\n";

        $results = `$cmd`;
        echo "results are <\n$results\n>\n";
        if ( function_exists( 'post_processing' ) ) {
            post_processing( $json, $results, $tag, $cacheemails );
        }
    }        

    if ( isset( $control_json->cacheemails ) ) {
        $cmd = "mail -s \"$control_json->mailhdr\" $control_json->sendcacheemail < $cacheemails";
        echo "$cmd\n";
        echo `$cmd`;
    }

    if ( isset( $control_json->once ) ) {
        exit;
    }
    print "sleeping ${minutes} minutes\n";
    sleep( 60 * $minutes );
}

?>
