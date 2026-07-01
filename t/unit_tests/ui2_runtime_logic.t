use strict;
use warnings;

use File::Spec;
use File::Temp qw(tempfile);
use FindBin;
use Test::More;

use lib File::Spec->catdir( $FindBin::Bin, '..', 'lib' );
use GenAppTest qw(repo_root);

my $repo_root = repo_root( File::Spec->catdir( $FindBin::Bin, '..' ) );
my ( $fh, $script ) = tempfile( 'ui2-runtime-logic-XXXX', SUFFIX => '.js', TMPDIR => 1, UNLINK => 1 );

print {$fh} <<"JS";
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const repoRoot = "$repo_root";
let source = fs.readFileSync(path.join(repoRoot, "languages/ui2/add/js/ui2.js"), "utf8");
source = source.replace(/\\n  init\\(\\);\\n\\}\\(\\)\\);\\s*\$/, "\\n}());\\n");

function createNode(tag) {
  const classes = new Set();
  const node = {
    tagName: String(tag || "div").toUpperCase(),
    attributes: {},
    dataset: {},
    style: {},
    children: [],
    className: "",
    isConnected: true,
    classList: {
      add(...names) {
        names.filter(Boolean).forEach((name) => classes.add(name));
        node.className = Array.from(classes).join(" ");
      },
      remove(...names) {
        names.forEach((name) => classes.delete(name));
        node.className = Array.from(classes).join(" ");
      },
      toggle(name, force) {
        if (force === true || (force == null && !classes.has(name))) {
          classes.add(name);
        } else {
          classes.delete(name);
        }
        node.className = Array.from(classes).join(" ");
        return classes.has(name);
      }
    },
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    append(...children) {
      this.children.push(...children);
    },
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {},
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
    closest() {
      return null;
    },
    setAttribute(name, value) {
      this.attributes[name] = String(value);
    },
    getAttribute(name) {
      return Object.prototype.hasOwnProperty.call(this.attributes, name) ? this.attributes[name] : null;
    },
    set innerHTML(value) {
      this._html = String(value || "");
    },
    get innerHTML() {
      return this._html || "";
    },
    set textContent(value) {
      this._text = String(value || "");
    },
    get textContent() {
      if (this._text != null) {
        return this._text;
      }
      return String(this._html || "").replace(/<[^>]*>/g, "");
    },
    get innerText() {
      return this.textContent;
    }
  };
  return node;
}

const document = {
  documentElement: { clientHeight: 800, clientWidth: 1200 },
  body: createNode("body"),
  head: createNode("head"),
  scripts: [],
  createElement: createNode,
  getElementById() {
    return null;
  },
  querySelector() {
    return null;
  },
  querySelectorAll() {
    return [];
  }
};

const window = {
  GenAppUi2App: { menus: [] },
  GenAppUi2ExposeTestHooks: true,
  __styleVars: {},
  CSS: { escape(value) { return String(value); } },
  crypto: { randomUUID() { return "uuid-for-test"; } },
  localStorage: { getItem() { return "{}"; }, setItem() {} },
  location: { href: "https://example.test/sassie3/ui2/", pathname: "/sassie3/ui2/", search: "" },
  name: "ui2-test",
  getComputedStyle() {
    return { getPropertyValue(name) { return window.__styleVars[name] || ""; } };
  },
  setTimeout() {},
  clearTimeout() {}
};
window.window = window;
window.document = document;
document.defaultView = window;

const context = {
  console,
  document,
  window,
  atob(value) {
    return Buffer.from(String(value), "base64").toString("binary");
  },
  btoa(value) {
    return Buffer.from(String(value), "binary").toString("base64");
  },
  URL,
  URLSearchParams,
  Event: class Event {
    constructor(type, options) {
      this.type = type;
      this.bubbles = !!options?.bubbles;
    }
  },
  FormData: class FormData {},
  HTMLProgressElement: class HTMLProgressElement {},
  Option: class Option {
    constructor(text, value) {
      this.text = text;
      this.value = value;
    }
  }
};
context.globalThis = context;

vm.createContext(context);
vm.runInContext(source, context, { filename: "ui2.js" });

const hooks = context.window.GenAppUi2TestHooks;
assert(hooks, "test hooks were exposed");

const nglPayload = hooks.parseNglPayload(JSON.stringify({
  loadname: "results/users/Joseph/no_project_specified/run_0/monomer_monte_carlo/movie.pdb",
  loadparams: { ext: "pdb" },
  representations: [{ type: "cartoon", params: { color: "blue" } }]
}));
assert.strictEqual(
  nglPayload.loadname,
  "results/users/Joseph/no_project_specified/run_0/monomer_monte_carlo/movie.pdb",
  "UI2 parses legacy NGL JSON payloads without falling back to raw text"
);
assert.strictEqual(
  hooks.normalizeNglLoadName(nglPayload.loadname),
  "../results/users/Joseph/no_project_specified/run_0/monomer_monte_carlo/movie.pdb",
  "UI2 rebases legacy result-relative NGL paths out of the ui2 subdirectory"
);
assert.strictEqual(
  hooks.normalizeNglLoadName("../results/users/Joseph/model.pdb"),
  "../results/users/Joseph/model.pdb",
  "UI2 does not double-prefix already rebased NGL paths"
);
assert.strictEqual(
  JSON.stringify(hooks.nglRepresentationSpecs(nglPayload)),
  JSON.stringify([{ type: "cartoon", params: { color: "blue" } }]),
  "UI2 preserves legacy NGL representation specs"
);
assert.strictEqual(
  JSON.stringify(hooks.nglRepresentationSpecs({ loadname: "model.pdb" })),
  JSON.stringify([{ type: "cartoon", params: {} }]),
  "UI2 defaults NGL payloads to the legacy cartoon representation"
);

window.__styleVars = {
  "--ui2-panel": "#1a201f",
  "--ui2-bg": "#111615",
  "--ui2-text": "#eef4f1",
  "--ui2-border": "#33403d"
};
const darkLayout = hooks.applyPlotlyTheme({
  legend: { bgcolor: "#ffffff", font: { color: "#ffffff" } }
});
assert.strictEqual(
  darkLayout.legend.bgcolor,
  "#ffffff",
  "UI2 preserves explicit Plotly legend backgrounds from the figure"
);
assert.strictEqual(
  darkLayout.legend.font.color,
  "#17201d",
  "UI2 forces dark legend text when the legend background is light"
);
window.__styleVars = {
  "--ui2-panel": "#ffffff",
  "--ui2-bg": "#f7f8fa",
  "--ui2-text": "#17201d",
  "--ui2-border": "#d8dfdc"
};
const lightLayout = hooks.applyPlotlyTheme({
  legend: { bgcolor: "#1a201f" }
});
assert.strictEqual(
  lightLayout.legend.bgcolor,
  "#1a201f",
  "UI2 preserves explicit dark Plotly legend backgrounds on light themes"
);
assert.strictEqual(
  lightLayout.legend.font.color,
  "#eef4f1",
  "UI2 forces light legend text when the legend background is dark"
);

assert.strictEqual(
  hooks.menuVisibleForSession({ id: "tools" }),
  true,
  "unrestricted UI2 menu groups are visible without session buckets"
);
assert.strictEqual(
  hooks.menuVisibleForSession({ id: "admin", restricted: "admin" }),
  false,
  "restricted UI2 menu groups are hidden until the current user is authorized"
);
hooks.state.session.restricted = ["admin"];
assert.strictEqual(
  hooks.menuVisibleForSession({ id: "admin", restricted: "admin" }),
  true,
  "restricted UI2 menu groups appear for matching appconfig restricted buckets"
);
assert.strictEqual(
  hooks.userConfigGroupVisible("beta", { userconfig: 1 }),
  false,
  "UI2 Settings hides the deprecated beta group even when appconfig marks it user configurable"
);
assert.strictEqual(
  hooks.userConfigGroupVisible("staff", { userconfig: 1 }),
  true,
  "UI2 Settings still shows other user configurable groups"
);
hooks.state.session.restricted = [];

assert(
  source.includes('nodes.jobs?.addEventListener("click", () => openUtilityModule("sys_job_manager"));'),
  "top bar opens Job Manager as a utility overlay"
);
assert(
  source.includes('nodes.files?.addEventListener("click", () => openUtilityModule("sys_file_manager"));'),
  "top bar opens File Manager as a utility overlay"
);
assert(
  source.includes('legacyEndpoint("", "ajax/sys_config/sys_pull.php")') &&
    source.includes('url.searchParams.set("datetime", "0")') &&
    source.includes('input.value = payload.datetime'),
  "system utility serverdate fields use the legacy datetime pull endpoint"
);
assert(
  !source.includes('nodes.jobs?.addEventListener("click", () => loadModule("sys_job_manager"));'),
  "top bar no longer replaces the active module with Job Manager"
);
assert(
  source.includes('submitSystemModuleAction("reattach", [jobId], "sys_job_manager")'),
  "reattach uses the explicit Job Manager endpoint"
);
assert.strictEqual(
  hooks.jobManagerEndpoint,
  "ajax/sys_config/sys_jobs2.php",
  "Job Manager uses the legacy details-capable job feed"
);
assert(
  source.includes('closeUtilityOverlay();\\n      await loadModule(moduleId);'),
  "reattach closes the utility overlay before switching to the attached module"
);
assert(
  source.includes('function openSplashDialog()'),
  "ui2 provides a splash/login dialog helper"
);
assert(
  source.includes('function splashFooterLines()'),
  "ui2 splash builds footer metadata from generated app details"
);
assert(
  source.includes('appMap.generatedOn') &&
    source.includes('appMap.appRevision') &&
    source.includes('appMap.genappRevision'),
  "ui2 splash footer reads legacy generated-on and revision metadata"
);
assert(
  source.includes('openLoginDialog({ mandatory: true });'),
  "logged-out login actions open a mandatory login dialog"
);
assert(
  source.includes('async function openRegisterDialog()'),
  "ui2 exposes a dedicated register dialog helper"
);
assert(
  source.includes('await fetchModuleDefinition("sys_register")') &&
    source.includes('await openRegisterDialog();'),
  "ui2 splash register loads the legacy sys_register module instead of reusing login"
);
assert(
  source.includes('allowBackdropClose: false') &&
    source.includes('onClose: () => {') &&
    source.includes('syncSplashForSession();'),
  "ui2 register dialog returns the user to the splash flow when it closes"
);
assert(
  source.includes('async function runLegacyCaptchaGate()') &&
    source.includes('ajax/sys_config/sys_captcha.php') &&
    source.includes('ajax/sys_config/sys_captcha_verify.php'),
  "ui2 register flow uses the legacy captcha challenge and verify endpoints"
);
assert(
  source.includes('if (String(module.captcha || "").toLowerCase() === "true")') &&
    source.includes('const verified = await runLegacyCaptchaGate();'),
  "ui2 register checks legacy captcha before submitting the real register request"
);
assert(
  source.includes('function applyLoginDialogMode(overlay, mandatory)'),
  "ui2 has a dedicated helper for mandatory login dialog state"
);
assert(
  source.includes('close.hidden = mandatory;') &&
    source.includes('cancel.hidden = mandatory;'),
  "mandatory login hides both close and cancel controls"
);
assert(
  source.includes('function syncSplashForSession()'),
  "ui2 reconciles splash visibility from session status"
);
assert(
  source.includes('renderSessionState();\\n      syncSplashForSession();'),
  "session refresh opens the splash for logged-out users"
);
assert(
  source.includes('if (state.session.logon) {\\n      hideSplashDialog();'),
  "session refresh hides the splash for logged-in users"
);
assert(
  source.includes('function stopSessionRuntime()'),
  "ui2 centralizes session-runtime cleanup"
);
assert(
  source.indexOf("stopSessionRuntime();") >= 0 &&
    source.indexOf("state.freshLoginAfterLogoff = true;", source.indexOf("stopSessionRuntime();")) >
      source.indexOf("stopSessionRuntime();") &&
    source.indexOf("openSplashDialog();", source.indexOf("state.freshLoginAfterLogoff = true;")) >
      source.indexOf("state.freshLoginAfterLogoff = true;"),
  "logoff stops active runtime polling and opens the splash dialog"
);
assert(
  source.includes('hideSplashDialog();\\n        await refreshSessionState();'),
  "successful login hides the splash dialog before refreshing session state"
);
assert(
  source.includes('state.freshLoginAfterLogoff = true;\\n      openSplashDialog();'),
  "logoff marks the next login as a fresh session"
);
assert(
  source.includes('state.freshLoginAfterLogoff = false;\\n          await loadStartupModule();'),
  "login after logoff returns to the startup module instead of the old attached job"
);

function job(id, moduleName, project, endSeconds, endText, duration) {
  return {
    id,
    cells: [
      { value: moduleName },
      { value: project },
      { value: "2026 Jun 28 10:00:00 UTC" },
      { value: "" },
      { value: endText || "" },
      { value: String(endSeconds || 0) },
      { value: duration || "0.5s" }
    ]
  };
}

const legacyJobColumns = [
  { index: 0, name: "actions", label: "Actions", hidden: false },
  { index: 1, name: "module", label: "Module", hidden: false },
  { index: 2, name: "project", label: "Project", hidden: false },
  { index: 3, name: "details", label: "Details", hidden: false },
  { index: 4, name: "start", label: "Start", hidden: false },
  { index: 5, name: "startnumeric", label: "Start numeric", hidden: true },
  { index: 6, name: "end", label: "End", hidden: false },
  { index: 7, name: "endnumeric", label: "End numeric", hidden: true },
  { index: 8, name: "duration", label: "Duration", hidden: false },
  { index: 9, name: "remoteip", label: "Remote IP", hidden: true },
  { index: 10, name: "resource", label: "Resource", hidden: true }
];

function legacyJob(id, moduleName, project, endSeconds, endText, duration, details, actions) {
  return {
    id,
    cells: [
      { value: actions || "→⇒⇓" },
      { value: moduleName },
      { value: project },
      { value: details || "" },
      { value: "2026 Jun 28 10:00:00 UTC" },
      { value: "1000" },
      { value: endText || "" },
      { value: String(endSeconds || 0) },
      { value: duration || "0.5s" },
      { value: "127.0.0.1" },
      { value: "host" }
    ]
  };
}

const now = 2000000;
const rows = [
  job("recent", "tools/data_interpolation", "hello", now - 3600, "", "0.7s"),
  job("old", "tools/data_interpolation", "hello", now - 3 * 86400, "", "0.8s"),
  job("running", "tools/data_interpolation", "hello", 0, "", "active")
];

assert.deepStrictEqual(
  hooks.filterJobRows(rows, { running: false, completed: "1", project: "*all*", module: "*all*" }, now).map((row) => row.id),
  ["recent"],
  "completed-days filter keeps only recent completed jobs"
);

assert.deepStrictEqual(
  hooks.filterJobRows(rows, { running: true, completed: "*all*", project: "*all*", module: "*all*" }, now).map((row) => row.id),
  ["running"],
  "running filter keeps only active jobs"
);

assert.deepStrictEqual(
  hooks.filterJobRows(rows, { running: true, completed: "1", project: "*all*", module: "*all*" }, now).map((row) => row.id),
  ["running"],
  "running filter is not hidden by the completed-days filter"
);

assert.deepStrictEqual(
  hooks.filterJobRows(rows, { running: false, completed: "*all*", project: "hello", module: "tools/data_interpolation" }, now).map((row) => row.id),
  ["recent", "old", "running"],
  "project and module filters match loaded row values"
);

const legacyRows = [
  legacyJob(
    "active-job",
    "simulate/monomer_monte_carlo",
    "<font color='red'>no_project_specified</font>",
    0,
    "18.2% (e.c. 1m 51.19s)",
    "active",
    "run_0/monomer_monte_carlo/",
    "→⇒⊗&#x1F512;"
  )
];
assert.deepStrictEqual(
  hooks.jobDisplayColumns(legacyJobColumns).map((column) => column.name),
  ["module", "project", "details", "start", "end", "duration"],
  "Job Manager displays Details while hiding legacy technical columns"
);

const jobThead = createNode("thead");
const jobTbody = createNode("tbody");
hooks.renderJobManagerTable(jobThead, jobTbody, legacyJobColumns, legacyRows);
assert(
  jobThead.children[0].children.map((cell) => cell.textContent).includes("Details"),
  "Job Manager renders the Details header"
);
assert(
  jobTbody.children[0].className.includes("ui2-job-row-running"),
  "running jobs get a row marker"
);
assert(
  jobTbody.children[0].className.includes("ui2-job-row-locked"),
  "locked jobs get a row marker"
);
assert(
  jobTbody.children[0].children.map((cell) => cell.textContent).includes("run_0/monomer_monte_carlo/"),
  "Job Manager renders Details values"
);
const projectCell = jobTbody.children[0].children.find((cell) => cell.textContent === "no_project_specified");
assert(projectCell, "Job Manager renders the project cell");
assert(
  projectCell.className.includes("ui2-job-project-red"),
  "locked running project is rendered in red"
);
const actionText = jobTbody.children[0].children[1].children.map((button) => button.textContent).join("");
assert(
  actionText.includes("⊗"),
  "running job renders the cancel action"
);
assert(
  actionText.includes("🔒"),
  "locked job renders the clear-lock action"
);

assert.strictEqual(
  hooks.moduleIdFromSwitchParts(["tools", "data_interpolation", "no_project_specified", "18a53955-2cca-4aa8-9783-1f31e46ba6ff"]),
  "data_interpolation",
  "legacy menu/module/project/job switch targets restore the module id"
);

assert.strictEqual(
  hooks.moduleIdFromSwitchParts(["data_interpolation", "no_project_specified", "18a53955-2cca-4aa8-9783-1f31e46ba6ff"]),
  "data_interpolation",
  "legacy module/project/job switch targets restore the module id"
);

const parentRows = {
  themetype: { dataset: { fieldId: "themetype", repeat: "changetheme" } },
  changetheme: { dataset: { fieldId: "changetheme" } }
};
const themeControl = {
  dataset: { fieldId: "themelight" },
  closest(selector) {
    if (selector === ".ui2-field") {
      return { dataset: { fieldId: "themelight", repeat: "themetype:light" } };
    }
    if (selector === "form") {
      return {
        querySelector(selectorText) {
          if (selectorText.includes('data-field-id="themetype"')) {
            return parentRows.themetype;
          }
          if (selectorText.includes('data-field-id="changetheme"')) {
            return parentRows.changetheme;
          }
          return null;
        }
      };
    }
    return null;
  }
};
assert.strictEqual(
  hooks.legacyUtilityFieldName(themeControl),
  "changetheme-themetype-light-themelight",
  "Settings submits nested theme repeat fields using the legacy PHP field name"
);

const passwordControl = {
  dataset: { fieldId: "password1" },
  closest(selector) {
    if (selector === ".ui2-field") {
      return { dataset: { fieldId: "password1", repeat: "changepassword" } };
    }
    if (selector === "form") {
      return { querySelector() { return { dataset: { fieldId: "changepassword" } }; } };
    }
    return null;
  }
};
assert.strictEqual(
  hooks.legacyUtilityFieldName(passwordControl),
  "changepassword-password1",
  "Settings submits direct repeat fields using the legacy PHP field name"
);

const selectControl = {
  dataset: { fieldId: "project", pullKey: "project" },
  value: "",
  children: [],
  appendChild(child) {
    this.children.push(child);
    return child;
  },
  set innerHTML(value) {
    this.children = [];
    this._html = String(value || "");
  }
};
hooks.state.session.project = "hello";
hooks.replaceSelectOptions(selectControl, ["alpha", "hello", "no_project_specified"]);
assert.deepStrictEqual(
  selectControl.children.map((option) => [option.value, option.text]),
  [["alpha", "alpha"], ["hello", "hello"], ["no_project_specified", "no_project_specified"]],
  "Settings rebuilds pulled project listbox options from the legacy array payload"
);
assert.strictEqual(selectControl.value, "hello", "Settings selects the current session project after pulling projects");

assert.strictEqual(
  JSON.stringify(hooks.normalizeFileList({ out: ["results/users/Joseph/min3.pdb"], extra: "results/users/Joseph/no_project_specified.tar" })),
  JSON.stringify(["results/users/Joseph/min3.pdb", "results/users/Joseph/no_project_specified.tar"]),
  "download file payloads can be object, array, or string shaped"
);

const links = hooks.fileDownloadLinks("results/users/Joseph/min3.pdb");
assert(links.includes("../results/users/Joseph/min3.pdb"), "download link targets the generated app path");
assert(links.includes("min3.pdb"), "download link labels the selected file");

assert.strictEqual(
  hooks.moduleSubmitEndpointFor({ executable: "sys_file_manager" }, "etc", "sys_file_manager"),
  "/sassie3/ajax/etc/sys_file_manager.php",
  "system utility submit endpoints can be computed without replacing the active module"
);

const payloadFiles = hooks.payloadFileList({ outfile: "results/users/Joseph/min3.pdb" });
assert.strictEqual(JSON.stringify(payloadFiles), JSON.stringify(["results/users/Joseph/min3.pdb"]), "single outfile payloads are accepted");

const nestedPayloadFiles = hooks.payloadFileList({
  _status: "complete",
  output: {
    fields: {
      outfiles: ["results/users/Joseph/no_project_specified/min3.pdb"]
    }
  }
});
assert.strictEqual(
  JSON.stringify(nestedPayloadFiles),
  JSON.stringify(["results/users/Joseph/no_project_specified/min3.pdb"]),
  "nested outfile payloads from async system jobs are accepted"
);

assert.strictEqual(
  hooks.serverSelectionDisplayPath("Li9zYW5zX2RhdGEuc3Vi", "<i>Server</i>: sans_data.sub"),
  "sans_data.sub",
  "server file replay prefers the legacy html display label"
);

const mergedInputPayload = hooks.mergeSavedInputPayloads(
  { _getinput: { run_name: "run_0" } },
  {
    _getinput: {
      _selaltval_data_file_name: "data_file_name_altval",
      data_file_name_altval: ["Li9zYW5zX2RhdGEuc3Vi"],
      _html_data_file_name_altval: "<i>Server</i>: sans_data.sub"
    }
  }
);
assert.strictEqual(
  JSON.stringify(mergedInputPayload._getinput),
  JSON.stringify({
    run_name: "run_0",
    _selaltval_data_file_name: "data_file_name_altval",
    data_file_name_altval: ["Li9zYW5zX2RhdGEuc3Vi"],
    _html_data_file_name_altval: "<i>Server</i>: sans_data.sub"
  }),
  "attach replay merges direct saved-input logs over incomplete get_results input"
);

const replayControl = {
  type: "text",
  value: "",
  dataset: { fieldId: "data_file_name" },
  closest(selector) {
    return selector === "#ui2-form" ? {} : null;
  },
  dispatchEvent(event) {
    this.lastEvent = event.type;
  }
};
document.querySelectorAll = (selector) => (
  selector === "[data-field-id=\\"data_file_name\\"]" ? [replayControl] : []
);
document.getElementById = () => null;
hooks.state.module = {
  fields: [
    { id: "data_file_name", type: "lrfile" }
  ]
};
hooks.state.serverSelections = {};
hooks.applyInputPayload({
  run_name: "run_0",
  _selaltval_data_file_name: "data_file_name_altval",
  data_file_name_altval: ["Li9zYW5zX2RhdGEuc3Vi"],
  _html_data_file_name_altval: "<i>Server</i>: sans_data.sub"
});
assert.strictEqual(replayControl.value, "sans_data.sub", "attach replay restores the visible server file label");
assert.strictEqual(
  hooks.state.serverSelections["data_file_name:"].encodedPath,
  "Li9zYW5zX2RhdGEuc3Vi",
  "attach replay restores the server selection payload for later submit"
);

replayControl.value = "";
hooks.state.serverSelections = {};
hooks.applyInputPayload({
  data_file_name_altval: ["Li9zYW5zX2RhdGEuc3Vi"],
  _html_data_file_name_altval: "<i>Server</i>: sans_data.sub"
});
assert.strictEqual(replayControl.value, "sans_data.sub", "attach replay restores server file labels without the selected-alt marker");
assert.strictEqual(
  hooks.state.serverSelections["data_file_name:"].encodedPath,
  "Li9zYW5zX2RhdGEuc3Vi",
  "attach replay restores server selection payloads without the selected-alt marker"
);

const dynamicGroup = {
  dataset: {
    outputFieldId: "dynamic_plots",
    outputType: "plotly",
    dynamicIdPrefix: "sascalc_dyn_plot",
    dynamicMax: "2",
    dynamicLabel: "Additional plots"
  }
};
const dynamicItems = hooks.dynamicOutputItems(dynamicGroup, {
  items: [
    { label: "First plot", value: { data: [] } },
    { id: "custom_plot", label: "Custom plot", data: { data: [] } },
    { id: "ignored_plot", value: { data: [] } }
  ]
});
assert.strictEqual(dynamicItems.length, 2, "dynamic output items honor the declared max");
assert.strictEqual(dynamicItems[0].id, "sascalc_dyn_plot_1", "dynamic output items generate ids from idprefix");
assert.strictEqual(dynamicItems[1].id, "custom_plot", "dynamic output items honor explicit safe ids");
assert.deepStrictEqual(dynamicItems[1].value, { data: [] }, "dynamic output items accept legacy data payload values");

const unsafeDynamicItems = hooks.dynamicOutputItems(dynamicGroup, [
  { id: "../bad id", value: "clean me" }
]);
assert.strictEqual(unsafeDynamicItems[0].id, "badid", "dynamic output explicit ids are sanitized");
JS
close $fh;

my $node = $ENV{NODE} || 'node';
my $output = `$node "$script" 2>&1`;
my $status = $? >> 8;

is( $status, 0, 'ui2 runtime helper behavior passes executable checks' )
    or diag($output);

done_testing();
