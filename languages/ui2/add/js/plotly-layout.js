(function () {
  "use strict";

  const AXIS_KEY = /^(xaxis|yaxis)\d*$/;
  const PLAIN_TITLE = /^[^<>]*$/;
  const ABOVE_PLOT = "above_plot";

  function titleText(axis) {
    if (axis?.title == null) {
      return "";
    }
    return String(typeof axis.title === "object" ? axis.title.text || "" : axis.title).trim();
  }

  function wrapTokens(text) {
    return String(text || "")
      .trim()
      .replace(/\s*\/\s*/g, " / ")
      .split(/\s+/)
      .filter(Boolean);
  }

  function wrapPlainText(text, maximumWidth, measureText) {
    const source = String(text || "").trim();
    if (!source || !PLAIN_TITLE.test(source) || !(maximumWidth > 0) || typeof measureText !== "function") {
      return source;
    }
    const lines = [];
    let current = "";
    wrapTokens(source).forEach((token) => {
      if (token === "/" && current) {
        current = `${current} /`;
        return;
      }
      const candidate = current ? `${current} ${token}` : token;
      if (current && measureText(candidate) > maximumWidth) {
        lines.push(current);
        current = token;
      } else {
        current = candidate;
      }
    });
    if (current) {
      lines.push(current);
    }
    return lines.join("<br>");
  }

  function canvasMeasure(font) {
    if (typeof document === "undefined" || typeof document.createElement !== "function") {
      return null;
    }
    const context = document.createElement("canvas")?.getContext?.("2d");
    if (!context) {
      return null;
    }
    context.font = font;
    return (text) => context.measureText(String(text || "")).width;
  }

  function axisFont(plot, axisName, sourceAxis) {
    const fullAxis = plot?._fullLayout?.[axisName] || {};
    const fullFont = fullAxis.title?.font || {};
    const sourceFont = typeof sourceAxis?.title === "object" ? sourceAxis.title.font || {} : {};
    const layoutFont = plot?._fullLayout?.font || {};
    const size = Number(fullFont.size || sourceFont.size || layoutFont.size || 12);
    const family = String(fullFont.family || sourceFont.family || layoutFont.family || "Arial, sans-serif");
    const weight = String(fullFont.weight || sourceFont.weight || "normal");
    return `${weight} ${Number.isFinite(size) && size > 0 ? size : 12}px ${family}`;
  }

  function axisLength(plot, axisName) {
    const fullAxis = plot?._fullLayout?.[axisName];
    const length = Number(fullAxis?._length);
    if (Number.isFinite(length) && length > 0) {
      return length;
    }
    const domain = fullAxis?.domain || plot?.layout?.[axisName]?.domain;
    const size = plot?._fullLayout?._size || {};
    const span = Array.isArray(domain) && domain.length === 2
      ? Math.max(0, Number(domain[1]) - Number(domain[0]))
      : 1;
    const total = axisName.startsWith("xaxis") ? Number(size.w) : Number(size.h);
    return Number.isFinite(total) && total > 0 ? span * total : 0;
  }

  function axisTitleWrapUpdate(plot, sourceLayout, selection, options) {
    if (selection?.axisTitleOverflow !== "wrap") {
      return null;
    }
    const update = {};
    Object.keys(sourceLayout || {}).filter((key) => AXIS_KEY.test(key)).forEach((axisName) => {
      const sourceAxis = sourceLayout[axisName];
      const sourceTitle = titleText(sourceAxis);
      if (!sourceTitle || !PLAIN_TITLE.test(sourceTitle)) {
        return;
      }
      const available = axisLength(plot, axisName) - 8;
      if (!(available > 0)) {
        return;
      }
      const measure = options?.measureText || canvasMeasure(axisFont(plot, axisName, sourceAxis));
      if (!measure) {
        return;
      }
      const wrapped = wrapPlainText(sourceTitle, available, measure);
      const displayedTitle = titleText(plot?.layout?.[axisName]);
      if (wrapped && wrapped !== displayedTitle) {
        update[`${axisName}.title.text`] = wrapped;
      }
    });
    return Object.keys(update).length ? update : null;
  }

  function applyAxisTitleOverflow(plot, sourceLayout, selection, options) {
    const update = axisTitleWrapUpdate(plot, sourceLayout, selection, options);
    if (!update || typeof window.Plotly?.relayout !== "function") {
      return null;
    }
    return Promise.resolve(window.Plotly.relayout(plot, update));
  }

  function nodeHeight(node) {
    const rect = node?.getBoundingClientRect?.();
    const height = Number(rect?.height);
    return Number.isFinite(height) && height > 0 ? Math.ceil(height) : 0;
  }

  function afterRenderFrames(plot) {
    const requestFrame = plot?.ownerDocument?.defaultView?.requestAnimationFrame
      || window.requestAnimationFrame;
    if (typeof requestFrame !== "function") {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      requestFrame(() => requestFrame(resolve));
    });
  }

  // Selected annotations are presentation elements, never data-axis inputs.
  // Prepare a detached layout before Plotly computes its first autorange.
  function prepareAnnotationPlacement(sourceLayout, selection) {
    const placements = selection?.annotationPlacement;
    if (!placements || !Array.isArray(sourceLayout?.annotations)) {
      return sourceLayout;
    }
    let selectedCount = 0;
    const annotations = sourceLayout.annotations.map((annotation) => {
      if (!annotation?.name || placements[annotation.name] !== ABOVE_PLOT) {
        return annotation;
      }
      const laneIndex = selectedCount++;
      return {
        ...annotation,
        xref: "paper", yref: "paper", x: 0, y: 1,
        xanchor: "left", yanchor: "bottom", showarrow: false,
        align: "left", xshift: 0, yshift: laneIndex * 36
      };
    });
    return selectedCount ? { ...sourceLayout, annotations } : sourceLayout;
  }

  function annotationPlacementUpdate(plot, sourceLayout, selection, options) {
    const placements = selection?.annotationPlacement;
    const annotations = Array.isArray(sourceLayout?.annotations) ? sourceLayout.annotations : [];
    if (!placements || typeof placements !== "object" || !annotations.length) {
      return null;
    }
    const selected = annotations.map((annotation, index) => ({ annotation, index }))
      .filter(({ annotation }) => (
        annotation?.name
        && placements[annotation.name] === ABOVE_PLOT
      ));
    if (!selected.length) {
      return null;
    }

    const gap = Math.max(0, Number(options?.gap) || 12);
    const fallbackAnnotationHeight = Math.max(
      1,
      Number(options?.fallbackAnnotationHeight) || 24
    );
    const renderedAnnotations = Array.from(plot?.querySelectorAll?.(".annotation") || []);
    const update = {};
    let laneHeight = 0;
    selected.forEach(({ index }) => {
      const height = nodeHeight(renderedAnnotations[index]) || fallbackAnnotationHeight;
      update[`annotations[${index}].xref`] = "paper";
      update[`annotations[${index}].x`] = 0;
      update[`annotations[${index}].xanchor`] = "left";
      update[`annotations[${index}].showarrow`] = false;
      update[`annotations[${index}].align`] = "left";
      update[`annotations[${index}].xshift`] = 0;
      update[`annotations[${index}].yref`] = "paper";
      update[`annotations[${index}].y`] = 1;
      update[`annotations[${index}].yanchor`] = "bottom";
      update[`annotations[${index}].yshift`] = laneHeight;
      laneHeight += height + gap;
    });

    const currentTopMargin = Number(plot?._fullLayout?.margin?.t) || 0;
    const configuredBase = Number(options?.baseTopMargin);
    const baseTopMargin = Number.isFinite(configuredBase) && configuredBase > 0
      ? configuredBase
      : Math.max(96, currentTopMargin - laneHeight);
    const titleHeight = nodeHeight(plot?.querySelector?.(".gtitle"));
    const modebarHeight = nodeHeight(plot?.querySelector?.(".modebar"));
    const chromeHeight = Math.max(baseTopMargin, titleHeight + modebarHeight + (3 * gap));
    update["margin.autoexpand"] = true;
    update["margin.t"] = Math.ceil(chromeHeight + laneHeight);
    return update;
  }

  function applyAnnotationPlacement(plot, sourceLayout, selection, options) {
    const update = annotationPlacementUpdate(plot, sourceLayout, selection, options);
    if (!update || typeof window.Plotly?.relayout !== "function") {
      return null;
    }
    return Promise.resolve(window.Plotly.relayout(plot, update))
      .then(() => afterRenderFrames(plot))
      .then(() => {
        // The first margin change can narrow and wrap annotation text. Measure
        // once more after Plotly has rendered that layout so the reserved lane
        // reflects the settled text height without creating an open-ended loop.
        const settledUpdate = annotationPlacementUpdate(
          plot,
          sourceLayout,
          selection,
          options
        );
        return settledUpdate
          ? window.Plotly.relayout(plot, settledUpdate)
          : null;
      });
  }


  // Numeric defaults are opt-in presentation. Inspect Plotly's resolved axis
  // types rather than guessing whether an input column is numeric or a date.
  function validNumericHoverFormat(format) {
    return typeof format === "string" &&
      /^(?:\.(?:[0-9]|1[0-5])e|\.(?:[1-9]|1[0-6])[gr])$/.test(format);
  }

  function numericHoverFormatUpdate(plot, format) {
    if (!validNumericHoverFormat(format)) return null;
    const update = {};
    const visit = (layout, prefix = "") => {
      Object.entries(layout || {}).forEach(([name, axis]) => {
        if (/^[xyz]axis\d*$/.test(name) && axis &&
            ["linear", "log"].includes(axis.type) && !axis.hoverformat) {
          update[`${prefix}${name}.hoverformat`] = format;
        } else if (/^scene\d*$/.test(name) && axis && typeof axis === "object") {
          visit(axis, `${prefix}${name}.`);
        }
      });
    };
    visit(plot?._fullLayout);
    return Object.keys(update).length ? update : null;
  }

  function numericHoverValues(values) {
    let found = false;
    const numeric = (value) => {
      if (Array.isArray(value) || ArrayBuffer.isView(value)) {
        return Array.from(value).every(numeric);
      }
      if (value == null) return true;
      const valid = (typeof value === "number" ||
        (typeof value === "string" && value.trim() !== "")) &&
        Number.isFinite(Number(value));
      found = found || valid;
      return valid;
    };
    return (Array.isArray(values) || ArrayBuffer.isView(values)) && numeric(values) && found;
  }

  function numericHoverTraceUpdates(plot, format) {
    if (!validNumericHoverFormat(format)) return [];
    const schema = window.Plotly?.PlotSchema?.get?.()?.traces;
    if (!schema) return [];
    // Non-coordinate values (for example a heatmap's z matrix) do not use a
    // layout axis. Use only formats declared by the trace's Plotly schema.
    return [["zhoverformat", "z"], ["valuehoverformat", "value"]].flatMap(([key, field]) => {
      const indices = [];
      (plot?._fullData || []).forEach((trace, index) => {
        if (key === "zhoverformat" && trace.scene) return;
        if (schema[trace.type]?.attributes?.[key] && !trace[key] &&
            numericHoverValues(trace[field])) indices.push(index);
      });
      return indices.length ? [{ update: { [key]: format }, indices }] : [];
    });
  }

  async function applyNumericHoverFormat(plot, format) {
    if (!validNumericHoverFormat(format)) return;
    const layoutUpdate = numericHoverFormatUpdate(plot, format);
    if (layoutUpdate && typeof window.Plotly?.relayout === "function") {
      await window.Plotly.relayout(plot, layoutUpdate);
    }
    if (typeof window.Plotly?.restyle === "function") {
      for (const { update, indices } of numericHoverTraceUpdates(plot, format)) {
        await window.Plotly.restyle(plot, update, indices);
      }
    }
  }

  window.GenAppPlotlyLayout = {
    validNumericHoverFormat,
    numericHoverFormatUpdate,
    numericHoverTraceUpdates,
    applyNumericHoverFormat,
    prepareAnnotationPlacement,
    annotationPlacementUpdate,
    applyAnnotationPlacement,
    applyAxisTitleOverflow,
    axisTitleWrapUpdate,
    titleText,
    wrapPlainText
  };
}());
