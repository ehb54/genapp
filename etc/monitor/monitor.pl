#!/usr/bin/perl

use Try::Tiny;
use File::Basename;
use File::Spec;
use JSON -support_by_pp;
require MIME::Lite;
use Data::Dumper;
use MIME::Base64;
use LWP::UserAgent;

$mb = dirname( File::Spec->rel2abs( __FILE__ ) );

print "export MONITORBASE=$mb\n";

# --------------------- user config area ---------------------

$cf = "$mb/config.json";

die "$0: configuration file $cf does not exist\n" if !-e $cf;

my $json = {};
{
    my $f = $cf;
    open my $fh, $f || die "$0: can not open $f\n";
    my @ol = <$fh>;
    close $fh;
    my @l = grep !/^\s*#/ , @ol;
    my $l = join '', @l;
    eval {
        $json = decode_json( $l );
        1;
    } || do {
        my $e = $@;
        
        # figure out line #

        my ( $cp ) = $e =~ /at character offset (\d+) /;
        my $i;
        my $cpos = $cp;
        for ( $i = 0; $i < @ol; ++$i ) {
            next if $ol[ $i ] =~ /^\s*#/;
            $cpos -= length( $ol[ $i ] );
            last if $cpos < 0;
        }

        my $sline = $i - 2;
        my $eline = $i + 2;
        $sline = 0 if $sline < 0;
        $eline = @ol - 1 if $eline >= @ol;

        print "JSON Error in file $f near these lines:\n";
        for ( my $j = $sline; $j <= $eline; ++$j ) {
            my $uj = $j + 1;
            print "$uj: $ol[$j]";
            print "$uj: " .'^'x(length($ol[$j])) . "\n" if $j == $i;
        }
        die;
    };
}

# general debug
if ( $$json{ 'debug' } ) {
    $debug              = $$json{ 'debug' }{ 'main' }          if $$json{ 'debug' }{ 'main' };
# simulate cycle of bad responses
    $debug_testdown     = $$json{ 'debug' }{ 'testdown' }      if $$json{ 'debug' }{ 'testdown' };
# simulate cycle of bad responses skip
    $debug_testdownskip = $$json{ 'debug' }{ 'testdownskip' }  if $$json{ 'debug' }{ 'testdownskip' };
# debug some key detail
    $debug_keys         = $$json{ 'debug' }{ 'keys' }          if $$json{ 'debug' }{ 'keys' };
# short timings for debugging
    $do_short           = $$json{ 'debug' }{ 'shorttime' }     if $$json{ 'debug' }{ 'shorttime' };
# no actual mail for debugging
    $nomail             = $$json{ 'debug' }{ 'nomail' }        if $$json{ 'debug' }{ 'nomail' };
}

$fromemail = 'monitor@genapp.uthscsa.edu';

# these need to be merged
#@toemails = (
#    'emre@biochem.uthscsa.edu'
#    ,'curtis.family@mac.com'
#    );

#@check = (
#    'http://www.chem.utk.edu',
#    'https://sassie-web.chem.utk.edu/genapptest',
#    'https://somo.chem.utk.edu/genapptest',
#    'https://sassie-web.chem.utk.edu/sassie2',
#    'http://gw105.iu.xsede.org:8000/genapp'
#    );

die "$0: no monitors defined if $cf\n" if !$$json{ 'monitors' };

{
    my @req = ( 'check', 'to', 'from' );

    my $count;
    my $pos = 0;
    foreach my $i ( @{$$json{ 'monitors' }} ) {
        $count++;

        print "ref i is " . ref( $i ) . "\n";
        print to_json( $i, { utf8 => 1, pretty => 1 } );
        print "\n";

        foreach my $c ( @req ) {
            die "$0: monitor entry #$count missing required tag '$c'\n" . to_json( $i, { utf8 => 1, pretty => 1 } ) . "\n" if !$$i{ $c };
        }

        # build up data structures for monitoring
        $to[ $pos ] = join ',', @{$$i{ 'to' }};
        $from[ $pos ] = $$i{ 'from' };
        $this_check[ $pos ] = [];

        foreach my $j ( @{$$i{ 'check' }} ) {
            print "j is $j\n";
            push @check, $j;
            push $this_check[ $pos ], $j;
        }
        $pos++;
    }
}

for ( my $i = 0; $i < @to; ++$i ) {
    print "\$to[$i] = $to[$i]\n";
    print "ref for \@\$this_check[ $i ] " . ref( @{$this_check[ $i ]} ) . "\n";
    print "scalar for \@\$this_check[ $i ] " . scalar @{$this_check[ $i ]} . "\n";
    for ( my $j = 0; $j < @{$this_check[ $i ]}; ++$j ) {
        print " \t\$this_check[$i][$j] = $this_check[$i][$j]\n";
    }
    print "\n";
}
foreach my $i ( @check ) {
    print "checking $i\n";
}

$$json{ 'timing' } = {}  if !$$json{ 'timing' };

$approx_every_minutes          = $$json{ 'timing' }{ 'loop_minutes' }           ? $$json{ 'timing' }{ 'loop_minutes' }           : 12.7;
$sleep_before_rechecking_secs  = $$json{ 'timing' }{ 'before_rechecking_secs' } ? $$json{ 'timing' }{ 'before_rechecking_secs' } : 30;
$sleep_between_gets_secs       = $$json{ 'timing' }{ 'between_gets_secs' }      ? $$json{ 'timing' }{ 'between_gets_secs' }      : 10;  

if ( $do_short )
{
    $approx_every_minutes          = .1;  
    $sleep_before_rechecking_secs  = 2;
    $sleep_between_gets_secs       = 1;  
}

die "$0: $cf mail must be defined\n" if !$$json{ 'mail' };

if ( $$json{ 'mail' }{ 'smtp' } ) {
    $email_smtp_host = $$json{ 'mail' }{ 'smtp' }{ 'host' } ? $$json{ 'mail' }{ 'smtp' }{ 'host' } : die "$0: $cf mail:smtp:host must be defined if mail:smtp is defined\n";
    $email_smtp_user = $$json{ 'mail' }{ 'smtp' }{ 'user' } ? $$json{ 'mail' }{ 'smtp' }{ 'user' } : die "$0: $cf mail:smtp:user must be defined if mail:smtp is defined\n";
    $email_auth_pass = $$json{ 'mail' }{ 'smtp' }{ 'password' } ? decode_base64( $$json{ 'mail' }{ 'smtp' }{ 'password' } ) : die "$0: $cf mail:smtp:password must be defined if mail:smtp is defined\n";
} else {
    $sendmail++;
}

$subject_prefix = $$json{ 'subject' } ? "[" . $$json{ 'subject' } . "] " : '[WebMonitor] ';

if ( $debug ) {
    if ( $sendmail ) {
        print "sendmail active\n";
    } else {
        print "smtp active
email_smtp_host: $email_smtp_host
email_smtp_user: $email_smtp_user
email_auth_pass: $email_auth_pass
"   ;
    }
}

# ------------------- end user config area -------------------

$version = "Web monitor 0.6";

$| = 1;

$SIG{INT}  = \&signal_handler;
$SIG{TERM} = \&signal_handler;

sub signal_handler {
    print "signal $! caught, sending goodbye email\n";
    email_bye();
    die "shutdown\n";
}

foreach $k ( @check ) {
    $maxurllen = length ( $k ) if $maxurllen < length( $k );
}

sub do_send {
    my $from    = $_[0];
    my $to      = $_[1];
    my $subject = $_[2];
    my $body    = $_[3];

    if ( $nomail ) {
        print '-'x60 . "\n";
        print "do_send nomail active:
from   : $from
to     : $to
subject: $subject
body:
$body
"       ;
        print '-'x60 . "\n";
        return;
    }

    my $msg = MIME::Lite->new(
        From    => $from,
        To      => $to,
        Subject => $subject,
        Data    => $body
        );

    try {
        $sendmail ? $msg->send() : $msg->send( 'smtp', $email_smtp_host, AuthUser => $email_auth_user,  AuthPass => $email_auth_pass );
    } catch {
        print "message send error\n";
    }
}    

sub do_email {
# should be ok
    my $pos = $_[0];
    my $subject = $subject_prefix . ( $_[2] ? "ERRORS PRESENT" : "All OK" );
    $subject .= " : $version";

    do_send( $from[ $pos ], $to[ $pos ], $subject, $_[1] );
}

sub email_welcome {
# should be ok
    for ( my $i = 0; $i < @to; ++$i ) {
        my $subject = $subject_prefix . "Welcome ";
        $subject .= " : $version";
        $subject .= " : advisory startup summary";

        my $body = "$version advisory startup summary

The following websites are being monitored:
";
        $body .= join "\n", @{$this_check[ $i ]};

        my $approx_mins = sprintf( "%.1f minutes", 
                                   ( $approx_every_minutes * 60 + $sleep_before_rechecking_secs + $sleep_between_gets_secs * @check ) /
                                   60e0 );

        $body .= "

These will be scanned consecutively approximately every $approx_mins
and a report will be sent on failure or reactivation after failure.

This service is currently experimental.
";

        do_send( $from[ $i ], $to[ $i ], $subject, $body );
    }
}

sub email_bye {
# should be ok
    for ( my $i = 0; $i < @to; ++$i ) {
        my $subject = $subject_prefix . "Goodbye ";
        $subject .= " : $version";
        $subject .= " : advisory shutdown summary";

        my $body = "$version advisory shutdown summary

The following websites are now no longer being monitored:
";
        $body .= join "\n", @{$this_check[ $i ]};

        $body .= "

This is due to a shutdown of the service

This service is currently experimental.
";

        do_send( $from[ $i ], $to[ $i ], $subject, $body );
    }
}

email_welcome();

$badleft = $debug_testdown     if $debug_testdown;
$badskip = $debug_testdownskip if $debug_testdownskip;

sub checkurl {
# should be ok
    if ( $debug_testdown )
    {
        if ( $debug_testdownskip && $badskip-- > 0 ) {
        } else {
            if ( $badleft-- > 0 )
            {
                $lasterror = "this was a simulated error";
                $badskip = $debug_testdownskip if $debug_testdownskip;
                return 0;
            }
        }
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

sub out_keys {
    print '-'x40 . "\n" . $_[0] . "\n" . '-'x40 . "\n";
    print "fails : " . join( ' ', keys %fails ) . "\n";
    print "keys fails " . ( scalar keys %fails ) . "\n";
    print "msgs  : " . join( ' ', keys %msgs ) . "\n";;
    print "keys msgs " . ( scalar keys %msg ) . "\n";
    print "sendmsg : " . ( $sendmsg ? "true" : "false" ) . "\n";
    print '-'x40 . "\n";
}    


undef %oks;
undef %fails;

$tc = 0;
while ( 1 ) {

    print '='x60 . "\n";

    undef %sendmsg;
    undef %msgs;

    out_keys( "start" ) if $debug_keys;
    
    foreach $url ( @check ) {
        if ( checkurl( $url ) )
        {
            print "$url check ok\n" if $debug;
            if ( $fails{ $url } )
            {
                $msgs{ $url } = "Previously failed, now ok. Received " . $lastresultbytes . " bytes of data in response.";
                $sendmsg{ $url }++;
            }
            delete $fails{ $url };
            delete $failmsgs{ $url };
        } else {
            print "$url check fail\n" if $debug;
            $fails{ $url }++;
            $failmsgs{ $url } .= $lasterror;
            $msgs{ $url }     .= $lasterror;
        }
        
        sleep $sleep_between_gets_secs;
    }

    # check fails one more time

    sleep $sleep_before_rechecking_secs;

    print '-'x60 . "\n";
    print "rechecking\n" if $debug;

    foreach $url ( keys %fails ) {
        if ( checkurl( $url ) )
        {
            print "$url recheck ok\n" if $debug;
            if ( $fails{ $url } > 1 )
            {
                $msgs{ $url } .= "; Previously failed, now ok. Received " . $lastresultbytes . " bytes of data in response.";
                $sendmsg{ $url }++;
            }
            delete $fails{ $url };
            delete $failmsgs{ $url };
        } else {
            print "$url recheck fail\n" if $debug;
            $fails{ $url }++;
            $failmsgs{ $url } .= "," . $lasterror;
            $msgs{ $url }     .= "," . $lasterror;
            $sendmsg{ $url }++;
        }
    }

    out_keys( "end" ) if $debug_keys;
    print "final messages\n";
    
# loop thru all and check if a url has sendmsg sent, if so, send that message
    for ( my $i = 0; $i < @to; ++$i ) {
        my $out;
        my $failcount = 0;
        for ( my $j = 0; $j < @{$this_check[ $i ]}; ++$j ) {
            if ( $sendmsg{ $this_check[$i][$j] } ) {
                $do_sendmsg++;
                $out .= sprintf( "%-${maxurllen}s $msgs{ $this_check[$i][$j] }\n", $this_check[$i][$j] );
            }
            if ( $fails{ $this_check[$i][$j] } ) {
                $failcount++;
            }
        }
        
        if ( $out ) {
            do_email( $i, $out, $failcount > 0 );
            print $out;
        }
    }
    
    print "sleeping $approx_every_minutes minutes\n" if $debug;
    sleep $approx_every_minutes * 60;
}
