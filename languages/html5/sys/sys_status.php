<?php
header('Content-type: application/json');
session_start(); 
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

$app_json = json_decode( file_get_contents( "__appconfig__" ) );
if ( !$app_json ) {
    $results[ "_message" ] = [ "icon" => "toast.png",
                               "text" => "<p>There appears to be an error with the appconfig.json file.</p>"
                               . "<p>This is a serious error which should be forwarded to the site adiminstrator.</p>" 
                               . "<p>Do not expect much to work properly until this is fixed.</p>" 
        ];
}

if ( isset( $app_json->submitblock ) ) {
    __~debug:submitblock{error_log( "submitblock found\n", 3, "/tmp/mylog" );}
    if ( isset( $app_json->submitblock->{"all"} ) &&
         isset( $app_json->submitblock->{"all"}->active ) &&
         $app_json->submitblock->{"all"}->active == 1 ) {
        __~debug:submitblock{error_log( "submitblock active all found\n", 3, "/tmp/mylog" );}
        $results[ "_message" ] = [ "icon" => "information.png",
                                   "text" => isset( $app_json->submitblock->{"all"}->text ) 
                                   ? $app_json->submitblock->{"all"}->text 
                                   : "Submission of jobs to $k is currently disabled."
            ];
    } else {
        __~debug:submitblock{error_log( "submitblock active all not found\n", 3, "/tmp/mylog" );}
        $msg = "";
        foreach ( $app_json->submitblock as $k => $v ) {
            if ( $k != "all" &&
                 isset( $v->active ) &&
                 $v->active == 1 ) {
                __~debug:submitblock{error_log( "submitblock active $k found\n", 3, "/tmp/mylog" );}
                $msg .= "<p>" . ( isset( $app_json->submitblock->{"$k"}->text ) 
                                  ? $app_json->submitblock->{"$k"}->text 
                                  : "Submission of jobs to $k is currently disabled." ) . "</p>";
            }
        }
        if ( strlen( $msg ) ) {
            $results[ "_message" ] = [ "icon" => "information.png",
                                       "text" => $msg ];
        }
    }
} else {
    __~debug:submitblock{error_log( "submitblock not found\n" . json_decode( $app_json, JSON_PRETTY_PRINT ) . "\n", 3, "/tmp/mylog" );}
}

if ( isset( $app_json->motd ) ) {
    if ( isset( $app_json->motd ) &&
         $app_json->motd->active == 1 ) {
        $motdtext = "";
        if ( isset( $app_json->motd->text ) ) {
            $motdtext .= $app_json->motd->text;
        }
        if ( isset( $app_json->motd->file ) &&
             is_readable( $app_json->motd->file ) ) {
            $motdtext .= ( strlen( $motdtext ) ? "<p><hr></p>" : "" ) . file_get_contents( $app_json->motd->file );
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
      if ( isset( $app_json->groups ) ) {
          $results[ "_groups" ] = $app_json->groups;
      } else {
          $results[ "_groups" ] = new stdClass();
      }
      $mongook = 1;
      try {
          $m = new MongoClient();
      } catch ( Exception $e ) {
          $results[ 'error' ] .= "Could not connect to the db " . $e->getMessage();
          $mongook = 0;
      }
      if ( $mongook ) {
          $coll = $m->__application__->users;
          if ( $doc = $coll->findOne( array( "name" => $_SESSION[ $window ][ 'logon' ] ), array( "groups" => 1 ) ) ) {
              if ( isset( $doc[ "groups" ] ) ) {
                  $results[ "_usergroups" ] = $doc[ "groups" ];
              } else {
                  $results[ "_usergroups" ] = [];
              }
          } else {
              $results[ "_usergroups" ] = [];
          }
          if ( __~usercolors{1}0 && $doc = $coll->findOne( array( "name" => $_SESSION[ $window ][ 'logon' ] ), array( "color" => 1 ) ) ) {
              $results[ "_color" ] = isset( $doc[ "color" ] ) ? $doc[ "color" ] : "";
          }
      }

      if ( 0 && __~xsedeproject{1}0 ) { // don't think we need this
          $mongook = 1;
          try {
              $m = new MongoClient();
          } catch ( Exception $e ) {
              $results[ 'error' ] .= "Could not connect to the db " . $e->getMessage();
              $mongook = 0;
          }
          if ( $mongook ) {
              if ( $doc = $coll->findOne( array( "name" => $_SESSION[ $window ][ 'logon' ] ), array( "xsedeproject" => 1 ) ) ) {
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

echo (json_encode($results));
exit();
?>
