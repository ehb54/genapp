use strict;
use warnings;

# Local HTTP integration, not live browser or SDL acceptance. The generated
# action and ordinary endpoints receive real multipart uploads. External job
# services and scientific executables are fixture doubles. Actual upload, receipt,
# request persistence, dispatch response and job completion code are exercised.
# LRFILE_STRICT=1 makes the pending action cleanup/audit contracts mandatory.
use File::Find;
use File::Path qw(make_path);
use File::Spec;
use FindBin;
use IO::Socket::INET;
use JSON::PP qw(decode_json encode_json);
use MIME::Base64 qw(encode_base64);
use POSIX qw(WNOHANG);
use Test::More;
use Time::HiRes qw(sleep);
use lib File::Spec->catdir($FindBin::Bin, 'lib');
use GenAppTest qw(find_executable generate_fixture_app php_executable read_file repo_root run_command);

my $php = php_executable();
my $curl = find_executable('curl');
plan skip_all => 'PHP and curl are required for real multipart checks' unless $php && $curl;
my $repo = repo_root($FindBin::Bin);
my $generated = generate_fixture_app(
    repo_root => $repo, fixture_name => 'action_button', genapp_args => ['--language', 'html5']);
is($generated->{status}, 0, 'generate disposable action fixture') or BAIL_OUT($generated->{output});
my $temporary = $generated->{temp_root};
my $web = File::Spec->catdir($generated->{app_dir}, qw(output html5));
my $bin = File::Spec->catdir($generated->{app_dir}, 'bin');
my $config = "$temporary/appconfig.json";
my $collector = "$temporary/audit.log";
my $sessions = "$temporary/sessions";
make_path($sessions);

sub write_file {
    my ($path, $text) = @_;
    open my $fh, '>', $path or die "write $path: $!";
    print {$fh} $text;
    close $fh or die "close $path: $!";
}
write_file($config, encode_json({resources => {host => {run => ''}, local => {run => ''}},
    resourcedefault => 'local', submitpolicy => 'login',
    messaging => {udphostip => '127.0.0.1', udpport => 9},
    audit => {enabled => JSON::PP::true, file_transfers => JSON::PP::true, destination => 'error_log'}}));
my %replacements = (
    '__docroot:html5__/action_button' => $web,
    '__executable_path:html5__' => $bin,
    '__appconfig__' => $config,
);
find({no_chdir => 1, wanted => sub {
    return unless -f $_ && /\.php$/;
    my $text = read_file($_);
    for my $token (keys %replacements) { $text =~ s/\Q$token\E/$replacements{$token}/g; }
    write_file($_, $text);
}}, $web);
my $executable = "$bin/precheck_action";
write_file($executable, "#!$^X\n" . <<'PERL');
use strict;
use warnings;
use JSON::PP;
my $request = decode_json(do { local $/; <STDIN> });
my $mode = $request->{sample};
my %bytes;
for my $field (qw(primary_file secondary_file)) {
    my $path = $request->{$field};
    $path = $path->[0] if ref($path) eq 'ARRAY';
    open my $input, '<', $path or die "fixture cannot read staged $field: $!";
    $bytes{$field} = do { local $/; <$input> };
    close $input;
    $request->{$field} = $path;
}
open my $capture, '>', "$request->{_action_workdir}/captured.json" or die $!;
print {$capture} encode_json({request => $request, bytes => \%bytes});
close $capture;
if ($mode eq 'bad_json') { print 'not JSON'; exit 0; }
my $result = {status => 'pass', summary => 'fixture completed'};
if ($mode ne 'accept') { $result->{error} = 'fixture validation failed'; }
if ($mode eq 'reject' || $mode eq 'nonzero_marker') {
    # A relationship failure marks a checked group. Only the local member is owned.
    $result->{_sassie_rejected_lrfiles} = [
        {field => 'primary_file', index => 0}, {field => 'secondary_file', index => 0}];
}
print encode_json($result);
exit($mode =~ /^nonzero/ ? 7 : 0);
PERL
chmod 0755, $executable or die $!;

# The entire generated ordinary handler runs. Only external database/ports,
# job registration and daemon launch are substituted. Uploads, normalization,
# receipts, request-file writes and the asynchronous response remain production code.
my $external = "$temporary/submission-services.php";
write_file($external, <<'PHP');
<?php namespace LrfileSubmitTest;
$results = array(); $ga_db_errors = '';
function ga_db_open(...$args) { return true; }
function ga_db_findOne(...$args) { return null; }
function ga_db_output($value) { return $value; }
function ga_db_insert(...$args) { return true; }
function ga_db_remove(...$args) { return true; }
function ga_db_status($value) { return true; }
function ga_getports(...$args) { return (object)array('status' => 'success'); }
function details(...$args) {}
function logjobstart(...$args) { return true; }
function error_log(...$args) { return true; }
function exec($command, &$output = null, &$result_code = null) {
    if (strpos($command, '/util/jobrun.php') === false) {
        throw new \RuntimeException('fixture refuses non-dispatch exec');
    }
    file_put_contents($GLOBALS['dir'] . '/dispatch-' . $_REQUEST['_uuid'] . '.json', json_encode($_REQUEST));
    $result_code = 0; return '';
}
function ga_record_rejected_lrfile_upload(&$entries, $module, $key, $index, $path, $root, $transfer = null) {
    $mode = $_REQUEST['sample'];
    if (($mode === 'record_failure' && $key === 'secondary_file') ||
        ($mode === 'array_record_failure' && $index === 1)) {
        file_put_contents($root . '/fault-injected', 'ownership'); return false;
    }
    return \ga_record_rejected_lrfile_upload($entries, $module, $key, $index, $path, $root, $transfer);
}
function ga_write_rejected_lrfile_receipt($path, $entries) {
    if ($_REQUEST['sample'] === 'receipt_failure') {
        file_put_contents($GLOBALS['dir'] . '/fault-injected', 'receipt'); return false;
    }
    return \ga_write_rejected_lrfile_receipt($path, $entries);
}
if (($_REQUEST['sample'] ?? '') === 'race_writer') {
    file_put_contents(__DIR__ . '/race/arrived', 'request entered');
}
PHP
my $ordinary = read_file("$web/ajax/demo/action_demo.php");
my $external_literal = encode_json($external);
$ordinary =~ s/<\?php/<?php namespace LrfileSubmitTest; require_once $external_literal;/;
my $service_count = ($ordinary =~ s{require_once\s+"[^"]*(?:getports|details|joblog)\.php";}{require_once $external_literal;}g);
is($service_count, 3, 'ordinary fixture substitutes only three external service includes');
write_file("$web/ordinary.php", $ordinary);

# Completion uses a separate process and the actual post-exec jobrun region.
# This boundary remains valid when cleanup moves outside the cancellation gate.
my $jobrun = read_file("$web/util/jobrun.php");
my ($completion) = $jobrun =~ /\$results = exec\( \$cmd \);(.*?)(?=^logjobupdate\( "finished")/ms;
BAIL_OUT('generated jobrun completion boundary changed') unless defined $completion;
write_file("$temporary/completion.inc", $completion);
my $cleanup_source = read_file("$web/util/rejected-lrfile.php");
$cleanup_source =~ s/<\?php/<?php namespace LrfileCompletionTest;/;
write_file("$temporary/cleanup-namespaced.php", $cleanup_source);
my $completion_script = "$temporary/complete.php";
write_file($completion_script, <<'PHP');
<?php namespace LrfileCompletionTest;
require __DIR__ . '/cleanup-namespaced.php';
require $argv[1];
function sendudptext($text) {}
function error_log(...$args) { return true; }
function unlink($path) {
    global $barrier, $upload;
    if ($barrier && $path === $upload) {
        file_put_contents($barrier . '/ready', 'identity checked; unlink pending');
        $deadline = microtime(true) + 8;
        while (!file_exists($barrier . '/release')) {
            if (microtime(true) > $deadline) { throw new \RuntimeException('fixture barrier timed out'); }
            usleep(10000);
        }
    }
    return \unlink($path);
}
$project = realpath($argv[2]); $id = $argv[3]; $mode = $argv[4];
$barrier = $argv[5] ?? '';
$submitted = json_decode(file_get_contents($project . '/dispatch-' . $id . '.json'), true);
$logdir = rtrim($submitted['_log_directory'], '/') . '/';
$receipt = ga_rejected_lrfile_receipt_path($logdir, $id);
$upload = $project . '/local-upload.dat';
$GLOBALS['logon'] = 'fixture_user';
$GLOBALS['module'] = 'action_demo';
$GLOBALS['getmenumoduledir'] = $project;
$GLOBALS['getmenumoduleproject'] = basename($project);
$GLOBALS['wascancelled'] = false;
$_REQUEST['_uuid'] = $id;
if ($mode !== 'inspect') {
    $results = $mode === 'parameter_error' ? '{"error":"unrelated bad form option"}'
        : '{"error":"file rejected","_sassie_rejected_lrfiles":[{"field":"primary_file","index":0},{"field":"secondary_file","index":0}]}';
    eval('namespace LrfileCompletionTest;' . file_get_contents(__DIR__ . '/completion.inc'));
}
echo json_encode(array('logdir' => $logdir, 'receipt_exists' => is_file($receipt),
    'receipt' => is_file($receipt) ? json_decode(file_get_contents($receipt), true) : null));
PHP

# The other three storage writers use the same authenticated fixture user.
# Keep their actual HTTP handlers; substitute only their job registry/mail dependencies.
my $storage_services = "$temporary/storage-services.php";
my $storage_stub = <<'PHP';
<?php namespace LrfileStorageWriterTest;
function error_log(...$args) { return true; }
function error_mail(...$args) { throw new \RuntimeException('fixture mail path reached'); }
function active_project_names(...$args) { return array(); }
function get_projects(...$args) { return array(); }
function get_projects_locked(...$args) { return array(); }
function job_saved_path_is_removed(...$args) { return array(); }
function getprojectdir($id) {
    $GLOBALS['getprojectdir'] = __USER_ROOT__ . '/' . $_REQUEST['_project'];
    $GLOBALS['getprojectdirproject'] = $_REQUEST['_project'];
    return true;
}
PHP
my $user_root_literal = encode_json("$web/results/users/fixture_user");
$storage_stub =~ s/__USER_ROOT__/$user_root_literal/g;
write_file($storage_services, $storage_stub);
my $storage_literal = encode_json($storage_services);
for my $name (qw(uploader sys_files)) {
    my @matches;
    find({no_chdir => 1, wanted => sub { push @matches, $_ if -f $_ && /\/$name\.php$/; }}, "$web/ajax");
    is(scalar @matches, 1, "generated $name handler is available for contention checks")
        or BAIL_OUT("missing or ambiguous generated $name handler");
    my $source = read_file($matches[0]);
    $source =~ s/<\?php/<?php namespace LrfileStorageWriterTest; require_once $storage_literal;/;
    $source =~ s{require(?:_once)?\s+['"][^'"]*(?:joblog|mail)\.php['"];}{require_once $storage_literal;}g;
    write_file("$web/storage-$name.php", $source);
}
write_file("$temporary/router.php", <<'PHP');
<?php
$writer = $_REQUEST['_fixture_writer'] ?? '';
if (in_array($writer, array('action', 'uploader', 'manager'), true)) {
    file_put_contents(__DIR__ . '/race-' . $writer . '/arrived', 'request entered');
}
return false;
PHP

my $session_id = 'lrfiletest' . $$;
my $session_code = 'session_name("GENAPP_ACTION_BUTTON"); session_id($argv[1]); session_start(); '
    . '$_SESSION["test-window"] = array("logon" => "fixture_user", "project" => "fixture_project"); session_write_close();';
my ($session_status, $session_output) = run_command(cwd => $temporary, cmd => [
    $php, '-d', "session.save_path=$sessions", '-r', $session_code, $session_id]);
is($session_status, 0, 'create isolated fixture session without a live account') or BAIL_OUT($session_output);
my $probe = IO::Socket::INET->new(LocalAddr => '127.0.0.1', LocalPort => 0, Listen => 1, Proto => 'tcp')
    or BAIL_OUT("cannot reserve loopback port: $!");
my $port = $probe->sockport;
close $probe;
my $pid = fork();
defined $pid or BAIL_OUT("fork PHP server: $!");
if (!$pid) {
    open STDOUT, '>', "$temporary/http.log" or die $!;
    open STDERR, '>&', \*STDOUT or die $!;
    delete $ENV{PHP_CLI_SERVER_WORKERS};
    exec $php, '-d', "session.save_path=$sessions", '-d', "error_log=$collector",
        '-d', "sys_temp_dir=$temporary", '-d', "upload_tmp_dir=$temporary",
        '-d', 'display_errors=0', '-d', 'log_errors=1',
        '-S', "127.0.0.1:$port", '-t', $web, "$temporary/router.php";
    die "exec PHP server: $!";
}
END { local $?; if ($pid) { kill 'TERM', $pid; waitpid($pid, 0); } }
my $ready;
for (1 .. 100) {
    my $socket = IO::Socket::INET->new(PeerAddr => '127.0.0.1', PeerPort => $port, Proto => 'tcp', Timeout => 0.1);
    if ($socket) { close $socket; $ready = 1; last; }
    sleep 0.05;
}
ok($ready, 'PHP HTTP fixture listens only on loopback') or BAIL_OUT(read_file("$temporary/http.log"));
my $user_root = "$web/results/users/fixture_user";
make_path("$user_root/stored");
write_file("$user_root/stored/server.dat", "server-selection\n");
my $local_file = "$temporary/local-upload.dat";
write_file($local_file, "browser-upload\n");

sub submit {
    my ($mode, $authenticated) = @_;
    my @command = ($curl, '--silent', '--show-error', '--max-time', '15', '--noproxy', '*');
    push @command, '--cookie', "GENAPP_ACTION_BUTTON=$session_id" if $authenticated;
    my %fields = (
        _window => 'test-window', _logon => 'fixture_user', _project => "project_$mode",
        _uuid => "request-$mode", _action => 'precheck', sample => $mode,
        input_mode => 'c2', part_count => 0,
        _selaltval_secondary_file => 'secondary_file_altval',
        'secondary_file_altval[]' => encode_base64('./stored/server.dat', ''),
    );
    for my $name (sort keys %fields) { push @command, '--form-string', "$name=$fields{$name}"; }
    push @command, '--form', "primary_file=\@$local_file;filename=local-upload.dat",
        "http://127.0.0.1:$port/ajax/action/action_demo.php";
    my ($status, $output) = run_command(cwd => $temporary, cmd => \@command);
    is($status, 0, "HTTP request completes: $mode") or diag $output;
    my $payload = eval { decode_json($output) };
    ok(ref($payload) eq 'HASH', "HTTP response is one JSON object: $mode") or BAIL_OUT($output);
    return $payload;
}

for my $mode (qw(accept parameter_error reject nonzero_marker nonzero_plain bad_json)) {
    my $payload = submit($mode, 1);
    my $capture_path = "$user_root/project_$mode/_actions/action_demo/precheck/captured.json";
    ok(-f $capture_path, "actual action executable was reached: $mode")
        or BAIL_OUT(encode_json($payload) . read_file("$temporary/http.log"));
    my $capture = decode_json(read_file($capture_path));
    is($capture->{bytes}{primary_file}, "browser-upload\n", "real multipart bytes reached executable: $mode");
    is($capture->{bytes}{secondary_file}, "server-selection\n", "server file reached executable: $mode");
    is(read_file("$user_root/stored/server.dat"), "server-selection\n", "server selection is preserved: $mode");
    my $uploaded = $capture->{request}{primary_file};
    if ($mode eq 'reject' || $mode eq 'nonzero_marker') {
        {

            ok(!-e $uploaded, "pending explicit rejection deletes the local group member: $mode");
        }
    } else {
        ok(-f $uploaded, "no explicit file rejection preserves uploaded bytes: $mode");
        is(read_file($uploaded), "browser-upload\n", "preserved upload has original contents: $mode");
    }
    my @records = map { decode_json($_) } map { /GENAPP_AUDIT (\{.*\})\s*$/ }
        split /\n/, read_file($collector);
    my @own = grep { ($_->{project} || '') eq "project_$mode" } @records;
    my @accepted = grep { $_->{event} eq 'upload_succeeded' } @own;
    is(scalar @accepted, 1, "only the browser upload has an upload event: $mode");
    my @rejected = grep { $_->{event} eq 'upload_failed' } @own;
    my @cleanup = grep { $_->{event} eq 'rejected_upload_cleanup' } @own;
    if ($mode eq 'reject' || $mode eq 'nonzero_marker') {
        {

            is(scalar @rejected, 1, "pending one rejection record for the local upload: $mode");
            is(scalar @cleanup, 1, "pending independent cleanup outcome record: $mode");
            ok(@rejected && @cleanup && $accepted[0]{transfer_id}
                && ($rejected[0]{transfer_id} || '') eq $accepted[0]{transfer_id}
                && ($cleanup[0]{transfer_id} || '') eq $accepted[0]{transfer_id}
                && ($cleanup[0]{outcome} || '') eq 'deleted',
                "pending records correlate and claim actual deletion: $mode");
        }
    } else {
        is(scalar @rejected + scalar @cleanup, 0, "no false rejection/deletion audit: $mode");
    }
}
my $unauthorized = submit('unauthorized', 0);
ok(exists $unauthorized->{error} || ($unauthorized->{_logon} // 'unexpected') eq '',
    'request without the fixture session is refused');
ok(!-e "$user_root/project_unauthorized", 'unauthenticated upload does not reach staging');
sub ordinary_command {
    my ($mode, $project, $uuid, $source) = @_;
    $source ||= $local_file;
    my @command = ($curl, '--silent', '--show-error', '--max-time', '15', '--noproxy', '*',
        '--cookie', "GENAPP_ACTION_BUTTON=$session_id");
    my %fields = (_window => 'test-window', _logon => 'fixture_user', _project => $project,
        _uuid => $uuid, sample => $mode, input_mode => 'c2', part_count => 0);
    if ($mode ne 'record_failure') {
        $fields{_selaltval_secondary_file} = 'secondary_file_altval';
        $fields{'secondary_file_altval[]'} = encode_base64('./stored/server.dat', '');
    }
    for my $name (sort keys %fields) { push @command, '--form-string', "$name=$fields{$name}"; }
    my $field = $mode eq 'array_record_failure' ? 'primary_file[]' : 'primary_file';
    push @command, '--form', "$field=\@$source;filename=local-upload.dat";
    push @command, '--form', "primary_file[]=\@$source;filename=second-upload.dat" if $mode eq 'array_record_failure';
    push @command, '--form', "secondary_file=\@$source;filename=second-upload.dat" if $mode eq 'record_failure';
    push @command, "http://127.0.0.1:$port/ordinary.php";
    return @command;
}
sub ordinary_request {
    my ($mode, $project, $uuid, $source) = @_;
    my ($status, $body) = run_command(cwd => $temporary,
        cmd => [ordinary_command($mode, $project, $uuid, $source)]);
    is($status, 0, "ordinary multipart request completes: $mode") or diag $body;
    my $payload = eval { decode_json($body) };
    ok(ref($payload) eq 'HASH', "ordinary response is JSON: $mode") or do { $body =~ s/[\r\n]+/ /g; BAIL_OUT($body); };
    return $payload;
}
sub completion_command {
    my ($project, $uuid, $mode, $barrier) = @_;
    return ($php, '-d', "sys_temp_dir=$temporary", '-d', "error_log=$collector",
        $completion_script, "$web/ajax/sys_config/ga_audit.php", "$user_root/$project", $uuid, $mode, $barrier || '');
}
sub complete_request {
    my ($project, $uuid, $mode) = @_;
    my ($status, $body) = run_command(cwd => $temporary,
        cmd => [completion_command($project, $uuid, $mode)]);
    is($status, 0, "ordinary completion/inspection executes: $mode") or diag $body;
    my $payload = eval { decode_json($body) };
    ok(ref($payload) eq 'HASH', "ordinary completion returns JSON: $mode") or do { $body =~ s/[\r\n]+/ /g; BAIL_OUT($body); };
    return $payload;
}

for my $mode (qw(reject parameter_error)) {
    my ($project, $uuid) = ("ordinary_$mode", "ordinary-$mode");
    my $response = ordinary_request($mode, $project, $uuid);
    is($response->{_status}, 'started', "ordinary handler acknowledges asynchronous start: $mode");
    my $capture = "$user_root/$project/dispatch-$uuid.json";
    ok(-f $capture, "ordinary handler reaches dispatch: $mode") or BAIL_OUT(encode_json($response));
    my $submitted = decode_json(read_file($capture));
    my $before = complete_request($project, $uuid, 'inspect');
    ok($before->{receipt_exists}, "started response retains upload ownership: $mode");
    is_deeply([map { +{field => $_->{field}, index => $_->{index}} } @{$before->{receipt}{uploads}}],
        [{field => 'primary_file', index => 0}], "receipt excludes server selection: $mode");
    is(read_file("$user_root/$project/local-upload.dat"), "browser-upload\n", "ordinary multipart bytes preserved before completion: $mode");
    complete_request($project, $uuid, $mode);
    if ($mode eq 'reject') {
        ok(!-e "$user_root/$project/local-upload.dat", 'ordinary marked browser upload is deleted');
    } else {
        is(read_file("$user_root/$project/local-upload.dat"), "browser-upload\n", 'ordinary form failure preserves the upload');
    }
    is(read_file("$user_root/stored/server.dat"), "server-selection\n", "ordinary completion preserves server selection: $mode");
}

# Exercise both ownership-recording sites and the receipt-persistence failure.
for my $mode (qw(record_failure array_record_failure receipt_failure)) {
    my ($project, $uuid) = ("ordinary_$mode", "ordinary-$mode");
    my $response = ordinary_request($mode, $project, $uuid);
    is($response->{_status}, 'failed', "ownership failure stops dispatch: $mode");
    ok(-f "$user_root/$project/fault-injected", "failure injection was reached: $mode");
    ok(!-e "$user_root/$project/dispatch-$uuid.json", "no job launched after ownership failure: $mode");
    {

        ok(-f "$user_root/$project/local-upload.dat" && read_file("$user_root/$project/local-upload.dat") eq "browser-upload\n", "pending preserve earlier/current upload on $mode");
        ok(-f "$user_root/$project/second-upload.dat" && read_file("$user_root/$project/second-upload.dat") eq "browser-upload\n", "pending preserve failing upload on $mode")
            if $mode ne 'receipt_failure';
    }
}

my $duplicate_project = 'ordinary_duplicate';
ordinary_request('accept', $duplicate_project, 'duplicate-id');
my $duplicate_before = complete_request($duplicate_project, 'duplicate-id', 'inspect');
my $request_file = $duplicate_before->{logdir} . "_input_duplicate-id";
my $request_before = read_file($request_file);
my $replacement_source = "$temporary/replacement.dat";
write_file($replacement_source, "replacement-browser-upload\n");
my $duplicate = ordinary_request('duplicate', $duplicate_project, 'duplicate-id', $replacement_source);
my $duplicate_after = complete_request($duplicate_project, 'duplicate-id', 'inspect');
{

    is($duplicate->{_status}, 'failed', 'duplicate submission is refused');
    is(read_file("$user_root/$duplicate_project/local-upload.dat"), "browser-upload\n", 'duplicate cannot replace uploaded bytes');
    is(read_file($request_file), $request_before, 'duplicate cannot replace saved request');
    is_deeply($duplicate_after->{receipt}, $duplicate_before->{receipt}, 'duplicate cannot replace ownership receipt');
}

# Deterministic identity-check/unlink interleaving. Cleanup pauses at unlink;
# a second process runs the real ordinary upload handler for the same user/path.
# Correct locking either delays that writer or refuses it visibly. It must
# never allow the paused cleanup to unlink the newly published replacement.
my $race = "$temporary/race"; make_path($race);
ordinary_request('accept', 'ordinary_race', 'race-first');
my @children;
sub launch_child {
    my ($output, @command) = @_;
    my $child = fork(); defined $child or BAIL_OUT("fork fixture: $!");
    if (!$child) {
        $pid = undef; @children = ();
        open STDOUT, '>', $output or die $!;
        open STDERR, '>', "$output.err" or die $!;
        exec @command; die "exec fixture: $!";
    }
    push @children, $child;
    return $child;
}
sub wait_for_file {
    my ($path) = @_;
    for (1 .. 500) { return 1 if -f $path; sleep 0.01; }
    return 0;
}
sub finish_child {
    my ($child) = @_;
    for (1 .. 1000) {
        if (waitpid($child, WNOHANG) == $child) {
            my $status = $?; @children = grep { $_ != $child } @children; return $status;
        }
        sleep 0.01;
    }
    kill 'TERM', $child; waitpid($child, 0);
    @children = grep { $_ != $child } @children;
    BAIL_OUT('fixture child timed out');
}
END { local $?; for my $child (@children) { kill 'TERM', $child; waitpid($child, 0); } }
my $cleaner = launch_child("$race/cleanup.json", completion_command('ordinary_race', 'race-first', 'reject', $race));
ok(wait_for_file("$race/ready"), 'cleanup reaches controlled post-identity unlink boundary')
    or BAIL_OUT(read_file("$race/cleanup.json.err"));
my $writer = launch_child("$race/writer.json", ordinary_command('race_writer', 'ordinary_race', 'race-second', $replacement_source));
ok(wait_for_file("$race/arrived"), 'competing ordinary writer entered the handler') or BAIL_OUT('writer did not enter');
sleep 0.25; # bounded contention observation after both explicit barriers
my $during = -f "$user_root/ordinary_race/local-upload.dat" ? read_file("$user_root/ordinary_race/local-upload.dat") : '';
write_file("$race/release", 'continue');
is(finish_child($cleaner), 0, 'cleanup process finishes and releases its resources');
is(finish_child($writer), 0, 'competing request finishes without a deadlock');
my $writer_result = decode_json(read_file("$race/writer.json"));
ok(($writer_result->{_status} || '') =~ /^(started|failed)$/, 'contending writer gives a visible result');
{

    is($during, "browser-upload\n", 'writer cannot replace bytes inside cleanup mutation interval');
    my $safe_result = $writer_result->{_status} eq 'failed'
        ? !-e "$user_root/ordinary_race/local-upload.dat"
        : (-f "$user_root/ordinary_race/local-upload.dat"
           && read_file("$user_root/ordinary_race/local-upload.dat") eq "replacement-browser-upload\n");
    ok($safe_result, 'cleanup never deletes a newly published replacement');
}

for my $kind (qw(action uploader manager)) {
    my $barrier = "$temporary/race-$kind"; make_path($barrier);
    my $project = "ordinary_race_$kind";
    my $uuid = "race-first-$kind";
    ordinary_request('accept', $project, $uuid);
    my $target = $kind eq 'action'
        ? "$user_root/$project/_actions/action_demo/precheck/files/primary_file-local-upload.dat"
        : $kind eq 'uploader' ? "$user_root/$project/uploads/storage-upload.dat"
        : "$user_root/$project/victim.txt";
    write_file($target, 'file manager victim') if $kind eq 'manager';
    my %fields = (_window => 'test-window', _logon => 'fixture_user',
        _project => $project, _uuid => "writer-$kind", _fixture_writer => $kind);
    my @files;
    my $endpoint;
    if ($kind eq 'action') {
        %fields = (%fields, _action => 'precheck', sample => 'accept', input_mode => 'c2', part_count => 0,
            _selaltval_secondary_file => 'secondary_file_altval',
            'secondary_file_altval[]' => encode_base64('./stored/server.dat', ''));
        @files = ('--form', "primary_file=\@$replacement_source;filename=local-upload.dat");
        $endpoint = 'ajax/action/action_demo.php';
    } elsif ($kind eq 'uploader') {
        @files = ('--form', "inputfile=\@$replacement_source;filename=storage-upload.dat");
        $endpoint = 'storage-uploader.php';
    } else {
        %fields = (%fields, _spec => 'fc_cache', _spec_dir => encode_base64('.', ''),
            _delete => encode_base64("./$project/victim.txt", ''));
        $endpoint = 'storage-sys_files.php';
    }
    my @command = ($curl, '--silent', '--show-error', '--max-time', '15', '--noproxy', '*',
        '--cookie', "GENAPP_ACTION_BUTTON=$session_id");
    for my $name (sort keys %fields) { push @command, '--form-string', "$name=$fields{$name}"; }
    push @command, @files, "http://127.0.0.1:$port/$endpoint";
    my $cleaner = launch_child("$barrier/cleanup.json", completion_command($project, $uuid, 'reject', $barrier));
    ok(wait_for_file("$barrier/ready"), "cleanup is paused with identity checked: $kind") or BAIL_OUT(read_file("$barrier/cleanup.json.err"));
    my $writer = launch_child("$barrier/writer.json", @command);
    ok(wait_for_file("$barrier/arrived"), "competing $kind request entered") or BAIL_OUT('writer did not enter');
    sleep 0.25;
    my $unchanged = $kind eq 'manager' ? -f $target : !-e $target;
    write_file("$barrier/release", 'continue');
    is(finish_child($cleaner), 0, "cleanup releases resources for $kind writer");
    is(finish_child($writer), 0, "$kind writer finishes without deadlock");
    my $body = read_file("$barrier/writer.json");
    my $payload = eval { decode_json($body) };
    ok(ref($payload) eq 'HASH' || ref($payload) eq 'ARRAY', "$kind writer returns JSON")
        or do { $body =~ s/[\r\n]+/ /g; BAIL_OUT($body); };
    my $failed = ref($payload) eq 'HASH' && $payload->{error};
    if ($failed) {
        ok($kind eq 'manager' ? -f $target : !-e $target,
            "$kind contention failure does not publish a mutation");
    } else {
        ok($kind eq 'manager' ? !-e $target : -f $target,
            "$kind actual operation completes after contention observation");
    }
    {

        ok($unchanged, "pending $kind writer cannot mutate while cleanup owns the user storage interval");
    }
}

done_testing();


=head1 RUNNING THE PRE-IMPLEMENTATION SUITE

From the GenApp checkout:

  prove t/unit_tests/rejected_lrfile_cleanup.t t/unit_tests/file_transfer_audit.t t/rejected_input_upload_http.t t/html5_php_templates.t

From the paired genapp_zazzie checkout, using its prescribed Python environment:

  python -B -m unittest sassie_genapp_tests.hook_tests.tests.test_data_interpolation_driver_runtime sassie_genapp_tests.test_nist_deployment

All rejection, preservation, concurrency and failure-path checks are mandatory.
LRFILE_STRICT=1 remains accepted for existing run commands; there are no expected
failures in this suite after the shared/pilot implementation.

Dependencies: PHP (override with PHP=/path/to/php), Perl and curl. The Python
tests load pure source components from ../zazzie, overridable with
SASSIE_SOURCE_ROOT. They do not install SASSIE or execute scientific jobs.

Coverage includes owned file coordinates, group/repeated selection, malformed
markers, sibling/server preservation, replacement/replay protection, audit
ordering and retry evidence, cancellation, actual ordinary/action uploads,
started-receipt retention, ownership-recording failures, duplicate submission
side effects, all four writer contention paths, filter branches, parameter-only
and early-grid errors, and deployment backup/hash controls. PHP diagnostic HTML
is disabled in the private HTTP server; errors are retained in its private log.

This suite does not prove the other 33 module integrations, the real database/
daemon lifecycle, every writer rollback/timeout branch, crash recovery, browser
reattachment, numerical output parity, or delivery to the real SDL collector.
Those remain implementation/acceptance checks. The local audit collector tests
the real emitter's envelope and sink response, not rsyslog forwarding.

=cut
