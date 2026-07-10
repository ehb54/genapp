use strict;
use warnings;

use Digest::SHA qw(sha1_hex);
use File::Spec;
use FindBin;
use Test::More;

use lib File::Spec->catdir( $FindBin::Bin, 'lib' );
use GenAppTest qw(generate_fixture_app read_file repo_root);

my $repo_root = repo_root($FindBin::Bin);
my $ga_min    = File::Spec->catfile( $repo_root, 'languages', 'html5', 'add', 'js', 'ga.min.js' );
my $before    = -f $ga_min ? read_file($ga_min) : undef;

my $generated = generate_fixture_app(
    repo_root    => $repo_root,
    fixture_name => 'minimal_html5',
    test_dir     => $FindBin::Bin,
    genapp_args  => ['-kl'],
);

is( $generated->{status}, 0, 'minimal_html5 fixture generates html5 output' )
    or diag("command failed ($generated->{status}): $generated->{quoted}\n$generated->{output}");

my $app_dir = $generated->{app_dir};

my @expected = (
    [ 'index.html',              [qw(output html5 index.html)] ],
    [ 'module html',             [qw(output html5 ajax demo echo.html)] ],
    [ 'module php',              [qw(output html5 ajax demo echo.php)] ],
    [ 'assembled ga.js',         [qw(output html5 js ga.js)] ],
    [ 'generated dependency JS', [qw(output html5 js genapp.js)] ],
);

for my $check (@expected) {
    ok( -f File::Spec->catfile( $app_dir, @{ $check->[1] } ), "$check->[0] was generated" );
}

my $ga_js = read_file( File::Spec->catfile( $app_dir, qw(output html5 js ga.js) ) );
my @ordered_markers = (
    'var ga = {};',
    'ga.colors = function',
    'ga.valid = {};',
    'ga.value = {};',
    'ga.repeat               = {};',
    'ga.data = {};',
    'ga.layout = {};',
    'ga.util = {};',
);

my $last_pos = -1;
for my $marker (@ordered_markers) {
    my $pos = index( $ga_js, $marker );
    ok( $pos > $last_pos, "ga.js contains '$marker' after prior marker" );
    $last_pos = $pos;
}

my $module_html = read_file( File::Spec->catfile( $app_dir, qw(output html5 ajax demo echo.html) ) );
like( $module_html, qr/ga\.layout\.process/,       'module html uses layout runtime' );
like( $module_html, qr/ga\.valid\.checkText/,      'module html wires text validation' );
like( $module_html, qr/ga\.value\.registerid/,     'module html registers input values' );
TODO: {
    local $TODO = 'current HTML5 templates leave optional help placeholders in generated module HTML';
    unlike( $module_html, qr/__~?[A-Za-z0-9:_-]+(?:__|\{)/, 'module html has no unresolved GenApp replacement tokens' );
}

my $project_name_message = 'Project names may contain only letters, numbers, and underscores. Dashes are not allowed; use an underscore instead.';
my $sys_user_config_html = read_file( File::Spec->catfile( $app_dir, qw(output html5 etc sys_user_config.html) ) );
like(
    $sys_user_config_html,
    qr/data-pattern-message="\Q$project_name_message\E"/,
    'sys_user_config project name input carries explicit pattern guidance'
);

my $module_php = read_file( File::Spec->catfile( $app_dir, qw(output html5 ajax demo echo.php) ) );
my $job_event_cache = File::Spec->catfile( $app_dir, qw(output html5 util job-event-cache.php) );
ok( -f $job_event_cache, 'bounded job-event replay helper was generated' );
like( $module_php, qr/\$modjson = json_decode/,     'module php embeds module json decode' );
like( $module_php, qr/\$_REQUEST\[ '_module' \]/,   'module php records module request metadata' );
unlike( $module_php, qr/__modulejson__|__menu:modules:id__|__application__/, 'module php has key substitutions applied' );

if ( defined $before ) {
    my $after = read_file($ga_min);
    if ( sha1_hex($after) ne sha1_hex($before) ) {
        open my $fh, '>', $ga_min or die "restore '$ga_min' failed: $!";
        print {$fh} $before;
        close $fh;
        fail('html5 generation changed languages/html5/add/js/ga.min.js; restored original content');
    } else {
        pass('html5 generation left languages/html5/add/js/ga.min.js content unchanged');
    }
}

done_testing();
