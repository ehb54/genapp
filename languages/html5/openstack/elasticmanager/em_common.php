<?php

{};

class em_status {
    private $statefile;

    private $statefilehandle;

    private $have_lock;

    public $debug;
    public $state;
    public $errors;

    function __construct( $debug = false, $statefile = "state.json" ) {
        $this->debug     = $debug;
        $this->statefile = $statefile;
        $this->errors    = "";
        ## for now reading initially without lock
        if ( file_exists( $this->statefile ) ) {
            $this->state = json_decode( file_get_contents( $this->statefile ) );
        } else {
            $this->state = (object)[];
            file_put_contents( $this->statefile, json_encode( $this->state ) );
        }
        $this->have_lock = false;
    }

    ## read and lock
    public function read_lock() {
        if ( $this->debug ) {
            echo "em_common: read_lock()\n";
        }

        if ( $this->have_lock ) {
            error_exit( "em_status: read_lock() we already have lock" );
        }

        if ( !($this->statefilehandle = fopen( $this->statefile, "r+" ) ) ) {
            error_exit( "em_status: read_lock() could not open statefile" );
        }

        if ( flock( $this->statefilehandle, LOCK_EX ) ) {
            $contents = fread( $this->statefilehandle, filesize( $this->statefile ) );
            $this->state = json_decode( $contents );
            $this->have_lock = true;
            return true;
        } else {
            error_exit( "em_status: read_lock() could not lock $hist->statefile" );
        }            
    }

    ## read without locking, useful for status
    public function read_no_lock() {
        if ( $this->debug ) {
            echo "em_common: read_no_lock()\n";
        }
        if ( file_exists( $this->statefile ) ) {
            $this->state = json_decode( file_get_contents( $this->statefile ) );
        } else {
            $this->state = (object)[];
        }
    }

    ## release lock - if the code read_lock'd and decided not to write?
    public function release_lock() {
        if ( $this->debug ) {
            echo "em_common: release_lock()\n";
        }

        if ( !$this->have_lock ) {
            error_exit( "em_status: release_lock() we don't have a lock" );
        }

        flock( $this->statefilehandle, LOCK_UN );
        fclose( $this->statefilehandle );
        $this->have_lock = false;
    }
    
    ## save - requries a prior read_lock()

    public function save() {
        if ( $this->debug ) {
            echo "em_common: save()\n";
        }

        if ( !$this->have_lock ) {
            error_exit( "em_status: save() lock was not acquired." );
        }

        ftruncate( $this->statefilehandle, 0 );
        rewind( $this->statefilehandle );
        $contents = json_encode( $this->state );
        
        if ( strlen( $contents ) != fwrite( $this->statefilehandle, $contents ) ) {
            error_exit( "em_status: save() write failed" );
        }
        
        $this->release_lock();
    }

    public function init() {
        if ( $this->debug ) {
            echo "em_common: init()\n";
        }
        $this->read_lock();
        $this->state = (object)[];
        return $this->save();
    }

    public function dump( $msg = false ) {
        return ( $msg ? "$msg:\n" : "" ) . json_encode( $this->state, JSON_PRETTY_PRINT ) . "\n";
    }
}

## utility functions

function mkdir_if_needed( $dir ) {
    if ( is_dir( $dir ) ) {
        return true;
    }
    mkdir( $dir, 0770 );
    chmod( $dir, 0770 );
    return is_dir( $dir );
}

function run_cmd( $cmd, $exit_if_error = true, $array_result = false ) {
    global $run_cmd_last_error_code;

    exec( "$cmd 2>&1", $res, $run_cmd_last_error_code );
    if ( $exit_if_error && $run_cmd_last_error_code ) {
        error_exit( "shell command [$cmd] returned result:<br>" . implode( "<br> ", $res ) . "<br>and with exit status '$run_cmd_last_error_code'" );
    }
    if ( !$array_result ) {
        return implode( "\n", $res ) . "\n";
    }
    return $res;
}

function run_streaming_cmd( $cmd, $cb_on_write, $exit_if_error = true, $array_result = false, $stderr_file = "error-output.txt" ) {
    global $run_cmd_last_error_code;

    $descriptorspec = array(
        0 => array( "pipe", "r" ),
        1 => array( "pipe", "w" ),
        2 => array( "file", $stderr_file, "w" )
        );

    $process = proc_open( $cmd, $descriptorspec, $pipes );

    $res = [];

    if ( is_resource( $process ) ) {

        # close stdin to proc
        fclose( $pipes[0] );

        while ( !feof( $pipes[1] ) ) {
            $line  = fgets( $pipes[1] );
            $res[] = $line;
            $cb_on_write( $line );
        }

        fclose($pipes[1]);

        $run_cmd_last_error_code = proc_close($process);

        if ( $exit_if_error && $run_cmd_last_error_code ) {
            error_exit( "shell command [$cmd] returned result:<br>" . implode( "<br> ", $res ) . "<br>and with exit status '$run_cmd_last_error_code'" );
        }
        if ( !$array_result ) {
            return implode( "\n", $res ) . "\n";
        }
        return $res;
    }

    ## !is_resource

    if ( $exit_if_error ) {
        error_exit( "shell command [$cmd] failed to run" );
    }
    $run_cmd_last_error_code = -1;
    return $array_result ? [] : "";
}

function error_exit( $msg, $cb = null ) {
    if ( is_callable( $cb ) ) {
        $cb();
    }

    if ( !strlen( $msg ) ) {
        $msg = "Empty error message!";
    }
    echo "ERROR, terminating : $msg\n";
    exit;
}
