use strict;
use warnings;

use File::Spec;
use FindBin;
use lib File::Spec->catdir( $FindBin::Bin, 'lib' );
use GenAppTest qw(generate_fixture_app read_file repo_root);
use JSON::PP qw(decode_json encode_json);
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
is( $ui2_action->{type}, 'action', 'ui2 module summary carries action field type' );
is( $ui2_action->{executable}, 'precheck_action', 'ui2 module summary carries action executable metadata' );
is( $ui2_action->{resource}, 'host', 'ui2 module summary carries action resource metadata' );
is( $ui2_action->{actiondata}, '_allformdata', 'ui2 module summary carries action data selection' );

my $ui2_js = read_file( File::Spec->catfile( $generated->{app_dir}, qw(output ui2 js ui2.js) ) );
like( $ui2_js, qr/type === "action"[\s\S]+renderActionControl\(field\)/, 'ui2 core renderer owns action controls' );
like( $ui2_js, qr/function runModuleAction\(field, button, statusNode\)/, 'ui2 runtime declares action execution helper' );
like( $ui2_js, qr/function moduleActionEndpointFor\(moduleId\)[\s\S]+ajax\/action/, 'ui2 action endpoint resolves through legacy ajax action root' );
like( $ui2_js, qr/function applyActionPayload\(payload\)/, 'ui2 runtime declares action response handler' );
like( $ui2_js, qr/createFieldGroup: \(groupFields, role\) => renderReactWorkbenchFieldGroup\(groupFields, role\)/, 'React bridge will receive action support through canonical UI2 field groups' );
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
my $php = qx{command -v php 2>/dev/null};
chomp $php;
SKIP: {
    skip 'php is not available on PATH; PHP endpoint checks are deferred', 6 if !$php;
    for my $check (
        [ action     => $action_endpoint_path ],
        [ submission => $submit_endpoint_path ],
    ) {
        my ( $label, $path ) = @{$check};
        my $lint = qx{'$php' -l '$path' 2>&1};
        is( $? >> 8, 0, "generated $label endpoint passes PHP syntax validation" )
            or diag($lint);
    }
    my $window = 'permission-window';
    my $php_code = join "\n",
        'umask(0022);',
        '$_REQUEST = array(',
        '  "_window" => ' . encode_json($window) . ',',
        '  "_logon" => "permission_user",',
        '  "_project" => "fresh_project",',
        '  "_action" => "conditional_precheck",',
        '  "sample" => "alpha"',
        ');',
        'session_name("GENAPP_ACTION_BUTTON");',
        'session_id("genapppermissiontest");',
        'session_start();',
        '$_SESSION[' . encode_json($window) . '] = array("logon" => "permission_user", "project" => "fresh_project");',
        'session_write_close();',
        'include ' . encode_json($action_endpoint_path) . ';';
    open my $runtime_output, '-|', $php, '-r', $php_code
        or die "could not run generated action endpoint with php: $!";
    my $runtime_json = do { local $/; <$runtime_output> };
    close $runtime_output;
    is( $? >> 8, 0, 'generated action endpoint runs with umask 0022' );
    my $runtime_payload = eval { decode_json($runtime_json) };
    ok( ref($runtime_payload) eq 'HASH' && !$runtime_payload->{error}, 'generated action endpoint returns a successful payload' )
        or diag($runtime_json);
    my $project_dir = File::Spec->catdir(
        $generated->{app_dir}, qw(output html5 results users permission_user fresh_project) );
    ok( -d $project_dir, 'action endpoint creates the fresh project directory' );
    my $project_mode = ( stat($project_dir) )[2] & 07777;
    ok( $project_mode & 0020, sprintf 'fresh action-created project is group-writable (mode %04o)', $project_mode );
}

done_testing();
