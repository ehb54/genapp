use strict;
use warnings;

use File::Spec;
use FindBin;
use Test::More;

use lib File::Spec->catdir( $FindBin::Bin, '..', 'lib' );
use GenAppTest qw(generate_fixture_app read_file repo_root run_command);

my $repo_root = repo_root( File::Spec->catdir( $FindBin::Bin, '..' ) );
my $generated = generate_fixture_app(
    repo_root    => $repo_root,
    fixture_name => 'ui2_test_scenarios',
    test_dir     => File::Spec->catdir( $FindBin::Bin, '..' ),
);

is( $generated->{status}, 0, 'data-interpolation-shaped scenario fixture generates UI2 output' )
    or diag("command failed ($generated->{status}): $generated->{quoted}\n$generated->{output}");

my $app_dir = $generated->{app_dir};
my $ui2 = File::Spec->catdir( $app_dir, qw(output ui2) );
my $endpoint = read_file( File::Spec->catfile( $ui2, qw(ajax ui2_test_scenarios.php) ) );
my $runtime = read_file( File::Spec->catfile( $ui2, qw(js ui2.js) ) );
my $catalog = read_file( File::Spec->catfile( $app_dir, qw(test_scenarios data_interpolation.json) ) );
my $file_catalog_path = File::Spec->catfile( $app_dir, qw(test_scenarios scenario_file_workflow.json) );
my $file_catalog = read_file( $file_catalog_path );
my $asset_path = File::Spec->catfile(
    $app_dir, qw(test_scenarios assets scenario_file_workflow sample_text sample.txt)
);

ok( -f File::Spec->catfile( $ui2, qw(ajax ui2_test_scenarios.php) ), 'UI2-only scenario endpoint is generated' );
like( $endpoint, qr/restricted->admin/, 'scenario endpoint checks configured server administrators' );
like( $endpoint, qr/hash_equals\(\$session_logon, \$requested_logon\)/, 'scenario endpoint verifies the requested browser identity against the server session' );
like( $endpoint, qr/unknown input field/, 'scenario endpoint rejects catalog inputs outside declared module fields' );
like( $runtime, qr/async function applyTestScenario\(id, form/, 'UI2 core owns asynchronous scenario hydration' );
like( $runtime, qr/window\.crypto\?\.subtle/, 'UI2 verifies fetched scenario files in the browser' );
like( $runtime, qr/new DataTransfer\(\)/, 'UI2 attaches verified assets through native file controls' );
like( $runtime, qr/applyInputPayload\(defaultInputPayload\(\), \{ clearMissing: true \}\)/, 'scenario hydration resets omitted ordinary inputs to module defaults' );
like( $runtime, qr/function evaluateTestScenarioVerification\(/, 'UI2 core owns final-output verification state' );
like( $runtime, qr/TEST_SCENARIO_ENDPOINT/, 'scenario service is UI2-local' );
unlike( $runtime, qr/html5.*test scenario/i, 'UI2 scenario runtime does not create an HTML5 workflow' );
like( $catalog, qr/"basic_documented_example"/, 'fixture includes a documented-example scenario' );
like( $catalog, qr/"manual_mode"/, 'fixture includes a manual branch' );
like( $catalog, qr/"advanced_branch"/, 'fixture includes an advanced branch' );
like( $catalog, qr/"output_nonempty"/, 'fixture reserves final-output verification expectations' );
like( $file_catalog, qr/"sample_file"/, 'neutral opted-in fixture declares a file target' );
like( $file_catalog, qr/"907729515e50a0bef905abcf2188f2fd9e0ae14734f2dd4eb8ae7b9656b686dc"/, 'neutral fixture pins the asset digest' );
is( -s $asset_path, 22, 'neutral scenario asset remains private application-owned test data' );
like( $endpoint, qr/realpath\(\$app_root \. '\/test_scenarios\/assets'\)/, 'protected endpoint anchors asset resolution under the private assets root' );
like( $endpoint, qr/hash_file\('sha256'/, 'protected endpoint verifies asset integrity before serving bytes' );

my $bad_file_catalog = $file_catalog;
$bad_file_catalog =~ s/907729515e50a0bef905abcf2188f2fd9e0ae14734f2dd4eb8ae7b9656b686dc/0000000000000000000000000000000000000000000000000000000000000000/;
open my $bad_asset, '>', $file_catalog_path or die "could not write invalid asset catalog fixture: $!";
print {$bad_asset} $bad_file_catalog;
close $bad_asset;
my ( $bad_asset_status, $bad_asset_output ) = run_command(
    cwd => $app_dir,
    env => { GENAPP => $repo_root },
    cmd => [ File::Spec->catfile( $repo_root, qw(bin genapp) ), '--language', 'ui2' ],
);
isnt( $bad_asset_status, 0, 'GenApp rejects a scenario asset whose declared digest is stale' );
like( $bad_asset_output, qr/size or sha256 does not match/i, 'asset validation reports the integrity mismatch' );
open my $restore_asset, '>', $file_catalog_path or die "could not restore asset catalog fixture: $!";
print {$restore_asset} $file_catalog;
close $restore_asset;

open my $invalid, '>', File::Spec->catfile( $app_dir, qw(test_scenarios data_interpolation.json) )
    or die "could not write invalid catalog fixture: $!";
print {$invalid} <<'JSON';
{
  "schema_version": 1,
  "module_id": "data_interpolation",
  "scenarios": [{
    "id": "invalid_field",
    "label": "Invalid field",
    "inputs": { "not_a_module_input": "no" }
  }]
}
JSON
close $invalid;
my ( $invalid_status, $invalid_output ) = run_command(
    cwd => $app_dir,
    env => { GENAPP => $repo_root },
    cmd => [ File::Spec->catfile( $repo_root, qw(bin genapp) ), '--language', 'ui2' ],
);
isnt( $invalid_status, 0, 'GenApp rejects a catalog with an unknown module input' );
like( $invalid_output, qr/not_a_module_input|unknown input/i, 'catalog validation names the invalid field' );

done_testing();
