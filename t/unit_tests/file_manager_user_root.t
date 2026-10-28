use strict;
use warnings;

use Cwd qw(abs_path);
use File::Path qw(make_path);
use File::Spec;
use File::Temp qw(tempdir tempfile);
use FindBin;
use JSON::PP qw(encode_json);
use Test::More;

use lib File::Spec->catdir( $FindBin::Bin, '..', 'lib' );
use GenAppTest qw(php_executable read_file repo_root run_command);

# The File Manager's user directory (sys_files.php): a user with no directory of their own yet (a new user, or one whose
# jobs each have a directory of their own, uniquedir) gets the empty answers php7designer gave, not an error; a
# directory that cannot be used is still refused. A site may name directories that users' directories are links into
# (appconfig.json file_manager.linked_user_dirs): a user's directory may then be a link to <directory>/<logon>,
# exactly, and to nothing else; without the setting such a link is refused, as before.

my $php = php_executable();
plan skip_all => 'php is not available on PATH; File Manager user directory checks are deferred' if !$php;

my $repo = repo_root( File::Spec->catdir( $FindBin::Bin, '..' ) );
my $source = read_file( File::Spec->catfile( $repo, qw(languages html5 sys sys_files.php) ) );

my ($within) = $source =~ /(^function ga_file_manager_path_is_within\(.*?^\})/ms;
my ($user_root) = $source =~ /(^function ga_file_manager_user_root\(.*?^\})/ms;
my ($linked_dirs) = $source =~ /(^function ga_file_manager_linked_user_dirs\(.*?^\})/ms;
ok( defined $within, 'sys_files.php has ga_file_manager_path_is_within' );
ok( defined $user_root, 'sys_files.php has ga_file_manager_user_root' );
ok( defined $linked_dirs, 'sys_files.php has ga_file_manager_linked_user_dirs' );
like( $linked_dirs // '', qr/file_get_contents\( "__appconfig__" \)/,
    "ga_file_manager_linked_user_dirs reads the application's appconfig.json" );

like( $source, qr/\$user_root = ga_file_manager_user_root\( \$dir,/,
    'the File Manager takes the user directory from ga_file_manager_user_root' );
like( $source, qr/\$user_root = ga_file_manager_user_root\( \$dir,[^;]*ga_file_manager_linked_user_dirs\(\) \);/,
    'the File Manager passes the directories that appconfig.json names' );
like( $source, qr/\$user_root === null \)\s*\{.*?echo \$is_spec_fc \? '\{\}' : json_encode\( \$result_dirs \);\s*exit\(\);/s,
    'a user with no directory yet gets an empty tree ({} for the other requests), not an error' );
like( $source, qr/\$user_root === false \|\| !chdir\( \$user_root \).*?Could not access File Manager user directory/s,
    'a user directory that cannot be used is still refused' );

# the helper reads the appconfig.json that APPCONFIG names, in place of the generated application's
( my $linked_dirs_env = $linked_dirs // '' ) =~ s/"__appconfig__"/getenv( 'APPCONFIG' )/;
my ( $helper_fh, $helper ) = tempfile( SUFFIX => '.php', UNLINK => 1 );
print {$helper_fh} "<?php\n$within\n$user_root\n$linked_dirs_env\n";
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

# a directory the site names, holding users' directories (a mount that another application shares, say)
my $shared = File::Spec->catdir( $root, 'shared' );
make_path( File::Spec->catdir( $shared, 'bob', 'no_project_specified' ), File::Spec->catdir( $shared, 'carol' ),
           File::Spec->catdir( $shared, 'gina', 'sub' ), File::Spec->catdir( $shared, 'ivan' ),
           File::Spec->catdir( $outside, 'hank' ) );
symlink( File::Spec->catdir( $shared, 'bob' ), File::Spec->catfile( $users, 'bob' ) ) or die "symlink: $!";
symlink( File::Spec->catdir( $shared, 'carol' ), File::Spec->catfile( $users, 'eve' ) ) or die "symlink: $!";
symlink( $shared, File::Spec->catfile( $users, 'dave' ) ) or die "symlink: $!";
symlink( File::Spec->catdir( $shared, 'gina', 'sub' ), File::Spec->catfile( $users, 'gina' ) ) or die "symlink: $!";
symlink( File::Spec->catdir( $outside, 'hank' ), File::Spec->catfile( $shared, 'hank' ) ) or die "symlink: $!";
symlink( File::Spec->catdir( $shared, 'hank' ), File::Spec->catfile( $users, 'hank' ) ) or die "symlink: $!";
symlink( File::Spec->catdir( $shared, 'jill' ), File::Spec->catfile( $users, 'jill' ) ) or die "symlink: $!";
my $shared_link = File::Spec->catfile( $root, 'shared_link' );
symlink( $shared, $shared_link ) or die "symlink: $!";
symlink( File::Spec->catdir( $shared_link, 'ivan' ), File::Spec->catfile( $users, 'ivan' ) ) or die "symlink: $!";
make_path( File::Spec->catdir( $shared, 'kim.x' ) );
symlink( File::Spec->catdir( $shared, 'kim.x' ), File::Spec->catfile( $users, 'kim.x' ) ) or die "symlink: $!";

sub user_root {
    my ( $users_dir, $logon, $linked ) = @_;
    my ( $status, $output ) = run_command(
        cwd => $root,
        cmd => [ $php, '-d', 'display_errors=stderr', '-r',
                 'require $argv[1]; var_export( isset( $argv[4] ) ? ' .
                 'ga_file_manager_user_root( $argv[2], $argv[3], json_decode( $argv[4] ) ) : ' .
                 'ga_file_manager_user_root( $argv[2], $argv[3] ) );',
                 $helper, $users_dir, $logon, ( defined $linked ? ($linked) : () ) ],
    );
    is( $status, 0, "ga_file_manager_user_root runs for '$logon'" . ( defined $linked ? ' with linked directories' : '' ) )
        or diag($output);
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

my $named = encode_json( [$shared] );
my $bob = var_export_string( abs_path( File::Spec->catdir( $shared, 'bob' ) ) );
is( user_root( $users_dir, 'bob' ), 'false', 'without the setting, a link to <directory>/<logon>: refused, as before' );
is( user_root( $users_dir, 'bob', '[]' ), 'false', 'with no directories named: refused, as before' );
is( user_root( $users_dir, 'bob', $named ), $bob,
    'a link to <directory>/<logon> for a directory the site names: its real path' );
is( user_root( $users_dir, 'alice', $named ), var_export_string( abs_path( File::Spec->catdir( $users, 'alice' ) ) ),
    'with directories named, a directory of the user\'s own: its real path, as before' );
is( user_root( $users_dir, 'newuser', $named ), 'NULL', 'with directories named, a user with no directory yet: null' );
is( user_root( $users_dir, 'eve', $named ), 'false', 'a link to another user\'s directory in a named directory: refused' );
is( user_root( $users_dir, 'dave', $named ), 'false', 'a link to a named directory itself: refused' );
is( user_root( $users_dir, 'gina', $named ), 'false', 'a link to a directory below <directory>/<logon>: refused' );
is( user_root( $users_dir, 'hank', $named ), 'false', 'a link to <directory>/<logon> that links on elsewhere: refused' );
is( user_root( $users_dir, 'jill', $named ), 'false', 'a link to a <directory>/<logon> that does not exist: refused' );
is( user_root( $users_dir, 'mallory', $named ), 'false', 'a link outside the named directories: still refused' );
is( user_root( $users_dir, 'dangling', $named ), 'false', 'a dangling link: still refused' );
is( user_root( $users_dir, 'kim.x', $named ), 'false', 'a name that GenApp does not take for a logon (_logon): refused' );
is( user_root( $users_dir, 'ivan', encode_json( [$shared_link] ) ),
    var_export_string( abs_path( File::Spec->catdir( $shared, 'ivan' ) ) ),
    'a named directory that is itself a link: compared by real paths' );
is( user_root( $users_dir, 'bob', encode_json( [ File::Spec->catdir( $root, 'nowhere' ) ] ) ), 'false',
    'a named directory that does not exist: refused' );
is( user_root( $users_dir, 'bob', encode_json( [ '', File::Spec->catdir( $root, 'nowhere' ), $outside, $shared ] ) ), $bob,
    'each named directory is tried' );

sub linked_dirs {
    my ($appconfig) = @_;
    my ( $status, $output ) = run_command(
        cwd => $root,
        env => { APPCONFIG => $appconfig },
        cmd => [ $php, '-d', 'display_errors=stderr', '-r',
                 'require $argv[1]; echo json_encode( ga_file_manager_linked_user_dirs() );', $helper ],
    );
    is( $status, 0, 'ga_file_manager_linked_user_dirs runs' ) or diag($output);
    return $output;
}

sub appconfig {
    my ($content) = @_;
    my ( $fh, $file ) = tempfile( SUFFIX => '.json', UNLINK => 1 );
    print {$fh} $content;
    close $fh;
    return $file;
}

is( linked_dirs( File::Spec->catfile( $root, 'missing-appconfig.json' ) ), '[]', 'no appconfig.json: no directories' );
is( linked_dirs( appconfig('{"hostname":"localhost"}') ), '[]', 'no file_manager setting: no directories (the default)' );
is( linked_dirs( appconfig('{"file_manager":{"linked_user_dirs":["/shared","",3,null,"/data/users"]}}') ),
    '["\/shared","\/data\/users"]', 'the named directories, the non-empty strings among them' );
is( linked_dirs( appconfig('{"file_manager":{"linked_user_dirs":"/shared"}}') ), '[]', 'a string in place of a list: none' );
is( linked_dirs( appconfig('{"file_manager":true}') ), '[]', 'file_manager not an object: none' );
is( linked_dirs( appconfig('{"file_manager":') ), '[]', 'an appconfig.json that is not JSON: none' );

done_testing();

sub var_export_string {
    my ($s) = @_;
    $s =~ s/(['\\])/\\$1/g;
    return "'$s'";
}
