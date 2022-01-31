#!/usr/bin/perl

# $debug++;
$t_name = "ga_fdb_t.js";
$d_name = "ga_fdb_d.js";

my $gb   = $ENV{ "GENAPP" } || die "$0: environment variable GENAPP must be set\n";

$language = "html5";
$tdir     = "$gb/languages/$language/types";

$|=1;


$notes = "usage: $0 target-directory

creates designer supplementary javascript containing types & data information
for the designer

";

$odir = shift || die $notes;

die "$odir is not a directory\n" if !-d $odir;
chdir $odir;

require "$gb/etc/perl/utility.pl";

$et = "$gb/etc/perl/dd_make_ga_fdb_t.pl";
$ed = "$gb/etc/perl/dd_make_ga_fdb_d.pl";

die "$et does not exist\n" if !-e $et;
die "$ed does not exist\n" if !-e $ed;

if ( -e $t_name && -e $d_name && !-z $t_name && !-z $d_name ) {
    $tmtime     = fmtime( $t_name );
    $dmtime     = fmtime( $d_name );
    $minouttime = $tmtime < $dmtime ? $tmtime : $dmtime;
    $maxintime  = maxcmdfmtime( "find $tdir -name '*.input' -or -name '*.output'" );
    if ( $maxintime < $minouttime ) {
        print "already latest version\n" if $debug;
        exit;
    }
}

runcmd( "perl $et > $t_name" );
print "$odir/$t_name\n";
runcmd( "perl $ed > $d_name" );
print "$odir/$d_name\n";

