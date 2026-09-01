(function () {
  "use strict";

  const AXIS_KEY = /^(xaxis|yaxis)\d*$/;
  const PLAIN_TITLE = /^[^<>]*$/;

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

  window.GenAppPlotlyLayout = {
    applyAxisTitleOverflow,
    axisTitleWrapUpdate,
    titleText,
    wrapPlainText
  };
}());
