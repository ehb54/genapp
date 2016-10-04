<?php

require "os_header_cli.php";

$cmd = "nova flavor-list; nova list";

$results = `$cmd`;
echo $results;
?>
