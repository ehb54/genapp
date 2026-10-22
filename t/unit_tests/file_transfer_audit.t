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

done_testing();
