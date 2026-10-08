<?php

{};

date_default_timezone_set('UTC');

require_once "em_common.php";
require_once "em_mail.php";

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

    public $id;
    private $project;
    private $image;
    public $flavor;
    private $idprefix = "genapp_elastic";

    private $logfile;
    private $notify = "";

    private $projects;

    private $global_putenv_done = false;

    private $run_cmd_last_error_code;

    ## why the last probe_instance() failed, so --probe can say more than "?"
    public $probe_error = "";

    ## low cpu tracking per slot: which job it belongs to, consecutive low
    ## readings, when the low stretch began, and when we last warned (0 = not
    ## yet). see probe_check() and probe_track_new()
    private $probe_track = [];

    ## openstack outage tracking, see api_unavailable() and api_answering():
    ## null while server lists work, otherwise when it began, failed attempts,
    ## when we last mailed, and when to try again
    private $api_down = null;

    ## slots a server list could not vouch for, warned about once each, see
    ## reload_state()
    private $listing_warned = [];

    ## no new start before this time, after one failed with openstack answering
    private $start_retry_at = 0;

    ## when a server list last worked, see refresh_if_due()
    private $last_listed = 0;
    
    function __construct( $debug = false, $configfile = "em_config.json" ) {
        $this->debug       = $debug;
        $this->configfile  = $configfile;
        $this->read_config();
        if ( !isset( $this->em_config->files ) ) {
            $this->error_exit( "$this->configfile does not define 'files'" );
        }
        if ( !isset( $this->em_config->files->state ) ) {
            $this->error_exit( "$this->configfile does not define 'files'->'state'" );
        }

        $this->statefile   = $this->em_config->files->state;
        $this->errors      = "";
        $this->em_state       = new em_state( $this->debug, $this->statefile );
    }

    ## read_config() - read the config file
    function read_config() {
        $this->debug_echo( "em_openstack: read_config()" );

        if ( !file_exists( $this->configfile ) ) {
            $this->error_exit( "File $this->configfile does not exist\n" );
        }

        try {
            $this->em_config = json_decode( file_get_contents( $this->configfile ) );
        } catch ( Exception $e ) {
            $this->error_exit( "Error decoding $this->configfile : " . $e->getMessage() );
        }

        if ( !isset( $this->em_config->flavors ) ) {
            $this->error_exit( "$this->configfile does not define 'flavors'" );
        }

        foreach ( $this->em_config->flavors as $flavor => $v ) {
            $this->flavor = $flavor;
            if ( !isset( $v->idle ) ) {
                $this->error_exit( "$this->configfile does not define flavors:$flavor:idle" );
            }
            if ( !isset( $v->maximum ) ) {
                $this->error_exit( "$this->configfile does not define flavors:$flavor:maximum" );
            }
        }

        if ( !isset( $this->em_config->project ) ) {
            $this->error_exit( "$this->configfile does not define project" );
        }

        $this->project = $this->em_config->project;

        if ( !isset( $this->em_config->id ) ) {
            $this->error_exit( "$this->configfile does not define id" );
        }

        $this->id = $this->em_config->id;

        if ( !isset( $this->em_config->logfile ) ) {
            $this->error_exit( "$this->configfile does not define logfile" );
        }

        $this->logfile = $this->em_config->logfile;

        if ( !isset( $this->em_config->notify ) ) {
            $this->echo_warn( "$this->configfile does not define notify" );
        } else {
            $this->notify = $this->em_config->notify;
        }

        if ( $this->debug ) {
            debug_json( "em_openstack:read_config() em_config:", $this->em_config );
        }
    }
            
    # load_secrets() - always loads
    function load_secrets() {
        $this->debug_echo( "em_openstack: load_secrets()" );
        if ( !isset( $this->em_config->files->secrets ) ) {
            $this->error_exit( "$this->configfile does not define 'files'->'secrets'" );
        }
        
        try {
            $this->secrets = json_decode( file_get_contents( $this->em_config->files->secrets ) );
        } catch ( Exception $e ) {
            $this->error_exit( "Error decoding $this->em_config->files->secrets " . $e->getMessage() );
        }

        if ( !isset( $this->secrets->openstack ) ) {
            $this->error_exit( "$this->em_config->files->secrets does not define 'openstack'" );
        }

        if ( !isset( $this->secrets->openstack->projects ) ) {
            $this->error_exit( "$this->em_config->files->secrets does not define 'openstack'->'projects'" );
        }

        $this->projects = $this->secrets->openstack->projects;

        ## restrict to a single defined project, run separate managers, separate config for each project

        if ( !isset( $this->projects->{ $this->project } ) ) {
            $this->error_exit( "main project $this->project is not defined in $this->em_config->files->secrets" );
        }

        $this->secrets_loaded = true;
    }            
        
    # load_appconfig() - loads and reloads
    function load_appconfig() {
        $this->debug_echo( "em_openstack: load_appconfig()" );
        if ( !isset( $this->em_config->files->appconfig ) ) {
            $this->error_exit( "$this->configfile does not define 'files'->'appconfig'" );
        }
        
        try {
            $this->appconfig = json_decode( file_get_contents( $this->em_config->files->appconfig ) );
        } catch ( Exception $e ) {
            $this->error_exit( "Error decoding $this->em_config->files->appconfig " . $e->getMessage() );
        }

        if ( !isset( $this->appconfig->resources ) ) {
            $this->error_exit( "error: resources not defined in $this->em_config->files->appconfig" );
        }

        if ( !isset( $this->appconfig->resources->oscluster ) ) {
            $this->error_exit( "error: resources:oscluster not defined in $this->em_config->files->appconfig" );
        }
        
        if ( !isset( $this->appconfig->resources->oscluster->properties ) ) {
            $this->error_exit( "error: resources:oscluster:properties not defined in $this->em_config->files->appconfig" );
        }

        if ( !isset( $this->appconfig->resources->oscluster->properties->baseimage ) ) {
            $this->error_exit( "error: resources:oscluster:properties:baseimage not defined in $this->em_config->files->appconfig" );
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


    ## shelve() - shelve, offload instance
    function shelve( $number ) {
        $this->debug_echo( "em_openstack: shelve( $number )" );
        $this->log( "shelve $number" );

        ## might have gone in_use
        $this->em_state->read_lock();
        if ( !isset( $this->em_state->state->$number ) ) {
            $this->em_state->release_lock();
            $this->echo_warn( "em_openstack: shelve() $number is missing from em_state" );
            return false;
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

        $res = $this->run_cmd( $cmd, false );

        if ( $this->run_cmd_last_error_code != 0 ) {
            $this->echo_warn( "$cmd failed with code $this->run_cmd_last_error_code, results:\n$res" );
            return false;
        }

        return true;
    }

    ## unshelve() - shelve, offload instance
    function unshelve( $number ) {
        $this->debug_echo( "em_openstack: unshelve( $number )" );
        $this->log( "unshelve $number" );

        if ( !isset( $this->em_state->state->$number ) ) {
            $this->echo_warn( "em_openstack: unshelve() $number is missing from em_state" );
            return false;
        }

        $this->project_putenv( $this->project );
        $cmd = "openstack server unshelve --wait " . $this->em_state->state->$number->id . " 2>&1";
        $this->debug_echo( $cmd );
        $res = $this->run_cmd( $cmd, false );

        if ( $this->run_cmd_last_error_code != 0 ) {
            $this->echo_warn( "$cmd failed with code $this->run_cmd_last_error_code, results:\n$res" );
            return false;
        }

        ## post unshelve tests

        if ( !isset( $this->em_state->state->$number ) 
             || !isset( $this->em_state->state->$number->network ) ) {
            $this->echo_warn( "em_openstack: unshelve() ip found for $number" );
            return false;
        }
        
        $ip = $this->em_state->state->$number->network;
        
        ## run ssh is-open test

        $tries    = 0;
        $maxtries = 10;
        $sshopen = false;
        do {
            ob_start();
            if ( @$fp = fsockopen( $ip, 22, $errno, $errstr, 10 ) ) {
                ob_end_clean();
                $sshopen = true;
                $this->debug_echo( "$ip is open\n" );
                fclose( $fp );                
            } else {
                ob_end_clean();
                $this->debug_echo( "$ip ssh not open\n" );
                sleep( 5 );
            }
        } while ( !$sshopen && ++$tries <= $maxtries );

        ## was this instance in error?
        if ( !$sshopen ) {
            $this->echo_warn( "unshelving $number could not ssh" );
            return false;
        }

        ## run postssh if defined
        if ( isset( $this->appconfig->resources->oscluster->properties->postssh ) ) {

            if ( !isset( $this->appconfig->resources->oscluster->properties->sshadmin ) ) {
                $this->error_exit( "resources:oscluster:properties:sshadmin not defined in appconfig" );
            }

            $os_sshadmin = $this->appconfig->resources->oscluster->properties->sshadmin;

            if ( !isset( $this->appconfig->resources->oscluster->properties->sshidentity ) ) {
                $this->error_exit( "resources:oscluster:properties:sshidentity not defined in appconfig" );
            }

            $os_sshidentity = $this->appconfig->resources->oscluster->properties->sshidentity;


            $cmd = "ssh -i $os_sshidentity -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no $os_sshadmin@$ip -C '" . $this->appconfig->resources->oscluster->properties->postssh . "'";
            $this->debug_echo( "post ssh : $cmd" );
            `$cmd 2>&1 > /dev/null`;
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
            $results_all = $this->run_cmd( $cmd, false, true );

            ## a failed list means "we do not know what is out there", not "there
            ## is nothing out there". believing it drops every tracked instance,
            ## in use included, and the next loop launches replacements for all
            ## of them. a DNS outage did exactly that on 2025-08-04. it also
            ## means pool changes would fail, so it starts an outage, during
            ## which status() holds them off, see api_unavailable()

            if ( $this->run_cmd_last_error_code ) {
                $this->api_unavailable( $project, implode( " ", $results_all ) );
                return false;
            }

            $results = preg_grep( $regexp, $results_all );
            $this->debug_echo( "cmd : $cmd\n" . implode( "\n", $results ) );

            foreach ( $results as $v ) {
                $l = explode( "|", $v );
                if ( count( $l ) < 5 ) {
                    $this->echo_warn( "reload_state() - unexpected results : $v" );
                    continue;
                }
                $id       = trim( $l[ 1 ] );
                $name     = trim( $l[ 2 ] );
                $status   = trim( $l[ 3 ] );
                $networks = trim( $l[ 4 ] );

                preg_match( '/\d+$/', $name, $numbers );
                $number   = $numbers[ 0 ];

                $nets = preg_split( '/genapp_net=/', $networks );
                
                ## empty when openstack lists the server without its network
                $network = isset( $nets[ 1 ] ) ? $nets[ 1 ] : "";

                $current->$number = (object)[];
                $current->$number->id      = $id;
                $current->$number->name    = $name;
                $current->$number->status  = $status;
                $current->$number->network = $network;
            }
        }

        if ( $this->debug ) {
            debug_json( "current", $current );
        }

        ## every list worked, so any outage is over

        $this->api_answering();
        $this->last_listed = time();

        ## setup statefile

        $this->em_state->read_lock();

        if ( $this->debug ) {
            debug_json( "em_state", $this->em_state->state );
        }

        ## compare state with current

        foreach ( (array) $this->em_state->state as $k => $v ) {
            ## a list taken while openstack is degraded can leave servers out or
            ## show them without a network. believing it about a slot in use
            ## drops or resets that slot, and the next acquire hands the running
            ## job's machine to a second job. so a slot in use is kept as it is,
            ## and so is any slot that merely lost its network in the list, each
            ## warned about once. other inconsistencies are handled as before

            $in_use = isset( $v->use_status ) && $v->use_status == "in use";

            if ( !isset( $current->$k ) ) {
                if ( $in_use ) {
                    $this->listing_unsure( $k, "slot $k is in use but missing from the server list, keeping it as it is" );
                    continue;
                }
                $this->echo_warn( "state inconsistency, entry in state not in current" );
                unset( $this->em_state->state->$k );
                unset( $this->listing_warned[ $k ] );
                continue;
            }
            if ( !strlen( (string) $current->$k->network ) && strlen( isset( $v->network ) ? (string) $v->network : "" ) ) {
                $this->listing_unsure( $k, "slot $k is listed without a network, keeping it as it is" );
                unset( $current->$k );
                continue;
            }
            if ( $current->$k->id != $this->em_state->state->$k->id
                 || $current->$k->name != $this->em_state->state->$k->name
                 || $current->$k->network != $this->em_state->state->$k->network ) {
                if ( $in_use ) {
                    $this->listing_unsure( $k, "slot $k is in use but listed with a different id, name or network, keeping it as it is" );
                    unset( $current->$k );
                    continue;
                }
                $this->echo_warn( "state inconsistency, entry in state and in current, but has differences" );
                unset( $this->em_state->state->$k );
                unset( $this->listing_warned[ $k ] );
                continue;
            }

            $this->listing_sure( $k );

            if ( $this->em_state->state->$k->status != $current->$k->status ) {
                $this->debug_echo( "instance $k status differences" );
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
            
        if ( $this->debug ) {
            debug_json( "reload state em_state - before save", $this->em_state->state );
        }
        $this->em_state->save();
        if ( $this->debug ) {
            debug_json( "reload state em_state - after save", $this->em_state->state );
        }

        return true;
    }


    # status() - compute status info, optionally update os status
    ## load_pct() - load15 as a percentage of the machine.
    ## the raw figure means nothing without the core count, and the core count
    ## changes with the flavor, so everything downstream should use this

    function load_pct( $load, $cores ) {
        if ( !is_numeric( $load ) || !is_numeric( $cores ) || $cores <= 0 ) {
            return "?";
        }

        return (string) round( 100 * $load / $cores );
    }

    ## probe_sample() - probe every ACTIVE instance and append one line each to
    ## the probe history. records every sample, not just interesting ones: no
    ## threshold can be chosen honestly until we know what a working job and an
    ## idle gap actually look like over time. a slot in use whose instance is
    ## not ACTIVE gets a line too, as a failed probe: there is no OS to ask, and
    ## a stopped or crashed instance under a running job must not go unnoticed.

    function probe_sample() {
        if ( !isset( $this->em_config->probe->history )
             && !isset( $this->em_config->probe->min_pct ) ) {
            return false;
        }

        $this->em_state->read_no_lock();

        if ( !isset( $this->em_state->state ) ) {
            return false;
        }

        $lines = [];

        foreach ( (array) $this->em_state->state as $k => $v ) {
            if ( !isset( $v->status ) || $v->status != "ACTIVE" || !isset( $v->network ) ) {
                if ( isset( $v->use_status ) && $v->use_status == "in use" ) {
                    $error = "instance " . ( isset( $v->status ) ? $v->status : "status unknown" );
                    $this->probe_check( $k, $v, "?", $error );
                    $lines[] = sprintf( "%s slot=%s cores=? load15=? pct=? waxsis=? use=inuse ip=%s tag=%s error=%s"
                                        ,$this->timestamp()
                                        ,$k
                                        ,isset( $v->network ) ? $v->network : "?"
                                        ,empty( $v->use_id ) ? "-" : $v->use_id
                                        ,str_replace( " ", "_", $error ) );
                }
                continue;
            }

            $ok  = $this->probe_instance( $v->network, $load, $waxsis, $cores );
            $pct = $this->load_pct( $load, $cores );

            $this->probe_check( $k, $v, $pct, $ok ? "" : $this->probe_error );

            $lines[] = sprintf( "%s slot=%s cores=%s load15=%s pct=%s waxsis=%s use=%s ip=%s tag=%s%s"
                                ,$this->timestamp()
                                ,$k
                                ,$cores
                                ,$load
                                ,$pct
                                ,$waxsis
                                ,( isset( $v->use_status ) && $v->use_status == "in use" ) ? "inuse" : "idle"
                                ,$v->network
                                ,empty( $v->use_id ) ? "-" : $v->use_id
                                ,$ok || !strlen( $this->probe_error ) ? "" : " error=" . str_replace( " ", "_", $this->probe_error )
                );
        }

        if ( count( $lines ) && isset( $this->em_config->probe->history ) ) {
            file_put_contents( $this->em_config->probe->history, implode( "\n", $lines ) . "\n", LOCK_EX | FILE_APPEND );
        }

        $this->debug_echo( "probe_sample: recorded " . count( $lines ) . " samples" );

        return true;
    }

    ## probe_check() - warn when a held slot stays under probe:min_pct for
    ## probe:consecutive readings in a row, and keep warning every probe:repeat
    ## seconds for as long as it stays there.
    ##
    ## only held slots: an idle instance is legitimately near nothing, and the
    ## floor is not zero anyway, a kworker stuck in D state since boot puts it
    ## around 2% of a 64 core box.
    ##
    ## the window has to be long. load15 is a 15 minute average and a working
    ## job does its between frame processing elsewhere, so a healthy job can sit
    ## at the idle floor for well over an hour. the two cases separate on how
    ## long the stretch lasts, not on how low it goes.
    ##
    ## an unreadable probe is not counted either way: it is a different failure,
    ## with its own alert, see probe_unreachable(). $error is why it failed,
    ## empty when no probe could be tried at all.

    function probe_check( $slot, $v, $pct, $error = "" ) {
        if ( !isset( $this->em_config->probe->min_pct ) ) {
            return;
        }

        $tag = ( isset( $v->use_status ) && $v->use_status == "in use" && !empty( $v->use_id ) ) ? $v->use_id : "";

        ## the counters belong to a job, not a slot. a slot released and then
        ## acquired by another job must start clean, or the new job inherits
        ## the old one's streak and its warned state. a daemon restart seeds
        ## from the history instead, so it does not go quiet for a whole window.

        if ( !isset( $this->probe_track[ $slot ] ) ) {
            $this->probe_track[ $slot ] = $this->probe_track_new( $slot, $tag, true );
        } else if ( $this->probe_track[ $slot ]->tag !== $tag ) {
            $this->probe_track[ $slot ] = $this->probe_track_new( $slot, $tag, false );
        }

        if ( !strlen( $tag ) ) {
            return;
        }

        $t      = $this->probe_track[ $slot ];
        $repeat = isset( $this->em_config->probe->repeat ) ? $this->em_config->probe->repeat : 0;
        $now    = time();

        if ( !is_numeric( $pct ) ) {
            if ( strlen( $error ) ) {
                $this->probe_unreachable( $slot, $v, $t, $error, $now, $repeat );
            }
            return;
        }

        $this->probe_reachable( $slot, $t, $now );

        $min    = $this->em_config->probe->min_pct;
        $need   = isset( $this->em_config->probe->consecutive ) ? $this->em_config->probe->consecutive : 3;

        ## the end of a stretch long enough to warn about is mailed too, so a
        ## run of warnings finishes with an all clear instead of just stopping.
        ## tested on the stretch rather than $t->warned: after a restart the
        ## warnings were sent by the previous process

        if ( $pct >= $min ) {
            if ( $t->low >= $need ) {
                $this->log( sprintf( "CLEARED: slot %s working again: %d%% cpu after %s under %d%% (%d probes). held %s by %s"
                                     ,$slot
                                     ,$pct
                                     ,$this->held_for( $t->since )
                                     ,$min
                                     ,$t->low
                                     ,$this->held_for( isset( $v->acquired_at ) ? $v->acquired_at : 0 )
                                     ,$tag ) );
            }

            $t->low    = 0;
            $t->since  = 0;
            $t->warned = 0;
            return;
        }

        if ( !$t->low ) {
            $t->since = $now;
        }

        ++$t->low;

        $this->debug_echo( sprintf( "probe_check: slot %s at %d%%, %d of %d low readings", $slot, $pct, $t->low, $need ) );

        if ( $t->low < $need ) {
            return;
        }

        if ( $t->warned && ( $repeat <= 0 || $now - $t->warned < $repeat ) ) {
            return;
        }

        $this->echo_warn( sprintf( "slot %s %s: %d%% cpu, under %d%% for %s (%d probes). held %s by %s, ip %s. if the job is gone: php em_client.php --release %s"
                                   ,$slot
                                   ,$t->warned ? "still idle" : "looks idle"
                                   ,$pct
                                   ,$min
                                   ,$this->held_for( $t->since )
                                   ,$t->low
                                   ,$this->held_for( isset( $v->acquired_at ) ? $v->acquired_at : 0 )
                                   ,$tag
                                   ,isset( $v->network ) ? $v->network : "?"
                                   ,escapeshellarg( $tag ) ) );

        $t->warned = $now;
    }

    ## probe_unreachable() - a slot in use did not answer its probe. one miss is
    ## normal, ssh can be slow to log in while the job keeps every core busy, so
    ## warn after probe:fail_consecutive in a row, and again every probe:repeat
    ## seconds while it lasts: the job may be stalled, or its instance hung or
    ## down

    function probe_unreachable( $slot, $v, $t, $error, $now, $repeat ) {
        $need = isset( $this->em_config->probe->fail_consecutive ) ? $this->em_config->probe->fail_consecutive : 3;

        if ( !$t->fail ) {
            $t->fail_since = $now;
        }

        ++$t->fail;

        if ( $t->fail < $need ) {
            return;
        }

        if ( $t->fail_warned && ( $repeat <= 0 || $now - $t->fail_warned < $repeat ) ) {
            return;
        }

        $this->echo_warn( sprintf( "slot %s %s: %d probes in a row failed over %s, last: %s. held %s by %s, ip %s. the job may be stalled or its instance down; if the job is gone: php em_client.php --release %s"
                                   ,$slot
                                   ,$t->fail_warned ? "still unreachable" : "unreachable"
                                   ,$t->fail
                                   ,$this->dur_text( $now - $t->fail_since )
                                   ,$error
                                   ,$this->held_for( isset( $v->acquired_at ) ? $v->acquired_at : 0 )
                                   ,$t->tag
                                   ,isset( $v->network ) ? $v->network : "?"
                                   ,escapeshellarg( $t->tag ) ) );

        $t->fail_warned = $now;
    }

    ## probe_reachable() - a slot in use answered: end any unreachable run, with
    ## an all clear if it was long enough to warn about. decided on the run, not
    ## on fail_warned: after a restart the warning came from the previous process

    function probe_reachable( $slot, $t, $now ) {
        $need = isset( $this->em_config->probe->fail_consecutive ) ? $this->em_config->probe->fail_consecutive : 3;

        if ( $t->fail >= $need ) {
            $this->log( sprintf( "CLEARED: slot %s answering probes again after %s, %d failed probes"
                                 ,$slot, $this->dur_text( $now - $t->fail_since ), $t->fail ) );
        }

        $t->fail        = 0;
        $t->fail_since  = 0;
        $t->fail_warned = 0;
    }

    ## probe_track_new() - fresh low cpu tracking for a slot.
    ##
    ## with $seed, rebuild the job's trailing low stretch from the probe history.
    ## only done the first time this process sees a slot, i.e. after a restart:
    ## a job that has just changed hands has no history worth reading. the time
    ## of the last warning is not recoverable, so a restart during an ongoing
    ## stretch warns again straight away, which is right for an unresolved
    ## problem.

    function probe_track_new( $slot, $tag, $seed ) {
        $t = (object)[ "tag" => $tag, "low" => 0, "since" => 0, "warned" => 0
                       ,"fail" => 0, "fail_since" => 0, "fail_warned" => 0 ];

        if ( !$seed
             || !strlen( $tag )
             || !isset( $this->em_config->probe->history )
             || !file_exists( $this->em_config->probe->history )
             || !( $fh = fopen( $this->em_config->probe->history, "r" ) ) ) {
            return $t;
        }

        $min = $this->em_config->probe->min_pct;

        while ( ( $line = fgets( $fh ) ) !== false ) {
            if ( !preg_match( '/^(\S+ \S+) slot=(\S+) .*\bpct=(\S+) .*\btag=(\S+)( error=)?/', $line, $m )
                 || $m[ 2 ] != $slot
                 || $m[ 4 ] !== $tag ) {
                continue;
            }

            ## a failed probe extends the unreachable run and leaves the low
            ## run alone; a reading ends the unreachable run

            if ( !is_numeric( $m[ 3 ] ) ) {
                if ( !empty( $m[ 5 ] ) ) {
                    if ( !$t->fail ) {
                        $t->fail_since = strtotime( $m[ 1 ] );
                    }
                    ++$t->fail;
                }
                continue;
            }

            $t->fail       = 0;
            $t->fail_since = 0;

            if ( $m[ 3 ] < $min ) {
                if ( !$t->low ) {
                    $t->since = strtotime( $m[ 1 ] );
                }
                ++$t->low;
            } else {
                $t->low   = 0;
                $t->since = 0;
            }
        }

        fclose( $fh );

        $this->debug_echo( sprintf( "probe_track_new: slot %s seeded with %d low readings, %d failed probes from history", $slot, $t->low, $t->fail ) );

        return $t;
    }

    ## api_unavailable() - a server list failed, so openstack is down or
    ## degraded. mail when that starts and every api:repeat seconds while it
    ## lasts, only log the attempts in between, and have status() hold off pool
    ## changes for api:retry seconds before the next attempt

    function api_unavailable( $project, $detail ) {
        $now    = time();
        $retry  = isset( $this->em_config->api->retry )  ? $this->em_config->api->retry  : 300;
        $repeat = isset( $this->em_config->api->repeat ) ? $this->em_config->api->repeat : 3600;

        if ( !$this->api_down ) {
            $this->api_down = (object)[ "since" => $now, "failures" => 0, "warned" => 0, "next_try" => 0 ];
        }

        $d = $this->api_down;
        ++$d->failures;
        $d->next_try = $now + $retry;

        if ( !$d->warned ) {
            $this->echo_warn( sprintf( "reload_state() could not list servers for project %s, leaving state untouched and holding off pool changes, retrying every %ds"
                                       ,$project, $retry ), $detail );
            $d->warned = $now;
        } else if ( $repeat > 0 && $now - $d->warned >= $repeat ) {
            $this->echo_warn( sprintf( "openstack still unavailable after %s, %d failed attempts, still holding off pool changes"
                                       ,$this->dur_text( $now - $d->since ), $d->failures ), $detail );
            $d->warned = $now;
        } else {
            ## no detail: it could contain a word that mails
            $this->log( sprintf( "openstack still unavailable, attempt %d", $d->failures ) );
        }
    }

    ## api_answering() - a server list worked: end any outage, and say so
    function api_answering() {
        if ( !$this->api_down ) {
            return;
        }

        $d = $this->api_down;
        $this->api_down = null;

        $this->log( sprintf( "CLEARED: openstack answering again after %s, %d failed attempts, pool changes resume"
                             ,$this->dur_text( time() - $d->since ), $d->failures ) );
    }

    ## refresh_if_due() - list servers when nothing has for api:refresh seconds.
    ## the state is otherwise refreshed only after a pool change, so a status
    ## that changes on its own (a reboot, an instance gone to ERROR, a shelve
    ## that half happened during an outage) goes unseen until the next change.
    ## not during an outage: status() already retries every api:retry seconds

    function refresh_if_due() {
        $refresh = isset( $this->em_config->api->refresh ) ? $this->em_config->api->refresh : 600;

        if ( $this->api_down || $refresh <= 0 || time() - $this->last_listed < $refresh ) {
            return false;
        }

        return $this->reload_state();
    }

    ## listing_unsure() - a server list could not vouch for slot $k, warn once
    function listing_unsure( $k, $msg ) {
        if ( empty( $this->listing_warned[ $k ] ) ) {
            $this->echo_warn( $msg );
            $this->listing_warned[ $k ] = time();
        }
    }

    ## listing_sure() - slot $k is listed normally, close any warning about it
    function listing_sure( $k ) {
        if ( !empty( $this->listing_warned[ $k ] ) ) {
            unset( $this->listing_warned[ $k ] );
            $this->log( "CLEARED: slot $k is listed normally again" );
        }
    }

    ## dur_text() - a duration for messages: "2d 03h", "3h 05m", "12m", "40s"
    function dur_text( $s ) {
        if ( $s >= 86400 ) {
            return sprintf( "%dd %02dh", intdiv( $s, 86400 ), intdiv( $s % 86400, 3600 ) );
        }
        if ( $s >= 3600 ) {
            return sprintf( "%dh %02dm", intdiv( $s, 3600 ), intdiv( $s % 3600, 60 ) );
        }
        if ( $s >= 60 ) {
            return sprintf( "%dm", intdiv( $s, 60 ) );
        }
        return sprintf( "%ds", $s );
    }

    ## held_for() - how long a slot has been held, from acquired_at
    function held_for( $ts ) {
        if ( !$ts || ( $s = time() - $ts ) < 0 ) {
            return "-";
        }
        return sprintf( "%dd %02dh", intdiv( $s, 86400 ), intdiv( $s % 86400, 3600 ) );
    }

    ## probe_instance() - ask the instance what it is actually doing.
    ## the 15 minute load average is the signal, not a container check:
    ## finalmodel.php runs one waxsis container per frame, so an instantaneous
    ## check reads idle in the gaps between frames

    function probe_instance( $ip, &$load, &$waxsis, &$cores = null ) {
        $load   = "?";
        $waxsis = "?";
        $cores  = "?";

        ## empty unless a probe was actually tried and failed: not being able
        ## to probe at all says nothing about the instance
        $this->probe_error = "";

        if ( !$this->appconfig_loaded ) {
            $this->load_appconfig();
        }

        $p = $this->appconfig->resources->oscluster->properties;

        if ( !isset( $p->sshidentity ) || !isset( $p->sshadmin ) ) {
            $this->debug_echo( "probe_instance: sshidentity or sshadmin not defined, cannot probe" );
            return false;
        }

        $probe_timeout         = 6;
        $probe_connect_timeout = 4;

        ## nproc so the reading can be a fraction of the machine rather than a
        ## bare number: a flavor change must not silently invalidate it

        $remote = 'echo L $(cut -d" " -f3 /proc/loadavg); echo C $(nproc); if docker ps >/dev/null 2>&1; then echo W $(docker ps | grep -ci waxsis); else echo W ?; fi';

        ## UserKnownHostsFile=/dev/null is not optional here. shelve and unshelve
        ## recycle addresses, so the same ip legitimately belongs to a different
        ## instance with a different host key over time; persisting keys would
        ## eventually fail every probe against a recycled address.
        ##
        ## LogLevel=ERROR suppresses the "Permanently added ... to the list of
        ## known hosts" line at the source. It used to be swallowed by sending
        ## all of stderr to /dev/null, which threw away the real errors too, so
        ## an unreachable instance reported "?" with no reason attached.

        $cmd = sprintf( "timeout %d ssh -i %s -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no -o LogLevel=ERROR -o BatchMode=yes -o ConnectTimeout=%d %s %s 2>&1"
                        ,$probe_timeout
                        ,escapeshellarg( $p->sshidentity )
                        ,$probe_connect_timeout
                        ,escapeshellarg( "$p->sshadmin@$ip" )
                        ,escapeshellarg( $remote )
            );

        $this->debug_echo( "probe_instance: $cmd" );

        ## deliberately not run_cmd(): an unreachable instance is an expected
        ## outcome here, not something to log as a command failure

        $out = [];
        exec( $cmd, $out, $code );

        $noise = [];

        foreach ( $out as $line ) {
            if ( preg_match( '/^L\s+(\S+)/', $line, $m ) ) {
                $load = $m[ 1 ];
            } else if ( preg_match( '/^C\s+(\d+)/', $line, $m ) ) {
                $cores = $m[ 1 ];
            } else if ( preg_match( '/^W\s+(\S+)/', $line, $m ) ) {
                $waxsis = $m[ 1 ] == "?" ? "?" : ( intval( $m[ 1 ] ) > 0 ? "yes" : "no" );
            } else if ( strlen( trim( $line ) ) ) {
                $noise[] = trim( $line );
            }
        }

        if ( $load == "?" ) {
            $this->probe_error = count( $noise )
                               ? implode( " | ", $noise )
                               : ( $code == 124 ? "timed out after {$probe_timeout}s" : "no answer, ssh exit $code" );
            return false;
        }

        $this->probe_error = "";
        return true;
    }

    function status( $update = false, $probe = false ) {
        $this->debug_echo( "em_openstack: status()" );

        ## while openstack is unavailable every pool change fails, and every
        ## failure mails, every service loop. so report only, and try a server
        ## list again every api:retry seconds: the first one that works ends the
        ## outage, refreshes the state, and pool changes resume in this same loop

        if ( $update && $this->api_down
             && ( time() < $this->api_down->next_try || !$this->reload_state() ) ) {
            $update = false;
        }

        $this->em_state->read_lock();

        if ( $this->debug ) {
            debug_json( "status em_state", $this->em_state->state );
        }

        if ( !isset( $this->em_state->state ) ) {
            $this->em_state->release_lock();
            $this->error_exit( "status: em_state->state not set?" );
        }

        $needed_idle = $this->em_config->flavors->{$this->flavor}->idle;
        $maximum     = $this->em_config->flavors->{$this->flavor}->maximum;

        $idle       = [];
        $in_use     = [];
        $in_use_ids = [];
        $active     = [];
        $shelved    = [];
        $error      = [];
        $build      = [];
        $unknown    = [];
        $all        = [];
        $missing    = [];
        $instances  = [];

        for ( $i = 0; $i < $maximum; ++$i ) {
            if ( !isset( $this->em_state->state->$i ) ) {
                $missing[] = $i;
            }
        }

        foreach ( (array) $this->em_state->state as $k => $v ) {
            $all[] = $k;

            $instances[ $k ] = (object)[
                "ip"      => isset( $v->network )    ? $v->network    : "?"
                ,"status" => isset( $v->status )     ? $v->status     : "?"
                ,"use"    => isset( $v->use_status ) ? $v->use_status : "?"
                ,"tag"    => empty( $v->use_id )     ? ""             : $v->use_id
                ,"held"   => $this->held_for( isset( $v->acquired_at ) ? $v->acquired_at : 0 )
                ,"load"   => "-"
                ,"waxsis" => "-"
                ,"cores"  => "-"
                ,"pct"    => "-"
                ];

            switch( $v->status ) {
                case "ACTIVE" : {
                    $active[] = $k;
                    if ( $v->use_status == "idle" ) {
                        $idle[] = $k;
                    } else {
                        $in_use[]     = $k;
                        $in_use_ids[] = empty( $v->use_id ) ? 'none' : $v->use_id;
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

        ## per instance detail, sorted by slot number

        ksort( $instances, SORT_NUMERIC );

        ## probing is one ssh per instance, so only on request and only where
        ## there is a running OS to answer

        $probe_errors = [];

        if ( $probe ) {
            foreach ( $instances as $k => $v ) {
                if ( $v->status != "ACTIVE" ) {
                    continue;
                }

                if ( !$this->probe_instance( $v->ip, $load, $waxsis, $cores ) && strlen( $this->probe_error ) ) {
                    $probe_errors[] = sprintf( "  slot %-4s %-15s %s", $k, $v->ip, $this->probe_error );
                }

                $v->load   = $load;
                $v->waxsis = $waxsis;
                $v->cores  = $cores;
                $v->pct    = $this->load_pct( $load, $cores );
            }
        }

        $fmt = $probe
             ? "%-4s %-15s %-17s %-6s %7s %-5s %5s %-6s %-8s %s\n"
             : "%-4s %-15s %-17s %-6s %-8s %s\n";

        $instance_table = $probe
                        ? sprintf( $fmt, "slot", "ip", "status", "use", "load15", "cores", "%cpu", "waxsis", "held", "tag" )
                        : sprintf( $fmt, "slot", "ip", "status", "use", "held", "tag" );

        foreach ( $instances as $k => $v ) {
            $instance_table .= $probe
                             ? sprintf( $fmt, $k, $v->ip, $v->status, $v->use, $v->load, $v->cores
                                        ,$v->pct == "-" || $v->pct == "?" ? $v->pct : $v->pct . "%", $v->waxsis, $v->held, $v->tag )
                             : sprintf( $fmt, $k, $v->ip, $v->status, $v->use, $v->held, $v->tag );
        }

        if ( count( $probe_errors ) ) {
            $instance_table .= "\nprobe failures:\n" . implode( "\n", $probe_errors ) . "\n";
        }

        if ( $update ) {
            $do_reload_state = false;
            while ( count( $error ) ) {
                $k = array_shift( $error );
                ## simply warn & remove the instance, new instance will be created next loop
                $this->delete_instance( $k );
                $do_reload_state = true;
            }
                
            ## a start can fail with openstack answering: no capacity, no
            ## quota. retried every loop it fails and mails every loop, so after
            ## one fails wait api:retry seconds before the next

            $start_now = $instances_to_start > 0 && time() >= $this->start_retry_at;

            if ( $start_now
                 || $instances_to_idle > 0 ) {
                $this->debug_echo( "updating.... (to start $instances_to_start, to idle $instances_to_idle) " );
                $do_reload_state = true;
                while (
                    $start_now
                    && $instances_to_start > 0
                    && count( $shelved )
                    ) {
                    $k = array_shift( $shelved );
                    if ( $this->unshelve( $k ) ) {
                        ## ok
                        --$instances_to_start;
                    } else if ( !$this->reload_state() ) {
                        ## openstack itself is down, so every further change
                        ## fails and mails too. the outage warning covers it
                        break;
                    }
                }
                while (
                    $start_now
                    && $instances_to_start > 0
                    && count( $missing )
                    && !$this->api_down ) {
                    $k = array_shift( $missing );
                    if ( isset( $this->em_state->state->$k ) ) {
                        $this->echo_warn( "trying to launch an instance that already exists!" );
                    } else {
                        if ( $this->launch_one( $k ) ) {
                            ## ok
                            --$instances_to_start;
                        } else {
                            ## a boot that fails fails the same way for every
                            ## slot number, so do not try them all. the list
                            ## tells an outage from a failure of its own
                            $this->reload_state();
                            break;
                        }
                    }
                }                    
                if ( $start_now && $instances_to_start > 0 && !$this->api_down ) {
                    $retry = isset( $this->em_config->api->retry ) ? $this->em_config->api->retry : 300;
                    $this->echo_warn( "could not start expected instances, next try in {$retry}s" );
                    $this->start_retry_at = time() + $retry;
                }

                while ( $instances_to_idle > 0
                        && count( $idle )
                        && !$this->api_down ) {
                    $k = array_shift( $idle );
                    if ( $this->shelve( $k ) ) {
                        ## ok
                        --$instances_to_idle;
                    } else {
                        ## likely was acquired, assume needed, don't idle, worry about it next loop
                        --$instances_to_idle;
                        if ( !$this->reload_state() ) {
                            break;
                        }
                    }
                }

                if ( $instances_to_idle > 0 && !$this->api_down ) {
                    $this->echo_warn( "could not idle expected instances" );
                }
            }

            if ( $do_reload_state ) {
                ## unless this loop already found openstack down
                if ( !$this->api_down ) {
                    $this->reload_state();
                }
            } else {
                ## nothing to update
                return "nothing to update\n";
            }
        }
            
        return sprintf(
            "idle    %d [%s]\n"
            . "in_use  %d [%s] ids %s\n"
            . "active  %d [%s]\n"
            . "shelved %d [%s]\n"
            . "error   %d [%s]\n"
            . "build   %d [%s]\n"
            . "unknown %d [%s]\n"
            . "missing %d [%s]\n"
            . "\n"
            . "%s"
            . "\n"
            . "needed idle $needed_idle\n"
            . "maximum     $maximum\n"
            . "instances to start $instances_to_start\n"
            . "instances to idle $instances_to_idle\n"

            ,count( $idle ), implode( ",", $idle )
            ,count( $in_use ), implode( ",", $in_use ), implode( ", ", $in_use_ids )
            ,count( $active ), implode( ",", $active )
            ,count( $shelved ), implode( ",", $shelved )
            ,count( $error ), implode( ",", $error )
            ,count( $build ), implode( ",", $build )
            ,count( $unknown ), implode( ",", $unknown )
            ,count( $missing ), implode( ",", $missing )
            ,$instance_table

            );
    }

    ## delete_instance() - remove an instance (e.g. in ERROR state)
    function delete_instance( $number ) {
        $this->debug_echo( "em_openstack: delete_instance( $number )" );
        $this->log( "delete $number" );

        if ( !isset( $this->em_state->state )
             || !isset( $this->em_state->state->$number ) ) {
            $this->error_exit( "delete_instance() - invalid instance number $number" );
        }

        $id = $this->em_state->state->$number->id;

        $this->echo_warn( "em_openstack: deleting instance $number, id $id" );

        $this->project_putenv( $this->project );
        $cmd = "openstack server delete --wait $id";
        echo $this->run_cmd( $cmd );
    }

    ## error_instance() - put instance into ERROR state for testing
    function error_instance( $number ) {
        $this->debug_echo( "em_openstack: error_instance( $number )" );

        if ( !isset( $this->em_state->state )
             || !isset( $this->em_state->state->$number ) ) {
            $this->error_exit( "error_instance() - invalid instance number $number" );
        }

        $id = $this->em_state->state->$number->id;
        $this->echo_warn( "em_openstack: setting instance to ERROR state $number, id $id" );

        ## policy doesn't allow this on js2
        # $this->project_putenv( $this->project );
        # $cmd = "openstack server set --state error $id";
        # echo "$cmd";
        # $res = $this->run_cmd( $cmd );
        # echo $res;

        # fake state

        $this->em_state->read_lock();
        if ( !isset( $this->em_state->state )
             || !isset( $this->em_state->state->$number ) ) {
            $this->error_exit( "error_instance() - invalid instance number $number" );
        }
        $id = $this->em_state->state->$number->status = "ERROR";
        $this->em_state->save();
    }

    ## launch_one() - launch a new instance given a number 
    function launch_one( $number ) {
        $this->debug_echo( "em_openstack: launch_one( $number )" );
        $this->log( "launch $number" );

        $flavor = $this->flavor;

        if ( !$this->secrets_loaded ) {
            $this->load_secrets();
        }

        if ( !$this->global_putenv_done ) {
            $this->global_putenv();
        }

        if ( !isset( $this->appconfig->resources->oscluster->properties->sshuser ) ) {
            $this->error_exit( "resources:oscluster:properties:sshuser not defined in $this->em_config->files->appconfig" );
        }

        $os_sshuser = $this->appconfig->resources->oscluster->properties->sshuser;

        if ( !isset( $this->appconfig->resources->oscluster->properties->sshadmin ) ) {
            $this->error_exit( "resources:oscluster:properties:sshadmin not defined in $this->em_config->files->appconfig" );
        }

        $os_sshadmin = $this->appconfig->resources->oscluster->properties->sshadmin;

        if ( !isset( $this->appconfig->resources->oscluster->properties->sshidentity ) ) {
            $this->error_exit( "resources:oscluster:properties:sshidentity not defined in $this->em_config->files->appconfig" );
        }

        $os_sshidentity = $this->appconfig->resources->oscluster->properties->sshidentity;

        ## needs a unique number

        $uuid = "$this->idprefix-$this->id-$this->flavor-$number";

        # -------------------- set up OS image info --------------------

        $this->project_putenv( $this->project );

        if ( !isset( $this->appconfig->resources->oscluster->properties->key ) ) {
            $this->error_exit( "resources:oscluster:properties:key not defined in $this->em_config->files->appconfig" );
        }

        $key = $this->appconfig->resources->oscluster->properties->key;

        if ( !isset( $this->appconfig->resources->oscluster->properties->secgroup ) ) {
            $this->error_exit( "resources:oscluster:properties:secgroup not defined in $this->em_config->files->appconfig" );
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
            $this->error_exit( "resources:oscluster:properties:network not defined in $this->em_config->files->appconfig" );
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
                $this->echo_warn( "Errors found when trying to boot a virtual cluster node.", "command:\n$create_cmd\nreturned:\n" .  implode( "\n", $results_array ) );
                return false;
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
                    $this->echo_warn( "OpenStack: exactly one status not returned for image ' . $v . '" );
                    return false;
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
                        $this->echo_warn( "OpenStack: unknown status ' . $this_status . ' received for image ' . $v . '" );
                        return false;
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
                if ( @$fp = fsockopen( $os_ip[$v], 22, $errno, $errstr, 10 ) ) {
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
                $this->debug_echo("checking for ready $v $os_ip[$v] time waiting {$os_ready_time_waiting}s\n" );

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
                $this->debug_echo( `$cmd 2>&1` );
            }
            $this->debug_echo( "Timeout while waiting for nodes to go ready" );
            if ( isset( $tempfile ) ) {
                unlink( $tempfile );
            }
            $this->echo_warn( "Timeout while waiting for nodes to go ready. Please try again in a short while." );
            return false;
        }
        return true;
    }

    ## server start
    function server_start() {
        $this->debug_echo( "em_openstack: server_start()" );
        $this->log( "STARTUP : elastic manager server id $this->id flavor $this->flavor" );

        ## read current server state & config & determine what's needed
        $this->read_config();
        
        $this->reload_state();

        $this->debug_echo( $this->status() );

        $this->debug_echo( $this->status( true ) );

        $last_probe = 0;

        while( 1 ) {
            $this->refresh_if_due();

            $this->debug_echo( $this->status( true ) );

            ## probing is one ssh per active instance, far too slow for every
            ## service loop, so it runs on its own interval

            if ( isset( $this->em_config->probe->interval )
                 && time() - $last_probe >= $this->em_config->probe->interval ) {
                $last_probe = time();
                $this->probe_sample();
            }

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
            $this->error_exit( "error: no secrets->openstack->projects defined in " . $this->em_config->files->secrets );
        }
        
        if ( !isset( $this->secrets->openstack->projects->{$project} ) ) {
            $this->error_exit( "error: project missing from secrets secrets:openstack:projects:$project " . $this->em_config->files->secrets );
        }

        if ( !isset( $this->secrets->openstack->projects->{$project}->id ) ) {
            $this->error_exit( "error: project id missing from secrets secrets:openstack:projects:project:id " . $this->em_config->files->secrets );
        }

        if ( !isset( $this->secrets->openstack->projects->{$project}->secret ) ) {
            $this->error_exit( "error: project secret missing from secrets secrets:openstack:projects:$project:secret " . $this->em_config->files->secrets );
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
            $this->error_exit( "error: resources:oscluster:properties:region_name not defined $this->em_config->files->appconfig" );
        }

        putenv( "OS_REGION_NAME=" . $this->appconfig->resources->oscluster->properties->region_name );

        if ( !isset( $this->appconfig->resources->oscluster->properties->api_version ) ) {
            $this->error_exit( "error: resources:oscluster:properties:api_version not defined $this->em_config->files->appconfig" );
        }

        putenv( "OS_IDENTITY_API_VERSION=" . $this->appconfig->resources->oscluster->properties->api_version );

        if ( !isset( $this->appconfig->resources->oscluster->properties->auth_url ) ) {
            $this->error_exit( "error: resources:oscluster:properties:auth_url not defined $this->em_config->files->appconfig" );
        }

        putenv( "OS_AUTH_URL=" . $this->appconfig->resources->oscluster->properties->auth_url );

        if ( !isset( $this->appconfig->resources->oscluster->properties->auth_type ) ) {
            $this->error_exit( "error: resources:oscluster:properties:auth_type not defined $this->em_config->files->appconfig" );
        }

        putenv( "OS_AUTH_TYPE=" . $this->appconfig->resources->oscluster->properties->auth_type );

        if ( !isset( $this->appconfig->resources->oscluster->properties->interface ) ) {
            $this->error_exit( "error: resources:oscluster:properties:interface not defined $this->em_config->files->appconfig" );
        }

        putenv( "OS_INTERFACE=" . $this->appconfig->resources->oscluster->properties->interface );

        $this->global_putenv_done = true;

        if ( $this->debug ) {
            echo "env after global_putenv():\n";
            echo `env | grep OS_`;
            echo "\n";
        }
    }

    ## --- logfile functions ----
    function timestamp() {
        $date = new DateTimeImmutable();
        return $date->format( 'Y-m-d H:i:s' );
    }

    # write a message to the logfile
    function log( $msg ) {
        file_put_contents( $this->logfile, $this->timestamp() . " - $msg\n", LOCK_EX | FILE_APPEND );
        if ( isset( $this->notify )
             && preg_match( '/(ERROR|WARNING|STARTUP|SHUTDOWN|CLEARED)/', $msg ) ) {
            $tag = "";
            if ( preg_match( '/WARNING/', $msg ) ) {
                $tag .= " WARNING";
            }
            if ( preg_match( '/ERROR/', $msg ) ) {
                $tag .= " ERROR";
            }
            if ( preg_match( '/STARTUP/', $msg ) ) {
                $tag .= "startup";
            }
            if ( preg_match( '/SHUTDOWN/', $msg ) ) {
                $tag .= "shutdown";
            }
            if ( preg_match( '/CLEARED/', $msg ) ) {
                $tag .= " CLEARED";
            }
            $host = gethostname();
            mymail( $this->notify, "[$host][$this->id] $tag", $msg );
        }
    }

    ## os interaction

    ## echo_warn() - print warning, perhaps to stderr later.
    ## $detail was already being passed at one call site but the signature only
    ## took $msg, so PHP dropped it: 423 boot failures on 2025-08-04 were logged
    ## with no trace of the cause. the log is one line per entry and em_log.php
    ## parses it that way, so detail is flattened rather than wrapped.

    function echo_warn( $msg, $detail = "" ) {
        if ( strlen( $detail ) ) {
            $msg .= " [" . preg_replace( '/\s*\R\s*/', " | ", trim( $detail ) ) . "]";
        }
        $this->log( "WARNING: $msg" );
        echo "WARNING: $msg\n";
    }

    function run_cmd( $cmd, $exit_if_error = false, $array_result = false ) {
        exec( "$cmd 2>&1", $res, $this->run_cmd_last_error_code );
        if ( $this->run_cmd_last_error_code ) {
            $this->log( "run_cmd() $cmd failed error code $this->run_cmd_last_error_code, result : " . implode( "<br> ", $res ) );
        }

        if ( $exit_if_error && $this->run_cmd_last_error_code ) {
            $this->error_exit( "shell command [$cmd] returned result:<br>" . implode( "<br> ", $res ) . "<br>and with exit status '$this->run_cmd_last_error_code'" );
        }
        if ( !$array_result ) {
            return implode( "\n", $res ) . "\n";
        }
        return $res;
    }
    
    function error_exit( $msg, $cb = null ) {
        if ( is_callable( $cb ) ) {
            $cb();
        }

        if ( !strlen( $msg ) ) {
            $msg = "Empty error message!";
        }
        echo "ERROR, terminating : $msg\n";
        $this->log( "ERROR, terminating : $msg\n" );
        exit;
    }

    ## --- client functions ----

    function acquire( $flavor, $tag, &$number, &$ip, $wait = true ) {
        $this->debug_echo( "em_openstack: acquire( $flavor, '$tag' )" );
        $this->log( "em_client.php : acquire flavor $flavor tag $tag" );
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
                    $v->use_status  = "in use";
                    $v->use_id      = $tag;
                    $v->acquired_at = time();
                    $this->em_state->save();
                    $number = $k;
                    $ip     = $this->em_state->state->$k->network;
                    $this->log( "em_client.php : acquire flavor $flavor tag $tag, acquired $number ip $ip" );
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

    ## release() - free a slot, given its number or the tag of the job holding
    ## it. by hand the tag is the safer form: it can only free that job's slot,
    ## so acting on a stale warning cannot release a job that has taken the
    ## slot since. the log line always carries the number, em_log.php reads it

    function release( $number ) {
        $this->debug_echo( "em_openstack: release( $number )" );
        $this->em_state->read_lock();

        if ( !preg_match( '/^\d+$/', $number ) ) {
            $tag    = $number;
            $number = null;
            foreach ( (array) $this->em_state->state as $k => $v ) {
                if ( isset( $v->use_status ) && $v->use_status == "in use"
                     && isset( $v->use_id ) && $v->use_id === $tag ) {
                    $number = $k;
                    break;
                }
            }
            if ( $number === null ) {
                $this->em_state->release_lock();
                $this->echo_warn( "release $tag: no slot is held by that tag" );
                return false;
            }
        }

        $this->log( "em_client.php : release $number" );

        if ( !isset( $this->em_state->state->$number ) ) {
            $this->em_state->release_lock();
            $this->echo_warn( "release $number: no such slot" );
            return false;
        }

        if ( $this->em_state->state->$number->use_status != "in use" ) {
            $this->em_state->release_lock();
            $this->echo_warn( "release $number was not in use" );
            return false;
        }
        $this->em_state->state->$number->use_status  = "idle";
        $this->em_state->state->$number->use_id      = "";
        $this->em_state->state->$number->acquired_at = 0;
        $this->em_state->save();
        return true;
    }
}        
