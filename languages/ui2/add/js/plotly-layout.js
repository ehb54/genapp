(function () {
  "use strict";

  const AXIS_KEY = /^(xaxis|yaxis)\d*$/;
  const PLAIN_TITLE = /^[^<>]*$/;
  const ABOVE_PLOT = "above_plot";
  const wrappedAxisMargins = new WeakMap();

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

  function explicitAxisMargin(plot, sourceLayout, axisName) {
    if (sourceLayout?.[axisName]?.automargin !== undefined) return true;
    const template = sourceLayout?.template;
    const layout = (typeof template === "object" ? template?.layout : null) ||
      plot?._fullLayout?.template?.layout;
    const baseAxis = axisName.startsWith("x") ? "xaxis" : "yaxis";
    if (layout?.[axisName]?.automargin !== undefined || layout?.[baseAxis]?.automargin !== undefined) return true;
    // An unresolved named template is authoritative, too.
    return typeof template === "string" && !layout;
  }

  function axisTitleWrapUpdate(plot, sourceLayout, selection, options) {
    const selected = selection?.axisTitleOverflow === "wrap";
    const owned = wrappedAxisMargins.get(plot) || new Set();
    if (!selected && !owned.size) return null;
    const update = {};
    const axes = new Set([...Object.keys(sourceLayout || {}).filter((key) => AXIS_KEY.test(key)), ...owned]);
    axes.forEach((axisName) => {
      const sourceAxis = sourceLayout?.[axisName];
      const sourceTitle = titleText(sourceAxis);
      let wrapped = "";
      if (selected && sourceTitle && PLAIN_TITLE.test(sourceTitle)) {
        const available = axisLength(plot, axisName) - 8;
        const measure = options?.measureText || canvasMeasure(axisFont(plot, axisName, sourceAxis));
        if (available > 0 && measure) wrapped = wrapPlainText(sourceTitle, available, measure);
      }
      const displayedTitle = titleText(plot?.layout?.[axisName]);
      if (wrapped && wrapped !== displayedTitle) update[`${axisName}.title.text`] = wrapped;
      else if (!selected && owned.has(axisName) && sourceTitle && displayedTitle !== sourceTitle) {
        update[`${axisName}.title.text`] = sourceTitle;
      }
      if (wrapped.includes("<br>") && !explicitAxisMargin(plot, sourceLayout, axisName)) {
        if (plot?.layout?.[axisName]?.automargin !== true) update[`${axisName}.automargin`] = true;
      } else if (owned.has(axisName)) {
        const original = sourceAxis?.automargin ?? null;
        if (plot?.layout?.[axisName]?.automargin !== original) update[`${axisName}.automargin`] = original;
      }
    });
    return Object.keys(update).length ? update : null;
  }

  function applyAxisTitleOverflow(plot, sourceLayout, selection, options) {
    const update = axisTitleWrapUpdate(plot, sourceLayout, selection, options);
    if (!update || typeof window.Plotly?.relayout !== "function") return null;
    return Promise.resolve(window.Plotly.relayout(plot, update)).then(() => {
      const owned = wrappedAxisMargins.get(plot) || new Set();
      Object.keys(update).filter((key) => key.endsWith(".automargin")).forEach((key) => {
        const axisName = key.split(".")[0];
        if (update[key] === true && !explicitAxisMargin(plot, sourceLayout, axisName)) owned.add(axisName);
        else owned.delete(axisName);
      });
      if (owned.size) wrappedAxisMargins.set(plot, owned);
      else wrappedAxisMargins.delete(plot);
    });
  }

  // Opted-in independent vertical panels reserve measured display-only lanes.
  // Rebuild domains from the source relationships, never from prior adjustments.
  function subplotSpacingUpdate(plot, sourceLayout, selection) {
    if (selection?.subplotSpacing !== "avoid-overlap") return null;
    const grid = sourceLayout?.grid;
    if (grid?.columns !== 1 || !Array.isArray(grid.subplots) || grid.subplots.length < 2) return null;
    const full = plot?._fullLayout;
    const height = Number(full?._size?.h);
    const plotTop = Number(plot?.getBoundingClientRect?.().top);
    if (!(height > 0) || !Number.isFinite(plotTop)) return null;
    const rows = grid.subplots.map((row) => {
      const match = Array.isArray(row) && row.length === 1 && /^x(\d*)y(\d*)$/.exec(row[0]);
      if (!match) return null;
      const xName = `xaxis${match[1]}`, yName = `yaxis${match[2]}`;
      const xAxis = full[xName], yAxis = full[yName];
      if (!xAxis || !yAxis || xAxis.side === "top" || xAxis.overlaying || yAxis.overlaying) return null;
      const domain = sourceLayout[yName]?.domain;
      const weight = Array.isArray(domain) && domain.length === 2 ? Number(domain[1]) - Number(domain[0]) : 1;
      return Number.isFinite(weight) && weight > 0 ? { xName, yName, xId: `x${match[1]}`, yAxis, weight } : null;
    });
    if (rows.some((row) => !row) || new Set(rows.map((r) => r.xName)).size !== rows.length ||
        new Set(rows.map((r) => r.yName)).size !== rows.length) return null;
    const gaps = rows.slice(0, -1).map((row) => {
      const bottom = plotTop + Number(row.yAxis._offset) + Number(row.yAxis._length);
      const nodes = [plot.querySelector?.(`.${row.xId}title`),
        ...Array.from(plot.querySelectorAll?.(`.${row.xId}tick text`) || [])];
      let depth = 0;
      nodes.forEach((node) => {
        const rect = node?.getBoundingClientRect?.();
        if (rect?.height > 0) depth = Math.max(depth, rect.bottom - bottom);
      });
      // Four-pixel lanes avoid subpixel font-rounding drift after relayout.
      return Math.max(24, 4 * Math.ceil((depth + 16 - 0.01) / 4));
    });
    if (gaps.some((gap) => !Number.isFinite(gap))) return null;
    const available = height - gaps.reduce((total, gap) => total + gap, 0);
    // Do not collapse scientific panels when a host supplies an unusable height.
    if (available < rows.length * 24) return null;
    const totalWeight = rows.reduce((total, row) => total + row.weight, 0);
    if (rows.some((row) => available * row.weight / totalWeight < 24)) return null;
    let top = 1;
    const update = {};
    rows.forEach((row, index) => {
      const bottom = top - available * row.weight / totalWeight / height;
      const domain = [Math.max(0, bottom), top];
      const current = full[row.yName].domain;
      if (!Array.isArray(current) || domain.some((value, i) => Math.abs(value - current[i]) > 0.0001)) {
        update[`${row.yName}.domain`] = domain;
      }
      top = bottom - (gaps[index] || 0) / height;
    });
    return Object.keys(update).length ? update : null;
  }

  function applySubplotSpacing(plot, sourceLayout, selection) {
    const update = subplotSpacingUpdate(plot, sourceLayout, selection);
    if (!update || typeof window.Plotly?.relayout !== "function") return null;
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


  // View-selected tick notation applies only to declared numeric axes. Work on
  // detached axis objects so final outputs remain authoritative and unchanged.
  function validNumericTickFormat(format) {
    return typeof format === "string" &&
      /^(?:\.(?:[0-9]|1[0-5])~?e|\.(?:[1-9]|1[0-6])~?[gr])$/.test(format);
  }

  function prepareNumericTickFormat(sourceLayout, selection) {
    const formats = selection?.axisTickFormats;
    if (!formats || typeof formats !== "object" || Array.isArray(formats)) {
      return sourceLayout;
    }
    let layout = sourceLayout;
    Object.entries(formats).forEach(([name, format]) => {
      if (!AXIS_KEY.test(name) || !validNumericTickFormat(format)) return;
      const axis = sourceLayout?.[name];
      const templateAxis = sourceLayout?.template?.layout?.[name];
      const hasExplicitTicks = (value) => value && (
        value.tickformat || value.tickformatstops?.length ||
        (value.tickmode === "array" && value.ticktext?.length)
      );
      if (!axis || !["linear", "log"].includes(axis.type) ||
          hasExplicitTicks(axis) || hasExplicitTicks(templateAxis)) return;
      if (layout === sourceLayout) layout = { ...sourceLayout };
      layout[name] = { ...axis, tickformat: format };
    });
    return layout;
  }

  // Automatic log labels may collide even when their notation is concise.
  // This display cache owns only tick placement, never source figures/ranges.
  const fittedTickAxes = new WeakMap();
  const TICK_PLACEMENT = ["tickmode", "tickvals", "ticktext", "dtick", "tick0", "nticks", "ticklabelstep"];

  function automaticLogAxis(sourceLayout, name, selection) {
    if (!AXIS_KEY.test(name) || selection?.axisTickDensity?.[name] !== "avoid-overlap") return false;
    const axis = sourceLayout?.[name], template = sourceLayout?.template?.layout?.[name];
    const explicit = value => value && TICK_PLACEMENT.some(key => value[key] != null);
    return axis?.type === "log" && !axis.overlaying && !template?.overlaying &&
      !explicit(axis) && !explicit(template);
  }

  function nonOverlappingTicks(rows, gap = 4) {
    const valid = rows.filter(row => Number.isFinite(row.value) && row.value > 0 &&
      Number.isFinite(row.start) && Number.isFinite(row.end) && row.end > row.start);
    // Favor decades, then fit the remaining native labels in screen order.
    const priority = row => Math.abs(Math.log10(row.value) - Math.round(Math.log10(row.value))) < 1e-8 ? 0 : 1;
    const ordered = valid.slice().sort((a, b) => priority(a) - priority(b) || a.start - b.start);
    const kept = [];
    ordered.forEach(row => {
      if (kept.every(other => row.end + gap <= other.start || other.end + gap <= row.start)) kept.push(row);
    });
    return kept.sort((a, b) => a.start - b.start);
  }

  function tickDensityUpdate(plot, sourceLayout, selection) {
    const update = {};
    Object.keys(selection?.axisTickDensity || {}).forEach(name => {
      if (!automaticLogAxis(sourceLayout, name, selection) || plot?._fullLayout?.[name]?.type !== "log") return;
      const id = name.replace("axis", ""), horizontal = name[0] === "x";
      const nodes = Array.from(plot.querySelectorAll?.(`.${id}tick text`) || []);
      if (nodes.length < 2 || nodes.length > 1000) return;
      const rows = nodes.map(node => {
        const box = node.getBoundingClientRect();
        const coordinate = node.__data__?.x;
        return { value: typeof coordinate === "number" ? 10 ** coordinate : NaN,
          // Plotly keeps superscripts and other label markup in its datum.
          text: node.__data__?.text ?? node.textContent, start: horizontal ? box.left : box.top,
          end: horizontal ? box.right : box.bottom };
      });
      if (rows.some(row => !Number.isFinite(row.value) || row.value <= 0 || !(row.end > row.start))) return;
      const kept = nonOverlappingTicks(rows);
      if (!kept.length || kept.length === rows.length) return;
      update[`${name}.tickmode`] = "array";
      update[`${name}.tickvals`] = kept.map(row => row.value);
      update[`${name}.ticktext`] = kept.map(row => row.text);
    });
    return Object.keys(update).length ? update : null;
  }

  function applyTickDensity(plot, sourceLayout, selection) {
    if (!plot?._fullLayout || typeof window.Plotly?.relayout !== "function") return null;
    let state = fittedTickAxes.get(plot);
    if (!state) {
      state = { axes: new Set(), busy: false };
      state.listener = event => {
        if (!state.busy && Object.keys(event || {}).some(key =>
            /(?:^width$|^height$|axis\d*\.(?:range|autorange))/.test(key))) {
          applyTickDensity(plot, state.source, state.selection);
        }
      };
      fittedTickAxes.set(plot, state);
    }
    state.source = sourceLayout || {};
    state.selection = selection || {};
    if (state.busy) return state.promise;
    // Purge/newPlot can remove listeners while retaining the same DOM node.
    plot.removeListener?.("plotly_relayout", state.listener);
    plot.on?.("plotly_relayout", state.listener);
    state.busy = true;
    state.promise = (async () => {
      try {
        const reset = {};
        state.axes.forEach(name => {
          for (const key of ["tickmode", "tickvals", "ticktext"]) {
            reset[`${name}.${key}`] = state.source?.[name]?.[key] ??
              state.source?.template?.layout?.[name]?.[key] ?? null;
          }
        });
        state.axes.clear();
        if (Object.keys(reset).length) await window.Plotly.relayout(plot, reset);
        const update = tickDensityUpdate(plot, state.source, state.selection);
        if (update) {
          Object.keys(update).filter(key => key.endsWith(".tickmode"))
            .forEach(key => state.axes.add(key.split(".")[0]));
          await window.Plotly.relayout(plot, update);
        }
      } finally {
        state.busy = false;
      }
    })();
    return state.promise;
  }

  // Presentation defaults never rewrite saved figures or explicit hover policy.
  function prepareHoverNameDisplay(sourceLayout, selection) {
    if (selection?.hoverNameDisplay !== "full" || !sourceLayout ||
        typeof sourceLayout !== "object" || Array.isArray(sourceLayout) ||
        sourceLayout.hoverlabel?.namelength != null ||
        sourceLayout.template?.layout?.hoverlabel?.namelength != null) {
      return sourceLayout;
    }
    return {
      ...sourceLayout,
      hoverlabel: { ...sourceLayout.hoverlabel, namelength: -1 }
    };
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
    subplotSpacingUpdate,
    applySubplotSpacing,
    automaticLogAxis,
    nonOverlappingTicks,
    tickDensityUpdate,
    applyTickDensity,
    validNumericTickFormat,
    prepareNumericTickFormat,
    prepareHoverNameDisplay,
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
