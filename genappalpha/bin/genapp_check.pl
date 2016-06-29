#!/usr/bin/perl

$notes = "usage: $0
checks the files
note: env variable GENAPP must be defined
" ;

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

require "$gap/etc/perl/genapp_util.pl";

check_files() || die "Errors found\n";

print "ok\n";
