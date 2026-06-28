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
like( $index, qr/\.\.\/js\/autobahn\.min\.js/, 'ui2 index preloads the existing legacy Autobahn websocket client' );
like( $index, qr/\.\.\/js\/plotly-2\.35\.2\.min\.js/, 'ui2 index preloads the existing generated Plotly bundle' );
like( $index, qr/js\/ui2\.js/, 'ui2 index loads the plain JavaScript playground' );
like( $index, qr/css\/ui2\.css/, 'ui2 index loads the ui2 stylesheet' );
like( $index, qr/id="ui2-session-status"/, 'ui2 index exposes a session/project status target' );
like( $index, qr/data-app-id="ui2_views"/, 'ui2 index exposes the generated application id' );

my $ui2_js = read_file( File::Spec->catfile( $ui2, qw(js ui2.js) ) );
like( $ui2_js, qr/function moduleSubmitEndpoint\(\)/, 'ui2 runtime bridge declares a module submit endpoint helper' );
like( $ui2_js, qr/function refreshSessionState\(\)/, 'ui2 runtime bridge declares a legacy session status helper' );
like( $ui2_js, qr/function legacyEndpoint\(paramName, path\)/, 'ui2 runtime bridge builds explicit legacy app-root endpoints' );
like( $ui2_js, qr/legacyEndpoint\("", "ajax"\)/, 'ui2 runtime bridge defaults submit endpoints to the legacy ajax root' );
like( $ui2_js, qr/dataset\.appId/, 'ui2 runtime bridge can fall back to the generated application id' );
like( $ui2_js, qr/sys_status\.php/, 'ui2 runtime bridge checks legacy sys_status for logon/project state' );
like( $ui2_js, qr/function openLoginDialog\(\)/, 'ui2 runtime bridge keeps login on the ui2 page' );
like( $ui2_js, qr/sys_login\.php/, 'ui2 runtime bridge posts login to the legacy login endpoint' );
like( $ui2_js, qr/function parseJsonResponse\(response, label\)/, 'ui2 runtime bridge reports non-JSON backend responses with endpoint context' );
like( $ui2_js, qr/PHP source instead of executing it/, 'ui2 runtime bridge calls out PHP-disabled runtime hosts' );
like( $ui2_js, qr/function initWebSocket\(\)/, 'ui2 runtime bridge initializes the legacy websocket channel' );
like( $ui2_js, qr/ajax\/sys_uid\.php/, 'ui2 runtime bridge uses the legacy sys_uid endpoint for websocket discovery' );
like( $ui2_js, qr/new window\.ab\.Session/, 'ui2 runtime bridge uses the legacy Autobahn websocket session' );
like( $ui2_js, qr/function subscribeRuntimeMessages\(uuid\)/, 'ui2 runtime bridge can subscribe to a submitted job uuid' );
like( $ui2_js, qr/state\.ws\.conn\.subscribe\(uuid, handleWebSocketMessage\)/, 'ui2 runtime bridge wires websocket messages into the runtime handler' );
like( $ui2_js, qr/function handleWebSocketMessage\(topic, data\)/, 'ui2 runtime bridge receives websocket runtime chunks' );
like( $ui2_js, qr/applyRuntimePayload\(payload\)/, 'ui2 websocket chunks flow through the same output rendering path as polling' );
like( $ui2_js, qr/ui2-ws-indicator-ok/, 'ui2 runtime bridge updates the websocket footer indicator' );
like( $ui2_js, qr/function buildSubmitFormData\(form, uuid\)/, 'ui2 runtime bridge builds GenApp submit FormData explicitly' );
like( $ui2_js, qr/function appendSelectedFiles\(formData, form\)/, 'ui2 runtime bridge includes selected file payloads' );
like( $ui2_js, qr/function appendServerSelection\(formData, selection\)/, 'ui2 runtime bridge includes server file selections' );
like( $ui2_js, qr/sys_files\.php/, 'ui2 runtime bridge uses the legacy server file endpoint' );
like( $ui2_js, qr/formData\.set\(`_selaltval_\$\{selection\.id\}`/, 'ui2 server file selections include the legacy selected-alt marker' );
like( $ui2_js, qr/\$\{selection\.id\}_altval\[\]/, 'ui2 server file selections include legacy encoded alt values' );
like( $ui2_js, qr/function renderJobManagerTool\(fields\)/, 'ui2 has a dedicated Job Manager shell' );
like( $ui2_js, qr/function fallbackUtilityModule\(moduleId\)/, 'ui2 can synthesize topbar utility modules not emitted into modules/' );
like( $ui2_js, qr/ajax\/sys_config\/sys_jobs\.php/, 'ui2 Job Manager loads rows from the legacy jobs endpoint' );
like( $ui2_js, qr/function applyJobManagerFilters\(table\)/, 'ui2 Job Manager applies local table filters' );
like( $ui2_js, qr/function updateJobFilterChoices\(table, rows\)/, 'ui2 Job Manager populates filter choices from loaded rows' );
like( $ui2_js, qr/function renderJobSelectFilter\(id, label, options\)/, 'ui2 Job Manager renders select filters for job columns' );
like( $ui2_js, qr/function toolFieldControl\(section, id, tagName\)/, 'ui2 Job Manager reads actual filter controls instead of wrapper rows' );
like( $ui2_js, qr/ajax\/sys_config\/sys_managejob\.php/, 'ui2 Job Manager uses the legacy manage-job endpoint for row actions' );
like( $ui2_js, qr/function submitSystemModuleAction\(action, jobIds\)/, 'ui2 Job Manager can submit legacy system-module actions' );
like( $ui2_js, qr/startJobPolling\(pollUuid, form, status, false, true\)/, 'ui2 Job Manager reattach polls the uuid from the legacy switch target' );
like( $ui2_js, qr/function moduleIdFromSwitchParts\(parts\)/, 'ui2 Job Manager parses legacy switch targets without assuming one shape' );
like( $ui2_js, qr/function applyInputPayload\(inputs\)/, 'ui2 Job Manager can hydrate form inputs from reattached job payloads' );
like( $ui2_js, qr/function renderFileManagerTool\(fields\)/, 'ui2 has a dedicated File Manager shell' );
like( $ui2_js, qr/function downloadFileManagerSelection\(table, status, links\)/, 'ui2 File Manager submits selected files for download and renders returned links' );
like( $ui2_js, qr/formData\.append\("selectedfiles\[\]", id\)/, 'ui2 File Manager sends legacy encoded selected file ids' );
like( $ui2_js, qr/const uuid = createUuid\(\);\s+formData\.set\("_uuid", uuid\)/s, 'ui2 File Manager supplies reusable uuid metadata to the generated wrapper' );
like( $ui2_js, qr/waitForFileManagerResult\(uuid, status\)/, 'ui2 File Manager polls async system download jobs with the submitted uuid' );
like( $ui2_js, qr/formData\.set\("_docrootexecutable", state\.module\.docrootexecutable\)/, 'ui2 File Manager sends docroot executable metadata for system downloads' );
like( $ui2_js, qr/function normalizeFileList\(value\)/, 'ui2 File Manager normalizes backend download file payload shapes' );
like( $ui2_js, qr/no downloadable file link was returned/, 'ui2 File Manager does not report success without a returned link' );
like( $ui2_js, qr/const uuid = createUuid\(\)/, 'ui2 runtime bridge keeps the submitted uuid for job polling' );
like( $ui2_js, qr/formData\.set\("_uuid", uuid/, 'ui2 runtime bridge supplies uuid for generated backend submit path' );
like( $ui2_js, qr/formData\.set\("_logon", state\.session\.logon/, 'ui2 submit uses the legacy session logon' );
like( $ui2_js, qr/formData\.set\("_project", state\.session\.project/, 'ui2 submit uses the legacy session project' );
like( $ui2_js, qr/function startJobPolling\(uuid, form, statusNode, getLastMsg = true, getInput = false\)/, 'ui2 runtime bridge starts polling submitted jobs' );
like( $ui2_js, qr/function pollJobResults\(uuid, form, statusNode, lastDelay, getLastMsg, getInput = false\)/, 'ui2 runtime bridge polls legacy job results' );
like( $ui2_js, qr/ajax\/get_results\.php/, 'ui2 runtime bridge uses the legacy job results endpoint' );
like( $ui2_js, qr/url\.searchParams\.set\("_getlastmsg", getLastMsg \? "1" : "0"\)/, 'ui2 runtime bridge requests legacy last-message updates with the PHP-native flag' );
like( $ui2_js, qr/url\.searchParams\.set\("_getinput", getInput \? "true" : "false"\)/, 'ui2 runtime bridge requests saved job inputs only when reattaching' );
like( $ui2_js, qr/function applyRuntimePayload\(payload\)/, 'ui2 runtime bridge maps runtime payloads into rendered outputs' );
like( $ui2_js, qr/function mergeRuntimeText\(existing, incoming\)/, 'ui2 runtime bridge preserves accumulated runtime text output' );
like( $ui2_js, qr/function isCompleteRuntimeText\(text\)/, 'ui2 runtime bridge recognizes complete final textarea streams' );
like( $ui2_js, qr/function stripUi2RuntimeStatus\(text\)/, 'ui2 runtime bridge strips ui2-only runtime status text from canonical output' );
like( $ui2_js, qr/function isRuntimeDividerText\(text\)/, 'ui2 runtime bridge preserves repeated textarea divider lines' );
like( $ui2_js, qr/output\.dataset\.runtimeText = merged/, 'ui2 runtime bridge keeps runtime text across later output redraws' );
like( $ui2_js, qr/function renderPlotlyOutput\(output, value\)/, 'ui2 runtime bridge has a dedicated Plotly output renderer' );
like( $ui2_js, qr/function applyPlotlyModebarHooks\(figure, config\)/, 'ui2 runtime bridge honors legacy Plotly Chart Editor config' );
like( $ui2_js, qr/Edit in Chart Editor/, 'ui2 Plotly modebar exposes the Chart Editor action when configured' );
like( $ui2_js, qr/function chartEditorLayout\(layout\)/, 'ui2 Plotly Chart Editor receives an editor-friendly layout copy' );
like( $ui2_js, qr/function chartEditorUrl\(editorUrl, id\)/, 'ui2 Plotly Chart Editor URLs resolve through the legacy app root' );
like( $ui2_js, qr/new URL\(legacyEndpoint\("", raw\), window\.location\.href\)/, 'ui2 relative Chart Editor URLs do not resolve under the ui2 subdirectory' );
like( $ui2_js, qr/function parsePlotlyFigure\(value\)/, 'ui2 runtime bridge parses Plotly JSON string payloads' );
like( $ui2_js, qr/function defaultPlotlyLayout\(\)/, 'ui2 runtime bridge supplies default Plotly layout polish' );
like( $ui2_js, qr/function ensurePlotlyLoaded\(\)/, 'ui2 runtime bridge can load the existing generated Plotly asset' );
like( $ui2_js, qr/function normalizeProgressValue\(value\)/, 'ui2 runtime bridge normalizes progress payload values' );
like( $ui2_js, qr/window\.GenAppUi2TestHooks/, 'ui2 runtime exposes opt-in test hooks for behavior checks' );
like( $ui2_js, qr/function renderSubmitResponse\(payload\) \{\s+if \(!devMode\) \{\s+return;/, 'ui2 hides raw submit payloads outside dev mode' );
like( $ui2_js, qr/type === "float"[\s\S]+input\.step = "any"/, 'ui2 float inputs allow decimal values' );
like( $ui2_js, qr/type === "integer"[\s\S]+input\.step = "1"/, 'ui2 integer inputs keep whole-number stepping' );

my $ui2_css = read_file( File::Spec->catfile( $ui2, qw(css ui2.css) ) );
like( $ui2_css, qr/\.ui2-dialog-overlay/, 'ui2 stylesheet includes login dialog shell styles' );
like( $ui2_css, qr/\.ui2-output-plotly/, 'ui2 stylesheet includes a stable Plotly output surface' );
like( $ui2_css, qr/\.ui2-output-rendered/, 'ui2 stylesheet distinguishes rendered runtime output from placeholders' );
like( $ui2_css, qr/\.ui2-output-field/, 'ui2 stylesheet lets output rows use the full default width' );
like( $ui2_css, qr/\.ui2-mini-button/, 'ui2 stylesheet includes compact system action buttons' );
like( $ui2_css, qr/\.ui2-file-download-links/, 'ui2 stylesheet makes File Manager download links visible beside actions' );

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
