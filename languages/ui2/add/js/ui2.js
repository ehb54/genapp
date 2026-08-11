(function () {
  "use strict";

  const fallbackModules = ["shared", "plain", "typed"];

  const appMap = window.GenAppUi2App || { menus: [] };
  const candidateModules = moduleCandidates();
  const params = new URLSearchParams(window.location.search);
  const prefs = loadPreferences();
  const UI2_DEFAULT_THEME = "slate";
  const UI2_THEME_OPTIONS = [
    ["system", "System"],
    ["slate", "Slate"],
    ["dark", "Dark"],
    ["cyborg", "Cyborg"],
    ["darkly", "Darkly"],
    ["solar", "Solar"],
    ["superhero", "Superhero"],
    ["light", "Light"],
    ["cerulean", "Cerulean"],
    ["cosmo", "Cosmo"],
    ["flatly", "Flatly"],
    ["journal", "Journal"],
    ["litera", "Litera"],
    ["lumen", "Lumen"],
    ["lux", "Lux"],
    ["materia", "Materia"],
    ["minty", "Minty"],
    ["pulse", "Pulse"],
    ["sandstone", "Sandstone"],
    ["simplex", "Simplex"],
    ["sketchy", "Sketchy"],
    ["spacelab", "Spacelab"],
    ["united", "United"],
    ["yeti", "Yeti"]
  ];
  const UI2_THEME_VALUES = new Set(UI2_THEME_OPTIONS.map(([value]) => value));
  const LEGACY_USER_CONFIG_THEME_FIELD_IDS = new Set(["changetheme", "themetype", "themedark", "themelight", "theme"]);
  const AI_HELPER_PREFERENCE_VALUES = new Set(["default", "on", "off"]);
  const AI_HELPER_ENDPOINT_STATES = new Set(["unavailable", "unconfigured", "development_stub", "configured"]);
  const AI_HELPER_SENSITIVE_FIELD_RE = /(?:password|passwd|passphrase|secret|token|apikey|api_key|auth|credential)/i;
  const AI_HELPER_OUTPUT_MAX_FIELDS = 6;
  const AI_HELPER_OUTPUT_MAX_CHARS = 400;
  const TEST_SCENARIO_ENDPOINT = "ajax/ui2_test_scenarios.php";
  const TEST_SCENARIO_CHECK_KINDS = new Set(["job_status", "output_present", "output_nonempty"]);
  const AI_HELPER_KATEX_CSS_URL = "https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css";
  const AI_HELPER_KATEX_SCRIPT_URL = "https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js";
  const requestedUi2Theme = params.get("ui2theme");
  let activeUi2Theme = normalizeUi2Theme(requestedUi2Theme || prefs.ui2Theme || UI2_DEFAULT_THEME);
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
  const NGL_FRAME_HISTORY_DEFAULT_MAX_BYTES = 64 * 1024 * 1024;
  let plotlyLoadPromise = null;
  let nglLoadPromise = null;
  let katexLoadPromise = null;
  let reactWorkbenchRoot = null;
  let reactWorkbenchSyncFrame = null;

  const state = {
    moduleId: "",
    menuId: "",
    activeMenuId: "",
    module: null,
    view: {},
    values: {},
    serverSelections: {},
    fileReselectionWarnings: {},
    lastServerFileDir: "",
    lastServerFileSessionKey: "",
    jobSelections: {},
    submitResponse: null,
    submittedRunContext: null,
    workbenchRunContextListeners: new Set(),
    runtimeOutputListeners: new Set(),
    testScenarioListeners: new Set(),
    testScenarios: initialTestScenarioState(),
    runtimeOutputAvailability: {},
    pendingSwitch: "",
    viewReady: null,
    viewReadyGeneration: 0,
    runtimeOutputs: {},
    nglFrameHistories: {},
    runtimeOutputContext: {
      moduleId: "",
      jobUuid: "",
      generation: 0
    },
    activeJob: null,
    jobEvents: createJobEventStore(),
    freshLoginAfterLogoff: false,
    ws: {
      conn: null,
      url: "",
      ready: false,
      subscribedUuid: ""
    },
    lastLegacyMessageKey: "",
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
    aiHelper: document.getElementById("ui2-ai-helper"),
    docsControl: document.getElementById("ui2-docs-control"),
    docs: document.getElementById("ui2-docs"),
    docsToggle: document.getElementById("ui2-docs-toggle"),
    docsMenu: document.getElementById("ui2-docs-menu"),
    docsModule: document.getElementById("ui2-docs-module"),
    docsMain: document.getElementById("ui2-docs-main"),
    help: document.getElementById("ui2-help"),
    logoff: document.getElementById("ui2-logoff"),
    wsIndicator: document.querySelector(".ui2-ws-indicator")
  };

  applyUi2Theme(activeUi2Theme);

  function init() {
    ensureWindowName();
    window.addEventListener?.("ui2-react-ready", () => {
      if (isReactWorkbenchView(state.view)) {
        renderModule();
      }
    });
    document.body.classList.toggle("ui2-dev-mode", devMode);
    setSidebarCollapsed(prefs.sidebarCollapsed === true);
    nodes.navToggle?.addEventListener("click", () => {
      setSidebarCollapsed(!document.body.classList.contains("ui2-sidebar-collapsed"), true);
    });
    nodes.jobs?.addEventListener("click", () => openUtilityModule("sys_job_manager"));
    nodes.files?.addEventListener("click", () => openUtilityModule("sys_file_manager"));
    nodes.settings?.addEventListener("click", () => openUtilityModule("sys_user_config"));
    nodes.feedback?.addEventListener("click", () => openUtilityModule("sys_feedback"));
    nodes.aiHelper?.addEventListener("click", openAiHelperPanel);
    nodes.docsToggle?.addEventListener("click", toggleDocsMenu);
    nodes.docsMain?.addEventListener("click", closeDocsMenu);
    nodes.docsModule?.addEventListener("click", closeDocsMenu);
    document.addEventListener("click", closeDocsMenuOnOutsideClick);
    document.addEventListener("keydown", closeDocsMenuOnEscape);
    nodes.help?.addEventListener("click", toggleHelp);
    nodes.logoff?.addEventListener("click", handleLogonAction);
    initHoverHelp();
    setHelpEnabled(true);
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

    loadStartupModule().catch((error) => showError(error.message));
  }

  async function loadStartupModule() {
    const switchValue = params.get("_switch");
    if (switchValue) {
      await refreshSessionState();
      if (!state.session.logon) {
        state.pendingSwitch = switchValue;
        openLoginDialog({ mandatory: true });
        return;
      }
      await attachSwitchValue(switchValue);
      return;
    }
    const requested = params.get("module");
    if (requested) {
      await loadModule(requested);
      return;
    }
    showStartupShell();
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
    const contextToken = state.activeJob?.contextToken || runtimeOutputToken();
    if (!runtimeOutputContextMatches(contextToken)) {
      return;
    }
    state.submitResponse = Object.assign({}, state.submitResponse || {}, payload);
    showLegacyMessagePayload(payload);
    applyRuntimePayload(payload, contextToken);
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
      updateSessionIdentity(payload);
      state.session.groups = payload._groups || {};
      state.session.usergroups = Array.isArray(payload._usergroups) ? payload._usergroups : [];
      state.session.theme = stringValue(payload._theme);
      state.session.aiHelper = normalizeAiHelperStatus(payload._aihelper);
      state.session.loaded = true;
      showLegacyMessagePayload(payload);
      await refreshRestrictedState();
      renderMenu();
      renderSessionState();
      renderAiHelperAvailability();
      syncSplashForSession();
      return payload;
    } catch (error) {
      state.session.loaded = false;
      state.session.restricted = [];
      state.session.aiHelper = normalizeAiHelperStatus(null);
      renderMenu();
      renderSessionState(error);
      renderAiHelperAvailability();
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

  function sessionProjectName() {
    return stringValue(state.session.project).trim() || "no_project_specified";
  }

  function renderSessionState(error) {
    const project = sessionProjectName();
    if (nodes.sessionStatus) {
      nodes.sessionStatus.textContent = `Project ${project}`;
      nodes.sessionStatus.title = state.session.logon
        ? `Logged on as ${state.session.logon}`
        : (error ? `Session status unavailable: ${error.message}` : "Not logged on");
    }
    if (nodes.logoff) {
      nodes.logoff.textContent = state.session.logon ? `Logoff ${state.session.logon}` : "Login";
      nodes.logoff.dataset.mode = state.session.logon ? "logoff" : "login";
    }
  }

  function normalizeAiHelperStatus(value) {
    const status = value && typeof value === "object" ? value : {};
    const preference = normalizeAiHelperPreference(status.user_preference);
    const endpointState = normalizeAiHelperEndpointState(status.endpoint_state);
    const available = status.available === true || String(status.available || "").toLowerCase() === "true" || String(status.available || "") === "1";
    const configured = status.configured === true || String(status.configured || "").toLowerCase() === "true" || String(status.configured || "") === "1";
    const enabledForUser = available && preference !== "off";
    return {
      available,
      configured,
      endpoint_state: endpointState,
      user_preference: preference,
      enabled_for_user: enabledForUser
    };
  }

  function normalizeAiHelperEndpointState(value) {
    const normalized = stringValue(value).trim().toLowerCase();
    return AI_HELPER_ENDPOINT_STATES.has(normalized) ? normalized : "unavailable";
  }

  function normalizeAiHelperPreference(value) {
    const normalized = stringValue(value).trim().toLowerCase();
    return AI_HELPER_PREFERENCE_VALUES.has(normalized) ? normalized : "default";
  }

  function renderAiHelperAvailability() {
    if (!nodes.aiHelper) {
      return;
    }
    nodes.aiHelper.hidden = !aiHelperEnabledForUser();
  }

  function aiHelperEnabledForUser() {
    return state.session.aiHelper?.enabled_for_user === true;
  }

  function syncSplashForSession() {
    if (state.session.logon) {
      hideSplashDialog();
      return;
    }
    openSplashDialog();
  }

  function updateSessionIdentity(payload) {
    const previousKey = serverFileSessionKey();
    state.session.logon = stringValue(payload?._logon);
    state.session.project = stringValue(payload?._project);
    const nextKey = serverFileSessionKey();
    if (previousKey !== nextKey) {
      clearRememberedServerFileDir();
    }
  }

  function serverFileSessionKey() {
    return `${state.session.logon || ""}:${state.session.project || ""}`;
  }

  function clearRememberedServerFileDir() {
    state.lastServerFileDir = "";
    state.lastServerFileSessionKey = serverFileSessionKey();
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
    if (state.pendingSwitch) {
      formData.set("_switch", state.pendingSwitch);
    }
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
      updateSessionIdentity(payload);
      state.session.usergroups = Array.isArray(payload._usergroups) ? payload._usergroups : [];
      state.session.loaded = true;
      renderSessionState();
      setSubmitStatus(status, payload.status || "Login successful", "ok");
      if (state.session.logon) {
        document.getElementById("ui2-login-dialog").hidden = true;
        hideSplashDialog();
        await refreshSessionState();
        const switchValue = stringValue(payload._switch || state.pendingSwitch);
        if (switchValue) {
          state.pendingSwitch = "";
          await attachSwitchValue(switchValue);
          return;
        }
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
      updateSessionIdentity(payload);
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
    beginRuntimeOutputContext(moduleId);

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
      state.serverSelections = {};
      clearFileReselectionWarnings();
      setSubmittedRunContext(null);
      state.jobEvents.reset("", moduleId);
      await loadTestScenarios(moduleId);
      beginViewReady();
      renderModule();
      await waitForViewReady();
      updateSelectedNavigation();
      syncDocsLink();
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

  async function loadTestScenarios(moduleId) {
    clearTestScenarios(false);
    if (!moduleId || !state.session.logon) {
      return;
    }
    updateTestScenarioState({ loading: true });
    try {
      const url = new URL(legacyEndpoint("", TEST_SCENARIO_ENDPOINT), window.location.href);
      url.searchParams.set("module", moduleId);
      url.searchParams.set("_window", window.name);
      url.searchParams.set("_logon", state.session.logon);
      const response = await fetch(url.toString(), { cache: "no-cache", credentials: "same-origin" });
      if (!response.ok) {
        return;
      }
      const payload = await parseJsonResponse(response, "Test scenarios");
      if (payload?.available && validTestScenarioCatalog(payload.catalog, moduleId)) {
        updateTestScenarioState({
          available: true,
          catalog: cloneUi2Value(payload.catalog)
        });
      }
    } catch (error) {
      // This is a privileged optional facility.  Ordinary UI2 use must remain
      // quiet if an application has no catalog endpoint or no administrator.
    } finally {
      updateTestScenarioState({ loading: false });
    }
  }

  function initialTestScenarioState() {
    return {
      available: false,
      loading: false,
      catalog: null,
      selectedId: "",
      verification: { state: "not_run", checks: [] }
    };
  }

  function updateTestScenarioState(patch) {
    state.testScenarios = Object.assign({}, state.testScenarios, patch);
    notifyTestScenarios();
  }

  function clearTestScenarios(notify = true) {
    state.testScenarios = initialTestScenarioState();
    if (notify) {
      notifyTestScenarios();
    }
  }

  function validTestScenarioCatalog(catalog, moduleId) {
    if (!catalog || Number(catalog.schema_version) !== 1 || catalog.module_id !== moduleId || !Array.isArray(catalog.scenarios)) {
      return false;
    }
    const ids = new Set();
    return catalog.scenarios.every((scenario) => {
      if (!scenario || !/^[A-Za-z0-9_-]+$/.test(String(scenario.id || "")) || ids.has(scenario.id) ||
          typeof scenario.label !== "string" || !scenario.inputs || typeof scenario.inputs !== "object" || Array.isArray(scenario.inputs) || !Object.keys(scenario.inputs).length) {
        return false;
      }
      ids.add(scenario.id);
      const verification = scenario.verification;
      return !verification || (Number(verification.schema_version) === 1 && Array.isArray(verification.checks) &&
        verification.checks.every((check) => check && /^[A-Za-z0-9_-]+$/.test(String(check.id || "")) &&
          TEST_SCENARIO_CHECK_KINDS.has(check.kind)));
    });
  }

  function testScenarioSnapshot() {
    // useSyncExternalStore compares snapshots by identity.  This reference
    // changes only through updateTestScenarioState()/clearTestScenarios().
    return state.testScenarios;
  }

  function notifyTestScenarios() {
    state.testScenarioListeners.forEach((listener) => {
      try { listener(); } catch (error) { window.setTimeout(() => { throw error; }, 0); }
    });
  }

  function subscribeTestScenarios(listener) {
    if (typeof listener !== "function") return () => {};
    state.testScenarioListeners.add(listener);
    return () => state.testScenarioListeners.delete(listener);
  }

  function selectedTestScenario() {
    return state.testScenarios.catalog?.scenarios?.find((scenario) => scenario.id === state.testScenarios.selectedId) || null;
  }

  function selectTestScenarioForInputs(inputs) {
    if (!inputs || typeof inputs !== "object" || !state.testScenarios.catalog?.scenarios?.length) return;
    const scenario = state.testScenarios.catalog.scenarios.find((candidate) => Object.entries(candidate.inputs || {}).every(
      ([id, value]) => Object.prototype.hasOwnProperty.call(inputs, id) && JSON.stringify(inputs[id]) === JSON.stringify(value)
    ));
    if (!scenario) return;
    updateTestScenarioState({
      selectedId: scenario.id,
      verification: { state: "not_run", checks: [] }
    });
  }

  function applyTestScenario(id, form = document.getElementById("ui2-form")) {
    const scenario = state.testScenarios.catalog?.scenarios?.find((item) => item.id === id);
    if (!scenario || !form) return { ok: false, error: "Scenario is unavailable." };
    syncValues(form);
    const defaults = defaultInputPayload();
    const dirty = Object.keys(state.values).some((key) => JSON.stringify(state.values[key]) !== JSON.stringify(defaults[key]));
    if (dirty && typeof window.confirm === "function" && !window.confirm("Replace the current module inputs with this test scenario?")) {
      return { ok: false, error: "Scenario load cancelled." };
    }
    applyInputPayload(scenario.inputs, { clearMissing: false });
    syncValues(form);
    updateTestScenarioState({
      selectedId: scenario.id,
      verification: { state: "not_run", checks: [] }
    });
    return { ok: true, values: cloneUi2Value(state.values) };
  }

  function renderTestScenarioPanel() {
    if (!state.testScenarios.available || !state.testScenarios.catalog?.scenarios?.length) return el("div", "ui2-test-scenarios-empty");
    const panel = el("section", "ui2-test-scenarios");
    panel.appendChild(el("h3", null, "Test scenario"));
    const select = document.createElement("select");
    select.dataset.testScenario = "true";
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Select a documented or test case";
    select.appendChild(placeholder);
    state.testScenarios.catalog.scenarios.forEach((scenario) => {
      const option = document.createElement("option");
      option.value = scenario.id;
      option.textContent = scenario.label;
      option.selected = scenario.id === state.testScenarios.selectedId;
      select.appendChild(option);
    });
    const load = el("button", "ui2-button", "Load scenario");
    load.type = "button";
    load.addEventListener("click", () => applyTestScenario(select.value));
    const detail = el("p", "ui2-help", "Loads inputs only; review them before running.");
    panel.append(select, load, detail);
    return panel;
  }

  function testScenarioOutputNonempty(value) {
    if (value == null || value === "") return false;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === "object" && Array.isArray(value.items)) return value.items.length > 0;
    return true;
  }

  function evaluateTestScenarioVerification(scenario, jobStatus, outputs) {
    const checks = scenario?.verification?.checks;
    if (!scenario?.verification) return { state: "not_run", checks: [] };
    if (!Array.isArray(checks) || Number(scenario.verification.schema_version) !== 1) return { state: "unsupported", checks: [] };
    if (!isTerminalStatus(jobStatus)) return { state: "running", checks: [] };
    const results = checks.map((check) => {
      if (!TEST_SCENARIO_CHECK_KINDS.has(check.kind)) return { id: check.id, passed: false, unsupported: true };
      if (check.kind === "job_status") return { id: check.id, passed: String(jobStatus) === String(check.equals) };
      const present = Object.prototype.hasOwnProperty.call(outputs || {}, check.output_id);
      return { id: check.id, passed: check.kind === "output_present" ? present : present && testScenarioOutputNonempty(outputs[check.output_id]) };
    });
    return { state: results.every((result) => result.passed) ? "passed" : "failed", checks: results };
  }

  function refreshTestScenarioVerification(jobStatus) {
    const scenario = selectedTestScenario();
    if (!scenario) return;
    updateTestScenarioState({
      verification: evaluateTestScenarioVerification(scenario, jobStatus, state.runtimeOutputs)
    });
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

  function openAiHelperPanel() {
    const content = renderAiHelperPanel();
    showUtilityOverlay("AI Helper", content, { dialogClass: "ui2-ai-helper-dialog" });
  }

  function renderAiHelperPanel() {
    const section = el("section", "ui2-section ui2-system-tool ui2-ai-helper");
    const body = el("div", "ui2-section-body ui2-tool-body");
    const context = buildAiHelperContext("");

    const contextSummary = renderAiHelperContextSummary(context);
    body.appendChild(contextSummary);

    if (!state.session.aiHelper?.configured) {
      body.appendChild(el("p", "ui2-help ui2-ai-helper-unconfigured", "AI Helper is not configured for this deployment."));
      section.appendChild(body);
      return section;
    }
    loadAiHelperMetadata(contextSummary);

    const form = el("form", "ui2-ai-helper-form");
    form.noValidate = true;
    const questionRow = el("label", "ui2-ai-helper-question");
    questionRow.appendChild(el("span", "ui2-field-label", "Question"));
    const question = el("textarea", "ui2-textarea");
    question.required = true;
    question.rows = 4;
    question.placeholder = "What should I do next?";
    question.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey && !event.isComposing) {
        event.preventDefault();
        if (typeof form.requestSubmit === "function") {
          form.requestSubmit(submit);
        } else {
          submit.click();
        }
      }
    });
    questionRow.appendChild(question);
    const actions = el("div", "ui2-form-actions");
    const submit = el("button", "ui2-button ui2-button-primary", "Ask AI Helper");
    submit.type = "submit";
    const status = el("div", "ui2-submit-status", "");
    status.setAttribute("role", "status");
    actions.append(submit, status);
    const usage = el("div", "ui2-ai-helper-usage", "");
    usage.setAttribute("aria-live", "polite");
    const response = el("div", "ui2-ai-helper-response");
    response.setAttribute("aria-live", "polite");
    form.appendChild(questionRow);
    if (devMode) {
      form.appendChild(renderAiHelperPayloadPreview(question));
    }
    form.append(actions, usage, response);
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const userQuestion = question.value.trim();
      if (!userQuestion) {
        setSubmitStatus(status, "Enter a question.", "error");
        question.focus();
        return;
      }
      submit.disabled = true;
      response.textContent = "";
      usage.textContent = "";
      setSubmitStatus(status, "Asking AI Helper", "pending");
      const waitStatus = startAiHelperWaitStatus(status);
      try {
        const payload = await submitAiHelperQuestion(buildAiHelperContext(userQuestion));
        response.innerHTML = aiHelperResponseHtml(aiHelperResponseMessage(payload));
        aiHelperTypesetMath(response);
        usage.textContent = aiHelperUsageSummary(payload);
        updateAiHelperMetadata(contextSummary, payload);
        setSubmitStatus(status, "Response received", "ok");
      } catch (error) {
        setSubmitStatus(status, error.message, "error");
      } finally {
        waitStatus.stop();
        submit.disabled = false;
      }
    });
    body.appendChild(form);
    section.appendChild(body);
    window.setTimeout(() => question.focus(), 0);
    return section;
  }

  function startAiHelperWaitStatus(status) {
    const started = Date.now();
    const interval = window.setInterval(() => {
      const elapsed = Math.max(1, Math.round((Date.now() - started) / 1000));
      if (elapsed < 10) {
        return;
      }
      const detail = elapsed >= 45
        ? "Still waiting on the AI provider. Large-context answers can take up to about 2 minutes."
        : "Still waiting on the AI provider.";
      setSubmitStatus(status, `${detail} ${elapsed}s elapsed.`, "pending");
    }, 1000);
    return {
      stop() {
        window.clearInterval(interval);
      }
    };
  }

  function renderAiHelperContextSummary(context) {
    const wrap = el("div", "ui2-ai-helper-context");
    const list = el("dl", "ui2-ai-helper-context-list");
    [
      ["Application", context.application || ""],
      ["Module", context.module || "No module loaded"],
      ["Page", context.page || ""],
      ["Run status", context.run_context?.status || "idle"]
    ].forEach(([label, value]) => {
      list.append(el("dt", null, label), el("dd", null, value || "-"));
    });
    const formFieldCount = Object.keys(context.form_values || {}).length;
    const outputAnalysis = context.output_analysis || aiHelperOutputAnalysis();
    const outputLabel = outputAnalysis.available
      ? `${outputAnalysis.included_count || 0} output summaries available${outputAnalysis.omitted_count ? `; ${outputAnalysis.omitted_count} omitted` : ""}`
      : "No output results available yet";
    list.append(
      el("dt", null, "Form context"),
      el("dd", null, formFieldCount ? `${formFieldCount} fields included` : "No form fields available"),
      el("dt", null, "Output context"),
      el("dd", null, outputLabel),
      el("dt", null, "AI context"),
      el("dd", "ui2-ai-helper-context-revision", "Checking context revision...")
    );
    wrap.appendChild(list);
    return wrap;
  }

  function renderAiHelperPayloadPreview(question) {
    const wrap = el("div", "ui2-ai-helper-payload-preview");
    wrap.appendChild(el("span", "ui2-field-label", "AI Helper request payload"));
    const preview = el("pre", "ui2-ai-helper-values");
    wrap.appendChild(preview);
    const update = () => {
      preview.textContent = JSON.stringify(buildAiHelperContext(question.value), null, 2);
    };
    question.addEventListener("input", update);
    update();
    return wrap;
  }

  async function submitAiHelperQuestion(requestPayload) {
    const response = await fetch("ajax/ui2_ai_helper.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestPayload),
      credentials: "same-origin"
    });
    const payload = await parseJsonResponse(response, "AI Helper");
    if (!response.ok || payload.error) {
      throw new Error(payload.error || `AI Helper returned HTTP ${response.status}`);
    }
    return payload;
  }

  async function loadAiHelperMetadata(contextSummary) {
    const target = contextSummary?.querySelector(".ui2-ai-helper-context-revision");
    if (!target) {
      return;
    }
    try {
      const response = await fetch("ajax/ui2_ai_helper.php?metadata=1", {
        method: "GET",
        credentials: "same-origin"
      });
      const payload = await parseJsonResponse(response, "AI Helper metadata");
      if (!response.ok || payload.error) {
        throw new Error(payload.error || `AI Helper metadata returned HTTP ${response.status}`);
      }
      updateAiHelperMetadata(contextSummary, payload);
    } catch (error) {
      target.textContent = "Unavailable";
      target.title = error.message;
    }
  }

  function updateAiHelperMetadata(contextSummary, payload) {
    const target = contextSummary?.querySelector(".ui2-ai-helper-context-revision");
    if (!target) {
      return;
    }
    const context = payload?.ai_context && typeof payload.ai_context === "object" ? payload.ai_context : payload;
    target.textContent = aiHelperContextRevisionSummary(context);
  }

  function aiHelperContextRevisionSummary(context) {
    if (!context || typeof context !== "object") {
      return "Not reported by backend";
    }
    if (context.loaded === false) {
      return "Not loaded";
    }
    const parts = [];
    const revision = stringValue(context.revision);
    if (revision) {
      parts.push(`rev ${revision}`);
    }
    const words = aiHelperNumberOrNull(context.words);
    if (words != null) {
      parts.push(`${words.toLocaleString()} words`);
    }
    const chars = aiHelperNumberOrNull(context.chars);
    if (chars != null) {
      parts.push(aiHelperFormatBytes(chars));
    }
    const mtime = aiHelperNumberOrNull(context.mtime);
    if (mtime != null) {
      const date = new Date(mtime * 1000);
      if (!Number.isNaN(date.getTime())) {
        parts.push(`updated ${date.toLocaleString()}`);
      }
    }
    return parts.length ? parts.join("; ") : "Loaded; revision unavailable";
  }

  function buildAiHelperContext(userQuestion) {
    syncValues();
    const runtime = state.jobEvents.snapshot();
    const moduleId = state.moduleId || runtime.module || "";
    return {
      application: aiHelperApplicationId() || null,
      module: moduleId || null,
      page: state.moduleId || state.activeMenuId || null,
      form_values: sanitizeAiHelperFormValues(state.values),
      run_context: aiHelperRunContext(runtime),
      output_analysis: aiHelperOutputAnalysis(),
      user_question: stringValue(userQuestion)
    };
  }

  function aiHelperApplicationId() {
    return stringValue(appMap.directives?.application)
      || stringValue(document.querySelector(".ui2-shell")?.dataset.appId)
      || stringValue(document.querySelector(".ui2-topbar h1")?.textContent);
  }

  function sanitizeAiHelperFormValues(values) {
    const sanitized = {};
    Object.entries(values || {}).forEach(([key, value]) => {
      if (!key || key.startsWith("_") || AI_HELPER_SENSITIVE_FIELD_RE.test(key)) {
        return;
      }
      sanitized[key] = cloneUi2Value(value);
    });
    return sanitized;
  }

  function aiHelperRunContext(runtime) {
    const lifecycle = runtime?.lifecycle || {};
    const activeStatus = stringValue(state.activeJob?.status || lifecycle.state || lifecycle.status);
    const lastLog = runtimeLastLogMessage(runtime);
    const lastStatusMessage = stringValue(lifecycle.error || lifecycle.message || lastLog);
    return {
      status: activeStatus || (state.activeJob?.uuid || runtime?.run ? "running" : "idle"),
      last_status_message: lastStatusMessage || null
    };
  }

  function runtimeLastLogMessage(runtime) {
    const log = runtime?.channels?.log?.run;
    const value = stringValue(log?.value).trim();
    if (value) {
      return value.split(/\r?\n/).filter(Boolean).slice(-1)[0] || "";
    }
    const items = Array.isArray(log?.items) ? log.items : [];
    return stringValue(items[items.length - 1]).trim();
  }

  function aiHelperOutputAnalysis() {
    const outputEntries = Object.entries(state.runtimeOutputs || {})
      .filter(([id]) => id && !id.startsWith("_") && !AI_HELPER_SENSITIVE_FIELD_RE.test(id));
    const fields = outputEntries.slice(0, AI_HELPER_OUTPUT_MAX_FIELDS)
      .map(([id, value]) => aiHelperOutputSummary(id, value));
    return {
      available: outputEntries.length > 0,
      output_count: outputEntries.length,
      included_count: fields.length,
      omitted_count: Math.max(0, outputEntries.length - fields.length),
      fields
    };
  }

  function aiHelperOutputSummary(id, value) {
    const field = moduleFieldById(id) || {};
    const summary = aiHelperSummarizeOutputValue(value, field);
    return {
      id,
      label: stringValue(field.label || id) || null,
      type: stringValue(field.type) || null,
      summary: summary.text,
      truncated: summary.truncated
    };
  }

  function aiHelperSummarizeOutputValue(value, field = {}) {
    let text = "";
    const fieldType = stringValue(field.type);
    if (Array.isArray(value) && /file/i.test(fieldType)) {
      const files = normalizeFileList(value).map(aiHelperFileBasename).filter(Boolean);
      text = files.length ? `Files: ${files.slice(0, 8).join(", ")}${files.length > 8 ? ", ..." : ""}` : "";
    } else if (value && typeof value === "object") {
      text = JSON.stringify(value);
    } else {
      text = stringValue(value);
    }
    if (/html/i.test(fieldType)) {
      text = stripHtml(text);
    }
    text = aiHelperRedactPathsFromText(text);
    text = text.replace(/\s+/g, " ").trim();
    const truncated = text.length > AI_HELPER_OUTPUT_MAX_CHARS;
    return {
      text: truncated ? `${text.slice(0, AI_HELPER_OUTPUT_MAX_CHARS).trim()}...` : text,
      truncated
    };
  }

  function aiHelperFileBasename(value) {
    return stringValue(value).split(/[\\/]/).filter(Boolean).pop() || "";
  }

  function aiHelperRedactPathsFromText(value) {
    return stringValue(value).replace(/(^|[\s"'(:\[])(\/[^\s"',)\]}<>]+)+/g, (match, prefix) => {
      const path = match.slice(prefix.length);
      if (/^\/\//.test(path)) {
        return match;
      }
      const basename = aiHelperFileBasename(path);
      return `${prefix}${basename ? `[path:${basename}]` : "[path]"}`;
    });
  }

  function aiHelperResponseMessage(payload) {
    if (payload == null) {
      return "";
    }
    if (typeof payload === "string") {
      return payload;
    }
    return stringValue(payload.message || payload.response || payload.text || "");
  }

  function aiHelperResponseHtml(message) {
    const text = stringValue(message).trim();
    if (!text) {
      return "";
    }
    const lines = text.replace(/\r\n?/g, "\n").split("\n");
    const html = [];
    let paragraph = [];
    let listType = "";
    let listItems = [];

    function flushParagraph() {
      if (paragraph.length) {
        html.push(`<p>${aiHelperInlineMarkdown(paragraph.join(" "))}</p>`);
        paragraph = [];
      }
    }

    function flushList() {
      if (listType && listItems.length) {
        html.push(`<${listType}>${listItems.map((item) => `<li>${aiHelperInlineMarkdown(item)}</li>`).join("")}</${listType}>`);
      }
      listType = "";
      listItems = [];
    }

    lines.forEach((line) => {
      const trimmed = line.trim();
      const displayMath = aiHelperDisplayMathLine(trimmed);
      const heading = /^(#{1,3})\s+(.+)$/.exec(trimmed);
      const ordered = /^\d+[.)]\s+(.+)$/.exec(trimmed);
      const unordered = /^[-*]\s+(.+)$/.exec(trimmed);
      if (!trimmed) {
        flushParagraph();
        flushList();
      } else if (displayMath) {
        flushParagraph();
        flushList();
        html.push(aiHelperMathPlaceholder(displayMath, true));
      } else if (heading) {
        flushParagraph();
        flushList();
        const level = String(heading[1]).length + 2;
        html.push(`<h${level}>${aiHelperInlineMarkdown(heading[2])}</h${level}>`);
      } else if (ordered || unordered) {
        flushParagraph();
        const nextListType = ordered ? "ol" : "ul";
        if (listType && listType !== nextListType) {
          flushList();
        }
        listType = nextListType;
        listItems.push((ordered || unordered)[1]);
      } else {
        flushList();
        paragraph.push(trimmed);
      }
    });
    flushParagraph();
    flushList();
    return html.join("");
  }

  function aiHelperDisplayMathLine(value) {
    const trimmed = stringValue(value).trim();
    let match = /^\$\$([\s\S]+)\$\$$/.exec(trimmed);
    if (match && match[1].trim()) {
      return match[1].trim();
    }
    match = /^\\{1,2}\[([\s\S]+)\\{1,2}\]$/.exec(trimmed);
    return match && match[1].trim() ? match[1].trim() : "";
  }

  function aiHelperInlineMarkdown(value) {
    const math = [];
    const tokenized = String(value)
      .replace(/\$\$([\s\S]*?)\$\$|\\{1,2}\[([\s\S]*?)\\{1,2}\]/g, (match, dollarDisplayTex, bracketDisplayTex) => {
        const tex = stringValue(dollarDisplayTex != null ? dollarDisplayTex : bracketDisplayTex).trim();
        return aiHelperMathToken(math, match, tex, true);
      })
      .replace(/\\{1,2}\(([\s\S]*?)\\{1,2}\)|\$([^$\n]+)\$/g, (match, parenTex, dollarTex) => {
        const tex = stringValue(parenTex != null ? parenTex : dollarTex).trim();
        return aiHelperMathToken(math, match, tex, false);
      });
    let html = escapeHtml(tokenized)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\b_([^_]+)_\b/g, "<em>$1</em>");
    math.forEach(([token, rendered]) => {
      html = html.replace(new RegExp(token, "g"), rendered);
    });
    return html;
  }

  function aiHelperMathToken(math, fallback, tex, displayMode) {
    if (!tex) {
      return fallback;
    }
    const token = `@@AI_HELPER_MATH_${math.length}@@`;
    math.push([token, aiHelperMathPlaceholder(tex, displayMode)]);
    return token;
  }

  function aiHelperMathPlaceholder(tex, displayMode) {
    const marker = displayMode ? `$$${tex}$$` : `$${tex}$`;
    return `<span class="ui2-ai-helper-math" data-display="${displayMode ? "true" : "false"}" data-tex="${escapeHtml(tex)}">${escapeHtml(marker)}</span>`;
  }

  function aiHelperTypesetMath(container) {
    const nodes = Array.from(container.querySelectorAll(".ui2-ai-helper-math"));
    if (!nodes.length) {
      return;
    }
    ensureAiHelperKatexLoaded()
      .then((katex) => {
        nodes.forEach((node) => {
          const tex = node.getAttribute("data-tex") || "";
          const displayMode = node.getAttribute("data-display") === "true";
          try {
            katex.render(tex, node, { displayMode, throwOnError: false, strict: "ignore" });
            node.classList.add("ui2-ai-helper-math-rendered");
          } catch (error) {
            node.classList.add("ui2-ai-helper-math-error");
          }
        });
      })
      .catch(() => {
        nodes.forEach((node) => node.classList.add("ui2-ai-helper-math-unavailable"));
      });
  }

  function ensureAiHelperKatexLoaded() {
    if (window.katex?.render) {
      ensureAiHelperKatexCss();
      return Promise.resolve(window.katex);
    }
    if (katexLoadPromise) {
      return katexLoadPromise;
    }
    ensureAiHelperKatexCss();
    katexLoadPromise = loadScript(AI_HELPER_KATEX_SCRIPT_URL)
      .then(() => {
        if (!window.katex?.render) {
          throw new Error("KaTeX did not initialize");
        }
        return window.katex;
      });
    return katexLoadPromise;
  }

  function ensureAiHelperKatexCss() {
    if (document.querySelector(`link[href="${AI_HELPER_KATEX_CSS_URL}"]`)) {
      return;
    }
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = AI_HELPER_KATEX_CSS_URL;
    document.head.appendChild(link);
  }

  function aiHelperUsageSummary(payload) {
    const usage = normalizeAiHelperUsage(payload);
    if (!usage.has_usage && !usage.has_remaining && !usage.has_cumulative && !usage.has_cost) {
      return "Token usage: not reported by backend.";
    }
    const parts = [];
    if (usage.total_tokens != null) {
      parts.push(`${usage.total_tokens} tokens used`);
    } else if (usage.input_tokens != null || usage.output_tokens != null) {
      parts.push(`${usage.input_tokens ?? "?"} in / ${usage.output_tokens ?? "?"} out`);
    }
    if (usage.remaining_tokens != null) {
      parts.push(`${usage.remaining_tokens} remaining`);
    } else {
      parts.push("remaining unavailable");
    }
    if (usage.cumulative_tokens != null) {
      parts.push(`${usage.cumulative_tokens} cumulative`);
    }
    if (usage.cache_state) {
      parts.push(`cache ${usage.cache_state}`);
    }
    if (usage.cached_input_tokens != null) {
      parts.push(`${usage.cached_input_tokens} cached`);
    }
    if (usage.estimated_cost_usd != null) {
      parts.push(`${aiHelperFormatUsd(usage.estimated_cost_usd)} estimated`);
    }
    if (usage.cumulative_cost_usd != null) {
      parts.push(`${aiHelperFormatUsd(usage.cumulative_cost_usd)} cumulative cost`);
    }
    return `Token usage: ${parts.join("; ")}.`;
  }

  function normalizeAiHelperUsage(payload) {
    const usage = payload?.usage && typeof payload.usage === "object" ? payload.usage : {};
    const metadata = payload?.usageMetadata && typeof payload.usageMetadata === "object" ? payload.usageMetadata : {};
    const inputTokens = aiHelperNumberOrNull(
      usage.input_tokens ?? usage.prompt_tokens ?? usage.promptTokenCount ?? metadata.promptTokenCount
    );
    const outputTokens = aiHelperNumberOrNull(
      usage.output_tokens ?? usage.completion_tokens ?? usage.candidatesTokenCount ?? metadata.candidatesTokenCount
    );
    const totalTokens = aiHelperNumberOrNull(
      usage.total_tokens ?? usage.totalTokenCount ?? metadata.totalTokenCount
    );
    const remainingTokens = aiHelperNumberOrNull(
      usage.remaining_tokens ?? usage.account_remaining_tokens ?? usage.accountRemainingTokens ?? payload?.account_remaining_tokens
    );
    const cumulativeTokens = aiHelperNumberOrNull(
      usage.cumulative_tokens ?? usage.account_cumulative_tokens ?? usage.accountCumulativeTokens ?? payload?.account_cumulative_tokens
    );
    const estimatedCostUsd = aiHelperNumberOrNull(
      usage.estimated_cost_usd ?? usage.estimatedCostUsd ?? payload?.estimated_cost_usd
    );
    const cumulativeCostUsd = aiHelperNumberOrNull(
      usage.cumulative_cost_usd ?? usage.account_cumulative_cost_usd ?? usage.accountCumulativeCostUsd ?? payload?.account_cumulative_cost_usd
    );
    const cachedInputTokens = aiHelperNumberOrNull(
      usage.cached_input_tokens ?? usage.cached_tokens ?? usage.cachedTokens ?? usage.prompt_tokens_details?.cached_tokens
    );
    return {
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      total_tokens: totalTokens,
      remaining_tokens: remainingTokens,
      cumulative_tokens: cumulativeTokens,
      cached_input_tokens: cachedInputTokens,
      cache_state: aiHelperCacheState(inputTokens, cachedInputTokens),
      estimated_cost_usd: estimatedCostUsd,
      cumulative_cost_usd: cumulativeCostUsd,
      has_usage: inputTokens != null || outputTokens != null || totalTokens != null,
      has_remaining: remainingTokens != null,
      has_cumulative: cumulativeTokens != null,
      has_cost: estimatedCostUsd != null || cumulativeCostUsd != null
    };
  }

  function aiHelperCacheState(inputTokens, cachedInputTokens) {
    if (cachedInputTokens != null && cachedInputTokens > 0) {
      return "warm";
    }
    if (inputTokens != null && inputTokens >= 50000) {
      return "cold";
    }
    return "";
  }

  function aiHelperFormatUsd(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return "$0.000000";
    }
    if (numeric > 0 && numeric < 0.000001) {
      return "<$0.000001";
    }
    return `$${numeric.toFixed(numeric < 0.01 ? 6 : 4)}`;
  }

  function aiHelperFormatBytes(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0) {
      return "0 B";
    }
    if (numeric < 1024) {
      return `${Math.round(numeric)} B`;
    }
    if (numeric < 1024 * 1024) {
      return `${(numeric / 1024).toFixed(1)} KB`;
    }
    return `${(numeric / (1024 * 1024)).toFixed(2)} MB`;
  }

  function aiHelperNumberOrNull(value) {
    if (value === "" || value == null) {
      return null;
    }
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
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

  function normalizeUi2Theme(value) {
    const theme = String(value || "").trim().toLowerCase();
    return UI2_THEME_VALUES.has(theme) ? theme : UI2_DEFAULT_THEME;
  }

  function applyUi2Theme(value) {
    activeUi2Theme = normalizeUi2Theme(value);
    const root = document.documentElement;
    if (root?.dataset) {
      root.dataset.ui2Theme = activeUi2Theme;
    } else if (root && typeof root.setAttribute === "function") {
      root.setAttribute("data-ui2-theme", activeUi2Theme);
    }
    return activeUi2Theme;
  }

  function setUi2ThemePreference(value, persist) {
    const theme = applyUi2Theme(value);
    if (persist) {
      savePreference("ui2Theme", theme);
    }
    return theme;
  }

  function currentUi2Theme() {
    return activeUi2Theme;
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
    setSubmittedRunContext(null);
    beginRuntimeOutputContext("");
    state.jobEvents.reset();
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
    syncDocsLink();
  }

  function renderModule() {
    const module = state.module || {};
    const fields = visibleFields(Array.isArray(module.fields) ? module.fields : []);
    const inputFields = fields.filter((field) => field.role !== "output");
    const outputFields = fields.filter((field) => field.role === "output");

    unmountReactWorkbench();
    nodes.empty.hidden = true;
    nodes.root.hidden = false;
    nodes.root.innerHTML = "";

    if (isReactWorkbenchView(state.view) && renderReactWorkbench(module, fields)) {
      return;
    }

    const container = el("div", "ui2-module");
    const systemTool = renderSystemTool(module, fields);
    if (systemTool) {
      container.appendChild(renderToolHeader(module));
      container.appendChild(systemTool);
      nodes.root.appendChild(container);
      syncValues();
      markViewReady();
      return;
    }

    container.appendChild(renderHeader(module, fields));
    container.appendChild(renderTabs(inputFields.length, outputFields.length));

    const form = el("form");
    form.id = "ui2-form";
    form.appendChild(renderSection("Inputs", inputFields, "input"));
    form.appendChild(renderTestScenarioPanel());
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
    form.addEventListener("reset", (event) => {
      event.preventDefault();
      stopJobPolling();
      resetModuleForm(form);
    });
    form.addEventListener("input", syncValues);
    form.addEventListener("change", syncValues);

    container.appendChild(form);
    nodes.root.appendChild(container);
    syncValues();
    markViewReady();
  }

  // Module definition and job state belong to UI2 core.  A renderer may mount
  // asynchronously, so core must not begin reattachment until its field and
  // output hosts exist.  Plain UI2 rendering resolves this synchronously;
  // React views call the bridge once their layout effects have mounted hosts.
  function beginViewReady() {
    const generation = ++state.viewReadyGeneration;
    let resolve;
    const promise = new Promise((done) => { resolve = done; });
    state.viewReady = { generation, promise, resolve, resolved: false };
    return state.viewReady;
  }

  function markViewReady(generation = state.viewReadyGeneration) {
    const ready = state.viewReady;
    if (!ready || ready.generation !== generation || ready.resolved) {
      return;
    }
    ready.resolved = true;
    ready.resolve();
  }

  async function waitForViewReady() {
    const ready = state.viewReady;
    if (!ready || ready.resolved) {
      return;
    }
    let timeout;
    try {
      await Promise.race([
        ready.promise,
        new Promise((_, reject) => {
          timeout = window.setTimeout(
            () => reject(new Error("Timed out waiting for the UI2 view to mount.")), 30000);
        })
      ]);
    } finally {
      if (timeout != null) {
        window.clearTimeout(timeout);
      }
    }
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
    unmountReactWorkbench();
    state.moduleId = "";
    state.menuId = "";
    state.module = null;
    state.view = {};
    state.values = {};
    state.submitResponse = null;
    clearTestScenarios();
    setSubmittedRunContext(null);
    beginRuntimeOutputContext("");
    state.activeJob = null;
    state.jobEvents.reset();
    nodes.root.hidden = true;
    nodes.root.innerHTML = "";
    nodes.empty.hidden = true;
    nodes.empty.innerHTML = "";
    syncDocsLink();
  }

  function renderReactWorkbench(module, fields) {
    if (!window.GenAppUi2Workbench?.mount) {
      return false;
    }
    const root = el("div", "ui2-workbench-react-root");
    reactWorkbenchRoot = root;
    nodes.root.appendChild(root);
    const stage = nodes.root.closest(".ui2-stage");
    if (stage) {
      stage.scrollTop = 0;
      stage.scrollLeft = 0;
    }
    const bridge = {
      createFieldGroup: (groupFields, role) => renderReactWorkbenchFieldGroup(groupFields, role),
      releaseField: releaseReactWorkbenchField,
      fieldGroupMounted: () => scheduleReactWorkbenchSync(),
      syncValues: () => {
        syncValues();
        return cloneUi2Value(state.values);
      },
      reset: (form) => resetModuleForm(form),
      returnToInputs: () => {
        setSubmittedRunContext(null);
      },
      submit: (form) => submitModule(form),
      resizeOutputs: resizeWorkbenchOutputs,
      viewReady: () => markViewReady(),
      runtimeSnapshot: () => state.jobEvents.snapshot(),
      subscribeRuntime: (listener) => state.jobEvents.subscribe(listener),
      outputSnapshot: () => state.runtimeOutputAvailability,
      subscribeOutputs: (listener) => subscribeRuntimeOutputs(listener),
      runContextSnapshot: () => state.submittedRunContext,
      subscribeRunContext: (listener) => subscribeWorkbenchRunContext(listener),
      testScenarioSnapshot: () => testScenarioSnapshot(),
      subscribeTestScenarios: (listener) => subscribeTestScenarios(listener),
      applyTestScenario: (id, form) => applyTestScenario(id, form)
    };
    window.GenAppUi2Workbench.mount(root, {
      module,
      fields,
      view: cloneUi2Value(state.view),
      bridge,
      submitted: cloneUi2Value(state.submittedRunContext)
    });
    scheduleReactWorkbenchSync();
    return true;
  }

  // A React workbench may mount an input section only after another native
  // control changes.  Run the normal UI2 dependency/table synchronization
  // once the complete native group is in the DOM, rather than asking React to
  // reproduce repeat, hook, matrix, and conditional-field behavior.
  function scheduleReactWorkbenchSync() {
    if (reactWorkbenchSyncFrame != null) {
      return;
    }
    reactWorkbenchSyncFrame = window.requestAnimationFrame(() => {
      reactWorkbenchSyncFrame = null;
      if (reactWorkbenchRoot) {
        syncValues();
      }
    });
  }

  function renderReactWorkbenchFieldGroup(groupFields, role) {
    const group = el("div", "ui2-workbench-native-field-group");
    const renderPlan = planFields(Array.isArray(groupFields) ? groupFields : []);
    renderPlan.forEach((item) => {
      group.appendChild(item.kind === "table"
        ? renderTableizedRepeater(item, role)
        : renderField(item.field, role));
    });
    return group;
  }

  function isReactWorkbenchView(view) {
    return String(view?.renderer || "").toLowerCase() === "react-workbench";
  }

  function unmountReactWorkbench() {
    if (reactWorkbenchSyncFrame != null) {
      window.cancelAnimationFrame(reactWorkbenchSyncFrame);
      reactWorkbenchSyncFrame = null;
    }
    if (!reactWorkbenchRoot) {
      return;
    }
    window.GenAppUi2Workbench?.unmount?.(reactWorkbenchRoot);
    reactWorkbenchRoot = null;
  }

  function cloneUi2Value(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function resizeWorkbenchOutputs() {
    document.querySelectorAll('[data-output-type="plotly"]').forEach((output) => {
      resizePlotlyOutputWhenVisible(output);
    });
    document.querySelectorAll('[data-output-type="ngl"]').forEach((output) => {
      resizeNglOutputWhenVisible(output);
      refreshNglOutputFrame(output);
    });
  }

  function resizeNglStage(stage) {
    if (!stage) {
      return;
    }
    stage.handleResize?.();
    requestNglRender(stage);
  }

  function disconnectNglOutputObserver(output) {
    output?._ui2NglResizeObserver?.disconnect?.();
    if (output) {
      output._ui2NglResizeObserver = null;
    }
  }

  function observeNglOutput(output) {
    disconnectNglOutputObserver(output);
    if (!output || typeof ResizeObserver !== "function") {
      return;
    }
    const target = output.parentElement || output;
    let width = 0;
    let height = 0;
    const observer = new ResizeObserver((entries) => {
      const rect = entries?.[0]?.contentRect;
      if (!rect || Math.abs(rect.width - width) < 1 && Math.abs(rect.height - height) < 1) {
        return;
      }
      width = rect.width;
      height = rect.height;
      const schedule = window.requestAnimationFrame || ((callback) => window.setTimeout(callback, 0));
      schedule(() => resizeNglOutputWhenVisible(output));
    });
    observer.observe(target);
    output._ui2NglResizeObserver = observer;
  }

  function resizeNglOutputWhenVisible(output) {
    const plot = output?.querySelector?.(".ui2-ngl-plot");
    const stage = output?._ui2NglStage;
    if (!plot || !stage || plot.hidden || plot.offsetParent === null) {
      return false;
    }
    const rect = plot.getBoundingClientRect?.();
    if (!rect || rect.width <= 1 || rect.height <= 1) {
      return false;
    }
    resizeNglStage(stage);
    if (output._ui2NglNeedsVisibleAutoView && output._ui2NglComponent?.autoView) {
      output._ui2NglComponent.autoView();
      output._ui2NglNeedsVisibleAutoView = false;
    }
    return true;
  }

  function requestNglRender(stage) {
    stage?.viewer?.requestRender?.();
  }

  function releaseReactWorkbenchField(fieldNode) {
    fieldNode?.querySelectorAll?.("[data-output-field-id]").forEach((output) => {
      disconnectPlotlyOutputObserver(output);
      if (output.dataset.outputType === "plotly" && window.Plotly?.purge) {
        window.Plotly.purge(output);
      }
      if (output.dataset.outputType === "ngl") {
        // A new job must not inherit a contour or opacity selected for the
        // previous run's density range.  Live updates within a job retain
        // these preferences; this is the explicit run boundary.
        clearNglOutput(output, { resetDensityPreferences: true });
      }
    });
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
    setHelpEnabled(enabled);
  }

  function setHelpEnabled(enabled) {
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
      if (nodes.docsControl) {
        nodes.docsControl.hidden = true;
      } else {
        nodes.docs.hidden = true;
      }
      return;
    }
    if (nodes.docsControl) {
      nodes.docsControl.hidden = false;
    }
    nodes.docs.hidden = false;

    const mainUrl = docsMainUrl(docsbase);
    const moduleUrl = state.moduleId ? docsModuleUrl(docsbase, state.moduleId, state.menuId) : "";
    nodes.docsControl?.classList.toggle("ui2-docs-context", Boolean(moduleUrl));
    nodes.docs.href = moduleUrl || mainUrl;
    nodes.docs.textContent = moduleUrl ? "Module docs" : "Docs";

    if (nodes.docsMain) {
      nodes.docsMain.href = mainUrl;
    }
    if (nodes.docsModule) {
      nodes.docsModule.href = moduleUrl || mainUrl;
      nodes.docsModule.hidden = !moduleUrl;
    }
    if (nodes.docsToggle) {
      nodes.docsToggle.hidden = !moduleUrl;
      nodes.docsToggle.setAttribute("aria-expanded", "false");
    }
    if (nodes.docsMenu) {
      nodes.docsMenu.hidden = true;
    }
  }

  function docsMainUrl(docsbase) {
    const base = stringValue(docsbase).trim().replace(/\/+$/, "");
    if (!base) {
      return "";
    }
    return /^(?:[a-z]+:|\/)/i.test(base) ? `${base}/` : `../${base}/`;
  }

  function docsModuleUrl(docsbase, moduleId, menuId) {
    const mainUrl = docsMainUrl(docsbase);
    const id = sanitizeModuleId(moduleId);
    const menu = sanitizeModuleId(menuId);
    return mainUrl && id && menu ? `${mainUrl}${menu}/${id}/${id}.html` : "";
  }

  function toggleDocsMenu(event) {
    event.preventDefault();
    event.stopPropagation();
    if (!nodes.docsMenu || !nodes.docsToggle || nodes.docsToggle.hidden) {
      return;
    }
    const expanded = nodes.docsToggle.getAttribute("aria-expanded") === "true";
    nodes.docsMenu.hidden = expanded;
    nodes.docsToggle.setAttribute("aria-expanded", expanded ? "false" : "true");
  }

  function closeDocsMenu() {
    if (nodes.docsMenu) {
      nodes.docsMenu.hidden = true;
    }
    nodes.docsToggle?.setAttribute("aria-expanded", "false");
  }

  function closeDocsMenuOnOutsideClick(event) {
    if (nodes.docsControl?.contains(event.target)) {
      return;
    }
    closeDocsMenu();
  }

  function closeDocsMenuOnEscape(event) {
    if (event.key === "Escape") {
      closeDocsMenu();
    }
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
    if (role === "output") {
      replayRuntimeOutput(field.id);
    }
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
    // A table needs the full field width.  Keeping it in the usual right-hand
    // control column makes ordinary five-column scientific tables scroll even
    // when the input card itself has sufficient room.
    row.classList.add("ui2-tableized-repeater", "ui2-field-wide");

    const stack = row.querySelector(".ui2-control-stack");
    const fields = repeatTableFields(item.fields || []);
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
      const header = el("th", null, field.label || field.id || field.type || "field");
      header.dataset.repeatTableHeader = field.id || "";
      headRow.appendChild(header);
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
      td.dataset.repeatTableField = field.id || "";
      td.dataset.repeatTableIndex = String(rowIndex);
      if (field.repeatcondition) {
        td.dataset.repeatcondition = field.repeatcondition;
      }
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
      select.defaultValue = select.value;
      setHoverHelp(select, field.help);
      return select;
    }

    if (type === "checkbox") {
      const wrap = el("label", "ui2-repeat-table-checkbox");
      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = checkboxDefault(field, rowIndex);
      input.defaultChecked = input.checked;
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
    input.defaultValue = input.value;
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
      textarea.defaultValue = textarea.value;
      return textarea;
    }
    if (type === "checkbox") {
      const label = el("label", "ui2-switch");
      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = String(field.checked || field.default || "").toLowerCase() === "true";
      input.defaultChecked = input.checked;
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
      select.defaultValue = select.value;
      if (field.ui2LocalPreference === true && field.id === "ui2theme") {
        select.dataset.ui2LocalPreference = "theme";
        select.value = currentUi2Theme();
        select.defaultValue = select.value;
        select.addEventListener("change", () => {
          select.value = setUi2ThemePreference(select.value, true);
          select.defaultValue = select.value;
        });
      }
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
        input.name = field.name || field.id;
        input.value = choice.value;
        input.checked = String(field.default || "") === choice.value || (!field.default && index === 0);
        input.defaultChecked = input.checked;
        wireControl(input, field);
        item.append(input, document.createTextNode(choice.label));
        group.appendChild(item);
      });
      return group;
    }
    if (type === "action") {
      return renderActionControl(field);
    }
    if (type === "button") {
      if (field.hook) {
        return renderHookButtonControl(field);
      }
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
    input.defaultValue = input.value;
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

  function renderActionControl(field) {
    const wrap = el("div", "ui2-action-control");
    const button = el("button", "ui2-button ui2-button-quiet", field.buttontext || field.label || "Action");
    button.type = "button";
    button.id = fieldId(field);
    button.dataset.actionId = field.id || "";
    const status = el("div", "ui2-submit-status ui2-action-status", "");
    status.id = `${fieldId(field)}-action-status`;
    button.addEventListener("click", () => runModuleAction(field, button, status));
    wrap.append(button, status);
    return wrap;
  }

  function renderHookButtonControl(field) {
    const fileMode = hookFileMode(field);
    if (fileMode) {
      return renderHookFileButtonControl(field, fileMode);
    }
    const wrap = el("div", "ui2-action-control ui2-hook-button-control");
    const button = el("button", "ui2-button ui2-button-quiet", field.buttontext || field.label || "Action");
    button.type = "button";
    button.id = fieldId(field);
    button.dataset.hookId = field.id || "";
    const status = el("div", "ui2-submit-status ui2-action-status", "");
    status.id = `${fieldId(field)}-hook-status`;
    button.addEventListener("click", () => runHookButton(field, button, status));
    wrap.append(button, status);
    return wrap;
  }

  function renderHookFileButtonControl(field, fileMode) {
    const wrap = el("div", "ui2-file-control ui2-hook-button-control");
    const display = el("input", "ui2-input");
    display.type = "text";
    display.id = `${fieldId(field)}-hook-file`;
    display.placeholder = "No file selected";
    display.readOnly = true;
    display.autocomplete = "off";
    display.spellcheck = false;

    const localPicker = document.createElement("input");
    localPicker.type = "file";
    localPicker.className = "ui2-native-file";
    localPicker.tabIndex = -1;

    const status = el("div", "ui2-submit-status ui2-action-status", "");
    status.id = `${fieldId(field)}-hook-status`;
    const actions = el("div", "ui2-file-actions");
    const supportsLocal = fileMode === "lfile" || fileMode === "lrfile";
    const supportsServer = fileMode === "rfile" || fileMode === "lrfile";

    if (supportsLocal) {
      const local = el("button", "ui2-button ui2-button-quiet", "Browse local files");
      local.type = "button";
      local.addEventListener("click", () => localPicker.click());
      actions.appendChild(local);
    }
    if (supportsServer) {
      const server = el("button", "ui2-button ui2-button-quiet", "Browse server");
      server.type = "button";
      server.addEventListener("click", () => {
        openServerFileDialog(Object.assign({}, field, { type: "rfile" }), display, {
          onSelect: (entry) => {
            display.value = decodeServerFileId(entry.id).replace(/^\.\//, "");
            display.dispatchEvent(new Event("input", { bubbles: true }));
            runHookButton(field, null, status, { source: "server", encodedPath: entry.id });
          }
        });
      });
      actions.appendChild(server);
    }

    localPicker.addEventListener("change", () => {
      const file = localPicker.files && localPicker.files[0];
      if (!file) {
        setSubmitStatus(status, "No file selected.", "error");
        return;
      }
      display.value = file.name || "Selected local file";
      display.dispatchEvent(new Event("input", { bubbles: true }));
      readHookLocalFile(file)
        .then((text) => runHookButton(field, null, status, { source: "local", data: text }))
        .catch((error) => {
          setSubmitStatus(status, error.message, "error");
          showLegacyMessagePayload({ error: error.message }, { force: true });
        });
    });

    wrap.append(display, localPicker, actions, status);
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

  function clearJobReferenceSelections(form) {
    form.querySelectorAll(".ui2-job-reference-control").forEach((wrap) => {
      const id = wrap.dataset.fieldId || "";
      if (id) {
        delete state.jobSelections[id];
      }
      const summary = wrap.querySelector(".ui2-job-reference-summary");
      const hidden = wrap.querySelector(".ui2-job-reference-hidden");
      if (summary) {
        summary.textContent = "No reference jobs selected.";
      }
      if (hidden) {
        hidden.innerHTML = "";
      }
    });
  }

  function renderFileControl(field, options) {
    const type = String(field.type || "").toLowerCase();
    const compact = options?.compact === true;
    const wrap = el("div", compact ? "ui2-file-control ui2-file-control-compact" : "ui2-file-control");
    const input = el("input", compact ? "ui2-input ui2-repeat-table-input" : "ui2-input");
    input.type = "text";
    input.placeholder = type === "rpath" ? "Server path" : "No file selected";
    // This is a display surface for the selection made through the local or
    // server picker, not a path-entry field.  A typed or browser-history value
    // cannot recreate either a File object or the encoded server selection
    // needed by submit, so prevent it from becoming a misleading pseudo-value.
    input.readOnly = true;
    input.autocomplete = "off";
    input.spellcheck = false;
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
    input.defaultValue = input.value;

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
      clearFileReselectionWarning(field.id, options?.repeatTableIndex);
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

    const reselectWarning = el("p", "ui2-file-reselect-warning", "");
    reselectWarning.dataset.fieldId = field.id || "";
    if (options?.repeatTableIndex != null) {
      reselectWarning.dataset.repeatTableIndex = String(options.repeatTableIndex);
    }
    reselectWarning.hidden = true;
    wrap.append(input, localPicker, actions, reselectWarning);
    refreshFileReselectionWarning(reselectWarning);
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
    const nav = el("div", "ui2-file-actions");
    const up = el("button", "ui2-button ui2-button-quiet", "Up");
    up.type = "button";
    const home = el("button", "ui2-button ui2-button-quiet", "Home");
    home.type = "button";
    const project = el("button", "ui2-button ui2-button-quiet", "Project");
    project.type = "button";
    nav.append(up, home, project);
    const list = el("div", "ui2-server-file-tree");
    list.setAttribute("role", "tree");
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
    let currentDir = "#";
    const load = async (dirId, loadOptions) => {
      if (loadOptions?.inline) {
        return fetchServerFileEntries(dirId);
      }
      currentDir = normalizeServerFileDir(dirId);
      status.textContent = "Loading server files...";
      status.dataset.status = "";
      list.innerHTML = "";
      choose.disabled = true;
      selected = null;
      try {
        const entries = await fetchServerFileEntries(currentDir);
        rememberServerFileDir(currentDir);
        path.textContent = serverFileDirLabel(currentDir);
        up.disabled = currentDir === "#";
        home.disabled = currentDir === "#";
        project.disabled = !serverFileProjectDir() || currentDir === serverFileProjectDir();
        renderServerFileTree(entries, list, {
          mode: serverFileType(field),
          load,
          selectEntry: (entry) => {
            selected = entry;
            choose.disabled = false;
          }
        });
        status.textContent = entries.length ? "Choose a server file." : "No files found here.";
        return entries;
      } catch (error) {
        status.textContent = error.message;
        status.dataset.status = "error";
        return [];
      }
    };

    choose.addEventListener("click", () => {
      if (!selected) {
        return;
      }
      if (typeof options?.onSelect === "function") {
        options.onSelect(selected, targetInput);
      } else {
        setServerSelection(field, options?.repeatTableIndex, selected);
        targetInput.value = decodeServerFileId(selected.id).replace(/^\.\//, "");
        targetInput.dispatchEvent(new Event("input", { bubbles: true }));
        setServerSelection(field, options?.repeatTableIndex, selected);
      }
      rememberServerFileDir(serverFileRememberDirForSelection(selected, serverFileType(field)));
      overlay.remove();
    });

    up.addEventListener("click", () => load(serverFileParentDir(currentDir)));
    home.addEventListener("click", () => load("#"));
    project.addEventListener("click", () => {
      const projectDir = serverFileProjectDir();
      if (projectDir) {
        load(projectDir);
      }
    });

    panel.append(header, path, nav, list, status, actions);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    load(serverFileInitialDir());
  }

  async function fetchServerFileEntries(dirId, options = {}) {
    const url = new URL(legacyEndpoint("filesBase", "ajax/sys_config/sys_files.php"), window.location.href);
    url.searchParams.set("_window", window.name);
    url.searchParams.set("_spec", "fc_cache");
    url.searchParams.set("_spec_dir", dirId && dirId !== "#" ? dirId : "");
    if (options.projectScoped && state.session.project && state.session.project !== "no_project_specified") {
      url.searchParams.set("project", state.session.project);
    }
    const response = await fetch(url.toString(), {
      credentials: "same-origin"
    });
    const payload = await parseJsonResponse(response, "Server file browser");
    return Array.isArray(payload) ? payload : [];
  }

  function serverFileInitialDir() {
    const sessionKey = serverFileSessionKey();
    if (state.lastServerFileSessionKey === sessionKey && state.lastServerFileDir) {
      return normalizeServerFileDir(state.lastServerFileDir);
    }
    return serverFileProjectDir() || "#";
  }

  function serverFileProjectDir() {
    const project = stringValue(state.session.project).trim();
    if (!project || project === "no_project_specified") {
      return "";
    }
    return encodeServerFilePath(`./${project}`);
  }

  function rememberServerFileDir(dirId) {
    state.lastServerFileDir = normalizeServerFileDir(dirId);
    state.lastServerFileSessionKey = serverFileSessionKey();
  }

  function serverFileRememberDirForSelection(entry, mode) {
    const dir = normalizeServerFileDir(entry?.id);
    if (mode === "rpath") {
      return dir;
    }
    return serverFileParentDir(dir);
  }

  function serverFileParentDir(dirId) {
    const path = decodeServerFileId(normalizeServerFileDir(dirId)).replace(/\/+$/, "");
    if (!path || path === "." || path === "./") {
      return "#";
    }
    const clean = path.replace(/^\.\//, "");
    const parts = clean.split("/").filter(Boolean);
    if (parts.length <= 1) {
      return "#";
    }
    return encodeServerFilePath(`./${parts.slice(0, -1).join("/")}`);
  }

  function serverFileDirLabel(dirId) {
    const path = decodeServerFileId(normalizeServerFileDir(dirId)).replace(/^\.\//, "");
    return path ? `User files / ${path}` : "User files";
  }

  function normalizeServerFileDir(dirId) {
    return dirId && dirId !== "#" ? dirId : "#";
  }

  function encodeServerFilePath(path) {
    return btoa(path);
  }

  function renderServerFileTree(entries, container, options) {
    container.innerHTML = "";
    const group = el("div", "ui2-server-tree-group");
    group.setAttribute("role", "group");
    entries.forEach((entry) => group.appendChild(renderServerFileTreeNode(entry, options, 0)));
    container.appendChild(group);
  }

  function renderServerFileTreeNode(entry, options, depth) {
    const isFolder = serverFileEntryIsFolder(entry);
    const mode = String(options?.mode || "rfile").toLowerCase();
    const selectable = serverFileTreeSelectable(entry, mode);
    const row = el("div", `ui2-server-tree-node${isFolder ? " ui2-server-tree-folder" : " ui2-server-tree-file"}`);
    row.dataset.id = entry.id || "";
    row.dataset.depth = String(depth || 0);
    row.setAttribute("role", "treeitem");
    row.setAttribute("aria-selected", "false");
    if (isFolder) {
      row.setAttribute("aria-expanded", "false");
    }
    if (!selectable) {
      row.classList.add("ui2-server-tree-unselectable");
    }

    const item = el("button", "ui2-server-tree-item", "");
    item.type = "button";
    item.style.paddingLeft = `${0.3 + depth * 1.15}rem`;

    const disclosure = el("span", "ui2-server-tree-disclosure", isFolder ? ">" : "");
    disclosure.setAttribute("aria-hidden", "true");
    const checkbox = document.createElement("span");
    checkbox.className = "ui2-server-tree-checkbox";
    checkbox.setAttribute("aria-hidden", "true");
    const icon = el("span", `ui2-server-tree-icon ${isFolder ? "ui2-server-tree-icon-folder" : "ui2-server-tree-icon-file"}`, "");
    icon.setAttribute("aria-hidden", "true");
    const name = el("span", "ui2-server-tree-name", fileEntryName(entry));
    const details = el("span", "ui2-server-tree-details", fileEntryDetails(entry));
    item.append(disclosure, checkbox, icon, name);
    if (details.textContent) {
      item.append(details);
    }

    const children = el("div", "ui2-server-tree-children");
    children.setAttribute("role", "group");
    children.hidden = true;

    item.addEventListener("click", async () => {
      if (selectable) {
        const root = row.closest(".ui2-server-file-tree");
        root?.querySelectorAll(".ui2-server-tree-node[aria-selected='true']").forEach((selected) => selected.setAttribute("aria-selected", "false"));
        row.setAttribute("aria-selected", "true");
        options?.selectEntry?.(entry);
      }
      if (isFolder) {
        await toggleServerFileTreeNode(row, entry, options, depth, children, disclosure);
      }
    });

    row.append(item, children);
    return row;
  }

  async function toggleServerFileTreeNode(row, entry, options, depth, children, disclosure) {
    const expanded = row.getAttribute("aria-expanded") === "true";
    if (expanded) {
      row.setAttribute("aria-expanded", "false");
      disclosure.textContent = ">";
      children.hidden = true;
      return;
    }
    row.setAttribute("aria-expanded", "true");
    disclosure.textContent = "v";
    children.hidden = false;
    if (children.dataset.loaded === "true") {
      return;
    }
    children.textContent = "Loading...";
    try {
      const childEntries = await options?.load?.(entry.id, { inline: true });
      children.innerHTML = "";
      (childEntries || []).forEach((child) => children.appendChild(renderServerFileTreeNode(child, options, depth + 1)));
      if (!childEntries?.length) {
        children.appendChild(el("div", "ui2-server-tree-empty", "No files found here."));
      }
      children.dataset.loaded = "true";
    } catch (error) {
      children.textContent = error.message;
    }
  }

  function serverFileTreeSelectable(entry, mode) {
    const isFolder = serverFileEntryIsFolder(entry);
    if (mode === "rpath") {
      return isFolder;
    }
    return !isFolder;
  }

  function serverFileEntryIsFolder(entry) {
    return entry?.children === true;
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
    clearFileReselectionWarning(field.id, repeatIndex);
  }

  function clearServerSelection(field, repeatIndex) {
    if (!field?.id) {
      return;
    }
    delete state.serverSelections[serverSelectionKey(field, repeatIndex)];
  }

  function fileReselectionWarningKey(id, repeatIndex) {
    return `${id || ""}:${repeatIndex == null ? "" : repeatIndex}`;
  }

  function setFileReselectionWarnings(warnings) {
    state.fileReselectionWarnings = {};
    (warnings || []).forEach((warning) => {
      if (warning?.id) {
        state.fileReselectionWarnings[fileReselectionWarningKey(warning.id, warning.repeatIndex)] = warning;
      }
    });
    refreshFileReselectionWarnings();
  }

  function clearFileReselectionWarnings() {
    state.fileReselectionWarnings = {};
    refreshFileReselectionWarnings();
  }

  function clearFileReselectionWarning(id, repeatIndex) {
    if (!id) {
      return;
    }
    delete state.fileReselectionWarnings[fileReselectionWarningKey(id, repeatIndex)];
    refreshFileReselectionWarnings(id, repeatIndex);
  }

  function fileReselectionWarning(id, repeatIndex) {
    return state.fileReselectionWarnings[fileReselectionWarningKey(id, repeatIndex)] || null;
  }

  function fileReselectionWarningText(warning) {
    if (!warning) {
      return "";
    }
    const name = warning.savedValue ? ` (${warning.savedValue})` : "";
    const field = moduleFieldById(warning.id);
    const alternative = fileModes(field?.type).includes("server") ? " or choose a server file" : "";
    return `This browser cannot restore the saved local file${name}. Select it again${alternative} before submitting a new run.`;
  }

  function refreshFileReselectionWarning(node) {
    if (!node) {
      return;
    }
    const warning = fileReselectionWarning(node.dataset.fieldId, repeatIndexValue(node.dataset.repeatTableIndex));
    node.textContent = fileReselectionWarningText(warning);
    node.hidden = !warning;
  }

  function refreshFileReselectionWarnings(id = null, repeatIndex = null) {
    const selector = id
      ? `.ui2-file-reselect-warning[data-field-id="${cssEscape(id)}"]`
      : ".ui2-file-reselect-warning";
    Array.from(document.querySelectorAll(selector)).forEach((node) => {
      if (id && repeatIndex != null && String(node.dataset.repeatTableIndex ?? "") !== String(repeatIndex)) {
        return;
      }
      refreshFileReselectionWarning(node);
    });
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
    if (type === "image") {
      return renderImageOutputShell(field, type);
    }
    const output = el("div", outputClassForType(type), outputPlaceholderForType(type));
    output.dataset.outputFieldId = field.id || "";
    output.dataset.outputType = type;
    return output;
  }

  function renderDynamicOutputGroup(field, type) {
    const output = el("div", `${outputClassForType(type)} ui2-dynamic-output`);
    output.append(el("div", "ui2-dynamic-output-placeholder", dynamicOutputPlaceholder(field)));
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
    } else if (type === "image") {
      classes.push("ui2-output-image");
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
    if (type === "image") {
      return "Image will appear here at runtime.";
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
      ["hour", "Hour"],
      ["day", "Day"],
      ["week", "Week"],
      ["month", "Month"]
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
    body.appendChild(renderJobActionsLegend());

    const tableWrap = el("div", "ui2-data-table-wrap");
    const table = el("table", "ui2-data-table");
    table.id = "ui2-job-table";
    const thead = document.createElement("thead");
    const tbody = document.createElement("tbody");
    table.append(thead, tbody);
    tableWrap.appendChild(table);
    body.appendChild(tableWrap);

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
    const refreshAll = el("button", "ui2-button ui2-button-quiet", "Refresh all");
    refreshAll.type = "button";
    const refreshSelected = el("button", "ui2-button ui2-button-quiet", "Refresh selected");
    refreshSelected.type = "button";
    const removeSelected = el("button", "ui2-button ui2-button-quiet", "Remove selected");
    removeSelected.type = "button";
    const download = el("button", "ui2-button", "Download");
    download.type = "button";
    const status = el("div", "ui2-submit-status", "");
    status.id = "ui2-file-manager-status";
    const links = el("div", "ui2-file-download-links");
    actions.append(refreshAll, refreshSelected, removeSelected, download, status, links);
    body.appendChild(actions);

    ["status", "outfiles"].forEach((id) => {
      const field = fields.find((item) => item.id === id);
      if (field) {
        body.appendChild(renderToolOutput(field.label || id, field));
      }
    });

    section.appendChild(body);
    table._ui2UtilityModule = module || {};
    refreshAll.addEventListener("click", () => loadFileManagerRows(table));
    refreshSelected.addEventListener("click", () => refreshSelectedFileManagerRows(table, status));
    removeSelected.addEventListener("click", () => removeSelectedFileManagerRows(table, status, links));
    download.addEventListener("click", () => downloadFileManagerSelection(table, status, links, module || {}));
    refreshServerDate(section);
    window.setTimeout(() => loadFileManagerRows(table), 0);
    return section;
  }

  function renderUserConfigTool(module, fields) {
    const section = el("section", "ui2-section ui2-system-tool ui2-user-config");
    const form = el("form", "ui2-utility-form");
    form.noValidate = true;
    const inputFields = ui2UserConfigFields(userConfigFields(fields.filter((field) => field.role !== "output")))
      .map(normalizeUserConfigField);
    const outputFields = fields.filter((field) => field.role === "output");
    form.appendChild(renderUtilitySection("Settings", inputFields, "input"));
    form.appendChild(renderUtilityActions("Update settings"));
    if (outputFields.length) {
      form.appendChild(renderUtilitySection("Status", outputFields, "output"));
    }
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      await submitUtilityModule(form, module, "ajax/sys_config/sys_user_config.php", {
        afterSuccess: (payload) => setSessionProjectFromSettings(form, payload)
      });
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
        successMessage: "Feedback sent",
        afterSuccess: () => clearJobReferenceSelections(form)
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

  function ui2UserConfigFields(fields) {
    const nextFields = [];
    let insertedTheme = false;
    fields.forEach((field) => {
      if (isLegacyUserConfigThemeField(field)) {
        if (!insertedTheme) {
          nextFields.push(ui2ThemeConfigField());
          insertedTheme = true;
        }
        return;
      }
      nextFields.push(field);
    });
    if (!insertedTheme) {
      nextFields.push(ui2ThemeConfigField());
    }
    return nextFields;
  }

  function isLegacyUserConfigThemeField(field) {
    return LEGACY_USER_CONFIG_THEME_FIELD_IDS.has(String(field?.id || ""));
  }

  function ui2ThemeConfigField() {
    return {
      id: "ui2theme",
      label: "UI2 theme",
      type: "listbox",
      values: ui2ThemeOptionValues(),
      default: currentUi2Theme(),
      help: "Select a native UI2 color theme. System follows the browser or operating system setting.",
      ui2LocalPreference: true
    };
  }

  function ui2ThemeOptionValues() {
    return UI2_THEME_OPTIONS.map(([value, label]) => `${label}~${value}`).join("~");
  }

  function normalizeUserConfigField(field) {
    if (field?.id === "newprojectdesc") {
      return { ...field, required: "false" };
    }
    return field;
  }

  function userConfigFieldVisible(field) {
    if (field?.id === "aihelperpreference") {
      return state.session.aiHelper?.available === true;
    }
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
    updateRepeatTables(form, rawValues, activeRows);
    updateRepeatTableCellConditions(form, rawValues);
    return collectControlValues(form, (control) => {
      const row = control.closest(".ui2-field");
      return !control.disabled && (!row || activeRows.get(row) !== false);
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
      } else if (control.tagName === "SELECT" && id === "aihelperpreference" && !value) {
        control.value = "default";
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
    const invalid = validateModuleForm(form);
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
      showLegacyMessagePayload(payload);
      if (!response.ok || payload.error || payload._status === "failed") {
        throw new Error(payload.error || `Settings returned HTTP ${response.status}`);
      }
      setSubmitStatus(status, payload.status || options.successMessage || "Settings updated", "ok");
      applyUtilityOutputs(form, payload);
      if (typeof options.afterSuccess === "function") {
        await options.afterSuccess(payload);
      }
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

  function settingsProjectFromResponse(form, payload = {}) {
    const responseProject = stringValue(payload?._project).trim();
    if (responseProject) {
      return responseProject;
    }
    const projectControl = fieldControls(form).find((control) => {
      return control.dataset.fieldId === "project" && control.dataset.pullKey === "project";
    });
    return stringValue(projectControl?.value).trim();
  }

  async function setSessionProjectFromSettings(form, payload = {}) {
    const project = settingsProjectFromResponse(form, payload);
    if (!project) {
      return null;
    }
    if (stringValue(payload?._project).trim()) {
      updateSessionIdentity({ _logon: state.session.logon, _project: project });
      renderSessionState();
      return payload;
    }
    return setLegacyProject(project);
  }

  async function setLegacyProject(project) {
    const selected = stringValue(project).trim() || "no_project_specified";
    const url = new URL(legacyEndpoint("", "ajax/sys_config/sys_project.php"), window.location.href);
    url.searchParams.set("_window", window.name);
    url.searchParams.set("_logon", state.session.logon || "");
    url.searchParams.set("_project", selected);
    const response = await fetch(url.toString(), {
      cache: "no-cache",
      credentials: "same-origin"
    });
    const payload = await parseJsonResponse(response, "Project selection");
    if (!response.ok || payload.error) {
      throw new Error(payload.error || `Project selection returned HTTP ${response.status}`);
    }
    updateSessionIdentity({ _logon: state.session.logon, _project: selected });
    renderSessionState();
    return payload;
  }

  function validateModuleForm(form) {
    syncFormValues(form);
    const fileNeedingReselection = fieldControls(form).find((control) => (
      !control.disabled
        && control.readOnly
        && control.closest(".ui2-file-control")
        && !control.closest(".ui2-output-field")
        && !control.closest(".ui2-hidden")
        && fileReselectionWarning(control.dataset.fieldId, repeatIndexValue(control.dataset.repeatTableIndex))
    ));
    if (fileNeedingReselection) {
      return {
        control: fileNeedingReselection,
        message: `${fieldLabelForControl(fileNeedingReselection)}: Select the local file again or choose a server file before submitting.`
      };
    }
    const missingRequiredFile = fieldControls(form).find((control) => (
      !control.disabled
        && control.required
        && control.readOnly
        && control.closest(".ui2-file-control")
        && !control.closest(".ui2-output-field")
        && !control.closest(".ui2-hidden")
        && !String(control.value || "").trim()
    ));
    if (missingRequiredFile) {
      return {
        control: missingRequiredFile,
        message: `${fieldLabelForControl(missingRequiredFile)}: Please select a file.`
      };
    }
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

  function validateUtilityForm(form) {
    return validateModuleForm(form);
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
      if (control.dataset.ui2LocalPreference) {
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
    if (control.type === "radio" && control.dataset.fieldName) {
      return control.dataset.fieldName;
    }
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
    const grouped = groupJobReferenceRows(rows, columns);
    let firstMonth = true;
    grouped.forEach((monthGroup) => {
      const monthDetails = renderJobReferenceBranch(monthGroup.label, "month", firstMonth);
      firstMonth = false;
      let firstDay = true;
      monthGroup.days.forEach((dayGroup) => {
        const dayDetails = renderJobReferenceBranch(dayGroup.label, "day", monthDetails.open && firstDay);
        firstDay = false;
        let firstModule = true;
        dayGroup.modules.forEach((moduleGroup) => {
          const moduleDetails = renderJobReferenceBranch(moduleGroup.label, "module", dayDetails.open && firstModule);
          firstModule = false;
          moduleGroup.jobs.forEach((job) => {
            const item = el("label", "ui2-job-reference-item");
            const input = document.createElement("input");
            input.type = "checkbox";
            input.value = job.id || "";
            input.checked = selectedIds.has(job.id || "");
            input.dataset.jobReferenceRow = "1";
            input.dataset.jobDisplay = jobReferenceDisplay(job, columns);
            item.append(input, document.createTextNode(input.dataset.jobDisplay));
            moduleDetails.appendChild(item);
          });
          dayDetails.appendChild(moduleDetails);
        });
        monthDetails.appendChild(dayDetails);
      });
      tree.appendChild(monthDetails);
    });
  }

  function renderJobReferenceBranch(label, level, open) {
    const details = el("details", `ui2-job-reference-group ui2-job-reference-${level}`);
    details.open = !!open;
    details.appendChild(el("summary", null, label));
    return details;
  }

  function groupJobReferenceRows(rows, columns) {
    const months = new Map();
    rows
      .slice()
      .sort((left, right) => jobReferenceStartSeconds(right, columns) - jobReferenceStartSeconds(left, columns))
      .forEach((job) => {
        const parts = jobReferenceDateParts(job, columns);
        const moduleName = jobReferenceModule(job, columns);
        if (!months.has(parts.monthKey)) {
          months.set(parts.monthKey, { label: parts.monthLabel, time: parts.time, days: new Map() });
        }
        const month = months.get(parts.monthKey);
        month.time = Math.max(month.time, parts.time);
        if (!month.days.has(parts.dayKey)) {
          month.days.set(parts.dayKey, { label: parts.dayLabel, time: parts.time, modules: new Map() });
        }
        const day = month.days.get(parts.dayKey);
        day.time = Math.max(day.time, parts.time);
        if (!day.modules.has(moduleName)) {
          day.modules.set(moduleName, { label: moduleName, time: parts.time, jobs: [] });
        }
        const moduleGroup = day.modules.get(moduleName);
        moduleGroup.time = Math.max(moduleGroup.time, parts.time);
        moduleGroup.jobs.push(job);
      });

    return Array.from(months.values())
      .sort((left, right) => right.time - left.time)
      .map((month) => ({
        ...month,
        days: Array.from(month.days.values())
          .sort((left, right) => right.time - left.time)
          .map((day) => ({
            ...day,
            modules: Array.from(day.modules.values())
              .sort((left, right) => right.time - left.time || left.label.localeCompare(right.label))
              .map((moduleGroup) => ({
                ...moduleGroup,
                jobs: moduleGroup.jobs
                  .slice()
                  .sort((left, right) => jobReferenceStartSeconds(right, columns) - jobReferenceStartSeconds(left, columns))
              }))
          }))
      }));
  }

  function jobReferenceDateParts(job, columns) {
    const time = jobReferenceStartSeconds(job, columns);
    if (!time) {
      return {
        time: 0,
        monthKey: "unknown",
        monthLabel: "unknown",
        dayKey: "unknown",
        dayLabel: "unknown"
      };
    }
    const date = new Date(time * 1000);
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    return {
      time,
      monthKey: `${year}-${month}`,
      monthLabel: `${year}-${month}`,
      dayKey: `${year}-${month}-${day}`,
      dayLabel: day
    };
  }

  function jobReferenceStartSeconds(job, columns) {
    const numeric = Number(jobCellTextByName(job, columns, "startnumeric", 5));
    if (Number.isFinite(numeric) && numeric > 0) {
      return numeric;
    }
    const parsed = Date.parse(jobCellTextByName(job, columns, "start", 2));
    return Number.isFinite(parsed) ? Math.floor(parsed / 1000) : 0;
  }

  function jobReferenceModule(job, columns) {
    const moduleName = jobCellTextByName(job, columns, "module", 0) || "Jobs";
    const parts = moduleName.split("/").filter(Boolean);
    return parts[parts.length - 1] || moduleName;
  }

  function jobReferenceDisplay(job, columns) {
    const project = jobCellTextByName(job, columns, "project", 1) || "no_project_specified";
    const start = jobReferenceTimeLabel(job, columns);
    const duration = jobCellTextByName(job, columns, "duration", 6);
    return `${project}${start ? ` start: ${start}` : ""}${duration ? ` duration: ${duration}` : ""}`;
  }

  function jobReferenceTimeLabel(job, columns) {
    const seconds = jobReferenceStartSeconds(job, columns);
    if (seconds > 0) {
      const date = new Date(seconds * 1000);
      return `${String(date.getUTCHours()).padStart(2, "0")}:`
        + `${String(date.getUTCMinutes()).padStart(2, "0")}:`
        + `${String(date.getUTCSeconds()).padStart(2, "0")} UTC`;
    }
    return jobCellTextByName(job, columns, "start", 2);
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
      const completedSeconds = completedFilterSeconds(filters.completed);
      if (completedSeconds > 0) {
        if (isRunning || !endSeconds) {
          return false;
        }
        return endSeconds >= nowSeconds - completedSeconds;
      }
      return true;
    });
  }

  function completedFilterSeconds(value) {
    const completedWindows = {
      hour: 60 * 60,
      day: 24 * 60 * 60,
      week: 7 * 24 * 60 * 60,
      month: 30 * 24 * 60 * 60
    };
    if (Object.prototype.hasOwnProperty.call(completedWindows, value)) {
      return completedWindows[value];
    }
    const legacyDays = Number(value);
    return legacyDays > 0 ? legacyDays * 24 * 60 * 60 : 0;
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
        const url = new URL(window.location.pathname || "index.html", window.location.origin);
        url.searchParams.set("_reqlogin", "1");
        url.searchParams.set("_switch", switchValue);
        window.open(url.toString(), "_blank", "noopener");
        return;
      }
      await attachSwitchValue(switchValue, jobId);
    } catch (error) {
      setSystemMessage("messages", error.message, true);
    }
  }

  async function attachSwitchValue(switchValue, jobId = "") {
    const target = switchTargetFromValue(switchValue);
    await refreshSessionState();
    closeUtilityOverlay();
    if (target.project) {
      await setLegacyProject(target.project);
    }
    await loadModule(target.moduleId);
    const form = document.getElementById("ui2-form");
    const status = document.getElementById("ui2-submit-status");
    if (!form || !status) {
      throw new Error(`UI2 view for ${target.moduleId} did not provide a reattach form.`);
    }
    beginJobOutputContext(target.moduleId, target.uuid);
    setSubmitStatus(status, `Attached (${jobId || target.uuid})`, "ok");
    // Match legacy ga.switch.cb2: the first authoritative result request
    // hydrates inputs and durable output/event state before live subscription.
    startJobPolling(target.uuid, form, status, true, true, false);
  }

  function switchTargetFromValue(switchValue) {
    const parts = stringValue(switchValue).split("/");
    const switchSegment = /^[A-Za-z0-9_.-]+$/;
    if (parts.length !== 4 || parts.some((part) => !switchSegment.test(part))) {
      throw new Error("Invalid legacy reattach target.");
    }
    const [menuId, moduleId, project, uuid] = parts;
    const menu = Array.isArray(appMap.menus)
      ? appMap.menus.find((entry) => entry.id === menuId)
      : null;
    if (!menu || !(menu.modules || []).some((entry) => entry.id === moduleId)) {
      throw new Error(`Reattach target is not a generated UI2 module: ${switchValue}`);
    }
    return {
      moduleId,
      menuId,
      project,
      uuid
    };
  }

  function moduleIdFromSwitchParts(parts) {
    if (!Array.isArray(parts) || !parts.length) {
      return "";
    }
    return parts.length >= 4 ? parts[1] : parts[0];
  }

  function switchProjectFromParts(parts) {
    if (!Array.isArray(parts) || parts.length < 2) {
      return "";
    }
    return parts.length >= 4 ? parts[2] : parts[parts.length - 2];
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
    row.dataset.parentId = entry.parent || "#";
    row.dataset.depth = String(depth);
    row._ui2FileEntry = entry;
    const selectCell = document.createElement("td");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.dataset.fileSelect = "1";
    selectCell.appendChild(checkbox);
    row.appendChild(selectCell);

    const nameCell = renderFileManagerNameCell(row, entry, depth, isFolder);
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
      const button = row.querySelector(".ui2-file-disclosure");
      button?.replaceChildren(">");
      button?.setAttribute("aria-label", `Open ${fileEntryName(entry)}`);
      return;
    }
    row.dataset.expanded = "true";
    const button = row.querySelector(".ui2-file-disclosure");
    button?.replaceChildren("v");
    button?.setAttribute("aria-label", `Close ${fileEntryName(entry)}`);
    try {
      await loadFileManagerFolderChildren(row, entry, depth);
    } catch (error) {
      const errorRow = document.createElement("tr");
      const cell = el("td", "ui2-table-empty", error.message);
      cell.colSpan = 3;
      errorRow.dataset.parentId = entry.id || "";
      errorRow.appendChild(cell);
      row.after(errorRow);
    }
  }

  async function loadFileManagerFolderChildren(row, entry, depth) {
    const tbody = row.parentElement;
    if (!tbody) {
      return;
    }
    removeFileManagerChildren(row);
    const children = await fetchServerFileEntries(entry.id);
    let anchor = row;
    children.forEach((child) => {
      const childRow = document.createElement("tr");
      appendFileManagerRowAfter(tbody, childRow, child, depth + 1, anchor, entry.id);
      anchor = childRow;
    });
  }

  function appendFileManagerRowAfter(tbody, row, entry, depth, anchor, parentId) {
    row.dataset.fileId = entry.id || "";
    row.dataset.parentId = entry.parent || parentId || "#";
    row.dataset.depth = String(depth);
    row._ui2FileEntry = entry;
    const isFolder = entry.children === true;
    const selectCell = document.createElement("td");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.dataset.fileSelect = "1";
    selectCell.appendChild(checkbox);
    row.appendChild(selectCell);
    const nameCell = renderFileManagerNameCell(row, entry, depth, isFolder);
    row.appendChild(nameCell);
    row.appendChild(el("td", null, fileEntryDetails(entry)));
    anchor.after(row);
  }

  function renderFileManagerNameCell(row, entry, depth, isFolder) {
    const nameCell = el("td", "ui2-file-manager-name", "");
    nameCell.style.paddingLeft = `${0.65 + depth * 1.25}rem`;
    if (isFolder) {
      const expand = el("button", "ui2-file-disclosure", ">");
      expand.type = "button";
      expand.setAttribute("aria-label", `Open ${fileEntryName(entry)}`);
      expand.addEventListener("click", () => toggleFileManagerFolder(row, entry, depth));
      nameCell.append(expand, el("span", "ui2-file-icon ui2-file-icon-folder", ""), el("span", null, fileEntryName(entry)));
    } else {
      nameCell.append(el("span", "ui2-file-disclosure ui2-file-disclosure-spacer", ""), el("span", "ui2-file-icon ui2-file-icon-file", ""), el("span", null, fileEntryName(entry)));
    }
    return nameCell;
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

  function fileManagerSelectedRows(table) {
    return Array.from(table?.querySelectorAll("input[data-file-select]") || [])
      .filter((input) => input.checked)
      .map((input) => input.closest("tr"))
      .filter(Boolean);
  }

  function fileManagerSelectedIds(table) {
    return fileManagerSelectedRows(table)
      .map((row) => row.dataset.fileId)
      .filter(Boolean);
  }

  function fileManagerSelectedParentIds(table) {
    return [...new Set(fileManagerSelectedRows(table)
      .map((row) => row.dataset.parentId || "#"))];
  }

  function fileManagerRemovalPrompt(ids) {
    const paths = ids.map((id) => decodeServerFileId(id).replace(/^\.\//, ""));
    const noun = ids.length === 1 ? "item" : "items";
    return `Remove ${ids.length} selected ${noun}? Directories include all of their contents.\n\n${paths.join("\n")}`;
  }

  function fileManagerDeleteFormData(ids) {
    const formData = new FormData();
    formData.set("_window", window.name);
    formData.set("_spec", "fc_cache");
    formData.set("_delete", ids.join(","));
    return formData;
  }

  function fileManagerRowForId(table, fileId) {
    return Array.from(table?.querySelectorAll("tr[data-file-id]") || [])
      .find((row) => row.dataset.fileId === fileId) || null;
  }

  async function refreshSelectedFileManagerRows(table, status) {
    const parentIds = fileManagerSelectedParentIds(table);
    if (!parentIds.length) {
      setSubmitStatus(status, "No files selected.", "error");
      return;
    }
    setSubmitStatus(status, "Refreshing selected files...", "pending");
    try {
      await refreshSessionState();
      if (parentIds.includes("#")) {
        await loadFileManagerRows(table);
      } else {
        for (const parentId of parentIds) {
          const parentRow = fileManagerRowForId(table, parentId);
          const entry = parentRow?._ui2FileEntry;
          if (!parentRow || !entry) {
            await loadFileManagerRows(table);
            break;
          }
          await loadFileManagerFolderChildren(parentRow, entry, Number(parentRow.dataset.depth || 0));
        }
      }
      setSubmitStatus(status, "Selected files refreshed.", "ok");
    } catch (error) {
      setSubmitStatus(status, error.message, "error");
    }
  }

  async function removeSelectedFileManagerRows(table, status, links) {
    const ids = fileManagerSelectedIds(table);
    if (!ids.length) {
      setSubmitStatus(status, "No files selected.", "error");
      return;
    }
    if (!window.confirm(fileManagerRemovalPrompt(ids))) {
      return;
    }
    setSubmitStatus(status, "Removing selected files...", "pending");
    try {
      await refreshSessionState();
      const response = await fetch(legacyEndpoint("filesBase", "ajax/sys_config/sys_files.php"), {
        method: "POST",
        body: fileManagerDeleteFormData(ids),
        credentials: "same-origin"
      });
      const payload = await parseJsonResponse(response, "File Manager remove selected");
      if (payload.error) {
        throw new Error(payload.error);
      }
      if (links) {
        links.innerHTML = "";
      }
      await loadFileManagerRows(table);
      setSubmitStatus(status, "Selected files removed.", "ok");
    } catch (error) {
      setSubmitStatus(status, error.message, "error");
    }
  }

  async function downloadFileManagerSelection(table, status, links, module) {
    const selected = fileManagerSelectedIds(table);
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
      showLegacyMessagePayload(payload);
      if (payload.error) {
        throw new Error(payload.error);
      }
      let finalPayload = payload;
      let linksHtml = fileDownloadLinks(payloadFileList(finalPayload));
      if (!linksHtml && runtimeStatus(payload) === "started") {
        finalPayload = await waitForFileManagerResult(uuid, status);
        showLegacyMessagePayload(finalPayload);
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

  function renderJobActionsLegend() {
    const legend = el("div", "ui2-tool-legend ui2-job-actions-legend");
    legend.appendChild(el("strong", "ui2-job-legend-title", "Actions Legend"));
    const items = el("div", "ui2-job-legend-list");
    [
      ["Attach", "→", "ui2-job-action-attach", "attach to job"],
      ["Attach in new window", "⇒", "ui2-job-action-attach", "attach to job in a new window"],
      ["Delete job", "⇓", "ui2-job-action-danger", "delete job"],
      ["Cancel job", "⊗", "ui2-job-action-danger", "cancel job"],
      ["Clear project lock", "🔒", "ui2-job-action-lock", "clear lock"]
    ].forEach(([label, glyph, className, text], index) => {
      const item = el("span", "ui2-job-legend-item");
      const icon = el("span", `ui2-mini-button ui2-job-action-icon ${className}`, glyph);
      icon.title = label;
      icon.setAttribute("aria-hidden", "true");
      item.append(icon, document.createTextNode(` ${text}`));
      items.appendChild(item);
      if (index < 4) {
        items.appendChild(document.createTextNode("; "));
      }
    });
    legend.appendChild(items);
    return legend;
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

  function syncValues(formOverride = null) {
    const form = formOverride || document.getElementById("ui2-form");
    if (!form) {
      return;
    }
    const initialValues = collectControlValues(form, () => true);
    syncLinkedControls(form, initialValues);
    const rawValues = collectControlValues(form, () => true);
    const activeRows = evaluateRepeatVisibility(form, rawValues);
    updateRepeats(form, activeRows, rawValues);
    updateRepeatTables(form, rawValues, activeRows);
    updateRepeatTableCellConditions(form, rawValues);
    state.values = collectControlValues(form, (control) => {
      const row = control.closest(".ui2-field");
      return !control.disabled && (!row || activeRows.get(row) !== false);
    });
    const preview = document.getElementById("ui2-preview");
    if (preview) {
      preview.textContent = JSON.stringify(state.values, null, 2);
    }
  }

  function resetModuleForm(form) {
    if (!form) {
      return;
    }
    state.serverSelections = {};
    clearFileReselectionWarnings();
    state.jobSelections = {};
    setSubmittedRunContext(null);
    state.jobEvents.reset("", state.moduleId);
    applyInputPayload(defaultInputPayload(), { clearMissing: true });
    beginRuntimeOutputContext(state.moduleId);
    clearRuntimeOutputs(form);
    clearSubmitResponse();
    setSubmitStatus(document.getElementById("ui2-submit-status"), "", "");
  }

  async function submitModule(form) {
    syncValues(form);
    const endpoint = moduleSubmitEndpoint();
    const status = document.getElementById("ui2-submit-status");
    if (!endpoint) {
      setSubmitStatus(status, "This module does not have a runtime endpoint yet.", "error");
      return { ok: false, error: "No runtime endpoint" };
    }

    const invalid = validateModuleForm(form);
    if (invalid) {
      setSubmitStatus(status, invalid.message, "error");
      showLegacyMessagePayload({ error: invalid.message }, { force: true });
      invalid.control?.focus();
      return { ok: false, error: invalid.message };
    }

    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) {
      submitButton.disabled = true;
    }
    stopJobPolling();
    clearRuntimeOutputs(form);
    setSubmitStatus(status, `Submitting to ${endpoint}`, "pending");

    try {
      await refreshSessionState();
      if (!state.session.logon) {
        throw new Error("You must be logged on to submit");
      }
      const uuid = createUuid();
      const contextToken = beginJobOutputContext(state.moduleId, uuid);
      state.jobEvents.reset(uuid, state.moduleId);
      state.jobEvents.setLifecycle({ state: "submitting" });
      refreshTestScenarioVerification("submitting");
      const response = await fetch(endpoint, {
        method: "POST",
        body: buildSubmitFormData(form, uuid),
        credentials: "same-origin"
      });
      const payload = await parseJsonResponse(response, "Runtime");
      if (!runtimeOutputContextMatches(contextToken)) {
        return { ok: false, error: "Submission context changed before the response arrived." };
      }
      state.submitResponse = payload;
      showLegacyMessagePayload(payload);
      if (!response.ok || payload.error || payload._status === "failed") {
        throw new Error(payload.error || `Runtime returned HTTP ${response.status}`);
      }
      const jobUuid = payload._uuid || uuid;
      if (jobUuid !== uuid) {
        contextToken.jobUuid = jobUuid;
        state.runtimeOutputContext.jobUuid = jobUuid;
      }
      state.jobEvents.setLifecycle({ state: "running", run: jobUuid });
      refreshTestScenarioVerification("running");
      applyRuntimePayload(payload, contextToken);
      setSubmitStatus(status, `Started${jobUuid ? ` (${jobUuid})` : ""}`, "ok");
      renderSubmitResponse(payload);
      if (jobUuid && !isTerminalStatus(runtimeStatus(payload))) {
        startJobPolling(jobUuid, form, status);
      }
      if (isReactWorkbenchView(state.view)) {
        setSubmittedRunContext({
          uuid: jobUuid,
          values: cloneUi2Value(state.values)
        });
      }
      return {
        ok: true,
        uuid: jobUuid,
        values: cloneUi2Value(state.values)
      };
    } catch (error) {
      state.jobEvents.setLifecycle({ state: "failed", error: error.message });
      setSubmitStatus(status, error.message, "error");
      renderSubmitResponse({ error: error.message });
      return { ok: false, error: error.message };
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
      }
    }
  }

  async function runModuleAction(field, button, statusNode) {
    const form = document.getElementById("ui2-form");
    const actionId = field?.id || "";
    if (!form || !actionId) {
      setSubmitStatus(statusNode, "Action is not available.", "error");
      return { ok: false, error: "Action is not available" };
    }

    syncValues();
    const endpoint = moduleActionEndpointFor(state.moduleId);
    if (!endpoint) {
      setSubmitStatus(statusNode, "This action does not have a runtime endpoint yet.", "error");
      return { ok: false, error: "No action endpoint" };
    }

    if (button) {
      button.disabled = true;
    }
    setSubmitStatus(statusNode, `Running ${field.buttontext || field.label || actionId}`, "pending");

    try {
      await refreshSessionState();
      if (!state.session.logon) {
        throw new Error("You must be logged on to run this action");
      }
      const response = await fetch(endpoint, {
        method: "POST",
        body: buildActionFormData(form, field),
        credentials: "same-origin"
      });
      const payload = await parseJsonResponse(response, "Action");
      if (!response.ok || payload.error || runtimeStatus(payload) === "failed" || runtimeStatus(payload) === "error") {
        throw new Error(payload.error || `Action returned HTTP ${response.status}`);
      }
      applyActionPayload(payload);
      const status = runtimeStatus(payload) || "complete";
      setSubmitStatus(statusNode, statusLabel(status), statusKind(status));
      return { ok: true, payload };
    } catch (error) {
      setSubmitStatus(statusNode, error.message, "error");
      showLegacyMessagePayload({ error: error.message }, { force: true });
      return { ok: false, error: error.message };
    } finally {
      if (button) {
        button.disabled = false;
      }
    }
  }

  async function runHookButton(field, button, statusNode, filePayload) {
    const form = document.getElementById("ui2-form");
    if (!form || !field?.hook) {
      setSubmitStatus(statusNode, "Hook is not available.", "error");
      return { ok: false, error: "Hook is not available" };
    }

    syncValues();
    const fileMode = hookFileMode(field);
    if (fileMode && !filePayload) {
      setSubmitStatus(statusNode, "Choose a file for this hook first.", "error");
      return { ok: false, error: "Choose a file for this hook first" };
    }

    if (button) {
      button.disabled = true;
    }
    setSubmitStatus(statusNode, `Running ${field.buttontext || field.label || field.id || "hook"}`, "pending");

    try {
      await refreshSessionState();
      if (!state.session.logon) {
        throw new Error("You must be logged on to run this hook");
      }
      const response = await fetch(legacyEndpoint("", "ajax/sys/get_defaults.php"), {
        method: "POST",
        body: buildHookFormData(form, field, filePayload),
        credentials: "same-origin"
      });
      const payload = await parseJsonResponse(response, "Hook");
      if (!response.ok || payload.error) {
        throw new Error(payload.error || `Hook returned HTTP ${response.status}`);
      }
      applyInputPayload(payload);
      setSubmitStatus(statusNode, "Defaults updated", "complete");
      return { ok: true, payload };
    } catch (error) {
      setSubmitStatus(statusNode, error.message, "error");
      showLegacyMessagePayload({ error: error.message }, { force: true });
      return { ok: false, error: error.message };
    } finally {
      if (button) {
        button.disabled = false;
      }
    }
  }

  function hookFileMode(field) {
    const mode = String(field?.file || "").toLowerCase();
    return mode && mode !== "__fields:file__" ? mode : "";
  }

  function readHookLocalFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => resolve(event.target?.result || "");
      reader.onerror = () => reject(new Error("Unable to read selected file"));
      reader.readAsText(file);
    });
  }

  function moduleActionEndpointFor(moduleId) {
    const id = sanitizeModuleId(moduleId || "");
    if (!id) {
      return "";
    }
    const base = params.get("actionBase") || legacyEndpoint("", "ajax/action");
    return `${base.replace(/\/+$/, "")}/${encodeURIComponent(id)}.php`;
  }

  function buildActionFormData(form, field) {
    const formData = new FormData();
    const actionData = stringValue(field?.actiondata || "_allformdata");
    const allData = !actionData || actionData === "_allformdata";
    const requested = new Set(actionData.split(",").map((id) => id.trim()).filter(Boolean));

    Object.entries(state.values || {}).forEach(([id, value]) => {
      if (allData || requested.has(id)) {
        appendFormValue(formData, id, value);
      }
    });
    if (allData) {
      appendSelectedFiles(formData, form);
    }

    formData.set("_action", field?.id || "");
    formData.set("_window", window.name);
    formData.set("_project", state.session.project || "no_project_specified");
    formData.set("_logon", state.session.logon || "");
    formData.set("_height", String(Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0)));
    formData.set("_width", String(Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0)));
    return formData;
  }

  function buildHookFormData(form, field, filePayload) {
    const formData = new FormData();
    const hookData = stringValue(field?.hookdata || "");
    const allData = hookData === "_allformdata";
    const requested = new Set(hookData.split(",").map((id) => id.trim()).filter(Boolean));

    Object.entries(state.values || {}).forEach(([id, value]) => {
      if (allData || requested.has(id)) {
        appendFormValue(formData, id, value);
      }
    });
    if (allData) {
      appendSelectedFiles(formData, form);
    }

    if (filePayload?.source === "local") {
      formData.set("_filedata", filePayload.data || "");
    } else if (filePayload?.source === "server") {
      formData.set("_file_enc_to_load", filePayload.encodedPath || "");
    }

    formData.set("hook", field?.hook || "");
    formData.set("_window", window.name);
    formData.set("_project", state.session.project || "no_project_specified");
    formData.set("_logon", state.session.logon || "");
    formData.set("_height", String(Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0)));
    formData.set("_width", String(Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0)));
    return formData;
  }

  function applyActionPayload(payload) {
    if (!payload || typeof payload !== "object") {
      return;
    }
    if (payload.fields && typeof payload.fields === "object") {
      applyActionFields(payload.fields);
    }
    if (Array.isArray(payload.actions)) {
      payload.actions.forEach(applyActionInstruction);
    }
    if (payload.summary) {
      showLegacyMessagePayload({
        _message: {
          icon: actionMessageIcon(payload.status),
          text: payload.summary
        }
      }, { force: true });
    } else {
      showLegacyMessagePayload(payload);
    }
  }

  function applyActionInstruction(instruction) {
    if (!instruction || typeof instruction !== "object") {
      return;
    }
    const action = stringValue(instruction.action).toLowerCase();
    if (action === "set_fields") {
      applyActionFields(instruction.fields || {});
      return;
    }
    if (action === "clear_fields") {
      clearActionFields(instruction.fields || []);
      return;
    }
    if (action === "message" || action === "dialog") {
      showLegacyMessagePayload({
        _message: {
          icon: actionMessageIcon(instruction.level),
          text: instruction.text || ""
        }
      }, { force: true });
    }
  }

  function applyActionFields(fields) {
    const inputs = {};
    const outputs = {};
    Object.entries(fields || {}).forEach(([id, value]) => {
      const field = moduleFieldById(id);
      if (field?.role === "output") {
        outputs[id] = value;
      } else {
        inputs[id] = value;
      }
    });
    if (Object.keys(inputs).length) {
      applyInputPayload(inputs);
    }
    if (Object.keys(outputs).length) {
      applyRuntimePayload(outputs);
    }
  }

  function clearActionFields(ids) {
    const inputs = {};
    const outputs = {};
    (Array.isArray(ids) ? ids : []).forEach((id) => {
      const field = moduleFieldById(id);
      if (field?.role === "output") {
        outputs[id] = "";
      } else if (field?.id) {
        inputs[id] = "";
      }
    });
    if (Object.keys(inputs).length) {
      applyInputPayload(inputs);
    }
    if (Object.keys(outputs).length) {
      applyRuntimePayload(outputs);
    }
  }

  function actionMessageIcon(status) {
    return /warn|fail|error/i.test(stringValue(status)) ? "warning.png" : "information.png";
  }

  function dispatchUi2Event(name, detail) {
    if (typeof window.dispatchEvent !== "function" || typeof CustomEvent !== "function") {
      return;
    }
    window.dispatchEvent(new CustomEvent(name, { detail }));
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
    formData.set("_runtime_protocol", "1");
    formData.set("_runtime_capabilities", JSON.stringify([
      "job-events",
      "plot-append",
      "structure-frames"
    ]));
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
    const groups = new Map();
    form.querySelectorAll(".ui2-native-file[data-field-id]").forEach((picker) => {
      const id = picker.dataset.fieldId;
      if (!id || picker.disabled || !picker.files || !picker.files.length) {
        return;
      }
      const repeatIndex = repeatIndexValue(picker.dataset.repeatTableIndex);
      removeServerSelection(id, repeatIndex);
      const group = fileSelectionGroup(groups, id);
      group.local.push({
        id,
        repeatIndex,
        submitId: repeatFileSubmitId(moduleFieldById(id), repeatIndex),
        files: Array.from(picker.files)
      });
    });
    Object.values(state.serverSelections || {}).forEach((selection) => {
      const field = moduleFieldById(selection?.id);
      if (!selection?.id || !selection.encodedPath || !fieldIsFileLike(field)) {
        return;
      }
      if (!repeatFileSelectionIsActive(form, selection.id, selection.repeatIndex)) {
        return;
      }
      fileSelectionGroup(groups, selection.id).server.push(Object.assign({}, selection, {
        submitId: repeatFileSubmitId(field, selection.repeatIndex)
      }));
    });
    groups.forEach((group, id) => {
      clearFormDataFileField(formData, id);
      group.server
        .sort(compareFileSelectionRows)
        .forEach((selection) => appendServerSelection(formData, selection));
      group.local
        .sort(compareFileSelectionRows)
        .forEach((selection) => appendLocalFileSelection(formData, selection));
    });
  }

  function fileSelectionGroup(groups, id) {
    if (!groups.has(id)) {
      groups.set(id, { local: [], server: [] });
    }
    return groups.get(id);
  }

  function repeatIndexValue(value) {
    return value == null || value === "" ? null : Number(value);
  }

  function compareFileSelectionRows(left, right) {
    const leftIndex = left?.repeatIndex == null ? -1 : Number(left.repeatIndex);
    const rightIndex = right?.repeatIndex == null ? -1 : Number(right.repeatIndex);
    return leftIndex - rightIndex;
  }

  function clearFormDataFileField(formData, id) {
    formData.delete(id);
    formData.delete(`${id}[]`);
    formData.delete(`${id}_altval[]`);
    formData.delete(`_selaltval_${id}`);
    formData.delete(`_decodepath_${id}`);
    formData.delete(`_html_${id}_altval`);
  }

  function appendLocalFileSelection(formData, selection) {
    const key = selection.submitId === selection.id && selection.repeatIndex != null
      ? `${selection.id}[]`
      : selection.submitId;
    selection.files.forEach((file) => formData.append(key, file));
  }

  function appendServerSelection(formData, selection) {
    const field = moduleFieldById(selection?.id);
    if (!selection?.id || !selection.encodedPath || !fieldIsFileLike(field)) {
      return;
    }
    const submitId = selection.submitId || selection.id;
    if (selection.type === "rpath") {
      if (submitId === selection.id) {
        formData.append(selection.repeatIndex != null ? `${selection.id}[]` : selection.id, selection.encodedPath);
        formData.append(`_decodepath_${selection.id}`, "");
      } else {
        formData.append(submitId, selection.encodedPath);
        formData.append(`_decodepath_${submitId}`, "");
      }
      return;
    }
    if (submitId === selection.id) {
      formData.set(`_selaltval_${selection.id}`, `${selection.id}_altval`);
      formData.append(`${selection.id}_altval[]`, selection.encodedPath);
      formData.set(`_html_${selection.id}_altval`, `<i>Server</i>: ${selection.path || "selected file"}`);
    } else {
      formData.set(`_selaltval_${submitId}`, `${submitId}_altval`);
      formData.append(`${submitId}_altval[]`, selection.encodedPath);
      formData.set(`_html_${submitId}_altval`, `<i>Server</i>: ${selection.path || "selected file"}`);
    }
  }

  function repeatFileSubmitId(field, repeatIndex) {
    const controller = repeatControllerId(field?.repeat || "");
    if (!field?.repeatcondition || !controller || repeatIndex == null) {
      return field?.id || "";
    }
    return `${controller}-${field.id}-${repeatIndex}`;
  }

  function repeatFileSelectionIsActive(form, id, repeatIndex) {
    if (repeatIndex == null || !form) {
      return true;
    }
    const control = Array.from(form.querySelectorAll(`[data-field-id="${cssEscape(id)}"]`)).find((item) => {
      return String(item.dataset.repeatTableIndex ?? "") === String(repeatIndex);
    });
    return !control || !control.disabled;
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
      const hasNestedValues = value.some((item) => Array.isArray(item));
      value.forEach((item, index) => {
        if (hasNestedValues) {
          appendFormValue(formData, `${id}[${index}]`, item);
          return;
        }
        formData.append(`${id}[]`, item == null ? "" : item);
      });
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

  function showLegacyMessagePayload(payload, options = {}) {
    const message = legacyMessageFromPayload(payload);
    if (!message) {
      return false;
    }
    const key = `${message.icon || ""}\n${message.text || ""}\n${message.ptext || ""}`;
    if (!options.force && key && state.lastLegacyMessageKey === key) {
      return false;
    }
    state.lastLegacyMessageKey = key;
    showLegacyMessageDialog(message);
    return true;
  }

  function legacyMessageFromPayload(payload) {
    if (!payload || typeof payload !== "object") {
      return null;
    }
    if (payload._message) {
      if (typeof payload._message === "string") {
        return { icon: "information.png", text: payload._message };
      }
      if (typeof payload._message === "object") {
        return {
          icon: payload._message.icon || legacyMessageIcon(payload),
          text: payload._message.text || payload._message.message || payload._message.status || "",
          ptext: payload._message.ptext || ""
        };
      }
    }
    if (payload.error) {
      return { icon: "warning.png", text: payload.error };
    }
    return null;
  }

  function legacyMessageIcon(payload) {
    const status = runtimeStatus(payload);
    if (status === "failed" || status === "error") {
      return "warning.png";
    }
    return "information.png";
  }

  function showLegacyMessageDialog(message) {
    let overlay = document.getElementById("ui2-legacy-message-dialog");
    if (overlay) {
      overlay.remove();
    }
    overlay = el("div", "ui2-dialog-overlay ui2-legacy-message-overlay");
    overlay.id = "ui2-legacy-message-dialog";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "ui2-legacy-message-title");

    const panel = el("section", "ui2-dialog ui2-legacy-message-dialog");
    const icon = legacyMessageIconElement(message.icon || "information.png");
    const body = el("div", "ui2-legacy-message-body");
    const title = el("h2", "ui2-legacy-message-title", legacyMessageTitle(message.icon));
    title.id = "ui2-legacy-message-title";
    const text = el("div", "ui2-legacy-message-text");
    text.innerHTML = sanitizeLegacyMessageHtml(message.text || "");
    body.append(title, text);
    if (message.ptext) {
      const detail = el("pre", "ui2-legacy-message-detail");
      detail.textContent = stripHtml(message.ptext);
      body.appendChild(detail);
    }

    const close = el("button", "ui2-dialog-close ui2-legacy-message-close", "Close");
    close.type = "button";
    close.addEventListener("click", () => overlay.remove());
    panel.append(icon, body, close);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    close.focus();
  }

  function legacyMessageIconElement(iconName) {
    const img = document.createElement("img");
    img.className = "ui2-legacy-message-icon";
    img.alt = "";
    img.src = `../pngs/${sanitizeLegacyIconName(iconName)}`;
    img.addEventListener("error", () => {
      img.replaceWith(el("span", "ui2-legacy-message-fallback-icon", "!"));
    }, { once: true });
    return img;
  }

  function sanitizeLegacyIconName(iconName) {
    const value = String(iconName || "information.png").split("/").pop();
    return /^[A-Za-z0-9_.-]+$/.test(value) ? value : "information.png";
  }

  function legacyMessageTitle(iconName) {
    return /warn|error|toast/i.test(String(iconName || "")) ? "Warning" : "Message";
  }

  function sanitizeLegacyMessageHtml(html) {
    const template = document.createElement("template");
    template.innerHTML = String(html || "");
    template.content.querySelectorAll("script, style, iframe, object, embed").forEach((node) => node.remove());
    template.content.querySelectorAll("*").forEach((node) => {
      Array.from(node.attributes).forEach((attr) => {
        if (/^on/i.test(attr.name) || attr.name === "style") {
          node.removeAttribute(attr.name);
        }
      });
    });
    return template.innerHTML || escapeHtml(stripHtml(html));
  }

  function clearRuntimeOutputs(scope) {
    state.runtimeOutputs = {};
    state.nglFrameHistories = {};
    clearRuntimeOutputAvailability();
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
        // Density contour and opacity are browser preferences for one live
        // job.  This is the actual new-submission boundary; retaining either
        // value here can make a new density range invalid before submission.
        clearNglOutput(output, { resetDensityPreferences: true });
        return;
      }
      if (output.dataset.outputType === "image") {
        renderImageOutput(output, "");
        return;
      }
      if (output instanceof HTMLProgressElement || output.dataset.outputType === "progress") {
        output.value = 0;
        return;
      }
      output.textContent = outputPlaceholderForType(output.dataset.outputType || "");
    });
  }

  function runtimeOutputToken() {
    return {
      moduleId: state.runtimeOutputContext.moduleId || "",
      jobUuid: state.runtimeOutputContext.jobUuid || "",
      generation: state.runtimeOutputContext.generation || 0
    };
  }

  function runtimeOutputContextMatches(token) {
    if (!token) {
      return false;
    }
    return token.moduleId === (state.runtimeOutputContext.moduleId || "")
      && token.jobUuid === (state.runtimeOutputContext.jobUuid || "")
      && token.generation === (state.runtimeOutputContext.generation || 0);
  }

  function beginRuntimeOutputContext(moduleId, jobUuid = "") {
    state.runtimeOutputContext = {
      moduleId: sanitizeModuleId(moduleId || ""),
      jobUuid: stringValue(jobUuid),
      generation: (state.runtimeOutputContext.generation || 0) + 1
    };
    state.runtimeOutputs = {};
    state.nglFrameHistories = {};
    clearRuntimeOutputAvailability();
    return runtimeOutputToken();
  }

  function beginJobOutputContext(moduleId, jobUuid) {
    return beginRuntimeOutputContext(moduleId || state.moduleId, jobUuid || "");
  }

  function startJobPolling(
      uuid, form, statusNode, getLastMsg = true, getInput = false,
      subscribeFirst = true) {
    stopJobPolling();
    const contextToken = runtimeOutputToken();
    state.activeJob = {
      uuid,
      form,
      statusNode,
      delay: 2000,
      getInput,
      subscribeAfterFirstPoll: !subscribeFirst,
      contextToken,
      timer: null
    };
    if (subscribeFirst) {
      subscribeRuntimeMessages(uuid);
    }
    pollJobResults(uuid, form, statusNode, 0, getLastMsg, getInput, contextToken);
  }

  function stopJobPolling() {
    if (state.activeJob?.timer) {
      window.clearTimeout(state.activeJob.timer);
    }
    unsubscribeRuntimeMessages();
    state.activeJob = null;
  }

  async function pollJobResults(uuid, form, statusNode, lastDelay, getLastMsg, getInput = false, contextToken = null) {
    const activeToken = contextToken || state.activeJob?.contextToken || null;
    if (!uuid || state.activeJob?.uuid !== uuid || !form?.isConnected || !runtimeOutputContextMatches(activeToken)) {
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
      if (state.activeJob?.uuid !== uuid || !form?.isConnected || !runtimeOutputContextMatches(activeToken)) {
        return;
      }
      state.submitResponse = payload;
      showLegacyMessagePayload(payload);
      if (getInput) {
        if (payload?._getinput) {
          applyInputPayload(payload._getinput, { reselectLocalFiles: true });
          selectTestScenarioForInputs(payload._getinput);
          if (isReactWorkbenchView(state.view)) {
            notifyWorkbenchReattached(
              uuid,
              payload._getinput,
              savedInputRestoreError(payload, uuid, payload._getinput),
              savedInputRestoreWarnings(payload._getinput)
            );
          }
        } else if (isReactWorkbenchView(state.view)) {
          notifyWorkbenchReattached(uuid, null, savedInputRestoreError(payload, uuid));
        }
        if (state.activeJob?.uuid === uuid) {
          state.activeJob.getInput = false;
        }
      }
      applyRuntimePayload(payload, activeToken);
      if (state.activeJob?.uuid === uuid && state.activeJob.subscribeAfterFirstPoll) {
        state.activeJob.subscribeAfterFirstPoll = false;
        subscribeRuntimeMessages(uuid);
      }
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
          () => pollJobResults(uuid, form, statusNode, nextDelay, true, false, activeToken),
          nextDelay
        );
      }
    } catch (error) {
      setSubmitStatus(statusNode, error.message, "error");
      if (state.activeJob?.uuid === uuid) {
        const nextDelay = nextPollDelay(lastDelay);
        state.activeJob.timer = window.setTimeout(
          () => pollJobResults(uuid, form, statusNode, nextDelay, true, false, activeToken),
          nextDelay
        );
      }
    }
  }

  async function applySavedJobInput(uuid) {
    let payload = null;
    try {
      payload = await fetchJobInputPayload(uuid);
    } catch (error) {
      console.warn("Unable to restore saved job input", error);
      return null;
    }
    if (!payload?._getinput) {
      return null;
    }
    applyInputPayload(payload._getinput, { reselectLocalFiles: true });
    selectTestScenarioForInputs(payload._getinput);
    return payload._getinput;
  }

  function savedInputRestoreError(payload, uuid, inputs = null) {
    const detail = stringValue(payload?._getinputerror || payload?.saved_input_error).trim();
    if (detail) {
      return `Could not restore inputs for run ${uuid}: ${detail}`;
    }
    if (inputs && typeof inputs === "object") {
      return "";
    }
    return `Could not restore inputs for run ${uuid}. The saved input record is unavailable; return to Job Manager or contact an administrator.`;
  }

  function unrecoverableSavedLocalFiles(inputs) {
    if (!inputs || typeof inputs !== "object") {
      return [];
    }
    return (state.module?.fields || []).flatMap((field) => {
      if (!fieldIsFileLike(field) || !fileModes(field.type).includes("local") || !Object.prototype.hasOwnProperty.call(inputs, field.id)) {
        return [];
      }
      const savedValues = valueList(inputs[field.id]).filter((value) => stringValue(value));
      if (!savedValues.length) {
        return [];
      }
      return savedValues.flatMap((savedValue, index) => {
        const repeatIndex = savedValues.length > 1 ? index : null;
        const selection = state.serverSelections[`${field.id}:${repeatIndex == null ? "" : repeatIndex}`];
        return selection?.encodedPath ? [] : [{
          id: field.id,
          label: field.label || field.id,
          repeatIndex,
          savedValue: stringValue(savedValue)
        }];
      });
    });
  }

  function savedInputRestoreWarnings(inputs) {
    return unrecoverableSavedLocalFiles(inputs).map((warning) => (
      `${warning.label} (${warning.savedValue}) was selected from this browser and must be selected again before submitting a new run.`
    ));
  }

  function notifyWorkbenchReattached(uuid, savedValues = null, restoreError = "", restoreWarnings = []) {
    const values = savedValues && typeof savedValues === "object"
      ? cloneUi2Value(savedValues)
      : {};
    setSubmittedRunContext({
      uuid,
      values,
      restoreError: stringValue(restoreError),
      restoreWarnings: Array.isArray(restoreWarnings) ? restoreWarnings.map(stringValue).filter(Boolean) : []
    });
    dispatchUi2Event("ui2:workbench-reattached", {
      moduleId: state.moduleId,
      uuid,
      values,
      restoreError: stringValue(restoreError),
      restoreWarnings: Array.isArray(restoreWarnings) ? restoreWarnings.map(stringValue).filter(Boolean) : []
    });
  }

  function setSubmittedRunContext(context) {
    state.submittedRunContext = context ? cloneUi2Value(context) : null;
    notifyWorkbenchRunContext();
  }

  function notifyWorkbenchRunContext() {
    state.workbenchRunContextListeners.forEach((listener) => {
      try {
        listener();
      } catch (error) {
        window.setTimeout(() => { throw error; }, 0);
      }
    });
  }

  function subscribeWorkbenchRunContext(listener) {
    if (typeof listener !== "function") {
      return () => {};
    }
    state.workbenchRunContextListeners.add(listener);
    listener();
    return () => state.workbenchRunContextListeners.delete(listener);
  }

  function notifyRuntimeOutputs() {
    state.runtimeOutputListeners.forEach((listener) => {
      try {
        listener();
      } catch (error) {
        window.setTimeout(() => { throw error; }, 0);
      }
    });
  }

  function clearRuntimeOutputAvailability() {
    state.runtimeOutputAvailability = {};
    notifyRuntimeOutputs();
  }

  function markRuntimeOutputAvailable(id) {
    if (!id || state.runtimeOutputAvailability[id]) {
      return;
    }
    state.runtimeOutputAvailability = {
      ...state.runtimeOutputAvailability,
      [id]: true
    };
    notifyRuntimeOutputs();
  }

  function subscribeRuntimeOutputs(listener) {
    if (typeof listener !== "function") {
      return () => {};
    }
    state.runtimeOutputListeners.add(listener);
    return () => state.runtimeOutputListeners.delete(listener);
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
    if (!response.ok) {
      return {};
    }
    return parseJsonResponse(response, "UI2 job input");
  }

  function applyInputPayload(inputs, options = {}) {
    if (!inputs || typeof inputs !== "object") {
      return;
    }
    const entries = Object.entries(inputs).filter(([id]) => id && !id.startsWith("_"));
    const dependencyIds = new Set([
      ...conditionalRepeatDependencyIds(document.getElementById("ui2-form")),
      ...repeaterControllerIds()
    ]);
    const restored = new Set();
    entries.forEach(([id, value]) => {
      if (!dependencyIds.has(id)) {
        return;
      }
      setInputControlValue(id, value);
      restored.add(id);
    });
    if (restored.size) {
      syncValues();
    }
    entries.forEach(([id, value]) => {
      if (restored.has(id)) {
        return;
      }
      setInputControlValue(id, value);
    });
    if (options.clearMissing) {
      clearMissingInputValues(new Set(entries.map(([id]) => id)));
    }
    // Repeat controllers may create the file controls needed for a restored
    // server selection.  Apply the encoded selection after all saved values
    // have rebuilt those rows so it wins over the decoded backend path.
    restoreServerSelections(inputs);
    syncValues();
    if (options.reselectLocalFiles) {
      setFileReselectionWarnings(unrecoverableSavedLocalFiles(inputs));
    }
  }

  function defaultInputPayload() {
    const payload = {};
    (state.module?.fields || []).forEach((field) => {
      if (!field?.id || field.role === "output" || isLayoutLabel(field)) {
        return;
      }
      payload[field.id] = defaultValueForField(field);
    });
    return payload;
  }

  function defaultValueForField(field) {
    const type = String(field.type || "text").toLowerCase();
    if (type === "checkbox") {
      return checkboxDefault(field, 0);
    }
    if (type === "radio") {
      return field.default == null ? "" : field.default;
    }
    if (Array.isArray(field.default)) {
      return JSON.parse(JSON.stringify(field.default));
    }
    return field.default == null ? "" : field.default;
  }

  function repeaterControllerIds() {
    const ids = new Set();
    (state.module?.fields || []).forEach((field) => {
      if (field?.id && isRepeater(field)) {
        ids.add(field.id);
      }
    });
    return Array.from(ids);
  }

  function clearMissingInputValues(ids) {
    const form = document.getElementById("ui2-form");
    if (!form) {
      return;
    }
    fieldControls(form).forEach((control) => {
      const id = control.dataset.fieldId;
      if (!id || ids.has(id) || control.dataset.outputFieldId) {
        return;
      }
      if (control.type === "checkbox" || control.type === "radio") {
        control.checked = false;
      } else if (control.type !== "file") {
        control.value = "";
      }
    });
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
      const submittedId = match[1];
      const submittedField = submittedFileField(submittedId);
      if (!submittedField) {
        return;
      }
      const { id, field, repeatIndex: submittedRepeatIndex } = submittedField;
      if (!fieldIsFileLike(field)) {
        return;
      }
      const altId = stringValue(firstValue(altField)) || `${submittedId}_altval`;
      const encodedPaths = valueList(inputs[altId] ?? inputs[`${submittedId}_altval`]).map(stringValue).filter(Boolean);
      if (!encodedPaths.length) {
        return;
      }
      const displayValues = valueList(inputs[`_html_${altId}`] ?? inputs[`_html_${submittedId}_altval`]);
      encodedPaths.forEach((encodedPath, index) => {
        const repeatIndex = submittedRepeatIndex == null
          ? serverSelectionRepeatIndex(field, encodedPaths, index)
          : submittedRepeatIndex;
        restoreServerSelection(id, encodedPath, stringValue(displayValues[index] ?? displayValues[0]), repeatIndex);
      });
      restored.add(submittedId);
    });

    Object.entries(inputs || {}).forEach(([key, value]) => {
      const match = /^(.+)_altval$/.exec(key);
      if (!match || key.startsWith("_html_")) {
        return;
      }
      const submittedId = match[1];
      if (restored.has(submittedId)) {
        return;
      }
      const submittedField = submittedFileField(submittedId);
      if (!submittedField) {
        return;
      }
      const { id, field, repeatIndex: submittedRepeatIndex } = submittedField;
      const encodedPaths = valueList(value).map(stringValue).filter(Boolean);
      if (!encodedPaths.length || !fieldIsFileLike(field)) {
        return;
      }
      const displayValues = valueList(inputs[`_html_${key}`]);
      encodedPaths.forEach((encodedPath, index) => {
        const repeatIndex = submittedRepeatIndex == null
          ? serverSelectionRepeatIndex(field, encodedPaths, index)
          : submittedRepeatIndex;
        restoreServerSelection(id, encodedPath, stringValue(displayValues[index] ?? displayValues[0]), repeatIndex);
      });
    });

    Object.entries(inputs || {}).forEach(([key]) => {
      const match = /^_decodepath_(.+)$/.exec(key);
      if (!match) {
        return;
      }
      const submittedId = match[1];
      const submittedField = submittedFileField(submittedId);
      if (!submittedField) {
        return;
      }
      const { id, field, repeatIndex: submittedRepeatIndex } = submittedField;
      if (String(field?.type || "").toLowerCase() !== "rpath") {
        return;
      }
      const encodedPaths = valueList(inputs[submittedId] ?? inputs[id]).map(stringValue).filter(Boolean);
      encodedPaths.forEach((encodedPath, index) => {
        restoreServerSelection(
          id,
          encodedPath,
          "",
          submittedRepeatIndex == null
            ? serverSelectionRepeatIndex(field, encodedPaths, index)
            : submittedRepeatIndex);
      });
    });
  }

  function serverSelectionRepeatIndex(field, encodedPaths, index) {
    if (repeatControllerId(field?.repeat || "")) {
      return index;
    }
    return encodedPaths.length > 1 ? index : null;
  }

  function submittedFileField(submittedId) {
    const field = moduleFieldById(submittedId);
    if (field) {
      return { id: submittedId, field, repeatIndex: null };
    }
    const fields = Array.isArray(state.module?.fields) ? state.module.fields : [];
    for (const candidate of fields) {
      const controller = repeatControllerId(candidate?.repeat || "");
      if (!candidate?.repeatcondition || !controller || !candidate?.id) {
        continue;
      }
      const prefix = `${controller}-${candidate.id}-`;
      const suffix = submittedId.startsWith(prefix) ? submittedId.slice(prefix.length) : "";
      const match = /^\d+$/.test(suffix) ? [suffix, suffix] : null;
      if (match) {
        return { id: candidate.id, field: candidate, repeatIndex: Number(match[1]) };
      }
    }
    return null;
  }

  function restoreServerSelection(id, encodedPath, displayHtml, repeatIndex) {
    const field = moduleFieldById(id);
    if (!fieldIsFileLike(field)) {
      return;
    }
    const path = serverSelectionDisplayPath(encodedPath, displayHtml);
    setServerSelection(field, repeatIndex, { id: encodedPath });
    const keyName = serverSelectionKey(field, repeatIndex);
    if (state.serverSelections[keyName]) {
      state.serverSelections[keyName].path = path;
    }
    if (repeatIndex == null) {
      setInputControlValue(id, path);
    } else {
      setInputControlValueAtRepeatIndex(id, repeatIndex, path);
    }
  }

  function moduleFieldById(id) {
    const fields = Array.isArray(state.module?.fields) ? state.module.fields : [];
    return fields.find((field) => field?.id === id) || null;
  }

  function firstValue(value) {
    return Array.isArray(value) ? value[0] : value;
  }

  function valueList(value) {
    if (!Array.isArray(value)) {
      return value == null ? [] : [value];
    }
    return value.map((item) => Array.isArray(item) ? firstValue(item) : item);
  }

  function serverSelectionDisplayPath(encodedPath, displayHtml) {
    const display = stripHtml(displayHtml || "").replace(/^\s*Server\s*:\s*/i, "").trim();
    return display || decodeServerFileId(encodedPath).replace(/^\.\//, "");
  }

  function setInputControlValue(id, value) {
    const controls = Array.from(document.querySelectorAll(`[data-field-id="${cssEscape(id)}"]`))
      .filter((control) => !control.dataset.outputFieldId && control.closest("#ui2-form"));
    controls.forEach((control, index) => {
      const controlValue = inputControlValue(value, control, index);
      if (control.type === "file") {
        return;
      }
      if (control.type === "checkbox") {
        const normalized = String(controlValue).toLowerCase();
        control.checked = controlValue === true || normalized === "true" || normalized === "1" || normalized === "on" || normalized === "yes";
      } else if (control.type === "radio") {
        control.checked = String(control.value) === String(controlValue);
      } else {
        control.value = controlValue == null ? "" : String(controlValue);
      }
      control.dispatchEvent(new Event("input", { bubbles: true }));
      control.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }

  function setInputControlValueAtRepeatIndex(id, repeatIndex, value) {
    const controls = Array.from(document.querySelectorAll(`[data-field-id="${cssEscape(id)}"]`))
      .filter((control) => !control.dataset.outputFieldId && control.closest("#ui2-form"));
    controls
      .filter((control) => String(control.dataset.repeatTableIndex ?? "") === String(repeatIndex))
      .forEach((control) => {
        if (control.type !== "file") {
          control.value = value == null ? "" : String(value);
          control.dispatchEvent(new Event("input", { bubbles: true }));
          control.dispatchEvent(new Event("change", { bubbles: true }));
        }
      });
  }

  function inputControlValue(value, control, index) {
    if (!Array.isArray(value)) {
      return value;
    }
    if (control.dataset.matrixRow != null && control.dataset.matrixColumn != null) {
      return matrixDefaultValue(
        value,
        Number(control.dataset.matrixRow || 0),
        Number(control.dataset.matrixColumn || 0)
      );
    }
    if (control.dataset.repeatTableIndex != null) {
      const repeatIndex = Number(control.dataset.repeatTableIndex || 0);
      return value[repeatIndex] ?? value[0] ?? "";
    }
    return value[index] ?? value[0] ?? "";
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

  function createJobEventStore() {
    const listeners = new Set();
    let run = "";
    let moduleId = "";
    let lastSequence = 0;
    let legacySequence = 0;
    let lifecycle = null;
    let channels = {};
    let expectFirstSequence = false;
    let cachedSnapshot = null;
    const seen = new Set();
    const missing = new Set();
    const pending = new Map();

    function invalidateSnapshot() {
      cachedSnapshot = null;
    }

    function notify() {
      invalidateSnapshot();
      const value = snapshot();
      listeners.forEach((listener) => {
        try {
          listener(value);
        } catch (error) {
          window.setTimeout(() => { throw error; }, 0);
        }
      });
    }

    function reset(nextRun = "", nextModuleId = "") {
      run = stringValue(nextRun);
      moduleId = stringValue(nextModuleId);
      lastSequence = 0;
      legacySequence = 0;
      lifecycle = null;
      channels = {};
      expectFirstSequence = Boolean(run);
      seen.clear();
      missing.clear();
      pending.clear();
      notify();
    }

    function commit(event, applied) {
      const channel = channels[event.channel] || {};
      const previous = channel[event.topic] || {
        items: [],
        value: null,
        complete: false,
        lastSequence: 0
      };
      const topic = Object.assign({}, previous, {
        operation: event.operation,
        lastSequence: event.sequence,
        timestamp: event.timestamp
      });
      if (event.operation === "append") {
        topic.items = event.replay === false
          ? [cloneUi2Value(event.payload)]
          : [...(previous.items || []), cloneUi2Value(event.payload)];
      } else if (event.operation === "clear") {
        topic.items = [];
        topic.value = null;
        topic.complete = false;
      } else {
        topic.value = cloneUi2Value(event.payload);
      }
      if (event.operation === "complete") {
        topic.complete = true;
      }
      channels = Object.assign({}, channels, {
        [event.channel]: Object.assign({}, channel, { [event.topic]: topic })
      });
      if (event.channel === "lifecycle") {
        lifecycle = cloneUi2Value(event.payload);
      }
      seen.add(event.sequence);
      pending.delete(event.sequence);
      missing.delete(event.sequence);
      lastSequence = event.sequence;
      expectFirstSequence = false;
      applied.push(event);
    }

    function drainPending(applied) {
      while (pending.has(lastSequence + 1)) {
        commit(pending.get(lastSequence + 1), applied);
      }
    }

    function applyMany(rawEvents) {
      let accepted = false;
      const applied = [];
      (Array.isArray(rawEvents) ? rawEvents : [rawEvents])
        .map(normalizeJobEvent)
        .filter(Boolean)
        .sort((left, right) => left.sequence - right.sequence)
        .forEach((event) => {
          if ((run && event.run !== run) || (moduleId && event.module !== moduleId) || seen.has(event.sequence)) {
            return;
          }
          if (!run) {
            run = event.run;
          }
          if (!moduleId) {
            moduleId = event.module;
          }

          const expected = lastSequence + 1;
          if (!lastSequence && !expectFirstSequence || event.sequence === expected) {
            accepted = true;
            commit(event, applied);
            drainPending(applied);
            return;
          }
          if (event.sequence > expected) {
            accepted = true;
            seen.add(event.sequence);
            pending.set(event.sequence, event);
            for (let sequence = expected; sequence < event.sequence; sequence += 1) {
              if (!seen.has(sequence)) {
                missing.add(sequence);
              }
            }
          }
        });
      if (accepted) {
        notify();
      }
      return { accepted, applied };
    }

    function apply(rawEvent) {
      return applyMany([rawEvent]).accepted;
    }

    function appendLegacyLog(text, nextRun = "", nextModuleId = "") {
      const value = stringValue(text);
      if (!value) {
        return false;
      }
      if (!run) {
        run = stringValue(nextRun);
        moduleId = stringValue(nextModuleId);
      }
      legacySequence += 1;
      const channel = channels.log || {};
      const previous = channel.run || { items: [], value: null, complete: false, lastSequence: 0 };
      const priorText = stringValue(previous.value);
      const complete = isCompleteRuntimeText(value);
      const topic = Object.assign({}, previous, {
        operation: complete ? "complete" : "append",
        items: complete ? [] : previous.items,
        value: mergeRuntimeText(priorText, value),
        legacy: true,
        complete: previous.complete || complete,
        lastSequence: legacySequence
      });
      channels = Object.assign({}, channels, {
        log: Object.assign({}, channel, { run: topic })
      });
      notify();
      return true;
    }

    function setLifecycle(value) {
      lifecycle = cloneUi2Value(value);
      notify();
    }

    function snapshot() {
      if (cachedSnapshot) {
        return cachedSnapshot;
      }
      cachedSnapshot = {
        run,
        module: moduleId,
        lastSequence,
        missingSequences: Array.from(missing).sort((a, b) => a - b),
        pendingSequences: Array.from(pending.keys()).sort((a, b) => a - b),
        lifecycle: cloneUi2Value(lifecycle),
        channels: cloneUi2Value(channels)
      };
      return cachedSnapshot;
    }

    function subscribe(listener) {
      if (typeof listener !== "function") {
        return () => {};
      }
      listeners.add(listener);
      listener(snapshot());
      return () => listeners.delete(listener);
    }

    return { reset, apply, applyMany, appendLegacyLog, setLifecycle, snapshot, subscribe };
  }

  function normalizeJobEvent(rawEvent) {
    if (!rawEvent || typeof rawEvent !== "object") {
      return null;
    }
    const version = Number(rawEvent.version);
    const sequence = Number(rawEvent.sequence);
    const run = stringValue(rawEvent.run);
    const moduleId = stringValue(rawEvent.module);
    const channel = stringValue(rawEvent.channel).toLowerCase();
    const topic = stringValue(rawEvent.topic || "run");
    const operation = stringValue(rawEvent.operation || "replace").toLowerCase();
    if (version !== 1 || !run || !moduleId || !Number.isInteger(sequence) || sequence < 1 || !channel || !topic) {
      return null;
    }
    if (!["append", "replace", "snapshot", "complete", "clear"].includes(operation)) {
      return null;
    }
    return {
      version,
      run,
      module: moduleId,
      sequence,
      timestamp: stringValue(rawEvent.timestamp),
      channel,
      topic,
      operation,
      replay: rawEvent.replay !== false,
      payload: cloneUi2Value(rawEvent.payload)
    };
  }

  function applyJobEventPayload(payload) {
    const events = [];
    if (Array.isArray(payload?._job_events)) {
      events.push(...payload._job_events);
    }
    if (payload?._job_event) {
      events.push(payload._job_event);
    }
    state.jobEvents.applyMany(events).applied.forEach(applyJobEventToOutput);
  }

  function applyJobEventToOutput(event) {
    if (!event || !["plot", "structure"].includes(event.channel)) {
      return;
    }
    markRuntimeOutputAvailable(event.topic);
    const output = document.querySelector(`[data-output-field-id="${cssEscape(event.topic)}"]`);
    if (!output) {
      return;
    }
    if (event.channel === "plot") {
      if (output.dataset.dynamicOutput === "true") {
        updateDynamicOutput(output, event.payload);
        return;
      }
      if (event.operation === "append") {
        appendPlotlyOutput(output, event.payload);
      } else if (event.payload) {
        renderPlotlyOutput(output, event.payload.figure || event.payload);
      }
      return;
    }
    if (event.channel === "structure" && event.payload) {
      if (event.payload.preview_type === "density" || event.payload.type === "density") {
        renderNglDensityUpdate(output, event.payload.density || event.payload);
        return;
      }
      if (event.operation === "append") {
        queue_ngl_coordinate_frame(output, event.payload);
      } else {
        // A structure snapshot may also carry the current live density layer.
        // Passing only .structure loses that layer before the renderer can load it.
        renderNglOutput(output, event.payload);
      }
    }
  }

  function applyRuntimePayload(payload, contextToken = null) {
    if (!payload || typeof payload !== "object") {
      return;
    }
    const activeToken = contextToken || runtimeOutputToken();
    if (!runtimeOutputContextMatches(activeToken)) {
      return;
    }
    showLegacyMessagePayload(payload);
    applyJobEventPayload(payload);
    Object.entries(payload).forEach(([id, value]) => {
      if (id === "_progress") {
        updateProgressOutputs(value);
        return;
      }
      if (id === "_textarea" || id === "_airavata") {
        if (isReactWorkbenchView(state.view)) {
          // Capability-aware drivers continue emitting legacy messages so a
          // legacy client can attach to the same job. Once native events have
          // arrived, they are authoritative and the mirrored textarea stream
          // must not be appended a second time in React. The complete final
          // textarea block is still accepted because it is the authoritative
          // legacy run report and may be richer than the streamed native log.
          const text = stringValue(value);
          if (state.jobEvents.snapshot().lastSequence > 0 && !isCompleteRuntimeText(text)) {
            return;
          }
          state.jobEvents.appendLegacyLog(text, state.activeJob?.uuid || "", state.moduleId);
          return;
        }
        appendRuntimeMessage(value);
        return;
      }
      if (id === "_status") {
        state.jobEvents.setLifecycle({ state: stringValue(value) });
        return;
      }
      if (id.startsWith("_")) {
        return;
      }
      if (!runtimeOutputContextMatches(activeToken)) {
        return;
      }
      state.runtimeOutputs[id] = cloneUi2Value(value);
      markRuntimeOutputAvailable(id);
      updateOutputField(id, value);
    });
    refreshTestScenarioVerification(runtimeStatus(payload));
  }

  function replayRuntimeOutput(id) {
    const contextToken = runtimeOutputToken();
    if (!id) {
      return;
    }
    window.setTimeout(() => {
      if (!runtimeOutputContextMatches(contextToken)) {
        return;
      }
      if (Object.prototype.hasOwnProperty.call(state.runtimeOutputs, id)) {
        updateOutputField(id, state.runtimeOutputs[id]);
      }
    }, 0);
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
    const declaredOutput = document.querySelector(`[data-output-field-id="${cssEscape(id)}"]`);
    const output = declaredOutput || (isReactWorkbenchView(state.view)
      ? null
      : ensureRuntimeOutputField(id, displayLabel(id), runtimeOutputTypeForValue(value)));
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
    if (type === "image") {
      renderImageOutput(output, value);
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
    if (!items.length) {
      group.querySelectorAll(".ui2-dynamic-output-instance").forEach((node) => node.remove());
      group.querySelectorAll(".ui2-dynamic-output-placeholder").forEach((node) => node.remove());
      group.classList.remove("ui2-output-rendered");
      group.textContent = "";
      if (parentRow) {
        parentRow.hidden = true;
      }
      group.append(el("div", "ui2-dynamic-output-placeholder", dynamicOutputPlaceholder({
        label: group.dataset.dynamicLabel,
        id: group.dataset.outputFieldId
      })));
      return;
    }
    if (parentRow) {
      parentRow.hidden = false;
    }
    group.classList.add("ui2-output-rendered");
    group.querySelectorAll(".ui2-dynamic-output-placeholder").forEach((node) => node.remove());
    const existing = new Map();
    group.querySelectorAll(".ui2-dynamic-output-instance").forEach((instance) => {
      const output = instance.querySelector("[data-output-field-id]");
      const id = output?.dataset?.outputFieldId;
      if (id) {
        existing.set(id, { instance, output });
      }
    });
    const active = new Set();
    items.forEach((item) => {
      active.add(item.id);
      let child = existing.get(item.id);
      if (!child) {
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
        child = { instance, output };
      } else {
        const label = child.instance.querySelector(".ui2-dynamic-output-label");
        if (label) {
          label.textContent = item.label;
        }
      }
      const { output } = child;
      updateOutputElement(output, item.value);
    });
    existing.forEach((child, id) => {
      if (!active.has(id)) {
        child.instance.remove();
      }
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

  function imageSource(value) {
    let source;
    if (value && typeof value === "object") {
      source = stringValue(value.src || value.file || value.url || value.path);
    } else {
      source = stringValue(value);
    }
    if (!source || /^(?:data:|blob:|https?:|\/)/i.test(source)) {
      return source;
    }
    // Result paths are rooted at the generated application, not at /ui2/.
    return legacyEndpoint("", source);
  }

  function renderImageOutputShell(field, type) {
    const output = el("div", outputClassForType(type));
    output.dataset.outputFieldId = field.id || "";
    output.dataset.outputType = type;
    const image = document.createElement("img");
    image.className = "ui2-output-image-content";
    image.alt = field.label || field.id || "Generated image";
    image.hidden = true;
    const placeholder = el("div", "ui2-output-image-placeholder", outputPlaceholderForType(type));
    output.append(image, placeholder);
    return output;
  }

  function renderImageOutput(output, value) {
    const image = output.querySelector(".ui2-output-image-content");
    const placeholder = output.querySelector(".ui2-output-image-placeholder");
    const source = imageSource(value);
    if (!image) {
      return;
    }
    if (!source) {
      image.hidden = true;
      if (placeholder) {
        placeholder.hidden = false;
      }
      return;
    }
    image.src = source;
    image.hidden = false;
    if (placeholder) {
      placeholder.hidden = true;
    }
    output.classList.add("ui2-output-rendered");
  }

  function renderTextOutput(output, value) {
    output.classList.add("ui2-output-rendered");
    output.textContent = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  }

  function renderNglOutputShell(field, type) {
    const output = el("div", outputClassForType(type));
    output.dataset.outputFieldId = field.id || "";
    output.dataset.outputType = type;
    // Viewer settings are presentation-only field metadata.
    output._ui2NglViewerConfig = cloneUi2Value(field.viewer || {});
    const savedFrames = state.nglFrameHistories[field.id || ""];
    if (Array.isArray(savedFrames) && savedFrames.length) {
      output._ui2_ngl_frames = savedFrames;
      output._ui2_ngl_pending_frame = savedFrames[savedFrames.length - 1];
    }

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

  function clearNglOutput(output, options = {}) {
    output._ui2NglRenderRevision = (output._ui2NglRenderRevision || 0) + 1;
    disconnectNglOutputObserver(output);
    stopNglFramePlayback(output);
    if (output._ui2NglStage?.dispose) {
      output._ui2NglStage.dispose();
    }
    output._ui2NglStage = null;
    output._ui2NglComponent = null;
    output._ui2NglDensityComponent = null;
    output._ui2NglDensitySurface = null;
    output._ui2NglDensitySurfaces = null;
    output._ui2NglDensitySpecs = null;
    output._ui2NglReps = null;
    output._ui2NglSpecs = null;
    output._ui2NglTrajectory = null;
    output._ui2NglAxesRep = null;
    output._ui2NglTopologyLoadName = null;
    output._ui2NglNeedsVisibleAutoView = false;
    output._ui2_ngl_density_payload = null;
    if (!options.preserveFrames) {
      output._ui2_ngl_frames = null;
      output._ui2_ngl_pending_frame = null;
      output._ui2_ngl_frame_scheduled = false;
    }
    if (options.resetDensityPreferences) {
      output._ui2_ngl_density_user_isovalue = null;
      output._ui2_ngl_density_user_opacity = null;
    }
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
    const structurePayload = payload?.structure || payload;
    const densityPayload = payload?.density || null;
    // Density is deliberately transient: final output/reattachment does not
    // serialize it. Retain it only while this live output element exists.
    const liveDensityPayload = densityPayload?.loadname
      ? densityPayload
      : output._ui2_ngl_density_payload;
    if (!structurePayload?.loadname) {
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
    const topologyLoadName = normalizeNglLoadName(structurePayload.loadname);
    const preserveLiveFrames = output._ui2NglTopologyLoadName === topologyLoadName
      && Array.isArray(output._ui2_ngl_frames)
      && output._ui2_ngl_frames.length
      && output._ui2NglComponent;
    if (preserveLiveFrames && output._ui2NglComponent) {
      output._ui2NglRenderRevision = (output._ui2NglRenderRevision || 0) + 1;
      if (liveDensityPayload?.loadname) {
        renderNglDensityUpdate(output, liveDensityPayload);
      }
      render_ngl_frame_controls(output);
      return;
    }
    // Completion can arrive before the initial topology has finished loading.
    // Keep the already-received coordinate history in that race so the newly
    // loaded component can apply it and expose its frame controls.
    clearNglOutput(output, { preserveFrames: preserveLiveFrames });
    const renderRevision = (output._ui2NglRenderRevision || 0) + 1;
    output._ui2NglRenderRevision = renderRevision;
    plot.hidden = false;
    buttons.hidden = false;
    output._ui2NglNeedsVisibleAutoView = true;
    observeNglOutput(output);
    if (placeholder) {
      placeholder.hidden = true;
    }
    ensureNglLoaded()
      .then(() => {
        if (output._ui2NglRenderRevision !== renderRevision) {
          return null;
        }
        const stage = new window.NGL.Stage(plot.id, nglViewerStageParams(output));
        output._ui2NglStage = stage;
        return stage.loadFile(topologyLoadName, structurePayload.loadparams || {}).then((component) => {
          if (output._ui2NglRenderRevision !== renderRevision) {
            stage.dispose?.();
            return null;
          }
          output._ui2NglComponent = component;
          output._ui2NglTopologyLoadName = topologyLoadName;
          output._ui2NglReps = {};
          const specs = nglRepresentationSpecs(structurePayload);
          specs.forEach((spec) => { spec.visible = spec.visible !== false; });
          output._ui2NglSpecs = specs;
          const layered = Array.isArray(structurePayload.representations) && structurePayload.representations.length;
          specs.forEach((spec, index) => {
            output._ui2NglReps[nglRepresentationStoreKey(spec, index, layered)] = component.addRepresentation(spec.type, spec.params || {});
          });
          resizeNglOutputWhenVisible(output);
          schedule_ngl_coordinate_frame(output);
          renderNglViewerControls(output, component, specs, layered);
          return attachNglFileTrajectory(
            output,
            component,
            structurePayload.trajectory || payload.trajectory,
            renderRevision
          ).then(() => {
            if (liveDensityPayload?.loadname) {
              return loadNglDensitySurface(output, liveDensityPayload);
            }
            return component;
          });
        });
      })
      .catch((error) => {
        if (output._ui2NglRenderRevision !== renderRevision) {
          return;
        }
        clearNglOutput(output);
        const message = output.querySelector(".ui2-ngl-placeholder");
        if (message) {
          message.textContent = `Could not render structure output: ${error.message}`;
        }
      });
  }

  function renderNglTrajectoryError(output, error) {
    const buttons = output?.querySelector?.(".ui2-ngl-buttons");
    if (!buttons) return;
    buttons.querySelector(".ui2-ngl-trajectory-error")?.remove();
    buttons.appendChild(el("span", "ui2-ngl-trajectory-error", `Trajectory could not be loaded: ${error.message}`));
  }

  function attachNglFileTrajectory(output, component, trajectoryPayload, renderRevision) {
    if (!trajectoryPayload?.loadname || typeof component?.addTrajectory !== "function") {
      return Promise.resolve(null);
    }
    const loader = window.NGL?.autoLoad;
    if (typeof loader !== "function") {
      renderNglTrajectoryError(output, new Error("NGL trajectory loader is unavailable"));
      return Promise.resolve(null);
    }
    const loadParams = Object.assign({}, trajectoryPayload.loadparams || {});
    const trajectoryParams = Object.assign({}, trajectoryPayload.trajectoryparams || {});
    const loadName = normalizeNglLoadName(trajectoryPayload.loadname);
    return Promise.resolve(loader(loadName, loadParams))
      .then((frames) => {
        if (output._ui2NglRenderRevision !== renderRevision) {
          return null;
        }
        // NGL's StructureComponent expects parsed trajectory frames here, not
        // a URL string.  autoLoad owns URL fetching and parser selection.
        output._ui2NglTrajectory = component.addTrajectory(frames, trajectoryParams);
        renderNglTrajectoryControls(output, output._ui2NglTrajectory);
        return output._ui2NglTrajectory;
      })
      .catch((error) => {
        if (output._ui2NglRenderRevision === renderRevision) {
          renderNglTrajectoryError(output, error);
        }
        return null;
      });
  }

  function renderNglTrajectoryControls(output, trajectoryComponent) {
    if (nglViewerConfig(output).capabilities?.frame_playback === false) return;
    const buttons = output?.querySelector?.(".ui2-ngl-buttons");
    const trajectory = trajectoryComponent?.trajectory || trajectoryComponent;
    if (!buttons || !trajectory) return;
    buttons.querySelector(".ui2-ngl-file-trajectory")?.remove();
    const controls = el("details", "ui2-ngl-file-trajectory");
    controls.appendChild(el("summary", null, "Trajectory"));
    const row = el("div", "ui2-ngl-control-grid");
    const status = el("span", "ui2-muted", "Loading trajectory frames…");
    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = "0";
    slider.max = "0";
    slider.value = "0";
    slider.disabled = true;
    slider.setAttribute("aria-label", "Trajectory frame");
    const frameLabel = el("span", "ui2-muted", "Frame —");
    const play = el("button", "ui2-button ui2-button-quiet", "Play");
    play.type = "button";
    play.disabled = true;
    const update = () => {
      const count = Number(trajectory.frameCount ?? trajectory._frameCount ?? 0);
      const current = Number(trajectory.currentFrame ?? trajectory._currentFrame ?? 0);
      if (count > 0) {
        slider.disabled = false;
        slider.max = String(Math.max(0, count - 1));
        slider.value = String(Math.max(0, Math.min(count - 1, current)));
        play.disabled = !trajectory.player;
        status.textContent = `${count} frame${count === 1 ? "" : "s"}`;
        frameLabel.textContent = `Frame ${Math.max(1, current + 1)} / ${count}`;
      }
    };
    slider.addEventListener("input", () => trajectory.setFrame?.(Number(slider.value)));
    play.addEventListener("click", () => {
      const player = trajectory.player;
      if (!player) return;
      player.toggle?.();
      play.textContent = player.isRunning ? "Pause" : "Play";
      play.setAttribute("aria-pressed", player.isRunning ? "true" : "false");
    });
    trajectory.signals?.countChanged?.add(update);
    trajectory.signals?.gotNumframes?.add(update);
    trajectory.signals?.frameChanged?.add(update);
    row.append(status, frameLabel, slider, play);
    controls.appendChild(row);
    buttons.appendChild(controls);
    update();
  }

  function renderNglDensityUpdate(output, payload) {
    if (!output?._ui2NglStage || !payload?.loadname) {
      return false;
    }
    ensureNglLoaded()
      .then(() => loadNglDensitySurface(output, payload))
      .catch(() => {});
    return true;
  }

  function nglViewerConfig(output) {
    const base = output?._ui2NglViewerConfig || {};
    return Object.assign({}, base, {
      capabilities: Object.assign({}, base.capabilities || {}),
      display: Object.assign({}, base.display || {})
    });
  }

  function nglViewerStageParams(output) {
    const display = nglViewerConfig(output).display || {};
    const params = { cameraType: "orthographic" };
    if (display.background) params.backgroundColor = display.background;
    if (display.camera === "orthographic" || display.camera === "perspective") {
      params.cameraType = display.camera;
    }
    if (display.mouse_preset) params.mousePreset = display.mouse_preset;
    return params;
  }

  function renderNglViewerControls(output, component, specs, layered) {
    const buttons = output?.querySelector?.(".ui2-ngl-buttons");
    if (!buttons || !component) return;
    buttons.textContent = "";
    const capabilities = nglViewerConfig(output).capabilities || {};
    if (capabilities.representation_controls !== false) {
      if (layered) {
        renderNglLayerButtons(buttons, component, output._ui2NglReps, specs);
      } else {
        renderNglButtons(buttons, component, output._ui2NglReps);
      }
    }
    if (capabilities.viewer_settings !== false) {
      renderNglSceneControls(output, component);
    }
    if (capabilities.layer_editor !== false) {
      renderNglLayerEditor(output, component, specs);
    }
    buttons.hidden = !buttons.childElementCount;
  }

  function renderNglSceneControls(output, component) {
    const buttons = output?.querySelector?.(".ui2-ngl-buttons");
    const stage = output?._ui2NglStage;
    if (!buttons || !stage || !component) return;
    buttons.querySelector(".ui2-ngl-scene-controls")?.remove();
    const config = nglViewerConfig(output);
    const display = config.display || {};
    const controls = el("details", "ui2-ngl-scene-controls");
    controls.open = false;
    controls.appendChild(el("summary", null, "Viewer settings"));
    const grid = el("div", "ui2-ngl-control-grid");
    const visible = document.createElement("input");
    visible.type = "checkbox";
    visible.checked = component.visible !== false;
    visible.setAttribute("aria-label", "Show molecule");
    visible.addEventListener("change", () => {
      if (typeof component.setVisibility === "function") component.setVisibility(visible.checked);
      requestNglRender(stage);
    });
    grid.appendChild(nglViewerControl("Molecule", visible));

    const camera = document.createElement("select");
    [["orthographic", "Orthographic"], ["perspective", "Perspective"]].forEach(([value, label]) => {
      camera.appendChild(new Option(label, value));
    });
    camera.value = display.camera === "perspective" ? "perspective" : "orthographic";
    camera.addEventListener("change", () => {
      stage.setParameters?.({ cameraType: camera.value });
      requestNglRender(stage);
    });
    grid.appendChild(nglViewerControl("Camera", camera));

    const background = document.createElement("input");
    background.type = "color";
    background.value = normalizeNglColor(display.background || "#050909");
    background.setAttribute("aria-label", "Background color");
    background.addEventListener("input", () => {
      stage.setParameters?.({ backgroundColor: background.value });
      requestNglRender(stage);
    });
    grid.appendChild(nglViewerControl("Background", background));

    const mouse = document.createElement("select");
    [["default", "Rotate / pan / zoom"], ["pymol", "PyMOL controls"], ["coot", "Coot controls"], ["astexviewer", "Astex controls"]].forEach(([value, label]) => {
      mouse.appendChild(new Option(label, value));
    });
    mouse.value = display.mouse_preset || "default";
    mouse.addEventListener("change", () => {
      try {
        stage.mouseControls?.preset?.(mouse.value);
        stage.setParameters?.({ mousePreset: mouse.value });
      } catch (_error) {
        mouse.value = "default";
      }
    });
    grid.appendChild(nglViewerControl("Mouse", mouse));

    const axes = document.createElement("input");
    axes.type = "checkbox";
    axes.checked = display.axes === true;
    axes.setAttribute("aria-label", "Show molecular axes");
    const setAxesVisible = () => {
      if (output._ui2NglAxesRep) {
        component.removeRepresentation?.(output._ui2NglAxesRep);
        output._ui2NglAxesRep = null;
      }
      if (axes.checked) {
        try {
          output._ui2NglAxesRep = component.addRepresentation("axes", { color: "white" });
        } catch (_error) {
          axes.checked = false;
        }
      }
      requestNglRender(stage);
    };
    axes.addEventListener("change", setAxesVisible);
    grid.appendChild(nglViewerControl("Molecular axes", axes));

    const reset = el("button", "ui2-button ui2-button-quiet", "Reset view");
    reset.type = "button";
    reset.addEventListener("click", () => component.autoView?.(250));
    grid.appendChild(reset);
    const spin = el("button", "ui2-button ui2-button-quiet", "Spin");
    spin.type = "button";
    spin.setAttribute("aria-pressed", "false");
    spin.addEventListener("click", () => {
      const enabled = spin.getAttribute("aria-pressed") !== "true";
      spin.setAttribute("aria-pressed", String(enabled));
      stage.setSpin?.(enabled);
    });
    grid.appendChild(spin);
    const fullscreen = el("button", "ui2-button ui2-button-quiet", "Fullscreen");
    fullscreen.type = "button";
    fullscreen.addEventListener("click", () => stage.toggleFullscreen?.());
    grid.appendChild(fullscreen);
    controls.appendChild(grid);
    buttons.appendChild(controls);
    if (axes.checked) setAxesVisible();
  }

  function nglViewerControl(label, control) {
    const wrapper = el("label", "ui2-ngl-control");
    wrapper.append(document.createTextNode(label), control);
    return wrapper;
  }

  function normalizeNglColor(value) {
    return /^#[0-9a-f]{6}$/i.test(String(value || "")) ? value : "#050909";
  }

  function renderNglLayerEditor(output, component, specs) {
    const buttons = output?.querySelector?.(".ui2-ngl-buttons");
    if (!buttons || !component) return;
    buttons.querySelector(".ui2-ngl-layer-editor")?.remove();
    const editor = el("details", "ui2-ngl-layer-editor");
    editor.appendChild(el("summary", null, "Display layers"));
    const list = el("div", "ui2-ngl-layer-list");
    specs.forEach((spec, index) => {
      const row = el("div", "ui2-ngl-layer-row");
      const name = document.createElement("input");
      name.type = "text";
      name.value = spec.name || `Layer ${index + 1}`;
      name.setAttribute("aria-label", `Layer ${index + 1} name`);
      name.addEventListener("change", () => { spec.name = name.value || spec.type; });
      const selection = document.createElement("input");
      selection.type = "text";
      selection.value = spec.params?.sele || "all";
      selection.setAttribute("aria-label", `Layer ${index + 1} selection`);
      selection.addEventListener("change", () => {
        spec.params = Object.assign({}, spec.params || {}, { sele: selection.value || "all" });
        rebuildNglRepresentations(output, component, specs);
      });
      const representation = document.createElement("select");
      NGL_REPRESENTATION_TYPES.forEach((type) => representation.appendChild(new Option(type, type)));
      representation.value = spec.type;
      representation.setAttribute("aria-label", `Layer ${index + 1} representation`);
      representation.addEventListener("change", () => {
        spec.type = representation.value;
        rebuildNglRepresentations(output, component, specs);
      });
      const visible = document.createElement("input");
      visible.type = "checkbox";
      visible.checked = spec.visible !== false;
      visible.setAttribute("aria-label", `Show layer ${index + 1}`);
      visible.addEventListener("change", () => {
        spec.visible = visible.checked;
        rebuildNglRepresentations(output, component, specs);
      });
      const remove = el("button", "ui2-button ui2-button-quiet", "Remove");
      remove.type = "button";
      remove.addEventListener("click", () => {
        specs.splice(index, 1);
        rebuildNglRepresentations(output, component, specs);
      });
      row.append(visible, name, selection, representation, remove);
      list.appendChild(row);
    });
    const add = el("button", "ui2-button ui2-button-quiet", "Add layer");
    add.type = "button";
    add.addEventListener("click", () => {
      specs.push({ name: "selection", type: "ball+stick", params: { sele: "all", colorScheme: "element" } });
      rebuildNglRepresentations(output, component, specs);
    });
    editor.append(list, add);
    buttons.appendChild(editor);
  }

  function rebuildNglRepresentations(output, component, specs) {
    Object.values(output._ui2NglReps || {}).forEach((rep) => component.removeRepresentation?.(rep));
    output._ui2NglReps = {};
    specs.forEach((spec, index) => {
      if (spec.visible !== false) {
        output._ui2NglReps[nglRepresentationKey(spec, index)] = component.addRepresentation(spec.type, spec.params || {});
      }
    });
    output._ui2NglSpecs = specs;
    renderNglViewerControls(output, component, specs, true);
    requestNglRender(output._ui2NglStage);
  }

  function loadNglDensitySurface(output, payload) {
    const stage = output?._ui2NglStage;
    if (!stage || !payload?.loadname) {
      return Promise.resolve(null);
    }
    const started_at_ms = ui2_now_ms();
    const priorComponent = output._ui2NglDensityComponent;
    return stage.loadFile(normalizeNglLoadName(payload.loadname), payload.loadparams || { ext: "cube" }).then((component) => {
      const specs = nglDensitySurfaceSpecs(payload);
      const surfaces = specs.map((spec, index) => {
        const surfacePayload = Object.assign({}, payload, {
          surface: spec,
          _ui2_primary_density_surface: index === 0,
          representationParams: Object.assign({}, payload.representationParams || {}, spec.params || {})
        });
        const surface = component.addRepresentation("surface", nglDensitySurfaceParams(output, surfacePayload));
        if (spec.visible === false) {
          surface.setVisibility?.(false);
        }
        return surface;
      });
      const surface = surfaces[0];
      output._ui2NglDensityComponent = component;
      output._ui2NglDensitySurface = surface;
      output._ui2NglDensitySurfaces = surfaces;
      output._ui2NglDensitySpecs = specs;
      output._ui2_ngl_density_payload = cloneUi2Value(payload);
      set_ngl_output_value(output, "ngl_density_load_ms", Math.max(0, ui2_now_ms() - started_at_ms).toFixed(3));
      set_ngl_output_value(output, "ngl_density_isovalue", nglDensitySurfaceParams(output, Object.assign({}, payload, {
        surface: specs[0] || {}
      })).isolevel);
      set_ngl_output_value(output, "ngl_density_min_positive", nglDensityMinPositive(payload));
      if (priorComponent && priorComponent !== component && stage.removeComponent) {
        stage.removeComponent(priorComponent);
      }
      renderNglDensityControls(output, payload);
      renderNglDensitySurfaceList(output);
      requestNglRender(stage);
      return component;
    });
  }

  function nglDensitySurfaceSpecs(payload) {
    const surfaces = Array.isArray(payload?.surfaces) ? payload.surfaces : [];
    if (surfaces.length) {
      return surfaces.map((surface, index) => Object.assign({
        name: index ? `Surface ${index + 1}` : "Density contour",
        visible: true
      }, surface || {}));
    }
    return [Object.assign({ name: "Density contour", visible: true }, payload?.surface || {})];
  }

  function nglDensitySurfaceParams(output, payload) {
    const source = payload?.surface || payload?.representationParams || {};
    const userValue = payload?._ui2_primary_density_surface === false ? null : output?._ui2_ngl_density_user_isovalue;
    const fallback = Number(source.default_isovalue ?? source.isolevel ?? source.min_positive ?? 1.0);
    const isolevel = Number.isFinite(Number(userValue)) ? Number(userValue) : fallback;
    const opacity = nglDensityOpacity(output, payload);
    const params = Object.assign({}, payload?.representationParams || {}, source || {});
    delete params.name;
    delete params.visible;
    delete params.min_positive;
    delete params.default_isovalue;
    delete params.max_value;
    return Object.assign({
      isolevelType: "value",
      isolevel: Number.isFinite(Number(isolevel)) ? Number(isolevel) : 1.0,
      opacity,
      color: "yellow",
      opaqueBack: false
    }, params, { isolevelType: "value", isolevel, opacity });
  }

  function nglDensityOpacity(output, payload) {
    const userValue = payload?._ui2_primary_density_surface === false ? null : output?._ui2_ngl_density_user_opacity;
    const sourceValue = payload?.representationParams?.opacity ?? payload?.surface?.opacity ?? 0.45;
    const opacity = Number(Number.isFinite(Number(userValue)) ? userValue : sourceValue);
    if (!Number.isFinite(opacity)) {
      return 0.45;
    }
    return Math.min(1.0, Math.max(0.05, opacity));
  }

  function nglDensityMinPositive(payload) {
    const value = Number(payload?.surface?.min_positive ?? payload?.surface?.default_isovalue ?? payload?.representationParams?.isolevel);
    return Number.isFinite(value) && value > 0 ? value : 0;
  }

  function nglDensityMaxValue(payload) {
    const value = Number(payload?.surface?.max_value ?? 100);
    return Number.isFinite(value) && value > 0 ? value : 100;
  }

  function renderNglDensityControls(output, payload) {
    const buttons = output?.querySelector?.(".ui2-ngl-buttons");
    const surface = output?._ui2NglDensitySurface;
    if (!buttons || !surface) {
      return;
    }
    buttons.querySelector(".ui2-ngl-density-controls")?.remove();
    const minValue = nglDensityMinPositive(payload);
    const maxValue = nglDensityMaxValue(payload);
    const currentValue = Number((output._ui2_ngl_density_user_isovalue ?? payload?.surface?.isolevel ?? payload?.surface?.default_isovalue ?? minValue) || 1);
    const currentOpacity = nglDensityOpacity(output, payload);
    const controls = el("span", "ui2-ngl-density-controls");
    const label = el("span", "ui2-muted", "Density contour");
    const slider = el("input", "ui2-ngl-density-slider");
    slider.type = "range";
    // This is a presentation-only control inside the module form.  Keep its
    // native range normalized so an exact scientific lower bound cannot be
    // rounded below slider.min and block a subsequent scientific submission.
    slider.min = "0";
    slider.max = "1";
    slider.step = "0.001";
    const densityRange = Math.max(0, maxValue - (minValue || 0));
    const densityValueToSlider = (value) => densityRange
      ? (Math.min(maxValue, Math.max(minValue || 0, value)) - (minValue || 0)) / densityRange
      : 0;
    const densitySliderToValue = (value) => (minValue || 0) + densityRange * Math.min(1, Math.max(0, Number(value) || 0));
    slider.value = String(densityValueToSlider(currentValue));
    slider.setAttribute("aria-label", "Density contour");
    const number = el("input", "ui2-ngl-density-input");
    number.type = "text";
    number.inputMode = "decimal";
    number.value = String(Math.min(maxValue, Math.max(minValue || 0, currentValue)));
    const opacityLabel = el("span", "ui2-muted", "Density opacity");
    const opacitySlider = el("input", "ui2-ngl-density-opacity-slider");
    opacitySlider.type = "range";
    opacitySlider.min = "0.05";
    opacitySlider.max = "1";
    opacitySlider.step = "0.05";
    opacitySlider.value = String(currentOpacity);
    opacitySlider.setAttribute("aria-label", "Density opacity");
    const opacityNumber = el("input", "ui2-ngl-density-input");
    opacityNumber.type = "text";
    opacityNumber.inputMode = "decimal";
    opacityNumber.value = opacitySlider.value;
    const reset = el("button", "ui2-button ui2-button-quiet ui2-ngl-button", "Reset density");
    reset.type = "button";
    const applyValue = (value, userSet = true) => {
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) {
        return;
      }
      const clamped = Math.min(maxValue, Math.max(minValue || 0, numeric));
      if (userSet) {
        output._ui2_ngl_density_user_isovalue = clamped;
      }
      slider.value = String(densityValueToSlider(clamped));
      number.value = String(clamped);
      const activeSurface = output?._ui2NglDensitySurface;
      if (typeof activeSurface?.setParameters === "function") {
        activeSurface.setParameters({ isolevel: clamped, isolevelType: "value" });
      }
      set_ngl_output_value(output, "ngl_density_isovalue", clamped);
      requestNglRender(output._ui2NglStage);
    };
    const applyOpacity = (value, userSet = true) => {
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) {
        return;
      }
      const clamped = Math.min(1.0, Math.max(0.05, numeric));
      if (userSet) {
        output._ui2_ngl_density_user_opacity = clamped;
      }
      opacitySlider.value = String(clamped);
      opacityNumber.value = String(clamped);
      const activeSurface = output?._ui2NglDensitySurface;
      if (typeof activeSurface?.setParameters === "function") {
        activeSurface.setParameters({ opacity: clamped });
      }
      set_ngl_output_value(output, "ngl_density_opacity", clamped);
      requestNglRender(output._ui2NglStage);
    };
    slider.addEventListener("input", () => applyValue(densitySliderToValue(slider.value)));
    number.addEventListener("change", () => applyValue(number.value));
    opacitySlider.addEventListener("input", () => applyOpacity(opacitySlider.value));
    opacityNumber.addEventListener("change", () => applyOpacity(opacityNumber.value));
    reset.addEventListener("click", () => {
      output._ui2_ngl_density_user_isovalue = null;
      output._ui2_ngl_density_user_opacity = null;
      applyValue(minValue || 1, false);
      applyOpacity(0.45, false);
    });
    controls.append(label, slider, number, opacityLabel, opacitySlider, opacityNumber, reset);
    buttons.appendChild(controls);
  }

  function renderNglDensitySurfaceList(output) {
    const buttons = output?.querySelector?.(".ui2-ngl-buttons");
    const specs = Array.isArray(output?._ui2NglDensitySpecs) ? output._ui2NglDensitySpecs : [];
    const surfaces = Array.isArray(output?._ui2NglDensitySurfaces) ? output._ui2NglDensitySurfaces : [];
    if (!buttons || !specs.length || !surfaces.length) return;
    buttons.querySelector(".ui2-ngl-density-surface-list")?.remove();
    const editor = el("details", "ui2-ngl-density-surface-list");
    editor.appendChild(el("summary", null, specs.length > 1 ? "Volume surfaces" : "Volume surface"));
    const list = el("div", "ui2-ngl-layer-list");
    specs.forEach((spec, index) => {
      const surface = surfaces[index];
      if (!surface) return;
      const row = el("div", "ui2-ngl-layer-row");
      const visible = document.createElement("input");
      visible.type = "checkbox";
      visible.checked = spec.visible !== false;
      visible.setAttribute("aria-label", `Show ${spec.name || `surface ${index + 1}`}`);
      visible.addEventListener("change", () => {
        spec.visible = visible.checked;
        surface.setVisibility?.(visible.checked);
        requestNglRender(output._ui2NglStage);
      });
      const label = el("span", "ui2-muted", spec.name || `Surface ${index + 1}`);
      const isolevel = document.createElement("input");
      isolevel.type = "number";
      isolevel.step = "any";
      isolevel.value = String(spec.isolevel ?? spec.default_isovalue ?? 1);
      isolevel.setAttribute("aria-label", `${spec.name || `Surface ${index + 1}`} isovalue`);
      isolevel.addEventListener("change", () => {
        const value = Number(isolevel.value);
        if (!Number.isFinite(value)) return;
        spec.isolevel = value;
        surface.setParameters?.({ isolevel: value, isolevelType: "value" });
        requestNglRender(output._ui2NglStage);
      });
      const color = document.createElement("input");
      color.type = "color";
      color.value = normalizeNglColor(spec.color || spec.params?.color || (index ? "#ff3c52" : "#ffd400"));
      color.setAttribute("aria-label", `${spec.name || `Surface ${index + 1}`} color`);
      color.addEventListener("input", () => {
        spec.color = color.value;
        surface.setParameters?.({ color: color.value });
        requestNglRender(output._ui2NglStage);
      });
      const opacity = document.createElement("input");
      opacity.type = "range";
      opacity.min = "0.05";
      opacity.max = "1";
      opacity.step = "0.05";
      opacity.value = String(spec.opacity ?? spec.params?.opacity ?? 0.45);
      opacity.setAttribute("aria-label", `${spec.name || `Surface ${index + 1}`} opacity`);
      opacity.addEventListener("input", () => {
        const value = Number(opacity.value);
        spec.opacity = value;
        surface.setParameters?.({ opacity: value });
        requestNglRender(output._ui2NglStage);
      });
      row.append(visible, label, isolevel, color, opacity);
      list.appendChild(row);
    });
    editor.appendChild(list);
    buttons.appendChild(editor);
  }

  function normalize_ngl_coordinate_frame(payload) {
    const raw = payload?.coordinates ?? payload?.positions;
    if (!Array.isArray(raw) && !ArrayBuffer.isView(raw)) {
      return null;
    }
    const coordinates = raw instanceof Float32Array ? raw : new Float32Array(raw);
    if (!coordinates.length || coordinates.length % 3 !== 0 || coordinates.some((value) => !Number.isFinite(value))) {
      return null;
    }
    const atom_count = Number(payload?.atom_count ?? payload?.atomCount ?? coordinates.length / 3);
    if (!Number.isInteger(atom_count) || atom_count < 1 || coordinates.length !== atom_count * 3) {
      return null;
    }
    const frame_id = stringValue(
      payload?.frame_id ?? payload?.frameId ?? payload?.frame ??
      payload?.frame_index ?? payload?.frameIndex
    );
    return {
      coordinates,
      atom_count,
      frame_id: frame_id || null,
      label: stringValue(payload?.label ?? payload?.frame_label ?? payload?.frameLabel),
      metadata: cloneUi2Value(payload?.metadata || {}),
      timestamp: stringValue(payload?.timestamp),
      coordinate_dtype: stringValue(payload?.coordinate_dtype || payload?.coordinateDtype || "float32") || "float32",
      byte_length: coordinates.byteLength,
      received_at_ms: ui2_now_ms()
    };
  }

  function ui2_now_ms() {
    return window.performance?.now ? window.performance.now() : Date.now();
  }

  function ngl_stream_telemetry(output) {
    if (!output) {
      return null;
    }
    output._ui2_ngl_telemetry = output._ui2_ngl_telemetry || {
      received_frames: 0,
      retained_frames: 0,
      dropped_frames: 0,
      invalid_frames: 0,
      rendered_frames: 0,
      bytes_retained: 0,
      last_atom_count: null,
      last_coordinate_dtype: "",
      last_frame_id: null,
      last_queue_age_ms: null,
      last_render_ms: null,
      last_dropped_reason: ""
    };
    return output._ui2_ngl_telemetry;
  }

  function set_ngl_output_value(output, name, value) {
    if (!output) {
      return;
    }
    const text = value == null ? "" : String(value);
    if (typeof output.setAttribute === "function") {
      output.setAttribute(`data-${name.replaceAll("_", "-")}`, text);
      return;
    }
    output.dataset = output.dataset || {};
    output.dataset[name] = text;
  }

  function sync_ngl_stream_telemetry(output) {
    const telemetry = output?._ui2_ngl_telemetry;
    if (!output || !telemetry) {
      return;
    }
    set_ngl_output_value(output, "ngl_frames_received", telemetry.received_frames);
    set_ngl_output_value(output, "ngl_frames_retained", telemetry.retained_frames);
    set_ngl_output_value(output, "ngl_frames_dropped", telemetry.dropped_frames);
    set_ngl_output_value(output, "ngl_frames_invalid", telemetry.invalid_frames);
    set_ngl_output_value(output, "ngl_frames_rendered", telemetry.rendered_frames);
    set_ngl_output_value(output, "ngl_bytes_retained", telemetry.bytes_retained);
    set_ngl_output_value(output, "ngl_coordinate_dtype", telemetry.last_coordinate_dtype);
    set_ngl_output_value(output, "ngl_last_frame_id", telemetry.last_frame_id);
    set_ngl_output_value(output, "ngl_last_queue_age_ms", telemetry.last_queue_age_ms);
    set_ngl_output_value(output, "ngl_last_render_ms", telemetry.last_render_ms);
    set_ngl_output_value(output, "ngl_last_dropped_reason", telemetry.last_dropped_reason);
  }

  function prune_ngl_frame_history(output) {
    const frames = Array.isArray(output?._ui2_ngl_frames) ? output._ui2_ngl_frames : [];
    const telemetry = ngl_stream_telemetry(output);
    if (!telemetry) {
      return;
    }
    const configured_max = Number(output._ui2_ngl_frame_history_max_bytes);
    const max_bytes = Number.isFinite(configured_max) && configured_max > 0
      ? configured_max
      : NGL_FRAME_HISTORY_DEFAULT_MAX_BYTES;
    let bytes_retained = frames.reduce((sum, frame) => sum + Number(frame.byte_length || 0), 0);
    let dropped = 0;
    while (bytes_retained > max_bytes && frames.length > 1) {
      const removed = frames.shift();
      bytes_retained -= Number(removed?.byte_length || 0);
      dropped += 1;
    }
    telemetry.dropped_frames += dropped;
    telemetry.retained_frames = frames.length;
    telemetry.bytes_retained = bytes_retained;
    if (dropped > 0) {
      telemetry.last_dropped_reason = "memory_budget";
    }
    sync_ngl_stream_telemetry(output);
  }

  function queue_ngl_coordinate_frame(output, payload) {
    const frame = normalize_ngl_coordinate_frame(payload);
    if (!output || !frame) {
      const telemetry = ngl_stream_telemetry(output);
      if (telemetry) {
        telemetry.invalid_frames += 1;
        telemetry.last_dropped_reason = "invalid_frame";
        sync_ngl_stream_telemetry(output);
      }
      return false;
    }
    const telemetry = ngl_stream_telemetry(output);
    output._ui2_ngl_frames = Array.isArray(output._ui2_ngl_frames) ? output._ui2_ngl_frames : [];
    output._ui2_ngl_frames.push(frame);
    if (telemetry) {
      telemetry.received_frames += 1;
      telemetry.last_atom_count = frame.atom_count;
      telemetry.last_coordinate_dtype = frame.coordinate_dtype;
      telemetry.last_frame_id = frame.frame_id;
      if (output._ui2_ngl_pending_frame) {
        telemetry.dropped_frames += 1;
        telemetry.last_dropped_reason = "stale_frame";
      }
    }
    prune_ngl_frame_history(output);
    const outputId = output.dataset?.outputFieldId || "";
    if (outputId) {
      state.nglFrameHistories[outputId] = output._ui2_ngl_frames;
    }
    output._ui2_ngl_pending_frame = frame;
    render_ngl_frame_controls(output);
    schedule_ngl_coordinate_frame(output);
    return true;
  }

  function ngl_frame_label(frame, index) {
    return frame?.label || (frame?.frame_id != null ? `Frame ${frame.frame_id}` : `Frame ${index + 1}`);
  }

  function latest_ngl_retained_frame(output) {
    const frames = Array.isArray(output?._ui2_ngl_frames) ? output._ui2_ngl_frames : [];
    return frames.length ? frames[frames.length - 1] : null;
  }

  function ngl_active_frame_index(output, frames) {
    const frame_list = Array.isArray(frames) ? frames : [];
    const active_frame = output?._ui2_ngl_last_frame || output?._ui2_ngl_pending_frame || latest_ngl_retained_frame(output);
    if (!active_frame || !frame_list.length) {
      return -1;
    }
    return frame_list.indexOf(active_frame);
  }

  function refreshNglOutputFrame(output) {
    const frame = output?._ui2_ngl_pending_frame || output?._ui2_ngl_last_frame || latest_ngl_retained_frame(output);
    if (!output?._ui2NglComponent || !frame) {
      return false;
    }
    return apply_ngl_coordinate_frame(output, frame);
  }

  function ngl_stream_telemetry_label(output) {
    const telemetry = output?._ui2_ngl_telemetry;
    if (!telemetry) {
      return "";
    }
    const rendered = Math.max(0, Number(telemetry.rendered_frames || 0));
    if (!rendered) {
      return "";
    }
    const coverage = nglViewerConfig(output).stream_preview_coverage;
    const frame = latest_ngl_retained_frame(output);
    const denominator = nglStreamCoverageValue(frame, coverage?.frame_field);
    if (coverage?.label && Number.isFinite(denominator) && denominator > 0) {
      const percent = Math.max(0, Math.min(100, Math.round((rendered / denominator) * 100)));
      return `Preview rendered ${rendered} of ${denominator} ${coverage.label} (${percent}%)`;
    }
    return `Rendered ${rendered} streamed ${rendered === 1 ? "frame" : "frames"}`;
  }

  function nglStreamCoverageValue(frame, field) {
    if (!frame || !field) {
      return NaN;
    }
    if (field === "frame_id") {
      return Number(frame.frame_id);
    }
    if (field.startsWith("metadata.")) {
      return Number(frame.metadata?.[field.slice("metadata.".length)]);
    }
    return NaN;
  }

  function render_ngl_frame_controls(output) {
    const buttons = output?.querySelector?.(".ui2-ngl-buttons");
    if (!buttons) {
      return;
    }
    if (output._ui2_ngl_scrubbing) {
      return;
    }
    buttons.querySelector(".ui2-ngl-frame-controls")?.remove();
    const frames = Array.isArray(output._ui2_ngl_frames) ? output._ui2_ngl_frames : [];
    if (!frames.length) {
      return;
    }
    const controls = el("span", "ui2-ngl-frame-controls");
    const label = el("span", "ui2-muted", frames.length === 1 ? ngl_frame_label(frames[0], 0) : "Streamed frames");
    controls.appendChild(label);
    const active_index = ngl_active_frame_index(output, frames);
    if (frames.length > 1) {
      const scrubber = el("input", "ui2-ngl-frame-scrubber");
      scrubber.type = "range";
      scrubber.min = "0";
      scrubber.max = String(frames.length - 1);
      scrubber.step = "1";
      scrubber.value = String(active_index >= 0 ? active_index : frames.length - 1);
      scrubber.setAttribute("aria-label", "Streamed structure frame");
      scrubber.addEventListener("pointerdown", () => {
        output._ui2_ngl_scrubbing = true;
      });
      const finishScrubbing = () => {
        if (!output._ui2_ngl_scrubbing) {
          return;
        }
        output._ui2_ngl_scrubbing = false;
        render_ngl_frame_controls(output);
      };
      scrubber.addEventListener("pointerup", finishScrubbing);
      scrubber.addEventListener("pointercancel", finishScrubbing);
      scrubber.addEventListener("change", finishScrubbing);
      const selected_label = el(
        "span",
        "ui2-muted ui2-ngl-frame-selected-label",
        ngl_frame_label(frames[Number(scrubber.value)], Number(scrubber.value)),
      );
      scrubber.addEventListener("input", () => {
        const index = Number(scrubber.value);
        const frame = frames[index];
        if (frame) {
          selected_label.textContent = ngl_frame_label(frame, index);
          apply_ngl_coordinate_frame(output, frame);
        }
      });
      controls.appendChild(scrubber);
      controls.appendChild(selected_label);

      if (nglViewerConfig(output).capabilities?.frame_playback !== false) {
        const previous = el("button", "ui2-button ui2-button-quiet ui2-ngl-button", "Previous");
        previous.type = "button";
        previous.addEventListener("click", () => setNglActiveFrame(output, Math.max(0, ngl_active_frame_index(output, frames) - 1)));
        const next = el("button", "ui2-button ui2-button-quiet ui2-ngl-button", "Next");
        next.type = "button";
        next.addEventListener("click", () => setNglActiveFrame(output, Math.min(frames.length - 1, Math.max(0, ngl_active_frame_index(output, frames)) + 1)));
        const play = el("button", "ui2-button ui2-button-quiet ui2-ngl-button", output._ui2_ngl_playback?.timer ? "Pause" : "Play");
        play.type = "button";
        play.setAttribute("aria-pressed", output._ui2_ngl_playback?.timer ? "true" : "false");
        play.addEventListener("click", () => {
          if (output._ui2_ngl_playback?.timer) {
            stopNglFramePlayback(output);
          } else {
            startNglFramePlayback(output);
          }
          render_ngl_frame_controls(output);
        });
        const mode = document.createElement("select");
        [["loop", "Loop"], ["once", "Once"], ["bounce", "Bounce"]].forEach(([value, label]) => mode.appendChild(new Option(label, value)));
        mode.value = output._ui2_ngl_playback?.mode || "loop";
        mode.setAttribute("aria-label", "Trajectory playback mode");
        mode.addEventListener("change", () => {
          output._ui2_ngl_playback = Object.assign({}, output._ui2_ngl_playback || {}, { mode: mode.value });
        });
        const speed = document.createElement("input");
        speed.type = "number";
        speed.min = "20";
        speed.step = "10";
        speed.value = String(output._ui2_ngl_playback?.interval || 100);
        speed.setAttribute("aria-label", "Trajectory frame interval milliseconds");
        speed.addEventListener("change", () => {
          const interval = Math.max(20, Number(speed.value) || 100);
          output._ui2_ngl_playback = Object.assign({}, output._ui2_ngl_playback || {}, { interval });
        });
        controls.append(previous, next, play, mode, speed);
      }
    }
    const telemetry_label = ngl_stream_telemetry_label(output);
    if (telemetry_label) {
      controls.appendChild(el("span", "ui2-muted ui2-ngl-frame-telemetry", telemetry_label));
    }
    buttons.appendChild(controls);
  }

  function setNglActiveFrame(output, index) {
    const frames = Array.isArray(output?._ui2_ngl_frames) ? output._ui2_ngl_frames : [];
    const frame = frames[index];
    if (!frame) return false;
    output._ui2_ngl_pending_frame = null;
    const applied = apply_ngl_coordinate_frame(output, frame);
    render_ngl_frame_controls(output);
    return applied;
  }

  function stopNglFramePlayback(output) {
    const timer = output?._ui2_ngl_playback?.timer;
    if (timer) window.clearTimeout(timer);
    if (output?._ui2_ngl_playback) output._ui2_ngl_playback.timer = null;
  }

  function startNglFramePlayback(output) {
    const state = output._ui2_ngl_playback = Object.assign({ mode: "loop", interval: 100, direction: 1, timer: null }, output?._ui2_ngl_playback || {});
    const advance = () => {
      const frames = Array.isArray(output?._ui2_ngl_frames) ? output._ui2_ngl_frames : [];
      if (frames.length < 2) {
        stopNglFramePlayback(output);
        render_ngl_frame_controls(output);
        return;
      }
      let index = ngl_active_frame_index(output, frames);
      index = index < 0 ? frames.length - 1 : index + state.direction;
      if (index >= frames.length || index < 0) {
        if (state.mode === "once") {
          stopNglFramePlayback(output);
          render_ngl_frame_controls(output);
          return;
        }
        if (state.mode === "bounce") {
          state.direction *= -1;
          index = Math.max(0, Math.min(frames.length - 1, index + 2 * state.direction));
        } else {
          index = index < 0 ? frames.length - 1 : 0;
        }
      }
      setNglActiveFrame(output, index);
      state.timer = window.setTimeout(advance, Math.max(20, Number(state.interval) || 100));
    };
    state.timer = window.setTimeout(advance, Math.max(20, Number(state.interval) || 100));
  }

  function schedule_ngl_coordinate_frame(output) {
    if (!output?._ui2NglComponent || !output._ui2_ngl_pending_frame || output._ui2_ngl_frame_scheduled) {
      return;
    }
    output._ui2_ngl_frame_scheduled = true;
    const schedule = window.requestAnimationFrame || ((callback) => window.setTimeout(callback, 0));
    schedule(() => {
      output._ui2_ngl_frame_scheduled = false;
      const frame = output._ui2_ngl_pending_frame;
      output._ui2_ngl_pending_frame = null;
      apply_ngl_coordinate_frame(output, frame);
      if (output._ui2_ngl_pending_frame) {
        schedule_ngl_coordinate_frame(output);
      }
    });
  }

  function apply_ngl_coordinate_frame(output, frame) {
    const component = output?._ui2NglComponent;
    const structure = component?.structure;
    if (!component || !structure || typeof structure.updatePosition !== "function" || !frame) {
      return false;
    }
    const structureAtomCount = Number(structure.atomCount ?? structure.atomStore?.count);
    const telemetry = ngl_stream_telemetry(output);
    if (Number.isInteger(structureAtomCount) && structureAtomCount > 0 && structureAtomCount !== frame.atom_count) {
      if (telemetry) {
        telemetry.invalid_frames += 1;
        telemetry.dropped_frames += 1;
        telemetry.last_dropped_reason = "atom_count_mismatch";
        sync_ngl_stream_telemetry(output);
      }
      render_ngl_frame_controls(output);
      return false;
    }
    const started_at_ms = ui2_now_ms();
    const is_same_active_frame = output._ui2_ngl_last_frame === frame;
    // This is the coordinate path used by bundled NGL 0.10.4 trajectories:
    // update the existing Structure and its representation positions. Do not
    // reload, recreate, or auto-center the component for each frame.
    try {
      structure.updatePosition(frame.coordinates);
      if (typeof component.updateRepresentations === "function") {
        component.updateRepresentations({ position: true });
      }
      requestNglRender(component.stage || output._ui2NglStage);
    } catch (_error) {
      if (telemetry) {
        telemetry.invalid_frames += 1;
        telemetry.dropped_frames += 1;
        telemetry.last_dropped_reason = "render_error";
        sync_ngl_stream_telemetry(output);
      }
      render_ngl_frame_controls(output);
      return false;
    }
    set_ngl_output_value(output, "ngl_frame_id", frame.frame_id);
    output._ui2_ngl_last_frame = frame;
    if (telemetry) {
      if (!is_same_active_frame) {
        telemetry.rendered_frames += 1;
      }
      telemetry.last_atom_count = frame.atom_count;
      telemetry.last_coordinate_dtype = frame.coordinate_dtype;
      telemetry.last_frame_id = frame.frame_id;
      telemetry.last_queue_age_ms = Math.max(0, started_at_ms - Number(frame.received_at_ms || started_at_ms));
      telemetry.last_render_ms = Math.max(0, ui2_now_ms() - started_at_ms);
      sync_ngl_stream_telemetry(output);
    }
    render_ngl_frame_controls(output);
    return true;
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
        name: rep?.name || rep?.label || rep?.type || rep?.representation || "",
        type: rep?.type || rep?.representation || "",
        params: rep?.params || rep?.representationParams || {}
      }))
      .filter((rep) => rep.type);
    if (specs.length) {
      return specs;
    }
    return [{
      name: payload?.representation || "cartoon",
      type: payload?.representation || "cartoon",
      params: payload?.representationParams || {}
    }];
  }

  function nglRepresentationKey(spec, index) {
    const key = spec?.type || "representation";
    if (spec?.params?.sele) {
      return `${key}:${spec.params.sele}:${index}`;
    }
    return index ? `${key}:${index}` : key;
  }

  function nglRepresentationStoreKey(spec, index, layered) {
    return layered ? nglRepresentationKey(spec, index) : spec?.type || "representation";
  }

  function toggleNglRepresentation(button, component, reps, key, spec) {
    if (reps[key] && component.removeRepresentation) {
      component.removeRepresentation(reps[key]);
      delete reps[key];
      button.setAttribute("aria-pressed", "false");
      return;
    }
    reps[key] = component.addRepresentation(spec.type, spec.params || {});
    button.setAttribute("aria-pressed", "true");
  }

  function renderNglLayerButtons(container, component, reps, specs) {
    container.textContent = "";
    specs.forEach((spec, index) => {
      const key = nglRepresentationKey(spec, index);
      const button = el("button", "ui2-button ui2-button-quiet ui2-ngl-button", spec.name || spec.type);
      button.type = "button";
      button.setAttribute("aria-pressed", reps[key] ? "true" : "false");
      button.addEventListener("click", () => {
        toggleNglRepresentation(button, component, reps, key, spec);
      });
      container.appendChild(button);
    });
  }

  function renderNglButtons(container, component, reps) {
    container.textContent = "";
    NGL_REPRESENTATION_TYPES.forEach((type) => {
      const button = el("button", "ui2-button ui2-button-quiet ui2-ngl-button", type);
      button.type = "button";
      button.setAttribute("aria-pressed", reps[type] ? "true" : "false");
      button.addEventListener("click", () => {
        toggleNglRepresentation(button, component, reps, type, { type, params: {} });
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
    output._ui2PlotlyLastFigure = cloneUi2Value(figure);
    output.classList.add("ui2-output-rendered", "ui2-output-plotly-ready");
    const updateExisting = Boolean(output.data && window.Plotly?.react);
    if (!updateExisting) {
      output.textContent = "";
    }
    ensurePlotlyLoaded()
      .then(() => {
        const layout = plotlyLayoutForOutput(output, figure.layout);
        if (layout.uirevision == null) {
          layout.uirevision = output.dataset.outputFieldId || "ui2-plot";
        }
        applyPlotlyTheme(layout);
        const config = plotlyConfigForOutput(figure);
        applyPlotlyModebarHooks(figure, config);
        const data = plotlyDataForOutput(output, figure.data);
        return updateExisting
          ? window.Plotly.react(output, data, layout, config)
          : window.Plotly.newPlot(output, data, layout, config);
      })
      .then(() => {
        observeFitPlotlyOutput(output);
        resizePlotlyOutputWhenVisible(output);
      })
      .catch((error) => {
        output.classList.remove("ui2-output-plotly-ready");
        output.textContent = `Could not render Plotly output: ${error.message}`;
      });
  }

  function appendPlotlyOutput(output, payload) {
    const traces = Array.isArray(payload?.traces) ? payload.traces : [];
    if (!traces.length) {
      return;
    }
    ensurePlotlyLoaded()
      .then(() => {
        if (!output.data || typeof window.Plotly?.extendTraces !== "function") {
          if (payload.figure) {
            renderPlotlyOutput(output, payload.figure);
          } else if (output._ui2PlotlyLastFigure) {
            renderPlotlyOutput(output, output._ui2PlotlyLastFigure);
          }
          return;
        }
        const indices = [];
        const x = [];
        const y = [];
        traces.forEach((trace) => {
          const index = Number(trace?.index);
          if (!Number.isInteger(index) || !Array.isArray(trace?.x) || !Array.isArray(trace?.y)) {
            return;
          }
          indices.push(index);
          x.push(trace.x);
          y.push(trace.y);
        });
        if (!indices.length) {
          return;
        }
        const max_points = Number(payload.max_points ?? payload.maxPoints);
        const extended = Number.isInteger(max_points) && max_points > 0
          ? window.Plotly.extendTraces(output, { x, y }, indices, max_points)
          : window.Plotly.extendTraces(output, { x, y }, indices);
        rememberPlotlyAppend(output, indices, x, y, max_points);
        return extended;
      })
      .then(() => {
        resizePlotlyOutputWhenVisible(output);
      })
      .catch((error) => {
        output.textContent = `Could not append Plotly output: ${error.message}`;
      });
  }

  function plotlyLayoutForOutput(output, sourceLayout) {
    const defaults = defaultPlotlyLayout();
    const layout = Object.assign({}, defaults, sourceLayout || {});
    // Geometry and theme are UI2 policy. Producers describe scientific
    // content, but must not freeze a workbench pane or bring a second theme.
    layout.autosize = true;
    delete layout.width;
    delete layout.height;
    layout.margin = Object.assign({}, defaults.margin);
    layout.font = Object.assign({}, defaults.font);
    layout.paper_bgcolor = defaults.paper_bgcolor;
    layout.plot_bgcolor = defaults.plot_bgcolor;
    applyPlotPresentationLayout(layout, plotPresentationProfileForOutput(output));
    return layout;
  }

  function plotlyConfigForOutput(figure) {
    const editor = figure?.config?.genapp_chart_editor;
    const config = {
      responsive: true,
      scrollZoom: true,
      displaylogo: false,
      modeBarButtonsToRemove: ["select2d", "lasso2d"]
    };
    // Availability is module metadata; the shared renderer owns the button.
    if (editor?.enabled && editor.url) {
      config.genapp_chart_editor = editor;
    }
    return config;
  }

  function plotlyFitMode(output) {
    if (!output) {
      return "";
    }
    if (output.dataset?.plotFit) {
      return output.dataset.plotFit;
    }
    return output.closest?.("[data-plot-fit]")?.dataset?.plotFit || "";
  }

  function observeFitPlotlyOutput(output) {
    disconnectPlotlyOutputObserver(output);
    if (plotlyFitMode(output) !== "pane" || typeof ResizeObserver !== "function") {
      return;
    }
    // Observe the allocated pane, not the Plotly element itself.  Plotly
    // changes its own SVG dimensions while resizing; observing that element
    // feeds its own relayout back into this observer and can widen the pane.
    const fittedAncestor = output.closest?.("[data-plot-fit]");
    const target = fittedAncestor && fittedAncestor !== output
      ? fittedAncestor
      : (output.parentElement || output);
    let width = 0;
    let height = 0;
    const observer = new ResizeObserver((entries) => {
      const rect = entries?.[0]?.contentRect;
      if (!rect || Math.abs(rect.width - width) < 1 && Math.abs(rect.height - height) < 1) {
        return;
      }
      width = rect.width;
      height = rect.height;
      const schedule = window.requestAnimationFrame || ((callback) => window.setTimeout(callback, 0));
      schedule(() => {
        resizePlotlyOutputWhenVisible(output);
      });
    });
    observer.observe(target);
    output._ui2PlotlyResizeObserver = observer;
  }

  function resizePlotlyOutputWhenVisible(output, attempt = 0) {
    if (!output?.isConnected || !window.Plotly?.Plots?.resize) {
      return;
    }
    const rect = output.getBoundingClientRect?.();
    if (rect && rect.width > 1 && rect.height > 1 && output.offsetParent !== null) {
      resizePlotlyOutputToVisibleBox(output, rect);
      return;
    }
    if (attempt >= 12) {
      return;
    }
    const delay = attempt < 4 ? 32 : 75;
    window.setTimeout(() => resizePlotlyOutputWhenVisible(output, attempt + 1), delay);
  }

  function resizePlotlyOutputToVisibleBox(output, rect) {
    const width = Math.max(1, Math.floor(rect?.width || output.clientWidth || 0));
    const height = Math.max(1, Math.floor(rect?.height || output.clientHeight || 0));
    debugPlotlyResize("resize", output, width, height);
    // Pane-fitted figures are autosized.  Plotly's resize routine reads the
    // CSS box; writing a fixed width/height back with relayout makes the plot
    // participate in its own size calculation and can grow the pane.
    const refreshed = refreshPlotlyOutputIfNeeded(output);
    if (refreshed?.then) {
      refreshed.then(() => window.Plotly?.Plots?.resize?.(output));
      return;
    }
    window.Plotly?.Plots?.resize?.(output);
  }

  function rememberPlotlyAppend(output, indices, x_values, y_values, max_points) {
    const figure = output?._ui2PlotlyLastFigure;
    if (!figure || !Array.isArray(figure.data)) {
      return;
    }
    indices.forEach((trace_index, position) => {
      const trace = figure.data[trace_index];
      if (!trace || !Array.isArray(x_values[position]) || !Array.isArray(y_values[position])) {
        return;
      }
      trace.x = Array.isArray(trace.x) ? trace.x.concat(x_values[position]) : x_values[position].slice();
      trace.y = Array.isArray(trace.y) ? trace.y.concat(y_values[position]) : y_values[position].slice();
      if (Number.isInteger(max_points) && max_points > 0 && trace.x.length > max_points) {
        trace.x = trace.x.slice(trace.x.length - max_points);
        trace.y = trace.y.slice(trace.y.length - max_points);
      }
    });
  }

  function refreshPlotlyOutputIfNeeded(output) {
    const figure = output?._ui2PlotlyLastFigure;
    if (!figure || !Array.isArray(figure.data) || typeof window.Plotly?.react !== "function") {
      return null;
    }
    const has_plot = Boolean(output.data && output.querySelector?.(".svg-container"));
    if (has_plot) {
      return null;
    }
    const layout = plotlyLayoutForOutput(output, figure.layout);
    if (layout.uirevision == null) {
      layout.uirevision = output.dataset.outputFieldId || "ui2-plot";
    }
    applyPlotlyTheme(layout);
    const config = plotlyConfigForOutput(figure);
    applyPlotlyModebarHooks(figure, config);
    return window.Plotly.react(output, plotlyDataForOutput(output, figure.data), layout, config);
  }

  function plotPresentationForOutput(output) {
    const raw = output?.closest?.("[data-plot-presentation]")?.dataset?.plotPresentation;
    if (!raw) {
      return {};
    }
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (_error) {
      return {};
    }
  }

  function plotPresentationProfileForOutput(output) {
    const selection = plotPresentationForOutput(output);
    const profileName = String(selection.profile || "").trim();
    if (!profileName) {
      return {};
    }
    const profiles = window.GENAPP_PLOT_PRESENTATIONS;
    if (!profiles || typeof profiles !== "object") {
      return {};
    }
    const resolve = (name, seen = new Set()) => {
      if (!name || seen.has(name)) {
        return {};
      }
      seen.add(name);
      const profile = profiles[name];
      if (!profile || typeof profile !== "object") {
        console.warn(`[ui2] unknown plot presentation profile: ${name}`);
        return {};
      }
      const inherited = resolve(String(profile.inherits || "").trim(), seen);
      return mergePlotPresentationProfiles(inherited, profile);
    };
    return resolve(profileName);
  }

  function mergePlotPresentationProfiles(base, override) {
    const merged = Object.assign({}, base || {});
    ["font", "background", "grid", "legend", "palette"].forEach((key) => {
      merged[key] = Object.assign({}, base?.[key] || {}, override?.[key] || {});
    });
    merged.styles = Object.assign({}, base?.styles || {});
    Object.entries(override?.styles || {}).forEach(([name, style]) => {
      merged.styles[name] = Object.assign({}, merged.styles[name] || {}, style || {});
    });
    return merged;
  }

  function presentationColor(value, presentation, colors) {
    if (typeof value !== "string" || !value.trim()) {
      return null;
    }
    const token = value.trim();
    const paletteValue = presentation?.palette?.[token];
    if (typeof paletteValue === "string" && paletteValue.trim()) {
      return paletteValue.trim();
    }
    if (token === "panel") {
      return colors.panel;
    }
    if (token === "background") {
      return colors.background;
    }
    if (token === "text") {
      return colors.text;
    }
    if (token === "border") {
      return colors.border;
    }
    if (token === "grid") {
      return colors.grid;
    }
    return token;
  }

  function presentationNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : null;
  }

  function applyPlotPresentationLayout(layout, presentation) {
    if (!presentation || typeof presentation !== "object") {
      return layout;
    }
    const colors = plotlyThemeColors();
    const font = presentation.font || {};
    const background = presentation.background || {};
    const grid = presentation.grid || {};
    const legend = presentation.legend || {};
    const paper = presentationColor(background.page, presentation, colors);
    const plot = presentationColor(background.plot, presentation, colors);
    if (paper) {
      layout.paper_bgcolor = paper;
    }
    if (plot) {
      layout.plot_bgcolor = plot;
    }
    if (typeof font.family === "string" && font.family.trim()) {
      layout.font = Object.assign({}, layout.font || {}, { family: font.family.trim() });
    }
    const labelSize = presentationNumber(font.label_size);
    const tickSize = presentationNumber(font.tick_size);
    const titleSize = presentationNumber(font.title_size);
    if (titleSize !== null) {
      layout.title = Object.assign({}, typeof layout.title === "object" ? layout.title : {}, {
        text: typeof layout.title === "string" ? layout.title : (layout.title?.text || ""),
        font: Object.assign({}, layout.title?.font || {}, { size: titleSize })
      });
    }
    if (legend.font_size != null) {
      const legendSize = presentationNumber(legend.font_size);
      if (legendSize !== null) {
        plotlyLegendKeys(layout).forEach((key) => {
          layout[key] = Object.assign({}, layout[key] || {}, {
            font: Object.assign({}, layout[key]?.font || {}, { size: legendSize })
          });
        });
      }
    }
    const legendBackground = legend.background === "translucent"
      ? colors.legendBackground
      : presentationColor(legend.background, presentation, colors);
    const legendBorder = legend.border === "subtle"
      ? colors.border
      : presentationColor(legend.border, presentation, colors);
    if (legendBackground || legendBorder) {
      plotlyLegendKeys(layout).forEach((key) => {
        layout[key] = Object.assign({}, layout[key] || {},
          legendBackground ? { bgcolor: legendBackground } : {},
          legendBorder ? { bordercolor: legendBorder } : {});
      });
    }
    Object.keys(layout || {}).filter((axisName) => /^(xaxis|yaxis)\d*$/.test(axisName)).forEach((axisName) => {
      const axis = Object.assign({}, layout[axisName] || {});
      if (grid.appearance === "none") {
        axis.showgrid = false;
      } else if (grid.appearance === "subtle") {
        axis.showgrid = true;
        axis.gridcolor = colors.grid;
      }
      const gridColor = presentationColor(grid.color, presentation, colors);
      if (gridColor) {
        axis.gridcolor = gridColor;
      }
      const gridWidth = presentationNumber(grid.width);
      if (gridWidth !== null) {
        axis.gridwidth = gridWidth;
      }
      if (labelSize !== null) {
        axis.title = Object.assign({}, typeof axis.title === "object" ? axis.title : {}, {
          text: typeof axis.title === "string" ? axis.title : (axis.title?.text || ""),
          font: Object.assign({}, axis.title?.font || {}, { size: labelSize })
        });
      }
      if (tickSize !== null) {
        axis.tickfont = Object.assign({}, axis.tickfont || {}, { size: tickSize });
      }
      layout[axisName] = axis;
    });
    return layout;
  }

  function plotlyDataForOutput(output, data) {
    if (!Array.isArray(data)) {
      return [];
    }
    const selection = plotPresentationForOutput(output);
    const traceRoles = selection.traceRoles || {};
    const presentation = plotPresentationProfileForOutput(output);
    return data.map((trace) => {
      const role = trace?.meta?.series_role;
      const policy = role ? traceRoles[role] : null;
      if (!policy || typeof policy !== "object") {
        return trace;
      }
      return applyPlotPresentationStyle(trace, policy, presentation);
    });
  }

  function applyPlotPresentationStyle(trace, policy, presentation) {
    const styled = Object.assign({}, trace);
    const token = String(policy?.token || "").trim();
    const defaultStyles = {
      context: { color: "rgba(113, 196, 232, 0.42)" }
    };
    const style = token ? (presentation?.styles?.[token] || defaultStyles[token]) : null;
    const colors = plotlyThemeColors();
    if (style && typeof style === "object") {
      const color = presentationColor(style.color, presentation, colors);
      const opacity = presentationNumber(style.opacity);
      const lineWidth = presentationNumber(style.line_width);
      const markerSize = presentationNumber(style.marker_size);
      if (color || lineWidth !== null || typeof style.line_style === "string") {
        styled.line = Object.assign({}, trace.line || {},
          color ? { color } : {},
          lineWidth !== null ? { width: lineWidth } : {},
          typeof style.line_style === "string" ? { dash: style.line_style } : {});
      }
      if (color || markerSize !== null || typeof style.marker === "string") {
        styled.marker = Object.assign({}, trace.marker || {},
          color ? { color } : {},
          markerSize !== null ? { size: markerSize } : {},
          typeof style.marker === "string" ? { symbol: style.marker } : {});
      }
      if (opacity !== null) {
        styled.opacity = opacity;
      }
      if (style.legend === "hidden") {
        styled.showlegend = false;
      } else if (style.legend === "shown") {
        styled.showlegend = true;
      }
    }
    if (policy?.legend === "hide") {
      styled.showlegend = false;
    } else if (policy?.legend === "show") {
      styled.showlegend = true;
    }
    return styled;
  }

  function debugPlotlyResize(label, output, width, height) {
    try {
      if (window.localStorage?.getItem("ui2DebugPlotly") !== "1") {
        return;
      }
      const svg = output?.querySelector?.(".svg-container")?.getBoundingClientRect?.();
      const plot = output?.querySelector?.(".plot-container")?.getBoundingClientRect?.();
      console.debug("[ui2 plotly]", label, {
        field: output?.dataset?.outputFieldId || "",
        width,
        height,
        output: output?.getBoundingClientRect?.(),
        plot,
        svg,
        time: Math.round(performance.now())
      });
    } catch (_error) {
      // Diagnostics must never affect runtime behavior.
    }
  }

  function disconnectPlotlyOutputObserver(output) {
    output?._ui2PlotlyResizeObserver?.disconnect?.();
    if (output) {
      output._ui2PlotlyResizeObserver = null;
    }
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
    Object.keys(layout || {}).filter((axisName) => /^(xaxis|yaxis)\d*$/.test(axisName)).forEach((axisName) => {
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

  function clearSubmitResponse() {
    document.getElementById("ui2-submit-response")?.remove();
  }

  function collectControlValues(scope, includeControl) {
    const values = {};
    fieldControls(scope).forEach((control) => {
      const id = control.dataset.fieldId;
      if (!id || control.type === "radio" && !control.checked) {
        return;
      }
      const included = includeControl(control);
      if (!included) {
        if (control.dataset.repeatTableField && control.dataset.matrixRow == null) {
          if (!Array.isArray(values[id])) {
            values[id] = [];
          }
          values[id][Number(control.dataset.repeatTableIndex || 0)] = "";
        }
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

  function updateRepeatTables(scope, rawValues, activeRows) {
    scope.querySelectorAll(".ui2-tableized-repeater").forEach((row) => {
      const controller = row._ui2RepeatTableController;
      const fields = repeatTableFields(row._ui2RepeatTableFields || []);
      const listField = row._ui2RepeatListField;
      const matrix = row.querySelector(".ui2-matrix-wrap");
      const tbody = row.querySelector(".ui2-repeat-table tbody");
      const listBody = row.querySelector(".ui2-repeat-list-body");
      if (!controller || !fields.length) {
        return;
      }
      const controllerActive = !activeRows || activeRows.get(row) !== false;
      if (matrix && matrix._ui2RepeatMatrixField) {
        const table = matrix.querySelector(".ui2-matrix-table");
        if (table) {
          renderRepeatMatrixTable(table, controller, matrix._ui2RepeatMatrixField, rawValues, controllerActive ? dimensionsFromController(controller, rawValues) : [0, 0]);
        }
        return;
      }
      const wanted = controllerActive ? repeatCount(controller, rawValues[controller.id]) : 0;
      if (listField && listBody) {
        while (listBody.children.length < wanted) {
          listBody.appendChild(renderRepeatListRow(listField, listBody.children.length));
        }
        while (listBody.children.length > wanted) {
          listBody.removeChild(listBody.lastElementChild);
        }
        applyRepeatTableValues(listBody, [listField], rawValues);
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
      applyRepeatTableValues(tbody, fields, rawValues);
    });
  }

  function updateRepeatTableCellConditions(scope, rawValues) {
    scope.querySelectorAll(".ui2-tableized-repeater").forEach((row) => {
      const fields = repeatTableFields(row._ui2RepeatTableFields || []);
      const fieldsById = new Map(fields.map((field) => [field.id, field]));
      row.querySelectorAll("[data-repeatcondition]").forEach((cell) => {
        const active = repeatTableConditionValue(
          cell.dataset.repeatcondition,
          rawValues,
          fieldsById,
          Number(cell.dataset.repeatTableIndex || 0)
        );
        cell.classList.toggle("ui2-hidden", !active);
        fieldControls(cell).forEach((control) => {
          control.disabled = !active;
        });
        cell.querySelectorAll(".ui2-native-file").forEach((control) => {
          control.disabled = !active;
        });
      });
      fields.filter((field) => field.repeatcondition).forEach((field) => {
        const fieldId = field.id || "";
        const hasActiveCell = Array.from(row.querySelectorAll(
          `td[data-repeat-table-field="${cssEscape(fieldId)}"]`
        )).some((cell) => !cell.classList.contains("ui2-hidden"));
        row.querySelectorAll(
          `th[data-repeat-table-header="${cssEscape(fieldId)}"]`
        ).forEach((header) => {
          header.classList.toggle("ui2-hidden", !hasActiveCell);
        });
      });
    });
  }

  function applyRepeatTableValues(scope, fields, rawValues) {
    repeatTableFields(fields || []).forEach((field) => {
      const values = rawValues?.[field.id];
      if (!Array.isArray(values)) {
        return;
      }
      Array.from(scope.querySelectorAll(`[data-repeat-table-field="${cssEscape(field.id)}"]`)).forEach((control, index) => {
        const value = inputControlValue(values, control, index);
        if (control.type === "file") {
          return;
        }
        if (control.type === "checkbox") {
          control.checked = value === true || String(value).toLowerCase() === "true" || String(value) === "1";
        } else {
          control.value = value == null ? "" : String(value);
        }
      });
    });
  }

  function repeatIsActive(expression, rawValues, activeRows, rowsByFieldId) {
    if (!expression) {
      return true;
    }
    if (repeatIsCondition(expression)) {
      return repeatConditionValue(expression, rawValues, activeRows, rowsByFieldId);
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

  function repeatIsCondition(expression) {
    return typeof expression === "string" && /(^|[^A-Za-z0-9_:])!|&&|\|\||[()]/.test(expression);
  }

  function repeatConditionTokens(expression) {
    const tokens = [];
    const rx = /\s*(&&|\|\||!|\(|\)|[A-Za-z_][A-Za-z0-9_]*(?::[A-Za-z0-9_.-]+)?)/g;
    let match;
    let pos = 0;
    while ((match = rx.exec(String(expression || ""))) !== null) {
      if (match.index !== pos && /\S/.test(String(expression).slice(pos, match.index))) {
        return null;
      }
      tokens.push(match[1]);
      pos = rx.lastIndex;
    }
    if (/\S/.test(String(expression || "").slice(pos))) {
      return null;
    }
    return tokens;
  }

  function repeatConditionDeps(expression) {
    const tokens = repeatConditionTokens(expression);
    const deps = new Set();
    if (!tokens) {
      return [];
    }
    tokens.forEach((token) => {
      if (/^[A-Za-z_]/.test(token)) {
        deps.add(token.replace(/:.*/, ""));
      }
    });
    return Array.from(deps);
  }

  function conditionalRepeatDependencyIds(scope) {
    const deps = new Set();
    if (!scope) {
      return deps;
    }
    scope.querySelectorAll(".ui2-field[data-repeat]").forEach((row) => {
      const expression = row.dataset.repeat || "";
      if (repeatIsCondition(expression)) {
        repeatConditionDeps(expression).forEach((id) => deps.add(id));
      }
    });
    return deps;
  }

  function repeatConditionValue(expression, rawValues, activeRows, rowsByFieldId) {
    const tokens = repeatConditionTokens(expression);
    let pos = 0;
    if (!tokens || !tokens.length) {
      return false;
    }

    const peek = () => tokens[pos];
    const take = (token) => {
      if (tokens[pos] === token) {
        pos += 1;
        return true;
      }
      return false;
    };

    const primary = () => {
      if (take("!")) {
        return !primary();
      }
      if (take("(")) {
        const value = orExpr();
        return take(")") ? value : false;
      }
      const token = peek();
      if (token && /^[A-Za-z_]/.test(token)) {
        pos += 1;
        return repeatConditionAtom(token, rawValues, activeRows, rowsByFieldId);
      }
      return false;
    };

    const andExpr = () => {
      let value = primary();
      while (take("&&")) {
        value = primary() && value;
      }
      return value;
    };

    const orExpr = () => {
      let value = andExpr();
      while (take("||")) {
        value = andExpr() || value;
      }
      return value;
    };

    const result = orExpr();
    return pos === tokens.length ? result : false;
  }

  function repeatTableConditionValue(expression, rawValues, fieldsById, repeatIndex) {
    const tokens = repeatConditionTokens(expression);
    let pos = 0;
    if (!tokens || !tokens.length) {
      return false;
    }

    const peek = () => tokens[pos];
    const take = (token) => {
      if (tokens[pos] === token) {
        pos += 1;
        return true;
      }
      return false;
    };
    const atom = (token) => {
      const parts = String(token || "").split(":");
      const id = parts[0].trim();
      const choice = parts.length > 1 ? parts.slice(1).join(":") : null;
      const field = fieldsById?.get(id);
      if (!field) {
        return false;
      }
      const actual = inputControlValue(rawValues?.[id], {
        dataset: { repeatTableIndex: String(repeatIndex) }
      }, repeatIndex);
      if (choice !== null) {
        if (String(field.type || "").toLowerCase() === "checkbox") {
          return choice === "true" && (actual === true || String(actual).toLowerCase() === "true" || String(actual) === "1");
        }
        return String(actual) === choice;
      }
      return String(field.type || "").toLowerCase() === "checkbox"
        && (actual === true || String(actual).toLowerCase() === "true" || String(actual) === "1");
    };
    const primary = () => {
      if (take("!")) {
        return !primary();
      }
      if (take("(")) {
        const value = orExpr();
        return take(")") ? value : false;
      }
      const token = peek();
      if (token && /^[A-Za-z_]/.test(token)) {
        pos += 1;
        return atom(token);
      }
      return false;
    };
    const andExpr = () => {
      let value = primary();
      while (take("&&")) {
        value = primary() && value;
      }
      return value;
    };
    const orExpr = () => {
      let value = andExpr();
      while (take("||")) {
        value = andExpr() || value;
      }
      return value;
    };
    const result = orExpr();
    return pos === tokens.length ? result : false;
  }

  function repeatConditionAtom(atom, rawValues, activeRows, rowsByFieldId) {
    const parts = String(atom || "").split(":");
    const id = parts[0].trim();
    const choice = parts.length > 1 ? parts.slice(1).join(":") : null;
    const controllerRow = rowsByFieldId?.get(id);
    if (!id || !controllerRow || activeRows?.get(controllerRow) === false) {
      return false;
    }
    const control = fieldControls(controllerRow)[0];
    const actual = rawValues ? rawValues[id] : undefined;
    if (choice !== null) {
      if (control && control.type === "checkbox") {
        return choice === "true" ? Boolean(actual) : false;
      }
      return String(actual) === choice;
    }
    if (control && control.type === "checkbox") {
      return Boolean(actual);
    }
    return false;
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
    if (repeatIsCondition(row.dataset.repeat)) {
      debug.textContent = `Repeat ${active ? "active" : "hidden"}: ${row.dataset.repeat}`;
      return;
    }
    const controller = row.closest("form")?.querySelector(`.ui2-field[data-field-id="${cssEscape(id)}"]`);
    const controllerActive = !controller || activeRows.get(controller) !== false;
    const expected = rawValue == null ? "truthy" : rawValue.trim();
    const actual = controllerActive ? rawValues[id] : "(inactive)";
    debug.textContent = `Repeat ${active ? "active" : "hidden"}: ${id} is ${JSON.stringify(actual)}; expected ${expected}`;
  }

  function wireControl(control, field) {
    control.id = fieldId(field);
    control.dataset.fieldId = field.id || "";
    if (field.name) {
      control.dataset.fieldName = field.name;
    }
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
    if (field.min != null && field.min !== "") {
      control.min = field.min;
    }
    if (field.max != null && field.max !== "") {
      control.max = field.max;
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
    if (field.min != null && field.min !== "") {
      control.min = field.min;
    }
    if (field.max != null && field.max !== "") {
      control.max = field.max;
    }
    if (field.pattern) {
      control.pattern = field.pattern;
      if (field.patternmessage) {
        control.title = field.patternmessage;
      }
    }
  }

  function fieldControls(scope) {
    return Array.from(scope.querySelectorAll(FIELD_CONTROL_SELECTOR))
      .filter((control) => !String(control.className || "").split(/\s+/).includes("ui2-native-file"));
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
    if (repeatIsCondition(String(expression))) {
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
    const tableFields = repeatTableFields(childFields);
    const explicit = String(field.tableize || "").toLowerCase() === "true";
    if (isRepeater(field) && explicit && tableFields.length) {
      return true;
    }
    const type = String(field.type || "").toLowerCase();
    return isRepeater(field)
      && (type === "integer" || type === "integerpair")
      && tableFields.length > 0
      && tableFields.every((child) => child.role !== "output" && !isRepeater(child));
  }

  function repeatTableFields(fields) {
    return (Array.isArray(fields) ? fields : []).filter((field) => {
      return !isLayoutLabel(field);
    });
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
    const hasMax = controller.max != null && controller.max !== "";
    const min = hasMin ? integerValue(controller.min, 0) : 1;
    const max = hasMax ? Math.max(min, integerValue(controller.max, min)) : null;
    const fallback = integerValue(controller.default, min);
    const parsed = integerValue(value, fallback);
    const bounded = Math.max(min, parsed);
    return max == null ? bounded : Math.min(max, bounded);
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

  function fieldIsFileLike(field) {
    return Boolean(field?.id) && isFileLikeType(field.type);
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
      moduleActionEndpointFor,
      buildActionFormData,
      buildHookFormData,
      applyActionPayload,
      applyActionFields,
      validateModuleForm,
      validateUtilityForm,
      submitModule,
      moduleSubmitEndpointFor,
      buildSubmitFormData,
      serverFileInitialDir,
      serverFileProjectDir,
      serverFileParentDir,
      serverFileRememberDirForSelection,
      serverFileDirLabel,
      serverSelectionDisplayPath,
      serverFileTreeSelectable,
      repeatFileSubmitId,
      serverFileEntryIsFolder,
      fileEntryName,
      fileEntryDetails,
      fileManagerSelectedIds,
      fileManagerSelectedParentIds,
      fileManagerRemovalPrompt,
      fileManagerDeleteFormData,
      renderFileControl,
      renderHookButtonControl,
      renderImageOutputShell,
      renderImageOutput,
      dynamicOutputItems,
      updateDynamicOutput,
      mergeSavedInputPayloads,
      menuVisibleForSession,
      moduleIdFromSwitchParts,
      switchTargetFromValue,
      beginViewReady,
      markViewReady,
      waitForViewReady,
      legacyUtilityFieldName,
      normalizeUi2Theme,
      applyUi2Theme,
      setUi2ThemePreference,
      currentUi2Theme,
      ui2UserConfigFields,
      ui2ThemeOptionValues,
      normalizeAiHelperStatus,
      normalizeAiHelperEndpointState,
      aiHelperEnabledForUser,
      buildAiHelperContext,
      sanitizeAiHelperFormValues,
      aiHelperRunContext,
      aiHelperOutputAnalysis,
      aiHelperSummarizeOutputValue,
      aiHelperUsageSummary,
      normalizeAiHelperUsage,
      replaceSelectOptions,
      settingsProjectFromResponse,
      userConfigGroupVisible,
      parseNglPayload,
      normalizeNglLoadName,
      observeNglOutput,
      resizeNglOutputWhenVisible,
      nglRepresentationSpecs,
      nglRepresentationKey,
      nglRepresentationStoreKey,
      attachNglFileTrajectory,
      nglStreamCoverageValue,
      ngl_stream_telemetry_label,
      normalize_ngl_coordinate_frame,
      queue_ngl_coordinate_frame,
      apply_ngl_coordinate_frame,
      refreshNglOutputFrame,
      ngl_active_frame_index,
      applyPlotlyTheme,
      plotPresentationForOutput,
      plotPresentationProfileForOutput,
      applyPlotPresentationLayout,
      applyPlotPresentationStyle,
      plotlyDataForOutput,
      appendPlotlyOutput,
      rememberPlotlyAppend,
      refreshPlotlyOutputIfNeeded,
      plotlyLayoutForOutput,
      plotlyConfigForOutput,
      plotlyThemeColors,
      repeatIsCondition,
      repeatConditionTokens,
      repeatConditionDeps,
      repeatConditionValue,
      repeatTableConditionValue,
      updateRepeatTableCellConditions,
      repeatControllerId,
      repeatTableFields,
      repeatCount,
      collectControlValues,
      syncValues,
      updateRepeatTables,
      defaultInputPayload,
      resetModuleForm,
      createJobEventStore,
      normalizeJobEvent,
      beginRuntimeOutputContext,
      beginJobOutputContext,
      runtimeOutputToken,
      runtimeOutputContextMatches,
      applyRuntimePayload,
      applyInputPayload,
      validTestScenarioCatalog,
      evaluateTestScenarioVerification,
      testScenarioOutputNonempty,
      applyTestScenario,
      testScenarioSnapshot,
      clearTestScenarios,
      subscribeTestScenarios,
      applySavedJobInput,
      savedInputRestoreError,
      savedInputRestoreWarnings,
      unrecoverableSavedLocalFiles,
      setFileReselectionWarnings,
      clearFileReselectionWarning,
      fileReselectionWarning,
      renderSessionState,
      sessionProjectName,
      state
    };
  }

  init();
}());
