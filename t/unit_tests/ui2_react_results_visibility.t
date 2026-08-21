use strict;
use warnings;

use File::Spec;
use File::Temp qw(tempdir tempfile);
use FindBin;
use Test::More;

use lib File::Spec->catdir( $FindBin::Bin, '..', 'lib' );
use GenAppTest qw(assert_command repo_root);

my $repo_root = repo_root( File::Spec->catdir( $FindBin::Bin, '..' ) );
my $react_dir = File::Spec->catdir( $repo_root, qw(languages ui2 react) );
my $compiled_dir = tempdir( CLEANUP => 1 );

assert_command(
    'results-visibility helper compiles for executable lifecycle checks',
    cwd => $react_dir,
    cmd => [
        'pnpm', 'exec', 'tsc',
        '--ignoreConfig',
        '--target', 'ES2022',
        '--module', 'NodeNext',
        '--moduleResolution', 'NodeNext',
        '--outDir', $compiled_dir,
        File::Spec->catfile( 'src', 'resultsVisibility.ts' ),
    ],
);

open my $package, '>', File::Spec->catfile( $compiled_dir, 'package.json' ) or die "write package metadata failed: $!";
print {$package} "{\"type\":\"module\"}\n";
close $package;

my ( $fh, $script ) = tempfile( 'ui2-react-results-visibility-XXXX', SUFFIX => '.mjs', TMPDIR => 1, UNLINK => 1 );
my $helper_url = 'file://' . File::Spec->catfile( $compiled_dir, 'resultsVisibility.js' );
print {$fh} <<"JS";
import assert from "node:assert/strict";
import { resultsVisibility } from "$helper_url";

assert.deepEqual(resultsVisibility({}), { showResultsPane: false, showRunStatus: false });
assert.deepEqual(resultsVisibility({ submitting: true }), { showResultsPane: true, showRunStatus: true });
assert.deepEqual(resultsVisibility({ hasRunContext: true }), { showResultsPane: true, showRunStatus: true });
assert.deepEqual(resultsVisibility({ hasAvailableOutput: true }), { showResultsPane: true, showRunStatus: false });
assert.deepEqual(resultsVisibility({ hasActionReview: true }), { showResultsPane: true, showRunStatus: false });
assert.deepEqual(resultsVisibility({ hasScenarioReview: true }), { showResultsPane: true, showRunStatus: false });
assert.deepEqual(resultsVisibility({ hasAvailableOutput: false }), { showResultsPane: false, showRunStatus: false });
JS
close $fh;

assert_command(
    'results-visibility helper distinguishes configuration, review, and run states',
    cwd => $repo_root,
    cmd => [ 'node', $script ],
);

done_testing();
