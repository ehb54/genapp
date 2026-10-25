<?php
# test image: finish an application's appconfig.json the way a site administrator does after getapp.pl
#  - messaging settings from $GENAPP/etc/config.json that getapp.pl does not copy (tcprport, tcptimeout);
#    util/msg-tcpserver will not start without tcprport
#  - messaging.tcplisten, the address util/msg-tcpserver listens on for messages (on this branch it listens on
#    a random port when tcplisten is not set): tcphostip, where the jobs send them
#  - restricted.admin as a list (getapp.pl -admin writes a string, the php pages expect a list)
# usage: php test-appconfig.php APPDIR/appconfig.json ADMINUSER

$f   = $argv[ 1 ];
$app = json_decode( file_get_contents( $f ) );
$cfg = json_decode( file_get_contents( getenv( "GENAPP" ) . "/etc/config.json" ) );

foreach ( $cfg->messaging as $k => $v ) {
    if ( !isset( $app->messaging->$k ) ) {
        $app->messaging->$k = $v;
    }
}
if ( !isset( $app->messaging->tcplisten ) ) {
    $app->messaging->tcplisten = $app->messaging->tcphostip;
}
$app->restricted = (object) [ "admin" => [ $argv[ 2 ] ] ];

file_put_contents( $f, json_encode( $app, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES ) . "\n" ) || exit( 1 );
