(function () {
  "use strict";

  const stage = new NGL.Stage("viewport", { backgroundColor: "#050909", cameraType: "orthographic" });
  const state = {
    structure: null,
    structureName: "",
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
    fileTrajectoryFrame: document.getElementById("file-trajectory-frame")
  };

  function updateFileTrajectoryControls() {
    const trajectory = state.fileTrajectory?.trajectory || state.fileTrajectory;
    const count = Number(trajectory?.frameCount ?? trajectory?._frameCount ?? 0);
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
    state.fileTrajectory?.dispose?.();
    state.fileTrajectory = null;
    state.fileTrajectoryName = "";
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
      const frames = await NGL.autoLoad(source, { ext: extension(name) });
      state.fileTrajectory = state.structure.addTrajectory(frames, { defaultMode: "loop" });
      state.fileTrajectoryName = name;
      const trajectory = state.fileTrajectory.trajectory || state.fileTrajectory;
      trajectory.signals?.countChanged?.add(updateFileTrajectoryControls);
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

  function representationParams(layer) {
    const selection = layer.node.querySelector(".selection").value.trim() || "all";
    const colorScheme = layer.node.querySelector(".color-scheme").value;
    const params = {
      sele: selection,
      opacity: Number(layer.node.querySelector(".opacity").value)
    };
    if (colorScheme === "uniform") {
      params.color = layer.node.querySelector(".color").value;
    } else {
      params.colorScheme = colorScheme;
    }
    return params;
  }

  function replaceMoleculeRepresentation(layer) {
    const error = layer.node.querySelector(".layer-error");
    error.textContent = "";
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
      error.textContent = err.message;
    }
  }

  function addMoleculeLayer(options) {
    if (!state.structure) return;
    removeEmptyState(elements.moleculeLayers);
    const node = document.getElementById("molecule-layer-template").content.firstElementChild.cloneNode(true);
    const layer = { node: node, representation: null };
    node.querySelector(".layer-name").value = options?.name || "selection";
    node.querySelector(".selection").value = options?.selection || "all";
    node.querySelector(".representation").value = options?.representation || "ball+stick";
    node.querySelector(".color-scheme").value = options?.colorScheme || "element";
    node.querySelector(".color").value = options?.color || "#4ca6ff";
    state.moleculeLayers.push(layer);
    elements.moleculeLayers.appendChild(node);

    node.querySelectorAll("input, select").forEach((control) => {
      control.addEventListener("input", function () {
        const output = control.parentElement.querySelector("output");
        if (output) output.value = Number(control.value).toFixed(2);
        replaceMoleculeRepresentation(layer);
      });
      control.addEventListener("change", function () { replaceMoleculeRepresentation(layer); });
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
    disposeFileTrajectory();
    if (state.structure) stage.removeComponent(state.structure);
    state.axes = null;
    state.moleculeLayers = [];
    elements.moleculeLayers.textContent = "";
    elements.moleculeLayers.classList.add("empty");
    try {
      state.structure = await stage.loadFile(source, { ext: extension(name) });
      state.structureName = name;
      elements.addLayer.disabled = false;
      if (elements.showAxes.checked) {
        try { state.axes = state.structure.addRepresentation("axes", { color: "white" }); } catch (_error) { elements.showAxes.checked = false; }
      }
      addMoleculeLayer({ name: "molecule", selection: "all", representation: "ball+stick", colorScheme: "element" });
      state.structure.autoView();
      setStatus(`Loaded structure ${name}.`);
    } catch (err) {
      state.structure = null;
      elements.addLayer.disabled = true;
      restoreEmptyState(elements.moleculeLayers, "Could not load the structure.");
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
    if (!state.structure) {
      elements.payload.value = "";
      return;
    }
    const representations = state.moleculeLayers.map((layer) => ({
      name: layer.node.querySelector(".layer-name").value || "selection",
      type: layer.node.querySelector(".representation").value,
      params: representationParams(layer),
      visible: layer.node.querySelector(".layer-visible").checked
    }));
    const first = representations[0] || { type: "cartoon", params: {} };
    elements.payload.value = JSON.stringify({
      loadname: state.structureName,
      loadparams: { ext: extension(state.structureName) },
      representation: first.type,
      representationParams: first.params,
      representations: representations.map(({ visible, ...rep }) => rep)
    }, null, 2);
    if (state.fileTrajectoryName) {
      const payload = JSON.parse(elements.payload.value);
      payload.trajectory = { loadname: state.fileTrajectoryName, loadparams: { ext: extension(state.fileTrajectoryName) } };
      elements.payload.value = JSON.stringify(payload, null, 2);
    }
  }

  elements.structureFile.addEventListener("change", (event) => event.target.files[0] && loadStructure(event.target.files[0]));
  elements.trajectoryFile.addEventListener("change", (event) => event.target.files[0] && loadTrajectory(event.target.files[0]));
  elements.volumeFile.addEventListener("change", (event) => event.target.files[0] && loadVolume(event.target.files[0]));
  document.getElementById("demo-structure").addEventListener("click", () => loadStructure("fixtures/demo.pdb", "demo.pdb"));
  document.getElementById("demo-volume").addEventListener("click", () => loadVolume("fixtures/demo.cube", "demo.cube"));
  elements.addLayer.addEventListener("click", () => addMoleculeLayer());
  elements.addSurface.addEventListener("click", () => addVolumeLayer());
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
    if (elements.showAxes.checked && state.structure) {
      try { state.axes = state.structure.addRepresentation("axes", { color: "white" }); } catch (_error) { elements.showAxes.checked = false; }
    }
  });
  elements.fileTrajectoryPrevious.addEventListener("click", () => setFileTrajectoryFrame(Number(elements.fileTrajectoryFrame.value) - 1));
  elements.fileTrajectoryNext.addEventListener("click", () => setFileTrajectoryFrame(Number(elements.fileTrajectoryFrame.value) + 1));
  elements.fileTrajectoryFrame.addEventListener("input", () => setFileTrajectoryFrame(elements.fileTrajectoryFrame.value));
  elements.fileTrajectoryPlay.addEventListener("click", toggleFileTrajectoryPlayback);
  document.getElementById("clear-all").addEventListener("click", function () {
    stage.removeAllComponents();
    state.structure = null;
    state.volume = null;
    state.axes = null;
    disposeFileTrajectory();
    state.moleculeLayers = [];
    state.volumeLayers = [];
    updateFileTrajectoryControls();
    elements.addLayer.disabled = true;
    elements.addSurface.disabled = true;
    elements.moleculeLayers.textContent = "";
    elements.volumeLayers.textContent = "";
    restoreEmptyState(elements.moleculeLayers, "Load a structure to add molecular layers.");
    restoreEmptyState(elements.volumeLayers, "Load a cube file to add isosurfaces.");
    updatePayload();
    setStatus("Viewer cleared.");
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
