(function () {
  "use strict";

  var RCE = globalThis.ReactChartEditor || {};
  var React = RCE.React;
  var ReactDOM = RCE.ReactDOM;
  var Plotly = RCE.Plotly;
  var PlotlyEditor = RCE.PlotlyEditor;
  var DefaultEditor = RCE.DefaultEditor;

  if (!React || !ReactDOM || !Plotly || !PlotlyEditor || !DefaultEditor) {
    console.error("Missing expected ReactChartEditor globals", RCE);
    return;
  }

  var useState = React.useState;
  var useEffect = React.useEffect;

  function slugify(text) {
    if (!text) return "genapp_chart";
    var s = String(text)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
    return s || "genapp_chart";
  }

  function titleText(layout) {
    var t = layout && layout.title;
    if (!t) return null;
    return typeof t === "string" ? t : t.text;
  }

  function downloadBlob(filename, content, mime) {
    var blob = new Blob([content], { type: mime });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function csvCell(value) {
    if (value === undefined || value === null) return "";
    var s = typeof value === "object" ? JSON.stringify(value) : String(value);
    if (/[",\r\n]/.test(s)) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  // Exports every top-level array-valued field of each trace (x, y, z,
  // labels, values, text, etc.) as its own column, named
  // "<traceName>_<field>". Columns are padded with empty cells to the
  // length of the longest column.
  function figureToCSV(figure) {
    var traces = (figure && figure.data) || [];
    var usedNames = {};
    var columns = [];

    traces.forEach(function (trace, i) {
      var baseName = trace.name ? String(trace.name) : "trace" + i;
      if (usedNames[baseName]) {
        baseName = baseName + "_" + i;
      }
      usedNames[baseName] = true;

      Object.keys(trace).forEach(function (key) {
        var value = trace[key];
        if (Array.isArray(value)) {
          columns.push({ header: baseName + "_" + key, values: value });
        }
      });
    });

    var maxLen = columns.reduce(function (m, c) {
      return Math.max(m, c.values.length);
    }, 0);

    var lines = [columns.map(function (c) { return csvCell(c.header); }).join(",")];
    for (var r = 0; r < maxLen; r++) {
      lines.push(
        columns
          .map(function (c) { return r < c.values.length ? csvCell(c.values[r]) : ""; })
          .join(",")
      );
    }
    return lines.join("\r\n");
  }

  // Plotly can leave an axis with a zero-width range (range[0] === range[1])
  // and autorange:false after certain editor interactions, which renders as
  // a chart zoomed into nothing. Drop such ranges and let the axis autorange.
  function sanitizeLayout(layout) {
    var result = JSON.parse(JSON.stringify(layout || {}));
    Object.keys(result).forEach(function (key) {
      if (!/^[xy]axis\d*$/.test(key)) return;
      var axis = result[key];
      var range = axis && axis.range;
      if (Array.isArray(range) && range.length === 2 && range[0] === range[1]) {
        delete axis.range;
        axis.autorange = true;
      }
    });
    return result;
  }

  // Escapes non-ASCII characters as \uXXXX so the exported JSON round-trips
  // safely through GenApp's Perl decode_json pipeline, which chokes on
  // strings carrying Perl's internal UTF8 flag from a prior decode.
  function escapeNonAscii(str) {
    var out = "";
    for (var i = 0; i < str.length; i++) {
      var code = str.charCodeAt(i);
      if (code > 127) {
        out += "\\u" + ("000" + code.toString(16)).slice(-4);
      } else {
        out += str.charAt(i);
      }
    }
    return out;
  }

  // GenApp's plotly field JSON shape: top-level data/layout/config, rather
  // than separate variables.
  function figureToJSON(figure) {
    var json = JSON.stringify(
      {
        data: (figure && figure.data) || [],
        layout: sanitizeLayout(figure && figure.layout),
        config: (figure && figure.config) || {},
      },
      null,
      2
    );
    return escapeNonAscii(json);
  }

  function App() {
    var params = new URLSearchParams(window.location.search);
    var id = params.get("id");
    var initial = globalThis.GENAPP_INITIAL_FIGURE || { data: [], layout: {} };
    if (id) {
      var stored = localStorage.getItem(id);
      if (stored) {
        try {
          var parsed = JSON.parse(stored);
          initial = Object.assign({}, initial, parsed);
        } catch (err) {
          console.error("genapp chart editor: failed to parse stored figure", err);
        }
        localStorage.removeItem(id);
      }
    }

    var state = useState(initial);
    var figure = state[0];
    var setFigure = state[1];

    var dirtyState = useState(false);
    var dirty = dirtyState[0];
    var setDirty = dirtyState[1];

    useEffect(function () {
      function handleBeforeUnload(e) {
        if (!dirty) return;
        e.preventDefault();
        e.returnValue = "";
        return "";
      }
      window.addEventListener("beforeunload", handleBeforeUnload);
      return function () {
        window.removeEventListener("beforeunload", handleBeforeUnload);
      };
    }, [dirty]);

    function handleDownloadCSV() {
      downloadBlob(slugify(titleText(figure.layout)) + ".csv", figureToCSV(figure), "text/csv;charset=utf-8");
      setDirty(false);
    }

    function handleDownloadJSON() {
      downloadBlob(slugify(titleText(figure.layout)) + ".json", figureToJSON(figure), "application/json;charset=utf-8");
      setDirty(false);
    }

    var dirtyMarker = dirty ? " ●" : "";

    return React.createElement(
      "div",
      { style: { display: "flex", flexDirection: "column", height: "100%" } },
      React.createElement(
        "div",
        {
          style: {
            height: "45px",
            flex: "0 0 auto",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "0 8px",
            borderBottom: "1px solid #ddd",
            boxSizing: "border-box",
          },
        },
        React.createElement("button", { onClick: handleDownloadCSV }, "Download CSV" + dirtyMarker),
        React.createElement("button", { onClick: handleDownloadJSON }, "Download JSON" + dirtyMarker)
      ),
      React.createElement(
        "div",
        { style: { flex: "1 1 auto", minHeight: 0 } },
        React.createElement(
          PlotlyEditor,
          {
            data: figure.data,
            layout: figure.layout,
            plotly: Plotly,
            useDefaultConfig: true,
            onUpdate: function (data, layout) {
              setFigure(function (f) {
                return Object.assign({}, f, { data: data, layout: layout });
              });
              setDirty(true);
            },
          },
          React.createElement(DefaultEditor)
        )
      )
    );
  }

  var el = document.getElementById("editor-root");
  if (!el) {
    console.error("Missing #editor-root");
    return;
  }

  if (typeof ReactDOM.createRoot === "function") {
    ReactDOM.createRoot(el).render(React.createElement(App));
  } else {
    ReactDOM.render(React.createElement(App), el);
  }
})();
