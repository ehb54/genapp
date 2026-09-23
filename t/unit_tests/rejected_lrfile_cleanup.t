use strict;
use warnings;

use File::Spec;
use File::Temp qw(tempdir);
use FindBin;
use JSON::PP qw(decode_json);
use Test::More;

my $repo_root = File::Spec->rel2abs(
    File::Spec->catdir( $FindBin::Bin, File::Spec->updir, File::Spec->updir )
);
my $helper = File::Spec->catfile(
    $repo_root, qw(languages html5 util rejected-lrfile.php) );
my $php = qx{command -v php 2>/dev/null};
chomp $php;

plan skip_all => 'php is not available on PATH' if !$php;

my $temporary_directory = tempdir( CLEANUP => 1 );
my $script = File::Spec->catfile( $temporary_directory, 'exercise.php' );
open my $script_handle, '>', $script or die "could not write $script: $!";
print {$script_handle} <<'PHP';
<?php
require $argv[1];
$root = $argv[2] . '/project';
$log = $root . '/log';
mkdir($root, 0770, true);
mkdir($log, 0770, true);
$module = json_decode('{"fields":[{"id":"profile","type":"lrfile"},{"id":"notes","type":"text"}]}');
$results = array();
$results['direct_coordinate'] = ga_rejected_lrfile_coordinate($module, 'profile', 2);
$results['repeated_coordinate'] = ga_rejected_lrfile_coordinate($module, 'rows-profile-7', 0);
$results['non_lrfile_coordinate'] = ga_rejected_lrfile_coordinate($module, 'notes', 0);

$entries = array();
$first = $root . '/first.dat';
$second = $root . '/second.dat';
$server = $root . '/server.dat';
file_put_contents($first, "0 1 0.1\n");
file_put_contents($second, "0 2 0.1\n");
file_put_contents($server, "stored\n");
ga_record_rejected_lrfile_upload($entries, $module, 'profile', 0, $first, $root);
ga_record_rejected_lrfile_upload($entries, $module, 'rows-profile-1', 0, $second, $root);
$receipt = ga_rejected_lrfile_receipt_path($log, 'job-1');
$results['receipt_written'] = ga_write_rejected_lrfile_receipt($receipt, $entries);
$results['receipt_mode'] = fileperms($receipt) & 0777;
$cleanup = ga_cleanup_sassie_rejected_lrfiles(
    json_decode('{"_sassie_rejected_lrfiles":[{"field":"profile","index":1}]}'),
    $receipt, $root);
$results['exact_cleanup'] = $cleanup;
$results['exact_deleted'] = !file_exists($second);
$results['unmatched_preserved'] = file_exists($first);
$results['server_preserved'] = file_exists($server);

$generic_entries = array();
$generic = $root . '/generic.dat';
file_put_contents($generic, "generic failure\n");
ga_record_rejected_lrfile_upload(
    $generic_entries, $module, 'profile', 2, $generic, $root);
$generic_receipt = ga_rejected_lrfile_receipt_path($log, 'job-2');
ga_write_rejected_lrfile_receipt($generic_receipt, $generic_entries);
$generic_result = ga_cleanup_sassie_rejected_lrfiles(
    json_decode('{"error":"ordinary validation failure"}'),
    $generic_receipt, $root);
$results['generic_result'] = $generic_result;
$results['generic_preserved'] = file_exists($generic);
$results['generic_receipt_discarded'] = !file_exists($generic_receipt);

$replacement_entries = array();
$replacement = $root . '/replacement.dat';
file_put_contents($replacement, "original\n");
ga_record_rejected_lrfile_upload(
    $replacement_entries, $module, 'profile', 3, $replacement, $root);
unlink($replacement);
file_put_contents($replacement, "replacement has a different identity\n");
$replacement_result = ga_remove_receipted_lrfile_uploads(
    $replacement_entries, $root, array(array('field' => 'profile', 'index' => 3)));
$results['replacement_skipped'] = $replacement_result;
$results['replacement_preserved'] = file_exists($replacement);

$outside = $argv[2] . '/outside.dat';
file_put_contents($outside, "outside\n");
$outside_entries = array(array(
    'field' => 'profile', 'index' => 4, 'path' => $outside,
    'identity' => ga_rejected_lrfile_identity($outside)));
$outside_result = ga_remove_receipted_lrfile_uploads(
    $outside_entries, $root, array(array('field' => 'profile', 'index' => 4)));
$results['outside_skipped'] = $outside_result;
$results['outside_preserved'] = file_exists($outside);

$link_entries = array();
$link_path = $root . '/link.dat';
file_put_contents($link_path, "uploaded\n");
ga_record_rejected_lrfile_upload(
    $link_entries, $module, 'profile', 5, $link_path, $root);
unlink($link_path);
symlink($server, $link_path);
$link_result = ga_remove_receipted_lrfile_uploads(
    $link_entries, $root, array(array('field' => 'profile', 'index' => 5)));
$results['link_skipped'] = $link_result;
$results['link_preserved'] = is_link($link_path) && file_exists($server);

$malformed_result = ga_cleanup_sassie_rejected_lrfiles(
    json_decode('{"_sassie_rejected_lrfiles":[{"field":"../profile","index":0},{"field":"profile","index":"0"}]}'),
    $receipt, $root);
$results['malformed_marker'] = $malformed_result;
$results['first_still_preserved'] = file_exists($first);
echo json_encode($results);
PHP
close $script_handle;

my $lint_output = qx{$php -l "$helper" 2>&1};
is( $? >> 8, 0, 'rejected-lrfile helper passes PHP syntax validation' )
    or diag $lint_output;

open my $runtime_handle, '-|', $php, $script, $helper, $temporary_directory
    or die "could not run rejected-lrfile helper test: $!";
my $runtime_output = do { local $/; <$runtime_handle> };
close $runtime_handle;
is( $? >> 8, 0, 'rejected-lrfile helper scenario completes' )
    or diag $runtime_output;
my $result = eval { decode_json($runtime_output) };
ok( $result, 'helper scenario returns JSON' ) or diag $runtime_output;

is_deeply( $result->{direct_coordinate}, { field => 'profile', index => 2 },
    'direct array upload keeps its declared field and member index' );
is_deeply( $result->{repeated_coordinate}, { field => 'profile', index => 7 },
    'repeated upload key resolves to its declared field and row' );
ok( !defined $result->{non_lrfile_coordinate}, 'non-lrfile fields cannot enter a receipt' );
ok( $result->{receipt_written}, 'private receipt is written' );
is( $result->{receipt_mode}, 0600, 'private receipt is owner-readable and owner-writable only' );
is_deeply( $result->{exact_cleanup}, { deleted => 1, skipped => 0 },
    'only the exact marked receipt coordinate is deleted' );
ok( $result->{exact_deleted}, 'matched current upload is removed' );
ok( $result->{unmatched_preserved}, 'unmatched current upload is preserved' );
ok( $result->{server_preserved}, 'unreceipted server file is preserved' );
is_deeply( $result->{generic_result}, { deleted => 0, skipped => 0 },
    'ordinary validation failure performs no cleanup' );
ok( $result->{generic_preserved}, 'ordinary validation failure preserves its upload' );
ok( $result->{generic_receipt_discarded}, 'completed ordinary failure discards its receipt' );
is_deeply( $result->{replacement_skipped}, { deleted => 0, skipped => 1 },
    'identity mismatch prevents deletion' );
ok( $result->{replacement_preserved}, 'replacement file is preserved' );
is_deeply( $result->{outside_skipped}, { deleted => 0, skipped => 1 },
    'out-of-root receipt entry is refused' );
ok( $result->{outside_preserved}, 'out-of-root file is preserved' );
is_deeply( $result->{link_skipped}, { deleted => 0, skipped => 1 },
    'link replacement prevents deletion' );
ok( $result->{link_preserved}, 'linked path and its target are preserved' );
is_deeply( $result->{malformed_marker}, { deleted => 0, skipped => 0 },
    'malformed driver coordinates match no receipt entry' );
ok( $result->{first_still_preserved}, 'malformed coordinates cannot delete an upload' );

done_testing();
