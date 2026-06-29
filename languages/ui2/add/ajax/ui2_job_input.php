<?php
header('Content-type: application/json');

$app_root = dirname(__DIR__, 2);
$application = basename($app_root);
session_name(strtoupper(preg_replace('/[^a-zA-Z0-9_]+/', '_', "GENAPP_" . $application)));
session_start();

$results = array();

if (!isset($_REQUEST['_uuid']) || !strlen($_REQUEST['_uuid'])) {
    $results['error'] = 'No _uuid specified in the request';
    echo(json_encode($results));
    exit();
}

$window = isset($_REQUEST['_window']) ? $_REQUEST['_window'] : '';
$requested_logon = isset($_REQUEST['_logon']) ? $_REQUEST['_logon'] : '';
$session_logon = '';

if ($window && isset($_SESSION[$window]) && isset($_SESSION[$window]['logon'])) {
    $session_logon = $_SESSION[$window]['logon'];
}

if (!$session_logon && $requested_logon) {
    foreach ($_SESSION as $entry) {
        if (is_array($entry) && isset($entry['logon']) && $entry['logon'] === $requested_logon) {
            $session_logon = $entry['logon'];
            break;
        }
    }
}

if (!$requested_logon || !$session_logon || $requested_logon !== $session_logon) {
    $results['error'] = 'Not logged in for saved job input';
    echo(json_encode($results));
    exit();
}

$GLOBALS['logon'] = $requested_logon;
require_once $app_root . '/ajax/joblog.php';

$uuid = $_REQUEST['_uuid'];
if (!getmenumodule($uuid)) {
    $results['error'] = "Could not find job id $uuid";
    echo(json_encode($results));
    exit();
}

$input_file = $GLOBALS['getmenumodulelogdir'] . '/_input_' . $uuid;
if (!is_file($input_file)) {
    $results['error'] = "Saved input not found for job id $uuid";
    echo(json_encode($results));
    exit();
}

$input_json = file_get_contents($input_file);
$input_data = json_decode($input_json);
if (json_last_error() !== JSON_ERROR_NONE) {
    $results['error'] = 'Saved input JSON is invalid: ' . json_last_error_msg();
    echo(json_encode($results));
    exit();
}

$results['_getinput'] = $input_data;
echo(json_encode($results));
