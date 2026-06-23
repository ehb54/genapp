use strict;
use warnings;

use File::Spec;
use File::Temp qw(tempdir);
use FindBin;
use Test::More;

use lib File::Spec->catdir( $FindBin::Bin, '..', 'lib' );
use GenAppTest qw(copy_tree repo_root run_command);

my $repo_root = repo_root( File::Spec->catdir( $FindBin::Bin, '..' ) );

sub generate_language_filter {
    my (@genapp_args) = @_;
    my $temp_root = tempdir( CLEANUP => 1 );
    my $app_dir   = File::Spec->catdir( $temp_root, 'language_filter' );
    copy_tree( File::Spec->catdir( $repo_root, qw(t fixtures apps language_filter) ), $app_dir );

    my %env = ( GENAPP => $repo_root );
    my @cmd = ( File::Spec->catfile( $repo_root, qw(bin genapp) ), @genapp_args );
    my ( $status, $output, $quoted ) = run_command(
        cwd => $app_dir,
        env => \%env,
        cmd => \@cmd,
    );

    return {
        app_dir => $app_dir,
        output  => $output,
        quoted  => $quoted,
        status  => $status,
    };
}

my $all_targets = generate_language_filter();
is( $all_targets->{status}, 0, 'default generation succeeds for all directives languages' )
    or diag("command failed ($all_targets->{status}): $all_targets->{quoted}\n$all_targets->{output}");
ok( -f File::Spec->catfile( $all_targets->{app_dir}, qw(output html5 index.html) ), 'default generation writes html5 index' );
ok( -f File::Spec->catfile( $all_targets->{app_dir}, qw(output ui2 index.html) ), 'default generation writes ui2 index' );

my $ui2_only = generate_language_filter( '-kl', '--language', 'ui2' );
is( $ui2_only->{status}, 0, 'short option before --language ui2 generation succeeds' )
    or diag("command failed ($ui2_only->{status}): $ui2_only->{quoted}\n$ui2_only->{output}");
ok( -f File::Spec->catfile( $ui2_only->{app_dir}, qw(output ui2 index.html) ), 'short option before --language ui2 writes ui2 index' );
ok( !-e File::Spec->catdir( $ui2_only->{app_dir}, qw(output html5) ), 'short option before --language ui2 does not write html5 output' );

my $html5_only = generate_language_filter( '--language=html5' );
is( $html5_only->{status}, 0, '--language=html5 generation succeeds' )
    or diag("command failed ($html5_only->{status}): $html5_only->{quoted}\n$html5_only->{output}");
ok( -f File::Spec->catfile( $html5_only->{app_dir}, qw(output html5 index.html) ), '--language=html5 writes html5 index' );
ok( !-e File::Spec->catdir( $html5_only->{app_dir}, qw(output ui2) ), '--language=html5 does not write ui2 output' );

my $unknown_language = generate_language_filter( '--languages', 'bogus' );
isnt( $unknown_language->{status}, 0, 'unknown requested language fails generation' );
like( $unknown_language->{output}, qr/requested language 'bogus' is not listed in directives\.json languages/, 'unknown requested language reports directives mismatch' );

done_testing();
