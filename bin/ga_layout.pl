#!/usr/bin/perl

$notes = 
"usage: $0 file
file is layout json
this test program \"fully populates\" layout fields in prep for layout testing

";

$gap = $ENV{ "GENAPP" } || die "$0: error env variable GENAPP must be defined\n";

require "$gap/etc/perl/genapp_util.pl";
use Scalar::Util qw(looks_like_number);

$f = shift || die $notes;

my $json = get_file_json( $f );
$$json{ 'panels' } = decode_json( $extra_subs{ '__panels__' } );
 
my $error;
my $warn;
my $notice;

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

    print "increment cursor column parentcols $parentcols samerow $samerow\n";

    $$cursor_c++;
    if ( $parentcols && $$cursor_c > $parentcols ) {
        $$cursor_r++ if !$samerow;
        $$cursor_c = 1;
    }
}

sub layout_expand {
    my $json = shift;

# phase 1 panels

## step 1 check for missing parent panels & assign parent panels

    my %panelpos;

### pass 1 : collect parent names
    my %panelpos;

    {
        my %used_panel_name;
        for ( my $i = 0; $i <  @{$$json{'panels'} }; ++$i ) {
            my $panel_name = ( keys $$json{'panels'}[$i] )[0];
            $error .= "panel name $panel_name duplicated\n" if $used_panel_name{ $panel_name }++;
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
            $error .= "$f panel $k parent '$$json{'panels'}[$panelpos{$k}]{$k}{'parent'}' not defined\n" if !exists $panelpos{$$json{'panels'}[$panelpos{$k}]{$k}{'parent'}};
        } else {
            $$json{'panels'}[$panelpos{$k}]{$k}{'parent'} = 'root' if $k ne 'root';
        }
    }

## step 2 propagate parent keys

    my %inherit;
    {
        # keys to progagate
        my @ikeys = ( 
            "gap",
            "align"
            );
        @inherit{ @ikeys } = (1) x @ikeys;
    }

    for my $k ( keys %panelpos ) {
        for my $inh ( keys %inherit ) {
            $$json{'panels'}[$panelpos{$k}]{$k}{$inh} = get_inherited_value( $json, \%panelpos, $k, $inh );
        }
    }


## step 3 assign CSS grid info (row column, spans etc in parent div)

    my %cursor_row;
    my %cursor_col;
    #    my %rc_used;

    # initialize cursors
    @cursor_row{ keys %panelpos } = (1) x keys %panelpos;
    @cursor_col{ keys %panelpos } = (1) x keys %panelpos;
        
    for my $k ( keys %panelpos ) {

        if ( $$json{'panels'}[$panelpos{$k}]{ $k }{ 'rows' } ) {
            my $type = typeof( $$json{'panels'}[$panelpos{$k}]{ $k }{ 'rows' } );
            # print "typeof of rows is $type\n";
            if ( $type eq 'SCALAR' ) {
                if ( looks_like_number( $$json{'panels'}[$panelpos{$k}]{ $k }{ 'rows' } ) ) {
                    $$json{'panels'}[$panelpos{$k}]{ $k }{ 'gtr' } = "repeat($$json{'panels'}[$panelpos{$k}]{$k}{'rows'},auto)";
                } else {
                    $$json{'panels'}[$panelpos{$k}]{ $k }{ 'gtr' } = $$json{'panels'}[$panelpos{$k}]{ $k }{ 'rows' };
                }
            } elsif ( $type eq 'ARRAYref' ) {
                for my $a ( @{$$json{'panels'}[$panelpos{$k}]{ $k }{ 'rows' } } ) {
                    print "arrayref value $a\n";
                    $$json{'panels'}[$panelpos{$k}]{ $k }{ 'gtr' } .= "${a}fr ";
                }
            } else {
                $error .= "unknown argument type for panel $k rows\n";
            }
        }

        if ( $$json{'panels'}[$panelpos{$k}]{ $k }{ 'columns' } ) {
            my $type = typeof( $$json{'panels'}[$panelpos{$k}]{ $k }{ 'columns' } );
            # print "typeof of columns is $type\n";
            if ( $type eq 'SCALAR' ) {
                if ( looks_like_number( $$json{'panels'}[$panelpos{$k}]{ $k }{ 'columns' } ) ) {
                    $$json{'panels'}[$panelpos{$k}]{ $k }{ 'gtc' } = "repeat($$json{'panels'}[$panelpos{$k}]{$k}{'columns'},auto)";
                } else {
                    $$json{'panels'}[$panelpos{$k}]{ $k }{ 'gtc' } = $$json{'panels'}[$panelpos{$k}]{ $k }{ 'columns' };
                }
            } elsif ( $type eq 'ARRAYref' ) {
                for my $a ( @{$$json{'panels'}[$panelpos{$k}]{ $k }{ 'columns' } } ) {
                    print "arrayref value $a\n";
                    $$json{'panels'}[$panelpos{$k}]{ $k }{ 'gtc' } .= "${a}fr ";
                }
            } else {
                $error .= "unknown argument type for panel $k columns\n";
            }
        }

        if ( $k eq 'root' ) {
            if ( $$json{'panels'}[$panelpos{$k}]{ $k }{ 'row' } ) {
                $warn .= "root panel defines row, meaningless, ignored\n";
            }
            if ( $$json{'panels'}[$panelpos{$k}]{ $k }{ 'column' } ) {
                $warn .= "root panel defines column, meaningless, ignored\n";
            }
        } else {
            # setup some local variables for convenience

            my $parent = $$json{'panels'}[$panelpos{$k}]{ $k }{ 'parent' };
            my $row = $$json{'panels'}[$panelpos{$k}]{ $k }{ 'row' };
            my $col = $$json{'panels'}[$panelpos{$k}]{ $k }{ 'column' };
            my $parentcols = $$json{'panels'}[$panelpos{$parent}]{ $parent }{ 'columns' };
            my $parentrows = $$json{'panels'}[$panelpos{$parent}]{ $parent }{ 'rows' };

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
                    $error .= "panel $k row definition is a range, but does not have exactly 2 elements\n";
                } else {
                    $row_s = $$row[ 0 ];
                    $row_e = $$row[ 1 ];
                    $error .= "panel $k row number less than 1\n" if $row_s < 1;
                    $error .= "panel $k row range end less than start\n" if $row_e < $row_s;
                    $error .= "panel $k row range contains non-numbers\n" if !looks_like_number( $row_s ) || !looks_like_number( $row_e );
                }
            }

            if ( $ctype eq 'ARRAYref' ) {
                $colt  = 'span';
                if ( scalar @$col != 2 ) {
                    $error .= "panel $k column definition is a range, but does not have exactly 2 elements\n";
                } else {
                    $col_s = $$col[ 0 ];
                    $col_e = $$col[ 1 ];
                    $error .= "panel $k column number less than 1\n" if $col_s < 1;
                    $error .= "panel $k column range end less than start\n" if $col_e < $col_s;
                    $error .= "panel $k column range contains non-numbers\n" if !looks_like_number( $col_s ) || !looks_like_number( $col_e );
                }
            }

            $error .= "panel $k unrecognized row type\n"    if !$rowt;
            $error .= "panel $k unrecognized column type\n" if !$colt;

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
                    $error .= "panel $k: unexpected error in updating row/column case row '#'\n";
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
                    $error .= "panel $k: unexpected error in updating row/column case row 'span'\n";
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
                    $error .= "panel $k: unexpected error in updating row/column case row 'next'\n";
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
                    $error .= "panel $k: row can not be 'same' and column 'full'\n";
                } else {
                    $error .= "panel $k: unexpected error in updating row/column case row 'next'\n";
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
                    $error .= "panel $k: row can not be 'full' and column 'full'\n";
                } else {
                    $error .= "panel $k: unexpected error in updating row/column case row 'next'\n";
                }
            } else {                
                $error .= "panel $k: unexpected error in updating row/column case unknown\n";
            }                
        }
    }

## step 4 check for clobbering (possibly included with previous step)

# phase 2 fields

## step 1 check for missing parent panels & assign parent panels

## step 2 propagate parent keys

## step 3 assign CSS grid info (row column, spans etc in parent div)

# label & data : r_start, r_end, c_start, c_end


## step 4 check for clobbering (possibly included with previous step)

}

layout_expand( $json );

my $js = JSON->new;

print $js->pretty->encode( $json ) . "\n";

print '-'x60 . "\nNotices:\n$notice" . '-'x60 . "\n"  if $notice;
print '-'x60 . "\nWarnings:\n$warn" . '-'x60 . "\n"   if $warn;
print '-'x60 . "\nErrors:\n$error" . '-'x60 . "\n"    if $error;
