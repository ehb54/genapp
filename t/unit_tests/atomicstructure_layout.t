use strict;
use warnings;

use File::Spec;
use FindBin;
use Test::More;

use lib File::Spec->catdir( $FindBin::Bin, '..', 'lib' );
use GenAppTest qw(generate_fixture_app read_file repo_root);

# atomicstructure output fields take the label options of the other output types (plotly, html, text, textarea):
# the ga-g-<module>-<field> class, which hoverhighlight highlights on hover, and the margins labelmargin and
# labelmargintop. The viewer keeps its markup and has no ga-g- class, so turning a structure with the mouse does not
# highlight its label. A label without these options renders as before apart from the class and an empty style;
# help_link stays on it. The bootswatch theme somoaf is in add/scss with the other bootswatch themes, for
# "bootstrap" : { "package" : "bootswatch", "theme" : "somoaf" }.

my $repo_root = repo_root( File::Spec->catdir( $FindBin::Bin, '..' ) );
my $generated = generate_fixture_app(
    repo_root    => $repo_root,
    fixture_name => 'atomicstructure_layout',
    test_dir     => File::Spec->catdir( $FindBin::Bin, '..' ),
    genapp_args  => ['-kl'],
);

is( $generated->{status}, 0, 'atomicstructure_layout fixture generates html5 output' )
    or diag("command failed ($generated->{status}): $generated->{quoted}\n$generated->{output}");

my $html5 = File::Spec->catdir( $generated->{app_dir}, qw(output html5) );
my $html  = read_file( File::Spec->catfile( $html5, qw(ajax structures viewer.html) ) );

# the first string of a field's label (lhtml) or viewer (dhtml) markup
sub markup {
    my ( $id, $part ) = @_;
    return $html =~ /ga\.layout\.fields\[ "\Q$id\E" \]\.\Q$part\E =\s*'([^']*)'/ ? $1 : undef;
}

is( markup( 'plain', 'lhtml' ), '<label for="plain" class="ga-g-viewer-plain" style="">Plain </label>',
    'a label without options has the layout class only' );
is( markup( 'plain', 'dhtml' ), '<div id="plain" type="atomicstructure" ></div>', 'the viewer markup is unchanged' );
is( markup( 'spaced', 'lhtml' ),
    '<label for="spaced" class="ga-g-viewer-spaced help_link" style="margin:0 1rem;margin-top:0.5rem;">Spaced </label>',
    'labelmargin and labelmargintop set the label margins, help_link stays on the label' );
is( markup( 'spaced', 'dhtml' ), '<div id="spaced" type="atomicstructure"  class="help_link"></div>',
    'the viewer keeps its help_link' );
like( $html, qr/<span class="help">Spaced structure help<\/span>/, 'the help text is generated' );
for my $id (qw(plain spaced)) {
    like( $html,
        qr/\$\("\.ga-g-viewer-\Q$id\E"\)\.hover\(function\(\)\{\$\("\.ga-g-viewer-\Q$id\E"\)\.toggleClass\("ga-highlight"\)\}\);/,
        "hoverhighlight highlights the $id label" );
}
like( $html, qr/_jmol_info\[ "spaced" \]/, 'the viewer still initializes its JSmol metadata' );

my $index = read_file( File::Spec->catfile( $html5, 'index.html' ) );
like( $index, qr{<link rel="stylesheet" href="scss/ga-bootstrap-bootswatch-somoaf\.css">}, 'the index links the somoaf theme' );
my $theme = File::Spec->catfile( $html5, qw(scss ga-bootstrap-bootswatch-somoaf.css) );
ok( -f $theme, 'the somoaf theme is copied into the application' );
is( -f $theme ? read_file($theme) : undef,
    read_file( File::Spec->catfile( $repo_root, qw(languages html5 add scss ga-bootstrap-bootswatch-somoaf.css) ) ),
    'the copy is the theme in add/scss' );

done_testing;
