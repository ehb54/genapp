use strict;
use warnings;

use File::Spec;
use File::Temp qw(tempfile);
use FindBin;
use JSON::PP qw(decode_json encode_json);
use Test::More;

use lib File::Spec->catdir( $FindBin::Bin, '..', 'lib' );
use GenAppTest qw(generate_fixture_app php_executable read_file repo_root run_command);

# A module's details (the text its fields' "details" make, which the job manager shows) name the directory of its
# runs' outputs only when the module says so: "detailsdirectory" : "true" in its json. Only for such a job does
# get_results refuse a run whose directory is gone (joblog.php's getmenumoduledetaildir), and do File Manager
# deletions invalidate the jobs whose directory they remove (job_saved_path_is_removed). Details that are display
# text, as in applications older than these checks, stay display text, even when they look like a relative path
# (a run name, a slash and a choice), and so do the details of jobs recorded before the declaration existed.

my $php = php_executable();
plan skip_all => 'php is not available on PATH; job details directory checks are deferred' if !$php;

my $repo = repo_root( File::Spec->catdir( $FindBin::Bin, '..' ) );

# the generated pages: only the module that declares it sets details_directory
my $generated = generate_fixture_app(
    repo_root    => $repo,
    fixture_name => 'details_directory',
    genapp_args  => ['-kl'],
);
is( $generated->{status}, 0, 'the details_directory fixture generates' )
    or diag("command failed ($generated->{status}): $generated->{quoted}\n$generated->{output}");
my $declared = read_file( File::Spec->catfile( $generated->{app_dir}, qw(output html5 ajax runs rundir.php) ) );
my $display  = read_file( File::Spec->catfile( $generated->{app_dir}, qw(output html5 ajax runs runlabel.php) ) );
like( $declared, qr/\$GLOBALS\[ 'details_directory' \] = true;/,
    'a module that declares detailsdirectory sets details_directory' );
unlike( $display, qr/\$GLOBALS\[ 'details_directory' \] = true;/,
    'a module that does not declare it leaves details_directory unset' );
like( $declared, qr/details\( \$_REQUEST, \$modjson \);\s*if \( !logjobstart\(/,
    'the details are made just before the job record is written' );
for my $page (qw(rundir runlabel)) {
    my ( $status, $output ) = run_command(
        cwd => $generated->{app_dir},
        cmd => [ $php, '-l', File::Spec->catfile( $generated->{app_dir}, qw(output html5 ajax runs), "$page.php" ) ],
    );
    is( $status, 0, "the generated $page.php passes PHP's syntax check" ) or diag($output);
}

# joblog.php's functions, on stand-ins for GenApp's database calls; documents are ArrayAccess objects, as the
# database's (MongoDB\Model\BSONDocument, an ArrayObject)
my $source = read_file( File::Spec->catfile( $repo, qw(languages html5 sys joblog.php) ) );
my %fn;
for my $name (qw(logjobstart job_details_are_directory job_detail_directory job_saved_path_is_removed getmenumodule)) {
    ( $fn{$name} ) = $source =~ /(^function \Q$name\E\(.*?^\})/ms;
    ok( defined $fn{$name}, "joblog.php has $name" );
}
my $stubs = <<'PHP';
$GLOBALS['db_log'] = array();
function doc( $a ) { return new ArrayObject( $a ); }
$GLOBALS['db_jobs'] = array_map( 'doc', json_decode( getenv( 'JOBS' ) ?: '[]', true ) );
function ga_db_open( $e = false ) { return array( 'status' => true, 'output' => null ); }
function ga_db_status( $r ) { return is_array( $r ) && $r['status']; }
function ga_db_output( $r ) { return $r['output']; }
function ga_db_date() { return array( 'status' => true, 'output' => 'now' ); }
function ga_db_insert( $c, $a, $doc, $o = array(), $e = false ) {
    $GLOBALS['db_log'][] = array( 'insert' => $doc );
    return array( 'status' => true, 'output' => true );
}
function ga_db_findOne( $c, $a, $q, $p = array(), $o = array(), $e = false ) {
    foreach ( $GLOBALS['db_jobs'] as $j ) {
        if ( $j['_id'] == $q['_id'] ) {
            return array( 'status' => true, 'output' => $j );
        }
    }
    return array( 'status' => true, 'output' => null );
}
function ga_db_find( $c, $a, $q, $p = array(), $o = array(), $e = false ) {
    return array( 'status' => true, 'output' => array_values( array_filter( $GLOBALS['db_jobs'],
        function ( $j ) use ( $q ) { return $j['user'] == $q['user']; } ) ) );
}
function ga_db_update( $c, $a, $q, $u, $o = array(), $e = false ) {
    $GLOBALS['db_log'][] = array( 'update' => $q['_id'], 'with' => $u );
    return array( 'status' => true, 'output' => true );
}
PHP
my ( $helper_fh, $helper ) = tempfile( SUFFIX => '.php', UNLINK => 1 );
print {$helper_fh} "<?php\n$stubs\n", join( "\n", map { $fn{$_} // '' } sort keys %fn ), "\n";
close $helper_fh;

sub php_run {
    my ( $code, $jobs, @args ) = @_;
    my ( $status, $output ) = run_command(
        cwd => File::Spec->tmpdir(),
        env => { JOBS => encode_json( $jobs || [] ) },
        cmd => [ $php, '-d', 'display_errors=stderr', '-r', "require \$argv[1]; $code", $helper, @args ],
    );
    is( $status, 0, 'joblog.php functions run' ) or diag($output);
    return $output;
}

# the job record: details_directory only with details that the module declared a directory
my $start = '$GLOBALS["menu"] = "runs"; $GLOBALS["module"] = "rundir"; $GLOBALS["project"] = "no_project_specified";'
    . ' $GLOBALS["logon"] = "alice"; $GLOBALS["dir"] = "/r/alice"; $GLOBALS["logdir"] = "/r/alice/_log";'
    . ' $GLOBALS["command"] = "x"; $GLOBALS["resource"] = "local"; $GLOBALS["jobweight"] = 1;'
    . ' $GLOBALS["REMOTE_ADDR"] = "127.0.0.1"; $_REQUEST["_uuid"] = "u1";';
sub inserted {
    my ($set) = @_;
    my $log = decode_json( php_run( "$start $set logjobstart(); echo json_encode( \$GLOBALS['db_log'] );" ) );
    return $log->[0]{insert};
}
my $doc = inserted('$GLOBALS["details"] = "run_0/match_point"; $GLOBALS["details_directory"] = true;');
ok( $doc->{details_directory} && $doc->{details} eq 'run_0/match_point',
    'a declared module: the job record has its details and details_directory' );
$doc = inserted('$GLOBALS["details"] = "run_0/match_point";');
ok( !exists $doc->{details_directory} && $doc->{details} eq 'run_0/match_point',
    'a module that does not declare it: details, and no details_directory' );
$doc = inserted('$GLOBALS["details_directory"] = true;');
ok( !exists $doc->{details_directory} && !exists $doc->{details}, 'no details: no details_directory either' );

# get_results' run directory (getmenumodule): only for details that the job's module declared a directory
my $dir = '/r/results/users/alice/no_project_specified';
my %base = ( user => 'alice', menu => 'runs', project => 'no_project_specified', directory => $dir, start => 'then',
             status => [ 'started', 'finished' ] );
my @jobs = (
    { %base, _id => 'declared', module => 'rundir', details => 'run_0/match_point', details_directory => JSON::PP::true },
    { %base, _id => 'display', module => 'runlabel', details => 'run_0/match_point' },
    { %base, _id => 'declared_text', module => 'rundir', details => 'run 0, match point', details_directory => JSON::PP::true },
    { %base, _id => 'declared_up', module => 'rundir', details => '../../etc', details_directory => JSON::PP::true },
    { %base, _id => 'declared_off', module => 'rundir', details => 'run_0/match_point', details_directory => JSON::PP::false },
);
sub detaildir {
    my ($id) = @_;
    return php_run( "\$GLOBALS['logon'] = 'alice'; var_export( getmenumodule( '$id' ) ); echo '|', \$GLOBALS['getmenumoduledetaildir'];",
                    \@jobs );
}
is( detaildir('declared'), "true|$dir/run_0/match_point", 'declared details: the run directory get_results checks' );
is( detaildir('display'), 'true|', 'details that look like a path, from a module that does not declare them: none' );
is( detaildir('declared_text'), 'true|', 'declared details that are not a relative path: none' );
is( detaildir('declared_up'), 'true|', 'declared details that leave the job directory: none' );
is( detaildir('declared_off'), 'true|', 'details_directory false: none' );

# File Manager deletions mark only the jobs whose declared directory they remove
sub removed {
    my ($paths) = @_;
    return decode_json( php_run(
        'echo json_encode( array( job_saved_path_is_removed( "alice", json_decode( $argv[2] ), "tok" ), $GLOBALS["db_log"] ) );',
        \@jobs, encode_json($paths) ) );
}
my ( $affected, $log ) = @{ removed( ['no_project_specified/run_0'] ) };
is_deeply( $affected, ['declared'], 'deleting a run directory: only the job whose module declared it is marked' );
is( scalar( grep { exists $_->{update} } @$log ), 1, 'one job record changed' );
is( $log->[0]{with}{'$set'}{saved_files_removed}{token}, 'tok', 'with the deletion token, for a rollback' );
( $affected, $log ) = @{ removed( ['no_project_specified'] ) };
is_deeply( $affected, ['declared'],
    'deleting the project: the declared job is marked (the others: get_results finds their directory gone)' );
( $affected, $log ) = @{ removed( ['no_project_specified/other'] ) };
is_deeply( $affected, [], 'deleting another directory: no job is marked' );

done_testing();
