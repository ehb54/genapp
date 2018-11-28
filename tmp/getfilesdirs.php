<?php
    ;

$credfile = "/opt/genapp/docker/tutorial2/results/bin/my_seedme2_conf.txt";
    
$debug = 0;

$process = proc_open(". $credfile && foldershare --host \$host --username \$username --password \$password",
                  [
                   [ "pipe","r" ],
                   [ "pipe","w" ],
                   [ "pipe","w" ]
                  ],
                  $pipes);

if ( !is_resource($process) ) {

    echo "Error, process is not resource\n";
    exit;
}

stream_set_blocking( $pipes[0], false );
stream_set_blocking( $pipes[1], false );
stream_set_blocking( $pipes[2], false );

# setup command stack

$cmds = [
    [ "waitfor" => "foldershare> " ]
    ,[ "runcmd" => "ls -l" ]
    ,[ "waitfor" => "foldershare> " ]
    ];

$towrite   = [];
$waitfor   = [];
$responses = "";
$lastcmd   = "";
$waitone   = 0;
$g_info    = 
    [ 
      "files" => []
      ,"dirs" => []
    ];

function finishup() {
    global $g_info;

    echo json_encode( $g_info, JSON_PRETTY_PRINT ) . "\n";

    exit;
}

function debugecho ( $str, $level = 1 ) {
    global $debug;
    if ( $debug >= $level ) {
        echo $str . "\n";
    }
}
    
function nextcmd() {
    global $cmds;
    global $towrite;
    global $waitfor;
    global $responses;
    global $lastcmd;
    global $waitone;
    global $g_info;
    
    debugecho( json_encode( $cmds, JSON_PRETTY_PRINT ) );
    
    if ( strlen( $lastcmd ) ) {
        if ( $waitone ) {
            $waitone--;
        } else {
            $basedir = preg_replace( '/^(ls -l|stat)\s*/', '', $lastcmd );
            if ( substr( $basedir, 0, 1 ) == "'" &&
                 substr( $basedir, -1, 1 ) == "'" ) {
                $basedir = substr( $basedir, 1 );
                $basedir = substr( $basedir, 0, -1 );
            }
            $basedir .= "/";
            debugecho(  "last command was $lastcmd, responses:--\n" . $responses . "\n--" );
            debugecho( "basedir is '$basedir'" );
            switch( substr( $lastcmd, 0, 4 ) ) {
                case "ls -" : {
                    $files = explode( "\n", $responses );
                    array_shift( $files );
                    array_pop( $files );
                    debugecho( "files:--\n" . implode( "\n", $files ) . "\n--" );
                    # convert to filenames list
                    $files = preg_replace( '/^.*\w{3}\s\d{2}\s\w{4}\s\d\d:\d\d (.*)$/',
                                           $basedir . '$1',
                                           $files );
                    debugecho( "files after replace:--\n" . implode( "\n", $files ) . "\n--" );
                    # push commands
                    foreach ( $files as $value ) {
                        array_push( $cmds, [ "runcmd" => "stat '$value'" ] );
                        array_push( $cmds, [ "waitfor" => "foldershare> " ] );
                    }
                }
                break;

                case "stat" : {
                    # check response FileType:
                    # if Directory, push ls -l of it
                    $basedir = substr( $basedir, 0, -1 );
                    preg_match( '/\s+FileType:\s(\w+)\s/', $responses, $matches );
                    $fileType = $matches[ 1 ];
                    # we could add data to this entry, e.g. timestamp, size etc
                    preg_match( '/\s+Size:\s(\d+)\s/', $responses, $matches );
                    $size = $matches[ 1 ];
                    preg_match( '/Modify:\s(.{23})/', $responses, $matches );
                    $modify = $matches[ 1 ];
                    preg_match( '/Create:\s(.{23})/', $responses, $matches );
                    $create = $matches[ 1 ];
                    $info = [
                        "size" => $size
                        ,"create" => $create
                        ,"modify" => $modify
                        ];
                    
                    debugecho( "for $basedir filetype is $fileType" );
                    switch( $fileType ) {
                        case "Directory" : {
                            array_push( $cmds, [ "runcmd" => "ls -l '$basedir'" ] );
                            array_push( $cmds, [ "waitfor" => "foldershare> " ] );
                            array_push( $g_info[ "dirs" ], [ $basedir => $info ] );
                        }
                        break;

                        case "Regular" : {
                            array_push( $g_info[ "files" ], [ $basedir => $info ] );
                        }
                        break;
                        
                        default : {
                            echo "unsupported fileType $fileType\n";
                            exit( 4 );
                        }
                        break;
                    }
                }
                break;

                default : {
                    echo "unsupported lastcmd '$lastcmd'\n";
                    exit( 3 );
                }
                break;
            }
            $lastcmd = "";
        }
    }

    debugecho( "next cmd" );
    if ( !count( $cmds ) ) {
        return 0;
    }

    $cmd = array_shift( $cmds );
    foreach ( $cmd as $key => $value ) {
        debugecho( "key $key value $value" );
        switch ( $key ) {
            case "waitfor" : {
                array_push( $waitfor, $value );
            }
            break;
            case "runcmd" : {
                $responses = "";
                array_push( $towrite, $value );
                $lastcmd = $value;
                $waitone++;
            }
            break;
            default : {
                debugecho( "Unsupported command type '$key'" );
                exit( 2 );
            }
            break;
        }
    }
    return 1;
}
    

if ( !nextcmd() ) {
    echo "Empty command stack!\n";
    exit;
}

do {
    debugecho( "select loop" );
    
    $read = [ 
        $pipes[ 2 ] 
        ];

    if ( count( $waitfor ) ) {
        array_push( $read, $pipes[ 1 ] );
    }

    if ( count( $towrite ) ) {
        $write = [
            $pipes[ 0 ]
            ];
    } else {
        $write = [];
    }
    $except = [];

    $retval = stream_select( $read, $write, $except, 1 );
    debugecho( "select loop return value : $retval" );
    if ( !$retval ) {
        $status = proc_get_status( $process );
        if ( !$status[ 'running' ] ) {
            echo "Error, process died\n";
            exit;
        }
        continue;
    }

    # there are streams to process
    if ( in_array( $pipes[ 1 ], $read ) ) {
        $responses .= stream_get_contents( $pipes[ 1 ] );
        if ( strpos( $responses, $waitfor[ 0 ] ) ) {
            array_shift( $waitfor );
            if ( !nextcmd() ) {
                finishup();
            }
        }
    }
         
    if ( in_array( $pipes[ 2 ], $read ) ) {
        echo "Error returned by process:" . stream_get_contents( $pipes[ 2 ] );
        exit( 1 );
    }

    if ( in_array( $pipes[ 0 ], $write ) ) {
        fwrite( $pipes[ 0 ], array_shift( $towrite ) . "\n");
        if ( !nextcmd() ) {
            finishup();
        }
    }

} while ( 1 );            

