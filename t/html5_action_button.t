use strict;
use warnings;

use File::Path qw(make_path);
use File::Spec;
use FindBin;
use lib File::Spec->catdir( $FindBin::Bin, 'lib' );
use GenAppTest qw(generate_fixture_app read_file repo_root);
use JSON::PP qw(decode_json encode_json);
use MIME::Base64 qw(encode_base64);
use Test::More;

my $repo_root = repo_root($FindBin::Bin);

my $generated = generate_fixture_app(
    repo_root    => $repo_root,
    fixture_name => 'action_button',
);

is( $generated->{status}, 0, 'action button fixture generates for html5' )
    or diag $generated->{output};

my $html = read_file( File::Spec->catfile( $generated->{app_dir}, qw(output html5 ajax demo action_demo.html) ) );
like( $html, qr/ga\.action\.click\("action_demo","precheck","_allformdata"\)/, 'html5 action input renders explicit action button call' );
like( $html, qr/ga\.repeat\.repeatOn\("action_demo",\s*"conditional_precheck",\s*"show_conditional"\s*\)/, 'action input can use existing repeat conditions' );
unlike( $html, qr/ga\.button\.click\("action_demo","precheck"/, 'action input does not reuse hook button path' );

my $endpoint = read_file( File::Spec->catfile( $generated->{app_dir}, qw(output html5 ajax action action_demo.php) ) );
like( $endpoint, qr/type' \] == 'action'/, 'action endpoint recognizes action fields from module JSON' );
like( $endpoint, qr/action_execution_command/, 'action endpoint can use a declared application resource' );
like( $endpoint, qr/proc_open\( \$action_command/, 'action endpoint runs the resolved action command' );
like( $endpoint, qr/action_stage_declared_files/, 'action endpoint stages declared local or server file inputs for actions' );
like( $endpoint, qr/function action_file_scope.*?actionfiledata.*?unknown file field/s, 'action endpoint validates an optional action-specific file scope' );
like( $endpoint, qr/is_array\( \$scope \).*?!isset\( \$scope\[ \$id \] \).*?continue/s, 'scoped actions skip unrelated declared file fields' );
like( $endpoint, qr/function action_scoped_file_is_active.*?\$controller.*?\$expected.*?\$_REQUEST/s, 'scoped actions evaluate simple file-field visibility conditions from submitted controls' );
like( $endpoint, qr/is_array\( \$scope \).*?!action_scoped_file_is_active\( \$field \).*?continue/s, 'scoped actions skip required files from inactive conditional branches' );
like( $endpoint, qr/action_stage_declared_files\( \$modjson, \$action, \$action_dir, \$dir \)/, 'action metadata controls server-side file staging' );
like( $endpoint, qr/function action_file_requests.*?"\$controller-\$id-\$index"/s, 'action endpoint resolves row-specific repeated file submit ids' );
like( $endpoint, qr/function action_stage_file_request.*?\$_FILES\[ \$submit_id \].*?_selaltval_\$submit_id/s, 'action endpoint stages repeated local and server file selections through the same row id' );
like( $endpoint, qr/\$repeated.*?\$_REQUEST\[ \$id \] = \$staged/s, 'action endpoint replaces repeated display values with ordered resolved paths' );
like( $endpoint, qr/No file selected for.*?action_file_label/s, 'action endpoint reports the missing repeated row in plain language' );
like( $endpoint, qr/\$action_dir = "\$rdir\/_actions\/action_demo\/\$action_id"/, 'action endpoint uses per-user project action directory' );
like( $endpoint, qr/function action_project_directory_group_writable.*?chmod\( \$dir, 0775 \).*?fileperms/s, 'action endpoint repairs and verifies project group-write permission' );
like( $endpoint, qr/action_project_directory_group_writable\( \$rdir \)/, 'action endpoint checks project permissions before creating action data' );
unlike( $endpoint, qr/jobrun\.php|sys_joblocked|joblog/, 'action endpoint stays outside job manager submit path' );

my $submit_endpoint = read_file( File::Spec->catfile( $generated->{app_dir}, qw(output html5 ajax demo action_demo.php) ) );
like( $submit_endpoint, qr/function ga_submission_project_directory_group_writable.*?chmod\( \$dir, 0775 \).*?fileperms/s, 'submission endpoint repairs and verifies project group-write permission' );
like( $submit_endpoint, qr/ga_submission_project_directory_group_writable\( \$dir \).*?ga_db_remove.*?Could not make project directory group-writable/s, 'submission permission failure clears the project lock and stops dispatch' );

my $ga_js = read_file( File::Spec->catfile( $generated->{app_dir}, qw(output html5 js ga.js) ) );
like( $ga_js, qr/ga\.action\.process = function/, 'shared html5 JavaScript includes action processor' );
like( $ga_js, qr/new FormData\(\)/, 'action requests preserve declared file inputs in FormData' );
like( $ga_js, qr/case "set_fields":/, 'action processor supports declarative field updates' );
like( $ga_js, qr/case "dialog":/, 'action processor supports message and dialog actions' );

my $ui2_module = decode_json( read_file( File::Spec->catfile( $generated->{app_dir}, qw(output ui2 modules action_demo.json) ) ) );
my ($ui2_action) = grep { $_->{id} eq 'precheck' } @{ $ui2_module->{modulejson}{fields} };
my ($ui2_scoped_action) = grep { $_->{id} eq 'conditional_precheck' } @{ $ui2_module->{modulejson}{fields} };
is( $ui2_action->{type}, 'action', 'ui2 module summary carries action field type' );
is( $ui2_action->{executable}, 'precheck_action', 'ui2 module summary carries action executable metadata' );
is( $ui2_action->{resource}, 'host', 'ui2 module summary carries action resource metadata' );
is( $ui2_action->{actiondata}, '_allformdata', 'ui2 module summary carries action data selection' );
is( $ui2_action->{label}, "Input check (\x{00c5})", 'ui2 module summary preserves a standalone Unicode label' );
is( $ui2_action->{buttontext}, "Precheck \x{00c5}\x{00b2}", 'ui2 module summary preserves adjacent Unicode code points' );
is( $ui2_scoped_action->{actionfiledata}, 'primary_file', 'ui2 module summary carries the optional action file scope' );

my $ui2_js = read_file( File::Spec->catfile( $generated->{app_dir}, qw(output ui2 js ui2.js) ) );
my $ui2_source = read_file( File::Spec->catfile( $repo_root, qw(languages ui2 add js ui2.js) ) );
like( $ui2_js, qr/type === "action"[\s\S]+renderActionControl\(field\)/, 'ui2 core renderer owns action controls' );
like( $ui2_js, qr/function runModuleAction\(field, button, statusNode\)/, 'ui2 runtime declares action execution helper' );
like( $ui2_js, qr/function moduleActionEndpointFor\(moduleId\)[\s\S]+ajax\/action/, 'ui2 action endpoint resolves through legacy ajax action root' );
like( $ui2_js, qr/function applyActionPayload\(payload\)/, 'ui2 runtime declares action response handler' );
like( $ui2_source, qr/createFieldGroup: \(groupFields, role, presentation\) => renderReactWorkbenchFieldGroup\(groupFields, role, presentation\)/, 'React bridge receives action support through canonical UI2 field groups' );
like( $ui2_js, qr/function renderActionControl\(field\).*?ui2-button ui2-button-action/s, 'declared actions receive the distinct secondary-action class' );
like( $ui2_js, qr/status\.setAttribute\("aria-live", "polite"\).*?status\.setAttribute\("role", "status"\)/s, 'action status announces progress and completion accessibly' );
like( $ui2_js, qr/return normalized === "warning" \? "warning" : "ok";/, 'action status preserves warning semantics' );

my $ui2_css = read_file( File::Spec->catfile( $generated->{app_dir}, qw(output ui2 css ui2.css) ) );
like( $ui2_css, qr/\.ui2-button-action\s*\{[^}]*background:\s*var\(--ui2-accent-soft\);/s, 'action buttons use the secondary accent treatment' );
like( $ui2_css, qr/\.ui2-button-action:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--ui2-focus-ring\);/s, 'action buttons retain a visible keyboard focus indicator' );
like( $ui2_css, qr/\.ui2-action-status\[data-status="ok"\]\s*\{[^}]*color:\s*var\(--ui2-success\);/s, 'successful action status uses the semantic success color' );
like( $ui2_css, qr/\.ui2-action-status\[data-status="warning"\]\s*\{[^}]*color:\s*var\(--ui2-warn\);/s, 'warning action status uses the semantic warning color' );

ok( -f File::Spec->catfile( $repo_root, qw(languages qt5 types action.input) ), 'qt5 has additive action input template stub' );
ok( -f File::Spec->catfile( $repo_root, qw(languages qt5 types action.output) ), 'qt5 has additive action output template stub' );

my $action_endpoint_path = File::Spec->catfile( $generated->{app_dir}, qw(output html5 ajax action action_demo.php) );
my $submit_endpoint_path = File::Spec->catfile( $generated->{app_dir}, qw(output html5 ajax demo action_demo.php) );
my $runtime_appconfig_path = File::Spec->catfile( $generated->{temp_root}, 'appconfig.json' );
open my $appconfig_fh, '>', $runtime_appconfig_path
    or die "write '$runtime_appconfig_path' failed: $!";
print {$appconfig_fh} encode_json({ resources => { host => { run => '' } } });
close $appconfig_fh;

my $runtime_endpoint = $endpoint;
my %runtime_replacements = (
    '__docroot:html5__/action_button' => File::Spec->catdir(
        $generated->{app_dir}, qw(output html5) ),
    '__appconfig__'           => $runtime_appconfig_path,
    '__executable_path:html5__' => File::Spec->catdir( $generated->{app_dir}, 'bin' ),
);
for my $placeholder ( keys %runtime_replacements ) {
    my $replacement = $runtime_replacements{$placeholder};
    $runtime_endpoint =~ s/\Q$placeholder\E/$replacement/g;
}
my $runtime_endpoint_path = File::Spec->catfile(
    $generated->{temp_root}, 'action_demo_runtime.php' );
open my $runtime_endpoint_fh, '>', $runtime_endpoint_path
    or die "write '$runtime_endpoint_path' failed: $!";
print {$runtime_endpoint_fh} $runtime_endpoint;
close $runtime_endpoint_fh;

my $php = qx{command -v php 2>/dev/null};
chomp $php;
SKIP: {
    skip 'php is not available on PATH; PHP endpoint checks are deferred', 11 if !$php;
    for my $check (
        [ action     => $runtime_endpoint_path ],
        [ submission => $submit_endpoint_path ],
    ) {
        my ( $label, $path ) = @{$check};
        my $lint = qx{'$php' -l '$path' 2>&1};
        is( $? >> 8, 0, "generated $label endpoint passes PHP syntax validation" )
            or diag($lint);
    }
    my $user_root = File::Spec->catdir(
        $generated->{app_dir}, qw(output html5 results users permission_user) );
    my $input_dir = File::Spec->catdir( $user_root, 'selected' );
    make_path($input_dir);
    my $primary_path = File::Spec->catfile( $input_dir, 'primary.txt' );
    open my $primary_fh, '>', $primary_path or die "write '$primary_path' failed: $!";
    print {$primary_fh} "primary\n";
    close $primary_fh;
    my $encoded_primary = encode_base64('./selected/primary.txt', '');

    my $window = 'permission-window-scoped';
    my $scoped_request = encode_json({
        '_window' => $window,
        '_logon' => 'permission_user',
        '_project' => 'fresh_project',
        '_action' => 'conditional_precheck',
        'sample' => 'alpha',
        'input_mode' => 'c2',
        '_selaltval_primary_file' => 'primary_file_altval',
        'primary_file_altval' => [$encoded_primary],
    });
    my $php_code = join "\n",
        'umask(0022);',
        '$_REQUEST = json_decode(' . encode_json($scoped_request) . ', true);',
        'session_name("GENAPP_ACTION_BUTTON");',
        'session_id("genappfilescopetest");',
        'session_start();',
        '$_SESSION[' . encode_json($window) . '] = array("logon" => "permission_user", "project" => "fresh_project");',
        'session_write_close();',
        'include ' . encode_json($runtime_endpoint_path) . ';';
    open my $runtime_output, '-|', $php, '-r', $php_code
        or die "could not run generated action endpoint with php: $!";
    my $runtime_json = do { local $/; <$runtime_output> };
    close $runtime_output;
    is( $? >> 8, 0, 'generated action endpoint runs with umask 0022' );
    my $runtime_payload = eval { decode_json($runtime_json) };
    ok( ref($runtime_payload) eq 'HASH' && !$runtime_payload->{error}, 'opted-in action ignores an unrelated required file and returns a successful payload' )
        or diag($runtime_json);
    like( $runtime_json, qr/Checked sample/, 'opted-in action reaches its helper executable' );
    my $project_dir = File::Spec->catdir(
        $generated->{app_dir}, qw(output html5 results users permission_user fresh_project) );
    ok( -d $project_dir, 'action endpoint creates the fresh project directory' );
    my $project_mode = ( stat($project_dir) )[2] & 07777;
    ok( $project_mode & 0020, sprintf 'fresh action-created project is group-writable (mode %04o)', $project_mode );

    my $inactive_window = 'permission-window-inactive';
    my $inactive_request = encode_json({
        '_window' => $inactive_window,
        '_logon' => 'permission_user',
        '_project' => 'inactive_project',
        '_action' => 'conditional_precheck',
        'sample' => 'pasted',
        'input_mode' => 'c1',
    });
    my $inactive_php_code = join "\n",
        '$_REQUEST = json_decode(' . encode_json($inactive_request) . ', true);',
        'session_name("GENAPP_ACTION_BUTTON");',
        'session_id("genappfilescopeinactivetest");',
        'session_start();',
        '$_SESSION[' . encode_json($inactive_window) . '] = array("logon" => "permission_user", "project" => "inactive_project");',
        'session_write_close();',
        'include ' . encode_json($runtime_endpoint_path) . ';';
    open my $inactive_output, '-|', $php, '-r', $inactive_php_code
        or die "could not run generated action endpoint for inactive file branch with php: $!";
    my $inactive_json = do { local $/; <$inactive_output> };
    close $inactive_output;
    is( $? >> 8, 0, 'generated action endpoint runs with an inactive scoped file branch' );
    my $inactive_payload = eval { decode_json($inactive_json) };
    ok( ref($inactive_payload) eq 'HASH' && !$inactive_payload->{error}, 'opted-in action does not require a scoped file from an inactive branch' )
        or diag($inactive_json);
    like( $inactive_json, qr/Checked sample 'pasted'/, 'inactive scoped file branch still reaches its helper executable' );

    my $legacy_window = 'permission-window-legacy';
    my $legacy_request = encode_json({
        '_window' => $legacy_window,
        '_logon' => 'permission_user',
        '_project' => 'legacy_project',
        '_action' => 'precheck',
        'sample' => 'alpha',
        '_selaltval_primary_file' => 'primary_file_altval',
        'primary_file_altval' => [$encoded_primary],
    });
    my $legacy_php_code = join "\n",
        '$_REQUEST = json_decode(' . encode_json($legacy_request) . ', true);',
        'session_name("GENAPP_ACTION_BUTTON");',
        'session_id("genappfilescopelegacytest");',
        'session_start();',
        '$_SESSION[' . encode_json($legacy_window) . '] = array("logon" => "permission_user", "project" => "legacy_project");',
        'session_write_close();',
        'include ' . encode_json($runtime_endpoint_path) . ';';
    open my $legacy_output, '-|', $php, '-r', $legacy_php_code
        or die "could not run generated legacy action endpoint with php: $!";
    my $legacy_json = do { local $/; <$legacy_output> };
    close $legacy_output;
    my $legacy_payload = eval { decode_json($legacy_json) };
    like(
        $legacy_payload->{error} || '',
        qr/No file selected for Secondary file/,
        'non-opted-in action still requires every declared file'
    );
}

done_testing();
