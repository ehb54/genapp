use strict;
use warnings;

use File::Spec;
use File::Temp qw(tempfile);
use FindBin;
use JSON::PP qw(decode_json);
use Test::More;

use lib File::Spec->catdir( $FindBin::Bin, 'lib' );
use GenAppTest qw(repo_root);

my $php = find_executable('php');
plan skip_all => 'php is not available on PATH; job-event cache checks are deferred' if !$php;

my $root = repo_root($FindBin::Bin);
my $helper = File::Spec->catfile( $root, qw(languages html5 util job-event-cache.php) );
my ( $fh, $script ) = tempfile( 'job-event-cache-XXXX', SUFFIX => '.php', TMPDIR => 1, UNLINK => 1 );

print {$fh} <<'PHP_HEADER';
<?php
PHP_HEADER
print {$fh} 'require_once ' . php_string($helper) . ";\n";
print {$fh} <<'PHP_BODY';

function event_value($sequence, $topic = "run", $payload = null) {
    return array(
        "version" => 1,
        "run" => "run-123",
        "module" => "monomer_monte_carlo",
        "sequence" => $sequence,
        "timestamp" => "2026-07-09T12:00:00Z",
        "channel" => $topic === "run" ? "log" : "plot",
        "topic" => $topic,
        "operation" => "append",
        "payload" => $payload === null ? array("text" => strval($sequence)) : $payload,
    );
}

$cached = array("_job_events" => array(event_value(1), event_value(2)));
$incoming = array(
    "_job_events" => array(event_value(4, "sas_stream"), event_value(3, "pr_stream")),
    "_job_event" => event_value(2, "run", array("text" => "replacement")),
);
$merged = ga_job_event_journal($cached, $incoming, 10, 100000);
$bounded_count = ga_job_event_journal(
    array("_job_events" => $merged),
    array("_job_event" => event_value(5, "energy_stream")),
    3,
    100000
);
$bounded_bytes = ga_job_event_journal(
    array(),
    array("_job_events" => array(
        event_value(1, "run", array("text" => str_repeat("x", 200))),
        event_value(2, "run", array("text" => "small"))
    )),
    10,
    300
);
$carried = ga_job_event_journal(
    array("_job_events" => $merged),
    array("_progress" => 0.5),
    10,
    100000
);
$invalid = ga_job_event_journal(
    array(),
    array("_job_event" => array("version" => 1, "sequence" => 1)),
    10,
    100000
);
$transient_event = event_value(5, "structure_preview");
$transient_event["channel"] = "structure";
$transient_event["replay"] = false;
$with_transient_marker = ga_job_event_journal(
    array("_job_events" => $merged),
    array("_job_event" => $transient_event),
    10,
    100000
);

echo json_encode(array(
    "merged" => $merged,
    "bounded_count" => $bounded_count,
    "bounded_bytes" => $bounded_bytes,
    "carried" => $carried,
    "invalid" => $invalid,
    "with_transient_marker" => $with_transient_marker,
));
PHP_BODY
close $fh;

my $syntax = `$php -l "$helper" 2>&1`;
is( $? >> 8, 0, 'job-event cache helper has valid PHP syntax' ) or diag($syntax);

my $output = `$php "$script" 2>&1`;
is( $? >> 8, 0, 'job-event cache helper executes' ) or diag($output);
my $data = eval { decode_json($output) };
ok( $data, 'job-event cache helper returns JSON' ) or diag($@ || $output);

if ($data) {
    is_deeply(
        [ map { $_->{sequence} } @{ $data->{merged} } ],
        [ 1, 2, 3, 4 ],
        'journal merges and orders cached, batch, and single events'
    );
    is( $data->{merged}[1]{payload}{text}, 'replacement', 'new duplicate sequence replaces the cached event' );
    is_deeply(
        [ map { $_->{sequence} } @{ $data->{bounded_count} } ],
        [ 3, 4, 5 ],
        'journal retains only the newest configured event count'
    );
    is_deeply(
        [ map { $_->{sequence} } @{ $data->{bounded_bytes} } ],
        [ 2 ],
        'journal drops oldest events until the byte budget is met'
    );
    is( scalar @{ $data->{carried} }, 4, 'non-event messages carry the existing replay journal forward' );
    is_deeply( $data->{invalid}, [], 'invalid event envelopes are not cached' );
    is_deeply(
        [ map { $_->{sequence} } @{ $data->{with_transient_marker} } ],
        [ 1, 2, 3, 4, 5 ],
        'non-replayable events retain a small sequence marker in the replay journal'
    );
    is(
        $data->{with_transient_marker}[4]{channel},
        'transient',
        'the replay marker cannot be rendered as the original structure event'
    );
    ok(
        $data->{with_transient_marker}[4]{payload}{omitted},
        'the replay marker records that transient content was omitted'
    );
    ok(
        !exists $data->{with_transient_marker}[4]{payload}{coordinates},
        'the replay marker contains no coordinate payload'
    );
}

done_testing();

sub php_string {
    my ($value) = @_;
    $value =~ s/\\/\\\\/g;
    $value =~ s/'/\\'/g;
    return "'$value'";
}

sub find_executable {
    my ($name) = @_;
    for my $dir ( split /:/, $ENV{PATH} || q{} ) {
        my $path = File::Spec->catfile( $dir, $name );
        return $path if -x $path;
    }
    return;
}
