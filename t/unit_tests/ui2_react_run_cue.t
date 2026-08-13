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
    'run-cue helper compiles for executable lifecycle checks',
    cwd => $react_dir,
    cmd => [
        'pnpm', 'exec', 'tsc',
        '--ignoreConfig',
        '--target', 'ES2022',
        '--module', 'NodeNext',
        '--moduleResolution', 'NodeNext',
        '--outDir', $compiled_dir,
        File::Spec->catfile( 'src', 'runCue.ts' ),
        File::Spec->catfile( 'src', 'types.ts' ),
    ],
);

open my $package, '>', File::Spec->catfile( $compiled_dir, 'package.json' ) or die "write package metadata failed: $!";
print {$package} "{\"type\":\"module\"}\n";
close $package;

my ( $fh, $script ) = tempfile( 'ui2-react-run-cue-XXXX', SUFFIX => '.mjs', TMPDIR => 1, UNLINK => 1 );
my $helper_url = 'file://' . File::Spec->catfile( $compiled_dir, 'runCue.js' );
print {$fh} <<"JS";
import assert from "node:assert/strict";
import { runCueMessage } from "$helper_url";

const snapshot = (lifecycle = null, channels = {}, run = "run-1") => ({
  run,
  module: "neutral_module",
  lastSequence: 0,
  missingSequences: [],
  pendingSequences: [],
  lifecycle,
  channels
});

assert.deepEqual(
  runCueMessage(snapshot({ state: "failed", error: "Saved files are unavailable." })),
  { text: "Run failed · Saved files are unavailable.", tone: "warning" }
);
assert.deepEqual(runCueMessage(snapshot({ state: "failed" })), { text: "Run failed", tone: "warning" });
assert.deepEqual(runCueMessage(snapshot({ state: "cancelled" })), { text: "Run cancelled", tone: "warning" });
assert.deepEqual(runCueMessage(snapshot({ state: "completed" })), { text: "Run completed", tone: "normal" });
assert.deepEqual(
  runCueMessage(snapshot({ state: "running" })),
  { text: "Starting job · runtime stream connecting", tone: "normal" }
);
assert.deepEqual(
  runCueMessage(snapshot(null, { log: { run: { value: "Traceback: example" } } })),
  { text: "Needs attention · driver reported an exception", tone: "warning" }
);
JS
close $fh;

assert_command(
    'run-cue helper reports terminal lifecycle state before log heuristics',
    cwd => $repo_root,
    cmd => [ 'node', $script ],
);

done_testing();
