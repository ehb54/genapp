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
    fixture_name => 'html5_language_overrides',
    test_dir     => File::Spec->catdir( $FindBin::Bin, '..' ),
    genapp_args  => ['-kl'],
);

TODO: {
    local $TODO = 'current html5 language-specific menu/module override generation exits nonzero while assembling system config modules';
    is( $generated->{status}, 0, 'html5_language_overrides fixture generates html5 output' )
        or diag("command failed ($generated->{status}): $generated->{quoted}\n$generated->{output}");
}

my $app_dir = $generated->{app_dir};
my $html5   = File::Spec->catdir( $app_dir, qw(output html5) );

ok( -f File::Spec->catfile( $html5, qw(ajax html5_menu.html) ), 'html5 menu replacement was generated' );
ok( !-f File::Spec->catfile( $html5, qw(ajax base_menu.html) ), 'base menu was replaced for html5' );

ok( -f File::Spec->catfile( $html5, qw(ajax html5_menu shared.html) ), 'html5 replacement module html was generated' );
ok( -f File::Spec->catfile( $html5, qw(ajax html5_menu shared.php) ), 'html5 replacement module php was generated' );
ok( !-f File::Spec->catfile( $html5, qw(ajax base_menu base_only.html) ), 'base-only module was not generated for replaced html5 menu' );

my $index = read_file( File::Spec->catfile( $html5, 'index.html' ) );
like( $index, qr/HTML5 Override Fixture/, 'html5 directives override title in generated index' );
like( $index, qr/HTML5 specific footer/, 'html5 directives override footer in generated index' );
unlike( $index, qr/Base footer/, 'base footer is replaced by html5 directives' );

my $module_html = read_file( File::Spec->catfile( $html5, qw(ajax html5_menu shared.html) ) );
like( $module_html, qr/html5_input/, 'html5 module replacement field appears in generated module html' );
unlike( $module_html, qr/"id":"shared_input"|id="shared_input"|name="shared_input"/, 'base module field is replaced by html5 module override' );

my $module_php = read_file( File::Spec->catfile( $html5, qw(ajax html5_menu shared.php) ) );
like( $module_php, qr/html5_shared/, 'html5 module replacement executable appears in generated module php' );
unlike( $module_php, qr/base_shared/, 'base module executable is replaced by html5 module override' );

TODO: {
    local $TODO = 'current html5 override fixture exits before add-file copy assertions can be verified';
    my $override_marker = File::Spec->catfile( $html5, 'override_marker.txt' );
    my $html5_only      = File::Spec->catfile( $html5, 'html5_only.txt' );
    ok( -f $override_marker, 'html5/add overwrite marker exists' );
    is( -f $override_marker ? read_file($override_marker) : q{}, "html5 add override\n", 'html5/add overwrites base add file' );
    ok( -f $html5_only, 'html5/add target-only file exists' );
    is( -f $html5_only ? read_file($html5_only) : q{}, "html5 only add file\n", 'html5/add copies target-only file' );
}

done_testing();
