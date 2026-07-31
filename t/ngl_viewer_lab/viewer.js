(function () {
  "use strict";

  const stage = new NGL.Stage("viewport", { backgroundColor: "#050909", cameraType: "orthographic" });
  const streamingAvailable = new URLSearchParams(window.location.search).get("streaming") !== "off";
  const state = {
    structure: null,
    structureName: "",
    volume: null,
    axes: null,
    moleculeLayers: [],
    volumeLayers: [],
    trajectory: { frames: [], cursor: 0, timer: null }
  };

  const elements = {
    structureFile: document.getElementById("structure-file"),
    volumeFile: document.getElementById("volume-file"),
    moleculeLayers: document.getElementById("molecule-layers"),
    volumeLayers: document.getElementById("volume-layers"),
    addLayer: document.getElementById("add-layer"),
    addSurface: document.getElementById("add-surface"),
    status: document.getElementById("status"),
    picked: document.getElementById("picked"),
    payload: document.getElementById("payload"),
    benchmarkRun: document.getElementById("benchmark-run"),
    benchmarkAtoms: document.getElementById("benchmark-atoms"),
    benchmarkFrames: document.getElementById("benchmark-frames"),
    benchmarkInterval: document.getElementById("benchmark-interval"),
    benchmarkTransport: document.getElementById("benchmark-transport"),
    benchmarkTopology: document.getElementById("benchmark-topology"),
    benchmarkRepresentation: document.getElementById("benchmark-representation"),
    benchmarkScale: document.getElementById("benchmark-scale"),
    benchmarkResults: document.getElementById("benchmark-results"),
    cameraMode: document.getElementById("camera-mode"),
    backgroundColor: document.getElementById("background-color"),
    mousePreset: document.getElementById("mouse-preset"),
    showAxes: document.getElementById("show-axes"),
    trajectoryStatus: document.getElementById("trajectory-status"),
    trajectoryPrevious: document.getElementById("trajectory-previous"),
    trajectoryPlay: document.getElementById("trajectory-play"),
    trajectoryNext: document.getElementById("trajectory-next"),
    trajectoryFrame: document.getElementById("trajectory-frame"),
    trajectorySpeed: document.getElementById("trajectory-speed")
  };

  function stopTrajectory() {
    if (state.trajectory.timer) window.clearTimeout(state.trajectory.timer);
    state.trajectory.timer = null;
    elements.trajectoryPlay.textContent = "Play";
    elements.trajectoryPlay.setAttribute("aria-pressed", "false");
  }

  function updateTrajectoryControls() {
    const count = state.trajectory.frames.length;
    const enabled = count > 1 && Boolean(state.structure);
    [elements.trajectoryPrevious, elements.trajectoryPlay, elements.trajectoryNext, elements.trajectoryFrame].forEach((control) => { control.disabled = !enabled; });
    elements.trajectoryFrame.max = String(Math.max(1, count));
    elements.trajectoryFrame.value = String(Math.min(count || 1, state.trajectory.cursor + 1));
    elements.trajectoryStatus.textContent = count ? `${count} retained frame${count === 1 ? "" : "s"}; frame ${state.trajectory.cursor + 1}.` : "No frames retained.";
  }

  function showTrajectoryFrame(index) {
    const frames = state.trajectory.frames;
    if (!state.structure || !frames.length) return;
    state.trajectory.cursor = Math.max(0, Math.min(frames.length - 1, index));
    applyCoordinateFrame(state.structure, frames[state.trajectory.cursor]);
    updateTrajectoryControls();
  }

  function playTrajectory() {
    stopTrajectory();
    if (state.trajectory.frames.length < 2 || !state.structure) return;
    elements.trajectoryPlay.textContent = "Pause";
    elements.trajectoryPlay.setAttribute("aria-pressed", "true");
    const tick = () => {
      if (!state.trajectory.timer) return;
      showTrajectoryFrame((state.trajectory.cursor + 1) % state.trajectory.frames.length);
      state.trajectory.timer = window.setTimeout(tick, Math.max(20, Number(elements.trajectorySpeed.value) || 250));
    };
    state.trajectory.timer = window.setTimeout(tick, Math.max(20, Number(elements.trajectorySpeed.value) || 250));
  }

  function clearTrajectory() {
    stopTrajectory();
    state.trajectory.frames = [];
    state.trajectory.cursor = 0;
    updateTrajectoryControls();
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
    if (state.structure) stage.removeComponent(state.structure);
    state.axes = null;
    clearTrajectory();
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

  function nowMs() {
    return window.performance?.now ? window.performance.now() : Date.now();
  }

  function sleep(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function setBenchmarkResults(lines) {
    elements.benchmarkResults.textContent = Array.isArray(lines) ? lines.join("\n") : String(lines);
  }

  function applyCoordinateFrame(component, coordinates) {
    const started = nowMs();
    component.structure.updatePosition(coordinates);
    if (typeof component.updateRepresentations === "function") {
      component.updateRepresentations({ position: true });
    }
    stage.viewer.requestRender();
    return nowMs() - started;
  }

  function summarizeMetric(values) {
    const sorted = values.slice().sort((a, b) => a - b);
    const sum = sorted.reduce((total, value) => total + value, 0);
    const pick = (fraction) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))] || 0;
    return {
      avg: sorted.length ? sum / sorted.length : 0,
      p50: pick(0.50),
      p95: pick(0.95),
      max: sorted[sorted.length - 1] || 0
    };
  }

  function metricLine(label, values, unit) {
    const metric = summarizeMetric(values);
    return `${label}: avg ${metric.avg.toFixed(2)} ${unit}, p50 ${metric.p50.toFixed(2)}, p95 ${metric.p95.toFixed(2)}, max ${metric.max.toFixed(2)}`;
  }

  async function fetchBenchmarkFrame(atoms, frame, transport, topology) {
    const fetchStarted = nowMs();
    const topologyParam = topology && topology !== "synthetic"
      ? `&topology=${encodeURIComponent(topology)}`
      : "";
    if (transport === "binary") {
      const response = await fetch(`/stream/frame.bin?atoms=${atoms}&frame=${frame}${topologyParam}`);
      const bytes = Number(response.headers.get("Content-Length") || 0);
      const buffer = await response.arrayBuffer();
      return {
        coordinates: new Float32Array(buffer),
        fetchMs: nowMs() - fetchStarted,
        parseMs: 0,
        bytes: bytes || buffer.byteLength
      };
    }
    const response = await fetch(`/stream/frame.json?atoms=${atoms}&frame=${frame}${topologyParam}`);
    const bytes = Number(response.headers.get("Content-Length") || 0);
    const text = await response.text();
    const fetchedAt = nowMs();
    const payload = JSON.parse(text);
    const parsedAt = nowMs();
    return {
      coordinates: new Float32Array(payload.coordinates),
      fetchMs: fetchedAt - fetchStarted,
      parseMs: parsedAt - fetchedAt,
      bytes: bytes || text.length
    };
  }

  async function runBenchmark() {
    if (!streamingAvailable) {
      setBenchmarkResults("Streaming is disabled for this static preview. Use the local lab server or a live GenApp job to exercise coordinate streaming.");
      return;
    }
    const requestedAtoms = Math.max(1, Number(elements.benchmarkAtoms.value) || 6730);
    const topology = elements.benchmarkTopology.value;
    const scale = elements.benchmarkScale.value;
    const topologyAtomCounts = {
      hiv1_gag: 6730,
      hiv1_gag_reduced: 431
    };
    const topologyAtoms = topologyAtomCounts[topology] || requestedAtoms;
    const atoms = scale === "reduced" ? Math.max(1, Math.round(topologyAtoms / 8)) : topologyAtoms;
    const frames = Math.max(1, Number(elements.benchmarkFrames.value) || 1);
    const interval = Math.max(0, Number(elements.benchmarkInterval.value) || 0);
    const transport = elements.benchmarkTransport.value;
    const representation = elements.benchmarkRepresentation.value;
    const fetchTimes = [];
    const parseTimes = [];
    const renderTimes = [];
    let totalBytes = 0;

    elements.benchmarkRun.disabled = true;
    setBenchmarkResults([
      `Starting benchmark: ${atoms} rendered atoms (${scale}, requested ${requestedAtoms}), ${frames} frames, ${transport}, ${interval} ms interval.`,
      `Loading ${topology} PDB from the serving host...`
    ]);
    try {
      const topologyFiles = {
        hiv1_gag: "fixtures/hiv1_gag_charmm27.pdb",
        hiv1_gag_reduced: "fixtures/hiv1_gag_charmm27_reduced_ca_p.pdb"
      };
      const topologyNames = {
        hiv1_gag: "hiv1_gag_charmm27.pdb",
        hiv1_gag_reduced: "hiv1_gag_charmm27_reduced_ca_p.pdb"
      };
      const structureUrl = topologyFiles[topology] || `/stream/pdb?atoms=${atoms}`;
      const structureName = topologyNames[topology] || `synthetic_${atoms}.pdb`;
      const loadStarted = nowMs();
      await loadStructure(structureUrl, structureName);
      const loadMs = nowMs() - loadStarted;
      if (!state.structure) throw new Error("synthetic structure did not load");
      state.moleculeLayers.slice().forEach((layer) => {
        if (layer.representation) state.structure.removeRepresentation(layer.representation);
        layer.node.remove();
      });
      state.moleculeLayers = [];
      elements.moleculeLayers.textContent = "";
      elements.moleculeLayers.classList.add("empty");
      addMoleculeLayer({ name: "benchmark", selection: "all", representation, colorScheme: "chainid" });
      stage.autoView(250);

      const started = nowMs();
      for (let frame = 1; frame <= frames; frame += 1) {
        const framePayload = await fetchBenchmarkFrame(atoms, frame, transport, topology);
        if (framePayload.coordinates.length !== atoms * 3) {
          throw new Error(`frame ${frame} had ${framePayload.coordinates.length / 3} atoms, expected ${atoms}`);
        }
        fetchTimes.push(framePayload.fetchMs);
        parseTimes.push(framePayload.parseMs);
        totalBytes += framePayload.bytes;
        renderTimes.push(applyCoordinateFrame(state.structure, framePayload.coordinates));
        state.trajectory.frames.push(framePayload.coordinates.slice());
        if (state.trajectory.frames.length > 40) state.trajectory.frames.shift();
        state.trajectory.cursor = state.trajectory.frames.length - 1;
        const elapsed = (nowMs() - started) / 1000;
        const mb = totalBytes / (1024 * 1024);
        setBenchmarkResults([
          `Running ${transport} stream: frame ${frame}/${frames}`,
          `Atoms: ${atoms} (${scale}); topology: ${topology}`,
          `Structure load/setup: ${loadMs.toFixed(2)} ms`,
          `Transferred: ${mb.toFixed(2)} MiB in ${elapsed.toFixed(2)} s`,
          metricLine("Fetch", fetchTimes, "ms"),
          metricLine("Parse", parseTimes, "ms"),
          metricLine("NGL update", renderTimes, "ms")
        ]);
        if (frame < frames && interval > 0) await sleep(interval);
      }
      updateTrajectoryControls();
      const totalSeconds = (nowMs() - started) / 1000;
      const mb = totalBytes / (1024 * 1024);
      setBenchmarkResults([
        `Completed ${transport} stream.`,
        `Atoms: ${atoms} (${scale}; requested ${requestedAtoms}); topology: ${topology}`,
        `Frames: ${frames}; interval: ${interval} ms`,
        `Structure load/setup: ${loadMs.toFixed(2)} ms`,
        `Transferred: ${mb.toFixed(2)} MiB; effective rate: ${(mb / Math.max(totalSeconds, 0.001)).toFixed(2)} MiB/s`,
        metricLine("Fetch", fetchTimes, "ms"),
        metricLine("Parse", parseTimes, "ms"),
        metricLine("NGL update", renderTimes, "ms")
      ]);
    } catch (err) {
      setBenchmarkResults(`Benchmark failed: ${err.message}`);
      setStatus(`Benchmark failed: ${err.message}`, true);
    } finally {
      elements.benchmarkRun.disabled = false;
    }
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
  }

  elements.structureFile.addEventListener("change", (event) => event.target.files[0] && loadStructure(event.target.files[0]));
  elements.volumeFile.addEventListener("change", (event) => event.target.files[0] && loadVolume(event.target.files[0]));
  document.getElementById("demo-structure").addEventListener("click", () => loadStructure("fixtures/demo.pdb", "demo.pdb"));
  document.getElementById("demo-volume").addEventListener("click", () => loadVolume("fixtures/demo.cube", "demo.cube"));
  elements.addLayer.addEventListener("click", () => addMoleculeLayer());
  elements.addSurface.addEventListener("click", () => addVolumeLayer());
  elements.benchmarkRun.addEventListener("click", runBenchmark);
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
  elements.trajectoryPrevious.addEventListener("click", () => showTrajectoryFrame(state.trajectory.cursor - 1));
  elements.trajectoryNext.addEventListener("click", () => showTrajectoryFrame(state.trajectory.cursor + 1));
  elements.trajectoryFrame.addEventListener("input", () => showTrajectoryFrame(Number(elements.trajectoryFrame.value) - 1));
  elements.trajectoryPlay.addEventListener("click", () => state.trajectory.timer ? stopTrajectory() : playTrajectory());
  document.getElementById("clear-all").addEventListener("click", function () {
    stage.removeAllComponents();
    state.structure = null;
    state.volume = null;
    state.axes = null;
    state.moleculeLayers = [];
    state.volumeLayers = [];
    clearTrajectory();
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
  if (!streamingAvailable) {
    elements.benchmarkRun.disabled = true;
    setBenchmarkResults("Streaming is disabled for this static preview. Use the local lab server or a live GenApp job to exercise coordinate streaming.");
  }
  setStatus(`Ready. GenApp bundled NGL ${NGL.Version}.`);
}());
