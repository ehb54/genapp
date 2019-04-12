<?php

$notes = "usage: $0 control-json
runs os_perf_cli.php as described in the control json
";

require_once "parallel.php";

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

$tagprefix = "";

if ( isset( $control_json->tagprefix ) ) {
    $tagprefix = $control_json->tagprefix . '-';
    echo "tagprefix $tagprefix will be prepended to each tag\n";
}

if ( isset( $control_json->loops ) ) {
    $loops = $control_json->loops;
    echo "$loops loops of these runs will be performed\n";
}

if ( isset( $control_json->loops ) && isset( $control_json->once ) ) {
    echo "error in control_json, both loops and once can not be set\n";
    exit;
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

echo "total runs " . count( $control_json->run ) . "\n";
foreach ( $control_json->run as $v ) {
    if ( !isset( $v->tag ) ) {
        echo "error no tag defined for this run\n";
        exit;
    }
    echo $v->tag . "\n";
}

while( 1 ) {

    $nogoodresults = [];
    $lastresults = [];

    foreach ( $control_json->run as $v ) {
        if ( !isset( $v->tag ) ) {
            echo "error no tag defined for this run\n";
            exit;
        }
        $tag = $tagprefix . $v->tag;
        $nogoodresults[ $tag ] = 1;
    }

    $retries_left = isset( $control_json->retryerror ) ? $control_json->retryerror : 0;

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

    $tags = [];

    $trys = 0;

    do {
        file_put_contents( $cacheemails, "starting processing loop, loops left: " . ( isset( $loops ) ? $loops - 1 : "infinite" ) . ", retries left: $retries_left\n", FILE_APPEND );

        echo "================================================================================\n";
        echo "starting processing loop, loops left: " . ( isset( $loops ) ? $loops - 1 : "infinite" ) . ", retries left: $retries_left\n";
        echo "================================================================================\n";

        prll_init( isset( $control_json->parallel ) ? $control_json->parallel : 1 );

        $cmds = [];
        
        foreach ( $control_json->run as $v ) {
            # modify oscmd json and produce temporary new oscmd file
            echo "----------------------------------------\n";
            echo json_encode( $v, JSON_PRETTY_PRINT ) . "\n";
            if ( !isset( $v->tag ) ) {
                echo "error no tag defined for this run\n";
                exit;
            }
            $tag = $tagprefix . $v->tag;
            if ( !isset( $nogoodresults[ $tag ] ) ) {
                continue;
            }

            if ( isset( $control_json->freshtagbase ) ) {
                $basedir = "$control_json->freshtagbase/$tag";
                if ( !isset( $v->modify ) ) {
                    $v->modify = new stdClass();
                }
                $v->modify->_base_directory  = $basedir;
                if ( !file_exists( $basedir ) ) {
                    if ( !mkdir( $basedir, 0777, true ) ) {
                        echo "error making $basedir\n";
                    }
                }
                `chmod g+w $basedir`;
            }
            $cmd = "";
            if ( isset( $v->prerun ) ) {
                $cmd = "(cd $basedir;$v->prerun)\n";
            }
            $cmd .= "php os_perf_cli3.php $oscmd_file '" . ( isset( $v->modify ) ? json_encode( $v->modify ) : "{}" ) . "' $do_perf\n";
            echo "cmd is $cmd\n";
            $tags[ $tag ] = $v;
            $cmds[ $tag ] = $cmd;

            prll_add( $tag, $cmd );
        }

        prll_run();

        # clean up any ERROR states
        
        echo `php os_delete_error.php`;

        foreach ( $prll[ 'sout' ] as $tag => $results ) {
            $json_results = json_decode( $results );
            $falsefail = 0;
            if ( isset( $control_json->failfirst ) && $trys == 0 &&
                 $control_json->failfirst >  mt_rand() / mt_getrandmax() ) {
                $falsefail = 1;
                echo "Notice: fake failure $tag\n";
            }
                    
            if ( $json_results != NULL && !isset( $json_results->error ) && !$falsefail ) {
                unset( $nogoodresults[ $tag ] );
            }
            $lastresults[ $tag ] = $results;
            if ( isset( $prll[ 'eout' ][ '$tag' ] ) && !empty( $prll[ 'eout' ][ '$tag' ] ) ) {
                file_put_contents( "prll/stderr", 
                                   "------------------------------------------------------------\n"
                                   . "$tag\n"
                                   . "------------------------------------------------------------\n"
                                   . $prll[ 'eout' ][ '$tag' ]
                                   , FILE_APPEND );
            }
        }
        $trys++;

        if ( count( $nogoodresults ) ) {
            echo "Notice: errors still present in " . count( $nogoodresults ) . " of the runs for this loop\n";
        }

    } while ( $retries_left-- > 0 && count( $nogoodresults ) );

    foreach ( $tags as $tag => $v ) {

        $results = $lastresults[ $tag ];
        echo "results are <\n$results\n>\n";
        if ( function_exists( 'post_processing' ) ) {
            if ( isset( $v->modify ) ) {
                foreach( $v->modify as $k => $v ) {
                    $json->$k = $v;
                }
            }
            post_processing( $json, $results, $tag, $cacheemails, $tagprefix );
        }
    }

    if ( isset( $control_json->cacheemails ) ) {
        $cmd = "mail -s \"$control_json->mailhdr\" $control_json->sendcacheemail < $cacheemails";
        echo "$cmd\n";
        echo `$cmd`;
    }

    
    if ( isset( $control_json->once ) ) {
        echo "'once' set, so exiting after one loop\n";
        exit;
    }

    if ( isset( $loops ) && --$loops <= 0 ) {
        echo "remaining loops is $loops, so exiting\n";
        exit;
    }

    print "sleeping ${minutes} minutes\n";
    sleep( 60 * $minutes );
}

