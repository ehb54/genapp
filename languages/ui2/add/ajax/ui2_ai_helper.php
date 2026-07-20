<?php
header('Content-type: application/json');

$app_root = dirname(__DIR__, 2);
$application = basename($app_root);

$appconfig = ui2_ai_helper_appconfig($app_root);
if (!$appconfig || !isset($appconfig->aihelper) || !is_object($appconfig->aihelper) ||
    !ui2_ai_helper_truthy(isset($appconfig->aihelper->enabled) ? $appconfig->aihelper->enabled : false)) {
    echo(json_encode(array("error" => "AI Helper is not configured for this deployment.")));
    exit();
}

$raw = file_get_contents('php://input');
$request = json_decode($raw, true);
if (!is_array($request)) {
    echo(json_encode(array("error" => "AI Helper request must be JSON.")));
    exit();
}

$request['application'] = isset($request['application']) && strlen(trim(strval($request['application'])))
    ? $request['application']
    : $application;

if (isset($appconfig->aihelper->development_stub) && ui2_ai_helper_truthy($appconfig->aihelper->development_stub)) {
    $module = isset($request['module']) && strlen(trim(strval($request['module']))) ? strval($request['module']) : "none";
    $question = isset($request['user_question']) ? strval($request['user_question']) : "";
    echo(json_encode(array(
        "message" => "AI Helper connected. Received module: " . $module . ". Received question: " . $question
    )));
    exit();
}

$endpoint = isset($appconfig->aihelper->endpoint) ? trim(strval($appconfig->aihelper->endpoint)) : "";
if (!strlen($endpoint)) {
    echo(json_encode(array("error" => "AI Helper is not configured for this deployment.")));
    exit();
}

$parts = parse_url($endpoint);
if (!$parts || !isset($parts['scheme']) || !in_array(strtolower($parts['scheme']), array("http", "https"), true)) {
    echo(json_encode(array("error" => "AI Helper endpoint must be an http or https URL.")));
    exit();
}

$timeout = ui2_ai_helper_timeout_seconds($appconfig);
$response = ui2_ai_helper_post_json($endpoint, json_encode($request), $timeout);
if (isset($response['error'])) {
    echo(json_encode(array("error" => $response['error'])));
    exit();
}

$payload = json_decode($response['body'], true);
if (is_array($payload)) {
    echo(json_encode($payload));
    exit();
}

echo(json_encode(array("message" => strval($response['body']))));
exit();

function ui2_ai_helper_appconfig($app_root) {
    $candidates = array(
        $app_root . "/appconfig.json",
        dirname($app_root) . "/appconfig.json"
    );
    foreach ($candidates as $candidate) {
        if (is_readable($candidate)) {
            return json_decode(file_get_contents($candidate));
        }
    }
    return null;
}

function ui2_ai_helper_truthy($value) {
    if (is_bool($value)) {
        return $value;
    }
    if (is_numeric($value)) {
        return intval($value) != 0;
    }
    return preg_match('/^(1|true|on|yes)$/i', strval($value)) === 1;
}

function ui2_ai_helper_timeout_seconds($appconfig) {
    $timeout = 45;
    if ($appconfig && isset($appconfig->aihelper) && is_object($appconfig->aihelper) &&
        isset($appconfig->aihelper->timeout_seconds) && is_numeric($appconfig->aihelper->timeout_seconds)) {
        $timeout = intval($appconfig->aihelper->timeout_seconds);
    }
    if ($timeout < 5) {
        return 5;
    }
    if ($timeout > 120) {
        return 120;
    }
    return $timeout;
}

function ui2_ai_helper_timeout_error($timeout) {
    return "AI Helper took too long to respond (" . intval($timeout) . " seconds). Please try again in a moment or ask a shorter question.";
}

function ui2_ai_helper_post_json($endpoint, $json, $timeout) {
    if (strlen($json) > 262144) {
        return array("error" => "AI Helper request is too large.");
    }
    if (function_exists('curl_init')) {
        $result = ui2_ai_helper_curl_post($endpoint, $json, $timeout);
        $body = $result["body"];
        $error = $result["error"];
        $status = $result["status"];
        if ($body === false) {
            if (ui2_ai_helper_connection_refused($error) && ui2_ai_helper_restart_local_service($endpoint)) {
                $result = ui2_ai_helper_curl_post($endpoint, $json, $timeout);
                $body = $result["body"];
                $error = $result["error"];
                $status = $result["status"];
            }
        }
        if ($body === false) {
            if (preg_match('/timed?\s*out|timeout/i', $error)) {
                return array("error" => ui2_ai_helper_timeout_error($timeout));
            }
            if (ui2_ai_helper_connection_refused($error)) {
                return array("error" => "AI Helper local service is not running. Please try again in a moment.");
            }
            return array("error" => "AI Helper endpoint request failed: " . $error);
        }
        if ($status < 200 || $status >= 300) {
            $endpoint_error = ui2_ai_helper_error_from_body($body);
            if (strlen($endpoint_error)) {
                return array("error" => $endpoint_error);
            }
            return array("error" => "AI Helper endpoint returned HTTP " . $status . ".");
        }
        return array("body" => substr($body, 0, 262144));
    }

    $context = stream_context_create(array(
        "http" => array(
            "method" => "POST",
            "header" => "Content-Type: application/json\r\n",
            "content" => $json,
            "timeout" => intval($timeout),
            "ignore_errors" => true
        )
    ));
    $body = file_get_contents($endpoint, false, $context);
    if ($body === false) {
        return array("error" => ui2_ai_helper_timeout_error($timeout));
    }
    $status = ui2_ai_helper_stream_status(isset($http_response_header) ? $http_response_header : array());
    if ($status && ($status < 200 || $status >= 300)) {
        $endpoint_error = ui2_ai_helper_error_from_body($body);
        if (strlen($endpoint_error)) {
            return array("error" => $endpoint_error);
        }
        return array("error" => "AI Helper endpoint returned HTTP " . $status . ".");
    }
    return array("body" => substr($body, 0, 262144));
}

function ui2_ai_helper_curl_post($endpoint, $json, $timeout) {
    $curl = curl_init($endpoint);
    curl_setopt($curl, CURLOPT_POST, true);
    curl_setopt($curl, CURLOPT_POSTFIELDS, $json);
    curl_setopt($curl, CURLOPT_HTTPHEADER, array("Content-Type: application/json"));
    curl_setopt($curl, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($curl, CURLOPT_CONNECTTIMEOUT, min(5, max(1, intval($timeout))));
    curl_setopt($curl, CURLOPT_TIMEOUT, intval($timeout));
    curl_setopt($curl, CURLOPT_MAXREDIRS, 0);
    $body = curl_exec($curl);
    $error = curl_error($curl);
    $status = intval(curl_getinfo($curl, CURLINFO_HTTP_CODE));
    curl_close($curl);
    return array("body" => $body, "error" => $error, "status" => $status);
}

function ui2_ai_helper_connection_refused($error) {
    return preg_match('/connection\s+refused|failed\s+to\s+connect/i', strval($error)) === 1;
}

function ui2_ai_helper_restart_local_service($endpoint) {
    $parts = parse_url($endpoint);
    if (!$parts || !isset($parts["host"])) {
        return false;
    }
    $host = strtolower(trim(strval($parts["host"]), "[]"));
    $port = isset($parts["port"]) ? intval($parts["port"]) : 80;
    if (!in_array($host, array("127.0.0.1", "localhost", "::1"), true) || $port !== 8765) {
        return false;
    }
    $service = "/etc/init.d/ai-helper-service";
    if (!is_executable($service) || !function_exists("exec")) {
        return false;
    }
    $output = array();
    $status = 1;
    exec($service . " check 2>&1", $output, $status);
    return $status === 0;
}

function ui2_ai_helper_error_from_body($body) {
    $payload = json_decode(strval($body), true);
    if (is_array($payload) && isset($payload['error']) && strlen(trim(strval($payload['error'])))) {
        $error = trim(strval($payload['error']));
        if (preg_match('/timed?\s*out|timeout/i', $error)) {
            return "AI Helper took too long to respond. Please try again in a moment or ask a shorter question.";
        }
        return substr($error, 0, 500);
    }
    return "";
}

function ui2_ai_helper_stream_status($headers) {
    if (!is_array($headers) || !count($headers)) {
        return 0;
    }
    if (preg_match('/\s(\d{3})\s/', strval($headers[0]), $matches)) {
        return intval($matches[1]);
    }
    return 0;
}
