<?php
header('Content-type: application/json');
session_name( strtoupper( preg_replace('/[^a-zA-Z0-9_]+/', '_', "GENAPP___application__" ) ) ); session_start();

require_once "__docroot:html5__/__application__/ajax/ga_filter.php";

$modjson = json_decode( '__modulejson__' );
$inputs_req = $_REQUEST;
$validation_inputs = ga_sanitize_validate( $modjson, $inputs_req, '__menu:modules:id__' );

if ( $validation_inputs[ "output" ] == "failed" ) {
    $results = array( "error" => $validation_inputs[ "error" ] );
#    $results[ '_status' ] = 'failed';
#    echo ( json_encode( $results ) );
#    exit();
};

$window = "";
if ( isset( $_REQUEST[ '_window' ] ) )
{
   $window = $_REQUEST[ '_window' ];
}

if ( !isset( $_SESSION[ $window ] ) )
{
   $_SESSION[ $window ] = array( "logon" => "", "project" => "" );
}

if ( isset( $_SESSION[ $window ][ 'project' ] ) )
{
  $results[ '_project' ] = $_SESSION[ $window ][ 'project' ];
} else {
  $results[ '_project' ] = "";
}
if ( isset( $_SESSION[ $window ][ 'logon' ] ) )
{ 
  $GLOBALS[ 'logon' ] = $_SESSION[ $window ][ 'logon' ];
  $results[ '_logon' ] = $_SESSION[ $window ][ 'logon' ];
} else {
  $results[ '_logon' ] = "";
  $results[ '_project' ] = "";
}
session_write_close();

if ( !sizeof( $_REQUEST ) )
{
    $results[ 'error' ] = "PHP code received no \$_REQUEST?";
    $results[ '_status' ] = 'failed';
    echo (json_encode($results));
    exit();
}

if ( !isset( $_REQUEST[ 'text1' ] ) || !strlen( $_REQUEST[ 'text1' ] ) )
{
//    $results[ 'error' ] = "You must provide a non-empty comment to submit feedback";
    $results[ '_message' ] = array( "icon" => "warning.png", "text" => "You must provide a non-empty comment to submit feedback" );
    $results[ '_status' ] = 'failed';
    echo (json_encode($results));
    exit();
}

__~debug:basemylog{error_log( "request\n" . print_r( $_REQUEST, true ) . "\n", 3, "/tmp/mylog" );}

require_once "../mail.php";
date_default_timezone_set( 'UTC' );
$json = json_decode( file_get_contents( "__appconfig__" ) );

$GLOBALS[ 'REMOTE_ADDR' ] = isset( $_SERVER[ 'REMOTE_ADDR' ] ) ? $_SERVER[ 'REMOTE_ADDR' ] : "not from an ip";

// $subject =  gethostname() . "/__application__ " . $_REQUEST[ 'level' ] . " feedback from " . $results[ '_logon' ] . "@" . $GLOBALS[ 'REMOTE_ADDR' ] . ( isset( $results[ '_project' ] ) ? " project " . $results[ '_project' ] : "" );

$subject =  "[" . gethostname() . "/__application__-feedback][" . $_REQUEST[ 'level' ] . "] '" . $_REQUEST[ 'subject' ] . "' " . $_REQUEST[ 'email' ];

$add = 
"\n" .
"subject : " . $_REQUEST[ 'subject' ] . "\n" .
"from    : " . $results[ '_logon' ] . "\n" .
"email   : " . $_REQUEST[ 'email' ] . "\n" .
"level   : " . $_REQUEST[ 'level' ] . "\n------------------------\n" .
$_REQUEST[ 'text1' ]
    ;


$data =
"project   : " . ( isset( $results[ '_project' ] ) ? $results[ '_project' ] : "no_project_specified" ) . "\n" .
"remote ip : " . $GLOBALS[ 'REMOTE_ADDR' ] . "\n" .
"browser   : " . $_REQUEST[ '_navigator' ] . "\n------------------------\n" .
// . "Events    : " . 
$_REQUEST[ '_eventlog' ] . "\n"
;

$ats = array( "json input" => "_args_", "command" => "_cmds_", "output" => "_stdout_", "error output" =>  "_stderr_" ); 

function ga_feedback_safe_component( $value )
{
    return is_string( $value ) &&
        preg_match( '/^[A-Za-z0-9][A-Za-z0-9._-]*$/', $value ) &&
        $value != "." && $value != "..";
}

function ga_feedback_path_is_within( $path, $root )
{
    return $path == $root || strpos( $path, $root . DIRECTORY_SEPARATOR ) === 0;
}

function ga_feedback_add_job_artifacts( $jobid, $jobdir, $logdir, $module, $run_field, $patterns, $max_depth, &$attachdata, &$attachinfo, &$attachment_state )
{
    $maximum_depth = 4;
    $maximum_files = 16;
    $maximum_file_bytes = 8 * 1024 * 1024;
    $maximum_total_bytes = 16 * 1024 * 1024;

    if ( !preg_match( '/^[A-Za-z][A-Za-z0-9_]*$/', $run_field ) ||
         !ga_feedback_safe_component( $module ) ||
         !is_int( $max_depth ) || $max_depth < 0 || $max_depth > $maximum_depth ) {
        $attachinfo .= "  job artifacts: rejected invalid application declaration\n";
        return;
    }

    $job_root = realpath( $jobdir );
    $args_file = $logdir . "/_args_" . $jobid;
    if ( $job_root === false || !is_file( $args_file ) || is_link( $args_file ) ) {
        $attachinfo .= "  job artifacts: selected job arguments unavailable\n";
        return;
    }

    $args_json = json_decode( file_get_contents( $args_file ), true );
    $run_name = is_array( $args_json ) && isset( $args_json[ $run_field ] ) ? $args_json[ $run_field ] : "";
    if ( !ga_feedback_safe_component( $run_name ) ) {
        $attachinfo .= "  job artifacts: selected job has no safe " . $run_field . " value\n";
        return;
    }

    $artifact_root = realpath( $job_root . DIRECTORY_SEPARATOR . $run_name . DIRECTORY_SEPARATOR . $module );
    if ( $artifact_root === false || !is_dir( $artifact_root ) || !ga_feedback_path_is_within( $artifact_root, $job_root ) ) {
        $attachinfo .= "  job artifacts: no completed run directory found\n";
        return;
    }

    $valid_patterns = array();
    foreach ( $patterns as $pattern ) {
        if ( preg_match( '/^[A-Za-z0-9._*?-]+$/', $pattern ) && strpos( $pattern, ".." ) === false ) {
            $valid_patterns[] = $pattern;
        }
    }
    if ( !count( $valid_patterns ) ) {
        $attachinfo .= "  job artifacts: no valid application patterns declared\n";
        return;
    }

    $args_mtime = filemtime( $args_file );
    $attached_for_job = 0;
    try {
        $iterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator( $artifact_root, FilesystemIterator::SKIP_DOTS ),
            RecursiveIteratorIterator::LEAVES_ONLY
        );
        foreach ( $iterator as $file_info ) {
            if ( $iterator->getDepth() > $max_depth || !$file_info->isFile() || $file_info->isLink() ) {
                continue;
            }
            $basename = $file_info->getFilename();
            $matched = false;
            foreach ( $valid_patterns as $pattern ) {
                if ( fnmatch( $pattern, $basename ) ) {
                    $matched = true;
                    break;
                }
            }
            if ( !$matched ) {
                continue;
            }
            $path = realpath( $file_info->getPathname() );
            if ( $path === false || !ga_feedback_path_is_within( $path, $artifact_root ) || isset( $attachment_state[ "seen" ][ $path ] ) ) {
                continue;
            }
            $size = filesize( $path );
            if ( $args_mtime !== false && filemtime( $path ) < $args_mtime ) {
                $attachinfo .= "  job artifact omitted (older than selected job): " . $basename . "\n";
            } elseif ( $attached_for_job >= $maximum_files || $size === false || $size > $maximum_file_bytes || $attachment_state[ "bytes" ] + $size > $maximum_total_bytes ) {
                $attachinfo .= "  job artifact omitted (attachment limit): " . $basename . "\n";
            } else {
                $contents = file_get_contents( $path );
                if ( $contents === false || strlen( $contents ) != $size ) {
                    $attachinfo .= "  job artifact omitted (could not read): " . $basename . "\n";
                } else {
                    $attachment_state[ "seen" ][ $path ] = true;
                    $attachment_state[ "bytes" ] += $size;
                    $attached_for_job++;
                    $attachdata[] = array( "data" => $contents, "name" => $jobid . "__" . $basename );
                    $attachinfo .= "  attach : job artifact as " . $jobid . "__" . $basename . "\n";
                }
            }
        }
    } catch ( UnexpectedValueException $exception ) {
        $attachinfo .= "  job artifacts: could not inspect run directory\n";
    }
}

$attach = array();
$attachinfo = "";

$attachdata = array();
__~feedbackjobattachmentpatterns{$feedback_job_attachment_state = array( "seen" => array(), "bytes" => 0 );}

if ( isset( $_REQUEST[ 'job1_altval' ] ) && count( $_REQUEST[ 'job1_altval' ] ) ) {
    require_once "../joblog.php";
__~debug:basemylog{error_log( "job1_altval found \n", 3, "/tmp/mylog" );}
    
    foreach ( $_REQUEST[ 'job1_altval' ] as $v ) {
__~debug:basemylog{error_log( "job1_altval checking for $v \n", 3, "/tmp/mylog" );}
        if ( getmenumodule( $v ) ) {
__~debug:basemylog{error_log( "job1_altval $v getmenumodule ok\n", 3, "/tmp/mylog" );}
            $attachinfo .= 
                "related job $v\n" .
                "  module : " . $GLOBALS[ "getmenumodule"        ] . "\n" .
                "  project: " . $GLOBALS[ "getmenumoduleproject" ] . "\n" .
                "  status : " . $GLOBALS[ "getmenumodulestatus"  ] . "\n" ;

            // attach log files

            $logdir = $GLOBALS[ "getmenumodulelogdir"  ];

            
            foreach ( $ats as $k1=>$v1 ) {
                $f = "$logdir/$v1$v";
__~debug:basemylog{error_log( "job1_altval $k1 $v1 $logdir checking $f\n", 3, "/tmp/mylog" );}
                if ( file_exists( $f ) ) {
                    $attachinfo .= "  attach : $k1 as $v1$v\n";
                    $attach[] = $f;
                }
            }
__~feedbackjobattachmentpatterns{$feedback_job_attachment_patterns = array_filter( array_map( 'trim', explode( ',', "__feedbackjobattachmentpatterns__" ) ) ); ga_feedback_add_job_artifacts( $v, $GLOBALS[ "getmenumoduledir" ], $logdir, $GLOBALS[ "module" ], "__feedbackjobattachmentrunfield__", $feedback_job_attachment_patterns, intval( "__feedbackjobattachmentmaxdepth__" ), $attachdata, $attachinfo, $feedback_job_attachment_state );}
        } else {
            $attachinfo .= 
                "Related job $v information not found in database\n";
__~debug:basemylog{error_log( "job1_altval $v getmenumodule FAILED\n", 3, "/tmp/mylog" );}
        }
        $attachinfo .= "------------------------\n";
    }
    //    $add .= $attachinfo;
    $attachdata[] = 
        array(
            "data" => $attachinfo
            ,"name" => "attachmentsummary.txt" );
}

$attachdata[] = 
    array(
        "data" => $data
        ,"name" => "eventlog.txt" );


if ( mymail_attach(
         $json->mail->feedback,
         $subject,
         $add,
         $attach,
         $attachdata
     ) )
{
    $results[ 'error' ]  = "Could not send email, mail server is down or not accepting requests";
    $results[ '_status' ] = 'failed';
} else {
    $results[ '_status' ] = 'complete';
    $results[ '-close2' ] = 1;
    $results[ '_message' ] = array( 'icon' => 'information.png', 'text' => 'Your feedback has been submitted.  Thank you.' );
}

echo (json_encode($results));
exit();
