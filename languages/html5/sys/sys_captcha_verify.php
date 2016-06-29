<?php
/*
 * sys_captcha_verify.php
 *
 * verify captcha info
 *
 */

$results = [];

if ( !sizeof( $_REQUEST ) ) {
    $results[ "error" ] = "PHP code received no \$_REQUEST?";
    echo (json_encode($results));
    exit();
}

if ( 
    !isset( $_REQUEST[ "_window" ] ) ||
    !isset( $_REQUEST[ "id" ] ) ||
    !isset( $_REQUEST[ "captcha" ] )
    ) {
    $results[ 'error' ] = "Error in call";
    echo json_encode( $results );
    exit();
}

date_default_timezone_set("UTC");
$now = new MongoDate();
try {
    $m = new MongoClient();
} catch ( Exception $e ) {
    $results[ 'error' ] = "Could not connect to the db " . $e->getMessage();
    exit();
}

$id      = $_REQUEST[ "id" ];
$captcha = $_REQUEST[ "captcha" ];

$coll = $m->__application__->captcha;

if ( $doc = $coll->findOne( array( "_id" => $id ) ) ) {
    $expires = $doc[ 'time' ];
    $expires->sec += 3 * 60;

    if ( $now < $expires &&
         $doc[ 'captcha' ] == $captcha &&
         $doc[ 'window' ] == $_REQUEST[ '_window' ] ) {
        try {
            $coll->update( array( "_id" => $id ),
                           array( '$set' => array( 'success' => 1 ) )
                           __~mongojournal{, array("j" => true )} );
        } catch(MongoCursorException $e) {
            $results[ 'error' ] = "Error updating the db " . $e->getMessage();
            exit();
        }
        $results[ 'success' ] = 1;
    } else {
        try {
            $coll->remove( array( "_id" => $id ), 
                           array( __~mongojournal{"j" => true, }"justOne" => true ) );
        } catch(MongoCursorException $e) {
            $results[ 'error' ] = "Error cleaning the db " . $e->getMessage();
            exit();
        }
    }
}

echo json_encode( $results );
exit();

?>
