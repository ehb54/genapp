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
    fixture_name => 'ui2_repeated_row_conditions',
    test_dir     => File::Spec->catdir( $FindBin::Bin, '..' ),
);

is( $generated->{status}, 0, 'neutral repeated-row condition fixture generates UI2 output' )
    or diag("command failed ($generated->{status}): $generated->{quoted}\n$generated->{output}");

my $ui2 = File::Spec->catdir( $generated->{app_dir}, qw(output ui2) );
my $condition_module = decode_json( read_file(
    File::Spec->catfile( $ui2, qw(modules repeated_row_conditions.json) )
) );
my $plain_module = decode_json( read_file(
    File::Spec->catfile( $ui2, qw(modules plain_repeater.json) )
) );

my %condition_fields = map { $_->{id} => $_ } @{ $condition_module->{modulejson}{fields} || [] };
my %plain_fields = map { $_->{id} => $_ } @{ $plain_module->{modulejson}{fields} || [] };

is( $condition_fields{prepared_file}{repeat}, 'row_count', 'conditioned file retains the numeric table controller' );
is( $condition_fields{prepared_file}{repeatcondition}, 'source_kind:prepared', 'conditioned file declares its row-local listbox condition' );
is( $condition_fields{raw_file}{repeat}, 'row_count', 'second conditioned file remains in the same table' );
is( $condition_fields{raw_file}{repeatcondition}, 'source_kind:raw', 'second conditioned file has the alternate row-local condition' );
is( $condition_fields{scale}{repeatcondition}, 'source_kind:raw', 'ordinary conditioned table cells use the same contract' );
ok( !exists $plain_fields{row_value}{repeatcondition}, 'non-opted-in repeater has no row-local condition metadata' );
is( $plain_fields{row_file}{repeat}, 'row_count', 'plain repeated file retains the numeric table controller' );
ok( !exists $plain_fields{row_file}{repeatcondition}, 'plain repeated file has no row-local condition metadata' );

my $ui2_js = read_file( File::Spec->catfile( $ui2, qw(js ui2.js) ) );
like( $ui2_js, qr/function updateRepeatTableCellConditions\(scope, rawValues\)/, 'generated UI2 runtime contains generic table-cell condition handling' );
like( $ui2_js, qr/function repeatTableConditionValue\(expression, rawValues, fieldsById, repeatIndex\)/, 'generated UI2 runtime evaluates conditions at the row index' );
like( $ui2_js, qr/header\.dataset\.repeatTableHeader = field\.id \|\| ""/, 'generated UI2 runtime identifies repeat-table headers by generic field id' );
like( $ui2_js, qr/hasActiveCell.*?td\[data-repeat-table-field=/s, 'generated UI2 runtime collapses a conditional column only when every row cell is inactive' );

is( $condition_module->{viewjson}{inputs}{layout}, 'wide', 'neutral repeated-row fixture opts into the wide input layout' );

done_testing();
