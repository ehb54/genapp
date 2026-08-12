use strict;
use warnings;

use File::Spec;
use FindBin;
use Test::More;

use lib File::Spec->catdir( $FindBin::Bin, 'lib' );
use GenAppTest qw(generate_fixture_app repo_root run_command);

my $repo_root = repo_root($FindBin::Bin);
my $node      = find_executable('node');

plan skip_all => 'node is not available on PATH' if !$node;

my $generated = generate_fixture_app(
    repo_root    => $repo_root,
    fixture_name => 'html5_layout_repeaters',
    test_dir     => $FindBin::Bin,
    genapp_args  => ['-kl'],
);

is( $generated->{status}, 0, 'html5_layout_repeaters fixture generates before repeater replay checks' )
    or diag("command failed ($generated->{status}): $generated->{quoted}\n$generated->{output}");

my $harness     = File::Spec->catfile( $repo_root, 't', 'js', 'genapp_js_harness.js' );
my $ga_js       = File::Spec->catfile( $generated->{app_dir}, qw(output html5 js ga.js) );
my $module_html = File::Spec->catfile( $generated->{app_dir}, qw(output html5 ajax demo repeat_demo.html) );

my ( $status, $output, $quoted ) = run_command(
    cwd => $repo_root,
    env => {},
    cmd => [ $node, $harness, 'repeater-replay', $ga_js, $module_html ],
);

ok( $status == 0, 'saved input replay restores integer repeater rows in DOM harness' )
    or diag("command failed ($status): $quoted\n$output");
like( $output, qr/ok - repeater-replay/, 'DOM harness reports repeater replay scenario success' );

my ( $switch_status, $switch_output, $switch_quoted ) = run_command(
    cwd => $repo_root,
    env => {},
    cmd => [ $node, $harness, 'module-switch-replay', $ga_js, $module_html ],
);

ok( $switch_status == 0, 'module switch restore keeps repeater controller and rows in sync' )
    or diag("command failed ($switch_status): $switch_quoted\n$switch_output");
like( $switch_output, qr/ok - module-switch-replay/, 'DOM harness reports module switch replay scenario success' );

done_testing();

sub find_executable {
    my ($name) = @_;
    for my $dir ( split /:/, $ENV{PATH} || q{} ) {
        my $path = File::Spec->catfile( $dir, $name );
        return $path if -x $path;
    }
    return;
}
