use strict;
use warnings;

use File::Find;
use File::Spec;
use FindBin;
use Test::More;

use lib File::Spec->catdir( $FindBin::Bin, 'lib' );
use GenAppTest qw(generate_fixture_app php_executable repo_root run_command);

my $php = php_executable();
plan skip_all => 'php is not available on PATH; generated PHP compatibility checks are deferred'
    if !$php;

my $repo_root = repo_root($FindBin::Bin);
my ( $version_status, $version ) = run_command(
    cwd => $repo_root,
    cmd => [ $php, '-r', 'echo PHP_VERSION;' ],
);
is( $version_status, 0, 'selected PHP interpreter reports its version' ) or diag($version);
note("generated PHP compatibility interpreter: $version");

my $generated = generate_fixture_app(
    repo_root    => $repo_root,
    fixture_name => 'minimal_html5',
    test_dir     => $FindBin::Bin,
    genapp_args  => ['-kl'],
);
is( $generated->{status}, 0, 'minimal HTML5 fixture generates before compatibility linting' )
    or diag("command failed ($generated->{status}): $generated->{quoted}\n$generated->{output}");

my $html5 = File::Spec->catdir( $generated->{app_dir}, qw(output html5) );
my @php_files;
find(
    {
        no_chdir => 1,
        wanted   => sub {
            return if !-f $File::Find::name || $File::Find::name !~ /[.]php\z/;
            return if $File::Find::name =~ m{/vendor/};
            return if $File::Find::name =~ m{/airavata/};
            push @php_files, $File::Find::name;
        },
    },
    $html5,
);

ok( @php_files >= 50, 'generated fixture exposes a broad first-party PHP surface' )
    or diag('found only ' . scalar(@php_files) . ' generated first-party PHP files');

my @failures;
for my $path ( sort @php_files ) {
    my ( $status, $output ) = run_command(
        cwd => $generated->{app_dir},
        cmd => [
            $php,
            '-d', 'error_reporting=E_ALL',
            '-d', 'display_errors=stderr',
            '-l', $path,
        ],
    );
    push @failures, File::Spec->abs2rel( $path, $html5 ) . ":\n$output"
        if $status != 0 || $output =~ /(?:Deprecated|Warning|Fatal error|Parse error):/i;
}

is( scalar(@failures), 0,
    'all generated first-party PHP files pass strict syntax and diagnostic checks' )
    or diag(join "\n", @failures);

done_testing();
