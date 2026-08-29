(function () {
  "use strict";

  const LIGHT_TEXT = "#17201d";
  const DARK_TEXT = "#eef4f1";

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function parseChannel(value) {
    const token = String(value || "").trim();
    const number = Number.parseFloat(token);
    if (!Number.isFinite(number)) {
      return null;
    }
    return token.endsWith("%") ? clamp(number * 2.55, 0, 255) : clamp(number, 0, 255);
  }

  function parseAlpha(value) {
    const token = String(value == null ? "1" : value).trim();
    const number = Number.parseFloat(token);
    if (!Number.isFinite(number)) {
      return null;
    }
    return token.endsWith("%") ? clamp(number / 100, 0, 1) : clamp(number, 0, 1);
  }

  function parseDirect(value) {
    const raw = String(value || "").trim().toLowerCase();
    if (raw === "transparent") {
      return { r: 0, g: 0, b: 0, a: 0 };
    }
    const hex = raw.match(/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
    if (hex) {
      let token = hex[1];
      if (token.length <= 4) {
        token = token.split("").map((character) => character + character).join("");
      }
      return {
        r: parseInt(token.slice(0, 2), 16),
        g: parseInt(token.slice(2, 4), 16),
        b: parseInt(token.slice(4, 6), 16),
        a: token.length === 8 ? parseInt(token.slice(6, 8), 16) / 255 : 1
      };
    }
    const rgb = raw.match(/^rgba?\((.*)\)$/i);
    if (!rgb) {
      return null;
    }
    const slashParts = rgb[1].split("/");
    const channels = slashParts[0].includes(",")
      ? slashParts[0].split(",")
      : slashParts[0].trim().split(/\s+/);
    let alphaToken = slashParts[1];
    if (channels.length === 4 && alphaToken == null) {
      alphaToken = channels.pop();
    }
    if (channels.length !== 3) {
      return null;
    }
    const parsed = channels.map(parseChannel);
    const alpha = parseAlpha(alphaToken);
    if (parsed.some((channel) => channel == null) || alpha == null) {
      return null;
    }
    return { r: parsed[0], g: parsed[1], b: parsed[2], a: alpha };
  }

  function normalizeBrowserColor(value) {
    if (typeof document === "undefined" || typeof document.createElement !== "function") {
      return null;
    }
    const canvas = document.createElement("canvas");
    const context = canvas?.getContext?.("2d");
    if (!context) {
      return null;
    }
    context.fillStyle = "#010203";
    context.fillStyle = String(value || "");
    return context.fillStyle === "#010203" && String(value || "").trim().toLowerCase() !== "#010203"
      ? null
      : context.fillStyle;
  }

  function parseColor(value) {
    const direct = parseDirect(value);
    if (direct) {
      return direct;
    }
    const normalized = normalizeBrowserColor(value);
    return normalized ? parseDirect(normalized) : null;
  }

  function composite(foreground, background) {
    const front = parseColor(foreground);
    const back = parseColor(background) || { r: 255, g: 255, b: 255, a: 1 };
    if (!front) {
      return back;
    }
    const alpha = front.a + back.a * (1 - front.a);
    if (alpha <= 0) {
      return { r: 255, g: 255, b: 255, a: 1 };
    }
    return {
      r: (front.r * front.a + back.r * back.a * (1 - front.a)) / alpha,
      g: (front.g * front.a + back.g * back.a * (1 - front.a)) / alpha,
      b: (front.b * front.a + back.b * back.a * (1 - front.a)) / alpha,
      a: alpha
    };
  }

  function luminance(value, background) {
    const rgb = composite(value, background);
    const channel = (input) => {
      const normalized = input / 255;
      return normalized <= 0.03928
        ? normalized / 12.92
        : ((normalized + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
  }

  function isDark(value, background) {
    return luminance(value, background) < 0.45;
  }

  function tokensFor(value, background) {
    const dark = isDark(value, background);
    const text = dark ? DARK_TEXT : LIGHT_TEXT;
    return {
      dark,
      text,
      grid: dark ? "rgba(238, 244, 241, 0.16)" : "rgba(23, 32, 29, 0.16)",
      border: dark ? "rgba(238, 244, 241, 0.42)" : "rgba(23, 32, 29, 0.42)",
      zeroLine: dark ? "rgba(238, 244, 241, 0.58)" : "rgba(23, 32, 29, 0.58)",
      translucent: dark ? "rgba(26, 32, 31, 0.88)" : "rgba(255, 255, 255, 0.88)"
    };
  }

  function legendKeys(layout) {
    const keys = Object.keys(layout || {}).filter((key) => /^legend\d*$/.test(key));
    return keys.length ? keys : ["legend"];
  }

  function apply(layout, options) {
    const result = layout || {};
    const fallback = options?.fallbackSurface || "#ffffff";
    result.paper_bgcolor = result.paper_bgcolor || fallback;
    result.plot_bgcolor = result.plot_bgcolor || result.paper_bgcolor;
    const paper = tokensFor(result.paper_bgcolor, fallback);
    const plot = tokensFor(result.plot_bgcolor, result.paper_bgcolor);

    result.font = Object.assign({}, result.font || {}, { color: paper.text });
    if (result.title != null) {
      result.title = typeof result.title === "object"
        ? Object.assign({}, result.title, { font: Object.assign({}, result.title.font || {}, { color: paper.text }) })
        : { text: result.title, font: { color: paper.text } };
    }
    Object.keys(result).filter((key) => /^(xaxis|yaxis)\d*$/.test(key)).forEach((key) => {
      const axis = result[key];
      if (!axis) {
        return;
      }
      result[key] = Object.assign({}, axis, {
        color: plot.text,
        tickcolor: plot.border,
        linecolor: plot.border,
        gridcolor: plot.grid,
        zerolinecolor: plot.zeroLine,
        tickfont: Object.assign({}, axis.tickfont || {}, { color: plot.text }),
        title: axis.title == null ? axis.title : (typeof axis.title === "object"
          ? Object.assign({}, axis.title, { font: Object.assign({}, axis.title.font || {}, { color: plot.text }) })
          : { text: axis.title, font: { color: plot.text } })
      });
    });
    legendKeys(result).forEach((key) => {
      const legend = result[key] || {};
      const background = legend.bgcolor || paper.translucent;
      const legendTokens = tokensFor(background, result.paper_bgcolor);
      result[key] = Object.assign({}, legend, {
        bgcolor: background,
        bordercolor: legendTokens.border,
        font: Object.assign({}, legend.font || {}, { color: legendTokens.text })
      });
    });
    result.hoverlabel = Object.assign({}, result.hoverlabel || {}, {
      bgcolor: result.hoverlabel?.bgcolor || plot.translucent,
      bordercolor: plot.border,
      font: Object.assign({}, result.hoverlabel?.font || {}, { color: tokensFor(result.hoverlabel?.bgcolor || plot.translucent, result.plot_bgcolor).text })
    });
    if (Array.isArray(result.annotations)) {
      result.annotations = result.annotations.map((annotation) => {
        if (!annotation) {
          return annotation;
        }
        const annotationTokens = annotation.bgcolor
          ? tokensFor(annotation.bgcolor, result.paper_bgcolor)
          : paper;
        return Object.assign({}, annotation, {
          bordercolor: annotation.bordercolor || annotationTokens.border,
          font: Object.assign({}, annotation.font || {}, { color: annotationTokens.text })
        });
      });
    }
    result.modebar = Object.assign({}, result.modebar || {}, {
      bgcolor: result.paper_bgcolor,
      color: paper.text,
      activecolor: paper.text
    });
    return result;
  }

  window.GenAppPlotlySurface = {
    apply,
    composite,
    isDark,
    luminance,
    parseColor,
    tokensFor
  };
}());
