use strict;
use warnings;

use File::Spec;
use File::Temp qw(tempdir);
use File::Path qw(make_path);
use JSON;
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


my $copied = tempdir( CLEANUP => 1 );
my $unknown = installed_build_stamp( $copied, 'neutral_library', '1.2', 'package' );
ok( !defined $unknown->{revision}, 'copied tree without a receipt remains unrecorded' );
make_path( "$copied/.local" );
open my $receipt, '>', "$copied/.local/build-info.json" or die $!;
print $receipt encode_json({schema_version=>1,components=>[{
    schema_version=>1,component_id=>'neutral_library',version=>'1.2',revision=>('b'x40),modified=>JSON::false
}]});
close $receipt;
is( installed_build_stamp( $copied, 'neutral_library', '1.2', 'package' )->{revision}, 'b'x40,
    'portable copied-source evidence supplies revision without a checkout' );
eval { installed_build_stamp( $copied, 'neutral_library', '2.0', 'package' ) };
like( $@, qr/does not identify/, 'mismatched copied-source version fails closed' );
my $built = installed_build_stamp( $repo_root, 'neutral_generator', genapp_version(), 'generator' );
is( $built->{revision}, $revision, 'build stamp identifies generator actually used' );
ok( JSON::is_bool( $built->{modified} ), 'development source flag is explicit' );

done_testing();
