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
      const ele = {
        attributes: {},
        checked: false,
        defaultValue: "",
        handlers: {},
        html: "",
        id,
        style: { display: "block" },
        value: "",
        visible: true,
      };
      Object.defineProperty(ele, "innerHTML", {
        get() {
          return ele.html;
        },
        set(value) {
          ele.html = value;
        },
      });
      elements[id] = ele;
    }
    return elements[id];
  }

  function parseAttributes(markup) {
    const attrs = {};
    String(markup).replace(/([A-Za-z0-9_:-]+)="([^"]*)"/g, (match, name, value) => {
      attrs[name] = value;
      return match;
    });
    return attrs;
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
          const attrs = parseAttributes(match);
          Object.keys(attrs).forEach((name) => {
            if (name === "style") {
              child.attributes.style = attrs[name];
            } else if (name !== "id") {
              child.attributes[name] = attrs[name];
            }
          });
          return match;
        });
        return this;
      },
      remove() {
        delete elements[id];
        return this;
      },
      on(event, data, cb) {
        ele.handlers[event] = { data, cb };
        return this;
      },
      off() { return this; },
      bind(event, cb) {
        ele.handlers[event] = { cb };
        return this;
      },
      trigger(event) {
        if (ele.handlers[event] && typeof ele.handlers[event].cb === "function") {
          ele.handlers[event].cb.call(ele, { data: ele.handlers[event].data, preventDefault() {} });
        }
        return this;
      },
      blur() { return this; },
      change() { return this; },
      keypress() { return this; },
      click(cb) {
        if (typeof cb === "function") {
          ele.handlers.click = { cb };
        } else if (ele.handlers.click && typeof ele.handlers.click.cb === "function") {
          ele.handlers.click.cb.call(ele);
        }
        return this;
      },
      css(name, value) {
        if (typeof name === "object") {
          Object.assign(ele.style, name);
          return this;
        }
        if (arguments.length > 1) {
          ele.style[name] = value;
          return this;
        }
        return ele.style[name] || "0";
      },
      height(value) {
        if (arguments.length) {
          ele.height = value;
          return this;
        }
        return ele.height || 0;
      },
      scrollTop(value) {
        if (arguments.length) {
          ele.scrollTopValue = value;
          return this;
        }
        return ele.scrollTopValue || 0;
      },
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
      get(index) {
        return index === 0 ? ele : undefined;
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
      bind() { return this; },
      trigger() { return this; },
      blur() { return this; },
      change() { return this; },
      keypress() { return this; },
      click() { return this; },
      css() { return undefined; },
      height() { return 0; },
      scrollTop() { return this; },
      each() { return this; },
      find() { return this; },
      text() { return undefined; },
      get() { return undefined; },
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
  h.context.Jmol = {
    calls: [],
    getAppletHtml(name, info) {
      this.calls.push({ name, info });
      return `<jmol name="${name}"></jmol>`;
    },
  };
  ga.bokeh = {
    calls: [],
    render(mod, id, value) {
      this.calls.push({ method: "render", mod, id, value });
      h.element(id).html = `bokeh:${value}`;
    },
    renderdata(pkg, id) {
      this.calls.push({ method: "renderdata", pkg, id });
    },
    reset(pkg, id) {
      this.calls.push({ method: "reset", pkg, id });
      if (h.elements[id]) {
        h.elements[id].html = "";
      }
    },
  };
  ga.ngl = {
    calls: [],
    clear(key, tag) {
      this.calls.push({ method: "clear", key, tag });
      const id = String(tag).replace(/^#/, "");
      if (h.elements[id]) {
        h.elements[id].html = "";
      }
    },
  };
  ga.value.nglshow = function nglshow(pkg, id, value) {
    ga.ngl.calls.push({ method: "show", pkg, id, value });
    h.element(id).html = `ngl:${value.file || value}`;
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
  h.element("dynamic_image").attributes.type = "dynamicoutput";
  h.element("dynamic_video").attributes.type = "dynamicoutput";
  h.element("dynamic_files").attributes.type = "dynamicoutput";
  h.element("dynamic_textarea").attributes.type = "dynamicoutput";
  h.element("dynamic_number").attributes.type = "dynamicoutput";
  h.element("dynamic_progress").attributes.type = "dynamicoutput";
  h.element("dynamic_plot2d").attributes.type = "dynamicoutput";
  h.element("dynamic_bokeh").attributes.type = "dynamicoutput";
  h.element("dynamic_matplotlib").attributes.type = "dynamicoutput";
  h.element("dynamic_plot3d").attributes.type = "dynamicoutput";
  h.element("dynamic_ngl").attributes.type = "dynamicoutput";
  h.element("dynamic_structure").attributes.type = "dynamicoutput";

  ga.value.setLastValue("output_contract_output", "#html_report");
  ga.value.extra_resets("html_report");
  function registerDynamic(config) {
    ga.dynamicOutput.register("output_contract", config);
    ga.value.extra_resets(config.id);
  }
  registerDynamic({ id: "dynamic_html", type: "html", label: "Dynamic HTML", idprefix: "dyn_html", max: 3 });
  registerDynamic({ id: "dynamic_plot", type: "plotly", label: "Dynamic Plot", idprefix: "dyn_plot", max: 2 });
  registerDynamic({ id: "dynamic_image", type: "image", label: "Dynamic Image", idprefix: "dyn_image", max: 2, width: "160", height: "120" });
  registerDynamic({ id: "dynamic_video", type: "video", label: "Dynamic Video", idprefix: "dyn_video", max: 2, width: "320", height: "240" });
  registerDynamic({ id: "dynamic_files", type: "file", label: "Dynamic Files", idprefix: "dyn_file", max: 2, multiple: "true" });
  registerDynamic({ id: "dynamic_textarea", type: "textarea", label: "Dynamic Textarea", idprefix: "dyn_textarea", max: 2, append: "on", rows: "4", cols: "40" });
  registerDynamic({ id: "dynamic_number", type: "float", label: "Dynamic Number", idprefix: "dyn_number", max: 2 });
  registerDynamic({ id: "dynamic_progress", type: "progress", label: "Dynamic Progress", idprefix: "dyn_progress", max: 2, maxvalue: "1.0" });
  registerDynamic({ id: "dynamic_plot2d", type: "plot2d", label: "Dynamic Plot2D", idprefix: "dyn_plot2d", max: 2, width: "320px", height: "240px", savetofile: "true" });
  registerDynamic({ id: "dynamic_bokeh", type: "bokeh", label: "Dynamic Bokeh", idprefix: "dyn_bokeh", max: 2 });
  registerDynamic({ id: "dynamic_matplotlib", type: "matplotlib", label: "Dynamic Matplotlib", idprefix: "dyn_matplotlib", max: 2, width: "640", height: "480", border: "0" });
  registerDynamic({ id: "dynamic_plot3d", type: "plot3d", label: "Dynamic Plot3D", idprefix: "dyn_plot3d", max: 2 });
  registerDynamic({ id: "dynamic_ngl", type: "ngl", label: "Dynamic NGL", idprefix: "dyn_ngl", max: 2, width: "300px", height: "200px" });
  registerDynamic({ id: "dynamic_structure", type: "atomicstructure", label: "Dynamic Structure", idprefix: "dyn_structure", max: 2, width: "300", height: "200" });

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
    dynamic_image: {
      items: [
        { value: "first.png" },
      ],
    },
    dynamic_video: {
      items: [
        { value: "movie" },
      ],
    },
    dynamic_files: {
      items: [
        { value: ["a.dat", "b.dat"] },
      ],
    },
    dynamic_textarea: {
      items: [
        { value: "log one" },
      ],
    },
    dynamic_number: {
      items: [
        { value: "3.14" },
      ],
    },
    dynamic_progress: {
      items: [
        { value: "0.5" },
      ],
    },
    dynamic_plot2d: {
      items: [
        { value: { data: [[[1, 2]]], options: {} } },
      ],
    },
    dynamic_bokeh: {
      items: [
        { value: "bokeh payload" },
      ],
    },
    dynamic_matplotlib: {
      items: [
        { value: "plots/mpl.html" },
      ],
    },
    dynamic_plot3d: {
      items: [
        { value: { data: [{ x: [1], y: [2], z: [3] }], layout: { title: "3D" } } },
      ],
    },
    dynamic_ngl: {
      items: [
        { value: { file: "model.pdb" } },
      ],
    },
    dynamic_structure: {
      items: [
        { value: { file: "structure.pdb", script: "cartoons on" } },
      ],
    },
  });

  assert(h.element("dyn_html_1").html === "<p>first</p>", "dynamic html output should create first generated id");
  assert(h.element("dyn_html_named").html === "<p>named</p>", "dynamic html output should honor safe explicit id");
  const newPlots = h.context.Plotly.calls.filter((call) => call.method === "newPlot");
  assert(newPlots.some((call) => call.id === "dyn_plot_1"), "dynamic plotly output should create first generated plot id");
  assert(newPlots.some((call) => call.id === "dyn_plot_2"), "dynamic plotly output should create second generated plot id");
  assert(!h.elements.dyn_plot_3, "dynamic plotly output should not create instances past max");
  assert(h.element("dyn_image_1").html.includes('src="first.png"'), "dynamic image output should render image tag");
  assert(h.element("dyn_image_1").attributes["data-width"] === "160", "dynamic image should preserve trusted width");
  assert(h.element("dyn_video_1").html.includes("movie.mp4"), "dynamic video output should render video sources");
  assert(h.element("dyn_file_1_filelink").html.includes("a.dat") && h.element("dyn_file_1_filelink").html.includes("b.dat"), "dynamic file output should render multiple file links");
  assert(h.element("dyn_textarea_1").value === "log one", "dynamic textarea output should receive text value");
  assert(h.context.$("#global_data").data("_append:output_contract_output_dyn_textarea_1") === 1, "dynamic textarea should register append behavior");
  assert(h.element("dyn_number_1").value === "3.14", "dynamic scalar output should receive value");
  assert(h.element("dyn_progress_1").value === "0.5", "dynamic progress should receive value");
  assert(h.element("dyn_progress_1").style.width === "50%", "dynamic progress should register layout handler");
  const plot2dCalls = $.plot.calls.filter((call) => call.selector === "#dyn_plot2d_1");
  assert(plot2dCalls.length >= 1, "dynamic plot2d output should route to $.plot");
  assert(h.elements.dyn_plot2d_1_savetofile, "dynamic plot2d output should create save helper ids");
  assert(ga.bokeh.calls.some((call) => call.method === "render" && call.id === "dyn_bokeh_1"), "dynamic bokeh output should route to bokeh renderer");
  assert(h.element("dyn_matplotlib_1").attributes.src === "plots/mpl.html", "dynamic matplotlib output should update iframe src");
  assert(h.element("dyn_matplotlib_1").attributes.width === "640px", "dynamic matplotlib should preserve trusted width");
  assert(newPlots.some((call) => call.id === "dyn_plot3d_1"), "dynamic plot3d output should route to Plotly");
  assert(ga.ngl.calls.some((call) => call.method === "show" && call.id === "dyn_ngl_1"), "dynamic ngl output should route to ngl renderer");
  assert(h.context.Jmol.calls.some((call) => call.name === "jmolAppletdyn_structure_1"), "dynamic atomicstructure output should route to JSmol");

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
  assert(!h.elements.dyn_image_1, "reset should remove dynamic image instances");
  assert(!h.elements.dyn_file_1_filelink, "reset should remove dynamic file helper instances");
  assert(!h.elements.dyn_plot2d_1_savetofile, "reset should remove dynamic plot2d helper instances");
  assert(!h.elements.dyn_bokeh_1, "reset should remove dynamic bokeh instances");
  assert(!h.elements.dyn_matplotlib_1, "reset should remove dynamic matplotlib instances");
  assert(!h.elements.dyn_ngl_1_plot, "reset should remove dynamic ngl helper instances");
  assert(!h.context._jmol_info.dyn_structure_1, "reset should remove dynamic atomicstructure metadata");
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
