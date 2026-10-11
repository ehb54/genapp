use strict;
use warnings;
use File::Spec;
use File::Temp qw(tempfile);
use FindBin;
use Test::More;
use lib File::Spec->catdir($FindBin::Bin, '..', 'lib');
use GenAppTest qw(repo_root run_command);
my $repo = repo_root(File::Spec->catdir($FindBin::Bin, '..'));
my ($fh, $script) = tempfile('ngl-compatibility-XXXX', SUFFIX => '.js', TMPDIR => 1, UNLINK => 1);
print {$fh} <<'JS';
const fs = require('fs'), path = require('path'), assert = require('assert');
// Only the parser and geometry APIs are exercised; no browser or WebGL state.
global.window = { navigator: { userAgent: 'node' }, location: { search: '' },
  addEventListener() {}, devicePixelRatio: 1 };
global.navigator = window.navigator;
global.self = window;
const root = process.argv[2];
const NGL = require(path.join(root, 'languages/html5/add/js/ngl.js'));
const fixture_root = path.join(root, 't/fixtures/ngl_structure_compatibility');
const read = name => fs.readFileSync(path.join(fixture_root, name), 'utf8');
async function parse(data, extension, options = {}) {
  const lines = data.split(/\r?\n/);
  const streamer = { data, name: 'neutral', path: 'neutral.' + extension,
    read: () => Promise.resolve(), peekLines: count => lines.slice(0, count),
    eachChunkOfLines: callback => callback(lines) };
  return new (NGL.ParserRegistry.get(extension))(streamer, options).parse();
}
function coordinates(structure) {
  const result = [];
  structure.eachAtom(atom => result.push([atom.x, atom.y, atom.z]));
  return result;
}
const expected_coordinates = [[0, 0, 0], [1.45, 0, 0], [2.1, 1.3, 0], [1.6, 2.4, 0]];
function check_coordinates(structure) {
  assert.strictEqual(structure.atomCount, 4);
  const actual = coordinates(structure);
  actual.forEach((point, index) => point.forEach((value, axis) =>
    assert(Math.abs(value - expected_coordinates[index][axis]) < 1e-6)));
}
let failures = 0;
async function check(name, run) {
  try { await run(); console.log('PASS ' + name); }
  catch (error) { failures++; console.log('FAIL ' + name + '\n' + error.stack); }
}
(async () => {
  assert.strictEqual(NGL.Version, '0.10.4', 'bounded fixes retain the bundled version');
  await check('full mmCIF uses atom_site coordinates', async () => {
    const data = read('full_structure_and_components.cif');
    const structure = await parse(data, 'cif');
    check_coordinates(structure);
    assert.strictEqual(structure.residueStore.count, 1);
    assert.strictEqual(structure.getAtomProxy(1).atomname, 'CA');
    assert.strictEqual(structure.getResidueProxy(0).resname, 'ALA');
    // A completed job or a fresh window parses the same saved bytes again.
    const reconstructed = await parse(data, 'cif');
    assert.deepStrictEqual(coordinates(reconstructed), coordinates(structure));
    const ca_only = await parse(read('full_structure_and_components.cif'), 'cif', { cAlphaOnly: true });
    assert.strictEqual(ca_only.atomCount, 1);
    assert.strictEqual(ca_only.getAtomProxy(0).atomname, 'CA');
    const rows = data.split('\n').filter(line => line.startsWith('ATOM '));
    const two_models = data.trim().slice(0, -1) + rows.map(line =>
      line.replace(/ 1$/, ' 2')).join('\n') + '\n#\n';
    const trajectory = await parse(two_models, 'cif', { asTrajectory: true });
    assert.strictEqual(trajectory.frames.length, 2);
    assert.strictEqual(trajectory.frames[0].length, 12);
  });
  await check('optional helix class preserves declared secondary structure', async () => {
    const data = read('optional_helix_class.cif');
    const structure = await parse(data, 'cif');
    check_coordinates(structure);
    assert.strictEqual(structure.getResidueProxy(0).sstruc, 'h');
    for (const [type, secondary] of [['HELX_RH_3T_P', 'g'], ['HELX_RH_PI_P', 'i']]) {
      const variant = await parse(data.replace('HELX_RH_AL_P', type), 'cif');
      check_coordinates(variant);
      assert.strictEqual(variant.getResidueProxy(0).sstruc, secondary);
    }
    const explicit = data.replace('_struct_conf.conf_type_id\n',
      '_struct_conf.conf_type_id\n_struct_conf.pdbx_PDB_helix_class\n')
      .replace('H1 HELX_RH_AL_P A', 'H1 HELX_RH_AL_P 3 A');
    assert.strictEqual((await parse(explicit, 'cif')).getResidueProxy(0).sstruc,
      'i', 'an existing numeric class stays authoritative');
    const other = await parse(data.replace('HELX_RH_AL_P', 'TURN_TY1_P'), 'cif');
    assert.notStrictEqual(other.getResidueProxy(0).sstruc, 'h', 'a nonhelix is not invented');
  });
  await check('chain wrap cartoon uses the actual connected residue', async () => {
    const structure = await parse(read('chain_wrap_cartoon.pdb'), 'pdb');
    assert.strictEqual(structure.atomCount, 216);
    assert.strictEqual(structure.residueStore.count, 13);
    const before = coordinates(structure), polymers = [];
    structure.eachPolymer(polymer => polymers.push(polymer));
    const polymer = polymers[0];
    assert.strictEqual(polymer.residueIndexStart, 0);
    assert.strictEqual(polymer.isPrevConnected, true);
    assert.strictEqual(polymer.isCyclic, false);
    const previous = structure.getResidueProxy(0).getPreviousConnectedResidue();
    assert.strictEqual(previous.index, 12);
    assert.strictEqual(polymer.getAtomIndexByType(-1, 'trace'), previous.traceAtomIndex);
    // Endpoint lookup must follow wrapped connections at either end.
    const next_wrap = Array.from({ length: 11 }, (_, index) =>
      new polymer.constructor(structure, index + 1, 12)).find(item => !item.isCyclic);
    assert(next_wrap, 'a noncyclic segment with a wrapped next connection exists');
    assert.strictEqual(next_wrap.isCyclic, false);
    assert.strictEqual(next_wrap.isNextNextConnected, true);
    assert.strictEqual(next_wrap.getAtomIndexByType(next_wrap.residueCount, 'trace'),
      structure.getResidueProxy(0).traceAtomIndex);
    const cyclic = new polymer.constructor(structure, 0, 12);
    assert.strictEqual(cyclic.isCyclic, true);
    assert.strictEqual(cyclic.getAtomIndexByType(-1, 'trace'), previous.traceAtomIndex);
    assert.strictEqual(cyclic.getAtomIndexByType(cyclic.residueCount, 'trace'),
      structure.getResidueProxy(0).traceAtomIndex);
    // These API endpoint checks do not assert continuity across the internal break.
    // Exercise the same geometry path used by the cartoon representation.
    const representation = Object.create(NGL.RepresentationRegistry.get('cartoon').prototype);
    Object.assign(representation, { subdiv: 6, tension: NaN, aspectRatio: 5, smoothSheet: false });
    for (const item of polymers) {
      if (item.residueCount < 4) continue;
      const spline = representation.getSpline(item);
      for (const values of Object.values(spline.getSubdividedPosition()))
        assert(Array.from(values).every(Number.isFinite), 'finite cartoon positions');
      for (const values of Object.values(spline.getSubdividedOrientation()))
        assert(Array.from(values).every(Number.isFinite), 'finite cartoon orientations');
    }
    assert.deepStrictEqual(coordinates(structure), before, 'geometry does not change coordinates');
  });
  await check('standalone chemical component and ordinary PDB controls', async () => {
    const component = await parse(read('chemical_component.cif'), 'cif');
    assert.strictEqual(component.atomCount, 4);
    assert.deepStrictEqual(coordinates(component), [[90, 90, 90], [91, 90, 90], [90, 90, 90], [91, 90, 90]]);
    const ordinary = await parse(fs.readFileSync(path.join(root,
      't/ngl_viewer_lab/fixtures/demo.pdb'), 'utf8'), 'pdb');
    assert(ordinary.atomCount > 0);
  });
  process.exitCode = failures ? 1 : 0;
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
JS
close $fh;
my ($status, $output) = run_command(cwd => $repo, cmd => ['node', $script, $repo]);
is($status, 0, 'NGL structure compatibility without application-specific logic') or diag($output);
for my $case ('full mmCIF uses atom_site coordinates',
              'optional helix class preserves declared secondary structure',
              'chain wrap cartoon uses the actual connected residue',
              'standalone chemical component and ordinary PDB controls') {
    like($output, qr/\QPASS $case\E/, $case);
}
done_testing();
