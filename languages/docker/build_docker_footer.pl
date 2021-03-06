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
    my %copymap;
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
                $copymap{ $val }++;
                next;
            }

            if ( $k eq 'run' ) {
                my $cmd = $val;
                $out .= "RUN $cmd\n";
                next;
            }

            if ( $k eq 'env' ) {
                my $env = $val;
                $env =~ s/\=/ /;
                $out .= "ENV $env\n";
                next;
            }

            $error .= "Module '$mod' : dependencies entry " . ( $i + 1 ) . " '" . encode_json( $entry ) . "' unknown tag '$k'\n";
            $has_error++;
            last;
        }
    }

    # add executable

    $out .= "COPY $$modjson{'executable'} $$modjson{'executable'}\n";
    push @copys, "$executable_path/$$modjson{'executable'}";

    ## if executable is not equal to module name, create symlink to enable appconfig:resource:docker*
    if ( $$modjson{'executable'} ne $mod ) {
        ### check if there is a clobber first, this is an error!
        if ( $copymap{ $mod } ) {
            $error .= "Module '$mod' : executable name does not match module id, yet there is a dependency of the same name\n";
            $has_error++;
        } else {
            $out .= "RUN ln -s $$modjson{'executable'} $mod\n";
        }
    }
    
    next if $has_error;

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

    # in dockerhub mode? (i.e. push and name appropriately)
    # name needs to match in html5/abacolib.php
    
    $dhmode = "__dockerhub:user__" ne '_' . '_dockerhub:user__';
    $dhtag = "";
    if ( $dhmode ) {
        if ( "__dockerhub:id__" ne '_' . '_dockerhub:id__' ) {
            $dhtag = "__dockerhub:id__";
            $dhtag =~ s/ //g;
        } else {
            $dhtag = lc( `hostname` );
            chomp $dhtag;
            $dhtag =~ s/[^a-z0-9_.-]/_/g;
        }
        if ( length( $dhtag ) ) {
            $dhtag .= "_";
        }
        $dhnopush = "__dockerhub:nopush__" ne '_' . '_dockerhub:nopush__';
        if ( $dhnopush ) {
            $warn .= "No push to dockerhub flag set!\n";
        }
    }

    # make container name

    # current docker:local resource specifier
    $cname = lc( "genapp_${dhtag}__application__" );
    if ( length( $cname ) > 30 ) {
        $warn .= "truncating docker image name '$cname' to leftmost 30 characters\n";
        $cname = substr( $cname, 0, 30 );
    }
    $tname = "${menu}-${mod}";

    if ( length( $tname ) > 128 ) {
        $warn .= "truncating docker image tag '$tname' to leftmost 128 characters\n";
        $tname = substr( $tname, 0, 128 );
    }
    
    $uname = "$cname:$tname";

    if ( $dhmode ) {
        $uname = "__dockerhub:user__/$uname";
    }

    # build containers
    $cmd = "cd $destdir && docker build -t $uname .";
    print "$cmd\n";
    system( $cmd );

    # push to dockerhub

    if ( $dhmode && !$dhnopush ) {
        $cmd = "docker push $uname 2>&1";
        print "$cmd\n";
        my $result = `$cmd`;
        if ( $result =~ /denied:/ ) {
            $error .= "You must $ docker login -u __dockerhub:user__\n";
        }
    }
}
    
print "================================================================================
Warnings:
--------------------------------------------------------------------------------
${warn}================================================================================
" if $warn;

die "================================================================================
Errors:
--------------------------------------------------------------------------------
${error}================================================================================

" if $error;
