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
  function syncClassesFromName() {
    String(node.className || "").split(/\\s+/).filter(Boolean).forEach((name) => classes.add(name));
  }
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
        syncClassesFromName();
        names.filter(Boolean).forEach((name) => classes.add(name));
        node.className = Array.from(classes).join(" ");
      },
      remove(...names) {
        syncClassesFromName();
        names.forEach((name) => classes.delete(name));
        node.className = Array.from(classes).join(" ");
      },
      toggle(name, force) {
        syncClassesFromName();
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
      child.parentNode = this;
      this.children.push(child);
      return child;
    },
    removeChild(child) {
      const index = this.children.indexOf(child);
      if (index >= 0) {
        this.children.splice(index, 1);
        child.parentNode = null;
      }
      return child;
    },
    append(...children) {
      children.forEach((child) => {
        child.parentNode = this;
        this.children.push(child);
      });
    },
    remove() {
      if (!this.parentNode) {
        return;
      }
      this.parentNode.children = this.parentNode.children.filter((child) => child !== this);
      this.parentNode = null;
    },
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {},
    querySelector(selector) {
      return querySelectorFrom(this, selector);
    },
    querySelectorAll(selector) {
      return querySelectorAllFrom(this, selector);
    },
    closest(selector) {
      let current = this;
      while (current) {
        if (matchesSelector(current, selector)) {
          return current;
        }
        current = current.parentNode || null;
      }
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
    },
    get lastElementChild() {
      return this.children.length ? this.children[this.children.length - 1] : null;
    },
    get parentElement() {
      return this.parentNode || null;
    },
    get rows() {
      return this.tagName === "TBODY" || this.tagName === "TABLE"
        ? this.children.filter((child) => child.tagName === "TR")
        : undefined;
    },
    deleteRow(index) {
      const rows = this.rows || [];
      const row = rows[index];
      if (row) {
        this.removeChild(row);
      }
    }
  };
  return node;
}

function querySelectorFrom(root, selector) {
  return querySelectorAllFrom(root, selector)[0] || null;
}

function querySelectorAllFrom(root, selector) {
  const selectors = String(selector || "").split(",").map((item) => item.trim()).filter(Boolean);
  const results = [];
  if (selectors.length === 1 && /\\s+/.test(selectors[0])) {
    const parts = selectors[0].split(/\\s+/).filter(Boolean);
    let scopes = [root];
    parts.forEach((part) => {
      scopes = scopes.flatMap((scope) => querySelectorAllFrom(scope, part));
    });
    return scopes;
  }
  function walk(node) {
    (node.children || []).forEach((child) => {
      if (selectors.some((item) => matchesSelector(child, item))) {
        results.push(child);
      }
      walk(child);
    });
  }
  walk(root);
  return results;
}

function matchesSelector(node, selector) {
  if (!node || !selector) {
    return false;
  }
  if (selector.startsWith("#")) {
    return node.id === selector.slice(1);
  }
  if (selector.startsWith(".")) {
    return String(node.className || "").split(/\\s+/).includes(selector.slice(1));
  }
  const compound = new RegExp('^([A-Za-z][A-Za-z0-9_-]*)?(\\\\.[A-Za-z0-9_-]+)?\\\\[data-([A-Za-z0-9_-]+)(?:="([^"]*)")?\\\\]\$').exec(selector);
  if (compound) {
    const [, tag, className, dataName, expected] = compound;
    if (tag && node.tagName !== tag.toUpperCase()) {
      return false;
    }
    if (className && !String(node.className || "").split(/\\s+/).includes(className.slice(1))) {
      return false;
    }
    const key = dataName.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
    if (!Object.prototype.hasOwnProperty.call(node.dataset || {}, key)) {
      return false;
    }
    return expected == null || String(node.dataset[key]) === expected;
  }
  if (selector.startsWith("[data-") && selector.endsWith("]")) {
    const body = selector.slice(6, -1);
    const equalAt = body.indexOf("=");
    const name = equalAt >= 0 ? body.slice(0, equalAt) : body;
    let expected = equalAt >= 0 ? body.slice(equalAt + 1) : null;
    if (expected && expected.startsWith('"') && expected.endsWith('"')) {
      expected = expected.slice(1, -1);
    }
    const key = name.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
    if (!Object.prototype.hasOwnProperty.call(node.dataset || {}, key)) {
      return false;
    }
    return expected == null || String(node.dataset[key]) === expected;
  }
  return node.tagName === selector.toUpperCase();
}

const document = {
  documentElement: { clientHeight: 800, clientWidth: 1200, dataset: {} },
  body: createNode("body"),
  head: createNode("head"),
  scripts: [],
  createElement: createNode,
  getElementById(id) {
    return querySelectorFrom(this.body, `#\${id}`) || querySelectorFrom(this.head, `#\${id}`);
  },
  querySelector(selector) {
    return querySelectorFrom(this.body, selector) || querySelectorFrom(this.head, selector);
  },
  querySelectorAll(selector) {
    return [...querySelectorAllFrom(this.body, selector), ...querySelectorAllFrom(this.head, selector)];
  }
};

const window = {
  GenAppUi2App: { menus: [] },
  GenAppUi2ExposeTestHooks: true,
  __styleVars: {},
  __localStorage: {},
  CSS: { escape(value) { return String(value); } },
  crypto: { randomUUID() { return "uuid-for-test"; } },
  localStorage: {
    getItem(key) {
      return window.__localStorage[key] || "{}";
    },
    setItem(key, value) {
      window.__localStorage[key] = String(value);
    }
  },
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
  FormData: class FormData {
    constructor() {
      this.values = new Map();
    }
    set(key, value) {
      this.values.set(key, String(value));
    }
    append(key, value) {
      const current = this.values.get(key);
      if (current === undefined) {
        this.values.set(key, [String(value)]);
        return;
      }
      if (Array.isArray(current)) {
        current.push(String(value));
        return;
      }
      this.values.set(key, [current, String(value)]);
    }
    delete(key) {
      this.values.delete(key);
    }
    get(key) {
      return this.values.get(key);
    }
  },
  HTMLProgressElement: class HTMLProgressElement {},
  Option: class Option {
    constructor(text, value) {
      this.text = text;
      this.value = value;
    }
  }
};
context.globalThis = context;

const sessionStatus = createNode("span");
sessionStatus.id = "ui2-session-status";
document.body.appendChild(sessionStatus);

vm.createContext(context);
vm.runInContext(source, context, { filename: "ui2.js" });

const hooks = context.window.GenAppUi2TestHooks;
assert(hooks, "test hooks were exposed");

assert.strictEqual(hooks.normalizeUi2Theme("dark"), "dark", "UI2 accepts the native dark theme id");
assert.strictEqual(hooks.normalizeUi2Theme("LIGHT"), "light", "UI2 normalizes native theme ids");
assert.strictEqual(hooks.normalizeUi2Theme("slate"), "slate", "UI2 accepts the legacy-default Slate theme id");
assert.strictEqual(hooks.normalizeUi2Theme("superhero"), "superhero", "UI2 accepts legacy-inspired theme ids");
assert.strictEqual(hooks.normalizeUi2Theme("unknown"), "slate", "UI2 falls back to Slate for unknown theme ids");
assert.strictEqual(hooks.currentUi2Theme(), "slate", "UI2 starts in Slate theme mode by default");
hooks.applyUi2Theme("cyborg");
assert.strictEqual(document.documentElement.dataset.ui2Theme, "cyborg", "UI2 applies named native themes at the document root");
hooks.setUi2ThemePreference("flatly", true);
assert.strictEqual(hooks.currentUi2Theme(), "flatly", "UI2 stores the active native theme");
assert.strictEqual(
  JSON.parse(window.__localStorage["genapp-ui2-preferences"]).ui2Theme,
  "flatly",
  "UI2 persists the native theme in UI2 preferences"
);
assert.strictEqual(
  hooks.ui2ThemeOptionValues().includes("Superhero~superhero") && hooks.ui2ThemeOptionValues().includes("Flatly~flatly"),
  true,
  "UI2 Settings exposes legacy-inspired theme candidates"
);
const nativeThemeFields = hooks.ui2UserConfigFields([
  { id: "project", type: "listbox" },
  { id: "changetheme", type: "checkbox" },
  { id: "themetype", type: "listbox" },
  { id: "themedark", type: "listbox" },
  { id: "themelight", type: "listbox" },
  { id: "theme", type: "listbox" },
  { id: "help", type: "checkbox" }
]);
assert.strictEqual(
  nativeThemeFields.map((field) => field.id).join(","),
  "project,ui2theme,help",
  "UI2 replaces the legacy theme cluster with one native Settings field"
);
assert.strictEqual(
  nativeThemeFields.find((field) => field.id === "ui2theme").ui2LocalPreference,
  true,
  "UI2 marks the native theme Settings field as a local preference"
);

hooks.state.session = { logon: "Joseph", project: "" };
hooks.renderSessionState();
assert.strictEqual(sessionStatus.textContent, "Project no_project_specified", "UI2 header uses the legacy default project for empty project state");
hooks.state.session.project = "no_project_specified";
hooks.renderSessionState();
assert.strictEqual(sessionStatus.textContent, "Project no_project_specified", "UI2 header displays the legacy default project name");
hooks.state.session.project = "hello";
hooks.renderSessionState();
assert.strictEqual(sessionStatus.textContent, "Project hello", "UI2 header displays selected project names");
hooks.state.session.project = "  ";
assert.strictEqual(hooks.sessionProjectName(), "no_project_specified", "UI2 treats blank project strings as the legacy default project");

const folderEntry = { id: btoa("./project"), text: "project", children: true };
const fileEntry = { id: btoa("./project/input.pdb"), text: "input.pdb | 1.2Mb | 2026 Jul 03 12:00:00 UTC" };
assert.strictEqual(hooks.serverFileEntryIsFolder(folderEntry), true, "UI2 recognizes server folder entries");
assert.strictEqual(hooks.serverFileEntryIsFolder(fileEntry), false, "UI2 recognizes server file entries");
assert.strictEqual(hooks.serverFileTreeSelectable(folderEntry, "lrfile"), false, "UI2 lrfile chooser does not select folders");
assert.strictEqual(hooks.serverFileTreeSelectable(fileEntry, "lrfile"), true, "UI2 lrfile chooser selects file leaves");
assert.strictEqual(hooks.serverFileTreeSelectable(folderEntry, "rpath"), true, "UI2 rpath chooser selects folders");
assert.strictEqual(hooks.serverFileTreeSelectable(fileEntry, "rpath"), false, "UI2 rpath chooser does not select file leaves");
assert.strictEqual(hooks.fileEntryName(fileEntry), "input.pdb", "UI2 server file tree strips metadata from the visible file name");
assert.strictEqual(hooks.fileEntryDetails(fileEntry), "1.2Mb | 2026 Jul 03 12:00:00 UTC", "UI2 server file tree preserves file metadata separately");
hooks.state.session = { logon: "Joseph", project: "hello" };
hooks.state.lastServerFileDir = "";
hooks.state.lastServerFileSessionKey = "";
assert.strictEqual(hooks.serverFileProjectDir(), btoa("./hello"), "UI2 server chooser can root at the current project without using project-scoped ajax");
assert.strictEqual(hooks.serverFileInitialDir(), btoa("./hello"), "UI2 server chooser starts in the current project when no path is remembered");
hooks.state.lastServerFileDir = btoa("./test3");
hooks.state.lastServerFileSessionKey = "Joseph:hello";
assert.strictEqual(hooks.serverFileInitialDir(), btoa("./test3"), "UI2 server chooser reopens the last folder in the same user/project session");
hooks.state.lastServerFileSessionKey = "Joseph:other";
assert.strictEqual(hooks.serverFileInitialDir(), btoa("./hello"), "UI2 server chooser ignores a remembered folder from another project session");
assert.strictEqual(hooks.serverFileParentDir(btoa("./hello/subdir")), btoa("./hello"), "UI2 server chooser computes an up-folder target");
assert.strictEqual(hooks.serverFileParentDir(btoa("./hello")), "#", "UI2 server chooser can move up from a project to the user root");
assert.strictEqual(hooks.serverFileRememberDirForSelection(fileEntry, "lrfile"), btoa("./project"), "UI2 remembers the containing folder after selecting a server file");
assert.strictEqual(hooks.serverFileRememberDirForSelection(folderEntry, "rpath"), btoa("./project"), "UI2 remembers the selected folder after selecting a server path");
assert.strictEqual(hooks.serverFileDirLabel(btoa("./project/subdir")), "User files / project/subdir", "UI2 labels server chooser paths relative to the user file root");

function conditionRow(id, type, value) {
  const row = createNode("div");
  row.className = "ui2-field";
  row.dataset.fieldId = id;
  const input = createNode(type === "textarea" ? "textarea" : type === "select" ? "select" : "input");
  input.type = type;
  input.dataset.fieldId = id;
  input.value = value == null ? "" : String(value);
  input.checked = value === true;
  row.appendChild(input);
  return row;
}

assert.strictEqual(hooks.repeatIsCondition("field"), false, "legacy repeat field refs are not condition expressions");
assert.strictEqual(hooks.repeatIsCondition("field:choice"), false, "legacy repeat choice refs are not condition expressions");
assert.strictEqual(hooks.repeatIsCondition("!use_experimental_data"), true, "negated repeats are condition expressions");
assert.strictEqual(hooks.repeatIsCondition("use_experimental_data && neutron_checkbox"), true, "compound repeats are condition expressions");
assert.deepStrictEqual(
  Array.from(hooks.repeatConditionTokens("use_experimental_data && (neutron_checkbox || xray_checkbox)")),
  ["use_experimental_data", "&&", "(", "neutron_checkbox", "||", "xray_checkbox", ")"],
  "UI2 tokenizes nested repeat condition expressions"
);
assert.deepStrictEqual(
  Array.from(hooks.repeatConditionDeps("mode:advanced && use_experimental_data")),
  ["mode", "use_experimental_data"],
  "UI2 extracts repeat condition dependencies without choice suffixes"
);
assert.strictEqual(
  hooks.repeatControllerId("mode:advanced && use_experimental_data"),
  "",
  "UI2 does not treat repeat condition expressions as repeater controller ids"
);
assert.strictEqual(
  hooks.repeatControllerId("mode:advanced"),
  "mode",
  "UI2 keeps legacy repeat choice controller ids"
);
assert.strictEqual(
  hooks.repeatCount({ min: 1, max: 2, default: 1 }, 5),
  2,
  "UI2 repeat counts honor a controller max when one is declared"
);
assert.strictEqual(
  hooks.repeatCount({ min: 1, default: 1 }, 5),
  5,
  "UI2 repeat counts remain open-ended when a controller max is not declared"
);

const useExperimentalRow = conditionRow("use_experimental_data", "checkbox", true);
const neutronRow = conditionRow("neutron_checkbox", "checkbox", false);
const xrayRow = conditionRow("xray_checkbox", "checkbox", true);
const modeRow = conditionRow("mode", "select-one", "advanced");
const titleRow = conditionRow("title", "text", "hello");
const conditionRowsById = new Map([
  ["use_experimental_data", useExperimentalRow],
  ["neutron_checkbox", neutronRow],
  ["xray_checkbox", xrayRow],
  ["mode", modeRow],
  ["title", titleRow]
]);
const activeConditionRows = new Map(Array.from(conditionRowsById.values()).map((row) => [row, true]));
const conditionValues = {
  use_experimental_data: true,
  neutron_checkbox: false,
  xray_checkbox: true,
  mode: "advanced",
  title: "hello"
};
assert.strictEqual(
  hooks.repeatConditionValue("use_experimental_data && (neutron_checkbox || xray_checkbox)", conditionValues, activeConditionRows, conditionRowsById),
  true,
  "UI2 evaluates checkbox OR/AND repeat condition gates"
);
assert.strictEqual(
  hooks.repeatConditionValue("mode:advanced && use_experimental_data", conditionValues, activeConditionRows, conditionRowsById),
  true,
  "UI2 evaluates list-like repeat conditions with field:choice atoms"
);
assert.strictEqual(
  hooks.repeatConditionValue("!neutron_checkbox", conditionValues, activeConditionRows, conditionRowsById),
  true,
  "UI2 evaluates negated checkbox repeat conditions"
);
assert.strictEqual(
  hooks.repeatConditionValue("use_experimental_data:false", conditionValues, activeConditionRows, conditionRowsById),
  false,
  "UI2 rejects checkbox:false at runtime instead of treating it as a valid gate"
);
assert.strictEqual(
  hooks.repeatConditionValue("title", conditionValues, activeConditionRows, conditionRowsById),
  false,
  "UI2 bare repeat condition atoms only pass for checkboxes"
);
assert.strictEqual(
  hooks.repeatConditionValue("missing_checkbox", conditionValues, activeConditionRows, conditionRowsById),
  false,
  "UI2 fails closed when repeat condition dependencies are missing"
);
activeConditionRows.set(useExperimentalRow, false);
assert.strictEqual(
  hooks.repeatConditionValue("use_experimental_data && xray_checkbox", conditionValues, activeConditionRows, conditionRowsById),
  false,
  "UI2 fails closed when a repeat condition dependency is itself hidden"
);
activeConditionRows.set(useExperimentalRow, true);
assert.strictEqual(
  hooks.repeatConditionValue("use_experimental_data && (xray_checkbox", conditionValues, activeConditionRows, conditionRowsById),
  false,
  "UI2 fails closed on malformed repeat condition expressions"
);

const repeatScope = createNode("form");
const repeatRow = createNode("div");
repeatRow.className = "ui2-field ui2-tableized-repeater";
repeatRow._ui2RepeatTableController = { id: "xray_experimental_number_contrast_points", min: 1, default: 1 };
repeatRow._ui2RepeatTableFields = [{ id: "xray_experimental_data_file_array", type: "text", label: "X-ray experimental data file" }];
repeatRow._ui2RepeatListField = repeatRow._ui2RepeatTableFields[0];
const repeatListBody = createNode("div");
repeatListBody.className = "ui2-repeat-list-body";
repeatRow.appendChild(repeatListBody);
repeatScope.appendChild(repeatRow);
hooks.updateRepeatTables(
  repeatScope,
  { xray_experimental_number_contrast_points: 2 },
  new Map([[repeatRow, true]])
);
assert.strictEqual(
  repeatListBody.children.length,
  2,
  "UI2 builds repeated file rows while the compound controller is active"
);
hooks.updateRepeatTables(
  repeatScope,
  { xray_experimental_number_contrast_points: 2 },
  new Map([[repeatRow, false]])
);
assert.strictEqual(
  repeatListBody.children.length,
  0,
  "UI2 clears repeated file rows when the compound controller becomes inactive"
);
assert.deepStrictEqual(
  hooks.repeatTableFields([
    { id: "region_label", type: "label", label: "Region", repeat: "number_flexible_regions" },
    { id: "move_type", type: "listbox", label: "move type", repeat: "number_flexible_regions" },
    { id: "flexible_region", type: "text", label: "flexible region", repeat: "number_flexible_regions" }
  ]).map((field) => field.id),
  ["move_type", "flexible_region"],
  "UI2 excludes layout labels from tableized repeat columns"
);

function ui2MultiColumnRepeatForm() {
  const form = createNode("form");
  form.id = "ui2-form";

  const runRow = createNode("div");
  runRow.className = "ui2-field";
  runRow.dataset.fieldId = "run_name";
  const runName = createNode("input");
  runName.type = "text";
  runName.dataset.fieldId = "run_name";
  runName.value = "run_0";
  runRow.appendChild(runName);
  form.appendChild(runRow);

  const controllerRow = createNode("div");
  controllerRow.className = "ui2-field ui2-tableized-repeater";
  controllerRow.dataset.fieldId = "number_contrast_points";
  const controller = createNode("input");
  controller.type = "number";
  controller.dataset.fieldId = "number_contrast_points";
  controller.value = "4";
  controllerRow.appendChild(controller);
  controllerRow._ui2RepeatTableController = {
    id: "number_contrast_points",
    type: "integer",
    min: 1,
    default: 4
  };
  controllerRow._ui2RepeatTableFields = [
    { id: "d2o_fraction", type: "float", default: ["0.0", "0.2", "0.85", "1.0"] },
    { id: "total_concentration", type: "float", default: ["7.7", "7.7", "7.7", "7.7"] },
    { id: "total_concentration_error", type: "float", default: ["0.4", "0.4", "0.4", "0.4"] },
    { id: "i_zero", type: "float", default: ["0.85", "0.534", "0.013", "0.095"] },
    { id: "i_zero_error", type: "float", default: ["0.01", "0.044", "0.003", "0.002"] }
  ];
  const table = createNode("table");
  table.className = "ui2-repeat-table";
  const tbody = createNode("tbody");
  table.appendChild(tbody);
  controllerRow.appendChild(table);
  form.appendChild(controllerRow);
  document.body.appendChild(form);
  return { form, runName, controller, controllerRow, tbody };
}

document.body.children = [];
hooks.state.module = {
  fields: [
    { id: "run_name", type: "text", default: "run_0" },
    { id: "number_contrast_points", type: "integer", default: 4, min: 1, repeater: "true", tableize: "true" },
    { id: "d2o_fraction", type: "float", default: ["0.0", "0.2", "0.85", "1.0"], repeat: "number_contrast_points" },
    { id: "total_concentration", type: "float", default: ["7.7", "7.7", "7.7", "7.7"], repeat: "number_contrast_points" },
    { id: "total_concentration_error", type: "float", default: ["0.4", "0.4", "0.4", "0.4"], repeat: "number_contrast_points" },
    { id: "i_zero", type: "float", default: ["0.85", "0.534", "0.013", "0.095"], repeat: "number_contrast_points" },
    { id: "i_zero_error", type: "float", default: ["0.01", "0.044", "0.003", "0.002"], repeat: "number_contrast_points" }
  ]
};
const multiRepeat = ui2MultiColumnRepeatForm();
hooks.applyInputPayload({
  run_name: "run_33",
  number_contrast_points: "4",
  d2o_fraction: ["0.0", "0.15", "0.85", "1.0"],
  total_concentration: ["7.7", "7.7", "7.7", "7.7"],
  total_concentration_error: ["0.4", "0.4", "0.4", "0.4"],
  i_zero: ["0.85", "0.534", "0.013", "0.095"],
  i_zero_error: ["0.01", "0.044", "0.003", "0.002"]
});
assert.strictEqual(multiRepeat.runName.value, "run_33", "UI2 reattach restores scalar values before repeated table replay");
assert.strictEqual(multiRepeat.tbody.rows.length, 4, "UI2 reattach builds the repeated table row count from saved input");
assert.strictEqual(
  multiRepeat.tbody.rows[1].children[0].children[0].value,
  "0.15",
  "UI2 reattach preserves changed values in plain tableized repeaters"
);
multiRepeat.runName.value = "mutated";
multiRepeat.controller.value = "4";
multiRepeat.tbody.rows[1].children[0].children[0].value = "0.15";
hooks.resetModuleForm(multiRepeat.form);
assert.strictEqual(multiRepeat.runName.value, "run_0", "UI2 reset restores scalar module defaults");
assert.strictEqual(
  multiRepeat.tbody.rows[1].children[0].children[0].value,
  "0.2",
  "UI2 reset restores tableized repeater defaults instead of blanking saved values"
);
document.body.children = [];

function ui2FormControl(form, fieldId, value, repeatIndex) {
  const control = createNode("input");
  control.type = "text";
  control.dataset.fieldId = fieldId;
  control.value = value == null ? "" : String(value);
  if (repeatIndex !== undefined) {
    control.dataset.repeatTableField = fieldId;
    control.dataset.repeatTableIndex = String(repeatIndex);
  }
  control.closest = function(selector) {
    if (selector === "#ui2-form") {
      return form;
    }
    return null;
  };
  form.appendChild(control);
  return control;
}

function ui2IntegerpairMatrixRow() {
  const matrixField = {
    id: "matrix_value",
    type: "text",
    default: [
      ["default 11", "default 12"],
      ["default 21", "default 22"],
      ["default 31", "default 32"]
    ]
  };
  const matrixRow = createNode("div");
  matrixRow.className = "ui2-field ui2-tableized-repeater";
  matrixRow.dataset.fieldId = "pair_grid";
  matrixRow._ui2RepeatTableController = {
    id: "pair_grid",
    type: "integerpair",
    calc: "row_count,column_count",
    headers: {
      corner: "row",
      row: ["row_label"],
      column: ["column_label"]
    }
  };
  matrixRow._ui2RepeatTableFields = [matrixField];
  const matrixWrap = createNode("div");
  matrixWrap.className = "ui2-matrix-wrap";
  matrixWrap._ui2RepeatMatrixField = matrixField;
  const matrixTable = createNode("table");
  matrixTable.className = "ui2-matrix-table";
  matrixWrap.appendChild(matrixTable);
  matrixRow.appendChild(matrixWrap);
  return { matrixRow, matrixTable };
}

const matrixReplayScope = createNode("form");
const matrixReplay = ui2IntegerpairMatrixRow();
matrixReplayScope.appendChild(matrixReplay.matrixRow);
hooks.updateRepeatTables(
  matrixReplayScope,
  {
    row_count: "3",
    column_count: "2",
    row_label: ["sample A", "sample B", "sample C"],
    column_label: ["component alpha", "component beta"],
    matrix_value: [
      ["A alpha", "A beta"],
      ["B alpha", "B beta"],
      ["C alpha", "C beta"]
    ]
  },
  new Map([[matrixReplay.matrixRow, true]])
);
assert.strictEqual(
  matrixReplay.matrixTable.children[0].children[1].textContent,
  "component alpha",
  "UI2 renders integerpair column headers from saved source arrays"
);
assert.strictEqual(
  matrixReplay.matrixTable.children[3].children[0].textContent,
  "sample C",
  "UI2 renders integerpair row headers from saved source arrays"
);
assert.strictEqual(
  matrixReplay.matrixTable.children[2].children[2].children[0].value,
  "B beta",
  "UI2 renders integerpair cell values from saved nested arrays"
);

const savedJobForm = createNode("form");
savedJobForm.id = "ui2-form";
document.body.appendChild(savedJobForm);
ui2FormControl(savedJobForm, "row_count", "1");
ui2FormControl(savedJobForm, "column_count", "1");
ui2FormControl(savedJobForm, "row_label", "", 0);
ui2FormControl(savedJobForm, "row_label", "", 1);
ui2FormControl(savedJobForm, "row_label", "", 2);
ui2FormControl(savedJobForm, "column_label", "", 0);
ui2FormControl(savedJobForm, "column_label", "", 1);
const savedJobMatrix = ui2IntegerpairMatrixRow();
savedJobForm.appendChild(savedJobMatrix.matrixRow);
hooks.applyInputPayload({
  row_count: "3",
  column_count: "2",
  row_label: ["saved row 1", "saved row 2", "saved row 3"],
  column_label: ["saved column 1", "saved column 2"]
});
assert.strictEqual(
  savedJobMatrix.matrixTable.children[0].children[1].textContent,
  "saved column 1",
  "UI2 reattach replay refreshes integerpair column labels"
);
assert.strictEqual(
  savedJobMatrix.matrixTable.children[2].children[0].textContent,
  "saved row 2",
  "UI2 reattach replay refreshes integerpair row labels"
);

const outputSection = createNode("section");
outputSection.id = "ui2-output-section";
const outputBody = createNode("div");
outputBody.className = "ui2-section-body";
const emptyOutputMessage = createNode("p");
emptyOutputMessage.className = "ui2-help";
emptyOutputMessage.textContent = "No outputs declared.";
outputBody.appendChild(emptyOutputMessage);
outputSection.appendChild(outputBody);
document.body.appendChild(outputSection);
hooks.applyRuntimePayload({
  _textarea: "apps sassie3\\nCommand line fixes possible",
  jobintegrityreport: "Errors present.\\n\\n"
});
assert.strictEqual(
  document.querySelector('[data-output-field-id="_textarea"]').textContent,
  "apps sassie3\\nCommand line fixes possible",
  "UI2 renders backend _textarea payloads even when the module declares no outputs"
);
assert.strictEqual(
  document.querySelector('[data-output-field-id="jobintegrityreport"]').textContent,
  "Errors present.\\n\\n",
  "UI2 creates a fallback output row for undeclared backend result keys"
);
assert.strictEqual(
  outputBody.querySelectorAll(".ui2-help").length,
  0,
  "UI2 removes the no-outputs placeholder when backend output arrives"
);
document.body.children = [];

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
  JSON.stringify([{ name: "cartoon", type: "cartoon", params: { color: "blue" } }]),
  "UI2 preserves legacy NGL representation specs"
);
assert.strictEqual(
  JSON.stringify(hooks.nglRepresentationSpecs({ loadname: "model.pdb" })),
  JSON.stringify([{ name: "cartoon", type: "cartoon", params: {} }]),
  "UI2 defaults NGL payloads to the legacy cartoon representation"
);
assert.strictEqual(
  hooks.nglRepresentationKey({ type: "cartoon", params: { sele: "bfactor > 0.5" } }, 1),
  "cartoon:bfactor > 0.5:1",
  "UI2 keeps selection-specific NGL representation handles distinct"
);
assert.strictEqual(
  hooks.nglRepresentationStoreKey({ type: "cartoon", params: { sele: "protein" } }, 0, false),
  "cartoon",
  "UI2 keeps simple selected NGL payloads on generic button keys"
);
assert.strictEqual(
  hooks.nglRepresentationStoreKey({ type: "cartoon", params: { sele: "protein" } }, 0, true),
  "cartoon:protein:0",
  "UI2 keeps layered selected NGL payloads on distinct layer keys"
);

window.__styleVars = {
  "--ui2-panel": "#1a201f",
  "--ui2-bg": "#111615",
  "--ui2-text": "#eef4f1",
  "--ui2-border": "#33403d"
};
const producerPlotLayout = {
  width: 1200,
  height: 760,
  title: "Monomer Monte Carlo Progress",
  font: { size: 14 }
};
const fittedPlotLayout = hooks.plotlyLayoutForOutput(
  { dataset: { plotFit: "pane" } },
  producerPlotLayout
);
assert.strictEqual(fittedPlotLayout.width, undefined, "MMC fit-to-pane removes producer Plotly width from the client copy");
assert.strictEqual(fittedPlotLayout.height, undefined, "MMC fit-to-pane removes producer Plotly height from the client copy");
assert.strictEqual(fittedPlotLayout.autosize, true, "MMC fit-to-pane keeps Plotly autosizing enabled");
assert.strictEqual(producerPlotLayout.width, 1200, "MMC fit-to-pane does not mutate the producer Plotly width");
assert.strictEqual(producerPlotLayout.height, 760, "MMC fit-to-pane does not mutate the producer Plotly height");
const fixedPlotLayout = hooks.plotlyLayoutForOutput(
  { dataset: {} },
  producerPlotLayout
);
assert.strictEqual(fixedPlotLayout.width, 1200, "ordinary UI2 Plotly outputs preserve producer width");
assert.strictEqual(fixedPlotLayout.height, 760, "ordinary UI2 Plotly outputs preserve producer height");
assert.strictEqual(
  hooks.normalizeJobEvent({ version: 2, run: "run-1", module: "mmc", sequence: 1, channel: "log", topic: "run" }),
  null,
  "job event normalizer rejects unknown protocol versions"
);
const eventStore = hooks.createJobEventStore();
eventStore.reset("run-1", "monomer_monte_carlo");
let eventNotifications = 0;
const unsubscribeEvents = eventStore.subscribe(() => { eventNotifications += 1; });
const logEvent = {
  version: 1,
  run: "run-1",
  module: "monomer_monte_carlo",
  sequence: 1,
  timestamp: "2026-07-10T12:00:00Z",
  channel: "log",
  topic: "run",
  operation: "append",
  payload: { text: "first line\\n" }
};
assert.strictEqual(eventStore.apply(logEvent), true, "job event store accepts a valid event");
assert.strictEqual(eventStore.apply(logEvent), false, "job event store suppresses duplicate sequence numbers");
assert.strictEqual(eventStore.apply(Object.assign({}, logEvent, {
  sequence: 3,
  channel: "progress",
  operation: "snapshot",
  payload: { fraction: 0.3 }
})), true, "job event store accepts a later topic snapshot");
assert.strictEqual(JSON.stringify(eventStore.snapshot().missingSequences), "[2]", "job event store records a delivery gap");
assert.strictEqual(eventStore.apply(Object.assign({}, logEvent, {
  sequence: 2,
  payload: { text: "second line\\n" }
})), true, "job event store accepts a recovered missing event");
assert.strictEqual(JSON.stringify(eventStore.snapshot().missingSequences), "[]", "job event store clears a recovered sequence gap");
assert.strictEqual(
  JSON.stringify(eventStore.snapshot().channels.log.run.items.map((item) => item.text)),
  JSON.stringify(["first line\\n", "second line\\n"]),
  "job event store keeps append payloads in sequence recovery order"
);
eventStore.appendLegacyLog("legacy line\\n", "run-1", "monomer_monte_carlo");
assert.strictEqual(eventStore.snapshot().channels.log.run.value, "legacy line\\n", "legacy text adapter writes only to the run-log topic");
unsubscribeEvents();
assert(eventNotifications >= 4, "job event subscribers receive immutable state updates");
const transientEventStore = hooks.createJobEventStore();
transientEventStore.reset("run-transient", "monomer_monte_carlo");
const transientStructureEvent = {
  version: 1,
  run: "run-transient",
  module: "monomer_monte_carlo",
  sequence: 1,
  timestamp: "2026-07-10T12:00:00Z",
  channel: "structure",
  topic: "structure_ngl",
  operation: "append",
  replay: false,
  payload: { frame_index: 1, coordinates: [0, 1, 2] }
};
transientEventStore.apply(transientStructureEvent);
transientEventStore.apply(Object.assign({}, transientStructureEvent, {
  sequence: 2,
  payload: { frame_index: 2, coordinates: [3, 4, 5] }
}));
assert.strictEqual(
  transientEventStore.snapshot().channels.structure.structure_ngl.items.length,
  1,
  "live non-replayable structure events retain only the newest runtime-store payload"
);
assert.strictEqual(
  transientEventStore.snapshot().channels.structure.structure_ngl.items[0].frame_index,
  2,
  "live non-replayable structure state advances to the newest frame"
);

const darkLayout = hooks.applyPlotlyTheme({
  legend: { bgcolor: "#ffffff", font: { color: "#ffffff" } },
  legend2: { bgcolor: "#ffffff", font: { color: "#ffffff" } },
  annotations: [{
    bgcolor: "rgba(255, 255, 255, 0.75)",
    font: { color: "#ffffff" },
    text: '<span style="color:rgb(55, 128, 191);">&#9679;</span> occupied convergence cells<br><span style="color:rgb(128, 0, 128);">&#9670;</span> new cells'
  }]
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
assert.strictEqual(
  darkLayout.legend2.font.color,
  "#17201d",
  "UI2 also fixes subplot legend text when a figure uses legend2"
);
assert.strictEqual(
  darkLayout.annotations[0].font.color,
  "#17201d",
  "UI2 fixes legacy Plotly annotation legends that use light backgrounds on dark themes"
);
window.__styleVars = {
  "--ui2-panel": "#ffffff",
  "--ui2-bg": "#f7f8fa",
  "--ui2-text": "#17201d",
  "--ui2-border": "#d8dfdc"
};
const lightLayout = hooks.applyPlotlyTheme({
  legend: { bgcolor: "#1a201f" },
  legend3: { bgcolor: "#1a201f" }
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
  lightLayout.legend3.font.color,
  "#eef4f1",
  "UI2 also fixes subplot legend text when a figure uses legend3"
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
  job("recent", "tools/data_interpolation", "hello", now - 1800, "", "0.7s"),
  job("same-day", "tools/data_interpolation", "hello", now - 12 * 3600, "", "0.75s"),
  job("old", "tools/data_interpolation", "hello", now - 3 * 86400, "", "0.8s"),
  job("running", "tools/data_interpolation", "hello", 0, "", "active")
];

assert.deepStrictEqual(
  hooks.filterJobRows(rows, { running: false, completed: "hour", project: "*all*", module: "*all*" }, now).map((row) => row.id),
  ["recent"],
  "completed-hour filter keeps only jobs completed in the last hour"
);

assert.deepStrictEqual(
  hooks.filterJobRows(rows, { running: false, completed: "1", project: "*all*", module: "*all*" }, now).map((row) => row.id),
  ["recent", "same-day"],
  "legacy completed-days filter keeps only recent completed jobs"
);

assert.deepStrictEqual(
  hooks.filterJobRows(rows, { running: false, completed: "week", project: "*all*", module: "*all*" }, now).map((row) => row.id),
  ["recent", "same-day", "old"],
  "completed-week filter maps to the legacy seven-day window"
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
  ["recent", "same-day", "old", "running"],
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
assert.strictEqual(
  hooks.moduleSubmitEndpointFor({ executable: "jobmonitor" }, "admin", "jobmonitor"),
  "/sassie3/ajax/admin/jobmonitor.php",
  "admin system module submit endpoints resolve through the generated admin wrapper"
);

hooks.state.values = { interval: 5 };
hooks.state.session = { logon: "Joseph", project: "no_project_specified" };
hooks.state.serverSelections = {};
hooks.state.module = {
  executable: "jobmonitor",
  docrootexecutable: "ajax/sys_config/sys_jobmonitor.php"
};
const adminFormData = hooks.buildSubmitFormData({
  querySelectorAll() {
    return [];
  }
}, "admin-test-uuid");
assert.strictEqual(
  adminFormData.get("_docrootexecutable"),
  "ajax/sys_config/sys_jobmonitor.php",
  "admin system module submits carry the legacy docroot executable to the generated wrapper"
);

assert.strictEqual(
  hooks.moduleActionEndpointFor("action_demo"),
  "/sassie3/ajax/action/action_demo.php",
  "UI2 action endpoints resolve through the app-level legacy ajax action root"
);
hooks.state.values = { sample: "alpha", extra: "beta" };
hooks.state.session = { logon: "Joseph", project: "precheck_project" };
hooks.state.serverSelections = {};
const allActionFormData = hooks.buildActionFormData({
  querySelectorAll() {
    return [];
  }
}, { id: "precheck", actiondata: "_allformdata" });
assert.deepStrictEqual(allActionFormData.get("sample"), ["alpha"], "UI2 action all-form payload includes current field values");
assert.deepStrictEqual(allActionFormData.get("extra"), ["beta"], "UI2 action all-form payload includes additional active values");
assert.strictEqual(allActionFormData.get("_action"), "precheck", "UI2 action payload names the requested action");
assert.strictEqual(allActionFormData.get("_logon"), "Joseph", "UI2 action payload carries the refreshed legacy logon");
assert.strictEqual(allActionFormData.get("_project"), "precheck_project", "UI2 action payload carries the current project");
assert.strictEqual(allActionFormData.get("_uuid"), undefined, "UI2 action payload stays outside the Job Manager uuid path");

const selectedActionFormData = hooks.buildActionFormData({
  querySelectorAll() {
    return [];
  }
}, { id: "conditional_precheck", actiondata: "sample" });
assert.deepStrictEqual(selectedActionFormData.get("sample"), ["alpha"], "UI2 action selected payload includes requested fields");
assert.strictEqual(selectedActionFormData.get("extra"), undefined, "UI2 action selected payload excludes unrequested fields");

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

const dcdTextControl = {
  type: "text",
  value: "run_0.dcd",
  dataset: { fieldId: "dcdfile" },
  closest(selector) {
    return selector === "#ui2-form" ? {} : null;
  },
  dispatchEvent(event) {
    this.lastEvent = event.type;
  }
};
document.querySelectorAll = (selector) => (
  selector === "[data-field-id=\\"dcdfile\\"]" ? [dcdTextControl] : []
);
hooks.state.module = {
  fields: [
    { id: "dcdfile", type: "text" }
  ]
};
hooks.state.serverSelections = {};
hooks.applyInputPayload({
  dcdfile: "run_0.dcd",
  _selaltval_dcdfile: "dcdfile_altval",
  dcdfile_altval: ["Li9oaXYxX2dhZ19jaGFybW0yNy5wZGI="],
  _html_dcdfile_altval: "<i>Server</i>: hiv1_gag_charmm27.pdb"
});
assert.strictEqual(dcdTextControl.value, "run_0.dcd", "attach replay leaves MMC dcdfile text outputs as plain text");
assert.strictEqual(
  hooks.state.serverSelections["dcdfile:"],
  undefined,
  "attach replay does not restore server selections for non-file fields"
);

hooks.state.values = { dcdfile: "run_0.dcd" };
hooks.state.serverSelections = {
  "dcdfile:": {
    id: "dcdfile",
    type: "text",
    repeatIndex: null,
    encodedPath: "Li9oaXYxX2dhZ19jaGFybW0yNy5wZGI=",
    path: "hiv1_gag_charmm27.pdb"
  }
};
const dcdFormData = hooks.buildSubmitFormData({
  querySelectorAll() {
    return [];
  }
}, "dcd-test-uuid");
assert.deepStrictEqual(dcdFormData.get("dcdfile"), ["run_0.dcd"], "submit keeps MMC dcdfile as the text output name");
assert.strictEqual(dcdFormData.get("_selaltval_dcdfile"), undefined, "submit ignores stale server selections for non-file fields");
assert.strictEqual(dcdFormData.get("dcdfile_altval[]"), undefined, "submit omits stale non-file alt values");
assert.strictEqual(dcdFormData.get("_runtime_protocol"), "1", "UI2 submit advertises the versioned runtime protocol");
assert.deepStrictEqual(
  JSON.parse(dcdFormData.get("_runtime_capabilities")),
  ["job-events", "plot-append", "structure-frames"],
  "UI2 submit advertises event, incremental plot, and structure-frame capabilities"
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

const dynamicPlotRow = createNode("div");
dynamicPlotRow.className = "ui2-field ui2-output-field ui2-dynamic-output-row";
dynamicPlotRow.hidden = true;
const dynamicPlotGroup = createNode("div");
dynamicPlotGroup.dataset.outputFieldId = "stream_dynamic_plot";
dynamicPlotGroup.dataset.outputType = "plotly";
dynamicPlotGroup.dataset.dynamicOutput = "true";
dynamicPlotGroup.dataset.dynamicIdPrefix = "stream_plot";
dynamicPlotGroup.dataset.dynamicMax = "1";
dynamicPlotGroup.dataset.dynamicLabel = "Streaming plots";
dynamicPlotRow.appendChild(dynamicPlotGroup);
document.body.appendChild(dynamicPlotRow);
window.Plotly = {
  newPlot(output, data, layout, config) {
    output.data = data;
    output.layout = layout;
    output.config = config;
    return Promise.resolve(output);
  },
  react(output, data, layout, config) {
    output.data = data;
    output.layout = layout;
    output.config = config;
    return Promise.resolve(output);
  },
  Plots: { resize() {} }
};
hooks.state.jobEvents.reset("run-dynamic-plot", "monomer_monte_carlo");
hooks.applyRuntimePayload({
  _job_event: {
    version: 1,
    run: "run-dynamic-plot",
    module: "monomer_monte_carlo",
    sequence: 1,
    timestamp: "2026-07-12T12:00:00Z",
    channel: "plot",
    topic: "stream_dynamic_plot",
    operation: "snapshot",
    payload: {
      items: [{
        id: "profile",
        label: "Profile",
        value: { data: [], layout: { title: "Profile" } }
      }]
    }
  }
});
assert.strictEqual(dynamicPlotRow.hidden, false, "plot job events reveal dynamic plot output rows");
assert.strictEqual(
  dynamicPlotGroup.querySelectorAll(".ui2-dynamic-output-instance").length,
  1,
  "plot job events populate dynamic plot output groups instead of rendering on the group shell"
);

const futureEventStore = hooks.createJobEventStore();
futureEventStore.reset("event-run", "monomer_monte_carlo");
assert.strictEqual(
  futureEventStore.snapshot(),
  futureEventStore.snapshot(),
  "job event snapshots keep stable identity between store updates"
);
assert.strictEqual(futureEventStore.apply({
  version: 1,
  run: "event-run",
  module: "monomer_monte_carlo",
  sequence: 1,
  timestamp: "2026-07-09T12:00:00Z",
  channel: "log",
  topic: "run",
  operation: "append",
  payload: { text: "native log\\n" }
}), true, "native runtime events enter the event store");
const stableSnapshotAfterEvent = futureEventStore.snapshot();
assert.strictEqual(
  futureEventStore.snapshot(),
  stableSnapshotAfterEvent,
  "job event snapshots remain stable after an applied event"
);
assert.strictEqual(futureEventStore.apply({
  version: 1,
  run: "event-run",
  module: "monomer_monte_carlo",
  sequence: 1,
  timestamp: "2026-07-09T12:00:00Z",
  channel: "log",
  topic: "run",
  operation: "append",
  payload: { text: "native log\\n" }
}), false, "duplicate event sequences are rejected");
assert.strictEqual(futureEventStore.apply({
  version: 1,
  run: "event-run",
  module: "monomer_monte_carlo",
  sequence: 3,
  timestamp: "2026-07-09T12:00:01Z",
  channel: "plot",
  topic: "sas_stream",
  operation: "append",
  payload: { traces: [] }
}), true, "independent future plot topics share the generic event store");
assert.deepStrictEqual(
  Array.from(futureEventStore.snapshot().missingSequences),
  [2],
  "event sequence gaps are retained for replay recovery"
);

const strictEventStore = hooks.createJobEventStore();
strictEventStore.reset("new-run", "monomer_monte_carlo");
strictEventStore.apply({
  version: 1,
  run: "new-run",
  module: "monomer_monte_carlo",
  sequence: 3,
  channel: "plot",
  topic: "plotout4_stream",
  operation: "append",
  payload: { traces: [] }
});
assert.strictEqual(strictEventStore.snapshot().lastSequence, 0, "a newly submitted run buffers events that arrive before sequence one");
assert.deepStrictEqual(Array.from(strictEventStore.snapshot().pendingSequences), [3], "out-of-order new-run events remain pending");
const recoveredEvents = strictEventStore.applyMany([{
  version: 1,
  run: "new-run",
  module: "monomer_monte_carlo",
  sequence: 1,
  channel: "lifecycle",
  topic: "run",
  operation: "replace",
  payload: { state: "running" }
}, {
  version: 1,
  run: "new-run",
  module: "monomer_monte_carlo",
  sequence: 2,
  channel: "plot",
  topic: "plotout4_stream",
  operation: "snapshot",
  payload: { figure: { data: [] } }
}]);
assert.deepStrictEqual(Array.from(recoveredEvents.applied).map((event) => event.sequence), [1, 2, 3], "gap recovery releases buffered events in strict sequence order");

const reattachedEventStore = hooks.createJobEventStore();
reattachedEventStore.reset("", "monomer_monte_carlo");
reattachedEventStore.apply({
  version: 1,
  run: "old-run",
  module: "monomer_monte_carlo",
  sequence: 100,
  channel: "progress",
  topic: "run",
  operation: "snapshot",
  payload: { fraction: 0.75 }
});
assert.strictEqual(reattachedEventStore.snapshot().lastSequence, 100, "reattachment can establish a baseline from a truncated bounded journal");

hooks.state.view = { renderer: "react-workbench" };
hooks.state.moduleId = "monomer_monte_carlo";
hooks.state.jobEvents.reset("native-run", "monomer_monte_carlo");
hooks.applyRuntimePayload({
  _job_event: {
    version: 1,
    run: "native-run",
    module: "monomer_monte_carlo",
    sequence: 1,
    timestamp: "2026-07-09T12:00:00Z",
    channel: "log",
    topic: "run",
    operation: "append",
    payload: { text: "one copy\\n" }
  }
});
hooks.applyRuntimePayload({ _textarea: "one copy\\n" });
const nativeLogTopic = hooks.state.jobEvents.snapshot().channels.log.run;
assert.strictEqual(nativeLogTopic.items.length, 1, "React ignores mirrored legacy textarea text after native events arrive");
assert.strictEqual(nativeLogTopic.value, null, "mirrored textarea text does not create a second legacy log value");
const completeTextareaLog = [
  "============================================================",
  "DATA FROM RUN: Fri Jul 10 22:12:16 2026",
  "",
  "Average accepted rg2 = 65.778345",
  "",
  "Configurations and statistics saved in ./run_0/monomer_monte_carlo/ directory",
  "",
  "accepted 269 out of 500 : 53.800000 percent",
  "",
  "============================================================",
  "MONOMER MONTE CARLO IS DONE",
  "============================================================",
  ""
].join("\\n");
hooks.applyRuntimePayload({ _textarea: completeTextareaLog });
const finalNativeLogTopic = hooks.state.jobEvents.snapshot().channels.log.run;
assert.strictEqual(finalNativeLogTopic.items.length, 0, "React final textarea report replaces partial native log append items");
assert.strictEqual(finalNativeLogTopic.value, completeTextareaLog, "React accepts complete final textarea report after native events arrive");
assert.strictEqual(finalNativeLogTopic.complete, true, "React marks the final textarea report as a complete run log");

const normalized_frame = hooks.normalize_ngl_coordinate_frame({
  atom_count: 2,
  frame: 7,
  accepted_structure: 7,
  frame_index: 3,
  milestone_percent: 30,
  milestone_trial: 600,
  trial: 612,
  coordinate_dtype: "float32",
  coordinates: [0, 1, 2, 3, 4, 5]
});
assert.strictEqual(Object.prototype.toString.call(normalized_frame.coordinates), "[object Float32Array]", "structure frames normalize to compact Float32 coordinates");
assert.strictEqual(normalized_frame.atom_count, 2, "structure frames retain their topology atom count");
assert.strictEqual(normalized_frame.accepted_structure, 7, "structure frames retain their accepted structure index");
assert.strictEqual(normalized_frame.frame_index, 3, "structure frames retain their streamed milestone frame index");
assert.strictEqual(normalized_frame.milestone_percent, 30, "structure frames retain their milestone percent");
assert.strictEqual(normalized_frame.milestone_trial, 600, "structure frames retain their milestone trial");
assert.strictEqual(normalized_frame.coordinate_dtype, "float32", "structure frames retain their coordinate dtype marker");
assert.strictEqual(normalized_frame.byte_length, 24, "structure frame telemetry records retained byte size");
assert.strictEqual(
  hooks.normalize_ngl_coordinate_frame({ atom_count: 2, coordinates: [0, 1, 2] }),
  null,
  "structure frames reject coordinate counts that do not match topology"
);

const nglCalls = [];
const frameOutput = {
  dataset: {},
  _ui2NglComponent: {
    structure: {
      atomCount: 2,
      updatePosition(coordinates) { nglCalls.push(["coordinates", Array.from(coordinates)]); }
    },
    updateRepresentations(changes) { nglCalls.push(["representations", changes]); }
  }
};
assert.strictEqual(hooks.apply_ngl_coordinate_frame(frameOutput, normalized_frame), true, "NGL accepts an in-place coordinate frame");
assert.deepStrictEqual(nglCalls[0], ["coordinates", [0, 1, 2, 3, 4, 5]], "NGL updates the existing Structure coordinates");
assert.strictEqual(JSON.stringify(nglCalls[1]), JSON.stringify(["representations", { position: true }]), "NGL updates representation positions without rebuilding topology");
assert.strictEqual(frameOutput.dataset.ngl_frame, "7", "NGL records the displayed frame without recentering");
assert.strictEqual(frameOutput.dataset.ngl_frame_index, "3", "NGL records the displayed streamed-frame index");
assert.strictEqual(frameOutput.dataset.ngl_milestone_percent, "30", "NGL records the displayed milestone percent");
assert.strictEqual(frameOutput.dataset.ngl_frames_rendered, "1", "NGL telemetry records applied coordinate frames");
assert.strictEqual(frameOutput.dataset.ngl_coordinate_dtype, "float32", "NGL telemetry records the active coordinate dtype");

const mismatch_output = {
  dataset: {},
  _ui2NglComponent: {
    structure: {
      atomCount: 3,
      updatePosition() { throw new Error("mismatched coordinates must not render"); }
    }
  }
};
assert.strictEqual(
  hooks.apply_ngl_coordinate_frame(mismatch_output, normalized_frame),
  false,
  "NGL rejects a frame whose atom count differs from the loaded topology"
);
assert.strictEqual(mismatch_output.dataset.ngl_frames_invalid, "1", "atom-count mismatch increments invalid-frame telemetry");
assert.strictEqual(mismatch_output.dataset.ngl_last_dropped_reason, "atom_count_mismatch", "atom-count mismatch is explained without failing the job");

const failed_render_output = {
  dataset: {},
  _ui2NglComponent: {
    structure: {
      atomCount: 2,
      updatePosition() { throw new Error("viewer unavailable"); }
    }
  }
};
assert.strictEqual(
  hooks.apply_ngl_coordinate_frame(failed_render_output, normalized_frame),
  false,
  "NGL rendering failure is contained as a preview failure"
);
assert.strictEqual(failed_render_output.dataset.ngl_frames_invalid, "1", "rendering failure increments invalid-frame telemetry");
assert.strictEqual(failed_render_output.dataset.ngl_last_dropped_reason, "render_error", "rendering failure is explained without failing the job");

const scheduledFrames = [];
window.requestAnimationFrame = (callback) => { scheduledFrames.push(callback); };
nglCalls.length = 0;
hooks.queue_ngl_coordinate_frame(frameOutput, { atom_count: 2, frame: 8, coordinates: [1, 1, 1, 2, 2, 2] });
hooks.queue_ngl_coordinate_frame(frameOutput, { atom_count: 2, frame: 9, coordinates: [3, 3, 3, 4, 4, 4] });
assert.strictEqual(frameOutput._ui2_ngl_frames.length, 2, "queued structure frames are retained for post-run NGL review");
assert.strictEqual(scheduledFrames.length, 1, "rapid structure frames coalesce into one animation-frame render");
scheduledFrames.shift()();
assert.deepStrictEqual(nglCalls[0], ["coordinates", [3, 3, 3, 4, 4, 4]], "coalescing renders the newest available structure frame");
assert.strictEqual(frameOutput.dataset.ngl_frame, "9", "coalescing skips stale previews but retains the latest frame identity");
assert.strictEqual(frameOutput.dataset.ngl_frames_received, "2", "NGL telemetry records queued coordinate frames");
assert.strictEqual(frameOutput.dataset.ngl_frames_retained, "2", "NGL telemetry records retained coordinate frames");
assert.strictEqual(frameOutput.dataset.ngl_frames_dropped, "1", "NGL telemetry records a coalesced stale render");
assert.strictEqual(frameOutput.dataset.ngl_last_dropped_reason, "stale_frame", "NGL telemetry explains stale-frame coalescing");
frameOutput._ui2_ngl_frame_history_max_bytes = 24 * 10;
for (let i = 0; i < 12; i += 1) {
  hooks.queue_ngl_coordinate_frame(frameOutput, { atom_count: 2, frame: 20 + i, coordinates: [i, i, i, i + 1, i + 1, i + 1] });
}
assert.strictEqual(frameOutput._ui2_ngl_frames.length, 10, "UI2 trims retained NGL frames when the memory budget is reached");
assert.strictEqual(frameOutput.dataset.ngl_frames_dropped, "16", "NGL telemetry records stale-render and memory-budget frame drops");
assert.strictEqual(frameOutput.dataset.ngl_bytes_retained, String(24 * 10), "NGL telemetry records retained coordinate bytes");
frameOutput._ui2_ngl_frame_history_max_bytes = 1;
hooks.queue_ngl_coordinate_frame(frameOutput, { atom_count: 2, frame: 99, coordinates: [9, 9, 9, 10, 10, 10] });
assert.strictEqual(frameOutput._ui2_ngl_frames.length, 1, "UI2 keeps only the latest NGL frame when the memory budget is tiny");
assert.strictEqual(frameOutput._ui2_ngl_frames[0].frame, 99, "UI2 does not preserve the old ten-frame experiment under memory pressure");
JS
close $fh;

my $node = $ENV{NODE} || 'node';
my $output = `$node "$script" 2>&1`;
my $status = $? >> 8;

is( $status, 0, 'ui2 runtime helper behavior passes executable checks' )
    or diag($output);

done_testing();
