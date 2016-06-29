<?php 
require_once("registerUtils.php");

$usage = "usage: $argv[0] {server {port}}
dumps airavata servier information from appconfig.json definitions
if server or port is provided, they will override appconfig.json definitions
";

if ( count( $argv ) > 1 && strtolower( substr( $argv[ 1 ], 0, 2 ) ) == '-h' ) {
   echo $usage;
   exit(254);
}

switch( count( $argv ) ) {
    case 1 : airavata_dump(); break;
    case 2 : airavata_dump( $argv[1] ); break;
    case 3 : airavata_dump( $argv[1], $argv[2] ); break;
    default : echo $usage; exit(254); break;
}

?>
