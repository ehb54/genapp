use strict;
use warnings;

use File::Spec;
use FindBin;
use Test::More;

use lib File::Spec->catdir( $FindBin::Bin, 'lib' );
use GenAppTest qw(generate_fixture_app read_file repo_root run_command);

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
my $module_info_php = File::Spec->catfile( $app_dir, qw(output html5 etc module_echo.php) );
my $results_php = read_file( File::Spec->catfile( $app_dir, qw(output html5 ajax get_results.php) ) );
my $jobrun_php  = read_file( File::Spec->catfile( $app_dir, qw(output html5 util jobrun.php) ) );
my $sys_user_config_php = read_file( File::Spec->catfile( $repo_root, qw(languages html5 sys sys_user_config.php) ) );
my $sys_login_php = read_file( File::Spec->catfile( $repo_root, qw(languages html5 sys sys_login.php) ) );
my $sys_project_php = read_file( File::Spec->catfile( $repo_root, qw(languages html5 sys sys_project.php) ) );
my $sys_files_php = read_file( File::Spec->catfile( $repo_root, qw(languages html5 sys sys_files.php) ) );
my $joblog_php = read_file( File::Spec->catfile( $repo_root, qw(languages html5 sys joblog.php) ) );
my $file_manager_js = read_file( File::Spec->catfile( $repo_root, qw(languages html5 js fc.js) ) );
my $project_name_message = 'Project names may contain only letters, numbers, and underscores. Dashes are not allowed; use an underscore instead.';

like( $module_php, qr/require_once ".*ajax\/ga_filter\.php"/, 'module php includes request filter support' );
like( $module_php, qr/\$GLOBALS\[ 'module'\s+\]\s+=\s+"echo"/, 'module php sets module global' );
like( $module_php, qr/\$_REQUEST\[ '_uuid' \]/, 'module php expects a request uuid' );
like( $module_php, qr/file_put_contents\( "\$logdir\/_input_"/, 'module php writes input replay data' );
like( $module_php, qr/\$_REQUEST\[ '_module' \]\s+=\s+"echo"/, 'module php annotates request with module id' );
like( $module_php, qr/\$cmd \.= \$cmdprefix == "oscluster" \? " echo" : " echo"/, 'module php command path includes executable/module id' );
unlike( $module_php, qr/__modulejson__|__resource__|__executable__|__menu:id__/, 'module php has important template tokens replaced' );
like( $module_php, qr/\Q(hello|sample)\\\\.world\E/, 'module php preserves regex alternation and host-escaped backslash from module JSON' );
like( $module_php, qr/\Qroute:left || route:right\E/, 'module php preserves logical OR from module JSON' );

my $php = qx{command -v php 2>/dev/null};
chomp $php;
SKIP: {
    skip 'php is not available on PATH; generated module runtime checks are deferred', 2 if !$php;
    my ( $lint_status, $lint_output ) = run_command(
        cwd => $app_dir,
        cmd => [ $php, '-l', File::Spec->catfile( $app_dir, qw(output html5 ajax demo echo.php) ) ],
    );
    is( $lint_status, 0, 'pipe- and backslash-bearing ordinary module handler passes PHP syntax validation' )
        or diag($lint_output);

    my ( $decode_status, $decode_output ) = run_command(
        cwd => $app_dir,
        cmd => [
            $php,
            '-r',
            q~require $argv[1]; $module = $GLOBALS["modulejson"]["echo"] ?? null; if (!is_object($module) || ($module->fields[0]->pattern ?? "") !== '^(hello|sample)\.world$' || ($module->fields[0]->help ?? "") !== "Author's message") { fwrite(STDERR, json_last_error_msg()); exit(1); }~,
            $module_info_php,
        ],
    );
    is( $decode_status, 0, 'PHP evaluates embedded module JSON without losing regex backslashes or apostrophes' )
        or diag($decode_output);
}

like( $results_php, qr/ga_sanitize_validate/, 'get_results php validates request input' );
like( $results_php, qr/_getinput/, 'get_results php can return replayed input' );
like( $results_php, qr/_stdout_/, 'get_results php reads job stdout payload' );
like( $results_php, qr/json_decode/, 'get_results php decodes JSON output' );
like( $results_php, qr/function ga_terminal_error_payload/, 'get_results defines a generic terminal-error payload check' );
like( $results_php, qr/\$missing_detaildir.*?ga_terminal_error_payload.*?\$terminal_error_without_detail/s, 'get_results preserves a terminal error when no run detail directory was created' );
like( $results_php, qr/This run's saved files have been removed/, 'get_results reports a friendly deleted-run message without its filesystem path' );
like( $results_php, qr/_getinputerror/, 'get_results carries deleted-run restoration failures to the UI2 input replay path' );
unlike( $results_php, qr/__application__/, 'get_results php has application substitution applied' );
like( $results_php, qr/__docroot:html5__\/minimal_html5\/ajax\/ga_filter\.php/, 'get_results php retains docroot deployment placeholder with app path' );

like( $jobrun_php, qr/file_get_contents\( "\$\{logdir\}_cmds_\$id"/, 'jobrun reads generated command file' );
like( $jobrun_php, qr/exec\( \$cmd \)/, 'jobrun executes recorded command' );
like( $jobrun_php, qr/file_put_contents\( "\$\{logdir\}_stdout_"/, 'jobrun writes stdout payload' );
like( $jobrun_php, qr/logjobupdate\( "finished"/, 'jobrun marks job finished' );

like(
    $sys_user_config_php,
    qr/\Q$project_name_message\E/,
    'sys_user_config server-side project-name validation uses explicit guidance'
);
like( $sys_login_php, qr/password_reset_hash/, 'sys_login keeps reset credentials separate from the permanent password until authentication' );

like( $joblog_php, qr/function active_project_names\( \$user/, 'joblog exposes the active project registry helper' );
like( $joblog_php, qr/function remove_active_projects\( \$user, \$projects/, 'joblog can retire active project identities without changing job records' );
like( $joblog_php, qr/function job_detail_directory\( \$directory, \$details \).*?preg_match.*?getmenumoduledetaildir/s, 'joblog derives a run directory only from a validated relative details path' );
like( $joblog_php, qr/function job_saved_path_is_removed.*?saved_files_removed.*?function restore_job_saved_paths/s, 'joblog records removable saved-job artifacts with rollback support' );
like( $results_php, qr/\$detaildir = \$GLOBALS\[ 'getmenumoduledetaildir' \].*?!is_dir\( \$detaildir \)/s, 'get_results refuses stale replay when a recorded run directory has been removed' );
like( $results_php, qr/getmenumodulesavedfilesremoved.*?saved files have been removed/s, 'get_results rejects an invalidated job before cached output can be replayed' );
like( $sys_project_php, qr/active_project_names\( \$_SESSION\[ \$window \]\[ 'logon' \]/, 'project selection validates non-default projects against the active registry' );
like( $sys_project_php, qr/project_available.*false/s, 'project selection reports a deleted project without restoring it into the session' );
like( $sys_files_php, qr/\$deleted_project_roots.*in_array\( \$file, \$active_project_names, true \)/s, 'file removal classifies exact registered roots as project lifecycle removals server-side' );
like( $sys_files_php, qr/remove_active_projects\( \$GLOBALS\[ 'logon' \], \$deleted_project_roots/, 'file removal retires selected registered project roots from Settings' );
like( $sys_files_php, qr/\$_SESSION as \$session_window => &\$session_state/, 'project deletion resets matching project selections in every session window' );
like( $sys_files_php, qr/function ga_file_manager_relative_path.*?base64_decode\( \$encoded, true \).*?\.\{1,2\}/s, 'File Manager strictly decodes and rejects traversal-shaped browser paths' );
like( $sys_files_php, qr/function ga_file_manager_resolve_path.*?realpath.*?ga_file_manager_path_is_within.*?is_link/s, 'File Manager resolves paths under the authenticated user root and rejects links' );
like( $sys_files_php, qr/function ga_file_manager_move.*?ga_file_manager_copy_tree/s, 'File Manager has a command-free cross-device move fallback' );
unlike( $sys_files_php, qr/rsync\s+-a|rm\s+-fr|`\$spec_cmd`/, 'File Manager does not interpolate selected paths into a shell command' );
like( $sys_files_php, qr/job_saved_path_is_removed.*?restore_job_saved_paths/s, 'File Manager invalidates affected saved jobs and rolls them back with its deletion token' );
like( $file_manager_js, qr/top-level directories that are active projects will also be removed from Settings/, 'legacy File Manager explains the project-root deletion consequence' );

done_testing();
