# NGL structure compatibility: shared-gap report

## Evidence and scope

The October 11, 2026 Build campaign on Zazzie3 UI2 passed 129 of 138
scenarios. Two failures were application catalog expectations: unsafe Build
Utilities output prefixes and PDB Scan run names are rejected by the existing
browser field patterns before submission. Their application mappings now say
`validation_rejected`; scientific scenario intent is unchanged.

Seven other failures completed backend verification but failed molecular
viewer initialization. Five full mmCIF cases raised `s.name.trim is not a
function`; AlphaFold P69905 mmCIF raised an undefined helix-class index error;
the PDBRx missing-residue case raised an undefined `traceAtomIndex` error.
The first five include two uses of the same 1CRN file, plus 1BNA, 4HHB and
RCSB 1CRN. Valid existing structure payloads and saved files reproduce the
errors directly in bundled NGL without a module driver, React, UI2 or WebGL.
Module metadata cannot correct these parser and polymer-indexing defects.

The requesting user explicitly approved the plan and exact manifest,
including GenApp core changes. SASSIE, application drivers and views remain
read-only references. This repair adds no payload schema, viewer capability,
transport, replay store or module-specific core behavior.

Applicable guidance blob hashes recorded during the audit:

- genapp_zazzie AGENTS.md: `da57b04c7fbb0c2b4a3846f3618041082e509cf2`
- GenApp AGENTS.md: `ce554e5f49da8bf3f57f7ad5d7030f03490814c3`
- SASSIE AGENTS.md: `b52f3f4d46134ed8dca617fb99cc6845576d8f67`

## Bounded bundled-library repairs

`languages/html5/add/js/ngl.js` remains NGL 0.10.4. The original bundle's
SHA-256 was `1527f80903b4744e37dfe415b1f63eddecc0474d3da6dc1ff884298c51c1a8ea`.
That bundle was identical locally and on Zazzie3. It was originally tracked
in commit `23d66b04` (2018-06-10). Only these three token substitutions are
made; the bundle is not reformatted or replaced with a new upstream version:

1. Chemical-component parsing requires `chem_comp && chem_comp_atom &&
   !atom_site`. Full structures use their atom-site coordinates even when
   component dictionaries coexist. Standalone component files retain their
   existing model and ideal coordinate handling.
2. When the `pdbx_PDB_helix_class` column is absent, numeric helix classes are
   selected from declared `conf_type_id`: `HELX_RH_AL_P` → 1 (alpha),
   `HELX_RH_3T_P` → 5 (3-10), `HELX_RH_PI_P` → 3 (pi). Existing numeric
   columns stay authoritative. Unknown or nonhelix types are skipped rather
   than assigned invented secondary structure.
3. Noncyclic polymer endpoint lookup follows the actual previous/next
   connected residue proxy instead of assuming its index is start-minus-one
   or end-plus-one. Existing connection flags, cyclic wrapping and endpoint
   clamping remain in force. No atoms, bonds or coordinates are changed.

The shared bundle is consumed by generated HTML5 and UI2 assets. There is
no legacy-interface browser test in this task. The same saved molecular file
and ordinary final output remain authoritative for completed-job reattachment.

## Regression fixtures and validation

Run `prove -v t/unit_tests/ngl_structure_compatibility.t` with Node available.
The test uses the real bundled parser and cartoon spline geometry APIs in
memory without application-specific logic or a WebGL context.

The three CIF fixtures are neutral parser inputs: a full atom-site structure
with component categories, optional helix-class metadata, and a standalone
chemical component with model and ideal coordinates. Coordinate, atom and
residue checks prevent an apparently successful parse of the wrong category.
The multi-model and C-alpha controls exercise existing parser modes.

`chain_wrap_cartoon.pdb` is an unmodified copy of SASSIE's maintained expected
output at
`src/sassie/build/pdbrx/local_testing/scenarios/expected_output/coordinate_only_pdb_missing_residue/anchored_internal_missing_residue_charmm.pdb`.
The committed copy makes this test independent of a paired checkout. Its
216 atoms and 13 residues reproduce an actual wrapped connection preceding
an internal polymer segment. Finite cartoon geometry and unchanged coordinates
are checked; endpoint API controls also preserve cyclic lookup. These are
viewer compatibility checks, not independent validation of PDBRx science.

Before repair, all three defect groups failed and the standalone component /
ordinary PDB control passed. After repair all groups passed on Mac Node
24.18.0 and Linux Node 10.19.0 inside Zazzie3, loading the patched bundle and
fixtures entirely in memory without changing deployed files.

Linux checks also parsed the saved failed-campaign 1CRN, 1BNA, 4HHB, RCSB
1CRN, AlphaFold P69905 and PDBRx colored PDB files and produced finite cartoon
positions and orientations. This covers the six distinct saved structures
behind the seven viewer failures. The PDBRx saved file has 216 atoms / 13
residues. Its earlier Rosetta alignment warning and supported backend fallback
are outside the viewer repair; backend success alone is not browser acceptance.

## Deployment acceptance and rollback

The implementation is not yet deployed. After the approved deployment workflow
and fresh task-specific administrator-account approval, rerun the nine failed
scenarios on UI2, retain passing PDB/mmCIF and standalone-component controls,
and check completed viewers, expansion/restore, same-window and fresh-window
reattachment. Browser/WebGL acceptance remains required; parser tests do not
establish it. Log out at the end of approved account use.

Rollback restores the original shared bundle and the two application mapping /
compiled-catalog pairs through the established generation and deployment
workflow. Saved structures and final output contracts require no migration.
