(() => {
  "use strict";

  const object = (value) => value && typeof value === "object" && !Array.isArray(value);
  const copy = (value) => object(value) ? { ...value } : {};

  function profilesFromRegistry(registry) {
    if (!object(registry)) return {};
    if (registry.schema_version === 1 && object(registry.profiles)) return registry.profiles;
    return registry; // compatibility with registries generated before schema versioning
  }

  function mergeProfile(base, override) {
    const merged = { ...base, ...override };
    ["font", "background", "grid", "legend", "palette", "group_palettes"].forEach((key) => {
      merged[key] = { ...copy(base?.[key]), ...copy(override?.[key]) };
    });
    merged.palette_variants = {};
    const variantNames = new Set([
      ...Object.keys(copy(base?.palette_variants)),
      ...Object.keys(copy(override?.palette_variants))
    ]);
    variantNames.forEach((name) => {
      merged.palette_variants[name] = {
        ...copy(base?.palette_variants?.[name]),
        ...copy(override?.palette_variants?.[name])
      };
    });
    merged.styles = { ...copy(base?.styles) };
    Object.entries(copy(override?.styles)).forEach(([name, style]) => {
      merged.styles[name] = { ...copy(merged.styles[name]), ...copy(style) };
    });
    return merged;
  }

  function resolveProfile(name, registry = window.GENAPP_PLOT_PRESENTATIONS, warn = console.warn) {
    const profiles = profilesFromRegistry(registry);
    const visit = (current, seen) => {
      if (!current) return {};
      if (seen.has(current)) {
        warn?.("[ui2] plot presentation inheritance cycle at: " + current);
        return {};
      }
      if (!object(profiles[current])) {
        warn?.("[ui2] unknown plot presentation profile: " + current);
        return {};
      }
      const next = new Set(seen);
      next.add(current);
      const profile = profiles[current];
      return mergeProfile(visit(String(profile.inherits || "").trim(), next), profile);
    };
    return visit(String(name || "").trim(), new Set());
  }

  function groupSlot(seriesGroup, channel, length) {
    if (typeof seriesGroup !== "string" || typeof channel !== "string" ||
        !Number.isInteger(length) || length < 1) return null;
    const suffix = seriesGroup.split("_").pop();
    if (!/^[0-9a-f]{24}$/i.test(suffix) ||
        !["color", "line_style", "marker", "marker_pattern"].includes(channel)) return null;
    let hash = 14695981039346656037n;
    for (const character of channel + "\0" + suffix.toLowerCase()) {
      hash ^= BigInt(character.codePointAt(0));
      hash = BigInt.asUintN(64, hash * 1099511628211n);
    }
    return Number(hash % BigInt(length));
  }

  function presentationColor(value, profile, theme = {}) {
    if (typeof value !== "string" || !value.trim()) return null;
    const token = value.trim();
    const palette = profile?.palette?.[token];
    if (typeof palette === "string" && palette.trim()) return palette.trim();
    if (typeof theme[token] === "string" && theme[token].trim()) return theme[token].trim();
    return token;
  }

  function profileForSurface(profile, plotSurface, paperSurface,
      surfacePolicy = window.GenAppPlotlySurface) {
    if (!object(profile)) return profile;
    const basePalette = copy(profile.palette);
    const variants = copy(profile.palette_variants);
    if (!Object.keys(variants).length ||
        typeof surfacePolicy?.parseColor !== "function" ||
        typeof surfacePolicy?.isDark !== "function") {
      return { ...profile, palette: basePalette };
    }
    const parsedPlot = surfacePolicy.parseColor(plotSurface);
    if (!parsedPlot || (parsedPlot.a < 1 && !surfacePolicy.parseColor(paperSurface))) {
      return { ...profile, palette: basePalette };
    }
    const variantName = surfacePolicy.isDark(plotSurface, paperSurface)
      ? "dark_surface"
      : "light_surface";
    return {
      ...profile,
      palette: { ...basePalette, ...copy(variants[variantName]) }
    };
  }

  function safeNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : null;
  }

  function groupValue(profile, policy, trace, channel) {
    const name = policy?.groupPalette;
    const values = name && profile?.group_palettes?.[name]?.[channel];
    const slot = Array.isArray(values)
      ? groupSlot(trace?.meta?.series_group, channel, values.length)
      : null;
    return slot == null ? null : values[slot];
  }

  function styleTrace(trace, policy, profile, theme = {}) {
    if (!object(trace) || !object(policy)) return trace;
    try {
      const token = typeof policy.token === "string" ? policy.token.trim() : "";
      const defaults = { context: { color: "rgba(113, 196, 232, 0.42)" } };
      const style = token ? (profile?.styles?.[token] || defaults[token]) : null;
      if (!object(style) && !policy.legend && !policy.groupPalette) return trace;
      const styled = { ...trace };
      const traceType = String(trace.type || "scatter").toLowerCase();
      const supportsLine = traceType === "scatter" || traceType === "scatter3d";
      const supportsMarkerSymbol = supportsLine;
      const supportsPattern = traceType === "bar" || traceType === "histogram";
      const groupedColor = groupValue(profile, policy, trace, "color");
      const color = presentationColor(groupedColor || style?.color, profile, theme);
      const lineStyle = groupValue(profile, policy, trace, "line_style") || style?.line_style;
      const marker = groupValue(profile, policy, trace, "marker") || style?.marker;
      const markerPattern = groupValue(profile, policy, trace, "marker_pattern") || style?.marker_pattern;
      const lineWidth = safeNumber(style?.line_width);
      const markerSize = safeNumber(style?.marker_size);
      const opacity = safeNumber(style?.opacity);
      if (supportsLine && (color || lineWidth !== null || typeof lineStyle === "string")) {
        styled.line = { ...copy(trace.line),
          ...(color ? { color } : {}),
          ...(lineWidth !== null ? { width: lineWidth } : {}),
          ...(typeof lineStyle === "string" ? { dash: lineStyle } : {}) };
      }
      if (color || (supportsMarkerSymbol && markerSize !== null) ||
          (supportsMarkerSymbol && typeof marker === "string") ||
          (supportsPattern && typeof markerPattern === "string")) {
        styled.marker = { ...copy(trace.marker),
          ...(color ? { color } : {}),
          ...(supportsMarkerSymbol && markerSize !== null ? { size: markerSize } : {}),
          ...(supportsMarkerSymbol && typeof marker === "string" ? { symbol: marker } : {}) };
        if (supportsPattern && typeof markerPattern === "string") {
          styled.marker.pattern = { fillmode: "overlay", ...copy(trace.marker?.pattern), shape: markerPattern };
        }
      }
      if (opacity !== null) styled.opacity = opacity;
      const errorColor = presentationColor(style?.error_bar_color || color, profile, theme);
      ["error_x", "error_y", "error_z"].forEach((key) => {
        if (errorColor && object(trace[key])) styled[key] = { ...trace[key], color: errorColor };
      });
      const legend = typeof policy.legend === "string" ? policy.legend : style?.legend;
      if (legend === "hide" || legend === "hidden") styled.showlegend = false;
      if (legend === "show" || legend === "shown") styled.showlegend = true;
      return styled;
    } catch (_error) {
      return trace;
    }
  }

  // Collection-level legend policy applies only to detached display traces.
  function styleTraces(data, traceRoles = {}, profile = {}, theme = {}) {
    if (!Array.isArray(data)) return data;
    const policyFor = (trace) => {
      const role = trace?.meta?.series_role;
      const raw = typeof role === "string" ? traceRoles?.[role] : null;
      return typeof raw === "string" ? { token: raw } : raw;
    };
    // Proxies exist only in display data; rebuilding must never accumulate them.
    data = data.filter((trace) => trace?._genappCompactLegendProxy !== true);
    const styled = data.map((trace) => styleTrace(trace, policyFor(trace), profile, theme));
    const families = new Map();
    data.forEach((trace, index) => {
      const legend = policyFor(trace)?.legend;
      if (!object(trace) || !object(legend) || legend.mode !== "compact" ||
          typeof legend.title !== "string" || !legend.title.trim() ||
          legend.title.length > 200 || trace.visible === false) return;
      // Existing legend slots and producer groups remain separate.
      const key = JSON.stringify([trace.meta.series_role,
        trace.legend || "legend", trace.legendgroup || ""]);
      if (!families.has(key)) families.set(key, { title: legend.title.trim(), indices: [] });
      families.get(key).indices.push(index);
    });
    families.forEach(({ title, indices }, key) => {
      const individual = indices.length <= 4;
      const first = data[indices[0]];
      const group = first.legendgroup || "genapp_compact_" + key;
      indices.forEach((index) => {
        styled[index] = { ...styled[index],
          legendgroup: group,
          showlegend: individual,
          legendgrouptitle: { ...copy(styled[index].legendgrouptitle),
            text: individual ? title + " (" + indices.length + " traces)" : "" }
        };
      });
      if (!individual) {
        // A sample-free legend key avoids renaming any real trace or hover label.
        const proxy = styleTrace({
          type: first.type === "scatter3d" ? "scatter3d" : "scatter",
          mode: "lines", x: [null], y: [null],
          ...(first.type === "scatter3d" ? { z: [null], scene: first.scene } :
            { xaxis: first.xaxis, yaxis: first.yaxis }),
          name: title + " (" + indices.length + " traces)",
          legend: first.legend, legendgroup: group, legendrank: first.legendrank,
          showlegend: true, hoverinfo: "skip", opacity: 1,
          _genappCompactLegendProxy: true
        }, { token: policyFor(first)?.token }, profile, theme);
        // Family opacity styles describe plotted samples, not this generic key.
        styled.push({ ...proxy, opacity: 1, showlegend: true });
      }
    });
    return styled;
  }

  window.GenAppPlotPresentation = Object.freeze({
    apiVersion: 1,
    resolveProfile,
    profileForSurface,
    groupSlot,
    styleTrace,
    styleTraces
  });
})();
