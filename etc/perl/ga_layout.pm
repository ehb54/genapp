use Scalar::Util qw(looks_like_number);

sub get_inherited_value {
    my $json     = shift;
    my $panelpos = shift;
    my $panel    = shift;
    my $inh      = shift;

    return $$json{'panels'}[$$panelpos{$panel}]{$panel}{$inh} if $$json{'panels'}[$$panelpos{$panel}]{$panel}{$inh};

    die "root panel missing essential key $inh\n" if $panel eq 'root';

    die "unexpected missing parent panel $panel\n" if !$$json{'panels'}[$$panelpos{$panel}]{$panel}{'parent'};

    return get_inherited_value( $json, $panelpos, $$json{'panels'}[$$panelpos{$panel}]{$panel}{'parent'}, $inh );
}

sub get_inherited_subvalue {
    my $json     = shift;
    my $panelpos = shift;
    my $panel    = shift;
    my $key      = shift;
    my $inh      = shift;

    return $$json{'panels'}[$$panelpos{$panel}]{$panel}{$key}{$inh} if $$json{'panels'}[$$panelpos{$panel}]{$panel}{$key}{$inh};

    die "root panel missing essential key $inh\n" if $panel eq 'root';

    die "unexpected missing parent panel $panel\n" if !$$json{'panels'}[$$panelpos{$panel}]{$panel}{'parent'};

    return get_inherited_subvalue( $json, $panelpos, $$json{'panels'}[$$panelpos{$panel}]{$panel}{'parent'}, $key, $inh );
}

sub typeof {
    my $expr = shift;
    if ( ref( $expr ) ) {
        return ref( $expr ) . "ref";
    }
    return ref( \$expr );
}

sub increment_cursor_column {
    my $cursor_r   = shift;
    my $cursor_c   = shift;
    my $parentcols = shift;
    my $samerow    = shift;

    print STDERR "increment cursor column parentcols $parentcols samerow $samerow\n" if $debuglayout;

    $$cursor_c++;
    # if ( !$parentcols || $$cursor_c > $parentcols ) {
    if ( $parentcols && $$cursor_c > $parentcols ) {
        $$cursor_r++ if !$samerow;
        $$cursor_c = 1;
    }
}

sub setmaxloc {
    my $loc_r = shift;
    my $loc_c = shift;
    my $max_r = shift;
    my $max_c = shift;

    if ( $$max_r < $loc_r ) {
       $$max_r = $loc_r;
    }
    
    if ( $$max_c < $loc_c ) {
        $$max_c = $loc_c;
    }
}

sub fields_in_panel {
    my $msg          = shift;
    my $panel        = shift;
    my $json         = shift;
    my $cursor_r     = shift;
    my $cursor_c     = shift;
    my $loc_row      = shift;
    my $loc_col      = shift;
    my $max_row      = shift;
    my $max_col      = shift;
    my $valid_panels = shift;

    # enumerate interesting panels

    my %onlypanels = ();

    if ( $valid_panels ne 'all' ) {
        my @vpanels = split /,/, $valid_panels;
        for my $i ( @vpanels ) {
            $onlypanels{ $i }++;
        }
    }
    
    return if keys %onlypanels && !$onlypanels{$panel};

    # print a summary of current layout by panel and cursors

    # get panels

    # print nice grid from current lgc, lgr, dgc, dgr, rgc, rgr

    my @usedgrid;
    my $urowmax = 0;
    my $ucolmax = 0;

    print '='x40 . "\n";
    print "$msg $panel:\n";
    print '-'x40 . "\n";


    for ( my $i = 0; $i <  @{$$json{'fields'} }; ++$i ) {
        my $field    = $$json{'fields'}[$i];
        my $fieldid  = $$field{'id'};
        my $layout   = $$field{'layout'};
        my $parent   = $$layout{'parent'};
        my $location = $$layout{'location'};
        next if $parent ne $panel;
        
        my $MAX_ROW = 10;
        my $MAX_COL = 10;
        
        my @types = ( 'l', 'd', 'r' );
        my @tags  = ( 'L', 'D', 'R' );

        for ( $t = 0; $t < @types; ++$t ) {
            my $tgr = "$types[$t]gr";
            my $tgc = "$types[$t]gc";
            my $tag = $tags[$t];
            
            if ( $$field{ $tgr } && $$field{ $tgc } ) {
                my $irow = $$field{$tgr};
                my $icol = $$field{$tgc};

                print "$fieldid $tag $irow $icol\n";
                my $urow_s;
                my $urow_e;
                my $ucol_s;
                my $ucol_e;
                
                if ( looks_like_number( $irow ) ) {
                    $urow_s = $irow;
                    $urow_e = $irow;
                } else {
                    if ( $irow =~ /^(\d+)\/((?:-|)\d+)$/ ) {
                        $urow_s = $1;
                        $urow_e = $2;
                        if ( $urow_e == -1 ) {
                            $urow_e = $MAX_ROW;
                        }
                    } else {
                        die "fields_in_panel: '$fieldid' unknown range type '$irow'\n";
                    }
                }
                if ( looks_like_number( $icol ) ) {
                    $ucol_s = $icol;
                    $ucol_e = $icol;
                } else {
                    if ( $icol =~ /^(\d+)\/((?:-|)\d+)$/ ) {
                        $ucol_s = $1;
                        $ucol_e = $2;
                        if ( $ucol_e == -1 ) {
                            $ucol_e = $MAX_COL;
                        }
                    } else {
                        die "fields_in_panel: '$fieldid' unknown range type '$icol'\n";
                    }
                }

                for ( my $j = $urow_s; $j <= $urow_e; ++$j ) {
                    for ( my $k = $ucol_s; $k <= $ucol_e; ++$k ) {
                        if ( length( $usedgrid[$j][$k] ) ) {
                            $usedgrid[$j][$k] = "X";
                        } else {
                            $usedgrid[$j][$k] = $tag;
                        }
                    }
                }
                $urowmax = $urow_e if $urowmax < $urow_e;
                $ucolmax = $ucol_e if $ucolmax < $ucol_e;
            }
        }
    }

    
    print '-'x40 . "\n";

    for ( my $i = 1; $i <= $urowmax; ++$i ) {
        for ( my $j = 1; $j <= $ucolmax; ++$j ) {
            my $out = $usedgrid[$i][$j];
            $out = "." if !length( $out );
            print $out;
        }
        print "\n";
    }
    print '-'x40 . "\n";
    print "cursor $cursor_r\t$cursor_c\n";
    print "loc    $loc_row\t$loc_col\n";
    print "max    $max_row\t$max_col\n";
    print '='x40 . "\n";

}
    


sub layout_prep {
    my $mname  = shift;
    my $layout = shift; 
    my $json   = shift; 

    $json = decode_json( encode_json( $json ) );

    my $moduleid = $$json{ "moduleid" };

    # check for panels
    if ( $extra_subs{ '__panels__' } ) {
        $$layout{ 'panels' } = decode_json( $extra_subs{ '__panels__' } );
        print "$f has panels\n" if $debuglayout;
    } else {
        $$layout{ 'panels' } = decode_json( "[]" );
    }

    # setup panel defaults (overrides in directives or somewhere else?)

    my %panel_apos;
    {
        my %used_panel_name;
        for ( my $i = 0; $i <  @{$$layout{'panels'} }; ++$i ) {
#            my $panel_name = ( keys $$layout{'panels'}[$i] )[0];
            my $panel_name = ( keys %{$$layout{'panels'}[$i]} )[0];
            if ( $used_panel_name{ $panel_name }++ ) {
                $error .= "module: $mname : panel $panel_name duplicated\n";
                last;
            }
            $panel_apos{ $panel_name } = $i;
        }

        for my $k ( keys %panel_apos ) {
            print "key $k pos $panel_apos{$k}\n" if $debuglayout;
        }

        if ( exists $panel_apos{ 'root' } &&
             $panel_apos{ 'root' } != 0 ) {
            $warn .= "module: $mname : root panel defined and not the first panel, moving to first position\n";
            my $tmp = $$layout{'panels'}[$panel_apos{ 'root' }];
            splice( @{$$layout{ 'panels' }}, $panel_apos{ 'root' }, 1 );
            unshift @{$$layout{ 'panels' }}, $tmp;
        }

        if ( !exists $panel_apos{ 'root' } ) {
            unshift @{$$layout{ 'panels' }}, decode_json( '{"root":{}}' );
        }

        if ( !exists $$layout{ 'panels' }[0]{ 'root' }{ 'size' } ) {
            $$layout{ 'panels' }[0]{ 'root' }{ 'size' } = [ "auto", "auto" ];
        }
        if ( !exists $$layout{ 'panels' }[0]{ 'root' }{ 'align' } ) {
            $$layout{ 'panels' }[0]{ 'root' }{ 'align' } = "left";
        }
        if ( !exists $$layout{ 'panels' }[0]{ 'root' }{ 'gap' } ) {
            $$layout{ 'panels' }[0]{ 'root' }{ 'gap' } = "5px";
        }
        if ( !exists $$layout{ 'panels' }[0]{ 'root' }{ 'label' } ) {
            $$layout{ 'panels' }[0]{ 'root' }{ 'label' } = [ 1, 1 ];
        }
        if ( !exists $$layout{ 'panels' }[0]{ 'root' }{ 'data' } ) {
            $$layout{ 'panels' }[0]{ 'root' }{ 'data' } = [ 1, 2 ];
        }
        # repeats section
        if ( !exists $$layout{ 'panels' }[0]{ 'root' }{ 'repeats' } ) {
            $$layout{ 'panels' }[0]{ 'root' }{ 'repeats' } = decode_json( '{"location":["next","full"],"size":["auto","auto"]}' );
        } else {
            if ( !exists $$layout{ 'panels' }[0]{ 'root' }{ 'repeats' }{ 'size' } ) {
                $$layout{ 'panels' }[0]{ 'root' }{ 'repeats' }{ 'size' } = [ "auto", "auto" ];
            }
            if ( !exists $$layout{ 'panels' }[0]{ 'root' }{ 'repeats' }{ 'location' } ) {
                $$layout{ 'panels' }[0]{ 'root' }{ 'repeats' }{ 'location' } = ["next","full"];
            }
        }
    }

    %panel_apos = ();

    {
        my %used_panel_name;
        for ( my $i = 0; $i <  @{$$layout{'panels'} }; ++$i ) {
#            my $panel_name = ( keys $$layout{'panels'}[$i] )[0];
            my $panel_name = ( keys %{$$layout{'panels'}[$i]} )[0];
            if ( $used_panel_name{ $panel_name }++ ) {
                $error .= "module: $mname : panel $panel_name duplicated\n";
                last;
            }
            $panel_apos{ $panel_name } = $i;
        }
    }

    for my $k ( keys %panel_apos ) {
        print "after panel fixup: key $k pos $panel_apos{$k}\n" if $debuglayout;
    }
    
# insert buttons if not specified
    {
        my %fieldnames;
        my %fieldpanel;

        for my $k ( @{$$json{ 'fields' }} ) {
            if ( !exists $$k{ 'id' } ) {
                my $js = JSON->new;
                $error .= "module: $mname : field missing id : " . $js->pretty->encode( $k ) . "\n";
            } else {
                $fieldnames{ $$k{ 'id' } }++;
                if ( exists $$k{ 'layout' } &&
                     exists $$k{ 'layout' }{ 'parent' } ) {
                    $fieldpanel{ $$k{ 'id' } } = $$k{ 'layout' }{ 'parent' };
                } else {
                    $fieldpanel{ $$k{ 'id' } } = 'root';
                }
            }
        }

# determine "case" for added controls

        my $control_case;
        my $use_control_panel  = 0;
        my $add_control_panel  = 0;
        my $inserts_at_end     = 0;
        my $inserts_at         = "output";
        my $inserts_type       = "role";
        my $inserts_before     = 1;

        if ( keys %panel_apos == 1 ) {
            $control_case = "only_root";
            if ( (keys %panel_apos)[0] ne 'root' ) {
                $error .= "module: $mname : only one panel defined and it is not named 'root'\n";
            }
        } elsif ( exists $panel_apos{ 'controls' } ) {
            $control_case       = "control_panel_exists";
            $use_control_panel  = 1;
            $inserts_at_end     = 1;
        } else {
            $control_case       = "create_control_panel";
            $add_control_panel  = 1;
            $use_control_panel  = 1;
            $inserts_at_end     = 1;
        }

        print "control case $control_case\n" if $debuglayout;

# add control panel if needed
        if ( $add_control_panel ) {
#            push $$layout{ 'panels' }, decode_json(
            push @{$$layout{ 'panels' }}, decode_json(
                '{
                    "controls" : {
                        "size"     : [ "auto", "auto" ],
                        "location" : [ "next", "full" ],
                        "label"    : [ 1, 1 ],
                        "data"     : [ 2, 1 ],
                        "align"    : "center"
                    }
                }' 
                );
        }

        my @insert = (
            'b_submit'
            ,'b_reset'
            );

        my @toinsert;

        for my $k ( @insert ) {
            if ( !exists $fieldnames{ $k } ) {
                push @toinsert, $k;
            }
        }

        my %insertjson;
        $insertjson{ 'b_submit' } =
            decode_json(
                '{
                    "role"        : "input"
                    ,"id"         : "b_submit"
                    ,"type"       : "button"
                    ,"buttontext" : "Submit"
                    ,"layout"     : {
                        "data"     : [ 1, 1 ]
                    }
                 }
                '
            );
        
        $insertjson{ 'b_reset' } =
            decode_json(
                '{
                    "role"        : "input"
                    ,"id"         : "b_reset"
                    ,"type"       : "button"
                    ,"buttontext" : "Reset to default values"
                    ,"layout"     : {
                        "data"     : [ 0, 2 ]
                    }
                 }
                '
            );

# special inserts
        my @specinserts = ( 
            "${moduleid}_progress",
            "${moduleid}_output_airavata",
            "${moduleid}_output_msgs",
            "${moduleid}_output_textarea"
            );

        push @toinsert, @specinserts;

        $insertjson{ "${moduleid}_progress" } =
            decode_json(
                qq/{
                   "role"        : "output"
                    ,"id"         : "${moduleid}_progress"
                    ,"type"       : "span"
                    ,"layout"     : {
                        "label"    : "none",
                        "data"     : [ 1, [ 1, 3 ] ]
                    }
                }/
            );


        $insertjson{ "${moduleid}_output_airavata" } =
            decode_json(
                qq/{
                   "role"        : "output"
                    ,"id"         : "${moduleid}_output_airavata"
                    ,"type"       : "span"
                    ,"layout"     : {
                        "data"     : [ 1, [ 1, 3 ] ]
                    }
                }/
            );

        $insertjson{ "${moduleid}_output_msgs" } =
            decode_json(
                qq/{
                   "role"        : "output"
                    ,"id"         : "${moduleid}_output_msgs"
                    ,"type"       : "span"
                    ,"layout"     : {
                        "data"     : [ 1, [ 1, 3 ] ]
                    }
                }/
            );

        $insertjson{ "${moduleid}_output_textarea" } =
            decode_json(
                qq/{
                   "role"        : "output"
                    ,"id"         : "${moduleid}_output_textarea"
                    ,"type"       : "span"
                    ,"layout"     : {
                        "data"     : [ 1, [ 1, 3 ] ]
                    }
                }/
            );

# fixup %insertjson if needed

        if ( $use_control_panel ) {
            print "using control panel\n" if $debuglayout;
            for my $k ( keys %insertjson ) {
                $insertjson{ $k }{ 'layout' }{ 'parent' } = 'controls';
            }
        }

# extract field info & layout info

        # extract specific fields:tags

        my %keepids;
        {
            my @ids = ( "id",
                        "role",
                        "type",
                        "layout",
                        "repeater",
                        "repeat" );
            @keepids{ @ids } = (1) x @ids;
        }

        $$layout{ 'fields' } = [];
        
        my $doneinsertbuttons = !@toinsert;

        for my $k ( @{$$json{ 'fields' }} ) {
            my %pushfield;

            print "dump of k\n" . Dumper( $k ) if $debuglayout;

            my $do_insert_after = 0;

            if ( !$inserts_at_end &&
                 !$doneinsertbuttons &&
                 $$k{ $inserts_type } eq $inserts_at ) {
                if ( $inserts_before ) {
                    for my $ik ( @toinsert ) {
#                       push $$layout{ 'fields' }, $insertjson{ $ik };
                        push @{$$layout{ 'fields' }}, $insertjson{ $ik };
                    }
                    $doneinsertbuttons++;
                } else {
                    $do_insert_after = 1;
                }
            }

#            foreach my $fk ( keys $k ) {
            foreach my $fk ( keys %{$k} ) {
                if ( $keepids{ $fk } ) {
                    $pushfield{ $fk } = $k->{$fk};
                }
            }
            
            print "dump of \%pushfield\n" . Dumper( %pushfield ) if $debuglayout;

#            push $$layout{ 'fields' }, \%pushfield;
            push @{$$layout{ 'fields' }}, \%pushfield;

            if ( $do_insert_after ) {
                for my $ik ( @toinsert ) {
#                    push $$layout{ 'fields' }, $insertjson{ $ik };
                    push @{$$layout{ 'fields' }}, $insertjson{ $ik };
                }
                $doneinsertbuttons++;
            }
        }

        if ( !$doneinsertbuttons ) {
            for my $ik ( @toinsert ) {
#                push $$layout{ 'fields' }, $insertjson{ $ik };
                push @{$$layout{ 'fields' }}, $insertjson{ $ik };
            }
        }
    }
}

sub layout_expand {
    my $mname    = shift;
    my $json     = shift;
    my $jsonfull = shift;

    $jsonfull    = $json if !$jsonfull;

    if ( $debuglayout ) {
        my $js = JSON->new;
        print "JSON before prep" . '-'x40 . "\n" . $js->pretty->encode( $json ) . "\n" . '-'x40 . "\n";
    }

    layout_prep( $mname, $json, $jsonfull );

    if ( $debuglayout ) {
        my $js = JSON->new;
        print "JSON after prep" . '-'x40 . "\n" . $js->pretty->encode( $json ) . "\n" . '-'x40 . "\n";
    }

# phase 1 panels

## step 1 check for missing parent panels & assign parent panels

    my %panelpos;

### pass 1 : collect parent names
    my %panelpos;

    {
        my %used_panel_name;
        for ( my $i = 0; $i <  @{$$json{'panels'} }; ++$i ) {
#            my $panel_name = ( keys $$json{'panels'}[$i] )[0];
            my $panel_name = ( keys %{$$json{'panels'}[$i]} )[0];
            $error .= "module: $mname : panel name $panel_name duplicated\n" if $used_panel_name{ $panel_name }++;
            $panelpos{ $panel_name } = $i;
            # print "panel $panel_name found at pos $i\n";
        }
    }    

### pass 2 : validate panelpos & set default parent if not specified

    for my $k ( keys %panelpos ) {
        if ( $$json{'panels'}[$panelpos{$k}]{$k}{'parent'} ) {
            my $pname = $$json{'panels'}[$panelpos{$k}]{$k}{'parent'};
            # print "found parent $pname of panel $k\n";
            # print "panel $k has parent $$json{'panels'}[$panelpos{$k}]{$k}{'parent'}\n";
            $error .= "module: $mname : $f panel $k parent '$$json{'panels'}[$panelpos{$k}]{$k}{'parent'}' not defined\n" if !exists $panelpos{$$json{'panels'}[$panelpos{$k}]{$k}{'parent'}};
        } else {
            $$json{'panels'}[$panelpos{$k}]{$k}{'parent'} = 'root' if $k ne 'root';
        }
    }

## step 2 propagate parent keys

    {
        my %inherit;
        {
            # keys to progagate
            my @ikeys = ( 
                "gap",
                "align",
                "label",
                "data"
                );
            @inherit{ @ikeys } = (1) x @ikeys;
        }

        for my $k ( keys %panelpos ) {
            for my $inh ( keys %inherit ) {
                $$json{'panels'}[$panelpos{$k}]{$k}{$inh} = get_inherited_value( $json, \%panelpos, $k, $inh );
            }
        }
    }
    
    # subvalue inherits
    # repeats section
    {
        my %inherit_subvalue;
        {
            # keys to progagate
            my @ikeys = ( 
                "size",
                "location"
                );
            @inherit_subvalue{ @ikeys } = (1) x @ikeys;
        }

        for my $k ( keys %panelpos ) {
            if ( !exists $$json{'panels'}[$panelpos{$k}]{$k}{"repeats"} ) {
                $$json{'panels'}[$panelpos{$k}]{$k}{"repeats"} = {};
            }
            for my $inh ( keys %inherit_subvalue ) {
                $$json{'panels'}[$panelpos{$k}]{$k}{"repeats"}{$inh} = get_inherited_subvalue( $json, \%panelpos, $k, "repeats", $inh );
            }
        }
    }
        

## step 3 assign CSS grid info (row column, spans etc in parent div)

    my %cursor_row;
    my %cursor_col;
    #    my %rc_used;

    # initialize cursors
    @cursor_row{ keys %panelpos } = (1) x keys %panelpos;
    @cursor_col{ keys %panelpos } = (1) x keys %panelpos;
        
    for ( my $i = 0; $i <  @{$$json{'panels'} }; ++$i ) {
#        my $k = ( keys $$json{'panels'}[$i] )[0];
        my $k = ( keys %{$$json{'panels'}[$i]} )[0];

        my $size     = $$json{'panels'}[$panelpos{$k}]{ $k }{ 'size' };

        if ( typeof( $size ) ne 'ARRAYref' ) {
            $error .= "module: $mname : panel $k 'size' not an array\n";
            return;
        }

        if ( @$size != 2 ) {
            $error .= "module: $mname : panel $k 'size' is an array but does not contain exactly 2 elements\n";
            return;
        }

        my $rows = $$size[0];
        my $cols = $$size[1];

        {
            my $type = typeof( $rows );
            # print "typeof of rows is $type\n";
            if ( $type eq 'SCALAR' ) {
                if ( looks_like_number( $rows ) ) {
                    $$json{'panels'}[$panelpos{$k}]{ $k }{ 'gtr' } = "repeat($rows,auto)";
                } else {
                    $$json{'panels'}[$panelpos{$k}]{ $k }{ 'gtr' } = $rows;
                }
            } elsif ( $type eq 'ARRAYref' ) {
                for my $a ( @$rows ) {
                    # print "arrayref value $a\n";
                    $$json{'panels'}[$panelpos{$k}]{ $k }{ 'gtr' } .= "${a}fr ";
                }
            } else {
                $error .= "module: $mname : unknown argument type for panel $k size element 1 rows\n";
            }
        }

        {
            my $type = typeof( $cols );
            # print "typeof of cols is $type\n";
            if ( $type eq 'SCALAR' ) {
                if ( looks_like_number( $cols ) ) {
                    $$json{'panels'}[$panelpos{$k}]{ $k }{ 'gtc' } = "repeat($cols,auto)";
                } else {
                    $$json{'panels'}[$panelpos{$k}]{ $k }{ 'gtc' } = $cols;
                }
            } elsif ( $type eq 'ARRAYref' ) {
                for my $a ( @$cols ) {
                    # print "arrayref value $a\n";
                    $$json{'panels'}[$panelpos{$k}]{ $k }{ 'gtc' } .= "${a}fr ";
                }
            } else {
                $error .= "module: $mname : unknown argument type for panel $k size element 1 rows\n";
            }
        }

        if ( 0 ) {
            my $js = JSON->new;
            print "panel $k: " . $js->pretty->encode( $$json{'panels'}[$panelpos{$k}]{ $k } ) . "\n";
        }

        if ( $k eq 'root' ) {
            if ( $$json{'panels'}[$panelpos{$k}]{ $k }{ 'location' } ) {
                $warn .= "module: $mname : root panel defines location, meaningless, ignored\n";
            }
        } else {
            # setup some local variables for convenience

            my $location = $$json{'panels'}[$panelpos{$k}]{ $k }{ 'location' };

            if ( $location ) {
                if ( typeof( $location ) ne 'ARRAYref' ) {
                    $error .= "module: $mname : panel $k 'location' not an array\n";
                    return;
                }

                if ( @$location != 2 ) {
                    $error .= "module: $mname : panel $k 'location' is an array but does not contain exactly 2 elements\n";
                    return;
                }
            }

            my $parent = $$json{'panels'}[$panelpos{$k}]{ $k }{ 'parent' };

            my $row;
            my $col;
            my $parentcols;
            my $parentrows;
            if ( $location ) {
                $row = $$location[0];
                $col = $$location[1];
            }
            if ( $$json{'panels'}[$panelpos{$parent}]{ $parent }{ 'size' } ) {
                $parentcols = $$json{'panels'}[$panelpos{$parent}]{ $parent }{ 'size' }[0];
                $parentrows = $$json{'panels'}[$panelpos{$parent}]{ $parent }{ 'size' }[1];
            }

            undef $parentcols if $parentcols eq 'auto';
            undef $parentrows if $parentrows eq 'auto';

            # print "panel $k row $row col $col parentcols $parentcols\n";

            # _s _e start end for spans
            my $row_s;
            my $row_e;
            my $col_s;
            my $col_e;

            my $rtype = typeof( $row );
            my $ctype = typeof( $col );

            # row and column types

            my $rowt;
            my $colt;

            $rowt      = 'next' if !$row || $row eq 'next';
            $colt      = 'next' if !$col || $col eq 'next';
            $rowt      = 'full' if $row eq 'full';
            $colt      = 'full' if $col eq 'full';
            $rowt      = '#'    if looks_like_number( $row );
            $colt      = '#'    if looks_like_number( $col );
            $rowt      = 'same' if $row eq 'same';
            
            if ( $rtype eq 'ARRAYref' ) {
                $rowt  = 'span';
                if ( scalar @$row != 2 ) {
                    $error .= "module: $mname : panel $k row definition is a range, but does not have exactly 2 elements\n";
                } else {
                    $row_s = $$row[ 0 ];
                    $row_e = $$row[ 1 ];
                    $error .= "module: $mname : panel $k row number less than 1\n" if $row_s < 1;
                    $error .= "module: $mname : panel $k row range end less than start\n" if $row_e < $row_s;
                    $error .= "module: $mname : panel $k row range contains non-numbers\n" if !looks_like_number( $row_s ) || !looks_like_number( $row_e );
                }
            }

            if ( $ctype eq 'ARRAYref' ) {
                $colt  = 'span';
                if ( scalar @$col != 2 ) {
                    $error .= "module: $mname : panel $k column definition is a range, but does not have exactly 2 elements\n";
                } else {
                    $col_s = $$col[ 0 ];
                    $col_e = $$col[ 1 ];
                    $error .= "module: $mname : panel $k column number less than 1\n" if $col_s < 1;
                    $error .= "module: $mname : panel $k column range end less than start\n" if $col_e < $col_s;
                    $error .= "module: $mname : panel $k column range contains non-numbers\n" if !looks_like_number( $col_s ) || !looks_like_number( $col_e );
                }
            }

            $error .= "module: $mname : panel $k unrecognized row type\n"    if !$rowt;
            $error .= "module: $mname : panel $k unrecognized column type\n" if !$colt;

            # print "panel $k: rowt $rowt $row_s $row_e colt $colt $col_s $col_e\n";

            
            ## test increment column

            # print "before increment panel $k cursor $cursor_row{$parent}, $cursor_col{$parent} parentcols $parentcols\n";
            # increment_cursor_column( \$cursor_row{ $parent }, \$cursor_col{ $parent }, $parentcols, $rowt eq 'same' );
            # print "after increment cursor column: panel $k cursor $cursor_row{$parent}, $cursor_col{$parent}\n";

            if ( $rowt eq '#' ) {
                $$json{'panels'}[$panelpos{$k}]{ $k }{ 'gr' } = $row;
                $cursor_row{ $parent } = $row;
                if ( $colt eq '#' ) {
                    $$json{'panels'}[$panelpos{$k}]{ $k }{ 'gc' } = $col;
                    $cursor_col{ $parent } = $col;
                    increment_cursor_column( \$cursor_row{ $parent }, \$cursor_col{ $parent }, $parentcols );
                } elsif ( $colt eq 'span' ) {
                    $$json{'panels'}[$panelpos{$k}]{ $k }{ 'gc' } = "$col_s/$col_e";
                    $cursor_col{ $parent } = $col_e;
                    increment_cursor_column( \$cursor_row{ $parent }, \$cursor_col{ $parent }, $parentcols );
                } elsif ( $colt eq 'next' ) {
                    $$json{'panels'}[$panelpos{$k}]{ $k }{ 'gc' } = $cursor_col{ $parent };
                    increment_cursor_column( \$cursor_row{ $parent }, \$cursor_col{ $parent }, $parentcols );
                } elsif ( $colt eq 'full' ) {
                    $$json{'panels'}[$panelpos{$k}]{ $k }{ 'gc' } = "1/-1";
                    $cursor_row{ $parent }++;
                    $cursor_col{ $parent } = 1;
                } else {
                    $error .= "module: $mname : panel $k: unexpected error in updating row/column case row '#'\n";
                }
            }  elsif ( $rowt eq 'span' ) {
                $$json{'panels'}[$panelpos{$k}]{ $k }{ 'gr' } = "$row_s/$row_e";
                $cursor_row{ $parent } = $row_e;
                if ( $colt eq '#' ) {
                    $$json{'panels'}[$panelpos{$k}]{ $k }{ 'gc' } = $col;
                    $cursor_col{ $parent } = $col;
                    increment_cursor_column( \$cursor_row{ $parent }, \$cursor_col{ $parent }, $parentcols );
                } elsif ( $colt eq 'span' ) {
                    $$json{'panels'}[$panelpos{$k}]{ $k }{ 'gc' } = "$col_s/$col_e";
                    $cursor_col{ $parent } = $col_e;
                    increment_cursor_column( \$cursor_row{ $parent }, \$cursor_col{ $parent }, $parentcols );
                } elsif ( $colt eq 'next' ) {
                    $$json{'panels'}[$panelpos{$k}]{ $k }{ 'gc' } = $cursor_col{ $parent };
                    increment_cursor_column( \$cursor_row{ $parent }, \$cursor_col{ $parent }, $parentcols );
                } elsif ( $colt eq 'full' ) {
                    $$json{'panels'}[$panelpos{$k}]{ $k }{ 'gc' } = "1/-1";
                    $cursor_row{ $parent }++;
                    $cursor_col{ $parent } = 1;
                } else {
                    $error .= "module: $mname : panel $k: unexpected error in updating row/column case row 'span'\n";
                }
            }  elsif ( $rowt eq 'next' ) {
                $$json{'panels'}[$panelpos{$k}]{ $k }{ 'gr' } = $cursor_row{ $parent };
                $cursor_row{ $parent }++;
                if ( $colt eq '#' ) {
                    $$json{'panels'}[$panelpos{$k}]{ $k }{ 'gc' } = $col;
                    $cursor_col{ $parent } = 1;
                } elsif ( $colt eq 'span' ) {
                    $$json{'panels'}[$panelpos{$k}]{ $k }{ 'gc' } = "$col_s/$col_e";
                    $cursor_col{ $parent } = 1;
                } elsif ( $colt eq 'next' ) {
                    $$json{'panels'}[$panelpos{$k}]{ $k }{ 'gc' } = $cursor_col{ $parent };
                    $cursor_col{ $parent } = 1;
                } elsif ( $colt eq 'full' ) {
                    $$json{'panels'}[$panelpos{$k}]{ $k }{ 'gc' } = "1/-1";
                    $cursor_col{ $parent } = 1;
                } else {
                    $error .= "module: $mname : panel $k: unexpected error in updating row/column case row 'next'\n";
                }
            }  elsif ( $rowt eq 'same' ) {
                $$json{'panels'}[$panelpos{$k}]{ $k }{ 'gr' } = $cursor_row{ $parent };
                if ( $colt eq '#' ) {
                    $$json{'panels'}[$panelpos{$k}]{ $k }{ 'gc' } = $col;
                    $cursor_col{ $parent } = $col;
                    increment_cursor_column( \$cursor_row{ $parent }, \$cursor_col{ $parent }, $parentcols, true );
                } elsif ( $colt eq 'span' ) {
                    $$json{'panels'}[$panelpos{$k}]{ $k }{ 'gc' } = "$col_s/$col_e";
                    $cursor_col{ $parent } = $col_e;
                    increment_cursor_column( \$cursor_row{ $parent }, \$cursor_col{ $parent }, $parentcols, true );
                } elsif ( $colt eq 'next' ) {
                    $$json{'panels'}[$panelpos{$k}]{ $k }{ 'gc' } = $cursor_col{ $parent };
                    increment_cursor_column( \$cursor_row{ $parent }, \$cursor_col{ $parent }, $parentcols, true );
                } elsif ( $colt eq 'full' ) {
                    $error .= "module: $mname : panel $k: row can not be 'same' and column 'full'\n";
                } else {
                    $error .= "module: $mname : panel $k: unexpected error in updating row/column case row 'next'\n";
                }
            }  elsif ( $rowt eq 'full' ) {
                $$json{'panels'}[$panelpos{$k}]{ $k }{ 'gr' } = "1/-1";
                if ( $colt eq '#' ) {
                    $$json{'panels'}[$panelpos{$k}]{ $k }{ 'gc' } = $col;
                    $cursor_col{ $parent } = $col;
                    increment_cursor_column( \$cursor_row{ $parent }, \$cursor_col{ $parent }, $parentcols, true );
                } elsif ( $colt eq 'span' ) {
                    $$json{'panels'}[$panelpos{$k}]{ $k }{ 'gc' } = "$col_s/$col_e";
                    $cursor_col{ $parent } = $col_e;
                    increment_cursor_column( \$cursor_row{ $parent }, \$cursor_col{ $parent }, $parentcols, true );
                } elsif ( $colt eq 'next' ) {
                    $$json{'panels'}[$panelpos{$k}]{ $k }{ 'gc' } = $cursor_col{ $parent };
                    increment_cursor_column( \$cursor_row{ $parent }, \$cursor_col{ $parent }, $parentcols, true );
                } elsif ( $colt eq 'full' ) {
                    $error .= "module: $mname : panel $k: row can not be 'full' and column 'full'\n";
                } else {
                    $error .= "module: $mname : panel $k: unexpected error in updating row/column case row 'next'\n";
                }
            } else {                
                $error .= "module: $mname : panel $k: unexpected error in updating row/column case unknown\n";
            }                
        }
    }

## step 4 check for clobbering (possibly included with previous step)

# phase 2 fields

    if ( $debuglayout ) {
        my $js = JSON->new;
        print "JSON prep after phase 1" . '-'x40 . "\n" . $js->pretty->encode( $json ) . "\n" . '-'x40 . "\n";
    }

## step 1 check for missing parent panels & assign parent panels

    if ( !$$json{'fields'} ) {
        $error .= "module: $mname : no fields defined\n";
        return;
    } 

    for ( my $i = 0; $i <  @{$$json{'fields'} }; ++$i ) {
        my $field  = $$json{'fields'}[$i];
        my $id     = $$field{'id'};
        my $layout = $$field{'layout'};
        # print "field id $id\n" if $debuglayout;

        if ( !$layout ) {
            $$field{'layout'} = decode_json( '{"parent":"root"}' );
        } elsif ( !$$layout{'parent'} ) {
            $$field{'layout'}{'parent'} = "root";
        } elsif ( !$panelpos{ $$layout{'parent'} } ) {
            $error .= "module: $mname : field $id layout:parent $$layout{'parent'} is missing from panels\n";
            return;
        } else {
            # print "field id $id has layout with parent\n";
        }
    }
        
## step 2 propagate parent keys
### do we need to do this?
### parent panels (div's in DOM) will hold "align", so only need if override
### possibly other properties?
    
    my %inherit;
    {
        # keys to progagate
        my @ikeys = ( 
            "label"
            ,"data"
            );
        @inherit{ @ikeys } = (1) x @ikeys;
    }

    for ( my $i = 0; $i <  @{$$json{'fields'} }; ++$i ) {
        my $field  = $$json{'fields'}[$i];
        my $layout = $$field{'layout'};
        
        for my $inh ( keys %inherit ) {
            # print "for key $inh, layout:$$layout{'parent'}:\n";
            if ( !$$layout{$inh} ) {
                $$layout{$inh} = get_inherited_value( $json, \%panelpos, $$layout{'parent'}, $inh );
            }
        }
    }

    # subvalue inherits
    # repeats section
    {
        my %inherit_subvalue;
        {
            # keys to progagate
            my @ikeys = ( 
                "size",
                "location"
                );
            @inherit_subvalue{ @ikeys } = (1) x @ikeys;
        }

        for ( my $i = 0; $i <  @{$$json{'fields'} }; ++$i ) {
            my $field  = $$json{'fields'}[$i];
            my $layout = $$field{'layout'};
            if ( exists $$field{"repeater"} ) {
                if ( !exists $$layout{"repeats"} ) {
                    $$layout{"repeats"} = {};
                }
                for my $inh ( keys %inherit_subvalue ) {
                    if ( !exists $$layout{"repeats"}{$inh} ) {
                        $$layout{"repeats"}{$inh} = get_inherited_subvalue( $json, \%panelpos, $$layout{'parent'}, "repeats", $inh );
                    }
                }
            }
        }
    }


## step 3 assign field CSS grid info (row column, spans etc in parent div)
    # re-initialize cursors for fields
    @cursor_row{ keys %panelpos } = (1) x keys %panelpos;
    @cursor_col{ keys %panelpos } = (1) x keys %panelpos;


    # label & data
### currently we have row, column, label & data
### how do we generalize?
### what about multi-element data fields? (e.g. lrfile) 
### what about field input error messages
### possibilities:
### simple:
###  define labeldata: above|below|left|right (could be in panel)
###  if left or right: 
###   column increment will be 2
###  if above or below: 
###   row increment will be 2

### plan:
###  we have now location, label & data info
###  location determines the cursor position (as in panels)
###  label & data are relative to the location
###  next cursor position is an increment from the max of greatest label & data

    for ( my $i = 0; $i <  @{$$json{'fields'} }; ++$i ) {
        # setup some local variables for convenience

        my $field    = $$json{'fields'}[$i];
        my $fieldid  = $$field{'id'};
        my $layout   = $$field{'layout'};
        my $parent   = $$layout{'parent'};
        my $location = $$layout{'location'};

        print "processing field $fieldid\n" if $debuglayout;
        if ( $debugfields ) {
            print '='x60 . "\n";
            print "$fieldid\n";
        }            

        if ( $location ) {
            if ( typeof( $location ) ne 'ARRAYref' ) {
                $error .= "module: $mname : field $fieldid layout:location not an array\n";
                return;
            }

            if ( @$location != 2 ) {
                $error .= "module: $mname : field $fieldid layout:location is an array but does not contain exactly 2 elements\n";
                return;
            }
        }

        my $row;
        my $col;
        my $parentcols;
        my $parentrows;
        if ( $location ) {
            $row = $$location[0];
            $col = $$location[1];
        }
        if ( $$json{'panels'}[$panelpos{$parent}]{ $parent }{ 'size' } ) {
            $parentcols = $$json{'panels'}[$panelpos{$parent}]{ $parent }{ 'size' }[0];
            $parentrows = $$json{'panels'}[$panelpos{$parent}]{ $parent }{ 'size' }[1];
        }

        undef $parentcols if $parentcols eq 'auto';
        undef $parentrows if $parentrows eq 'auto';

        # _s _e start end for spans
        my $row_s;
        my $row_e;
        my $col_s;
        my $col_e;

        my $rtype = typeof( $row );
        my $ctype = typeof( $col );

        # row and column types

        my $rowt;
        my $colt;

        $rowt      = 'next' if !$row || $row eq 'next';
        $colt      = 'next' if !$col || $col eq 'next';
        $rowt      = 'full' if $row eq 'full';
        $colt      = 'full' if $col eq 'full';
        $rowt      = '#'    if looks_like_number( $row );
        $colt      = '#'    if looks_like_number( $col );
        $rowt      = 'same' if $row eq 'same';
        
        if ( $rtype eq 'ARRAYref' ) {
            $rowt  = 'span';
            if ( scalar @$row != 2 ) {
                $error .= "module: $mname : field $fieldid row definition is a range, but does not have exactly 2 elements\n";
            } else {
                $row_s = $$row[ 0 ];
                $row_e = $$row[ 1 ];
                $error .= "module: $mname : field $fieldid row number less than 1\n" if $row_s < 1;
                $error .= "module: $mname : field $fieldid row range end less than start\n" if $row_e < $row_s;
                $error .= "module: $mname : field $fieldid row range contains non-numbers\n" if !looks_like_number( $row_s ) || !looks_like_number( $row_e );
            }
        }

        if ( $ctype eq 'ARRAYref' ) {
            $colt  = 'span';
            if ( scalar @$col != 2 ) {
                $error .= "module: $mname : field $fieldid column definition is a range, but does not have exactly 2 elements\n";
            } else {
                $col_s = $$col[ 0 ];
                $col_e = $$col[ 1 ];
                $error .= "module: $mname : field $fieldid column number less than 1\n" if $col_s < 1;
                $error .= "module: $mname : field $fieldid column range end less than start\n" if $col_e < $col_s;
                $error .= "module: $mname : field $fieldid column range contains non-numbers\n" if !looks_like_number( $col_s ) || !looks_like_number( $col_e );
            }
        }

        $error .= "module: $mname : field $fieldid unrecognized row type\n"    if !$rowt;
        $error .= "module: $mname : field $fieldid unrecognized column type\n" if !$colt;

        # print "field $fieldid: rowt $rowt $row_s $row_e colt $colt $col_s $col_e\n";
            
        # determine base position & extents
        my $loc_row = $cursor_row{ $parent };
        my $loc_col = $cursor_col{ $parent };

        if ( $rowt eq '#' ) {
            $loc_row = $row;
            $cursor_row{ $parent } = $row;
            if ( $colt eq '#' ) {
                $loc_col = $col;
                $cursor_col{ $parent } = $col;
                increment_cursor_column( \$cursor_row{ $parent }, \$cursor_col{ $parent }, $parentcols );
            } elsif ( $colt eq 'span' ) {
                $loc_col = $col_s;
                $cursor_col{ $parent } = $col_e;
                increment_cursor_column( \$cursor_row{ $parent }, \$cursor_col{ $parent }, $parentcols );
            } elsif ( $colt eq 'next' ) {
                $loc_col = $cursor_col{ $parent };
                increment_cursor_column( \$cursor_row{ $parent }, \$cursor_col{ $parent }, $parentcols );
            } elsif ( $colt eq 'full' ) {
                $loc_col = 1;
                $cursor_row{ $parent }++;
                $cursor_col{ $parent } = 1;
            } else {
                $error .= "module: $mname : field $fieldid: unexpected error in updating row/column case row '#'\n";
            }
        }  elsif ( $rowt eq 'span' ) {
            $loc_row = $row_s;
            $cursor_row{ $parent } = $row_e;
            if ( $colt eq '#' ) {
                $loc_col = $col;
                $cursor_col{ $parent } = $col;
                increment_cursor_column( \$cursor_row{ $parent }, \$cursor_col{ $parent }, $parentcols );
            } elsif ( $colt eq 'span' ) {
                $loc_col = $col_s;
                $cursor_col{ $parent } = $col_e;
                increment_cursor_column( \$cursor_row{ $parent }, \$cursor_col{ $parent }, $parentcols );
            } elsif ( $colt eq 'next' ) {
                $loc_col = $cursor_col{ $parent };
                increment_cursor_column( \$cursor_row{ $parent }, \$cursor_col{ $parent }, $parentcols );
            } elsif ( $colt eq 'full' ) {
                $loc_col = 1;
                $cursor_row{ $parent }++;
                $cursor_col{ $parent } = 1;
            } else {
                $error .= "module: $mname : field $fieldid: unexpected error in updating row/column case row 'span'\n";
            }
        }  elsif ( $rowt eq 'next' ) {
            $loc_row = $cursor_row{ $parent };
            $cursor_row{ $parent }++;
            if ( $colt eq '#' ) {
                $loc_col = $col;
                $cursor_col{ $parent } = 1;
            } elsif ( $colt eq 'span' ) {
                $loc_col = $col_s;
                $cursor_col{ $parent } = 1;
            } elsif ( $colt eq 'next' ) {
                $loc_col = $cursor_col{ $parent };
                $cursor_col{ $parent } = 1;
            } elsif ( $colt eq 'full' ) {
                $loc_col = 1;
                $cursor_col{ $parent } = 1;
            } else {
                $error .= "module: $mname : field $fieldid: unexpected error in updating row/column case row 'next'\n";
            }
        }  elsif ( $rowt eq 'same' ) {
            $loc_row = $cursor_row{ $parent };
            if ( $colt eq '#' ) {
                $loc_col = $col;
                $cursor_col{ $parent } = $col;
                increment_cursor_column( \$cursor_row{ $parent }, \$cursor_col{ $parent }, $parentcols, true );
            } elsif ( $colt eq 'span' ) {
                $loc_col = $col_s;
                $cursor_col{ $parent } = $col_e;
                increment_cursor_column( \$cursor_row{ $parent }, \$cursor_col{ $parent }, $parentcols, true );
            } elsif ( $colt eq 'next' ) {
                $loc_col = $cursor_col{ $parent };
                increment_cursor_column( \$cursor_row{ $parent }, \$cursor_col{ $parent }, $parentcols, true );
            } elsif ( $colt eq 'full' ) {
                $error .= "module: $mname : field $fieldid: row can not be 'same' and column 'full'\n";
            } else {
                $error .= "module: $mname : field $fieldid: unexpected error in updating row/column case row 'next'\n";
            }
        }  elsif ( $rowt eq 'full' ) {
            $loc_row = 1;
            if ( $colt eq '#' ) {
                $loc_col = $col;
                $cursor_col{ $parent } = $col;
                increment_cursor_column( \$cursor_row{ $parent }, \$cursor_col{ $parent }, $parentcols, true );
            } elsif ( $colt eq 'span' ) {
                $loc_col = $col_s;
                $cursor_col{ $parent } = $col_e;
                increment_cursor_column( \$cursor_row{ $parent }, \$cursor_col{ $parent }, $parentcols, true );
            } elsif ( $colt eq 'next' ) {
                $loc_col = $cursor_col{ $parent };
                increment_cursor_column( \$cursor_row{ $parent }, \$cursor_col{ $parent }, $parentcols, true );
            } elsif ( $colt eq 'full' ) {
                $error .= "module: $mname : field $fieldid: row can not be 'full' and column 'full'\n";
            } else {
                $error .= "module: $mname : field $fieldid: unexpected error in updating row/column case row 'next'\n";
            }
        } else {                
            $error .= "module: $mname : field $fieldid: unexpected error in updating row/column case unknown\n";
        }                
        
        # now we have our base location and cursor is updated to the next position
        # determine lgc, lgr, dgc, dgr, rgc, rgr from data, label info
        print "location tracking: before label: location row $loc_row col $loc_col\n" if $debugcursor;

        fields_in_panel( "start '$fieldid'", $parent, $json, $cursor_row{$parent}, $cursor_col{$parent}, $loc_row, $loc_col, "nd", "nd", $debugfields ) if $debugfields;

        my $max_row;
        my $max_col;

        if ( exists $$layout{'label'} && $$layout{'label'} != "none" ) {
            add_field( 'label', $field, $$layout{'label'}[0], $$layout{'label'}[1], \$loc_row, \$loc_col, \$max_row, \$max_col, \$cursor_row{ $parent }, \$cursor_col{ $parent }, $parentcols );
            fields_in_panel( "after label '$fieldid'", $parent, $json, $cursor_row{$parent}, $cursor_col{$parent}, $loc_row, $loc_col, "nd", "nd", $debugfields ) if $debugfields;
        }            
        if ( exists $$layout{'data'} && $$layout{'data'} != "none" ) {
            add_field( 'data', $field, $$layout{'data'}[0], $$layout{'data'}[1], \$loc_row, \$loc_col, \$max_row, \$max_col, \$cursor_row{ $parent }, \$cursor_col{ $parent }, $parentcols );
            fields_in_panel( "after data '$fieldid'", $parent, $json, $cursor_row{$parent}, $cursor_col{$parent}, $loc_row, $loc_col, "nd", "nd", $debugfields ) if $debugfields;
        }            
        if ( exists $$layout{'repeats'} ) {
            if ( !exists $$layout{'repeats'}{'location'} ) {
                die "repeater without layout:repeats:location";
            }
            add_field( 'repeats', $field, $$layout{'repeats'}{'location'}[0], $$layout{'repeats'}{'location'}[1], \$loc_row, \$loc_col, \$max_row, \$max_col, \$cursor_row{ $parent }, \$cursor_col{ $parent }, $parentcols );
            fields_in_panel( "after repeats '$fieldid'", $parent, $json, $cursor_row{$parent}, $cursor_col{$parent}, $loc_row, $loc_col, "nd", "nd", $debugfields ) if $debugfields;
        }            

        if ( 0 ) { # old way 

                       if ( $$layout{'label'} != "none" ) {

                           my $lrow = $$layout{'label'}[0];
                           my $lcol = $$layout{'label'}[1];

                           # _s _e start end for spans
                           my $lrow_s;
                           my $lrow_e;
                           my $lcol_s;
                           my $lcol_e;

                           my $lrtype = typeof( $lrow );
                           my $lctype = typeof( $lcol );

                           # row and column types

                           my $lrowt;
                           my $lcolt;

                           # disabled for now, we are just supporting #'s and spans
                           # $lrowt      = 'next' if !$lrow || $lrow eq 'next';
                           # $lcolt      = 'next' if !$lcol || $lcol eq 'next';
                           # $lrowt      = 'full' if $lrow eq 'full';
                           # $lcolt      = 'full' if $lcol eq 'full';
                           # $lrowt      = 'same' if $lrow eq 'same';

                           print "lrow is $lrow\n" if $debuglayout;
                           if ( looks_like_number( $lrow ) ) {
                               print "lrow looks like a number\n" if $debuglayout;
                               $lrowt = '#';
                               $lrow  += $loc_row - 1;
                           }
                           if ( looks_like_number( $lcol ) ) {
                               $lcolt = '#';
                               $lcol  += $loc_col - 1;
                           }
                           
                           if ( $lrtype eq 'ARRAYref' ) {
                               $lrowt  = 'span';
                               if ( scalar @$lrow != 2 ) {
                                   $error .= "module: $mname : field $fieldid label row definition is a range, but does not have exactly 2 elements\n";
                               } else {
                                   $lrow_s = $$lrow[ 0 ];
                                   $lrow_e = $$lrow[ 1 ];
                                   $error .= "module: $mname : field $fieldid label row number less than 1\n" if $lrow_s < 1;
                                   $error .= "module: $mname : field $fieldid label row range end less than start\n" if $lrow_e < $lrow_s;
                                   $error .= "module: $mname : field $fieldid label row range contains non-numbers\n" if !looks_like_number( $lrow_s ) || !looks_like_number( $lrow_e );
                                   $lrow_s += $loc_row - 1;
                                   $lrow_e += $loc_row - 1;
                               }
                           }

                           if ( $lctype eq 'ARRAYref' ) {
                               $lcolt  = 'span';
                               if ( scalar @$lcol != 2 ) {
                                   $error .= "module: $mname : field $fieldid label column definition is a range, but does not have exactly 2 elements\n";
                               } else {
                                   $lcol_s = $$lcol[ 0 ];
                                   $lcol_e = $$lcol[ 1 ];
                                   $error .= "module: $mname : field $fieldid label column number less than 1\n" if $lcol_s < 1;
                                   $error .= "module: $mname : field $fieldid label column range end less than start\n" if $lcol_e < $lcol_s;
                                   $error .= "module: $mname : field $fieldid label column range contains non-numbers\n" if !looks_like_number( $lcol_s ) || !looks_like_number( $lcol_e );
                               }
                           }

                           $error .= "module: $mname : field $fieldid unrecognized label row type\n"    if !$lrowt;
                           $error .= "module: $mname : field $fieldid unrecognized label column type\n" if !$lcolt;

                           print "processing field $fieldid : lrowt $lrowt lcolt $lcolt\n" if $debuglayout;

                           if ( $lrowt eq '#' ) {
                               $$field{ 'lgr' } = $lrow;
                               $max_row = $lrow;
                               if ( $lcolt eq '#' ) {
                                   $$field{ 'lgc' } = $lcol;
                                   $max_col = $lcol;
                                   # increment_cursor_column( \$cursor_row{ $parent }, \$cursor_col{ $parent }, $parentcols );
                               } elsif ( $lcolt eq 'span' ) {
                                   $$field{ 'lgc' } = "$lcol_s/$lcol_e";
                                   $max_col = $lcol_e;
                                   # increment_cursor_column( \$cursor_row{ $parent }, \$cursor_col{ $parent }, $parentcols );
                               } elsif ( $lcolt eq 'next' ) {
                                   $error .= "module: $mname : field $fieldid: unsupported case label column 'next'\n";
                                   $$field{ 'lgc' } = $cursor_col{ $parent };
                                   $max_col = $cursor_col{ $parent };
                                   # increment_cursor_column( \$cursor_row{ $parent }, \$cursor_col{ $parent }, $parentcols );
                               } elsif ( $lcolt eq 'full' ) {
                                   $error .= "module: $mname : field $fieldid: unsupported case label column 'full'\n";
                                   $$field{ 'lgc' } = "1/-1";
                                   $max_row++;
                                   $max_col = 1;
                               } else {
                                   $error .= "module: $mname : field $fieldid: unexpected error in updating label row/column case row '#'\n";
                               }
                           }  elsif ( $lrowt eq 'span' ) {
                               $$field{ 'lgr' } = "$lrow_s/$lrow_e";
                               $max_row = $lrow_e;
                               if ( $lcolt eq '#' ) {
                                   $$field{ 'lgc' } = $lcol;
                                   $max_col = $lcol;
                                   # increment_cursor_column( \$cursor_row{ $parent }, \$cursor_col{ $parent }, $parentcols );
                               } elsif ( $lcolt eq 'span' ) {
                                   $$field{ 'lgc' } = "$lcol_s/$lcol_e";
                                   $max_col = $lcol_e;
                                   # increment_cursor_column( \$cursor_row{ $parent }, \$cursor_col{ $parent }, $parentcols );
                               } elsif ( $lcolt eq 'next' ) {
                                   $error .= "module: $mname : field $fieldid: unsupported case label column 'next'\n";
                                   $$field{ 'lgc' } = $cursor_col{ $parent };
                                   # increment_cursor_column( \$cursor_row{ $parent }, \$cursor_col{ $parent }, $parentcols );
                               } elsif ( $lcolt eq 'full' ) {
                                   $error .= "module: $mname : field $fieldid: unsupported case label column 'full'\n";
                                   $$field{ 'lgc' } = "1/-1";
                                   $max_row++;
                                   $max_col = 1;
                               } else {
                                   $error .= "module: $mname : field $fieldid: unexpected error in updating label row/column case row 'span'\n";
                               }
                           }  elsif ( $lrowt eq 'next' ) {
                               $error .= "module: $mname : field $fieldid: unsupported case label row 'next'\n";
                               $$field{ 'lgr' } = $cursor_row{ $parent };
                               $max_row = $cursor_row{ $parent };
                               if ( $lcolt eq '#' ) {
                                   $$field{ 'lgc' } = $lcol;
                                   $max_col = 1;
                               } elsif ( $lcolt eq 'span' ) {
                                   $$field{ 'lgc' } = "$lcol_s/$lcol_e";
                                   $max_col = 1;
                               } elsif ( $lcolt eq 'next' ) {
                                   $error .= "module: $mname : field $fieldid: unsupported case label column 'next'\n";
                                   $$field{ 'lgc' } = $cursor_col{ $parent };
                                   $max_col = 1;
                               } elsif ( $lcolt eq 'full' ) {
                                   $error .= "module: $mname : field $fieldid: unsupported case label column 'full'\n";
                                   $$field{ 'lgc' } = "1/-1";
                                   $max_col = 1;
                               } else {
                                   $error .= "module: $mname : field $fieldid: unexpected error in updating label row/column case row 'next'\n";
                               }
                           }  elsif ( $lrowt eq 'same' ) {
                               $error .= "module: $mname : field $fieldid: unsupported case label row 'same'\n";
                               $$field{ 'lgr' } = $cursor_row{ $parent };
                               if ( $lcolt eq '#' ) {
                                   $$field{ 'lgc' } = $lcol;
                                   $max_col = $lcol;
                                   # increment_cursor_column( \$cursor_row{ $parent }, \$cursor_col{ $parent }, $parentcols, true );
                               } elsif ( $lcolt eq 'span' ) {
                                   $$field{ 'lgc' } = "$lcol_s/$lcol_e";
                                   $max_col = $lcol_e;
                                   # increment_cursor_column( \$cursor_row{ $parent }, \$cursor_col{ $parent }, $parentcols, true );
                               } elsif ( $lcolt eq 'next' ) {
                                   $error .= "module: $mname : field $fieldid: unsupported case label column 'next'\n";
                                   $$field{ 'lgc' } = $cursor_col{ $parent };
                                   # increment_cursor_column( \$cursor_row{ $parent }, \$cursor_col{ $parent }, $parentcols, true );
                               } elsif ( $lcolt eq 'full' ) {
                                   $error .= "module: $mname : field $fieldid: label row can not be 'same' and column 'full'\n";
                               } else {
                                   $error .= "module: $mname : field $fieldid: unexpected error in updating label row/column case row 'next'\n";
                               }
                           }  elsif ( $lrowt eq 'full' ) {
                               $error .= "module: $mname : field $fieldid: unsupported case label row 'full'\n";
                               $$field{ 'lgr' } = "1/-1";
                               if ( $lcolt eq '#' ) {
                                   $$field{ 'lgc' } = $lcol;
                                   $max_col = $lcol;
                                   # increment_cursor_column( \$cursor_row{ $parent }, \$cursor_col{ $parent }, $parentcols, true );
                               } elsif ( $lcolt eq 'span' ) {
                                   $$field{ 'lgc' } = "$lcol_s/$lcol_e";
                                   $max_col = $lcol_e;
                                   # increment_cursor_column( \$cursor_row{ $parent }, \$cursor_col{ $parent }, $parentcols, true );
                               } elsif ( $lcolt eq 'next' ) {
                                   $error .= "module: $mname : field $fieldid: unsupported case label column 'next'\n";
                                   $$field{ 'lgc' } = $cursor_col{ $parent };
                                   # increment_cursor_column( \$cursor_row{ $parent }, \$cursor_col{ $parent }, $parentcols, true );
                               } elsif ( $lcolt eq 'full' ) {
                                   $error .= "module: $mname : field $fieldid: label row can not be 'full' and column 'full'\n";
                               } else {
                                   $error .= "module: $mname : field $fieldid: unexpected error in updating label row/column case row 'next'\n";
                               }
                           } else {                
                               $error .= "module: $mname : field $fieldid: unexpected error in updating row/column case unknown\n";
                           }
                   } # end of label section

                   print "location tracking: after label, before data: location row $loc_row col $loc_col\n" if $debugcursor;
                   fields_in_panel( "after label '$fieldid'", $parent, $json, $cursor_row{$parent}, $cursor_col{$parent}, $loc_row, $loc_col, $max_row, $max_col, $debugfields ) if $debugfields;

                   # data section
                   if ( exists $$layout{'data'} ) {
                       my $drow = $$layout{'data'}[0];
                       my $dcol = $$layout{'data'}[1];

                       # _s _e start end for spans
                       my $drow_s;
                       my $drow_e;
                       my $dcol_s;
                       my $dcol_e;

                       my $drtype = typeof( $drow );
                       my $dctype = typeof( $dcol );

                       # row and column types

                       my $drowt;
                       my $dcolt;

                       # disabled for now, we are just supporting #'s and spans
                       # $drowt      = 'next' if !$drow || $drow eq 'next';
                       # $dcolt      = 'next' if !$dcol || $dcol eq 'next';
                       # $drowt      = 'full' if $drow eq 'full';
                       # $dcolt      = 'full' if $dcol eq 'full';
                       # $drowt      = 'same' if $drow eq 'same';
                       if ( looks_like_number( $drow ) ) {
                           $drowt = '#';
                           $drow  += $loc_row - 1;
                       }
                       if ( looks_like_number( $dcol ) ) {
                           $dcolt = '#';
                           $dcol  += $loc_col - 1;
                       }
                       
                       if ( $drtype eq 'ARRAYref' ) {
                           $drowt  = 'span';
                           if ( scalar @$drow != 2 ) {
                               $error .= "module: $mname : field $fieldid data row definition is a range, but does not have exactly 2 elements\n";
                           } else {
                               $drow_s = $$drow[ 0 ];
                               $drow_e = $$drow[ 1 ];
                               $error .= "module: $mname : field $fieldid data row number less than 1\n" if $drow_s < 1;
                               $error .= "module: $mname : field $fieldid data row range end less than start\n" if $drow_e < $drow_s;
                               $error .= "module: $mname : field $fieldid data row range contains non-numbers\n" if !looks_like_number( $drow_s ) || !looks_like_number( $drow_e );
                               $drow_s += $loc_row - 1;
                               $drow_e += $loc_row - 1;
                           }
                       }

                       if ( $dctype eq 'ARRAYref' ) {
                           $dcolt  = 'span';
                           if ( scalar @$dcol != 2 ) {
                               $error .= "module: $mname : field $fieldid data column definition is a range, but does not have exactly 2 elements\n";
                           } else {
                               $dcol_s = $$dcol[ 0 ];
                               $dcol_e = $$dcol[ 1 ];
                               $error .= "module: $mname : field $fieldid data column number less than 1\n" if $dcol_s < 1;
                               $error .= "module: $mname : field $fieldid data column range end less than start\n" if $dcol_e < $dcol_s;
                               $error .= "module: $mname : field $fieldid data column range contains non-numbers\n" if !looks_like_number( $dcol_s ) || !looks_like_number( $dcol_e );
                           }
                       }

                       $error .= "module: $mname : field $fieldid unrecognized data row type\n"    if !$drowt;
                       $error .= "module: $mname : field $fieldid unrecognized data column type\n" if !$dcolt;

                       print "processing field $fieldid : drowt $lrowt dcolt $lcolt\n" if $debuglayout;

                       if ( $drowt eq '#' ) {
                           $$field{ 'dgr' } = $drow;
                           $max_row = $drow;
                           if ( $dcolt eq '#' ) {
                               $$field{ 'dgc' } = $dcol;
                               $max_col = $dcol;
                               # increment_cursor_column( \$cursor_row{ $parent }, \$cursor_col{ $parent }, $parentcols );
                           } elsif ( $dcolt eq 'span' ) {
                               $$field{ 'dgc' } = "$dcol_s/$dcol_e";
                               $max_col = $dcol_e;
                               # increment_cursor_column( \$cursor_row{ $parent }, \$cursor_col{ $parent }, $parentcols );
                           } elsif ( $dcolt eq 'next' ) {
                               $error .= "module: $mname : field $fieldid: unsupported case data column 'next'\n";
                               $$field{ 'dgc' } = $cursor_col{ $parent };
                               $max_col = $cursor_col{ $parent };
                               # increment_cursor_column( \$cursor_row{ $parent }, \$cursor_col{ $parent }, $parentcols );
                           } elsif ( $dcolt eq 'full' ) {
                               $error .= "module: $mname : field $fieldid: unsupported case data column 'full'\n";
                               $$field{ 'dgc' } = "1/-1";
                               $max_row++;
                               $max_col = 1;
                           } else {
                               $error .= "module: $mname : field $fieldid: unexpected error in updating data row/column case row '#'\n";
                           }
                       }  elsif ( $drowt eq 'span' ) {
                           $$field{ 'dgr' } = "$drow_s/$drow_e";
                           $max_row = $drow_e;
                           if ( $dcolt eq '#' ) {
                               $$field{ 'dgc' } = $dcol;
                               $max_col = $dcol if $dcol;
                               # increment_cursor_column( \$cursor_row{ $parent }, \$cursor_col{ $parent }, $parentcols );
                           } elsif ( $dcolt eq 'span' ) {
                               $$field{ 'dgc' } = "$dcol_s/$dcol_e";
                               $max_col = $dcol_e if $dcol_e;
                               # increment_cursor_column( \$cursor_row{ $parent }, \$cursor_col{ $parent }, $parentcols );
                           } elsif ( $dcolt eq 'next' ) {
                               $error .= "module: $mname : field $fieldid: unsupported case data column 'next'\n";
                               $$field{ 'dgc' } = $cursor_col{ $parent };
                               # increment_cursor_column( \$cursor_row{ $parent }, \$cursor_col{ $parent }, $parentcols );
                           } elsif ( $dcolt eq 'full' ) {
                               $error .= "module: $mname : field $fieldid: unsupported case data column 'full'\n";
                               $$field{ 'dgc' } = "1/-1";
                               $max_row++;
                               $max_col = 1;
                           } else {
                               $error .= "module: $mname : field $fieldid: unexpected error in updating data row/column case row 'span'\n";
                           }
                       }  elsif ( $drowt eq 'next' ) {
                           $error .= "module: $mname : field $fieldid: unsupported case data row 'next'\n";
                           $$field{ 'dgr' } = $cursor_row{ $parent };
                           $max_row = $cursor_row{ $parent };
                           if ( $dcolt eq '#' ) {
                               $$field{ 'dgc' } = $dcol;
                               $max_col = 1;
                           } elsif ( $dcolt eq 'span' ) {
                               $$field{ 'dgc' } = "$dcol_s/$dcol_e";
                               $max_col = 1;
                           } elsif ( $dcolt eq 'next' ) {
                               $error .= "module: $mname : field $fieldid: unsupported case data column 'next'\n";
                               $$field{ 'dgc' } = $cursor_col{ $parent };
                               $max_col = 1;
                           } elsif ( $dcolt eq 'full' ) {
                               $error .= "module: $mname : field $fieldid: unsupported case data column 'full'\n";
                               $$field{ 'dgc' } = "1/-1";
                               $max_col = 1;
                           } else {
                               $error .= "module: $mname : field $fieldid: unexpected error in updating data row/column case row 'next'\n";
                           }
                       }  elsif ( $drowt eq 'same' ) {
                           $error .= "module: $mname : field $fieldid: unsupported case data row 'same'\n";
                           $$field{ 'dgr' } = $cursor_row{ $parent };
                           if ( $dcolt eq '#' ) {
                               $$field{ 'dgc' } = $dcol;
                               $max_col = $dcol;
                               # increment_cursor_column( \$cursor_row{ $parent }, \$cursor_col{ $parent }, $parentcols, true );
                           } elsif ( $dcolt eq 'span' ) {
                               $$field{ 'dgc' } = "$dcol_s/$dcol_e";
                               $max_col = $dcol_e;
                               # increment_cursor_column( \$cursor_row{ $parent }, \$cursor_col{ $parent }, $parentcols, true );
                           } elsif ( $dcolt eq 'next' ) {
                               $error .= "module: $mname : field $fieldid: unsupported case data column 'next'\n";
                               $$field{ 'dgc' } = $cursor_col{ $parent };
                               # increment_cursor_column( \$cursor_row{ $parent }, \$cursor_col{ $parent }, $parentcols, true );
                           } elsif ( $dcolt eq 'full' ) {
                               $error .= "module: $mname : field $fieldid: data row can not be 'same' and column 'full'\n";
                           } else {
                               $error .= "module: $mname : field $fieldid: unexpected error in updating data row/column case row 'next'\n";
                           }
                       }  elsif ( $drowt eq 'full' ) {
                           $error .= "module: $mname : field $fieldid: unsupported case data row 'full'\n";
                           $$field{ 'dgr' } = "1/-1";
                           if ( $dcolt eq '#' ) {
                               $$field{ 'dgc' } = $dcol;
                               $max_col = $dcol;
                               # increment_cursor_column( \$cursor_row{ $parent }, \$cursor_col{ $parent }, $parentcols, true );
                           } elsif ( $dcolt eq 'span' ) {
                               $$field{ 'dgc' } = "$dcol_s/$dcol_e";
                               $max_col = $dcol_e;
                               # increment_cursor_column( \$cursor_row{ $parent }, \$cursor_col{ $parent }, $parentcols, true );
                           } elsif ( $dcolt eq 'next' ) {
                               $error .= "module: $mname : field $fieldid: unsupported case data column 'next'\n";
                               $$field{ 'dgc' } = $cursor_col{ $parent };
                               # increment_cursor_column( \$cursor_row{ $parent }, \$cursor_col{ $parent }, $parentcols, true );
                           } elsif ( $dcolt eq 'full' ) {
                               $error .= "module: $mname : field $fieldid: data row can not be 'full' and column 'full'\n";
                           } else {
                               $error .= "module: $mname : field $fieldid: unexpected error in updating data row/column case row 'next'\n";
                           }
                       } else {                
                           $error .= "module: $mname : field $fieldid: unexpected error in updating row/column case unknown\n";
                       }
                   } # end data case

                   print "location tracking: after data, before repeats: location row $loc_row col $loc_col\n" if $debugcursor;
                   fields_in_panel( "after data '$fieldid'", $parent, $json, $cursor_row{$parent}, $cursor_col{$parent}, $loc_row, $loc_col, $max_row, $max_col, $debugfields ) if $debugfields;

                   # repeaters
                   if ( exists $$layout{'repeats'} ) {
                       $loc_row = $cursor_row{ $parent };
                       $loc_col = $cursor_col{ $parent };
                       print "found repeater field:id $fieldid\n" if $debuglayout;
                       if ( !exists $$layout{'repeats'}{'location'} ) {
                           die "repeater without layout:repeats:location";
                       }

                       my $rrow = $$layout{'repeats'}{'location'}[0];
                       my $rcol = $$layout{'repeats'}{'location'}[1];
                       print "found repeater field:id $fieldid rrow $rrow rcol $rcol\n" if $debuglayout;

                       # _s _e start end for spans
                       my $rrow_s;
                       my $rrow_e;
                       my $rcol_s;
                       my $rcol_e;

                       my $rrtype = typeof( $rrow );
                       my $rctype = typeof( $rcol );

                       # row and column types

                       my $rrowt;
                       my $rcolt;

                       # disabled for now, we are just supporting #'s and spans
                       $rrowt      = 'next' if !$rrow || $rrow eq 'next';
                       $rcolt      = 'next' if !$rcol || $rcol eq 'next';
                       $rrowt      = 'full' if $rrow eq 'full';
                       $rcolt      = 'full' if $rcol eq 'full';
                       # $rrowt      = 'same' if $rrow eq 'same';
                       if ( looks_like_number( $rrow ) ) {
                           $rrowt = '#';
                           $rrow  += $loc_row - 1;
                       }
                       if ( looks_like_number( $rcol ) ) {
                           $rcolt = '#';
                           $rcol  += $loc_col - 1;
                       }
                       
                       if ( $rrtype eq 'ARRAYref' ) {
                           $rrowt  = 'span';
                           if ( scalar @$rrow != 2 ) {
                               $error .= "module: $mname : field $fieldid repeats row definition is a range, but does not have exactly 2 elements\n";
                           } else {
                               $rrow_s = $$rrow[ 0 ];
                               $rrow_e = $$rrow[ 1 ];
                               $error .= "module: $mname : field $fieldid repeats row number less than 1\n" if $rrow_s < 1;
                               $error .= "module: $mname : field $fieldid repeats row range end less than start\n" if $rrow_e < $rrow_s;
                               $error .= "module: $mname : field $fieldid repeats row range contains non-numbers\n" if !looks_like_number( $rrow_s ) || !looks_like_number( $rrow_e );
                               $rrow_s += $loc_row - 1;
                               $rrow_e += $loc_row - 1;
                           }
                       }

                       if ( $rctype eq 'ARRAYref' ) {
                           $rcolt  = 'span';
                           if ( scalar @$rcol != 2 ) {
                               $error .= "module: $mname : field $fieldid repeats column definition is a range, but does not have exactly 2 elements\n";
                           } else {
                               $rcol_s = $$rcol[ 0 ];
                               $rcol_e = $$rcol[ 1 ];
                               $error .= "module: $mname : field $fieldid repeats column number less than 1\n" if $rcol_s < 1;
                               $error .= "module: $mname : field $fieldid repeats column range end less than start\n" if $rcol_e < $rcol_s;
                               $error .= "module: $mname : field $fieldid repeats column range contains non-numbers\n" if !looks_like_number( $rcol_s ) || !looks_like_number( $rcol_e );
                           }
                       }

                       $error .= "module: $mname : field $fieldid unrecognized repeats row type\n"    if !$rrowt;
                       $error .= "module: $mname : field $fieldid unrecognized repeats column type\n" if !$rcolt;

                       print "processing repeats field $fieldid : rrowt $rrowt rcolt $rcolt\n" if $debuglayout;
                       print "processing repeats field $fieldid : rrowt $rrowt\n" if $debuglayout;
                       print "processing repeats field $fieldid : rcolt $rcolt\n" if $debuglayout;

                       if ( $rrowt eq '#' ) {
                           $$field{ 'rgr' } = $rrow;
                           $max_row = $rrow;
                           if ( $rcolt eq '#' ) {
                               $$field{ 'rgc' } = $rcol;
                               $max_col = $rcol;
                               # increment_cursor_column( \$cursor_row{ $parent }, \$cursor_col{ $parent }, $parentcols );
                           } elsif ( $rcolt eq 'span' ) {
                               $$field{ 'rgc' } = "$rcol_s/$rcol_e";
                               $max_col = $rcol_e;
                               # increment_cursor_column( \$cursor_row{ $parent }, \$cursor_col{ $parent }, $parentcols );
                           } elsif ( $rcolt eq 'next' ) {
                               $error .= "module: $mname : field $fieldid: unsupported case repeats column 'next'\n";
                               $$field{ 'rgc' } = $cursor_col{ $parent };
                               $max_col = $cursor_col{ $parent };
                               # increment_cursor_column( \$cursor_row{ $parent }, \$cursor_col{ $parent }, $parentcols );
                           } elsif ( $rcolt eq 'full' ) {
                               $error .= "module: $mname : field $fieldid: unsupported case repeats column 'full'\n";
                               $$field{ 'rgc' } = "1/-1";
                               $max_row++;
                               $max_col = 1;
                           } else {
                               $error .= "module: $mname : field $fieldid: unexpected error in updating repeats row/column case row '#'\n";
                           }
                       }  elsif ( $rrowt eq 'span' ) {
                           $$field{ 'rgr' } = "$rrow_s/$rrow_e";
                           $max_row = $rrow_e;
                           if ( $rcolt eq '#' ) {
                               $$field{ 'rgc' } = $rcol;
                               $max_col = $rcol if $rcol;
                               # increment_cursor_column( \$cursor_row{ $parent }, \$cursor_col{ $parent }, $parentcols );
                           } elsif ( $rcolt eq 'span' ) {
                               $$field{ 'rgc' } = "$rcol_s/$rcol_e";
                               $max_col = $rcol_e if $rcol_e;
                               # increment_cursor_column( \$cursor_row{ $parent }, \$cursor_col{ $parent }, $parentcols );
                           } elsif ( $rcolt eq 'next' ) {
                               $error .= "module: $mname : field $fieldid: unsupported case repeats column 'next'\n";
                               $$field{ 'rgc' } = $cursor_col{ $parent };
                               # increment_cursor_column( \$cursor_row{ $parent }, \$cursor_col{ $parent }, $parentcols );
                           } elsif ( $rcolt eq 'full' ) {
                               $error .= "module: $mname : field $fieldid: unsupported case repeats column 'full'\n";
                               $$field{ 'rgc' } = "1/-1";
                               $max_row++;
                               $max_col = 1;
                           } else {
                               $error .= "module: $mname : field $fieldid: unexpected error in updating repeats row/column case row 'span'\n";
                           }
                       }  elsif ( $rrowt eq 'next' ) {
                           # $error .= "module: $mname : field $fieldid: unsupported case repeats row 'next'\n";
                           # $loc_row++;
                           # $loc_col = 1;
                           $$field{ 'rgr' } = $loc_row + 0;
                           $max_row = $loc_row if $max_row < $loc_row;
                           if ( $rcolt eq '#' ) {
                               $$field{ 'rgc' } = $rcol;
                               $max_col = 1;
                           } elsif ( $rcolt eq 'span' ) {
                               $$field{ 'rgc' } = "$rcol_s/$rcol_e";
                               $max_col = 1;
                           } elsif ( $rcolt eq 'next' ) {
                               $error .= "module: $mname : field $fieldid: unsupported case repeats column 'next'\n";
                               $$field{ 'rgc' } = $cursor_col{ $parent };
                               $max_col = 1;
                           } elsif ( $rcolt eq 'full' ) {
                               # $error .= "module: $mname : field $fieldid: unsupported case repeats column 'full'\n";
                               $$field{ 'rgc' } = "1/-1";
                               $max_row++;
                               $max_col = 0;
                           } else {
                               $error .= "module: $mname : field $fieldid: unexpected error in updating repeats row/column case row 'next'\n";
                           }
                       }  elsif ( $rrowt eq 'same' ) {
                           $error .= "module: $mname : field $fieldid: unsupported case repeats row 'same'\n";
                           $$field{ 'rgr' } = $cursor_row{ $parent };
                           if ( $rcolt eq '#' ) {
                               $$field{ 'rgc' } = $rcol;
                               $max_col = $rcol;
                               # increment_cursor_column( \$cursor_row{ $parent }, \$cursor_col{ $parent }, $parentcols, true );
                           } elsif ( $rcolt eq 'span' ) {
                               $$field{ 'rgc' } = "$rcol_s/$rcol_e";
                               $max_col = $rcol_e;
                               # increment_cursor_column( \$cursor_row{ $parent }, \$cursor_col{ $parent }, $parentcols, true );
                           } elsif ( $rcolt eq 'next' ) {
                               $error .= "module: $mname : field $fieldid: unsupported case repeats column 'next'\n";
                               $$field{ 'rgc' } = $cursor_col{ $parent };
                               # increment_cursor_column( \$cursor_row{ $parent }, \$cursor_col{ $parent }, $parentcols, true );
                           } elsif ( $rcolt eq 'full' ) {
                               $error .= "module: $mname : field $fieldid: repeats row can not be 'same' and column 'full'\n";
                           } else {
                               $error .= "module: $mname : field $fieldid: unexpected error in updating repeats row/column case row 'next'\n";
                           }
                       }  elsif ( $rrowt eq 'full' ) {
                           $error .= "module: $mname : field $fieldid: unsupported case repeats row 'full'\n";
                           $$field{ 'rgr' } = "1/-1";
                           if ( $rcolt eq '#' ) {
                               $$field{ 'rgc' } = $rcol;
                               $max_col = $rcol;
                               # increment_cursor_column( \$cursor_row{ $parent }, \$cursor_col{ $parent }, $parentcols, true );
                           } elsif ( $rcolt eq 'span' ) {
                               $$field{ 'rgc' } = "$rcol_s/$rcol_e";
                               $max_col = $rcol_e;
                               # increment_cursor_column( \$cursor_row{ $parent }, \$cursor_col{ $parent }, $parentcols, true );
                           } elsif ( $rcolt eq 'next' ) {
                               $error .= "module: $mname : field $fieldid: unsupported case repeats column 'next'\n";
                               $$field{ 'rgc' } = $cursor_col{ $parent };
                               # increment_cursor_column( \$cursor_row{ $parent }, \$cursor_col{ $parent }, $parentcols, true );
                           } elsif ( $rcolt eq 'full' ) {
                               $error .= "module: $mname : field $fieldid: repeats row can not be 'full' and column 'full'\n";
                           } else {
                               $error .= "module: $mname : field $fieldid: unexpected error in updating repeats row/column case row 'next'\n";
                           }
                       } else {                
                           $error .= "module: $mname : field $fieldid: unexpected error in updating row/column case unknown\n";
                       }
                       print "end of cursor processing repeats field:id $fieldid rgr $$field{'rgr'} rgc $$field{'rgc'}\n" if $debugcursor;
                   }

                   print "location tracking: after repeats: location row $loc_row col $loc_col\n" if $debugcursor;
                   fields_in_panel( "after repeats '$fieldid'", $parent, $json, $cursor_row{$parent}, $cursor_col{$parent}, $loc_row, $loc_col, $max_row, $max_col, $debugfields ) if $debugfields;
        }

        # adjust parent cursor in case of overflow

        # print STDERR "field $fieldid: data max_row,col $max_row,$max_col cursor_row,col $cursor_row{$parent},$cursor_col{$parent}\n";
        print "cursor pos info field $fieldid: data max_row,col $max_row,$max_col cursor_row,col $cursor_row{$parent},$cursor_col{$parent}\n" if $debugcursor;

        if ( $cursor_row{ $parent } <= $max_row ) { # row overflows, reset row & col
            $cursor_row{ $parent } = $max_row;
            $cursor_col{ $parent } = $max_col;
            $has_overflow++;
#        } elsif ( $cursor_row{ $parent } == $max_row &&
#                  $cursor_col{ $parent } < $max_col ) { # row is the same but col overflows
#            $cursor_col{ $parent } = $max_col;
#            $has_overflow++;
        } # if row is less than max row and column overflows, ignore

        # increment cursor if overflow
        if ( $has_overflow ) {
            # print STDERR "field $fieldid: has overflow\n";
            increment_cursor_column( \$cursor_row{ $parent }, \$cursor_col{ $parent }, $parentcols, $rowt eq 'same' );
        }

## step 3 check for clobbering (possibly included with previous step)

    } # fields

    if ( length( $error ) ) {
        die $error;
    }
}

sub add_field {
    # usage add_field( type, field, row, col, loc_row, loc_col, max_row, max_col, cursor_row, cursor_col, parentcols )
    my $type       = shift;
    my $field      = shift;
    my $row        = shift;
    my $col        = shift;
    my $loc_row    = shift;
    my $loc_col    = shift;
    my $max_row    = shift;
    my $max_col    = shift;
    my $cursor_r   = shift;
    my $cursor_c   = shift;
    my $parentcols = shift;

    print "add field type $type fieldid $$field{'id'}\n";

    die "$0: add_field() unknown type '$type'\n" if $type != /^(label|data|repeats)$/;

    my $tag = substr($type, 0, 1 );

    my $gr  = "${tag}gr";
    my $gc  = "${tag}gc";

    # _s _e start end for spans
    my $row_s;
    my $row_e;
    my $col_s;
    my $col_e;

    my $rtype = typeof( $row );
    my $ctype = typeof( $col );

    # row and column types

    my $rowt;
    my $colt;

    $rowt      = 'next' if !$row || $row eq 'next';
    $colt      = 'next' if !$col || $col eq 'next';
    $rowt      = 'full' if $row eq 'full';
    $colt      = 'full' if $col eq 'full';
    $rowt      = 'same' if $row eq 'same';

    print "row is $row\n" if $debuglayout;
    if ( looks_like_number( $row ) ) {
        print "row looks like a number\n" if $debuglayout;
        $rowt = '#';
        $row  += $$loc_row - 1;
    }
    if ( looks_like_number( $col ) ) {
        $colt = '#';
        $col  += $$loc_col - 1;
    }
    
    if ( $rtype eq 'ARRAYref' ) {
        $rowt  = 'span';
        if ( scalar @$row != 2 ) {
            $error .= "module: $mname : field $fieldid $type row definition is a range, but does not have exactly 2 elements\n";
        } else {
            $row_s = $$row[ 0 ];
            $row_e = $$row[ 1 ];
            $error .= "module: $mname : field $fieldid $type row number less than 1\n" if $row_s < 1;
            $error .= "module: $mname : field $fieldid $type row range end less than start\n" if $row_e < $row_s;
            $error .= "module: $mname : field $fieldid $type row range contains non-numbers\n" if !looks_like_number( $row_s ) || !looks_like_number( $row_e );
            $row_s += $$loc_row - 1;
            $row_e += $$loc_row - 1;
        }
    }

    if ( $ctype eq 'ARRAYref' ) {
        $colt  = 'span';
        if ( scalar @$col != 2 ) {
            $error .= "module: $mname : field $fieldid $type column definition is a range, but does not have exactly 2 elements\n";
        } else {
            $col_s = $$col[ 0 ];
            $col_e = $$col[ 1 ];
            $error .= "module: $mname : field $fieldid $type column number less than 1\n" if $col_s < 1;
            $error .= "module: $mname : field $fieldid $type column range end less than start\n" if $col_e < $col_s;
            $error .= "module: $mname : field $fieldid $type column range contains non-numbers\n" if !looks_like_number( $col_s ) || !looks_like_number( $col_e );
        }
    }

    $error .= "module: $mname : field $fieldid unrecognized $type row type\n"    if !$rowt;
    $error .= "module: $mname : field $fieldid unrecognized $type column type\n" if !$colt;

    print "processing field $fieldid : rowt $rowt colt $colt\n" if $debuglayout;

    if ( $rowt eq '#' ) {
        $$field{ $gr } = $row;
        $$max_row = $row;
        if ( $colt eq '#' ) {
            $$field{ $gc } = $col;
            $$max_col = $col;
            # increment_cursor_column( $cursor_r, $cursor_c, $parentcols );
        } elsif ( $colt eq 'span' ) {
            $$field{ $gc } = "$col_s/$col_e";
            $$max_col = $col_e;
            # increment_cursor_column( $cursor_r, $cursor_c, $parentcols );
        } elsif ( $colt eq 'next' ) {
            $error .= "module: $mname : field $fieldid: unsupported case $type column 'next'\n";
            $$field{ $gc } = $$cursor_c;
            $$max_col = $$cursor_c;
            # increment_cursor_column( $cursor_r, $cursor_c, $parentcols );
        } elsif ( $colt eq 'full' ) {
            $error .= "module: $mname : field $fieldid: unsupported case $type column 'full'\n";
            $$field{ $gc } = "1/-1";
            $$max_row++;
            $$max_col = 1;
        } else {
            $error .= "module: $mname : field $fieldid: unexpected error in updating $type row/column case row '#'\n";
        }
    }  elsif ( $rowt eq 'span' ) {
        $$field{ $gr } = "$row_s/$row_e";
        $$max_row = $row_e;
        if ( $colt eq '#' ) {
            $$field{ $gc } = $col;
            $$max_col = $col;
            # increment_cursor_column( $cursor_r, $cursor_c, $parentcols );
        } elsif ( $colt eq 'span' ) {
            $$field{ $gc } = "$col_s/$col_e";
            $$max_col = $col_e;
            # increment_cursor_column( $cursor_r, $cursor_c, $parentcols );
        } elsif ( $colt eq 'next' ) {
            $error .= "module: $mname : field $fieldid: unsupported case $type column 'next'\n";
            $$field{ $gc } = $$cursor_c;
            # increment_cursor_column( $cursor_r, $cursor_c, $parentcols );
        } elsif ( $colt eq 'full' ) {
            $error .= "module: $mname : field $fieldid: unsupported case $type column 'full'\n";
            $$field{ $gc } = "1/-1";
            $$max_row++;
            $$max_col = 1;
        } else {
            $error .= "module: $mname : field $fieldid: unexpected error in updating $type row/column case row 'span'\n";
        }
    }  elsif ( $rowt eq 'next' ) {
        $error .= "module: $mname : field $fieldid: unsupported case $type row 'next'\n";
        $$field{ $gr } = $$cursor_r;
        $$max_row = $$cursor_r;
        if ( $colt eq '#' ) {
            $$field{ $gc } = $col;
            $$max_col = 1;
        } elsif ( $colt eq 'span' ) {
            $$field{ $gc } = "$col_s/$col_e";
            $$max_col = 1;
        } elsif ( $colt eq 'next' ) {
            $error .= "module: $mname : field $fieldid: unsupported case $type column 'next'\n";
            $$field{ $gc } = $$cursor_c;
            $$max_col = 1;
        } elsif ( $colt eq 'full' ) {
            # $error .= "module: $mname : field $fieldid: unsupported case $type column 'full'\n";
            $$field{ $gc } = "1/-1";
            $$max_row++;
            $$max_col = 1;
        } else {
            $error .= "module: $mname : field $fieldid: unexpected error in updating $type row/column case row 'next'\n";
        }
    }  elsif ( $rowt eq 'same' ) {
        $error .= "module: $mname : field $fieldid: unsupported case $type row 'same'\n";
        $$field{ $gr } = $$cursor_r;
        if ( $colt eq '#' ) {
            $$field{ $gc } = $col;
            $$max_col = $col;
            # increment_cursor_column( $cursor_r, $cursor_c, $parentcols, true );
        } elsif ( $colt eq 'span' ) {
            $$field{ $gc } = "$col_s/$col_e";
            $$max_col = $col_e;
            # increment_cursor_column( $cursor_r, $cursor_c, $parentcols, true );
        } elsif ( $colt eq 'next' ) {
            $error .= "module: $mname : field $fieldid: unsupported case $type column 'next'\n";
            $$field{ $gc } = $$cursor_c;
            # increment_cursor_column( $cursor_r, $cursor_c, $parentcols, true );
        } elsif ( $colt eq 'full' ) {
            $error .= "module: $mname : field $fieldid: $type row can not be 'same' and column 'full'\n";
        } else {
            $error .= "module: $mname : field $fieldid: unexpected error in updating $type row/column case row 'next'\n";
        }
    }  elsif ( $rowt eq 'full' ) {
        $error .= "module: $mname : field $fieldid: unsupported case $type row 'full'\n";
        $$field{ $gr } = "1/-1";
        if ( $colt eq '#' ) {
            $$field{ $gc } = $col;
            $$max_col = $col;
            # increment_cursor_column( $cursor_r, $cursor_c, $parentcols, true );
        } elsif ( $colt eq 'span' ) {
            $$field{ $gc } = "$col_s/$col_e";
            $$max_col = $col_e;
            # increment_cursor_column( $cursor_r, $cursor_c, $parentcols, true );
        } elsif ( $colt eq 'next' ) {
            $error .= "module: $mname : field $fieldid: unsupported case $type column 'next'\n";
            $$field{ $gc } = $$cursor_c;
            # increment_cursor_column( $cursor_r, $cursor_c, $parentcols, true );
        } elsif ( $colt eq 'full' ) {
            $error .= "module: $mname : field $fieldid: $type row can not be 'full' and column 'full'\n";
        } else {
            $error .= "module: $mname : field $fieldid: unexpected error in updating $type row/column case row 'next'\n";
        }
    } else {                
        $error .= "module: $mname : field $fieldid: unexpected error in updating row/column case unknown\n";
    }
}
    

return 1;

