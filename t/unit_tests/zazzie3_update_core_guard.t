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

done_testing();
