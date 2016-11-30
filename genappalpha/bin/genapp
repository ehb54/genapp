#!/usr/bin/perl -X

$gb = $ENV{ "GENAPP" } || die "$0: error env variable GENAPP must be defined\n";

if ( $] < 5.018 ) {
    if ( -e "$gb/perl/bin/perl" ) {
        $pv =`$gb/perl/bin/perl -e 'print \$];'`;
        if ( $pv >= 5.018 ) {
            unshift @ARGV, "$gb/bin/genapp_run.pl";
            exec( "$gb/perl/bin/perl", @ARGV );
        } else {
            die "$gb/perl/bin/perl exists, but not a correct version of perl (needs a minimum of 5.18)\n";
        }
    } else {
        die "you need to install a version of perl >= 5.18 in $gb/perl\n
there is a script $gb/sbin/install-perl-stable to do this";
    }
}

exec( "$gb/bin/genapp_run.pl", @ARGV );

