#!/usr/bin/perl

# $debug++;

use File::Basename;

$notes = "usage: $0 tag filename
converts doc or docx to html using abiword and splits out style sheet and html and included images
replaces info with tag
returns file names for each
they should later be unlinked
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

$tag = shift || die $notes;
$f = shift || die $notes;

$f2u = $f;
$f2u =~ s/^.*\///;

die "$0: $f does not exist or is not readable\n" if !-e $f || !-r $f;

$td = "._genapp_tmp";

if ( !-d $td ) {
    mkdir $td || die "$0: could not create temporary directory $td, check permissions\n";
}

die "$0: $td is not writeable, check permissions\n"  if !-w $td;

$tb = basename( $f );
( $base, $type ) = $tb =~ /^(.*)\.([^.]*)$/;
$mf = $base;
$mf =~ s/\W+//g;
$utag = "${tag}_$mf";

$d = `date +'%Y%m%d%H%M%S'`;
chomp $d;

$od = "$td/${mf}_$d";
while( -e $od ) {
    $od = "$td/${mf}_$d_" . ++$ext;
}

print "od is $od\n" if $debug;
mkdir $od || die "$0: could not create temporary directory $od, check permissions\n";

$cmd = "cp '$f' $od; cd $od; abiword --to=html --to-name=$utag --exp-props='html-markup: html4;' '$f2u' 2> /dev/null";

print "$cmd\n" if $debug;
print `$cmd`;

# get html & css from output

open $fh, "$od/$utag" || die "$0: can not open abiword processed output $od/$utag\n";
my @l = <$fh>;
close $fh;
my $res = join '', @l;
( my $style ) = $res =~ /<style type="text\/css">((.|\n)*)<\/style>/m;
( my $body ) = $res =~ /<body>((.|\n)*)<\/body>/m;

# replace links __link
$body =~ s/__link{\s*(\S+)\s+(.*?)\s*}/<a href="$1" target="_blank">$2<\/a>/g;
$body =~ s/~/&#126;/g;
while ( $body =~ s/img style="(width:[^;"]*; height:[^;"]*)"/img style="width:replace"/ ) {
    push @imagestyles, $1;
}

$body =~ s/__hr__/<hr>/g;

# parse imagesizes

if ( $body =~ s/__imagesize:([^_]*)__// ) {
    my $imagesize = $1;
    $imagesize =~ s/\s*//g;
    my @imagesize = split ',', $imagesize;
    my $pos = 0;
    my $supress = 0;
    my $gpos = 0;
    while( $body =~ /img style="width:replace"/ ) {
        die "$0: error $f __imagesize:__ invalid parameter $imagesize[$pos]\n" if $imagesize[$pos] !~ /^(original|\d*(|\.\d*)%)$/;
        if ( $imagesize[$pos] =~ /^original$/ ) {
            $body =~ s/img style="width:replace"/img style="$imagestyles[$gpos]"/;
        } else {
            $body =~ s/img style="width:replace"/img style="width:$imagesize[$pos]"/;
        }
        $pos++;
        $gpos++;
        if ( $pos >= @imagesize ) {
            warn "$0: $f has more images than specified in the __imagesize:__ list, the last entry was repeatedly used\n" if !$supress++ && @imagesize > 1;
            $pos = @imagesize - 1;
        }
    }
} else {
    $body =~ s/img style="width:replace"/img style="width:75%"/g;
}

$x40 = '-'x40;

print "style is:$x40\n$style\n$x40\nbody is:$x40\n$body\n$x40\n" if $debug;

$cmd = "cd $od/${utag}_files 2> /dev/null && ls -1";
print "$cmd\n" if $debug;
@ftr = `cd $od/${utag}_files 2> /dev/null && ls -1`;

print "files are:$x40\n" . ( join '', @ftr ) . "\n$x40\n" if $debug;

$fo = "$od/${utag}.html";
open $fh, ">$fo" || die "$0: can not open $fo for writing\n";
print $fh $body;
close $fh;

$fo = "$od/${utag}.css";
open $fh, ">$fo" || die "$0: can not open $fo for writing\n";
print $fh $style;
close $fh;

unlink "$od/$utag" unless $debug;
unlink "$od/$f2u" unless $debug;

print "$od\n";
print "$utag\n";
