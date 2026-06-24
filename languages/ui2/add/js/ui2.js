(function () {
  "use strict";

  const fallbackModules = [
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

  const appMap = window.GenAppUi2App || { menus: [] };
  const candidateModules = moduleCandidates();
  const params = new URLSearchParams(window.location.search);
  const prefs = loadPreferences();
  const devMode = params.get("ui2dev") === "1" || prefs.devMode === true;

  const state = {
    moduleId: "",
    menuId: "",
    module: null,
    view: {},
    values: {},
    submitResponse: null,
    session: {
      logon: "",
      project: "",
      groups: {},
      usergroups: [],
      theme: "",
      loaded: false
    }
  };

  const nodes = {
    input: document.getElementById("ui2-module-id"),
    load: document.getElementById("ui2-load"),
    refresh: document.getElementById("ui2-refresh"),
    root: document.getElementById("ui2-module-root"),
    empty: document.getElementById("ui2-empty"),
    candidates: document.getElementById("ui2-module-candidates"),
    menuNav: document.getElementById("ui2-menu-nav"),
    navToggle: document.getElementById("ui2-nav-toggle"),
    sessionStatus: document.getElementById("ui2-session-status"),
    jobs: document.getElementById("ui2-jobs"),
    files: document.getElementById("ui2-files"),
    settings: document.getElementById("ui2-settings"),
    help: document.getElementById("ui2-help"),
    logoff: document.getElementById("ui2-logoff")
  };

  function init() {
    ensureWindowName();
    document.body.classList.toggle("ui2-dev-mode", devMode);
    setSidebarCollapsed(prefs.sidebarCollapsed === true);
    nodes.navToggle?.addEventListener("click", () => {
      setSidebarCollapsed(!document.body.classList.contains("ui2-sidebar-collapsed"), true);
    });
    nodes.jobs?.addEventListener("click", () => loadModule("sys_job_manager"));
    nodes.files?.addEventListener("click", () => loadModule("sys_file_manager"));
    nodes.settings?.addEventListener("click", () => loadModule("sys_user_config"));
    nodes.help?.addEventListener("click", toggleHelp);
    nodes.logoff?.addEventListener("click", handleLogonAction);

    renderMenu();
    refreshSessionState();
    if (nodes.candidates) {
      candidateModules.forEach((id) => {
        const option = document.createElement("option");
        option.value = id;
        nodes.candidates.appendChild(option);
      });
    }

    if (nodes.input) {
      nodes.input.value = params.get("module") || candidateModules[0];
    }

    nodes.load?.addEventListener("click", () => loadModule(nodes.input.value));
    nodes.refresh?.addEventListener("click", () => loadModule(state.moduleId || nodes.input?.value));
    nodes.input?.addEventListener("keydown", (event) => {
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

  function ensureWindowName() {
    if (window.name && window.name.length) {
      return;
    }
    window.name = createUuid();
  }

  async function refreshSessionState() {
    const endpoint = legacyEndpoint("statusBase", "ajax/sys_config/sys_status.php");
    try {
      const url = new URL(endpoint, window.location.href);
      url.searchParams.set("tags", "_logon");
      url.searchParams.set("tagmode", "any");
      url.searchParams.set("format", "json");
      url.searchParams.set("_window", window.name);
      url.searchParams.set("_groups", "1");
      const response = await fetch(url.toString(), {
        cache: "no-cache",
        credentials: "same-origin"
      });
      if (!response.ok) {
        throw new Error(`session status returned ${response.status}`);
      }
      const payload = await response.json();
      state.session.logon = stringValue(payload._logon);
      state.session.project = stringValue(payload._project);
      state.session.groups = payload._groups || {};
      state.session.usergroups = Array.isArray(payload._usergroups) ? payload._usergroups : [];
      state.session.theme = stringValue(payload._theme);
      state.session.loaded = true;
      renderSessionState();
      return payload;
    } catch (error) {
      state.session.loaded = false;
      renderSessionState(error);
      return {};
    }
  }

  function renderSessionState(error) {
    const project = state.session.project && state.session.project !== "no_project_specified"
      ? state.session.project
      : "";
    if (nodes.sessionStatus) {
      nodes.sessionStatus.textContent = project ? `Project ${project}` : "Project";
      nodes.sessionStatus.title = state.session.logon
        ? `Logged on as ${state.session.logon}`
        : (error ? `Session status unavailable: ${error.message}` : "Not logged on");
    }
    if (nodes.logoff) {
      nodes.logoff.textContent = state.session.logon ? `Logoff ${state.session.logon}` : "Login";
      nodes.logoff.dataset.mode = state.session.logon ? "logoff" : "login";
    }
  }

  async function handleLogonAction() {
    if (!state.session.logon) {
      openLoginDialog();
      return;
    }
    await logoffSession();
  }

  function openLoginDialog() {
    let overlay = document.getElementById("ui2-login-dialog");
    if (overlay) {
      overlay.hidden = false;
      overlay.querySelector("input[name='userid']")?.focus();
      return;
    }

    overlay = el("div", "ui2-dialog-overlay");
    overlay.id = "ui2-login-dialog";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "ui2-login-title");

    const panel = el("section", "ui2-dialog");
    const header = el("div", "ui2-dialog-header");
    const title = el("h2", null, "Login");
    title.id = "ui2-login-title";
    const close = el("button", "ui2-dialog-close", "Close");
    close.type = "button";
    close.addEventListener("click", () => {
      overlay.hidden = true;
    });
    header.append(title, close);

    const form = el("form", "ui2-login-form");
    form.appendChild(renderLoginInput("userid", "User id", "text", "Enter user id"));
    form.appendChild(renderLoginInput("password", "Password", "password", "Enter password"));

    const forgot = el("label", "ui2-switch ui2-login-forgot");
    const forgotInput = document.createElement("input");
    forgotInput.type = "checkbox";
    forgotInput.name = "forgotpassword";
    forgot.append(forgotInput, document.createTextNode("Forgot password"));
    form.appendChild(forgot);

    const actions = el("div", "ui2-dialog-actions");
    const submit = el("button", "ui2-button", "Login");
    submit.type = "submit";
    const cancel = el("button", "ui2-button ui2-button-quiet", "Cancel");
    cancel.type = "button";
    cancel.addEventListener("click", () => {
      overlay.hidden = true;
    });
    actions.append(submit, cancel);
    form.appendChild(actions);

    const status = el("div", "ui2-submit-status");
    status.id = "ui2-login-status";
    form.appendChild(status);
    form.addEventListener("submit", submitLogin);

    panel.append(header, form);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    form.elements.userid?.focus();
  }

  function renderLoginInput(name, labelText, type, placeholder) {
    const row = el("label", "ui2-login-row");
    row.appendChild(el("span", "ui2-field-label", labelText));
    const input = el("input", "ui2-input");
    input.name = name;
    input.type = type;
    input.placeholder = placeholder;
    input.required = true;
    if (name === "userid") {
      input.minLength = 3;
      input.maxLength = 30;
      input.pattern = "[A-Za-z][A-Za-z0-9_]+";
      input.autocomplete = "username";
    } else {
      input.minLength = 10;
      input.maxLength = 100;
      input.autocomplete = "current-password";
    }
    row.appendChild(input);
    return row;
  }

  async function submitLogin(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const status = document.getElementById("ui2-login-status");
    const submit = form.querySelector('button[type="submit"]');
    const endpoint = legacyEndpoint("loginBase", "ajax/sys_config/sys_login.php");
    const formData = new FormData(form);
    formData.set("_window", window.name);
    if (!formData.has("forgotpassword")) {
      formData.delete("forgotpassword");
    }
    submit.disabled = true;
    setSubmitStatus(status, "Logging in", "pending");
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        body: formData,
        credentials: "same-origin"
      });
      const payload = await parseJsonResponse(response, "Login");
      if (!response.ok || payload.error) {
        throw new Error(payload.error || `Login returned HTTP ${response.status}`);
      }
      state.session.logon = stringValue(payload._logon);
      state.session.project = stringValue(payload._project);
      state.session.usergroups = Array.isArray(payload._usergroups) ? payload._usergroups : [];
      state.session.loaded = true;
      renderSessionState();
      setSubmitStatus(status, payload.status || "Login successful", "ok");
      if (state.session.logon) {
        document.getElementById("ui2-login-dialog").hidden = true;
        await refreshSessionState();
      }
    } catch (error) {
      setSubmitStatus(status, error.message, "error");
    } finally {
      submit.disabled = false;
    }
  }

  async function logoffSession() {
    const endpoint = legacyEndpoint("logoffBase", "ajax/sys_config/sys_logoff.php");
    try {
      const formData = new FormData();
      formData.set("_window", window.name);
      formData.set("_logon", state.session.logon);
      const response = await fetch(endpoint, {
        method: "POST",
        body: formData,
        credentials: "same-origin"
      });
      const payload = await response.json();
      state.session.logon = stringValue(payload._logon);
      state.session.project = stringValue(payload._project);
      state.session.loaded = true;
      renderSessionState();
    } catch (error) {
      renderSessionState(error);
    }
  }

  async function loadModule(rawId) {
    const moduleId = sanitizeModuleId(rawId);
    if (!moduleId) {
      showError("Enter a module id.");
      return;
    }

    if (nodes.input) {
      nodes.input.value = moduleId;
    }
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
      state.menuId = menuIdForModule(moduleId);
      state.module = payload.modulejson || payload;
      state.view = payload.viewjson || {};
      state.values = {};
      renderModule();
      updateSelectedNavigation();
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
        if (nodes.input) {
          nodes.input.value = moduleId;
        }
        state.moduleId = moduleId;
        state.menuId = menuIdForModule(moduleId);
        state.module = payload.modulejson || payload;
        state.view = payload.viewjson || {};
        state.values = {};
        renderModule();
        updateSelectedNavigation();
        return;
      } catch (error) {
        // Keep looking; this startup path is intentionally forgiving.
      }
    }
    showError("No candidate modules could be loaded.");
  }

  function loadPreferences() {
    try {
      return JSON.parse(window.localStorage.getItem("genapp-ui2-preferences") || "{}");
    } catch (error) {
      return {};
    }
  }

  function stringValue(value) {
    return value == null ? "" : String(value);
  }

  function savePreference(key, value) {
    prefs[key] = value;
    try {
      window.localStorage.setItem("genapp-ui2-preferences", JSON.stringify(prefs));
    } catch (error) {
      // Local storage can be unavailable; preferences are convenience only.
    }
  }

  function setSidebarCollapsed(collapsed, persist) {
    document.body.classList.toggle("ui2-sidebar-collapsed", collapsed);
    if (nodes.navToggle) {
      nodes.navToggle.textContent = collapsed ? "Menu" : "Hide Menu";
      nodes.navToggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
    }
    if (persist) {
      savePreference("sidebarCollapsed", collapsed);
    }
  }

  function renderModule() {
    const module = state.module || {};
    const fields = visibleFields(Array.isArray(module.fields) ? module.fields : []);
    const inputFields = fields.filter((field) => field.role !== "output");
    const outputFields = fields.filter((field) => field.role === "output");

    nodes.empty.hidden = true;
    nodes.root.hidden = false;
    nodes.root.innerHTML = "";

    const container = el("div", "ui2-module");
    const systemTool = renderSystemTool(module, fields);
    if (systemTool) {
      container.appendChild(renderToolHeader(module));
      container.appendChild(systemTool);
      nodes.root.appendChild(container);
      syncValues();
      return;
    }

    container.appendChild(renderHeader(module, fields));
    container.appendChild(renderTabs(inputFields.length, outputFields.length));

    const form = el("form");
    form.id = "ui2-form";
    form.appendChild(renderSection("Inputs", inputFields, "input"));
    if (module.executable) {
      form.appendChild(renderActionBar());
    }
    form.appendChild(renderSection("Outputs", outputFields, "output"));
    if (devMode) {
      form.appendChild(renderPreview());
    }
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      await submitModule(form);
    });
    form.addEventListener("reset", () => {
      window.setTimeout(syncValues, 0);
    });
    form.addEventListener("input", syncValues);
    form.addEventListener("change", syncValues);

    container.appendChild(form);
    nodes.root.appendChild(container);
    syncValues();
  }

  function renderMenu() {
    if (!nodes.menuNav) {
      return;
    }
    nodes.menuNav.innerHTML = "";
    if (!Array.isArray(appMap.menus) || !appMap.menus.length) {
      nodes.menuNav.appendChild(el("p", "ui2-help", "No menu map was generated."));
      return;
    }

    appMap.menus.forEach((menu, index) => {
      const modules = (menu.modules || []).filter((module) => {
        return !isUtilityModule(module.id);
      });
      if (!modules.length) {
        return;
      }
      const group = el("section", "ui2-menu-group");
      group.dataset.menuId = menu.id || "";

      const button = el("button", "ui2-menu-button");
      button.type = "button";
      button.setAttribute("aria-expanded", index === 0 ? "true" : "false");
      button.appendChild(menuTitle(menu));

      const list = el("div", "ui2-module-list");
      list.hidden = index !== 0;
      modules.forEach((module) => {
        const item = el("button", "ui2-module-button", displayLabel(module.label || module.id));
        item.type = "button";
        item.dataset.moduleId = module.id || "";
        item.addEventListener("click", () => loadModule(module.id));
        list.appendChild(item);
      });

      button.addEventListener("click", () => {
        const expanded = button.getAttribute("aria-expanded") === "true";
        button.setAttribute("aria-expanded", expanded ? "false" : "true");
        list.hidden = expanded;
      });

      group.append(button, list);
      nodes.menuNav.appendChild(group);
    });

  }

  function menuTitle(menu) {
    const wrap = el("span", "ui2-menu-title");
    if (menu.icon) {
      const img = document.createElement("img");
      img.className = "ui2-menu-icon";
      img.alt = "";
      img.src = menu.icon;
      wrap.appendChild(img);
    }
    wrap.appendChild(document.createTextNode(displayLabel(menu.label || menu.id || "Menu")));
    return wrap;
  }

  function updateSelectedNavigation() {
    if (!nodes.menuNav) {
      return;
    }
    nodes.menuNav.querySelectorAll(".ui2-module-button").forEach((button) => {
      const selected = button.dataset.moduleId === state.moduleId;
      if (selected) {
        button.setAttribute("aria-current", "page");
        const group = button.closest(".ui2-menu-group");
        const groupButton = group?.querySelector(".ui2-menu-button");
        const list = group?.querySelector(".ui2-module-list");
        groupButton?.setAttribute("aria-expanded", "true");
        if (list) {
          list.hidden = false;
        }
      } else {
        button.removeAttribute("aria-current");
      }
    });
  }

  function renderHeader(module, fields) {
    const header = el("header", "ui2-module-header");
    const titleWrap = el("div");
    const title = el("h2", "ui2-module-title", displayLabel(module.label || module.moduleid || state.moduleId));

    titleWrap.appendChild(title);
    if (devMode) {
      const meta = el("div", "ui2-meta");
      meta.appendChild(el("span", "ui2-pill", module.moduleid || state.moduleId || "module"));
      meta.appendChild(el("span", "ui2-pill", `${fields.length} fields`));
      meta.appendChild(el("span", "ui2-pill", `${fields.filter((field) => field.role === "output").length} outputs`));
      if (module.executable) {
        meta.appendChild(el("span", "ui2-pill", `exec: ${module.executable}`));
      }
      if (Object.keys(state.view || {}).length) {
        meta.appendChild(el("span", "ui2-pill", "view metadata"));
      }
      titleWrap.appendChild(meta);
    }

    header.appendChild(titleWrap);
    return header;
  }

  function renderToolHeader(module) {
    const header = el("header", "ui2-module-header ui2-tool-header");
    const titleWrap = el("div");
    titleWrap.appendChild(el("h2", "ui2-module-title", displayLabel(utilityLabel({ id: module.moduleid || state.moduleId, label: module.label }))));
    if (devMode) {
      const meta = el("div", "ui2-meta");
      meta.appendChild(el("span", "ui2-pill", module.moduleid || state.moduleId || "system"));
      meta.appendChild(el("span", "ui2-pill", "utility"));
      titleWrap.appendChild(meta);
    }
    header.appendChild(titleWrap);
    return header;
  }

  function displayLabel(value) {
    const text = String(value || "").trim();
    if (!text) {
      return "";
    }
    return text
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function toggleHelp() {
    const enabled = nodes.help?.getAttribute("aria-pressed") !== "true";
    document.body.classList.toggle("ui2-help-enabled", enabled);
    if (nodes.help) {
      nodes.help.setAttribute("aria-pressed", enabled ? "true" : "false");
      nodes.help.textContent = enabled ? "Help on" : "Help off";
    }
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
    const renderPlan = planFields(fields);

    if (!fields.length) {
      body.appendChild(el("p", "ui2-help", `No ${title.toLowerCase()} declared.`));
    } else {
      renderPlan.forEach((item) => {
        body.appendChild(item.kind === "table" ? renderTableizedRepeater(item, role) : renderField(item.field, role));
      });
    }

    section.append(header, body);
    return section;
  }

  function renderField(field, role) {
    if (isHiddenField(field)) {
      return renderHiddenField(field);
    }
    if (isLayoutLabel(field)) {
      return renderLayoutLabel(field);
    }

    const row = el("div", "ui2-field");
    row.dataset.fieldId = field.id || "";
    if (field.repeat) {
      row.dataset.repeat = field.repeat;
    }

    const label = el("label", "ui2-field-label");
    label.textContent = field.label || field.id || field.type || "field";
    if (devMode && field.id) {
      label.setAttribute("for", fieldId(field));
      label.appendChild(el("small", null, `${field.id} · ${field.type || "text"}`));
    }

    const stack = el("div", "ui2-control-stack");
    stack.appendChild(role === "output" ? renderOutput(field) : renderControl(field));
    if (devMode && field.repeat) {
      stack.appendChild(el("p", "ui2-help", `Visible when ${field.repeat}`));
      stack.appendChild(el("p", "ui2-help ui2-repeat-debug"));
    }
    if (devMode && isRepeater(field)) {
      stack.appendChild(el("p", "ui2-help", "Repeater source"));
    }

    row.append(label, stack);
    return row;
  }

  function renderHiddenField(field) {
    const row = el("div", "ui2-field ui2-hidden-field");
    row.dataset.fieldId = field.id || "";
    if (field.repeat) {
      row.dataset.repeat = field.repeat;
    }
    const input = document.createElement("input");
    input.type = "hidden";
    input.value = field.default == null ? "" : field.default;
    wireControl(input, field);
    row.appendChild(input);
    return row;
  }

  function renderTableizedRepeater(item, role) {
    const controller = item.controller;
    const row = isHiddenField(controller) ? renderHiddenTableRepeater(controller, item.fields || []) : renderField(controller, role);
    row.classList.add("ui2-tableized-repeater");

    const stack = row.querySelector(".ui2-control-stack");
    const fields = item.fields || [];
    if (!stack || !fields.length || role === "output") {
      return row;
    }
    row._ui2RepeatTableController = controller;
    row._ui2RepeatTableFields = fields;

    if (isIntegerPairMatrix(controller, fields)) {
      const matrix = renderRepeatMatrix(controller, fields[0]);
      stack.appendChild(matrix);
      return row;
    }

    if (row._ui2RepeatListField) {
      const list = el("div", "ui2-repeat-list");
      list.appendChild(renderRepeatListBody(controller, row._ui2RepeatListField));
      stack.appendChild(list);
      return row;
    }

    const tableWrap = el("div", "ui2-repeat-table-wrap");
    const table = el("table", "ui2-repeat-table");
    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    fields.forEach((field) => {
      headRow.appendChild(el("th", null, field.label || field.id || field.type || "field"));
    });
    thead.appendChild(headRow);
    table.appendChild(thead);
    table.appendChild(renderRepeatTableBody(controller, fields));
    tableWrap.appendChild(table);

    if (devMode) {
      tableWrap.appendChild(el("p", "ui2-help", `Tableized repeat: ${fields.map((field) => field.id).join(", ")}`));
    }

    stack.appendChild(tableWrap);
    return row;
  }

  function renderHiddenTableRepeater(controller, fields) {
    if (fields.length === 1 && !isIntegerPairMatrix(controller, fields)) {
      return renderHiddenRepeatList(controller, fields[0]);
    }

    const row = el("div", "ui2-field ui2-field-wide");
    row.dataset.fieldId = controller.id || "";
    if (controller.repeat) {
      row.dataset.repeat = controller.repeat;
    }
    const input = document.createElement("input");
    input.type = "hidden";
    input.value = controller.default == null ? "" : controller.default;
    wireControl(input, controller);
    row.appendChild(input);

    const label = el("label", "ui2-field-label", isIntegerPairMatrix(controller, fields) ? "" : repeatedGroupLabel(controller, fields));
    const stack = el("div", "ui2-control-stack");
    row.append(label, stack);
    return row;
  }

  function renderHiddenRepeatList(controller, field) {
    const row = el("div", "ui2-field ui2-field-wide ui2-hidden-repeat-controller");
    row.dataset.fieldId = controller.id || "";
    if (controller.repeat) {
      row.dataset.repeat = controller.repeat;
    }
    const input = document.createElement("input");
    input.type = "hidden";
    input.value = controller.default == null ? "" : controller.default;
    wireControl(input, controller);
    row.appendChild(input);
    row._ui2RepeatListField = field;
    row.appendChild(el("div", "ui2-control-stack"));
    return row;
  }

  function renderRepeatTableBody(controller, fields) {
    const tbody = document.createElement("tbody");
    const rows = repeatCount(controller, controller.default);
    for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
      tbody.appendChild(renderRepeatTableRow(fields, rowIndex));
    }
    return tbody;
  }

  function renderRepeatTableRow(fields, rowIndex) {
    const tr = document.createElement("tr");
    fields.forEach((field) => {
      const td = document.createElement("td");
      td.appendChild(renderRepeatTableControl(field, rowIndex));
      tr.appendChild(td);
    });
    return tr;
  }

  function renderRepeatListBody(controller, field) {
    const body = el("div", "ui2-repeat-list-body");
    const rows = repeatCount(controller, controller.default);
    for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
      body.appendChild(renderRepeatListRow(field, rowIndex));
    }
    return body;
  }

  function renderRepeatListRow(field, rowIndex) {
    const row = el("div", "ui2-repeat-list-row");
    const label = el("label", "ui2-field-label", `${field.label || field.id || field.type || "field"} [${rowIndex + 1}]`);
    row.appendChild(label);
    const stack = el("div", "ui2-control-stack");
    stack.appendChild(renderRepeatTableControl(field, rowIndex));
    row.appendChild(stack);
    return row;
  }

  function renderRepeatMatrix(controller, field) {
    const wrap = el("div", "ui2-matrix-wrap");
    wrap._ui2RepeatMatrixController = controller;
    wrap._ui2RepeatMatrixField = field;
    const table = el("table", "ui2-matrix-table");
    wrap.appendChild(table);
    renderRepeatMatrixTable(table, controller, field, {}, dimensionsFromController(controller, {}));
    return wrap;
  }

  function renderRepeatMatrixTable(table, controller, field, rawValues, dimensions) {
    table.innerHTML = "";
    const [rowCount, columnCount] = dimensions;
    const headerRow = document.createElement("tr");
    headerRow.appendChild(el("th", "ui2-matrix-corner", matrixCornerLabel(controller)));
    for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
      headerRow.appendChild(el("th", null, matrixHeaderValue(controller, "column", columnIndex, rawValues)));
    }
    table.appendChild(headerRow);

    for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
      const tr = document.createElement("tr");
      tr.appendChild(el("th", "ui2-matrix-row-header", matrixHeaderValue(controller, "row", rowIndex, rawValues)));
      for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
        const td = document.createElement("td");
        td.appendChild(renderMatrixControl(field, rowIndex, columnIndex, rawValues));
        tr.appendChild(td);
      }
      table.appendChild(tr);
    }
  }

  function renderMatrixControl(field, rowIndex, columnIndex, rawValues) {
    const type = String(field.type || "text").toLowerCase();
    const input = el("input", "ui2-input ui2-repeat-table-input ui2-matrix-input");
    input.type = inputType(type);
    input.dataset.fieldId = field.id || "";
    input.dataset.repeatTableField = field.id || "";
    input.dataset.matrixRow = String(rowIndex);
    input.dataset.matrixColumn = String(columnIndex);
    input.value = matrixCurrentValue(rawValues[field.id], field.default, rowIndex, columnIndex);
    if (field.required === "true" || field.required === true) {
      input.required = true;
    }
    if (field.sync) {
      input.dataset.sync = field.sync;
    }
    return input;
  }

  function renderRepeatTableControl(field, rowIndex) {
    const type = String(field.type || "text").toLowerCase();
    if (type === "listbox" || type === "select") {
      const select = el("select", "ui2-select ui2-repeat-table-input");
      parseValues(field.values).forEach((choice) => {
        const option = document.createElement("option");
        option.value = choice.value;
        option.textContent = choice.label;
        select.appendChild(option);
      });
      wireRepeatTableControl(select, field, rowIndex);
      select.value = arrayDefaultValue(field.default, rowIndex) || select.value;
      return select;
    }

    if (type === "checkbox") {
      const wrap = el("label", "ui2-repeat-table-checkbox");
      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = checkboxDefault(field, rowIndex);
      wireRepeatTableControl(input, field, rowIndex);
      wrap.appendChild(input);
      return wrap;
    }

    if (isFileLikeType(type)) {
      return renderFileControl(field, {
        compact: true,
        idSuffix: `-${rowIndex}`,
        repeatTableIndex: rowIndex
      });
    }

    const input = el("input", "ui2-input ui2-repeat-table-input");
    input.type = inputType(type);
    wireRepeatTableControl(input, field, rowIndex);
    input.value = arrayDefaultValue(field.default, rowIndex);
    return input;
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
    if (isFileLikeType(type)) {
      return renderFileControl(field);
    }

    const input = el("input", "ui2-input");
    input.type = inputType(type);
    if (type === "float") {
      input.step = "any";
    } else if (type === "integer") {
      input.step = "1";
    }
    wireControl(input, field);
    input.value = field.default == null ? "" : field.default;
    return input;
  }

  function renderFileControl(field, options) {
    const type = String(field.type || "").toLowerCase();
    const compact = options?.compact === true;
    const wrap = el("div", compact ? "ui2-file-control ui2-file-control-compact" : "ui2-file-control");
    const input = el("input", compact ? "ui2-input ui2-repeat-table-input" : "ui2-input");
    input.type = "text";
    input.placeholder = type === "rpath" ? "Server path" : "No file selected";
    if (options?.idSuffix) {
      input.id = `${fieldId(field)}${options.idSuffix}`;
    } else {
      wireControl(input, field);
    }
    if (options?.repeatTableIndex != null) {
      input.dataset.fieldId = field.id || "";
      input.dataset.repeatTableField = field.id || "";
      input.dataset.repeatTableIndex = String(options.repeatTableIndex);
      if (field.required === "true" || field.required === true) {
        input.required = true;
      }
    }
    if (field.sync) {
      input.dataset.sync = field.sync;
    }
    input.value = arrayDefaultValue(field.default, options?.repeatTableIndex || 0);

    const localPicker = document.createElement("input");
    localPicker.type = "file";
    localPicker.className = "ui2-native-file";
    localPicker.tabIndex = -1;
    localPicker.dataset.fieldId = field.id || "";
    if (options?.repeatTableIndex != null) {
      localPicker.dataset.repeatTableIndex = String(options.repeatTableIndex);
    }
    localPicker.addEventListener("change", () => {
      input.value = localPicker.files && localPicker.files[0] ? localPicker.files[0].name : "";
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });

    const actions = el("div", "ui2-file-actions");
    if (fileModes(type).includes("local")) {
      const local = el("button", "ui2-button ui2-button-quiet", compact ? "Local" : "Browse local files");
      local.type = "button";
      local.addEventListener("click", () => localPicker.click());
      actions.appendChild(local);
    }
    if (fileModes(type).includes("server")) {
      const server = el("button", "ui2-button ui2-button-quiet", compact ? "Server" : "Browse server");
      server.type = "button";
      server.title = "Server file picker wiring will attach here.";
      actions.appendChild(server);
    }

    wrap.append(input, localPicker, actions);
    return wrap;
  }

  function renderActionBar() {
    const actions = el("div", "ui2-form-actions");
    const submit = el("button", "ui2-button ui2-button-primary", "Submit");
    submit.type = "submit";
    const reset = el("button", "ui2-button ui2-button-quiet", "Reset");
    reset.type = "reset";
    const status = el("div", "ui2-submit-status", "Not submitted");
    status.id = "ui2-submit-status";
    status.setAttribute("role", "status");
    actions.append(submit, reset, status);
    return actions;
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

  function renderSystemTool(module, fields) {
    const moduleId = module.moduleid || state.moduleId;
    if (moduleId === "sys_job_manager" || moduleId === "sys_job2_manager") {
      return renderJobManagerTool(fields);
    }
    if (moduleId === "sys_file_manager") {
      return renderFileManagerTool(fields);
    }
    if (moduleId === "sys_user_config") {
      return renderSimpleSystemTool("Settings", fields);
    }
    if (moduleId === "sys_logoff") {
      return renderSimpleSystemTool("Logoff", fields);
    }
    return null;
  }

  function isUtilityModule(moduleId) {
    return [
      "sys_job_manager",
      "sys_job2_manager",
      "sys_file_manager",
      "sys_user_config",
      "sys_feedback",
      "sys_feedback2",
      "sys_logoff"
    ].includes(moduleId);
  }

  function utilityLabel(module) {
    const id = module.id || "";
    if (id === "sys_file_manager") {
      return "File Manager";
    }
    if (id === "sys_job_manager" || id === "sys_job2_manager") {
      return "Job Manager";
    }
    if (id === "sys_user_config") {
      return "Settings";
    }
    if (id === "sys_feedback" || id === "sys_feedback2") {
      return "Feedback";
    }
    if (id === "sys_logoff") {
      return "Logoff";
    }
    return module.label || id || "Utility";
  }

  function renderJobManagerTool(fields) {
    const section = el("section", "ui2-section ui2-system-tool ui2-job-manager");
    const body = el("div", "ui2-section-body ui2-tool-body");
    const filters = el("div", "ui2-tool-filters");
    [
      ["serverdate", "Server date", "loads from server"],
      ["running", "Running", "Show running jobs"],
      ["completed", "Completed in the last", "*all*"],
      ["project", "Project", "*all*"],
      ["module", "Module", "*all*"]
    ].forEach(([id, label, value]) => {
      filters.appendChild(renderToolFilter(id, label, value, id === "running"));
    });
    body.appendChild(filters);

    const legend = el("div", "ui2-tool-legend");
    legend.appendChild(el("h3", null, "Actions Legend"));
    legend.appendChild(el("p", null, "Attach, attach in a new window, delete, cancel, and clear lock actions appear beside jobs."));
    body.appendChild(legend);

    const tableWrap = el("div", "ui2-data-table-wrap");
    const table = el("table", "ui2-data-table");
    const thead = document.createElement("thead");
    const head = document.createElement("tr");
    ["Actions", "Module", "Project", "Details", "Start", "End", "Duration"].forEach((label) => head.appendChild(el("th", null, label)));
    thead.appendChild(head);
    const tbody = document.createElement("tbody");
    const placeholder = document.createElement("tr");
    const cell = el("td", "ui2-table-empty", "Job rows will load from the Job Manager runtime service.");
    cell.colSpan = 7;
    placeholder.appendChild(cell);
    tbody.appendChild(placeholder);
    table.append(thead, tbody);
    tableWrap.appendChild(table);
    body.appendChild(tableWrap);

    const messages = fields.find((field) => field.id === "messages");
    if (messages) {
      body.appendChild(renderToolOutput("Messages", messages));
    }

    section.appendChild(body);
    return section;
  }

  function renderFileManagerTool(fields) {
    const section = el("section", "ui2-section ui2-system-tool ui2-file-manager");
    const body = el("div", "ui2-section-body ui2-tool-body");
    body.appendChild(renderToolFilter("serverdate", "Server date", "loads from server", false));

    const tree = el("div", "ui2-file-tree");
    tree.appendChild(el("h3", null, "User file tree"));
    const tableWrap = el("div", "ui2-data-table-wrap");
    const table = el("table", "ui2-data-table ui2-file-table");
    const thead = document.createElement("thead");
    const head = document.createElement("tr");
    ["", "Name", "Type", "Size", "Modified"].forEach((label) => head.appendChild(el("th", null, label)));
    thead.appendChild(head);
    const tbody = document.createElement("tbody");
    [
      ["folder", "Project folders", "", "loads from server"],
      ["file", "Input files", "size", "modified time"],
      ["folder", "Result archives", "", "loads from server"]
    ].forEach(([type, name, size, modified]) => {
      const row = document.createElement("tr");
      const selected = document.createElement("td");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.disabled = true;
      selected.appendChild(checkbox);
      row.appendChild(selected);
      row.appendChild(el("td", null, name));
      row.appendChild(el("td", null, type));
      row.appendChild(el("td", null, size));
      row.appendChild(el("td", null, modified));
      tbody.appendChild(row);
    });
    table.append(thead, tbody);
    tableWrap.appendChild(table);
    tree.appendChild(tableWrap);
    body.appendChild(tree);

    const compression = fields.find((field) => field.id === "compression");
    if (compression) {
      body.appendChild(renderField(compression, "input"));
    }

    const actions = el("div", "ui2-tool-actions");
    actions.appendChild(el("button", "ui2-button", "Download"));
    actions.querySelector("button").type = "button";
    body.appendChild(actions);

    ["status", "outfiles"].forEach((id) => {
      const field = fields.find((item) => item.id === id);
      if (field) {
        body.appendChild(renderToolOutput(field.label || id, field));
      }
    });

    section.appendChild(body);
    return section;
  }

  function renderSimpleSystemTool(title, fields) {
    const section = el("section", "ui2-section ui2-system-tool");
    const body = el("div", "ui2-section-body ui2-tool-body");
    const note = el("div", "ui2-tool-legend");
    note.appendChild(el("h3", null, title));
    note.appendChild(el("p", null, "This utility needs its dedicated ui2 runtime wiring; the generic module form is intentionally bypassed."));
    body.appendChild(note);
    fields.filter((field) => !isLayoutLabel(field)).forEach((field) => {
      body.appendChild(renderField(field, field.role === "output" ? "output" : "input"));
    });
    section.appendChild(body);
    return section;
  }

  function renderToolFilter(id, label, value, toggle) {
    const row = el("div", "ui2-tool-filter");
    row.dataset.fieldId = id;
    row.appendChild(el("label", "ui2-field-label", label));
    const stack = el("div", "ui2-control-stack");
    if (toggle) {
      const switchLabel = el("label", "ui2-switch");
      const input = document.createElement("input");
      input.type = "checkbox";
      input.dataset.fieldId = id;
      switchLabel.append(input, document.createTextNode(value));
      stack.appendChild(switchLabel);
    } else {
      const input = el("input", "ui2-input");
      input.type = "text";
      input.value = value;
      input.dataset.fieldId = id;
      stack.appendChild(input);
    }
    row.appendChild(stack);
    return row;
  }

  function renderToolOutput(label, field) {
    const row = el("div", "ui2-field");
    row.dataset.fieldId = field.id || "";
    row.appendChild(el("label", "ui2-field-label", label || field.id || "Output"));
    const stack = el("div", "ui2-control-stack");
    stack.appendChild(renderOutput(field));
    row.appendChild(stack);
    return row;
  }

  function syncValues() {
    const form = document.getElementById("ui2-form");
    if (!form) {
      return;
    }
    const initialValues = collectControlValues(form, () => true);
    syncLinkedControls(form, initialValues);
    const rawValues = collectControlValues(form, () => true);
    const activeRows = evaluateRepeatVisibility(form, rawValues);
    updateRepeats(form, activeRows, rawValues);
    updateRepeatTables(form, rawValues);
    state.values = collectControlValues(form, (control) => {
      const row = control.closest(".ui2-field");
      return !row || activeRows.get(row) !== false;
    });
    const preview = document.getElementById("ui2-preview");
    if (preview) {
      preview.textContent = JSON.stringify(state.values, null, 2);
    }
  }

  async function submitModule(form) {
    syncValues();
    const endpoint = moduleSubmitEndpoint();
    const status = document.getElementById("ui2-submit-status");
    if (!endpoint) {
      setSubmitStatus(status, "This module does not have a runtime endpoint yet.", "error");
      return;
    }

    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    setSubmitStatus(status, `Submitting to ${endpoint}`, "pending");

    try {
      await refreshSessionState();
      if (!state.session.logon) {
        throw new Error("You must be logged on to submit");
      }
      const response = await fetch(endpoint, {
        method: "POST",
        body: buildSubmitFormData(form),
        credentials: "same-origin"
      });
      const payload = await parseJsonResponse(response, "Runtime");
      state.submitResponse = payload;
      if (!response.ok || payload.error || payload._status === "failed") {
        throw new Error(payload.error || `Runtime returned HTTP ${response.status}`);
      }
      const uuid = payload._uuid || state.values._uuid || "";
      setSubmitStatus(status, `Started${uuid ? ` (${uuid})` : ""}`, "ok");
      renderSubmitResponse(payload);
    } catch (error) {
      setSubmitStatus(status, error.message, "error");
      renderSubmitResponse({ error: error.message });
    } finally {
      submitButton.disabled = false;
    }
  }

  function moduleSubmitEndpoint() {
    if (!state.menuId || !state.moduleId || !state.module?.executable) {
      return "";
    }
    const base = params.get("submitBase") || legacyEndpoint("", "ajax");
    return `${base.replace(/\/+$/, "")}/${encodeURIComponent(state.menuId)}/${encodeURIComponent(state.moduleId)}.php`;
  }

  function legacyEndpoint(paramName, path) {
    if (paramName && params.get(paramName)) {
      return params.get(paramName);
    }
    const cleanPath = String(path || "").replace(/^\/+/, "");
    const appId = sanitizeModuleId(document.querySelector(".ui2-shell")?.dataset.appId || "");
    const pathname = window.location.pathname;
    const marker = "/ui2/";
    const markerIndex = pathname.indexOf(marker);
    if (markerIndex > 0) {
      return `${pathname.slice(0, markerIndex + 1)}${cleanPath}`;
    }
    if (appId) {
      return `/${appId}/${cleanPath}`;
    }
    return `../${cleanPath}`;
  }

  async function parseJsonResponse(response, label) {
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch (error) {
      const snippet = text.replace(/\s+/g, " ").slice(0, 180);
      throw new Error(`${label} returned non-JSON response (${response.status}) from ${response.url}: ${snippet}`);
    }
  }

  function buildSubmitFormData(form) {
    const formData = new FormData();
    Object.entries(state.values || {}).forEach(([id, value]) => appendFormValue(formData, id, value));
    appendSelectedFiles(formData, form);
    formData.set("_uuid", createUuid());
    formData.set("_window", window.name);
    formData.set("_project", state.session.project || "");
    formData.set("_logon", state.session.logon || "");
    formData.set("_height", String(Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0)));
    formData.set("_width", String(Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0)));
    return formData;
  }

  function appendSelectedFiles(formData, form) {
    if (!form) {
      return;
    }
    form.querySelectorAll(".ui2-native-file[data-field-id]").forEach((picker) => {
      const id = picker.dataset.fieldId;
      if (!id || !picker.files || !picker.files.length) {
        return;
      }
      if (picker.dataset.repeatTableIndex != null) {
        Array.from(picker.files).forEach((file) => formData.append(`${id}[]`, file));
        return;
      }
      formData.delete(id);
      Array.from(picker.files).forEach((file) => formData.append(id, file));
    });
  }

  function appendFormValue(formData, id, value) {
    if (Array.isArray(value)) {
      value.forEach((item) => appendFormValue(formData, `${id}[]`, item));
      return;
    }
    formData.append(id, value == null ? "" : value);
  }

  function createUuid() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return `ui2-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function setSubmitStatus(node, message, kind) {
    if (!node) {
      return;
    }
    node.textContent = message;
    node.dataset.status = kind || "";
  }

  function renderSubmitResponse(payload) {
    const existing = document.getElementById("ui2-submit-response");
    const target = existing || el("pre", "ui2-output ui2-submit-response");
    target.id = "ui2-submit-response";
    target.textContent = JSON.stringify(payload, null, 2);
    if (!existing) {
      document.getElementById("ui2-form")?.appendChild(target);
    }
  }

  function collectControlValues(scope, includeControl) {
    const values = {};
    scope.querySelectorAll("[data-field-id]").forEach((control) => {
      const id = control.dataset.fieldId;
      if (!id || control.type === "radio" && !control.checked || !includeControl(control)) {
        return;
      }
      if (control.dataset.repeatTableField) {
        if (!Array.isArray(values[id])) {
          values[id] = [];
        }
        if (control.dataset.matrixRow != null && control.dataset.matrixColumn != null) {
          const rowIndex = Number(control.dataset.matrixRow || 0);
          const columnIndex = Number(control.dataset.matrixColumn || 0);
          if (!Array.isArray(values[id][rowIndex])) {
            values[id][rowIndex] = [];
          }
          values[id][rowIndex][columnIndex] = control.type === "checkbox" ? control.checked : control.value;
          return;
        }
        values[id][Number(control.dataset.repeatTableIndex || 0)] = control.type === "checkbox" ? control.checked : control.value;
        return;
      }
      values[id] = control.type === "checkbox" ? control.checked : control.value;
    });
    return values;
  }

  function syncLinkedControls(scope, rawValues) {
    const groups = new Map();
    scope.querySelectorAll("[data-sync]").forEach((control) => {
      const group = control.dataset.sync;
      if (!group) {
        return;
      }
      if (!groups.has(group)) {
        groups.set(group, []);
      }
      groups.get(group).push(control);
    });

    groups.forEach((controls) => {
      const source = controls.find((control) => {
        return control.type !== "hidden" && !control.disabled && rawValues[control.dataset.fieldId] != null;
      }) || controls.find((control) => rawValues[control.dataset.fieldId] != null);
      if (!source) {
        return;
      }
      const value = source.type === "checkbox" ? source.checked : source.value;
      controls.forEach((control) => {
        if (control === source || control.type === "radio") {
          return;
        }
        if (control.type === "checkbox") {
          control.checked = Boolean(value);
        } else {
          control.value = value;
        }
      });
    });
  }

  function evaluateRepeatVisibility(scope, rawValues) {
    const rows = Array.from(scope.querySelectorAll(".ui2-field"));
    const rowsByFieldId = new Map();
    rows.forEach((row) => {
      if (row.dataset.fieldId && !rowsByFieldId.has(row.dataset.fieldId)) {
        rowsByFieldId.set(row.dataset.fieldId, row);
      }
    });

    const activeRows = new Map(rows.map((row) => [row, !row.dataset.repeat]));
    for (let pass = 0; pass < rows.length + 1; pass += 1) {
      let changed = false;
      rows.forEach((row) => {
        const active = row.dataset.repeat
          ? repeatIsActive(row.dataset.repeat, rawValues, activeRows, rowsByFieldId)
          : true;
        if (activeRows.get(row) !== active) {
          activeRows.set(row, active);
          changed = true;
        }
      });
      if (!changed) {
        break;
      }
    }
    return activeRows;
  }

  function updateRepeats(scope, activeRows, rawValues) {
    scope.querySelectorAll(".ui2-field").forEach((row) => {
      const active = activeRows.get(row) !== false;
      row.classList.toggle("ui2-hidden", !active);
      row.querySelectorAll("[data-field-id]").forEach((control) => {
        control.disabled = !active;
      });
      updateRepeatDebug(row, active, rawValues, activeRows);
    });
  }

  function updateRepeatTables(scope, rawValues) {
    scope.querySelectorAll(".ui2-tableized-repeater").forEach((row) => {
      const controller = row._ui2RepeatTableController;
      const fields = row._ui2RepeatTableFields || [];
      const listField = row._ui2RepeatListField;
      const matrix = row.querySelector(".ui2-matrix-wrap");
      const tbody = row.querySelector(".ui2-repeat-table tbody");
      const listBody = row.querySelector(".ui2-repeat-list-body");
      if (!controller || !fields.length) {
        return;
      }
      if (matrix && matrix._ui2RepeatMatrixField) {
        const table = matrix.querySelector(".ui2-matrix-table");
        if (table) {
          renderRepeatMatrixTable(table, controller, matrix._ui2RepeatMatrixField, rawValues, dimensionsFromController(controller, rawValues));
        }
        return;
      }
      const wanted = repeatCount(controller, rawValues[controller.id]);
      if (listField && listBody) {
        while (listBody.children.length < wanted) {
          listBody.appendChild(renderRepeatListRow(listField, listBody.children.length));
        }
        while (listBody.children.length > wanted) {
          listBody.removeChild(listBody.lastElementChild);
        }
        return;
      }
      if (!tbody) {
        return;
      }
      while (tbody.rows.length < wanted) {
        tbody.appendChild(renderRepeatTableRow(fields, tbody.rows.length));
      }
      while (tbody.rows.length > wanted) {
        tbody.deleteRow(tbody.rows.length - 1);
      }
    });
  }

  function repeatIsActive(expression, rawValues, activeRows, rowsByFieldId) {
    if (!expression) {
      return true;
    }
    const [rawId, rawValue] = expression.split(":");
    const id = rawId.trim();
    const expected = rawValue == null ? true : rawValue.trim();
    const controllerRow = rowsByFieldId.get(id);
    const controllerActive = !controllerRow || activeRows.get(controllerRow) !== false;
    const actual = controllerActive ? rawValues[id] : undefined;
    if (rawValue == null) {
      return Boolean(actual) && actual !== "false";
    }
    return String(actual) === expected;
  }

  function updateRepeatDebug(row, active, rawValues, activeRows) {
    if (!devMode || !row.dataset.repeat) {
      return;
    }
    const debug = row.querySelector(".ui2-repeat-debug");
    if (!debug) {
      return;
    }
    const [rawId, rawValue] = row.dataset.repeat.split(":");
    const id = rawId.trim();
    const controller = row.closest("form")?.querySelector(`.ui2-field[data-field-id="${cssEscape(id)}"]`);
    const controllerActive = !controller || activeRows.get(controller) !== false;
    const expected = rawValue == null ? "truthy" : rawValue.trim();
    const actual = controllerActive ? rawValues[id] : "(inactive)";
    debug.textContent = `Repeat ${active ? "active" : "hidden"}: ${id} is ${JSON.stringify(actual)}; expected ${expected}`;
  }

  function wireControl(control, field) {
    control.id = fieldId(field);
    control.dataset.fieldId = field.id || "";
    if (field.sync) {
      control.dataset.sync = field.sync;
    }
    if (field.required === "true" || field.required === true) {
      control.required = true;
    }
  }

  function wireRepeatTableControl(control, field, rowIndex) {
    control.id = `${fieldId(field)}-${rowIndex}`;
    control.dataset.fieldId = field.id || "";
    control.dataset.repeatTableField = field.id || "";
    control.dataset.repeatTableIndex = String(rowIndex);
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

  function cssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === "function") {
      return window.CSS.escape(value);
    }
    return String(value).replace(/["\\]/g, "\\$&");
  }

  function moduleCandidates() {
    const fromMap = [];
    if (Array.isArray(appMap.menus)) {
      appMap.menus.forEach((menu) => {
        (menu.modules || []).forEach((module) => {
          if (module.id && !fromMap.includes(module.id)) {
            fromMap.push(module.id);
          }
        });
      });
    }
    return fromMap.length ? fromMap : fallbackModules;
  }

  function menuIdForModule(moduleId) {
    if (!Array.isArray(appMap.menus)) {
      return "";
    }
    const menu = appMap.menus.find((entry) => (entry.modules || []).some((module) => module.id === moduleId));
    return menu ? menu.id : "";
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

  function planFields(fields) {
    const ordered = orderFieldsByRepeater(fields);
    const byId = new Map();
    ordered.forEach((field) => {
      if (field.id) {
        byId.set(field.id, field);
      }
    });

    const tableChildren = new Map();
    ordered.forEach((field) => {
      const parentId = repeatControllerId(field.repeat);
      if (!parentId || !byId.has(parentId)) {
        return;
      }
      if (!tableChildren.has(parentId)) {
        tableChildren.set(parentId, []);
      }
      tableChildren.get(parentId).push(field);
    });

    const consumed = new Set();
    const plan = [];
    ordered.forEach((field) => {
      if (consumed.has(field)) {
        return;
      }
      const fieldsForTable = tableChildren.get(field.id) || [];
      if (isTableizedRepeater(field, fieldsForTable)) {
        fieldsForTable.forEach((child) => consumed.add(child));
        plan.push({
          kind: "table",
          controller: field,
          fields: fieldsForTable
        });
        return;
      }
      plan.push({
        kind: "field",
        field
      });
    });
    return plan;
  }

  function orderFieldsByRepeater(fields) {
    const byId = new Map();
    const children = new Map();
    fields.forEach((field) => {
      if (field.id) {
        byId.set(field.id, field);
      }
    });
    fields.forEach((field) => {
      const parentId = repeatControllerId(field.repeat);
      if (!parentId || !byId.has(parentId) || parentId === field.id) {
        return;
      }
      if (!children.has(parentId)) {
        children.set(parentId, []);
      }
      children.get(parentId).push(field);
    });

    const output = [];
    const emitted = new Set();
    const emit = (field, stack) => {
      if (!field || emitted.has(field)) {
        return;
      }
      emitted.add(field);
      output.push(field);
      const nested = children.get(field.id) || [];
      nested.forEach((child) => {
        if (!stack.has(child)) {
          stack.add(child);
          emit(child, stack);
          stack.delete(child);
        }
      });
    };

    fields.forEach((field) => {
      const parentId = repeatControllerId(field.repeat);
      if (parentId && byId.has(parentId) && parentId !== field.id) {
        return;
      }
      emit(field, new Set([field]));
    });
    fields.forEach((field) => emit(field, new Set([field])));
    return output;
  }

  function repeatControllerId(expression) {
    if (!expression) {
      return "";
    }
    return String(expression).split(":")[0].trim();
  }

  function isRepeater(field) {
    return String(field.repeater || "").toLowerCase() === "true" || String(field.repeater || "").toLowerCase() === "yes";
  }

  function isHiddenField(field) {
    return String(field.hidden || "").toLowerCase() === "true";
  }

  function isTableizedRepeater(field, childFields) {
    const explicit = String(field.tableize || "").toLowerCase() === "true";
    if (isRepeater(field) && explicit && childFields.length) {
      return true;
    }
    const type = String(field.type || "").toLowerCase();
    return isRepeater(field)
      && (type === "integer" || type === "integerpair")
      && childFields.length > 0
      && childFields.every((child) => child.role !== "output" && !isRepeater(child));
  }

  function isIntegerPairMatrix(controller, fields) {
    return String(controller.type || "").toLowerCase() === "integerpair" && fields.length === 1;
  }

  function integerValue(value, fallback) {
    if (Array.isArray(value)) {
      return integerValue(value[0], fallback);
    }
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function repeatCount(controller, value) {
    const hasMin = controller.min != null && controller.min !== "";
    const min = hasMin ? integerValue(controller.min, 0) : 1;
    const fallback = integerValue(controller.default, min);
    const parsed = integerValue(value, fallback);
    return Math.max(min, parsed);
  }

  function dimensionsFromController(controller, rawValues) {
    const tokens = String(controller.calc || "").split(",").map((token) => token.trim()).filter(Boolean);
    if (tokens.length >= 2) {
      return [
        Math.max(0, integerValue(rawValues[tokens[0]], 0)),
        Math.max(0, integerValue(rawValues[tokens[1]], 0))
      ];
    }
    if (Array.isArray(controller.default)) {
      return [
        Math.max(0, integerValue(controller.default[0], 0)),
        Math.max(0, integerValue(controller.default[1], 0))
      ];
    }
    const parsed = String(controller.default || "").split(/[,\s]+/).filter(Boolean);
    if (parsed.length >= 2) {
      return [
        Math.max(0, integerValue(parsed[0], 0)),
        Math.max(0, integerValue(parsed[1], 0))
      ];
    }
    return [0, 0];
  }

  function arrayDefaultValue(value, index) {
    if (Array.isArray(value)) {
      return value[index] == null ? value[0] || "" : value[index];
    }
    return value == null ? "" : value;
  }

  function matrixDefaultValue(value, rowIndex, columnIndex) {
    if (Array.isArray(value)) {
      const row = value[rowIndex];
      if (Array.isArray(row)) {
        return row[columnIndex] == null ? "" : row[columnIndex];
      }
      return row == null ? "" : row;
    }
    return value == null ? "" : value;
  }

  function matrixCurrentValue(current, fallback, rowIndex, columnIndex) {
    const currentValue = matrixDefaultValue(current, rowIndex, columnIndex);
    return currentValue === "" ? matrixDefaultValue(fallback, rowIndex, columnIndex) : currentValue;
  }

  function matrixCornerLabel(controller) {
    return decodeHtml(controller.headers?.corner || "");
  }

  function matrixHeaderValue(controller, axis, index, rawValues) {
    const sourceId = Array.isArray(controller.headers?.[axis]) ? controller.headers[axis][0] : "";
    const values = sourceId ? rawValues[sourceId] : null;
    if (Array.isArray(values)) {
      return values[index] == null || values[index] === "" ? `${index + 1}` : values[index];
    }
    return `${index + 1}`;
  }

  function decodeHtml(value) {
    const textarea = document.createElement("textarea");
    textarea.innerHTML = String(value || "");
    return textarea.value;
  }

  function checkboxDefault(field, index) {
    const value = arrayDefaultValue(field.checked == null ? field.default : field.checked, index);
    return String(value || "").toLowerCase() === "true" || value === true;
  }

  function isFileLikeType(type) {
    return ["file", "lrfile", "rfile", "ftree", "rpath"].includes(String(type || "").toLowerCase());
  }

  function fileModes(type) {
    const normalized = String(type || "").toLowerCase();
    if (normalized === "lrfile") {
      return ["local", "server"];
    }
    if (normalized === "file") {
      return ["local"];
    }
    return ["server"];
  }

  function repeatedGroupLabel(controller, fields) {
    const label = String(controller.label || "").trim();
    if (label) {
      return displayLabel(label);
    }
    if (fields.length === 1) {
      return fields[0].label || displayLabel(fields[0].id || "Repeated value");
    }
    return "Repeated values";
  }

  function visibleFields(fields) {
    return fields.filter((field) => !isHiddenLayoutLabel(field));
  }

  function isHiddenLayoutLabel(field) {
    return field
      && isLayoutLabel(field)
      && (
        field.id === "module_header"
        || !meaningfulLayoutLabel(field)
      );
  }

  function isLayoutLabel(field) {
    return field
      && String(field.type || "").toLowerCase() === "label";
  }

  function meaningfulLayoutLabel(field) {
    const label = String(field.label || "").trim();
    const id = String(field.id || "").trim();
    if (!label || label === id || /^dum(?:my)?\d*$/i.test(label) || /^separator(?:[_-]|$)/i.test(label)) {
      return false;
    }
    return true;
  }

  function renderLayoutLabel(field) {
    const row = el("div", "ui2-field ui2-field-heading");
    row.dataset.fieldId = field.id || "";
    if (field.repeat) {
      row.dataset.repeat = field.repeat;
    }

    row.appendChild(el("h3", null, field.label || field.id || "Section"));
    if (devMode && field.repeat) {
      row.appendChild(el("p", "ui2-help ui2-repeat-debug"));
    }
    return row;
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
