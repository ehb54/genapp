use strict;
use warnings;

use File::Spec;
use FindBin;
use JSON::PP;
use Test::More;

use lib File::Spec->catdir( $FindBin::Bin, '..', 'lib' );
use GenAppTest qw(read_file repo_root);

# static checks of dockerfiles/php8designer: the image is built and its applications are checked
# on a docker host (dockerfiles/php8designer/README.md); these checks need no docker

my $root = repo_root( File::Spec->catdir( $FindBin::Bin, '..' ) );
my $dir = File::Spec->catdir( $root, qw(dockerfiles php8designer) );
my $source = read_file( File::Spec->catfile( $dir, 'Dockerfile' ) );
my $build = read_file( File::Spec->catfile( $dir, 'build.sh' ) );
my $start = read_file( File::Spec->catfile( $dir, 'genapp-start' ) );
my $fixture_directives = read_file( File::Spec->catfile( $dir, 'genapptest-directives.json' ) );
my $json = JSON::PP->new;
my $composer = $json->decode( read_file( File::Spec->catfile(
    $root, qw(languages html5 composer.json) ) ) );
my $nodeapi_package = $json->decode( read_file( File::Spec->catfile(
    $root, qw(languages nodeapi package.json) ) ) );
my $ui2_package = $json->decode( read_file( File::Spec->catfile(
    $root, qw(languages ui2 react package.json) ) ) );

like( $source, qr/^ARG UBUNTU=ubuntu:24[.]04$/m, 'the image is built on Ubuntu 24.04' );
unlike( $source, qr/pro attach|ubuntu-pro-client|ubuntu-advantage/,
    'the image does not need Ubuntu Pro' );
like( $source, qr/libapache2-mod-php8[.]3/, 'Apache runs PHP 8.3' );

# pinned downloads
for my $what ( qw(PYTHON2 EXT_MONGODB GO NODE) ) {
    like( $source, qr/ARG ${what}_SHA256=[0-9a-f]{64}\n/,
        "the $what download has a pinned SHA-256" );
    like( $source, qr/echo "\$${what}_SHA256  \S+" \| sha256sum -c -/,
        "the $what download is checked against it" );
}
like( $source, qr/ARG MONGODB_VERSION=8[.]0[.]\d+\n/, 'MongoDB server is pinned to an 8.0 release' );
like( $source, qr/mongodb-org-server=\$MONGODB_VERSION/, 'the pinned MongoDB release is installed' );
like( $source, qr{signed-by=/usr/share/keyrings/mongodb-server-8[.]0[.]gpg},
    'the MongoDB repository key is scoped with signed-by' );
unlike( $source, qr/\bapt-key\b/, 'no repository uses the obsolete global apt-key store' );

# the composer libraries are resolved for the extension the image builds
my ($ext_mongodb) = $source =~ /^ARG EXT_MONGODB_VERSION=(\S+)$/m;
is( $composer->{config}{platform}{'ext-mongodb'}, $ext_mongodb,
    'composer.json resolves the libraries for the mongodb extension the image builds' );
like( $source, qr/version_compare\(phpversion\("mongodb"\), "\Q$ext_mongodb\E", ">="\)/,
    'the build fails unless that mongodb extension is loaded' );

# the Node.js release satisfies the engines of the node api and of the UI2 build
my ($node) = $source =~ /^ARG NODE_VERSION=(\d+[.]\d+[.]\d+)$/m;
ok( defined $node, 'Node.js is pinned to a release' );
for my $package ( [ 'languages/nodeapi', $nodeapi_package ], [ 'languages/ui2/react', $ui2_package ] ) {
    my ( $name, $p ) = @$package;
    my ($min) = ( $p->{engines}{node} // q{} ) =~ /^>=\s*(\d+[.]\d+[.]\d+)$/;
    ok( defined $min && version_ge( $node, $min ),
        "Node.js $node satisfies $name engines.node " . ( $p->{engines}{node} // 'undefined' ) );
}

# Apache hardening, as in dockerfiles/php7designer
like( $source, qr/ServerTokens Prod/, 'Apache does not report its version in headers' );
like( $source, qr/ServerSignature Off/, 'Apache error pages carry no server signature' );
like( $source, qr/TraceEnable Off/, 'Apache refuses TRACE' );
like( $source, qr/Options -Indexes/, 'Apache lists no directories under /var/www' );
unlike( $source, qr/phpinfo\(/, 'the image publishes no phpinfo page' );

# ids the sites' volumes depend on
like( $source, qr/groupadd --system --gid 101 mongodb/, 'the mongodb group has gid 101' );
like( $source, qr/useradd --system --uid 100 /, 'the mongodb user has uid 100' );

# Java archives left out
like( $build, qr{rm -f "\$ctx/genapp/etc/closure_compiler[.]jar" "\$ctx/genapp/languages/java/add/lib/libthrift-0[.]9[.]1[.]jar"},
    'build.sh leaves the Closure Compiler and Thrift 0.9.1 archives out of the build context' );
like( $source, qr{test ! -e \$GENAPP/etc/closure_compiler[.]jar},
    'the build fails if the Closure Compiler archive is in the image' );

# entry point
like( $start, qr/until mongosh .*ping/, 'the container waits for MongoDB before the messaging services' );
like( $start, qr/trap stop TERM INT/, 'docker stop shuts down Apache, MongoDB and the messaging services' );

# test target
like( $source, qr{cp -a \$GENAPP/t/fixtures/apps/minimal_html5 \$APPBASE/genapptest},
    'the test image uses the maintained minimal HTML5 fixture as genapptest' );
like( $source, qr{\$GENAPP/bin/genapp --language=html5 -kl}, 'genapptest is generated for html5 only' );
like( $source, qr{getapp[.]pl -gen -ref svn-r\d+/tutorial2 git tutorial2},
    'the test image installs an application with getapp.pl from git' );
like( $fixture_directives, qr/"zmqversion"\s*:\s*"4"/,
    'genapptest builds the ZeroMQ 4 TCP messaging server' );

done_testing();

sub version_ge {
    my ( $have, $want ) = @_;
    my @h = split /[.]/, $have;
    my @w = split /[.]/, $want;
    for my $i ( 0 .. 2 ) {
        return 1 if $h[$i] > $w[$i];
        return 0 if $h[$i] < $w[$i];
    }
    return 1;
}
