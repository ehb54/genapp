#!/usr/bin/perl

my $gb   = $ENV{ "GENAPP" };
if ( !$gb ) {
    use Cwd 'abs_path';
    $gb = abs_path($0);
    $gb =~ s/\/sbin\/setconfig\.pl$//;
}

if ( $] < 5.018 ) {
    if ( -e "$gb/perl/bin/perl" ) {
        $pv =`$gb/perl/bin/perl -e 'print \$];'`;
        if ( $pv >= 5.018 ) {
            print "will run new version\n" if $debug;
            unshift @ARGV, $0;
            exec( "$gb/perl/bin/perl", @ARGV );
        } else {
            die "$gb/perl/bin/perl exists, but not a correct version of perl (needs a minimum of 5.18)\n";
        }
    } else {
        die "you need to install a version of perl >= 5.18 in $gb/perl\n
there is a script $gb/sbin/install-perl-stable to do this";
    }
}

my $rc = eval {
    require JSON;         JSON->import( -support_by_pp );
};

my $notes = "
usage: $0

sets up $gb/config.json

options
 -f                            force overwrite of identified values to those previously stored
 -h                            show help
 -hostip hostip                use specified host ip address
 -hostname hostname            use specified host name
 -if network-interface-id      find and set hostip from that of specified interface (e.g. eth0, eth1, lo, etc)
 -pj                           print resulting config.json
 -https                        use https and wss
 -publicport                   specify a public port (used for websockets)
 -webroot webroot              specify the webroot directory
 -mongossl hostname cafile     specify the hostname and certificate file for mongod
";

my $pj;
my $fo;
my $hostip;
my $hostname;
my $https = 0;
my $webroot;

while ( @ARGV ) {
    my $option = shift @ARGV;
    if ( $option =~ /^-f$/ ) {
        $fo = 1;
        next;
    }
    if ( $option =~ /^-if$/ ) {
        die "$0: option $option requries an argument\n" . $notes if !@ARGV;
        my $if = shift @ARGV; 
        my $cmd = "/sbin/ip -4 addr show $if | grep inet | awk '{ print \$2 }' | sed 's/\\\/.*\$//'";
        $hostip = `$cmd`;
        chomp $hostip;
        die "$0: could not get hostip of interface $if\n" if !$hostip;
        next;
    }
    if ( $option =~ /^-hostip$/ ) {
        die "$0: option $option requries an argument\n" . $notes if !@ARGV;
        $hostip = shift @ARGV;
        next;
    }
    if ( $option =~ /^-hostname$/ ) {
        die "$0: option $option requries an argument\n" . $notes if !@ARGV;
        $hostname = shift @ARGV;
        next;
    }
    if ( $option =~ /^-webroot$/ ) {
        die "$0: option $option requries an argument\n" . $notes if !@ARGV;
        $webroot = shift @ARGV;;
        next;
    }
    if ( $option =~ /^-publicport$/ ) {
        die "$0: option $option requries an argument\n" . $notes if !@ARGV;
        $publicport = shift @ARGV;;
        next;
    }
    if ( $option =~ /^-h$/ ) {
        print $notes;
        exit;
    }
    if ( $option =~ /^-pj$/ ) {
        $pj++;
        next;
    }
    if ( $option =~ /^-https$/ ) {
        $https++;
        next;
    }
    if ( $option =~ /^-mongossl$/ ) {
        $mongosslhost = shift @ARGV;
        $mongourl = "mongodb://${mongosslhost}:27017/?ssl=true";
        die "$0: option $option requries two arguments\n" . $notes if !@ARGV;
        $mongocafile = shift @ARGV;
        next;
    }

    die "Unknown command line option specified '$option'\n" . $notes;
}

my $f = "$gb/etc/config.json";

my $json = {};

if ( -e $f ) {
    print "reading $f\n";
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

# determine os

my $tos = `uname -v`;
my $os;
my $os_release;

$os = 'ubuntu' if $tos =~ /Ubuntu/;

if ( $os eq 'ubuntu' ) {
    $os_release = `lsb_release -r | awk '{ print \$2 }'`;
    chomp $os_release;
}

if ( !$os && -e "/etc/redhat-release" ) {
# check for centos/redhat
    my $check = `cat /etc/redhat-release`;
    chomp $check;
    if ( $check =~ /^CentOS .* release/ ) {
        $os = "centos";
        ( $os_release ) = $check =~ /^CentOS .* release (\S+)/;
        
    } else {
        if ( $check =~ /^CentOS release/ ) {
            $os = "centos";
            ( $os_release ) = $check =~ /^CentOS release (\S+)/;
        }
    }
    if ( $check =~ /^Red Hat Enterprise Linux Server release/ ) {
        $os = "redhat";
        ( $os_release ) = $check =~ /^Red Hat Enterprise Linux Server release (\S+)/;
    }
    if ( $check =~ /^Scientific Linux release/ ) {
        $os = "scientific";
        ( $os_release ) = $check =~ /^Scientific Linux release (\S+)/;
        if ( -e "/etc/cernvm-release" ) {
            $os_release .= "-cernvm";
        }
    }
}    

if ( !$os  && -e "/etc/slackware-version" ) {
    my $check = `cat /etc/slackware-version`;
    $os = "slackware";
    ( $os_release ) = $check =~ /^Slackware (\S+)/;
}

if ( !os ) {
    warn "$0: operating system not recognized\n";
}

print "Operating system is identified as '$os' release '$os_release'\n";

my $notice;

if ( $$json{'os'} ) {
    if ( $$json{'os'} ne $os ) {
        $notice .= "The identified operating system [$os] is different than that stored [$$json{'os'}] in $f. " . ( $fo ? "Overwriting with identified value." : "Leaving stored value untouched (use -f to overwrite)." ) . "\n";
    } else {
        if ( $$json{'os_release'} ne $os_release ) {
            $notice .= "The identified $os release [$os_release] is different than that stored [$$json{'os_release'}] in $f. " . ( $fo ? "Overwriting with identified value." : "Leaving stored value untouched (use -f to overwrite)." ) . "\n";
        }
    }
    if ( $fo ) {
        $$json{ 'os' }         = $os;
        $$json{ 'os_release' } = $os_release;
    }
} else {
    $$json{ 'os' }         = $os;
    $$json{ 'os_release' } = $os_release;
}

if ( !$hostip ) {
    my $foundwgetorcurl;
    if ( `which wget 2> /dev/null` ) {
        $hostip = `wget http://ipinfo.io/ip -qO -`;
        chomp $hostip;
        $foundwgetorcurl++;
    } else {
        if ( `which curl 2> /dev/null` ) {
            $cmd = 'curl -q ipinfo.io 2> /dev/null | grep \'"ip":\' | awk \'{ print $2 }\' | sed s/,// | sed s/\"//g';
            $hostip = `$cmd`;
            chomp $hostip;
            $foundwgetorcurl++;
        }
    }
    die "$0: please install wget or curl so that your public ip address can be determined" if !$foundwgetorcurl;
}

if ( $$json{'hostip'} ) {
    if ( $$json{'hostip'} ne $hostip ) {
        $notice .= "The identified hostip for this server [$hostip] is different than that stored [$$json{'hostip'}] in $f. " . ( $fo ? "Overwriting with identified value." : "Leaving stored value untouched (use -f to overwrite)." ) . "\n";
    }
    if ( $fo ) {
        $$json{ 'hostip' }         = $hostip;
    }
} else {
    $$json{ 'hostip' }         = $hostip;
}

if ( !$hostname ) {
    $hostname = `host $hostip` if !$hostname;
    chomp $hostname;
    if ( $hostname =~ /(not found|no PTR record)/ ) {
        $hostname = $hostip;
    } else {
        ( $hostname ) = $hostname =~ /\s+(\S+)\.$/;
    }
}

if ( $$json{'hostname'} ) {
    if ( $$json{'hostname'} ne $hostname ) {
        $notice .= "The identified hostname for this server [$hostname] is different than that stored [$$json{'hostname'}] in $f. " . ( $fo ? "Overwriting with identified value." : "Leaving stored value untouched (use -f to overwrite)." ) . "\n";
    }
    if ( $fo ) {
        $$json{ 'hostname' }         = $hostname;
    }
} else {
    $$json{ 'hostname' }         = $hostname;
}

$hostname = $$json{ 'hostname' };
# verify hostname matches ip address
{
    my $nametoip;
    if ( `which dig 2> /dev/null` ) {
        $nametoip = `dig \@8.8.8.8 +short $hostname`;
    } else {
        $nametoip = `host $hostname | awk '/has address/ { print \$4 }'`;
    }
    chomp $nametoip;
    if ( $nametoip ne $hostip ) {
        $notice .= "WARNING: the ip address from a DNS lookup [$nametoip] of the hostname [$hostname] does not match the hostip [$hostip]. This will create issues unless you really understand what you are doing!\n";
    }
}


my $wssport    = $https ? 443 : 80;
$wssport    = $publicport if $publicport;
my $wsport     = 30777;
my $zmqport    = 30778;
my $zmqhostip  = "127.0.0.1";
my $udpport    = 30779;
my $udphostip  = "127.0.0.1";
my $tcpport    = 30780;
my $tcphostip  = "127.0.0.1";
my $tcprport   = 30781;
my $tcptimeout = 300;

if ( $$json{ "messaging" }{ "wssport" } ) {
    if ( $$json{'messaging'}{'wssport'} != $wssport ) {
        $notice .= "The identified wssport for this server [$wssport] is different than that stored [$$json{'messaging'}{'wssport'}] in $f. " . ( $fo ? "Overwriting with identified value." : "Leaving stored value untouched (use -f to overwrite)." ) . "\n";
    }
    if ( $fo ) {
        $$json{ 'messaging'}{'wssport' }         = $wssport;
    }
} else {
    $$json{ 'messaging'}{'wssport' }         = $wssport;
}

if ( $$json{ "messaging" }{ "wsport" } ) {
    if ( $$json{'messaging'}{'wsport'} != $wsport ) {
        $notice .= "The identified wsport for this server [$wsport] is different than that stored [$$json{'messaging'}{'wsport'}] in $f. " . ( $fo ? "Overwriting with identified value." : "Leaving stored value untouched (use -f to overwrite)." ) . "\n";
    }
    if ( $fo ) {
        $$json{ 'messaging'}{'wsport' }         = $wsport;
    }
} else {
    $$json{ 'messaging'}{'wsport' }         = $wsport;
}

if ( $$json{ "messaging" }{ "zmqport" } ) {
    if ( $$json{'messaging'}{'zmqport'} != $zmqport ) {
        $notice .= "The identified zmqport for this server [$zmqport] is different than that stored [$$json{'messaging'}{'zmqport'}] in $f. " . ( $fo ? "Overwriting with identified value." : "Leaving stored value untouched (use -f to overwrite)." ) . "\n";
    }
    if ( $fo ) {
        $$json{ 'messaging'}{'zmqport' }         = $zmqport;
    }
} else {
    $$json{ 'messaging'}{'zmqport' }         = $zmqport;
}

if ( $$json{ "messaging" }{ "zmqhostip" } ) {
    if ( $$json{'messaging'}{'zmqhostip'} ne $zmqhostip ) {
        $notice .= "The identified zmqhostip for this server [$zmqhostip] is different than that stored [$$json{'messaging'}{'zmqhostip'}] in $f. " . ( $fo ? "Overwriting with identified value." : "Leaving stored value untouched (use -f to overwrite)." ) . "\n";
    }
    if ( $fo ) {
        $$json{ 'messaging'}{'zmqhostip' }         = $zmqhostip;
    }
} else {
    $$json{ 'messaging'}{'zmqhostip' }         = $zmqhostip;
}

if ( $$json{ "messaging" }{ "udpport" } ) {
    if ( $$json{'messaging'}{'udpport'} != $udpport ) {
        $notice .= "The identified udpport for this server [$udpport] is different than that stored [$$json{'messaging'}{'udpport'}] in $f. " . ( $fo ? "Overwriting with identified value." : "Leaving stored value untouched (use -f to overwrite)." ) . "\n";
    }
    if ( $fo ) {
        $$json{ 'messaging'}{'udpport' }         = $udpport;
    }
} else {
    $$json{ 'messaging'}{'udpport' }         = $udpport;
}

if ( $$json{ "messaging" }{ "udphostip" } ) {
    if ( $$json{'messaging'}{'udphostip'} ne $udphostip ) {
        $notice .= "The identified udphostip for this server [$udphostip] is different than that stored [$$json{'messaging'}{'udphostip'}] in $f. " . ( $fo ? "Overwriting with identified value." : "Leaving stored value untouched (use -f to overwrite)." ) . "\n";
    }
    if ( $fo ) {
        $$json{ 'messaging'}{'udphostip' }         = $udphostip;
    }
} else {
    $$json{ 'messaging'}{'udphostip' }         = $udphostip;
}

if ( $$json{ "messaging" }{ "tcpport" } ) {
    if ( $$json{'messaging'}{'tcpport'} != $tcpport ) {
        $notice .= "The identified tcpport for this server [$tcpport] is different than that stored [$$json{'messaging'}{'tcpport'}] in $f. " . ( $fo ? "Overwriting with identified value." : "Leaving stored value untouched (use -f to overwrite)." ) . "\n";
    }
    if ( $fo ) {
        $$json{ 'messaging'}{'tcpport' }         = $tcpport;
    }
} else {
    $$json{ 'messaging'}{'tcpport' }         = $tcpport;
}

if ( $$json{ "messaging" }{ "tcphostip" } ) {
    if ( $$json{'messaging'}{'tcphostip'} ne $tcphostip ) {
        $notice .= "The identified tcphostip for this server [$tcphostip] is different than that stored [$$json{'messaging'}{'tcphostip'}] in $f. " . ( $fo ? "Overwriting with identified value." : "Leaving stored value untouched (use -f to overwrite)." ) . "\n";
    }
    if ( $fo ) {
        $$json{ 'messaging'}{'tcphostip' }         = $tcphostip;
    }
} else {
    $$json{ 'messaging'}{'tcphostip' }         = $tcphostip;
}

if ( $$json{ "messaging" }{ "tcprport" } ) {
    if ( $$json{'messaging'}{'tcprport'} ne $tcprport ) {
        $notice .= "The identified tcprport for this server [$tcprport] is different than that stored [$$json{'messaging'}{'tcprport'}] in $f. " . ( $fo ? "Overwriting with identified value." : "Leaving stored value untouched (use -f to overwrite)." ) . "\n";
    }
    if ( $fo ) {
        $$json{ 'messaging'}{'tcprport' }         = $tcprport;
    }
} else {
    $$json{ 'messaging'}{'tcprport' }         = $tcprport;
}

if ( $$json{ "messaging" }{ "tcptimeout" } ) {
    if ( $$json{'messaging'}{'tcptimeout'} ne $tcptimeout ) {
        $notice .= "The identified tcptimeout for this server [$tcptimeout] is different than that stored [$$json{'messaging'}{'tcptimeout'}] in $f. " . ( $fo ? "Overwriting with identified value." : "Leaving stored value untouched (use -f to overwrite)." ) . "\n";
    }
    if ( $fo ) {
        $$json{ 'messaging'}{'tcptimeout' }         = $tcptimeout;
    }
} else {
    $$json{ 'messaging'}{'tcptimeout' }         = $tcptimeout;
}

if ( $$json{ "https" } ) {
    if ( $$json{'https'} != $https ) {
        $notice .= "The identified https flag for this server [$https] is different than that stored [$$json{'https'}] in $f. " . ( $fo ? "Overwriting with identified value." : "Leaving stored value untouched (use -f to overwrite)." ) . "\n";
    }
    if ( $fo ) {
        $$json{'https'}         = int($https);
    }
} else {
    $$json{'https'}         = int($https);
}

if ( !$webroot ) {
    $webroot = "/var/www/html" if $os =~ /^(ubuntu|centos|redhat|scientific)$/;
    $webroot = "/var/www/htdocs" if $os =~ /^slackware$/;
}

if ( $$json{ "webroot" } ) {
    if ( $$json{'webroot'} != $webroot ) {
        $notice .= "The identified webroot for this server [$webroot] is different than that stored [$$json{'webroot'}] in $f. " . ( $fo ? "Overwriting with identified value." : "Leaving stored value untouched (use -f to overwrite)." ) . "\n";
    }
    if ( $fo ) {
        $$json{'webroot'}         = $webroot;
    }
} else {
    $$json{'webroot'}         = $webroot;
}

if ( $$json{ "mongo" }{ "url" } ) {
    if ( $$json{'mongo'}{'url'} ne $mongourl ) {
        $notice .= "The identified mongod url for this server [$mongourl] is different than that stored [$$json{'mongo'}{'url'}] in $f. " . ( $fo ? "Overwriting with identified value." : "Leaving stored value untouched (use -f to overwrite)." ) . "\n";
    }
    if ( $fo ) {
        $$json{'mongo'}{'url'} = $mongourl;
    }
} else {
    if ( $mongourl ) {
        $$json{'mongo'}{'url'} = $mongourl;
    } else {
        delete $$json{'mongo'};
    }
}

if ( $$json{ "mongo" }{ "cafile" } ) {
    if ( $$json{'mongo'}{'cafile'} ne $mongocafile ) {
        $notice .= "The identified mongod certificate file for this server [$mongocafile] is different than that stored [$$json{'mongo'}{'cafile'}] in $f. " . ( $fo ? "Overwriting with identified value." : "Leaving stored value untouched (use -f to overwrite)." ) . "\n";
    }
    if ( $fo ) {
        $$json{'mongo'}{'cafile'} = $mongocafile;
    }
} else {
    if ( $mongocafile ) {
        $$json{'mongo'}{'cafile'} = $mongocafile;
    } else {
        delete $$json{'mongo'};
    }
}

open my $fh, ">$f" || die "$0: can not open $f for writing, check permissions\n";
print $fh to_json( $json, { utf8 => 1, pretty => 1 } );
close $fh;

if ( $pj ) {
    print "-"x80 . "\n";
    print "Final config.json:\n";
    print "-"x80 . "\n";
    {
        my $js = JSON->new;
        print $js->pretty->encode( $json );
    }
    print "-"x80 . "\n";
}

print "-"x80 . "\n" . "Notices:\n" . "-"x80 . "\n" . $notice . "-"x80 . "\n" if $notice;
