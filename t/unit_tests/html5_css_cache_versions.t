use strict;
use warnings;

use File::Spec;
use File::Temp qw(tempdir);
use FindBin;
use Test::More;

use lib File::Spec->catdir( $FindBin::Bin, '..', 'lib' );
use GenAppTest qw(copy_tree generate_fixture_app read_file repo_root run_command);

# The generated index.html links the stylesheets that GenApp generates with the generation's version (?v=), as it links
# js/genapp.js, so a browser fetches them again after each generation instead of keeping a cached copy: the ga.css of
# an earlier GenApp (which, for example, linked jstree's css by itself) leaves the File Manager's tree unstyled.

my $repo = repo_root( File::Spec->catdir( $FindBin::Bin, '..' ) );
my $header = read_file( File::Spec->catfile( $repo, qw(languages html5 base_header.html) ) );
for my $css ( 'css/ga.css', 'css/ga-std.css', 'scss/ga-bootstrap-__bootstrap:package__.css',
              'scss/ga-bootstrap-__bootstrap:package__-__bootstrap:theme__.css', 'css/dd.css' ) {
    like( $header, qr/href="\Q$css\E\?v=__datetimeinseconds__"/, "base_header.html links $css with the generation's version" );
}

sub stylesheets_and_version {
    my ( $app_dir, $label ) = @_;
    my $index = read_file( File::Spec->catfile( $app_dir, qw(output html5 index.html) ) );
    my ($version) = $index =~ m{src="js/genapp\.js\?v=(\d+)"};
    ok( defined $version, "$label: js/genapp.js has the generation's version" );
    unlike( $index, qr/__datetimeinseconds__/, "$label: the version token is replaced everywhere" );
    my @links = $index =~ m{<link rel="stylesheet" href="((?:css/ga|css/dd|scss/ga-bootstrap)[^"]*)"}g;
    return ( $version // 'none', @links );
}

my $generated = generate_fixture_app( repo_root => $repo, fixture_name => 'minimal_html5', test_dir => $FindBin::Bin );
is( $generated->{status}, 0, 'minimal_html5 generates' ) or diag( $generated->{output} );
my ( $version, @links ) = stylesheets_and_version( $generated->{app_dir}, 'minimal_html5' );
ok( ( grep { $_ eq "css/ga.css?v=$version" } @links ), "minimal_html5: css/ga.css?v=$version (the version of js/genapp.js)" )
    or diag( join "\n", @links );
is_deeply( [ grep { !/\?v=\Q$version\E$/ } @links ], [], 'minimal_html5: every stylesheet GenApp generates has that version' );

# the same application with a bootstrap theme (the scss stylesheets, inside conditional template blocks)
my $themed = File::Spec->catdir( tempdir( CLEANUP => 1 ), 'minimal_html5' );
copy_tree( $generated->{fixture_root}, $themed );
my $directives = File::Spec->catfile( $themed, 'directives.json' );
( my $text = read_file($directives) ) =~ s/^\{/{\n    "bootstrap"   : { "package" : "bootswatch", "theme" : "solar" },/m;
open my $fh, '>', $directives or die "write: $!";
print {$fh} $text;
close $fh;
my $ga_min = File::Spec->catfile( $repo, qw(languages html5 add js ga.min.js) );
my $ga_min_before = -f $ga_min ? read_file($ga_min) : undef;
my ( $status, $output ) = run_command( cwd => $themed, env => { GENAPP => $repo },
                                       cmd => [ File::Spec->catfile( $repo, 'bin', 'genapp' ) ] );
if ( defined $ga_min_before && read_file($ga_min) ne $ga_min_before ) {
    open my $gfh, '>', $ga_min or die "restore: $!";
    print {$gfh} $ga_min_before;
    close $gfh;
}
is( $status, 0, 'minimal_html5 with a bootstrap theme generates' ) or diag($output);
( $version, @links ) = stylesheets_and_version( $themed, 'with a bootstrap theme' );
ok( ( grep { $_ eq "scss/ga-bootstrap-bootswatch-solar.css?v=$version" } @links ),
    "with a bootstrap theme: scss/ga-bootstrap-bootswatch-solar.css?v=$version" ) or diag( join "\n", @links );
is_deeply( [ grep { !/\?v=\Q$version\E$/ } @links ], [], 'with a bootstrap theme: every stylesheet GenApp generates has that version' );

done_testing();
