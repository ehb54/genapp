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
like(
    $source,
    qr/find "\$module_handler_root" -mindepth 2 -maxdepth 2 -type f -name '\*\.php' -print0/,
    'core update helper limits PHP syntax checks to generated module-handler paths'
);
like( $source, qr/"\$php_bin" -l "\$module_handler"/, 'core update helper syntax-checks every generated module handler' );
like( $source, qr/Generated module handler has invalid PHP syntax:.*?exit 1/s, 'invalid generated PHP is a terminal deployment failure' );
like( $source, qr/module_handler_count == 0.*?exit 1/s, 'deployment fails when no generated module handlers are available to check' );
like(
    $source,
    qr/find "\$module_info_root" -mindepth 1 -maxdepth 1 -type f -name 'module_\*\.php' -print0/,
    'core update helper limits runtime JSON checks to generated module metadata files'
);
like( $source, qr/!is_object\(\$module_json\).*?json_last_error_msg/s, 'core update helper rejects module metadata that PHP cannot decode as an object' );
like( $source, qr/Generated module metadata does not decode at runtime:.*?exit 1/s, 'invalid runtime module JSON is a terminal deployment failure' );
like( $source, qr/module_info_count == 0.*?exit 1/s, 'deployment fails when no generated module metadata files are available to check' );
unlike( $source, qr/find\s+output(?:\/|"\s).*?-name '\*\.php'/, 'core update helper does not lint unrelated generated PHP trees' );
unlike( $source, qr/\bdocker\s+(?:stop|rm|run|rename|commit|restart|kill|pause|unpause|system\s+prune|container\s+prune)\b/, 'core update helper contains no Docker lifecycle or prune command' );

done_testing();
