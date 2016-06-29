#!/usr/bin/perl

$gap = $ENV{ "GENAPP" } || die "$0: error env variable GENAPP must be defined\n";

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

@f = `(cd input; ls -1 *.json)`;
grep chomp, @f;

undef $debug_rplc;

while ( $f = shift @f )
{
#    print "$f\n";
    $json = get_file_json( "input/$f" );    
    $fo = $f;
    $fo =~ s/\.json$//;
    open OUT, ">output/$fo" || die;
    print OUT '-'x80 . "\n";
    print OUT "$f:\n";
    print OUT '-'x80 . "\n";
    $ref = {};
    $rplc = start_json( $json, $ref );
    print OUT '-'x40 . "\n";
    print OUT " pos is "  . $$ref{ "pos" };
    print OUT " mpos is " . $$ref{ "mpos" } . "\n";
    print OUT get_sorted_rplc_out();
    while ( $rplc = next_json( $ref ) )
    {
        print OUT '-'x40 . "\n";
        print OUT " pos is "  . $$ref{ "pos" };
        print OUT " mpos is " . $$ref{ "mpos" } . "\n";
        print OUT get_sorted_rplc_out();
    }

    if ( 1 ) {

        print OUT '-'x40 . "\n";
        print OUT "rewind, search for changes in 'menu:id'\n";
        $rplc = rewind_json( $ref );
        print OUT get_sorted_rplc_out();
        while ( $rplc = next_json( $ref, "menu:id" ) )
        {
            print OUT '-'x40 . "\n";
            print OUT " pos is "  . $$ref{ "pos" };
            print OUT " mpos is " . $$ref{ "mpos" } . "\n";
            print OUT get_sorted_rplc_out();
        }
    }

    if ( 1 ) {
        print OUT '-'x40 . "\n";
        print OUT "rewind, search for changes in 'menu:modules:id'\n";
        $rplc = rewind_json( $ref );
        print OUT get_sorted_rplc_out();
        while ( $rplc = next_json( $ref, "menu:modules:id" ) )
        {
            print OUT '-'x40 . "\n";
            print OUT " pos is "  . $$ref{ "pos" };
            print OUT " mpos is " . $$ref{ "mpos" } . "\n";
            print OUT get_sorted_rplc_out();
        }
    }

    if ( 1 ) {
        print OUT '-'x40 . "\n";
        print OUT "rewind, search for changes in 'menu:modules:id|menu:id'\n";
        $rplc = rewind_json( $ref );
        print OUT get_sorted_rplc_out();
        while ( $rplc = next_json( $ref, "menu:modules:id" ) )
        {
            print OUT '-'x40 . "\n";
            print OUT " pos is "  . $$ref{ "pos" };
            print OUT " mpos is " . $$ref{ "mpos" } . "\n";
            print OUT get_sorted_rplc_out();
        }
    }

    close OUT;
    $diff = `cmp output.ref/$fo output/$fo 2>&1`;
    print "$f: " . ( $diff ? "FAILED\n" : "Passed\n" );
}
