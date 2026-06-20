use strict;
use warnings;

use Cwd qw(abs_path);
use File::Spec;
use File::Temp qw(tempdir);
use FindBin;
use Test::More;

use lib File::Spec->catdir( $FindBin::Bin, 'lib' );
use GenAppTest qw(copy_tree read_file run_command);

my $repo_root = abs_path( File::Spec->catdir( $FindBin::Bin, '..' ) );
my $fixture_root = File::Spec->catdir( $repo_root, 't', 'fixtures', 'apps', 'minimal_html5' );

ok( -d $fixture_root, 'fixture app directory exists' );

my $temp_root = tempdir( CLEANUP => 1 );
my $app_dir   = File::Spec->catdir( $temp_root, 'minimal_html5' );

copy_tree( $fixture_root, $app_dir );

ok( -f File::Spec->catfile( $app_dir, 'directives.json' ), 'copied directives.json' );
ok( -f File::Spec->catfile( $app_dir, 'menu.json' ), 'copied menu.json' );
ok( -f File::Spec->catfile( $app_dir, 'modules', 'echo.json' ), 'copied module json' );

my %env = ( GENAPP => $repo_root );

assert_ok(
    'check_json parses the fixture files',
    cwd => $app_dir,
    env => \%env,
    cmd => [
        File::Spec->catfile( $repo_root, 'bin', 'check_json.pl' ),
        'directives.json',
        'menu.json',
        'modules/echo.json',
    ],
);

assert_ok(
    'genapp_check validates the fixture app',
    cwd => $app_dir,
    env => \%env,
    cmd => [ File::Spec->catfile( $repo_root, 'bin', 'genapp_check.pl' ) ],
);

assert_ok(
    'genapp generates html5 output and saved layouts',
    cwd => $app_dir,
    env => \%env,
    cmd => [ File::Spec->catfile( $repo_root, 'bin', 'genapp' ), '-kl' ],
);

my @expected_files = (
    [ 'generated index',      File::Spec->catfile( $app_dir, 'output', 'html5', 'index.html' ) ],
    [ 'generated menu html',  File::Spec->catfile( $app_dir, 'output', 'html5', 'ajax', 'demo.html' ) ],
    [ 'generated module html', File::Spec->catfile( $app_dir, 'output', 'html5', 'ajax', 'demo', 'echo.html' ) ],
    [ 'generated module php', File::Spec->catfile( $app_dir, 'output', 'html5', 'ajax', 'demo', 'echo.php' ) ],
);

for my $check (@expected_files) {
    ok( -f $check->[1], $check->[0] );
}

my $layout_dir = File::Spec->catdir( $app_dir, 'output', 'html5', 'layout' );
ok( -d $layout_dir, 'saved layout directory exists' );

opendir my $dh, $layout_dir or die "opendir '$layout_dir' failed: $!";
my @layout_files = grep { /\.json$/ } readdir $dh;
closedir $dh;
ok( scalar @layout_files > 0, 'saved layout json was produced' );

my $index_html = read_file( File::Spec->catfile( $app_dir, 'output', 'html5', 'index.html' ) );
like( $index_html, qr/Minimal HTML5 Fixture/, 'index includes the fixture title' );

my $module_php = read_file( File::Spec->catfile( $app_dir, 'output', 'html5', 'ajax', 'demo', 'echo.php' ) );
like( $module_php, qr/echo/, 'generated module php includes the executable name' );

done_testing();

sub assert_ok {
    my ( $name, %args ) = @_;
    my ( $status, $output, $quoted ) = run_command(%args);

    ok( $status == 0, $name ) or diag("command failed ($status): $quoted\n$output");
}
