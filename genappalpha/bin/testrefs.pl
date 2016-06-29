#!/usr/bin/perl

$notes = "usage: $0 files
lists contents of files in json format [with optional # comment lines]
note: env variable GENAPP must be defined
" ;

die $notes if !@ARGV;
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

sub get_sorted_rplc_out {
    my @out;
    while ( my ( $k, $v ) = each $rplc )
    {
        push @out, "$k $v\n";
    }
    @out = sort { $a cmp $b } @out;
    my $ret = '-'x40 . "\n";
    $ret .= join '', @out;
    $ret;
}
    
while ( $f = shift )
{
    $json = get_file_json( $f );    
    print "$f:\n";
    $ref = {};
    $rplc = start_json( $json, $ref );
    print '-'x40 . "\n";
    print " pos is "  . $$ref{ "pos" };
    print " mpos is " . $$ref{ "mpos" } . "\n";
    print get_sorted_rplc_out();
    while ( $rplc = next_json( $ref ) )
    {
        print '-'x40 . "\n";
        print " pos is "  . $$ref{ "pos" };
        print " mpos is " . $$ref{ "mpos" } . "\n";
        print get_sorted_rplc_out();
    }

    if ( 0 ) {

        print '-'x40 . "\n";
        print "rewind, search for changes in 'menu:id'\n";
        $rplc = rewind_json( $ref );
        print get_sorted_rplc_out();
        while ( $rplc = next_json( $ref, "menu:id" ) )
        {
            print '-'x40 . "\n";
            print " pos is "  . $$ref{ "pos" };
            print " mpos is " . $$ref{ "mpos" } . "\n";
            print get_sorted_rplc_out();
        }
    }

    if ( 1 ) {
        print "rewind, search for changes in 'menu:modules:id'\n";
        $rplc = rewind_json( $ref );
        print get_sorted_rplc_out();
        while ( $rplc = next_json( $ref, "menu:modules:id" ) )
        {
            print '-'x40 . "\n";
            print " pos is "  . $$ref{ "pos" };
            print " mpos is " . $$ref{ "mpos" } . "\n";
            print get_sorted_rplc_out();
        }

        print "rewind, search for changes in 'menu:modules:id|menu:id'\n";
        $rplc = rewind_json( $ref );
        print get_sorted_rplc_out();
        while ( my ( $k, $v ) = each $rplc )
        {
            print "$k $v\n";
        }
        while ( $rplc = next_json( $ref, "menu:modules:id" ) )
        {
            print '-'x40 . "\n";
            print " pos is "  . $$ref{ "pos" };
            print " mpos is " . $$ref{ "mpos" } . "\n";
            print get_sorted_rplc_out();
        }
    }
    
}
