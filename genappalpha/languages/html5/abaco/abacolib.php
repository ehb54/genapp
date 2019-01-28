<?php

# all custom bits

include( '__docroot:html5__/__application__/vendor/rmccue/requests/Requests.php' );
$secrets = json_decode( file_get_contents( "__secrets__" ) );
$dockerhub       = (object) [];
$dockerhub->user = "__dockerhub:user__";
$dockerhub->id   = str_replace( ' ', '', "__dockerhub:id__" );
$appname         = "__application__";

# end custom bits

Requests::register_autoloader();

$results = [];

if ( $secrets == NULL ) {
    $results[ "_message" ] = [ "icon" => "toast.png",
                               "text" => "<p>Could not load configuration information to setup ABACO execution.</p>"
                               . "<p>This is a configuration error which should be forwarded to the site administrator.</p>" 
                               . "<p>ABACO submission will not work this is fixed.</p>" 
        ];
    $results[ "error" ] = "ABACO configuration failed";
    $results[ '_status' ] = 'failed';
    echo json_encode( $results );
    exit();
}

if ( !isset( $secrets->abaco ) ) {
    $results[ "_message" ] = [ "icon" => "toast.png",
                               "text" => "<p>Configuration information missing 'abaco' definition.</p>"
                               . "<p>This is a configuration error which should be forwarded to the site administrator.</p>" 
                               . "<p>ABACO submission will not work this is fixed.</p>" 
        ];
    $results[ "error" ] = "Configuration missing 'abaco' section";
    $results[ '_status' ] = 'failed';
    echo json_encode( $results );
    exit();
}

if ( !isset( $secrets->abaco->host ) ||
     !isset( $secrets->abaco->username ) ||
     !isset( $secrets->abaco->password ) ||
     !isset( $secrets->abaco->api_key ) ||
     !isset( $secrets->abaco->api_secret )
    ) {
    $results[ "_message" ] = [ "icon" => "toast.png",
                               "text" => "<p>Configuration information incomplete 'abaco' definition.</p>"
                               . "<p>This is a configuration error which should be forwarded to the site administrator.</p>" 
                               . "<p>ABACO submission will not work this is fixed.</p>" 
        ];
    $results[ "error" ] = "Configuration incomplete 'abaco' section";
    $results[ '_status' ] = 'failed';
    echo json_encode( $results );
    exit();
}

function container_name( $menu, $mod ) {
    global $dockerhub;
    global $appname;

    # name needs to match in docker/build_docker_footer.pl

    $results = [];

    if ( !strlen( $dockerhub->user ) ) {
        $results[ "error" ] = "directives:dockerhub:user not defined";
        $results[ '_status' ] = 'failed';
        return json_encode( $results );
    }

    $dhtag = "";
    if ( $dockerhub->id != '_' . '_dockerhub:id__' ) {
        $dhtag = $dockerhub->id;
    } else {
        $dhtag = strtolower( `hostname` );
        $dhtag = preg_replace( '/[^a-z0-9_.-]/', '', $dhtag );
    }
    if ( strlen( $dhtag ) ) {
        $dhtag .= "_";
    }

    # make container name

    # current docker:local resource specifier 
    $cname = strtolower( "genapp_${dhtag}$appname" );
    if ( strlen( $cname ) > 30 ) {
        $cname = substr( $cname, 0, 30 );
    }
    $tname = "${menu}-${mod}";

    if ( strlen( $tname ) > 128 ) {
        $tname = substr( $tname, 0, 128 );
    }
    
    $uname = "$cname:$tname";

    $uname = "__dockerhub:user__/$uname";

    return $uname;
}

function gettoken() {
    global $secrets;

    $results = [];

    try {
        $response = Requests::post( $secrets->abaco->host . "/token"
                                    ,[]
                                    ,[ 
                                        'username'    => $secrets->abaco->username
                                        ,'password'   => $secrets->abaco->password
                                        ,'grant_type' => 'password'
                                        ,'scope'      => 'PRODUCTION'
                                    ]
                                    ,[ 
                                        'auth' => [
                                            $secrets->abaco->api_key
                                            ,$secrets->abaco->api_secret
                                        ]
                                    ]
            );
    } catch ( Exception $e ) {
        $error = $e;
    }  

    if ( !isset( $error ) &&
         $response->status_code == 200 ) {
        $results = json_decode( $response->body );
        $results->_status = "success";
    } else {
        if ( isset( $error ) ) {
            $results[ "error" ] = $error->getMessage();
            $results[ '_status' ] = 'failed';
        } else {
            echo "error in response:" . 
            $results[ "error" ] = "Response error $response->status_code\n";
            $results[ '_status' ] = 'failed';
        }
    }
    return json_encode( $results );
}

function registoractor( $token, $cname, $id ) {
    global $secrets;

    $results = [];

    try {
        $response = Requests::post( $secrets->abaco->host . "/actors/v2"
                                    ,[
                                        'Authorization' => 'Bearer ' . $token
                                        ,'Content-Type' => 'application/json'
                                    ]
                                    ,json_encode(
                                        [
                                         'image' => $cname
                                         ,'name' => $cname
                                         ,'description' => $id
                                        ] )
            );
    } catch ( Exception $e ) {
        $error = $e;
    }  

    if ( !isset( $error ) &&
         $response->status_code == 200 ) {
        $results = json_decode( $response->body );
        $results->_status = "success";
    } else {
        if ( isset( $error ) ) {
            $results[ "error" ] = $error->getMessage();
            $results[ '_status' ] = 'failed';
        } else {
            echo "error in response:" . 
            $results[ "error" ] = "Response error $response->status_code\n";
            $results[ '_status' ] = 'failed';
        }
    }
    return json_encode( $results );
}

function getactors( $token ) {
    global $secrets;

    $results = [];

    try {
        $response = Requests::get( $secrets->abaco->host . "/actors/v2"
                                    ,[
                                        'Authorization' => 'Bearer ' . $token
                                        ,'Content-Type' => 'application/json'
                                    ]
            );
    } catch ( Exception $e ) {
        $error = $e;
    }  

    if ( !isset( $error ) &&
         $response->status_code == 200 ) {
        $results = json_decode( $response->body );
        $results->_status = "success";
    } else {
        if ( isset( $error ) ) {
            $results[ "error" ] = $error->getMessage();
            $results[ '_status' ] = 'failed';
        } else {
            echo "error in response:" . 
            $results[ "error" ] = "Response error $response->status_code\n";
            $results[ '_status' ] = 'failed';
        }
    }
    return json_encode( $results );
}

function getactor( $token, $actorid ) {
    global $secrets;

    $results = [];

    try {
        $response = Requests::get( $secrets->abaco->host . "/actors/v2/$actorid"
                                    ,[
                                        'Authorization' => 'Bearer ' . $token
                                        ,'Content-Type' => 'application/json'
                                    ]
            );
    } catch ( Exception $e ) {
        $error = $e;
    }  

    if ( !isset( $error ) &&
         $response->status_code == 200 ) {
        $results = json_decode( $response->body );
        $results->_status = "success";
    } else {
        if ( isset( $error ) ) {
            $results[ "error" ] = $error->getMessage();
            $results[ '_status' ] = 'failed';
        } else {
            echo "error in response:" . 
            $results[ "error" ] = "Response error $response->status_code\n";
            $results[ '_status' ] = 'failed';
        }
    }
    return json_encode( $results );
}

function deleteactor( $token, $actorid ) {
    global $secrets;

    $results = [];

    try {
        $response = Requests::delete( $secrets->abaco->host . "/actors/v2/$actorid"
                                      ,[
                                          'Authorization' => 'Bearer ' . $token
                                          ,'Content-Type' => 'application/json'
                                      ]
            );
    } catch ( Exception $e ) {
        $error = $e;
    }  

    if ( !isset( $error ) &&
         $response->status_code == 200 ) {
        $results = json_decode( $response->body );
        $results->_status = "success";
    } else {
        if ( isset( $error ) ) {
            $results[ "error" ] = $error->getMessage();
            $results[ '_status' ] = 'failed';
        } else {
            echo "error in response:" . 
            $results[ "error" ] = "Response error $response->status_code\n";
            $results[ '_status' ] = 'failed';
        }
    }
    return json_encode( $results );
}

function startexecution( $token, $actorid, $msg ) {
    global $secrets;

    $results = [];

    try {
        $response = Requests::post( $secrets->abaco->host . "/actors/v2/$actorid/messages"
                                    ,[
                                        'Authorization' => 'Bearer ' . $token
                                        ,'Content-Type' => 'application/json'
                                    ]
                                    ,json_encode( [
                                                      'message' => $msg
                                                  ] )
            );

    } catch ( Exception $e ) {
        $error = $e;
    }  

    if ( !isset( $error ) &&
         $response->status_code == 200 ) {
        $results = json_decode( $response->body );
        $results->_status = "success";
    } else {
        if ( isset( $error ) ) {
            $results[ "error" ] = $error->getMessage();
            $results[ '_status' ] = 'failed';
        } else {
            echo "error in response:" . 
            $results[ "error" ] = "Response error $response->status_code\n";
            $results[ '_status' ] = 'failed';
        }
    }
    return json_encode( $results );
}

function getexecution( $token, $actorid, $execid ) {
    global $secrets;

    try {
        $response = Requests::get( $secrets->abaco->host . "/actors/v2/$actorid/executions/$execid"
                                    ,[
                                        'Authorization' => 'Bearer ' . $token
                                        ,'Content-Type' => 'application/json'
                                    ]
            );

    } catch ( Exception $e ) {
        $error = $e;
    }  

    if ( !isset( $error ) &&
         $response->status_code == 200 ) {
        $results = json_decode( $response->body );
        $results->_status = "success";
    } else {
        if ( isset( $error ) ) {
            $results[ "error" ] = $error->getMessage();
            $results[ '_status' ] = 'failed';
        } else {
            echo "error in response:" . 
            $results[ "error" ] = "Response error $response->status_code\n";
            $results[ '_status' ] = 'failed';
        }
    }
    return json_encode( $results );
}

function getlog( $token, $actorid, $execid ) {
    global $secrets;

    try {
        $response = Requests::get( $secrets->abaco->host . "/actors/v2/$actorid/executions/$execid/logs"
                                    ,[
                                        'Authorization' => 'Bearer ' . $token
                                        ,'Content-Type' => 'application/json'
                                    ]
            );

    } catch ( Exception $e ) {
        $error = $e;
    }  

    if ( !isset( $error ) &&
         $response->status_code == 200 ) {
        $results = json_decode( $response->body );
        $results->_status = "success";
    } else {
        if ( isset( $error ) ) {
            $results[ "error" ] = $error->getMessage();
            $results[ '_status' ] = 'failed';
        } else {
            echo "error in response:" . 
            $results[ "error" ] = "Response error $response->status_code\n";
            $results[ '_status' ] = 'failed';
        }
    }
    return json_encode( $results );
}

function getexecutions( $token, $actorid ) {
    global $secrets;

    $results = [];

    try {
        $response = Requests::get( $secrets->abaco->host . "/actors/v2/$actorid/executions"
                                    ,[
                                        'Authorization' => 'Bearer ' . $token
                                        ,'Content-Type' => 'application/json'
                                    ]
            );

    } catch ( Exception $e ) {
        $error = $e;
    }  

    if ( !isset( $error ) &&
         $response->status_code == 200 ) {
        $results = json_decode( $response->body );
        $results->_status = "success";
    } else {
        if ( isset( $error ) ) {
            $results[ "error" ] = $error->getMessage();
            $results[ '_status' ] = 'failed';
        } else {
            echo "error in response:" . 
            $results[ "error" ] = "Response error $response->status_code\n";
            $results[ '_status' ] = 'failed';
        }
    }
    return json_encode( $results );
}

function getmessages( $token, $actorid ) {
    global $secrets;

    $results = [];

    try {
        $response = Requests::get( $secrets->abaco->host . "/actors/v2/$actorid/messages"
                                    ,[
                                        'Authorization' => 'Bearer ' . $token
                                        ,'Content-Type' => 'application/json'
                                    ]
            );

    } catch ( Exception $e ) {
        $error = $e;
    }  

    if ( !isset( $error ) &&
         $response->status_code == 200 ) {
        $results = json_decode( $response->body );
        $results->_status = "success";
    } else {
        if ( isset( $error ) ) {
            $results[ "error" ] = $error->getMessage();
            $results[ '_status' ] = 'failed';
        } else {
            echo "error in response:" . 
            $results[ "error" ] = "Response error $response->status_code\n";
            $results[ '_status' ] = 'failed';
        }
    }
    return json_encode( $results );
}
