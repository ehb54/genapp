use strict;
use warnings;

use File::Spec;
use File::Temp qw(tempfile);
use FindBin;
use Test::More;

use lib File::Spec->catdir( $FindBin::Bin, 'lib' );
use GenAppTest qw(read_file repo_root run_command);

my $php = find_executable('php');
plan skip_all => 'php is not available on PATH; backend execution contract tests are deferred' if !$php;

my $repo_root = repo_root($FindBin::Bin);
my $results_source = read_file(
    File::Spec->catfile( $repo_root, qw(languages html5 results.php) )
);
my ($helper_source) = $results_source =~ /(function ga_terminal_error_payload\(.*?^\})/ms;
ok( defined $helper_source, 'terminal-error helper is present in the generated results template' );
my ($status_helper_source) = $results_source =~ /(function ga_terminal_output_status\(.*?^\})/ms;
ok( defined $status_helper_source, 'terminal-output status helper is present in the generated results template' );

my ( $helper_fh, $helper_path ) = tempfile( SUFFIX => '.php' );
print {$helper_fh} "<?php\n$helper_source\n$status_helper_source\n";
close $helper_fh;

sub evaluate_payload {
    my ($payload) = @_;
    my ( $status, $output ) = run_command(
        cwd => $repo_root,
        cmd => [
            $php,
            '-r',
            'require $argv[1]; echo json_encode(ga_terminal_error_payload($argv[2]));',
            $helper_path,
            $payload,
        ],
    );
    is( $status, 0, 'terminal-error helper executes in PHP' ) or diag($output);
    return $output;
}

like(
    evaluate_payload('{"error":"scientific validation failed","report":"details"}'),
    qr/"error":"scientific validation failed"/,
    'a durable terminal error remains available when a run directory was never created'
);
is(
    evaluate_payload('{"_status":"complete","report":"done"}'),
    'false',
    'a successful payload cannot bypass missing-run-directory protection'
);
is(
    evaluate_payload('not json'),
    'false',
    'malformed output cannot bypass missing-run-directory protection'
);

sub evaluate_status {
    my ( $payload, $cancelled ) = @_;
    my ( $status, $output ) = run_command(
        cwd => $repo_root,
        cmd => [
            $php,
            '-r',
            'require $argv[1]; echo ga_terminal_output_status($argv[2], $argv[3] === "1");',
            $helper_path,
            $payload,
            $cancelled ? '1' : '0',
        ],
    );
    is( $status, 0, 'terminal-output status helper executes in PHP' ) or diag($output);
    return $output;
}

is(
    evaluate_status('{"error":"scientific validation failed"}', 0),
    'failed',
    'a valid terminal error payload is classified as a failed job'
);
is(
    evaluate_status('{"report":"done"}', 0),
    'complete',
    'a valid successful payload remains a completed job'
);
is(
    evaluate_status('{"error":"late output"}', 1),
    'cancelled',
    'an explicit cancellation remains authoritative over terminal output'
);
done_testing();

sub find_executable {
    my ($name) = @_;
    for my $dir ( split /:/, $ENV{PATH} || q{} ) {
        my $path = File::Spec->catfile( $dir, $name );
        return $path if -x $path;
    }
    return;
}
