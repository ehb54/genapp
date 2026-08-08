(function () {
  "use strict";

  const stage = new NGL.Stage("viewport", { backgroundColor: "#050909", cameraType: "orthographic" });
  const state = {
    molecules: [],
    currentMolecule: null,
    structure: null,
    structureName: "",
    structureSource: null,
    volume: null,
    axes: null,
    fileTrajectory: null,
    moleculeLayers: [],
    volumeLayers: []
  };

  const elements = {
    structureFile: document.getElementById("structure-file"),
    trajectoryFile: document.getElementById("trajectory-file"),
    volumeFile: document.getElementById("volume-file"),
    moleculeLayers: document.getElementById("molecule-layers"),
    volumeLayers: document.getElementById("volume-layers"),
    addLayer: document.getElementById("add-layer"),
    addSurface: document.getElementById("add-surface"),
    status: document.getElementById("status"),
    picked: document.getElementById("picked"),
    payload: document.getElementById("payload"),
    cameraMode: document.getElementById("camera-mode"),
    backgroundColor: document.getElementById("background-color"),
    mousePreset: document.getElementById("mouse-preset"),
    showAxes: document.getElementById("show-axes"),
    fileTrajectoryStatus: document.getElementById("file-trajectory-status"),
    fileTrajectoryPrevious: document.getElementById("file-trajectory-previous"),
    fileTrajectoryPlay: document.getElementById("file-trajectory-play"),
    fileTrajectoryNext: document.getElementById("file-trajectory-next"),
    fileTrajectoryFrame: document.getElementById("file-trajectory-frame"),
    moleculeList: document.getElementById("molecule-list"),
    saveCoordinates: document.getElementById("save-coordinates"),
    basisCatalog: document.getElementById("basis-catalog-list")
  };

  const localHelperAvailable = window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost";
  const moleculeColors = ["#4ca6ff", "#fb9a99", "#8dd3c7", "#fdb462", "#bebada", "#b3de69"];

  function currentMolecule() { return state.currentMolecule; }

  function updateMoleculeList() {
    elements.moleculeList.textContent = "";
    if (!state.molecules.length) {
      elements.moleculeList.classList.add("empty");
      elements.moleculeList.textContent = "Load a structure to begin.";
      return;
    }
    elements.moleculeList.classList.remove("empty");
    state.molecules.forEach((molecule, index) => {
      const row = document.createElement("div"); row.className = "molecule-row";
      const current = molecule === state.currentMolecule;
      row.innerHTML = `<button type="button" class="make-current">${current ? "Current" : "Make current"}</button><span>${molecule.name}</span><label class="visible"><input type="checkbox" ${molecule.component.visible ? "checked" : ""}> visible</label><button type="button" class="remove-molecule">Remove</button>`;
      row.querySelector(".make-current").addEventListener("click", () => activateMolecule(molecule));
      row.querySelector("input").addEventListener("change", (event) => { molecule.component.setVisibility(event.target.checked); updatePayload(); });
      row.querySelector(".remove-molecule").addEventListener("click", () => removeMolecule(molecule));
      elements.moleculeList.appendChild(row);
    });
  }

  function activateMolecule(molecule) {
    if (state.currentMolecule) {
      state.currentMolecule.axes = state.axes;
    }
    state.currentMolecule = molecule || null;
    state.structure = molecule?.component || null;
    state.structureName = molecule?.name || "";
    state.structureSource = molecule?.source || null;
    state.fileTrajectory = molecule?.trajectory || null;
    state.fileTrajectoryName = molecule?.trajectoryName || "";
    state.moleculeLayers = molecule?.layers || [];
    state.axes = molecule?.axes || null;
    elements.moleculeLayers.textContent = "";
    if (molecule?.layers?.length) {
      elements.moleculeLayers.classList.remove("empty");
      molecule.layers.forEach((layer) => elements.moleculeLayers.appendChild(layer.node));
    } else {
      elements.moleculeLayers.classList.add("empty");
      elements.moleculeLayers.textContent = molecule ? "Add a layer to display this molecule." : "Load a structure to add molecular layers.";
    }
    elements.addLayer.disabled = !molecule;
    elements.saveCoordinates.disabled = !molecule || !localHelperAvailable || !["pdb", "ent"].includes(extension(molecule.name));
    updateFileTrajectoryControls(); updateMoleculeList(); renderBasisCatalog(); updatePayload();
  }

  function removeMolecule(molecule) {
    if (molecule.trajectory) {
      activateMolecule(molecule); disposeFileTrajectory(); molecule.trajectory = null;
    }
    stage.removeComponent(molecule.component);
    state.molecules = state.molecules.filter((item) => item !== molecule);
    activateMolecule(state.molecules[0] || null);
    setStatus(`Removed ${molecule.name}.`);
  }

  function updateFileTrajectoryControls() {
    const trajectory = state.fileTrajectory?.trajectory || state.fileTrajectory;
    const count = Number(trajectory?.frameCount ?? trajectory?._frameCount ?? trajectory?.numframes ?? 0);
    const current = Number(trajectory?.currentFrame ?? trajectory?._currentFrame ?? 0);
    const enabled = Boolean(trajectory) && count > 0;
    [elements.fileTrajectoryPrevious, elements.fileTrajectoryPlay, elements.fileTrajectoryNext, elements.fileTrajectoryFrame].forEach((control) => { control.disabled = !enabled; });
    elements.fileTrajectoryFrame.max = String(Math.max(0, count - 1));
    elements.fileTrajectoryFrame.value = String(Math.max(0, Math.min(Math.max(0, count - 1), current)));
    elements.fileTrajectoryStatus.textContent = enabled
      ? `${count} frame${count === 1 ? "" : "s"}; frame ${current + 1}.`
      : "Load a structure, then add a DCD/TRR/XTC file.";
  }

  function setFileTrajectoryFrame(index) {
    const trajectory = state.fileTrajectory?.trajectory || state.fileTrajectory;
    if (!trajectory?.setFrame) return;
    trajectory.setFrame(Number(index));
    updateFileTrajectoryControls();
  }

  function toggleFileTrajectoryPlayback() {
    const trajectory = state.fileTrajectory?.trajectory || state.fileTrajectory;
    const player = trajectory?.player;
    if (!player) return;
    player.toggle?.();
    elements.fileTrajectoryPlay.textContent = player.isRunning ? "Pause" : "Play";
    elements.fileTrajectoryPlay.setAttribute("aria-pressed", player.isRunning ? "true" : "false");
  }

  function disposeFileTrajectory() {
    const trajectoryComponent = state.fileTrajectory;
    const trajectory = trajectoryComponent?.trajectory || trajectoryComponent;
    // In NGL 0.10.4, Trajectory.dispose() calls player.stop(), which resets a
    // frame and can redraw the just-removed structure.  Pause and detach the
    // player first, then remove the trajectory from the structure's own list.
    trajectory?.player?.pause?.();
    trajectory?.setPlayer?.(null);
    if (trajectoryComponent && state.structure?.trajList?.indexOf(trajectoryComponent) !== -1) {
      state.structure.removeTrajectory(trajectoryComponent);
    } else {
      trajectoryComponent?.dispose?.();
    }
    state.fileTrajectory = null;
    state.fileTrajectoryName = "";
    if (currentMolecule()) { currentMolecule().trajectory = null; currentMolecule().trajectoryName = ""; }
  }

  async function loadTrajectory(source, displayName) {
    if (!state.structure) {
      setStatus("Load a structure before loading a trajectory.", true);
      return;
    }
    const name = displayName || source.name || "trajectory";
    setStatus(`Loading trajectory ${name}…`);
    try {
      disposeFileTrajectory();
      const frames = await loadTrajectoryFrames(source, name);
      state.fileTrajectory = state.structure.addTrajectory(frames, { defaultMode: "loop" });
      state.fileTrajectoryName = name;
      currentMolecule().trajectory = state.fileTrajectory;
      currentMolecule().trajectoryName = name;
      const trajectory = state.fileTrajectory.trajectory || state.fileTrajectory;
      trajectory.signals?.countChanged?.add(updateFileTrajectoryControls);
      trajectory.signals?.gotNumframes?.add(updateFileTrajectoryControls);
      trajectory.signals?.frameChanged?.add(updateFileTrajectoryControls);
      updateFileTrajectoryControls();
      updatePayload();
      setStatus(`Loaded trajectory ${name}.`);
    } catch (err) {
      disposeFileTrajectory();
      updateFileTrajectoryControls();
      setStatus(`Could not load ${name}: ${err.message}`, true);
    }
  }

  async function loadTrajectoryFrames(source, name) {
    if (extension(name) === "dcd" && typeof source !== "string" && typeof state.structureSource !== "string") {
      return loadLocalSasmolDcd(state.structureSource, source, name);
    }
    return NGL.autoLoad(source, { ext: extension(name) });
  }

  async function loadLocalSasmolDcd(structureSource, trajectorySource, name) {
    const localHost = window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost";
    if (!localHost) {
      throw new Error("Local DCD files require the localhost Sasmol helper. Start local_sasmol_helper.py and open its URL.");
    }
    const form = new FormData();
    form.append("structure", structureSource, structureSource.name || "structure.pdb");
    form.append("trajectory", trajectorySource, trajectorySource.name || name);
    const response = await fetch("/local-sasmol/trajectory", { method: "POST", body: form });
    if (!response.ok) {
      let message = `local Sasmol helper returned ${response.status}`;
      try { message = (await response.json()).error || message; } catch (_error) { /* keep status text */ }
      throw new Error(message);
    }
    const buffer = await response.arrayBuffer();
    const header = new DataView(buffer);
    const magic = String.fromCharCode(header.getUint8(0), header.getUint8(1), header.getUint8(2), header.getUint8(3));
    const frameCount = header.getUint32(4, true);
    const atomCount = header.getUint32(8, true);
    const expectedBytes = 12 + frameCount * atomCount * 3 * 4;
    if (magic !== "NGLF" || frameCount < 1 || atomCount < 1 || buffer.byteLength !== expectedBytes) {
      throw new Error("local Sasmol helper returned invalid trajectory data");
    }
    const structureAtomCount = Number(state.structure?.structure?.atomCount || 0);
    if (structureAtomCount && atomCount !== structureAtomCount) {
      throw new Error(`trajectory has ${atomCount} atoms but the structure has ${structureAtomCount}`);
    }
    const values = new Float32Array(buffer, 12);
    const frameSize = atomCount * 3;
    const coordinates = [];
    for (let frame = 0; frame < frameCount; frame += 1) {
      coordinates.push(values.subarray(frame * frameSize, (frame + 1) * frameSize));
    }
    return { type: "Frames", name, path: "", coordinates, boxes: [] };
  }

  function setStatus(message, isError) {
    elements.status.textContent = message;
    elements.status.style.color = isError ? "#ff9c92" : "#cbd8d5";
  }

  function removeEmptyState(container) {
    if (container.classList.contains("empty")) {
      container.classList.remove("empty");
      container.textContent = "";
    }
  }

  function restoreEmptyState(container, message) {
    if (!container.children.length) {
      container.classList.add("empty");
      container.textContent = message;
    }
  }

  function customColorScheme(field, molecule) {
    const values = molecule?.catalog?.atom_values?.[field];
    if (!values) throw new Error(`${field} coloring requires a local PDB catalog`);
    molecule.colorSchemes ||= {};
    if (molecule.colorSchemes[field]) return molecule.colorSchemes[field];
    const palette = [0x4ca6ff, 0xfb9a99, 0x8dd3c7, 0xfdb462, 0xbebada, 0xb3de69, 0xffed6f, 0xbc80bd];
    const colors = {}; let number = 0;
    values.forEach((value) => { if (colors[value] === undefined) { colors[value] = palette[number % palette.length]; number += 1; } });
    molecule.colorSchemes[field] = NGL.ColormakerRegistry.addScheme(function () {
      this.atomColor = function (atom) { return colors[values[atom.index]] ?? 0xffffff; };
    }, `sasmol-${field}-${state.molecules.indexOf(molecule)}`);
    return molecule.colorSchemes[field];
  }

  function representationParams(layer) {
    const selection = layer.resolvedSelection || "all";
    const colorScheme = layer.node.querySelector(".color-scheme").value;
    const params = {
      sele: selection,
      opacity: Number(layer.node.querySelector(".opacity").value)
    };
    if (colorScheme === "uniform" || colorScheme === "molecule") {
      params.color = colorScheme === "molecule" ? currentMolecule().color : layer.node.querySelector(".color").value;
    } else if (colorScheme.indexOf("sasmol-") === 0) {
      params.colorScheme = customColorScheme(colorScheme.slice(7), currentMolecule());
    } else {
      params.colorScheme = colorScheme;
    }
    return params;
  }

  function layerPayloadName(layer) {
    return layer.basis || "all atoms";
  }

  function setLayerMessage(layer, message, isError) {
    const messageNode = layer.node.querySelector(".layer-error");
    messageNode.textContent = message || "";
    messageNode.style.color = isError ? "#ff9c92" : "";
  }

  async function structureFileForSasmol() {
    if (!["pdb", "ent"].includes(extension(state.structureName))) {
      throw new Error("SasMol basis selections currently require a PDB structure");
    }
    if (typeof state.structureSource !== "string") return state.structureSource;
    const response = await fetch(state.structureSource);
    if (!response.ok) throw new Error(`could not read ${state.structureName}`);
    const blob = await response.blob();
    return new File([blob], state.structureName, { type: "chemical/x-pdb" });
  }

  async function loadBasisCatalog(molecule) {
    if (!localHelperAvailable || !["pdb", "ent"].includes(extension(molecule.name))) { renderBasisCatalog(); return; }
    try {
      activateMolecule(molecule);
      const form = new FormData(); const structureFile = await structureFileForSasmol();
      form.append("structure", structureFile, structureFile.name || "structure.pdb");
      const response = await fetch("/local-sasmol/catalog", { method: "POST", body: form });
      const catalog = await response.json();
      if (!response.ok) throw new Error(catalog.error || "catalog request failed");
      molecule.catalog = catalog;
    } catch (error) { molecule.catalogError = error.message; }
    if (molecule === currentMolecule()) { renderBasisCatalog(); molecule.layers.forEach(populateLayerBasis); }
  }

  function renderBasisCatalog() {
    const molecule = currentMolecule(); const catalog = molecule?.catalog;
    if (!catalog) { elements.basisCatalog.textContent = molecule?.catalogError || "Available for a PDB when opened with local_sasmol_helper.py."; return; }
    elements.basisCatalog.textContent = "";
    Object.entries(catalog.fields).forEach(([field, data]) => {
      const line = document.createElement("div");
      const shown = data.values.map((item) => `${item.value || "(blank)"} (${item.count})`).join(", ");
      line.innerHTML = `<code>${field}</code>: ${shown || "no values"}${data.truncated ? `; first ${data.values.length} of ${data.distinct_count}` : ""}`;
      elements.basisCatalog.appendChild(line);
    });
  }

  function populateLayerBasis(layer) {
    const keyword = layer.node.querySelector(".basis-keyword"); const value = layer.node.querySelector(".basis-value");
    const catalog = currentMolecule()?.catalog;
    keyword.textContent = "";
    keyword.append(new Option(catalog ? "Choose a field" : "Local PDB helper required", ""));
    if (catalog) Object.keys(catalog.fields).forEach((field) => keyword.append(new Option(field, field)));
    value.disabled = true; value.textContent = ""; value.append(new Option("Choose a field first", ""));
  }

  function updateBasisValues(layer) {
    const field = layer.node.querySelector(".basis-keyword").value; const value = layer.node.querySelector(".basis-value");
    const data = currentMolecule()?.catalog?.fields?.[field]; value.textContent = "";
    if (!data) { value.disabled = true; value.append(new Option("Choose a field first", "")); return; }
    value.disabled = false; value.append(new Option("Choose a value", ""));
    data.values.forEach((item) => value.append(new Option(`${item.value || "(blank)"} (${item.count})`, item.value)));
  }

  async function applySasmolSelection(layer) {
    const basis = layer.node.querySelector(".selection").value.trim();
    const count = layer.node.querySelector(".selection-count");
    setLayerMessage(layer, "");
    if (!basis) {
      layer.basis = "";
      layer.resolvedSelection = "all";
      count.value = "All atoms";
      count.textContent = "All atoms";
      replaceMoleculeRepresentation(layer);
      return;
    }
    const localHost = window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost";
    if (!localHost) {
      setLayerMessage(layer, "SasMol selections require the local Sasmol helper. Open the helper URL on your local machine.", true);
      return;
    }
    const apply = layer.node.querySelector(".apply-basis");
    apply.disabled = true;
    count.value = "Checking…";
    count.textContent = "Checking…";
    try {
      const structureFile = await structureFileForSasmol();
      const form = new FormData();
      form.append("structure", structureFile, structureFile.name || "structure.pdb");
      form.append("basis", basis);
      const response = await fetch("/local-sasmol/selection", { method: "POST", body: form });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || `local Sasmol helper returned ${response.status}`);
      if (!Array.isArray(payload.indices) || !payload.indices.length) {
        throw new Error("selection matches no atoms");
      }
      layer.basis = basis;
      layer.resolvedSelection = `@${payload.indices.join(",")}`;
      count.value = `${payload.count} atom${payload.count === 1 ? "" : "s"}`;
      count.textContent = count.value;
      replaceMoleculeRepresentation(layer);
    } catch (err) {
      count.value = "Not applied";
      count.textContent = "Not applied";
      setLayerMessage(layer, err.message, true);
    } finally {
      apply.disabled = false;
    }
  }

  function replaceMoleculeRepresentation(layer) {
    setLayerMessage(layer, "");
    if (layer.representation) {
      state.structure.removeRepresentation(layer.representation);
      layer.representation = null;
    }
    try {
      layer.representation = state.structure.addRepresentation(
        layer.node.querySelector(".representation").value,
        representationParams(layer)
      );
      layer.representation.setVisibility(layer.node.querySelector(".layer-visible").checked);
      updatePayload();
    } catch (err) {
      setLayerMessage(layer, err.message, true);
    }
  }

  function addMoleculeLayer(options) {
    if (!state.structure) return;
    removeEmptyState(elements.moleculeLayers);
    const node = document.getElementById("molecule-layer-template").content.firstElementChild.cloneNode(true);
    const layer = { node: node, representation: null, basis: options?.basis || "", resolvedSelection: "all" };
    node.querySelector(".selection").value = layer.basis;
    node.querySelector(".representation").value = options?.representation || "ball+stick";
    node.querySelector(".color-scheme").value = options?.colorScheme || "element";
    node.querySelector(".color").value = options?.color || "#4ca6ff";
    state.moleculeLayers.push(layer);
    elements.moleculeLayers.appendChild(node);
    populateLayerBasis(layer);

    node.querySelectorAll("input, select").forEach((control) => {
      if (control.classList.contains("selection")) return;
      control.addEventListener("input", function () {
        const output = control.parentElement.querySelector("output");
        if (output) output.value = Number(control.value).toFixed(2);
        replaceMoleculeRepresentation(layer);
      });
      control.addEventListener("change", function () { replaceMoleculeRepresentation(layer); });
    });
    node.querySelector(".apply-basis").addEventListener("click", () => applySasmolSelection(layer));
    node.querySelector(".basis-keyword").addEventListener("change", () => updateBasisValues(layer));
    node.querySelector(".insert-basis").addEventListener("click", () => {
      const field = node.querySelector(".basis-keyword").value;
      const value = node.querySelector(".basis-value").value;
      if (!field || value === "") return;
      const quoted = /[\s]/.test(value) ? `\"${value.replace(/\"/g, "\\\"")}\"` : value;
      const selection = node.querySelector(".selection");
      selection.value = selection.value.trim() ? `${selection.value} and ${field} == ${quoted}` : `${field} == ${quoted}`;
    });
    node.querySelector(".selection").addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        applySasmolSelection(layer);
      }
    });
    node.querySelector(".remove-layer").addEventListener("click", function () {
      if (layer.representation) state.structure.removeRepresentation(layer.representation);
      state.moleculeLayers = state.moleculeLayers.filter((item) => item !== layer);
      node.remove();
      restoreEmptyState(elements.moleculeLayers, "Add a layer to display part of the structure.");
      updatePayload();
    });
    replaceMoleculeRepresentation(layer);
  }

  function volumeParams(layer) {
    return {
      isolevel: Number(layer.node.querySelector(".isolevel").value),
      color: layer.node.querySelector(".color").value,
      opacity: Number(layer.node.querySelector(".opacity").value),
      side: layer.node.querySelector(".side").value,
      useWorker: false
    };
  }

  function replaceVolumeRepresentation(layer) {
    const error = layer.node.querySelector(".layer-error");
    error.textContent = "";
    if (layer.representation) {
      state.volume.removeRepresentation(layer.representation);
      layer.representation = null;
    }
    try {
      layer.representation = state.volume.addRepresentation("surface", volumeParams(layer));
      layer.representation.setVisibility(layer.node.querySelector(".layer-visible").checked);
    } catch (err) {
      error.textContent = err.message;
    }
  }

  function addVolumeLayer(options) {
    if (!state.volume) return;
    removeEmptyState(elements.volumeLayers);
    const node = document.getElementById("volume-layer-template").content.firstElementChild.cloneNode(true);
    const layer = { node: node, representation: null };
    node.querySelector(".layer-name").value = options?.name || "isosurface";
    node.querySelector(".isolevel").value = options?.isolevel ?? 0.015;
    node.querySelector(".color").value = options?.color || "#2f7fff";
    state.volumeLayers.push(layer);
    elements.volumeLayers.appendChild(node);

    node.querySelectorAll("input, select").forEach((control) => {
      control.addEventListener("input", function () {
        const output = control.parentElement.querySelector("output");
        if (output) output.value = Number(control.value).toFixed(2);
        replaceVolumeRepresentation(layer);
      });
      control.addEventListener("change", function () { replaceVolumeRepresentation(layer); });
    });
    node.querySelector(".remove-layer").addEventListener("click", function () {
      if (layer.representation) state.volume.removeRepresentation(layer.representation);
      state.volumeLayers = state.volumeLayers.filter((item) => item !== layer);
      node.remove();
      restoreEmptyState(elements.volumeLayers, "Add an isosurface to display the volume.");
    });
    replaceVolumeRepresentation(layer);
  }

  async function loadStructure(source, displayName) {
    const name = displayName || source.name;
    setStatus(`Loading structure ${name}…`);
    try {
      const component = await stage.loadFile(source, { ext: extension(name) });
      const molecule = { component, name, source, layers: [], trajectory: null, trajectoryName: "", axes: null, catalog: null, color: moleculeColors[state.molecules.length % moleculeColors.length] };
      // The lab owns its representations.  NGL adds an automatic full-structure
      // representation during load, which otherwise hides changes to Selection.
      component.reprList.slice().forEach((representation) => component.removeRepresentation(representation));
      state.molecules.push(molecule);
      activateMolecule(molecule);
      if (elements.showAxes.checked) {
        try { state.axes = component.addRepresentation("axes", { color: "white" }); molecule.axes = state.axes; } catch (_error) { elements.showAxes.checked = false; }
      }
      addMoleculeLayer({ representation: "ball+stick", colorScheme: "element" });
      component.autoView();
      loadBasisCatalog(molecule);
      setStatus(`Loaded structure ${name}.`);
    } catch (err) {
      setStatus(`Could not load ${name}: ${err.message}`, true);
    }
  }

  async function loadVolume(source, displayName) {
    const name = displayName || source.name;
    setStatus(`Loading Gaussian cube ${name}…`);
    if (state.volume) stage.removeComponent(state.volume);
    state.volumeLayers = [];
    elements.volumeLayers.textContent = "";
    elements.volumeLayers.classList.add("empty");
    try {
      state.volume = await stage.loadFile(source, { ext: "cube" });
      elements.addSurface.disabled = false;
      addVolumeLayer({ name: "positive", isolevel: 0.015, color: "#287cff" });
      addVolumeLayer({ name: "negative", isolevel: -0.015, color: "#ff3c52" });
      stage.autoView();
      setStatus(`Loaded Gaussian cube ${name}.`);
    } catch (err) {
      state.volume = null;
      elements.addSurface.disabled = true;
      restoreEmptyState(elements.volumeLayers, "Could not load the cube file.");
      setStatus(`Could not load ${name}: ${err.message}`, true);
    }
  }

  function extension(name) {
    const ext = name.split(".").pop().toLowerCase();
    return ext === "mmcif" ? "cif" : ext;
  }

  function updatePayload() {
    if (!state.molecules.length) {
      elements.payload.value = "";
      return;
    }
    const componentPayload = (molecule) => {
      const representations = molecule.layers.map((layer) => ({
      name: layerPayloadName(layer),
      type: layer.node.querySelector(".representation").value,
      params: representationParams(layer),
      visible: layer.node.querySelector(".layer-visible").checked
      }));
      const first = representations[0] || { type: "cartoon", params: {} };
      const result = { name: molecule.name, loadname: molecule.name, loadparams: { ext: extension(molecule.name) }, representation: first.type, representationParams: first.params, representations: representations.map(({ visible, ...rep }) => rep) };
      if (molecule.trajectoryName) result.trajectory = { loadname: molecule.trajectoryName, loadparams: { ext: extension(molecule.trajectoryName) } };
      return result;
    };
    const components = state.molecules.map(componentPayload);
    const first = components[0];
    const payload = {
      loadname: first.loadname,
      loadparams: first.loadparams,
      representation: first.representation,
      representationParams: first.representationParams,
      representations: first.representations,
      components
    };
    if (first.trajectory) payload.trajectory = first.trajectory;
    elements.payload.value = JSON.stringify(payload, null, 2);
  }

  elements.structureFile.addEventListener("change", (event) => { if (event.target.files[0]) loadStructure(event.target.files[0]); event.target.value = ""; });
  elements.trajectoryFile.addEventListener("change", (event) => { if (event.target.files[0]) loadTrajectory(event.target.files[0]); event.target.value = ""; });
  elements.volumeFile.addEventListener("change", (event) => event.target.files[0] && loadVolume(event.target.files[0]));
  document.getElementById("demo-structure").addEventListener("click", () => loadStructure("fixtures/demo.pdb", "demo.pdb"));
  document.getElementById("demo-volume").addEventListener("click", () => loadVolume("fixtures/demo.cube", "demo.cube"));
  elements.addLayer.addEventListener("click", () => addMoleculeLayer());
  elements.addSurface.addEventListener("click", () => addVolumeLayer());
  document.getElementById("open-molecule").addEventListener("click", function () { const menu = document.getElementById("molecule-menu"); menu.hidden = !menu.hidden; this.setAttribute("aria-expanded", String(!menu.hidden)); });
  document.getElementById("open-structure").addEventListener("click", () => { document.getElementById("molecule-menu").hidden = true; elements.structureFile.click(); });
  document.getElementById("open-trajectory").addEventListener("click", () => { document.getElementById("molecule-menu").hidden = true; if (!currentMolecule()) return setStatus("Load or choose a current molecule first.", true); elements.trajectoryFile.click(); });
  document.getElementById("center-view").addEventListener("click", () => stage.autoView(500));
  document.getElementById("toggle-spin").addEventListener("click", function () {
    const enabled = this.getAttribute("aria-pressed") !== "true";
    this.setAttribute("aria-pressed", String(enabled));
    stage.setSpin(enabled);
  });
  elements.cameraMode.addEventListener("change", () => stage.setParameters({ cameraType: elements.cameraMode.value }));
  elements.backgroundColor.addEventListener("input", () => stage.setParameters({ backgroundColor: elements.backgroundColor.value }));
  elements.mousePreset.addEventListener("change", () => {
    try { stage.mouseControls.preset(elements.mousePreset.value); } catch (_error) { elements.mousePreset.value = "default"; }
  });
  elements.showAxes.addEventListener("change", () => {
    if (state.axes && state.structure) state.structure.removeRepresentation(state.axes);
    state.axes = null;
    if (currentMolecule()) currentMolecule().axes = null;
    if (elements.showAxes.checked && state.structure) {
      try { state.axes = state.structure.addRepresentation("axes", { color: "white" }); if (currentMolecule()) currentMolecule().axes = state.axes; } catch (_error) { elements.showAxes.checked = false; }
    }
  });
  elements.fileTrajectoryPrevious.addEventListener("click", () => setFileTrajectoryFrame(Number(elements.fileTrajectoryFrame.value) - 1));
  elements.fileTrajectoryNext.addEventListener("click", () => setFileTrajectoryFrame(Number(elements.fileTrajectoryFrame.value) + 1));
  elements.fileTrajectoryFrame.addEventListener("input", () => setFileTrajectoryFrame(elements.fileTrajectoryFrame.value));
  elements.fileTrajectoryPlay.addEventListener("click", toggleFileTrajectoryPlayback);
  document.getElementById("clear-all").addEventListener("click", function () {
    // The bundled NGL trajectory must be disposed while its structure still
    // exists.  Removing all components first leaves it half-disposed and
    // prevents the rest of this reset handler from running.
    state.molecules.slice().forEach((molecule) => { activateMolecule(molecule); disposeFileTrajectory(); });
    stage.removeAllComponents();
    // NGL does not schedule an empty-scene redraw when its last component is
    // removed, so ask its viewer to paint the cleared background now.
    stage.viewer.requestRender();
    state.structure = null;
    state.molecules = [];
    state.currentMolecule = null;
    state.structureSource = null;
    state.volume = null;
    state.axes = null;
    state.moleculeLayers = [];
    state.volumeLayers = [];
    updateFileTrajectoryControls();
    elements.addLayer.disabled = true;
    elements.addSurface.disabled = true;
    elements.moleculeLayers.textContent = "";
    elements.volumeLayers.textContent = "";
    restoreEmptyState(elements.moleculeLayers, "Load a structure to add molecular layers.");
    restoreEmptyState(elements.volumeLayers, "Load a cube file to add isosurfaces.");
    updateMoleculeList();
    elements.volumeFile.value = "";
    updatePayload();
    setStatus("Viewer cleared.");
  });
  elements.saveCoordinates.addEventListener("click", async function () {
    const molecule = currentMolecule();
    if (!molecule || !localHelperAvailable) return;
    try {
      const file = await structureFileForSasmol(); const atomStore = molecule.component.structure.atomStore; const count = molecule.component.structure.atomCount;
      const coordinates = new Float32Array(count * 3);
      for (let atom = 0; atom < count; atom += 1) { coordinates[atom * 3] = atomStore.x[atom]; coordinates[atom * 3 + 1] = atomStore.y[atom]; coordinates[atom * 3 + 2] = atomStore.z[atom]; }
      const frame = new Uint8Array(12 + coordinates.byteLength); const view = new DataView(frame.buffer); view.setUint8(0, 78); view.setUint8(1, 71); view.setUint8(2, 76); view.setUint8(3, 70); view.setUint32(4, 1, true); view.setUint32(8, count, true); frame.set(new Uint8Array(coordinates.buffer), 12);
      const form = new FormData(); form.append("structure", file, file.name); form.append("coordinates", new Blob([frame]), "coordinates.nglf");
      const response = await fetch("/local-sasmol/save", { method: "POST", body: form }); if (!response.ok) { const body = await response.json(); throw new Error(body.error || "save failed"); }
      const url = URL.createObjectURL(await response.blob()); const link = document.createElement("a"); link.href = url; link.download = `${molecule.name.replace(/\.[^.]+$/, "")}_current_frame.pdb`; link.click(); URL.revokeObjectURL(url); setStatus(`Saved current coordinates for ${molecule.name}.`);
    } catch (error) { setStatus(`Could not save coordinates: ${error.message}`, true); }
  });
  document.getElementById("copy-payload").addEventListener("click", async function () {
    await navigator.clipboard.writeText(elements.payload.value);
    setStatus("Payload copied to the clipboard.");
  });

  stage.signals.clicked.add(function (proxy) {
    if (!proxy || !proxy.atom) {
      elements.picked.textContent = "Nothing selected.";
      return;
    }
    const atom = proxy.atom;
    elements.picked.textContent = `Atom ${atom.atomname} · ${atom.resname} ${atom.resno} · chain ${atom.chainname || atom.chainid || "-"} · index ${atom.index}`;
  });
  window.addEventListener("resize", () => stage.handleResize());
  elements.payload.value = "";
  setStatus(`Ready. GenApp bundled NGL ${NGL.Version}.`);
}());
