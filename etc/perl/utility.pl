use File::stat;

sub runcmd {
    my $cmd = $_[0];
    my $out;
    print "running shell command:\n--------\n$cmd\n--------\n" if $debug;
    open my $fh, "$cmd |";
    while ( <$fh> ) {
        $out .= $_;
        print if $debug;
    }
    close $fh;
    die "$0: command $cmd failed\n" if $?;
    $out;
}

## returns fhe file mtime
sub fmtime {
    my $f = shift;
    stat( $f )->mtime;
}

## returns the maximum file mtime from an array of files
sub maxfmtime {
    my @files = @{$_[0]};
    my $maxt  = 0;
    for my $f ( @files ) {
        my $tt = fmtime( $f );
        $maxt = $tt if $maxt < $tt;
    }
    $maxt;
}

## returns the maximum file mtime from a command result
sub maxcmdfmtime {
    my $cmd   = shift;
    my $files = runcmd( $cmd );
    my @files = split /\n/, $files;
    grep chomp, @files;
    maxfmtime( \@files );
}
    
return 1;
