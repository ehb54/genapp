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

ok( -f File::Spec->catfile( $ui2, qw(ajax ui2_test_scenarios.php) ), 'UI2-only scenario endpoint is generated' );
like( $endpoint, qr/restricted->admin/, 'scenario endpoint checks configured server administrators' );
like( $endpoint, qr/hash_equals\(\$session_logon, \$requested_logon\)/, 'scenario endpoint verifies the requested browser identity against the server session' );
like( $endpoint, qr/unknown input field/, 'scenario endpoint rejects catalog inputs outside declared module fields' );
like( $runtime, qr/function applyTestScenario\(id, form/, 'UI2 core owns scenario hydration' );
like( $runtime, qr/function evaluateTestScenarioVerification\(/, 'UI2 core owns final-output verification state' );
like( $runtime, qr/TEST_SCENARIO_ENDPOINT/, 'scenario service is UI2-local' );
unlike( $runtime, qr/html5.*test scenario/i, 'UI2 scenario runtime does not create an HTML5 workflow' );
like( $catalog, qr/"basic_documented_example"/, 'fixture includes a documented-example scenario' );
like( $catalog, qr/"manual_mode"/, 'fixture includes a manual branch' );
like( $catalog, qr/"advanced_branch"/, 'fixture includes an advanced branch' );
like( $catalog, qr/"output_nonempty"/, 'fixture reserves final-output verification expectations' );

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
