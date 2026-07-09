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
        children: [],
        defaultValue: "",
        handlers: {},
        html: "",
        id,
        name: "",
        nodeName: "DIV",
        parentId: null,
        style: { display: "block" },
        type: "",
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
      ele.getElementsByTagName = function getElementsByTagName(tagName) {
        const requested = String(tagName).toUpperCase();
        return descendantsOf(ele.id).filter((child) => child.nodeName === requested);
      };
      ele.querySelectorAll = function querySelectorAll(selector) {
        const requested = String(selector).toUpperCase();
        if (/^[A-Z0-9_:-]+$/.test(requested)) {
          return descendantsOf(ele.id).filter((child) => child.nodeName === requested);
        }
        return [];
      };
      ele.addEventListener = function addEventListener(event, cb) {
        ele.handlers[event] = { cb };
      };
      elements[id] = ele;
    }
    return elements[id];
  }

  function descendantsOf(parentId) {
    const found = [];
    Object.keys(elements).forEach((id) => {
      let current = elements[id];
      while (current && current.parentId) {
        if (current.parentId === parentId) {
          found.push(elements[id]);
          return;
        }
        current = elements[current.parentId];
      }
    });
    return found;
  }

  function deleteDescendants(parentId) {
    descendantsOf(parentId).forEach((child) => {
      delete elements[child.id];
    });
    if (elements[parentId]) {
      elements[parentId].children = [];
    }
  }

  function parseAttributes(markup) {
    const attrs = {};
    const body = String(markup).replace(/^<\s*[A-Za-z0-9_:-]+/, "").replace(/\/?>$/, "");
    body.replace(/([A-Za-z0-9_:-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g, (match, name, doubleQuoted, singleQuoted, bare) => {
      attrs[name] = doubleQuoted !== undefined ? doubleQuoted : singleQuoted !== undefined ? singleQuoted : bare !== undefined ? bare : true;
      return match;
    });
    return attrs;
  }

  function parseMarkup(markup, parentId, replaceChildren) {
    const parent = parentId ? element(parentId) : null;
    if (parent && replaceChildren) {
      descendantsOf(parentId).forEach((child) => {
        child.parentId = null;
      });
      parent.children = [];
    }
    String(markup).replace(/<\s*([A-Za-z0-9_:-]+)([^>]*)>/g, (match, tagName) => {
      if (/^\/|^!/.test(tagName)) {
        return match;
      }
      const attrs = parseAttributes(match);
      if (!attrs.id) {
        return match;
      }
      const child = element(attrs.id);
      child.nodeName = String(tagName).toUpperCase();
      child.attributes = {};
      Object.keys(attrs).forEach((name) => {
        if (name !== "id") {
          child.attributes[name] = attrs[name];
        }
      });
      child.name = attrs.name || "";
      child.type = attrs.type || "";
      child.value = attrs.value !== undefined && attrs.value !== true ? attrs.value : "";
      child.checked = attrs.checked !== undefined;
      child.required = attrs.required !== undefined;
      child.parentId = parentId || null;
      if (parent && !parent.children.includes(child.id)) {
        parent.children.push(child.id);
      }
      return match;
    });
  }

  function inputElementsUnder(id) {
    return descendantsOf(id).filter((child) => ["INPUT", "SELECT", "TEXTAREA", "BUTTON"].includes(child.nodeName));
  }

  function collectionWrapper(items) {
    const list = items.filter(Boolean);
    return {
      length: list.length,
      each(cb) {
        list.forEach((ele, index) => cb.call(ele, index, ele));
        return this;
      },
      get(index) {
        if (arguments.length === 0) {
          return list.slice();
        }
        return list[index];
      },
      find(selector) {
        if (selector === ":input") {
          const inputs = [];
          list.forEach((ele) => {
            inputs.push(...inputElementsUnder(ele.id));
          });
          return collectionWrapper(inputs);
        }
        return emptyWrapper();
      },
    };
  }

  function wrapperFor(id) {
    const ele = element(id);
    return {
      length: 1,
      val(value) {
        if (arguments.length) {
          ele.value = Array.isArray(value) ? value.join(",") : value;
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
          parseMarkup(value, ele.id, true);
          return this;
        }
        return ele.html;
      },
      empty() {
        ele.html = "";
        deleteDescendants(ele.id);
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
        const child = value && typeof value.get === "function" ? value.get(0) : value;
        if (child && typeof child === "object" && child.id) {
          child.parentId = ele.id;
          if (!ele.children.includes(child.id)) {
            ele.children.push(child.id);
          }
          return this;
        }
        ele.html += value;
        parseMarkup(value, ele.id, false);
        return this;
      },
      remove() {
        delete elements[id];
        return this;
      },
      on(event, data, cb) {
        if (typeof data === "function") {
          cb = data;
          data = undefined;
        }
        if (!ele.handlers[event]) {
          ele.handlers[event] = [];
        }
        if (!Array.isArray(ele.handlers[event])) {
          ele.handlers[event] = [ele.handlers[event]];
        }
        ele.handlers[event].push({ data, cb });
        return this;
      },
      off() { return this; },
      bind(event, cb) {
        ele.handlers[event] = { cb };
        return this;
      },
      trigger(event) {
        Object.keys(ele.handlers).forEach((name) => {
          if (name !== event && !name.startsWith(`${event}.`)) {
            return;
          }
          const handlers = Array.isArray(ele.handlers[name]) ? ele.handlers[name] : [ele.handlers[name]];
          handlers.forEach((handler) => {
            if (handler && typeof handler.cb === "function") {
              handler.cb.call(ele, { data: handler.data, preventDefault() {} });
            }
          });
        });
        return this;
      },
      blur() { return this; },
      change(cb) {
        if (typeof cb === "function") {
          ele.handlers.change = { cb };
          return this;
        }
        return this.trigger("change");
      },
      keypress(cb) {
        if (typeof cb === "function") {
          ele.handlers.keypress = { cb };
        }
        return this;
      },
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
        if (selector === ":input") {
          return collectionWrapper(inputElementsUnder(id));
        }
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
        if (arguments.length === 0) {
          return [ele];
        }
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
      get() { return []; },
    };
  }

  function $(selector) {
    if (selector === global.document || selector === global.window) {
      return emptyWrapper();
    }
    if (typeof selector === "string" && selector.trim().startsWith("<")) {
      const attrs = parseAttributes(selector);
      const id = attrs.id || `created_${Object.keys(elements).length + 1}`;
      const tag = (selector.match(/^<\s*([A-Za-z0-9_:-]+)/) || [null, "div"])[1];
      const ele = element(id);
      ele.nodeName = tag.toUpperCase();
      ele.attributes = attrs;
      ele.type = ele.attributes.type || "";
      return wrapperFor(id);
    }
    if (selector && typeof selector === "object" && selector.id) {
      return wrapperFor(selector.id);
    }
    if (typeof selector !== "string") {
      return emptyWrapper();
    }
    const inputMatch = selector.match(/^#([^ ]+)\s+:input$/);
    if (inputMatch) {
      return elements[inputMatch[1]] ? collectionWrapper(inputElementsUnder(inputMatch[1])) : emptyWrapper();
    }
    if (selector.startsWith("#") && !selector.includes(" ")) {
      return wrapperFor(selector.slice(1));
    }
    return emptyWrapper();
  }

  $.each = function each(obj, cb) {
    Object.keys(obj || {}).forEach((key) => cb.call(obj[key], key, obj[key]));
  };
  $.extend = function extend() {
    const args = Array.from(arguments);
    const deep = args[0] === true;
    const target = deep ? args[1] || {} : args[0] || {};
    const sources = deep ? args.slice(2) : args.slice(1);
    sources.forEach((source) => {
      Object.keys(source || {}).forEach((key) => {
        const value = source[key];
        if (deep && value && typeof value === "object" && !Array.isArray(value)) {
          target[key] = $.extend(true, target[key] || {}, value);
        } else if (deep && Array.isArray(value)) {
          target[key] = value.map((item) => (item && typeof item === "object" ? $.extend(true, Array.isArray(item) ? [] : {}, item) : item));
        } else {
          target[key] = value;
        }
      });
    });
    return target;
  };
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
      body: element("body"),
      getElementById(id) {
        return element(id);
      },
      styleSheets: [],
    },
    window: {
      getComputedStyle() {
        return { backgroundColor: "", getPropertyValue() { return ""; } };
      },
      location: { search: "" },
      name: "test_window",
    },
    setTimeout,
    clearTimeout,
  };
  context.global = context;

  return { context, element, elements, parseMarkup };
}

function loadGeneratedGa(gaPath, moduleHtmlPath) {
  const harness = createDomHarness();
  const source = fs.readFileSync(gaPath, "utf8");
  vm.createContext(harness.context);
  vm.runInContext(source, harness.context, { filename: gaPath });
  harness.context.ga.color = harness.context.ga.color || {};
  harness.context.ga.color.data = harness.context.ga.color.data || {};
  harness.context.ga.color.data.body = harness.context.ga.color.data.body || { background: "" };
  if (moduleHtmlPath) {
    loadGeneratedModule(harness, moduleHtmlPath);
  }
  return harness;
}

function loadGeneratedModule(harness, moduleHtmlPath) {
  const html = fs.readFileSync(moduleHtmlPath, "utf8");
  harness.parseMarkup(html, null);
  html.replace(/<form[^>]*id="([^"]+)"/gi, (match, formId) => {
    const inputAreaId = `${formId}_input_area`;
    if (harness.elements[inputAreaId]) {
      harness.elements[inputAreaId].parentId = formId;
    }
    return match;
  });

  const scripts = [];
  html.replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, (match, script) => {
    scripts.push(script);
    return match;
  });
  scripts.forEach((script, index) => {
    vm.runInContext(script, harness.context, { filename: `${moduleHtmlPath}:script${index + 1}` });
  });
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

  const projectNameMessage = "Project names may contain only letters, numbers, and underscores. Dashes are not allowed; use an underscore instead.";
  h.element("project_name").value = "my-project";
  h.element("project_name").attributes.pattern = "^[a-zA-Z0-9_]+$";
  h.element("project_name").attributes["data-pattern-message"] = projectNameMessage;
  h.element("project_name").required = true;
  assert(ga.valid.checkText("#project_name") === 0, "custom text pattern mismatch should fail");
  assert(h.element("project_name_msg").html === projectNameMessage, "custom text pattern message should be set");

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
    h.element(id).html = `ngl:${value.loadname || value.file || value}`;
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
  assert(h.element("dynamic_plot").visible === false, "dynamic groups should be hidden until they receive items");

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
  h.context.Plotly.calls = [];
  $("#global_data").data("output_contract_output:#plot_main:last_value", firstPlot);
  ga.value.setLastValue("output_contract_output", "#plot_main");
  const restoredPlot = h.context.Plotly.calls.find((call) => call.method === "plot" && call.id === "plot_main");
  assert(restoredPlot, "plotly restore should replot saved output");
  assert(restoredPlot.config === firstPlot.config, "plotly restore should pass saved config");
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
        { value: { loadname: "model.pdb", loadparams: { ext: "pdb" }, representation: "cartoon" } },
      ],
    },
    dynamic_structure: {
      items: [
        { value: { file: "structure.pdb", script: "cartoons on" } },
      ],
    },
  });

  assert(h.element("dyn_html_1").html === "<p>first</p>", "dynamic html output should create first generated id");
  assert(h.element("dynamic_plot").visible === true, "dynamic group should become visible after non-empty update");
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
  assert(
    ga.ngl.calls.some(
      (call) =>
        call.method === "show" &&
        call.id === "dyn_ngl_1" &&
        call.value.loadname === "model.pdb" &&
        call.value.loadparams.ext === "pdb" &&
        call.value.representation === "cartoon"
    ),
    "dynamic ngl output should route canonical NGL payload to ngl renderer"
  );
  assert(h.elements.dyn_ngl_1_plot, "dynamic ngl output should create plot helper div");
  assert(h.elements.dyn_ngl_1_buttons, "dynamic ngl output should create button helper div");
  assert(h.element("dyn_ngl_1_plot").attributes.style === "width:300px;height:200px;", "dynamic ngl plot helper should preserve trusted size");
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
  assert(h.elements.dyn_plot_1, "omitted dynamic group should preserve existing instances");

  ga.data.update("output_contract", {
    dynamic_plot: {
      items: [],
    },
  });
  assert(!h.elements.dyn_plot_1, "empty dynamic items should clear existing instances");
  assert(h.element("dynamic_plot").visible === false, "empty dynamic items should hide the group");

  delete h.elements.dynamic_image;
  ga.data.update("output_contract", {
    dynamic_image: {
      items: [
        { value: "hidden.png" },
      ],
    },
  });
  assert(h.element("output_contract_output_msgs").html === "", "inactive declared dynamic output should not become unexpected output");

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

function runNglRepresentationScenario(gaPath) {
  const h = loadGeneratedGa(gaPath);
  const ga = h.context.ga;
  const calls = [];

  function makeComponent() {
    return {
      addRepresentation(type, params) {
        const rep = { type, params };
        calls.push({ method: "addRepresentation", type, params });
        return rep;
      },
      removeRepresentation(rep) {
        calls.push({ method: "removeRepresentation", rep });
      },
      autoView() {
        calls.push({ method: "autoView" });
      },
    };
  }

  h.context.NGL = {
    Stage: function Stage(id) {
      calls.push({ method: "stage", id });
      this.loadFile = function loadFile(loadname, loadparams) {
        calls.push({ method: "loadFile", loadname, loadparams });
        return {
          then(cb) {
            cb(makeComponent());
          },
        };
      };
      this.dispose = function dispose() {
        calls.push({ method: "dispose", id });
      };
    },
  };

  h.element("structure_ngl").attributes.type = "ngl";
  h.element("structure_ngl_plot");
  h.element("structure_ngl_buttons");

  ga.value.nglshow("module_output", "structure_ngl", {
    loadname: "run_0/monomer_monte_carlo/monomer_monte_carlo_colored_movie.pdb",
    loadparams: { ext: "pdb", asTrajectory: true },
    representation: "cartoon",
    representationParams: { colorScheme: "bfactor" },
  });

  assert(calls.some((call) => call.method === "stage" && call.id === "structure_ngl_plot"), "ngl show should create a stage for the plot div");
  assert(
    calls.some(
      (call) =>
        call.method === "loadFile" &&
        call.loadname === "run_0/monomer_monte_carlo/monomer_monte_carlo_colored_movie.pdb" &&
        call.loadparams.ext === "pdb" &&
        call.loadparams.asTrajectory === true
    ),
    "ngl show should pass load params to NGL loadFile"
  );
  assert(
    calls.some(
      (call) =>
        call.method === "addRepresentation" &&
        call.type === "cartoon" &&
        call.params.colorScheme === "bfactor"
    ),
    "ngl show should pass single representationParams to addRepresentation"
  );
  assert(ga.ngl["module_output:#structure_ngl:last_value"].reps.cartoon, "single ngl representation should keep the legacy representation key");
  assert(h.elements.structure_ngl_buttons.children.length === ga.ngl.types.length, "single ngl representation should keep the generic representation buttons");
  assert(h.elements.cartoon, "single ngl representation should keep the legacy cartoon button id");

  calls.length = 0;
  ga.value.nglshow("module_output", "structure_ngl", {
    loadname: "run_0/monomer_monte_carlo/monomer_monte_carlo_colored_movie.pdb",
    representation: "cartoon",
    representationParams: { sele: "protein", colorScheme: "bfactor" },
  });
  const selectedSaveKey = ga.ngl["module_output:#structure_ngl:last_value"];
  assert(selectedSaveKey.reps.cartoon, "single selected ngl representation should still use the generic cartoon key");
  assert(!selectedSaveKey.reps["cartoon:protein:0"], "single selected ngl representation should not use layered selection keys");
  calls.length = 0;
  h.context.$("#cartoon").trigger("click");
  assert(calls.some((call) => call.method === "removeRepresentation" && call.rep.params.sele === "protein"), "legacy cartoon button should remove the initial selected representation");
  assert(!selectedSaveKey.reps.cartoon, "legacy cartoon button should clear the generic representation handle");

  calls.length = 0;
  ga.value.nglshow("module_output", "structure_ngl", {
    loadname: "run_0/monomer_monte_carlo/monomer_monte_carlo_colored_movie.pdb",
    loadparams: { ext: "pdb", asTrajectory: true },
    representations: [
      { name: "reference ribbon", type: "cartoon", params: { sele: "all", color: "blue" } },
      { name: "reference alignment basis", type: "cartoon", params: { sele: "bfactor > 0.5", color: "red" } },
    ],
  });

  const added = calls.filter((call) => call.method === "addRepresentation");
  assert(added.length === 2, "ngl show should add all requested representations");
  assert(added[0].type === "cartoon" && added[0].params.sele === "all" && added[0].params.color === "blue", "ngl show should pass first selection-specific representation");
  assert(added[1].type === "cartoon" && added[1].params.sele === "bfactor > 0.5" && added[1].params.color === "red", "ngl show should pass second selection-specific representation");
  assert(calls.some((call) => call.method === "dispose"), "ngl show should dispose the previous stage before reloading");
  assert(ga.ngl["module_output:#structure_ngl:last_value"].reps["cartoon:all:0"], "ngl show should retain the first representation handle");
  assert(ga.ngl["module_output:#structure_ngl:last_value"].reps["cartoon:bfactor > 0.5:1"], "ngl show should retain the second representation handle");
  const layerButtons = h.elements.structure_ngl_buttons.children.map((id) => h.elements[id]);
  assert(layerButtons.length === 2, "layered ngl representations should replace generic buttons with named layer buttons");
  assert(layerButtons[0].html === "reference ribbon", "first layered ngl button should use the representation name");
  assert(layerButtons[1].html === "reference alignment basis", "second layered ngl button should use the representation name");
  calls.length = 0;
  h.context.$(`#${layerButtons[1].id}`).trigger("click");
  assert(calls.some((call) => call.method === "removeRepresentation" && call.rep.type === "cartoon" && call.rep.params.color === "red"), "layered ngl button should remove only the selected representation");
  assert(!ga.ngl["module_output:#structure_ngl:last_value"].reps["cartoon:bfactor > 0.5:1"], "layered ngl button should clear the selected representation handle");
}

function setupCalcDrivenIntegerpairReplay(h) {
  const ga = h.context.ga;
  const mod = "calc_replay";

  h.parseMarkup(
    [
      '<form id="calc_replay">',
      '<input type="number" id="pair_rows" name="pair_rows" value="2">',
      '<input type="number" id="pair_cols" name="pair_cols" value="2">',
      '<input type="text" id="pair_rows-row_label-0" name="pair_rows-row_label-0" value="default row 1">',
      '<input type="text" id="pair_rows-row_label-1" name="pair_rows-row_label-1" value="default row 2">',
      '<input type="text" id="pair_rows-row_label-2" name="pair_rows-row_label-2" value="default row 3">',
      '<input type="text" id="pair_cols-column_label-0" name="pair_cols-column_label-0" value="default column 1">',
      '<input type="text" id="pair_cols-column_label-1" name="pair_cols-column_label-1" value="default column 2">',
      '<input type="text" id="pair_grid" name="pair_grid" value="2,2">',
      '<div id="ga-repeater-pair_grid"></div>',
      '</form>',
    ].join(""),
    null
  );
  [
    "pair_rows",
    "pair_cols",
    "pair_rows-row_label-0",
    "pair_rows-row_label-1",
    "pair_rows-row_label-2",
    "pair_cols-column_label-0",
    "pair_cols-column_label-1",
    "pair_grid",
    "ga-repeater-pair_grid",
  ].forEach((id) => {
    h.elements[id].parentId = mod;
  });

  ga.layout.modules[mod] = {
    fields: {
      pair_grid: {},
      pair_payload: {},
    },
    json: {
      pair_rows: { id: "pair_rows", type: "integer" },
      pair_cols: { id: "pair_cols", type: "integer" },
      row_label: { id: "row_label", type: "text", repeat: "pair_rows" },
      column_label: { id: "column_label", type: "text", repeat: "pair_cols" },
      pair_grid: {
        id: "pair_grid",
        type: "integerpair",
        calc: "pair_rows,pair_cols",
        repeater: "true",
        headers: {
          corner: "row / column",
          row: ["row_label"],
          column: ["column_label"],
        },
      },
      pair_payload: { id: "pair_payload", type: "text", repeat: "pair_grid" },
    },
  };

  ga.repeat.data[mod] = { repeat: {}, repeater: {} };
  ga.repeat.data[mod].repeat.pair_payload = {
    lhtmlr: '<label for="%%id%%">%%label%%</label>',
    lhtmlrg: '<label id="%%id%%" style="grid-column:%%gridcol%%">%%label%%</label>',
    lhtmls: '<label>Pair Payload</label>',
    dhtmlr: '<input type="text" id="%%id%%" name="%%id%%" value="">',
    dhtmlrg: '<input type="text" id="%%id%%" name="%%id%%" value="" style="grid-column:%%gridcol%%">',
    evalr: "",
  };

  ga.repeat.repeater(mod, "pair_grid", "integerpair", "false");
  ga.repeat.repeatOn(mod, "pair_payload", "pair_grid");
  ga.calc.register(mod, "pair_grid", "pair_rows,pair_cols");
  ga.repeat.change(mod, "pair_grid", true);
}

function runRepeaterReplayScenario(gaPath, moduleHtmlPath) {
  const h = loadGeneratedGa(gaPath, moduleHtmlPath);
  const ga = h.context.ga;

  ga.valuen.input("repeat_demo", {
    row_count: "3",
    "row_count-row_label-0": "alpha",
    "row_count-row_label-1": "beta",
    "row_count-row_label-2": "gamma",
  });

  assert(h.element("row_count").value === "3", "integer repeater count should be restored");
  assert(h.element("row_count-row_label-0").value === "alpha", "first repeated text input should be restored");
  assert(h.element("row_count-row_label-1").value === "beta", "second repeated text input should be restored");
  assert(h.element("row_count-row_label-2").value === "gamma", "third repeated text input should be restored");

  setupCalcDrivenIntegerpairReplay(h);
  ga.valuen.input("calc_replay", {
    pair_rows: "3",
    pair_cols: "2",
    "pair_rows-row_label-0": "sample A",
    "pair_rows-row_label-1": "sample B",
    "pair_rows-row_label-2": "sample C",
    "pair_cols-column_label-0": "component alpha",
    "pair_cols-column_label-1": "component beta",
    "pair_grid-pair_payload-0-0": "r1c1",
    "pair_grid-pair_payload-0-1": "r1c2",
    "pair_grid-pair_payload-1-0": "r2c1",
    "pair_grid-pair_payload-1-1": "r2c2",
    "pair_grid-pair_payload-2-0": "r3c1",
    "pair_grid-pair_payload-2-1": "r3c2",
  });

  assert(h.element("pair_grid").value === "3,2", "calc-driven integerpair repeater should be recomputed");
  assert(h.element("pair_grid-pair_payload-0-0").value === "r1c1", "first matrix value should be restored");
  assert(h.element("pair_grid-pair_payload-0-1").value === "r1c2", "second matrix value should be restored");
  assert(h.element("pair_grid-pair_payload-1-0").value === "r2c1", "third matrix value should be restored");
  assert(h.element("pair_grid-pair_payload-1-1").value === "r2c2", "fourth matrix value should be restored");
  assert(h.element("pair_grid-pair_payload-2-0").value === "r3c1", "new matrix row first value should be restored");
  assert(h.element("pair_grid-pair_payload-2-1").value === "r3c2", "new matrix row second value should be restored");
  assert(h.element("pair_grid-pair_payload-colh-0-0").html === "component alpha", "first matrix column header should use restored label source value");
  assert(h.element("pair_grid-pair_payload-colh-0-1").html === "component beta", "second matrix column header should use restored label source value");
  assert(h.element("pair_grid-pair_payload-rowh-0-2").html === "sample A", "first matrix row header should use restored label source value");
  assert(h.element("pair_grid-pair_payload-rowh-1-2").html === "sample B", "second matrix row header should use restored label source value");
  assert(h.element("pair_grid-pair_payload-rowh-2-2").html === "sample C", "third matrix row header should use restored label source value");
}

function runModuleSwitchReplayScenario(gaPath, moduleHtmlPath) {
  const first = loadGeneratedGa(gaPath, moduleHtmlPath);
  const firstGa = first.context.ga;
  const saved = {};
  let second;
  let secondGa;

  first.element("row_count").value = "3";
  firstGa.repeat.change("repeat_demo", "row_count", true);
  first.element("row_count-row_label-0").value = "alpha";
  first.element("row_count-row_label-1").value = "beta";
  first.element("row_count-row_label-2").value = "gamma";
  firstGa.valuen.save("repeat_demo");

  saved.data = JSON.parse(JSON.stringify(firstGa.valuen.data));
  saved.html = JSON.parse(JSON.stringify(firstGa.valuen.html));

  second = loadGeneratedGa(gaPath, moduleHtmlPath);
  secondGa = second.context.ga;
  secondGa.valuen.data = JSON.parse(JSON.stringify(saved.data));
  secondGa.valuen.html = JSON.parse(JSON.stringify(saved.html));

  secondGa.valuen.save("repeat_demo", true);
  secondGa.valuen.restore("repeat_demo");

  assert(second.element("row_count").value === "3", "module restore should keep repeater controller value in sync");
  assert(second.element("row_count-row_label-0").value === "alpha", "module restore should rebuild first repeated field");
  assert(second.element("row_count-row_label-1").value === "beta", "module restore should rebuild second repeated field");
  assert(second.element("row_count-row_label-2").value === "gamma", "module restore should rebuild third repeated field");
}

function runRepeatConditionScenario(gaPath, moduleHtmlPath) {
  const h = loadGeneratedGa(gaPath, moduleHtmlPath);
  const ga = h.context.ga;
  const $ = h.context.$;
  let processAllCalls = 0;
  ga.calc.processall = function processall() {
    processAllCalls += 1;
  };
  const attachedId = (id) => {
    const mapped = ga.repeat && ga.repeat.map ? ga.repeat.map[id] : null;
    if (mapped && Object.prototype.hasOwnProperty.call(h.elements, mapped) && h.elements[mapped].parentId !== null) {
      return mapped;
    }
    if (Object.prototype.hasOwnProperty.call(h.elements, id) && h.elements[id].parentId !== null) {
      return id;
    }
    return null;
  };
  const hasAttached = (id) => attachedId(id) !== null;
  const field = (id) => h.element(attachedId(id) || id);
  const triggerField = (id, event) => {
    const rendered = attachedId(id) || id;
    $(`#${rendered}`).trigger(event);
  };

  assert(hasAttached("prediction_q"), "inverse condition field should be visible when experimental mode is off");
  assert(!hasAttached("neutron_exp_file"), "neutron file should be hidden until both experimental and neutron are active");
  assert(!hasAttached("xray_exp_file"), "x-ray file should be hidden until both experimental and x-ray are active");
  assert(!hasAttached("experimental_file_type"), "file type chooser should be hidden until experimental mode is active");
  assert(!hasAttached("experimental_interpolation_method"), "interpolation method should be hidden until reduced data is selected");

  field("prediction_q").value = "0.25";
  ga.valuen.save("repeater_contract");
  assert(ga.valuen.data.repeater_contract.prediction_q[0] === "0.25", "visible inverse condition field should submit with its original id");

  let callsBefore = processAllCalls;
  $("#use_experimental_data").prop("checked", true).trigger("change");
  assert(processAllCalls - callsBefore === 1, "experimental checkbox should trigger one processall refresh");
  assert(!hasAttached("prediction_q"), "inverse condition field should hide when experimental mode is active");
  assert(!hasAttached("neutron_exp_file"), "neutron file should still wait for neutron checkbox");
  assert(hasAttached("experimental_file_type"), "file type chooser should appear when experimental mode is active");
  assert(!hasAttached("experimental_interpolation_method"), "interpolation method should wait for reduced file type");

  callsBefore = processAllCalls;
  field("experimental_file_type").value = "reduced_experimental";
  triggerField("experimental_file_type", "change");
  assert(processAllCalls - callsBefore === 1, "nested file type listbox should trigger one processall refresh");
  assert(hasAttached("experimental_interpolation_method"), "compound condition should notice a late-created listbox dependency");
  field("experimental_interpolation_method").value = "linear_I";
  ga.valuen.save("repeater_contract");
  assert(ga.valuen.data.repeater_contract.experimental_interpolation_method[0] === "linear_I", "late-created listbox condition field should submit with its original id");

  field("experimental_file_type").value = "sassie_interpolated";
  triggerField("experimental_file_type", "change");
  assert(!hasAttached("experimental_interpolation_method"), "interpolation method should hide again when reduced file type is cleared");

  $("#neutron_checkbox").prop("checked", true).trigger("change");
  assert(hasAttached("neutron_exp_file"), "compound neutron condition should show when both checkboxes are active");
  field("neutron_exp_file").value = "neutron_loaded.dat";
  ga.valuen.save("repeater_contract");
  assert(ga.valuen.data.repeater_contract.neutron_exp_file[0] === "neutron_loaded.dat", "compound condition field should submit with its original id");

  $("#xray_checkbox").prop("checked", true).trigger("change");
  assert(hasAttached("xray_exp_file"), "compound x-ray condition should show when both checkboxes are active");

  $("#use_experimental_data").prop("checked", false).trigger("change");
  assert(hasAttached("prediction_q"), "prediction field should return when experimental mode is disabled");
  assert(!hasAttached("neutron_exp_file"), "neutron file should hide when experimental mode is disabled");
  assert(!hasAttached("xray_exp_file"), "x-ray file should hide when experimental mode is disabled");

  ga.valuen.input("repeater_contract", {
    use_experimental_data: [""],
    experimental_file_type: ["reduced_experimental"],
    experimental_interpolation_method: ["pchip_logI"],
    neutron_checkbox: [""],
    neutron_exp_file: ["restored_neutron.dat"],
  });
  assert(h.element("use_experimental_data").checked === true, "input replay should restore experimental checkbox");
  assert(h.element("neutron_checkbox").checked === true, "input replay should restore neutron checkbox");
  assert(hasAttached("experimental_interpolation_method"), "input replay should show late-created listbox condition field");
  assert(field("experimental_interpolation_method").value === "pchip_logI", "input replay should restore late-created listbox condition value");
  assert(hasAttached("neutron_exp_file"), "input replay should show compound condition field after restoring dependencies");
  assert(field("neutron_exp_file").value === "restored_neutron.dat", "input replay should restore compound condition field value");
}

const command = process.argv[2];
const gaPath = process.argv[3];
const moduleHtmlPath = process.argv[4];

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
  case "ngl-representations":
    runNglRepresentationScenario(gaPath);
    break;
  case "repeater-replay":
    if (!moduleHtmlPath) {
      throw new Error("repeater-replay requires generated module HTML path");
    }
    runRepeaterReplayScenario(gaPath, moduleHtmlPath);
    break;
  case "module-switch-replay":
    if (!moduleHtmlPath) {
      throw new Error("module-switch-replay requires generated module HTML path");
    }
    runModuleSwitchReplayScenario(gaPath, moduleHtmlPath);
    break;
  case "repeat-condition":
    if (!moduleHtmlPath) {
      throw new Error("repeat-condition requires generated module HTML path");
    }
    runRepeatConditionScenario(gaPath, moduleHtmlPath);
    break;
  default:
    throw new Error(`unknown command '${command}'`);
}

console.log(`ok - ${command}`);
