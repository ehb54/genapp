use strict;
use warnings;

use File::Spec;
use FindBin;
use lib File::Spec->catdir( $FindBin::Bin, 'lib' );
use GenAppTest qw(generate_fixture_app read_file repo_root);
use JSON::PP qw(decode_json);
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
like( $endpoint, qr/proc_open\( \$actionexe/, 'action endpoint runs action executable directly' );
like( $endpoint, qr/\$action_dir = "\$rdir\/_actions\/action_demo\/\$action_id"/, 'action endpoint uses per-user project action directory' );
unlike( $endpoint, qr/jobrun\.php|sys_joblocked|joblog/, 'action endpoint stays outside job manager submit path' );

my $ga_js = read_file( File::Spec->catfile( $generated->{app_dir}, qw(output html5 js ga.js) ) );
like( $ga_js, qr/ga\.action\.process = function/, 'shared html5 JavaScript includes action processor' );
like( $ga_js, qr/case "set_fields":/, 'action processor supports declarative field updates' );
like( $ga_js, qr/case "dialog":/, 'action processor supports message and dialog actions' );

my $ui2_module = decode_json( read_file( File::Spec->catfile( $generated->{app_dir}, qw(output ui2 modules action_demo.json) ) ) );
my ($ui2_action) = grep { $_->{id} eq 'precheck' } @{ $ui2_module->{modulejson}{fields} };
is( $ui2_action->{type}, 'action', 'ui2 module summary carries action field type' );
is( $ui2_action->{executable}, 'precheck_action', 'ui2 module summary carries action executable metadata' );
is( $ui2_action->{actiondata}, '_allformdata', 'ui2 module summary carries action data selection' );

my $ui2_js = read_file( File::Spec->catfile( $generated->{app_dir}, qw(output ui2 js ui2.js) ) );
like( $ui2_js, qr/type === "action"[\s\S]+renderActionControl\(field\)/, 'ui2 core renderer owns action controls' );
like( $ui2_js, qr/function runModuleAction\(field, button, statusNode\)/, 'ui2 runtime declares action execution helper' );
like( $ui2_js, qr/function moduleActionEndpointFor\(moduleId\)[\s\S]+ajax\/action/, 'ui2 action endpoint resolves through legacy ajax action root' );
like( $ui2_js, qr/function applyActionPayload\(payload\)/, 'ui2 runtime declares action response handler' );
like( $ui2_js, qr/createField: \(field, role\) => renderField\(field, role\)/, 'React bridge will receive action support through canonical UI2 fields' );

ok( -f File::Spec->catfile( $repo_root, qw(languages qt5 types action.input) ), 'qt5 has additive action input template stub' );
ok( -f File::Spec->catfile( $repo_root, qw(languages qt5 types action.output) ), 'qt5 has additive action output template stub' );

done_testing();
