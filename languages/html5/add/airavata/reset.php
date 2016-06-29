<?php 
require_once("registerUtils.php");

$usage = "usage: $argv[0] server gatewayId {hostport {FULL_RESET}}
resets airavata gateway gatewayId on server on optional thrift port hostport
if FULL_RESET keyword is given, the airavata server will remove all compute resources
";

if ( count( $argv ) > 1 && strtolower( substr( $argv[ 1 ], 0, 2 ) ) == '-h' ) {
   echo $usage;
   exit(254);
}

switch( count( $argv ) ) {
    case 3 : 
    {
        echo "will process gateway $argv[2] on server $argv[1]\n";
        airavata_reset( $argv[1], $argv[2] );
    }
    break;
    case 4 :
    {
        echo "will process gateway $argv[2] on server $argv[1] thrift port $argv[3]\n";
        airavata_reset( $argv[1], $argv[2], $argv[3] );
    }
    break;
    case 5 :
    {
        if ( $argv[ 4 ] == "FULL_RESET" ) {
            echo "will process gateway $argv[2] on server $argv[1] thrift port $argv[3] and clear compute resources\n";
            airavata_reset( $argv[1], $argv[2], $argv[3], $argv[4] );
        } else {
            echo $usage;
            exit(254);
        }
    }
    break;
    default : 
    {
        echo $usage;
        exit(254);
    }
    break;
}

?>
