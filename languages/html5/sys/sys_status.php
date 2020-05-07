<?php
header('Content-type: application/json');
session_start(); 

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

$appjson = json_decode( file_get_contents( "__appconfig__" ) );
if ( !$appjson ) {
    $results[ "_message" ] = [ "icon" => "toast.png",
                               "text" => "<p>There appears to be an error with the appconfig.json file.</p>"
                               . "<p>This is a serious error which should be forwarded to the site administrator.</p>" 
                               . "<p>Do not expect much to work properly until this is fixed.</p>" 
        ];
}

if ( isset( $appjson->submitblock ) ) {
    __~debug:submitblock{error_log( "submitblock found\n", 3, "/tmp/mylog" );}
    if ( isset( $appjson->submitblock->{"all"} ) &&
         isset( $appjson->submitblock->{"all"}->active ) &&
         $appjson->submitblock->{"all"}->active == 1 ) {
        __~debug:submitblock{error_log( "submitblock active all found\n", 3, "/tmp/mylog" );}
        $results[ "_message" ] = [ "icon" => "information.png",
                                   "text" => isset( $appjson->submitblock->{"all"}->text ) 
                                   ? $appjson->submitblock->{"all"}->text 
                                   : "Submission of jobs to $k is currently disabled."
            ];
    } else {
        __~debug:submitblock{error_log( "submitblock active all not found\n", 3, "/tmp/mylog" );}
        $msg = "";
        foreach ( $appjson->submitblock as $k => $v ) {
            if ( $k != "all" &&
                 isset( $v->active ) &&
                 $v->active == 1 ) {
                __~debug:submitblock{error_log( "submitblock active $k found\n", 3, "/tmp/mylog" );}
                $msg .= "<p>" . ( isset( $appjson->submitblock->{"$k"}->text ) 
                                  ? $appjson->submitblock->{"$k"}->text 
                                  : "Submission of jobs to $k is currently disabled." ) . "</p>";
            }
        }
        if ( strlen( $msg ) ) {
            $results[ "_message" ] = [ "icon" => "information.png",
                                       "text" => $msg ];
        }
    }
} else {
    __~debug:submitblock{error_log( "submitblock not found\n" . json_decode( $appjson, JSON_PRETTY_PRINT ) . "\n", 3, "/tmp/mylog" );}
}

if ( isset( $appjson->motd ) ) {
    if ( isset( $appjson->motd ) &&
         $appjson->motd->active == 1 ) {
        $motdtext = "";
        if ( isset( $appjson->motd->text ) ) {
            $motdtext .= $appjson->motd->text;
        }
        if ( isset( $appjson->motd->file ) &&
             is_readable( $appjson->motd->file ) ) {
            $motdtext .= ( strlen( $motdtext ) ? "<p><hr></p>" : "" ) . file_get_contents( $appjson->motd->file );
        }

        if ( strlen( $motdtext ) ) {
            if ( isset( $results[ "_message" ] ) ) {
                $results[ "_message" ][ "text" ] .= "<p><hr></p>$motdtext";
            } else {
                $results[ "_message" ] = [ "icon" => "information.png",
                                           "text" => $motdtext ];
            }
        }
    }
}

if ( isset( $_SESSION[ $window ][ 'logon' ] ) ) {
   if ( !isset( $_SESSION[ $window ][ 'app' ] ) ||
        $_SESSION[ $window ][ 'app' ] != "__application__" ) {
       unset( $_SESSION[ $window ][ 'app' ] );
       unset( $_SESSION[ $window ][ 'logon' ] );
       $results[ '_logon' ] = "";
       $results[ '_project' ] = "";
       __~xsedeproject{$results[ '_xsedeproject' ] = "";}
       echo (json_encode($results));
       exit();
   }
   $results[ '_logon' ] = $_SESSION[ $window ][ 'logon' ];
       
   if ( isset( $_REQUEST[ "_groups" ] ) ) {
      if ( isset( $appjson->groups ) ) {
          $results[ "_groups" ] = $appjson->groups;
      } else {
          $results[ "_groups" ] = new stdClass();
      }
      require_once "__docroot:html5__/__application__/ajax/ga_db_lib.php";
      $mongook = 1;
      if ( !ga_db_status( ga_db_open() ) ) {
          $results[ 'error' ] .= "Could not connect to the db " . $ga_db_errors;
          $mongook = 0;
      }
      if ( $mongook ) {
          if ( $doc = 
               ga_db_output(
                   ga_db_findOne(
                       'users',
                       '',
                       [ "name" => $_SESSION[ $window ][ 'logon' ] ], 
                       [ "groups" => 1 ]
                       )
               )
              ) {
              if ( isset( $doc[ "groups" ] ) ) {
                  $results[ "_usergroups" ] = $doc[ "groups" ];
              } else {
                  $results[ "_usergroups" ] = [];
              }
          } else {
              $results[ "_usergroups" ] = [];
          }
          if ( __~usercolors{1}0 
               && $doc = 
               ga_db_output( 
                   ga_db_findOne(
                       'users',
                       '',
                       [ "name" => $_SESSION[ $window ][ 'logon' ] ],
                       [ "color" => 1 ]
                   ) 
               ) 
              ) {
              $results[ "_color" ] = isset( $doc[ "color" ] ) ? $doc[ "color" ] : "";
          }
      }

      # is this correct? maybe down a couple levels?

      if ( __~xsedeproject{1}0 ) {
          $mongook = 1;
          if ( !ga_db_status( ga_db_open() ) ) {
              $results[ 'error' ] .= "Could not connect to the db " . $ga_db_errors;
              $mongook = 0;
          }
          if ( $mongook ) {
              if ( $doc = 
                   ga_db_output(
                       ga_db_findOne(
                           'users',
                           '',
                           [ "name" => $_SESSION[ $window ][ 'logon' ] ], 
                           [ "xsedeproject" => 1 ]
                       )
                   )
                  ) {
                  if ( isset( $doc[ 'xsedeproject' ] ) ) {
                      $results[ '_xsedeproject' ] = [];
                      foreach ( $doc[ 'xsedeproject' ] as $v ) {
                          foreach ( $v as $k2 => $v2 ) {
                              $results[ '_xsedeproject' ][] = $k2;
                          }
                      }
                  }
              }
          }
      }
  }
} else {
    $results[ '_logon' ] = "";
    $results[ '_project' ] = "";
    __~xsedeproject{$results[ '_xsedeproject' ] = "";}
}

if ( isset( $appjson->resourcedefault ) ) {
    $results[ '_resourcedefault' ] = $appjson->resourcedefault;
}
if ( __~xsedeproject{1}0 && isset( $appjson->resources ) ) {
    $results[ '_resourcexsedeproject' ] = [];
    foreach ( $appjson->resources as $k => $v ) {
        if ( isset( $v->properties ) && isset( $v->properties->xsedeproject ) ) {
                $results[ '_resourcexsedeproject' ][] = $k;
        }
    }
}

echo (json_encode($results));
exit();
