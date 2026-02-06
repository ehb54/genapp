#!/usr/bin/env php
<?php
// session-monitor-php74.php - Reliable session viewer for PHP 7.4 file-based sessions

$sessionPath = ini_get('session.save_path') ?: '/var/lib/php/sessions';
$filter      = isset($argv[1]) ? $argv[1] : '';

echo "Scanning: $sessionPath\n";
if ($filter) {
    echo "Filter: $filter\n";
}
echo "\n";

$files = glob("$sessionPath/sess_*");
$count = count($files);

if ($count === 0) {
    echo "No sessions found.\n";
    exit(0);
}

echo "Found $count sessions:\n\n";

foreach ($files as $file) {
    $sessionId = substr(basename($file), 5); // remove 'sess_'
    $data      = @file_get_contents($file);

    if (empty($data)) {
        continue;
    }

    $sessionVars = session_decode_manual($data);

    // Apply filter
    if ($filter) {
        $haystack = $sessionId . json_encode($sessionVars);
        if (stripos($haystack, $filter) === false) {
            continue;
        }
    }

    echo "Session ID: $sessionId\n";
    echo "Last modified: " . date('Y-m-d H:i:s', filemtime($file)) . "\n";
    echo "Size: " . round(filesize($file) / 1024, 2) . " KB\n";

    if ($sessionVars === false || !is_array($sessionVars)) {
        echo "Could not decode session (custom handler / encrypted / corrupted?)\n";
    } else if (empty($sessionVars)) {
        echo "Empty session\n";
    } else {
        echo "Variables:\n";
        print_r($sessionVars);
    }

    echo str_repeat('-', 70) . "\n\n";
}

echo "Done.\n";

/**
 * Manual session decoder - reliable for PHP 7.x file-based sessions
 * Parses "key|serialized_value" pairs iteratively
 */
function session_decode_manual($data) {
    $result = [];
    $offset = 0;
    $len    = strlen($data);

    while ($offset < $len) {
        $keyEnd = strpos($data, '|', $offset);
        if ($keyEnd === false) {
            break;
        }

        $key = substr($data, $offset, $keyEnd - $offset);
        $offset = $keyEnd + 1;

        // Try to unserialize the value starting at current offset
        $value = @unserialize(substr($data, $offset), ['allowed_classes' => true]);

        if ($value === false) {
            // Could be corrupted or object with unserializable class
            $result[$key] = '** unserialize failed **';
        } else {
            $result[$key] = $value;
        }

        // Move offset forward by the length of the serialized value
        // This is trickyb  we re-serialize to find the exact length PHP used
        $serializedValue = @serialize($value);
        if ($serializedValue !== false) {
            $offset += strlen($serializedValue);
        } else {
            // Fallback: try to guess end (risky, but rare)
            $nextPipe = strpos($data, '|', $offset);
            $offset = $nextPipe !== false ? $nextPipe : $len;
        }
    }

    return $result;
}
