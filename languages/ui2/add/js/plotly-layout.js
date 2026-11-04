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

  // Coalesce display geometry requests. Exports join the same queue as resize
  // and rendering, including a newer source arriving during an awaited fit.
  const presentationFits = new WeakMap();
  function queuePresentationFit(plot, fit) {
    let state = presentationFits.get(plot);
    if (!state) { state = { latest: null, promise: null }; presentationFits.set(plot, state); }
    state.latest = fit;
    if (!state.promise) state.promise = Promise.resolve().then(async () => {
      while (state.latest && plot?._fullLayout) {
        const next = state.latest;
        state.latest = null;
        await next();
      }
    }).finally(() => { state.promise = null; });
    return state.promise;
  }

  const figureTitleFits = new WeakMap();
  const FIGURE_TITLE_KEYS = ["text", "x", "xref", "xanchor", "y", "yref", "yanchor", "pad.t"];
  const nestedValue = (object, key) => key.split(".").reduce((value, part) => value?.[part], object);

  async function applyFigureTitleOverflow(plot, sourceLayout, selection, options = {}) {
    if (!plot?._fullLayout || typeof window.Plotly?.relayout !== "function") return;
    const sourceText = titleText(sourceLayout);
    let owned = figureTitleFits.get(plot);
    // A new render supplies a fresh source layout and supersedes display state.
    if (owned && owned.source !== sourceLayout) { figureTitleFits.delete(plot); owned = null; }
    const selected = selection?.figureTitleOverflow === "wrap" && sourceText && PLAIN_TITLE.test(sourceText);
    const currentTitle = () => typeof plot.layout?.title === "object" ? plot.layout.title : { text: plot.layout?.title };
    const patch = async (update) => {
      const changed = Object.fromEntries(Object.entries(update).filter(([key, value]) =>
        (nestedValue(plot.layout, key) ?? null) !== value));
      if (Object.keys(changed).length) await window.Plotly.relayout(plot, changed);
    };
    if (!selected) {
      if (owned) {
        const update = {};
        for (const key of FIGURE_TITLE_KEYS) {
          if ((nestedValue(currentTitle(), key) ?? null) === owned.applied[key]) {
            update[`title.${key}`] = owned.original[key];
          }
        }
        if (plot.layout?.margin?.t === owned.margin) update["margin.t"] = owned.base;
        await patch(update);
        figureTitleFits.delete(plot);
      }
      return;
    }
    const width = Number(plot._fullLayout.width);
    if (!(width > 24)) return; // Hidden/tiny hosts are fitted when visible.
    const font = plot._fullLayout.title?.font || plot._fullLayout.font || {};
    const measure = options.measureText || canvasMeasure(
      `${font.weight || "normal"} ${Number(font.size) || 17}px ${font.family || "Arial, sans-serif"}`);
    if (!measure) return;
    if (!owned) {
      owned = { source: sourceLayout, original: {}, applied: {},
        base: Number(options.baseTopMargin) || Number(plot.layout?.margin?.t) || 96 };
      for (const key of FIGURE_TITLE_KEYS) owned.original[key] = nestedValue(currentTitle(), key) ?? null;
      figureTitleFits.set(plot, owned);
    }
    const text = wrapPlainText(sourceText, width - 24, measure);
    const modebarHeight = nodeHeight(plot.querySelector?.(".modebar"));
    const top = modebarHeight + 12;
    owned.applied = { text, x: 0.5, xref: "container", xanchor: "center",
      y: Math.max(0, 1 - (top + (Number(font.size) || 17)) / (Number(plot._fullLayout.height) || 480)),
      yref: "container", yanchor: "top", "pad.t": 0 };
    await patch(Object.fromEntries(Object.entries(owned.applied).map(([key, value]) => [`title.${key}`, value])));
    // Measure the rendered lines, not a font-size estimate. Restore the base
    // when widening unwraps the title; selected annotation lanes are added next.
    const height = nodeHeight(plot.querySelector?.(".gtitle"));
    owned.margin = Math.ceil(Math.max(owned.base, top + height + 24));
    await patch({ "margin.t": owned.margin });
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
  const fittedHoverTemplates = new WeakMap();
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

  // Tick identity survives renderer round trips without changing tick values.
  // Reserve exact matches first; approximate matches are axis-local, one-to-one,
  // and much narrower than the distance to any neighboring distinct tick.
  function correspondingTicks(reference, candidates) {
    const result = reference.map(() => -1), used = new Set();
    const exact = new Map();
    candidates.forEach((value, index) => {
      if (!exact.has(value)) exact.set(value, []);
      exact.get(value).push(index);
    });
    reference.forEach((value, index) => {
      const queue = exact.get(value);
      if (queue?.length) { result[index] = queue.shift(); used.add(result[index]); }
    });
    reference.forEach((value, index) => {
      if (result[index] >= 0 || !Number.isFinite(value)) return;
      let best = -1, distance = Infinity;
      candidates.forEach((candidate, candidateIndex) => {
        if (used.has(candidateIndex) || !Number.isFinite(candidate)) return;
        const delta = Math.abs(value - candidate);
        if (delta < distance) { best = candidateIndex; distance = delta; }
      });
      if (best < 0) return;
      let tolerance = 8 * Number.EPSILON * Math.max(1, Math.abs(value), Math.abs(candidates[best]));
      for (const [values, center] of [[reference, value], [candidates, candidates[best]]]) {
        for (const other of values) if (Number.isFinite(other) && other !== center) {
          tolerance = Math.min(tolerance, Math.abs(other - center) / 4);
        }
      }
      if (distance <= tolerance) { result[index] = best; used.add(best); }
    });
    return result;
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
      const visible = new Set(correspondingTicks(
        axisRows.filter(row => kept.has(row)).map(row => row.coordinate),
        ticks.map(tick => tick.x)).filter(index => index >= 0));
      update[`${name}.tickmode`] = "array";
      update[`${name}.tickvals`] = ticks.map(tick => tickCoordinateValue(axis, tick.x));
      update[`${name}.ticktext`] = ticks.map((tick, index) => visible.has(index) ? tick.text : blankTickLabel);
    }
    return Object.keys(update).length ? update : null;
  }

  // Plotly also consults ticktext when formatting a hover coordinate. Supply
  // an explicit native numeric placeholder only where our own mask hid it.
  // Keep the original placeholder as well: it carries native error-bar text.
  function unfittedHoverTemplate(trace) {
    const fitted = fittedHoverTemplates.get(trace);
    return fitted && sameTickValue(trace.hovertemplate, fitted.display)
      ? fitted.original : trace.hovertemplate;
  }

  function maskedHoverFormat(axis, trace, field) {
    const compare = (a, b) => {
      if (typeof a === 'number' && typeof b === 'number') return a - b;
      const rank = value => typeof value === 'number' ? [2, value]
        : [String(value)[0] === 'L' ? 0 : 1, Number(String(value).slice(1))];
      const x = rank(a), y = rank(b);
      return x[0] - y[0] || x[1] - y[1];
    };
    const stop = axis.tickformatstops?.find(item => item.enabled !== false &&
      (item.dtickrange?.[0] == null || compare(axis.dtick, item.dtickrange[0]) >= 0) &&
      (item.dtickrange?.[1] == null || compare(axis.dtick, item.dtickrange[1]) <= 0));
    return trace[field + 'hoverformat'] || axis.hoverformat || stop?.value || axis.tickformat || '.6g';
  }

  function nativeCoordinateHoverTemplate(plot, trace, native = false) {
    const info = trace.hoverinfo || 'all';
    if (info === 'skip' || info === 'none') return null;
    const fields = ['x', 'y', 'z'].filter(field =>
      (trace[field] != null || precisionAxis(plot, trace, field)) &&
      (info === 'all' || info.split('+').includes(field)));
    let template = native ? fields.map(field => `%{${field}}`).join(', ')
      : fields.map(field => `${field}: %{${field}}`).join('<br>');
    if (native && fields.length > 1) template = `(${template})`;
    if (info === 'all' || info.split('+').includes('text')) {
      const key = trace.hovertext != null && trace.hovertext !== '' ? 'hovertext' : 'text';
      if (trace[key] != null && trace[key] !== '') template += `<br>%{${key}}`;
    }
    return template + (info === 'all' || info.split('+').includes('name')
      ? '<extra>%{fullData.name}</extra>' : '<extra></extra>');
  }

  async function restoreFittedHoverTemplates(plot, state, restyle) {
    for (const entry of state.hoverTemplates || []) {
      if (plot.data?.[entry.index] === entry.trace &&
          sameTickValue(entry.trace.hovertemplate, entry.display)) {
        const update = {hovertemplate:[entry.original ?? null]};
        if (entry.nameLength != null && entry.trace.hoverlabel?.namelength === entry.nameLength) {
          update['hoverlabel.namelength'] = [entry.originalNameLength ?? null];
        }
        await restyle(update, [entry.index]);
      }
      fittedHoverTemplates.delete(entry.trace);
    }
    state.hoverTemplates = [];
  }

  async function fitHoverCoordinates(plot, state, restyle) {
    if (plot._fullLayout?.hovermode !== 'closest') return;
    for (let index = 0; index < (plot.data || []).length; index++) {
      const trace = plot.data[index], fullTrace = plot._fullData?.[index];
      if (!fullTrace || trace.transforms?.length ||
          !['scatter', 'scattergl', 'bar'].includes(fullTrace.type)) continue;
      const axes = {};
      for (const field of ['x', 'y']) {
        const name = (trace[field + 'axis'] || field).replace(/^([xy])/, '$1axis');
        const fitted = state.axes.get(name), axis = plot._fullLayout[name];
        if (!fitted || !['linear', 'log'].includes(axis?.type)) continue;
        const hidden = fitted.fitted.tickvals.filter((_, i) =>
          fitted.fitted.ticktext[i] === blankTickLabel);
        if (hidden.length) axes[field] = {axis, hidden, nativeTicks:fitted.nativeTicks};
      }
      if (!Object.keys(axes).length) continue;
      const original = trace.hovertemplate ?? fullTrace.hovertemplate;
      const length = Math.max(trace.x?.length || 0, trace.y?.length || 0);
      let changed = false;
      const display = Array.from({length}, (_, point) => {
        const source = pointValue(original, point);
        if (Array.isArray(original) && !source) return source ?? null;
        const template = source || nativeCoordinateHoverTemplate(plot, {...fullTrace, ...trace}, true);
        if (typeof template !== 'string') return source ?? null;
        let repaired = template;
        for (const [field, {axis, hidden, nativeTicks}] of Object.entries(axes)) {
          const value = pointValue(trace[field], point);
          const coordinate = axis.d2l?.(value) ?? value;
          if (!Number.isFinite(coordinate)) continue;
          const tolerance = Math.abs(axis.range[1] - axis.range[0]) / 1e4;
          if (!hidden.some(tick => Math.abs(coordinate - (axis.d2l?.(tick) ?? tick)) < tolerance)) continue;
          let coordinateText;
          if (nativeTicks?.tickmode === 'array' && Array.isArray(nativeTicks.ticktext)) {
            const originalIndex = nativeTicks.tickvals?.findIndex(tick =>
              Math.abs(coordinate - (axis.d2l?.(tick) ?? tick)) < tolerance);
            if (originalIndex >= 0 && originalIndex < nativeTicks.ticktext.length) {
              coordinateText = String(nativeTicks.ticktext[originalIndex]);
              // Authored blank labels remain authored blank labels.
              if (!coordinateText.replace(/\u200b/g, '').trim()) continue;
            }
          }
          if (coordinateText == null) {
            const format = maskedHoverFormat(axis, trace, field);
            if (typeof format !== 'string' || /[{}<>]/.test(format)) continue;
            const prefix = axis.showtickprefix === 'none' ? '' : axis.tickprefix || '';
            const suffix = axis.showticksuffix === 'none' ? '' : axis.ticksuffix || '';
            coordinateText = `${prefix}%{${field}:${format}}${suffix}`;
          }
          repaired = repaired.split(`%{${field}}`).join(`${coordinateText}%{${field}}`);
        }
        if (repaired === template) return template;
        changed = true;
        return repaired;
      });
      if (!changed) continue;
      const entry = {trace, index, original, display,
        nameLength:fullTrace.hoverlabel?.namelength,
        originalNameLength:trace.hoverlabel?.namelength};
      state.hoverTemplates.push(entry);
      fittedHoverTemplates.set(trace, entry);
      const update = {hovertemplate:[display]};
      // Adding a template must not change native/default name clipping.
      if (entry.nameLength != null) update['hoverlabel.namelength'] = [entry.nameLength];
      await restyle(update, [index]);
    }
  }

  // Axis titles need a separate lane even when their text does not wrap.
  // Rectangles are CSS pixels; Plotly standoff/margins use unscaled layout pixels.
  const fittedTitleClearance = new WeakMap();
  function axisTitleClearanceUpdate(plot, gap = 4) {
    const full = plot?._fullLayout || {}, update = {}, margins = {};
    const box = plot?.getBoundingClientRect?.();
    const scaleX = box?.width > 0 && full.width > 0 ? box.width / full.width : 1;
    const scaleY = box?.height > 0 && full.height > 0 ? box.height / full.height : 1;
    for (const [name, axis] of Object.entries(full)) {
      if (!AXIS_KEY.test(name) || !axis || axis.visible === false || axis.showticklabels === false) continue;
      const id = name.replace('axis', ''), horizontal = name.startsWith('x');
      const title = plot.querySelector?.(`.${id}title`);
      const bounds = title?.getBoundingClientRect?.();
      if (!title?.textContent?.trim() || !(bounds?.width > 0 && bounds?.height > 0)) continue;
      const side = axis.side || (horizontal ? 'bottom' : 'left');
      let deficit = 0;
      for (const tick of Array.from(plot.querySelectorAll?.(`.${id}tick text`) || [])) {
        if (!tick.textContent?.replace(/\u200b/g, '').trim()) continue;
        const r = tick.getBoundingClientRect();
        if (!(r.width > 0 && r.height > 0)) continue;
        if (horizontal ? bounds.right <= r.left || bounds.left >= r.right : bounds.bottom <= r.top || bounds.top >= r.bottom) continue;
        const clearance = side === 'bottom' ? bounds.top - r.bottom : side === 'top' ? r.top - bounds.bottom
          : side === 'left' ? r.left - bounds.right : bounds.left - r.right;
        deficit = Math.max(deficit, gap - clearance);
      }
      if (deficit <= .5) continue;
      const delta = Math.ceil(deficit / (horizontal ? scaleY : scaleX));
      update[`${name}.title.standoff`] = Math.max(0, Number(axis.title?.standoff) || 0) + delta;
      const key = {bottom:'b',top:'t',left:'l',right:'r'}[side];
      if (key) margins[key] = Math.max(margins[key] || 0, delta);
    }
    for (const [side, delta] of Object.entries(margins)) {
      update[`margin.${side}`] = Math.ceil(Number(full.margin?.[side]) || 0) + delta;
    }
    return Object.keys(update).length ? update : null;
  }

  async function resetAxisTitleClearance(plot, relayout) {
    const state = fittedTitleClearance.get(plot);
    fittedTitleClearance.delete(plot);
    if (!state || state.layout !== plot.layout) return;
    const reset = {};
    for (const [key, entry] of state.values) {
      // A new producer, user edit, or earlier geometry stage owns newer values.
      if (nestedValue(plot.layout, key) === entry.fitted) reset[key] = entry.original;
    }
    if (Object.keys(reset).length) await relayout(reset);
  }

  async function fitAxisTitleClearance(plot, relayout) {
    const update = axisTitleClearanceUpdate(plot);
    if (!update) return false;
    const state = fittedTitleClearance.get(plot) || {layout:plot.layout, values:new Map()};
    for (const [key, value] of Object.entries(update)) {
      const entry = state.values.get(key) || {original:nestedValue(plot.layout, key) ?? null};
      entry.fitted = value;
      state.values.set(key, entry);
    }
    fittedTitleClearance.set(plot, state);
    await relayout(update);
    return true;
  }

  function applyTickDensity(plot) {
    if (!plot?._fullLayout || typeof window.Plotly?.relayout !== "function") return Promise.resolve();
    let state = fittedTickAxes.get(plot);
    if (!state) {
      state = { axes:new Map(), hoverTemplates:[], pending:false, promise:null, internal:false, scheduled:null };
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
        // Plotly may normalize values in our own tick/title/margin patch.
        // A real range/size/style update during fitting still requests a pass.
        if (!state.internal || Object.keys(event || {}).some(key =>
            !/^(?:[xy]axis\d*\.(?:tickmode|tickvals|ticktext|title\.standoff)|margin\.[lrtb])$/.test(key))) state.schedule();
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
    const restyle = async (update, indices) => {
      if (typeof window.Plotly.restyle !== 'function') return;
      state.internal = true;
      try { await window.Plotly.restyle(plot, update, indices); }
      finally { state.internal = false; }
    };
    state.promise = Promise.resolve().then(async () => {
      while (state.pending && plot._fullLayout) {
        state.pending = false;
        await restoreFittedHoverTemplates(plot, state, restyle);
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
        await resetAxisTitleClearance(plot, relayout);
        // Margin changes can change tick density. Recheck both in a bounded
        // pass, under the same internal-event guard and export promise.
        for (let clearancePass = 0; clearancePass < 4 && !state.pending; clearancePass++) {
          let update = tickDensityUpdate(plot);
          // Array-mode labels can have different geometry from native labels.
          // Each pass removes text monotonically; retain the full tick positions.
          while (update && !state.pending) {
            for (const name of new Set(Object.keys(update).map(key => key.split(".")[0]))) {
              let entry = state.axes.get(name);
              if (!entry) {
                entry = {original:{}, fitted:{}, nativeTicks:{}};
                for (const key of TICK_PLACEMENT) {
                  entry.original[key] = copyTickValue(plot.layout?.[name]?.[key]);
                  entry.nativeTicks[key] = copyTickValue(plot._fullLayout?.[name]?.[key]);
                }
                state.axes.set(name, entry);
              } else {
                const text = update[`${name}.ticktext`];
                const matches = correspondingTicks(entry.fitted.tickvals, update[`${name}.tickvals`]);
                update[`${name}.tickvals`] = entry.fitted.tickvals;
                update[`${name}.ticktext`] = matches.map((index, i) =>
                  entry.fitted.ticktext[i] === blankTickLabel ? blankTickLabel : text[index] ?? blankTickLabel);
              }
              for (const key of TICK_PLACEMENT) entry.fitted[key] = copyTickValue(update[`${name}.${key}`]);
            }
            await relayout(update);
            update = tickDensityUpdate(plot);
          }
          if (!await fitAxisTitleClearance(plot, relayout)) break;
        }
        if (!state.pending) await fitHoverCoordinates(plot, state, restyle);
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

  // Application policy is applied to display copies, including archived figures.
  // Keep the trace name for legends; suppress only its hover presentation.
  function prepare_hover_name_suppression(figure, selection) {
    if (selection !== "none" || !figure || typeof figure !== "object" || Array.isArray(figure)) return figure;
    const template = value => {
      if (Array.isArray(value)) return value.map(template);
      if (typeof value !== "string") return value;
      const body = value.replace(/<extra>[\s\S]*?<\/extra>/gi, "")
        .replace(/%\{(?:fullData\.name|data\.name|name)(?::[^}]*)?\}/g, "");
      return body + "<extra></extra>";
    };
    const trace = value => {
      if (!value || typeof value !== "object" || Array.isArray(value)) return value;
      const display = { ...value, hoverlabel: { ...value.hoverlabel, namelength: 0 } };
      if (value.hovertemplate != null) display.hovertemplate = template(value.hovertemplate);
      if (typeof value.hoverinfo === "string" && value.hoverinfo !== "all") {
        const flags = value.hoverinfo.split("+").filter(flag => flag !== "name");
        display.hoverinfo = flags.join("+") || "none";
      }
      return display;
    };
    const layout = value => {
      const display = { ...value, hoverlabel: { ...value?.hoverlabel, namelength: 0 } };
      if (value?.template && typeof value.template === "object") {
        display.template = { ...value.template,
          layout: { ...value.template.layout, hoverlabel: { ...value.template.layout?.hoverlabel, namelength: 0 } } };
        if (value.template.data) display.template.data = Object.fromEntries(
          Object.entries(value.template.data).map(([type, traces]) =>
            [type, Array.isArray(traces) ? traces.map(trace) : traces]));
      }
      return display;
    };
    return { ...figure, data: Array.isArray(figure.data) ? figure.data.map(trace) : figure.data,
      layout: layout(figure.layout) };
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
      template = nativeCoordinateHoverTemplate(plot, trace);
      if (!template) return sourceTemplate;
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
      const sourceTemplate = unfittedHoverTemplate(trace);
      let state = precisionTemplates.get(trace);
      if (!state || sourceTemplate !== state.display) {
        state = { source: sourceTemplate ?? fullTrace.hovertemplate };
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

  // Opt-in hover eligibility only; Plotly still selects the nearest real point.
  const hover_trace_selections = new WeakMap();
  const hover_trace_titles = {all:'Hover all traces', lines:'Hover lines', markers:'Hover markers'};
  function hover_trace_selection_eligible(figure, selection) {
    if (selection?.hover_trace_selection !== 'lines-markers' || !Array.isArray(figure?.data)) return false;
    const traces = figure.data.filter(trace => trace.visible !== false && trace.visible !== 'legendonly');
    if (!traces.length || traces.some(trace => !['scatter', 'scattergl'].includes(trace.type || 'scatter'))) return false;
    const eligible = traces.filter(trace => trace.hoverinfo !== 'skip');
    return eligible.some(trace => String(trace.mode || '').split('+').includes('lines')) &&
      eligible.some(trace => String(trace.mode || '').split('+').includes('markers'));
  }
  function hover_trace_controls(plot) {
    const state = hover_trace_selections.get(plot), closest = plot?._fullLayout?.hovermode === 'closest';
    for (const [kind, title] of Object.entries(hover_trace_titles)) {
      const button = plot?.querySelector?.(`.modebar-btn[data-title="${title}"]`);
      if (!button) continue;
      const selected = (state?.kind || 'all') === kind;
      button.setAttribute('role', 'button'); button.setAttribute('tabindex', '0');
      button.setAttribute('aria-label', title); button.setAttribute('title', title);
      button.setAttribute('aria-pressed', String(selected));
      button.setAttribute('aria-disabled', String(!closest));
      button.classList?.toggle('active', selected);
    }
  }
  function clear_hover_trace_selection(plot) {
    const state = hover_trace_selections.get(plot);
    if (!state) return;
    state.disposed = true;
    plot.removeListener?.('plotly_relayout', state.relayout);
    plot.removeListener?.('plotly_afterplot', state.afterplot);
    // This synchronous teardown precedes react/purge, never a scientific source edit.
    for (const [trace, entry] of state.originals) {
      if (trace.hoverinfo === 'skip' && (trace.hovertemplate == null || trace.hovertemplate === '')) {
        if (entry.info == null) delete trace.hoverinfo; else trace.hoverinfo = entry.info;
        if (entry.template == null) delete trace.hovertemplate; else trace.hovertemplate = entry.template;
      }
    }
    state.originals.clear(); hover_trace_selections.delete(plot);
  }
  async function restore_hover_trace_entries(plot, state) {
    for (const [trace, entry] of state.originals) {
      if (state.disposed || !plot._fullLayout) break;
      const index = plot.data?.indexOf(trace);
      if (index < 0) continue;
      const patch = {};
      if (trace.hoverinfo === 'skip') patch.hoverinfo = [entry.info ?? null];
      // Preserve a newer authored template instead of restoring our old value.
      if (trace.hovertemplate == null || trace.hovertemplate === '') patch.hovertemplate = [entry.template ?? null];
      if (Object.keys(patch).length) await window.Plotly.restyle(plot, patch, [index]);
    }
    state.originals.clear();
  }
  async function apply_hover_trace_kind(plot, state) {
    if (state.disposed || !plot._fullLayout) return;
    if (plot._fullLayout.hovermode !== 'closest') state.kind = 'all';
    if (state.kind !== 'all') for (let index = 0; index < plot.data.length; index++) {
      if (state.disposed) break;
      const trace = plot.data[index], full = plot._fullData?.[index] || trace;
      if (full.visible === false || full.visible === 'legendonly' || full.hoverinfo === 'skip' ||
          String(full.mode || trace.mode || '').split('+').includes(state.kind)) continue;
      const coordinate_patch = fittedHoverTemplates.get(trace);
      const template = coordinate_patch && sameTickValue(trace.hovertemplate, coordinate_patch.display)
        ? coordinate_patch.original : trace.hovertemplate;
      state.originals.set(trace, {info:trace.hoverinfo, template});
      // A precision/authored template overrides hoverinfo in Plotly defaults.
      // Clear it only on an excluded display trace and restore it on release.
      await window.Plotly.restyle(plot, {hoverinfo:['skip'], hovertemplate:['']}, [index]);
    }
    if (!state.disposed) { await settleTickDensity(plot); hover_trace_controls(plot); }
  }
  function queue_hover_trace_selection(plot, operation) {
    const state = hover_trace_selections.get(plot);
    if (!state) return Promise.resolve().then(operation);
    const next = state.promise.catch(() => {}).then(() => state.disposed ? undefined : operation(state));
    state.promise = next;
    return next;
  }
  function bind_hover_trace_selection(plot, selection) {
    if (!hover_trace_selection_eligible(plot, selection)) { clear_hover_trace_selection(plot); return; }
    if (hover_trace_selections.has(plot)) { hover_trace_controls(plot); return; }
    const state = {kind:'all', originals:new Map(), promise:Promise.resolve(), disposed:false};
    state.relayout = event => {
      if (Object.prototype.hasOwnProperty.call(event || {}, 'hovermode') && plot._fullLayout?.hovermode !== 'closest') {
        set_hover_trace_selection(plot, 'all').catch(error => window.console?.error?.('Hover selection failed', error));
      }
    };
    state.afterplot = () => hover_trace_controls(plot);
    hover_trace_selections.set(plot, state);
    plot.on?.('plotly_relayout', state.relayout); plot.on?.('plotly_afterplot', state.afterplot);
    hover_trace_controls(plot);
  }
  function set_hover_trace_selection(plot, kind) {
    if (!Object.prototype.hasOwnProperty.call(hover_trace_titles, kind)) return Promise.resolve();
    return queue_hover_trace_selection(plot, async state => {
      if (!state || (kind !== 'all' && plot._fullLayout?.hovermode !== 'closest')) return;
      await restore_hover_trace_entries(plot, state);
      if (state.disposed) return;
      state.kind = kind;
      await apply_hover_trace_kind(plot, state);
    });
  }
  async function settle_hover_trace_selection(plot) {
    let pending;
    do { pending = hover_trace_selections.get(plot)?.promise; if (pending) await pending; }
    while (pending && pending !== hover_trace_selections.get(plot)?.promise);
  }
  function refresh_hover_trace_selection(plot, operation) {
    if (!hover_trace_selections.has(plot)) return operation();
    return queue_hover_trace_selection(plot, async state => {
      await restore_hover_trace_entries(plot, state);
      if (state.disposed) return;
      await operation();
      await apply_hover_trace_kind(plot, state);
    });
  }
  function hover_trace_selection_data(plot) {
    if (!hover_trace_selections.has(plot)) return Promise.resolve(plot.data || []);
    return queue_hover_trace_selection(plot, async state => {
      await restore_hover_trace_entries(plot, state);
      await settleTickDensity(plot);
      const data = JSON.parse(JSON.stringify(plot.data || []));
      await apply_hover_trace_kind(plot, state);
      return data;
    });
  }
  function hover_trace_selection_buttons(figure, selection) {
    if (!hover_trace_selection_eligible(figure, selection)) return [];
    const paths = {all:'M2 9H9V2H11V9H18V11H11V18H9V11H2Z',lines:'M2 15L7 5L13 11L17 2L19 3L14 15L8 9L4 17Z',markers:'M3 3H8V8H3ZM12 12H17V17H12Z'};
    return Object.entries(hover_trace_titles).map(([kind, title]) => ({
      name:`hover_trace_${kind}`, title,
      icon:{width:20,height:20,path:paths[kind]},
      click:plot => set_hover_trace_selection(plot, kind)
    }));
  }

  window.GenAppPlotlyLayout = {
    hover_trace_selection_buttons,
    bind_hover_trace_selection,
    clear_hover_trace_selection,
    set_hover_trace_selection,
    settle_hover_trace_selection,
    refresh_hover_trace_selection,
    hover_trace_selection_data,
    queuePresentationFit,
    applyFigureTitleOverflow,
    subplotSpacingUpdate,
    applySubplotSpacing,
    axisTitleClearanceUpdate,
    tickLabelRows,
    settleTickDensity,
    nonOverlappingTicks,
    tickDensityUpdate,
    applyTickDensity,
    validNumericTickFormat,
    prepareNumericTickFormat,
    prepareHoverNameDisplay,
    prepare_hover_name_suppression,
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
