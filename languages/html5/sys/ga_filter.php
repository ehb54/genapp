<?php

function ga_sanitize_validate( $modjson, $inputs, $modulename ) {

    __~debug:validate{error_log("\n================================================================================\n", 3, '/tmp/validatelog' );}
    __~debug:validate{error_log("                                   $modulename                                  \n", 3, '/tmp/validatelog' );}
    __~debug:validate{error_log("================================================================================\n\n", 3, '/tmp/validatelog' );}

    $format = "%-s |  %-s | %-s | %-s | %-s | %-s | %-s |\n";
    $sprint = sprintf( $format, "## request", "value", "type", "filter type" , "san_req?", "validation", "options" );
    __~debug:validate{error_log( $sprint ,3 , '/tmp/validatelog' );}

    $results[ '_status' ] = "complete";
    $results[ '_project' ] = "";

    $results[ 'output' ] = "success";

    $filter_data = file_get_contents( 'ga_filter_type.json', true ) ;
    $filter_json =  json_decode( $filter_data );
     
    if ( !isset( $filter_json->fields ) || !isset( $filter_json->filterconstant ) ) {
	$results[ "error" ] =  "missing fields or fiterconstant";
        echo (json_encode($results)); 
	exit();
    };

    $modjson_merge = [];

    if ( isset ( $modjson ) ) {
        if ( isset( $modjson->fields ) ) {
    	    foreach ( $modjson->fields as $k=>$v ) {
    	        if ( isset( $v->id ) && isset( $v->type) ) {
                    if ( $v->type == "radio" ) {
			$vid = $v->name;
		    } else {
			$vid = $v->id;
		    };    
		    if ( isset( $modjson_merge[ $vid ] ) ) {
                        continue;
		    };
		    $modjson_merge[ $vid ] = new stdClass;
		    $modjson_merge[ $vid ]->type = $v->type;
		    if ( isset( $v->pattern ) ) {
	                $modjson_merge[ $vid ]->pattern = $v->pattern;
		    };
		    if ( isset( $v->min ) ) {
                        $modjson_merge[ $vid ]->min = $v->min;
		    };
		    if ( isset( $v->max ) ) {
                        $modjson_merge[ $vid ]->max = $v->max;
                    };
		};
            };
    	};
    };

    if ( isset ( $filter_json->fields ) ) {
        foreach ( $filter_json->fields as $k=>$v ) {
	    if ( isset( $v->id ) && isset( $v->type) ) {  
	        $modjson_merge[ $v->id ] = new stdClass;
                $modjson_merge[ $v->id ]->type = $v->type;
                if ( isset( $v->pattern ) ) {
                    $modjson_merge[ $v->id ]->pattern = $v->pattern;
		};
		if ( isset( $v->min ) ) {
                    $modjson_merge[ $v->id ]->min = $v->min;
		};
		if ( isset( $v->max ) ) {
                    $modjson_merge[ $v->id ]->max = $v->max;
                };
            };
         };
    };

    $validate = [];
    $sanitize_requested = [];
    $sanitize = [];
    $req_types = [];
    $filter_name = [];
    $v_options = [];

    foreach ( $inputs as $k=>$v ) {

# extract key from repeater     
        $arrk = preg_split( "/[\-,]+/", $k );
        $len_arrk = count($arrk);
        $req_ids = $arrk [ $len_arrk - 1 ];
        $req_types[ $k ] = ""; 
        $req_v = $v;

	$options = [];

	$found_id = false;
        $found_altval = false;
        $found_html = false;

# keys with _selalt_: override req_ids
        $selalt = "_selaltval_";
        $lenselalt = strlen( $selalt );

        if ( !strncmp( $k, $selalt, $lenselalt ) ) {
                #$found_selalt = true;
                $found_id = true;
                $tmp_key = substr( $k, $lenselalt );
                $req_ids = "_selaltval";
                $options += array( "regexp" => "/^" . $tmp_key. "_altval". "$/" );
	};

# keys with _html_ that have html tags

	$selhtml = "_html_";
	$altval = "_altval";
	$lenselhtml = strlen( $selhtml );
	$lenaltval = strlen( $altval );
        if ( !strncmp( $k, $selhtml, $lenselhtml ) ) {
	    $found_id = true;
	    $found_html = true;
            $req_ids = "_html";    
	}  else {
            if ( preg_match("/_altval$/", $k ) ) {
                if ( $len_arrk == 1 ) {    
		    $found_id = true;
		    $req_ids = substr( $k, 0, -1*$lenaltval );
		} else {  
		    $arrk[ $len_arrk - 1 ] = substr( $arrk[ $len_arrk - 1 ] , 0, -1*$lenaltval );
		};
	    };
	};
# repeater

        if ( !( $found_id ) && $len_arrk > 1 ) {
            if ( preg_match( "/^[0-9]*$/", $arrk[ $len_arrk - 1 ] ) ) {
                $req_ids = $arrk [ $len_arrk - 2 ];
            };
	};

# _decodedpath : override req_ids 	
	$decodepath = "_decodepath";
	$lendecodepath = strlen( $decodepath );
        if ( !strncmp( $k, $decodepath, $lendecodepath ) ) {
                $found_id = true;
                $req_ids = $decodepath;
	};

# search type in module json
        $found_id = false;	
	foreach ( $modjson_merge as $new_k => $new_v ) {
    	    if ( $req_ids == $new_k ) {
		$req_types[ $k ] = $new_v->type;
		$found_id = true;
		if ( isset( $new_v->min ) ) { 
		    $options += array( "min_range" => $new_v->min ); 
		};
                if ( isset( $new_v->max ) ) {
                    $options += array( "max_range" => $new_v->max );
		};
		if ( isset( $new_v->pattern ) && !( isset( $options[ "regexp" ] ) ) ) {
                    $options += array( "regexp" => "/" . $new_v->pattern . "/" );
		};
                break;		
	    };
	}; 
    

# keys starting with jqg_jobgrid
        if ( substr( $k, 0, 12 ) == "jqg_jobgrid_") {
	    $req_types[ $k ] = "checkbox";
	    $found_id = true;
        };

# special case: colors pull
        $ke = count( explode( ":", $k ) );
        if ( $ke > 1 ) {
            $found_id = true;
            $req_types[ $k ] = "integer";
	};

	$found_filter_type = false;       
	$filter_option = [];
	$filter_name[ $k ] = '';
	foreach ( $filter_json->filterconstant as $fid ) { 
            #echo ( $fid->id . "\n" );
            if ( $req_types[ $k ] == $fid->id ) {
		$filter_name[ $k ] = $fid->type;
		if ( isset ( $fid->pattern ) && !isset( $options->regexp ) ) {
	            $options += array( "regexp" => "/" . $fid->pattern . "/" );
		};
		$v_options[ $k ] = array( "options" => $options );
		$found_filter_type = true;
		break;    
	    };
	};

#        error_log( " ** $k => " . $inputs[ $k ] . " " . $req_ids . " ". $req_types[ $k ] . json_encode( $options ) .  "\n" , 3, '/tmp/validatelog' ); 	

	$sanitize_requested[ $k ] = "N";
        $validate[ $k ] = "success";

        switch ( $filter_name[ $k ] ) {

            case "float":
                $sanitize_requested[ $k ] = "Y";    
		$v_sanitize = filter_var( $req_v, FILTER_SANITIZE_NUMBER_FLOAT );
		$sanitize[ $k ] = $v_sanitize ;

	        if ( isset ( $v_options[ $k ][ "options" ][ "min_range" ] ) ) {
                    if ( $a < $v_options[ $k ][ "options" ][ "min_range" ] ) {
			$validate[ $k ] = "failed";
			break;
                    };
		};	
		if ( isset ( $v_options[ $k ][ "options" ][ "max_range" ] ) ) {
                    if ( $a > $v_options[ $k ][ "options" ][ "max_range" ] ) {
			$validate[ $k ] = "failed";
			break;
                    };
                };
	        $vi = filter_var ( $v_sanitize, FILTER_VALIDATE_FLOAT, $v_options[ $k ] );	
#		if ( !( filter_var ( $v_sanitize, FILTER_VALIDATE_FLOAT, $v_options ) ) ) {
                if ( $vi === 0.0 || ! $vi === false ) {
		    $validate[ $k ] ="success";
		} else {
		    $validate[ $k ] = "failed";
		};
		break;
                
            case "integer":
                $sanitize_requested[ $k ] = "Y";    
		$v_sanitize = filter_var( $req_v, FILTER_SANITIZE_NUMBER_INT );
                $sanitize[ $k ] = $v_sanitize;

		$vi = filter_var( $v_sanitize, FILTER_VALIDATE_INT, $v_options[ $k ] );
		if ( $vi === 0 || ! $vi === false ) {
		    $validate[ $k ] = "success";
		} else { 
	            $validate[ $k ] = "failed";
		};
		break;

	    case "string":
	        if ( !( $req_v === "" ) && !$found_html) {
                    $sanitize_requested[ $k ] = "Y";     
		    $v_sanitize = filter_var( $req_v, FILTER_SANITIZE_STRING );
		    $sanitize[ $k ] =  $v_sanitize ;
		    if ( !( filter_var ( $v_sanitize, FILTER_VALIDATE_REGEXP, $v_options[ $k ] ) ) ) {
			    $validate[ $k ] = "failed"; 
		    };
		} else {
		    $validate[ $k ] = "success";
	        };	    
	        break;

	    case "string_array":
		$sanitize_requested[ $k ] = "Y";
		$sanitize[ $k ] = [];
		$validate_array = [];
                if  ( isset( $req_v ) && !( sizeof( $req_v ) == 0 ) ) {
		    $sanitize_requested[ $k ] = "Y"; 
                    foreach ( $req_v as $new_v ) {
                        $v_sanitize = filter_var( $new_v, FILTER_SANITIZE_STRING );
			array_push( $sanitize[ $k ], $v_sanitize );
			if ( ! (filter_var ( $v_sanitize, FILTER_VALIDATE_REGEXP, $v_options[ $k ] ) ) ) {
			    array_push( $validate_array, "failed" );
			} else {
			    array_push( $validate_array, "success" );
			};
		    };

		    if ( in_array( "failed", $validate_array ) ) {
			$validate[ $k ] = "failed";
		    } else {
			$validate[ $k ] = "success";
		    };  
                } else {
                    $validate[ $k ] = "success";
                };
		break;

            case "email":
		$sanitize_requested[ $k ] = "Y"; 
		$v_sanitize = filter_var( $req_v, FILTER_SANITIZE_EMAIL ); 
		$sanitize[ $k ] = $v_sanitize;
		if ( !(filter_var ( $v_sanitize, FILTER_VALIDATE_EMAIL, $v_options[ $k ] ) ) ) {
		    $validate[ $k ] = "failed";
		};
                break;

	    case "boolean":
		$sanitize_requested[ $k ] = "Y";
		$sanitize[ $k ] = $req_v;
#		$v_options[ $k ] = array ( "flags" => FILTER_NULL_ON_FAILURE );
#                if ( !( filter_var ( $req_v, FILTER_VALIDATE_BOOLEAN, $v_options[ $k ] ) ) ) {
#                if ( !( filter_var ( $req_v, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE ) ) ) {    
                if  ( !( ( $req_v == "true" ) || ( $req_v == "false" ) ) ) {
		    $validate[ $k ] = "failed"; 
		};
                break;

	    case "domain":
		$sanitize[ $k ] = $req_v;
                if ( ( !filter_var ( $req_v, FILTER_VALIDATE_DOMAIN, $v_options[ $k ] ) ) ) {
		    $validate[ $k ] = "failed" ; 
                };
		break;

            case "url":
		 $sanitize_requested[ $k ] = "Y";  
		 $v_sanitize = filter_var( $req_v, FILTER_SANITIZE_URL );
		 $sanitize[ $k ] = $v_sanitize;
		 if ( !( filter_var ( $req_v, FILTER_VALIDATE_URL, $v_options[ $k ] ) ) ) {
                    $validate[ $k ] = "failed";
                };
                break;

	    case "ip": 
		$sanitize[ $k ] = $req_v;    
                if ( !( filter_var ( $req_v, FILTER_VALIDATE_IP, $v_options[ $k ] ) ) ) {
	            $validate[ $k ] = "failed";
		};
                break;

	    case "mac":
		$sanitize[ $k ] = $req_v; 
                if ( !( filter_var ( $req_v, FILTER_VALIDATE_MAC, $v_options[ $k ] ) ) ) {
                    $validate[ $k ] = "failed";
                };
		break;
	    default:
		$sanitize[ $k ] = $req_v;
		$validate[ $k ] = "failed";
		break;
	};	
    };

    foreach ( $validate as $k => $v ) {
        $sprint = sprintf( $format, "## " . $k , $inputs[ $k ] , $req_types[ $k ], $filter_name[ $k ], $sanitize_requested[ $k ] ,  $v , json_encode( $v_options[ $k ] ) );    
	__~debug:validate{error_log( $sprint ,3 , '/tmp/validatelog' );}

	if ( isset( $sanitize[ $k ] ) && !( $sanitize[ $k ] == $inputs[ $k ] ) ) {
            __~debug:validate{error_log( "   WARNING: Input " . $inputs[ $k ] . " was sanitized to " . $sanitize[ $k ] .  "\n" , 3, '/tmp/validatelog' );}
	};

	if ( $v == "failed" ) {
            $results[ 'output' ] = "failed";
	    $results[ '_status' ] = "failed";
	    if ( $inputs[ $k ] == "" ) {
                $inputs[ $k ] = "empty" ;
            };
            $results[ "error" ] = "Invalid inputs " . $k . " => " . $inputs[ $k ] . " found\n";
	    __~debug:validate{error_log( "   WARNING: Invalid value " . $inputs[ $k ] . " for ". $k ." \n", 3, '/tmp/validatelog' );}
#	    break;
	  };
	    # Code must exit with echo ( json_encode($results) ) if Invalid inputs found. 
	    # exit();

    };
    __~debug:validate{error_log( "   _REQUEST =  \n" . json_encode( $inputs, JSON_PRETTY_PRINT ) ."\n" , 3, '/tmp/validatelog' );}
    return $results;
}
