#!/usr/bin/perl

use IO::Socket;

$notes = "usage: $0 appname runningservername udphost udpport uuid pid
typically pid would be \$\$ for the current pid
";

$appname = shift;
$server  = shift;
$udphost = shift;
$udpport = shift;
$uuid    = shift;
$pid     = shift || die $notes;

my $sock = IO::Socket::INET->new( Proto => 'udp', PeerPort => $udpport, PeerAddr => $udphost );

$msg = <<EOT;
{"_app":"$appname","_uuid":"$uuid","_pid":$pid,"_where":"$server","_what":"remote pgid"}
EOT

print $msg;

$sock->send( $msg );

