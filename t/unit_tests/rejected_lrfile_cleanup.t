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
use lib File::Spec->catdir($FindBin::Bin, '..', 'lib');
use GenAppTest qw(php_executable);
my $php = php_executable();

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
ga_record_rejected_lrfile_upload(
    $entries, $module, 'profile', 0, $first, $root, 'transfer-first');
ga_record_rejected_lrfile_upload(
    $entries, $module, 'rows-profile-1', 0, $second, $root, 'transfer-second');
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

// Each negative case gets a live receipt. Reusing a consumed receipt would
// make a destructive bug look safe without exercising the coordinate parser.
$results['invalid_cases'] = array();
$invalid_markers = array(
    array(array('field' => '../profile', 'index' => 0)),
    array(array('field' => 'profile', 'index' => '0')),
    array(array('field' => 'profile', 'index' => -1)),
    array(array('field' => 'profile', 'index' => true)),
    array(array('field' => 'unknown', 'index' => 0)),
    array(), null, 'profile'
);
foreach ($invalid_markers as $number => $marker) {
    $path = $root . '/invalid-' . $number . '.dat';
    file_put_contents($path, 'preserve');
    $owned = array();
    ga_record_rejected_lrfile_upload($owned, $module, 'profile', 0, $path, $root);
    $ticket = ga_rejected_lrfile_receipt_path($log, 'invalid-' . $number);
    ga_write_rejected_lrfile_receipt($ticket, $owned);
    $out = (object)array('_sassie_rejected_lrfiles' => $marker);
    $cleaned = ga_cleanup_sassie_rejected_lrfiles($out, $ticket, $root);
    $results['invalid_cases'][] = file_exists($path) && $cleaned['deleted'] === 0;
    if (file_exists($ticket)) { unlink($ticket); }
}

$owned = array();
foreach (array(0, 2, 7) as $row) {
    $path = $root . '/group-' . $row . '.dat';
    file_put_contents($path, 'row-' . $row);
    ga_record_rejected_lrfile_upload($owned, $module, 'profile', $row, $path, $root);
}
$ticket = ga_rejected_lrfile_receipt_path($log, 'group');
ga_write_rejected_lrfile_receipt($ticket, $owned);
$packet = json_decode('{"_sassie_rejected_lrfiles":[{"field":"profile","index":2},{"field":"profile","index":7},{"field":"profile","index":2},{"field":"profile","index":9}]}');
$group_result = ga_cleanup_sassie_rejected_lrfiles($packet, $ticket, $root);
$results['group_deletes_two'] = $group_result['deleted'] === 2;
$results['group_preserves_sibling'] = file_get_contents($root . '/group-0.dat') === 'row-0';
$results['group_preserves_server'] = file_exists($server);
file_put_contents($root . '/group-2.dat', 'later-upload');
ga_cleanup_sassie_rejected_lrfiles($packet, $ticket, $root);
$results['replay_preserves_later_upload'] = file_get_contents($root . '/group-2.dat') === 'later-upload';

// Fail-closed authorization and duplicate-identity checks are mandatory.
$results['pending_packets'] = array();
foreach (array(
    'null' => null,
    'mixed_invalid' => array(array('field' => 'profile', 'index' => 0), array('field' => 'profile', 'index' => -1)),
    'path_bearing' => array(array('field' => 'profile', 'index' => 0, 'path' => $server))
) as $label => $coordinates) {
    $path = $root . '/pending-' . $label . '.dat';
    file_put_contents($path, 'preserve');
    $owned = array();
    ga_record_rejected_lrfile_upload($owned, $module, 'profile', 0, $path, $root);
    $cleaned = ga_remove_receipted_lrfile_uploads($owned, $root, $coordinates);
    $results['pending_packets'][$label] = file_exists($path) && $cleaned['deleted'] === 0;
}
$ticket = ga_rejected_lrfile_receipt_path($log, 'duplicate-identity');
$owned = array();
ga_record_rejected_lrfile_upload($owned, $module, 'profile', 0, $first, $root);
ga_write_rejected_lrfile_receipt($ticket, $owned);
$before = file_get_contents($ticket);
$replacement_owned = array();
ga_record_rejected_lrfile_upload($replacement_owned, $module, 'profile', 0, $generic, $root);
$rewritten = ga_write_rejected_lrfile_receipt($ticket, $replacement_owned);
$results['duplicate_receipt_refused'] = !$rewritten && file_get_contents($ticket) === $before;
unlink($ticket);

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
is_deeply( $result->{exact_cleanup}, {
        pending => JSON::PP::false,
        deleted => 1,
        skipped => 0,
        deleted_uploads => [{
            field => 'profile',
            filename => 'second.dat',
            size_bytes => 8,
            transfer_id => 'transfer-second',
        }],
    },
    'only the exact marked receipt coordinate is deleted' );
ok( $result->{exact_deleted}, 'matched current upload is removed' );
ok( $result->{unmatched_preserved}, 'unmatched current upload is preserved' );
ok( $result->{server_preserved}, 'unreceipted server file is preserved' );
is_deeply( $result->{generic_result}, {
        pending => JSON::PP::false,
        deleted => 0, skipped => 0, deleted_uploads => [] },
    'ordinary validation failure performs no cleanup' );
ok( $result->{generic_preserved}, 'ordinary validation failure preserves its upload' );
ok( $result->{generic_receipt_discarded}, 'completed ordinary failure discards its receipt' );
is_deeply( $result->{replacement_skipped}, {
        deleted => 0, skipped => 1, deleted_uploads => [] },
    'identity mismatch prevents deletion' );
ok( $result->{replacement_preserved}, 'replacement file is preserved' );
is_deeply( $result->{outside_skipped}, {
        deleted => 0, skipped => 1, deleted_uploads => [] },
    'out-of-root receipt entry is refused' );
ok( $result->{outside_preserved}, 'out-of-root file is preserved' );
is_deeply( $result->{link_skipped}, {
        deleted => 0, skipped => 1, deleted_uploads => [] },
    'link replacement prevents deletion' );
ok( $result->{link_preserved}, 'linked path and its target are preserved' );
is_deeply($result->{invalid_cases}, [(JSON::PP::true) x 8],
    'fresh receipts reject malformed, unknown, empty, null and scalar markers');
ok($result->{group_deletes_two}, 'related rejection removes both owned rows, once each');
ok($result->{group_preserves_sibling}, 'unmarked row zero survives a related-file rejection');
ok($result->{group_preserves_server}, 'a checked group cannot delete an unreceipted server selection');
ok($result->{replay_preserves_later_upload}, 'replayed final result cannot remove a later upload');
for my $label (sort keys %{$result->{pending_packets}}) {
    {

        ok($result->{pending_packets}{$label}, "pending fail-closed packet: $label");
    }
}
{

    ok($result->{duplicate_receipt_refused}, 'duplicate job receipt cannot replace original ownership');
}

done_testing();
