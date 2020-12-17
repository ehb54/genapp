#!/usr/bin/perl

$|=1;

$f = "ga_fdb_t.js";

# $debug++;

my $gb   = $ENV{ "GENAPP" } || die "$0: environment variable GENAPP must be set\n";


$notes = "usage: $0
outputs js for ga.fdb from $gb/languages/html/types
";

print "perl version is $]\n" if $debug;
print "command is: $0 @ARGV\n" if $debug;

if ( $] < 5.018 ) {
    if ( -e "$gb/perl/bin/perl" ) {
        my $pv =`$gb/perl/bin/perl -e 'print \$];'`;
        if ( $pv >= 5.018 ) {
            print "will run new version\n" if $debug;
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

require "$gb/etc/perl/genapp_util.pl";

die "0: could not open $f for input\n" if !-e $f;

open IN, $f || die "$0: $f open error $!\n";

$l = `cat $f`;
chomp $l;
$l =~ s/^ga\.fdb\.t\s*=\s*//;
$l =~ s/;\s*$//;

$obj = decode_json( $l );

my %attribm;
my @attribs;

for $k ( keys %$obj ) {
    print "field $k\n" if $debug;
    for $r ( ( 'input', 'output' ) ) {
        for $l ( @{$$obj{$k}{$r}{'attrib'}} ) {
            print "\trole $r attrib $l\n" if $debug;
            push @attribs, $l if !$attribm{ $l }++;
        }
    }
}

@attribs = sort { $a cmp $b } @attribs;

# print join "\n", @attribs;
# print "\n";
@kattribs = ( 
    "accept",
    "alt",
    "append",
    "array",
    "backgroundcolor",
    "buttontext",
    "calc",
    "call",
    "changescalex",
    "changescaley",
    "checked",
    "cleartree",
    "clearval",
    "cols",
    "customtooltips",
    "default",
    "directory",
    "fontclass",
    "globuslogin",
    "googlelogin",
    "height",
    "help",
    "hide",
    "hideifnot",
    "hider",
    "hover",
    "jsmoladd",
    "label",
    "match",
    "max",
    "maxlength",
    "min",
    "multiple",
    "name",
    "onlyleaf",
    "pan",
    "pattern",
    "pull",
    "readonly",
    "repeat",
    "repeater",
    "report",
    "reportpath",
    "required",
    "rotatedylabel",
    "rows",
    "safefile",
    "savetofile",
    "selzoom",
    "setaltval",
    "setinputfromfile",
    "setinputfromfileids",
    "showcollapse",
    "single",
    "singlepath",
    "size",
    "specifiedproject",
    "step",
    "style",
    "sync",
    "tableize",
    "titlefontclass",
    "url",
    "value",
    "values",
    "width",
    "zoom",
    );
for $a ( @kattribs ) {
    $kattribm{$a}++;
}

for $a ( @attribs ) {
    $errors .= "missing definition for attribute '$a'\n" if !$kattribm{$a};
}

die $errors if length($errors);

@typeints = (
    "cols",
    "rows",
    );

for $a ( @typeints ) {
    $typeintm{ $a }++;
}

@typefloat = (
    "min",
    "max",
    "step"
    );

for $a ( @typefloat) {
    $typefloatm{ $a }++;
}

@typebool = (
    "changescalex",
    "changescaley",
    "checked",
    "directory",
    "globuslogin",
    "googlelogin",
    "repeater",
    );

for $a ( @typebool) {
    $typeboolm{ $a }++;
}

# build up field json
# later can add help & others

$res = {};

for $a ( @attribs ) {
    $$res{$a} = {};
    $$res{$a}{'label'} = "$a";
    $$res{$a}{'type'}  = "text";
    $$res{$a}{'type'}  = "integer"   if $typeintm{$a};
    $$res{$a}{'type'}  = "float"     if $typefloatm{$a};
    $$res{$a}{'type'}  = "checkbox"  if $typeboolm{$a};
}


    
if ( $debug ) {
    my $js = JSON->new;
    print $js->pretty->encode( $res ) . "\n";
} else {
    print "ga.fdb.d = " . encode_json( $res ) . ";\n";
}
