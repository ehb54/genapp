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
  const node = {
    tagName: String(tag || "div").toUpperCase(),
    dataset: {},
    style: {},
    children: [],
    className: "",
    isConnected: true,
    classList: {
      add() {},
      remove() {},
      toggle() {}
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
  CSS: { escape(value) { return String(value); } },
  crypto: { randomUUID() { return "uuid-for-test"; } },
  localStorage: { getItem() { return "{}"; }, setItem() {} },
  location: { href: "https://example.test/sassie3/ui2/", pathname: "/sassie3/ui2/", search: "" },
  name: "ui2-test",
  getComputedStyle() {
    return { getPropertyValue() { return ""; } };
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

assert.strictEqual(
  JSON.stringify(hooks.normalizeFileList({ out: ["results/users/Joseph/min3.pdb"], extra: "results/users/Joseph/no_project_specified.tar" })),
  JSON.stringify(["results/users/Joseph/min3.pdb", "results/users/Joseph/no_project_specified.tar"]),
  "download file payloads can be object, array, or string shaped"
);

const links = hooks.fileDownloadLinks("results/users/Joseph/min3.pdb");
assert(links.includes("../results/users/Joseph/min3.pdb"), "download link targets the generated app path");
assert(links.includes("min3.pdb"), "download link labels the selected file");

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

const replayControl = {
  type: "text",
  value: "",
  dataset: { fieldId: "data_file_name" },
  closest(selector) {
    return selector === ".ui2-module-form" ? {} : null;
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
JS
close $fh;

my $node = $ENV{NODE} || 'node';
my $output = `$node "$script" 2>&1`;
my $status = $? >> 8;

is( $status, 0, 'ui2 runtime helper behavior passes executable checks' )
    or diag($output);

done_testing();
