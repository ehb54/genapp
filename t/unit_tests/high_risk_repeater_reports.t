use strict;
use warnings;

use File::Spec;
use FindBin;
use Test::More;

use lib File::Spec->catdir( $FindBin::Bin, '..', 'lib' );
use GenAppTest qw(generate_fixture_app read_file repo_root);

my $repo_root = repo_root( File::Spec->catdir( $FindBin::Bin, '..' ) );
my $generated = generate_fixture_app(
    repo_root    => $repo_root,
    fixture_name => 'unit_high_risk_features',
    test_dir     => File::Spec->catdir( $FindBin::Bin, '..' ),
    genapp_args  => ['-sr'],
);

ok( $generated->{status} != 0, '-sr exits after writing repeater reports in current GenApp' );
like( $generated->{output}, qr/-sr option terminates here/, '-sr reports intentional early termination' );

my $report = File::Spec->catfile( $generated->{app_dir}, qw(output repeaters repeater_contract_repeater.txt) );
ok( -f $report, 'repeater contract report was generated' );

if ( -f $report ) {
    my $text = read_file($report);
    like( $text, qr/advanced_count\[integer\] => analysis_mode:advanced\[listbox choice \d+\] => analysis_mode\[listbox\]/, 'report records option-qualified integer repeater' );
    like( $text, qr/advanced_label\[text\] => advanced_count\[integer\]/, 'report records integer repeated child' );
    like( $text, qr/nested_gate\[checkbox\] => advanced_count\[integer\]/, 'report records nested checkbox repeater' );
    like( $text, qr/nested_value\[text\] => nested_gate\[checkbox\]/, 'report records nested repeated child' );
    like( $text, qr/pair_grid\[integerpair\] => analysis_mode:pair\[listbox choice \d+\] => analysis_mode\[listbox\]/, 'report records option-qualified integerpair repeater' );
    like( $text, qr/pair_payload\[text\] => pair_grid\[integerpair\]/, 'report records integerpair repeated child' );
    like( $text, qr/checkbox_gate_count\[integer\] => checkbox_gate:true\[checkbox true gate\]/, 'report records checkbox true gate' );
    like( $text, qr/checkbox_gate_value\[text\] => checkbox_gate_count\[integer\]/, 'report records checkbox-gated integer repeated child' );
}

done_testing();
