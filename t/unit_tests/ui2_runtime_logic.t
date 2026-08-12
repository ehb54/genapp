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
  const normalizedTag = String(tag || "div").toLowerCase();
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
      contains(name) {
        syncClassesFromName();
        return classes.has(name);
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
    focus() {
      this.focused = true;
      document.activeElement = this;
    },
    checkValidity() {
      if (this.readOnly) {
        this.validationMessage = "";
        return true;
      }
      if (this.required && !String(this.value || "").trim()) {
        this.validationMessage = "Please fill out this field.";
        return false;
      }
      this.validationMessage = "";
      return true;
    },
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
    removeAttribute(name) {
      delete this.attributes[name];
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
  if (normalizedTag === "template") {
    node.content = createNode("fragment");
  }
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
  if (selector.startsWith(".")) {
    return String(node.className || "").split(/\\s+/).includes(selector.slice(1));
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

const imageOutput = hooks.renderImageOutputShell({ id: "density_slice_xy", type: "image", label: "density XY center slice" }, "image");
hooks.renderImageOutput(imageOutput, "results/run_0/density_slice_xy.png");
const imageNode = imageOutput.querySelector(".ui2-output-image-content");
assert.strictEqual(imageNode.src, "/sassie3/results/run_0/density_slice_xy.png", "UI2 image output assigns a returned PNG path to an img element at the application root");
assert.strictEqual(imageNode.hidden, false, "UI2 image output reveals the image when a path is available");
assert.strictEqual(imageOutput.querySelector(".ui2-output-image-placeholder").hidden, true, "UI2 image output hides its placeholder after a path arrives");
hooks.renderImageOutput(imageOutput, "");
assert.strictEqual(imageNode.hidden, true, "UI2 image output returns to an empty state when the path is cleared");

window.GenAppUi2App.menus = [{
  id: "simulate",
  modules: [{ id: "monomer_monte_carlo" }]
}];
const parsedSwitch = hooks.switchTargetFromValue("simulate/monomer_monte_carlo/no_project_specified/uuid-123");
assert.strictEqual(parsedSwitch.menuId, "simulate", "UI2 retains the legacy reattach menu id");
assert.strictEqual(parsedSwitch.moduleId, "monomer_monte_carlo", "UI2 retains the legacy reattach module id");
assert.strictEqual(parsedSwitch.project, "no_project_specified", "UI2 retains the legacy reattach project");
assert.strictEqual(parsedSwitch.uuid, "uuid-123", "UI2 retains the legacy reattach uuid");
assert.throws(
  () => hooks.switchTargetFromValue("monomer_monte_carlo/no_project_specified/uuid-123"),
  /Invalid legacy reattach target/,
  "UI2 rejects noncanonical reattach target shapes instead of guessing the module"
);
assert.throws(
  () => hooks.switchTargetFromValue("simulate/not_generated/no_project_specified/uuid-123"),
  /not a generated UI2 module/,
  "UI2 rejects a switch target outside the generated menu/module map"
);
const ready = hooks.beginViewReady();
assert.strictEqual(ready.resolved, false, "UI2 core waits until an asynchronous renderer reports mounted hosts");
hooks.markViewReady(ready.generation);
assert.strictEqual(ready.resolved, true, "UI2 core releases reattach only after renderer readiness");

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
const settingsProjectControl = {
  className: "",
  dataset: { fieldId: "project", pullKey: "project" },
  value: "test4"
};
const settingsProjectForm = {
  querySelectorAll() {
    return [settingsProjectControl];
  }
};
assert.strictEqual(
  hooks.settingsProjectFromResponse(settingsProjectForm, { _project: "blah2" }),
  "blah2",
  "UI2 Settings keeps the project selected by a successful project-creation response"
);
assert.strictEqual(
  hooks.settingsProjectFromResponse(settingsProjectForm, {}),
  "test4",
  "UI2 Settings retains the selected-project fallback for legacy responses"
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

const fileManagerTable = createNode("table");
const fileManagerBody = createNode("tbody");
fileManagerTable.appendChild(fileManagerBody);
function addFileManagerSelection(id, parentId, checked) {
  const row = createNode("tr");
  row.dataset.fileId = id;
  row.dataset.parentId = parentId;
  const select = createNode("input");
  select.dataset.fileSelect = "1";
  select.checked = checked;
  row.appendChild(select);
  fileManagerBody.appendChild(row);
}
const selectedRootFile = btoa("./project/input.pdb");
const selectedNestedFile = btoa("./project/subdir/result.dat");
const nestedParent = btoa("./project/subdir");
addFileManagerSelection(selectedRootFile, "#", true);
addFileManagerSelection(selectedNestedFile, nestedParent, true);
addFileManagerSelection(btoa("./project/other.dat"), "#", false);
assert.strictEqual(
  hooks.fileManagerSelectedIds(fileManagerTable).join(","),
  [selectedRootFile, selectedNestedFile].join(","),
  "UI2 File Manager collects only checked encoded file ids"
);
assert.strictEqual(
  hooks.fileManagerSelectedParentIds(fileManagerTable).join(","),
  ["#", nestedParent].join(","),
  "UI2 File Manager refreshes each selected parent once"
);
const fileManagerRemovalPrompt = hooks.fileManagerRemovalPrompt([selectedRootFile, selectedNestedFile]);
assert(
  fileManagerRemovalPrompt.includes("project/input.pdb") && fileManagerRemovalPrompt.includes("project/subdir/result.dat"),
  "UI2 File Manager confirms the decoded selected paths before removal"
);
const fileManagerDeleteFormData = hooks.fileManagerDeleteFormData([selectedRootFile, selectedNestedFile]);
assert.strictEqual(fileManagerDeleteFormData.get("_window"), "ui2-test", "UI2 File Manager delete retains the legacy window id");
assert.strictEqual(fileManagerDeleteFormData.get("_spec"), "fc_cache", "UI2 File Manager delete uses the legacy file-cache contract");
assert.strictEqual(fileManagerDeleteFormData.get("_delete"), selectedRootFile + "," + selectedNestedFile, "UI2 File Manager delete sends only the selected encoded ids");

["file", "lrfile", "rfile", "rpath"].forEach((type) => {
  const control = hooks.renderFileControl({ id: `\${type}_input`, type });
  const display = control.children[0];
  assert.strictEqual(display.type, "text", `UI2 \${type} control keeps a readable selection display`);
  assert.strictEqual(display.readOnly, true, `UI2 \${type} control does not accept an unrecoverable typed file value`);
  assert.strictEqual(display.autocomplete, "off", `UI2 \${type} control suppresses browser history suggestions`);
  assert.strictEqual(display.spellcheck, false, `UI2 \${type} control does not spellcheck file names or paths`);
});
const requiredLrfile = hooks.renderFileControl({ id: "pdbfile", type: "lrfile", required: "true" });
const requiredLrfileDisplay = requiredLrfile.children[0];
assert.strictEqual(requiredLrfileDisplay.required, true, "UI2 marks required top-level lrfile controls for shared submit validation");
const requiredFileForm = createNode("form");
requiredFileForm.appendChild(requiredLrfile);
const missingRequiredFile = hooks.validateModuleForm(requiredFileForm);
assert.strictEqual(
  missingRequiredFile.control,
  requiredLrfileDisplay,
  "UI2 shared validation rejects an empty required top-level lrfile before submit"
);
assert.match(
  missingRequiredFile.message,
  /pdbfile.*Please select a file/,
  "UI2 shared validation reports the missing required file field"
);
const localFileControl = hooks.renderFileControl({ id: "input_pdbfile", type: "lrfile", required: "true" });
const localFileDisplay = localFileControl.children[0];
const localFilePicker = localFileControl.children[1];
localFileDisplay.value = "hiv1_gag_charmm27.pdb";
localFilePicker.value = "";
localFilePicker.files = ["hiv1_gag_charmm27.pdb"];
const localFileForm = createNode("form");
localFileForm.appendChild(localFileControl);
assert.strictEqual(
  hooks.collectControlValues(localFileForm, () => true).input_pdbfile,
  "hiv1_gag_charmm27.pdb",
  "UI2 value collection keeps the visible lrfile selection instead of the hidden native file input value"
);
hooks.state.fileReselectionWarnings = {
  "input_pdbfile:": {
    id: "input_pdbfile",
    label: "Coordinate file",
    repeatIndex: null,
    savedValue: "hiv1_gag_charmm27.pdb"
  }
};
const staleLocalFile = hooks.validateModuleForm(localFileForm);
assert.strictEqual(
  staleLocalFile.control,
  localFileDisplay,
  "UI2 rejects a restored local filename until the browser receives a real file or server selection"
);
assert.match(
  staleLocalFile.message,
  /Select the local file again or choose a server file before submitting/,
  "UI2 explains why a restored local filename cannot be submitted"
);
hooks.state.fileReselectionWarnings = {};

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

const rowConditionFields = new Map([
  ["source_kind", { id: "source_kind", type: "listbox", repeat: "row_count" }],
  ["enabled", { id: "enabled", type: "checkbox", repeat: "row_count" }]
]);
const rowConditionValues = {
  source_kind: ["prepared", "raw", "prepared"],
  enabled: [true, false, true]
};
assert.strictEqual(
  hooks.repeatTableConditionValue("source_kind:prepared", rowConditionValues, rowConditionFields, 0),
  true,
  "UI2 evaluates a row-local listbox condition for the first row"
);
assert.strictEqual(
  hooks.repeatTableConditionValue("source_kind:prepared", rowConditionValues, rowConditionFields, 1),
  false,
  "UI2 evaluates a mixed row-local listbox condition independently per row"
);
assert.strictEqual(
  hooks.repeatTableConditionValue("source_kind:raw && !enabled", rowConditionValues, rowConditionFields, 1),
  true,
  "UI2 evaluates combined row-local listbox and checkbox conditions"
);
rowConditionValues.source_kind[1] = "prepared";
assert.strictEqual(
  hooks.repeatTableConditionValue("source_kind:prepared", rowConditionValues, rowConditionFields, 1),
  true,
  "UI2 reevaluates the changed row choice without changing other rows"
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

const deferredActionForm = createNode("form");
deferredActionForm.id = "ui2-form";
const deferredActionControl = ui2FormControl(
  deferredActionForm, "deferred_repeater_metadata", ""
);
const viewBeforeDeferredAction = hooks.state.view;
hooks.state.view = { renderer: "react-workbench" };
hooks.state.pendingInputValues = {};
hooks.deferUnavailableReactWorkbenchInput(
  "deferred_repeater_metadata", ["0.25", "0.75"], 0
);
assert.deepEqual(
  hooks.state.pendingInputValues.deferred_repeater_metadata,
  ["0.25", "0.75"],
  "UI2 retains action values for a repeater field whose React section is not mounted"
);
const querySelectorAllBeforeDeferredAction = document.querySelectorAll;
document.querySelectorAll = function(selector) {
  return selector === '[data-field-id="deferred_repeater_metadata"]'
    ? [deferredActionControl]
    : [];
};
hooks.applyPendingReactWorkbenchInputValues();
document.querySelectorAll = querySelectorAllBeforeDeferredAction;
hooks.state.view = viewBeforeDeferredAction;
assert.strictEqual(
  deferredActionControl.value,
  "0.25",
  "UI2 hydrates the first mounted repeater control from deferred action values"
);
assert.ok(
  !Object.prototype.hasOwnProperty.call(
    hooks.state.pendingInputValues, "deferred_repeater_metadata"
  ),
  "UI2 clears a deferred action value after its repeater control mounts"
);

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

hooks.beginRuntimeOutputContext("pdb_scan");
const pdbScanToken = hooks.runtimeOutputToken();
hooks.applyRuntimePayload({ sasoutput2: "PDBScan completed output" }, pdbScanToken);
assert.strictEqual(
  hooks.state.runtimeOutputs.sasoutput2,
  "PDBScan completed output",
  "UI2 runtime output cache stores declared output values inside the active module context"
);
hooks.beginRuntimeOutputContext("pdb_rx");
assert.strictEqual(
  Object.prototype.hasOwnProperty.call(hooks.state.runtimeOutputs, "sasoutput2"),
  false,
  "UI2 module navigation clears cached outputs even when the next module reuses an output id"
);
hooks.applyRuntimePayload({ sasoutput2: "Late PDBScan output" }, pdbScanToken);
assert.strictEqual(
  Object.prototype.hasOwnProperty.call(hooks.state.runtimeOutputs, "sasoutput2"),
  false,
  "UI2 ignores stale runtime payloads from the previous module context"
);
const pdbRxToken = hooks.runtimeOutputToken();
hooks.applyRuntimePayload({ sasoutput2: "PDBRx output" }, pdbRxToken);
assert.strictEqual(
  hooks.state.runtimeOutputs.sasoutput2,
  "PDBRx output",
  "UI2 accepts reused output ids when the payload belongs to the active module context"
);
hooks.beginJobOutputContext("monomer_monte_carlo", "mmc-run-1");
const mmcRunOneToken = hooks.runtimeOutputToken();
hooks.applyRuntimePayload({ progress_html: "MMC run one" }, mmcRunOneToken);
hooks.beginJobOutputContext("monomer_monte_carlo", "mmc-run-2");
hooks.applyRuntimePayload({ progress_html: "Late MMC run one" }, mmcRunOneToken);
assert.strictEqual(
  Object.prototype.hasOwnProperty.call(hooks.state.runtimeOutputs, "progress_html"),
  false,
  "UI2 ignores stale payloads from an earlier job in the same module"
);
hooks.applyRuntimePayload({ progress_html: "MMC run two" });
assert.strictEqual(
  hooks.state.runtimeOutputs.progress_html,
  "MMC run two",
  "UI2 accepts payloads from the current job context without changing declared output ids"
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

const parsedTrajectoryFrames = { kind: "parsed-dcd-frames" };
const trajectoryLoadCalls = [];
const trajectoryAttachCalls = [];
window.NGL = {
  autoLoad(loadname, options) {
    trajectoryLoadCalls.push([loadname, options]);
    return Promise.resolve(parsedTrajectoryFrames);
  }
};
const trajectoryOutput = {
  dataset: {},
  _ui2NglRenderRevision: 17
};
const trajectoryComponent = {
  addTrajectory(frames, options) {
    trajectoryAttachCalls.push([frames, options]);
    return { trajectory: {} };
  }
};
hooks.attachNglFileTrajectory(
  trajectoryOutput,
  trajectoryComponent,
  { loadname: "results/users/Joseph/run_0/accepted.dcd", loadparams: { ext: "dcd" } },
  17
).then(() => {
  assert.strictEqual(
    JSON.stringify(trajectoryLoadCalls),
    JSON.stringify([["../results/users/Joseph/run_0/accepted.dcd", { ext: "dcd" }]]),
    "UI2 parses a URL-backed DCD through NGL autoLoad before attachment"
  );
  assert.strictEqual(
    JSON.stringify(trajectoryAttachCalls),
    JSON.stringify([[parsedTrajectoryFrames, {}]]),
    "UI2 attaches parsed trajectory frames rather than passing a URL to StructureComponent"
  );
});

const embeddedTrajectoryAttachCalls = [];
const embeddedTrajectoryOutput = { _ui2NglRenderRevision: 18 };
const embeddedTrajectoryComponent = {
  structure: { frames: [new Float32Array([0, 0, 0])] },
  addTrajectory(...args) {
    embeddedTrajectoryAttachCalls.push(args);
    return { trajectory: {} };
  }
};
hooks.attachNglEmbeddedTrajectory(
  embeddedTrajectoryOutput,
  embeddedTrajectoryComponent,
  { loadparams: { ext: "pdb", asTrajectory: true } },
  18
);
assert.strictEqual(
  JSON.stringify(embeddedTrajectoryAttachCalls),
  JSON.stringify([[]]),
  "UI2 activates a bounded multi-model PDB through NGL's embedded StructureTrajectory path"
);

const densityDefaultsPayload = {
  representationParams: { opacity: 0.45 },
  surface: { default_isovalue: 0.25, min_positive: 0.25 }
};
const densityDefaultsOutput = {
  _ui2_ngl_density_user_isovalue: null,
  _ui2_ngl_density_user_opacity: null
};
assert.strictEqual(
  hooks.nglDensityOpacity(densityDefaultsOutput, densityDefaultsPayload),
  0.45,
  "UI2 treats a reset density opacity as absent and retains the producer default"
);
assert.deepStrictEqual(
  hooks.nglDensitySurfaceParams(densityDefaultsOutput, densityDefaultsPayload).isolevel,
  0.25,
  "UI2 treats a reset density contour as absent and retains the producer default"
);

let resolveStaleDensity;
const staleDensityComponent = {};
const staleDensityStage = {
  loadFile() {
    return new Promise((resolve) => { resolveStaleDensity = resolve; });
  },
  removeComponent(component) {
    this.removedComponent = component;
  }
};
const staleDensityOutput = {
  _ui2NglStage: staleDensityStage,
  _ui2NglRenderRevision: 30
};
const staleDensityLoad = hooks.loadNglDensitySurface(
  staleDensityOutput,
  Object.assign({ loadname: "results/density.cube", loadparams: { ext: "cube" } }, densityDefaultsPayload),
  30
);
staleDensityOutput._ui2NglStage = {};
staleDensityOutput._ui2NglRenderRevision = 31;
resolveStaleDensity(staleDensityComponent);
staleDensityLoad.then(() => {
  assert.strictEqual(
    staleDensityStage.removedComponent,
    staleDensityComponent,
    "UI2 discards a density component that finishes after its NGL stage was replaced"
  );
});

const coverageOutput = {
  _ui2NglViewerConfig: {
    stream_preview_coverage: { frame_field: "frame_id", label: "accepted structures" }
  },
  _ui2_ngl_frames: [{ frame_id: "200" }],
  _ui2_ngl_telemetry: { rendered_frames: 10 }
};
assert.strictEqual(
  hooks.ngl_stream_telemetry_label(coverageOutput),
  "Preview rendered 10 of 200 accepted structures (5%)",
  "UI2 displays a module-declared bounded-preview coverage percentage"
);

const nglVisibilityCalls = [];
const nglVisibilityPlot = {
  hidden: false,
  offsetParent: null,
  getBoundingClientRect() {
    return { width: 0, height: 0 };
  }
};
const nglVisibilityOutput = {
  _ui2NglNeedsVisibleAutoView: true,
  _ui2NglStage: {
    handleResize() { nglVisibilityCalls.push("resize"); },
    viewer: { requestRender() { nglVisibilityCalls.push("render"); } }
  },
  _ui2NglComponent: {
    autoView() { nglVisibilityCalls.push("autoview"); }
  },
  querySelector(selector) {
    return selector === ".ui2-ngl-plot" ? nglVisibilityPlot : null;
  }
};
assert.strictEqual(
  hooks.resizeNglOutputWhenVisible(nglVisibilityOutput),
  false,
  "UI2 defers NGL fitting while a result tab has no visible geometry"
);
assert.deepStrictEqual(nglVisibilityCalls, [], "hidden NGL output does not fit against a zero-size stage");
nglVisibilityPlot.offsetParent = {};
nglVisibilityPlot.getBoundingClientRect = () => ({ width: 640, height: 480 });
assert.strictEqual(
  hooks.resizeNglOutputWhenVisible(nglVisibilityOutput),
  true,
  "UI2 fits NGL when the result tab first receives usable geometry"
);
assert.deepStrictEqual(
  nglVisibilityCalls,
  ["resize", "render", "autoview"],
  "first visible NGL fit resizes, renders, and centers the loaded structure"
);
hooks.resizeNglOutputWhenVisible(nglVisibilityOutput);
assert.deepStrictEqual(
  nglVisibilityCalls,
  ["resize", "render", "autoview", "resize", "render"],
  "later layout changes resize NGL without resetting the user's camera"
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
  font: { size: 14 },
  margin: { l: 3, r: 4, t: 5, b: 6 },
  paper_bgcolor: "#ff0000",
  plot_bgcolor: "#00ff00"
};
const fittedPlotLayout = hooks.plotlyLayoutForOutput(
  { dataset: { plotFit: "pane" } },
  producerPlotLayout
);
assert.strictEqual(fittedPlotLayout.width, undefined, "MMC fit-to-pane removes producer Plotly width from the client copy");
assert.strictEqual(fittedPlotLayout.height, undefined, "MMC fit-to-pane removes producer Plotly height from the client copy");
assert.strictEqual(fittedPlotLayout.autosize, true, "MMC fit-to-pane keeps Plotly autosizing enabled");
assert.strictEqual(JSON.stringify(fittedPlotLayout.margin), JSON.stringify({ l: 72, r: 32, t: 72, b: 72 }), "UI2 owns fitted Plotly margins");
assert.strictEqual(fittedPlotLayout.font.size, undefined, "UI2 does not inherit producer font sizing");
assert.strictEqual(fittedPlotLayout.paper_bgcolor, "#1a201f", "UI2 owns fitted Plotly surface color");
assert.strictEqual(fittedPlotLayout.plot_bgcolor, "#1a201f", "UI2 owns fitted Plotly plot color");
assert.strictEqual(producerPlotLayout.width, 1200, "MMC fit-to-pane does not mutate the producer Plotly width");
assert.strictEqual(producerPlotLayout.height, 760, "MMC fit-to-pane does not mutate the producer Plotly height");
const inheritedFitHost = {
  dataset: {},
  closest(selector) {
    return selector === "[data-plot-fit]" ? { dataset: { plotFit: "pane" } } : null;
  }
};
const inheritedFittedPlotLayout = hooks.plotlyLayoutForOutput(inheritedFitHost, producerPlotLayout);
assert.strictEqual(inheritedFittedPlotLayout.width, undefined, "dynamic MMC Plotly children inherit the pane-fit width rule");
assert.strictEqual(inheritedFittedPlotLayout.height, undefined, "dynamic MMC Plotly children inherit the pane-fit height rule");
const fixedPlotLayout = hooks.plotlyLayoutForOutput(
  { dataset: {} },
  producerPlotLayout
);
assert.strictEqual(fixedPlotLayout.width, undefined, "ordinary UI2 Plotly outputs remove producer width");
assert.strictEqual(fixedPlotLayout.height, undefined, "ordinary UI2 Plotly outputs remove producer height");
const centralizedPlotConfig = hooks.plotlyConfigForOutput({
  config: {
    responsive: false,
    displaylogo: true,
    modeBarButtonsToAdd: ["drawline"],
    genapp_chart_editor: { enabled: true, url: "_cedit/_chart_edit.html" }
  }
});
assert.strictEqual(centralizedPlotConfig.responsive, true, "UI2 owns Plotly responsive behavior");
assert.strictEqual(centralizedPlotConfig.displaylogo, false, "UI2 owns Plotly branding behavior");
assert.strictEqual(JSON.stringify(centralizedPlotConfig.modeBarButtonsToRemove), JSON.stringify(["select2d", "lasso2d"]), "UI2 owns the standard Plotly toolbar");
assert.strictEqual(centralizedPlotConfig.modeBarButtonsToAdd, undefined, "UI2 ignores producer toolbar additions");
assert.strictEqual(centralizedPlotConfig.genapp_chart_editor.enabled, true, "UI2 preserves explicit Chart Editor availability metadata");
const multiAxisLayout = { xaxis4: {}, yaxis4: {} };
hooks.applyPlotlyTheme(multiAxisLayout);
assert.strictEqual(multiAxisLayout.xaxis4.gridcolor, "rgba(238, 244, 241, 0.12)", "UI2 themes fourth-and-later x axes");
assert.strictEqual(multiAxisLayout.yaxis4.gridcolor, "rgba(238, 244, 241, 0.12)", "UI2 themes fourth-and-later y axes");
const neutralSeries = [
  { name: "sample 00001", meta: { series_role: "replicate" }, x: [0.01], y: [1.0] },
  { name: "reference", meta: { series_role: "reference" }, x: [0.01], y: [1.1] }
];
const neutralPresentationHost = { dataset: { plotPresentation: JSON.stringify({ traceRoles: { replicate: { token: "context", legend: "hide" } } }) } };
const neutralPresentationOutput = { closest: () => neutralPresentationHost };
const renderedNeutralSeries = hooks.plotlyDataForOutput(neutralPresentationOutput, neutralSeries);
assert.strictEqual(renderedNeutralSeries[0].showlegend, false, "an opted-in neutral context series can be hidden from the legend");
assert.strictEqual(renderedNeutralSeries[0].line.color, "rgba(113, 196, 232, 0.42)", "UI2 gives a neutral context token a consistent translucent line");
assert.strictEqual(renderedNeutralSeries[1].showlegend, undefined, "a role without view presentation remains unchanged");
assert.strictEqual(neutralSeries[0].showlegend, undefined, "UI2 does not mutate the saved scientific figure");
assert.strictEqual(neutralSeries[0].line, undefined, "UI2 does not put visual policy into the saved scientific figure");
window.GENAPP_PLOT_PRESENTATIONS = {
  house: {
    font: { family: "Artist Sans", title_size: 19, label_size: 13, tick_size: 11 },
    background: { page: "#fdfcf8", plot: "#ffffff" },
    grid: { appearance: "subtle", width: 2 },
    legend: { background: "translucent", border: "subtle", font_size: 10 },
    palette: { primary: "#204a87" },
    styles: { focal: { color: "primary", line_width: 4, marker: "diamond", marker_size: 8 } }
  },
  accent: {
    inherits: "house",
    styles: { focal: { color: "#a51d2d", line_width: 5 } }
  }
};
const catalogPresentationHost = { dataset: { plotPresentation: JSON.stringify({ profile: "accent", traceRoles: { replicate: { token: "focal" } } }) } };
const catalogPresentationOutput = { closest: () => catalogPresentationHost };
const catalogSeries = hooks.plotlyDataForOutput(catalogPresentationOutput, neutralSeries);
assert.strictEqual(catalogSeries[0].line.color, "#a51d2d", "an opted-in profile overrides a house token color");
assert.strictEqual(catalogSeries[0].line.width, 5, "an opted-in profile overrides a house token width");
assert.strictEqual(catalogSeries[0].marker.symbol, "diamond", "a profile inherits the house marker style");
assert.strictEqual(catalogSeries[0].marker.size, 8, "a profile inherits the house marker size");
const catalogLayout = hooks.plotlyLayoutForOutput(catalogPresentationOutput, { title: "Neutral figure", xaxis: { title: "x" }, yaxis: { title: "y" } });
assert.strictEqual(catalogLayout.paper_bgcolor, "#fdfcf8", "a presentation profile controls its plot surface without producer geometry");
assert.strictEqual(catalogLayout.font.family, "Artist Sans", "a presentation profile controls its font family");
assert.strictEqual(catalogLayout.xaxis.gridwidth, 2, "a presentation profile controls grid thickness");
assert.strictEqual(catalogLayout.xaxis.title.font.size, 13, "a presentation profile controls axis label size");
const unoptedLayout = hooks.plotlyLayoutForOutput({ dataset: {}, closest: () => null }, { xaxis: {} });
assert.strictEqual(unoptedLayout.paper_bgcolor, "#1a201f", "a non-opted-in plot retains the UI2 theme surface");
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
hooks.state.session.aiHelper = hooks.normalizeAiHelperStatus({ available: false, configured: false, user_preference: "on" });
assert.strictEqual(
  hooks.aiHelperEnabledForUser(),
  false,
  "AI Helper cannot be enabled by user preference when deployment availability is off"
);
hooks.state.session.aiHelper = hooks.normalizeAiHelperStatus({ available: true, configured: true, user_preference: "default" });
assert.strictEqual(
  hooks.aiHelperEnabledForUser(),
  true,
  "AI Helper is visible when deployment allows it and the user follows the default"
);
assert.strictEqual(
  hooks.state.session.aiHelper.endpoint_state,
  "unavailable",
  "AI Helper endpoint state defaults to unavailable when backend omits it"
);
hooks.state.session.aiHelper = hooks.normalizeAiHelperStatus({ available: true, configured: true, endpoint_state: "development_stub", user_preference: "default" });
assert.strictEqual(
  hooks.state.session.aiHelper.endpoint_state,
  "development_stub",
  "AI Helper preserves the development stub endpoint state"
);
assert.strictEqual(
  hooks.normalizeAiHelperEndpointState("configured"),
  "configured",
  "AI Helper accepts the configured endpoint state"
);
assert.strictEqual(
  hooks.normalizeAiHelperEndpointState("unexpected"),
  "unavailable",
  "AI Helper rejects unknown endpoint states"
);
hooks.state.session.aiHelper = hooks.normalizeAiHelperStatus({ available: true, configured: true, user_preference: "off" });
assert.strictEqual(
  hooks.aiHelperEnabledForUser(),
  false,
  "AI Helper is hidden when the user turns it off"
);
const aiHelperSanitizedValues = hooks.sanitizeAiHelperFormValues({
  runname: "run_0",
  pdbfile: "example.pdb",
  password: "hidden",
  api_token: "hidden",
  _uuid: "hidden"
});
assert.strictEqual(aiHelperSanitizedValues.runname, "run_0", "AI Helper context keeps ordinary run fields");
assert.strictEqual(aiHelperSanitizedValues.pdbfile, "example.pdb", "AI Helper context keeps ordinary file path fields");
assert.strictEqual(Object.prototype.hasOwnProperty.call(aiHelperSanitizedValues, "password"), false, "AI Helper context excludes password fields");
assert.strictEqual(Object.prototype.hasOwnProperty.call(aiHelperSanitizedValues, "api_token"), false, "AI Helper context excludes token fields");
assert.strictEqual(Object.prototype.hasOwnProperty.call(aiHelperSanitizedValues, "_uuid"), false, "AI Helper context excludes private UI fields");
hooks.state.moduleId = "";
hooks.state.activeMenuId = "";
hooks.state.runtimeOutputs = {};
hooks.state.jobEvents.reset("", "");
const aiHelperNoModuleContext = hooks.buildAiHelperContext("Hello world");
assert.strictEqual(aiHelperNoModuleContext.application, null, "AI Helper sends JSON null when application cannot be resolved");
assert.strictEqual(aiHelperNoModuleContext.module, null, "AI Helper sends JSON null when no module is loaded");
assert.strictEqual(aiHelperNoModuleContext.page, null, "AI Helper sends JSON null when no page or menu context is active");
assert.strictEqual(aiHelperNoModuleContext.run_context.status, "idle", "AI Helper reports idle run status without an active job");
assert.strictEqual(aiHelperNoModuleContext.run_context.last_status_message, null, "AI Helper sends JSON null when no status message is available");
assert.strictEqual(aiHelperNoModuleContext.output_analysis.available, false, "AI Helper reports no output analysis when no runtime outputs are available");
assert.strictEqual(aiHelperNoModuleContext.output_analysis.output_count, 0, "AI Helper output analysis starts with zero output fields");
hooks.state.moduleId = "pdbrx";
hooks.state.module = {
  fields: [
    { id: "run_report", role: "output", label: "Run report", type: "html" },
    { id: "download_files", role: "output", label: "Download files", type: "filelist" },
    { id: "api_token_result", role: "output", label: "Hidden output", type: "textarea" }
  ]
};
hooks.state.values = { runname: "", pdbfile: "example.pdb", api_token: "hidden" };
hooks.state.runtimeOutputs = {
  run_report: "<p>Finished PDBRx validation with 2 warnings.</p>",
  download_files: ["/private/project/run_0/full/path/output.pdb"],
  api_token_result: "hidden"
};
const aiHelperModuleContext = hooks.buildAiHelperContext("What next?");
assert.strictEqual(aiHelperModuleContext.module, "pdbrx", "AI Helper sends the active module id when one is loaded");
assert.strictEqual(aiHelperModuleContext.page, "pdbrx", "AI Helper uses the active module id as page context");
assert.strictEqual(aiHelperModuleContext.form_values.runname, "", "AI Helper preserves intentional empty form field values");
assert.strictEqual(aiHelperModuleContext.form_values.pdbfile, "example.pdb", "AI Helper carries ordinary module form values");
assert.strictEqual(Object.prototype.hasOwnProperty.call(aiHelperModuleContext.form_values, "api_token"), false, "AI Helper filters sensitive values from the submitted payload");
assert.strictEqual(aiHelperModuleContext.output_analysis.available, true, "AI Helper marks output analysis available when runtime outputs exist");
assert.strictEqual(aiHelperModuleContext.output_analysis.output_count, 2, "AI Helper output analysis filters sensitive output ids");
assert.strictEqual(aiHelperModuleContext.output_analysis.fields[0].summary, "Finished PDBRx validation with 2 warnings.", "AI Helper output analysis strips HTML from output summaries");
assert.strictEqual(aiHelperModuleContext.output_analysis.fields[1].summary, "Files: output.pdb", "AI Helper output analysis keeps filenames without full private paths");
const longOutput = hooks.aiHelperSummarizeOutputValue("x".repeat(450), { type: "textarea" });
assert.strictEqual(longOutput.truncated, true, "AI Helper output analysis truncates long output text");
assert(longOutput.text.length <= 403, "AI Helper output analysis keeps long summaries compact");
const pathOutput = hooks.aiHelperSummarizeOutputValue({ result: "/private/project/run_0/deep/result.dat" }, { type: "json" });
assert.strictEqual(pathOutput.text.includes("/private/project"), false, "AI Helper output analysis redacts private path prefixes in structured summaries");
assert.strictEqual(pathOutput.text.includes("[path:result.dat]"), true, "AI Helper output analysis preserves useful path basenames");
const normalizedUsage = hooks.normalizeAiHelperUsage({ usage: { input_tokens: "12", output_tokens: 8, cached_input_tokens: 11, account_remaining_tokens: 1000, account_cumulative_tokens: 2500, estimated_cost_usd: 0.00000235, account_cumulative_cost_usd: 0.0012 } });
assert.strictEqual(normalizedUsage.input_tokens, 12, "AI Helper normalizes input token counts");
assert.strictEqual(normalizedUsage.output_tokens, 8, "AI Helper normalizes output token counts");
assert.strictEqual(normalizedUsage.total_tokens, null, "AI Helper leaves missing total token counts null");
assert.strictEqual(normalizedUsage.remaining_tokens, 1000, "AI Helper normalizes account remaining token counts when supplied");
assert.strictEqual(normalizedUsage.cumulative_tokens, 2500, "AI Helper normalizes cumulative account token counts when supplied");
assert.strictEqual(normalizedUsage.cached_input_tokens, 11, "AI Helper normalizes cached input token counts when supplied");
assert.strictEqual(normalizedUsage.cache_state, "warm", "AI Helper labels cached provider responses as warm");
assert.strictEqual(normalizedUsage.estimated_cost_usd, 0.00000235, "AI Helper normalizes per-request estimated costs when supplied");
assert.strictEqual(normalizedUsage.cumulative_cost_usd, 0.0012, "AI Helper normalizes cumulative estimated costs when supplied");
assert.strictEqual(normalizedUsage.has_usage, true, "AI Helper recognizes returned token usage");
assert.strictEqual(normalizedUsage.has_remaining, true, "AI Helper recognizes returned account remaining tokens");
assert.strictEqual(normalizedUsage.has_cumulative, true, "AI Helper recognizes returned cumulative account token counts");
assert.strictEqual(normalizedUsage.has_cost, true, "AI Helper recognizes returned cost estimates");
assert.strictEqual(
  hooks.aiHelperUsageSummary({ usage: { total_tokens: 12, cached_input_tokens: 11, account_cumulative_tokens: 2500, estimated_cost_usd: 0.00000235, account_cumulative_cost_usd: 0.0012 } }),
  "Token usage: 12 tokens used; remaining unavailable; 2500 cumulative; cache warm; 11 cached; \$0.000002 estimated; \$0.001200 cumulative cost.",
  "AI Helper displays provider token usage with cumulative account usage and estimated costs when available"
);
assert.strictEqual(
  hooks.aiHelperUsageSummary({ usage: { input_tokens: 256000, total_tokens: 256012, cached_input_tokens: 0 } }),
  "Token usage: 256012 tokens used; remaining unavailable; cache cold; 0 cached.",
  "AI Helper labels large uncached provider prompts as cold"
);
assert.strictEqual(
  hooks.aiHelperUsageSummary({ message: "ok" }),
  "Token usage: not reported by backend.",
  "AI Helper reports when backend does not provide token usage"
);
hooks.state.moduleId = "";
hooks.state.activeMenuId = "";
hooks.state.values = {};
hooks.state.runtimeOutputs = {};
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
assert(
  source.includes('targetWindow = window.open("about:blank", targetWindowName);') &&
    source.includes('await handoffSessionToWindow(targetWindowName);') &&
    source.includes('targetWindow.location.replace(url.toString());'),
  "new-window reattach reserves its popup before async work, hands off the session, then navigates the target"
);
assert(
  source.includes('function handoffSessionToWindow(targetWindowName)') &&
    source.includes('ui2/ajax/ui2_session_handoff.php') &&
    source.includes('formData.set("source_window", window.name);') &&
    source.includes('formData.set("target_window", targetWindowName);'),
  "new-window reattach uses the UI2-local same-origin session handoff endpoint"
);
assert(
  !source.includes('url.searchParams.set("_reqlogin", "1");'),
  "new-window reattach does not force a login after its session handoff"
);
assert.strictEqual(
  hooks.jobManagerEndpoint,
  "ajax/sys_config/sys_jobs2.php",
  "Job Manager uses the legacy details-capable job feed"
);
assert(
  source.includes('closeUtilityOverlay();\\n    if (target.project) {') &&
    source.includes('await loadModule(target.moduleId);'),
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
  source.includes('renderSessionState();\\n      renderAiHelperAvailability();\\n      syncSplashForSession();'),
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

assert.strictEqual(
  hooks.resolveRecentCompletedWindow(rows, undefined, now),
  "hour",
  "recent default selects Hour when an hour-old completed job exists"
);

assert.strictEqual(
  hooks.resolveRecentCompletedWindow(rows.slice(1), undefined, now),
  "day",
  "recent default widens to Day when Hour is empty"
);

assert.strictEqual(
  hooks.resolveRecentCompletedWindow([job("week-old", "tools/data_interpolation", "hello", now - 3 * 86400)], undefined, now),
  "week",
  "recent default widens to Week when Day is empty"
);

assert.strictEqual(
  hooks.resolveRecentCompletedWindow([job("month-old", "tools/data_interpolation", "hello", now - 14 * 86400)], undefined, now),
  "month",
  "recent default widens to Month when Week is empty"
);

assert.strictEqual(
  hooks.resolveRecentCompletedWindow([job("older", "tools/data_interpolation", "hello", now - 31 * 86400)], undefined, now),
  "*all*",
  "recent default falls back to All when completed jobs are older than a month"
);

assert.strictEqual(
  hooks.resolveRecentCompletedWindow([job("running-only", "tools/data_interpolation", "hello", 0, "", "active")], undefined, now),
  "*all*",
  "recent default does not treat a running job as a completed result"
);

assert.strictEqual(
  hooks.resolveRecentCompletedWindow([], undefined, now),
  "*all*",
  "recent default uses All for an empty job history"
);

assert.strictEqual(
  hooks.resolveRecentCompletedWindow([job("hour-boundary", "tools/data_interpolation", "hello", now - 3600)], undefined, now),
  "hour",
  "recent default includes a job completed exactly one hour ago"
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

document.body.children = [];
document.getElementById = function(id) {
  return querySelectorFrom(this.body, `#\${id}`) || querySelectorFrom(this.head, `#\${id}`);
};
const missingFileSubmitForm = createNode("form");
missingFileSubmitForm.id = "ui2-form";
const missingFileStatus = createNode("div");
missingFileStatus.id = "ui2-submit-status";
const missingFileControl = hooks.renderFileControl({ id: "pdbfile", type: "lrfile", required: "true" });
missingFileSubmitForm.append(missingFileControl, missingFileStatus);
document.body.appendChild(missingFileSubmitForm);
hooks.state.menuId = "build";
hooks.state.moduleId = "build_utilities";
hooks.state.module = { executable: "build_utilities" };
hooks.state.session = { logon: "Joseph", project: "no_project_specified" };
let scientificSubmitFetches = 0;
context.fetch = async () => {
  scientificSubmitFetches += 1;
  throw new Error("scientific submit should not fetch with a missing required file");
};
hooks.submitModule(missingFileSubmitForm).then((result) => {
  assert.strictEqual(result.ok, false, "UI2 scientific submit rejects missing required lrfile input");
  assert.match(result.error, /pdbfile.*Please select a file/, "UI2 scientific submit returns the required file validation message");
  assert.strictEqual(missingFileStatus.dataset.status, "error", "UI2 scientific submit marks the status as an input error");
  assert.strictEqual(scientificSubmitFetches, 0, "UI2 scientific submit does not contact the runtime after required-field failure");
});

document.body.children = [];
const staleForm = createNode("form");
staleForm.id = "ui2-form";
const staleInput = createNode("input");
staleInput.dataset.fieldId = "input_pdbfile";
staleInput.value = "";
staleForm.appendChild(staleInput);
document.body.appendChild(staleForm);
const selectedFileSubmitForm = createNode("form");
selectedFileSubmitForm.id = "ui2-form";
const selectedFileControl = hooks.renderFileControl({ id: "input_pdbfile", type: "lrfile", required: "true" });
selectedFileControl.children[0].value = "hiv1_gag_charmm27.pdb";
selectedFileControl.children[1].value = "";
selectedFileControl.children[1].files = ["hiv1_gag_charmm27.pdb"];
selectedFileSubmitForm.appendChild(selectedFileControl);
document.body.appendChild(selectedFileSubmitForm);
hooks.state.module = {
  fields: [{ id: "input_pdbfile", type: "lrfile", required: "true" }]
};
hooks.syncValues(selectedFileSubmitForm);
assert.strictEqual(
  hooks.state.values.input_pdbfile,
  "hiv1_gag_charmm27.pdb",
  "UI2 syncValues reads the submitted React form instead of an older document-level ui2-form"
);
hooks.state.session = { logon: "Joseph", project: "no_project_specified" };
hooks.state.serverSelections = {};
const selectedFileFormData = hooks.buildSubmitFormData(selectedFileSubmitForm, "selected-file-test-uuid");
assert.deepStrictEqual(
  selectedFileFormData.get("input_pdbfile"),
  ["hiv1_gag_charmm27.pdb"],
  "UI2 submit FormData sends the selected local lrfile after preserving the visible value"
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

hooks.state.module = {
  fields: [
    { id: "pdbfile", label: "Coordinate file", type: "lrfile" }
  ]
};
hooks.state.serverSelections = {};
assert.strictEqual(
  hooks.savedInputRestoreError({}, "local-file-run", { pdbfile: ["coordinate.pdb"] }),
  "",
  "UI2 reserves a restore error for unavailable saved input instead of a browser-local file"
);
assert.deepStrictEqual(
  hooks.savedInputRestoreWarnings({ pdbfile: ["coordinate.pdb"] }),
  ["Coordinate file (coordinate.pdb) was selected from this browser and must be selected again before submitting a new run."],
  "UI2 reports a browser-local file as a nonfatal reselect warning"
);
hooks.state.serverSelections = {
  "pdbfile:": {
    id: "pdbfile",
    encodedPath: "Li4vcHJvamVjdC9jb29yZGluYXRlLnBkYg=="
  }
};
assert.strictEqual(
  hooks.savedInputRestoreWarnings({ pdbfile: ["coordinate.pdb"] }).length,
  0,
  "UI2 does not warn when the saved file selection has a server replay token"
);
hooks.state.serverSelections = {
  "pdbfile:1": {
    id: "pdbfile",
    encodedPath: "Li4vcHJvamVjdC9jb29yZGluYXRlMi5wZGI="
  }
};
assert.deepStrictEqual(
  hooks.savedInputRestoreWarnings({ pdbfile: ["coordinate_1.pdb", "coordinate_2.pdb"] }),
  ["Coordinate file (coordinate_1.pdb) was selected from this browser and must be selected again before submitting a new run."],
  "UI2 preserves per-row local-file warnings when a repeated field mixes local and server selections"
);

replayControl.value = "";
hooks.state.module = {
  fields: [
    { id: "data_file_name", type: "lrfile" }
  ]
};
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

hooks.state.values = {
  fraction_d2o: ["0.0", "0.2", "0.85", "1.0"],
  delta_rho: [
    ["2.551", "5.104"],
    ["1.383", "3.928"],
    ["-2.415", "0.109"],
    ["-3.292", "-0.773"]
  ]
};
hooks.state.serverSelections = {};
const matrixFormData = hooks.buildSubmitFormData({
  querySelectorAll() {
    return [];
  }
}, "matrix-test-uuid");
assert.deepStrictEqual(
  matrixFormData.get("fraction_d2o[]"),
  ["0.0", "0.2", "0.85", "1.0"],
  "UI2 retains the established flat repeated-value form"
);
assert.deepStrictEqual(
  matrixFormData.get("delta_rho[0][]"),
  ["2.551", "5.104"],
  "UI2 retains the first submitted matrix row"
);
assert.deepStrictEqual(
  matrixFormData.get("delta_rho[3][]"),
  ["-3.292", "-0.773"],
  "UI2 retains every submitted matrix row and column"
);
assert.strictEqual(
  matrixFormData.get("delta_rho[][]"),
  undefined,
  "UI2 does not flatten a matrix into one-cell rows"
);

document.body.children = [];
document.getElementById = function(id) {
  return querySelectorFrom(this.body, `#\${id}`) || querySelectorFrom(this.head, `#\${id}`);
};
const matrixSubmitForm = createNode("form");
matrixSubmitForm.id = "ui2-form";
document.body.appendChild(matrixSubmitForm);
ui2FormControl(matrixSubmitForm, "number_of_contrast_points_stuhrmann", "4");
ui2FormControl(matrixSubmitForm, "number_of_components_stuhrmann", "2");
const matrixSubmit = ui2IntegerpairMatrixRow();
matrixSubmit.matrixRow._ui2RepeatTableController = {
  id: "mpair_stuhrmann",
  type: "integerpair",
  calc: "number_of_contrast_points_stuhrmann,number_of_components_stuhrmann",
  headers: {}
};
matrixSubmit.matrixRow._ui2RepeatTableFields = [{
  id: "delta_rho_sturhmann",
  type: "text",
  default: [
    ["2.551", "5.104"],
    ["1.383", "3.928"],
    ["-2.415", "0.109"],
    ["-3.292", "-0.773"]
  ]
}];
matrixSubmit.matrixWrap = matrixSubmit.matrixRow.querySelector(".ui2-matrix-wrap");
matrixSubmit.matrixWrap._ui2RepeatMatrixField = matrixSubmit.matrixRow._ui2RepeatTableFields[0];
matrixSubmit.matrixWrap._ui2RepeatMatrixController = matrixSubmit.matrixRow._ui2RepeatTableController;
matrixSubmitForm.appendChild(matrixSubmit.matrixRow);
hooks.updateRepeatTables(
  matrixSubmitForm,
  {
    number_of_contrast_points_stuhrmann: "4",
    number_of_components_stuhrmann: "2"
  },
  new Map([[matrixSubmit.matrixRow, true]])
);
assert.strictEqual(
  matrixSubmitForm.querySelectorAll('input[data-field-id="delta_rho_sturhmann"]').length,
  8,
  "UI2 renders all MCA Stuhrmann matrix controls before collecting submit values"
);
assert.strictEqual(
  JSON.stringify(hooks.collectControlValues(matrixSubmitForm, () => true).delta_rho_sturhmann),
  JSON.stringify([
    ["2.551", "5.104"],
    ["1.383", "3.928"],
    ["-2.415", "0.109"],
    ["-3.292", "-0.773"]
  ]),
  "UI2 collects MCA Stuhrmann matrix controls as a nested matrix before repeat refresh"
);
hooks.syncValues();
assert.strictEqual(
  JSON.stringify(hooks.state.values.delta_rho_sturhmann),
  JSON.stringify([
    ["2.551", "5.104"],
    ["1.383", "3.928"],
    ["-2.415", "0.109"],
    ["-3.292", "-0.773"]
  ]),
  "UI2 syncValues preserves the nested MCA Stuhrmann matrix before submit"
);
const matrixControlFormData = hooks.buildSubmitFormData(matrixSubmitForm, "matrix-control-test-uuid");
assert.deepStrictEqual(
  matrixControlFormData.get("delta_rho_sturhmann[0][]"),
  ["2.551", "5.104"],
  "UI2 submits the first MCA Stuhrmann matrix row as one indexed row"
);
assert.deepStrictEqual(
  matrixControlFormData.get("delta_rho_sturhmann[3][]"),
  ["-3.292", "-0.773"],
  "UI2 submits the last MCA Stuhrmann matrix row as one indexed row"
);
assert.strictEqual(
  matrixControlFormData.get("delta_rho_sturhmann[][]"),
  undefined,
  "UI2 MCA control collection never degrades a matrix into one-cell rows"
);

hooks.state.values = {
  data_file_name: "stale-visible-value",
  sas_paths: "stale-server-path"
};
hooks.state.session = { logon: "Joseph", project: "repeat_project" };
hooks.state.module = {
  fields: [
    { id: "row_count", type: "integer", repeater: "true", tableize: "true" },
    { id: "data_file_name", type: "lrfile", repeat: "row_count" },
    { id: "sas_paths", type: "rpath", repeat: "row_count" }
  ]
};
const serverRepeatOne = btoa("./server_one.dat");
const serverRepeatTwo = btoa("./server_two.dat");
const serverRepeatThree = btoa("./server_three.dat");
hooks.state.serverSelections = {
  "data_file_name:0": {
    id: "data_file_name",
    type: "lrfile",
    repeatIndex: 0,
    encodedPath: serverRepeatOne,
    path: "server_one.dat"
  },
  "data_file_name:1": {
    id: "data_file_name",
    type: "lrfile",
    repeatIndex: 1,
    encodedPath: serverRepeatTwo,
    path: "server_two.dat"
  },
  "data_file_name:2": {
    id: "data_file_name",
    type: "lrfile",
    repeatIndex: 2,
    encodedPath: serverRepeatThree,
    path: "server_three.dat"
  },
  "sas_paths:0": {
    id: "sas_paths",
    type: "rpath",
    repeatIndex: 0,
    encodedPath: btoa("./sas/run_a"),
    path: "sas/run_a"
  },
  "sas_paths:1": {
    id: "sas_paths",
    type: "rpath",
    repeatIndex: 1,
    encodedPath: btoa("./sas/run_b"),
    path: "sas/run_b"
  }
};
assert.strictEqual(
  hooks.repeatFileSubmitId({ id: "data_file_name", type: "lrfile", repeat: "row_count" }, 2),
  "row_count-data_file_name-2",
  "UI2 gives every repeated file field a row-specific legacy submit id"
);
assert.strictEqual(
  hooks.repeatFileSubmitId({ id: "top_level_file", type: "lrfile" }, null),
  "top_level_file",
  "UI2 preserves the scalar submit id for a non-repeated file"
);
const repeatedFileFormData = hooks.buildSubmitFormData({
  querySelectorAll(selector) {
    if (selector !== ".ui2-native-file[data-field-id]") {
      return [];
    }
    return [
      {
        dataset: { fieldId: "data_file_name", repeatTableIndex: "1" },
        files: ["local_two.dat"]
      }
    ];
  }
}, "repeat-file-test-uuid");
assert.deepStrictEqual(
  repeatedFileFormData.get("row_count-data_file_name-0_altval[]"),
  [serverRepeatOne],
  "UI2 submits the first repeated server file through its row-specific legacy key"
);
assert.deepStrictEqual(
  repeatedFileFormData.get("row_count-data_file_name-2_altval[]"),
  [serverRepeatThree],
  "UI2 submits the later repeated server file through its row-specific legacy key"
);
assert.deepStrictEqual(
  repeatedFileFormData.get("row_count-data_file_name-1"),
  ["local_two.dat"],
  "UI2 submits a repeated local file through its original row-specific legacy key"
);
assert.strictEqual(
  repeatedFileFormData.get("data_file_name_altval[]"),
  undefined,
  "UI2 does not collapse repeated server files into one receiver-incompatible array"
);
assert.deepStrictEqual(
  repeatedFileFormData.get("sas_paths[]"),
  [btoa("./sas/run_a"), btoa("./sas/run_b")],
  "UI2 repeated submit preserves repeated server rpath values"
);
assert.deepStrictEqual(
  repeatedFileFormData.get("_decodepath_sas_paths"),
  ["", ""],
  "UI2 repeated rpath submit keeps the decode marker for each selected row"
);
assert.strictEqual(
  hooks.state.serverSelections["data_file_name:1"],
  undefined,
  "UI2 local repeated file rows clear only the matching server selection row"
);

const plainFileTable = hooks.renderTableizedRepeater({
  controller: { id: "row_count", type: "integer", default: 2, repeater: "true", tableize: "true" },
  fields: [
    { id: "data_file_name", type: "lrfile", repeat: "row_count" },
    { id: "concentration", type: "float", repeat: "row_count" }
  ]
}, "input");
assert.strictEqual(
  plainFileTable.classList.contains("ui2-repeat-table-has-file"),
  true,
  "UI2 marks a file-bearing repeated table for generic responsive file-column styling"
);
assert.strictEqual(
  plainFileTable.querySelector(".ui2-repeat-table-file-cell") !== null,
  true,
  "UI2 marks each repeated file cell without using a module-specific selector"
);

hooks.state.values = {
  row_count: "3",
  source_kind: ["prepared", "raw", "prepared"],
  prepared_file: ["prepared_local.dat", "", ""],
  raw_file: ["", "raw_server.dat", ""],
  scale: ["", "1.25", ""]
};
hooks.state.module = {
  fields: [
    { id: "row_count", type: "integer", repeater: "true", tableize: "true" },
    { id: "source_kind", type: "listbox", repeat: "row_count" },
    { id: "prepared_file", type: "lrfile", repeat: "row_count", repeatcondition: "source_kind:prepared" },
    { id: "raw_file", type: "lrfile", repeat: "row_count", repeatcondition: "source_kind:raw" },
    { id: "scale", type: "float", repeat: "row_count", repeatcondition: "source_kind:raw" }
  ]
};
hooks.state.serverSelections = {
  "raw_file:1": {
    id: "raw_file",
    type: "lrfile",
    repeatIndex: 1,
    encodedPath: serverRepeatTwo,
    path: "raw_server.dat"
  }
};
const conditionedFileFormData = hooks.buildSubmitFormData({
  querySelectorAll(selector) {
    if (selector === ".ui2-native-file[data-field-id]") {
      return [{
        dataset: { fieldId: "prepared_file", repeatTableIndex: "0" },
        disabled: false,
        files: ["prepared_local.dat"]
      }];
    }
    if (selector === '[data-field-id="raw_file"]') {
      return [{ dataset: { repeatTableIndex: "1" }, disabled: false }];
    }
    return [];
  }
}, "conditioned-file-test-uuid");
assert.deepStrictEqual(
  conditionedFileFormData.get("row_count-prepared_file-0"),
  ["prepared_local.dat"],
  "UI2 submits an opted-in local file through the indexed legacy repeater key"
);
assert.deepStrictEqual(
  conditionedFileFormData.get("row_count-raw_file-1_altval[]"),
  [serverRepeatTwo],
  "UI2 submits an opted-in server file through the indexed legacy repeater key"
);
assert.strictEqual(
  conditionedFileFormData.get("prepared_file[]"),
  undefined,
  "UI2 replaces dense display placeholders with indexed conditional file transport"
);
assert.deepStrictEqual(
  conditionedFileFormData.get("scale[]"),
  ["", "1.25", ""],
  "UI2 preserves dense scalar row alignment for conditioned table cells"
);

function conditionedTableCell(fieldId, condition, index) {
  const cell = createNode("td");
  cell.dataset.repeatTableField = fieldId;
  cell.dataset.repeatTableIndex = String(index);
  if (condition) cell.dataset.repeatcondition = condition;
  return cell;
}

function conditionedTableHeader(fieldId) {
  const header = createNode("th");
  header.dataset.repeatTableHeader = fieldId;
  return header;
}

const conditionedTable = createNode("div");
conditionedTable.classList.add("ui2-tableized-repeater");
conditionedTable._ui2RepeatTableFields = [
  { id: "source_kind", type: "listbox", repeat: "row_count" },
  { id: "prepared_file", type: "lrfile", repeat: "row_count", repeatcondition: "source_kind:prepared" },
  { id: "raw_file", type: "lrfile", repeat: "row_count", repeatcondition: "source_kind:raw" },
  { id: "scale", type: "float", repeat: "row_count", repeatcondition: "source_kind:raw" }
];
const conditionedHeaderRow = createNode("tr");
const sourceHeader = conditionedTableHeader("source_kind");
const preparedHeader = conditionedTableHeader("prepared_file");
const rawHeader = conditionedTableHeader("raw_file");
const scaleHeader = conditionedTableHeader("scale");
conditionedHeaderRow.append(sourceHeader, preparedHeader, rawHeader, scaleHeader);
const conditionedHead = createNode("thead");
conditionedHead.appendChild(conditionedHeaderRow);
const conditionedBody = createNode("tbody");
for (let index = 0; index < 2; index += 1) {
  const tableRow = createNode("tr");
  tableRow.append(
    conditionedTableCell("source_kind", "", index),
    conditionedTableCell("prepared_file", "source_kind:prepared", index),
    conditionedTableCell("raw_file", "source_kind:raw", index),
    conditionedTableCell("scale", "source_kind:raw", index)
  );
  conditionedBody.appendChild(tableRow);
}
const conditionedNativeTable = createNode("table");
conditionedNativeTable.append(conditionedHead, conditionedBody);
conditionedTable.appendChild(conditionedNativeTable);
const conditionedScope = createNode("div");
conditionedScope.appendChild(conditionedTable);

hooks.updateRepeatTableCellConditions(conditionedScope, {
  source_kind: ["prepared", "prepared"]
});
assert.strictEqual(preparedHeader.classList.contains("ui2-hidden"), false, "UI2 keeps the active conditional column header visible");
assert.strictEqual(rawHeader.classList.contains("ui2-hidden"), true, "UI2 collapses a conditional column with no active row cells");
assert.strictEqual(scaleHeader.classList.contains("ui2-hidden"), true, "UI2 collapses every inactive conditional scalar column");
assert.strictEqual(sourceHeader.classList.contains("ui2-hidden"), false, "UI2 leaves unconditional column headers visible");

hooks.updateRepeatTableCellConditions(conditionedScope, {
  source_kind: ["prepared", "raw"]
});
assert.strictEqual(preparedHeader.classList.contains("ui2-hidden"), false, "UI2 retains the prepared header for a mixed conditional table");
assert.strictEqual(rawHeader.classList.contains("ui2-hidden"), false, "UI2 retains the raw header when one row requires it");
assert.strictEqual(scaleHeader.classList.contains("ui2-hidden"), false, "UI2 retains a scalar header when one row requires it");

hooks.state.module = {
  fields: [
    { id: "data_file_name", type: "lrfile", repeat: "row_count" }
  ]
};
const repeatedReplayControls = [0, 1].map((repeatIndex) => ({
  type: "text",
  value: "",
  dataset: { fieldId: "data_file_name", repeatTableIndex: String(repeatIndex) },
  closest(selector) {
    return selector === "#ui2-form" ? {} : null;
  },
  dispatchEvent(event) {
    this.lastEvent = event.type;
  }
}));
document.querySelectorAll = (selector) => (
  selector === "[data-field-id=\\"data_file_name\\"]" ? repeatedReplayControls : []
);
hooks.state.serverSelections = {};
hooks.applyInputPayload({
  _selaltval_data_file_name: "data_file_name_altval",
  data_file_name_altval: [[serverRepeatOne], [serverRepeatTwo]],
  _html_data_file_name_altval: ["<i>Server</i>: server_one.dat", "<i>Server</i>: server_two.dat"]
});
assert.strictEqual(repeatedReplayControls[0].value, "server_one.dat", "UI2 reattach restores the first repeated server-file label");
assert.strictEqual(repeatedReplayControls[1].value, "server_two.dat", "UI2 reattach restores the second repeated server-file label");
assert.strictEqual(
  hooks.state.serverSelections["data_file_name:0"].encodedPath,
  serverRepeatOne,
  "UI2 reattach restores the first repeated server-file payload"
);
assert.strictEqual(
  hooks.state.serverSelections["data_file_name:1"].encodedPath,
  serverRepeatTwo,
  "UI2 reattach restores the second repeated server-file payload"
);

hooks.state.module = {
  fields: [
    { id: "row_count", type: "integer", repeater: "true", tableize: "true" },
    { id: "prepared_file", type: "lrfile", repeat: "row_count", repeatcondition: "source_kind:prepared" }
  ]
};
const conditionedReplayControl = {
  type: "text",
  value: "",
  dataset: { fieldId: "prepared_file", repeatTableIndex: "2" },
  closest(selector) {
    return selector === "#ui2-form" ? {} : null;
  },
  dispatchEvent(event) {
    this.lastEvent = event.type;
  }
};
document.querySelectorAll = (selector) => (
  selector === "[data-field-id=\\\"prepared_file\\\"]" ? [conditionedReplayControl] : []
);
hooks.state.serverSelections = {};
hooks.applyInputPayload({
  "_selaltval_row_count-prepared_file-2": "row_count-prepared_file-2_altval",
  "row_count-prepared_file-2_altval": [serverRepeatTwo],
  "_html_row_count-prepared_file-2_altval": "<i>Server</i>: prepared_row_3.dat"
});
assert.strictEqual(
  conditionedReplayControl.value,
  "prepared_row_3.dat",
  "UI2 reattach restores a row-conditioned server-file label at its original row"
);
assert.strictEqual(
  hooks.state.serverSelections["prepared_file:2"].encodedPath,
  serverRepeatTwo,
  "UI2 reattach restores a row-conditioned server-file payload at its original row"
);

const singleRepeatedReplayControl = {
  type: "text",
  value: "",
  dataset: { fieldId: "experimental_data_file_array", repeatTableIndex: "0" },
  closest(selector) {
    return selector === "#ui2-form" ? {} : null;
  },
  dispatchEvent(event) {
    this.lastEvent = event.type;
  }
};
document.querySelectorAll = (selector) => (
  selector === "[data-field-id=\\\"experimental_data_file_array\\\"]" ? [singleRepeatedReplayControl] : []
);
hooks.state.module = {
  fields: [
    { id: "experimental_number_contrast_points", type: "integer", repeater: "true", tableize: "true" },
    { id: "experimental_data_file_array", type: "lrfile", repeat: "experimental_number_contrast_points" }
  ]
};
hooks.state.serverSelections = {};
hooks.applyInputPayload({
  _selaltval_experimental_data_file_array: "experimental_data_file_array_altval",
  experimental_data_file_array_altval: [serverRepeatOne],
  _html_experimental_data_file_array_altval: "<i>Server</i>: sans_data.sub"
});
assert.strictEqual(
  singleRepeatedReplayControl.value,
  "sans_data.sub",
  "UI2 reattach restores a single repeated server-file label"
);
assert.strictEqual(
  hooks.state.serverSelections["experimental_data_file_array:0"].encodedPath,
  serverRepeatOne,
  "UI2 reattach keeps a single repeated server-file selection in row zero"
);

hooks.state.values = { component_count: 3, note: "hook note" };
hooks.state.session = { logon: "Joseph", project: "hook_project" };
hooks.state.serverSelections = {};
hooks.state.module = {
  fields: [
    { id: "component_count", type: "integer" },
    { id: "data_file_name", type: "lrfile" }
  ]
};
const hookFormData = hooks.buildHookFormData({
  querySelectorAll() {
    return [];
  }
}, {
  id: "load_defaults",
  type: "button",
  hook: "hook_multicomponent_analysis.py",
  hookdata: "_allformdata",
  file: "lrfile"
}, {
  source: "server",
  encodedPath: serverRepeatOne
});
assert.strictEqual(hookFormData.get("hook"), "hook_multicomponent_analysis.py", "UI2 hook payload carries the configured hook script");
assert.deepStrictEqual(hookFormData.get("component_count"), ["3"], "UI2 hook all-form payload includes current values");
assert.strictEqual(hookFormData.get("_file_enc_to_load"), serverRepeatOne, "UI2 hook server-file payload uses the legacy encoded-file key");
assert.strictEqual(hookFormData.get("_project"), "hook_project", "UI2 hook payload carries the current project");

const inlineHookFileControl = hooks.renderHookButtonControl({
  id: "load_defaults",
  label: "read data from contrast calculator output file",
  type: "button",
  hook: "hook_multicomponent_analysis.py",
  hookdata: "_allformdata",
  file: "lrfile"
});
assert.strictEqual(
  inlineHookFileControl.querySelectorAll(".ui2-native-file").length,
  1,
  "UI2 hook file buttons render an inline local-file picker instead of a hook chooser popup"
);
assert.strictEqual(
  inlineHookFileControl.querySelectorAll("button").map((button) => button.textContent).join("|"),
  "Browse local files|Browse server",
  "UI2 hook lrfile buttons expose normal inline local/server choices"
);
assert.strictEqual(
  inlineHookFileControl.querySelector(".ui2-dialog-overlay"),
  null,
  "UI2 hook file buttons do not render a modal input chooser"
);

const dynamicGroup = {
  dataset: {
    outputFieldId: "dynamic_gallery",
    outputType: "plotly",
    dynamicIdPrefix: "fixture_plot",
    dynamicMax: "2",
    dynamicLabel: "Dynamic gallery"
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
assert.strictEqual(dynamicItems[0].id, "fixture_plot_1", "dynamic output items generate ids from idprefix");
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
dynamicPlotGroup.dataset.plotFit = "pane";
dynamicPlotGroup.dataset.outputFieldId = "dynamic_gallery";
dynamicPlotGroup.dataset.outputType = "plotly";
dynamicPlotGroup.dataset.dynamicOutput = "true";
dynamicPlotGroup.dataset.dynamicIdPrefix = "fixture_plot";
dynamicPlotGroup.dataset.dynamicMax = "2";
dynamicPlotGroup.dataset.dynamicLabel = "Dynamic gallery";
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
hooks.state.jobEvents.reset("run-dynamic-gallery", "fixture_module");
hooks.applyRuntimePayload({
  _job_event: {
    version: 1,
    run: "run-dynamic-gallery",
    module: "fixture_module",
    sequence: 1,
    timestamp: "2026-07-12T12:00:00Z",
    channel: "plot",
    topic: "dynamic_gallery",
    operation: "snapshot",
    payload: {
      items: [{
        id: "series_one",
        label: "Series one",
        value: { data: [], layout: { title: "Series one" } }
      }, {
        id: "series_two",
        label: "Series two",
        value: { data: [], layout: { title: "Series two" } }
      }]
    }
  }
});
assert.strictEqual(dynamicPlotRow.hidden, false, "plot job events reveal dynamic plot output rows");
assert.strictEqual(
  dynamicPlotGroup.querySelectorAll(".ui2-dynamic-output-instance").length,
  2,
  "dynamic plot output groups retain two generated children instead of rendering on the group shell"
);
const retainedDynamicPlot = dynamicPlotGroup.querySelector('[data-output-field-id="series_one"]');
hooks.applyRuntimePayload({
  _job_event: {
    version: 1,
    run: "run-dynamic-gallery",
    module: "fixture_module",
    sequence: 2,
    timestamp: "2026-07-12T12:00:01Z",
    channel: "plot",
    topic: "dynamic_gallery",
    operation: "snapshot",
    payload: {
      items: [{
        id: "series_one",
        label: "Updated series one",
        value: { data: [], layout: { title: "Updated series one" } }
      }, {
        id: "series_two",
        label: "Updated series two",
        value: { data: [], layout: { title: "Updated series two" } }
      }]
    }
  }
});
assert.strictEqual(
  dynamicPlotGroup.querySelector('[data-output-field-id="series_one"]'),
  retainedDynamicPlot,
  "successive dynamic Plotly snapshots retain the existing canvas instead of recreating it"
);
hooks.applyRuntimePayload({ dynamic_gallery: { items: [] } });
assert.strictEqual(dynamicPlotRow.hidden, true, "clearing a dynamic gallery hides its output row");
assert.strictEqual(
  dynamicPlotGroup.querySelectorAll(".ui2-dynamic-output-instance").length,
  0,
  "clearing a dynamic gallery removes generated children"
);
hooks.applyRuntimePayload({
  dynamic_gallery: {
    items: [{
      id: "series_one",
      label: "Restored series one",
      value: { data: [], layout: { title: "Restored series one" } }
    }, {
      id: "series_two",
      label: "Restored series two",
      value: { data: [], layout: { title: "Restored series two" } }
    }]
  }
});
assert.strictEqual(dynamicPlotRow.hidden, false, "repopulating a dynamic gallery reveals its output row");
assert.strictEqual(
  dynamicPlotGroup.querySelectorAll(".ui2-dynamic-output-instance").length,
  2,
  "repopulating a dynamic gallery restores both generated children"
);

const rememberedPlot = createNode("div");
rememberedPlot.dataset.outputFieldId = "plotout4_stream";
rememberedPlot.dataset.outputType = "plotly";
rememberedPlot.dataset.plotFit = "pane";
rememberedPlot._ui2PlotlyLastFigure = {
  data: [{ x: [1], y: [10], type: "scatter" }],
  layout: { width: 900, height: 600, title: "Remembered" },
  config: { responsive: true }
};
hooks.rememberPlotlyAppend(rememberedPlot, [0], [[2, 3, 4]], [[20, 30, 40]], 3);
assert.deepStrictEqual(
  rememberedPlot._ui2PlotlyLastFigure.data[0].x,
  [2, 3, 4],
  "Plotly append events update the remembered snapshot used for hidden-pane recovery"
);
let refreshCount = 0;
window.Plotly.react = function(output, data, layout, config) {
  refreshCount += 1;
  output.data = data;
  output.layout = layout;
  output.config = config;
  const svg = createNode("div");
  svg.className = "svg-container";
  output.appendChild(svg);
  return output;
};
hooks.refreshPlotlyOutputIfNeeded(rememberedPlot);
assert.strictEqual(refreshCount, 1, "blank Plotly nodes can be refreshed from the remembered snapshot before resize");
assert.strictEqual(
  rememberedPlot.layout.height,
  undefined,
  "refreshed pane-fitted Plotly output keeps producer height out of the client layout"
);
assert.deepStrictEqual(
  rememberedPlot.data[0].y,
  [20, 30, 40],
  "refreshed Plotly output uses the latest remembered appended data"
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
  frame_id: "snapshot-7",
  label: "Snapshot 7",
  metadata: { source_step: 612 },
  coordinate_dtype: "float32",
  coordinates: [0, 1, 2, 3, 4, 5]
});
assert.strictEqual(Object.prototype.toString.call(normalized_frame.coordinates), "[object Float32Array]", "structure frames normalize to compact Float32 coordinates");
assert.strictEqual(normalized_frame.atom_count, 2, "structure frames retain their topology atom count");
assert.strictEqual(normalized_frame.frame_id, "snapshot-7", "structure frames retain a generic frame identity");
assert.strictEqual(normalized_frame.label, "Snapshot 7", "structure frames retain an optional generic label");
assert.strictEqual(normalized_frame.metadata.source_step, 612, "structure frames retain opaque producer metadata");
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
assert.strictEqual(frameOutput.dataset.ngl_frame_id, "snapshot-7", "NGL records the displayed generic frame identity without recentering");
assert.strictEqual(frameOutput.dataset.ngl_frames_rendered, "1", "NGL telemetry records applied coordinate frames");
assert.strictEqual(frameOutput.dataset.ngl_coordinate_dtype, "float32", "NGL telemetry records the active coordinate dtype");
assert.strictEqual(hooks.ngl_active_frame_index(frameOutput, [normalized_frame]), 0, "NGL active-frame selection follows the last successfully rendered frame");
const rerendered_frame = hooks.normalize_ngl_coordinate_frame({
  atom_count: 2,
  frame_id: "snapshot-7",
  coordinate_dtype: "float32",
  coordinates: [6, 7, 8, 9, 10, 11]
});
assert.strictEqual(hooks.apply_ngl_coordinate_frame(frameOutput, rerendered_frame), true, "NGL can redraw a selected retained frame");
assert.strictEqual(frameOutput.dataset.ngl_frames_rendered, "1", "NGL preview coverage counts distinct frame identities instead of redraws");

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
hooks.queue_ngl_coordinate_frame(frameOutput, { atom_count: 2, frame_id: "snapshot-8", coordinates: [1, 1, 1, 2, 2, 2] });
hooks.queue_ngl_coordinate_frame(frameOutput, { atom_count: 2, frame_id: "snapshot-9", coordinates: [3, 3, 3, 4, 4, 4] });
assert.strictEqual(frameOutput._ui2_ngl_frames.length, 2, "queued structure frames are retained for post-run NGL review");
assert.strictEqual(scheduledFrames.length, 1, "rapid structure frames coalesce into one animation-frame render");
scheduledFrames.shift()();
assert.deepStrictEqual(nglCalls[0], ["coordinates", [3, 3, 3, 4, 4, 4]], "coalescing renders the newest available structure frame");
assert.strictEqual(frameOutput.dataset.ngl_frame_id, "snapshot-9", "coalescing skips stale previews but retains the latest frame identity");
assert.strictEqual(frameOutput.dataset.ngl_frames_received, "2", "NGL telemetry records queued coordinate frames");
assert.strictEqual(frameOutput.dataset.ngl_frames_retained, "2", "NGL telemetry records retained coordinate frames");
assert.strictEqual(frameOutput.dataset.ngl_frames_dropped, "1", "NGL telemetry records a coalesced stale render");
assert.strictEqual(frameOutput.dataset.ngl_last_dropped_reason, "stale_frame", "NGL telemetry explains stale-frame coalescing");
const refreshStart = nglCalls.length;
assert.strictEqual(hooks.refreshNglOutputFrame(frameOutput), true, "NGL refresh reapplies the active retained frame after tab or panel resize");
assert.deepStrictEqual(nglCalls[refreshStart], ["coordinates", [3, 3, 3, 4, 4, 4]], "NGL resize refresh keeps the visible structure on the active streamed frame");
frameOutput._ui2_ngl_frame_history_max_bytes = 24 * 10;
for (let i = 0; i < 12; i += 1) {
  hooks.queue_ngl_coordinate_frame(frameOutput, { atom_count: 2, frame_id: "snapshot-" + (20 + i), coordinates: [i, i, i, i + 1, i + 1, i + 1] });
}
assert.strictEqual(frameOutput._ui2_ngl_frames.length, 10, "UI2 trims retained NGL frames when the memory budget is reached");
assert.strictEqual(frameOutput.dataset.ngl_frames_dropped, "16", "NGL telemetry records stale-render and memory-budget frame drops");
assert.strictEqual(frameOutput.dataset.ngl_bytes_retained, String(24 * 10), "NGL telemetry records retained coordinate bytes");
frameOutput._ui2_ngl_frame_history_max_bytes = 1;
hooks.queue_ngl_coordinate_frame(frameOutput, { atom_count: 2, frame_id: "snapshot-99", coordinates: [9, 9, 9, 10, 10, 10] });
assert.strictEqual(frameOutput._ui2_ngl_frames.length, 1, "UI2 keeps only the latest NGL frame when the memory budget is tiny");
assert.strictEqual(frameOutput._ui2_ngl_frames[0].frame_id, "snapshot-99", "UI2 does not preserve the old ten-frame experiment under memory pressure");

const scenario = {
  id: "basic_documented_example",
  verification: {
    schema_version: 1,
    checks: [
      { id: "completed", kind: "job_status", equals: "complete" },
      { id: "report", kind: "output_present", output_id: "interpolated_file" },
      { id: "plot", kind: "output_nonempty", output_id: "lineplot" }
    ]
  }
};
assert.strictEqual(
  hooks.validTestScenarioCatalog({ schema_version: 1, module_id: "data_interpolation", scenarios: [{ ...scenario, label: "Basic", inputs: { run_name: "example" } }] }, "data_interpolation"),
  true,
  "UI2 accepts a declarative scenario catalog with allowed verification checks"
);
assert.strictEqual(
  hooks.validTestScenarioCatalog({ schema_version: 1, module_id: "data_interpolation", scenarios: [{ ...scenario, id: "bad id", label: "Bad", inputs: {} }] }, "data_interpolation"),
  false,
  "UI2 rejects unsafe scenario identifiers"
);
assert.strictEqual(
  hooks.evaluateTestScenarioVerification(scenario, "running", { interpolated_file: "result" }).state,
  "running",
  "verification remains running until a terminal result is durable"
);
assert.strictEqual(
  hooks.evaluateTestScenarioVerification(scenario, "complete", { interpolated_file: "result", lineplot: { items: [{ value: 1 }] } }).state,
  "passed",
  "verification passes from durable final output values"
);
assert.strictEqual(
  hooks.evaluateTestScenarioVerification(scenario, "complete", { interpolated_file: "result", lineplot: { items: [] } }).state,
  "failed",
  "verification reports an absent required final output without fabricating data"
);
const scenarioSnapshotBefore = hooks.testScenarioSnapshot();
const scenarioSnapshotRepeated = hooks.testScenarioSnapshot();
assert.strictEqual(
  scenarioSnapshotBefore,
  scenarioSnapshotRepeated,
  "test-scenario snapshot identity remains stable between reads for React subscriptions"
);
let scenarioNotifications = 0;
const unsubscribeTestScenarios = hooks.subscribeTestScenarios(() => { scenarioNotifications += 1; });
assert.strictEqual(
  scenarioNotifications,
  0,
  "registering a test-scenario subscriber does not publish a synthetic state change"
);
hooks.clearTestScenarios();
assert.strictEqual(scenarioNotifications, 1, "clearing test scenarios publishes exactly one state transition");
assert.notStrictEqual(
  hooks.testScenarioSnapshot(),
  scenarioSnapshotBefore,
  "test-scenario snapshot identity changes after a real state transition"
);
unsubscribeTestScenarios();
JS
close $fh;

my $node = $ENV{NODE} || 'node';
my $output = `$node "$script" 2>&1`;
my $status = $? >> 8;

is( $status, 0, 'ui2 runtime helper behavior passes executable checks' )
    or diag($output);

done_testing();
