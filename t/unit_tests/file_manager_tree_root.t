use strict;
use warnings;

use File::Path qw(make_path);
use File::Spec;
use File::Temp qw(tempdir tempfile);
use FindBin;
use JSON::PP qw(decode_json);
use MIME::Base64 qw(encode_base64);
use Test::More;

use lib File::Spec->catdir( $FindBin::Bin, '..', 'lib' );
use GenAppTest qw(php_executable read_file repo_root run_command);

# The File Manager's tree and the chooser of files on the server (sys_files.php, _spec=fc_cache): the pages ask for the
# top of the user's directory with the root's id "#" appended to the url, where it starts the fragment, so the request
# arrives with _spec_dir empty and sys_files.php lists base64 ".". The listed entries must have the tree's root "#" for
# their parent, as php7designer gave them, or the tree shows nothing ("Loading ..."). A folder below has its own id
# (base64 of "./<name>", as the top's listing gives it) for its entries' parent.

my $php = php_executable();
plan skip_all => 'php is not available on PATH; File Manager tree checks are deferred' if !$php;

my $repo = repo_root( File::Spec->catdir( $FindBin::Bin, '..' ) );
my $source = read_file( File::Spec->catfile( $repo, qw(languages html5 sys sys_files.php) ) );

my ($relative_path) = $source =~ /(^function ga_file_manager_relative_path\(.*?^\})/ms;
my ($get_directory) = $source =~ /(^function getDirectory\(.*?^\})/ms;
ok( defined $relative_path, 'sys_files.php has ga_file_manager_relative_path' );
ok( defined $get_directory, 'sys_files.php has getDirectory' );
like( $source, qr/\$is_spec_fc_dir = base64_encode\( "\." \);/,
    'an empty _spec_dir (the root\'s "#" lost as the url\'s fragment) is listed as base64 "."' );

my ( $helper_fh, $helper ) = tempfile( SUFFIX => '.php', UNLINK => 1 );
print {$helper_fh} "<?php\n\$result_dirs = []; \$refd_dirs = []; \$pos_dirs = []; \$pattern = ''; \$no_pattern = true;\n" .
    ( $relative_path // '' ) . "\n" . ( $get_directory // '' ) . "\n";
close $helper_fh;

my $root = tempdir( CLEANUP => 1 );
make_path( File::Spec->catdir( $root, qw(proj_a run1) ), File::Spec->catdir( $root, 'proj_b' ) );
for my $file ( [ 'notes.txt' ], [ qw(proj_a input.dat) ] ) {
    open my $fh, '>', File::Spec->catfile( $root, @{$file} ) or die "write: $!";
    print {$fh} "x\n";
    close $fh;
}

sub listing {
    my ($asked) = @_;
    my ( $status, $output ) = run_command(
        cwd => $root,
        cmd => [ $php, '-d', 'display_errors=stderr', '-r',
                 'require $argv[1]; getDirectory( $argv[2] ); echo json_encode( $GLOBALS[ "result_dirs" ] );',
                 $helper, $asked ],
    );
    is( $status, 0, "getDirectory runs for '$asked'" ) or diag($output);
    return eval { decode_json($output) } || [];
}

sub parents { my %p = map { $_->{parent} => 1 } @{ $_[0] }; return [ sort keys %p ]; }

my $top = listing( encode_base64( '.', '' ) );
is( scalar @{$top}, 3, 'the top of the user\'s directory: its two folders and its file' );
is_deeply( parents($top), ['#'], 'asked for as base64 "." (an empty _spec_dir): every entry\'s parent is the root "#"' );
is_deeply( parents( listing('#') ), ['#'], 'asked for as "#": the root "#"' );
is_deeply( parents( listing( encode_base64( './', '' ) ) ), ['#'], 'asked for as base64 "./": the root "#"' );

my ($proj_a) = grep { $_->{text} =~ m{<b>proj_a</b>} } @{$top};
ok( $proj_a && $proj_a->{children}, 'proj_a is listed at the top as a folder with children' );
my $inside = listing( $proj_a ? $proj_a->{id} : 'none' );
is( scalar @{$inside}, 2, 'proj_a\'s listing: its folder and its file' );
is_deeply( parents($inside), [ $proj_a ? $proj_a->{id} : 'none' ],
    'a folder below the top: its entries\' parent is that folder\'s id, as the top\'s listing gave it' );

done_testing();
