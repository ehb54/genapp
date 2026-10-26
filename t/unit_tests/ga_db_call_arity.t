use strict;
use warnings;

use File::Find;
use File::Spec;
use FindBin;
use Test::More;

use lib File::Spec->catdir( $FindBin::Bin, '..', 'lib' );
use GenAppTest qw(read_file repo_root);

# A call of a ga_db_* function with fewer arguments than the function requires is an ArgumentCountError
# at run time (PHP 7.1 and later), on paths that the PHP lint and compatibility checks do not reach:
# approvedeny-base.php's ga_db_update had no criteria from 2019 on, so every Approve and Deny link of
# register:requireapproval ended in a fatal error. Each call in the html5 PHP files (not the vendored
# libraries) is checked against the definitions in ga_db_lib_v7.php, with strings and comments blanked
# first. A parameter with a default before a required one is required too.

my $root  = repo_root( File::Spec->catdir( $FindBin::Bin, '..' ) );
my $html5 = File::Spec->catdir( $root, qw(languages html5) );
my $lib   = File::Spec->catfile( $html5, qw(sys ga_db_lib_v7.php) );

# the PHP text with strings, heredocs, comments and text outside the PHP tags turned into spaces
# (newlines kept), so that only code is left
sub blank_php {
    my ($text) = @_;
    my $out = '';
    my $n   = length $text;
    my $i   = 0;
    my $php = index( $text, '<?php' ) < 0 ? 1 : 0;    # a fragment with no PHP tag is all code
    my $keep = sub { my $s = shift; $s =~ s/[^\n]/ /g; $out .= $s };
    while ( $i < $n ) {
        if ( !$php ) {
            my $j = index $text, '<?php', $i;
            $j = $n if $j < 0;
            $keep->( substr $text, $i, $j - $i );
            $out .= substr $text, $j, 5 if $j < $n;
            $i = $j + 5;
            $php = 1;
            next;
        }
        my $rest = substr $text, $i, 3;
        my $c    = substr $text, $i, 1;
        if ( substr( $rest, 0, 2 ) eq '?>' ) {
            $out .= '?>';
            $i += 2;
            $php = 0;
            next;
        }
        if ( $c eq '"' || $c eq "'" || $c eq '`' ) {
            my $j = $i + 1;
            while ( $j < $n ) {
                my $d = substr $text, $j, 1;
                if ( $d eq '\\' ) { $j += 2; next }
                last if $d eq $c;
                $j++;
            }
            $out .= $c;
            $keep->( substr $text, $i + 1, $j - $i - 1 );
            $out .= $c;
            $i = $j + 1;
            next;
        }
        if ( $rest eq '<<<' && substr( $text, $i ) =~ /\A<<<[ \t]*(["']?)([A-Za-z_]\w*)\1[ \t]*\n/ ) {
            my ( $head, $label ) = ( length $&, $2 );
            my $body = substr $text, $i + $head;
            my $len  = $head + ( $body =~ /^[ \t]*\Q$label\E\b/m ? $+[0] : length $body );
            $out .= '""';
            $keep->( substr $text, $i, $len );
            $i += $len;
            next;
        }
        if ( substr( $rest, 0, 2 ) eq '/*' ) {
            my $j = index $text, '*/', $i + 2;
            $j = $n - 2 if $j < 0;
            $keep->( substr $text, $i, $j + 2 - $i );
            $i = $j + 2;
            next;
        }
        if ( substr( $rest, 0, 2 ) eq '//' || ( $c eq '#' && substr( $rest, 1, 1 ) ne '[' ) ) {
            my $j = index $text, "\n", $i;
            $j = $n if $j < 0;
            my $q = index $text, '?>', $i;
            $j = $q if $q >= 0 && $q < $j;
            $keep->( substr $text, $i, $j - $i );
            $i = $j;
            next;
        }
        $out .= $c;
        $i++;
    }
    return $out;
}

# the top-level arguments between the "(" at $open and its ")", in blanked text: brackets and braces
# (template markers such as __~x{, ...} included) nest, so their commas do not count
sub arguments {
    my ( $code, $open ) = @_;
    my ( $depth, $cur, @args ) = ( 0, '' );
    for my $i ( $open .. length($code) - 1 ) {
        my $c = substr $code, $i, 1;
        if ( $c =~ /[\(\[\{]/ ) {
            $cur .= $c if $depth++;
        }
        elsif ( $c =~ /[\)\]\}]/ ) {
            if ( --$depth == 0 ) {
                push @args, $cur if $cur =~ /\S/ || @args;
                return \@args;
            }
            $cur .= $c;
        }
        elsif ( $c eq ',' && $depth == 1 ) {
            push @args, $cur;
            $cur = '';
        }
        else {
            $cur .= $c;
        }
    }
    return \@args;
}

my %required;
my $lib_code = blank_php( read_file($lib) );
while ( $lib_code =~ /\bfunction\s+(ga_db_\w+)\s*\(/g ) {
    my $name   = $1;
    my $params = arguments( $lib_code, pos($lib_code) - 1 );
    my $count  = 0;
    for my $k ( 0 .. $#$params ) {
        $count = $k + 1 unless $params->[$k] =~ /=/ || $params->[$k] =~ /\.\.\./;
    }
    $required{$name} = $count;
}
cmp_ok( scalar keys %required, '>=', 15, 'ga_db_lib_v7.php defines the ga_db_* functions' );
is( $required{ga_db_update}, 4, 'ga_db_update requires the collection, the application, the criteria and the update' );

my @files;
find(
    {   no_chdir => 1,
        wanted   => sub {
            if ( -d $_ && /\/vendor\z/ ) { $File::Find::prune = 1; return }
            push @files, $_ if /\.php\z/ && !/ga_db_lib_v5\.php\z/;
        },
    },
    $html5
);
cmp_ok( scalar @files, '>', 100, 'the html5 PHP files are found' );

my ( $calls, @short ) = (0);
for my $file ( sort @files ) {
    my $code = blank_php( read_file($file) );
    while ( $code =~ /(?<![\w\$>:\\])(ga_db_\w+)\s*\(/g ) {
        my ( $name, $start, $open ) = ( $1, $-[0], pos($code) - 1 );
        next if !exists $required{$name} || substr( $code, 0, $start ) =~ /\bfunction\s+\z/;
        $calls++;
        my $args = arguments( $code, $open );
        next if @$args >= $required{$name};
        my $line = 1 + ( substr( $code, 0, $start ) =~ tr/\n// );
        push @short, sprintf '%s:%d: %s with %d of its %d required arguments', File::Spec->abs2rel( $file, $root ),
            $line, $name, scalar @$args, $required{$name};
    }
}
cmp_ok( $calls, '>', 100, 'ga_db_* calls are found in the html5 PHP files' );
is_deeply( \@short, [], 'no ga_db_* call has fewer arguments than the function requires' ) or diag join "\n", @short;

done_testing;
