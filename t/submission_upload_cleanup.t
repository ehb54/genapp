use strict;
use warnings;

use File::Path qw(make_path);
use File::Spec;
use File::Temp qw(tempdir);
use FindBin;
use JSON::PP qw(decode_json encode_json);
use Test::More;

use lib File::Spec->catdir( $FindBin::Bin, 'lib' );
use GenAppTest qw(read_file repo_root run_command);

my $repo_root = repo_root($FindBin::Bin);
my $helper = File::Spec->catfile(
    $repo_root, qw(languages html5 util submission-upload-cleanup.php) );
my $source = read_file($helper);

like( $source, qr/function ga_submission_upload_destination/, 'collision-safe destination helper is defined' );
like( $source, qr/function ga_record_submission_upload/, 'submission ownership recorder is defined' );
like( $source, qr/function ga_cleanup_input_validation_uploads/, 'failure-class dispatcher is defined' );

my $php = find_executable('php');
SKIP: {
    skip 'php is not available on PATH; cleanup execution checks are deferred', 25 if !$php;

    my $temp = tempdir( CLEANUP => 1 );
    my $project = File::Spec->catdir( $temp, 'project' );
    my $log = File::Spec->catdir( $project, 'log' );
    make_path($log);
    my $existing = File::Spec->catfile( $project, 'input.dat' );
    my $upload = File::Spec->catfile( $project, 'input-1.dat' );
    my $server_selected = File::Spec->catfile( $project, 'selected.dat' );
    write_text( $existing, 'existing' );
    write_text( $upload, 'new upload' );
    write_text( $server_selected, 'selected' );

    my $destination = php_call(
        $php, $helper,
        'echo json_encode(ga_submission_upload_destination($argv[2], $argv[3]));',
        $project, 'input.dat',
    );
    is( decode_json($destination), $upload, 'an existing destination receives a collision-safe suffix' );

    my $recorded = php_call(
        $php, $helper,
        'echo json_encode(ga_record_submission_upload($argv[2], $argv[3], $argv[4], $argv[5], $argv[6]));',
        $log, 'job-1', 'data_file', $upload, $project,
    );
    is( decode_json($recorded), 1, 'new upload ownership is recorded' );

    my $runtime_result = php_call(
        $php, $helper,
        'echo json_encode(ga_cleanup_input_validation_uploads($argv[2], $argv[3], $argv[4], $argv[5]));',
        encode_json({ error => 'backend failed' }), $log, 'job-1', $project,
    );
    is( decode_json($runtime_result), 0, 'ordinary runtime failure does not request cleanup' );
    ok( -f $upload, 'runtime failure preserves the upload' );

    my $cleanup = decode_json(php_call(
        $php, $helper,
        'echo json_encode(ga_cleanup_input_validation_uploads($argv[2], $argv[3], $argv[4], $argv[5]));',
        encode_json({ error => 'invalid', _failure_class => 'input_validation' }),
        $log, 'job-1', $project,
    ));
    is( scalar @{ $cleanup->{removed} }, 1, 'validation failure removes the one owned upload' );
    ok( !-e $upload, 'owned upload is gone' );
    ok( -f $existing, 'pre-existing collision target is preserved' );
    ok( -f $server_selected, 'unrecorded server-selected file is preserved' );

    my $again = decode_json(php_call(
        $php, $helper,
        'echo json_encode(ga_cleanup_input_validation_uploads($argv[2], $argv[3], $argv[4], $argv[5]));',
        encode_json({ _failure_class => 'input_validation' }),
        $log, 'job-1', $project,
    ));
    is( scalar @{ $again->{removed} }, 0, 'cleanup is idempotent' );

    my $replaced = File::Spec->catfile( $project, 'replaced.dat' );
    write_text( $replaced, 'first' );
    is( decode_json(php_call(
        $php, $helper,
        'echo json_encode(ga_record_submission_upload($argv[2], $argv[3], $argv[4], $argv[5], $argv[6]));',
        $log, 'job-2', 'data_file', $replaced, $project,
    )), 1, 'replacement scenario ownership is recorded' );
    unlink $replaced or die "unlink '$replaced' failed: $!";
    write_text( $replaced, 'second file with different identity' );
    my $replacement_cleanup = decode_json(php_call(
        $php, $helper,
        'echo json_encode(ga_cleanup_input_validation_uploads($argv[2], $argv[3], $argv[4], $argv[5]));',
        encode_json({ _failure_class => 'input_validation' }),
        $log, 'job-2', $project,
    ));
    ok( -f $replaced, 'a replaced path is preserved' );
    is( scalar @{ $replacement_cleanup->{refused} }, 1, 'identity mismatch is reported as refused' );

    my $outside = File::Spec->catfile( $temp, 'outside.dat' );
    write_text( $outside, 'outside' );
    is( decode_json(php_call(
        $php, $helper,
        'echo json_encode(ga_record_submission_upload($argv[2], $argv[3], $argv[4], $argv[5], $argv[6]));',
        $log, 'job-3', 'data_file', $outside, $project,
    )), 0, 'ownership recorder rejects a path outside the project' );
    ok( -f $outside, 'outside file remains untouched' );

    my $target = File::Spec->catfile( $project, 'target.dat' );
    my $link = File::Spec->catfile( $project, 'link.dat' );
    write_text( $target, 'target' );
    symlink $target, $link or die "symlink '$link' failed: $!";
    is( decode_json(php_call(
        $php, $helper,
        'echo json_encode(ga_record_submission_upload($argv[2], $argv[3], $argv[4], $argv[5], $argv[6]));',
        $log, 'job-4', 'data_file', $link, $project,
    )), 0, 'ownership recorder rejects a symlink' );
    ok( -l $link && -f $target, 'symlink and target remain untouched' );
}

done_testing();

sub php_call {
    my ( $php, $helper, $code, @arguments ) = @_;
    my ( $status, $output ) = run_command(
        cwd => $repo_root,
        cmd => [ $php, '-r', 'require $argv[1]; ' . $code, $helper, @arguments ],
    );
    is( $status, 0, 'PHP cleanup helper call succeeds' ) or diag($output);
    return $output;
}

sub write_text {
    my ( $path, $text ) = @_;
    open my $handle, '>', $path or die "open '$path' failed: $!";
    print {$handle} $text;
    close $handle or die "close '$path' failed: $!";
}

sub find_executable {
    my ($name) = @_;
    for my $directory ( split /:/, $ENV{PATH} || q{} ) {
        my $path = File::Spec->catfile( $directory, $name );
        return $path if -x $path;
    }
    return;
}
