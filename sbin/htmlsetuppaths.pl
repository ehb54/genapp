#!/usr/bin/perl

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

my $f = "directives.json";
die "$0: must be run from a directory containing $f\n" if !-e $f;

my $json = get_file_json( $f );

my $docroot = $$json{ "docroot" }{ "html5" };
my $exepath = $$json{ "executable_path" }{ "html5" };
my $app     = $$json{ "application" };

$docroot =~ s/\/$//;
$exepath =~ s/\/$//;

my $errors;

$errors .= "No executable_path for html5 defined in $f\n" if !$exepath;
$errors .= "No docroot for html5 defined in $f\n" if !$docroot;
$errors .= "No application defined in $f\n" if !$app;

my $dir = `pwd`;
chomp $dir;

die $errors if $errors;

my $webroot = $$json{ "webroot" };
my $whoami = `whoami`;
chomp $whoami;

if ( !$webroot ) {
    my $httpconf;
    my @trys = ( "/etc/httpd/httpd.conf",
                 "/etc/httpd/conf/httpd.conf",
                 "/etc/apache2/sites-enabled/000-default.conf" );
    my $used;
    foreach my $i ( @trys ) {
        if ( -e $i ) {
            print "checking $i\n" if $debug;
            open my $fh, $i;
            my @l = <$fh>;
            close $fh;
            grep s/^\s+//, @l;
            grep s/#.*$//, @l;
            @l = grep /documentroot/i, @l;
            grep chomp, @l;
            grep s/documentroot //i, @l;
            grep s/\"//g, @l;
            my %uniq;
            my @possible;
            foreach my $k ( @l ) {
                if ( !$uniq{ $k }++ ) {
                    push @possible, $k;
                }
            }
            if ( @possible ) {
                $webroot = $possible[ 0 ];
                $used = $i;
                last;
            }
        }
    }
    if ( $webroot &&
         $webroot != $docroot ) {
        print "Found webroot of $webroot in $used\n";
    }
}    

print "webroot after checking configuration files is $webroot\n" if $debug;

if ( !$webroot ) {
    if ( $docroot =~ /www/ ) {
        $webroot = $docroot;
    } else {
        die "$0: could not find a reasonable web root location.  Please define \"webroot\" in your directives.json which is the 'DocumentRoot' of your webserver\n";
    }
}

die "$0: webroot location '$webroot' is not a directory
Please define \"webroot\" in your directives.json which is the 'DocumentRoot' of your webserver
" if !-d $webroot;

# figure out ownership

my $ggroup = "";
{
    my @trys = ( "genapp", "apache", "www-data" );

    foreach my $i ( @trys ) {
        my $res = `getent group $i`;
        chomp $res;
        if ( $res ) {
            $ggroup = $i;
            last;
        }
    }
}

if ( $debug ) {
    print "executable path html5 <$exepath>\n";
    print "docroot path html5 <$docroot>\n";
    print "directory is <$dir>\n";
    print "webroot is <$webroot>\n";
    print "group is <$ggroup>\n";
}

# utility subs

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


$cmds = "ln -sf $dir/output/html5 $webroot/$app
mkdir -p output/html5/results output/html5/deleted 2> /dev/null
rm ajax results util 2> /dev/null
ln -sf output/html5/ajax ajax && ln -sf output/html5/results results && ln -sf output/html5/util util
chown -R $whoami:$ggroup . && chmod -R g+rw . && find . -type d | xargs chmod g+xs
";

print "Setting up via these commands:
$cmds";

runcmdsb( $cmds );

