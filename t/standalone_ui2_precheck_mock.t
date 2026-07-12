use strict;
use warnings;

use File::Spec;
use FindBin;
use lib File::Spec->catdir( $FindBin::Bin, 'lib' );
use GenAppTest qw(read_file repo_root run_command);
use Test::More;

my $repo_root = repo_root($FindBin::Bin);
my $demo_dir  = File::Spec->catdir( $repo_root, qw(standalone ui2-react-precheck) );

ok( -f File::Spec->catfile( $demo_dir, 'index.html' ), 'standalone precheck mock has an index page' );
ok( -f File::Spec->catfile( $demo_dir, 'app.js' ), 'standalone precheck mock has JavaScript behavior' );
ok( -f File::Spec->catfile( $demo_dir, 'styles.css' ), 'standalone precheck mock has UI2 styling' );

my $html = read_file( File::Spec->catfile( $demo_dir, 'index.html' ) );
like( $html, qr/Standalone UI2 React mock/, 'mock identifies itself as a standalone UI2 React-style test' );
like( $html, qr/id="precheck-button"/, 'mock exposes a manual precheck button' );
like( $html, qr/id="show_precheck"[^>]+type="checkbox"/, 'mock exposes conditional precheck display control' );
like( $html, qr/id="run-button"[^>]+disabled/, 'mock keeps run separate from precheck' );

my $js = read_file( File::Spec->catfile( $demo_dir, 'app.js' ) );
like( $js, qr/function mockActionEndpoint/, 'mock uses a local action endpoint simulator' );
like( $js, qr/action:\s*"set_fields"/, 'mock response supports set_fields' );
like( $js, qr/action:\s*statusValue === "pass" \? "message" : "dialog"/, 'mock response supports message and dialog' );
like( $js, qr/received:\s*values/, 'mock shows the values sent to precheck' );

my ( $status, $output, $quoted ) = run_command(
    cwd => $repo_root,
    cmd => [ 'node', '--check', File::Spec->catfile( $demo_dir, 'app.js' ) ],
);
is( $status, 0, 'standalone precheck mock JavaScript passes node --check' )
    or diag("command failed ($status): $quoted\n$output");

done_testing();
