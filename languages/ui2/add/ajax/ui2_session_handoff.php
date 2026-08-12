<?php
header('Content-type: application/json');

$app_root = dirname(__DIR__, 2);
$application = basename($app_root);
session_name(strtoupper(preg_replace('/[^a-zA-Z0-9_]+/', '_', "GENAPP_" . $application)));
session_start();

function ui2_session_handoff_reply($payload, $status = 200) {
    http_response_code($status);
    echo(json_encode($payload));
    exit();
}

function ui2_session_handoff_window_id($value) {
    $value = is_string($value) ? $value : '';
    return preg_match('/^[A-Za-z0-9_-]{1,128}$/', $value) ? $value : '';
}

$source_window = ui2_session_handoff_window_id(isset($_REQUEST['source_window']) ? $_REQUEST['source_window'] : '');
$target_window = ui2_session_handoff_window_id(isset($_REQUEST['target_window']) ? $_REQUEST['target_window'] : '');

if (!$source_window || !$target_window || $source_window === $target_window) {
    ui2_session_handoff_reply(array('error' => 'Invalid new-window session handoff request.'), 400);
}

$source = isset($_SESSION[$source_window]) && is_array($_SESSION[$source_window])
    ? $_SESSION[$source_window]
    : array();
$logon = isset($source['logon']) && is_string($source['logon']) ? $source['logon'] : '';
$source_application = isset($source['app']) && is_string($source['app']) ? $source['app'] : '';

if (!strlen($logon) || !hash_equals($application, $source_application)) {
    ui2_session_handoff_reply(array('error' => 'Your login session has expired. Please log in again.'), 403);
}

// Keep this deliberately minimal. Window-local preferences and
// next_job_environment settings must not leak into a second browsing context.
$_SESSION[$target_window] = array(
    'logon' => $logon,
    'app' => $application,
    'project' => isset($source['project']) && is_string($source['project']) ? $source['project'] : ''
);
session_write_close();

ui2_session_handoff_reply(array('handoff' => true));
