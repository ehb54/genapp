#!/usr/bin/perl

$| = 1;

{
    if ( $] < 5.018 ) {
        my $f = "/etc/profile.d/genapp.sh";
        my $gb;
        if ( -e $f ) {
            my $fh;
            !open $fh, $f || die "Error: the version of perl found is < 5.18 and, although there exists $f, the permissions do now allow reading by this process\n";
            my @l = <$fh>;
            close $fh;
            @l = grep !/^\s*#/, @l;
            @l = grep /GENAPP=/, @l;
            grep chomp, @l;
            die "Error: the version of perl found is < 5.18 and, although there exists $f, there is no definition of GENAPP available within it.\n" if !@l;
            my $l = pop @l;
            ( $gb ) = $l =~ /GENAPP=([^#;]+)/;
            die "Error: the version of perl found is < 5.18 and, although there exists $f, the value of GENAPP within it could not be parsed.\n" if !$gb;
            die "Error: the version of perl found is < 5.18 and, although there exists $f, the value of GENAPP within it ($gb) is not a directory.\n" if !-d $gb;
        } else {
            die "Error: the version of perl found is < 5.18 and $f does not exist\n";
        }        
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

my $rc = eval {
    require JSON;         JSON->import();
};

my %dependencies;
my %module_json;
my %menus;

my $executable_path = "__executable_path:docker__";
my $bindir          = "/genapp/bin";
my $rundir          = "/genapp/run";

my $wdir = $0;
$wdir =~ s/\/[^\/]*$//;
chdir $wdir || die "Error: could not chdir to $wdir\n";
