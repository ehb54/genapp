<?php
header('Content-type: application/json');

$app_root = dirname(__DIR__, 2);
$application = basename($app_root);
session_name(strtoupper(preg_replace('/[^a-zA-Z0-9_]+/', '_', "GENAPP_" . $application)));
session_start();

$module_id = isset($_REQUEST['module']) ? strval($_REQUEST['module']) : '';
if (!preg_match('/^[A-Za-z0-9_-]+$/', $module_id)) {
    ui2_test_scenarios_reply(array('error' => 'Invalid module id.'), 400);
}

$appconfig = ui2_test_scenarios_appconfig($app_root);
if (!ui2_test_scenarios_enabled($appconfig)) {
    ui2_test_scenarios_reply(array('available' => false));
}

$window = isset($_REQUEST['_window']) ? strval($_REQUEST['_window']) : '';
$requested_logon = isset($_REQUEST['_logon']) ? strval($_REQUEST['_logon']) : '';
$session_logon = ($window && isset($_SESSION[$window]) && is_array($_SESSION[$window]) &&
    isset($_SESSION[$window]['logon'])) ? strval($_SESSION[$window]['logon']) : '';
if (!$requested_logon || !$session_logon || !hash_equals($session_logon, $requested_logon)) {
    ui2_test_scenarios_reply(array('error' => 'Administrator session required.'), 403);
}
if (!ui2_test_scenarios_is_admin($appconfig, $session_logon)) {
    ui2_test_scenarios_reply(array('error' => 'Administrator access required.'), 403);
}

$catalog_path = $app_root . '/test_scenarios/' . $module_id . '.json';
if (!is_readable($catalog_path)) {
    ui2_test_scenarios_reply(array('available' => false, 'module_id' => $module_id));
}
$catalog = json_decode(file_get_contents($catalog_path), true);
if (!is_array($catalog)) {
    ui2_test_scenarios_reply(array('error' => 'Scenario catalog is invalid JSON.'), 500);
}
$error = ui2_test_scenarios_validate_catalog($catalog, $module_id, $app_root);
if ($error) {
    ui2_test_scenarios_reply(array('error' => $error), 500);
}
ui2_test_scenarios_reply(array('available' => true, 'catalog' => $catalog));

function ui2_test_scenarios_reply($payload, $status = 200) {
    http_response_code($status);
    echo(json_encode($payload));
    exit();
}

function ui2_test_scenarios_appconfig($app_root) {
    foreach (array($app_root . '/appconfig.json', dirname($app_root) . '/appconfig.json') as $path) {
        if (is_readable($path)) return json_decode(file_get_contents($path));
    }
    return null;
}

function ui2_test_scenarios_truthy($value) {
    if (is_bool($value)) return $value;
    if (is_numeric($value)) return intval($value) !== 0;
    return preg_match('/^(1|true|yes|on)$/i', strval($value)) === 1;
}

function ui2_test_scenarios_enabled($appconfig) {
    return $appconfig && isset($appconfig->test_scenarios) && is_object($appconfig->test_scenarios) &&
        isset($appconfig->test_scenarios->enabled) && ui2_test_scenarios_truthy($appconfig->test_scenarios->enabled);
}

function ui2_test_scenarios_is_admin($appconfig, $logon) {
    return $appconfig && isset($appconfig->restricted) && is_object($appconfig->restricted) &&
        isset($appconfig->restricted->admin) && is_array($appconfig->restricted->admin) &&
        in_array($logon, $appconfig->restricted->admin, true);
}

function ui2_test_scenarios_validate_catalog($catalog, $module_id, $app_root) {
    $allowed_provenance = array('current_docs', 'legacy_docs', 'gui_mimic', 'test_sassie', 'developer', 'scientist');
    $allowed_maturity = array('draft', 'candidate', 'verified_cli', 'verified_ui', 'release_ready', 'deferred');
    $allowed_checks = array('job_status', 'output_present', 'output_nonempty');
    if (!isset($catalog['schema_version']) || intval($catalog['schema_version']) !== 1 ||
        !isset($catalog['module_id']) || $catalog['module_id'] !== $module_id ||
        !isset($catalog['scenarios']) || !is_array($catalog['scenarios'])) return 'Scenario catalog has an invalid root shape.';
    $module_path = $app_root . '/ui2/modules/' . $module_id . '.json';
    if (!is_readable($module_path)) $module_path = $app_root . '/modules/' . $module_id . '.json';
    $module_payload = is_readable($module_path) ? json_decode(file_get_contents($module_path), true) : null;
    $module = is_array($module_payload) && isset($module_payload['modulejson']) ? $module_payload['modulejson'] : $module_payload;
    $input_ids = array();
    foreach (is_array($module) && isset($module['fields']) && is_array($module['fields']) ? $module['fields'] : array() as $field) {
        if (is_array($field) && isset($field['id']) && (!isset($field['role']) || $field['role'] !== 'output')) $input_ids[$field['id']] = true;
    }
    if (!count($input_ids)) return 'Scenario catalog module definition is unavailable.';
    $seen = array();
    foreach ($catalog['scenarios'] as $scenario) {
        if (!is_array($scenario) || !isset($scenario['id']) || !preg_match('/^[A-Za-z0-9_-]+$/', strval($scenario['id'])) ||
            isset($seen[$scenario['id']]) || !isset($scenario['label']) || !isset($scenario['inputs']) || !is_array($scenario['inputs']) || !count($scenario['inputs'])) return 'Scenario catalog has an invalid scenario.';
        $seen[$scenario['id']] = true;
        foreach ($scenario['inputs'] as $field_id => $value) {
            if (!preg_match('/^[A-Za-z0-9_-]+$/', strval($field_id)) || !isset($input_ids[$field_id])) return 'Scenario catalog references an unknown input field.';
        }
        foreach (isset($scenario['provenance']) && is_array($scenario['provenance']) ? $scenario['provenance'] : array() as $source) {
            if (!in_array($source, $allowed_provenance, true)) return 'Scenario catalog has an invalid provenance value.';
        }
        if (isset($scenario['maturity']) && !in_array($scenario['maturity'], $allowed_maturity, true)) return 'Scenario catalog has an invalid maturity value.';
        if (!isset($scenario['verification'])) continue;
        $verification = $scenario['verification'];
        if (!is_array($verification) || intval(isset($verification['schema_version']) ? $verification['schema_version'] : 0) !== 1 ||
            !isset($verification['checks']) || !is_array($verification['checks'])) return 'Scenario catalog has an invalid verification block.';
        foreach ($verification['checks'] as $check) {
            if (!is_array($check) || !isset($check['id']) || !preg_match('/^[A-Za-z0-9_-]+$/', strval($check['id'])) ||
                !isset($check['kind']) || !in_array($check['kind'], $allowed_checks, true)) return 'Scenario catalog has an invalid verification check.';
            if ($check['kind'] === 'job_status' && !isset($check['equals'])) return 'Scenario job_status check requires equals.';
            if ($check['kind'] !== 'job_status' && (!isset($check['output_id']) || !preg_match('/^[A-Za-z0-9_-]+$/', strval($check['output_id'])))) return 'Scenario output check requires output_id.';
        }
    }
    return '';
}
