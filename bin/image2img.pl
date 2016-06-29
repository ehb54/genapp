#!/usr/bin/perl

$notes = "usage: $0 width files
output base64 encoded images suitable for css or html img src=
";

$gap = $ENV{ "GENAPP" } || die "$0: error env variable GENAPP must be defined\n";

{
    my $gb   = $gap;

    if ( $] < 5.018 ) {
        if ( -e "$gb/perl/bin/perl" ) {
            $pv =`$gb/perl/bin/perl -e 'print \$];'`;
            if ( $pv >= 5.018 ) {
                unshift @ARGV, $0;
                exec( "$gb/perl/bin/perl", @ARGV );
            } else {
                die "$gb/perl/bin/perl exists, but not a correct version of perl (needs a minimum of 5.18)\n";
            }
        } else {
            die "you need to install a version of perl >= 5.18 in $gb/perl\n
there is a script $gb/sbin/install-perl-stable to do this";
        }
    }
}

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

    print "$f: \"data:image/$t;base64,$b64\"\n";
}

