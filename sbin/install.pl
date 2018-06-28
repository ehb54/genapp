#!/usr/bin/perl

my $gb   = $ENV{ "GENAPP" } || die "$0: environment variable GENAPP must be set\n";

print "perl version is $]\n" if $debug;
print "command is: $0 @ARGV\n" if $debug;

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

# configuration

my $appbase = "/opt/genapp";

# uncomment for debugguing
# $debug++;

# end configuration

use JSON -support_by_pp;

my $home = $ENV{ "HOME" } || die "$0: environment variable HOME must be set\n";

$sorry = "------------------------------------------------------------
We are sorry that your operating system / release is not currently supported.
Please let us know your requirements and we can likely provide an install script to work with your system.
You can subscribe to the mailing list http://biochem.uthscsa.edu/mailman/listinfo/genapp-devel
and then send your questions to genapp-devel\@biochem.uthscsa.edu
------------------------------------------------------------
";

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
    print "sd cmd is <$cmd>\n";
    runcmd( $cmd );
}

sub add_to_phpini {
    my $phpfile = shift;

    die "$0: $phpfile does not exist\n" if !-e $phpfile;
    die "$0: $phpfile is not readable\n" if !-r $phpfile;

    open my $fh, $phpfile || die "$0: error reading $phpfile\n";
    my @phpini = <$fh>;
    close $fh;

    my @phpext = grep ( /extension\s*=/, @phpini );
    @phpext = grep ( !/\s*;/, @phpext );
    @phpext = grep ( s/^\s*extension\s*=\s*//, @phpext );
    @phpext = grep ( s/^\s*//g, @phpext );
    @phpext = grep ( s/\.so//, @phpext );
    grep chomp, @phpext;

    my %hasext;
    foreach my $i ( @phpext ) {
        $hasext{ $i }++;
    }

    my $add;
    foreach my $check ( @_ ) {
        if ( !$hasext{ $check } ) {
            $add .= "; Enable $check extension module\nextension=${check}.so\n";
        }
    }
    my $cmd;
    if ( $add ) {
        $cmd = "cat <<_EOF >> $phpfile\n${add}_EOF\n";
    }
    return $cmd;
}

# get system configuration information
my $cfgjson = {};
my $cfgjsonf = "$gb/etc/config.json";
my $cfgjsonnotes = '-'x80 . "\n
$cfgjsonf contains global system information.
this is used to setup individual applications values.
to build a default config.json file
$gb/sbin/setconfig.pl -pj
and verify the information is correct.
NB: if the machine is not publically exposed, you probably want to change the hostip and hostname, as it will likely report the public ip of your firewall.
    You can get a full set of options listed by running $gb/sbin/setconfig.pl -h
    If you know the ethernet interface to run on, $gb/sbin/setconfig.pl -if network-interface-id can be helpful
    The -f option will force the changes to a previously set $cfgjsonf file
    The full options are listed by $gb/sbin/setconfig.pl -h
    You can also manually edit $cfgjsonf

Once you are satisified that the setting are correct 
you can rerun $gb/sbin/install
" . '-'x80 . "\n"
;

# get config info

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

die "$0: no webroot defined in $cfgjson
please verify and correct before proceeding

$cfgjsonnotes
" if !$$cfgjson{ 'webroot' };

if ( !$$cfgjson{ 'lockdir' } ) {
    $$cfgjson{ 'lockdir' } = "$gb/etc";
}

die "$0: no messaging:wsport defined in $cfgjson
please verify and correct before proceeding

$cfgjsonnotes
" if !$$cfgjson{ 'messaging' }{ 'wsport' };

$wsport = $$cfgjson{ 'messaging' }{ 'wsport' };

# screen os / os_release

my $os = $$cfgjson{ 'os' } || die "$0: $cfgjsonf does not contain an 'os' tag. $cfgjsonnotes";
my $os_release = $$cfgjson{ 'os_release' } || die "$0: $cfgjsonf does not contain an 'os_release' tag. $cfgjsonnotes";

if ( $os eq 'ubuntu' ) {
    die "only ubuntu 14.04, 16.04 and 18.04 are currently supported and this appears to be version $os_release\n$sorry" if $os_release != 14.04 && $os_release != 16.04 && $os_release != 18.04;
}

if ( $os eq 'centos' ) {
    die "only Centos 6.7, 6.8, 6.9, 7.2, 7.3, 7.4 and 7.5 currently supported and this appears to be version $os_release\n$sorry" if $os_release !~ /^6\.(7|8|9)$/ && $os_release !~ /^7\.(2|3|4|5)/;
}

if ( $os eq 'redhat' ) {
    die "only Red Hat Enterprise Linux Server 6.7 and 6.8 are currently supported and this appears to be version $os_release\n$sorry" if $os_release !~ /^6\.(7|8)$/;
}    

if ( $os eq 'slackware' ) {
    die "slackware install not currently supported\n";
}

my $whoami = `whoami`;
chomp $whoami;

my $CPUS=`grep processor /proc/cpuinfo | wc -l`;
grep chomp $CPUS;
$CPUS = 1 if !$CPUS;
$CPUS *= 2;

# ------ ubuntu 14.04 ------

if ( $os eq 'ubuntu' && $os_release == 14.04 ) {
    # install required modules

    runcmd( "sudo apt-get -y install mlocate build-essential apache2 libzmq-dev libapache2-mod-php5 php-pear php5-imagick php-mail php-mail-mime php5-mongo php5-dev mongodb pkg-config re2c uuid-dev abiword wget" );
    runcmdsb( "yes '' | pecl install uuid zmq-beta" );

    # zmq to php

    runcmdsb( "cat <<_EOF > /etc/php5/mods-available/zmq.ini
; configuration for php zmq module
; priority=20
extension=zmq.so
_EOF
php5enmod zmq" );

    # add pcntl to php

    my $pcntl_so_exists = `cd /usr/lib/php5/20*/ ; ls -1 pcntl.so`;
    
    if ( $pcntl_so_exists !~ /pcntl.so/ ) {
        runcmdsb( "mkdir /tmp/phpsource
cd /tmp/phpsource
apt-get source php5
cd /tmp/phpsource/php5-*/ext/pcntl
phpize
./configure
make
cd modules
cp pcntl.so /usr/lib/php5/20*/
cat <<_EOF > /etc/php5/mods-available/pcntl.ini
; configuration for php pcntl module
; priority=20
extension=pcntl.so
_EOF
" );
    } else {
        print "skipped pcntl.so module install since preexisting\n";
    }
    runcmdsb( "sed \"s/^disable_functions = pcntl/\;disable_functions = pcntl/\" /etc/php5/apache2/php.ini > /tmp/_php.ini
cp /etc/php5/apache2/php.ini{,.org}
mv /tmp/_php.ini /etc/php5/apache2/php.ini
#php5enmod pcntl" );

    # add proxy support for ws, wss
    runcmdsb( "cat <<_EOF > /etc/apache2/mods-available/wsproxy.conf
# ws proxy pass
# priority=20
ProxyPass /ws2 ws://localhost:$wsport/
_EOF
cat <<_EOF > /etc/apache2/mods-available/wsproxy.load
_EOF
cat <<_EOF > /etc/apache2/mods-available/wssproxy.conf
# wss proxy pass
# priority=20
ProxyPass /wss2 ws://localhost:$wsport/
_EOF
cat <<_EOF > /etc/apache2/mods-available/wssproxy.load
_EOF
");
    runcmd( "sudo a2enmod proxy proxy_wstunnel wsproxy" );

    # genapp html5 likes php at /usr/local/bin/php so make sure it exists

    if ( -e "/usr/bin/php" && !-e "/usr/local/bin/php" ) {
        runcmd( "sudo bash -c 'ln -s /usr/bin/php /usr/local/bin/php'" );
    }

    # make the base of the genapp instances directory, create group genapp, add user & www-data to genapp group

    runcmdsb( "mkdir -p $appbase
groupadd genapp
useradd genapp -r -s /usr/sbin/nologin -d $appbase -g genapp
chmod g+rwx $appbase
chown $whoami:genapp $appbase
chmod g+s $appbase
mkdir $$cfgjson{'lockdir'}
chown genapp:genapp $$cfgjson{'lockdir'}
chmod g+rwx $$cfgjson{'lockdir'}
usermod -g users -G genapp $whoami
usermod -G genapp \'www-data\'
chgrp -R genapp $gb
chmod g+w $gb/etc
" );

    # setup local system definitions

    runcmdsb( "cat <<_EOF > /etc/profile.d/genapp.sh
export GENAPP=$gb
export PATH=\\\\\\\$GENAPP/bin:\\\\\\\$PATH
_EOF
" );

    # php info for debugging
    
    runcmdsb( "cat <<_EOF > $$cfgjson{'webroot'}/php_info.php
<?php
phpinfo();
?>
_EOF
" );

    # setup genapptest instance

    runcmd( "cd $appbase && $gb/sbin/getapp.pl -force -gen -admin $whoami svn genapptest" );

    # apache2 security needed ?

    runcmdsb( "cat <<_EOF >> /etc/apache2/conf-enabled/security.conf
# add Alias /genapptest $$cfgjson{'webroot'}/genapptest
<Directory $$cfgjson{'webroot'}/genapptest>
 Options FollowSymLinks
 AllowOverride None
 Order Allow,Deny
 Allow from all
</Directory>
<Directory /var/www/>
	Options FollowSymLinks
	AllowOverride None
	Require all granted
</Directory>
_EOF
" );

    # add ws servers to startup

    runcmdsb( "cp $appbase/genapptest/output/html5/util/rc.genapp /etc/init.d
update-rc.d rc.genapp defaults 99
update-rc.d mongodb defaults" );

    # start ws servers
    runcmdsb( "sg genapp -c '/etc/init.d/rc.genapp start'" );

# restart apache2

    runcmd( "sudo service apache2 restart" );
    exit();
}

# ------ centos 6.7 & 6.8 & 6.9 -------
if ( $os eq 'centos' && ( $os_release == 6.7 || $os_release == 6.8 || $os_release == 6.9 ) ) {
    # install required modules

#    runcmdsb( "rpm -Uvh http://mirror.webtatic.com/yum/el6/latest.rpm" );
    runcmdsb( "yum -y groupinstall 'Development tools'" );
    runcmdsb( "yum -y install centos-release-scl" );

    runcmdsb( "yum -y install mlocate httpd24-httpd httpd24-httpd-devel rh-php56-php rh-php56-php-devel rh-php56-php-pear rh-php56-php-pecl-mongo mongodb mongodb-server wget libuuid-devel zeromq-devel openssl-devel ImageMagick ImageMagick-devel" );
# old commands
#    runcmdsb( "yum -y install mlocate httpd24-httpd httpd24-httpd-devel httpd24-php55 http24-php55w-devel httpd24--pecl-imagick mongodb mongodb-server pkg-config wget libuuid-devel zeromq-devel openssl-devel" );
#    runcmdsb( "yum -y install mlocate httpd24-httpd httpd24-httpd-develhttpd24-php55 http24-php55w-devel httpd24--pecl-imagick mongodb mongodb-server pkg-config wget libuuid-devel zeromq-devel openssl-devel" );
#-zmq php-pecl-http php-pear php-pecl-imagick php-mail php-mail-mime php-pecl-mongo php-devel mongodb mongodb-server pkg-config re2c php-pecl-uuid wget" );

    my $rhsclphp    = "/opt/rh/rh-php56/root";
    my $rhsclphpetc = "/etc/opt/rh/rh-php56/";
    my $rhsclhttpd  = "/opt/rh/httpd24/root";

    runcmdsb( "yes '' | $rhsclphp/usr/bin/pecl install uuid zmq-beta mongo imagick;
cat <<_EOF > $rhsclphpetc/php.d/uuid.ini
; Enable uuid extension module
extension=uuid.so
_EOF
cat <<_EOF > $rhsclphpetc/php.d/zmq.ini
; Enable zmq extension module
extension=zmq.so
_EOF
cat <<_EOF > $rhsclphpetc/php.d/imagick.ini
; Enable imagick extension module
extension=imagick.so
_EOF
#cat <<_EOF > $rhsclphpetc/php.d/mongo.ini
#; Enable mongo extension module
#extension=mongo.so
#_EOF
" );

    runcmdsb( "scl enable rh-php56 'pear upgrade --force --alldeps http://pear.php.net/get/PEAR-1.10.5'" );
    runcmdsb( "scl enable rh-php56 'pear install --alldeps Mail Mail_Mime Net_SMTP'" );

    `sudo killall mongod 2> /dev/null`;
    runcmdsb( "service mongod start" );

    runcmdsb( "cat <<_EOF > $rhsclhttpd/etc/httpd/conf.d/wsproxy.conf
# ws proxy pass
# priority=20
ProxyPass /ws2 ws://localhost:$wsport/
ProxyPass /wss2 ws://localhost:$wsport/
_EOF
cat <<_EOF > $rhsclhttpd/etc/httpd/conf.d/genapp.conf
SetEnv GENAPP $gb
_EOF
");

    runcmdsb( "cat <<_EOF > $rhsclhttpd/etc/httpd/conf.d/noindices.conf
<Directory \"$rhsclhttpd/var/www/html\">
    Options FollowSymLinks
    AllowOverride None
    Require all granted
</Directory>
_EOF
");

    # scl puts php in $rhsclphp so link it

    runcmdsb( "ln -sf $rhsclphp/usr/bin/php /usr/bin/php" );

    # scl puts httpd root in $rhsclphp so link it

    if ( -e "/var/www" ) {
        if ( -d "/var/www" || -f "/var/www" ) {
            my $bdir = "/var/www.previous";
            my $ext ;
            while ( -e $bdir ) {
               $ext++;
               $bdir = "/var/www.previous-$ext";
            }
            $warnings .= "/var/www is backed up in $bdir";
            runcmdsb( "mv /var/www $bdir" );
        } else {
            runcmdsb( "rm /var/www" );
        }
    }

    runcmdsb( "ln -sf $rhsclhttpd/var/www /var/www" );

    # genapp html5 likes php at /usr/local/bin/php so make sure it exists

    if ( -e "/usr/bin/php" && !-e "/usr/local/bin/php" ) {
        runcmd( "sudo bash -c 'ln -s /usr/bin/php /usr/local/bin/php'" );
    }

    # make the base of the genapp instances directory, create group genapp, add user & apache to genapp group

    runcmdsb( "mkdir -p $appbase
groupadd genapp
useradd genapp -r -s /usr/sbin/nologin -d $appbase -g genapp
chmod g+rwx $appbase
chown $whoami:genapp $appbase
chmod g+s $appbase
mkdir $$cfgjson{'lockdir'}
chown genapp:genapp $$cfgjson{'lockdir'}
chmod g+rwx $$cfgjson{'lockdir'}
usermod -g users -G genapp $whoami
usermod -G genapp \'apache\'
chgrp -R genapp $gb
chmod g+w $gb/etc
" );

    # setup local system definitions

    runcmdsb( "cat <<_EOF > /etc/profile.d/genapp.sh
export GENAPP=$gb
export PATH=\\\\\\\$GENAPP/bin:\\\\\\\$PATH
_EOF
cat <<_EOF > /etc/profile.d/genapp.csh
setenv GENAPP $gb
setenv PATH=\\\\\\\$\{GENAPP\}/bin:\\\\\\\$\{PATH}
_EOF

" );

    runcmdsb( "cat <<_EOF > $$cfgjson{'webroot'}/php_info.php
<?php
phpinfo();
?>
_EOF
" );

    # setup genapptest instance

    runcmd( "cd $appbase && $gb/sbin/getapp.pl -force -gen -admin $whoami svn genapptest" );

    # add ws servers to startup

    runcmdsb( "cp $appbase/genapptest/output/html5/util/rc.genapp /etc/init.d" );
    runcmdsb( "chkconfig --add rc.genapp" );
    runcmdsb( "/etc/init.d/rc.genapp start" );

    # open ports
    {
        my $iptab = `service iptables status | grep ACCEPT | grep INPUT | grep dpt:80`;
        chomp $iptab;
        if ( $iptab !~ /tcp/ ) {
            runcmdsb( "iptables -I INPUT 1 -m state --state NEW -m tcp -p tcp --dport 80 -j ACCEPT
service iptables save" );
        }
    }
    if ( $$cfgjson{ 'https' } ) {
        my $iptab = `service iptables status | grep ACCEPT | grep INPUT | grep dpt:443`;
        chomp $iptab;
        if ( $iptab !~ /tcp/ ) {
            runcmdsb( "iptables -I INPUT 1 -m state --state NEW -m tcp -p tcp --dport 443 -j ACCEPT
service iptables save" );
        }
    }

    runcmdsb( "semanage permissive -a httpd_t; service httpd24-httpd restart && chkconfig httpd24-httpd on" );
    exit();
}

# ------ centos 7.2,7.3,7.4,7.5 -------
if ( $os eq 'centos' && $os_release =~ /^7\.(2|3|4|5)/ ) {

    # install required modules

#    runcmdsb( "rpm -Uvh http://mirror.webtatic.com/yum/el6/latest.rpm" );
    runcmdsb( "yum -y groupinstall 'Development tools'" );
    runcmdsb( "yum -y install centos-release-scl" );

    runcmdsb( "yum -y install mlocate httpd24-httpd httpd24-httpd-devel rh-php56-php rh-php56-php-devel rh-php56-php-pear rh-php56-php-pecl-mongo mongodb mongodb-server wget libuuid-devel zeromq-devel openssl-devel ImageMagick ImageMagick-devel" );
# old commands
#    runcmdsb( "yum -y install mlocate httpd24-httpd httpd24-httpd-devel httpd24-php55 http24-php55w-devel httpd24--pecl-imagick mongodb mongodb-server pkg-config wget libuuid-devel zeromq-devel openssl-devel" );
#    runcmdsb( "yum -y install mlocate httpd24-httpd httpd24-httpd-develhttpd24-php55 http24-php55w-devel httpd24--pecl-imagick mongodb mongodb-server pkg-config wget libuuid-devel zeromq-devel openssl-devel" );
#-zmq php-pecl-http php-pear php-pecl-imagick php-mail php-mail-mime php-pecl-mongo php-devel mongodb mongodb-server pkg-config re2c php-pecl-uuid wget" );

    my $rhsclphp    = "/opt/rh/rh-php56/root";
    my $rhsclphpetc = "/etc/opt/rh/rh-php56/";
    my $rhsclhttpd  = "/opt/rh/httpd24/root";

    runcmdsb( "yes '' | $rhsclphp/usr/bin/pecl install uuid zmq-beta mongo imagick;
cat <<_EOF > $rhsclphpetc/php.d/uuid.ini
; Enable uuid extension module
extension=uuid.so
_EOF
cat <<_EOF > $rhsclphpetc/php.d/zmq.ini
; Enable zmq extension module
extension=zmq.so
_EOF
cat <<_EOF > $rhsclphpetc/php.d/imagick.ini
; Enable imagick extension module
extension=imagick.so
_EOF
#cat <<_EOF > $rhsclphpetc/php.d/mongo.ini
#; Enable mongo extension module
#extension=mongo.so
#_EOF
" );

    runcmdsb( "scl enable rh-php56 'pear upgrade --force --alldeps http://pear.php.net/get/PEAR-1.10.5'" );
    runcmdsb( "scl enable rh-php56 'pear install --alldeps Mail Mail_Mime Net_SMTP'" );

    `sudo killall mongod 2> /dev/null`;
    runcmdsb( "service mongod start" );

    runcmdsb( "cat <<_EOF > $rhsclhttpd/etc/httpd/conf.d/wsproxy.conf
# ws proxy pass
# priority=20
ProxyPass /ws2 ws://localhost:$wsport/
ProxyPass /wss2 ws://localhost:$wsport/
_EOF
cat <<_EOF > $rhsclhttpd/etc/httpd/conf.d/genapp.conf
SetEnv GENAPP $gb
_EOF
");

    runcmdsb( "cat <<_EOF > $rhsclhttpd/etc/httpd/conf.d/noindices.conf
<Directory \"$rhsclhttpd/var/www/html\">
    Options FollowSymLinks
    AllowOverride None
    Require all granted
</Directory>
_EOF
");

    # scl puts php in $rhsclphp so link it

    runcmdsb( "ln -sf $rhsclphp/usr/bin/php /usr/bin/php" );

    # scl puts httpd root in $rhsclphp so link it

    if ( -e "/var/www" ) {
        if ( -d "/var/www" || -f "/var/www" ) {
            my $bdir = "/var/www.previous";
            my $ext ;
            while ( -e $bdir ) {
               $ext++;
               $bdir = "/var/www.previous-$ext";
            }
            $warnings .= "/var/www is backed up in $bdir";
            runcmdsb( "mv /var/www $bdir" );
        } else {
            runcmdsb( "rm /var/www" );
        }
    }

    runcmdsb( "ln -sf $rhsclhttpd/var/www /var/www" );

    # genapp html5 likes php at /usr/local/bin/php so make sure it exists

    if ( -e "/usr/bin/php" && !-e "/usr/local/bin/php" ) {
        runcmd( "sudo bash -c 'ln -s /usr/bin/php /usr/local/bin/php'" );
    }

    # make the base of the genapp instances directory, create group genapp, add user & apache to genapp group

    runcmdsb( "mkdir -p $appbase
groupadd genapp
useradd genapp -r -s /usr/sbin/nologin -d $appbase -g genapp
chmod g+rwx $appbase
chown $whoami:genapp $appbase
chmod g+s $appbase
mkdir $$cfgjson{'lockdir'}
chown genapp:genapp $$cfgjson{'lockdir'}
chmod g+rwx $$cfgjson{'lockdir'}
usermod -g users -G genapp $whoami
usermod -G genapp \'apache\'
chgrp -R genapp $gb
chmod g+w $gb/etc
" );

    # setup local system definitions

    runcmdsb( "cat <<_EOF > /etc/profile.d/genapp.sh
export GENAPP=$gb
export PATH=\\\\\\\$GENAPP/bin:\\\\\\\$PATH
_EOF
cat <<_EOF > /etc/profile.d/genapp.csh
setenv GENAPP $gb
setenv PATH=\\\\\\\$\{GENAPP\}/bin:\\\\\\\$\{PATH}
_EOF

" );

    runcmdsb( "cat <<_EOF > $$cfgjson{'webroot'}/php_info.php
<?php
phpinfo();
?>
_EOF
" );

    # setup genapptest instance

    runcmd( "cd $appbase && $gb/sbin/getapp.pl -force -gen -admin $whoami svn genapptest" );

    # add ws servers to startup

    runcmdsb( "cp $appbase/genapptest/output/html5/util/rc.genapp /etc/init.d" );
    runcmdsb( "chkconfig --add rc.genapp" );
    runcmdsb( "/etc/init.d/rc.genapp start" );

    # open ports
    {
        my $iptab = `service iptables status | grep ACCEPT | grep INPUT | grep dpt:80`;
        chomp $iptab;
        if ( $iptab !~ /tcp/ ) {
            runcmdsb( "iptables -I INPUT 1 -m state --state NEW -m tcp -p tcp --dport 80 -j ACCEPT
service iptables save" );
        }
    }
    if ( $$cfgjson{ 'https' } ) {
        my $iptab = `service iptables status | grep ACCEPT | grep INPUT | grep dpt:443`;
        chomp $iptab;
        if ( $iptab !~ /tcp/ ) {
            runcmdsb( "iptables -I INPUT 1 -m state --state NEW -m tcp -p tcp --dport 443 -j ACCEPT
service iptables save" );
        }
    }

    runcmdsb( "semanage permissive -a httpd_t; service httpd24-httpd restart && chkconfig httpd24-httpd on" );
    exit();
}

# ------ redhat -------
if ( $os eq 'redhat' ) {
    # install required modules

#    runcmdsb( "rpm -Uvh http://mirror.webtatic.com/yum/el6/latest.rpm" );
    runcmdsb( "cat <<_EOF > /etc/yum.repos.d/mongodb.repo
[mongodb]
name=MongoDB Repository
baseurl=http://downloads-distro.mongodb.org/repo/redhat/os/x86_64/
gpgcheck=0
enabled=1
_EOF
# the 3.2 repo didn't seem to work
#cat <<_EOF > /etc/yum.repos.d/mongodb-org-3.2.repo
#[mongodb-org-3.2]
#name=MongoDB Repository
#baseurl=https://repo.mongodb.org/yum/redhat/\$releasever/mongodb-org/3.2/x86_64/
#gpgcheck=1
#enabled=1
#gpgkey=https://www.mongodb.org/static/pgp/server-3.2.asc
#_EOF
cat <<_EOF > /etc/yum.repos.d/mongodb-org-2.6.repo
[mongodb-org-2.6]
name=MongoDB 2.6 Repository
baseurl=http://downloads-distro.mongodb.org/repo/redhat/os/x86_64/
gpgcheck=0
enabled=1
_EOF
cat <<_EOF > /etc/yum.repos.d/fengshuo_zeromq.repo
[home_fengshuo_zeromq]
name=The latest stable of zeromq builds (CentOS_CentOS-6)
type=rpm-md
baseurl=http://download.opensuse.org/repositories/home:/fengshuo:/zeromq/CentOS_CentOS-6/
gpgcheck=1
gpgkey=http://download.opensuse.org/repositories/home:/fengshuo:/zeromq/CentOS_CentOS-6/repodata/repomd.xml.key
enabled=1
_EOF
# semanage port -a -t mongod_port_t -p tcp 27017
");

    runcmdsb( "yum -y groupinstall 'Development tools'" );
    runcmdsb( "yum-config-manager --enable rhel-server-rhscl-6-rpms" );
    {
        my @res = `sudo subscription-manager list --available --all 2>&1 | grep 'not yet registered'`;
        die "$0: could not enable rhel-server-rhscl-6-rpms, the system does not appear to be registered. Try \$ sudo subscription-manager register --help" if @res;
        @res = `sudo yum repolist 2> /dev/null | grep rhscl`;
        die '-'x80 . "
$0: you appeared to be registered, but need to attach to a pool.  you can use:
\$ sudo subscription-manager list --available
and identify a 'Pool ID:'=pool_id and then use that pool_id to
\$ sudo subscription-manager attach --pool=pool_id
" . '-'x80 . "
You may also find info at this url:
https://access.redhat.com/documentation/en-US/Red_Hat_Software_Collections/2/html-single/2.1_Release_Notes/index.html#sect-Installation-Subscribe
" . '-'x80 . "
" if !@res;
    }

    runcmdsb( "yum -y install mlocate httpd24-httpd httpd24-httpd-devel rh-php56-php rh-php56-php-devel rh-php56-php-pear rh-php56-php-pecl-mongo mongodb-org mongodb-org-server wget libuuid-devel zeromq-devel openssl-devel libpng-devel libjpeg-devel fontconfig-devel freetype-devel fftw-devel libtiff-devel cairo-devel pango pango-devel" );

    # need imagemagick from source :(
    my $imversion = "ImageMagick-6.9.7-10.tar.xz";
    runcmd( "rm -f /tmp/$imversion 2>/dev/null;cd /tmp && wget http://transloadit.imagemagick.org/download/releases/$imversion && tar Jxf $imversion && cd ImageMagick-* && ./configure && make -j$CPUS && sudo make install" ) if !-e "/usr/local/bin/MagickWand-config";

    my $rhsclphp    = "/opt/rh/rh-php56/root";
    my $rhsclphpetc = "/etc/opt/rh/rh-php56/";
    my $rhsclhttpd  = "/opt/rh/httpd24/root";

    runcmdsb( "yes '' | $rhsclphp/usr/bin/pecl channel-update pecl.php.net" );
    runcmdsb( "yes '' | $rhsclphp/usr/bin/pecl install uuid zmq-beta mongo imagick;
cat <<_EOF > $rhsclphpetc/php.d/uuid.ini
; Enable uuid extension module
extension=uuid.so
_EOF
cat <<_EOF > $rhsclphpetc/php.d/zmq.ini
; Enable zmq extension module
extension=zmq.so
_EOF
cat <<_EOF > $rhsclphpetc/php.d/imagick.ini
; Enable imagick extension module
extension=imagick.so
_EOF
#cat <<_EOF > $rhsclphpetc/php.d/mongo.ini
#; Enable mongo extension module
#extension=mongo.so
#_EOF
" );

    runcmdsb( "scl enable rh-php56 'pear upgrade --force --alldeps http://pear.php.net/get/PEAR-1.10.5'" );
    runcmdsb( "scl enable rh-php56 'pear install --alldeps Mail Mail_Mime Net_SMTP'" );

    `sudo killall mongod 2> /dev/null`;
    runcmdsb( "service mongod start" );

    # add proxy support for ws, wss
    runcmdsb( "cat <<_EOF > $rhsclhttpd/etc/httpd/conf.d/wsproxy.conf
# ws proxy pass
# priority=20
ProxyPass /ws2 ws://localhost:$wsport/
ProxyPass /wss2 ws://localhost:$wsport/
_EOF
cat <<_EOF > $rhsclhttpd/etc/httpd/conf.d/genapp.conf
SetEnv GENAPP $gb
_EOF
");

    runcmdsb( "cat <<_EOF > $rhsclhttpd/etc/httpd/conf.d/noindices.conf
<Directory \"$rhsclhttpd/var/www/html\">
    Options FollowSymLinks
    AllowOverride None
    Require all granted
</Directory>
_EOF
");

    # scl puts php in $rhsclphp so link it

    runcmdsb( "ln -sf $rhsclphp/usr/bin/php /usr/bin/php" );

    # scl puts httpd root in $rhsclphp so link it

    if ( -e "/var/www" ) {
        if ( -d "/var/www" || -f "/var/www" ) {
            my $bdir = "/var/www.previous";
            my $ext ;
            while ( -e $bdir ) {
               $ext++;
               $bdir = "/var/www.previous-$ext";
            }
            $warnings .= "/var/www is backed up in $bdir";
            runcmdsb( "mv /var/www $bdir" );
        } else {
            runcmdsb( "rm /var/www" );
        }
    }
      
    runcmdsb( "ln -sf $rhsclhttpd/var/www /var/www" );

    # genapp html5 likes php at /usr/local/bin/php so make sure it exists

    if ( -e "/usr/bin/php" && !-e "/usr/local/bin/php" ) {
        runcmdsb( "ln -s /usr/bin/php /usr/local/bin/php" );
    }

    # make the base of the genapp instances directory, create group genapp, add user & apache to genapp group

    runcmdsb( "mkdir -p $appbase
groupadd genapp
useradd genapp -r -s /usr/sbin/nologin -d $appbase -g genapp
chmod g+rwx $appbase
chown $whoami:genapp $appbase
chmod g+s $appbase
mkdir $$cfgjson{'lockdir'}
chown genapp:genapp $$cfgjson{'lockdir'}
chmod g+rwx $$cfgjson{'lockdir'}
usermod -g users -G genapp $whoami
usermod -G genapp \'apache\'
chgrp -R genapp $gb
chmod g+w $gb/etc
" );

    # setup local system definitions

    runcmdsb( "cat <<_EOF > /etc/profile.d/genapp.sh
export GENAPP=$gb
export PATH=\\\\\\\$GENAPP/bin:\\\\\\\$PATH
_EOF
cat <<_EOF > /etc/profile.d/genapp.csh
setenv GENAPP $gb
setenv PATH=\\\\\\\$\{GENAPP\}/bin:\\\\\\\$\{PATH}
_EOF

" );

    runcmdsb( "cat <<_EOF > $$cfgjson{'webroot'}/php_info.php
<?php
phpinfo();
?>
_EOF
" );

    # setup genapptest instance

    runcmd( "cd $appbase && $gb/sbin/getapp.pl -force -gen -admin $whoami svn genapptest" );

    # add ws servers to startup

    runcmdsb( "cp $appbase/genapptest/output/html5/util/rc.genapp /etc/init.d" );
    runcmdsb( "chkconfig --add rc.genapp" );
    runcmdsb( "/etc/init.d/rc.genapp start" );

    runcmdsb( "semanage permissive -a httpd_t; service httpd24-httpd restart && chkconfig httpd24-httpd on" );

    {
        my $iptab = `service iptables status | grep ACCEPT | grep INPUT | grep dpt:80`;
        chomp $iptab;
        if ( $iptab !~ /tcp/ ) {
            runcmdsb( "iptables -I INPUT 1 -m state --state NEW -m tcp -p tcp --dport 80 -j ACCEPT
service iptables save" );
        }
    }
    if ( $$cfgjson{ 'https' } ) {
        my $iptab = `service iptables status | grep ACCEPT | grep INPUT | grep dpt:443`;
        chomp $iptab;
        if ( $iptab !~ /tcp/ ) {
            runcmdsb( "iptables -I INPUT 1 -m state --state NEW -m tcp -p tcp --dport 443 -j ACCEPT
service iptables save" );
        }
    }

#    runcmdsb( "service httpd restart && chkconfig httpd on" );
    exit();
}

# ------ ubuntu 16.04 ------
if ( $os eq 'ubuntu' && ( $os_release == 16.04 || $os_release == 18.04 ) ) {
    # install required modules

    my $zmqv = "3" if $os_release == 18.04;

    runcmd( "sudo add-apt-repository -y ppa:ondrej/php && sudo apt-get -y update" );
    runcmd( "sudo apt-get -y install mlocate build-essential apache2 php5.6-dev libapache2-mod-php5.6 php5.6-xml pkg-config re2c libzmq${zmqv}-dev uuid-dev abiword wget mongodb libmagickwand-6.q16-dev" );

# php-pear php-imagick php-mail php-mail-mime php-mongodb mongodb" );

    runcmdsb( "pear install --alldeps Mail Mail_Mime Net_SMTP" );
    runcmdsb( "yes '' | pecl install uuid zmq-beta mongo imagick" );

    # zmq to php

    runcmdsb( "cat <<_EOF > /etc/php/5.6/mods-available/zmq.ini
; configuration for php zmq module
; priority=20
extension=zmq.so
_EOF
cat <<_EOF > /etc/php/5.6/mods-available/imagick.ini
; Enable imagick extension module
extension=imagick.so
_EOF
cat <<_EOF > /etc/php/5.6/mods-available/mongo.ini
; Enable mongo extension module
extension=mongo.so
_EOF
phpenmod zmq mongo imagick" );

    runcmdsb( "sed \"s/^disable_functions = pcntl/\;disable_functions = pcntl/\" /etc/php/5.6/apache2/php.ini > /tmp/_php.ini
cp /etc/php/5.6/apache2/php.ini{,.org}
mv /tmp/_php.ini /etc/php/5.6/apache2/php.ini
#phpenmod pcntl" );

    # add proxy support for ws, wss
    runcmdsb( "cat <<_EOF > /etc/apache2/mods-available/wsproxy.conf
# ws proxy pass
# priority=20
ProxyPass /ws2 ws://localhost:$wsport/
_EOF
cat <<_EOF > /etc/apache2/mods-available/wsproxy.load
_EOF
cat <<_EOF > /etc/apache2/mods-available/wssproxy.conf
# wss proxy pass
# priority=20
ProxyPass /wss2 ws://localhost:$wsport/
_EOF
cat <<_EOF > /etc/apache2/mods-available/wssproxy.load
_EOF
");
    runcmd( "sudo a2enmod proxy proxy_wstunnel wsproxy" );

    # genapp html5 likes php at /usr/local/bin/php so make sure it exists

    if ( -e "/usr/bin/php" && !-e "/usr/local/bin/php" ) {
        runcmd( "sudo bash -c 'ln -s /usr/bin/php /usr/local/bin/php'" );
    }

    # make the base of the genapp instances directory, create group genapp, add user & www-data to genapp group

    runcmdsb( "mkdir -p $appbase
groupadd genapp
useradd genapp -r -s /usr/sbin/nologin -d $appbase -g genapp
chmod g+rwx $appbase
chown $whoami:genapp $appbase
chmod g+s $appbase
mkdir $$cfgjson{'lockdir'}
chown genapp:genapp $$cfgjson{'lockdir'}
chmod g+rwx $$cfgjson{'lockdir'}
usermod -g users -G genapp $whoami
usermod -G genapp \'www-data\'
chgrp -R genapp $gb
chmod g+w $gb/etc
" );

    # setup local system definitions

    runcmdsb( "cat <<_EOF > /etc/profile.d/genapp.sh
export GENAPP=$gb
export PATH=\\\\\\\$GENAPP/bin:\\\\\\\$PATH
_EOF
" );

    # php info for debugging
    
    runcmdsb( "cat <<_EOF > $$cfgjson{'webroot'}/php_info.php
<?php
phpinfo();
?>
_EOF
" );

    # setup genapptest instance

    runcmd( "cd $appbase && $gb/sbin/getapp.pl -force -gen -admin $whoami svn genapptest" );

    # apache2 security needed ?

    runcmdsb( "cat <<_EOF >> /etc/apache2/conf-enabled/security.conf
# add Alias /genapptest $$cfgjson{'webroot'}/genapptest
<Directory $$cfgjson{'webroot'}/genapptest>
 Options FollowSymLinks
 AllowOverride None
 Order Allow,Deny
 Allow from all
</Directory>
<Directory /var/www/>
	Options FollowSymLinks
	AllowOverride None
	Require all granted
</Directory>
_EOF
" );

    # add ws servers to startup

    runcmdsb( "cp $appbase/genapptest/output/html5/util/rc.genapp /etc/init.d
update-rc.d rc.genapp defaults 99
update-rc.d mongodb defaults" );

    # start ws servers
    runcmdsb( "/etc/init.d/rc.genapp start" );

# restart apache2

    runcmd( "sudo service apache2 restart" );
    exit();
}

# ------ scientific linux 7.2 -------
if ( $os eq 'scientific' && $os_release =~ /^7\.(2|3|4)(cernvm|)/ ) {

    my $cernvm;
    if ( $os_release =~ /cernvm$/ ) {
        $cernvm++;
    }

    runcmdsb( "cat <<_EOF > /etc/yum.repos.d/mongodb.repo
[mongodb]
name=MongoDB Repository
baseurl=http://downloads-distro.mongodb.org/repo/redhat/os/x86_64/
gpgcheck=0
enabled=1
_EOF
# the 3.2 repo didn't seem to work
#cat <<_EOF > /etc/yum.repos.d/mongodb-org-3.2.repo
#[mongodb-org-3.2]
#name=MongoDB Repository
#baseurl=https://repo.mongodb.org/yum/redhat/\$releasever/mongodb-org/3.2/x86_64/
#gpgcheck=1
#enabled=1
#gpgkey=https://www.mongodb.org/static/pgp/server-3.2.asc
#_EOF
cat <<_EOF > /etc/yum.repos.d/mongodb-org-2.6.repo
[mongodb-org-2.6]
name=MongoDB 2.6 Repository
baseurl=http://downloads-distro.mongodb.org/repo/redhat/os/x86_64/
gpgcheck=0
enabled=1
_EOF
cat <<_EOF > /etc/yum.repos.d/fengshuo_zeromq.repo
[home_fengshuo_zeromq]
name=The latest stable of zeromq builds (CentOS_CentOS-6)
type=rpm-md
baseurl=http://download.opensuse.org/repositories/home:/fengshuo:/zeromq/CentOS_CentOS-6/
gpgcheck=1
gpgkey=http://download.opensuse.org/repositories/home:/fengshuo:/zeromq/CentOS_CentOS-6/repodata/repomd.xml.key
enabled=1
_EOF
");

    runcmdsb( "semanage port -l | grep mongod_port_t || semanage port -a -t mongod_port_t -p tcp 27017" ) if !$cernvm;

    # install required modules

#    runcmdsb( "rpm -Uvh http://mirror.webtatic.com/yum/el6/latest.rpm" );
    runcmdsb( "yum -y groupinstall 'Development tools'" ) if !$cernvm;

    runcmdsb( "yum -y install mlocate wget httpd httpd-devel php php-devel php-pear openssl-devel libuuid-devel mongodb-org mongodb-org-server zeromq-devel" );
 
    if ( $cernvm ) {
        # need imagemagick from source :(
        my $imversion = "ImageMagick-6.9.7-10.tar.xz";
        runcmd( "rm -f /tmp/$imversion 2>/dev/null; cd /tmp && wget http://transloadit.imagemagick.org/download/releases/$imversion && tar Jxf $imversion && cd ImageMagick-* && ./configure && make -j$CPUS && sudo make install" ) if !-e "/usr/local/bin/MagickWand-config";
    } else {
        runcmdsb( "yum -y install ImageMagick ImageMagick-devel" );
    }

    my $rhsclphp    = "";
    my $rhsclphpetc = "";
    my $rhsclhttpd  = "";

    runcmdsb( "yes '' | pecl channel-update pecl.php.net" );
    runcmdsb( "yes '' | pecl install uuid zmq-beta mongo imagick" );

    if ( my $cmd = add_to_phpini( '/etc/php.ini', 'uuid', 'zmq', 'imagick', 'mongo' ) ) {
        runcmdsb( $cmd );
    }

    # rh-php56-php-pecl-mongo mongodb mongodb-server zeromq-devel" );
    runcmdsb( "yes '' | pear channel-update pear.php.net" );
    runcmdsb( "yes '' | pear install --alldeps Mail Mail_Mime Net_SMTP" );

    `sudo killall mongod 2> /dev/null`;
    runcmdsb( "service mongod start
chkconfig mongod on
" );

    runcmdsb( "cat <<_EOF > $rhsclhttpd/etc/httpd/conf.d/wsproxy.conf
# ws proxy pass
# priority=20
ProxyPass /ws2 ws://localhost:$wsport/
ProxyPass /wss2 ws://localhost:$wsport/
_EOF
cat <<_EOF > $rhsclhttpd/etc/httpd/conf.d/genapp.conf
SetEnv GENAPP $gb
_EOF
");

    runcmdsb( "cat <<_EOF > $rhsclhttpd/etc/httpd/conf.d/noindices.conf
<Directory \"$rhsclhttpd/var/www/html\">
    Options FollowSymLinks
    AllowOverride None
    Require all granted
</Directory>
_EOF
");

    # genapp html5 likes php at /usr/local/bin/php so make sure it exists

    if ( -e "/usr/bin/php" && !-e "/usr/local/bin/php" ) {
        runcmd( "sudo bash -c 'ln -s /usr/bin/php /usr/local/bin/php'" );
    }

    # make the base of the genapp instances directory, create group genapp, add user & apache to genapp group

    runcmdsb( "mkdir -p $appbase
groupadd genapp
useradd genapp -r -s /usr/sbin/nologin -d $appbase -g genapp
chmod g+rwx $appbase
chown $whoami:genapp $appbase
chmod g+s $appbase
mkdir $$cfgjson{'lockdir'} 2> /dev/null
chown genapp:genapp $$cfgjson{'lockdir'}
chmod g+rwx $$cfgjson{'lockdir'}
usermod -g users -G genapp $whoami
usermod -G genapp \'apache\'
chgrp -R genapp $gb
chmod g+w $gb/etc
" );

    # setup local system definitions

    runcmdsb( "cat <<_EOF > /etc/profile.d/genapp.sh
export GENAPP=$gb
export PATH=\\\\\\\$GENAPP/bin:\\\\\\\$PATH
_EOF
cat <<_EOF > /etc/profile.d/genapp.csh
setenv GENAPP $gb
setenv PATH=\\\\\\\$\{GENAPP\}/bin:\\\\\\\$\{PATH}
_EOF

" );

    runcmdsb( "cat <<_EOF > $$cfgjson{'webroot'}/php_info.php
<?php
phpinfo();
?>
_EOF
" );

    # setup genapptest instance

    runcmd( "cd $appbase && $gb/sbin/getapp.pl -force -gen -admin $whoami svn genapptest" );

    # add ws servers to startup

    runcmdsb( "cp $appbase/genapptest/output/html5/util/rc.genapp /etc/init.d" );
    runcmdsb( "chkconfig --add rc.genapp" );
    runcmdsb( "/etc/init.d/rc.genapp start" );

    # open ports
    if ( !$cernvm ) {
        runcmdsb( "firewall-cmd --permanent --zone=public --add-service=http" );
        if ( $$cfgjson{ 'https' } ) {
            runcmdsb( "firewall-cmd --permanent --zone=public --add-service=https" );
        }
        runcmdsb( "systemctl restart firewalld.service" );
    }

    runcmdsb( "semanage permissive -a httpd_t" ) if !$cernvm;

    if ( $cernvm ) {
        runcmdsb( "sed --in-place=.prev 's/Listen .*:80/Listen 80/g' /etc/httpd/conf/httpd.conf" );
    }

    runcmdsb( "systemctl restart httpd.service && systemctl enable httpd.service" );
    exit();
}


die "------------------------------------------------------------
Operating system identified as $os / release $os_release
$sorry";
