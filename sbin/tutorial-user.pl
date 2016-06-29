#!/usr/bin/perl

# configuration

# uncomment for debugguing
$debug++;

# systems :  systemname, homebase, wwwbase, wwwusebase, optgenapp, group, lockdir-used, random pass cmd

@systems = (
    "slack",  "/home", "/var/www/htdocs", "/share/apps/genapp/__app__/output/html5", "/share/apps/genapp", "apache", 0, "mkpasswd",
    "ubuntu", "/home", "/var/www/html",   "/opt/genapp/__app__/output/html5",        "/opt/genapp",        "genapp", 1, " echo '' | mkpasswd -s | cut -c1-9",
    );

$svndemo = "gw105.iu.xsede.org/svn/base/demo";

# end configuration

while ( $i = shift @systems ) {
    $sname           { $i }++;
    $homebase        { $i } = shift @systems;
    $wwwbase         { $i } = shift @systems;
    $wwwusebase      { $i } = shift @systems;
    $optgenapp       { $i } = shift @systems;
    $group           { $i } = shift @systems;
    $lockdir         { $i } = shift @systems;
    $mkpasswd        { $i } = shift @systems;
    $requireslinks   { $i } = $wwwusebase{ $i } eq $optgenapp{ $i };
}

my $gb   = $ENV{ "GENAPP" } || die "$0: environment variable GENAPP must be set\n";

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
# use JSON -support_by_pp;

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
    $cmd =~ s/\$/\\\$/g;
    $cmd = "sudo bash -c \"$cmd\"";
    print "sd cmd is <$cmd>\n";
    runcmd( $cmd );
}

$notes = 
"usage: $0 system wss ip hostname name
sets up a new user named 'name' for tutorials
wss must be y or n
currently supported 'system's are slack and ubuntu
";

$sys      = shift || die $notes;
$wss      = shift || die $notes;
$ip       = shift || die $notes;
$hostname = shift || die $notes;
$user     = shift || die $notes;

die "$0 wss must be y or n
$notes" if $wss !~ /^(y|n)$/;

$wssp = $wss eq "y" ? "443" : "80";

die "$0: unknown system $sys\n" if !$sname{ $sys };

my $whoami = `whoami`;
chomp $whoami;


$app       = "${user}";
$wwwusebase{$sys} =~ s/__app__/$app/;
$targetwww    = "$wwwbase{$sys}/$app";
$targetwwwuse = "$wwwusebase{$sys}";
$targetsvn    = "$optgenapp{$sys}/$app";

print "
system        $sys
wss           $wss
homebase      $homebase{$sys}
wwwbase       $wwwbase{$sys}
wwwusebase    $wwwusebase{$sys}
optgenapp     $optgenapp{$sys}
group         $group{$sys}
lockdir       $lockdir{$sys}
requireslinks $requireslinks{$sys}

app           $app
targetwww     $targetwww
targetwwwuse  $targetwwwuse
targetsvn     $targetsvn

" if $debug;

$id = `id -u $user 2> /dev/null`;
chomp $id;
die "$0: user $user already exists\n" if $id;

{ 
    my $tmp;
    $tmp = `getent group $group{$sys}`;
    chomp $tmp;
    die "$0: group group '$group{$sys}' must exist to proceed\n" if !$tmp;

    $tmp = `getent group sshlogin`;
    chomp $tmp;
    die "$0: group 'sshlogin' must exist to proceed\n" if !$tmp;

    die "$0: $targetwww already exists\n" if -e $targetwww;
    die "$0: $targetwwwuse already exists\n" if -e $targetwwwuse;
    die "$0: $targetsvn already exists\n" if -e $targetsvn;

    die "$0: $optgenapp{$sys} not a directory\n" if !-d $optgenapp{$sys};
}

# proceed, add user

$pw = `$mkpasswd{$sys}`;
chomp $pw;
$pw =~ s/^-/X/g;

print "pw is $pw\n";

$f = "$optgenapp{$sys}/tutorialinfo.txt";
`cat <<__EOF >> $f
username $user
password $pw
\l
__EOF
`;

$epw = `openssl passwd -1 '$pw'`;
chomp $epw;

print "pw is $pw, epw is $epw\n" if $debug;

$cmd = "/usr/sbin/useradd -m -d $homebase{$sys}/$user -s /bin/bash -G $group{$sys},sshlogin -p '$epw' $user";

runcmdsb( $cmd );

# checkout svn instance

runcmd( "cd $optgenapp{$sys} && svn --force export svn://$svndemo $app" );


# setup genapptest instance

chdir "$targetsvn" || die "$0: could not change to directory $targetsvn\n";

{
    my $f = "directives.json.template";
    open my $fh, "$f" || die "$0: could not open $f\n";
    my @l = <$fh>;
    close $fh;

    my $apphome = $optgenapp{$sys};
    my $wwwhome = $wwwbase{$sys};
    grep s/\/REPLACE_WITH_YOUR_HOME_DIRECTORY\/REPLACE_WITH_DIRNAME/$targetsvn/, @l;
    grep s/\/REPLACE_WITH_YOUR_HOME_DIRECTORY/$apphome/, @l;
    grep s/\/REPLACE_WITH_YOUR_WEBROOT/$wwwhome/, @l;
    grep s/REPLACE_WITH_DIRNAME/$app/, @l;

    pop @l;
    push @l, $wss eq "y" ? '   ,"usewss":"true"' : '   ,"usews":"true"';
    push @l, "\n}\n";

    $f = "directives.json";
    open  $fh, ">$f" || die "$0: could not open $f for writing\n";
    print $fh ( join '', @l );
    close $fh;
}

{
    if ( $ip eq 'auto' ) {
        $ip = `wget http://ipinfo.io/ip -qO -`;
        chomp $ip;
        $hostname = $ip;
    }

    my $json = {};
    $$json{ "hostip"   } = $ip;
    $$json{ "hostname" } = $hostname;

    $$json{ "messaging" }{ "wsport" } = 37777;
    $$json{ "messaging" }{ "wssport" } = $wssp;
    $$json{ "messaging" }{ "zmqhostip" } = "127.0.0.1";
    $$json{ "messaging" }{ "zmqport" } = 37778;
    $$json{ "messaging" }{ "udphostip" } = "127.0.0.1";
    $$json{ "messaging" }{ "udpport" } = 37779;
    $$json{ "messaging" }{ "tcphostip" } = "127.0.0.1";
    $$json{ "messaging" }{ "tcpport" } = 37780;

    $$json{ "restricted" }{ "admin" } = ( $whoami );

    $$json{ "resources" }{ "local" } = "";

    $$json{ "resourcedefault" } = "local";
    $$json{ "submitpolicy" } = "login";

    $$json{ "lockdir" } = "$optgenapp{$sys}/etc" if $lockdir;

    $f = "appconfig.json";
    open  $fh, ">$f" || die "$0: could not open $f for writing\n";
    print $fh to_json( $json, { utf8 => 1, pretty => 1 } );
    close $fh;
}


runcmdsb( "chown -R $user:$group{$sys} $targetsvn && chmod -R g+rw $targetsvn && find . -type d | xargs chmod g+xs" );

runcmd ( "sudo su - $user -c '. /etc/profile; cd $optgenapp{$sys}/$app && genapp.pl'" );

# setup links

runcmdsb( "ln -sf $targetwwwuse $targetwww" );
if ( $requireslinks{$sys} ) {
    runcmd( "cd $targetsvn && ln -s output/html5/ajax ajax && ln -s output/html5/results results && ln -s output/html5/util util" );
}

# fixup ownership

runcmd( "mkdir $targetsvn/tmp" );
runcmd ( "sudo su - $user -c 'ln -s $targetsvn $app'" );

runcmdsb( "chown -R $user:$group{$sys} $targetsvn && chmod -R g+rw $targetsvn && find . -type d | xargs chmod g+xs" );
    
