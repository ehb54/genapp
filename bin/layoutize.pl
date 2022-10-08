#!/usr/bin/perl

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

use JSON;

$ltmpl = "$gap/etc/layout_templates";
die "$0: no $ltmpl directory found\n" if !-d $ltmpl;

@ltmpls = `cd $ltmpl && ls -1`;
grep chomp, @ltmpls;

die "no layouts found in $ltmpl\n" if !@ltmpls;

$notes = "usage: $0 template-name

where template-name can be one of

" . ( join "\t", @ltmpls ) . "

builds a layout version of the specified module json

";

$type = shift || die $notes;
die "no $type template named '$type' plate found in $ltmpl\n" if !-e "$ltmpl/$type";

$mod  = shift || die $notes;
die "modules/$mod does not exist\n" if !-e "modules/$mod";

$fo = "modules/$mod.new";
die "$fo already exists, please remove and try again\n" if -e $fo;

## check layout json
$f = "$ltmpl/$type";
open $fh, $f || die "$0: get_file_json error file open $f $!\n";
my @ol = <$fh>;
close $fh;
@l = grep !/^\s*#/ , @ol;
$l = join '', @l;

eval {
    $ljson = decode_json( $l );
    1;
} || do {
    my $e = $@;

    # figure out line #

    my ( $cp ) = $e =~ /at character offset (\d+) /;
    my $i;
    my $cpos = $cp;
    for ( $i = 0; $i < @ol; ++$i ) {
        next if $ol[ $i ] =~ /^\s*#/;
        $cpos -= length( $ol[ $i ] );
        last if $cpos < 0;
    }

    my $sline = $i - 2;
    my $eline = $i + 2;
    $sline = 0 if $sline < 0;
    $eline = @ol - 1 if $eline >= @ol;

    print "JSON Error in file $f near these lines:\n";
    for ( my $j = $sline; $j <= $eline; ++$j ) {
        my $uj = $j + 1;
        print "$uj: $ol[$j]";
        print "$uj: " .'^'x(length($ol[$j])) . "\n" if $j == $i;
    }
    die;
};

die "$ltmpl has no panels" if !exists $ljson->{panels};
die "$ltmpl has no fields" if !exists $ljson->{fields};

print "layout json ok\n";

## check module json
$f = "modules/$mod";
open $fh, $f || die "$0: get_file_json error file open $f $!\n";
my @ol = <$fh>;
close $fh;
@l = grep !/^\s*#/ , @ol;
$l = join '', @l;

eval {
    $mjson = decode_json( $l );
    1;
} || do {
    my $e = $@;

    # figure out line #

    my ( $cp ) = $e =~ /at character offset (\d+) /;
    my $i;
    my $cpos = $cp;
    for ( $i = 0; $i < @ol; ++$i ) {
        next if $ol[ $i ] =~ /^\s*#/;
        $cpos -= length( $ol[ $i ] );
        last if $cpos < 0;
    }

    my $sline = $i - 2;
    my $eline = $i + 2;
    $sline = 0 if $sline < 0;
    $eline = @ol - 1 if $eline >= @ol;

    print "JSON Error in file $f near these lines:\n";
    for ( my $j = $sline; $j <= $eline; ++$j ) {
        my $uj = $j + 1;
        print "$uj: $ol[$j]";
        print "$uj: " .'^'x(length($ol[$j])) . "\n" if $j == $i;
    }
    die;
};

die "$mod has no fields" if !exists $mjson->{fields};
die "$mod already has panels, this must be removed before layoutizing" if exists $mjson->{panels};

print "module json ok\n";

## add panels

$mjson->{panels} = $ljson->{panels};



## add fields

for ( $i = 0; $i < @{$mjson->{fields}}; ++$i ) {
    my $f = $mjson->{fields}[$i];
    die "no id provided for field # " . ( $i + 1 ) . " in $mod\n" if !exists $f->{id};
    print "field id $f->{id}\n";
    die "type not specified for field $f->{id}\n" if !exists $f->{type};
    die "when processing field $f->{id}, role $f->{roll} missing in $type\n" if !exists $ljson->{fields}->{$f->{role}};
    $mjson->{fields}[$i]->{layout} = $ljson->{fields}->{$f->{role}};
}

## save

open $fh, ">$fo" || die "$0 can not create $fo for writing $!\n";
$js = JSON->new;
print $fh $js->pretty->encode( $mjson );
close $fh;

$ltag = "Layout notes:\n" if exists $ljson->{notes};

print qq[
$fo created from $mod using layout $type
Note that comments are lost and key order is usually changed
Adjust as desired
To use this new layout, copy $fo to modules/$mod & rerun genapp

$ltag
$ljson->{notes}
]
    ;

