use strict;
use warnings;

use File::Spec;
use FindBin;
use JSON qw(decode_json);
use Test::More;

use lib File::Spec->catdir( $FindBin::Bin, '..', 'lib' );
use GenAppTest qw(read_file repo_root);

my $repo_root = repo_root( File::Spec->catdir( $FindBin::Bin, '..' ) );
my $fixture   = File::Spec->catdir( $repo_root, qw(t fixtures apps unit_high_risk_features) );

ok( -d $fixture, 'unit_high_risk_features fixture exists' );

my @module_files = map { File::Spec->catfile( $fixture, 'modules', "$_.json" ) } qw(
    repeater_contract
    output_contract
    transport_contract
);

my ( %types, %output_types, %repeaters, %repeats, %modules );
for my $path (@module_files) {
    my $json = decode_json( _json_text($path) );
    my $id   = $json->{moduleid};
    $modules{$id} = 1;

    for my $field ( @{ $json->{fields} || [] } ) {
        my $type = $field->{type} || q{};
        $types{$type}{$id} = 1 if length $type;
        $output_types{$type}{$id} = 1 if ( $field->{role} || q{} ) eq 'output';
        $repeaters{ $field->{id} } = $id if ( $field->{repeater} || q{} ) eq 'true';
        $repeats{ $field->{id} } = $field->{repeat} if exists $field->{repeat};
    }
}

for my $module (qw(repeater_contract output_contract transport_contract)) {
    ok( $modules{$module}, "$module fixture module is present" );
}

for my $type (qw(integerpair plotly atomicstructure image file rpath progress html textarea text)) {
    ok( exists $types{$type}, "fixture covers $type field type" );
}

for my $type (qw(plotly atomicstructure image file progress html textarea)) {
    ok( exists $output_types{$type}, "fixture covers $type output type" );
}

for my $repeater (qw(analysis_mode advanced_count nested_gate pair_grid)) {
    ok( exists $repeaters{$repeater}, "$repeater is declared as a repeater" );
}

is( $repeats{advanced_count}, 'analysis_mode:advanced', 'option-qualified integer repeater is represented' );
is( $repeats{pair_grid},      'analysis_mode:pair',     'option-qualified integerpair repeater is represented' );
is( $repeats{nested_gate},    'advanced_count',         'nested repeater is represented' );
is( $repeats{nested_value},   'nested_gate',            'nested repeated child is represented' );
is( $repeats{pair_payload},   'pair_grid',              'integerpair repeated child is represented' );

my $menu = decode_json( _json_text( File::Spec->catfile( $fixture, 'menu.json' ) ) );
my ($transport_menu) = grep { ( $_->{id} || q{} ) eq 'transport_fixtures' } @{ $menu->{menu} || [] };
ok( $transport_menu, 'transport fixture menu exists' );
is( $transport_menu->{hidden}, 'true', 'transport fixture menu is marked hidden/test-only' );

my $output_contract = decode_json( _json_text( File::Spec->catfile( $fixture, qw(modules output_contract.json) ) ) );
my ($safe_name) = grep { ( $_->{id} || q{} ) eq 'safe_name' } @{ $output_contract->{fields} || [] };
ok( $safe_name, 'fixture includes safefile text field' );
is( $safe_name->{safefile}, 'true', 'safefile contract is represented' );

done_testing();

sub _json_text {
    my ($path) = @_;
    my $text = read_file($path);
    $text =~ s/^\s*#.*\n//mg;
    return $text;
}
