#!/usr/bin/perl

$notes = "usage: $0 width files
output img src= for base64 encoded images
";

$gap = $ENV{ "GENAPP" } || die "$0: error env variable GENAPP must be defined\n";

$wid = shift || die $notes;
die $notes if @ARGV < 1;

use File::Basename;

while ( $f = shift ) {
    my ( $base, $path, $ext ) = fileparse( $f, qr/\.[^.]*/ );

    die "$0: $f not found\n" if !-e $f;

    $cmd = "identify $f | awk '{ print \$2 \"x\" \$3 }'\n";
    $res = `$cmd`;
    my ( $t, $w, $h ) = $res =~ /^([^x]+)x([^x]+)x([^x]+)$/;
    $t = lc( $t );
    print "$f: $t $h $w\n";

    $cmd = "convert -resize $wid $f - | base64 -w 0";
    $b64 = `$cmd`;

    print "$f: \"data:image/png;base64,$b64\"\n";
}

