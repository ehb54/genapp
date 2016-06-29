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

$bp = "$gap/etc/bp";
die "$0: no $bp directory found\n" if !-d $bp;

@bps = `cd $gap/etc/bp; ls -1`;
grep chomp, @bps;

$notes = "usage: $0 language-type

where language-type can be one of
" . ( join "\t", @bps ) . "

makes simple boiler plate executables in bin/ for all modules/ that aren't already in bin/
by replacing the __moduleid__ code in the language-type boiler plate file
";


$type = shift || die $notes;
die "no $type boiler plate found in $bp\n" if !-e "$bp/$type";

$bpc = `cat $bp/$type`;

require "$gap/etc/perl/genapp_util.pl";

@f = `ls -1 modules/*.json`;
grep chomp, @f;

while ( $f = shift @f )
{
    $json = get_file_json( $f );
    $exec = $$json{ "executable" };
    if ( !$exec ) {
        warn "$f has no executable name defined\n";
        next;
    }
    if( !length( $exec ) ) {
        warn "$f has and empty executable name defined\n";
        next;
    }
    $of = "bin/$exec";
    if ( -e "$of" ) {
        $exist++;
        if ( !-x "$of" ) {
            print "bin/$exec exists but is not executable, fixing\n";
            print `chmod +x $of`;
            $fixed++;
        }
        next;
    }
    if ( !-d "bin" ) {
        mkdir "bin";
        $bin++;
    }
    print "creating $of\n";
    open OUT, ">$of" || die "$0 >$of $!\n";
    $bpw = $bpc;
    $bpw =~ s/__moduleid__/$exec/g;
    print OUT $bpw;
    close OUT;
    print `chmod +x $of`;
    $created++;
}

print "bin directory created\n"  if $bin;
print "$exist executables already exist\n"  if $exist;
print "$fixed existing executables set to executable\n" if $fixed;
print "$created new executables created\n" if $created;
