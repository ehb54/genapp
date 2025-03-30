<?php

{};

require_once "em_common.php";

## class for managing openstack instance pool

class em_openstack {

    public $debug;
    public $errors;

    private $statefile;
    private $state;

    private $configfile;
    private $emconfig;
    
    private $em_state;
    private $appconfig;
    private $appconfig_loaded = false;
    
    private $secrets;
    private $secrets_loaded = false;
    private $cli_secrets;

    private $id;
    private $project;
    private $image;

    private $projects;

    private $global_putenv_done = false;
    
    function __construct( $debug = false, $configfile = "em_config.json" ) {
        $this->debug       = $debug;
        $this->configfile  = $configfile;
        $this->read_config();
        if ( !isset( $this->emconfig->files ) ) {
            error_exit( "$this->configfile does not define 'files'" );
        }
        if ( !isset( $this->emconfig->files->state ) ) {
            error_exit( "$this->configfile does not define 'files'->'state'" );
        }

        $this->statefile   = $this->emconfig->files->state;
        $this->errors      = "";
        $this->state       = new em_state( $this->debug, $this->statefile );
    }

    ## read_config() - read the config file
    function read_config() {
        $this->debug_echo( "em_openstack: read_config()" );

        if ( !file_exists( $this->configfile ) ) {
            error_exit( "File $this->configfile does not exist\n" );
        }

        try {
            $this->emconfig = json_decode( file_get_contents( $this->configfile ) );
        } catch ( Exception $e ) {
            error_exit( "Error decoding $this->configfile : " . $e->getMessage() );
        }
        if ( !isset( $this->emconfig->flavors ) ) {
            error_exit( "$this->configfile does not define 'flavors'" );
        }

        foreach ( $this->emconfig->flavors as $flavor => $v ) {
            if ( !isset( $v->idle ) ) {
                error_exit( "$this->configfile does not define flavors:$flavor:idle" );
            }
            if ( !isset( $v->maximum ) ) {
                error_exit( "$this->configfile does not define flavors:$flavor:maximum" );
            }
        }

        if ( !isset( $this->emconfig->project ) ) {
            error_exit( "$this->configfile does not define project" );
        }

        $this->project = $this->emconfig->project;

        if ( !isset( $this->emconfig->id ) ) {
            error_exit( "$this->configfile does not define id" );
        }

        $this->id = $this->emconfig->id;

        if ( $this->debug ) {
            debug_json( "em_openstack:read_config() emconfig:", $this->emconfig );
        }
    }
            
    # load_secrets() - always loads
    function load_secrets() {
        $this->debug_echo( "em_openstack: load_secrets()" );
        if ( !isset( $this->emconfig->files->secrets ) ) {
            error_exit( "$this->configfile does not define 'files'->'secrets'" );
        }
        
        try {
            $this->secrets = json_decode( file_get_contents( $this->emconfig->files->secrets ) );
        } catch ( Exception $e ) {
            error_exit( "Error decoding $this->emconfig->files->secrets " . $e->getMessage() );
        }

        if ( !isset( $this->secrets->openstack ) ) {
            error_exit( "$this->emconfig->files->secrets does not define 'openstack'" );
        }

        if ( !isset( $this->secrets->openstack->projects ) ) {
            error_exit( "$this->emconfig->files->secrets does not define 'openstack'->'projects'" );
        }

        $this->projects = $this->secrets->openstack->projects;

        ## restrict to a single defined project, run separate managers, separate config for each project

        if ( !isset( $this->projects->{ $this->project } ) ) {
            error_exit( "main project $this->project is not defined in $this->emconfig->files->secrets" );
        }

        $this->secrets_loaded = true;
    }            
        
    # load_appconfig() - loads and reloads
    function load_appconfig() {
        $this->debug_echo( "em_openstack: load_appconfig()" );
        if ( !isset( $this->emconfig->files->appconfig ) ) {
            error_exit( "$this->configfile does not define 'files'->'appconfig'" );
        }
        
        try {
            $this->appconfig = json_decode( file_get_contents( $this->emconfig->files->appconfig ) );
        } catch ( Exception $e ) {
            error_exit( "Error decoding $this->emconfig->files->appconfig " . $e->getMessage() );
        }

        if ( !isset( $this->appconfig->resources ) ) {
            error_exit( "error: resources not defined in $this->emconfig->files->appconfig" );
        }

        if ( !isset( $this->appconfig->resources->oscluster ) ) {
            error_exit( "error: resources:oscluster not defined in $this->emconfig->files->appconfig" );
        }
        
        if ( !isset( $this->appconfig->resources->oscluster->properties ) ) {
            error_exit( "error: resources:oscluster:properties not defined in $this->emconfig->files->appconfig" );
        }

        if ( !isset( $this->appconfig->resources->oscluster->properties->baseimage ) ) {
            error_exit( "error: resources:oscluster:properties:baseimage not defined in $this->emconfig->files->appconfig" );
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

    ## reload state() - reload from openstack api call
    function reload_state() {
        $this->debug_echo( "em_openstack: reload_state()" );
        
        ## make openstack call, get current instances, then lock & update state

        foreach ( $this->projects() as $project ) {        
            $this->project_putenv( $project );
            $cmd = "openstack server list -c ID -c Name -c Status -c Networks";
            $this->debug_echo( "cmd - $cmd" );
            $regexp = "/\| $project-genapp_elastic-$this->id-/";
            error_exit( "regexp : $regexp" );
            $results = preg_grep( "/\| $project-em/", run_cmd( $cmd, true, true ) );
            echo "cmd : $cmd\n$results\n";
        }
            
        error_exit( "em_openstack:reload_state() - not yet implemented" );
    }

    function launch_one() {
        $this->debug_echo( "em_openstack: launch_one()" );

        ## needs a unique number

        # -------------------- set up OS image info --------------------

        project_putenv( $this->project );

        if ( !isset( $this->appconfig->resources->oscluster->properties->key ) ) {
            error_exit( "resources:oscluster:properties:key not defined in $this->emconfig->files->appconfig" );
        }

        $key = $this->appconfig->resources->oscluster->properties->key;

        if ( !isset( $this->appconfig->resources->oscluster->properties->secgroup ) ) {
            error_exit( "resources:oscluster:properties:secgroup not defined in $this->emconfig->files->appconfig" );
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
            error_exit( "resources:oscluster:properties:network not defined in $this->emconfig->files->appconfig" );
        }

        $use_network = $this->appconfig->resources->oscluster->properties->network;

        #    $this->debug_echo( `openstack server list` );

        $cstrong = true;

        $os_image = [];

        # -------------------- boot instances --------------------

        $nodes = 1; ## just boot one at a time

        $this->debug_echo( "Booting $nodes virtual cluster node" . ( $nodes > 1 ? "s" : "" ) );

        for ( $i = 0; $i < $nodes; ++$i ) {
            
            $name =  
                "${project}-run-" . $uuid . "-" . str_pad( $i, 3, "0", STR_PAD_LEFT );
            ##        "-run-" . bin2hex( openssl_random_pseudo_bytes ( 16, $cstrong ) );

            $cmd = "openstack server create $name --flavor $flavor --image $baseimage --key-name $key --security-group $secgroup --network $use_network $userdata";
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
                    $this->debug_echo( `$cmd 2>&1` );
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
                        $this->debug_echo( `$cmd 2>&1` );
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
                            $this->debug_echo( `$cmd 2>&1` );
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
                $this->debug_echo( `$cmd 2>&1` );
            }
            $this->debug_echo( "Timeout while waiting for nodes to go ready" );
            if ( isset( $tempfile ) ) {
                unlink( $tempfile );
            }
            error_exit( "Timeout while waiting for nodes to go ready. Please try again in a short while." ); 
        }       
    }

    ## server start
    function server_start() {
        $this->debug_echo( "em_openstack: server_start()" );

        ## read current server state & config & determine what's needed
        $this->read_config();

        $this->reload_state();

        error_exit( "testing" );

        debug_json( "projects", $this->projects() );

        foreach ( $this->projects() as $project ) {
            $this->project_putenv( $project );
            echo `env | grep OS_`;
        }

        # foreach ( $this->emconfig->flavors as $flavor => $v ) {}

    }

    ## global_putenv() setup OS env
    function project_putenv( $project ) {
        $this->debug_echo( "em_openstack: project_putenv( '$project' )" );

        if ( !$this->global_putenv_done ) {
            $this->global_putenv();
        }

        if ( !isset( $this->secrets ) ||
             !isset( $this->secrets->openstack ) ||
             !isset( $this->secrets->openstack->projects ) ) {
            error_exit( "error: no secrets->openstack->projects defined in $this->emconfig->files->secrets" );
        }
        
        if ( !isset( $this->secrets->openstack->projects->{$project} ) ) {
            error_exit( "error: project missing from secrets secrets:openstack:projects:$project $this->emconfig->files->secrets" );
        }

        if ( !isset( $this->secrets->openstack->projects->{$project}->id ) ) {
            error_exit( "error: project id missing from secrets secrets:openstack:projects:project:id $this->emconfig->files->secrets" );
        }

        if ( !isset( $this->secrets->openstack->projects->{$project}->secret ) ) {
            error_exit( "error: project secret missing from secrets secrets:openstack:projects:$project:secret $this->emconfig->files->secrets" );
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
            error_exit( "error: resources:oscluster:properties:region_name not defined $this->emconfig->files->appconfig" );
        }

        putenv( "OS_REGION_NAME=" . $this->appconfig->resources->oscluster->properties->region_name );

        if ( !isset( $this->appconfig->resources->oscluster->properties->api_version ) ) {
            error_exit( "error: resources:oscluster:properties:api_version not defined $this->emconfig->files->appconfig" );
        }

        putenv( "OS_IDENTITY_API_VERSION=" . $this->appconfig->resources->oscluster->properties->api_version );

        if ( !isset( $this->appconfig->resources->oscluster->properties->auth_url ) ) {
            error_exit( "error: resources:oscluster:properties:auth_url not defined $this->emconfig->files->appconfig" );
        }

        putenv( "OS_AUTH_URL=" . $this->appconfig->resources->oscluster->properties->auth_url );

        if ( !isset( $this->appconfig->resources->oscluster->properties->auth_type ) ) {
            error_exit( "error: resources:oscluster:properties:auth_type not defined $this->emconfig->files->appconfig" );
        }

        putenv( "OS_AUTH_TYPE=" . $this->appconfig->resources->oscluster->properties->auth_type );

        if ( !isset( $this->appconfig->resources->oscluster->properties->interface ) ) {
            error_exit( "error: resources:oscluster:properties:interface not defined $this->emconfig->files->appconfig" );
        }

        putenv( "OS_INTERFACE=" . $this->appconfig->resources->oscluster->properties->interface );

        $this->global_putenv_done = true;

        if ( $this->debug ) {
            echo "env after global_putenv():\n";
            echo `env | grep OS_`;
            echo "\n";
        }
    }
}        

    
