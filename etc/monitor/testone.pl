#!/usr/bin/perl

use Try::Tiny;
use File::Basename;
use File::Spec;
use JSON -support_by_pp;
require MIME::Lite;
use MIME::Base64;
use LWP::UserAgent;

$notes = "usage: $0 url

checks one url once

";

$url = shift || die $notes;


$debug = 1;

checkurl( $url );

sub checkurl {
# should be ok
    if ( $_[0] =~ /^ws/ ) {
        return checkwss( $_[0] );
    }

    my $ua = LWP::UserAgent->new();
    $ua->ssl_opts( verify_hostname => 0 );
    
    print "checking $_[0]\n" if $debug;
    my $response = $ua->get($_[0]);

    undef $lasterror;
    undef $lastresult;
    undef $lastresultbytes;
    
    if ($response->is_success) 
    {
        $lastresultbytes = length($response->decoded_content);
        $lastresult      = $response->decoded_content;
        print "checking $_[0] ok $lastresultbytes received\n" if $debug;
        return 1;
    } else {
        $lasterror = $response->status_line;
        print "checking $_[0] error $lasterror\n" if $debug;
        return 0;
    }
}

sub checkwss {
    print "checking wss $_[0]\n" if $debug;
    `websocat -k -q -uU $_[0] 2> /dev/null`;
    my $response = $?;
    print "checking wss $_[0] response '$response'\n" if $debug;
    
    undef $lasterror;
    undef $lastresult;
    undef $lastresultbytes;

    if ($response == 0 )
    {
        $lastresultbytes = 1;
        $lastresult      = "websocket ok";
        print "checking $_[0] ok $lastresultbytes received\n" if $debug;
        return 1;
    } else {
        $lasterror = "websocket error";
        print "checking $_[0] error $lasterror\n" if $debug;
        return 0;
    }
}

