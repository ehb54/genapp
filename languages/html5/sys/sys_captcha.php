<?php
/*
 * sys_captcha.php
 *
 * output json with image and key
 *
 */

$results = [];
if ( !sizeof( $_REQUEST ) ) {
    $results[ "error" ] = "PHP code received no \$_REQUEST?";
    echo (json_encode($results));
    exit();
}

if ( !isset( $_REQUEST[ "_window" ] ) ) {
    $results[ 'error' ] = "Error in call";
    echo json_encode( $results );
    exit();
}

$font    = '__docroot:html5__/__application__/fonts/captcha.ttf';

$size      = 75;

/* Create Imagick object from background file*/

$imagestr = "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";

// $image = new Imagick( 'cap_bg.jpg' );
$image = new Imagick();
$image->readimageblob( base64_decode( $imagestr ) );
srand( make_seed() );

$cstrong = true;
$captcha = substr( strtolower( base64_encode( openssl_random_pseudo_bytes ( 4, $cstrong ) ) ), 0, 6 );
$captcha = str_replace( "+", "t", $captcha );
$captcha = str_replace( "/", "l", $captcha  );
$captcha = str_replace( "=", "e", $captcha  );
$captcha = str_replace( "l", "1", $captcha  );
$captcha = str_replace( "i", "x", $captcha  );
$captcha = str_replace( "0", "8", $captcha  );
$captcha = str_replace( "o", "8", $captcha  );

$id = base64_encode( openssl_random_pseudo_bytes ( 20, $cstrong ) );

/* Create a drawing object and set the font size */
$ImagickDraw = new ImagickDraw();
$ImagickDraw->setFont( $font );
$ImagickDraw->setFontSize( $size );

// Figure out position
$bbox = $image->queryFontMetrics( $ImagickDraw, $captcha );

$x  = ( 320 - $bbox['textWidth'] ) / 2 - 5 ; // the distance from left
$y  = ( 200 - $bbox['textHeight'] ) / 2 + $bbox['textHeight'] - 15; // from top to baseline

settype( $x, 'int' );
settype( $y, 'integer' );

// Change the font color
$colors    = array();
$colors[]  = 'black';
$colors[]  = '#2B4E72';       // dark blue
$colors[]  = '#4E4E4E';       // gray
$colors[]  = '#2790B0';       // teal
$colors[]  = '#00FFFF';       // cyan
$ndx       = rand( 0, 4 );
$color     = 'black'; $colors[ $ndx ];
$ImagickDraw->setFillColor( $color );
$ImagickDraw->setFillOpacity( 1.0 );   // 100%

/* Write the text on the image */
$image->annotateImage( $ImagickDraw, $x, $y, 0, $captcha );

/* Add some swirl */
$image->swirlImage( 30 );

$image->charcoalImage( 2, 2 );
$image->implodeImage( .2 );
$image->blurImage( 2, 3 );
$image->sepiaToneImage( 70 );
$image->swirlImage( -20 );
$image->swirlImage( 40 );

/* Draw the ImagickDraw object contents to the image. */
$image->drawImage( $ImagickDraw );

$image->paintTransparentImage( 'white', 0.0, 15000 );

/* Give the image a format */
$image->setImageFormat( 'png' );


$results[ 'captcha' ] =  base64_encode( $image->getImageBlob() );
$results[ 'id' ] = $id;

$ImagickDraw->destroy();
$image->destroy();

date_default_timezone_set("UTC");
$now = new MongoDate();

try {
    $m = new MongoClient();
} catch ( Exception $e ) {
    $results[ 'error' ] = "Could not connect to the db " . $e->getMessage();
    exit();
}

try {
    $m->__application__->captcha->insert( array( "_id"     => $id,
                                                 "captcha" => $captcha,
                                                 "time"    => $now,
                                                 "window"  => $_REQUEST[ '_window' ] ) );
} catch ( MongoException $e ) {
    $results[ 'error' ] = "Internal error: could not insert into db";
    echo json_encode( $results );
    exit();
}

echo json_encode( $results );
exit();

function make_seed()
{
  list($usec, $sec) = explode(' ', microtime());
  return (float) $sec + ((float) $usec * 100000);
}
?>
