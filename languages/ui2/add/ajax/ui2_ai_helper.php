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

$response = ui2_ai_helper_post_json($endpoint, json_encode($request));
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

function ui2_ai_helper_post_json($endpoint, $json) {
    if (strlen($json) > 262144) {
        return array("error" => "AI Helper request is too large.");
    }
    if (function_exists('curl_init')) {
        $curl = curl_init($endpoint);
        curl_setopt($curl, CURLOPT_POST, true);
        curl_setopt($curl, CURLOPT_POSTFIELDS, $json);
        curl_setopt($curl, CURLOPT_HTTPHEADER, array("Content-Type: application/json"));
        curl_setopt($curl, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($curl, CURLOPT_CONNECTTIMEOUT, 3);
        curl_setopt($curl, CURLOPT_TIMEOUT, 15);
        curl_setopt($curl, CURLOPT_MAXREDIRS, 0);
        $body = curl_exec($curl);
        $error = curl_error($curl);
        $status = intval(curl_getinfo($curl, CURLINFO_HTTP_CODE));
        curl_close($curl);
        if ($body === false) {
            return array("error" => "AI Helper endpoint request failed: " . $error);
        }
        if ($status < 200 || $status >= 300) {
            return array("error" => "AI Helper endpoint returned HTTP " . $status . ".");
        }
        return array("body" => substr($body, 0, 262144));
    }

    $context = stream_context_create(array(
        "http" => array(
            "method" => "POST",
            "header" => "Content-Type: application/json\r\n",
            "content" => $json,
            "timeout" => 15,
            "ignore_errors" => true
        )
    ));
    $body = file_get_contents($endpoint, false, $context);
    if ($body === false) {
        return array("error" => "AI Helper endpoint request failed.");
    }
    $status = ui2_ai_helper_stream_status(isset($http_response_header) ? $http_response_header : array());
    if ($status && ($status < 200 || $status >= 300)) {
        return array("error" => "AI Helper endpoint returned HTTP " . $status . ".");
    }
    return array("body" => substr($body, 0, 262144));
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
