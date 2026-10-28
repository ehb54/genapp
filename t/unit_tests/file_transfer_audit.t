use strict;
use warnings;

use File::Path qw(make_path);
use File::Spec;
use File::Temp qw(tempdir);
use FindBin;
use JSON::PP qw(decode_json);
use Test::More;

use lib File::Spec->catdir( $FindBin::Bin, '..', 'lib' );
use GenAppTest qw(php_executable read_file repo_root run_command);

my $repo = repo_root( File::Spec->catdir( $FindBin::Bin, '..' ) );
my $source_path = File::Spec->catfile(
    $repo, qw(languages html5 sys ga_audit.php) );
open my $source_fh, '<', $source_path or die "read $source_path: $!";
local $/;
my $source = <$source_fh>;
close $source_fh;

my $root = tempdir( CLEANUP => 1 );
my $config = File::Spec->catfile( $root, 'appconfig.json' );
open my $config_fh, '>', $config or die "write $config: $!";
print {$config_fh} '{"audit":{"enabled":true,"file_transfers":true,"destination":"error_log"}}';
close $config_fh;
$source =~ s/__appconfig__/$config/g;
$source =~ s/__application__/audit_fixture/g;
my $helper = File::Spec->catfile( $root, 'ga_audit.php' );
open my $helper_fh, '>', $helper or die "write $helper: $!";
print {$helper_fh} $source;
close $helper_fh;

my $user_dir = File::Spec->catdir( $root, qw(results users Joseph project) );
make_path( $user_dir );
my $file = File::Spec->catfile( $user_dir, 'result.txt' );
open my $file_fh, '>', $file or die "write $file: $!";
print {$file_fh} "result\n";
close $file_fh;

my $script = File::Spec->catfile( $root, 'check.php' );
open my $script_fh, '>', $script or die "write $script: $!";
print {$script_fh} <<'PHP';
<?php
require $argv[1];
$root = $argv[2];
$checks = array(
  ga_audit_resolve_user_result($root, 'Joseph', 'results/users/Joseph/project/result.txt') !== false,
  ga_audit_resolve_user_result($root, 'Other', 'results/users/Joseph/project/result.txt') === false,
  ga_audit_resolve_user_result($root, 'Joseph', 'results/users/Joseph/../../Joseph/project/result.txt') === false,
  ga_audit_resolve_user_result($root, 'Joseph', 'results/users/Joseph/project/missing.txt') === false
);
echo json_encode($checks);
PHP
close $script_fh;

my $php = php_executable();
my ( $status, $output ) = run_command(
    cwd => $root,
    cmd => [ $php, $script, $helper, $root ],
);
is( $status, 0, 'audit helper runs under the supported PHP interpreter' );
is( $output, '[true,true,true,true]',
    'download resolver accepts only existing files in the authenticated user tree' );

my $collector = File::Spec->catfile( $root, 'mock-sdl-collector.log' );
my $emit_script = File::Spec->catfile( $root, 'emit.php' );
open my $emit_fh, '>', $emit_script or die "write $emit_script: $!";
print {$emit_fh} <<'PHP';
<?php
require $argv[1];
require $argv[2];
$_SERVER['REMOTE_ADDR'] = '192.0.2.25';
$accepted = ga_file_transfer_audit('upload_succeeded', array(
  'transfer_id' => 'transfer-fixture-1',
  'username' => "Joseph\nforged",
  'project' => 'audit-project',
  'module' => 'data_interpolation',
  'field' => 'data_file_name',
  'filename' => "sample_sans_data.dat\rhidden",
  'size_bytes' => 1234,
  'outcome' => 'accepted',
  'password' => 'must-not-be-logged'
));
$project_root = $argv[3] . '/audit-project';
$log_root = $project_root . '/log';
if (!is_dir($project_root)) {
  mkdir($project_root, 0770, true);
}
if (!is_dir($log_root)) {
  mkdir($log_root, 0770, true);
}
$module = json_decode('{"fields":[{"id":"data_file_name","type":"lrfile"}]}');
$uploaded = $project_root . '/adk_reverse_console.log';
file_put_contents($uploaded, "not scientific data\n");
$entries = array();
ga_record_rejected_lrfile_upload(
  $entries, $module, 'data_file_name', 0, $uploaded, $project_root,
  'transfer-fixture-2');
$receipt = ga_rejected_lrfile_receipt_path($log_root, 'audit-job');
ga_write_rejected_lrfile_receipt($receipt, $entries);
$cleanup = ga_cleanup_sassie_rejected_lrfiles(
  json_decode('{"_sassie_rejected_lrfiles":[{"field":"data_file_name","index":0}]}'),
  $receipt, $project_root);
$rejected = false;
foreach ($cleanup['deleted_uploads'] as $deleted_upload) {
  $rejected = ga_file_transfer_audit('upload_failed', array(
    'transfer_id' => $deleted_upload['transfer_id'],
    'username' => 'Joseph',
    'project' => 'audit-project',
    'module' => 'data_interpolation',
    'field' => $deleted_upload['field'],
    'filename' => $deleted_upload['filename'],
    'size_bytes' => $deleted_upload['size_bytes'],
    'outcome' => 'rejected',
    'failure' => 'scientific_validation'
  ));
}
echo ($accepted && $rejected && $cleanup['deleted'] === 1 && !file_exists($uploaded))
  ? 'written' : 'failed';
PHP
close $emit_fh;

( $status, $output ) = run_command(
    cwd => $root,
    cmd => [
        $php, '-d', 'log_errors=1', '-d', "error_log=$collector",
        $emit_script, $helper, $repo . '/languages/html5/util/rejected-lrfile.php',
        $root,
    ],
);
is( $status, 0, 'enabled audit emitter runs against the mock collector' );
is( $output, 'written', 'emitter reports that the local sink accepted the event' );

my @audit_lines = grep { /GENAPP_AUDIT / } split /\n/, read_file( $collector );
is( scalar @audit_lines, 2, 'mock collector receives accepted and rejected audit events' );
my @payloads = map { /GENAPP_AUDIT (\{.*\})\s*$/ } @audit_lines;
is( scalar @payloads, 2, 'each collector line contains a JSON audit envelope' );
my @records = map { decode_json( $_ ) } @payloads;
my ($record) = grep { $_->{event} eq 'upload_succeeded' } @records;
my ($rejected_record) = grep { $_->{event} eq 'upload_failed' } @records;
ok( defined $record, 'collector receives the accepted-upload event' );
ok( defined $rejected_record, 'collector receives the rejected-upload event' );
is( $record->{schema}, 'genapp.file_transfer.v1', 'event has the stable schema' );
is( $record->{application}, 'audit_fixture', 'event identifies the application' );
is( $record->{event}, 'upload_succeeded', 'event identifies a successful upload' );
like( $record->{timestamp}, qr/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\+00:00$/,
    'event has a UTC timestamp' );
is( $record->{source_ip}, '192.0.2.25', 'event records the server-observed source IP' );
is( $record->{transfer_id}, 'transfer-fixture-1', 'event carries its correlation ID' );
is( $record->{username}, 'Joseph forged', 'control characters are removed from values' );
is( $record->{project}, 'audit-project', 'event carries the project' );
is( $record->{module}, 'data_interpolation', 'event carries the module' );
is( $record->{field}, 'data_file_name', 'event carries the input field' );
is( $record->{filename}, 'sample_sans_data.dat hidden', 'filename is single-line safe' );
is( $record->{size_bytes}, 1234, 'event carries the byte count as a number' );
is( $record->{outcome}, 'accepted', 'event carries the transfer outcome' );
ok( !exists $record->{password}, 'unapproved sensitive detail keys are omitted' );
is( $rejected_record->{filename}, 'adk_reverse_console.log',
    'rejected event identifies the safe uploaded filename' );
is( $rejected_record->{outcome}, 'rejected', 'rejected event carries its outcome' );
is( $rejected_record->{failure}, 'scientific_validation',
    'rejected event carries its non-sensitive failure category' );
is( $rejected_record->{transfer_id}, 'transfer-fixture-2',
    'scientific rejection correlates to the accepted upload transfer ID' );
is( $rejected_record->{size_bytes}, 20,
    'scientific rejection records the deleted upload byte count' );
unlike( join( "\n", @audit_lines ), qr/\Q$root\E/,
    'collector records contain no absolute temporary path' );

my $disabled_config = File::Spec->catfile( $root, 'disabled-appconfig.json' );
open my $disabled_config_fh, '>', $disabled_config
    or die "write $disabled_config: $!";
print {$disabled_config_fh} '{"audit":{"enabled":false,"file_transfers":true,"destination":"error_log"}}';
close $disabled_config_fh;
my $disabled_source = $source;
$disabled_source =~ s/\Q$config\E/$disabled_config/g;
my $disabled_helper = File::Spec->catfile( $root, 'ga_audit_disabled.php' );
open my $disabled_fh, '>', $disabled_helper or die "write $disabled_helper: $!";
print {$disabled_fh} $disabled_source;
close $disabled_fh;
my $disabled_collector = File::Spec->catfile( $root, 'disabled-collector.log' );
( $status, $output ) = run_command(
    cwd => $root,
    cmd => [
        $php, '-d', 'log_errors=1', '-d', "error_log=$disabled_collector",
        $emit_script, $disabled_helper,
        $repo . '/languages/html5/util/rejected-lrfile.php', $root,
    ],
);
is( $status, 0, 'disabled audit emitter remains non-blocking' );
is( $output, 'failed', 'disabled emitter reports that no event was delivered' );
ok( !-e $disabled_collector || read_file( $disabled_collector ) !~ /GENAPP_AUDIT /,
    'disabled audit emits no collector event' );

like( $source, qr/GENAPP_AUDIT/, 'audit records use the stable collector prefix' );
like( $source, qr/GENAPP_AUDIT_DELIVERY_FAILURE/,
    'delivery failures leave a content-free local warning' );
unlike( $source, qr/HTTP_X_FORWARDED_FOR/, 'untrusted forwarding headers are not logged as source identity' );

# Execute the real completion region between command execution and job-log
# finalization. These boundaries do not depend on cancellation or audit layout.
# External daemon/database startup is outside this component test.
my $jobrun = read_file($repo . '/languages/html5/util/jobrun.php');
my ($cleanup_block) = $jobrun =~ /\$results = exec\( \$cmd \);(.*?)(?=^logjobupdate\( "finished")/ms;
BAIL_OUT('jobrun completion boundary moved; update the fixture') unless defined $cleanup_block;
$cleanup_block =~ s/^\s*__~debug:[^\n]+\n//mg;
ok(index($cleanup_block, 'ga_cleanup_sassie_rejected_lrfiles') >= 0,
    'whole completion region includes cleanup independently of its cancellation placement');
my $namespaced_helper = read_file($repo . '/languages/html5/util/rejected-lrfile.php');
$namespaced_helper =~ s/<\?php/<?php namespace LrfileAuditTest;/;
my $isolated_helper = File::Spec->catfile($root, 'isolated-cleanup.php');
open my $isolated_fh, '>', $isolated_helper or die $!;
print {$isolated_fh} $namespaced_helper;
close $isolated_fh;
my $integration = File::Spec->catfile($root, 'jobrun-cleanup.php');
open my $integration_fh, '>', $integration or die $!;
print {$integration_fh} <<'PHP';
<?php namespace LrfileAuditTest;
require $argv[1];
require $argv[2];
$trace = array(); $phase = 0; $upload_unlinks = 0; $lock_attempts = 0;
function ga_file_transfer_audit($event, $details = array()) {
    global $trace, $upload, $mode, $phase, $project;
    $storage_free = null;
    if ($mode === 'normal') {
        $probe = ga_lrfile_storage_lock($project);
        $storage_free = $probe !== false; ga_lrfile_unlock($probe);
    }
    $fail = $mode === 'audit_failure'
        || ($mode === 'retry_rejection' && $phase === 0)
        || (in_array($mode, array('outcome_failure', 'retry_outcome'), true)
            && $phase === 0 && $event === 'rejected_upload_cleanup');
    $written = $fail ? false : \ga_file_transfer_audit($event, $details);
    $trace[] = array('event' => $event, 'file_exists' => is_file($upload),
        'details' => $details, 'written' => $written, 'phase' => $phase, 'storage_free' => $storage_free);
    return $written;
}
function flock($stream, $operation, &$would_block = null) {
    global $mode, $lock_attempts;
    if ($operation !== LOCK_UN) {
        ++$lock_attempts;
        if ($mode === 'lock_failure' || ($mode === 'storage_lock_failure' && $lock_attempts > 1)) {
            $would_block = 1; return false;
        }
    }
    return \flock($stream, $operation, $would_block);
}
function sendudptext($text) {}
function unlink($path) {
    global $upload, $mode, $upload_unlinks;
    if ($path === $upload) {
        ++$upload_unlinks;
        if ($mode === 'unlink_failure') { return false; }
    }
    return \unlink($path);
}
function error_log($message, $type = 0, $destination = null) { return true; }
$mode = $argv[3];
$project = $argv[4] . '/jobrun-' . $mode;
mkdir($project, 0770, true);
$logdir = $project . '/log/'; mkdir($logdir);
$id = 'jobrun-' . $mode;
$upload = $project . '/profile.dat';
file_put_contents($upload, "rejected input\n"); $upload = realpath($upload);
$module = json_decode('{"fields":[{"id":"profile","type":"lrfile","role":"input"}]}');
$owned = array();
ga_record_rejected_lrfile_upload($owned, $module, 'profile', 0, $upload, $project, 'audit-' . $mode);
$receipt = ga_rejected_lrfile_receipt_path($logdir, $id);
ga_write_rejected_lrfile_receipt($receipt, $owned);
if ($mode === 'interrupted_cleanup') {
    ga_lrfile_save_receipt($receipt, array('version' => 1, 'uploads' => $owned,
        'processing' => array(array('rejection_logged' => true, 'intent' => true))));
    \unlink($upload); // Simulate process loss after unlink, before result persistence.
}
$GLOBALS['getmenumoduledir'] = $project;
$GLOBALS['logon'] = 'test_user';
$GLOBALS['getmenumoduleproject'] = 'test_project';
$GLOBALS['module'] = 'test_module';
$_REQUEST['_uuid'] = $id;
$GLOBALS['wascancelled'] = strpos($mode, 'cancelled_') === 0;
$results = in_array($mode, array('parameter_error', 'cancelled_without_marker'), true)
    ? '{"error":"invalid unrelated parameter"}'
    : '{"error":"file rejected","_sassie_rejected_lrfiles":[{"field":"profile","index":0}]}';
if ($mode === 'malformed_output') { $results = 'not valid JSON'; }
$completion = 'namespace LrfileAuditTest;' . file_get_contents($argv[5]);
eval($completion);
$first = array('file_exists' => is_file($upload), 'receipt_exists' => is_file($receipt));
if (strpos($mode, 'retry_') === 0) {
    if ($mode === 'retry_outcome') { file_put_contents($upload, 'later unrelated replacement'); }
    $phase = 1;
    eval($completion);
}
echo json_encode(array('trace' => $trace, 'first' => $first,
    'file_exists' => is_file($upload), 'receipt_exists' => is_file($receipt),
    'remaining_bytes' => is_file($upload) ? file_get_contents($upload) : null,
    'upload_unlinks' => $upload_unlinks, 'lock_attempts' => $lock_attempts));
if (is_file($receipt)) { \unlink($receipt); }
PHP
close $integration_fh;
my $completion_file = File::Spec->catfile($root, 'completion.inc');
open my $completion_fh, '>', $completion_file or die $!;
print {$completion_fh} $cleanup_block;
close $completion_fh;
my %scenarios;
for my $mode (qw(normal parameter_error audit_failure unlink_failure outcome_failure cancelled_rejection cancelled_without_marker malformed_output audit_disabled retry_rejection retry_outcome lock_failure storage_lock_failure interrupted_cleanup)) {
    my $selected_helper = $mode eq 'audit_disabled' ? $disabled_helper : $helper;
    my ($exit, $json) = run_command(cwd => $root, cmd => [
        $php, '-d', "error_log=$collector", $integration, $selected_helper,
        $isolated_helper, $mode, $root, $completion_file]);
    is($exit, 0, "jobrun completion scenario executes: $mode") or diag $json;
    $scenarios{$mode} = eval { decode_json($json) };
    ok(ref($scenarios{$mode}) eq 'HASH', "jobrun completion returns JSON: $mode") or BAIL_OUT($json);
}
ok(!$scenarios{normal}{file_exists}, 'confirmed rejection deletes an owned upload');
ok($scenarios{parameter_error}{file_exists}, 'parameter-only error preserves the upload');
is_deeply($scenarios{parameter_error}{trace}, [], 'parameter-only error emits no rejection or deletion claim');
ok($scenarios{unlink_failure}{file_exists}, 'injected unlink failure leaves bytes in place');
for my $mode (qw(cancelled_without_marker malformed_output)) {
    ok($scenarios{$mode}{file_exists}, "no confirmed rejection preserves bytes: $mode");
    is_deeply($scenarios{$mode}{trace}, [], "no false rejection audit: $mode");
}
ok(!$scenarios{audit_disabled}{file_exists}, 'explicitly disabled auditing preserves ordinary cleanup compatibility');
is(scalar(grep { $_->{written} } @{$scenarios{audit_disabled}{trace}}), 0,
    'disabled auditing cannot claim delivered evidence or NIST acceptance');
my @trace = @{$scenarios{normal}{trace}};
is($trace[0]{details}{transfer_id}, 'audit-normal', 'jobrun keeps upload correlation ID');
is($trace[0]{details}{failure}, 'scientific_validation', 'jobrun retains existing rejection category');
{

    ok($trace[0]{file_exists}, 'rejection is logged while upload still exists');
    ok(!$scenarios{cancelled_rejection}{file_exists} && @{$scenarios{cancelled_rejection}{trace}} == 2,
        'confirmed rejection survives legacy cancelled status');
    is_deeply([map { $_->{event} } @trace], ['upload_failed', 'rejected_upload_cleanup'],
        'rejection and cleanup produce separate ordered records');
    ok(@trace == 2 && !$trace[1]{file_exists} && ($trace[1]{details}{outcome} || '') eq 'deleted'
        && ($trace[1]{details}{transfer_id} || '') eq 'audit-normal',
        'cleanup records actual deletion with the same transfer ID');
    ok($scenarios{audit_failure}{file_exists} && $scenarios{audit_failure}{receipt_exists},
        'rejected-audit failure retains file and evidence');
    my @failed = @{$scenarios{unlink_failure}{trace}};
    ok(@failed == 2 && ($failed[0]{event} || '') eq 'upload_failed'
        && ($failed[1]{details}{outcome} || '') eq 'failed' && $failed[1]{file_exists}
        && $scenarios{unlink_failure}{receipt_exists},
        'unlink failure records rejection and actual failure, retains evidence');
    ok(!$scenarios{outcome_failure}{file_exists} && $scenarios{outcome_failure}{receipt_exists},
        'outcome-audit failure preserves evidence after deletion');
    ok($scenarios{lock_failure}{lock_attempts} > 0 && $scenarios{lock_failure}{file_exists}
        && $scenarios{lock_failure}{receipt_exists} && $scenarios{lock_failure}{upload_unlinks} == 0,
        'lock acquisition failure preserves upload and receipt without an unlocked fallback');
    my $retry = $scenarios{retry_rejection};
    my @written = grep { $_->{written} } @{$retry->{trace}};
    ok($retry->{first}{file_exists} && $retry->{first}{receipt_exists}
        && !$retry->{file_exists} && !$retry->{receipt_exists} && $retry->{upload_unlinks} == 1
        && @written == 2 && $written[0]{event} eq 'upload_failed'
        && $written[1]{event} eq 'rejected_upload_cleanup',
        'retry after logging recovers updates its own receipt and deletes once');
    $retry = $scenarios{retry_outcome};
    @written = grep { $_->{written} } @{$retry->{trace}};
    ok($retry->{first}{receipt_exists} && !$retry->{first}{file_exists}
        && ($retry->{remaining_bytes} || '') eq 'later unrelated replacement'
        && $retry->{upload_unlinks} == 1 && !$retry->{receipt_exists}
        && @written == 2 && $written[1]{event} eq 'rejected_upload_cleanup'
        && $written[1]{details}{outcome} eq 'deleted'
        && $written[1]{details}{transfer_id} eq 'audit-retry_outcome',
        'outcome retry reports known deletion without unlinking a replacement');
}
my $storage_failure = $scenarios{storage_lock_failure};
ok($storage_failure->{file_exists} && $storage_failure->{receipt_exists}
    && $storage_failure->{upload_unlinks} == 0,
    'failed storage lock preserves upload and pending evidence');
my @storage_trace = @{$storage_failure->{trace}};
ok(@storage_trace == 2 && $storage_trace[1]{event} eq 'rejected_upload_cleanup'
    && $storage_trace[1]{details}{outcome} eq 'failed'
    && $storage_trace[1]{details}{failure} eq 'storage_lock_unavailable',
    'failed storage lock records rejection and truthful cleanup failure');
ok(@trace == 2 && $trace[0]{storage_free} && $trace[1]{storage_free},
    'audit callbacks run without holding the storage mutation lock');
my $interrupted = $scenarios{interrupted_cleanup};
my @interrupted_trace = @{$interrupted->{trace}};
ok(!$interrupted->{file_exists} && $interrupted->{receipt_exists}
    && $interrupted->{upload_unlinks} == 0,
    'interrupted cleanup retains evidence without repeating unlink');
ok(@interrupted_trace == 1 && $interrupted_trace[0]{event} eq 'rejected_upload_cleanup'
    && $interrupted_trace[0]{details}{outcome} eq 'failed'
    && $interrupted_trace[0]{details}{failure} eq 'cleanup_outcome_uncertain',
    'missing file after interrupted intent is never reported as known deletion');

# daemon_error_log_regression: use jobrun's actual double-fork/closed-stream startup.
my $daemon_prefix = read_file(File::Spec->catfile($repo, qw(languages html5 util jobrun.php)));
$daemon_prefix =~ s/\$logdir\s*=.*\z//s;
$daemon_prefix =~ s/^__~debug:[^\n]*\n//mg;
$daemon_prefix =~ s/<\?php/\<?php\nini_set('error_log', \$argv[3]);/;
# Keep the production diagnostic destination isolated inside this test fixture.
$daemon_prefix =~ s!'/tmp/php_errors'!\$argv[2]!g;
my $daemon_script = File::Spec->catfile($root, 'daemon-audit.php');
open my $daemon_fh, '>', $daemon_script or die $!;
print {$daemon_fh} $daemon_prefix, <<'PHP';
require $argv[1];
$details = array('transfer_id' => 'daemon-rejection', 'username' => 'Joseph',
  'filename' => 'rejected.dat', 'outcome' => 'rejected');
ga_file_transfer_audit('upload_failed', $details);
$details['outcome'] = 'deleted';
ga_file_transfer_audit('rejected_upload_cleanup', $details);
file_put_contents($argv[4], 'done');
PHP
close $daemon_fh;
for my $mode (qw(default configured)) {
    my $fallback_log = File::Spec->catfile($root, "daemon-fallback-$mode.log");
    my $configured_log = File::Spec->catfile($root, "daemon-configured-$mode.log");
    my $done = File::Spec->catfile($root, "daemon-$mode.done");
    my $setting = $mode eq 'configured' ? $configured_log : '';
    my ($exit, $stdout) = run_command(cwd => $root, cmd => [
        $php, $daemon_script, $helper, $fallback_log, $setting, $done]);
    for (1 .. 250) { last if -f $done; select undef, undef, undef, 0.02; }
    ok($exit == 0 && -f $done, "actual daemon reaches audit completion: $mode");
    my $destination = $mode eq 'configured' ? $configured_log : $fallback_log;
    my $text = -f $destination ? read_file($destination) : '';
    my @events = map { decode_json($_) } ($text =~ /GENAPP_AUDIT (\{[^\n]*\})/g);
    is_deeply([map { $_->{event} } @events], ['upload_failed', 'rejected_upload_cleanup'],
        "closed-stream daemon persists both audit records: $mode");
    ok(@events == 2 && $events[0]{transfer_id} eq $events[1]{transfer_id}
        && $events[0]{outcome} eq 'rejected' && $events[1]{outcome} eq 'deleted',
        "daemon records retain correlation and actual outcomes: $mode");
    ok($mode ne 'configured' || !-e $fallback_log,
        'daemon preserves an explicitly configured PHP log destination');
}

done_testing();
