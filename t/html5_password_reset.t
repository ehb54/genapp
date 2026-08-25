use strict;
use warnings;

use File::Spec;
use File::Temp qw(tempdir);
use FindBin;
use JSON::PP qw(decode_json encode_json);
use Test::More;

use lib File::Spec->catdir( $FindBin::Bin, 'lib' );
use GenAppTest qw(repo_root);

my $php = $ENV{PHP} || find_executable('php');
plan skip_all => 'php is not available on PATH; password-reset contract checks are deferred' if !$php;

my $repo_root = repo_root($FindBin::Bin);
my @templates = map {
    File::Spec->catfile( $repo_root, qw(languages html5 sys), $_ )
} qw(sys_login.php sys_login_globus.php sys_login_google.php);

for my $template (@templates) {
    my $source = read_file($template);
    like( $source, qr/bin2hex\( random_bytes\( 16 \) \)/, "$template uses cryptographically secure reset credentials" );
    like( $source, qr/password_reset_hash/, "$template stores a pending reset hash" );
    like( $source, qr/\$loginusingpendingreset/, "$template recognizes a pending reset login" );
    unlike( $source, qr/"password"\s*=>\s*\$doc\[ 'password' \]/, "$template does not replace the permanent password during reset request" );
}

my $root = tempdir( CLEANUP => 1 );
my $app_dir = File::Spec->catdir( $root, 'app' );
my $ajax_dir = File::Spec->catdir( $app_dir, 'ajax' );
my $sys_dir = File::Spec->catdir( $ajax_dir, 'sys_config' );
mkdir $app_dir or die "mkdir $app_dir: $!";
mkdir $ajax_dir or die "mkdir $ajax_dir: $!";
mkdir $sys_dir or die "mkdir $sys_dir: $!";

my $handler = File::Spec->catfile( $sys_dir, 'sys_login.php' );
render_handler( $templates[0], $handler, $root );

write_file( File::Spec->catfile( $ajax_dir, 'ga_db_lib.php' ), <<'PHP' );
<?php
function ga_db_open($unused = false) { return true; }
function ga_db_output($value) { return $value; }
function ga_db_date() { return 1000; }
function ga_db_date_add_secs($when, $seconds) { return $when + $seconds; }
function ga_db_status($value) { return $value; }
function ga_db_findOne($collection, $app, $query, $projection = [], $options = [], $unused = false) {
    if ($collection !== 'users') { return null; }
    foreach ($query as $key => $value) {
        if (!array_key_exists($key, $GLOBALS['record']) || $GLOBALS['record'][$key] !== $value) { return null; }
    }
    return $GLOBALS['record'];
}
function ga_db_update($collection, $app, $query, $update, $options = []) {
    if ($collection !== 'users') { return true; }
    foreach ($query as $key => $value) {
        if (!array_key_exists($key, $GLOBALS['record']) || $GLOBALS['record'][$key] !== $value) { return false; }
    }
    foreach (($update['$set'] ?? []) as $key => $value) { $GLOBALS['record'][$key] = $value; }
    foreach (($update['$unset'] ?? []) as $key => $value) { unset($GLOBALS['record'][$key]); }
    foreach (($update['$inc'] ?? []) as $key => $value) { $GLOBALS['record'][$key] = ($GLOBALS['record'][$key] ?? 0) + $value; }
    file_put_contents($GLOBALS['record_path'], json_encode($GLOBALS['record']));
    return true;
}
PHP

write_file( File::Spec->catfile( $ajax_dir, 'ga_filter.php' ), <<'PHP' );
<?php
function ga_sanitize_validate($module, $request, $module_id) { return ['output' => 'ok']; }
PHP

write_file( File::Spec->catfile( $ajax_dir, 'mail.php' ), <<'PHP' );
<?php
function mymail($to, $subject, $body) {
    file_put_contents($GLOBALS['mail_path'], json_encode(['to' => $to, 'subject' => $subject, 'body' => $body]));
    return $GLOBALS['mail_failure'];
}
PHP

my $runner = File::Spec->catfile( $root, 'run_login.php' );
write_file( $runner, <<'PHP' );
<?php
$GLOBALS['record_path'] = $argv[1];
$GLOBALS['mail_path'] = $argv[2];
$GLOBALS['mail_failure'] = $argv[3] === '1';
$GLOBALS['record'] = json_decode(file_get_contents($GLOBALS['record_path']), true);
$_REQUEST = json_decode(file_get_contents($argv[4]), true);
$_SERVER['REMOTE_ADDR'] = '127.0.0.1';
session_save_path(dirname($GLOBALS['record_path']));
session_id('password-reset-contract-' . substr(md5($argv[4]), 0, 12));
ini_set('display_errors', '0');
error_reporting(E_ALL & ~E_DEPRECATED);
chdir(dirname($argv[5]));
require basename($argv[5]);
PHP

my $permanent_password = 'current-password-123';
my $permanent_hash = php_password_hash( $php, $permanent_password );
my $base_record = {
    name => 'tester',
    email => 'tester@example.test',
    password => $permanent_hash,
};

for my $index ( 1 .. $#templates ) {
    my $variant_handler = File::Spec->catfile( $sys_dir, "variant-$index.php" );
    render_handler( $templates[$index], $variant_handler, $root );
    my ( undef, $variant_record, $variant_mail ) = run_handler(
        $php, $runner, $variant_handler, $root, $base_record,
        { _window => "variant-$index", userid => 'tester', forgotpassword => 'on' }, 0,
    );
    is( $variant_record->{password}, $permanent_hash, "$templates[$index] leaves the permanent password unchanged" );
    my ($variant_password) = $variant_mail->{body} =~ /^Now: ([0-9a-f]+)$/m;
    $variant_record->{lastfailedloginattempts} = 5;
    $variant_record->{expiretime} = 999;
    $variant_record->{expiretimes} = 0;
    my ( $variant_reply, $variant_promoted_record ) = run_handler(
        $php, $runner, $variant_handler, $root, $variant_record,
        { _window => "variant-promotion-$index", userid => 'tester', password => $variant_password }, 0,
    );
    like( $variant_reply->{status}, qr/Login successful/, "$templates[$index] pending credential bypasses stale expiry and failed-attempt markers" );
    ok( !exists $variant_reply->{'-close'}, "$templates[$index] keeps the password-change handoff active" );
    ok( php_password_verify( $php, $variant_password, $variant_promoted_record->{password} ), "$templates[$index] promotes the pending credential" );
    is( $variant_promoted_record->{expiretimes}, 0, "$templates[$index] replaces the stale use count without decrementing it" );
    ok( !exists $variant_promoted_record->{password_reset_hash}, "$templates[$index] clears the pending reset" );
}

my ( $reset_reply, $reset_record, $reset_mail ) = run_handler(
    $php, $runner, $handler, $root, $base_record,
    { _window => 'reset', userid => 'tester', forgotpassword => 'on' }, 0,
);
is( $reset_record->{password}, $permanent_hash, 'accepted reset mail leaves the permanent password unchanged' );
ok( exists $reset_record->{password_reset_hash}, 'accepted reset mail stores a pending credential' );
like( $reset_reply->{status}, qr/Check your registered email address/, 'accepted reset reports the existing delivery status' );
my ($temporary_password) = $reset_mail->{body} =~ /^Now: ([0-9a-f]+)$/m;
ok( defined $temporary_password, 'mail body carries the generated temporary credential' );

my ( $old_login_reply, $old_login_record ) = run_handler(
    $php, $runner, $handler, $root, $reset_record,
    { _window => 'old-login', userid => 'tester', password => $permanent_password }, 0,
);
like( $old_login_reply->{status}, qr/Login successful/, 'permanent password remains usable while reset is pending' );
ok( exists $old_login_reply->{'-close'}, 'permanent-password login may close the ordinary login dialog' );
ok( !exists $old_login_record->{password_reset_hash}, 'permanent-password login cancels the pending reset' );

my ( undef, $promotion_reset_record, $promotion_mail ) = run_handler(
    $php, $runner, $handler, $root, $base_record,
    { _window => 'promotion-reset', userid => 'tester', forgotpassword => 'on' }, 0,
);
my ($promotion_password) = $promotion_mail->{body} =~ /^Now: ([0-9a-f]+)$/m;
$promotion_reset_record->{lastfailedloginattempts} = 5;
$promotion_reset_record->{expiretime} = 999;
$promotion_reset_record->{expiretimes} = 0;
my ( $promotion_reply, $promotion_record ) = run_handler(
    $php, $runner, $handler, $root, $promotion_reset_record,
    { _window => 'promotion-login', userid => 'tester', password => $promotion_password }, 0,
);
like( $promotion_reply->{status}, qr/Login successful/, 'pending credential bypasses stale expiry and failed-attempt markers' );
ok( !exists $promotion_reply->{'-close'}, 'pending credential keeps the password-change handoff active' );
ok( php_password_verify( $php, $promotion_password, $promotion_record->{password} ), 'pending credential is promoted only after it authenticates' );
is( $promotion_record->{expiretimes}, 0, 'promoted credential replaces the stale use count without decrementing it' );
ok( !exists $promotion_record->{password_reset_hash}, 'promotion clears the pending reset' );

my $expired_record = {
    %{$base_record},
    password_reset_hash => php_password_hash( $php, 'expired-password-123' ),
    password_reset_expires => 999,
};
my ( $expired_reply ) = run_handler(
    $php, $runner, $handler, $root, $expired_record,
    { _window => 'expired-login', userid => 'tester', password => 'expired-password-123' }, 0,
);
unlike( $expired_reply->{status}, qr/Login successful/, 'expired pending credential cannot authenticate' );

my ( $failed_mail_reply, $failed_mail_record ) = run_handler(
    $php, $runner, $handler, $root, $base_record,
    { _window => 'failed-mail', userid => 'tester', forgotpassword => 'on' }, 1,
);
is( $failed_mail_record->{password}, $permanent_hash, 'explicit mail failure leaves the permanent password unchanged' );
ok( !exists $failed_mail_record->{password_reset_hash}, 'explicit mail failure rolls back the pending reset' );
like( $failed_mail_reply->{status}, qr/Unable to login or send password email/, 'explicit mail failure remains visible to the user' );

done_testing();

sub run_handler {
    my ( $php, $runner, $handler, $root, $record, $request, $mail_failure ) = @_;
    my $token = int(rand(1_000_000_000));
    my $record_path = File::Spec->catfile( $root, "record-$token.json" );
    my $mail_path = File::Spec->catfile( $root, "mail-$token.json" );
    my $request_path = File::Spec->catfile( $root, "request-$token.json" );
    write_file( $record_path, encode_json($record) );
    write_file( $request_path, encode_json($request) );
    open my $output, '-|', $php, $runner, $record_path, $mail_path, $mail_failure, $request_path, $handler
        or die "cannot run PHP handler: $!";
    my $reply = do { local $/; <$output> };
    close $output or die "PHP handler failed: $?";
    my $updated_record = decode_json( read_file($record_path) );
    my $mail = -e $mail_path ? decode_json( read_file($mail_path) ) : {};
    return ( decode_json($reply), $updated_record, $mail );
}

sub read_file {
    my ($path) = @_;
    open my $handle, '<', $path or die "open $path: $!";
    local $/;
    return <$handle>;
}

sub write_file {
    my ( $path, $contents ) = @_;
    open my $handle, '>', $path or die "open $path: $!";
    print {$handle} $contents or die "write $path: $!";
    close $handle or die "close $path: $!";
}

sub find_executable {
    my ($name) = @_;
    for my $directory ( split /:/, $ENV{PATH} || q{} ) {
        my $path = File::Spec->catfile( $directory, $name );
        return $path if -x $path;
    }
    return;
}

sub render_handler {
    my ( $template, $handler, $root ) = @_;
    my $source = read_file($template);
    $source =~ s/__docroot:html5__/$root/g;
    $source =~ s/__application__/app/g;
    $source =~ s/__modulejson__/\{"fields":\[\]\}/g;
    $source =~ s/__menu:modules:id__/sys_login/g;
    $source =~ s/__~register:verifyemail\{1\}0/0/g;
    $source =~ s/__~register:requireapproval\{1\}0/0/g;
    $source =~ s/__~usercolors\{1\}0/0/g;
    $source =~ s/__~xsedeproject\{1\}0/0/g;
    $source =~ s/__~debug:basemylog\{[^\n]*\}//g;
    write_file( $handler, $source );
}

sub php_password_hash {
    my ( $php, $password ) = @_;
    open my $output, '-|', $php, '-r', 'echo password_hash($argv[1], PASSWORD_DEFAULT);', $password
        or die "cannot run PHP password_hash: $!";
    my $hash = do { local $/; <$output> };
    close $output or die "PHP password_hash failed: $?";
    return $hash;
}

sub php_password_verify {
    my ( $php, $password, $hash ) = @_;
    open my $output, '-|', $php, '-r', 'echo password_verify($argv[1], $argv[2]) ? "1" : "0";', $password, $hash
        or die "cannot run PHP password_verify: $!";
    my $verified = do { local $/; <$output> };
    close $output or die "PHP password_verify failed: $?";
    return $verified eq '1';
}
