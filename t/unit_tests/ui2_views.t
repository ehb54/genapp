use strict;
use warnings;

use File::Spec;
use FindBin;
use JSON qw(decode_json);
use Test::More;

use lib File::Spec->catdir( $FindBin::Bin, '..', 'lib' );
use GenAppTest qw(generate_fixture_app read_file repo_root);

my $repo_root = repo_root( File::Spec->catdir( $FindBin::Bin, '..' ) );
my $generated = generate_fixture_app(
    repo_root    => $repo_root,
    fixture_name => 'ui2_views',
    test_dir     => File::Spec->catdir( $FindBin::Bin, '..' ),
);

is( $generated->{status}, 0, 'ui2_views fixture generates ui2 output' )
    or diag("command failed ($generated->{status}): $generated->{quoted}\n$generated->{output}");

my $app_dir = $generated->{app_dir};
my $ui2     = File::Spec->catdir( $app_dir, qw(output ui2) );

ok( -f File::Spec->catfile( $ui2, 'index.html' ), 'ui2 index was generated' );
ok( -f File::Spec->catfile( $ui2, qw(js app-map.js) ), 'ui2 app map was generated' );
ok( -f File::Spec->catfile( $ui2, qw(css ui2.css) ), 'ui2 stylesheet was copied' );
ok( -f File::Spec->catfile( $ui2, qw(js ui2.js) ), 'ui2 script was copied' );
ok( -f File::Spec->catfile( $ui2, qw(modules shared.json) ), 'ui2 shared module summary was generated' );
ok( -f File::Spec->catfile( $ui2, qw(modules plain.json) ), 'ui2 plain module summary was generated' );
ok( -f File::Spec->catfile( $ui2, qw(modules typed.json) ), 'ui2 typed module summary was generated without ui2 type templates' );

my $index = read_file( File::Spec->catfile( $ui2, 'index.html' ) );
like( $index, qr/js\/app-map\.js/, 'ui2 index loads the generated app map' );
like( $index, qr/js\/ui2\.js/, 'ui2 index loads the plain JavaScript playground' );
like( $index, qr/css\/ui2\.css/, 'ui2 index loads the ui2 stylesheet' );
like( $index, qr/id="ui2-session-status"/, 'ui2 index exposes a session/project status target' );

my $ui2_js = read_file( File::Spec->catfile( $ui2, qw(js ui2.js) ) );
like( $ui2_js, qr/function moduleSubmitEndpoint\(\)/, 'ui2 runtime bridge declares a module submit endpoint helper' );
like( $ui2_js, qr/\.\.\/ajax/, 'ui2 runtime bridge defaults to sibling html5 ajax endpoints' );
like( $ui2_js, qr/function refreshSessionState\(\)/, 'ui2 runtime bridge declares a legacy session status helper' );
like( $ui2_js, qr/sys_status\.php/, 'ui2 runtime bridge checks legacy sys_status for logon/project state' );
like( $ui2_js, qr/function openLoginDialog\(\)/, 'ui2 runtime bridge keeps login on the ui2 page' );
like( $ui2_js, qr/sys_login\.php/, 'ui2 runtime bridge posts login to the legacy login endpoint' );
like( $ui2_js, qr/function buildSubmitFormData\(form\)/, 'ui2 runtime bridge builds GenApp submit FormData explicitly' );
like( $ui2_js, qr/function appendSelectedFiles\(formData, form\)/, 'ui2 runtime bridge includes selected file payloads' );
like( $ui2_js, qr/formData\.set\("_uuid"/, 'ui2 runtime bridge supplies uuid for generated backend submit path' );
like( $ui2_js, qr/formData\.set\("_logon", state\.session\.logon/, 'ui2 submit uses the legacy session logon' );
like( $ui2_js, qr/formData\.set\("_project", state\.session\.project/, 'ui2 submit uses the legacy session project' );
like( $ui2_js, qr/type === "float"[\s\S]+input\.step = "any"/, 'ui2 float inputs allow decimal values' );
like( $ui2_js, qr/type === "integer"[\s\S]+input\.step = "1"/, 'ui2 integer inputs keep whole-number stepping' );

my $ui2_css = read_file( File::Spec->catfile( $ui2, qw(css ui2.css) ) );
like( $ui2_css, qr/\.ui2-dialog-overlay/, 'ui2 stylesheet includes login dialog shell styles' );

my $app_map = read_file( File::Spec->catfile( $ui2, qw(js app-map.js) ) );
like( $app_map, qr/addMenuFromParts\("demo", "Demo", ""\)/, 'ui2 app map records menu groups' );
like( $app_map, qr/addModule\("demo", \{\s+id: "shared",\s+label: "Shared"/, 'ui2 app map records menu modules' );

my $shared = decode_json( read_file( File::Spec->catfile( $ui2, qw(modules shared.json) ) ) );
is( $shared->{module}, 'shared', 'shared summary records module id' );
is( $shared->{modulejson}{label}, 'UI2 Module Override', 'ui2/module_overrides replaces the canonical module for ui2' );
is( $shared->{modulejson}{executable}, 'ui2_module_override_shared', 'ui2/module_overrides executable is used' );
is( $shared->{modulejson}{fields}[0]{id}, 'ui2_override_input', 'ui2/module_overrides field is used' );
unlike( $shared->{modulejson}{label}, qr/Legacy UI2 Modules Override Should Lose/, 'ui2/module_overrides wins over ui2/modules fallback' );

is( $shared->{viewjson}{module}, 'shared', 'general view file is loaded' );
is( $shared->{viewjson}{labels}{basis}, 'target neutral', 'general view nested data is preserved' );
is( $shared->{viewjson}{labels}{title}, 'UI2 View', 'target-specific ui2 view overrides general view data' );
is( $shared->{viewjson}{renderers}{shared_input}, 'compact', 'target-specific ui2 view adds target-only data' );
is( $shared->{viewjson}{sections}[0]{id}, 'general', 'general view sections are available to ui2' );

my $plain = decode_json( read_file( File::Spec->catfile( $ui2, qw(modules plain.json) ) ) );
is( $plain->{module}, 'plain', 'plain summary records module id' );
is( $plain->{modulejson}{label}, 'Plain UI2 Modules Fallback', 'ui2/modules remains a fallback module override path' );
is( $plain->{modulejson}{fields}[0]{id}, 'plain_ui2_modules_input', 'ui2/modules fallback field is used when module_overrides is absent' );
is_deeply( $plain->{viewjson}, {}, 'missing view files produce an empty view object' );

my $typed = decode_json( read_file( File::Spec->catfile( $ui2, qw(modules typed.json) ) ) );
is( $typed->{module}, 'typed', 'typed summary records module id' );
is( $typed->{modulejson}{fields}[0]{type}, 'integer', 'ui2 can carry integer fields without ui2 type templates' );
is( $typed->{modulejson}{fields}[1]{type}, 'checkbox', 'ui2 can carry checkbox fields without ui2 type templates' );
is( $typed->{modulejson}{fields}[2]{type}, 'float', 'ui2 can carry float fields without ui2 type templates' );
is( $typed->{modulejson}{fields}[3]{default}[0], '{"rot": [[[1.0, 0.0, 0.0]]], "trans": [[0.0, 0.0, 0.0]]}', 'ui2 module summaries preserve nested JSON string defaults as valid JSON' );
is( $typed->{modulejson}{fields}[8]{type}, 'integerpair', 'ui2 can carry integerpair matrix controllers without ui2 type templates' );
is( $typed->{modulejson}{fields}[8]{calc}, 'row_count,column_count', 'ui2 preserves integerpair matrix dimensions' );
is( $typed->{modulejson}{fields}[8]{headers}{row}[0], 'row_label', 'ui2 preserves matrix row header metadata' );
is( $typed->{modulejson}{fields}[9]{default}[1][1], '4', 'ui2 preserves matrix field two-dimensional defaults' );
is_deeply( $typed->{viewjson}, {}, 'typed module missing view files produce an empty view object' );

my $invalid = generate_fixture_app(
    repo_root    => $repo_root,
    fixture_name => 'ui2_invalid_view',
    test_dir     => File::Spec->catdir( $FindBin::Bin, '..' ),
);

isnt( $invalid->{status}, 0, 'invalid ui2 view JSON fails generation' );
like( $invalid->{output}, qr/JSON Error in view file views\/shared\.json/, 'invalid ui2 view JSON reports the view file path' );

done_testing();
