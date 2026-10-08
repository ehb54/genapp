use strict;
use warnings;

use File::Path qw(make_path);
use File::Spec;
use File::Temp qw(tempdir);
use FindBin;
use Test::More;

use lib File::Spec->catdir( $FindBin::Bin, '..', 'lib' );
use GenAppTest qw(php_executable repo_root);

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
my $output = qx{$php "$script" "$helper" "$root"};
is( $?, 0, 'audit helper runs under the supported PHP interpreter' );
is( $output, '[true,true,true,true]',
    'download resolver accepts only existing files in the authenticated user tree' );

like( $source, qr/GENAPP_AUDIT/, 'audit records use the stable collector prefix' );
unlike( $source, qr/HTTP_X_FORWARDED_FOR/, 'untrusted forwarding headers are not logged as source identity' );

done_testing();
