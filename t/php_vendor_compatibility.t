use strict;
use warnings;

use File::Find;
use File::Spec;
use FindBin;
use Test::More;

use lib File::Spec->catdir( $FindBin::Bin, 'lib' );
use GenAppTest qw(php_executable repo_root run_command);

my $php = php_executable();
plan skip_all => 'php is not available on PATH; bundled PHP dependency checks are deferred'
    if !$php;

my $repo_root = repo_root($FindBin::Bin);
my $composer_autoload = File::Spec->catfile(
    $repo_root, qw(languages html5 add vendor autoload.php) );
my $thrift_autoload = File::Spec->catfile(
    $repo_root, qw(languages html5 add airavata lib Thrift autoload.php) );
my $airavata_register = File::Spec->catfile(
    $repo_root, qw(languages html5 add airavata registerUtils.php) );

my ( $composer_status, $composer_output ) = run_command(
    cwd => $repo_root,
    cmd => [
        $php,
        '-d', 'error_reporting=E_ALL',
        '-d', 'display_errors=stderr',
        '-r', 'require $argv[1]; echo "autoload-ok\\n";',
        $composer_autoload,
    ],
);
is( $composer_status, 0, 'Composer dependency bundle loads' ) or diag($composer_output);
unlike(
    $composer_output,
    qr/(?:Deprecated|Warning|Fatal error|Parse error):/i,
    'Composer dependency bundle loads without PHP compatibility diagnostics',
) or diag($composer_output);

TODO: {
    local $TODO = 'legacy optional Airavata integration requires replacement or retirement';
    my ( $thrift_status, $thrift_output ) = run_command(
        cwd => $repo_root,
        cmd => [
            $php,
            '-d', 'error_reporting=E_ALL',
            '-d', 'display_errors=stderr',
            '-r', 'require $argv[1]; echo "autoload-ok\\n";',
            $thrift_autoload,
        ],
    );
    is( $thrift_status, 0, 'Airavata Thrift dependency bundle loads' )
        or diag($thrift_output);
    unlike(
        $thrift_output,
        qr/(?:Deprecated|Warning|Fatal error|Parse error):/i,
        'Airavata Thrift dependency bundle loads without PHP compatibility diagnostics',
    ) or diag($thrift_output);

    my ( $register_status, $register_output ) = run_command(
        cwd => $repo_root,
        cmd => [ $php, '-l', $airavata_register ],
    );
    is( $register_status, 0, 'Airavata registration helper passes syntax validation' )
        or diag($register_output);
}

SKIP: {
    skip 'set GENAPP_PHP_VENDOR_FULL=1 for the extended bundled-dependency syntax pass', 1
        if !$ENV{GENAPP_PHP_VENDOR_FULL};

    my @roots = (
        File::Spec->catdir( $repo_root, qw(languages html5 add vendor) ),
        File::Spec->catdir( $repo_root, qw(languages html5 add airavata lib) ),
    );
    my @files;
    find(
        {
            no_chdir => 1,
            wanted   => sub {
                push @files, $File::Find::name
                    if -f $File::Find::name && $File::Find::name =~ /[.]php\z/;
            },
        },
        @roots,
    );

    my @failures;
    for my $path ( sort @files ) {
        my ( $status, $output ) = run_command(
            cwd => $repo_root,
            cmd => [ $php, '-d', 'error_reporting=E_ALL', '-l', $path ],
        );
        push @failures, File::Spec->abs2rel( $path, $repo_root ) . ":\n$output"
            if $status != 0;
    }
    is( scalar(@failures), 0, 'all bundled PHP dependency files pass syntax validation' )
        or diag(join "\n", @failures);
}

done_testing();
