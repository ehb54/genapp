use strict;
use warnings;

use File::Spec;
use FindBin;
use Test::More;

use lib File::Spec->catdir( $FindBin::Bin, 'lib' );
use GenAppTest qw(generate_fixture_app read_file repo_root);

my $repo_root = repo_root($FindBin::Bin);
my $generated = generate_fixture_app(
    repo_root    => $repo_root,
    fixture_name => 'minimal_html5',
    test_dir     => $FindBin::Bin,
    genapp_args  => ['-kl'],
);

is( $generated->{status}, 0, 'minimal_html5 fixture generates before PHP template checks' )
    or diag("command failed ($generated->{status}): $generated->{quoted}\n$generated->{output}");

my $app_dir    = $generated->{app_dir};
my $module_php = read_file( File::Spec->catfile( $app_dir, qw(output html5 ajax demo echo.php) ) );
my $results_php = read_file( File::Spec->catfile( $app_dir, qw(output html5 ajax get_results.php) ) );
my $jobrun_php  = read_file( File::Spec->catfile( $app_dir, qw(output html5 util jobrun.php) ) );

like( $module_php, qr/require_once ".*ajax\/ga_filter\.php"/, 'module php includes request filter support' );
like( $module_php, qr/\$GLOBALS\[ 'module'\s+\]\s+=\s+"echo"/, 'module php sets module global' );
like( $module_php, qr/\$_REQUEST\[ '_uuid' \]/, 'module php expects a request uuid' );
like( $module_php, qr/file_put_contents\( "\$logdir\/_input_"/, 'module php writes input replay data' );
like( $module_php, qr/\$_REQUEST\[ '_module' \]\s+=\s+"echo"/, 'module php annotates request with module id' );
like( $module_php, qr/\$cmd \.= \$cmdprefix == "oscluster" \? " echo" : " echo"/, 'module php command path includes executable/module id' );
unlike( $module_php, qr/__modulejson__|__resource__|__executable__|__menu:id__/, 'module php has important template tokens replaced' );

like( $results_php, qr/ga_sanitize_validate/, 'get_results php validates request input' );
like( $results_php, qr/_getinput/, 'get_results php can return replayed input' );
like( $results_php, qr/_stdout_/, 'get_results php reads job stdout payload' );
like( $results_php, qr/json_decode/, 'get_results php decodes JSON output' );
unlike( $results_php, qr/__application__/, 'get_results php has application substitution applied' );
like( $results_php, qr/__docroot:html5__\/minimal_html5\/ajax\/ga_filter\.php/, 'get_results php retains docroot deployment placeholder with app path' );

like( $jobrun_php, qr/file_get_contents\( "\$\{logdir\}_cmds_\$id"/, 'jobrun reads generated command file' );
like( $jobrun_php, qr/exec\( \$cmd \)/, 'jobrun executes recorded command' );
like( $jobrun_php, qr/file_put_contents\( "\$\{logdir\}_stdout_"/, 'jobrun writes stdout payload' );
like( $jobrun_php, qr/logjobupdate\( "finished"/, 'jobrun marks job finished' );

done_testing();
