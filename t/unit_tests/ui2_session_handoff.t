use strict;
use warnings;

use File::Spec;
use FindBin;
use Test::More;

use lib File::Spec->catdir( $FindBin::Bin, '..', 'lib' );
use GenAppTest qw(read_file repo_root);

my $repo_root = repo_root( File::Spec->catdir( $FindBin::Bin, '..' ) );
my $endpoint = read_file( File::Spec->catfile( $repo_root, qw(languages ui2 add ajax ui2_session_handoff.php) ) );

like( $endpoint, qr/session_name\(strtoupper\(preg_replace/, 'handoff uses the generated application PHP session namespace' );
like( $endpoint, qr/\$source_window.*?\$target_window/s, 'handoff accepts explicit source and target window ids' );
like( $endpoint, qr/\^\[A-Za-z0-9_-\]\{1,128\}\$/, 'handoff validates both window identifiers' );
like( $endpoint, qr/\$source_window === \$target_window/, 'handoff rejects reusing the source window as target' );
like( $endpoint, qr/hash_equals\(\$application, \$source_application\)/, 'handoff requires an authenticated source for the generated application' );
like( $endpoint, qr/\$_SESSION\[\$target_window\] = array\([\s\S]*?'logon'\s*=>\s*\$logon[\s\S]*?'app'\s*=>\s*\$application[\s\S]*?'project'/, 'handoff writes only the target identity, app, and project session fields' );
like( $endpoint, qr/window-local preferences[\s\S]*?must not leak/i, 'handoff documents exclusion of window-local settings' );
unlike( $endpoint, qr/next_job_environment'\s*=>/, 'handoff never copies one-job environment settings' );
unlike( $endpoint, qr/password|token|credential/i, 'handoff does not copy credentials or tokens' );
like( $endpoint, qr/session_write_close\(\)/, 'handoff commits the target session before responding' );

done_testing();
