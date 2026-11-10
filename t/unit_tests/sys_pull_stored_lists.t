use strict;
use warnings;

use File::Spec;
use File::Temp qw(tempdir);
use FindBin;
use JSON::PP qw(decode_json encode_json);
use Test::More;

use lib File::Spec->catdir( $FindBin::Bin, '..', 'lib' );
use GenAppTest qw(php_executable read_file repo_root run_command);

# The values a page pulls from the logged-in user's record (sys_pull.php): the project list of the Settings page and the
# Job Manager's project filter, read from the stored list of { <name> : { desc, created } } entries, and xsedeproject.
# ga_db_lib_v7.php's client returns stored arrays as PHP arrays and stored documents as MongoDB\Model\BSONDocument
# objects; the stand-in library below does the same, with ArrayObject (BSONDocument's parent class) for the documents.
# A user with projects, and a user with none (whose xsedeproject is ""), get the names, as under PHP 7.4, not an error.

my $php = php_executable();
plan skip_all => 'php is not available on PATH; sys_pull.php runtime checks are deferred' if !$php;

my $repo = repo_root( File::Spec->catdir( $FindBin::Bin, '..' ) );
my $source = read_file( File::Spec->catfile( $repo, qw(languages html5 sys sys_pull.php) ) );
my $dir = tempdir( CLEANUP => 1 );

sub write_file {
    my ( $name, $content ) = @_;
    my $path = File::Spec->catfile( $dir, $name );
    open my $fh, '>', $path or die "write '$path': $!";
    print {$fh} $content;
    close $fh;
    return $path;
}

my $filter = write_file( 'ga_filter.php', <<'PHP' );
<?php
function ga_sanitize_validate( $modjson, $inputs, $id ) { return [ 'output' => 'success' ]; }
PHP

my $db_lib = write_file( 'ga_db_lib.php', <<'PHP' );
<?php
// the stored user record is USER_DOC (JSON), the user's distinct job modules JOB_MODULES (JSON)
function ga_db_stored( $v ) {
    if ( is_array( $v ) ) {
        return array_map( 'ga_db_stored', $v );
    }
    if ( is_object( $v ) ) {
        $doc = [];
        foreach ( get_object_vars( $v ) as $k => $x ) {
            $doc[ $k ] = ga_db_stored( $x );
        }
        return new ArrayObject( $doc, ArrayObject::ARRAY_AS_PROPS );
    }
    return $v;
}
function ga_db_open( $error_json_exit = false ) { return [ '_status' => 'success' ]; }
function ga_db_output( $results ) { return $results[ 'output' ]; }
function ga_db_findOne( $coll, $appname, $query, $projection = [], $options = [], $error_json_exit = false ) {
    $doc = json_decode( getenv( 'USER_DOC' ) );
    return [ '_status' => 'success', 'output' => $doc === null ? null : ga_db_stored( $doc ) ];
}
function ga_db_distinct( $coll, $appname, $key, $query = [], $options = [], $error_json_exit = false ) {
    return [ '_status' => 'success', 'output' => json_decode( getenv( 'JOB_MODULES' ) ?: '[]', true ) ];
}
PHP

# the request (PULL_REQUEST, JSON) and the session window of the logged-in user (LOGON) that sys_pull.php reads
my $prepend = write_file( 'prepend.php', <<'PHP' );
<?php
$_GET = $_REQUEST = json_decode( getenv( 'PULL_REQUEST' ), true );
session_name( 'GENAPP_TESTAPP' );
session_start();
$_SESSION[ $_REQUEST[ '_window' ] ] = [ 'logon' => getenv( 'LOGON' ), 'project' => '' ];
PHP

( my $script = $source ) =~ s/^__~debug:[^\n]*\n//mg;
$script =~ s{"__docroot:html5__/__application__/ajax/ga_filter\.php"}{"$filter"}g;
$script =~ s{"__docroot:html5__/__application__/ajax/ga_db_lib\.php"}{"$db_lib"}g;
$script =~ s/__modulejson__/{"fields":[]}/g;
$script =~ s/__menu:modules:id__/sys_pull/g;
$script =~ s/__application__/testapp/g;
$script =~ s/__appconfig__/$dir\/appconfig.json/g;
$script =~ s/__nextjobenvironment__/false/g;
$script =~ s/__text_color_rgb__/220,210,210/g;
$script =~ s/__background_color_rgb__/0,0,95/g;
unlike( $script, qr/__[a-z~][a-zA-Z0-9_:~]*__/, 'sys_pull.php: every template token is replaced for the run' );
my $pull = write_file( 'sys_pull.php', $script );

my ( $lint_status, $lint_output ) = run_command( cwd => $dir, cmd => [ $php, '-l', $pull ] );
is( $lint_status, 0, 'sys_pull.php as run passes PHP syntax validation' ) or diag($lint_output);

my $window = '0d6c4f2e-6a43-4c55-9a5b-1f0c9c1d2e3f';
my %pages = (
    settings    => { xsedeproject => 0, project => 0, visible => 0, aihelperpreference => 0, next_job_environment => 0 },
    job_manager => { datetime => 0, projecta => 0, modulea => 0 },
);

sub pull {
    my ( $page, $user, $modules ) = @_;
    my $log = File::Spec->catfile( $dir, "php-$page-$user->{name}.log" );
    unlink $log;
    my ( $status, $output ) = run_command(
        cwd => $dir,
        env => {
            PULL_REQUEST => encode_json( { %{ $pages{$page} }, _window => $window, _logon => $user->{name} } ),
            LOGON        => $user->{name},
            USER_DOC     => encode_json($user),
            JOB_MODULES  => encode_json( $modules || [] ),
        },
        cmd => [ $php, '-d', 'display_errors=0', '-d', 'log_errors=1', '-d', "error_log=$log", '-d', 'error_reporting=-1',
                 '-d', "session.save_path=$dir", '-d', "auto_prepend_file=$prepend", $pull ],
    );
    my $json = eval { decode_json($output) };
    ok( $status == 0 && ref $json eq 'HASH', "$page pull for $user->{name}: sys_pull.php answers" )
        or diag( "exit $status\n$output\n" . ( -f $log ? read_file($log) : 'no PHP log' ) );
    return $json || {};
}

sub stored { return [ map { { $_ => { desc => q{}, created => '2025-05-04T22:11:31.285Z' } } } @_ ]; }

my $with = { name => 'pat', email => 'pat@example.org', project => stored(qw(proj_10 alpha proj_9)) };
my $none = { name => 'nan', email => 'nan@example.org' };
my $xsede = { name => 'xan', email => 'xan@example.org', xsedeproject => stored(qw(allocation_10 allocation_2)) };

my $r = pull( 'settings', $with );
is_deeply( $r->{project}, [qw(alpha no_project_specified proj_9 proj_10)],
    'a user with projects: the Settings page gets their names, and no_project_specified, in natural order' );
is( $r->{xsedeproject}, q{}, 'a user without xsedeproject: "" (as under PHP 7.4)' );

$r = pull( 'job_manager', $with, [qw(ses center)] );
is_deeply( $r->{projecta}, [qw(*all* alpha no_project_specified proj_9 proj_10)],
    'a user with projects: the Job Manager filter gets *all* and the names' );
is_deeply( $r->{modulea}, [qw(*all* center ses)], 'the Job Manager module filter: *all* and the modules of the user\'s jobs' );
ok( !exists $r->{project}, 'the Job Manager pull answers no project key of its own' );

$r = pull( 'settings', $none );
is_deeply( $r->{project}, ['no_project_specified'], 'a user without projects: no_project_specified only' );
is( $r->{xsedeproject}, q{}, 'a user without projects or xsedeproject: xsedeproject ""' );

$r = pull( 'job_manager', $none );
is_deeply( $r->{projecta}, [qw(*all* no_project_specified)], 'a user without projects: the Job Manager filter' );

$r = pull( 'settings', $xsede );
is_deeply( $r->{xsedeproject}, [qw(allocation_2 allocation_10)], 'a stored xsedeproject list: its names, in natural order' );

done_testing();
