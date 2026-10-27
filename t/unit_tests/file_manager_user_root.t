use strict;
use warnings;

use Cwd qw(abs_path);
use File::Path qw(make_path);
use File::Spec;
use File::Temp qw(tempdir tempfile);
use FindBin;
use Test::More;

use lib File::Spec->catdir( $FindBin::Bin, '..', 'lib' );
use GenAppTest qw(php_executable read_file repo_root run_command);

# The File Manager's user directory (sys_files.php): a user with no directory of their own yet (a new user, or one whose
# jobs each have a directory of their own, uniquedir) gets the empty answers php7designer gave, not an error; a
# directory that cannot be used is still refused.

my $php = php_executable();
plan skip_all => 'php is not available on PATH; File Manager user directory checks are deferred' if !$php;

my $repo = repo_root( File::Spec->catdir( $FindBin::Bin, '..' ) );
my $source = read_file( File::Spec->catfile( $repo, qw(languages html5 sys sys_files.php) ) );

my ($within) = $source =~ /(^function ga_file_manager_path_is_within\(.*?^\})/ms;
my ($user_root) = $source =~ /(^function ga_file_manager_user_root\(.*?^\})/ms;
ok( defined $within, 'sys_files.php has ga_file_manager_path_is_within' );
ok( defined $user_root, 'sys_files.php has ga_file_manager_user_root' );

like( $source, qr/\$user_root = ga_file_manager_user_root\( \$dir,/,
    'the File Manager takes the user directory from ga_file_manager_user_root' );
like( $source, qr/\$user_root === null \)\s*\{.*?echo \$is_spec_fc \? '\{\}' : json_encode\( \$result_dirs \);\s*exit\(\);/s,
    'a user with no directory yet gets an empty tree ({} for the other requests), not an error' );
like( $source, qr/\$user_root === false \|\| !chdir\( \$user_root \).*?Could not access File Manager user directory/s,
    'a user directory that cannot be used is still refused' );

my ( $helper_fh, $helper ) = tempfile( SUFFIX => '.php', UNLINK => 1 );
print {$helper_fh} "<?php\n$within\n$user_root\n";
close $helper_fh;

my $root = tempdir( CLEANUP => 1 );
my $users = File::Spec->catdir( $root, qw(results users) );
make_path( File::Spec->catdir( $users, 'alice', 'no_project_specified' ) );
my $outside = File::Spec->catdir( $root, 'outside' );
make_path($outside);
symlink( $outside, File::Spec->catfile( $users, 'mallory' ) ) or die "symlink: $!";
symlink( File::Spec->catdir( $root, 'gone' ), File::Spec->catfile( $users, 'dangling' ) ) or die "symlink: $!";
open my $file_fh, '>', File::Spec->catfile( $users, 'plainfile' ) or die "write: $!";
close $file_fh;

sub user_root {
    my ( $users_dir, $logon ) = @_;
    my ( $status, $output ) = run_command(
        cwd => $root,
        cmd => [ $php, '-d', 'display_errors=stderr', '-r',
                 'require $argv[1]; var_export( ga_file_manager_user_root( $argv[2], $argv[3] ) );',
                 $helper, $users_dir, $logon ],
    );
    is( $status, 0, "ga_file_manager_user_root runs for '$logon'" ) or diag($output);
    return $output;
}

my $users_dir = "$users/";
is( user_root( $users_dir, 'newuser' ), 'NULL', 'a user with no directory yet: null (nothing to show)' );
is( user_root( $users_dir, 'alice' ), var_export_string( abs_path( File::Spec->catdir( $users, 'alice' ) ) ),
    'a user with a directory: its real path' );
is( user_root( $users_dir, 'mallory' ), 'false', 'a link to a directory outside the users directory: refused' );
is( user_root( $users_dir, 'dangling' ), 'false', 'a dangling link is not taken for a missing directory: refused' );
is( user_root( $users_dir, 'plainfile' ), 'false', 'a file in place of the user directory: refused' );
is( user_root( File::Spec->catdir( $root, 'nousers' ) . '/', 'alice' ), 'false',
    'no users directory: refused here (sys_files.php answers {} before asking)' );

done_testing();

sub var_export_string {
    my ($s) = @_;
    $s =~ s/(['\\])/\\$1/g;
    return "'$s'";
}
