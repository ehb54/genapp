<?php

{};

require_once "em_common.php";

## class for managing openstack instance pool

class em_openstack {

    public $debug;
    public $errors;

    private $statefile;
    private $em_state;

    private $configfile;
    private $em_config;
    
    private $appconfig;
    private $appconfig_loaded = false;
    
    private $secrets;
    private $secrets_loaded = false;
    private $cli_secrets;

    private $id;
    private $project;
    private $image;
    private $flavor;
    private $idprefix = "genapp_elastic";

    private $projects;

    private $global_putenv_done = false;
    
    function __construct( $debug = false, $configfile = "em_config.json" ) {
        $this->debug       = $debug;
        $this->configfile  = $configfile;
        $this->read_config();
        if ( !isset( $this->em_config->files ) ) {
            error_exit( "$this->configfile does not define 'files'" );
        }
        if ( !isset( $this->em_config->files->state ) ) {
            error_exit( "$this->configfile does not define 'files'->'state'" );
        }

        $this->statefile   = $this->em_config->files->state;
        $this->errors      = "";
        $this->em_state       = new em_state( $this->debug, $this->statefile );
    }

    ## read_config() - read the config file
    function read_config() {
        $this->debug_echo( "em_openstack: read_config()" );

        if ( !file_exists( $this->configfile ) ) {
            error_exit( "File $this->configfile does not exist\n" );
        }

        try {
            $this->em_config = json_decode( file_get_contents( $this->configfile ) );
        } catch ( Exception $e ) {
            error_exit( "Error decoding $this->configfile : " . $e->getMessage() );
        }

        if ( !isset( $this->em_config->flavors ) ) {
            error_exit( "$this->configfile does not define 'flavors'" );
        }

        foreach ( $this->em_config->flavors as $flavor => $v ) {
            $this->flavor = $flavor;
            if ( !isset( $v->idle ) ) {
                error_exit( "$this->configfile does not define flavors:$flavor:idle" );
            }
            if ( !isset( $v->maximum ) ) {
                error_exit( "$this->configfile does not define flavors:$flavor:maximum" );
            }
        }

        if ( !isset( $this->em_config->project ) ) {
            error_exit( "$this->configfile does not define project" );
        }

        $this->project = $this->em_config->project;

        if ( !isset( $this->em_config->id ) ) {
            error_exit( "$this->configfile does not define id" );
        }

        $this->id = $this->em_config->id;

        if ( $this->debug ) {
            debug_json( "em_openstack:read_config() em_config:", $this->em_config );
        }
    }
            
    # load_secrets() - always loads
    function load_secrets() {
        $this->debug_echo( "em_openstack: load_secrets()" );
        if ( !isset( $this->em_config->files->secrets ) ) {
            error_exit( "$this->configfile does not define 'files'->'secrets'" );
        }
        
        try {
            $this->secrets = json_decode( file_get_contents( $this->em_config->files->secrets ) );
        } catch ( Exception $e ) {
            error_exit( "Error decoding $this->em_config->files->secrets " . $e->getMessage() );
        }

        if ( !isset( $this->secrets->openstack ) ) {
            error_exit( "$this->em_config->files->secrets does not define 'openstack'" );
        }

        if ( !isset( $this->secrets->openstack->projects ) ) {
            error_exit( "$this->em_config->files->secrets does not define 'openstack'->'projects'" );
        }

        $this->projects = $this->secrets->openstack->projects;

        ## restrict to a single defined project, run separate managers, separate config for each project

        if ( !isset( $this->projects->{ $this->project } ) ) {
            error_exit( "main project $this->project is not defined in $this->em_config->files->secrets" );
        }

        $this->secrets_loaded = true;
    }            
        
    # load_appconfig() - loads and reloads
    function load_appconfig() {
        $this->debug_echo( "em_openstack: load_appconfig()" );
        if ( !isset( $this->em_config->files->appconfig ) ) {
            error_exit( "$this->configfile does not define 'files'->'appconfig'" );
        }
        
        try {
            $this->appconfig = json_decode( file_get_contents( $this->em_config->files->appconfig ) );
        } catch ( Exception $e ) {
            error_exit( "Error decoding $this->em_config->files->appconfig " . $e->getMessage() );
        }

        if ( !isset( $this->appconfig->resources ) ) {
            error_exit( "error: resources not defined in $this->em_config->files->appconfig" );
        }

        if ( !isset( $this->appconfig->resources->oscluster ) ) {
            error_exit( "error: resources:oscluster not defined in $this->em_config->files->appconfig" );
        }
        
        if ( !isset( $this->appconfig->resources->oscluster->properties ) ) {
            error_exit( "error: resources:oscluster:properties not defined in $this->em_config->files->appconfig" );
        }

        if ( !isset( $this->appconfig->resources->oscluster->properties->baseimage ) ) {
            error_exit( "error: resources:oscluster:properties:baseimage not defined in $this->em_config->files->appconfig" );
        }
        $this->image = $this->appconfig->resources->oscluster->properties->baseimage;

        $this->appconfig_loaded = true;
    }            

    # projects
    function projects() {
        $this->debug_echo( "em_openstack: projects()" );
        if ( !$this->secrets_loaded ) {
            $this->load_secrets();
        }

        return [ $this->project ]; # array_keys( (array) $this->projects );
    }

    ## debug_echo() - only echo if debug set
    function debug_echo( $msg ) {
        if ( $this->debug ) {
            echo "$msg\n";
        }
    }

    ## echo_warn() - print warning, perhaps to stderr later
    function echo_warn( $msg ) {
        echo "WARNING: $msg\n";
    }

    ## shelve() - shelve, offload instance
    function shelve( $number ) {
        global $run_cmd_last_error_code;

        $this->debug_echo( "em_openstack: shelve( $number )" );

        ## might have gone in_use
        $this->em_state->read_lock();
        if ( !isset( $this->em_state->state->$number ) ) {
            error_exit( "em_openstack: shelve() $number is missing from em_state" );
        }
        if ( $this->em_state->state->$number->use_status != "idle" ) {
            ## was acquired!
            $this->em_state->release_lock();
            return false;
        }
        $this->em_state->state->$number->status = "SHELVING";
        $this->em_state->save();
        
        $this->project_putenv( $this->project );
        $cmd = "openstack server shelve --offload --wait " . $this->em_state->state->$number->id . " 2>&1";
        $this->debug_echo( $cmd );

        $res = run_cmd( $cmd, false );

        if ( $run_cmd_last_error_code != 0 ) {
            $this->echo_warn( "$cmd failed with code $run_cmd_last_error_code, results:\n$res" );
            return false;
        }
        return true;
    }

    ## unshelve() - shelve, offload instance
    function unshelve( $number ) {
        global $run_cmd_last_error_code;
        $this->debug_echo( "em_openstack: unshelve( $number )" );

        if ( !isset( $this->em_state->state->$number ) ) {
            error_exit( "em_openstack: unshelve() $number is missing from em_state" );
        }

        $this->project_putenv( $this->project );
        $cmd = "openstack server unshelve --wait " . $this->em_state->state->$number->id . " 2>&1";
        $this->debug_echo( $cmd );
        $res = run_cmd( $cmd, false );

        if ( $run_cmd_last_error_code != 0 ) {
            error_exit( "$cmd failed with code $run_cmd_last_error_code, results:\n$res" );

            $this->echo_warn( "$cmd failed with code $run_cmd_last_error_code, results:\n$res" );
            return false;
        }
        return true;
    }
    
        
    ## reload state() - reload from openstack api call
    function reload_state() {
        $this->debug_echo( "em_openstack: reload_state()" );
        
        ## make openstack call, get current instances, then lock & update state

        $current = (object)[];

        foreach ( $this->projects() as $project ) {        
            $this->project_putenv( $project );
            $cmd = "openstack server list -c ID -c Name -c Status -c Networks";
            $regexp = "/\| $project-run-$this->idprefix-$this->id-$this->flavor-/";
            $results_all = run_cmd( $cmd, true, true );
            $results = preg_grep( $regexp, $results_all );
            $this->debug_echo( "cmd : $cmd\n" . implode( "\n", $results ) );

            foreach ( $results as $v ) {
                $l = explode( "|", $v );
                if ( count( $l ) < 5 ) {
                    error_exit( "unexpected results : $v" );
                }
                $id       = trim( $l[ 1 ] );
                $name     = trim( $l[ 2 ] );
                $status   = trim( $l[ 3 ] );
                $networks = trim( $l[ 4 ] );

                preg_match( '/\d+$/', $name, $numbers );
                $number   = $numbers[ 0 ];

                $nets = preg_split( '/genapp_net=/', $networks );
                
                $network = $nets[ 1 ];

                $current->$number = (object)[];
                $current->$number->id      = $id;
                $current->$number->name    = $name;
                $current->$number->status  = $status;
                $current->$number->network = $network;
            }
        }

        debug_json( "current", $current );

        ## setup statefile

        $this->em_state->read_lock();

        debug_json( "em_state", $this->em_state->state );

        ## compare state with current

        foreach ( (array) $this->em_state->state as $k => $v ) {
            if ( !isset( $current->$k ) ) {
                $this->echo_warn( "state inconsistency, entry in state not in current" );
                unset( $this->em_state->state->$k );
                continue;
            }
            if ( $current->$k->id != $this->em_state->state->$k->id
                 || $current->$k->name != $this->em_state->state->$k->name
                 || $current->$k->network != $this->em_state->state->$k->network ) {
                $this->echo_warn( "state inconsistency, entry in state and in current, but has differences" );
                unset( $this->em_state->state->$k );
                continue;
            }

            if ( $this->em_state->state->$k->status != $current->$k->status ) {
                $this->echo_warn( "instance $k status differences" );
                $this->em_state->state->$k->status = $current->$k->status;
            }
            unset( $current->$k );
        }
                
        ## add missing current to state, they are idle
        
        foreach ( (array) $current as $k => $v ) {
            $this->em_state->state->$k = json_decode( json_encode( $v ) );
            $this->em_state->state->$k->use_status = "idle";
            $this->em_state->state->$k->use_id     = "";
        }
            
        debug_json( "reload state em_state - before save", $this->em_state->state );
        $this->em_state->save();
        debug_json( "reload state em_state - after save", $this->em_state->state );
            
        # error_exit( "em_openstack:reload_state() - not yet implemented" );
    }


    # status() - compute status info, optionally update os status
    function status( $update = false ) {
        $this->debug_echo( "em_openstack: status()" );

        $this->em_state->read_lock();

        debug_json( "status em_state", $this->em_state->state );

        if ( !isset( $this->em_state->state ) ) {
            $this->em_state->release_lock();
            error_exit( "status: em_state->state not set?" );
        }

        $needed_idle = $this->em_config->flavors->{$this->flavor}->idle;
        $maximum     = $this->em_config->flavors->{$this->flavor}->maximum;

        $idle    = [];
        $in_use  = [];
        $active  = [];
        $shelved = [];
        $error   = [];
        $build   = [];
        $unknown = [];
        $all     = [];
        $missing = [];

        for ( $i = 0; $i < $maximum; ++$i ) {
            if ( !isset( $this->em_state->state->$i ) ) {
                $missing[] = $i;
            }
        }

        foreach ( (array) $this->em_state->state as $k => $v ) {
            $all[] = $k;
            switch( $v->status ) {
                case "ACTIVE" : {
                    $active[] = $k;
                    if ( $v->use_status == "idle" ) {
                        $idle[] = $k;
                    } else {
                        $in_use[] = $k;
                    }
                }
                break;
                
                case "ERROR" : {
                    $error[] = $k;
                }
                break;
                
                case "BUILD" : {
                    $build[] = $k;
                }
                break;
                
                case "SHELVED_OFFLOADED" :
                case "SHELVING" : {
                    $shelved[] = $k;
                }
                break;
                
                default : {
                    $unknown[] = $k;
                }
                break;
                
            }
        }
                
        #$to_shelve = [];
        #$to_launch = [];
        
        # debug_json( "state", $this->em_state->state );

        $difference = $needed_idle - count( $idle );

        $instances_to_start = 0;
        $instances_to_idle  = 0;

        if ( $difference > 0 ) {
            $instances_to_start = $difference;
            if ( $instances_to_start + count( $active ) > $maximum ) {
                $instances_to_start = $maximum - count( $active );
            }
            if ( $instances_to_start < 0 ) {
                $instances_to_start = 0;
            }
        }
        if ( $difference < 0 ) {
            $instances_to_idle = -$difference;
        }

        $this->em_state->release_lock();

        if ( $update ) {
            if ( $instances_to_start > 0
                 || $instances_to_idle > 0 ) {
                $this->debug_echo( "updating.... (to start $instances_to_start, to idle $instances_to_idle) " );
                while (
                    $instances_to_start > 0
                    && count( $shelved )
                    ) {
                    $k = array_shift( $shelved );
                    if ( $this->unshelve( $k ) ) {
                        ## ok
                        --$instances_to_start;
                    }
                }
                while (
                    $instances_to_start > 0
                    && count( $missing ) ) {
                    $k = array_shift( $missing );
                    if ( isset( $this->em_state->state->$k ) ) {
                        $this->echo_warn( "trying to launch an instance that already exists!" );
                    } else {
                        if ( $this->launch_one( $k ) ) {
                            ## ok
                            --$instances_to_start;
                        }
                    }
                }                    
                if ( $instances_to_start > 0 ) {
                    $this->echo_warn( "could not start expected instances" );
                }

                while ( $instances_to_idle > 0
                        && count( $idle ) ) {
                    $k = array_shift( $idle );
                    if ( $this->shelve( $k ) ) {
                        ## ok
                        --$instances_to_idle;
                    } else {
                        ## likely was acquired, assume needed, don't idle, worry about it next loop
                        --$instances_to_idle;
                    }
                }

                if ( $instances_to_idle > 0 ) {
                    $this->echo_warn( "could not idle expected instances" );
                }

                $this->reload_state();
            } else {
                ## nothing to update
                return "nothing to update\n";
            }
        }
            
        return sprintf(
            "idle    %d [%s]\n"
            . "in_use  %d [%s]\n"
            . "active  %d [%s]\n"
            . "shelved %d [%s]\n"
            . "error   %d [%s]\n"
            . "build   %d [%s]\n"
            . "unknown %d [%s]\n"
            . "missing %d [%s]\n"
            . "\n"
            . "needed idle $needed_idle\n"
            . "maximum     $maximum\n"
            . "instances to start $instances_to_start\n"
            . "instances to idle $instances_to_idle\n"

            ,count( $idle ), implode( ",", $idle )
            ,count( $in_use ), implode( ",", $in_use )
            ,count( $active ), implode( ",", $active )
            ,count( $shelved ), implode( ",", $shelved )
            ,count( $error ), implode( ",", $error )
            ,count( $build ), implode( ",", $build )
            ,count( $unknown ), implode( ",", $unknown )
            ,count( $missing ), implode( ",", $missing )

            );
    }

    ## launch_one() - launch a new instance given a number 
    function launch_one( $number ) {
        $this->debug_echo( "em_openstack: launch_one( $number )" );

        $flavor = $this->flavor;

        if ( !$this->secrets_loaded ) {
            $this->load_secrets();
        }

        if ( !$this->global_putenv_done ) {
            $this->global_putenv();
        }

        if ( !isset( $this->appconfig->resources->oscluster->properties->sshuser ) ) {
            error_exit( "resources:oscluster:properties:sshuser not defined in appconfig" );
        }

        $os_sshuser = $this->appconfig->resources->oscluster->properties->sshuser;

        if ( !isset( $this->appconfig->resources->oscluster->properties->sshadmin ) ) {
            error_exit( "resources:oscluster:properties:sshadmin not defined in appconfig" );
        }

        $os_sshadmin = $this->appconfig->resources->oscluster->properties->sshadmin;

        if ( !isset( $this->appconfig->resources->oscluster->properties->sshidentity ) ) {
            error_exit( "resources:oscluster:properties:sshidentity not defined in appconfig" );
        }

        $os_sshidentity = $this->appconfig->resources->oscluster->properties->sshidentity;

        ## needs a unique number

        $uuid = "$this->idprefix-$this->id-$this->flavor-$number";

        # -------------------- set up OS image info --------------------

        $this->project_putenv( $this->project );

        if ( !isset( $this->appconfig->resources->oscluster->properties->key ) ) {
            error_exit( "resources:oscluster:properties:key not defined in $this->em_config->files->appconfig" );
        }

        $key = $this->appconfig->resources->oscluster->properties->key;

        if ( !isset( $this->appconfig->resources->oscluster->properties->secgroup ) ) {
            error_exit( "resources:oscluster:properties:secgroup not defined in $this->em_config->files->appconfig" );
        }

        $secgroup = $this->appconfig->resources->oscluster->properties->secgroup;

        $userdata = "";
        if ( isset( $this->appconfig->resources->oscluster->properties->user_data ) ) {
            $this->debug_echo( "userdata is set\n" );
            $tempfile = tempnam( ".", "_os_temp" );
            file_put_contents( $tempfile, '#!/bin/bash' . "\n" . $this->appconfig->resources->oscluster->properties->user_data . "\n" );
            $userdata = "--user-data $tempfile";
            $this->debug_echo( "userdata $userdata\n" );
        }

        # currently sharing same network
        #    if ( isset( $this->appconfig->resources->oscluster->properties->network ) ) {
        #        $use_network = $this->appconfig->resources->oscluster->properties->network;
        #    } else {
        #        $use_network = "${project}-api";
        #    }

        if ( !isset( $this->appconfig->resources->oscluster->properties->network ) ) {
            error_exit( "resources:oscluster:properties:network not defined in $this->em_config->files->appconfig" );
        }

        $use_network = $this->appconfig->resources->oscluster->properties->network;

        #    $this->debug_echo( `openstack server list` );

        $cstrong = true;

        $os_image = [];

        # -------------------- boot instances --------------------

        $nodes = 1; ## just boot one at a time

        $this->debug_echo( "Booting $nodes virtual cluster node" . ( $nodes > 1 ? "s" : "" ) );

        ## restricted to one node for now
        for ( $i = 0; $i < $nodes; ++$i ) {
            $name =  
                "$this->project-run-" . $uuid
                ## when we booted multiple nodes ##  . "-" . str_pad( $i, 3, "0", STR_PAD_LEFT )
                ;
            ##        "-run-" . bin2hex( openssl_random_pseudo_bytes ( 16, $cstrong ) );

            $cmd = "openstack server create $name --flavor $this->flavor --image $this->image --key-name $key --security-group $secgroup --network $use_network $userdata";
            $this->debug_echo( "$cmd\n" );
            exec( "$cmd 2>&1", $results_array, $cmd_exitCode );
            $this->debug_echo( implode( "\n", $results_array ) . "\n" );
            $results_error = preg_grep( '/ERROR/', $results_array );

            if ( count( $results_error ) || $cmd_exitCode ) {
                $this->debug_echo( "Errors found when trying to boot a virtual cluster node" );
                $create_cmd = $cmd;
                $cmd = "";
                if ( count( $os_image ) ) {
                    $cmd = "openstack server delete --wait " . implode( ' ', $os_image );
                    $this->debug_echo( $cmd );
                    $this->debug_echo( "Removing successfully booted virtual cluster nodes" );
                    ## RESTORE WHEN CONFIDENT ! $this->debug_echo( `$cmd 2>&1` );
                }
                $this->debug_echo( "Errors found when trying to boot a virtual cluster node" );
                if ( isset( $tempfile ) ) {
                    unlink( $tempfile );
                }
                error_exit( "Errors found when trying to boot a virtual cluster node.", "command:\n$create_cmd\nreturned:\n" .  implode( "\n", $results_array ) );
            }        

            $os_image[] = $name;
        }

        if ( isset( $tempfile ) ) {
            unlink( $tempfile );
        }

        # -------------------- wait to become active --------------------

        $isactive = [];
        $os_ip = [];

        $this->debug_echo( "Checking $nodes virtual cluster node" . ( $nodes > 1 ? "s" : "" ) );

        do {
            $any_booting = false;
            foreach ( $os_image as $v ) {
                if ( array_key_exists( $v, $isactive ) ) {
                    continue;
                }
                $this->debug_echo( "checking $v\n" );
                ## probably should be chained to one openstack server list at the start of the loop (?)
                $cmd = "openstack server show $v";
                $results = `$cmd`;
                $resultsarray = explode( "\n", $results );
                $status = array_values( preg_grep( "/ status  /", $resultsarray ) );

                if ( count( $status ) != 1 ) {
                    $cmd = "";
                    if ( count( $os_image ) ) {
                        $cmd = "openstack server delete --wait " . implode( ' ', $os_image );
                        $this->debug_echo( $cmd );
                        $this->debug_echo( "Removing successfully booted virtual cluster nodes" );
                        ## RESTORE WHEN CONFIDENT ! $this->debug_echo( `$cmd 2>&1` );
                    }
                    $this->debug_echo( "Errors found when trying to boot a virtual cluster node" );
                    error_exit( "OpenStack: exactly one status not returned for image ' . $v . '" );
                }

                $this_status_array = preg_split( '/\s+/', $status[ 0 ] );
                foreach ( $this_status_array as $k2 => $v2 ) {
                    $this_status = $this_status_array[ 3 ];
                    $status_ok = 0;
                    switch( $this_status ) {
                        case "ACTIVE" : $status_ok = 1; break;
                        case "BUILD" : $status_ok = 1; break;
                        default : break;
                    }
                    if ( !$status_ok ) {
                        $cmd = "";
                        if ( count( $os_image ) ) {
                            $cmd = "openstack server delete --wait " . implode( ' ', $os_image );
                            $this->debug_echo( $cmd );
                            $this->debug_echo( "Removing successfully booted virtual cluster nodes" );
                            ## RESTORE WHEN CONFIDENT ! $this->debug_echo( `$cmd 2>&1` );
                        }
                        $this->debug_echo( "Errors found when trying to boot a virtual cluster node" );
                        error_exit( "OpenStack: unknown status ' . $this_status . ' received for image ' . $v . '" );
                    }
                }

                # $this->debug_echo( "status: " . json_encode( $status, JSON_PRETTY_PRINT ) . "\n" );
                $network = array_values( preg_grep( "/ addresses  /", $resultsarray ) );
                # $this->debug_echo( "network: " . json_encode( $network, JSON_PRETTY_PRINT ) . "\n" );

                if ( $network ) {
                    $nets = preg_split( '/\s+/', $network[ 0 ] );
                    #foreach ( $nets as $k2 => $v2 ) {
                    #    $this->debug_echo( "nets[$k2]=$v2\n" );
                    #}
                    # strange xxlarge's sometimes get 2 ip's
                    array_pop( $nets );
                    $os_ip[ $v ] = preg_replace( '/^.*=/', '', array_pop( $nets ) );
                }

                if ( $status &&
                     strpos( $status[ 0 ], "ACTIVE" ) ) {
                    $isactive[ $v ] = 1;
                } else {
                    $any_booting = true;
                    $this->debug_echo( "$v still booting\n" );
                }
            }
        } while( $any_booting );

        $this->debug_echo( "Nodes all active, waiting for ssh to open" );
        $this->debug_echo( "all active\n" );
        foreach ( $os_image as $v ) {
            $this->debug_echo( "$v $os_ip[$v]\n" );
        }

        # -------------------- wait for ssh to open--------------------

        $issshopen = [];

        do {
            $any_notopen = false;
            foreach ( $os_image as $v ) {
                if ( array_key_exists( $v, $issshopen ) ) {
                    continue;
                }
                if ( !isset( $os_ip[$v] ) ) {
                    $this->debug_echo( "error: $v has no ip address defined\n" );
                    exit(-1);
                }
                $this->debug_echo("checking for ssh $v $os_ip[$v]\n" );

                ob_start();
                if ( $fp = fsockopen( $os_ip[$v], 22, $errno, $errstr, 10 ) ) {
                    ob_end_clean();
                    $issshopen[ $v ] = 1;
                    $this->debug_echo( "$os_ip[$v] is open\n" );
                    fclose( $fp );                
                } else {
                    ob_end_clean();
                    $any_notopen = true;
                    $this->debug_echo( "$os_ip[$v] ssh not open\n" );
                }
            }
            sleep( 5 );
        } while( $any_notopen );
        
        $this->debug_echo( "Nodes all active and ssh open, waiting to go ready" );

        # -------------------- run postssh if present --------------------

        if ( isset( $this->appconfig->resources->oscluster->properties->postssh ) ) {
            foreach ( $os_image as $v ) {
                $cmd = "ssh -i $os_sshidentity -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no $os_sshadmin@$os_ip[$v] -C '" . $this->appconfig->resources->oscluster->properties->postssh . "'";
                $this->debug_echo( "post ssh : $cmd" );
                `$cmd 2>&1 > /dev/null`;
            }
        }

        # -------------------- check for /tmp/ready --------------------

        $ready = [];

        ## need to postssh and/or other ssh setup working
        $os_ready_sleep_seconds = 5;
        $os_ready_max_wait      = 60;
        $os_ready_time_waiting  = 0;
        $os_ready_ssh_timeout   = 3;
        $any_notready = false;

        do {
            foreach ( $os_image as $v ) {
                if ( array_key_exists( $v, $ready ) ) {
                    continue;
                }
                if ( !isset( $os_ip[$v] ) ) {
                    $this->debug_echo( "error: $v has no ip address defined\n" );
                    exit(-1);
                }
                $this->debug_echo("checking for ready $v $os_ip[$v] time waiting ${os_ready_time_waiting}s\n" );

                ob_start();

                $cmd = "timeout $os_ready_ssh_timeout ssh -i $os_sshidentity -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no $os_sshadmin@$os_ip[$v] 'ls /tmp/ready'";
                
                $res = `$cmd 2>&1`;

                ob_end_clean();

                $this->debug_echo( $cmd );

                if ( preg_match( '/^\/tmp\/ready$/m', $res ) ) {
                    $ready[ $v ] = 1;
                    $this->debug_echo( "$os_ip[$v] is ready\n" );
                } else {
                    $any_notready = true;
                    $this->debug_echo( "$os_ip[$v] is not ready\n" );
                }
            }
            sleep( $os_ready_sleep_seconds );
            $os_ready_time_waiting += $os_ready_sleep_seconds;
        } while( $any_notready && $os_ready_time_waiting < $os_ready_max_wait );

        if ( $any_notready ) {
            $cmd = "";
            $this->debug_echo( "Timeout while waiting for nodes to go ready, removing virtual cluster nodes" );
            if ( count( $os_image ) ) {
                $cmd = "openstack server delete --wait " . implode( ' ', $os_image );
                $this->debug_echo( $cmd );
                $this->debug_echo( "Removing successfully booted virtual cluster nodes" );
                ## RESTORE WHEN CONFIDENT ! $this->debug_echo( `$cmd 2>&1` );
            }
            $this->debug_echo( "Timeout while waiting for nodes to go ready" );
            if ( isset( $tempfile ) ) {
                unlink( $tempfile );
            }
            error_exit( "Timeout while waiting for nodes to go ready. Please try again in a short while." ); 
        }
        return true;
    }

    ## server start
    function server_start() {
        $this->debug_echo( "em_openstack: server_start()" );

        ## read current server state & config & determine what's needed
        $this->read_config();
        
        $this->reload_state();

        echo $this->status();

        echo $this->status( true );

        while( 1 ) {
            echo $this->status( true );
            sleep( $this->em_config->sleep->service_loop );
        }            
    }

    ## project_putenv() setup OS env
    function project_putenv( $project ) {
        $this->debug_echo( "em_openstack: project_putenv( '$project' )" );

        if ( !$this->global_putenv_done ) {
            $this->global_putenv();
        }

        if ( !isset( $this->secrets ) ||
             !isset( $this->secrets->openstack ) ||
             !isset( $this->secrets->openstack->projects ) ) {
            error_exit( "error: no secrets->openstack->projects defined in " . $this->em_config->files->secrets );
        }
        
        if ( !isset( $this->secrets->openstack->projects->{$project} ) ) {
            error_exit( "error: project missing from secrets secrets:openstack:projects:$project " . $this->em_config->files->secrets );
        }

        if ( !isset( $this->secrets->openstack->projects->{$project}->id ) ) {
            error_exit( "error: project id missing from secrets secrets:openstack:projects:project:id " . $this->em_config->files->secrets );
        }

        if ( !isset( $this->secrets->openstack->projects->{$project}->secret ) ) {
            error_exit( "error: project secret missing from secrets secrets:openstack:projects:$project:secret " . $this->em_config->files->secrets );
        }

        putenv( "OS_APPLICATION_CREDENTIAL_ID=" . $this->secrets->openstack->projects->{$project}->id );
        putenv( "OS_APPLICATION_CREDENTIAL_SECRET=" . $this->secrets->openstack->projects->{$project}->secret );

        $this->cli_secrets =
            "OS_APPLICATION_CREDENTIAL_ID=" . $this->secrets->openstack->projects->{$project}->id 
            . " OS_APPLICATION_CREDENTIAL_SECRET=\"" . $this->secrets->openstack->projects->{$project}->secret . "\" "
            ;
        
    }

    ## global_putenv() setup OS env
    function global_putenv() {
        $this->debug_echo( "em_openstack: global_putenv()" );

        if ( !$this->appconfig_loaded ) {
            $this->load_appconfig();
        }

        if ( !isset( $this->appconfig->resources->oscluster->properties->region_name ) ) {
            error_exit( "error: resources:oscluster:properties:region_name not defined $this->em_config->files->appconfig" );
        }

        putenv( "OS_REGION_NAME=" . $this->appconfig->resources->oscluster->properties->region_name );

        if ( !isset( $this->appconfig->resources->oscluster->properties->api_version ) ) {
            error_exit( "error: resources:oscluster:properties:api_version not defined $this->em_config->files->appconfig" );
        }

        putenv( "OS_IDENTITY_API_VERSION=" . $this->appconfig->resources->oscluster->properties->api_version );

        if ( !isset( $this->appconfig->resources->oscluster->properties->auth_url ) ) {
            error_exit( "error: resources:oscluster:properties:auth_url not defined $this->em_config->files->appconfig" );
        }

        putenv( "OS_AUTH_URL=" . $this->appconfig->resources->oscluster->properties->auth_url );

        if ( !isset( $this->appconfig->resources->oscluster->properties->auth_type ) ) {
            error_exit( "error: resources:oscluster:properties:auth_type not defined $this->em_config->files->appconfig" );
        }

        putenv( "OS_AUTH_TYPE=" . $this->appconfig->resources->oscluster->properties->auth_type );

        if ( !isset( $this->appconfig->resources->oscluster->properties->interface ) ) {
            error_exit( "error: resources:oscluster:properties:interface not defined $this->em_config->files->appconfig" );
        }

        putenv( "OS_INTERFACE=" . $this->appconfig->resources->oscluster->properties->interface );

        $this->global_putenv_done = true;

        if ( $this->debug ) {
            echo "env after global_putenv():\n";
            echo `env | grep OS_`;
            echo "\n";
        }
    }

    ## --- client functions ----

    function acquire( $flavor, &$number, &$ip, $wait = true ) {
        if ( $flavor != $this->flavor ) {
            $this->echo_warn( "flavor $flavor not currently available, use $this->flavor" );
            return false;
        }

        while ( 1 ) {
            $this->em_state->read_lock();
            ## find an idle, set it to "in use"

            foreach ( (array) $this->em_state->state as $k => $v ) {
                if ( $v->status == "ACTIVE"
                     && $v->use_status == "idle" ) {
                    $v->use_status = "in use";
                    $this->em_state->save();
                    $number = $k;
                    $ip     = $this->em_state->state->$k->network;
                    return true;
                }
            }
            $this->em_state->release_lock();

            if ( !$wait ) {
                return false;
            }

            ## wait

            sleep( $this->em_config->sleep->acquire_wait );
        }
    }

    function release( $number ) {
        $this->em_state->read_lock();
        if ( $this->em_state->state->$number->use_status != "in use" ) {
            $this->em_state->release_lock();
            $this->echo_warn( "release $number was not in use" );
            return false;
        }
        $this->em_state->state->$number->use_status = "idle";
        $this->em_state->save();
        return true;
    }
}        


