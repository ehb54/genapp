(function () {
  "use strict";

  const form = document.getElementById("mock-module-form");
  const precheckPanel = document.getElementById("precheck-panel");
  const precheckButton = document.getElementById("precheck-button");
  const resetButton = document.getElementById("reset-button");
  const showPrecheck = document.getElementById("show_precheck");
  const status = document.getElementById("precheck-status");
  const statePill = document.getElementById("precheck-state");
  const summary = document.getElementById("precheck_summary");
  const responseJson = document.getElementById("response-json");
  const dialog = document.getElementById("message-dialog");
  const dialogIcon = document.getElementById("message-icon");
  const dialogText = document.getElementById("message-text");
  const dialogClose = document.getElementById("message-close");

  function valuesFromForm() {
    const values = {};
    new FormData(form).forEach((value, key) => {
      values[key] = value;
    });
    values.show_precheck = showPrecheck.checked ? "true" : "false";
    return values;
  }

  function mockActionEndpoint(values) {
    const qMin = Number(values.q_min);
    const qMax = Number(values.q_max);
    const d2o = Number(values.d2o_fraction);
    const fields = {};
    const actions = [];
    let statusValue = "pass";
    let summaryText = "Inputs look consistent for a trial run.";

    if (!values.input_file || !/\.(dat|sub|txt)$/i.test(values.input_file)) {
      statusValue = "fail";
      summaryText = "Input path should end in .dat, .sub, or .txt for this mock.";
    } else if (!Number.isFinite(qMin) || !Number.isFinite(qMax) || qMin <= 0 || qMax <= qMin) {
      statusValue = "fail";
      summaryText = "q range is invalid. q min must be positive and q max must be larger.";
    } else if (qMax > 0.5 || d2o > 0.9) {
      statusValue = "warning";
      summaryText = "Inputs are usable, but q max or D2O fraction is outside the preferred review range.";
    }

    fields.precheck_summary = [
      `run_name: ${values.run_name || "(blank)"}`,
      `input_file: ${values.input_file || "(blank)"}`,
      `q range: ${values.q_min} to ${values.q_max}`,
      `D2O fraction: ${values.d2o_fraction}`,
      `status: ${statusValue}`
    ].join("\n");

    actions.push({
      action: "set_fields",
      fields
    });

    actions.push({
      action: statusValue === "pass" ? "message" : "dialog",
      level: statusValue === "pass" ? "info" : statusValue,
      text: summaryText
    });

    return {
      status: statusValue,
      summary: summaryText,
      received: values,
      actions
    };
  }

  function applyActionResponse(response) {
    if (response.fields) {
      setFields(response.fields);
    }
    if (Array.isArray(response.actions)) {
      response.actions.forEach((action) => {
        if (action.action === "set_fields") {
          setFields(action.fields || {});
        } else if (action.action === "clear_fields") {
          (action.fields || []).forEach((id) => setFields({ [id]: "" }));
        } else if (action.action === "message" || action.action === "dialog") {
          showDialog(action.level || response.status, action.text || response.summary || "");
        }
      });
    }

    const statusValue = response.status || "complete";
    status.textContent = response.summary || statusValue;
    status.dataset.status = statusValue;
    statePill.textContent = statusValue === "pass" ? "Precheck passed" :
      statusValue === "warning" ? "Precheck warning" : "Precheck failed";
    statePill.dataset.status = statusValue;
    responseJson.textContent = JSON.stringify(response, null, 2);
  }

  function setFields(fields) {
    Object.entries(fields || {}).forEach(([id, value]) => {
      const field = document.getElementById(id);
      if (field) {
        field.value = value == null ? "" : String(value);
      }
    });
  }

  function showDialog(level, text) {
    dialog.hidden = false;
    dialogIcon.textContent = /fail|error|warn/i.test(String(level || "")) ? "!" : "i";
    dialogText.textContent = text;
    dialogClose.focus();
  }

  function runPrecheck() {
    precheckButton.disabled = true;
    status.textContent = "Running precheck...";
    status.dataset.status = "";

    window.setTimeout(() => {
      const response = mockActionEndpoint(valuesFromForm());
      applyActionResponse(response);
      precheckButton.disabled = false;
    }, 250);
  }

  function syncConditionalPrecheck() {
    precheckPanel.hidden = !showPrecheck.checked;
  }

  precheckButton.addEventListener("click", runPrecheck);
  showPrecheck.addEventListener("change", syncConditionalPrecheck);
  dialogClose.addEventListener("click", () => {
    dialog.hidden = true;
  });
  resetButton.addEventListener("click", () => {
    window.setTimeout(() => {
      status.textContent = "No precheck has run.";
      status.dataset.status = "";
      statePill.textContent = "Not checked";
      statePill.dataset.status = "";
      summary.value = "Waiting for precheck.";
      responseJson.textContent = "{}";
      syncConditionalPrecheck();
    }, 0);
  });

  syncConditionalPrecheck();
}());
