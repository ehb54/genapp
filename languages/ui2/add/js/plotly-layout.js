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

  // Tick labels are display geometry. Keep every native tick/grid position,
  // masking only colliding text on detached display axes. Saved figures are
  // never changed. Old axisTickDensity selections are accepted but unnecessary.
  const fittedTickAxes = new WeakMap();
  const TICK_PLACEMENT = ["tickmode", "tickvals", "ticktext"];
  const blankTickLabel = "\u200b";
  const copyTickValue = value => value == null ? null : JSON.parse(JSON.stringify(value));
  const sameTickValue = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  function tickCoordinateValue(axis, coordinate) {
    return ["category", "multicategory"].includes(axis.type) ? coordinate
      : typeof axis.l2d === "function" ? axis.l2d(coordinate)
      : axis.type === "log" ? 10 ** coordinate : coordinate;
  }

  function tickLabelRows(plot) {
    const rows = [];
    Object.entries(plot?._fullLayout || {}).forEach(([name, axis]) => {
      if (!AXIS_KEY.test(name) || !axis || axis.visible === false || axis.showticklabels === false) return;
      const id = name.replace("axis", "");
      Array.from(plot.querySelectorAll?.(`.${id}tick text`) || []).forEach(node => {
        const text = node.__data__?.text ?? node.textContent;
        if (!String(text || "").replace(/\u200b/g, "").trim()) return;
        const box = node.getBoundingClientRect();
        const coordinate = node.__data__?.x;
        if (!Number.isFinite(coordinate) || !(box.width > 0 && box.height > 0)) return;
        // Category coordinates must stay numeric, including duplicate labels.
        const value = tickCoordinateValue(axis, coordinate);
        rows.push({name, value, text, left:box.left, right:box.right,
          top:box.top, bottom:box.bottom, coordinate,
          priority:axis.type === "log" && Math.abs(coordinate - Math.round(coordinate)) < 1e-8 ? 0 : 1});
      });
    });
    return rows;
  }

  function nonOverlappingTicks(rows, gap = 4) {
    const ordered = rows.slice().sort((a, b) => a.priority - b.priority ||
      a.top - b.top || a.left - b.left || a.name.localeCompare(b.name));
    const kept = [];
    for (const row of ordered) {
      if (kept.every(other => row.right + gap <= other.left || other.right + gap <= row.left ||
          row.bottom + gap <= other.top || other.bottom + gap <= row.top)) kept.push(row);
    }
    return kept;
  }

  function tickDensityUpdate(plot) {
    const rows = tickLabelRows(plot), kept = new Set(nonOverlappingTicks(rows));
    const update = {};
    for (const name of new Set(rows.filter(row => !kept.has(row)).map(row => row.name))) {
      const axisRows = rows.filter(row => row.name === name);
      const axis = plot._fullLayout[name];
      // Plotly's resolved ticks include intentional blank labels and native
      // unlabeled grid positions; a DOM-text-only list would lose those ticks.
      const ticks = Array.isArray(axis._vals) ? axis._vals : axisRows.map(row => ({x:row.coordinate,text:row.text}));
      const visible = new Set(axisRows.filter(row => kept.has(row)).map(row => row.coordinate));
      update[`${name}.tickmode`] = "array";
      update[`${name}.tickvals`] = ticks.map(tick => tickCoordinateValue(axis, tick.x));
      update[`${name}.ticktext`] = ticks.map(tick => visible.has(tick.x) ? tick.text : blankTickLabel);
    }
    return Object.keys(update).length ? update : null;
  }

  function applyTickDensity(plot) {
    if (!plot?._fullLayout || typeof window.Plotly?.relayout !== "function") return Promise.resolve();
    let state = fittedTickAxes.get(plot);
    if (!state) {
      state = { axes:new Map(), pending:false, promise:null, internal:false, scheduled:null };
      state.schedule = () => {
        if (state.scheduled) return;
        state.scheduled = Promise.resolve().then(() => {
          state.scheduled = null;
          return applyTickDensity(plot);
        });
        // Event callbacks cannot return an awaited promise to Plotly.
        state.scheduled.catch(error => window.console?.error?.("Tick label fitting failed", error));
      };
      state.relayout = event => {
        // Our own patch contains only tick-placement keys. A real range/size/
        // style change during fitting must request a fresh pass, not be lost.
        if (!state.internal || Object.keys(event || {}).some(key =>
            !/^[xy]axis\d*\.(tickmode|tickvals|ticktext)$/.test(key))) state.schedule();
      };
      state.afterplot = () => { if (!state.internal) state.schedule(); };
      fittedTickAxes.set(plot, state);
    }
    for (const [event, listener] of [["plotly_relayout",state.relayout],["plotly_afterplot",state.afterplot]]) {
      plot.removeListener?.(event, listener);
      plot.on?.(event, listener);
    }
    state.pending = true;
    if (state.promise) return state.promise;
    const relayout = async update => {
      state.internal = true;
      try { await window.Plotly.relayout(plot, update); }
      finally { state.internal = false; }
    };
    state.promise = Promise.resolve().then(async () => {
      while (state.pending && plot._fullLayout) {
        state.pending = false;
        const reset = {};
        for (const [name, entry] of state.axes) {
          // react/newPlot or an explicit user edit replaces our display patch.
          // Do not overwrite that newer figure with the preceding baseline.
          if (TICK_PLACEMENT.every(key => sameTickValue(plot.layout?.[name]?.[key], entry.fitted[key]))) {
            for (const key of TICK_PLACEMENT) reset[`${name}.${key}`] = entry.original[key];
          }
        }
        state.axes.clear();
        if (Object.keys(reset).length) await relayout(reset);
        let update = tickDensityUpdate(plot);
        // Array-mode labels can have different geometry from native labels.
        // Each pass removes text monotonically; retain the full tick positions.
        while (update && !state.pending) {
          for (const name of new Set(Object.keys(update).map(key => key.split(".")[0]))) {
            let entry = state.axes.get(name);
            if (!entry) {
              entry = {original:{}, fitted:{}};
              for (const key of TICK_PLACEMENT) entry.original[key] = copyTickValue(plot.layout?.[name]?.[key]);
              state.axes.set(name, entry);
            } else {
              const visible = new Map(update[`${name}.tickvals`].map((v,i) => [JSON.stringify(v),update[`${name}.ticktext`][i]]));
              update[`${name}.tickvals`] = entry.fitted.tickvals;
              update[`${name}.ticktext`] = entry.fitted.tickvals.map(v => visible.get(JSON.stringify(v)) ?? blankTickLabel);
            }
            for (const key of TICK_PLACEMENT) entry.fitted[key] = copyTickValue(update[`${name}.${key}`]);
          }
          await relayout(update);
          update = tickDensityUpdate(plot);
        }
      }
    }).finally(() => { state.promise = null; });
    return state.promise;
  }

  // Exports and editor handoff must await the latest queued display fit.
  async function settleTickDensity(plot) {
    const state = fittedTickAxes.get(plot);
    if (state?.scheduled) await state.scheduled;
    await applyTickDensity(plot);
    if (state?.scheduled) await state.scheduled;
    if (state?.promise) await state.promise;
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
      /^(?:\.(?:[0-9]|1[0-5])e|\.(?:[1-9]|1[0-6])~?[gr])$/.test(format);
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

  // This policy formats supplied values only. It never estimates uncertainty
  // or uses error-bar endpoint subtraction to recover it.
  const precisionTemplates = new WeakMap();
  const numericValue = value => value !== null && value !== '' &&
    (typeof value === 'number' || typeof value === 'string') && Number.isFinite(Number(value));

  function decimalParts(value) {
    const [mantissa, exponent = '0'] = String(value).toLowerCase().split('e');
    const [whole, fraction = ''] = mantissa.split('.');
    return { coefficient: BigInt(whole + fraction), power: Number(exponent) - fraction.length };
  }

  // Decimal round-to-nearest, ties-to-even, once from the supplied number's
  // shortest decimal representation; no floating-point multiplication rounding.
  function roundDecimal(value, place) {
    const parts = decimalParts(value);
    const shift = parts.power - place;
    if (shift >= 0) return parts.coefficient * (10n ** BigInt(shift));
    const divisor = 10n ** BigInt(-shift);
    const sign = parts.coefficient < 0n ? -1n : 1n;
    const absolute = parts.coefficient * sign;
    const quotient = absolute / divisor, remainder = absolute % divisor;
    const up = remainder * 2n > divisor || (remainder * 2n === divisor && quotient % 2n === 1n);
    return (quotient + (up ? 1n : 0n)) * sign;
  }

  function decimalText(coefficient, place) {
    const negative = coefficient < 0n;
    let digits = String(negative ? -coefficient : coefficient);
    if (place >= 0) digits = coefficient === 0n ? '0' : digits + '0'.repeat(place);
    else {
      digits = digits.padStart(1 - place, '0');
      digits = digits.slice(0, place) + '.' + digits.slice(place);
    }
    return (negative ? '−' : '') + digits;
  }

  function uncertaintyPrecision(value) {
    if (!numericValue(value) || Number(value) <= 0) return null;
    const number = Number(value);
    let place = Math.floor(Math.log10(number)) - 1;
    let coefficient = roundDecimal(number, place);
    if (coefficient >= 100n) coefficient = roundDecimal(number, ++place);
    return { coefficient, place };
  }

  function formatUncertainValue(value, plus, minus = plus) {
    if (!numericValue(value)) return null;
    const upper = uncertaintyPrecision(plus), lower = uncertaintyPrecision(minus);
    // Zero/nonfinite/absent uncertainty is not evidence of infinite precision.
    if (!upper || !lower) return null;
    const place = Math.min(upper.place, lower.place);
    const rounded = roundDecimal(Number(value), place);
    const magnitude = rounded === 0n ? Math.max(upper.place, lower.place) + 1 : String(rounded < 0n ? -rounded : rounded).length - 1 + place;
    const exponent = magnitude < -4 || magnitude >= 6 ? magnitude : 0;
    const valueText = decimalText(rounded, place - exponent);
    const plusText = decimalText(upper.coefficient, upper.place - exponent);
    const minusText = decimalText(lower.coefficient, lower.place - exponent);
    const symmetric = Number(plus) === Number(minus);
    const body = symmetric ? `${valueText} ± ${plusText}` : `${valueText} +${plusText}/−${minusText}`;
    return {
      value: valueText + (exponent ? `e${exponent}` : ''),
      plus: plusText + (exponent ? `e${exponent}` : ''),
      minus: minusText + (exponent ? `e${exponent}` : ''),
      text: exponent ? `(${body})e${exponent}` : body
    };
  }

  function pointValue(values, index) {
    if (Array.isArray(index)) return values?.[index[0]]?.[index[1]];
    return Array.isArray(values) || ArrayBuffer.isView(values) ? values[index] : values;
  }

  function suppliedUncertainty(error, value, index) {
    if (!error || error.visible === false || !numericValue(value)) return null;
    // Only explicit, absolute data uncertainties. Percent/constant/sqrt and
    // cross-trace references are not silently converted or reinterpreted here.
    if (error.type !== 'data' || error.traceref != null) return null;
    const plus = pointValue(error.array, index);
    const minus = error.symmetric === false ? pointValue(error.arrayminus, index) : plus;
    return formatUncertainValue(value, plus, minus);
  }

  function precisionAxis(plot, trace, field) {
    if (trace.scene) return plot?._fullLayout?.[trace.scene]?.[field + 'axis'];
    const id = trace[field + 'axis'] || field;
    return plot?._fullLayout?.[id[0] + 'axis' + id.slice(1)];
  }

  function uncertainHoverTemplate(plot, trace, sourceTemplate, index) {
    const pairs = {};
    for (const field of ['x', 'y', 'z']) {
      const axis = precisionAxis(plot, trace, field);
      if (!['linear', 'log'].includes(axis?.type)) continue;
      const value = pointValue(trace[field], index);
      const pair = suppliedUncertainty(trace['error_' + field], value, index);
      if (pair) pairs[field] = pair;
    }
    if (!Object.keys(pairs).length) return sourceTemplate;
    let template = sourceTemplate;
    if (!template) {
      const info = trace.hoverinfo || 'all';
      if (info === 'skip' || info === 'none') return sourceTemplate;
      const fields = ['x', 'y', 'z'].filter(field => (trace[field] != null || precisionAxis(plot, trace, field)) &&
        (info === 'all' || info.split('+').includes(field)));
      template = fields.map(field => `${field}: %{${field}}`).join('<br>');
      if (info === 'all' || info.split('+').includes('text')) {
        const textField = trace.hovertext != null && trace.hovertext !== '' ? 'hovertext' : 'text';
        if (trace[textField] != null && trace[textField] !== '') template += `<br>%{${textField}}`;
      }
      template += info === 'all' || info.split('+').includes('name') ? '<extra>%{fullData.name}</extra>' : '<extra></extra>';
    }
    return template.replace(/%\{([xyz])(?::[^}]*)?\}/g, (original, field) => {
      const pair = pairs[field];
      if (!pair) return original;
      // If the author explicitly includes error-array placeholders, keep the
      // value and uncertainty separate while sharing the rounding decision.
      return template.includes(`%{error_${field}.array`) ? pair.value : pair.text;
    }).replace(/%\{error_([xyz])\.(arrayminus|array)(?::[^}]*)?\}/g,
      (original, field, side) => pairs[field]?.[side === 'array' ? 'plus' : 'minus'] || original);
  }

  function numericHoverPrecisionUpdates(plot) {
    const updates = [];
    (plot?.data || []).forEach((trace, index) => {
      const fullTrace = plot._fullData?.[index];
      if (!fullTrace || trace.transforms?.length || !['scatter', 'scattergl', 'scatter3d', 'bar'].includes(fullTrace.type)) return;
      const resolved = { ...fullTrace, ...trace, hoverinfo: trace.hoverinfo || 'all' };
      for (const field of ['x', 'y', 'z']) {
        const key = 'error_' + field;
        // Resolved errors contain Plotly bookkeeping defaults (for example
        // traceref=0); only the inferred type supplements explicit input.
        resolved[key] = trace[key] ? { ...trace[key], type: trace[key].type || fullTrace[key]?.type } : undefined;
      }
      let state = precisionTemplates.get(trace);
      if (!state || trace.hovertemplate !== state.display) {
        state = { source: trace.hovertemplate ?? fullTrace.hovertemplate };
        precisionTemplates.set(trace, state);
      }
      if (state.display == null && !['x', 'y', 'z'].some(field => resolved['error_' + field]?.array != null)) return;
      const length = Math.max(...['x', 'y', 'z'].map(field => trace[field]?.length || 0));
      if (!length) return;
      const display = Array.from({ length }, (_, point) => uncertainHoverTemplate(
        plot, resolved, pointValue(state.source, point), point));
      const changed = display.some((value, point) => value !== pointValue(state.source, point));
      const template = changed ? display : state.source;
      if (JSON.stringify(template) === JSON.stringify(trace.hovertemplate)) return;
      state.display = template;
      updates.push({ index, template });
    });
    return updates;
  }

  async function applyNumericHoverPrecision(plot) {
    for (const { index, template } of numericHoverPrecisionUpdates(plot)) {
      // The extra array is Plotly's per-trace update envelope; template itself
      // is the per-point string array. Scientific/custom data are untouched.
      await window.Plotly.restyle(plot, { hovertemplate: [template ?? null] }, [index]);
    }
  }

  async function applyNumericHoverFormat(plot, format) {
    if (format === "uncertainty-2") {
      await applyNumericHoverFormat(plot, ".6g");
      return applyNumericHoverPrecision(plot);
    }
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
    tickLabelRows,
    settleTickDensity,
    nonOverlappingTicks,
    tickDensityUpdate,
    applyTickDensity,
    validNumericTickFormat,
    prepareNumericTickFormat,
    prepareHoverNameDisplay,
    formatUncertainValue,
    numericHoverPrecisionUpdates,
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
