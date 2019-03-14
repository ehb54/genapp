<?php

require_once "../joblog.php";

function checklocalopenport( $port ) {
    $connection = @fsockopen('localhost', $port );
    return is_resource( $connection );
}

function userports_clear_db() {
    # for each entry in mongo:global.userports, do job records exists, if not, remove
}



