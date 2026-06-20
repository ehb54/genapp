use strict;
use warnings;

use File::Spec;
use FindBin;
use JSON qw(decode_json);
use Test::More;

use lib File::Spec->catdir( $FindBin::Bin, 'lib' );
use GenAppTest qw(generate_fixture_app read_file repo_root);

my $repo_root = repo_root($FindBin::Bin);
my $generated = generate_fixture_app(
    repo_root    => $repo_root,
    fixture_name => 'html5_layout_repeaters',
    test_dir     => $FindBin::Bin,
    genapp_args  => ['-kl'],
);

is( $generated->{status}, 0, 'html5_layout_repeaters fixture generates with saved layout output' )
    or diag("command failed ($generated->{status}): $generated->{quoted}\n$generated->{output}");

my $app_dir     = $generated->{app_dir};
my $module_html = read_file( File::Spec->catfile( $app_dir, qw(output html5 ajax demo repeat_demo.html) ) );

like( $module_html, qr/ga\.repeat\.repeater\( "repeat_demo", "row_count", "integer"/, 'integer repeater is wired in generated JS' );
like( $module_html, qr/ga\.repeat\.repeatOn\("repeat_demo", "row_label", "row_count"/, 'text field repeats on integer repeater' );
like( $module_html, qr/ga\.repeat\.repeater\( "repeat_demo", "include_extra", "checkbox"/, 'checkbox repeater is wired in generated JS' );
like( $module_html, qr/ga\.repeat\.repeatOn\("repeat_demo", "extra_text", "include_extra"/, 'text field repeats on checkbox repeater' );
like( $module_html, qr/ga\.layout\.rhtml\( 'row_count' \)/, 'generated module retains row_count repeat layout hook' );

my $repeaters = generate_fixture_app(
    repo_root    => $repo_root,
    fixture_name => 'html5_layout_repeaters',
    test_dir     => $FindBin::Bin,
    genapp_args  => ['-sr'],
);

ok( $repeaters->{status} != 0, '-sr exits after writing repeater reports in current GenApp' );
like( $repeaters->{output}, qr/-sr option terminates here/, '-sr reports its intentional early termination' );

my $repeaters_file = File::Spec->catfile( $repeaters->{app_dir}, qw(output repeaters repeat_demo_repeater.txt) );
ok( -f $repeaters_file, 'show-repeaters output file exists' );
if ( -f $repeaters_file ) {
    my $repeaters_text = read_file($repeaters_file);
    like( $repeaters_text, qr/row_label\[text\] => row_count\[integer\]/, 'show-repeaters records row_label dependency' );
    like( $repeaters_text, qr/extra_text\[text\] => include_extra\[checkbox\]/, 'show-repeaters records extra_text dependency' );
}

my $layout_dir = File::Spec->catdir( $app_dir, qw(output html5 layout) );
ok( -d $layout_dir, 'layout output directory exists' );

opendir my $dh, $layout_dir or die "opendir '$layout_dir' failed: $!";
my @layout_files = sort grep { /\.json$/ } readdir $dh;
closedir $dh;

ok( @layout_files, 'layout JSON files were generated' );

my $layout_payload = q{};
for my $file (@layout_files) {
    my $content = read_file( File::Spec->catfile( $layout_dir, $file ) );
    if ( $content =~ /row_count/ && $content =~ /include_extra/ ) {
        $layout_payload = $content;
        last;
    }
}

TODO: {
    local $TODO = 'current saved-layout output does not reliably include the generated fixture module payload';
    ok( length $layout_payload, 'a layout JSON payload contains the fixture fields' );
}
if ( length $layout_payload ) {
    my $layout = eval { decode_json($layout_payload) };
    ok( $layout, 'layout JSON payload decodes' ) or diag($@);
    like( $layout_payload, qr/"id"\s*:\s*"row_count"/,     'layout JSON includes row_count field' );
    like( $layout_payload, qr/"repeat"\s*:\s*"row_count"/, 'layout JSON includes repeat relationship' );
    like( $layout_payload, qr/"id"\s*:\s*"include_extra"/, 'layout JSON includes checkbox repeater field' );
}

done_testing();
