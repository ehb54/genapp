#!/usr/bin/perl

$|=1;

# $debug++;

my $gb   = $ENV{ "GENAPP" } || die "$0: environment variable GENAPP must be set\n";

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
sub clean_content {
    my $f = shift;
    my @l = `cat $f`;
    grep chomp, @l;
    grep s/\/\/.*$//, @l;
    my @r;
    my $incomment = 0;
    for my $l ( @l ) {
        if ( $l =~ /\*\// ) {
            die "$f: unbalanced comment closing $f line '$l'\n" if !$incomment;
            $incomment = 0;
            die "$f: unsupported text after comment\n" if $l =~ /\*\/\s*\S+\s*$/;
            next;
        }
        if ( $l =~ /\/\*/ ) {
            die "$f: unsupported nexted comments $f line '$l'\n" if $incomment;
            $incomment = 1;
            die "$f: unsupported text before comment\n" if $l =~ /^\s*\S+\s*\/\*/;
            next;
        }
        next if $incomment;
        push @r, $l;
    }
    @r = grep !/^\s*$/, @r;
    return join '', @r;
}

sub extract_fields {
    my $c = shift;
    # print "extract_fields()\n$c\n";
    my %tags;
    my @matches = $c =~ /__[!~]fields:([A-Za-z0-9_]+)\{/g;
    for my $m ( @matches ) {
        # print "found field:'$m'\n";
        $tags{$m}++;
    }
    @matches = $c =~ /__fields:([A-Za-z0-9_]+)__/g;
    for my $m ( @matches ) {
        # print "found field:'$m'\n";
        $tags{$m}++;
    }
    my @res;
    for my $k ( keys %tags ) {
        push @res, $k;
    }
    @res = sort { $a cmp $b } @res;
    return @res;
}

$language = "html5";

$tdir = "$gb/languages/$language/types";

die "expected directory $tdir does not exist\n" if !-d $tdir;

$cmd = "(cd $tdir && ls *.input *.output | awk -F. '{ print \$1 }' | sort -u)";
# print "$cmd\n";

@types = `(cd $tdir && (ls *.input *.output | awk -F. '{ print \$1 }' | sort -u))`; 

grep chomp, @types;

$res = {};

for $t ( @types ) {
    $$res{ $t } = {};
    for $e ( ( 'input', 'output' ) ) {
        $f = "$tdir/$t.$e";
        if ( !-e $f ) {
            warn "expected file $f does not exist\n";
            next;
        }
        $$res{ $t }{ $e } = {};
        $cc = clean_content( $f );
        $$res{ $t }{ $e }{ 'content' } = $cc;
        @res = extract_fields( $cc );
        for $k ( @res ) {
            $$res{ $t }{ $e }{ 'attrib' } = \@res;
        }
    }
}

# $json = JSON->new;
# print $json->pretty->encode( $res ) . "\n";
print "ga.fdb = " . encode_json( $res ) . ";\n";
