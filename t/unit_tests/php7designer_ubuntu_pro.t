use strict;
use warnings;

use File::Spec;
use FindBin;
use Test::More;

use lib File::Spec->catdir( $FindBin::Bin, '..', 'lib' );
use GenAppTest qw(read_file repo_root);

my $root = repo_root( File::Spec->catdir( $FindBin::Bin, '..' ) );
my $dockerfile = File::Spec->catfile(
    $root, qw(dockerfiles php7designer Dockerfile) );
my $source = read_file($dockerfile);
my $readme = read_file( File::Spec->catfile(
    $root, qw(dockerfiles php7designer README.md) ) );
my $fixture_directives = read_file( File::Spec->catfile(
    $root, qw(dockerfiles php7designer genapptest-directives.json) ) );

like( $source, qr/^# syntax=docker\/dockerfile:1[.]7$/m,
    'Dockerfile selects a BuildKit frontend with secret mounts' );
like( $source,
    qr/RUN --mount=type=secret,id=pro-attach-config,required=true/,
    'Ubuntu Pro attach configuration is mounted as a required build secret' );
like( $source,
    qr/pro attach --attach-config \/run\/secrets\/pro-attach-config/,
    'Ubuntu Pro is attached from the secret configuration' );
like( $source, qr/apt-get .*Acquire::Retries=5.* upgrade -y/,
    'installed Ubuntu packages are upgraded while Pro is attached' );
like( $source, qr/apt-get .*Acquire::Retries=5.* install -y/s,
    'Ubuntu package downloads use bounded retries' );
like( $source, qr/liblwp-protocol-https-perl/,
    'HTTPS-capable LWP is installed from Ubuntu packages' );
unlike( $source, qr/cpanm[^\n]*LWP::UserAgent/,
    'LWP is not replaced with an unpinned CPAN release' );
like( $source, qr/php-mail-mime/, 'PEAR mail libraries come from Ubuntu packages' );
unlike( $source, qr/^RUN pear (?:channel-update|install)/m,
    'mail libraries do not depend on the unreliable public PEAR REST service' );
like( $source, qr/pecl install uuid-1[.]3[.]0 mongodb-1[.]20[.]1 imagick-3[.]8[.]1/,
    'PHP 7-compatible PECL extension releases are pinned' );
like( $source, qr/test -s \/usr\/lib\/php\/20190902\/mongodb[.]so/,
    'the build fails if the MongoDB extension was not installed' );
like( $source, qr/^FROM ubuntu:20[.]04 AS php7designer-security-base$/m,
    'patched runtime is available as an independently verifiable build stage' );
like( $source, qr/TraceEnable Off.*FROM php7designer-security-base AS php7designer/s,
    'Apache hardening is part of the security base stage' );
like( $source,
    qr{COPY --chown=genapp:genapp t/fixtures/apps/minimal_html5/ \$APPBASE/genapptest/},
    'complete image uses the maintained minimal HTML5 application fixture' );
like( $source, qr{genapptest-directives[.]json},
    'container-specific fixture deployment paths are copied explicitly' );
like( $source, qr{genapptest-appconfig[.]json},
    'container-specific application runtime settings are copied explicitly' );
like( $source,
    qr{\$GENAPP/bin/genapp --language=html5 -kl},
    'complete image generates only the HTML5 fixture target' );
like( $source, qr{\$GENAPP/sbin/htmlsetuppaths[.]pl},
    'complete image installs the generated HTML5 links' );
like( $fixture_directives, qr/"zmqversion"\s*:\s*"4"/,
    'container fixture builds the shared ZeroMQ 4 TCP messaging server' );
like( $source, qr/for i in \$\(seq 1 60\).*mongosh.*adminCommand/s,
    'container startup waits for MongoDB before GenApp messaging' );
like( $source, qr{rm -f /run/apache2/apache2[.]pid},
    'container restart removes only the stale Apache PID file' );
like( $source,
    qr{FROM ubuntu:20[.]04\@sha256:[0-9a-f]{64} AS genapp-messaging-builder},
    'TCP messaging binary uses the digest-pinned runtime-compatible builder OS' );
like( $source, qr/ARG GO_VERSION=1[.]27[.]1/,
    'TCP messaging binary uses the current pinned Go release' );
like( $source, qr/GO_LINUX_AMD64_SHA256=.*sha256sum -c -/s,
    'downloaded Go toolchain is checksum verified' );
like( $source,
    qr{github[.]com/ehb54/go-ps=github[.]com/mitchellh/go-ps\@v1[.]0[.]0},
    'legacy Go process dependency is replaced by its canonical module' );
like( $source,
    qr{github[.]com/ehb54/lockfile\@cc765475c0b71203143551503b096080206f5d73},
    'TCP lockfile dependency is pinned to an exact commit' );
like( $source,
    qr{github[.]com/ehb54/zmq4=github[.]com/pebbe/zmq4\@v1[.]2[.]7},
    'legacy ZeroMQ fork is replaced by its matching canonical release' );
like( $source,
    qr{require=github[.]com/ehb54/zmq4\@v1[.]2[.]7},
    'TCP ZeroMQ dependency is pinned to the matching canonical release' );
like( $source,
    qr{COPY --from=genapp-messaging-builder --chown=root:genapp.*msg-tcpserver}s,
    'only the rebuilt TCP server is copied into the runtime image' );
unlike( $source, qr/getapp[.]pl[^\n]*\bsvn\b[^\n]*\bgenapptest\b/,
    'complete image does not depend on the obsolete SVN genapptest project' );
like( $source, qr/pro detach --assume-yes/,
    'Ubuntu Pro is detached before the package layer closes' );
like( $source, qr/apt-get purge --auto-remove -y ubuntu-pro-client/,
    'Ubuntu Pro client state is purged from the image' );
like( $source, qr{rm -f /etc/apt/auth[.]conf[.]d/90ubuntu-advantage},
    'Ubuntu Pro APT authentication is explicitly removed' );
like( $source,
    qr{rm -f /etc/ssh/ssh_host_\*_key /etc/ssh/ssh_host_\*_key[.]pub;.*pro detach}s,
    'build-time SSH host keys are removed before the package layer closes' );
like( $source, qr{CMD \[.*ssh-keygen -A},
    'each running container generates its own SSH host keys' );
unlike( $source, qr/\bapt-key\b/,
    'external APT repository does not use the obsolete global apt-key store' );
like( $source, qr/signed-by=\/etc\/apt\/keyrings\/mongodb-server-8[.]0[.]gpg/,
    'MongoDB repository key is scoped with signed-by' );
like( $source, qr{repo[.]mongodb[.]org/apt/ubuntu focal/mongodb-org/8[.]0},
    'MongoDB uses the supported Ubuntu 20.04 repository' );
like( $source, qr/ARG MONGODB_VERSION=8[.]0[.]32/,
    'MongoDB server packages are pinned to the reviewed 8.0 release' );
like( $source, qr/ARG MONGODB_MONGOSH_VERSION=2[.]12[.]0/,
    'MongoDB shell is pinned to the reviewed release' );
unlike( $source, qr/mongodb-database-tools|mongodb-org-tools/,
    'unused MongoDB database tools with an unmaintained crypto dependency are absent' );
unlike( $source, qr{mongodb-org/4[.]2|mongodb-server-4[.]2},
    'unsupported MongoDB 4.2 repository is absent' );
like( $source,
    qr{rm -f etc/closure_compiler[.]jar languages/java/add/lib/libthrift-0[.]9[.]1[.]jar},
    'vulnerable Java archives are removed in their creation layer' );
like( $source, qr/ARG THRIFT_JAVA_VERSION=0[.]24[.]0/,
    'Java target uses the reviewed Apache Thrift release' );
like( $source, qr/THRIFT_JAVA_SHA256=.*sha256sum -c -/s,
    'replacement Apache Thrift archive is checksum verified' );

my ($runtime_after_pro) = $source =~
    m{test ! -d /var/lib/ubuntu-advantage/private\n(.*?)^FROM .* AS genapp-messaging-builder}ms;
ok( defined $runtime_after_pro,
    'runtime layers after Ubuntu Pro cleanup are identifiable' );
unlike( $runtime_after_pro // q{}, qr/^\s*RUN\s+apt-get\b/m,
    'no later runtime layer installs Ubuntu packages without ESM access' );
like( $readme, qr/--platform linux\/amd64/,
    'documented build command selects the verified deployment platform' );
unlike( $readme, qr/token:\s+(?!YOUR_)[A-Za-z0-9]/,
    'documentation contains no real Ubuntu Pro token' );

done_testing();
