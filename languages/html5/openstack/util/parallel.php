<?php

# using "React" from https://github.com/reactphp/child-process

use React\EventLoop\Factory;
use React\ChildProcess\Process;

require getenv( 'HOME' ) . '/vendor/autoload.php';

function prll_init( $maxsimultaneous = 0 ) {
    global $prll;

    $prll = [];

    $prll[ 'debug' ] = 1;

    if ( isset( $prll[ 'debug' ] ) ) {
        echo "debug: prll_init()\n";
    }

    $prll[ 'loop' ] = Factory::create();
    $prll[ 'table' ] = [];
    $prll[ 'torun' ] = [];
    $prll[ 'sout' ] = [];
    $prll[ 'eout' ] = [];
    $prll[ 'max' ] = $maxsimultaneous;
    $prll[ 'running' ] = 0;
    
    `mkdir prll 2> /dev/null`;
}

function prll_run() {
    global $prll;

    if ( isset( $prll[ 'debug' ] ) ) {
        echo "debug: prll_run()\n";
    }

    $prll[ 'loop' ]->run();

    foreach ( array_keys( $prll[ 'table' ] ) as $key ) {
        if ( file_exists( "prll/$key.stdout" ) ) {
            $prll[ 'sout' ][ $key ] = file_get_contents( "prll/$key.stdout" );
            unlink( "prll/$key.stdout" );
        }
        if ( file_exists( "prll/$key.stderr" ) ) {
            $prll[ 'eout' ][ $key ] = file_get_contents( "prll/$key.stderr" );
            unlink( "prll/$key.stderr" );
        }
    }
}

function prll_run_one( $key ) {
    global $prll;

    if ( isset( $prll[ 'debug' ] ) ) {
        echo "debug: prll_run_one( $key )\n";
    }

    $prll[ 'running' ]++;

    $prll[ 'table' ][ $key ] = new Process( $prll[ 'torun' ][ $key ] );
    $prll[ 'table' ][ $key ]->start( $prll[ 'loop' ] );

    unset( $prll[ 'torun' ][ $key ] );

# can't use ->on since can pass context without hacking React
#    $prll[ 'table' ][ $key ]->stdout->on('data', function ($chunk) {
#        echo "chunk is $chunk\n";
#                                    });

#    $prll[ 'table' ][ $key ]->stderr->on('data', function ($chunk) {
#        echo "chunk is $chunk\n";
#                                    });

    $prll[ 'table' ][ $key ]->on('exit', function ($code) {
        global $prll;

        if ( isset( $prll[ 'debug' ] ) ) {
            echo "debug: exit a process\n";
        }

        $prll[ 'running' ]--;

        $keys = array_keys( $prll[ 'torun' ] );
        if ( count( $keys ) ) {
            prll_run_one( $keys[ 0 ] );
        }
                                 });
}

function prll_add( $key, $cmd ) {
    global $prll;

    if ( isset( $prll[ 'debug' ] ) ) {
        echo "debug: prll_add( $key, $cmd )\n";
    }

    if ( isset( $prll[ 'torun' ][ $key ] ) ) {
        echo "error prll_add( $key ): duplicate key\n";
        exit;
    }

    if ( file_exists( "prll/$key.stdout" ) ) {
        unlink( "prll/$key.stdout" );
    }
    if ( file_exists( "prll/$key.stderr" ) ) {
        unlink( "prll/$key.stderr" );
    }

    $cmd = "( $cmd ) > prll/$key.stdout 2> prll/$key.stderr";

    if ( isset( $prll[ 'debug' ] ) ) {
        echo "debug: prll_add( $key ): modified command: $cmd\n";
    }

    $prll[ 'torun' ][ $key ] = $cmd;
    $prll[ 'sout' ][ $key ] = "";
    $prll[ 'eout' ][ $key ] = "";

    if ( !$prll[ 'max' ] ||
         $prll[ 'running' ] < $prll[ 'max' ] ) {
        prll_run_one( $key );
    }
}

# $testing_example = 1;

if ( isset( $testing_example ) ) {

    prll_init( 3 );

    prll_add( "ls", "ls -l\necho hi\nhi there\n\n" );
    prll_add( "du", "du -h" );
    prll_add( "ls1", "ls -s" );

    prll_run();

    foreach ( array_keys( $prll[ 'table' ] ) as $key ) {
        echo "stdout $key " . $prll[ 'sout' ][ $key ] . "\n";
        echo "stderr $key " . $prll[ 'eout' ][ $key ] . "\n";
    }
}

