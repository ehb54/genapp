use strict;
use warnings;

use File::Spec;
use FindBin;
use Test::More;

use lib File::Spec->catdir( $FindBin::Bin, 'lib' );
use GenAppTest qw(read_file repo_root);

my $repo_root = repo_root($FindBin::Bin);
local $ENV{GENAPP} = $repo_root;

require File::Spec->catfile( $repo_root, 'etc', 'perl', 'genapp_util.pl' );

is( genapp_version(), '0.1.0-beta.1', 'VERSION owns the GenApp framework version' );
is( read_file( File::Spec->catfile( $repo_root, 'VERSION' ) ), "0.1.0-beta.1\n", 'VERSION contains one canonical value' );

my ( $display, $revision ) = gitinfo($repo_root);
like( $display, qr/^Git [0-9a-f]{12} on \d{4}-\d{2}-\d{2}T/, 'Git checkout metadata includes a short revision and commit date' );
like( $revision, qr/^[0-9a-f]{40}$/, 'Git checkout metadata includes the full revision' );

done_testing();
