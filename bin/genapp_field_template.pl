#!/usr/bin/perl

$notes = "usage: $0 field-name
generates empty field-name.input and field-name.output for each current language
preexisting files will not be overwritten
";

$gap = $ENV{ "GENAPP" } || die "$0: error env variable GENAPP must be defined\n";

@langs = `cd $gap/languages ; find * -maxdepth 0 -type d`;
grep chomp, @langs;

$fn = shift || die $notes;


chdir $gap || die "$0: can not change to genapp directory $gap\n";

foreach $l ( @langs ) {
    foreach $t ( "input", "output" ) {
        my $f = "languages/$l/types/$fn.$t";

        if ( -e $f ) {
            push @exists, $f;
        } else {
            push @create, $f;
        }
    }
}

if ( $debug &&  @exists ) {
    print "preexisting:\n";
    print join "\n", @exists;
    print "\n";
    print "\n" if @create;
}

if ( @create ) {
    print "create:\n" if $debug;
    foreach $f ( @create ) {
        $cmd = "touch $f; svn add $f\n";
        print $cmd if $debug;
        print "$f\n";
        print `$cmd`;
    }
}

