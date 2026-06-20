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
    fixture_name => 'minimal_html5',
    test_dir     => $FindBin::Bin,
    genapp_args  => ['-kl'],
);

is( $generated->{status}, 0, 'minimal_html5 fixture generates before JS syntax checks' )
    or diag("command failed ($generated->{status}): $generated->{quoted}\n$generated->{output}");

my $ga_js = File::Spec->catfile( $generated->{app_dir}, qw(output html5 js ga.js) );
my ( $status, $output, $quoted ) = run_command(
    cwd => $generated->{app_dir},
    env => {},
    cmd => [ $node, '--check', $ga_js ],
);

ok( $status == 0, 'generated ga.js passes node --check' )
    or diag("command failed ($status): $quoted\n$output");

done_testing();

sub find_executable {
    my ($name) = @_;
    for my $dir ( split /:/, $ENV{PATH} || q{} ) {
        my $path = File::Spec->catfile( $dir, $name );
        return $path if -x $path;
    }
    return;
}
