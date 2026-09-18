use strict;
use warnings;

use File::Path qw(make_path);
use File::Spec;
use File::Temp qw(tempdir);
use FindBin;
use JSON::PP qw(decode_json encode_json);
use POSIX qw(_exit);
use Test::More;
use Time::HiRes qw(usleep);

use lib File::Spec->catdir( $FindBin::Bin, 'lib' );
use GenAppTest qw(read_file repo_root run_command);

my $repo_root = repo_root($FindBin::Bin);
my $helper = File::Spec->catfile(
    $repo_root, qw(languages html5 util submission-upload-cleanup.php) );
my $source = read_file($helper);

like( $source, qr/function ga_accept_submission_upload/, 'transactional upload helper is defined' );
like( $source, qr/function ga_publish_submission_upload/, 'atomic publication helper is defined' );
like( $source, qr/\@link\( \$staged_path, \$candidate \)/, 'publication uses no-overwrite hard-link creation' );
like( $source, qr/function ga_record_submission_upload/, 'submission ownership recorder is defined' );
like( $source, qr/function ga_cleanup_input_validation_uploads/, 'failure-class dispatcher is defined' );

my $php = find_executable('php');
SKIP: {
    skip 'php is not available on PATH; cleanup execution checks are deferred', 29 if !$php;

    my $temp = tempdir( CLEANUP => 1 );
    my $project = File::Spec->catdir( $temp, 'project' );
    my $log = File::Spec->catdir( $project, 'log' );
    make_path($log);
    my $existing = File::Spec->catfile( $project, 'input.dat' );
    my $upload = File::Spec->catfile( $project, 'input-1.dat' );
    my $staged = File::Spec->catfile( $project, '.staged-upload' );
    my $server_selected = File::Spec->catfile( $project, 'selected.dat' );
    write_text( $existing, 'existing' );
    write_text( $staged, 'new upload' );
    write_text( $server_selected, 'selected' );

    my $destination = php_call(
        $php, $helper,
        'echo json_encode(ga_publish_submission_upload($argv[2], $argv[3], $argv[4]));',
        $staged, $project, 'input.dat',
    );
    is( decode_json($destination), $upload, 'an existing destination receives a collision-safe suffix' );
    is( read_file($upload), 'new upload', 'atomic publication preserves uploaded content' );
    unlink $staged or die "unlink '$staged' failed: $!";

    my $concurrent_a = File::Spec->catfile( $project, '.concurrent-a' );
    my $concurrent_b = File::Spec->catfile( $project, '.concurrent-b' );
    write_text( $concurrent_a, 'concurrent a' );
    write_text( $concurrent_b, 'concurrent b' );
    my ( $concurrent_results, $concurrent_statuses ) = concurrent_publish(
        $php, $helper, $project, 'input.dat', $temp, $concurrent_a, $concurrent_b );
    is_deeply( $concurrent_statuses, [ 0, 0 ], 'concurrent publishers both succeed' );
    my @published = sort map { decode_json($_) } @{$concurrent_results};
    is_deeply(
        \@published,
        [ File::Spec->catfile( $project, 'input-2.dat' ),
          File::Spec->catfile( $project, 'input-3.dat' ) ],
        'concurrent uploads atomically claim different names',
    );
    my @concurrent_contents = sort map { read_file($_) } @published;
    is_deeply( \@concurrent_contents, [ 'concurrent a', 'concurrent b' ],
        'neither concurrent upload overwrites the other' );
    unlink $concurrent_a or die "unlink '$concurrent_a' failed: $!";
    unlink $concurrent_b or die "unlink '$concurrent_b' failed: $!";

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

sub concurrent_publish {
    my ( $php, $helper, $project, $name, $temp, @staged_paths ) = @_;
    my $barrier = File::Spec->catfile( $temp, 'publish-go' );
    my @output_paths;
    my @processes;
    for my $index ( 0 .. $#staged_paths ) {
        my $output_path = File::Spec->catfile( $temp, "publish-$index.out" );
        push @output_paths, $output_path;
        my $process = fork();
        die 'fork failed' if !defined $process;
        if ( $process == 0 ) {
            usleep( 1_000 ) until -e $barrier;
            open STDOUT, '>', $output_path or _exit(111);
            my $status = system $php, '-r',
                'require $argv[1]; echo json_encode(ga_publish_submission_upload($argv[2], $argv[3], $argv[4]));',
                $helper, $staged_paths[$index], $project, $name;
            _exit( $status == -1 ? 127 : $status >> 8 );
        }
        push @processes, $process;
    }
    write_text( $barrier, 'go' );

    my @statuses;
    for my $process (@processes) {
        waitpid( $process, 0 );
        push @statuses, $? >> 8;
    }
    my @results = map { read_file($_) } @output_paths;
    return ( \@results, \@statuses );
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
