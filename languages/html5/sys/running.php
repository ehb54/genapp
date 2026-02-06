<?php

{};

header('Content-type: application/json');
session_name( strtoupper( preg_replace('/[^a-zA-Z0-9_]+/', '_', "GENAPP___application__" ) ) ); session_start();

$results = (object)[];
$results->_status = 'complete';

if ( !sizeof( $_REQUEST ) ) {
    $results->error = "PHP code received no \$_REQUEST?";
    echo (json_encode($results));
    exit();
}

require_once "__docroot:html5__/__application__/ajax/ga_filter.php";

$modjson = json_decode( '__modulejson__' );
#$modjson = [];
$inputs_req = $_REQUEST;
# $validation_inputs = ga_sanitize_validate( $modjson, $inputs_req, '__menu:modules:id__' );

# if ( $validation_inputs[ "output" ] == "failed" ) {
#    $results = array( "error" => $validation_inputs[ "error" ] );
#    #    $results[ '_status' ] = 'failed';
#    #    echo ( json_encode( $results ) );
#    #    exit();
#};

if ( isset( $_REQUEST[ '_window' ] ) ) {
    $window = $_REQUEST[ '_window' ];
}
if ( !isset( $_SESSION[ $window ] ) ) {
    $_SESSION[ $window ] = array( "logon" => "", "project" => "" );
}

$results->_status = 'complete';

if ( !isset( $_SESSION[ $window ][ 'logon' ] ) ||
     !isset( $_REQUEST[ '_logon' ] ) ) {
    $results->_logon = "";
    echo (json_encode($results));
    exit();
}

require_once "__docroot:html5__/__application__/ajax/ga_db_lib.php";

if ( $_REQUEST[ '_logon' ] != $_SESSION[ $window ][ 'logon' ] ) {
    $savelogon = $_SESSION[ $window ][ 'logon' ];
    unset( $_SESSION[ $window ][ 'logon' ] );
    session_write_close();
    $results->_logon = "";
    $results->error = 'Possible security violation user mismatch. ';

    ga_db_open( true );

    $now = ga_db_output( ga_db_date() );

    $insert[ 'requestuser' ] = $_REQUEST[ '_logon' ];
    $insert[ 'sessionuser' ] = $savelogon;
    $insert[ 'remoteip'    ] = isset( $_SERVER[ 'REMOTE_ADDR' ] ) ? $_SERVER[ 'REMOTE_ADDR' ] : "not from an ip";
    $insert[ 'when'        ] = $now;

    ga_db_insert( 'security', '', $insert, [], true );

    require_once "../mail.php";
    $json = json_decode( file_get_contents( "__appconfig__" ) );

    mymail( $json->mail->admin, 'security alert __application__', "session timeout or possible security breach attempt on __application__\n" .
            'requestuser: ' . $insert[ 'requestuser' ] . "\n" .
            'sessionuser: ' . $insert[ 'sessionuser' ] . "\n" .
            'remoteip:    ' . $insert[ 'remoteip' ] . "\n" .
            'when:        ' . date('Y-m-d H:i:s', ga_db_date_secs( $insert[ 'when' ] ) ) . " UTC\n" .
            '' );

    echo (json_encode($results));
    exit();
}
session_write_close();

if ( !sizeof( $_REQUEST ) ) {
    $results[ 'error' ] = "PHP code received no \$_REQUEST?";
    echo (json_encode($results));
    exit();
}

$input = (object)$_REQUEST;

require_once "__docroot:html5__/__application__/ajax/ga_db_lib.php";

if ( !isset( $input->_project )
     || !isset( $input->_logon )
    ) {
    $results->error = 'Incorrect request';
    echo json_encode($results) . "\n";
}

# $ga_db_log_file = "/tmp/dblog";

## open db

$res = ga_db_open( true );

## get ids of running

$ids = [];

$res = ga_db_output( ga_db_find( 
                         "running"
                         ,''
                         ,[ 'user' => $input->_logon ]
                         ,[ '_id' => 1 ] 
                     ) );
foreach ( $res as $k => $v ) {
    $ids[] = $v->_id;
}

## return if nothing running for this user

if ( isset( $input->module ) ) {
    if ( !count( $ids ) ) {
        $results->_none = true;
        echo json_encode( $results );
        exit;
    }
    $res =  ga_db_output( ga_db_findOne( 
                              "jobs"
                              ,''
                              ,[ '_id' => ['$in' => $ids ], 'project' => $input->_project, 'module' => $input->module ]
                              ,[ "_id" => 1 ] 
                          ) 
        );
    if ( $res ) {
        $results->id = $res->_id;
    } else {
        $results->_none = true;
    }
} else {
    $res =  ga_db_output( ga_db_find( 
                              "jobs"
                              ,''
                              ,[ '_id' => ['$in' => $ids ], 'project' => $input->_project ]
                              ,[ "_id" => 1, 'module' => 1 ] 
                          ) 
        );

    $running = (object)[];

    foreach ( $res as $k => $v ) {
        ## should only have one running per module as we are in one project
        ## otherwise, no locking for that module
        $running->{$v->module} = $v->_id;
    }
    if ( !count( (array) $running ) ) {
        $results->_none = true;
    } else {
        $results->running = $running;
    }
}            
echo json_encode( $results );
exit;
