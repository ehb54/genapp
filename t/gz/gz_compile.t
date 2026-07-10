use strict;
use warnings;

use File::Copy qw(copy);
use File::Find;
use File::Path qw(make_path);
use File::Spec;
use File::Temp qw(tempdir);
use FindBin;
use JSON qw(decode_json);
use Test::More;

use lib File::Spec->catdir( $FindBin::Bin, '..', 'lib' );
use GenAppTest qw(copy_tree read_file repo_root run_command);

my $repo_root = repo_root( File::Spec->catdir( $FindBin::Bin, '..' ) );
my $gz_dir    = $ENV{GENAPP_GZ_DIR}
    || File::Spec->catdir( $repo_root, '..', 'genapp_zazzie' );

if ( !-d $gz_dir ) {
    plan skip_all => 'GENAPP_GZ_DIR is not set and adjacent ../genapp_zazzie is unavailable';
}

if ( !-f File::Spec->catfile( $gz_dir, 'menu.json' ) || !-d File::Spec->catdir( $gz_dir, 'modules' ) ) {
    plan skip_all => "gz checkout '$gz_dir' does not look like a GenApp application";
}

my $directives_source = -f File::Spec->catfile( $gz_dir, 'directives.json' )
    ? File::Spec->catfile( $gz_dir, 'directives.json' )
    : File::Spec->catfile( $gz_dir, 'directives.json.docker' );

if ( !-f $directives_source ) {
    plan skip_all => "gz checkout '$gz_dir' has neither directives.json nor directives.json.docker";
}

my $stage_root = tempdir( CLEANUP => 1 );
my $directives_text = read_file($directives_source);
$directives_text =~ s/^\s*#.*\n//mg;
my $directives = decode_json($directives_text);
my $application = $directives->{application};
die "directives application must be a safe directory name\n"
    if !defined($application) || $application !~ /\A[A-Za-z0-9._-]+\z/;
my $app_dir    = File::Spec->catdir( $stage_root, $application );
make_path($app_dir);

copy( $directives_source, File::Spec->catfile( $app_dir, 'directives.json' ) )
    or die "copy directives failed: $!";
copy( File::Spec->catfile( $gz_dir, 'menu.json' ), File::Spec->catfile( $app_dir, 'menu.json' ) )
    or die "copy menu failed: $!";
copy_tree( File::Spec->catdir( $gz_dir, 'modules' ), File::Spec->catdir( $app_dir, 'modules' ) );
copy_tree( File::Spec->catdir( $gz_dir, 'add' ), File::Spec->catdir( $app_dir, 'add' ) )
    if -d File::Spec->catdir( $gz_dir, 'add' );
copy_tree( File::Spec->catdir( $gz_dir, 'pngs' ), File::Spec->catdir( $app_dir, 'pngs' ) )
    if -d File::Spec->catdir( $gz_dir, 'pngs' );

_create_executable_stubs( $app_dir );

my %env = ( GENAPP => $repo_root );

my @json_files = (
    'directives.json',
    'menu.json',
    map { File::Spec->abs2rel( $_, $app_dir ) } _top_level_module_files($app_dir),
);

my ( $json_status, $json_output, $json_cmd ) = run_command(
    cwd => $app_dir,
    env => \%env,
    cmd => [ File::Spec->catfile( $repo_root, qw(bin check_json.pl) ), @json_files ],
);
is( $json_status, 0, 'gz staged directives/menu/top-level module JSON parse' )
    or diag("command failed ($json_status): $json_cmd\n$json_output");

my ( $check_status, $check_output, $check_cmd ) = run_command(
    cwd => $app_dir,
    env => \%env,
    cmd => [ File::Spec->catfile( $repo_root, qw(bin genapp_check.pl) ) ],
);
is( $check_status, 0, 'gz staged app passes genapp_check' )
    or diag("command failed ($check_status): $check_cmd\n$check_output");

my ( $gen_status, $gen_output, $gen_cmd ) = run_command(
    cwd => $app_dir,
    env => \%env,
    cmd => [ File::Spec->catfile( $repo_root, qw(bin genapp) ), '-kl' ],
);
is( $gen_status, 0, 'gz staged app generates html5 output with saved layouts' )
    or diag("command failed ($gen_status): $gen_cmd\n$gen_output");

my $html5 = File::Spec->catdir( $app_dir, qw(output html5) );
ok( -f File::Spec->catfile( $html5, 'index.html' ), 'gz generated index.html exists' );
ok( -f File::Spec->catfile( $html5, qw(ajax contrast multi_component_analysis.html) ), 'gz generated multi_component_analysis html exists' );
ok( -f File::Spec->catfile( $html5, qw(ajax simulate sas_assembly.html) ), 'gz generated sas_assembly html exists' );
ok( -f File::Spec->catfile( $html5, qw(js ga.js) ), 'gz generated ga.js exists' );
ok( -d File::Spec->catdir( $html5, 'layout' ), 'gz saved layout directory exists' );

my ( $sr_status, $sr_output, $sr_cmd ) = run_command(
    cwd => $app_dir,
    env => \%env,
    cmd => [ File::Spec->catfile( $repo_root, qw(bin genapp) ), '-sr' ],
);
ok( $sr_status != 0, 'gz -sr exits after writing repeater reports in current GenApp' );
like( $sr_output, qr/-sr option terminates here/, 'gz -sr reports intentional early termination' )
    or diag("command output ($sr_cmd):\n$sr_output");

my $mca_report = File::Spec->catfile( $app_dir, qw(output repeaters multi_component_analysis_repeater.txt) );
ok( -f $mca_report, 'gz multi_component_analysis repeater report exists' );
if ( -f $mca_report ) {
    my $report = read_file($mca_report);
    like( $report, qr/integerpair|mpair/i, 'gz repeater report captures integer-pair style repeaters' );
}

done_testing();

sub _top_level_module_files {
    my ($app_dir) = @_;
    my $module_dir = File::Spec->catdir( $app_dir, 'modules' );
    opendir my $dh, $module_dir or die "opendir '$module_dir' failed: $!";
    my @files = map { File::Spec->catfile( $module_dir, $_ ) }
        grep { /\.json$/ && -f File::Spec->catfile( $module_dir, $_ ) } readdir $dh;
    closedir $dh;
    return sort @files;
}

sub _create_executable_stubs {
    my ($app_dir) = @_;
    my $bin_dir = File::Spec->catdir( $app_dir, 'bin' );
    make_path($bin_dir);

    my %executables;
    for my $module_file ( _top_level_module_files($app_dir) ) {
        my $text = read_file($module_file);
        $text =~ s/^\s*#.*\n//mg;
        my $json = eval { decode_json($text) };
        next if !$json || !$json->{executable};
        $executables{ $json->{executable} } = 1;
    }

    for my $exe ( sort keys %executables ) {
        next if $exe =~ m{\A/};
        my $path = File::Spec->catfile( $bin_dir, $exe );
        my ( $vol, $dir ) = File::Spec->splitpath($path);
        make_path( File::Spec->catpath( $vol, $dir, q{} ) );
        open my $fh, '>', $path or die "open '$path' failed: $!";
        print {$fh} "#!/usr/bin/env perl\nprint qq({}\\n);\n";
        close $fh;
        chmod 0755, $path;
    }
}
