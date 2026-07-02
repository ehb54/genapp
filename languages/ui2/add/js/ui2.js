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
  const JOB_MANAGER_ENDPOINT = "ajax/sys_config/sys_jobs2.php";
  const FIELD_CONTROL_SELECTOR = "input[data-field-id], select[data-field-id], textarea[data-field-id]";
  const NGL_REPRESENTATION_TYPES = [
    "backbone",
    "ball+stick",
    "cartoon",
    "contact",
    "helixorient",
    "hyperball",
    "label",
    "licorice",
    "line",
    "point",
    "ribbon",
    "rocket",
    "rope",
    "spacefill",
    "surface",
    "trace",
    "tube"
  ];
  let plotlyLoadPromise = null;
  let nglLoadPromise = null;

  const state = {
    moduleId: "",
    menuId: "",
    activeMenuId: "",
    module: null,
    view: {},
    values: {},
    serverSelections: {},
    jobSelections: {},
    submitResponse: null,
    activeJob: null,
    freshLoginAfterLogoff: false,
    ws: {
      conn: null,
      url: "",
      ready: false,
      subscribedUuid: ""
    },
    session: {
      logon: "",
      project: "",
      groups: {},
      usergroups: [],
      restricted: [],
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
    moduleStrip: document.getElementById("ui2-module-strip"),
    navToggle: document.getElementById("ui2-nav-toggle"),
    sessionStatus: document.getElementById("ui2-session-status"),
    jobs: document.getElementById("ui2-jobs"),
    files: document.getElementById("ui2-files"),
    settings: document.getElementById("ui2-settings"),
    feedback: document.getElementById("ui2-feedback"),
    docs: document.getElementById("ui2-docs"),
    help: document.getElementById("ui2-help"),
    logoff: document.getElementById("ui2-logoff"),
    wsIndicator: document.querySelector(".ui2-ws-indicator")
  };

  function init() {
    ensureWindowName();
    document.body.classList.toggle("ui2-dev-mode", devMode);
    setSidebarCollapsed(prefs.sidebarCollapsed === true);
    nodes.navToggle?.addEventListener("click", () => {
      setSidebarCollapsed(!document.body.classList.contains("ui2-sidebar-collapsed"), true);
    });
    nodes.jobs?.addEventListener("click", () => openUtilityModule("sys_job_manager"));
    nodes.files?.addEventListener("click", () => openUtilityModule("sys_file_manager"));
    nodes.settings?.addEventListener("click", () => openUtilityModule("sys_user_config"));
    nodes.feedback?.addEventListener("click", () => openUtilityModule("sys_feedback"));
    nodes.help?.addEventListener("click", toggleHelp);
    nodes.logoff?.addEventListener("click", handleLogonAction);
    initHoverHelp();
    applyGlobalHelpBindings();
    syncDocsLink();

    renderMenu();
    refreshSessionState();
    initWebSocket();
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

    loadStartupModule();
  }

  function loadStartupModule() {
    const requested = params.get("module");
    if (requested) {
      return loadModule(requested);
    }
    showStartupShell();
    return Promise.resolve();
  }

  function ensureWindowName() {
    if (window.name && window.name.length) {
      return;
    }
    window.name = createUuid();
  }

  async function initWebSocket() {
    setWebSocketStatus("pending", "WebSocket status pending");
    if (!window.ab || typeof window.ab.Session !== "function") {
      setWebSocketStatus("error", "Autobahn WebSocket client is unavailable");
      return;
    }
    try {
      const response = await fetch(legacyEndpoint("sidBase", "ajax/sys_uid.php"), {
        cache: "no-cache",
        credentials: "same-origin"
      });
      const payload = await parseJsonResponse(response, "WebSocket setup");
      const wsUrl = stringValue(payload._ws);
      if (!wsUrl) {
        setWebSocketStatus("error", "WebSocket endpoint was not returned by sys_uid");
        return;
      }
      openWebSocketSession(wsUrl);
    } catch (error) {
      setWebSocketStatus("error", `WebSocket unavailable: ${error.message}`);
    }
  }

  function openWebSocketSession(wsUrl) {
    if (state.ws.conn?.isOpen) {
      return;
    }
    state.ws.url = wsUrl;
    state.ws.conn = new window.ab.Session(
      wsUrl,
      () => {
        state.ws.ready = true;
        setWebSocketStatus("ok", "WebSocket connected");
        subscribeRuntimeMessages("keepalive");
        if (state.activeJob?.uuid) {
          subscribeRuntimeMessages(state.activeJob.uuid);
        }
      },
      () => {
        state.ws.ready = false;
        state.ws.conn = null;
        state.ws.subscribedUuid = "";
        setWebSocketStatus("error", "WebSocket disconnected; polling is still active");
      },
      {
        skipSubprotocolCheck: true,
        maxRetries: 60,
        retryDelay: 2000
      }
    );
  }

  function setWebSocketStatus(kind, title) {
    if (!nodes.wsIndicator) {
      return;
    }
    nodes.wsIndicator.classList.remove(
      "ui2-ws-indicator-ok",
      "ui2-ws-indicator-error",
      "ui2-ws-indicator-pending"
    );
    nodes.wsIndicator.classList.add(`ui2-ws-indicator-${kind || "pending"}`);
    nodes.wsIndicator.title = title || "WebSocket status pending";
  }

  function subscribeRuntimeMessages(uuid) {
    if (!uuid || !state.ws.conn || !state.ws.ready) {
      return;
    }
    if (uuid !== "keepalive") {
      unsubscribeRuntimeMessages();
      state.ws.subscribedUuid = uuid;
    }
    state.ws.conn.subscribe(uuid, handleWebSocketMessage);
  }

  function unsubscribeRuntimeMessages() {
    if (!state.ws.conn || !state.ws.ready || !state.ws.subscribedUuid) {
      state.ws.subscribedUuid = "";
      return;
    }
    try {
      state.ws.conn.unsubscribe(state.ws.subscribedUuid);
    } catch (error) {
      // Keep polling as the authoritative fallback if unsubscribe races a close.
    }
    state.ws.subscribedUuid = "";
  }

  function handleWebSocketMessage(topic, data) {
    if (topic === "keepalive" || data === "keepalive") {
      return;
    }
    const payload = parseWebSocketPayload(data === undefined ? topic : data);
    if (!payload) {
      return;
    }
    state.submitResponse = Object.assign({}, state.submitResponse || {}, payload);
    applyRuntimePayload(payload);
    const status = runtimeStatus(payload);
    if (status && state.activeJob?.statusNode) {
      setSubmitStatus(state.activeJob.statusNode, statusLabel(status), statusKind(status));
    }
  }

  function parseWebSocketPayload(data) {
    if (!data) {
      return null;
    }
    if (typeof data === "string") {
      try {
        return JSON.parse(data);
      } catch (error) {
        return { _textarea: data };
      }
    }
    if (typeof data.json === "string") {
      try {
        return JSON.parse(data.json);
      } catch (error) {
        return { _textarea: data.json };
      }
    }
    if (typeof data === "object") {
      return data;
    }
    return null;
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
      await refreshRestrictedState();
      renderMenu();
      renderSessionState();
      syncSplashForSession();
      return payload;
    } catch (error) {
      state.session.loaded = false;
      state.session.restricted = [];
      renderMenu();
      renderSessionState(error);
      return {};
    }
  }

  async function refreshRestrictedState() {
    if (!state.session.logon) {
      state.session.restricted = [];
      return [];
    }
    const endpoint = legacyEndpoint("licenseBase", "ajax/sys_config/sys_license.php");
    try {
      const url = new URL(endpoint, window.location.href);
      url.searchParams.set("_window", window.name);
      url.searchParams.set("_logon", state.session.logon);
      const response = await fetch(url.toString(), {
        cache: "no-cache",
        credentials: "same-origin"
      });
      if (!response.ok) {
        throw new Error(`restricted status returned ${response.status}`);
      }
      const payload = await response.json();
      state.session.restricted = Array.isArray(payload.restricted) ? payload.restricted.map(stringValue) : [];
      return state.session.restricted;
    } catch (error) {
      state.session.restricted = [];
      return [];
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

  function syncSplashForSession() {
    if (state.session.logon) {
      hideSplashDialog();
      return;
    }
    openSplashDialog();
  }

  async function handleLogonAction() {
    if (!state.session.logon) {
      openLoginDialog({ mandatory: true });
      return;
    }
    openLogoffDialog();
  }

  function openLogoffDialog() {
    let overlay = document.getElementById("ui2-logoff-dialog");
    if (overlay) {
      overlay.hidden = false;
      overlay.querySelector(".ui2-logoff-confirm")?.focus();
      return;
    }

    overlay = el("div", "ui2-dialog-overlay");
    overlay.id = "ui2-logoff-dialog";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "ui2-logoff-title");

    const panel = el("section", "ui2-dialog ui2-logoff-dialog");
    const header = el("div", "ui2-dialog-header");
    const title = el("h2", null, "Logoff");
    title.id = "ui2-logoff-title";
    const close = el("button", "ui2-dialog-close", "Close");
    close.type = "button";
    close.addEventListener("click", () => {
      overlay.hidden = true;
    });
    header.append(title, close);

    const actions = el("div", "ui2-dialog-actions");
    const confirm = el("button", "ui2-button ui2-logoff-confirm", "Logoff");
    confirm.type = "button";
    confirm.addEventListener("click", async () => {
      confirm.disabled = true;
      await logoffSession();
      confirm.disabled = false;
      overlay.hidden = true;
    });
    actions.appendChild(confirm);

    panel.append(header, actions);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    confirm.focus();
  }

  function openLoginDialog(options = {}) {
    const mandatory = options.mandatory !== false && !state.session.logon;
    let overlay = document.getElementById("ui2-login-dialog");
    if (overlay) {
      applyLoginDialogMode(overlay, mandatory);
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
    applyLoginDialogMode(overlay, mandatory);
    form.elements.userid?.focus();
  }

  function applyLoginDialogMode(overlay, mandatory) {
    overlay.dataset.mandatory = mandatory ? "true" : "false";
    const close = overlay.querySelector(".ui2-dialog-close");
    const cancel = overlay.querySelector(".ui2-button-quiet");
    if (close) {
      close.hidden = mandatory;
    }
    if (cancel) {
      cancel.hidden = mandatory;
    }
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
        hideSplashDialog();
        await refreshSessionState();
        if (state.freshLoginAfterLogoff) {
          state.freshLoginAfterLogoff = false;
          await loadStartupModule();
        }
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
      state.session.restricted = [];
      renderMenu();
      renderSessionState();
      stopSessionRuntime();
      state.freshLoginAfterLogoff = true;
      openSplashDialog();
    } catch (error) {
      renderSessionState(error);
    }
  }

  function stopSessionRuntime() {
    stopJobPolling();
    closeUtilityOverlay();
  }

  function openSplashDialog() {
    let overlay = document.getElementById("ui2-splash-dialog");
    if (overlay) {
      overlay.hidden = false;
      return;
    }

    overlay = el("div", "ui2-dialog-overlay ui2-splash-overlay");
    overlay.id = "ui2-splash-dialog";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "ui2-splash-title");

    const panel = el("section", "ui2-dialog ui2-splash-dialog");
    const title = el("h2", null, appTitle());
    title.id = "ui2-splash-title";

    const actions = el("div", "ui2-splash-actions");
    const login = el("button", "ui2-splash-action", "Login");
    login.type = "button";
    login.addEventListener("click", () => {
      overlay.hidden = true;
      openLoginDialog({ mandatory: true });
    });

    const register = el("button", "ui2-splash-action", "Register");
    register.type = "button";
    register.addEventListener("click", async () => {
      overlay.hidden = true;
      await openRegisterDialog();
    });
    actions.append(login, register);

    const docs = el("a", "ui2-splash-docs", "View the documentation");
    docs.href = "../docs/";
    docs.target = "_blank";
    docs.rel = "noopener";

    const footer = el("div", "ui2-splash-footer");
    splashFooterLines().forEach((line) => {
      footer.appendChild(el("p", "ui2-splash-meta", line));
    });

    panel.append(title, actions, docs, footer);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
  }

  function splashFooterLines() {
    const lines = [];
    const generatedOn = stringValue(appMap.generatedOn);
    const appRevision = stringValue(appMap.appRevision);
    const genappRevision = stringValue(appMap.genappRevision);
    if (generatedOn) {
      lines.push(generatedOn);
    }
    if (appRevision) {
      lines.push(appRevision);
    }
    if (genappRevision) {
      lines.push(genappRevision);
    } else {
      lines.push("GenApp");
    }
    return lines;
  }

  function appTitle() {
    return stringValue(appMap.title) ||
      stringValue(document.querySelector(".ui2-topbar h1")?.textContent) ||
      stringValue(document.querySelector(".ui2-shell")?.dataset.appTitle) ||
      "GenApp";
  }

  function hideSplashDialog() {
    const overlay = document.getElementById("ui2-splash-dialog");
    if (overlay) {
      overlay.hidden = true;
    }
  }

  async function openRegisterDialog() {
    try {
      const payload = await fetchModuleDefinition("sys_register");
      const module = payload.module || {};
      const fields = visibleFields(Array.isArray(module.fields) ? module.fields : []);
      const content = renderRegisterTool(module, fields);
      showUtilityOverlay("Register", content, {
        allowBackdropClose: false,
        onClose: () => {
          syncSplashForSession();
        }
      });
    } catch (error) {
      showError(`Could not load registration: ${error.message}`);
      syncSplashForSession();
    }
  }

  async function loadModule(rawId) {
    const moduleId = sanitizeModuleId(rawId);
    if (!moduleId) {
      showError("Enter a module id.");
      return;
    }
    stopJobPolling();

    if (nodes.input) {
      nodes.input.value = moduleId;
    }
    nodes.root.hidden = true;
    nodes.empty.hidden = false;
    nodes.empty.innerHTML = `<p class="ui2-kicker">Loading</p><h2>${escapeHtml(moduleId)}</h2>`;

    try {
      const payload = await fetchModuleDefinition(moduleId);
      state.moduleId = moduleId;
      state.menuId = menuIdForModule(moduleId);
      state.activeMenuId = state.menuId;
      state.module = payload.module;
      state.view = payload.viewjson || {};
      state.values = {};
      renderModule();
      updateSelectedNavigation();
    } catch (error) {
      showError(`Could not load ${moduleId}: ${error.message}`);
    }
  }

  async function fetchModuleDefinition(moduleId) {
    const response = await fetch(`modules/${encodeURIComponent(moduleId)}.json`, { cache: "no-cache" });
    if (!response.ok) {
      const utilityModule = fallbackUtilityModule(moduleId);
      if (!utilityModule) {
        throw new Error(`modules/${moduleId}.json returned ${response.status}`);
      }
      return { module: utilityModule, viewjson: {} };
    }
    const payload = await response.json();
    return {
      module: payload.modulejson || payload,
      viewjson: payload.viewjson || {}
    };
  }

  async function openUtilityModule(rawId) {
    const moduleId = sanitizeModuleId(rawId);
    if (!moduleId) {
      return;
    }
    try {
      await refreshSessionState();
      const payload = await fetchModuleDefinition(moduleId);
      const module = payload.module || {};
      const fields = visibleFields(Array.isArray(module.fields) ? module.fields : []);
      const content = renderSystemTool(module, fields);
      if (!content) {
        throw new Error(`${moduleId} is not wired as a UI2 utility.`);
      }
      showUtilityOverlay(utilityLabel(module), content, {
        dialogClass: (moduleId === "sys_feedback" || moduleId === "sys_feedback2") ? "ui2-feedback-dialog" : ""
      });
    } catch (error) {
      const message = el("div", "ui2-error", `Could not load ${moduleId}: ${error.message}`);
      showUtilityOverlay("Utility", message);
    }
  }

  function showUtilityOverlay(titleText, content, options = {}) {
    closeUtilityOverlay();
    const overlay = el("div", "ui2-dialog-overlay ui2-utility-overlay");
    overlay.id = "ui2-utility-overlay";
    overlay._ui2OnClose = typeof options.onClose === "function" ? options.onClose : null;
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay && options.allowBackdropClose !== false) {
        closeUtilityOverlay();
      }
    });
    const dialog = el("section", ["ui2-dialog", "ui2-utility-dialog", options.dialogClass || ""].filter(Boolean).join(" "));
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", "ui2-utility-title");
    const header = el("div", "ui2-dialog-header");
    const title = el("h2", null, titleText || "Utility");
    title.id = "ui2-utility-title";
    const close = el("button", "ui2-dialog-close", "Close");
    close.type = "button";
    close.addEventListener("click", closeUtilityOverlay);
    close.hidden = options.hideClose === true;
    header.append(title, close);
    const body = el("div", "ui2-utility-body");
    body.appendChild(content);
    dialog.append(header, body);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    close.focus();
  }

  function closeUtilityOverlay() {
    const overlay = document.getElementById("ui2-utility-overlay");
    if (overlay) {
      const onClose = overlay._ui2OnClose;
      overlay.remove();
      if (typeof onClose === "function") {
        onClose();
      }
    }
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
      const label = collapsed ? "Expand menu" : "Hide menu";
      nodes.navToggle.setAttribute("aria-label", label);
      nodes.navToggle.title = label;
      nodes.navToggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
    }
    if (persist) {
      savePreference("sidebarCollapsed", collapsed);
    }
  }

  function showStartupShell() {
    stopJobPolling();
    closeUtilityOverlay();
    setSidebarCollapsed(false, false);
    state.moduleId = "";
    state.menuId = "";
    state.activeMenuId = "";
    state.module = null;
    state.view = {};
    state.values = {};
    nodes.root.hidden = true;
    nodes.root.innerHTML = "";
    nodes.empty.hidden = false;
    nodes.empty.innerHTML = [
      '<h2>Choose a menu group from the options on the left.</h2>',
      '<p>Then choose a module from the list that appears at the top of the page.</p>'
    ].join("");
    collapseMenuGroups();
    renderModuleStrip();
    updateSelectedNavigation();
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
      stopJobPolling();
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

    appMap.menus.forEach((menu) => {
      if (!menuVisibleForSession(menu)) {
        return;
      }
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
      button.setAttribute("aria-pressed", state.activeMenuId === menu.id ? "true" : "false");
      button.appendChild(menuTitle(menu));
      setHoverHelp(button, menu.help);

      button.addEventListener("click", () => {
        selectMenuGroup(menu.id);
      });

      group.appendChild(button);
      nodes.menuNav.appendChild(group);
    });

    renderModuleStrip();
  }

  function menuVisibleForSession(menu) {
    const restricted = stringValue(menu?.restricted);
    if (!restricted) {
      return true;
    }
    return (state.session.restricted || []).includes(restricted);
  }

  function collapseMenuGroups() {
    if (!nodes.menuNav) {
      return;
    }
    nodes.menuNav.querySelectorAll(".ui2-menu-group").forEach((group) => {
      group.querySelector(".ui2-menu-button")?.setAttribute("aria-pressed", "false");
    });
  }

  function selectMenuGroup(menuId) {
    state.activeMenuId = stringValue(menuId);
    clearLoadedModule();
    renderMenu();
  }

  function clearLoadedModule() {
    stopJobPolling();
    closeUtilityOverlay();
    state.moduleId = "";
    state.menuId = "";
    state.module = null;
    state.view = {};
    state.values = {};
    state.submitResponse = null;
    state.activeJob = null;
    nodes.root.hidden = true;
    nodes.root.innerHTML = "";
    nodes.empty.hidden = true;
    nodes.empty.innerHTML = "";
  }

  function renderModuleStrip() {
    if (!nodes.moduleStrip) {
      return;
    }
    nodes.moduleStrip.innerHTML = "";
    const menu = (appMap.menus || []).find((entry) => entry.id === state.activeMenuId && menuVisibleForSession(entry));
    const modules = (menu?.modules || []).filter((module) => !isUtilityModule(module.id));
    if (!modules.length) {
      nodes.moduleStrip.hidden = true;
      return;
    }
    modules.forEach((module) => {
      const item = el("button", "ui2-strip-module-button", displayLabel(module.label || module.id));
      item.type = "button";
      item.dataset.moduleId = module.id || "";
      setHoverHelp(item, module.help);
      if (module.id === state.moduleId) {
        item.setAttribute("aria-current", "page");
      }
      item.addEventListener("click", () => chooseMenuModule(module.id));
      nodes.moduleStrip.appendChild(item);
    });
    nodes.moduleStrip.hidden = false;
  }

  async function chooseMenuModule(moduleId) {
    await loadModule(moduleId);
    if (state.moduleId === sanitizeModuleId(moduleId)) {
      setSidebarCollapsed(true, false);
    }
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
    nodes.menuNav.querySelectorAll(".ui2-menu-group").forEach((group) => {
      const active = group.dataset.menuId === state.activeMenuId;
      group.querySelector(".ui2-menu-button")?.setAttribute("aria-pressed", active ? "true" : "false");
    });
    renderModuleStrip();
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
    hideHoverHelp();
  }

  function applyGlobalHelpBindings() {
    const help = appMap.help || appMap.directives?.help || {};
    setHoverHelp(nodes.navToggle, help.menu || "Show or hide the module menu.");
    setHoverHelp(nodes.sessionStatus, help.project);
    setHoverHelp(nodes.jobs, help.jobs || "Open the Job Manager.");
    setHoverHelp(nodes.files, help.files || "Open the File Manager.");
    setHoverHelp(nodes.settings, help.user_config || help.register || "Open user settings.");
    setHoverHelp(nodes.feedback, help.feedback || "Send feedback about this application.");
    setHoverHelp(nodes.docs, help.docs || "Open the application documentation.");
    setHoverHelp(nodes.help, help.help || "Toggle hover help on and off.");
    setHoverHelp(nodes.logoff, help.logoff || help.login);
  }

  function syncDocsLink() {
    if (!nodes.docs) {
      return;
    }
    const docsbase = stringValue(appMap.directives?.docsbaseurl || "").trim();
    if (!docsbase) {
      nodes.docs.hidden = true;
      return;
    }
    nodes.docs.hidden = false;
    const base = docsbase.replace(/\/+$/, "");
    nodes.docs.href = /^(?:[a-z]+:|\/)/i.test(base) ? `${base}/` : `../${base}/`;
  }

  function setHoverHelp(node, help) {
    const text = stringValue(help).trim();
    if (!node || !text) {
      return node;
    }
    node.dataset.ui2Help = text;
    node.setAttribute("aria-describedby", "ui2-hover-help");
    return node;
  }

  function initHoverHelp() {
    if (document.getElementById("ui2-hover-help")) {
      return;
    }
    const tooltip = el("div", "ui2-hover-help");
    tooltip.id = "ui2-hover-help";
    tooltip.setAttribute("role", "tooltip");
    tooltip.hidden = true;
    document.body.appendChild(tooltip);
    document.addEventListener("mouseover", handleHoverHelpEnter);
    document.addEventListener("mousemove", handleHoverHelpMove);
    document.addEventListener("mouseout", handleHoverHelpLeave);
    document.addEventListener("focusin", handleHoverHelpEnter);
    document.addEventListener("focusout", handleHoverHelpLeave);
  }

  function hoverHelpEnabled() {
    return document.body.classList.contains("ui2-help-enabled");
  }

  function handleHoverHelpEnter(event) {
    if (!hoverHelpEnabled()) {
      return;
    }
    const target = event.target?.closest?.("[data-ui2-help]");
    if (!target) {
      return;
    }
    showHoverHelp(target.dataset.ui2Help || "", event);
  }

  function handleHoverHelpMove(event) {
    if (!hoverHelpEnabled()) {
      hideHoverHelp();
      return;
    }
    const tooltip = document.getElementById("ui2-hover-help");
    if (!tooltip || tooltip.hidden) {
      return;
    }
    positionHoverHelp(tooltip, event);
  }

  function handleHoverHelpLeave(event) {
    const target = event.target?.closest?.("[data-ui2-help]");
    if (!target) {
      return;
    }
    if (event.relatedTarget && target.contains(event.relatedTarget)) {
      return;
    }
    hideHoverHelp();
  }

  function showHoverHelp(help, event) {
    const tooltip = document.getElementById("ui2-hover-help");
    if (!tooltip || !help) {
      return;
    }
    tooltip.innerHTML = help;
    tooltip.hidden = false;
    positionHoverHelp(tooltip, event);
  }

  function hideHoverHelp() {
    const tooltip = document.getElementById("ui2-hover-help");
    if (!tooltip) {
      return;
    }
    tooltip.hidden = true;
    tooltip.textContent = "";
  }

  function positionHoverHelp(tooltip, event) {
    const pad = 14;
    const fallback = event.target?.getBoundingClientRect?.() || { left: 0, bottom: 0 };
    const pointerX = Number.isFinite(event.clientX) ? event.clientX : fallback.left;
    const pointerY = Number.isFinite(event.clientY) ? event.clientY : fallback.bottom;
    const rect = tooltip.getBoundingClientRect();
    const maxLeft = Math.max(8, window.innerWidth - rect.width - 8);
    const maxTop = Math.max(8, window.innerHeight - rect.height - 8);
    tooltip.style.left = `${Math.min(maxLeft, Math.max(8, pointerX + pad))}px`;
    tooltip.style.top = `${Math.min(maxTop, Math.max(8, pointerY + pad))}px`;
  }

  function renderTabs(inputCount, outputCount) {
    const tabs = el("div", "ui2-tabs");
    tabs.setAttribute("role", "tablist");
    tabs.appendChild(tabButton("Inputs", inputCount, true, "ui2-input-section"));
    tabs.appendChild(tabButton("Outputs", outputCount, false, "ui2-output-section"));
    return tabs;
  }

  function tabButton(label, count, selected, targetId) {
    const button = el("button", "ui2-tab", label);
    button.type = "button";
    button.setAttribute("role", "tab");
    button.setAttribute("aria-selected", selected ? "true" : "false");
    button.setAttribute("aria-label", `${label} ${count}`);
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
    if (role !== "output" && String(field.type || "").toLowerCase() === "group") {
      return renderGroupField(field);
    }

    const row = el("div", role === "output" ? "ui2-field ui2-output-field" : "ui2-field");
    row.dataset.fieldId = field.id || "";
    if (field.repeat) {
      row.dataset.repeat = field.repeat;
    }
    if (role === "output" && isDynamicOutputField(field)) {
      row.classList.add("ui2-dynamic-output-row");
      row.hidden = true;
    }

    const label = el("label", "ui2-field-label");
    label.textContent = field.label || field.id || field.type || "field";
    setHoverHelp(label, field.help);
    if (devMode && field.id) {
      label.setAttribute("for", fieldId(field));
      label.appendChild(el("small", null, `${field.id} · ${field.type || "text"}`));
    }

    const stack = el("div", "ui2-control-stack");
    stack.appendChild(setHoverHelp(role === "output" ? renderOutput(field) : renderControl(field), field.help));
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

  function renderGroupField(field) {
    const wrap = el("div", "ui2-group-field");
    const groups = state.session.groups || {};
    const userGroups = new Set(Array.isArray(state.session.usergroups) ? state.session.usergroups : []);
    Object.keys(groups).sort().forEach((groupId) => {
      const group = groups[groupId] || {};
      if (!userConfigGroupVisible(groupId, group)) {
        return;
      }
      const row = el("div", "ui2-field");
      row.dataset.fieldId = `_setgroup_${field.id || "groups"}_${groupId}`;
      const label = el("label", "ui2-field-label", group.label || groupId);
      setHoverHelp(label, group.help);
      const stack = el("div", "ui2-control-stack");
      const control = el("label", "ui2-switch");
      const input = document.createElement("input");
      input.type = "checkbox";
      input.dataset.fieldId = `_setgroup_${field.id || "groups"}_${groupId}`;
      input.checked = userGroups.has(groupId);
      control.append(input);
      if (group.help) {
        setHoverHelp(control, group.help);
      }
      stack.appendChild(control);
      row.append(label, stack);
      wrap.appendChild(row);
    });
    return wrap;
  }

  function userConfigGroupVisible(groupId, group) {
    if (groupId === "beta") {
      return false;
    }
    return !!group.userconfig;
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
    setHoverHelp(label, controller.help);
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
    setHoverHelp(label, field.help);
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
    setHoverHelp(input, field.help);
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
      setHoverHelp(select, field.help);
      return select;
    }

    if (type === "checkbox") {
      const wrap = el("label", "ui2-repeat-table-checkbox");
      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = checkboxDefault(field, rowIndex);
      wireRepeatTableControl(input, field, rowIndex);
      wrap.appendChild(input);
      setHoverHelp(wrap, field.help);
      return wrap;
    }

    if (isFileLikeType(type)) {
      return setHoverHelp(renderFileControl(field, {
        compact: true,
        idSuffix: `-${rowIndex}`,
        repeatTableIndex: rowIndex
      }), field.help);
    }

    const input = el("input", "ui2-input ui2-repeat-table-input");
    input.type = inputType(type);
    wireRepeatTableControl(input, field, rowIndex);
    input.value = arrayDefaultValue(field.default, rowIndex);
    setHoverHelp(input, field.help);
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
      label.append(input);
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
      const choices = parseValues(field.values);
      if (!choices.length) {
        const item = el("label", "ui2-radio");
        const input = document.createElement("input");
        input.type = "radio";
        input.name = field.name || field.id;
        input.value = field.id || field.value || "on";
        input.checked = String(field.checked || field.default || "").toLowerCase() === "true";
        wireControl(input, field);
        item.append(input);
        return item;
      }
      const group = el("div", "ui2-radio-group");
      choices.forEach((choice, index) => {
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
    if (type === "job") {
      return renderJobReferenceControl(field);
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

  function renderJobReferenceControl(field) {
    const wrap = el("div", "ui2-job-reference-control");
    wrap.dataset.fieldId = field.id || "";
    const button = el("button", "ui2-button ui2-button-quiet", "Select a job or jobs");
    button.type = "button";
    const summary = el("div", "ui2-job-reference-summary");
    summary.id = `${fieldId(field)}-altval`;
    summary.textContent = "No reference jobs selected.";
    const hidden = el("div", "ui2-job-reference-hidden");
    button.addEventListener("click", () => openJobReferenceDialog(field, wrap));
    wrap.append(button, summary, hidden);
    return wrap;
  }

  function updateJobReferenceControl(wrap, field, selections) {
    const id = field.id || "";
    const selected = Array.isArray(selections) ? selections : [];
    state.jobSelections[id] = selected;
    const summary = wrap.querySelector(".ui2-job-reference-summary");
    const hidden = wrap.querySelector(".ui2-job-reference-hidden");
    if (summary) {
      summary.innerHTML = "";
      if (!selected.length) {
        summary.textContent = "No reference jobs selected.";
      } else {
        const table = el("table", "ui2-job-reference-table");
        selected.forEach((job) => {
          const row = document.createElement("tr");
          row.appendChild(el("td", null, job.display || job.id || "Selected job"));
          table.appendChild(row);
        });
        summary.appendChild(table);
      }
    }
    if (hidden) {
      hidden.innerHTML = "";
      selected.forEach((job) => {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = `${id}_altval[]`;
        input.value = job.id || "";
        input.dataset.jobReferenceValue = id;
        hidden.appendChild(input);
      });
    }
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
      clearServerSelection(field, options?.repeatTableIndex);
      input.value = localPicker.files && localPicker.files[0] ? localPicker.files[0].name : "";
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    input.addEventListener("input", (event) => {
      if (event.isTrusted) {
        clearServerSelection(field, options?.repeatTableIndex);
      }
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
      server.addEventListener("click", () => openServerFileDialog(field, input, options));
      actions.appendChild(server);
    }

    wrap.append(input, localPicker, actions);
    return wrap;
  }

  function openServerFileDialog(field, targetInput, options) {
    if (!state.session.logon) {
      openLoginDialog();
      return;
    }

    const overlay = el("div", "ui2-dialog-overlay");
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "ui2-server-file-title");

    const panel = el("section", "ui2-dialog ui2-file-dialog");
    const header = el("div", "ui2-dialog-header");
    const title = el("h2", null, fileDialogTitle(field));
    title.id = "ui2-server-file-title";
    const close = el("button", "ui2-dialog-close", "Close");
    close.type = "button";
    close.addEventListener("click", () => overlay.remove());
    header.append(title, close);

    const path = el("div", "ui2-server-path", "User files");
    const list = el("div", "ui2-server-file-list");
    list.setAttribute("role", "listbox");
    const status = el("div", "ui2-submit-status", "Loading server files...");
    const actions = el("div", "ui2-dialog-actions");
    const choose = el("button", "ui2-button", "Select");
    choose.type = "button";
    choose.disabled = true;
    const cancel = el("button", "ui2-button ui2-button-quiet", "Cancel");
    cancel.type = "button";
    cancel.addEventListener("click", () => overlay.remove());
    actions.append(choose, cancel);

    let selected = null;
    const load = async (dirId) => {
      status.textContent = "Loading server files...";
      status.dataset.status = "";
      list.innerHTML = "";
      choose.disabled = true;
      selected = null;
      try {
        const entries = await fetchServerFileEntries(dirId);
        path.textContent = dirId && dirId !== "#" ? `User files / ${decodeServerFileId(dirId)}` : "User files";
        renderServerFileEntries(entries, list, field, load, (entry) => {
          selected = entry;
          choose.disabled = false;
        });
        status.textContent = entries.length ? "Choose a server file." : "No files found here.";
      } catch (error) {
        status.textContent = error.message;
        status.dataset.status = "error";
      }
    };

    choose.addEventListener("click", () => {
      if (!selected) {
        return;
      }
      setServerSelection(field, options?.repeatTableIndex, selected);
      targetInput.value = decodeServerFileId(selected.id).replace(/^\.\//, "");
      targetInput.dispatchEvent(new Event("input", { bubbles: true }));
      setServerSelection(field, options?.repeatTableIndex, selected);
      overlay.remove();
    });

    panel.append(header, path, list, status, actions);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    load("#");
  }

  async function fetchServerFileEntries(dirId) {
    const url = new URL(legacyEndpoint("filesBase", "ajax/sys_config/sys_files.php"), window.location.href);
    url.searchParams.set("_window", window.name);
    url.searchParams.set("_spec", "fc_cache");
    url.searchParams.set("_spec_dir", dirId && dirId !== "#" ? dirId : "");
    if (state.session.project && state.session.project !== "no_project_specified") {
      url.searchParams.set("project", state.session.project);
    }
    const response = await fetch(url.toString(), {
      credentials: "same-origin"
    });
    const payload = await parseJsonResponse(response, "Server file browser");
    return Array.isArray(payload) ? payload : [];
  }

  function renderServerFileEntries(entries, list, field, load, selectEntry) {
    entries.forEach((entry) => {
      const isFolder = entry.children === true;
      const allowed = isFolder ? serverFileType(field) === "rpath" : serverFileType(field) !== "rpath";
      const row = el("button", `ui2-server-file-row${isFolder ? " ui2-server-file-folder" : ""}`, "");
      row.type = "button";
      row.dataset.id = entry.id || "";
      row.setAttribute("role", "option");
      row.textContent = `${isFolder ? "Folder" : "File"} ${stripHtml(entry.text) || decodeServerFileId(entry.id || "")}`;
      row.addEventListener("click", () => {
        if (isFolder && serverFileType(field) !== "rpath") {
          load(entry.id);
          return;
        }
        if (!allowed) {
          return;
        }
        list.querySelectorAll(".ui2-server-file-row").forEach((item) => item.setAttribute("aria-selected", "false"));
        row.setAttribute("aria-selected", "true");
        selectEntry(entry);
      });
      if (isFolder) {
        row.addEventListener("dblclick", () => load(entry.id));
      }
      list.appendChild(row);
    });
  }

  function fileDialogTitle(field) {
    return serverFileType(field) === "rpath" ? "Choose Server Folder" : "Choose Server File";
  }

  function serverFileType(field) {
    return String(field.type || "").toLowerCase();
  }

  function serverSelectionKey(field, repeatIndex) {
    return `${field.id || ""}:${repeatIndex == null ? "" : repeatIndex}`;
  }

  function setServerSelection(field, repeatIndex, entry) {
    if (!field.id || !entry?.id) {
      return;
    }
    state.serverSelections[serverSelectionKey(field, repeatIndex)] = {
      id: field.id,
      type: serverFileType(field),
      repeatIndex: repeatIndex == null ? null : repeatIndex,
      encodedPath: entry.id,
      path: decodeServerFileId(entry.id).replace(/^\.\//, "")
    };
  }

  function clearServerSelection(field, repeatIndex) {
    if (!field?.id) {
      return;
    }
    delete state.serverSelections[serverSelectionKey(field, repeatIndex)];
  }

  function decodeServerFileId(id) {
    if (!id || id === "#") {
      return "";
    }
    try {
      return atob(id);
    } catch (error) {
      return id;
    }
  }

  function stripHtml(value) {
    const div = document.createElement("div");
    div.innerHTML = String(value || "");
    return div.textContent || "";
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
    if (isDynamicOutputField(field)) {
      return renderDynamicOutputGroup(field, type);
    }
    if (type === "progress") {
      const progress = el("progress", "ui2-progress");
      progress.max = field.max || 1;
      progress.value = 0;
      progress.dataset.outputFieldId = field.id || "";
      progress.dataset.outputType = type;
      return progress;
    }
    if (type === "ngl") {
      return renderNglOutputShell(field, type);
    }
    const output = el("div", outputClassForType(type), outputPlaceholderForType(type));
    output.dataset.outputFieldId = field.id || "";
    output.dataset.outputType = type;
    return output;
  }

  function renderDynamicOutputGroup(field, type) {
    const output = el("div", `${outputClassForType(type)} ui2-dynamic-output`, dynamicOutputPlaceholder(field));
    output.dataset.outputFieldId = field.id || "";
    output.dataset.outputType = type;
    output.dataset.dynamicOutput = "true";
    output.dataset.dynamicIdPrefix = field.idprefix || "";
    output.dataset.dynamicMax = field.max || "";
    output.dataset.dynamicLabel = field.label || field.id || "Dynamic output";
    output.dataset.dynamicWidth = field.width || "";
    output.dataset.dynamicHeight = field.height || "";
    return output;
  }

  function isDynamicOutputField(field) {
    return String(field?.dynamicoutput || "").toLowerCase() === "true";
  }

  function dynamicOutputPlaceholder(field) {
    return `${field.label || "Dynamic output"} will appear when the run creates it.`;
  }

  function outputClassForType(type) {
    const classes = ["ui2-output"];
    if (type === "plotly") {
      classes.push("ui2-output-plotly");
    } else if (type === "html" || type === "file") {
      classes.push("ui2-output-html");
    } else if (type === "textarea" || type === "text") {
      classes.push("ui2-output-text");
    } else if (type === "ngl") {
      classes.push("ui2-output-ngl");
    }
    return classes.join(" ");
  }

  function outputPlaceholderForType(type) {
    if (type === "plotly") {
      return "Plot will appear here at runtime.";
    }
    if (type === "html") {
      return "Report output will appear here at runtime.";
    }
    if (type === "ngl") {
      return "Structure will appear here at runtime.";
    }
    return `${type || "output"} output will appear here at runtime.`;
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
    const moduleId = module.moduleid || module.id || state.moduleId;
    if (moduleId === "sys_job_manager" || moduleId === "sys_job2_manager") {
      return renderJobManagerTool(fields, moduleId);
    }
    if (moduleId === "sys_file_manager") {
      return renderFileManagerTool(module, fields);
    }
    if (moduleId === "sys_user_config") {
      return renderUserConfigTool(module, fields);
    }
    if (moduleId === "sys_logoff") {
      return renderSimpleSystemTool("Logoff", fields);
    }
    if (moduleId === "sys_register") {
      return renderRegisterTool(module, fields);
    }
    if (moduleId === "sys_feedback" || moduleId === "sys_feedback2") {
      return renderFeedbackTool(module, fields);
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
    const id = module.id || module.moduleid || "";
    if (id === "sys_register") {
      return "Register";
    }
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

  function fallbackUtilityModule(moduleId) {
    if (moduleId === "sys_job_manager" || moduleId === "sys_job2_manager") {
      return {
        moduleid: moduleId,
        label: "Submitted Jobs",
        executable: moduleId,
        nojobcontrol: "true",
        fields: [
          { role: "output", id: "messages", label: "Messages", type: "textarea" }
        ]
      };
    }
    if (moduleId === "sys_user_config") {
      return {
        moduleid: moduleId,
        label: "Settings",
        executable: moduleId,
        nojobcontrol: "true",
        fields: []
      };
    }
    return null;
  }

  function renderJobManagerTool(fields, moduleId = "sys_job_manager") {
    const section = el("section", "ui2-section ui2-system-tool ui2-job-manager");
    const body = el("div", "ui2-section-body ui2-tool-body");
    const filters = el("div", "ui2-tool-filters");
    filters.appendChild(renderToolFilter("serverdate", "Server date", "loads from server", false));
    filters.appendChild(renderToolFilter("running", "Running", "Show running jobs", true));
    filters.appendChild(renderJobSelectFilter("completed", "Completed in the last", [
      ["*all*", "*all*"],
      ["1", "1 day"],
      ["7", "7 days"],
      ["30", "30 days"]
    ]));
    filters.appendChild(renderJobSelectFilter("project", "Project", [["*all*", "*all*"]]));
    filters.appendChild(renderJobSelectFilter("module", "Module", [["*all*", "*all*"]]));
    body.appendChild(filters);

    const actions = el("div", "ui2-tool-actions");
    const refresh = el("button", "ui2-button", "Refresh");
    refresh.type = "button";
    const deleteMany = el("button", "ui2-button ui2-button-quiet", "Delete selected");
    deleteMany.type = "button";
    actions.append(refresh, deleteMany);
    body.appendChild(actions);

    const tableWrap = el("div", "ui2-data-table-wrap");
    const table = el("table", "ui2-data-table");
    table.id = "ui2-job-table";
    const thead = document.createElement("thead");
    const tbody = document.createElement("tbody");
    table.append(thead, tbody);
    tableWrap.appendChild(table);
    body.appendChild(tableWrap);

    const messages = fields.find((field) => field.id === "messages");
    if (messages) {
      body.appendChild(renderToolOutput("Messages", messages));
    }

    section.appendChild(body);
    table._ui2UtilityModuleId = moduleId;
    refresh.addEventListener("click", () => loadJobManagerRows(table));
    deleteMany.addEventListener("click", () => deleteSelectedJobs(table));
    filters.addEventListener("change", () => applyJobManagerFilters(table));
    refreshServerDate(section);
    window.setTimeout(() => loadJobManagerRows(table), 0);
    return section;
  }

  function renderFileManagerTool(module, fields) {
    const section = el("section", "ui2-section ui2-system-tool ui2-file-manager");
    const body = el("div", "ui2-section-body ui2-tool-body");
    body.appendChild(renderToolFilter("serverdate", "Server date", "loads from server", false));

    const tree = el("div", "ui2-file-tree");
    tree.appendChild(el("h3", null, "User file tree"));
    const tableWrap = el("div", "ui2-data-table-wrap");
    const table = el("table", "ui2-data-table ui2-file-table");
    table.id = "ui2-file-manager-table";
    const thead = document.createElement("thead");
    const head = document.createElement("tr");
    ["", "Name", "Details"].forEach((label) => head.appendChild(el("th", null, label)));
    thead.appendChild(head);
    const tbody = document.createElement("tbody");
    table.append(thead, tbody);
    tableWrap.appendChild(table);
    tree.appendChild(tableWrap);
    body.appendChild(tree);

    const compression = fields.find((field) => field.id === "compression");
    if (compression) {
      body.appendChild(renderField(compression, "input"));
    }

    const actions = el("div", "ui2-tool-actions");
    const refresh = el("button", "ui2-button ui2-button-quiet", "Refresh files");
    refresh.type = "button";
    const download = el("button", "ui2-button", "Download");
    download.type = "button";
    const status = el("div", "ui2-submit-status", "");
    status.id = "ui2-file-manager-status";
    const links = el("div", "ui2-file-download-links");
    actions.append(refresh, download, status, links);
    body.appendChild(actions);

    ["status", "outfiles"].forEach((id) => {
      const field = fields.find((item) => item.id === id);
      if (field) {
        body.appendChild(renderToolOutput(field.label || id, field));
      }
    });

    section.appendChild(body);
    table._ui2UtilityModule = module || {};
    refresh.addEventListener("click", () => loadFileManagerRows(table));
    download.addEventListener("click", () => downloadFileManagerSelection(table, status, links, module || {}));
    refreshServerDate(section);
    window.setTimeout(() => loadFileManagerRows(table), 0);
    return section;
  }

  function renderUserConfigTool(module, fields) {
    const section = el("section", "ui2-section ui2-system-tool ui2-user-config");
    const form = el("form", "ui2-utility-form");
    form.noValidate = true;
    const inputFields = userConfigFields(fields.filter((field) => field.role !== "output"))
      .map(normalizeUserConfigField);
    const outputFields = fields.filter((field) => field.role === "output");
    form.appendChild(renderUtilitySection("Settings", inputFields, "input"));
    form.appendChild(renderUtilityActions("Update settings"));
    if (outputFields.length) {
      form.appendChild(renderUtilitySection("Status", outputFields, "output"));
    }
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      await submitUtilityModule(form, module, "ajax/sys_config/sys_user_config.php");
    });
    form.addEventListener("reset", () => window.setTimeout(() => syncFormValues(form), 0));
    form.addEventListener("input", () => syncFormValues(form));
    form.addEventListener("change", () => syncFormValues(form));
    section.appendChild(form);
    window.setTimeout(() => {
      syncFormValues(form);
      pullUtilityFieldValues(form);
    }, 0);
    return section;
  }

  function renderRegisterTool(module, fields) {
    const section = el("section", "ui2-section ui2-system-tool ui2-register-tool");
    const form = el("form", "ui2-utility-form");
    form.noValidate = true;
    const inputFields = fields.filter((field) => field.role !== "output");
    const outputFields = fields.filter((field) => field.role === "output");
    form.appendChild(renderUtilitySection("Register", inputFields, "input"));
    form.appendChild(renderUtilityActions(module.submit_label || "Register", { includeReset: false }));
    if (outputFields.length) {
      form.appendChild(renderUtilitySection("Status", outputFields, "output"));
    }
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const invalid = validateUtilityForm(form);
      if (invalid) {
        const status = form.querySelector(".ui2-submit-status");
        setSubmitStatus(status, invalid.message, "error");
        applyUtilityOutputs(form, { status: invalid.message });
        invalid.control?.focus();
        return;
      }
      if (String(module.captcha || "").toLowerCase() === "true") {
        const verified = await runLegacyCaptchaGate();
        if (!verified) {
          return;
        }
      }
      await submitUtilityModule(form, module, "ajax/sys_config/sys_register.php", {
        pendingMessage: "Submitting registration",
        successMessage: "Registration submitted"
      });
    });
    form.addEventListener("input", () => syncFormValues(form));
    form.addEventListener("change", () => syncFormValues(form));
    section.appendChild(form);
    window.setTimeout(() => syncFormValues(form), 0);
    return section;
  }

  function renderFeedbackTool(module, fields) {
    const moduleId = module.moduleid || module.id || "sys_feedback";
    const section = el("section", "ui2-section ui2-system-tool ui2-feedback-tool");
    const form = el("form", "ui2-utility-form");
    form.noValidate = true;
    const inputFields = fields.filter((field) => field.role !== "output");
    const outputFields = fields.filter((field) => field.role === "output");
    form.appendChild(renderUtilitySection("Feedback", inputFields, "input"));
    form.appendChild(renderUtilityActions(module.submit_label || "Send feedback", { includeReset: false }));
    if (outputFields.length) {
      form.appendChild(renderUtilitySection("Status", outputFields, "output"));
    }
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      await submitUtilityModule(form, module, `ajax/sys_config/${moduleId}.php`, {
        pendingMessage: "Sending feedback",
        successMessage: "Feedback sent"
      });
    });
    form.addEventListener("input", () => syncFormValues(form));
    form.addEventListener("change", () => syncFormValues(form));
    section.appendChild(form);
    window.setTimeout(() => {
      syncFormValues(form);
      pullUtilityFieldValues(form);
    }, 0);
    return section;
  }

  async function runLegacyCaptchaGate() {
    try {
      const challenge = await fetchCaptchaChallenge();
      return await openCaptchaDialog(challenge);
    } catch (error) {
      showError(`Could not load captcha: ${error.message}`);
      return false;
    }
  }

  async function fetchCaptchaChallenge() {
    const url = new URL(legacyEndpoint("", "ajax/sys_config/sys_captcha.php"), window.location.href);
    url.searchParams.set("_window", window.name);
    const response = await fetch(url.toString(), {
      cache: "no-cache",
      credentials: "same-origin"
    });
    const payload = await parseJsonResponse(response, "Captcha");
    if (!response.ok || payload.error) {
      throw new Error(payload.error || `Captcha returned HTTP ${response.status}`);
    }
    return payload;
  }

  async function verifyCaptchaChallenge(challengeId, captchaText) {
    const url = new URL(legacyEndpoint("", "ajax/sys_config/sys_captcha_verify.php"), window.location.href);
    url.searchParams.set("_window", window.name);
    url.searchParams.set("id", challengeId || "");
    url.searchParams.set("captcha", String(captchaText || "").trim().toLowerCase());
    const response = await fetch(url.toString(), {
      cache: "no-cache",
      credentials: "same-origin"
    });
    const payload = await parseJsonResponse(response, "Captcha verification");
    if (!response.ok || payload.error) {
      throw new Error(payload.error || `Captcha verification returned HTTP ${response.status}`);
    }
    return payload;
  }

  function openCaptchaDialog(initialChallenge) {
    return new Promise((resolve) => {
      let overlay = document.getElementById("ui2-captcha-dialog");
      if (overlay) {
        overlay.remove();
      }

      overlay = el("div", "ui2-dialog-overlay");
      overlay.id = "ui2-captcha-dialog";
      overlay.setAttribute("role", "dialog");
      overlay.setAttribute("aria-modal", "true");
      overlay.setAttribute("aria-labelledby", "ui2-captcha-title");

      const panel = el("section", "ui2-dialog ui2-captcha-dialog");
      const header = el("div", "ui2-dialog-header");
      const title = el("h2", null, "Verify");
      title.id = "ui2-captcha-title";
      header.appendChild(title);

      const body = el("div", "ui2-login-form");
      const image = document.createElement("img");
      image.className = "ui2-captcha-image";
      image.alt = "Captcha challenge";

      const row = el("label", "ui2-login-row");
      row.appendChild(el("span", "ui2-field-label", "Verification code"));
      const input = el("input", "ui2-input");
      input.type = "text";
      input.maxLength = 6;
      input.required = true;
      input.autocapitalize = "none";
      input.autocomplete = "off";
      input.spellcheck = false;
      row.appendChild(input);

      const help = el("p", "ui2-help", "Enter the 6 character code shown in the image.");
      const status = el("div", "ui2-submit-status", "");
      status.setAttribute("role", "status");
      const actions = el("div", "ui2-dialog-actions");
      const submit = el("button", "ui2-button", "Submit");
      submit.type = "button";
      actions.appendChild(submit);

      let currentChallenge = initialChallenge || {};
      const renderChallenge = (challenge) => {
        currentChallenge = challenge || {};
        image.src = `data:image/png;base64,${currentChallenge.captcha || ""}`;
        input.value = "";
        input.focus();
      };

      const closeDialog = (result) => {
        overlay.remove();
        resolve(result);
      };

      submit.addEventListener("click", async () => {
        if (!input.value.trim()) {
          setSubmitStatus(status, "Enter the captcha code shown in the image.", "error");
          input.focus();
          return;
        }
        submit.disabled = true;
        setSubmitStatus(status, "Verifying code", "pending");
        try {
          const payload = await verifyCaptchaChallenge(currentChallenge.id, input.value);
          if (payload.success) {
            closeDialog(true);
            return;
          }
          const nextChallenge = await fetchCaptchaChallenge();
          renderChallenge(nextChallenge);
          setSubmitStatus(status, "Verification failed. Please try the new code.", "error");
        } catch (error) {
          setSubmitStatus(status, error.message, "error");
        } finally {
          submit.disabled = false;
        }
      });

      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          submit.click();
        }
      });

      body.append(image, row, help, actions, status);
      panel.append(header, body);
      overlay.appendChild(panel);
      document.body.appendChild(overlay);
      renderChallenge(currentChallenge);
    });
  }

  function userConfigFields(fields) {
    const visibleIds = new Set();
    fields.forEach((field) => {
      if (userConfigFieldVisible(field)) {
        visibleIds.add(field.id || "");
      }
    });
    return fields.filter((field) => {
      if (!userConfigFieldVisible(field)) {
        return false;
      }
      const controller = repeatControllerId(field.repeat || "");
      return !controller || visibleIds.has(controller);
    });
  }

  function normalizeUserConfigField(field) {
    if (field?.id === "newprojectdesc") {
      return { ...field, required: "false" };
    }
    return field;
  }

  function userConfigFieldVisible(field) {
    return !field.hideifnot || directiveEnabled(field.hideifnot);
  }

  function directiveEnabled(name) {
    const directives = appMap.directives || {};
    const value = directives[name];
    return value != null && !/^(off|false|0)$/i.test(String(value));
  }

  function renderUtilitySection(title, fields, role) {
    const section = el("section", "ui2-section");
    const header = el("div", "ui2-section-header");
    header.appendChild(el("h2", null, title));
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

  function renderUtilityActions(submitLabel, options = {}) {
    const actions = el("div", "ui2-form-actions");
    const submit = el("button", "ui2-button ui2-button-primary", submitLabel || "Submit");
    submit.type = "submit";
    const status = el("div", "ui2-submit-status", "");
    status.setAttribute("role", "status");
    actions.appendChild(submit);
    if (options.includeReset !== false) {
      const reset = el("button", "ui2-button ui2-button-quiet", "Reset");
      reset.type = "reset";
      actions.appendChild(reset);
    }
    actions.appendChild(status);
    return actions;
  }

  function syncFormValues(form) {
    const initialValues = collectControlValues(form, () => true);
    syncLinkedControls(form, initialValues);
    const rawValues = collectControlValues(form, () => true);
    const activeRows = evaluateRepeatVisibility(form, rawValues);
    updateRepeats(form, activeRows, rawValues);
    updateRepeatTables(form, rawValues);
    return collectControlValues(form, (control) => {
      const row = control.closest(".ui2-field");
      return !row || activeRows.get(row) !== false;
    });
  }

  async function pullUtilityFieldValues(form) {
    const requested = fieldControls(form)
      .map((control) => control.dataset.pullKey)
      .filter(Boolean);
    const uniqueRequested = Array.from(new Set(requested));
    if (!uniqueRequested.length) {
      return;
    }
    try {
      await refreshSessionState();
      const url = new URL(legacyEndpoint("pullBase", "ajax/sys_config/sys_pull.php"), window.location.href);
      url.searchParams.set("_window", window.name);
      url.searchParams.set("_logon", state.session.logon || "");
      uniqueRequested.forEach((id) => url.searchParams.set(id, "0"));
      const response = await fetch(url.toString(), { cache: "no-cache", credentials: "same-origin" });
      const payload = await parseJsonResponse(response, "Settings defaults");
      applyPulledValues(form, payload || {});
      syncFormValues(form);
    } catch (error) {
      const status = form.querySelector(".ui2-submit-status");
      setSubmitStatus(status, `Could not load current settings: ${error.message}`, "error");
    }
  }

  function applyPulledValues(form, payload) {
    fieldControls(form).forEach((control) => {
      const id = control.dataset.fieldId;
      const pullKey = control.dataset.pullKey || id;
      if (!id || payload[pullKey] == null || control.type === "password") {
        return;
      }
      const value = payload[pullKey];
      if (control.type === "checkbox") {
        control.checked = value === true || String(value).toLowerCase() === "on" || String(value).toLowerCase() === "true";
      } else if (control.tagName === "SELECT" && Array.isArray(value)) {
        replaceSelectOptions(control, value);
      } else if (Array.isArray(value)) {
        control.value = value[Number(control.dataset.repeatTableIndex || 0)] ?? control.value;
      } else {
        control.value = value;
      }
    });
  }

  function replaceSelectOptions(select, values) {
    const current = select.value || (select.dataset.pullKey === "project" ? state.session.project : "");
    select.innerHTML = "";
    values.forEach((value) => {
      select.appendChild(new Option(String(value), String(value)));
    });
    if (values.map(String).includes(current)) {
      select.value = current;
    }
  }

  async function submitUtilityModule(form, module, endpointPath, options = {}) {
    const status = form.querySelector(".ui2-submit-status");
    const submitButton = form.querySelector('button[type="submit"]');
    const invalid = validateUtilityForm(form);
    if (invalid) {
      setSubmitStatus(status, invalid.message, "error");
      applyUtilityOutputs(form, { status: invalid.message });
      invalid.control?.focus();
      return;
    }
    submitButton.disabled = true;
    setSubmitStatus(status, options.pendingMessage || "Submitting settings", "pending");
    try {
      await refreshSessionState();
      if (!state.session.logon && !utilityAllowsAnonymous(module)) {
        throw new Error("You must be logged on to update settings");
      }
      const endpoint = legacyEndpoint("", endpointPath);
      const response = await fetch(endpoint, {
        method: "POST",
        body: buildUtilityFormData(form, module),
        credentials: "same-origin"
      });
      const payload = await parseJsonResponse(response, module?.label || "Settings");
      if (!response.ok || payload.error || payload._status === "failed") {
        throw new Error(payload.error || `Settings returned HTTP ${response.status}`);
      }
      setSubmitStatus(status, payload.status || options.successMessage || "Settings updated", "ok");
      applyUtilityOutputs(form, payload);
      if (module?.moduleid !== "sys_register") {
        await refreshSessionState();
        await pullUtilityFieldValues(form);
      }
    } catch (error) {
      setSubmitStatus(status, error.message, "error");
      applyUtilityOutputs(form, { status: error.message });
    } finally {
      submitButton.disabled = false;
    }
  }

  function utilityAllowsAnonymous(module) {
    const moduleId = module?.moduleid || module?.id || "";
    return moduleId === "sys_register" || moduleId === "sys_feedback" || moduleId === "sys_feedback2";
  }

  function validateUtilityForm(form) {
    syncFormValues(form);
    const invalid = fieldControls(form).find((control) => (
      !control.disabled
        && !control.closest(".ui2-output-field")
        && !control.closest(".ui2-hidden")
        && typeof control.checkValidity === "function"
        && !control.checkValidity()
    ));
    if (!invalid) {
      return validateMatchedUtilityControls(form);
    }
    return {
      control: invalid,
      message: `${fieldLabelForControl(invalid)}: ${invalid.validationMessage || "Invalid value."}`
    };
  }

  function validateMatchedUtilityControls(form) {
    const controlsById = new Map();
    fieldControls(form).forEach((control) => {
      const id = control.dataset.fieldId || "";
      if (id) {
        controlsById.set(id, control);
      }
    });
    const invalid = fieldControls(form).find((control) => {
      const matchId = control.dataset.matchField || "";
      if (!matchId || control.disabled) {
        return false;
      }
      const other = controlsById.get(matchId);
      return !!other && control.value !== other.value;
    });
    if (!invalid) {
      return null;
    }
    return {
      control: invalid,
      message: `${fieldLabelForControl(invalid)} must match ${displayLabel(invalid.dataset.matchField || "the matching field")}.`
    };
  }

  function fieldLabelForControl(control) {
    const row = control.closest(".ui2-field");
    const label = row?.querySelector(".ui2-field-label");
    return label?.textContent?.trim() || control.dataset.fieldId || "Field";
  }

  function buildUtilityFormData(form, module) {
    const activeValues = syncFormValues(form);
    const formData = new FormData();
    fieldControls(form).forEach((control) => {
      if (control.disabled || control.type === "radio" && !control.checked) {
        return;
      }
      if (control.type === "checkbox" && !control.checked) {
        return;
      }
      const id = control.dataset.fieldId || "";
      if (id && !Object.prototype.hasOwnProperty.call(activeValues, id)) {
        return;
      }
      const name = legacyUtilityFieldName(control);
      if (!name || control.closest(".ui2-output-field") || control.closest(".ui2-hidden")) {
        return;
      }
      appendFormValue(formData, name, control.type === "checkbox" ? "on" : control.value);
    });
    formData.set("_uuid", createUuid());
    formData.set("_window", window.name);
    formData.set("_project", state.session.project || "");
    formData.set("_logon", state.session.logon || "");
    if (module?.executable) {
      formData.set("_docrootexecutable", module.executable);
    }
    appendJobReferenceSelections(formData, form);
    return formData;
  }

  function appendJobReferenceSelections(formData, form) {
    form.querySelectorAll("input[data-job-reference-value][name]").forEach((input) => {
      if (input.value) {
        formData.append(input.name, input.value);
      }
    });
  }

  function legacyUtilityFieldName(control) {
    const id = control.dataset.fieldId || "";
    const row = control.closest(".ui2-field");
    const parts = [id];
    let repeat = row?.dataset.repeat || "";
    const form = control.closest("form");
    while (repeat) {
      const [rawParent, rawValue] = repeat.split(":");
      const parent = (rawParent || "").trim();
      const expected = rawValue == null ? "" : rawValue.trim();
      if (!parent) {
        break;
      }
      if (expected) {
        parts.unshift(expected);
      }
      parts.unshift(parent);
      const parentRow = form?.querySelector(`.ui2-field[data-field-id="${cssEscape(parent)}"]`);
      repeat = parentRow?.dataset.repeat || "";
    }
    return parts.join("-");
  }

  function applyUtilityOutputs(form, payload) {
    form.querySelectorAll("[data-output-field-id]").forEach((output) => {
      const id = output.dataset.outputFieldId;
      if (id && payload[id] != null) {
        output.textContent = Array.isArray(payload[id]) ? payload[id].join("\n") : String(payload[id]);
      }
    });
  }

  async function openJobReferenceDialog(field, targetControl) {
    if (!state.session.logon) {
      openLoginDialog();
      return;
    }

    const overlay = el("div", "ui2-dialog-overlay ui2-job-reference-overlay");
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "ui2-job-reference-title");

    const panel = el("section", "ui2-dialog ui2-job-reference-dialog");
    const header = el("div", "ui2-dialog-header");
    const title = el("h2", null, "Choose a job");
    title.id = "ui2-job-reference-title";
    const close = el("button", "ui2-dialog-close", "Close");
    close.type = "button";
    close.addEventListener("click", () => overlay.remove());
    header.append(title, close);

    const body = el("div", "ui2-job-reference-body");
    const serverDateRow = renderToolFilter("serverdate", "Server date", "loads from server", false);
    const tree = el("div", "ui2-job-reference-tree", "Loading jobs...");
    body.append(serverDateRow, tree);

    const actions = el("div", "ui2-dialog-actions");
    const cancel = el("button", "ui2-button ui2-button-quiet", "Cancel");
    cancel.type = "button";
    cancel.addEventListener("click", () => overlay.remove());
    const apply = el("button", "ui2-button", "OK");
    apply.type = "button";
    apply.addEventListener("click", () => {
      const selected = Array.from(tree.querySelectorAll("input[data-job-reference-row]:checked")).map((input) => ({
        id: input.value,
        display: input.dataset.jobDisplay || input.value
      }));
      updateJobReferenceControl(targetControl, field, selected);
      targetControl.dispatchEvent(new Event("change", { bubbles: true }));
      overlay.remove();
    });
    actions.append(cancel, apply);

    panel.append(header, body, actions);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    close.focus();
    refreshServerDate(panel);

    try {
      const payload = await fetchJobReferenceRows();
      renderJobReferenceTree(tree, payload.rows, payload.columns, state.jobSelections[field.id || ""] || []);
    } catch (error) {
      tree.textContent = error.message;
    }
  }

  async function fetchJobReferenceRows() {
    await refreshSessionState();
    const url = new URL(legacyEndpoint("jobsBase", JOB_MANAGER_ENDPOINT), window.location.href);
    url.searchParams.set("_window", window.name);
    const response = await fetch(url.toString(), { cache: "no-cache", credentials: "same-origin" });
    const payload = await parseJsonResponse(response, "Job chooser");
    return {
      rows: payload?.jobgrid?.outerwrapper?.innerwrapper?.rows || [],
      columns: jobColumns(payload?.colNames || [], payload?.colModel || [])
    };
  }

  function renderJobReferenceTree(tree, rows, columns, currentSelections) {
    tree.innerHTML = "";
    if (!rows.length) {
      tree.textContent = "No jobs found.";
      return;
    }
    const selectedIds = new Set((currentSelections || []).map((job) => job.id));
    const grouped = new Map();
    rows.forEach((job) => {
      const groupKey = jobReferenceGroup(job, columns);
      if (!grouped.has(groupKey)) {
        grouped.set(groupKey, []);
      }
      grouped.get(groupKey).push(job);
    });
    grouped.forEach((groupRows, groupKey) => {
      const details = el("details", "ui2-job-reference-group");
      details.open = true;
      details.appendChild(el("summary", null, groupKey));
      groupRows.forEach((job) => {
        const item = el("label", "ui2-job-reference-item");
        const input = document.createElement("input");
        input.type = "checkbox";
        input.value = job.id || "";
        input.checked = selectedIds.has(job.id || "");
        input.dataset.jobReferenceRow = "1";
        input.dataset.jobDisplay = jobReferenceDisplay(job, columns);
        item.append(input, document.createTextNode(input.dataset.jobDisplay));
        details.appendChild(item);
      });
      tree.appendChild(details);
    });
  }

  function jobReferenceGroup(job, columns) {
    const moduleName = jobCellTextByName(job, columns, "module", 0) || "Jobs";
    const start = jobCellTextByName(job, columns, "start", 2);
    const date = start.match(/\d{4}[-/]\d{2}(?:[-/]\d{2})?/)?.[0] || "Recent";
    return `${date} / ${moduleName}`;
  }

  function jobReferenceDisplay(job, columns) {
    const project = jobCellTextByName(job, columns, "project", 1) || "no_project_specified";
    const start = jobCellTextByName(job, columns, "start", 2);
    const duration = jobCellTextByName(job, columns, "duration", 6);
    return `${project}${start ? ` start: ${start}` : ""}${duration ? ` duration: ${duration}` : ""}`;
  }

  async function loadJobManagerRows(table) {
    const thead = table?.querySelector("thead");
    const tbody = table?.querySelector("tbody");
    if (!thead || !tbody) {
      return;
    }
    renderTableMessage(tbody, 1, "Loading jobs...");
    try {
      await refreshSessionState();
      const url = new URL(legacyEndpoint("jobsBase", JOB_MANAGER_ENDPOINT), window.location.href);
      url.searchParams.set("_window", window.name);
      const response = await fetch(url.toString(), { cache: "no-cache", credentials: "same-origin" });
      const payload = await parseJsonResponse(response, "Job Manager");
      const rows = payload?.jobgrid?.outerwrapper?.innerwrapper?.rows || [];
      const columns = jobColumns(payload?.colNames || [], payload?.colModel || []);
      table._ui2JobColumns = columns;
      table._ui2JobRows = rows;
      updateJobFilterChoices(table, rows, columns);
      applyJobManagerFilters(table);
    } catch (error) {
      renderTableMessage(tbody, 1, error.message);
    }
  }

  function applyJobManagerFilters(table) {
    const thead = table?.querySelector("thead");
    const tbody = table?.querySelector("tbody");
    const rows = table?._ui2JobRows || [];
    const columns = table?._ui2JobColumns || jobColumns([], []);
    if (!thead || !tbody) {
      return;
    }
    renderJobManagerTable(thead, tbody, columns, filterJobRows(rows, collectJobFilters(table), columns));
  }

  function collectJobFilters(table) {
    const section = table?.closest(".ui2-job-manager");
    return {
      running: !!toolFieldControl(section, "running", "input")?.checked,
      completed: toolFieldControl(section, "completed", "select")?.value || "*all*",
      project: toolFieldControl(section, "project", "select")?.value || "*all*",
      module: toolFieldControl(section, "module", "select")?.value || "*all*"
    };
  }

  function filterJobRows(rows, filters, columnsOrNowSeconds, maybeNowSeconds) {
    const columns = Array.isArray(columnsOrNowSeconds) ? columnsOrNowSeconds : jobColumns([], []);
    const nowSeconds = Array.isArray(columnsOrNowSeconds)
      ? (maybeNowSeconds || Math.floor(Date.now() / 1000))
      : (columnsOrNowSeconds || Math.floor(Date.now() / 1000));
    return rows.filter((job) => {
      const moduleValue = jobCellTextByName(job, columns, "module", 0);
      const projectValue = jobCellTextByName(job, columns, "project", 1);
      const endSeconds = jobEndSeconds(job, columns);
      const isRunning = isRunningJob(job, columns, endSeconds);
      if (filters.running && !isRunning) {
        return false;
      }
      if (filters.project !== "*all*" && projectValue !== filters.project) {
        return false;
      }
      if (filters.module !== "*all*" && moduleValue !== filters.module) {
        return false;
      }
      if (filters.running) {
        return true;
      }
      const completedDays = Number(filters.completed);
      if (completedDays > 0) {
        if (isRunning || !endSeconds) {
          return false;
        }
        return endSeconds >= nowSeconds - completedDays * 24 * 60 * 60;
      }
      return true;
    });
  }

  function jobCellText(job, index) {
    return stripHtml(jobCellHtml(job, index));
  }

  function jobCellHtml(job, index) {
    return String(job?.cells?.[index]?.value || "");
  }

  function jobColumn(columns, name, fallbackIndex) {
    return (columns || []).find((column) => column.name === name) || { index: fallbackIndex, name };
  }

  function jobCellTextByName(job, columns, name, fallbackIndex) {
    return jobCellText(job, jobColumn(columns, name, fallbackIndex).index);
  }

  function jobCellHtmlByName(job, columns, name, fallbackIndex) {
    return jobCellHtml(job, jobColumn(columns, name, fallbackIndex).index);
  }

  function jobEndSeconds(job, columns) {
    const numeric = Number(jobCellTextByName(job, columns, "endnumeric", 5));
    if (Number.isFinite(numeric) && numeric > 0) {
      return numeric;
    }
    const parsed = Date.parse(jobCellTextByName(job, columns, "end", 4));
    return Number.isFinite(parsed) ? Math.floor(parsed / 1000) : 0;
  }

  function isRunningJob(job, columns, endSeconds) {
    return !endSeconds || /active|running/i.test(jobCellTextByName(job, columns, "duration", 6));
  }

  function updateJobFilterChoices(table, rows, columns) {
    const section = table?.closest(".ui2-job-manager");
    updateSelectOptions(toolFieldControl(section, "project", "select"), uniqueJobCellValues(rows, columns, "project", 1));
    updateSelectOptions(toolFieldControl(section, "module", "select"), uniqueJobCellValues(rows, columns, "module", 0));
  }

  function toolFieldControl(section, id, tagName) {
    return section?.querySelector(`${tagName}[data-field-id="${cssEscape(id)}"]`) || null;
  }

  function uniqueJobCellValues(rows, columns, name, fallbackIndex) {
    return Array.from(new Set(
      rows.map((job) => jobCellTextByName(job, columns, name, fallbackIndex))
        .filter(Boolean)
    )).sort((a, b) => a.localeCompare(b));
  }

  function updateSelectOptions(select, values) {
    if (!select) {
      return;
    }
    const current = select.value || "*all*";
    select.innerHTML = "";
    select.appendChild(new Option("*all*", "*all*"));
    values.forEach((value) => select.appendChild(new Option(value, value)));
    select.value = values.includes(current) ? current : "*all*";
  }

  const JOB_HIDDEN_COLUMNS = new Set(["startnumeric", "endnumeric", "durationnumeric", "remoteip", "resource", "recent"]);

  function jobColumns(names, models) {
    const columns = [];
    models.forEach((model, index) => {
      columns.push({
        index,
        name: model.name || `col${index}`,
        label: stripHtml(names[index] || model.name || `Column ${index + 1}`),
        hidden: !!model.hidden
      });
    });
    return columns.length ? columns : [
      { index: 0, name: "module", label: "Module", hidden: false },
      { index: 1, name: "project", label: "Project", hidden: false },
      { index: 2, name: "start", label: "Start", hidden: false },
      { index: 4, name: "end", label: "End", hidden: false },
      { index: 5, name: "endnumeric", label: "End numeric", hidden: true },
      { index: 6, name: "duration", label: "Duration", hidden: false }
    ];
  }

  function jobDisplayColumns(columns) {
    return (columns || []).filter((column) => (
      !column.hidden && column.name !== "actions" && !JOB_HIDDEN_COLUMNS.has(column.name)
    ));
  }

  function visibleJobColumns(names, models) {
    return jobDisplayColumns(jobColumns(names, models));
  }

  function jobVisualState(job, columns) {
    const projectHtml = jobCellHtmlByName(job, columns, "project", 1);
    const actionsHtml = jobCellHtmlByName(job, columns, "actions", -1);
    const endSeconds = jobEndSeconds(job, columns);
    const running = isRunningJob(job, columns, endSeconds);
    const locked = /(?:&#x1f512;|&#128274;|🔒|lock)/i.test(actionsHtml);
    let projectColor = "";
    const colorMatch = projectHtml.match(/color\s*=\s*["']?([^"'>\s]+)/i);
    if (colorMatch) {
      projectColor = colorMatch[1].toLowerCase();
    } else if (running && locked) {
      projectColor = "red";
    } else if (locked) {
      projectColor = "yellow";
    } else if (running) {
      projectColor = "green";
    }
    return { running, locked, projectColor };
  }

  function renderJobManagerTable(thead, tbody, columns, rows) {
    const displayColumns = jobDisplayColumns(columns);
    thead.innerHTML = "";
    tbody.innerHTML = "";
    const header = document.createElement("tr");
    header.appendChild(el("th", null, ""));
    header.appendChild(el("th", null, "Actions"));
    displayColumns.forEach((column) => header.appendChild(el("th", null, column.label)));
    thead.appendChild(header);

    if (!rows.length) {
      renderTableMessage(tbody, displayColumns.length + 2, state.session.logon ? "No jobs found." : "Log in to view jobs.");
      return;
    }

    rows.forEach((job) => {
      const row = document.createElement("tr");
      const visual = jobVisualState(job, columns);
      if (visual.running) {
        row.classList.add("ui2-job-row-running");
      }
      if (visual.locked) {
        row.classList.add("ui2-job-row-locked");
      }
      row.dataset.jobId = job.id || "";
      const selectCell = document.createElement("td");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.dataset.jobSelect = "1";
      selectCell.appendChild(checkbox);
      row.appendChild(selectCell);

      const actionCell = el("td", "ui2-job-actions");
      const actionDefinitions = [
        ["Attach", "→", "ui2-job-action-attach", () => reattachJob(job.id, false)],
        ["Attach in new window", "⇒", "ui2-job-action-attach", () => reattachJob(job.id, true)],
        visual.running
          ? ["Cancel job", "⊗", "ui2-job-action-danger", () => manageJob(job.id, "jobcancel", "Cancel this job?")]
          : ["Delete job", "⇓", "ui2-job-action-danger", () => manageJob(job.id, "jobdelete", "Delete this job record?")]
      ];
      if (visual.locked) {
        actionDefinitions.push(["Clear project lock", "🔒", "ui2-job-action-lock", () => manageJob(projectCellValue(job, columns), "clearlock", "Clear the lock for this job project?")]);
      }
      actionDefinitions.forEach(([label, glyph, className, handler]) => {
        const button = el("button", `ui2-mini-button ui2-job-action-icon ${className}`, glyph);
        button.type = "button";
        button.title = label;
        button.setAttribute("aria-label", label);
        button.addEventListener("click", handler);
        actionCell.appendChild(button);
      });
      row.appendChild(actionCell);

      displayColumns.forEach((column) => {
        const value = stripHtml(job?.cells?.[column.index]?.value || "");
        const cellClasses = [];
        if (column.name === "project") {
          cellClasses.push("ui2-job-project");
          if (visual.projectColor) {
            cellClasses.push(`ui2-job-project-${visual.projectColor}`);
          }
        }
        const cell = el("td", cellClasses.join(" ") || null, value);
        if (column.name === "details") {
          cell.classList.add("ui2-job-details");
        }
        cell.title = value;
        row.appendChild(cell);
      });
      tbody.appendChild(row);
    });
  }

  function projectCellValue(job, columns) {
    const projectColumn = columns.find((column) => column.name === "project");
    return stripHtml(job?.cells?.[projectColumn?.index ?? 1]?.value || "");
  }

  async function reattachJob(jobId, newWindow) {
    if (!jobId) {
      setSystemMessage("messages", "No job id selected.", true);
      return;
    }
    try {
      const payload = await submitSystemModuleAction("reattach", [jobId], "sys_job_manager");
      if (payload.error) {
        throw new Error(payload.error);
      }
      const switchValue = stringValue(payload._switch);
      if (!switchValue) {
        throw new Error("Reattach returned no switch target.");
      }
      if (newWindow) {
        const url = new URL("../index.html", window.location.href);
        url.searchParams.set("_reqlogin", "1");
        url.searchParams.set("_switch", switchValue);
        window.open(url.toString(), "_blank", "noopener");
        return;
      }
      const parts = switchValue.split("/").filter(Boolean);
      const moduleId = moduleIdFromSwitchParts(parts);
      const pollUuid = parts[parts.length - 1] || jobId;
      await refreshSessionState();
      closeUtilityOverlay();
      await loadModule(moduleId);
      const form = document.getElementById("ui2-form");
      const status = document.getElementById("ui2-submit-status");
      const restoredInput = form ? await applySavedJobInput(pollUuid) : false;
      setSubmitStatus(status, `Attached (${jobId})`, "ok");
      if (form) {
        startJobPolling(pollUuid, form, status, false, !restoredInput);
      }
    } catch (error) {
      setSystemMessage("messages", error.message, true);
    }
  }

  function moduleIdFromSwitchParts(parts) {
    if (!Array.isArray(parts) || !parts.length) {
      return "";
    }
    return parts.length >= 4 ? parts[1] : parts[0];
  }

  async function manageJob(jobId, command, prompt) {
    if (!jobId) {
      setSystemMessage("messages", "No job selected.", true);
      return;
    }
    if (!window.confirm(prompt)) {
      return;
    }
    try {
      await refreshSessionState();
      const url = new URL(legacyEndpoint("manageJobBase", "ajax/sys_config/sys_managejob.php"), window.location.href);
      url.searchParams.set("tagmode", "any");
      url.searchParams.set("format", "json");
      url.searchParams.set("_window", window.name);
      url.searchParams.set("_logon", state.session.logon || "");
      url.searchParams.set("_cmd", command);
      url.searchParams.set("_jid", jobId);
      url.searchParams.set("_isadmin", "false");
      const response = await fetch(url.toString(), { cache: "no-cache", credentials: "same-origin" });
      const payload = await parseJsonResponse(response, "Job Manager action");
      if (payload.success !== "true") {
        throw new Error(payload.error || "Job Manager action failed.");
      }
      setSystemMessage("messages", payload.successtext || "Job Manager action completed.", false);
      const table = document.getElementById("ui2-job-table");
      if (table) {
        await loadJobManagerRows(table);
      }
    } catch (error) {
      setSystemMessage("messages", error.message, true);
    }
  }

  async function deleteSelectedJobs(table) {
    const ids = Array.from(table?.querySelectorAll("input[data-job-select]:checked") || [])
      .map((input) => input.closest("tr")?.dataset.jobId)
      .filter(Boolean);
    if (!ids.length) {
      setSystemMessage("messages", "No jobs selected.", true);
      return;
    }
    if (!window.confirm(`Delete ${ids.length} selected job record(s)?`)) {
      return;
    }
    try {
      await refreshSessionState();
      const url = new URL(legacyEndpoint("manageJobBase", "ajax/sys_config/sys_managejob.php"), window.location.href);
      url.searchParams.set("tagmode", "any");
      url.searchParams.set("format", "json");
      url.searchParams.set("_window", window.name);
      url.searchParams.set("_logon", state.session.logon || "");
      url.searchParams.set("_cmd", "jobdeletemany");
      url.searchParams.set("_isadmin", "false");
      ids.forEach((id) => url.searchParams.append("_jid[]", id));
      const response = await fetch(url.toString(), { cache: "no-cache", credentials: "same-origin" });
      const payload = await parseJsonResponse(response, "Job Manager delete selected");
      if (payload.success !== "true") {
        throw new Error(payload.error || "Delete selected jobs failed.");
      }
      setSystemMessage("messages", payload.successtext || "Selected jobs deleted.", false);
      await loadJobManagerRows(table);
    } catch (error) {
      setSystemMessage("messages", error.message, true);
    }
  }

  async function submitSystemModuleAction(action, jobIds, moduleId = "sys_job_manager") {
    const endpoint = legacyEndpoint("", `ajax/sys_config/${sanitizeModuleId(moduleId) || "sys_job_manager"}.php`);
    await refreshSessionState();
    const formData = new FormData();
    formData.set("_window", window.name);
    formData.set("_logon", state.session.logon || "");
    formData.set("_project", state.session.project || "");
    formData.set("action", action);
    (jobIds || []).forEach((id) => formData.set(`jqg_jobgrid_${id}`, "on"));
    const response = await fetch(endpoint, { method: "POST", body: formData, credentials: "same-origin" });
    return parseJsonResponse(response, "System module action");
  }

  async function loadFileManagerRows(table) {
    const tbody = table?.querySelector("tbody");
    if (!tbody) {
      return;
    }
    renderTableMessage(tbody, 3, "Loading files...");
    try {
      await refreshSessionState();
      const entries = await fetchServerFileEntries("#");
      renderFileManagerRows(tbody, entries, 0);
    } catch (error) {
      renderTableMessage(tbody, 3, error.message);
    }
  }

  function renderFileManagerRows(tbody, entries, depth) {
    if (!depth) {
      tbody.innerHTML = "";
    }
    if (!entries.length && !depth) {
      renderTableMessage(tbody, 3, state.session.logon ? "No files found." : "Log in to view files.");
      return;
    }
    entries.forEach((entry) => appendFileManagerRow(tbody, entry, depth || 0));
  }

  function appendFileManagerRow(tbody, entry, depth) {
    const isFolder = entry.children === true;
    const row = document.createElement("tr");
    row.dataset.fileId = entry.id || "";
    row.dataset.depth = String(depth);
    const selectCell = document.createElement("td");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.dataset.fileSelect = "1";
    selectCell.appendChild(checkbox);
    row.appendChild(selectCell);

    const nameCell = el("td", null, "");
    nameCell.style.paddingLeft = `${0.65 + depth * 1.25}rem`;
    if (isFolder) {
      const expand = el("button", "ui2-mini-button", "Open");
      expand.type = "button";
      expand.addEventListener("click", () => toggleFileManagerFolder(row, entry, depth));
      nameCell.append(expand, document.createTextNode(` ${fileEntryName(entry)}`));
    } else {
      nameCell.textContent = fileEntryName(entry);
    }
    row.appendChild(nameCell);
    row.appendChild(el("td", null, fileEntryDetails(entry)));
    tbody.appendChild(row);
  }

  async function toggleFileManagerFolder(row, entry, depth) {
    const tbody = row.parentElement;
    if (!tbody) {
      return;
    }
    const expanded = row.dataset.expanded === "true";
    removeFileManagerChildren(row);
    if (expanded) {
      row.dataset.expanded = "false";
      row.querySelector("button")?.replaceChildren("Open");
      return;
    }
    row.dataset.expanded = "true";
    row.querySelector("button")?.replaceChildren("Close");
    try {
      const children = await fetchServerFileEntries(entry.id);
      let anchor = row;
      children.forEach((child) => {
        const childRow = document.createElement("tr");
        appendFileManagerRowAfter(tbody, childRow, child, depth + 1, anchor);
        anchor = childRow;
      });
    } catch (error) {
      const errorRow = document.createElement("tr");
      const cell = el("td", "ui2-table-empty", error.message);
      cell.colSpan = 3;
      errorRow.dataset.parentId = entry.id || "";
      errorRow.appendChild(cell);
      row.after(errorRow);
    }
  }

  function appendFileManagerRowAfter(tbody, row, entry, depth, anchor) {
    row.dataset.fileId = entry.id || "";
    row.dataset.parentId = anchor.closest("tr")?.dataset.fileId || "";
    row.dataset.depth = String(depth);
    const isFolder = entry.children === true;
    const selectCell = document.createElement("td");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.dataset.fileSelect = "1";
    selectCell.appendChild(checkbox);
    row.appendChild(selectCell);
    const nameCell = el("td", null, "");
    nameCell.style.paddingLeft = `${0.65 + depth * 1.25}rem`;
    if (isFolder) {
      const expand = el("button", "ui2-mini-button", "Open");
      expand.type = "button";
      expand.addEventListener("click", () => toggleFileManagerFolder(row, entry, depth));
      nameCell.append(expand, document.createTextNode(` ${fileEntryName(entry)}`));
    } else {
      nameCell.textContent = fileEntryName(entry);
    }
    row.appendChild(nameCell);
    row.appendChild(el("td", null, fileEntryDetails(entry)));
    anchor.after(row);
  }

  function removeFileManagerChildren(row) {
    const depth = Number(row.dataset.depth || 0);
    let current = row.nextElementSibling;
    while (current && Number(current.dataset.depth || 0) > depth) {
      const next = current.nextElementSibling;
      current.remove();
      current = next;
    }
  }

  async function downloadFileManagerSelection(table, status, links, module) {
    const selected = Array.from(table?.querySelectorAll("input[data-file-select]:checked") || [])
      .map((input) => input.closest("tr")?.dataset.fileId)
      .filter(Boolean);
    if (links) {
      links.innerHTML = "";
    }
    if (!selected.length) {
      setSubmitStatus(status, "No files selected.", "error");
      return;
    }
    const fileManagerModule = module || table?._ui2UtilityModule || {};
    const endpoint = moduleSubmitEndpointFor(fileManagerModule, menuIdForModule("sys_file_manager"), "sys_file_manager");
    if (!endpoint) {
      setSubmitStatus(status, "No generated File Manager endpoint.", "error");
      return;
    }
    setSubmitStatus(status, "Preparing download...", "pending");
    try {
      await refreshSessionState();
      const formData = new FormData();
      formData.set("_window", window.name);
      formData.set("_logon", state.session.logon || "");
      formData.set("_project", state.session.project || "");
      const uuid = createUuid();
      formData.set("_uuid", uuid);
      formData.set("_height", String(Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0)));
      formData.set("_width", String(Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0)));
      if (fileManagerModule.docrootexecutable) {
        formData.set("_docrootexecutable", fileManagerModule.docrootexecutable);
      }
      const compressionControl = table.closest(".ui2-file-manager")?.querySelector('select[data-field-id="compression"], input[data-field-id="compression"]');
      formData.set("compression", compressionControl?.value || "tar");
      selected.forEach((id) => formData.append("selectedfiles[]", id));
      const response = await fetch(endpoint, { method: "POST", body: formData, credentials: "same-origin" });
      const payload = await parseJsonResponse(response, "File Manager download");
      if (payload.error) {
        throw new Error(payload.error);
      }
      let finalPayload = payload;
      let linksHtml = fileDownloadLinks(payloadFileList(finalPayload));
      if (!linksHtml && runtimeStatus(payload) === "started") {
        finalPayload = await waitForFileManagerResult(uuid, status);
        linksHtml = fileDownloadLinks(payloadFileList(finalPayload));
      }
      if (!linksHtml) {
        throw new Error(finalPayload?.status
          ? `${stripHtml(finalPayload.status)}; no downloadable file link was returned.`
          : "Download completed, but no downloadable file link was returned.");
      }
      setSubmitStatus(status, finalPayload.status ? stripHtml(finalPayload.status) : "Download ready.", "ok");
      if (links) {
        links.innerHTML = linksHtml;
      }
      updateOutputField("status", finalPayload.status || "");
      updateOutputField("outfiles", linksHtml);
    } catch (error) {
      setSubmitStatus(status, error.message, "error");
      if (links) {
        links.innerHTML = "";
      }
      updateOutputField("status", error.message);
    }
  }

  async function waitForFileManagerResult(uuid, status) {
    const url = new URL(legacyEndpoint("resultsBase", "ajax/get_results.php"), window.location.href);
    url.searchParams.set("tagmode", "any");
    url.searchParams.set("format", "json");
    url.searchParams.set("_window", window.name);
    url.searchParams.set("_logon", state.session.logon || "");
    url.searchParams.set("_uuid", uuid);
    url.searchParams.set("_getlastmsg", "1");
    url.searchParams.set("_getinput", "false");

    let lastPayload = null;
    for (let attempt = 0; attempt < 12; attempt += 1) {
      if (attempt > 0) {
        setSubmitStatus(status, "Preparing download...", "pending");
        await delay(Math.min(500 + attempt * 250, 2000));
      }
      const response = await fetch(url.toString(), {
        cache: "no-cache",
        credentials: "same-origin"
      });
      const payload = await parseJsonResponse(response, "File Manager result");
      lastPayload = payload;
      if (payloadFileList(payload).length || isTerminalStatus(runtimeStatus(payload))) {
        return payload;
      }
    }
    return lastPayload || {};
  }

  function delay(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function payloadFileList(payload) {
    if (!payload || typeof payload !== "object") {
      return [];
    }
    const direct = normalizeFileList(payload.outfiles ?? payload.outfile ?? payload.outfile_tag ?? payload.file ?? payload.files);
    if (direct.length) {
      return direct;
    }
    return normalizeFileList(findNestedValue(payload, ["outfiles", "outfile", "outfile_tag", "file", "files"]));
  }

  function findNestedValue(value, keys, seen = new Set()) {
    if (!value || typeof value !== "object" || seen.has(value)) {
      return null;
    }
    seen.add(value);
    for (const key of keys) {
      if (value[key] != null && value[key] !== "") {
        return value[key];
      }
    }
    for (const item of Object.values(value)) {
      const found = findNestedValue(item, keys, seen);
      if (found != null && found !== "") {
        return found;
      }
    }
    return null;
  }

  function normalizeFileList(value) {
    if (value == null || value === "") {
      return [];
    }
    if (Array.isArray(value)) {
      return value.flatMap((item) => normalizeFileList(item));
    }
    if (typeof value === "object") {
      return Object.values(value).flatMap((item) => normalizeFileList(item));
    }
    return [String(value)];
  }

  function fileDownloadLinks(files) {
    const normalized = normalizeFileList(files);
    if (!normalized.length) {
      return "";
    }
    return normalized.map((file) => {
      const href = `../${String(file).replace(/^\/+/, "")}`;
      const label = String(file).split("/").pop() || file;
      return `<a href="${escapeHtml(href)}" download>${escapeHtml(label)}</a>`;
    }).join("<br>");
  }

  function fileEntryName(entry) {
    const text = stripHtml(entry?.text || "");
    return text.split("|")[0].trim() || decodeServerFileId(entry?.id || "").replace(/^\.\//, "") || "file";
  }

  function fileEntryDetails(entry) {
    const text = stripHtml(entry?.text || "");
    return text.split("|").slice(1).map((part) => part.trim()).filter(Boolean).join(" | ");
  }

  function renderTableMessage(tbody, colSpan, message) {
    tbody.innerHTML = "";
    const row = document.createElement("tr");
    const cell = el("td", "ui2-table-empty", message);
    cell.colSpan = colSpan;
    row.appendChild(cell);
    tbody.appendChild(row);
  }

  function setSystemMessage(id, message, isError) {
    const output = document.querySelector(`[data-output-field-id="${cssEscape(id)}"]`);
    if (output) {
      output.classList.add("ui2-output-rendered");
      output.dataset.status = isError ? "error" : "ok";
      output.textContent = message;
    }
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
      if (id === "serverdate") {
        input.readOnly = true;
      }
      stack.appendChild(input);
    }
    row.appendChild(stack);
    return row;
  }

  async function refreshServerDate(section) {
    const input = toolFieldControl(section, "serverdate", "input");
    if (!input) {
      return;
    }
    try {
      await refreshSessionState();
      const url = new URL(legacyEndpoint("", "ajax/sys_config/sys_pull.php"), window.location.href);
      url.searchParams.set("_window", window.name);
      url.searchParams.set("_logon", state.session.logon || "");
      url.searchParams.set("datetime", "0");
      const response = await fetch(url.toString(), { cache: "no-cache", credentials: "same-origin" });
      const payload = await parseJsonResponse(response, "Server date");
      if (payload?.datetime) {
        input.value = payload.datetime;
      }
    } catch (error) {
      input.value = "Server date unavailable";
      input.title = error.message;
    }
  }

  function renderJobSelectFilter(id, label, options) {
    const row = el("div", "ui2-tool-filter");
    row.dataset.fieldId = id;
    row.appendChild(el("label", "ui2-field-label", label));
    const stack = el("div", "ui2-control-stack");
    const select = el("select", "ui2-input");
    select.dataset.fieldId = id;
    (options || [["*all*", "*all*"]]).forEach(([value, text]) => {
      select.appendChild(new Option(text, value));
    });
    stack.appendChild(select);
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
    stopJobPolling();
    clearRuntimeOutputs(form);
    setSubmitStatus(status, `Submitting to ${endpoint}`, "pending");

    try {
      await refreshSessionState();
      if (!state.session.logon) {
        throw new Error("You must be logged on to submit");
      }
      const uuid = createUuid();
      const response = await fetch(endpoint, {
        method: "POST",
        body: buildSubmitFormData(form, uuid),
        credentials: "same-origin"
      });
      const payload = await parseJsonResponse(response, "Runtime");
      state.submitResponse = payload;
      if (!response.ok || payload.error || payload._status === "failed") {
        throw new Error(payload.error || `Runtime returned HTTP ${response.status}`);
      }
      const jobUuid = payload._uuid || uuid;
      applyRuntimePayload(payload);
      setSubmitStatus(status, `Started${jobUuid ? ` (${jobUuid})` : ""}`, "ok");
      renderSubmitResponse(payload);
      if (jobUuid && !isTerminalStatus(runtimeStatus(payload))) {
        startJobPolling(jobUuid, form, status);
      }
    } catch (error) {
      setSubmitStatus(status, error.message, "error");
      renderSubmitResponse({ error: error.message });
    } finally {
      submitButton.disabled = false;
    }
  }

  function moduleSubmitEndpoint() {
    return moduleSubmitEndpointFor(state.module, state.menuId, state.moduleId);
  }

  function moduleSubmitEndpointFor(module, menuId, moduleId) {
    if (!menuId || !moduleId || !module?.executable) {
      return "";
    }
    const base = params.get("submitBase") || legacyEndpoint("", "ajax");
    return `${base.replace(/\/+$/, "")}/${encodeURIComponent(menuId)}/${encodeURIComponent(moduleId)}.php`;
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
      if (/^\s*<\?php\b/.test(text)) {
        throw new Error(`${label} reached ${response.url}, but the server returned PHP source instead of executing it. Open UI2 from the PHP-enabled application host.`);
      }
      throw new Error(`${label} returned non-JSON response (${response.status}) from ${response.url}: ${snippet}`);
    }
  }

  function buildSubmitFormData(form, uuid) {
    const formData = new FormData();
    Object.entries(state.values || {}).forEach(([id, value]) => appendFormValue(formData, id, value));
    appendSelectedFiles(formData, form);
    formData.set("_uuid", uuid || createUuid());
    formData.set("_window", window.name);
    formData.set("_project", state.session.project || "");
    formData.set("_logon", state.session.logon || "");
    if (state.module?.docrootexecutable) {
      formData.set("_docrootexecutable", state.module.docrootexecutable);
    }
    formData.set("_height", String(Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0)));
    formData.set("_width", String(Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0)));
    return formData;
  }

  function appendSelectedFiles(formData, form) {
    if (!form) {
      return;
    }
    Object.values(state.serverSelections || {}).forEach((selection) => appendServerSelection(formData, selection));
    form.querySelectorAll(".ui2-native-file[data-field-id]").forEach((picker) => {
      const id = picker.dataset.fieldId;
      if (!id || !picker.files || !picker.files.length) {
        return;
      }
      removeServerSelection(id, picker.dataset.repeatTableIndex);
      formData.delete(`${id}_altval[]`);
      formData.delete(`_selaltval_${id}`);
      formData.delete(`${id}[]`);
      formData.delete(`_decodepath_${id}`);
      if (picker.dataset.repeatTableIndex != null) {
        Array.from(picker.files).forEach((file) => formData.append(`${id}[]`, file));
        return;
      }
      formData.delete(id);
      Array.from(picker.files).forEach((file) => formData.append(id, file));
    });
  }

  function appendServerSelection(formData, selection) {
    if (!selection?.id || !selection.encodedPath) {
      return;
    }
    formData.delete(selection.id);
    formData.delete(`${selection.id}[]`);
    formData.delete(`${selection.id}_altval[]`);
    formData.delete(`_selaltval_${selection.id}`);
    formData.delete(`_decodepath_${selection.id}`);
    if (selection.type === "rpath") {
      formData.append(`${selection.id}[]`, selection.encodedPath);
      formData.append(`_decodepath_${selection.id}`, "");
      return;
    }
    formData.set(`_selaltval_${selection.id}`, `${selection.id}_altval`);
    formData.append(`${selection.id}_altval[]`, selection.encodedPath);
    formData.set(`_html_${selection.id}_altval`, `<i>Server</i>: ${selection.path || "selected file"}`);
  }

  function removeServerSelection(id, repeatIndex) {
    Object.keys(state.serverSelections || {}).forEach((key) => {
      const selection = state.serverSelections[key];
      if (selection?.id === id && String(selection.repeatIndex ?? "") === String(repeatIndex ?? "")) {
        delete state.serverSelections[key];
      }
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

  function clearRuntimeOutputs(scope) {
    (scope || document).querySelectorAll("[data-output-field-id]").forEach((output) => {
      if (output.dataset.dynamicOutput === "true") {
        updateDynamicOutput(output, { items: [] });
        return;
      }
      delete output.dataset.runtimeText;
      output.classList.remove("ui2-output-rendered", "ui2-output-plotly-ready");
      output.dataset.status = "";
      if (window.Plotly?.purge && output.dataset.outputType === "plotly") {
        window.Plotly.purge(output);
      }
      if (output.dataset.outputType === "ngl") {
        clearNglOutput(output);
        return;
      }
      if (output instanceof HTMLProgressElement || output.dataset.outputType === "progress") {
        output.value = 0;
        return;
      }
      output.textContent = outputPlaceholderForType(output.dataset.outputType || "");
    });
  }

  function startJobPolling(uuid, form, statusNode, getLastMsg = true, getInput = false) {
    stopJobPolling();
    state.activeJob = {
      uuid,
      form,
      statusNode,
      delay: 2000,
      getInput,
      timer: null
    };
    subscribeRuntimeMessages(uuid);
    pollJobResults(uuid, form, statusNode, 0, getLastMsg, getInput);
  }

  function stopJobPolling() {
    if (state.activeJob?.timer) {
      window.clearTimeout(state.activeJob.timer);
    }
    unsubscribeRuntimeMessages();
    state.activeJob = null;
  }

  async function pollJobResults(uuid, form, statusNode, lastDelay, getLastMsg, getInput = false) {
    if (!uuid || state.activeJob?.uuid !== uuid || !form?.isConnected) {
      return;
    }
    const url = new URL(legacyEndpoint("resultsBase", "ajax/get_results.php"), window.location.href);
    url.searchParams.set("tagmode", "any");
    url.searchParams.set("format", "json");
    url.searchParams.set("_window", window.name);
    url.searchParams.set("_logon", state.session.logon || "");
    url.searchParams.set("_uuid", uuid);
    url.searchParams.set("_getlastmsg", getLastMsg ? "1" : "0");
    url.searchParams.set("_getinput", getInput ? "true" : "false");

    try {
      const response = await fetch(url.toString(), {
        cache: "no-cache",
        credentials: "same-origin"
      });
      const payload = await parseJsonResponse(response, "Job results");
      state.submitResponse = payload;
      if (getInput && payload?._getinput) {
        applyInputPayload(payload._getinput);
        if (state.activeJob?.uuid === uuid) {
          state.activeJob.getInput = false;
        }
      }
      applyRuntimePayload(payload);
      renderSubmitResponse(payload);

      const status = runtimeStatus(payload);
      if (status) {
        setSubmitStatus(statusNode, statusLabel(status), statusKind(status));
      }
      if (isTerminalStatus(status)) {
        stopJobPolling();
        return;
      }

      const nextDelay = nextPollDelay(lastDelay);
      if (state.activeJob?.uuid === uuid) {
        state.activeJob.delay = nextDelay;
        state.activeJob.timer = window.setTimeout(
          () => pollJobResults(uuid, form, statusNode, nextDelay, true, false),
          nextDelay
        );
      }
    } catch (error) {
      setSubmitStatus(statusNode, error.message, "error");
      if (state.activeJob?.uuid === uuid) {
        const nextDelay = nextPollDelay(lastDelay);
        state.activeJob.timer = window.setTimeout(
          () => pollJobResults(uuid, form, statusNode, nextDelay, true, false),
          nextDelay
        );
      }
    }
  }

  async function applySavedJobInput(uuid) {
    const payload = await fetchJobInputPayload(uuid);
    if (!payload?._getinput) {
      return false;
    }
    applyInputPayload(payload._getinput);
    return true;
  }

  async function fetchJobInputPayload(uuid) {
    const url = new URL(legacyEndpoint("resultsBase", "ajax/get_results.php"), window.location.href);
    url.searchParams.set("tagmode", "any");
    url.searchParams.set("format", "json");
    url.searchParams.set("_window", window.name);
    url.searchParams.set("_logon", state.session.logon || "");
    url.searchParams.set("_uuid", uuid);
    url.searchParams.set("_getlastmsg", "0");
    url.searchParams.set("_getinput", "true");
    const response = await fetch(url.toString(), {
      cache: "no-cache",
      credentials: "same-origin"
    });
    const payload = await parseJsonResponse(response, "Job input");
    try {
      const savedPayload = await fetchUi2JobInputPayload(uuid);
      return mergeSavedInputPayloads(payload, savedPayload);
    } catch (error) {
      if (payload?._getinput) {
        return payload;
      }
      throw error;
    }
  }

  async function fetchUi2JobInputPayload(uuid) {
    const url = new URL("ajax/ui2_job_input.php", window.location.href);
    url.searchParams.set("tagmode", "any");
    url.searchParams.set("format", "json");
    url.searchParams.set("_window", window.name);
    url.searchParams.set("_logon", state.session.logon || "");
    url.searchParams.set("_uuid", uuid);
    const response = await fetch(url.toString(), {
      cache: "no-cache",
      credentials: "same-origin"
    });
    return parseJsonResponse(response, "UI2 job input");
  }

  function applyInputPayload(inputs) {
    if (!inputs || typeof inputs !== "object") {
      return;
    }
    restoreServerSelections(inputs);
    Object.entries(inputs).forEach(([id, value]) => {
      if (!id || id.startsWith("_")) {
        return;
      }
      setInputControlValue(id, value);
    });
    syncValues();
  }

  function mergeSavedInputPayloads(primary, saved) {
    if (!primary?._getinput) {
      return saved?._getinput ? saved : primary;
    }
    if (!saved?._getinput) {
      return primary;
    }
    return Object.assign({}, primary, {
      _getinput: Object.assign({}, primary._getinput, saved._getinput)
    });
  }

  function restoreServerSelections(inputs) {
    const restored = new Set();
    Object.entries(inputs || {}).forEach(([key, altField]) => {
      const match = /^_selaltval_(.+)$/.exec(key);
      if (!match) {
        return;
      }
      const id = match[1];
      const altId = stringValue(firstValue(altField)) || `${id}_altval`;
      const encodedPath = stringValue(firstValue(inputs[altId] ?? inputs[`${id}_altval`]));
      if (!encodedPath) {
        return;
      }
      const displayHtml = stringValue(inputs[`_html_${altId}`] ?? inputs[`_html_${id}_altval`]);
      restoreServerSelection(id, encodedPath, displayHtml);
      restored.add(id);
    });

    Object.entries(inputs || {}).forEach(([key, value]) => {
      const match = /^(.+)_altval$/.exec(key);
      if (!match || key.startsWith("_html_")) {
        return;
      }
      const id = match[1];
      if (restored.has(id)) {
        return;
      }
      const encodedPath = stringValue(firstValue(value));
      if (!encodedPath || !moduleFieldById(id)) {
        return;
      }
      restoreServerSelection(id, encodedPath, stringValue(inputs[`_html_${key}`]));
    });
  }

  function restoreServerSelection(id, encodedPath, displayHtml) {
    const field = moduleFieldById(id) || { id, type: "file" };
    const path = serverSelectionDisplayPath(encodedPath, displayHtml);
    setServerSelection(field, null, { id: encodedPath });
    const keyName = serverSelectionKey(field, null);
    if (state.serverSelections[keyName]) {
      state.serverSelections[keyName].path = path;
    }
    setInputControlValue(id, path);
  }

  function moduleFieldById(id) {
    const fields = Array.isArray(state.module?.fields) ? state.module.fields : [];
    return fields.find((field) => field?.id === id) || null;
  }

  function firstValue(value) {
    return Array.isArray(value) ? value[0] : value;
  }

  function serverSelectionDisplayPath(encodedPath, displayHtml) {
    const display = stripHtml(displayHtml || "").replace(/^\s*Server\s*:\s*/i, "").trim();
    return display || decodeServerFileId(encodedPath).replace(/^\.\//, "");
  }

  function setInputControlValue(id, value) {
    const controls = Array.from(document.querySelectorAll(`[data-field-id="${cssEscape(id)}"]`))
      .filter((control) => !control.dataset.outputFieldId && control.closest("#ui2-form"));
    controls.forEach((control, index) => {
      const controlValue = Array.isArray(value) ? value[index] ?? value[0] ?? "" : value;
      if (control.type === "file") {
        return;
      }
      if (control.type === "checkbox") {
        control.checked = controlValue === true || String(controlValue).toLowerCase() === "true" || String(controlValue) === "1";
      } else if (control.type === "radio") {
        control.checked = String(control.value) === String(controlValue);
      } else {
        control.value = controlValue == null ? "" : String(controlValue);
      }
      control.dispatchEvent(new Event("input", { bubbles: true }));
      control.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }

  function nextPollDelay(lastDelay) {
    if (!lastDelay || lastDelay < 2000) {
      return 2000;
    }
    return Math.min(lastDelay * 2, 16000);
  }

  function runtimeStatus(payload) {
    return stringValue(payload?._status || payload?.status).toLowerCase();
  }

  function isTerminalStatus(status) {
    return ["complete", "completed", "finished", "cancelled", "canceled", "failed", "error"].includes(stringValue(status).toLowerCase());
  }

  function statusLabel(status) {
    const normalized = stringValue(status).toLowerCase();
    if (normalized === "complete" || normalized === "completed" || normalized === "finished") {
      return "Complete";
    }
    if (normalized === "cancelled" || normalized === "canceled") {
      return "Cancelled";
    }
    if (normalized === "failed" || normalized === "error") {
      return "Failed";
    }
    if (normalized === "started" || normalized === "running") {
      return normalized[0].toUpperCase() + normalized.slice(1);
    }
    return status ? String(status) : "Running";
  }

  function statusKind(status) {
    const normalized = stringValue(status).toLowerCase();
    return ["failed", "error", "cancelled", "canceled"].includes(normalized) ? "error" : "ok";
  }

  function applyRuntimePayload(payload) {
    if (!payload || typeof payload !== "object") {
      return;
    }
    Object.entries(payload).forEach(([id, value]) => {
      if (id === "_progress") {
        updateProgressOutputs(value);
        return;
      }
      if (id === "_textarea" || id === "_airavata") {
        appendRuntimeMessage(value);
        return;
      }
      if (id.startsWith("_")) {
        return;
      }
      updateOutputField(id, value);
    });
  }

  function updateProgressOutputs(value) {
    document.querySelectorAll('[data-output-type="progress"]').forEach((progress) => {
      const numeric = normalizeProgressValue(value);
      if (!Number.isFinite(numeric)) {
        return;
      }
      if (numeric > Number(progress.max || 1) || numeric > 1 && Number(progress.max || 1) <= 1) {
        progress.max = 100;
      }
      progress.value = numeric;
    });
  }

  function normalizeProgressValue(value) {
    if (value && typeof value === "object") {
      return Number(value.value ?? value.progress ?? value.percent ?? value.percent_done ?? value._progress);
    }
    return Number(value);
  }

  function appendRuntimeMessage(value) {
    const output = document.querySelector('[data-output-type="textarea"], [data-output-type="html"], [data-output-type="text"]') ||
      ensureRuntimeOutputField("_textarea", "Runtime output", "textarea");
    if (!output) {
      return;
    }
    const text = stringValue(value);
    if (!text) {
      return;
    }
    const merged = mergeRuntimeText(output.dataset.runtimeText || visibleOutputText(output), text);
    output.dataset.runtimeText = merged;
    output.classList.add("ui2-output-rendered", "ui2-output-text");
    if (output.dataset.outputType === "html") {
      output.textContent = merged;
      return;
    }
    output.textContent = merged;
  }

  function visibleOutputText(output) {
    const text = output.textContent || "";
    return text.includes("output will appear here") ? "" : text;
  }

  function mergeRuntimeText(existing, incoming) {
    const prior = stripUi2RuntimeStatus(String(existing || ""));
    const next = stripUi2RuntimeStatus(String(incoming || ""));
    if (!prior) {
      return next;
    }
    if (!next) {
      return prior;
    }
    if (isCompleteRuntimeText(next)) {
      return next;
    }
    if (prior.includes(next) && !isRuntimeDividerText(next)) {
      return prior;
    }
    if (next.includes(prior)) {
      return next;
    }
    const separator = prior.endsWith("\n") || next.startsWith("\n") ? "" : "\n";
    return `${prior}${separator}${next}`;
  }

  function isCompleteRuntimeText(text) {
    return text.includes("DATA FROM RUN:") && / IS DONE\b/.test(text);
  }

  function stripUi2RuntimeStatus(text) {
    return String(text || "").replace(/^\s*starting job\s*\n*/i, "");
  }

  function isRuntimeDividerText(text) {
    return /^\s*=+\s*$/.test(String(text || ""));
  }

  function updateOutputField(id, value) {
    const output = document.querySelector(`[data-output-field-id="${cssEscape(id)}"]`) ||
      ensureRuntimeOutputField(id, displayLabel(id), runtimeOutputTypeForValue(value));
    if (!output) {
      return;
    }
    if (output.dataset.dynamicOutput === "true") {
      updateDynamicOutput(output, value);
      return;
    }
    updateOutputElement(output, value);
  }

  function ensureRuntimeOutputField(id, label, type) {
    if (!id) {
      return null;
    }
    const existing = document.querySelector(`[data-output-field-id="${cssEscape(id)}"]`);
    if (existing) {
      return existing;
    }

    let section = document.getElementById("ui2-output-section");
    if (!section) {
      section = renderSection("Outputs", [], "output");
      const form = document.getElementById("ui2-form");
      form?.appendChild(section);
    }
    const body = section?.querySelector(".ui2-section-body");
    if (!body) {
      return null;
    }

    body.querySelectorAll(".ui2-help").forEach((node) => {
      if (String(node.textContent || "").trim() === "No outputs declared.") {
        node.remove();
      }
    });

    const field = {
      id,
      label: label || displayLabel(id),
      type: type || "textarea"
    };
    const row = renderField(field, "output");
    row.classList.add("ui2-runtime-output-field");
    body.appendChild(row);
    return row.querySelector(`[data-output-field-id="${cssEscape(id)}"]`);
  }

  function runtimeOutputTypeForValue(value) {
    if (typeof value === "string" && value.indexOf("<") >= 0 && value.indexOf(">") > value.indexOf("<")) {
      return "html";
    }
    return "textarea";
  }

  function updateOutputElement(output, value) {
    const type = output.dataset.outputType || "";
    if (output instanceof HTMLProgressElement) {
      updateProgressOutputs(value);
      return;
    }
    if (type === "progress") {
      updateProgressOutputs(value);
      return;
    }
    if (type === "plotly") {
      renderPlotlyOutput(output, value);
      return;
    }
    if (type === "ngl") {
      renderNglOutput(output, value);
      return;
    }
    if (type === "html" || type === "file") {
      renderHtmlOutput(output, value);
      return;
    }
    renderTextOutput(output, value);
  }

  function updateDynamicOutput(group, payload) {
    const parentRow = group.closest(".ui2-dynamic-output-row");
    const items = dynamicOutputItems(group, payload);
    group.querySelectorAll(".ui2-dynamic-output-instance").forEach((node) => node.remove());
    group.classList.remove("ui2-output-rendered");
    group.textContent = "";
    if (!items.length) {
      if (parentRow) {
        parentRow.hidden = true;
      }
      group.textContent = dynamicOutputPlaceholder({
        label: group.dataset.dynamicLabel,
        id: group.dataset.outputFieldId
      });
      return;
    }
    if (parentRow) {
      parentRow.hidden = false;
    }
    group.classList.add("ui2-output-rendered");
    items.forEach((item) => {
      const instance = el("div", "ui2-dynamic-output-instance");
      const label = el("h3", "ui2-dynamic-output-label", item.label);
      const output = renderOutput({
        id: item.id,
        type: group.dataset.outputType || "html",
        width: group.dataset.dynamicWidth || "",
        height: group.dataset.dynamicHeight || ""
      });
      output.dataset.dynamicChild = "true";
      instance.append(label, output);
      group.appendChild(instance);
      updateOutputElement(output, item.value);
    });
  }

  function dynamicOutputItems(group, payload) {
    const rawItems = Array.isArray(payload) ? payload : Array.isArray(payload?.items) ? payload.items : [];
    const max = Math.max(0, parseInt(group.dataset.dynamicMax || "0", 10) || rawItems.length);
    const prefix = safeDynamicId(group.dataset.dynamicIdPrefix || group.dataset.outputFieldId || "dynamic_output");
    const label = group.dataset.dynamicLabel || "Dynamic output";
    return rawItems.slice(0, max).map((raw, index) => {
      const item = raw && typeof raw === "object" ? raw : { value: raw };
      const generatedId = `${prefix}_${index + 1}`;
      return {
        id: safeDynamicId(item.id) || generatedId,
        label: item.label || `${label} ${index + 1}`,
        value: item.value ?? item.data ?? ""
      };
    });
  }

  function safeDynamicId(value) {
    return String(value || "").replace(/[^A-Za-z0-9_-]/g, "");
  }

  function renderHtmlOutput(output, value) {
    const html = stringValue(value);
    output.classList.add("ui2-output-rendered");
    output.innerHTML = html;
  }

  function renderTextOutput(output, value) {
    output.classList.add("ui2-output-rendered");
    output.textContent = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  }

  function renderNglOutputShell(field, type) {
    const output = el("div", outputClassForType(type));
    output.dataset.outputFieldId = field.id || "";
    output.dataset.outputType = type;

    const plot = el("div", "ui2-ngl-plot");
    plot.id = `${field.id || "ngl_output"}_plot`;
    plot.hidden = true;
    if (field.width) {
      plot.style.width = field.width;
    }
    if (field.height) {
      plot.style.height = field.height;
    }

    const buttons = el("div", "ui2-ngl-buttons");
    buttons.id = `${field.id || "ngl_output"}_buttons`;
    buttons.hidden = true;

    const placeholder = el("div", "ui2-ngl-placeholder", outputPlaceholderForType(type));
    output.append(plot, buttons, placeholder);
    return output;
  }

  function clearNglOutput(output) {
    if (output._ui2NglStage?.dispose) {
      output._ui2NglStage.dispose();
    }
    output._ui2NglStage = null;
    output._ui2NglComponent = null;
    output._ui2NglReps = null;
    const plot = output.querySelector(".ui2-ngl-plot");
    const buttons = output.querySelector(".ui2-ngl-buttons");
    const placeholder = output.querySelector(".ui2-ngl-placeholder");
    if (plot) {
      plot.textContent = "";
      plot.hidden = true;
    }
    if (buttons) {
      buttons.textContent = "";
      buttons.hidden = true;
    }
    if (placeholder) {
      placeholder.hidden = false;
      placeholder.textContent = outputPlaceholderForType("ngl");
    }
  }

  function renderNglOutput(output, value) {
    const payload = parseNglPayload(value);
    if (!payload?.loadname) {
      renderTextOutput(output, value);
      return;
    }
    output.classList.add("ui2-output-rendered");
    const plot = output.querySelector(".ui2-ngl-plot");
    const buttons = output.querySelector(".ui2-ngl-buttons");
    const placeholder = output.querySelector(".ui2-ngl-placeholder");
    if (!plot || !buttons) {
      renderTextOutput(output, value);
      return;
    }
    clearNglOutput(output);
    plot.hidden = false;
    buttons.hidden = false;
    if (placeholder) {
      placeholder.hidden = true;
    }
    ensureNglLoaded()
      .then(() => {
        const stage = new window.NGL.Stage(plot.id);
        output._ui2NglStage = stage;
        return stage.loadFile(normalizeNglLoadName(payload.loadname), payload.loadparams || {}).then((component) => {
          output._ui2NglComponent = component;
          output._ui2NglReps = {};
          nglRepresentationSpecs(payload).forEach((spec) => {
            output._ui2NglReps[spec.type] = component.addRepresentation(spec.type, spec.params || {});
          });
          if (component.autoView) {
            component.autoView();
          }
          if (stage.handleResize) {
            stage.handleResize();
          }
          renderNglButtons(buttons, component, output._ui2NglReps);
        });
      })
      .catch((error) => {
        clearNglOutput(output);
        const message = output.querySelector(".ui2-ngl-placeholder");
        if (message) {
          message.textContent = `Could not render structure output: ${error.message}`;
        }
      });
  }

  function parseNglPayload(value) {
    if (value && typeof value === "object") {
      return value;
    }
    if (typeof value !== "string") {
      return null;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    try {
      const parsed = JSON.parse(trimmed);
      return parsed && typeof parsed === "object" ? parsed : { loadname: trimmed };
    } catch (_error) {
      return { loadname: trimmed };
    }
  }

  function normalizeNglLoadName(loadname) {
    const value = String(loadname || "");
    if (!value || /^(?:[a-z]+:|\/|\.\.\/|\.\/)/i.test(value)) {
      return value;
    }
    if (value.startsWith("results/")) {
      return `../${value}`;
    }
    return value;
  }

  function nglRepresentationSpecs(payload) {
    const reps = Array.isArray(payload?.representations) ? payload.representations : [];
    const specs = reps
      .map((rep) => ({
        type: rep?.type || rep?.representation || "",
        params: rep?.params || rep?.representationParams || {}
      }))
      .filter((rep) => rep.type);
    if (specs.length) {
      return specs;
    }
    return [{
      type: payload?.representation || "cartoon",
      params: payload?.representationParams || {}
    }];
  }

  function renderNglButtons(container, component, reps) {
    container.textContent = "";
    NGL_REPRESENTATION_TYPES.forEach((type) => {
      const button = el("button", "ui2-button ui2-button-quiet ui2-ngl-button", type);
      button.type = "button";
      button.setAttribute("aria-pressed", reps[type] ? "true" : "false");
      button.addEventListener("click", () => {
        if (reps[type] && component.removeRepresentation) {
          component.removeRepresentation(reps[type]);
          delete reps[type];
          button.setAttribute("aria-pressed", "false");
          return;
        }
        reps[type] = component.addRepresentation(type, {});
        button.setAttribute("aria-pressed", "true");
      });
      container.appendChild(button);
    });
  }

  function renderPlotlyOutput(output, value) {
    const figure = parsePlotlyFigure(value);
    if (!figure) {
      renderTextOutput(output, value);
      return;
    }
    output.classList.add("ui2-output-rendered", "ui2-output-plotly-ready");
    output.textContent = "";
    ensurePlotlyLoaded()
      .then(() => {
        const layout = Object.assign(defaultPlotlyLayout(), figure.layout || {});
        layout.font = Object.assign(defaultPlotlyLayout().font, figure.layout?.font || {});
        applyPlotlyTheme(layout);
        const config = Object.assign({ responsive: true }, figure.config || {});
        applyPlotlyModebarHooks(figure, config);
        return window.Plotly.newPlot(output, figure.data, layout, config);
      })
      .then(() => {
        if (window.Plotly?.Plots?.resize) {
          window.Plotly.Plots.resize(output);
        }
      })
      .catch((error) => {
        output.classList.remove("ui2-output-plotly-ready");
        output.textContent = `Could not render Plotly output: ${error.message}`;
      });
  }

  function applyPlotlyModebarHooks(figure, config) {
    const editor = config?.genapp_chart_editor;
    if (!editor?.enabled || !editor.url || !window.Plotly?.Icons?.pencil) {
      return;
    }
    const originalConfig = JSON.stringify(figure.config || {});
    config.modeBarButtonsToAdd = (config.modeBarButtonsToAdd || []).concat([{
      name: "editInChartEditor",
      title: "Edit in Chart Editor",
      icon: window.Plotly.Icons.pencil,
      click: (graphDiv) => {
        const id = `gace_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
        window.localStorage.setItem(id, JSON.stringify({
          data: graphDiv.data,
          layout: chartEditorLayout(graphDiv.layout),
          config: JSON.parse(originalConfig)
        }));
        window.open(
          chartEditorUrl(editor.url, id),
          editor.target || "_blank",
          "noopener"
        );
      }
    }]);
  }

  function chartEditorLayout(layout) {
    const copy = JSON.parse(JSON.stringify(layout || {}));
    copy.autosize = true;
    delete copy.width;
    delete copy.height;
    return copy;
  }

  function chartEditorUrl(editorUrl, id) {
    const raw = String(editorUrl || "");
    const url = /^[a-z][a-z0-9+.-]*:/i.test(raw) || raw.startsWith("//")
      ? new URL(raw, window.location.href)
      : new URL(legacyEndpoint("", raw), window.location.href);
    url.searchParams.set("id", id);
    return url.toString();
  }

  function defaultPlotlyLayout() {
    const colors = plotlyThemeColors();
    return {
      autosize: true,
      height: 460,
      margin: { l: 72, r: 32, t: 72, b: 72 },
      paper_bgcolor: colors.panel,
      plot_bgcolor: colors.panel,
      font: { color: colors.text }
    };
  }

  function applyPlotlyTheme(layout) {
    const colors = plotlyThemeColors();
    layout.paper_bgcolor = layout.paper_bgcolor || colors.panel;
    layout.plot_bgcolor = layout.plot_bgcolor || colors.panel;
    layout.font = Object.assign({ color: colors.text }, layout.font || {});
    plotlyLegendKeys(layout).forEach((legendKey) => {
      const currentLegend = layout[legendKey] || {};
      const legendBackground = currentLegend.bgcolor || colors.legendBackground;
      layout[legendKey] = Object.assign({}, currentLegend, {
        bgcolor: legendBackground,
        bordercolor: colors.border,
        font: Object.assign({}, currentLegend.font || {}, { color: contrastTextColor(legendBackground) })
      });
    });
    if (Array.isArray(layout.annotations)) {
      layout.annotations = layout.annotations.map((annotation) => {
        if (!annotation?.bgcolor) {
          return annotation;
        }
        return Object.assign({}, annotation, {
          font: Object.assign({}, annotation.font || {}, { color: contrastTextColor(annotation.bgcolor) })
        });
      });
    }
    ["xaxis", "yaxis", "xaxis2", "yaxis2", "xaxis3", "yaxis3"].forEach((axisName) => {
      if (!layout[axisName]) {
        return;
      }
      layout[axisName] = Object.assign({
        color: colors.text,
        gridcolor: colors.grid,
        linecolor: colors.border,
        zerolinecolor: colors.border
      }, layout[axisName]);
    });
    return layout;
  }

  function plotlyLegendKeys(layout) {
    const keys = Object.keys(layout || {}).filter((key) => /^legend\d*$/.test(key));
    return keys.length ? keys : ["legend"];
  }

  function plotlyThemeColors() {
    const styles = window.getComputedStyle(document.documentElement);
    const panel = styles.getPropertyValue("--ui2-panel").trim() || "#ffffff";
    const background = styles.getPropertyValue("--ui2-bg").trim() || panel;
    const text = styles.getPropertyValue("--ui2-text").trim() || "#17201d";
    const border = styles.getPropertyValue("--ui2-border").trim() || "#d8dfdc";
    const dark = isDarkCssColor(panel) || isDarkCssColor(background);
    return {
      panel,
      text,
      border,
      grid: dark ? "rgba(238, 244, 241, 0.12)" : "rgba(23, 32, 29, 0.12)",
      legendBackground: dark ? "rgba(26, 32, 31, 0.88)" : "rgba(255, 255, 255, 0.88)"
    };
  }

  function isDarkCssColor(value) {
    const rgb = parseCssColor(value);
    if (!rgb) {
      return false;
    }
    const channel = (v) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    const luminance = 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
    return luminance < 0.45;
  }

  function contrastTextColor(background) {
    return isDarkCssColor(background) ? "#eef4f1" : "#17201d";
  }

  function parseCssColor(value) {
    const raw = String(value || "").trim();
    const hex = raw.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (hex) {
      const token = hex[1].length === 3
        ? hex[1].split("").map((char) => char + char).join("")
        : hex[1];
      return {
        r: parseInt(token.slice(0, 2), 16),
        g: parseInt(token.slice(2, 4), 16),
        b: parseInt(token.slice(4, 6), 16)
      };
    }
    const rgb = raw.match(/^rgba?\(([^)]+)\)$/i);
    if (!rgb) {
      return null;
    }
    const parts = rgb[1].split(",").map((part) => Number.parseFloat(part.trim()));
    if (parts.length < 3 || parts.slice(0, 3).some((part) => !Number.isFinite(part))) {
      return null;
    }
    return {
      r: Math.max(0, Math.min(255, parts[0])),
      g: Math.max(0, Math.min(255, parts[1])),
      b: Math.max(0, Math.min(255, parts[2]))
    };
  }

  function parsePlotlyFigure(value) {
    let figure = value;
    if (typeof figure === "string") {
      const trimmed = figure.trim();
      if (!trimmed || trimmed[0] !== "{") {
        return null;
      }
      try {
        figure = JSON.parse(trimmed);
      } catch (error) {
        return null;
      }
    }
    if (!figure || typeof figure !== "object" || !Array.isArray(figure.data)) {
      return null;
    }
    return figure;
  }

  function ensurePlotlyLoaded() {
    if (window.Plotly?.newPlot) {
      return Promise.resolve(window.Plotly);
    }
    if (plotlyLoadPromise) {
      return plotlyLoadPromise;
    }
    plotlyLoadPromise = loadScript("../js/plotly-2.35.2.min.js")
      .catch(() => loadScript("../js/plotly-latest.min.js"))
      .then(() => {
        if (!window.Plotly?.newPlot) {
          throw new Error("Plotly did not initialize");
        }
        return window.Plotly;
      });
    return plotlyLoadPromise;
  }

  function ensureNglLoaded() {
    if (window.NGL?.Stage) {
      return Promise.resolve(window.NGL);
    }
    if (nglLoadPromise) {
      return nglLoadPromise;
    }
    nglLoadPromise = loadScript("../js/ngl.js")
      .then(() => {
        if (!window.NGL?.Stage) {
          throw new Error("NGL did not initialize");
        }
        return window.NGL;
      });
    return nglLoadPromise;
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = Array.from(document.scripts).find((script) => script.getAttribute("src") === src);
      if (existing) {
        existing.addEventListener("load", resolve, { once: true });
        existing.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)), { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(script);
    });
  }

  function renderSubmitResponse(payload) {
    if (!devMode) {
      return;
    }
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
    fieldControls(scope).forEach((control) => {
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
      fieldControls(row).forEach((control) => {
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
    if (field.match) {
      control.dataset.matchField = field.match;
    }
    if (field.pull) {
      control.dataset.pullKey = field.pull;
    }
    if (field.sync) {
      control.dataset.sync = field.sync;
    }
    if (field.required === "true" || field.required === true) {
      control.required = true;
    }
    if (field.pattern) {
      control.pattern = field.pattern;
      if (field.patternmessage) {
        control.title = field.patternmessage;
      }
    }
  }

  function wireRepeatTableControl(control, field, rowIndex) {
    control.id = `${fieldId(field)}-${rowIndex}`;
    control.dataset.fieldId = field.id || "";
    control.dataset.repeatTableField = field.id || "";
    control.dataset.repeatTableIndex = String(rowIndex);
    if (field.match) {
      control.dataset.matchField = field.match;
    }
    if (field.pull) {
      control.dataset.pullKey = field.pull;
    }
    if (field.required === "true" || field.required === true) {
      control.required = true;
    }
    if (field.pattern) {
      control.pattern = field.pattern;
      if (field.patternmessage) {
        control.title = field.patternmessage;
      }
    }
  }

  function fieldControls(scope) {
    return Array.from(scope.querySelectorAll(FIELD_CONTROL_SELECTOR));
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

  if (window.GenAppUi2ExposeTestHooks) {
    window.GenAppUi2TestHooks = {
      filterJobRows,
      jobManagerEndpoint: JOB_MANAGER_ENDPOINT,
      jobColumns,
      jobDisplayColumns,
      jobEndSeconds,
      jobVisualState,
      renderJobManagerTable,
      refreshServerDate,
      normalizeFileList,
      payloadFileList,
      fileDownloadLinks,
      moduleSubmitEndpointFor,
      buildSubmitFormData,
      serverSelectionDisplayPath,
      dynamicOutputItems,
      mergeSavedInputPayloads,
      menuVisibleForSession,
      moduleIdFromSwitchParts,
      legacyUtilityFieldName,
      replaceSelectOptions,
      userConfigGroupVisible,
      parseNglPayload,
      normalizeNglLoadName,
      nglRepresentationSpecs,
      applyPlotlyTheme,
      plotlyThemeColors,
      applyRuntimePayload,
      applyInputPayload,
      applySavedJobInput,
      state
    };
  }

  init();
}());
