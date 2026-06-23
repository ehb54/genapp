(function () {
  "use strict";

  const candidateModules = [
    "data_interpolation",
    "align",
    "extract_utilities",
    "merge_utilities",
    "multi_component_analysis",
    "sas_assembly",
    "shared",
    "plain",
    "typed"
  ];

  const state = {
    moduleId: "",
    module: null,
    view: {},
    values: {}
  };

  const nodes = {
    input: document.getElementById("ui2-module-id"),
    load: document.getElementById("ui2-load"),
    refresh: document.getElementById("ui2-refresh"),
    root: document.getElementById("ui2-module-root"),
    empty: document.getElementById("ui2-empty"),
    candidates: document.getElementById("ui2-module-candidates")
  };

  function init() {
    candidateModules.forEach((id) => {
      const option = document.createElement("option");
      option.value = id;
      nodes.candidates.appendChild(option);
    });

    const params = new URLSearchParams(window.location.search);
    nodes.input.value = params.get("module") || candidateModules[0];

    nodes.load.addEventListener("click", () => loadModule(nodes.input.value));
    nodes.refresh.addEventListener("click", () => loadModule(state.moduleId || nodes.input.value));
    nodes.input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        loadModule(nodes.input.value);
      }
    });

    const requested = params.get("module");
    if (requested) {
      loadModule(requested);
    } else {
      loadFirstAvailable();
    }
  }

  async function loadModule(rawId) {
    const moduleId = sanitizeModuleId(rawId);
    if (!moduleId) {
      showError("Enter a module id.");
      return;
    }

    nodes.input.value = moduleId;
    nodes.root.hidden = true;
    nodes.empty.hidden = false;
    nodes.empty.innerHTML = `<p class="ui2-kicker">Loading</p><h2>${escapeHtml(moduleId)}</h2>`;

    try {
      const response = await fetch(`modules/${encodeURIComponent(moduleId)}.json`, { cache: "no-cache" });
      if (!response.ok) {
        throw new Error(`modules/${moduleId}.json returned ${response.status}`);
      }
      const payload = await response.json();
      state.moduleId = moduleId;
      state.module = payload.modulejson || payload;
      state.view = payload.viewjson || {};
      state.values = {};
      renderModule();
    } catch (error) {
      showError(`Could not load ${moduleId}: ${error.message}`);
    }
  }

  async function loadFirstAvailable() {
    for (const moduleId of candidateModules) {
      try {
        const response = await fetch(`modules/${encodeURIComponent(moduleId)}.json`, { cache: "no-cache" });
        if (!response.ok) {
          continue;
        }
        const payload = await response.json();
        nodes.input.value = moduleId;
        state.moduleId = moduleId;
        state.module = payload.modulejson || payload;
        state.view = payload.viewjson || {};
        state.values = {};
        renderModule();
        return;
      } catch (error) {
        // Keep looking; this startup path is intentionally forgiving.
      }
    }
    showError("No candidate modules could be loaded. Enter a module id manually.");
  }

  function renderModule() {
    const module = state.module || {};
    const fields = Array.isArray(module.fields) ? module.fields : [];
    const inputFields = fields.filter((field) => field.role !== "output");
    const outputFields = fields.filter((field) => field.role === "output");

    nodes.empty.hidden = true;
    nodes.root.hidden = false;
    nodes.root.innerHTML = "";

    const container = el("div", "ui2-module");
    container.appendChild(renderHeader(module, fields));
    container.appendChild(renderTabs(inputFields.length, outputFields.length));

    const form = el("form");
    form.id = "ui2-form";
    form.appendChild(renderSection("Inputs", inputFields, "input"));
    form.appendChild(renderSection("Outputs", outputFields, "output"));
    form.appendChild(renderPreview());
    form.addEventListener("input", syncValues);
    form.addEventListener("change", syncValues);

    container.appendChild(form);
    nodes.root.appendChild(container);
    syncValues();
  }

  function renderHeader(module, fields) {
    const header = el("header", "ui2-module-header");
    const titleWrap = el("div");
    const kicker = el("p", "ui2-kicker", module.moduleid || state.moduleId || "module");
    const title = el("h2", "ui2-module-title", module.label || module.moduleid || state.moduleId);
    const meta = el("div", "ui2-meta");

    meta.appendChild(el("span", "ui2-pill", `${fields.length} fields`));
    meta.appendChild(el("span", "ui2-pill", `${fields.filter((field) => field.role === "output").length} outputs`));
    if (module.executable) {
      meta.appendChild(el("span", "ui2-pill", `exec: ${module.executable}`));
    }
    if (Object.keys(state.view || {}).length) {
      meta.appendChild(el("span", "ui2-pill", "view metadata"));
    }

    titleWrap.append(kicker, title, meta);
    header.appendChild(titleWrap);
    return header;
  }

  function renderTabs(inputCount, outputCount) {
    const tabs = el("div", "ui2-tabs");
    tabs.setAttribute("role", "tablist");
    tabs.appendChild(tabButton("Inputs", inputCount, true, "ui2-input-section"));
    tabs.appendChild(tabButton("Outputs", outputCount, false, "ui2-output-section"));
    return tabs;
  }

  function tabButton(label, count, selected, targetId) {
    const button = el("button", "ui2-tab", `${label} ${count}`);
    button.type = "button";
    button.setAttribute("role", "tab");
    button.setAttribute("aria-selected", selected ? "true" : "false");
    button.addEventListener("click", () => {
      document.querySelectorAll(".ui2-tab").forEach((node) => node.setAttribute("aria-selected", "false"));
      button.setAttribute("aria-selected", "true");
      document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return button;
  }

  function renderSection(title, fields, role) {
    const section = el("section", "ui2-section");
    section.id = role === "output" ? "ui2-output-section" : "ui2-input-section";
    const header = el("div", "ui2-section-header");
    header.appendChild(el("h2", null, title));
    header.appendChild(el("span", "ui2-pill", `${fields.length}`));
    const body = el("div", "ui2-section-body");

    if (!fields.length) {
      body.appendChild(el("p", "ui2-help", `No ${title.toLowerCase()} declared.`));
    } else {
      fields.forEach((field) => body.appendChild(renderField(field, role)));
    }

    section.append(header, body);
    return section;
  }

  function renderField(field, role) {
    const row = el("div", "ui2-field");
    row.dataset.fieldId = field.id || "";
    if (field.repeat) {
      row.dataset.repeat = field.repeat;
    }

    const label = el("label", "ui2-field-label");
    label.textContent = field.label || field.id || field.type || "field";
    if (field.id) {
      label.setAttribute("for", fieldId(field));
      label.appendChild(el("small", null, `${field.id} · ${field.type || "text"}`));
    }

    const stack = el("div", "ui2-control-stack");
    stack.appendChild(role === "output" ? renderOutput(field) : renderControl(field));
    if (field.help) {
      stack.appendChild(el("p", "ui2-help", stripTags(field.help)));
    }
    if (field.repeat) {
      stack.appendChild(el("p", "ui2-help", `Visible when ${field.repeat}`));
    }
    if (isRepeater(field)) {
      stack.appendChild(el("p", "ui2-help", "Repeater source"));
    }

    row.append(label, stack);
    return row;
  }

  function renderControl(field) {
    const type = String(field.type || "text").toLowerCase();
    if (type === "label") {
      return el("div", "ui2-note", field.default || field.label || "");
    }
    if (type === "html") {
      const note = el("div", "ui2-note");
      note.innerHTML = field.default || "";
      return note;
    }
    if (type === "textarea") {
      const textarea = el("textarea", "ui2-textarea");
      wireControl(textarea, field);
      textarea.value = field.default || "";
      return textarea;
    }
    if (type === "checkbox") {
      const label = el("label", "ui2-switch");
      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = String(field.checked || field.default || "").toLowerCase() === "true";
      wireControl(input, field);
      label.append(input, document.createTextNode(field.checked ? "Enabled" : "Optional"));
      return label;
    }
    if (type === "listbox" || type === "select") {
      const select = el("select", "ui2-select");
      parseValues(field.values).forEach((choice) => {
        const option = document.createElement("option");
        option.value = choice.value;
        option.textContent = choice.label;
        select.appendChild(option);
      });
      wireControl(select, field);
      select.value = field.default || select.value;
      return select;
    }
    if (type === "radio") {
      const group = el("div", "ui2-radio-group");
      parseValues(field.values).forEach((choice, index) => {
        const item = el("label", "ui2-radio");
        const input = document.createElement("input");
        input.type = "radio";
        input.name = field.id;
        input.value = choice.value;
        input.checked = String(field.default || "") === choice.value || (!field.default && index === 0);
        wireControl(input, field);
        item.append(input, document.createTextNode(choice.label));
        group.appendChild(item);
      });
      return group;
    }
    if (type === "button") {
      const button = el("button", "ui2-button ui2-button-quiet", field.buttontext || field.label || "Action");
      button.type = "button";
      button.id = fieldId(field);
      return button;
    }
    if (type === "integerpair") {
      const pair = el("div", "ui2-pair");
      ["First", "Second"].forEach((labelText, index) => {
        const input = el("input", "ui2-input");
        input.type = "number";
        input.placeholder = labelText;
        input.id = `${fieldId(field)}-${index}`;
        input.dataset.fieldId = field.id || "";
        pair.appendChild(input);
      });
      return pair;
    }
    if (type === "grid" || type === "grid2") {
      return el("div", "ui2-output", `${type} field placeholder. A dedicated table/matrix widget belongs here.`);
    }

    const input = el("input", "ui2-input");
    input.type = inputType(type);
    if (type === "lrfile" || type === "file" || type === "rpath") {
      input.placeholder = type === "rpath" ? "Path" : "File";
    }
    wireControl(input, field);
    input.value = field.default == null ? "" : field.default;
    return input;
  }

  function renderOutput(field) {
    const type = String(field.type || "html").toLowerCase();
    if (type === "progress") {
      const progress = el("progress", "ui2-progress");
      progress.max = field.max || 1;
      progress.value = 0;
      return progress;
    }
    return el("div", "ui2-output", `${field.type || "output"} output will appear here at runtime.`);
  }

  function renderPreview() {
    const section = el("section", "ui2-section");
    const header = el("div", "ui2-section-header");
    header.appendChild(el("h2", null, "Input Preview"));
    header.appendChild(el("span", "ui2-pill", "local only"));
    const body = el("div", "ui2-section-body");
    const pre = el("pre", "ui2-output");
    pre.id = "ui2-preview";
    body.appendChild(pre);
    section.append(header, body);
    return section;
  }

  function syncValues() {
    const form = document.getElementById("ui2-form");
    if (!form) {
      return;
    }
    state.values = {};
    form.querySelectorAll("[data-field-id]").forEach((control) => {
      const id = control.dataset.fieldId;
      if (!id || control.type === "radio" && !control.checked) {
        return;
      }
      state.values[id] = control.type === "checkbox" ? control.checked : control.value;
    });
    updateRepeats(form);
    const preview = document.getElementById("ui2-preview");
    if (preview) {
      preview.textContent = JSON.stringify(state.values, null, 2);
    }
  }

  function updateRepeats(scope) {
    scope.querySelectorAll("[data-repeat]").forEach((row) => {
      row.classList.toggle("ui2-hidden", !repeatIsActive(row.dataset.repeat));
    });
  }

  function repeatIsActive(expression) {
    if (!expression) {
      return true;
    }
    const [rawId, rawValue] = expression.split(":");
    const id = rawId.trim();
    const expected = rawValue == null ? true : rawValue.trim();
    const actual = state.values[id];
    if (rawValue == null) {
      return Boolean(actual) && actual !== "false";
    }
    return String(actual) === expected;
  }

  function wireControl(control, field) {
    control.id = fieldId(field);
    control.dataset.fieldId = field.id || "";
    if (field.required === "true" || field.required === true) {
      control.required = true;
    }
  }

  function fieldId(field) {
    return `ui2-field-${sanitizeModuleId(field.id || field.label || field.type || "field")}`;
  }

  function sanitizeModuleId(value) {
    return String(value || "").trim().replace(/[^A-Za-z0-9_-]/g, "");
  }

  function inputType(type) {
    if (type === "integer" || type === "float") {
      return "number";
    }
    if (type === "password" || type === "date" || type === "email") {
      return type;
    }
    return "text";
  }

  function isRepeater(field) {
    return String(field.repeater || "").toLowerCase() === "true" || String(field.repeater || "").toLowerCase() === "yes";
  }

  function parseValues(values) {
    if (!values) {
      return [];
    }
    const parts = String(values).split("~");
    const choices = [];
    for (let i = 0; i < parts.length; i += 2) {
      choices.push({
        label: parts[i] || parts[i + 1] || "",
        value: parts[i + 1] || parts[i] || ""
      });
    }
    return choices;
  }

  function stripTags(value) {
    const div = document.createElement("div");
    div.innerHTML = String(value);
    return div.textContent || div.innerText || "";
  }

  function showError(message) {
    nodes.empty.hidden = true;
    nodes.root.hidden = false;
    nodes.root.innerHTML = "";
    nodes.root.appendChild(el("div", "ui2-error", message));
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;"
    }[char]));
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) {
      node.className = className;
    }
    if (text != null) {
      node.textContent = text;
    }
    return node;
  }

  init();
}());
