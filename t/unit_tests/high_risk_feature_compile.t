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
    genapp_args  => ['-kl'],
);

is( $generated->{status}, 0, 'unit_high_risk_features fixture generates html5 output' )
    or diag("command failed ($generated->{status}): $generated->{quoted}\n$generated->{output}");

my $app_dir = $generated->{app_dir};

for my $module (qw(repeater_contract output_contract transport_contract)) {
    ok( -f File::Spec->catfile( $app_dir, 'output', 'html5', 'ajax', 'contracts', "$module.html" )
            || -f File::Spec->catfile( $app_dir, 'output', 'html5', 'ajax', 'transport_fixtures', "$module.html" ),
        "$module module html was generated"
    );
}

my $repeater_html = read_file( File::Spec->catfile( $app_dir, qw(output html5 ajax contracts repeater_contract.html) ) );
like( $repeater_html, qr/ga\.repeat\.repeater\( "repeater_contract", "analysis_mode", "listbox"/, 'listbox repeater is wired' );
like( $repeater_html, qr/ga\.repeat\.repeater\( "repeater_contract", "advanced_count", "integer"/, 'integer repeater is wired' );
like( $repeater_html, qr/ga\.repeat\.repeater\( "repeater_contract", "pair_grid", "integerpair"/, 'integerpair repeater is wired' );
like( $repeater_html, qr/ga\.repeat\.repeatOn\("repeater_contract", "advanced_count", "analysis_mode:advanced"/, 'option-qualified repeat is wired' );
like( $repeater_html, qr/ga\.repeat\.repeatOn\("repeater_contract", "nested_gate", "advanced_count"/, 'nested repeater parent is wired' );
like( $repeater_html, qr/ga\.repeat\.repeatOn\("repeater_contract", "nested_value", "nested_gate"/, 'nested repeated child is wired' );
like( $repeater_html, qr/ga\.repeat\.repeatOn\("repeater_contract", "pair_payload", "pair_grid"/, 'integerpair repeated child is wired' );

my $output_html = read_file( File::Spec->catfile( $app_dir, qw(output html5 ajax contracts output_contract.html) ) );
my $genapp_js   = read_file( File::Spec->catfile( $app_dir, qw(output html5 js genapp.js) ) );
like( $output_html, qr/data-type="rpath"/, 'rpath input emits server path selector' );
like( $output_html, qr/ga\.altfile\.button\("output_contract","server_path","Server Path","rpath"/, 'rpath input wires altfile handler' );
like( $output_html, qr/ga\.valid\.safeFile\( "#safe_name" \)/, 'safefile text input wires safe path validation' );
like( $output_html, qr/<input type="file" name="local_upload" multiple id="local_upload"/, 'file input supports multiple local files' );
like( $output_html, qr/<div name="plot_main".*type="plotly"/s, 'plotly output div is generated' );
like( $output_html, qr/_jmol_info\[ "structure_view" \]/, 'atomicstructure output initializes JSmol metadata' );
like( $output_html, qr/<div id="result_image" type="image"[^>]*data-width="320"[^>]*data-height="240"/, 'image output includes dimensions' );
like( $output_html, qr/type="filelinkm"/, 'file output supports multiple download links' );
like( $output_html, qr/<progress name="progress_output" id="progress_output" value="0" max="1\.0"/, 'progress output is generated' );
like( $output_html, qr/\$\( "#html_report" \)\.attr\( "type", "div" \)/, 'html output sets div type handler' );
like( $output_html, qr/<textarea name="log_text" id="log_text" rows="8" cols="60" readonly/s, 'textarea output is generated' );
like( $output_html, qr/_append:output_contract_log_text/, 'textarea append behavior is wired' );
like( $output_html, qr/id="dynamic_html" type="dynamicoutput" data-dynamic-type="html"/, 'dynamic html output group is generated' );
like( $output_html, qr/id="dynamic_plot" type="dynamicoutput" data-dynamic-type="plotly"/, 'dynamic plotly output group is generated' );
like( $output_html, qr/ga\.layout\.fields\[ "dynamic_html" \]\.eval\s*=.*ga\.dynamicOutput\.register\( "output_contract", \{.*id: "dynamic_html".*type: "html".*idprefix: "dyn_html".*max: parseInt\( "3"/s, 'dynamic html output registers trusted metadata' );
like( $output_html, qr/ga\.layout\.fields\[ "dynamic_plot" \]\.eval\s*=.*ga\.dynamicOutput\.register\( "output_contract", \{.*id: "dynamic_plot".*type: "plotly".*idprefix: "dyn_plot".*max: parseInt\( "2"/s, 'dynamic plotly output registers trusted metadata' );
for my $dynamic_check (
    [ dynamic_image     => 'image' ],
    [ dynamic_video     => 'video' ],
    [ dynamic_files     => 'file' ],
    [ dynamic_textarea  => 'textarea' ],
    [ dynamic_number    => 'float' ],
    [ dynamic_progress  => 'progress' ],
    [ dynamic_plot2d    => 'plot2d' ],
    [ dynamic_bokeh     => 'bokeh' ],
    [ dynamic_matplotlib => 'matplotlib' ],
    [ dynamic_plot3d    => 'plot3d' ],
    [ dynamic_ngl       => 'ngl' ],
    [ dynamic_structure => 'atomicstructure' ],
) {
    my ( $id, $type ) = @{$dynamic_check};
    like( $output_html, qr/id="\Q$id\E" type="dynamicoutput" data-dynamic-type="\Q$type\E"/, "$id dynamic output group is generated" );
    like( $output_html, qr/ga\.layout\.fields\[ "\Q$id\E" \]\.eval\s*=.*ga\.dynamicOutput\.register\( "output_contract", \{.*id: "\Q$id\E".*type: "\Q$type\E"/s, "$id dynamic output registers trusted metadata" );
}
unlike( $output_html, qr/id="dyn_html_1"|id="dyn_plot_1"/, 'dynamic output instances are not generated statically' );
unlike( $output_html, qr/ga\.value\.registerid\("output_contract","plot_main"/, 'output-only plot field does not receive input registration' );
unlike( $output_html, qr/ga\.value\.setLastValue\( "output_contract_output", "#safe_name"/, 'input-only text field does not receive output last-value wiring' );
unlike( $output_html, qr/__moduleid__|__fields:id__|__fields:type__/, 'output module html has key template tokens replaced' );
like( $genapp_js, qr/ga\.dynamicOutput\.register = function/, 'generated app bundle includes dynamic output runtime' );
like( $genapp_js, qr/case "dynamicoutput" :\s+ga\.dynamicOutput\.update/s, 'generated app bundle routes dynamic output updates' );

my $transport_html = read_file( File::Spec->catfile( $app_dir, qw(output html5 ajax transport_fixtures transport_contract.html) ) );
like( $transport_html, qr/<textarea name="stream_log" id="stream_log"/, 'transport fixture has streaming textarea output' );
like( $transport_html, qr/<progress name="stream_progress" id="stream_progress" value="0" max="1\.0"/, 'transport fixture has progress output' );
like( $transport_html, qr/<div name="plotbar".*type="plotly"/s, 'transport fixture has plotbar output' );
like( $transport_html, qr/<div name="plotline".*type="plotly"/s, 'transport fixture has plotline output' );

my @transport_files = (
    [ 'UDP server template',     [qw(output html5 util msg-udpserver.php)] ],
    [ 'TCP server template',     [qw(output html5 util msg-tcpserver.go)] ],
    [ 'UDP pid registration',    [qw(output html5 util ga_regpid_udp.pl)] ],
    [ 'GenApp PHP transport API', [qw(output html5 php genapp.php)] ],
    [ 'request filter types',    [qw(output html5 ajax ga_filter_type.json)] ],
);
for my $check (@transport_files) {
    ok( -f File::Spec->catfile( $app_dir, @{ $check->[1] } ), "$check->[0] was generated" );
}

my $genapp_php = read_file( File::Spec->catfile( $app_dir, qw(output html5 php genapp.php) ) );
like( $genapp_php, qr/function tcpmessage/, 'GenApp PHP helper includes TCP messaging API' );
like( $genapp_php, qr/function udpmessage/, 'GenApp PHP helper includes UDP messaging API' );
like( $genapp_php, qr/\$this->input->_tcphost/, 'TCP helper reads generated _tcphost input' );
like( $genapp_php, qr/\$this->input->_udphost/, 'UDP helper reads generated _udphost input' );

my $filter_types = read_file( File::Spec->catfile( $app_dir, qw(output html5 ajax ga_filter_type.json) ) );
for my $transport_key (qw(_tcphost _tcpport _udphost _udpport _uuid)) {
    like( $filter_types, qr/"\Q$transport_key\E"/, "request filter allows $transport_key" );
}

done_testing();
