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
        String(value).replace(/<[^>]*\sid="([^"]+)"[^>]*>/g, (match, childId) => {
          const child = element(childId);
          const type = match.match(/\stype="([^"]+)"/);
          if (type) {
            child.attributes.type = type[1];
          }
          return match;
        });
        return this;
      },
      remove() {
        delete elements[id];
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
      remove() { return this; },
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
  h.element("dynamic_html").attributes.type = "dynamicoutput";
  h.element("dynamic_plot").attributes.type = "dynamicoutput";

  ga.value.setLastValue("output_contract_output", "#html_report");
  ga.value.extra_resets("html_report");
  ga.dynamicOutput.register("output_contract", {
    id: "dynamic_html",
    type: "html",
    label: "Dynamic HTML",
    idprefix: "dyn_html",
    max: 3,
  });
  ga.dynamicOutput.register("output_contract", {
    id: "dynamic_plot",
    type: "plotly",
    label: "Dynamic Plot",
    idprefix: "dyn_plot",
    max: 2,
  });
  ga.value.extra_resets("dynamic_html");
  ga.value.extra_resets("dynamic_plot");

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

  ga.data.update("output_contract", {
    dynamic_html: {
      items: [
        { label: "First dynamic report", value: "<p>first</p>" },
        { id: "dyn_html_named", label: "Named dynamic report", value: "<p>named</p>" },
      ],
    },
    dynamic_plot: {
      items: [
        { value: { data: [{ x: [1], y: [1] }], layout: { title: "A" } } },
        { value: { data: [{ x: [2], y: [4] }], layout: { title: "B" } } },
        { value: { data: [{ x: [3], y: [9] }], layout: { title: "C" } } },
      ],
    },
  });

  assert(h.element("dyn_html_1").html === "<p>first</p>", "dynamic html output should create first generated id");
  assert(h.element("dyn_html_named").html === "<p>named</p>", "dynamic html output should honor safe explicit id");
  const newPlots = h.context.Plotly.calls.filter((call) => call.method === "newPlot");
  assert(newPlots.length === 3, "dynamic plotly output should route max-limited plot instances");
  assert(newPlots[1].id === "dyn_plot_1", "dynamic plotly output should create first generated plot id");
  assert(newPlots[2].id === "dyn_plot_2", "dynamic plotly output should create second generated plot id");
  assert(!h.elements.dyn_plot_3, "dynamic plotly output should not create instances past max");

  ga.data.update("output_contract", {
    dynamic_html: {
      items: [
        { label: "Only remaining report", value: "<p>remaining</p>" },
      ],
    },
  });
  assert(h.element("dyn_html_1").html === "<p>remaining</p>", "dynamic html replacement should update remaining instance");
  assert(!h.elements.dyn_html_named, "dynamic html replacement should remove stale explicit instance");

  ga.value.resetDefaultValues("output_contract_output", false);
  assert(h.element("html_report").html === "", "reset should restore html output default");
  assert(
    $("#global_data").data("output_contract_output:#html_report:last_value") === "",
    "reset should update html output last-value storage"
  );
  assert(!h.elements.dyn_html_1, "reset should remove dynamic html instances");
  assert(!h.elements.dyn_plot_1, "reset should remove dynamic plot instances");
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
