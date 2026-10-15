use strict;
use warnings;

use File::Spec;
use File::Temp qw(tempdir);
use File::Path qw(make_path);
use JSON;
use FindBin;
use Test::More;

use lib File::Spec->catdir( $FindBin::Bin, '..', 'lib' );
use GenAppTest qw(copy_tree read_file repo_root run_command);

my $repo_root = repo_root( File::Spec->catdir( $FindBin::Bin, '..' ) );

sub generate_language_filter {
    my (@genapp_args) = @_;
    my $options = ref($genapp_args[0]) eq 'HASH' ? shift @genapp_args : {};
    my $temp_root = tempdir( CLEANUP => 1 );
    my $app_dir   = File::Spec->catdir( $temp_root, 'language_filter' );
    copy_tree( File::Spec->catdir( $repo_root, qw(t fixtures apps language_filter) ), $app_dir );


    if ($options->{installed}) {
        make_path("$app_dir/ui2/add", "$app_dir/.local");
        my $manifest={schema_version=>1, installed_tracking=>1,
            application_component=>'neutral_application',generator_component=>'neutral_generator',
            components=>[
                {component_id=>'neutral_application',version=>'0.01',display_version=>'Fixture App 0.01',release_stage=>'beta'},
                {component_id=>'neutral_generator',version=>'0.1.0-beta.1',display_version=>'Fixture Generator',release_stage=>'beta'}
            ]};
        open my $fh, '>', "$app_dir/ui2/add/release-manifest.json" or die $!;
        print $fh encode_json($manifest); close $fh;
        open $fh, '>', "$app_dir/.local/build-info.json" or die $!;
        print $fh encode_json({schema_version=>1,components=>[{
            component_id=>'neutral_application',version=>'0.01',revision=>('a'x40),modified=>JSON::false
        }]}); close $fh;
        # A stale old collector file must not poison installed-tracking builds.
        open $fh, '>', "$app_dir/.local/source_revision_metadata.json" or die $!;
        print $fh 'invalid retired metadata'; close $fh;
    }

    my %env = ( GENAPP => $repo_root );
    if ($options->{fail_copy}) {
        make_path("$app_dir/fake-bin");
        open my $copy, '>', "$app_dir/fake-bin/cp" or die $!;
        print $copy "#!/bin/sh\nexit 37\n";close $copy;
        chmod 0755, "$app_dir/fake-bin/cp";
        $env{PATH}="$app_dir/fake-bin:$ENV{PATH}";
    }

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


ok( !-e "$ui2_only->{app_dir}/output/ui2/build-info.json", 'non-opted application gets no installed build receipt' );
my $installed = generate_language_filter({installed=>1}, '--language', 'ui2');
is($installed->{status},0,'neutral opted-in UI2 generation succeeds')
    or diag($installed->{output});
my $receipt_path="$installed->{app_dir}/output/ui2/build-info.json";
my $receipt=decode_json(read_file($receipt_path));
is($receipt->{components}->[0]->{revision},'a'x40,'copied application uses portable source receipt');
like($receipt->{components}->[1]->{revision},qr/^[a-f0-9]{40}$/,'generator records actual build checkout');
ok(exists $receipt->{artifacts}->{'js/app-map.js'},'receipt binds generated application map');
ok(!-e "$installed->{app_dir}/output/html5",'opted-in target generation does not write another language');
my $manifest_path="$installed->{app_dir}/output/ui2/release-manifest.json";
my $served=decode_json(read_file($manifest_path));
$served->{components}->[0]->{installed}={status=>'recorded',revision=>('c'x40),version=>'0.01'};
open my $manifest_fh,'>',$manifest_path or die $!;
print $manifest_fh encode_json($served);close $manifest_fh;
my $before_manifest=read_file($manifest_path);
my ($regenerated,$regenerated_output)=run_command(cwd=>$installed->{app_dir},env=>{GENAPP=>$repo_root},
    cmd=>["$repo_root/bin/genapp",'--language','ui2']);
is($regenerated,0,'regeneration succeeds before separately verified publication') or diag($regenerated_output);
is(read_file($manifest_path),$before_manifest,'regeneration preserves the published component stack');
my $before_receipt=read_file($receipt_path);
open my $broken,'>',"$installed->{app_dir}/modules/echo.json" or die $!;
print $broken '{broken';close $broken;
my ($failed)=run_command(cwd=>$installed->{app_dir},env=>{GENAPP=>$repo_root},cmd=>["$repo_root/bin/genapp",'--language','ui2']);
isnt($failed,0,'failed generation is returned to the caller');
is(read_file($receipt_path),$before_receipt,'failed generation cannot replace previous successful build evidence');
is(read_file($manifest_path),$before_manifest,'failed generation cannot publish a new installed stack');


my $failed_copy=generate_language_filter({installed=>1,fail_copy=>1},'--language','ui2');
isnt($failed_copy->{status},0,'failed generated asset copy is a generation failure');
ok(!-e "$failed_copy->{app_dir}/output/ui2/build-info.json",'failed asset copy cannot create a success receipt');

done_testing();
