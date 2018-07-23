# process each module with dependencies

foreach my $mod ( keys %dependencies ) {
    my $menu = $menus{ $mod };
    print "checking $menu:$mod\n";
    if ( $dependencies{ $mod } =~ /^_{2}dependencies__/ ) {
        print "no dependencies\n";
        $error .= "Module '$mod' : no dependencies defined, can not create docker container.\n";
        next;
    }
    $depjson = decode_json( $dependencies{ $mod } );
    $modjson = decode_json( $module_json{ $mod } );
    if ( !$$modjson{'executable'} ) {
        $error .= "Module '$mod' has no 'executable' defined.\n";
        next;
    }
    print "executable is $$modjson{'executable'}\n";


    # build up and output docker file based upon dependencies
    # executable needs copying
    my $out;
    my $has_error;
    my $has_base;
    my @copys;
    my $has_cpanm;
    
    for ( my $i = 0; $i < @$depjson; ++$i ) {
        my $entry = $$depjson[$i];
        if ( scalar ( keys %$entry ) != 1 ) {
            $has_error++;
            $error .= "Module '$mod' : dependencies entry " . ( $i + 1 ) . " '" . encode_json( $entry ) . "' does not have exactly 1 key\n";
            break;
        }

        my $k = (keys %$entry)[0];
        my $v = $$entry{$k};
        $k = lc( $k );
        if ( ref( $v ) ne 'ARRAY' ) {
            my @v = ( $v );
            $v = \@v;
        }
        # create command to build and post (?) dockerfile

        for ( my $j = 0; $j < @$v; ++$j ) {
            my $val = $$v[$j];
            if ( length( ref( $val ) ) ) {
                $error .= "Module '$mod' : dependencies entry " . ( $i + 1 ) . " '" . encode_json( $entry ) . "' improper value in list entry number " . ( $j + 1 ) . "\n";
                $has_error++;
                next;
            }
            if ( $k eq 'base' ) {
                if ( $hasbase ) {
                    $error .= "Module '$mod' : dependencies entry " . ( $i + 1 ) . " '" . encode_json( $entry ) . "' multiple 'base' tags found, only one allowed\n";
                    $has_error;
                    last;
                }
                $out .= "FROM $val\n";
                $out .= "WORKDIR $bindir\n";
                $has_base++;
                next;
            }
            if ( !$has_base ) {
                $warn .= "No 'base' entry found in first position, defaulting to 'ubuntu'\n";
                $out .= "FROM ubuntu\n";
                $out .= "WORKDIR $bindir\n";
                $has_base++;
                next;
            }                
            if ( $k eq 'cpan' ) {
                if ( !$has_cpanm ) {
                    $out .= "RUN curl -L http://cpanmin.us | perl - App::cpanminus\n";
                    $out .= "RUN mv /usr/bin/perl /usr/bin/perl.save\n";
                    $out .= "RUN ln -s /usr/local/bin/perl /usr/bin/perl\n";
                    $has_cpanm++;
                }
                $out .= "RUN cpanm $val\n";
                next;
            }

            if ( $k eq 'file' ) {
                my $dest = $val;
                $dest =~ s/^.*\///g;
                $out .= "COPY $dest $dest\n";
                $val = "$executable_path/$val" if $val !~ /^\//;
                push @copys, $val;
                next;
            }

            $error .= "Module '$mod' : dependencies entry " . ( $i + 1 ) . " '" . encode_json( $entry ) . "' unknown tag '$k'\n";
            $has_error++;
            last;
        }
    }

    next if $has_error;

    # add executable

    $out .= "COPY $$modjson{'executable'} $$modjson{'executable'}\n";
    push @copys, "$executable_path/$$modjson{'executable'}";

    # add CMD

    ## always run in $rundir ?
    $out .= "WORKDIR $rundir\n";

    ## straight form: 
    ## $out .= "CMD [\"$bindir/$$modjson{'executable'}\"]\n";

    ## abaco MSG form:
    $out .= "CMD $bindir/$$modjson{'executable'} `echo \$MSG`\n";

    # write dockerfile
    if ( !-d $menu ) {
        if ( -e $menu ) {
            $error .= "File $menu exists in output folder, but is not a directory\n";
            next;
        }
        if ( !mkdir $menu ) {
            $error .= "Could not create subdir $menu $!\n";
            next;
        }
    }

    my $destdir = "$menu/$mod";
    if ( !-d $destdir ) {
        if ( -e $destdir ) {
            $error .= "File $destdir exists in output folder, but is not a directory\n";
            next;
        }
        if ( !mkdir $destdir ) {
            $error .= "Could not create subdir $destdir $!\n";
            next;
        }
    }
        
    my $df = "$destdir/Dockerfile";
    my $fh;
    if ( !( open $fh, ">$df" ) ) {
        $error .= "Could not create file $df for writing\n";
        next;
    }
    print $fh $out;
    close $fh;

    # do copies
    $cmd = "cp " . ( join " ", @copys ) . " $destdir/";
    print "$cmd\n";
    system( $cmd );

    # build containers
    $cmd = "cd $destdir && docker build -t genapp___application___${menu}_${mod} .";
    print "$cmd\n";
    system( $cmd );
}
    
print "Warnings:\n$warn" if $warn;
die "Errors:\n$error" if $error;
