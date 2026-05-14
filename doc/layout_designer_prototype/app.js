(function () {
  "use strict";

  var state = {};
  var selected = null;
  var draggedField = null;
  var draggedPrimitive = null;
  var designerActive = true;
  var undoStack = [];
  var historyPaused = false;
  var HISTORY_LIMIT = 40;

  var canvas = document.getElementById("canvas");
  var shellNode = document.querySelector(".designer-shell");
  var designerActiveInput = document.getElementById("designer-active");
  var selectionLabel = document.getElementById("selection-label");
  var templateJson = document.getElementById("template-json");
  var templateName = document.getElementById("template-name");
  var templateNotes = document.getElementById("template-notes");
  var undoButton = document.getElementById("undo-action");
  var inspectorMode = "below";

  var form = {
    id: document.getElementById("item-id"),
    parent: document.getElementById("item-parent"),
    location: document.getElementById("item-location"),
    columnSpan: document.getElementById("item-column-span"),
    rowSpan: document.getElementById("item-row-span"),
    controlWidth: document.getElementById("item-control-width"),
    size: document.getElementById("item-size"),
    childMode: document.getElementById("item-child-mode"),
    align: document.getElementById("item-align"),
    gap: document.getElementById("item-gap")
  };

  function freshState() {
    return {
      panels: {
        root: {
          id: "root",
          parent: null,
          childMode: "stack",
          size: ["auto", [1, 1]],
          location: ["next", "full"],
          label: [1, 1],
          data: [1, 2],
          align: "left",
          gap: "8px"
        },
        header: {
          id: "header",
          parent: "root",
          childMode: "stack",
          size: ["auto", "auto"],
          location: ["next", "full"],
          label: [1, 1],
          data: [2, 1],
          align: "center",
          gap: "5px"
        },
        body: {
          id: "body",
          parent: "root",
          childMode: "stack",
          size: ["auto", [1, 1]],
          location: ["next", "full"],
          align: "left",
          gap: "8px"
        },
        inputpanel: {
          id: "inputpanel",
          parent: "body",
          childMode: "stack",
          size: ["auto", [1, 1]],
          location: ["next", "full"],
          label: [1, 1],
          data: [1, 2],
          align: "left",
          gap: "5px"
        },
        controls: {
          id: "controls",
          parent: "body",
          childMode: "compact-grid",
          size: ["auto", [1, 1]],
          location: ["next", "full"],
          label: [1, 1],
          data: [1, 2],
          align: "left",
          gap: "5px",
          runtimeSlot: true
        },
        msgspanel: {
          id: "msgspanel",
          parent: "body",
          childMode: "stack",
          size: ["auto", [1, 1]],
          location: ["next", "full"],
          label: [1, 1],
          data: [1, 2],
          align: "left",
          gap: "5px"
        },
        resultpanel: {
          id: "resultpanel",
          parent: "body",
          childMode: "stack",
          size: ["auto", [1, 1]],
          location: ["next", "full"],
          label: [1, 1],
          data: [1, 2],
          align: "left",
          gap: "5px"
        },
        footer: {
          id: "footer",
          parent: "root",
          childMode: "stack",
          size: ["auto", "auto"],
          location: ["next", "full"],
          label: [1, 1],
          data: [2, 1],
          align: "center",
          gap: "5px"
        }
      },
      fields: {
        module_header: {
          id: "module_header",
          role: "header",
          type: "label",
          parent: "header",
          location: ["next", "full"],
          align: "center"
        },
        input_file: {
          id: "input_file",
          role: "input",
          type: "file",
          label: "Input data file",
          parent: "inputpanel",
          location: ["next", "next"],
          align: "left"
        },
        cutoff: {
          id: "cutoff",
          role: "input",
          type: "float",
          label: "Cutoff",
          value: "12.5",
          parent: "inputpanel",
          location: ["next", "next"],
          align: "left",
          controlWidth: "normal"
        },
        interpolation_method: {
          id: "interpolation_method",
          role: "input",
          type: "select",
          label: "Interpolation method",
          value: "cubic spline",
          parent: "inputpanel",
          location: ["next", "next"],
          align: "left"
        },
        normalize_output: {
          id: "normalize_output",
          role: "input",
          type: "checkbox",
          label: "Normalize output",
          value: "checked",
          parent: "inputpanel",
          location: ["next", "next"],
          align: "left"
        },
        progress_html: {
          id: "progress_html",
          role: "message",
          type: "html",
          label: "Run status",
          parent: "msgspanel",
          location: ["next", "full"],
          align: "left"
        },
        lineplot: {
          id: "lineplot",
          role: "output",
          type: "plotly",
          label: "Interpolated curve",
          parent: "resultpanel",
          location: ["next", "full"],
          align: "left"
        },
          output_report: {
          id: "output_report",
          role: "output",
          type: "textarea",
          label: "Output report",
          parent: "resultpanel",
          location: ["next", "full"],
          align: "left"
        }
      },
      runtimeFields: {
        b_submit: {
          id: "b_submit",
          role: "runtime",
          type: "button",
          label: "Submit",
          parent: "controls",
          location: ["next", "next"],
          align: "left",
          generated: true
        },
        b_reset: {
          id: "b_reset",
          role: "runtime",
          type: "button",
          label: "Reset",
          parent: "controls",
          location: ["same", "next"],
          align: "left",
          generated: true
        },
        module_progress: {
          id: "module_progress",
          role: "runtime",
          type: "status",
          label: "Progress",
          parent: "msgspanel",
          location: ["next", "full"],
          align: "left",
          generated: true
        },
        module_output_msgs: {
          id: "module_output_msgs",
          role: "runtime",
          type: "messages",
          label: "Output messages",
          parent: "msgspanel",
          location: ["next", "full"],
          align: "left",
          generated: true
        },
        module_output_textarea: {
          id: "module_output_textarea",
          role: "runtime",
          type: "textarea",
          label: "Raw output textarea",
          parent: "resultpanel",
          location: ["next", "full"],
          align: "left",
          hidden: true,
          generated: true
        }
      }
    };
  }

  function blankState() {
    return {
      panels: {
        root: {
          id: "root",
          parent: null,
          childMode: "stack",
          size: ["auto", [1, 1]],
          location: ["next", "full"],
          label: [1, 1],
          data: [1, 2],
          align: "left",
          gap: "8px"
        },
        body: {
          id: "body",
          parent: "root",
          childMode: "stack",
          size: ["auto", [1, 1]],
          location: ["next", "full"],
          align: "left",
          gap: "8px"
        },
        inputpanel: {
          id: "inputpanel",
          parent: "body",
          childMode: "stack",
          size: ["auto", [1, 1]],
          location: ["next", "full"],
          label: [1, 1],
          data: [1, 2],
          align: "left",
          gap: "5px"
        },
        controls: {
          id: "controls",
          parent: "body",
          childMode: "compact-grid",
          size: ["auto", [1, 1]],
          location: ["next", "full"],
          label: [1, 1],
          data: [1, 2],
          align: "left",
          gap: "5px",
          runtimeSlot: true
        },
        msgspanel: {
          id: "msgspanel",
          parent: "body",
          childMode: "stack",
          size: ["auto", [1, 1]],
          location: ["next", "full"],
          label: [1, 1],
          data: [1, 2],
          align: "left",
          gap: "5px"
        },
        resultpanel: {
          id: "resultpanel",
          parent: "body",
          childMode: "stack",
          size: ["auto", [1, 1]],
          location: ["next", "full"],
          label: [1, 1],
          data: [1, 2],
          align: "left",
          gap: "5px"
        }
      },
      fields: {},
      runtimeFields: defaultRuntimeFields()
    };
  }

  function defaultRuntimeFields() {
    return {
      b_submit: {
        id: "b_submit",
        role: "runtime",
        type: "button",
        label: "Submit",
        parent: "controls",
        location: ["next", "next"],
        align: "left",
        generated: true
      },
      b_reset: {
        id: "b_reset",
        role: "runtime",
        type: "button",
        label: "Reset",
        parent: "controls",
        location: ["same", "next"],
        align: "left",
        generated: true
      },
      module_progress: {
        id: "module_progress",
        role: "runtime",
        type: "status",
        label: "Progress",
        parent: "msgspanel",
        location: ["next", "full"],
        align: "left",
        generated: true
      },
      module_output_msgs: {
        id: "module_output_msgs",
        role: "runtime",
        type: "messages",
        label: "Output messages",
        parent: "msgspanel",
        location: ["next", "full"],
        align: "left",
        generated: true
      },
      module_output_textarea: {
        id: "module_output_textarea",
        role: "runtime",
        type: "textarea",
        label: "Raw output textarea",
        parent: "resultpanel",
        location: ["next", "full"],
        align: "left",
        hidden: true,
        generated: true
      }
    };
  }

  function panelChildren(parentId) {
    return Object.keys(state.panels)
      .map(function (id) { return state.panels[id]; })
      .filter(function (panel) { return panel.parent === parentId; });
  }

  function fieldChildren(parentId) {
    return Object.keys(state.fields)
      .map(function (id) { return state.fields[id]; })
      .filter(function (field) { return field.parent === parentId; })
      .sort(orderSort);
  }

  function runtimeChildren(parentId) {
    return Object.keys(state.runtimeFields)
      .map(function (id) { return state.runtimeFields[id]; })
      .filter(function (field) { return field.parent === parentId; })
      .sort(orderSort);
  }

  function orderSort(a, b) {
    return (a.layoutOrder || 0) - (b.layoutOrder || 0);
  }

  function selectItem(kind, id) {
    selected = { kind: kind, id: id };
    render();
  }

  function pushHistory(label) {
    if (historyPaused) {
      return;
    }
    undoStack.push({
      label: label || "change",
      state: clone(state),
      selected: clone(selected),
      templateName: templateName.value,
      templateNotes: templateNotes.value,
      inspectorMode: inspectorMode,
      designerActive: designerActive
    });
    if (undoStack.length > HISTORY_LIMIT) {
      undoStack.shift();
    }
    updateUndoButton();
  }

  function undoLast() {
    var snapshot = undoStack.pop();
    if (!snapshot) {
      updateUndoButton();
      return;
    }
    historyPaused = true;
    state = clone(snapshot.state);
    selected = clone(snapshot.selected);
    templateName.value = snapshot.templateName;
    templateNotes.value = snapshot.templateNotes;
    inspectorMode = snapshot.inspectorMode;
    designerActive = snapshot.designerActive;
    designerActiveInput.checked = designerActive;
    historyPaused = false;
    updateUndoButton();
    render();
  }

  function updateUndoButton() {
    if (!undoButton) {
      return;
    }
    undoButton.disabled = undoStack.length === 0;
    undoButton.textContent = undoStack.length ? "Undo " + undoStack[undoStack.length - 1].label : "Undo";
  }

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function render() {
    ensureOrders();
    shellNode.classList.toggle("inspector-below", inspectorMode === "below");
    shellNode.classList.toggle("inspector-collapsed", inspectorMode === "collapsed");
    document.body.classList.toggle("runtime-mode", !designerActive);
    document.body.classList.toggle("designer-disabled", !designerActive);
    canvas.innerHTML = "";
    var shell = document.createElement("div");
    shell.className = "mock-module";
    shell.appendChild(renderPanel("root"));
    canvas.appendChild(shell);
    updateParentOptions();
    updateInspector();
    updateExport();
    updateUndoButton();
  }

  function renderPanel(id) {
    var panel = state.panels[id];
    var node = document.createElement("section");
    node.className = "panel-node";
    node.dataset.panel = id;
    node.style.gap = panel.gap || "5px";
    node.style.textAlign = panel.align || "left";
    if (selected && selected.kind === "panel" && selected.id === id) {
      node.classList.add("selected");
    }

    var title = document.createElement("div");
    title.className = "panel-title";
    title.innerHTML = "<span>" + escapeHtml(id) + "</span><span>panel</span>";
    title.addEventListener("click", function (event) {
      if (!designerActive) {
        return;
      }
      event.stopPropagation();
      selectItem("panel", id);
    });
    if (designerActive) {
      node.appendChild(title);
    }

    var children = document.createElement("div");
    children.className = "panel-children";
    if (panel.childMode === "two-column") {
      children.classList.add("cols-2");
    }
    if (panel.childMode === "three-column") {
      children.classList.add("cols-3");
    }
    if (panel.childMode === "four-column") {
      children.classList.add("cols-4");
    }
    if (panel.childMode === "compact-grid") {
      children.classList.add("compact-grid");
    }
    if (designerActive) {
      children.dataset.dropPanel = id;
      children.addEventListener("dragover", onDragOver);
      children.addEventListener("dragleave", onDragLeave);
      children.addEventListener("drop", onDrop);
    }

    panelChildren(id).forEach(function (child) {
      children.appendChild(renderPanel(child.id));
    });
    fieldChildren(id).forEach(function (field) {
      children.appendChild(renderField(field));
    });
    runtimeChildren(id).forEach(function (field) {
      children.appendChild(renderField(field));
    });

    if (designerActive) {
      var drop = document.createElement("div");
      drop.className = "drop-zone";
      drop.textContent = "Drop fields here";
      children.appendChild(drop);
    }
    node.appendChild(children);

    return node;
  }

  function renderField(field) {
    var node = document.createElement("div");
    node.className = "field-node " + field.role;
    if (field.generated) {
      node.classList.add("generated");
    }
    if (field.hidden && !designerActive) {
      node.classList.add("hidden-runtime");
    }
    node.draggable = false;
    node.dataset.field = field.id;
    applyFieldSpan(node, field);
    if (selected && selected.kind === "field" && selected.id === field.id) {
      node.classList.add("selected");
    }
    node.innerHTML =
      dragHandleHtml(field) +
      '<div class="field-label">' + escapeHtml(field.label || field.id) + fieldMeta(field) + '</div>' +
      '<div class="field-control control-' + escapeHtml(field.controlWidth || "fill") + '">' + fieldControlHtml(field) + '</div>' +
      inlineResizeTools(field);
    node.addEventListener("click", function (event) {
      if (!designerActive) {
        return;
      }
      event.stopPropagation();
      selectItem("field", field.id);
    });
    var handle = node.querySelector(".field-drag-handle");
    if (handle) {
      handle.addEventListener("dragstart", function (event) {
        if (!designerActive) {
          event.preventDefault();
          return;
        }
        event.stopPropagation();
        draggedField = field.id;
      });
      handle.addEventListener("dragend", function () {
        draggedField = null;
      });
    }
    node.querySelectorAll("[data-resize-action]").forEach(function (button) {
      button.addEventListener("click", function (event) {
        event.stopPropagation();
        pushHistory("resize");
        resizeField(field.id, button.dataset.resizeAction);
      });
    });
    return node;
  }

  function inlineResizeTools(field) {
    if (!designerActive || !selected || selected.kind !== "field" || selected.id !== field.id) {
      return "";
    }
    return '<div class="field-resize-tools">' +
      '<button type="button" data-resize-action="span-down">Span -</button>' +
      '<button type="button" data-resize-action="span-up">Span +</button>' +
      '<button type="button" data-resize-action="width-cycle">Width</button>' +
      '<span>span: ' + escapeHtml(field.columnSpan || 1) + ', width: ' + escapeHtml(field.controlWidth || "fill") + '</span>' +
      '</div>';
  }

  function resizeField(fieldId, action) {
    var field = fieldById(fieldId);
    if (!field) {
      return;
    }
    var spans = [1, 2, 3, 4, "full"];
    var widths = ["compact", "normal", "wide", "fill"];
    if (action === "span-up") {
      field.columnSpan = nextChoice(spans, field.columnSpan || 1, 1);
    } else if (action === "span-down") {
      field.columnSpan = nextChoice(spans, field.columnSpan || 1, -1);
    } else if (action === "width-cycle") {
      field.controlWidth = nextChoice(widths, field.controlWidth || "fill", 1);
    }
    render();
  }

  function nextChoice(values, current, direction) {
    var index = values.indexOf(current);
    if (index < 0) {
      index = values.indexOf(String(current));
    }
    if (index < 0) {
      index = 0;
    }
    return values[Math.max(0, Math.min(values.length - 1, index + direction))];
  }

  function dragHandleHtml(field) {
    if (!designerActive) {
      return "";
    }
    return '<div class="field-drag-handle" draggable="true" title="Drag to move ' + escapeHtml(field.id) + '">::</div>';
  }

  function applyFieldSpan(node, field) {
    var columnSpan = field.columnSpan || 1;
    var rowSpan = field.rowSpan || 1;
    node.style.gridColumn = columnSpan === "full" ? "1 / -1" : "span " + columnSpan;
    node.style.gridRow = "span " + rowSpan;
  }

  function fieldMeta(field) {
    if (!designerActive) {
      return "";
    }
    var owner = field.generated ? "runtime-owned" : "module-owned";
    return '<small>' + escapeHtml(field.id + " | " + field.role + " / " + field.type + " | " + owner) + '</small>';
  }

  function fieldControlHtml(field) {
    if (field.generated && field.type === "button") {
      return '<button type="button" class="' + (field.id === "b_reset" ? "secondary" : "") + '">' + escapeHtml(field.label) + '</button>';
    }
    if (field.generated && field.type === "status") {
      return '<div class="status-strip"><span class="status-dot"></span>job status: idle</div>';
    }
    if (field.generated && field.type === "messages") {
      return '<div class="status-strip"><span class="status-dot"></span>runtime messages will appear here</div>';
    }
    if (field.generated && field.type === "textarea") {
      return '<textarea readonly>Hidden raw output textarea injected by GenApp.</textarea>';
    }
    if (field.role === "header") {
      return designerActive ? escapeHtml(field.role + " / " + field.type) : "";
    }
    if (field.role === "message") {
      return '<div class="status-strip"><span class="status-dot"></span>Ready to run; progress messages will stream here.</div>';
    }
    if (field.role === "output" && field.type === "plotly") {
      return '<div class="plot-mock"><svg viewBox="0 0 320 120" role="img" aria-label="Mock plot"><polyline points="8,100 56,86 104,72 152,35 200,56 248,28 312,18"></polyline><line x1="8" y1="104" x2="312" y2="104"></line><line x1="8" y1="12" x2="8" y2="104"></line></svg></div>';
    }
    if (field.role === "output") {
      return '<textarea readonly>Output report preview\\n- job id: pending\\n- results will appear after submit</textarea>';
    }
    if (field.type === "file") {
      return '<input type="file">';
    }
    if (field.type === "float") {
      return '<input type="number" value="' + escapeHtml(field.value || "") + '">';
    }
    if (field.type === "select") {
      return '<select><option>linear</option><option selected>cubic spline</option><option>nearest</option></select>';
    }
    if (field.type === "checkbox") {
      return '<label class="checkbox-field"><input type="checkbox" checked> Enabled</label>';
    }
    return '<input type="text" value="' + escapeHtml(field.value || "") + '">';
  }

  function onDragOver(event) {
    if (!draggedField && !draggedPrimitive) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.classList.add("drag-over");
  }

  function onDragLeave(event) {
    event.stopPropagation();
    event.currentTarget.classList.remove("drag-over");
  }

  function onDrop(event) {
    event.preventDefault();
    event.stopPropagation();
    var panelId = event.currentTarget.dataset.dropPanel;
    event.currentTarget.classList.remove("drag-over");
    if (!panelId) {
      return;
    }
    if (draggedPrimitive) {
      addPrimitiveToPanel(draggedPrimitive, panelId);
      draggedPrimitive = null;
      return;
    }
    if (!draggedField || !fieldById(draggedField)) {
      return;
    }
    pushHistory("move");
    moveFieldToPanel(draggedField, panelId, targetFieldId(event));
    selected = { kind: "field", id: draggedField };
    render();
  }

  function targetFieldId(event) {
    var target = event.target.closest ? event.target.closest(".field-node") : null;
    if (!target || !target.dataset || !target.dataset.field || target.dataset.field === draggedField) {
      return null;
    }
    return target.dataset.field;
  }

  function moveFieldToPanel(fieldId, panelId, beforeFieldId) {
    var field = fieldById(fieldId);
    var beforeField = beforeFieldId ? fieldById(beforeFieldId) : null;
    field.parent = panelId;
    field.location = ["next", "full"];

    normalizeOrders(panelId, state.fields);
    normalizeOrders(panelId, state.runtimeFields);

    if (beforeField && beforeField.parent === panelId && sameFieldCollection(fieldId, beforeFieldId)) {
      field.layoutOrder = beforeField.layoutOrder - 0.5;
    } else {
      field.layoutOrder = nextOrder(panelId, field.generated ? state.runtimeFields : state.fields);
    }

    normalizeOrders(panelId, field.generated ? state.runtimeFields : state.fields);
  }

  function sameFieldCollection(a, b) {
    return !!(state.fields[a] && state.fields[b]) || !!(state.runtimeFields[a] && state.runtimeFields[b]);
  }

  function fieldById(id) {
    return state.fields[id] || state.runtimeFields[id];
  }

  function ensureOrders() {
    Object.keys(state.panels).forEach(function (panelId) {
      normalizeOrders(panelId, state.fields);
      normalizeOrders(panelId, state.runtimeFields);
    });
  }

  function normalizeOrders(panelId, collection) {
    Object.keys(collection)
      .map(function (id) { return collection[id]; })
      .filter(function (field) { return field.parent === panelId; })
      .sort(orderSort)
      .forEach(function (field, index) {
        field.layoutOrder = index + 1;
      });
  }

  function nextOrder(panelId, collection) {
    return Object.keys(collection)
      .map(function (id) { return collection[id]; })
      .filter(function (field) { return field.parent === panelId; })
      .reduce(function (max, field) { return Math.max(max, field.layoutOrder || 0); }, 0) + 1;
  }

  function updateParentOptions() {
    var value = form.parent.value;
    form.parent.innerHTML = "";
    Object.keys(state.panels).forEach(function (id) {
      var option = document.createElement("option");
      option.value = id;
      option.textContent = id;
      form.parent.appendChild(option);
    });
    if (state.panels[value]) {
      form.parent.value = value;
    }
  }

  function updateInspector() {
    var item = selectedItem();
    selectionLabel.textContent = item ? selected.kind + ": " + item.id : "No selection";
    Array.prototype.forEach.call(document.querySelectorAll(".inspector input, .inspector select"), function (control) {
      control.disabled = !item || !designerActive;
    });
    document.getElementById("apply-inspector").disabled = !item || !designerActive;

    if (!item) {
      form.id.value = "";
      form.gap.value = "";
      form.childMode.value = "stack";
      form.columnSpan.value = "1";
      form.rowSpan.value = "1";
      form.controlWidth.value = "fill";
      return;
    }

    form.id.value = item.id;
    form.parent.value = item.parent || "root";
    form.location.value = locationToForm(item.location || ["next", "full"]);
    form.columnSpan.value = String(item.columnSpan || 1);
    form.rowSpan.value = String(item.rowSpan || 1);
    form.controlWidth.value = item.controlWidth || "fill";
    form.size.value = sizeToForm(item.size || ["auto", [1, 1]]);
    form.childMode.value = item.childMode || "stack";
    form.align.value = item.align || "left";
    form.gap.value = item.gap || "5px";
    form.id.disabled = !!item.generated;
    form.parent.disabled = selected.kind === "panel" && selected.id === "root";
    form.columnSpan.disabled = selected.kind === "panel";
    form.rowSpan.disabled = selected.kind === "panel";
    form.controlWidth.disabled = selected.kind === "panel";
    form.size.disabled = selected.kind === "field";
    form.childMode.disabled = selected.kind === "field";
    form.gap.disabled = selected.kind === "field";
  }

  function selectedItem() {
    if (!selected) {
      return null;
    }
    if (selected.kind === "panel") {
      return state.panels[selected.id];
    }
    return state.fields[selected.id] || state.runtimeFields[selected.id];
  }

  function addPanel(kind) {
    addPanelToParent(kind, selected && selected.kind === "panel" ? selected.id : "body");
  }

  function addPanelToParent(kind, parent) {
    pushHistory("add panel");
    var id = uniqueId(kind === "output" ? "resultpanel" : "panel", state.panels);
    state.panels[id] = {
      id: id,
      parent: parent,
      childMode: panelModeForKind(kind),
      size: kind === "two-column" ? ["auto", [1, 1]] : ["auto", [1, 1]],
      location: ["next", "full"],
      label: [1, 1],
      data: [1, 2],
      align: "left",
      gap: "5px"
    };
    selected = { kind: "panel", id: id };
    render();
  }

  function addField(role) {
    addFieldToParent(role, selected && selected.kind === "panel" ? selected.id : role === "message" ? "msgspanel" : role === "output" ? "resultpanel" : "inputpanel");
  }

  function addFieldToParent(role, parent) {
    pushHistory("add field");
    var id = uniqueId(role + "_field", state.fields);
    state.fields[id] = {
      id: id,
      role: role,
      type: role === "output" ? "plot" : role === "message" ? "html" : "text",
      label: id.replace(/_/g, " "),
      parent: parent,
      location: ["next", role === "input" ? "next" : "full"],
      align: "left",
      layoutOrder: nextOrder(parent, state.fields)
    };
    selected = { kind: "field", id: id };
    render();
  }

  function addPrimitiveToPanel(primitive, panelId) {
    if (primitive.kind === "panel") {
      addPanelToParent(primitive.value, panelId);
    } else {
      addFieldToParent(primitive.value, panelId);
    }
  }

  function panelModeForKind(kind) {
    if (kind === "two-column" || kind === "three-column" || kind === "compact-grid") {
      return kind;
    }
    return "stack";
  }

  function applyInspector(event) {
    event.preventDefault();
    var item = selectedItem();
    if (!item) {
      return;
    }

    var oldId = item.id;
    var newId = safeId(form.id.value);
    if (!newId) {
      return;
    }
    pushHistory("edit");
    item.id = newId;
    item.location = formToLocation(form.location.value);
    item.align = form.align.value;

    if (selected.kind === "panel") {
      item.parent = oldId === "root" ? null : form.parent.value;
      item.size = formToSize(form.size.value);
      item.childMode = form.childMode.value;
      item.gap = form.gap.value || "5px";
      if (newId !== oldId) {
        renameKey(state.panels, oldId, newId);
        Object.keys(state.panels).forEach(function (id) {
          if (state.panels[id].parent === oldId) {
            state.panels[id].parent = newId;
          }
        });
        Object.keys(state.fields).forEach(function (id) {
          if (state.fields[id].parent === oldId) {
            state.fields[id].parent = newId;
          }
        });
        selected.id = newId;
      }
    } else {
      item.parent = form.parent.value;
      item.columnSpan = form.columnSpan.value === "full" ? "full" : +form.columnSpan.value;
      item.rowSpan = +form.rowSpan.value;
      item.controlWidth = form.controlWidth.value;
      if (newId !== oldId) {
        renameKey(state.fields[oldId] ? state.fields : state.runtimeFields, oldId, newId);
        selected.id = newId;
      }
    }
    render();
  }

  function applyLiveInspector(event) {
    if (!designerActive || !selected) {
      return;
    }
    if (event && event.target === form.id) {
      return;
    }
    applyInspector({ preventDefault: function () {} });
  }

  function deleteSelected() {
    if (!selected || selected.id === "root") {
      return;
    }
    if (selected.kind === "field") {
      if (state.runtimeFields[selected.id]) {
        return;
      }
      pushHistory("delete");
      delete state.fields[selected.id];
    } else {
      pushHistory("delete");
      var target = selected.id;
      panelChildren(target).forEach(function (child) {
        child.parent = state.panels[target].parent || "root";
      });
      fieldChildren(target).forEach(function (field) {
        field.parent = state.panels[target].parent || "root";
      });
      runtimeChildren(target).forEach(function (field) {
        field.parent = state.panels[target].parent || "root";
      });
      delete state.panels[target];
    }
    selected = null;
    render();
  }

  function cleanLayout(skipHistory) {
    if (!skipHistory) {
      pushHistory("clean");
    }
    Object.keys(state.panels).forEach(function (id) {
      var panel = state.panels[id];
      if (panel.parent && !state.panels[panel.parent]) {
        panel.parent = "root";
      }
      panel.gap = panel.gap || "5px";
      panel.align = panel.align || "left";
    });
    Object.keys(state.fields).forEach(function (id) {
      var field = state.fields[id];
      if (!state.panels[field.parent]) {
        field.parent = "inputpanel";
      }
      field.location = field.location || ["next", "full"];
      field.columnSpan = field.columnSpan || 1;
      field.rowSpan = field.rowSpan || 1;
      field.controlWidth = field.controlWidth || "fill";
    });
    Object.keys(state.runtimeFields).forEach(function (id) {
      var field = state.runtimeFields[id];
      if (!state.panels[field.parent]) {
        field.parent = "controls";
      }
      field.location = field.location || ["next", "full"];
      field.columnSpan = field.columnSpan || 1;
      field.rowSpan = field.rowSpan || 1;
      field.controlWidth = field.controlWidth || "fill";
    });
    render();
  }

  function updateExport() {
    templateJson.value = JSON.stringify(exportTemplate(), null, 2);
  }

  function exportTemplate() {
    var panels = [];
    orderedPanels().forEach(function (panel) {
      var entry = {};
      entry[panel.id] = {};
      if (panel.parent) {
        entry[panel.id].parent = panel.parent;
      }
      entry[panel.id].size = panel.size;
      entry[panel.id].location = panel.location;
      if (panel.label) {
        entry[panel.id].label = panel.label;
      }
      if (panel.data) {
        entry[panel.id].data = panel.data;
      }
      entry[panel.id].align = panel.align || "left";
      entry[panel.id].gap = panel.gap || "5px";
      if (panel.childMode && panel.childMode !== "stack") {
        entry[panel.id].designer = { childMode: panel.childMode };
      }
      panels.push(entry);
    });

    return {
      name: safeId(templateName.value) || "prototype_layout",
      panels: panels,
      fields: fieldRoleDefaults(),
      runtime_fields: runtimeFieldLayouts(),
      sample_field_layouts: Object.keys(state.fields).reduce(function (acc, id) {
        var field = state.fields[id];
        acc[id] = {
          parent: field.parent,
          location: field.location,
          align: field.align || "left",
          layoutOrder: field.layoutOrder || 1,
          columnSpan: field.columnSpan || 1,
          rowSpan: field.rowSpan || 1,
          controlWidth: field.controlWidth || "fill"
        };
        return acc;
      }, {}),
      notes: templateNotes.value
    };
  }

  function runtimeFieldLayouts() {
    return Object.keys(state.runtimeFields).reduce(function (acc, id) {
      var field = state.runtimeFields[id];
      acc[id] = {
        parent: field.parent,
        location: field.location,
        align: field.align || "left",
        layoutOrder: field.layoutOrder || 1,
        columnSpan: field.columnSpan || 1,
        rowSpan: field.rowSpan || 1,
        controlWidth: field.controlWidth || "fill",
        generated: true
      };
      if (field.hidden) {
        acc[id].hidden = true;
      }
      return acc;
    }, {});
  }

  function fieldRoleDefaults() {
    var result = {
      default: { parent: "inputpanel" },
      input: { parent: "inputpanel" },
      output: { parent: "resultpanel" },
      header: { parent: "header" },
      message: { parent: "msgspanel" }
    };
    Object.keys(state.fields).forEach(function (id) {
      var field = state.fields[id];
      if (!result[field.role]) {
        result[field.role] = { parent: field.parent };
      }
    });
    return result;
  }

  function orderedPanels() {
    var result = [];
    function visit(id) {
      if (!state.panels[id]) {
        return;
      }
      result.push(state.panels[id]);
      panelChildren(id).forEach(function (child) {
        visit(child.id);
      });
    }
    visit("root");
    return result;
  }

  function importTemplate() {
    var parsed;
    try {
      parsed = JSON.parse(templateJson.value);
    } catch (error) {
      alert("Template JSON is not valid: " + error.message);
      return;
    }
    if (!parsed.panels || !Array.isArray(parsed.panels)) {
      alert("Template JSON must contain a panels array.");
      return;
    }

    pushHistory("import");
    state.panels = {};
    parsed.panels.forEach(function (panelEntry) {
      var id = Object.keys(panelEntry)[0];
      var src = panelEntry[id];
      state.panels[id] = {
        id: id,
        parent: src.parent || null,
        childMode: src.designer && src.designer.childMode ? src.designer.childMode : "stack",
        size: src.size || ["auto", [1, 1]],
        location: src.location || ["next", "full"],
        label: src.label,
        data: src.data,
        align: src.align || "left",
        gap: src.gap || "5px"
      };
    });
    if (!state.panels.root) {
      state.panels.root = freshState().panels.root;
    }
    if (parsed.sample_field_layouts) {
      Object.keys(parsed.sample_field_layouts).forEach(function (id) {
        var src = parsed.sample_field_layouts[id];
        if (!state.fields[id]) {
          state.fields[id] = {
            id: id,
            role: "input",
            type: "text",
            parent: src.parent || "inputpanel",
            location: src.location || ["next", "full"],
            align: src.align || "left",
            layoutOrder: src.layoutOrder || nextOrder(src.parent || "inputpanel", state.fields),
            columnSpan: src.columnSpan || 1,
            rowSpan: src.rowSpan || 1,
            controlWidth: src.controlWidth || "fill"
          };
        } else {
          state.fields[id].parent = src.parent || state.fields[id].parent;
          state.fields[id].location = src.location || state.fields[id].location;
          state.fields[id].align = src.align || state.fields[id].align;
          state.fields[id].layoutOrder = src.layoutOrder || state.fields[id].layoutOrder || nextOrder(state.fields[id].parent, state.fields);
          state.fields[id].columnSpan = src.columnSpan || state.fields[id].columnSpan || 1;
          state.fields[id].rowSpan = src.rowSpan || state.fields[id].rowSpan || 1;
          state.fields[id].controlWidth = src.controlWidth || state.fields[id].controlWidth || "fill";
        }
      });
    }
    if (parsed.runtime_fields) {
      Object.keys(parsed.runtime_fields).forEach(function (id) {
        var src = parsed.runtime_fields[id];
        if (!state.runtimeFields[id]) {
          state.runtimeFields[id] = {
            id: id,
            role: "runtime",
            type: id.indexOf("textarea") > -1 ? "textarea" : "status",
            label: id,
            generated: true
          };
        }
        state.runtimeFields[id].parent = src.parent || state.runtimeFields[id].parent || "controls";
        state.runtimeFields[id].location = src.location || state.runtimeFields[id].location || ["next", "full"];
        state.runtimeFields[id].align = src.align || state.runtimeFields[id].align || "left";
        state.runtimeFields[id].layoutOrder = src.layoutOrder || state.runtimeFields[id].layoutOrder || nextOrder(state.runtimeFields[id].parent, state.runtimeFields);
        state.runtimeFields[id].columnSpan = src.columnSpan || state.runtimeFields[id].columnSpan || 1;
        state.runtimeFields[id].rowSpan = src.rowSpan || state.runtimeFields[id].rowSpan || 1;
        state.runtimeFields[id].controlWidth = src.controlWidth || state.runtimeFields[id].controlWidth || "fill";
        state.runtimeFields[id].hidden = !!src.hidden;
      });
    }
    templateName.value = parsed.name || templateName.value;
    templateNotes.value = parsed.notes || templateNotes.value;
    selected = null;
    cleanLayout(true);
  }

  function copyTemplate() {
    updateExport();
    templateJson.select();
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(templateJson.value);
      return;
    }
    document.execCommand("copy");
  }

  function uniqueId(base, collection) {
    var id = safeId(base);
    var index = 2;
    while (collection[id]) {
      id = safeId(base) + "_" + index;
      index += 1;
    }
    return id;
  }

  function safeId(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  function renameKey(collection, oldId, newId) {
    collection[newId] = collection[oldId];
    delete collection[oldId];
  }

  function formToLocation(value) {
    return value.split("-");
  }

  function locationToForm(value) {
    return value[0] + "-" + value[1];
  }

  function formToSize(value) {
    if (value === "auto-2") {
      return ["auto", [1, 1]];
    }
    if (value === "1-1") {
      return [1, 1];
    }
    if (value === "1-2") {
      return [1, [1, 1]];
    }
    return ["auto", [1, 1]];
  }

  function sizeToForm(value) {
    if (Array.isArray(value) && value[0] === 1 && Array.isArray(value[1])) {
      return "1-2";
    }
    if (Array.isArray(value) && value[0] === 1 && value[1] === 1) {
      return "1-1";
    }
    if (Array.isArray(value) && value[0] === "auto" && Array.isArray(value[1]) && value[1].length === 2) {
      return "auto-2";
    }
    return "auto-1";
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  document.querySelectorAll("[data-add-panel]").forEach(function (button) {
    button.draggable = true;
    button.addEventListener("dragstart", function () {
      draggedPrimitive = { kind: "panel", value: button.dataset.addPanel };
    });
    button.addEventListener("dragend", function () {
      draggedPrimitive = null;
    });
    button.addEventListener("click", function () {
      addPanel(button.dataset.addPanel);
    });
  });
  document.querySelectorAll("[data-add-field]").forEach(function (button) {
    button.draggable = true;
    button.addEventListener("dragstart", function () {
      draggedPrimitive = { kind: "field", value: button.dataset.addField };
    });
    button.addEventListener("dragend", function () {
      draggedPrimitive = null;
    });
    button.addEventListener("click", function () {
      addField(button.dataset.addField);
    });
  });
  document.getElementById("inspector-form").addEventListener("submit", applyInspector);
  [form.parent, form.location, form.columnSpan, form.rowSpan, form.controlWidth, form.size, form.childMode, form.align].forEach(function (control) {
    control.addEventListener("change", applyLiveInspector);
  });
  form.gap.addEventListener("change", applyLiveInspector);
  designerActiveInput.addEventListener("change", function () {
    designerActive = designerActiveInput.checked;
    if (!designerActive) {
      selected = null;
    }
    render();
  });
  document.getElementById("delete-selected").addEventListener("click", deleteSelected);
  document.getElementById("undo-action").addEventListener("click", undoLast);
  document.getElementById("clean-layout").addEventListener("click", cleanLayout);
  document.getElementById("copy-template").addEventListener("click", copyTemplate);
  document.getElementById("import-template").addEventListener("click", importTemplate);
  document.getElementById("inspector-side").addEventListener("click", function () {
    inspectorMode = "side";
    render();
  });
  document.getElementById("inspector-below").addEventListener("click", function () {
    inspectorMode = "below";
    render();
  });
  document.getElementById("inspector-toggle").addEventListener("click", function () {
    inspectorMode = inspectorMode === "collapsed" ? "below" : "collapsed";
    document.getElementById("inspector-toggle").textContent = inspectorMode === "collapsed" ? "Show Inspector" : "Hide Inspector";
    render();
  });
  document.getElementById("reset-demo").addEventListener("click", function () {
    pushHistory("reset");
    state = freshState();
    selected = null;
    templateName.value = "prototype_layout";
    templateNotes.value = "Prototype template exported from the GenApp layout designer prototype.";
    render();
  });
  document.getElementById("blank-canvas").addEventListener("click", function () {
    pushHistory("blank");
    state = blankState();
    selected = null;
    templateName.value = "blank_layout";
    templateNotes.value = "Minimal blank layout with GenApp runtime slots and no module-owned sample fields.";
    render();
  });
  document.getElementById("load-minimal-template").addEventListener("click", function () {
    pushHistory("minimal");
    state = blankState();
    selected = null;
    templateName.value = "blank_layout";
    templateNotes.value = "Minimal blank layout with GenApp runtime slots and no module-owned sample fields.";
    render();
    templateJson.value = JSON.stringify(exportTemplate(), null, 2);
  });
  document.addEventListener("keydown", function (event) {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
      event.preventDefault();
      undoLast();
    }
  });
  templateName.addEventListener("input", updateExport);
  templateNotes.addEventListener("input", updateExport);

  state = freshState();
  render();
}());
