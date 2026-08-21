use strict;
use warnings;

use File::Spec;
use FindBin;
use Test::More;

use lib File::Spec->catdir( $FindBin::Bin, '..', 'lib' );
use GenAppTest qw(read_file repo_root run_command);

my $repo_root = repo_root( File::Spec->catdir( $FindBin::Bin, '..' ) );
my $script = File::Spec->catfile( $repo_root, qw(tools zazzie3_update_genapp_core.sh) );
my ( $status, $output ) = run_command(
    cwd => $repo_root,
    cmd => [ 'bash', '-n', $script ],
);
is( $status, 0, 'Zazzie3 core update helper has valid shell syntax' ) or diag($output);

my $source = read_file($script);
like( $source, qr/--allow-branch-switch/, 'core update helper requires an explicit branch-switch option' );
like( $source, qr/Refusing to switch GenApp core branch/, 'core update helper refuses implicit server branch changes' );
like( $source, qr/git fetch origin "\$branch".*?Switching GenApp core branch/s, 'core update helper fetches a requested branch before switching to it' );
like( $source, qr/--allow-nonstandard-target/, 'core update helper requires an explicit nonstandard-target option' );
like( $source, qr/Refusing a nonstandard Zazzie3 deployment target/, 'core update helper rejects implicit target changes' );
like( $source, qr/container_id_before=.*?docker inspect.*?container_id_after=.*?docker inspect/s, 'core update helper verifies container identity before and after deployment' );
like(
    $source,
    qr/flock -n -o -E "\$lock_conflict_status" "\$core_dir\/\.git\/zazzie3-update\.lock".*?bash -s/s,
    'core update helper holds one deployment lock without passing its descriptor to child services'
);
unlike( $source, qr/exec 9>.*?zazzie3-update\.lock/, 'core update helper does not expose the lock descriptor to generated services' );
like( $source, qr/remote_status=.*?Another Zazzie3 core update is already running/s, 'core update helper reports lock conflicts after the close-on-exec wrapper returns' );
like( $source, qr/GACPU stopped\. Do not repair, replace, or recreate the container/, 'core update helper makes failures terminal instead of authorizing repairs' );
unlike( $source, qr/\bdocker\s+(?:stop|rm|run|rename|commit|restart|kill|pause|unpause|system\s+prune|container\s+prune)\b/, 'core update helper contains no Docker lifecycle or prune command' );

done_testing();
