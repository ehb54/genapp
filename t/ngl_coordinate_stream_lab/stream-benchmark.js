(async function () {
  "use strict";

  const atomCount = 1000;
  const frameCount = 120;
  const result = document.getElementById("benchmark-result");
  const stage = new NGL.Stage("viewport", { backgroundColor: "#0d1513", cameraType: "orthographic" });

  function pdbLine(index) {
    const serial = String(index + 1).padStart(5, " ");
    const residue = String(index + 1).padStart(4, " ");
    const x = (index * 0.12).toFixed(3).padStart(8, " ");
    const y = (Math.sin(index * 0.08) * 5).toFixed(3).padStart(8, " ");
    const z = (Math.cos(index * 0.08) * 5).toFixed(3).padStart(8, " ");
    return `ATOM  ${serial}  CA  ALA A${residue}    ${x}${y}${z}  1.00  0.00           C`;
  }

  try {
    const pdb = `${Array.from({ length: atomCount }, (_, index) => pdbLine(index)).join("\n")}\nEND\n`;
    const component = await stage.loadFile(new Blob([pdb]), { ext: "pdb" });
    component.addRepresentation("spacefill", { radiusScale: 0.2, colorScheme: "chainname" });
    component.autoView(0);
    const initialComponent = component;
    const coordinates = new Float32Array(atomCount * 3);
    let updateMilliseconds = 0;
    let frame = 0;
    const wallStart = performance.now();

    function update() {
      const updateStart = performance.now();
      for (let atom = 0; atom < atomCount; atom += 1) {
        const offset = atom * 3;
        coordinates[offset] = atom * 0.12;
        coordinates[offset + 1] = Math.sin(atom * 0.08 + frame * 0.08) * 5;
        coordinates[offset + 2] = Math.cos(atom * 0.08 + frame * 0.08) * 5;
      }
      component.structure.updatePosition(coordinates);
      component.updateRepresentations({ position: true });
      updateMilliseconds += performance.now() - updateStart;
      frame += 1;
      if (frame < frameCount) {
        requestAnimationFrame(update);
        return;
      }
      const report = {
        nglVersion: NGL.Version,
        atoms: atomCount,
        frames: frameCount,
        componentCount: stage.compList.length,
        sameComponent: stage.compList[0] === initialComponent,
        topologyLoads: 1,
        autoViewCalls: 1,
        meanCoordinateUpdateMs: Number((updateMilliseconds / frameCount).toFixed(3)),
        wallTimeMs: Number((performance.now() - wallStart).toFixed(1))
      };
      result.dataset.status = report.componentCount === 1 && report.sameComponent ? "pass" : "fail";
      result.textContent = JSON.stringify(report, null, 2);
    }

    requestAnimationFrame(update);
  } catch (error) {
    result.dataset.status = "fail";
    result.textContent = error.stack || error.message;
  }
}());
