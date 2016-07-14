#!/usr/bin/perl

$svnbase = "gw105.iu.xsede.org/svn/base";

$|=1;

# $debug++;

my $gb   = $ENV{ "GENAPP" } || die "$0: environment variable GENAPP must be set\n";

print "perl version is $]\n" if $debug;
print "command is: $0 @ARGV\n" if $debug;

if ( $] < 5.018 ) {
    if ( -e "$gb/perl/bin/perl" ) {
        my $pv =`$gb/perl/bin/perl -e 'print \$];'`;
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

my $gap = $gb;

require "$gap/etc/perl/genapp_util.pl";

$notes = 
"usage[1]: $0 {options} svntype applicationname
usage[2]: $0 list 

When using usage[1]:
 svntype can be svn or svn+ssh
 applicationname must be a valid application name (use usage[2] to get a list)
 svn checks out application and sets up paths

 Options:
   -admin user         add user name to admin list for application
   -force              force checkout even if directory exists
   -gen                run genapp.pl after install
   -nolinks            do not setup html links
   -dir directory      use specified directory instead of application name

when using usage[2];
 this will list the available application names

";

my $admin;
my $force;
my $gen;
my $nolinks;
my $targetdir;

while ( $ARGV[ 0 ] =~ /^-/ ) {
    my $option = shift @ARGV;
    if ( $option =~ /^-admin$/ ) {
        die "$0: option $option requries an argument\n" . $notes if !@ARGV;
        $admin = shift @ARGV;
        next;
    }
    if ( $option =~ /^-dir$/ ) {
        die "$0: option $option requries an argument\n" . $notes if !@ARGV;
        $targetdir = shift @ARGV;
        next;
    }
    if ( $option =~ /^-force$/ ) {
        $force = "--force";
        next;
    }
    if ( $option =~ /^-gen$/ ) {
        $gen++;
        next;
    }
    if ( $option =~ /^-nolinks$/ ) {
        $nolinks++;
        next;
    }
    die "Unknown command line option specified '$option'\n" . $notes;
}

$svntype = shift || die $notes;

#--- get config.json info

my $cfgjson = {};
my $cfgjsonf = "$gb/etc/config.json";
my $cfgjsonnotes = '-'x80 . "\n
$cfgjsonf contains global system information.
this is used to setup individual applications values.
to build a default config.json file
$gb/sbin/setconfig.pl -pj
and verify the information is correct.
Particularly, if the machine is not publically exposed, you probably want to change the hostip and hostname, as it will likely report the public ip of your firewall.
The full options are listed by
$gb/sbin/setconfig.pl -h
You can also manually edit $cfgjsonf

Once you are satisified that the setting are correct 
you can rerun $0
" . '-'x80 . "\n"
;

{
    my $f = $cfgjsonf;
    if ( -e $f ) {
        print "reading $f\n";
        open my $fh, $f || die "$0: can not open $f\n";
        my @ol = <$fh>;
        close $fh;
        my @l = grep !/^\s*#/ , @ol;
            my $l = join '', @l;
        eval {
            $cfgjson = decode_json( $l );
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
    } else {
        my $res = `$gb/sbin/setconfig.pl -pj`;
        print "$0 : 
" . '-'x80 . "
please verify these settings are correct
" . '-'x80 . "
$res
$cfgjsonnotes
";
        exit;
    }
}

sub listapps {
    my @l = `svn ls svn://$svnbase`;
    grep chomp, @l;
    grep s/\///, @l;
    @l = grep !/^genapp(|alpha)$/, @l;
    return @l;
}

if ( $svntype eq 'list' ) {
    print join "\n", listapps();
    print "\n";
    exit;
}

$app       = shift || die $notes;
$targetdir = $app if !$targetdir;

die "$0: svn-type must be svn or svn+ssh and you specified '$svntype'\n" if $svntype !~ /^svn(\+ssh|)$/;

die "$0: $targetdir directory already exists\n" if -e $targetdir && !$force;

@l = listapps();
foreach $i ( @l ) {
    $vapp{ $i }++;
}

die "$0: Error: $app is not known as an application name\n" if !$vapp{ $app };

$cmd = "svn $force co ${svntype}://$svnbase/$app $targetdir";

print "$cmd\n";

print `$cmd`;
die "$0: checkout failed. 
One possibility is you switched from svn to svn+ssh or vice-versa, if this is true, you will have to remove or rename the directory.
Other possibilities include a network issue, host issue, local diskspace or permissions issue or ?\n" if $?;

# sets up the app's appconfig.json:

sub setappconfig {
    my $app        = $_[0];
    my $targetdir  = $_[1];
    my $admin      = $_[2];

    my $json = {};
    $$json{ "hostip"   } = $$cfgjson{ 'hostip' }   || die "$0 hostip not defined in $cfgjsonf. $cfgjsonnotes";
    $$json{ "hostname" } = $$cfgjson{ 'hostname' } || die "$0 hostname not defined in $cfgjsonf. $cfgjsonnotes";

    $$json{ "messaging" }{ "wsport" }    = $$cfgjson{ "messaging" }{ "wsport" } || die "$0 wsport not defined in $cfgjsonf. $cfgjsonnotes";
    $$json{ "messaging" }{ "wssport" }   = $$cfgjson{ "messaging" }{ "wssport" } || die "$0 wssport not defined in $cfgjsonf. $cfgjsonnotes";
    $$json{ "messaging" }{ "zmqhostip" } = $$cfgjson{ "messaging" }{ "zmqhostip" } || die "$0 zmqhostip not defined in $cfgjsonf. $cfgjsonnotes";
    $$json{ "messaging" }{ "zmqport" }   = $$cfgjson{ "messaging" }{ "zmqport" } || die "$0 zmqport not defined in $cfgjsonf. $cfgjsonnotes";
    $$json{ "messaging" }{ "udphostip" } = $$cfgjson{ "messaging" }{ "udphostip" } || die "$0 udphostip not defined in $cfgjsonf. $cfgjsonnotes";
    $$json{ "messaging" }{ "udpport" }   = $$cfgjson{ "messaging" }{ "udpport" } || die "$0 udpport not defined in $cfgjsonf. $cfgjsonnotes";
    $$json{ "messaging" }{ "tcphostip" } = $$cfgjson{ "messaging" }{ "tcphostip" } || die "$0 tcphostip not defined in $cfgjsonf. $cfgjsonnotes";
    $$json{ "messaging" }{ "tcpport" }   = $$cfgjson{ "messaging" }{ "tcpport" } || die "$0 tcpport not defined in $cfgjsonf. $cfgjsonnotes";

    $$json{ "restricted" }{ "admin" } = ( $admin ) if $admin;

    $$json{ "resources" }{ "local" } = "";

    $$json{ "resourcedefault" } = "local";
    $$json{ "submitpolicy" } = "login";

    $$json{ "lockdir" } = "$gb/etc";

    $f = "$targetdir/appconfig.json";
    open  $fh, ">$f" || die "$0: could not open $f for writing\n";
    print $fh to_json( $json, { utf8 => 1, pretty => 1 } );
    close $fh;
    print "created $f\n";
}

setappconfig( $app, $targetdir, $admin );

# setup directives.json

my $devmsg = "You can subscribe to the mailing list http://biochem.uthscsa.edu/mailman/listinfo/genapp-devel
and then send your questions to genapp-devel\@biochem.uthscsa.edu\n";

sub setdirectives {
    my $app       = $_[0];
    my $targetdir = $_[1];
    my $webroot   = $_[2];

    my $f      = "directives.json.template";
    my $fo     = "directives.json";
    
    die "$0: $targetdir/$f does not exist for this application.  
This is an error of the application developer and they should be informed.\n$devmsg" if !-e "$targetdir/$f";

    die "$0: $targetdir/$fo already exists for this application. 
This file must be manually removed before continuing.  
If this error recurrs after removing,
This is an error of the application developer and they should be informed.\n$devmsg" if -e "$targetdir/$fo";

    my $djson  = get_file_json( "$targetdir/$f" );

    open my $fh, "$targetdir/$f" || die "$0: file open error on $targetdir/$f\n";
    my @l = <$fh>;
    close $fh;

    my $dir = `pwd`;
    chomp $dir;

    die "$0: $targetdir/$f error, missing __app_parent_directory__ tags.
This is an error of the application developer and they should be informed.\n$devmsg" if !( grep /__app_parent_directory__/, @l );

    die "$0: $targetdir/$f error, missing __webroot__ tags.
This is an error of the application developer and they should be informed.\n$devmsg" if !( grep /__webroot__/, @l );

#    die "$0: $targetdir/$f error, missing __application__ tags.
# This is an error of the application developer and they should be informed.\n$devmag" if !( grep /__application__/, @l );

    grep s/__app_parent_directory__/$dir/g, @l;

    grep s/__webroot__/$webroot/g, @l;

#    grep s/__application__/$app/g, @l;

    if ( $app ne $targetdir ) {
        grep s/"$app"/"$targetdir"/g, @l;
        grep s/\/$app\//\/$targetdir\//g, @l;
    }        

    if ( $$djson{ 'usewss' } && !$$cfgjson{ 'https' } ) {
        @l = grep !/"usewss"/, @l;
    }        

    if ( $$djson{ 'usews' } && $$cfgjson{ 'https' } ) {
        @l = grep !/"usews"/, @l;
    }        

    # strip white space and comments from end of array
    while ( $l[ -1 ] =~ /^(#.*|\s*)$/ ) {
        pop @l;
    }

    die "$0 : $targetdir/$f error: can not locate json closure.
This is an error of the application developer and they should be informed.\n$devmsg" if $l[ -1 ] !~ /^\s*}\s*$/;

    pop @l;
    push @l, ( $$cfgjson{ 'https' } ? "   ,\"usewss\" : \"true\"\n" : "   ,\"usews\" : \"true\"\n" );
    push @l, "}\n";

    open  $fh, ">$targetdir/$fo" || die "$0: could not open $targetdir/$fo for writing\n";
    print $fh ( join '', @l );
    close $fh;
    print "created $targetdir/$fo\n";
}

setdirectives( $app, $targetdir, $$cfgjson{'webroot'} );

sub runcmd {
    my $cmd = $_[0];
    my $out;
    print "running shell command:\n--------\n$cmd\n--------\n" if $debug;
    open my $fh, "$cmd |";
    while ( <$fh> ) {
        $out .= $_;
        print;
    }
    close $fh;
    die "$0: command $cmd failed\n" if $?;
    $out;
}

sub runcmdsb {
    my $cmd = $_[0];
    $cmd =~ s/"/\\\"/g;
    $cmd = "sudo bash -c \"$cmd\"";
    print "sd cmd is <$cmd>\n" if $debug;
    runcmd( $cmd );
}

if ( $gen ) {
    runcmd( "cd $targetdir; env GENAPP=$gb \$GENAPP/bin/genapp.pl" );
    if ( !$nolinks ) {
        my $dir = `pwd`;
        chomp $dir;
        my $cmds = 
"cd $targetdir
ln -sf $dir/$targetdir/output/html5 $$cfgjson{'webroot'}/$targetdir
mkdir -p output/html5/results output/html5/deleted 2> /dev/null
rm ajax results util 2> /dev/null
ln -sf output/html5/ajax ajax && ln -sf output/html5/results results && ln -sf output/html5/util util
chgrp -R genapp . && chmod -R g+rw . && find . -type d | xargs chmod g+xs
";
       print "Setting up via these commands:
$cmds";
       runcmdsb( $cmds );
    }
}

