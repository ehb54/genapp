const fs = require("fs");
const vm = require("vm");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function createDomHarness() {
  const elements = {};

  function element(id) {
    if (!elements[id]) {
      elements[id] = {
        attributes: {},
        checked: false,
        defaultValue: "",
        html: "",
        id,
        style: { display: "block" },
        value: "",
        visible: true,
      };
    }
    return elements[id];
  }

  function wrapperFor(id) {
    const ele = element(id);
    return {
      length: 1,
      val(value) {
        if (arguments.length) {
          ele.value = value;
          return this;
        }
        return ele.value;
      },
      attr(name, value) {
        if (arguments.length > 1) {
          ele.attributes[name] = value;
          return this;
        }
        return ele.attributes[name];
      },
      prop(name, value) {
        if (arguments.length > 1) {
          ele[name] = value;
          return this;
        }
        return ele[name];
      },
      html(value) {
        if (arguments.length) {
          ele.html = value;
          return this;
        }
        return ele.html;
      },
      empty() {
        ele.html = "";
        return this;
      },
      is(query) {
        return query === ":visible" ? ele.visible : false;
      },
      hide() {
        ele.visible = false;
        ele.style.display = "none";
        return this;
      },
      show() {
        ele.visible = true;
        ele.style.display = "block";
        return this;
      },
      data(name, value) {
        ele.data = ele.data || {};
        if (arguments.length > 1) {
          ele.data[name] = value;
          return this;
        }
        return ele.data[name];
      },
      removeData(name) {
        ele.data = ele.data || {};
        if (arguments.length) {
          delete ele.data[name];
        } else {
          ele.data = {};
        }
        return this;
      },
      addClass() { return this; },
      removeClass() { return this; },
      append(value) {
        ele.html += value;
        return this;
      },
      on() { return this; },
      off() { return this; },
      blur() { return this; },
      change() { return this; },
      keypress() { return this; },
      click() { return this; },
      each(cb) {
        cb.call(ele, 0, ele);
        return this;
      },
      find(selector) {
        if (typeof selector === "string" && selector.startsWith("#") && !selector.includes(" ")) {
          const id = selector.slice(1);
          return elements[id] ? wrapperFor(id) : emptyWrapper();
        }
        return emptyWrapper();
      },
      text(value) {
        if (arguments.length) {
          ele.html = value;
          return this;
        }
        return ele.html;
      },
    };
  }

  function emptyWrapper() {
    return {
      length: 0,
      val() { return undefined; },
      attr() { return undefined; },
      prop() { return undefined; },
      html() { return undefined; },
      empty() { return this; },
      is() { return false; },
      hide() { return this; },
      show() { return this; },
      data() { return undefined; },
      removeData() { return this; },
      addClass() { return this; },
      removeClass() { return this; },
      append() { return this; },
      on() { return this; },
      off() { return this; },
      blur() { return this; },
      change() { return this; },
      keypress() { return this; },
      click() { return this; },
      each() { return this; },
      find() { return this; },
      text() { return undefined; },
    };
  }

  function $(selector) {
    if (selector === global.document || selector === global.window) {
      return emptyWrapper();
    }
    if (typeof selector !== "string") {
      return emptyWrapper();
    }
    if (selector.startsWith("#") && !selector.includes(" ")) {
      return wrapperFor(selector.slice(1));
    }
    return emptyWrapper();
  }

  $.each = function each(obj, cb) {
    Object.keys(obj || {}).forEach((key) => cb(key, obj[key]));
  };
  $.extend = Object.assign;
  $.jstree = { defaults: {}, plugins: {} };
  $.plot = function plot(selector, data, options) {
    $.plot.calls.push({ selector, data, options });
    return {};
  };
  $.plot.calls = [];

  const context = {
    $,
    jQuery: $,
    console,
    document: {
      getElementById(id) {
        return element(id);
      },
      styleSheets: [],
    },
    window: { location: { search: "" }, name: "test_window" },
    setTimeout,
    clearTimeout,
  };
  context.global = context;

  return { context, element, elements };
}

function loadGeneratedGa(gaPath) {
  const harness = createDomHarness();
  const source = fs.readFileSync(gaPath, "utf8");
  vm.createContext(harness.context);
  vm.runInContext(source, harness.context, { filename: gaPath });
  return harness;
}

function runValidationScenario(gaPath) {
  const h = loadGeneratedGa(gaPath);
  const ga = h.context.ga;

  h.element("float_field").value = "11";
  h.element("float_field").attributes.min = "0";
  h.element("float_field").attributes.max = "10";
  assert(ga.valid.checkFloat("#float_field") === 1, "valid float should pass");
  assert(h.element("float_field").value === "10", "float value should clamp to max");
  assert(h.element("float_field_msg").html === " value set to maximum allowed", "float max message should be set");

  h.element("int_field").value = "abc";
  h.element("int_field").attributes.min = "0";
  h.element("int_field").attributes.max = "10";
  h.element("int_field").required = true;
  assert(ga.valid.checkInt("#int_field") === 0, "invalid integer should fail");
  assert(h.element("int_field_msg").html === " wrong format", "integer error message should be set");

  h.element("text_field").value = "abc";
  h.element("text_field").attributes.pattern = "^[A-Z]+$";
  h.element("text_field").required = true;
  assert(ga.valid.checkText("#text_field") === 0, "text pattern mismatch should fail");
  assert(h.element("text_field_msg").html === " wrong format", "text error message should be set");

  h.element("safe_file").value = "../bad";
  h.element("safe_file").defaultValue = "safe.txt";
  ga.valid.safeFile("#safe_file");
  assert(h.element("safe_file").value === "safe.txt", "unsafe file should reset to default");

  const value = ["12"];
  h.element("coerce").attributes.min = "0";
  h.element("coerce").attributes.max = "5";
  h.element("coerce").data = { type: "integer" };
  assert(ga.value.checkFloatIntOK("#coerce", value) === true, "integer coercion should pass");
  assert(value[0] === "5", "integer coercion should clamp max");
}

function runDataUpdateScenario(gaPath) {
  const h = loadGeneratedGa(gaPath);
  const ga = h.context.ga;
  const $ = h.context.$;

  h.context.gd = $("#global_data");
  h.context.syncState = function syncState() {
    h.context.__syncStateCalled = true;
  };
  h.context.Plotly = {
    calls: [],
    newPlot(id, data, layout, config) {
      this.calls.push({ method: "newPlot", id, data, layout, config });
    },
    plot(id, data, layout, config) {
      this.calls.push({ method: "plot", id, data, layout, config });
    },
    purge(id) {
      this.calls.push({ method: "purge", id });
    },
  };

  h.element("_state");
  h.element("output_contract");
  h.element("output_contract_output");
  h.element("output_contract_output_msgs").attributes.type = "msgs";
  h.element("html_report").attributes.type = "div";
  h.element("plot_main").attributes.type = "plotly";
  h.element("progress_output").attributes.type = "progress";
  h.element("log_text").attributes.type = "textarea";

  ga.value.setLastValue("output_contract_output", "#html_report");
  ga.value.extra_resets("html_report");

  const firstPlot = {
    data: [{ x: [1], y: [2], type: "scatter" }],
    layout: { title: "First" },
    config: { responsive: true },
  };
  const ret = ga.data.update("output_contract", {
    html_report: "<b>ready</b>",
    progress_output: "0.75",
    plot_main: firstPlot,
    log_text: "first line",
    rogue_result: "not declared",
    _status: "complete",
  });

  assert(ret.job_status === "complete", "status result should be returned");
  assert(h.context.__syncStateCalled === true, "state-changing metadata should call syncState");
  assert(h.element("html_report").html === "<b>ready</b>", "html output should route through div handler");
  assert(h.element("progress_output").value === "0.75", "progress-like output should receive value");
  assert(h.element("log_text").value === "first line", "textarea output should receive value");
  assert(h.context.Plotly.calls.length === 1, "plotly output should call Plotly once");
  assert(h.context.Plotly.calls[0].id === "plot_main", "plotly output should target declared id");
  assert(h.context.Plotly.calls[0].data === firstPlot.data, "plotly output should receive declared data");
  assert(
    h.element("output_contract_output_msgs").html.includes("Unexpected results:") &&
      h.element("output_contract_output_msgs").html.includes("rogue_result => not declared"),
    "undeclared result keys should remain unexpected results"
  );

  ga.data.update("output_contract", {
    html_report: "<i>updated</i>",
    log_text: "second line",
  });

  assert(h.element("html_report").html === "<i>updated</i>", "partial update should update existing html output");
  assert(h.element("log_text").value === "second line", "partial update should update existing textarea output");
  assert(h.element("output_contract_output_msgs").html === "", "declared-only update should clear previous unexpected output");

  ga.value.resetDefaultValues("output_contract_output", false);
  assert(h.element("html_report").html === "", "reset should restore html output default");
  assert(
    $("#global_data").data("output_contract_output:#html_report:last_value") === "",
    "reset should update html output last-value storage"
  );
}

const command = process.argv[2];
const gaPath = process.argv[3];

if (!command || !gaPath) {
  throw new Error("usage: node genapp_js_harness.js <command> <generated-ga.js>");
}

switch (command) {
  case "validation":
    runValidationScenario(gaPath);
    break;
  case "data-update":
    runDataUpdateScenario(gaPath);
    break;
  default:
    throw new Error(`unknown command '${command}'`);
}

console.log(`ok - ${command}`);
