#** @file genapp_util.pl
#   @brief This file includes all utilities for parsing the json file structure
#    
#*

# user definition

my $max_repeater_depth = 25;

# subroutines for general usage

use JSON;
#use JSON::PP;

# use Switch;
# use Data::Dumper;
use Hash::Merge qw( merge );
Hash::Merge::set_behavior( 'RIGHT_PRECEDENT' );

my $gap_version = '0.01';

%__json_scratch = {};

sub load_reserved_words {
    my $fh;
    my $f = "$gap/etc/reserved_words";
    return "$f not found, will not be applied" if !-e $f;
    open $fh, "$f";
    while ( my $l = <$fh> )
    {
        next if $l =~ /^\s*#/;
        chomp $l;
        $reserved_words{ $l }++ if length( $l );;
    }
    "";
}

sub show_state {
    my $ref   = $_[ 0 ];
    my $tag   = $_[ 1 ];
    my $depth = $_[ 2 ];
#    print "$tag: d $depth state of __json_scratch\{ $ref \}:\n";
    print "d $depth: $tag: size of array: " . scalar @{$__json_scratch{ $ref }} . "\n";
}

# $debug_rplc++;

sub json_expand_util {
    my $json  = $_[ 0 ];
    my $ref   = $_[ 1 ];
    my $tag   = $_[ 2 ];
    my $depth = $_[ 3 ];

    print '-'x80 . "\n" if $debug_rplc;
    print "d $depth json_expand util " . ref( $json ) . "\n" if $debug_rplc;
    print '-'x80 . "\n" if $debug_rplc;
    $$ref{ "skipinc" } = 0;

    if ( ref( $json ) eq 'HASH' )
    {
        # make 2 pass, one pass for non-refs, 2nd for arrays
        my @added;
        while ( my ($k, $v ) = each %$json )
        {
            if ( !ref( $v ) )
            {
                my $ntag = ( $tag ? "$tag:" : "" ) . $k;
                print '-'x60 . "\n" if $debug_rplc;
                show_state( $ref, "pre adding hash element '$ntag' '$v'", $depth ) if $debug_rplc;
                if ( $__json_scratch{ $ref }[ $$ref{ "pos" } ]{ $ntag } )
                {
                    $$ref{ "pos" }++;
                    %{$__json_scratch{ $ref }[ $$ref{ "pos" } ]} =
                        %{$__json_scratch{ $ref }[ $$ref{ "pos" } - 1 ]};
                    $$ref{ "skipinc" } = 0;
                }
                $__json_scratch{ $ref }[ $$ref{ "pos" } ]{ $ntag } = $v;
                push @added, $ntag;
                show_state( $ref, "post adding hash element '$ntag' '$v'", $depth ) if $debug_rplc;
            }
        }
        my $array_count = 0;
        while ( my ($k, $v ) = each %$json )
        {
            if ( ref( $v ) eq 'HASH' )
            {
                my $ntag = ( $tag ? "$tag:" : "" ) . $k;
                json_expand_util( $v, $ref, ( $tag ? "$tag:" : "" ) . $k, $depth + 1 );
                print "d $depth: depth " . ( 1 + $depth ) . " HASH return from expand ARRAY on $ntag\n" if ref( $v ) eq 'ARRAY' && $debug_rplc;
                print "d $depth: depth " . ( 1 + $depth ) . " HASH return from expand HASH on $ntag\n" if ref( $v ) eq 'HASH' && $debug_rplc;
                print "my added " . ( join " ", @added ) . "\n" if $debug_rplc;
#                print "try clear closed hash, tag $ntag ref = " . ref( $v ) . "\n" if $debug_rplc;
#                if ( ref( $v ) eq 'ARRAY' )
#                {
## increment, clear out matching keys                    
#                    print "clear closed hash\n" if $debug_rplc;
#                    $$ref{ "pos" }++ if !$$ref{ "skipinc" };
#                    $$ref{ "skipinc" } = 1;
#                    %{$__json_scratch{ $ref }[ $$ref{ "pos" } ]} =
#                        %{$__json_scratch{ $ref }[ $$ref{ "pos" } - 1 ]};
#                    for ( grep /^$ntag/, keys %{$__json_scratch{ $ref }[ $$ref{ "pos" } ]} )
#                    {
#                        print "deleting hash key $_\n" if $debug_rplc;
#                        delete ${$__json_scratch{ $ref }[ $$ref{ "pos" } ]}{ $_ };
#                    }
#                }                
            }
        }
        while ( my ($k, $v ) = each %$json )
        {
            if ( ref( $v ) eq 'ARRAY' )
            {
                my $ntag = ( $tag ? "$tag:" : "" ) . $k;
                if ( ref( $v ) eq 'ARRAY' )
                {
# allow for general usage, probably should be a warning if active field
#                    if ( $array_count )
#                    {
#                        die "Error: only one ARRAY currently supported per hash found at $ntag in ?.json\n";
#                    }
                    $array_count++;
                }
                json_expand_util( $v, $ref, ( $tag ? "$tag:" : "" ) . $k, $depth + 1 );
                print "d $depth: depth " . ( 1 + $depth ) . " HASH return from expand ARRAY on $ntag\n" if ref( $v ) eq 'ARRAY' && $debug_rplc;
                print "d $depth: depth " . ( 1 + $depth ) . " HASH return from expand HASH on $ntag\n" if ref( $v ) eq 'HASH' && $debug_rplc;
                print "my added " . ( join " ", @added ) . "\n" if $debug_rplc;
                print "try clear closed array, tag $ntag ref = " . ref( $v ) . "\n" if $debug_rplc;
                if ( ref( $v ) eq 'ARRAY' )
                {
# increment, clear out matching keys                    
                    print "clear closed array ntag $ntag\n" if $debug_rplc;
                    $$ref{ "pos" }++ if !$$ref{ "skipinc" };
                    $$ref{ "skipinc" } = 1;
                    %{$__json_scratch{ $ref }[ $$ref{ "pos" } ]} =
                        %{$__json_scratch{ $ref }[ $$ref{ "pos" } - 1 ]};
                    my $utag = $ntag;
                    print "clear closed array, utag1 $utag\n" if $debug_rplc;
                    $utag =~ s/\:\w*$//;
                    print "clear closed array, utag $utag\n" if $debug_rplc;
                    for ( grep /^$utag(:|$)/, keys %{$__json_scratch{ $ref }[ $$ref{ "pos" } ]} )
                    {
                        print "deleting hash key $_\n" if $debug_rplc;
                        delete ${$__json_scratch{ $ref }[ $$ref{ "pos" } ]}{ $_ };
                    }
                }                
            }
        }
    }
    if ( ref( $json ) eq 'ARRAY' )
    {
        my @added;
        for ( my $i = 0; $i < @$json; ++$i )
        {
            my $v = $$json[ $i ];
            if ( ref( $v ) )
            {
                json_expand_util( $v, $ref, $tag, $depth + 1 );
                print "d $depth: depth " . ( 1 + $depth ) . " ARRAY return from expand ARRAY on $tag\n" if ref( $v ) eq 'ARRAY' && $debug_rplc;
                print "d $depth: depth " . ( 1 + $depth ) . " ARRAY return from expand HASH on $tag\n" if ref( $v ) eq 'HASH' && $debug_rplc;
                print "my added " . ( join " ", @added ) . "\n" if $debug_rplc;
                if ( ref( $v ) eq 'HASH' )
                {
# increment, clear out matching keys                    
                    print "clear closed hash\n" if $debug_rplc;
                    $$ref{ "pos" }++ if !$$ref{ "skipinc" };
                    $$ref{ "skipinc" } = 1;
                    %{$__json_scratch{ $ref }[ $$ref{ "pos" } ]} =
                        %{$__json_scratch{ $ref }[ $$ref{ "pos" } - 1 ]};
                    for ( grep /^$tag(:|$)/, keys %{$__json_scratch{ $ref }[ $$ref{ "pos" } ]} )
                    {
                        print "deleting hash key $_\n" if $debug_rplc;
                        delete ${$__json_scratch{ $ref }[ $$ref{ "pos" } ]}{ $_ };
                    }
                    print "after delete pairs:\n" if $debug_rplc;
                    while ( my ( $k1, $v1 ) = each %{$__json_scratch{ $ref }[ $$ref{ "pos" } ]} )
                    {
                        print "$k1 $v1\n" if $debug_rplc;
                    }
                }                
            } else {
                print '-'x60 . "\n" if $debug_rplc;
                show_state( $ref, "pre adding array element '$tag' '$v'", $depth ) if $debug_rplc;
                if ( $__json_scratch{ $ref }[ $$ref{ "pos" } ]{ $tag } )
                {
                    $$ref{ "pos" }++;
                    %{$__json_scratch{ $ref }[ $$ref{ "pos" } ]} =
                        %{$__json_scratch{ $ref }[ $$ref{ "pos" } - 1 ]};
                    $$ref{ "skipinc" } = 0;
                }
                $__json_scratch{ $ref }[ $$ref{ "pos" } ]{ $tag } = $v;
                push @added, $tag;
                show_state( $ref, "post adding array element '$tag' '$v'", $depth ) if $debug_rplc;
            }
        }
        if ( 0 ) {
            for ( my $i = 0; $i < @$json; ++$i )
            {
                my $v = $$json[ $i ];
                if ( ref( $v ) )
                {
                    json_expand_util( $v, $ref, $tag, $depth + 1 );
                }
            }
        }
    }
}    

undef %global_file_replace_cache;
undef %global_file_replace_style_cache;
undef %include_additional_files;

sub replace_file_json_walk {
    my ( $hash, $lang, $file ) = @_;
    while (my ($k, $v) = each %$hash) {
        if (ref($v) eq 'HASH') {
            replace_file_json_walk( $v, $lang, $file );
        } else {
            if ( ref( $v ) eq 'ARRAY' ) {
                for ( my $i = 0; $i < @$v; ++$i ) {
                    replace_file_json_walk( @$v[$i], $lang, $file );
                }
            } else {
                # at leaf node ... load file if needed
                if ( $v =~ /^__<\s*(.*)\.(\S+)$/ ) {
                    my $f = "files/$1.$2";
                    my $type = $2;
                    # print "---> file match found $f type $type\n";
                    if ( $type !~ /^(txt|html|doc|docx)$/ ) {
                        $error .= "Unsupported include file type found $type\n";
                    } else {
                        $f = "$lang/$f" if -e "$lang/$f";
                        if ( $global_file_replace_cache{ $f } ) {
                            $$hash{ $k } = $global_file_replace_cache{ $f };
                        } else {
                            if ( !-e $f ) {
                                $error .= "Could not find include file $f\n";
                            } else {
                                if ( !-r $f ) {
                                    $error .= "Could not read include file $f, check permissions\n";
                                } else {
                                    print "including file $f\n";
                                    if ( $type =~ /^(txt|html)$/ ) {
                                        # print "now include as text\n";
                                        my $fh;
                                        open $fh, $f || die "$0: error reading include file $f\n";
                                        my @l = <$fh>;
                                        close $fh;
                                        my $body = join '', @l;
                                        # escape single quotes, remove newlines
                                        $body =~ s/'/\\'/g;
                                        $body =~ s/\n/ /g;
                                        # replace tilde's
                                        $body =~ s/~/&#126;/g;
                                        $global_file_replace_cache{ $f } = $body;
                                        $$hash{ $k } = $body;
                                        if ( !length( $global_file_replace_cache{ $f } ) ) {
                                            $warn .= "Included file $f appears to be empty\n";
                                        }
                                    }
                                    if ( $type =~ /^(doc|docx)$/ ) {
                                        # print "now include as html from abiword\n";
                                        my $uf = $file;
                                        $file =~ s/\.json$//;
                                        $file =~ s/^.*\///;
                                        my $cmd = "doc2html.pl $file '$f'\n";
                                        print $cmd;
                                        my $fh;
                                        open $fh, "doc2html.pl $file '$f' |";
                                        my @l = <$fh>;
                                        close $fh;
                                        die "$0: error with image conversion of $f\n" if $?;
                                        
                                        my $od = $l[ 0 ];
                                        chomp $od;
                                        my $utag = $l[ 1 ];
                                        chomp $utag;
                                        print "od is '$od'\nutag is '$utag'\n";
                                        
                                        open $fh, "$od/$utag.html";
                                        my @l = <$fh>;
                                        close $fh;
                                        my $body = join '', @l;

                                        open $fh, "$od/$utag.css";
                                        my @l = <$fh>;
                                        close $fh;
                                        my $style = join '', @l;

                                        if ( -e "$od/${utag}_files" ) {
                                            my @fs = `cd $od/${utag}_files; ls -1`;
                                            grep chomp, @fs;
                                            grep s/^/${utag}_files\//, @fs;
                                            # print join "\n", @fs;
                                            # print "\n";
                                            foreach my $k ( @fs ) {
                                                $include_additional_files{ "$od/$k" } = "files/$k";
                                                $body =~ s/$k/files\/$k/g;
                                            }
                                            #foreach my $k ( keys %include_additional_files ) {
                                            #    print "\$include_additional_files{ $k } = $include_additional_files{$k}\n";
                                            #}
                                        }

                                        # escape single quotes, remove newlines
                                        $body  =~ s/'/\\'/g;
                                        $body  =~ s/\n/ /g;
                                        $style =~ s/'/\\'/g;
                                        $style =~ s/\n/ /g;
                                        $global_file_replace_cache{ $f }          = $body;
                                        $global_file_replace_cache_style{ $file } .= $style;

                                        # print "style is:----------------------------------------\n$style\n----------------------------------------\n";
                                        # print "body is:----------------------------------------\n$body\n----------------------------------------\n";
                                        
                                        if ( !length( $global_file_replace_cache{ $f } ) ) {
                                            $warn .= "Included file $f appears to be empty after abiword processing\n";
                                        }

                                        if ( 0 ) { # old way
                                            my $uf = $f;
                                            $uf =~ s/ /\\ /g;
                                            my $fh;
                                            open $fh, "abiword --to=html --to-name=fd://1 --exp-props='html-markup: html4; html-images: embed' $uf 2> /dev/null |" || die "$0: error reading include file $f\n";
                                            my @l = <$fh>;
                                            close $fh;
                                            my $res = join '', @l;
                                            ( my $style ) = $res =~ /<style type="text\/css">((.|\n)*)<\/style>/m;
                                            ( my $body ) = $res =~ /<body>((.|\n)*)<\/body>/m;
                                            # escape single quotes, remove newlines
                                            $body  =~ s/'/\\'/g;
                                            $body  =~ s/\n/ /g;
                                            $style =~ s/'/\\'/g;
                                            $style =~ s/\n/ /g;
                                            $global_file_replace_cache{ $f }          = $body;
                                            $global_file_replace_cache_style{ $file } .= $style;
#                                        print "style is:\n$style\n";
#                                        print "in walk global_file_replace_cache_style:\n" . Dumper( %global_file_replace_cache_style );
                                            $$hash{ $k } = $body;
                                            if ( !length( $global_file_replace_cache{ $f } ) ) {
                                                $warn .= "Included file $f appears to be empty after abiword processing\n";
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    $hash;
}

#** @function public start_json ( json , ref )
#
# @brief takes json and initiates an iterator
#
# This starts an iterator thru the json
# rewind the iterator with rewind_json()
# increment the iterator with next_json()
#
# @param json required a decoded_json HASH e.g. a return from get_file_json()
# @param ref  required a an empty hash to store the iterator
# @retval ref the initialized iterator
#*

sub start_json {
    my $json = $_[0];
    my $ref  = $_[1];    # a reference to a HASH 
    
    my $error;
    if ( ref( $json ) ne 'HASH' )
    {
        $error .= "start_json argument 1 is not a HASH\n";
    }
    if ( ref( $ref ) ne 'HASH' )
    {
        $error .= "start_json argument 2 is not a HASH\n";
    }
    die $error if $error;

    $__json_scratch{ $ref } = (); # an array of pairs
    $$ref{ "pos" }     = 0;
    $$ref{ "skipinc" } = 0;

    json_expand_util( $json, $ref );
    if ( $$ref{ "pos" } ) # -1 to take care of last closer ?
    {
        $__json_scratch{ $ref }[ $$ref{ "pos" } ] = 0;
        $$ref{ "pos" }--;
#        pop( $__json_scratch{ $ref } );
    }
    $$ref{ "mpos" } = $$ref{ "pos" };
    $$ref{ "pos" } = 0;
#    print "ref( $json ) is " . ref( $json ) . "\n";
#    print "ref( $ref ) is " . ref( $ref ) . "\n";
    $__json_scratch{ $ref }[ $$ref{ "pos" } ];
}

#** @function public rewind_json ( ref )
#
# @brief rewinds the json iterator
#
# @param ref the iterator HASH reference
# @retval ref the iterator set back to the start 
#
# @bug needs testing
#*

sub rewind_json {
    my $ref = $_[0];
    $$ref{ "pos" } = 0;
    return $__json_scratch{ $ref }[ $$ref{ "pos" } ];
}

#** @function public copy_json ( ref )
#
# @brief makes a copy
#
# @param ref the iterator HASH reference
# @retval ref the iterator set back to the start 
#
#*

sub copy_json {
    my $org_ref = $_[ 0 ];
    my $new_ref = $_[ 1 ];
    $__json_scratch{ $new_ref } = [ @$__json_scratch{ $org_ref } ];
}

#** @function public next_json ( ref, match )
#
# @brief moves to the next matched block of json
#
# @param ref the iterator HASH reference
# @param match the string to check for iteration forward
# @retval ref the iterator moved forward
#
#*

sub next_json {
    my $ref   = $_[ 0 ];
    my $match = $_[ 1 ];
    my @match = split '\|', $match;

    if ( !$match )
    {
        $$ref{ "pos" }++;
    } else {
        my @v;
        for ( my $i = 0; $i < @match; ++$i )
        {
            $v[ $i ] = $__json_scratch{ $ref }[ $$ref{ "pos" } ]{ $match[ $i ] };
        }
#        print "start next json: match: " . ( join '~', @match ) . "\n";
#        print "start next json: v    : " . ( join '~', @v     ) . "\n";
        my $goon = 1;
        do {
            $$ref{ "pos" }++;
            for ( my $i = 0; $i < @match; ++$i )
            {
                if (  $__json_scratch{ $ref }[ $$ref{ "pos" } ]{ $match[ $i ] } ne $v[ $i ] )
                {
                    $goon = 0;
                    last;
                }
            }
        } while ( $$ref{ "pos" } < $$ref{ "mpos" } && $goon );
        if ( $goon )
        {
            return 0;
        }
#        print "end of match check: pos " . $$ref{ "pos" } . " mpos: " . $$ref{ "mpos" } . "\n";
    }
    return $__json_scratch{ $ref }[ $$ref{ "pos" } ];
}    


sub get_replacements {
    my $t = $_[ 0 ];
    if ( ref( $t ) ne 'ARRAY' )
    {
        my @r = split "\n", $t;
        return get_replacements( \@r );
    }
    my %used;
    my @ret;
    foreach my $k ( @$t )
    {
        while ( ( $tok ) = $k =~ /__([a-z0-9:]+)__/ )
        {
            push @ret, $tok if !$used{ $tok }++;
            $k =~ s/__${tok}__//g;
            print "k after removal of __${tok}__ is $k\n" if $debug_rplc;
        }
    }
    \@ret;
}

sub test_get_replacements {
    my @l = (
        "__line1__",
        "__line2__line3a__",
        "__line2____line3b__",
        "__tagx__ __tagy__"
        );
    my $r = get_replacements( \@l );
    print "test_get_replacements:\n";
    for ( my $i = 0; $i < @$r; ++$i )
    {
        print "$$r[ $i ]\n";
    }
}

sub fix_up_sub_tok {
    my $tok = $_[ 0 ];
    $tok =~ s/\\/\\\\/g;
    $tok =~ s/\+/\\+/g;
    $tok =~ s/\(/\\(/g;
    $tok =~ s/\)/\\)/g;
    $tok =~ s/\*/\\*/g;
    $tok =~ s/\{/\\{/g;
    $tok =~ s/\}/\\}/g;
    $tok =~ s/\^/\\^/g;
    $tok =~ s/\$/\\\$/g;
    $tok =~ s/\[/\\[/g;
    $tok =~ s/\]/\\]/g;
    $tok =~ s/\?/\\?/g;
    $tok;
}

sub get_cond_replacements {
#    $debug_rplc++;
    my $t = $_[ 0 ];
    if ( ref( $t ) ne 'ARRAY' )
    {
        my @r = split "\n", $t;
        return get_cond_replacements( \@r );
    }
    my %used;
    my %ret;
    my @l = @$t; # make copy to avoid side effect of destroying fields
    foreach my $k ( @l )
    {
        print '-'x30 . "\n" . "testing: <$k>\n" if $debug_rplc;
#        while ( ( $tok1, $tok2 ) = $k =~ /__\~([a-z0-9:]+)\s*\{([a-zA-Z0-9_=\"\': \+\-\(\)\*;%\.>]+)/ )
#        while ( ( $tok1, $tok2 ) = $k =~ /__\~([a-z0-9:_]+)\s*\{(([a-zA-Z0-9_=\"\': \+\-\(\)\*;#%\.\,\^>\/<~\?\\\$\[\]&]|\{[^\}]*\})+)\}/ )

# works for arbitrary sets:    my @array = $k =~ /\{ ( (?: [^{}]* | (?0) )* ) \}/x;

        if ( 1 ) {
            while ( ( $tok1 ) = $k =~ /__\~([a-z0-9:_]+)\s*\{/ )
            {
                print "--- tok1 is $tok1\n" if $debug_rplc;
                if ( $used{ $tok1 }++ )
                {
                    die "Error: multiple condition replacements for $tok1 in $k\n";
                }
                my $k1 = $k;
                $k1 =~ s/^.*__~${tok1}\s*\{/\{/;
                print "--- k1 is  $k1\n" if $debug_rplc;
                ( $tok2 ) = $k1 =~  /\{ ( (?: [^{}]* | (?0) )* ) \}/x;
                print "--- tok1 $tok1 : $tok2\n" if $debug_rplc;
                die "Error: empty tok2 in condition replacement of $tok1\n" if !length( $tok2 );
                $ret{ $tok1 } = $tok2;
                my $tok2r = fix_up_sub_tok( $tok2 );
                print "tok2r is $tok2r\n" if $debug_rplc;
                $k =~ s/__~${tok1}\s*\{$tok2r\}//g;
                print "k after removal of __~${tok1}\s*\{$tok2\} is '$k'\n" if $debug_rplc;
            }
        } else {
            while ( ( $tok1, $tok2 ) = $k =~ /__\~([a-z0-9:_]+)\s*\{(([a-zA-Z0-9_=\"\': \+\-\(\)\*;#%\.\,\^>\/<~\?\\\$\[\]&]|\{[^\}]*\})+)\}/ )
            {
                print "--- tok1 $tok1 : $tok2\n" if $debug_rplc;
                if ( $used{ $tok1 }++ )
                {
                    die "Error: multiple condition replacements for $tok1\n";
                }
                $ret{ $tok1 } = $tok2;
                my $tok2r = fix_up_sub_tok( $tok2 );
                $k =~ s/__~${tok1}\s*\{$tok2r\}//g;
                print "k after removal of __~${tok1}\s*\{$tok2\} is $k\n" if $debug_rplc;
            }
        }
        print "testing <$k> done\n" . '-'x30 . "\n" if $debug_rplc;
    }
    undef $debug_rplc;
    \%ret;
}

sub test_get_cond_replacements {
    my @l = (
        '__~myrplc2{ max="__max2__"} midstuff __~myrplc3{ max="__max2__"}'
        ,'extrapre __~myrplc4{{{}}} extrapost'
        ,'__~myrplc3b{"{{}}"}'
        ,'__~myrplcxy'
        ,'__~myrplcxy2{ max="__hi__"}'
        ,'__~myrplc1{ max="__max__"}'
        ,'__~myrplc2a{ max="__max__"}__~myrplc3a{ max="__max__"}'
        );
    print "test_get_cond_replacements:\n";
    $debug_rplc++;
    my $r = get_cond_replacements( \@l );
    while( my ( $k, $v ) = each %$r )
    {
        print "$k => $v\n";
    }
}

sub mkdir_for_file {
    my $f = $_[ 0 ];
    my @l = split '/', $f;
    my $p;
    for ( my $i = 0; $i < @l -1; ++$i )
    {
        $p .= "/" if $p;
        $p .= $l[ $i ];
        if ( !-d $p )
        {
            if ( -e $p )
            {
                die "Error: creating directory $p, it is not a directory and already exists\n";
            }
            if ( ! mkdir $p )
            {
                die "Error: creating directory $p $!\n";
            }
            $notice .= "created directory $p\n";
        }
    }
}

sub print_json_expand {
    my $arg = $_[ 0 ];
    my $pos = $_[ 1 ];
    if ( ref( $arg ) eq 'HASH' )
    {
        while ( my ($k, $v ) = each %$arg )
        {
            if ( ref( $v ) )
            {
                print '-'x$pos . "$k is a ref:\n";
                print_json_expand( $v, $pos + 1 );
            } else {
                print '-'x$pos . "$k is $v\n";
            }
        }
    }
    if ( ref( $arg ) eq 'ARRAY' )
    {
        for ( my $i = 0; $i < @$arg; ++$i )
        {
            my $v = $$arg[ $i ];
            if ( ref( $v ) )
            {
                print '-'x$pos . "[$i] is a ref:\n";
                print_json_expand( $v, $pos + 1 );
            } else {
                print '-'x$pos . "[$i] is $v\n";
            }
        }
    }
}    

#** @function public get_file_json (filename, filename2 )
# @brief opens json formatted file and returns the json decoded as a HASH
#
# opens json formatted file and returns the json decoded as a HASH
# will die if file does not exist
#
# @param filename required the file to open
# @param filename2 optional the file to append
# @retval json the json decoded as a HASH
#*

sub get_file_json {
    my $f  = $_[ 0 ];
    my $f2 = $_[ 1 ];

    $get_file_json_last = $f;

    die "$0: get_file_json error $f does not exist\n" if !-e $f;
    my $fh;
    open $fh, $f || die "$0: get_file_json error file open $f $!\n";
    my @ol = <$fh>;
    close $fh;
    my @l = grep !/^\s*#/ , @ol;
    my $l = join '', @l;
    my $json;
    eval {
        $json = decode_json( $l );
        1;
    } || do {
        my $e = $@;
        
        # figure out line #

        my ( $cp ) = $e =~ /at character offset (\d+) /;
        my $i;
        my $cpos = $cp;
        for ( $i = 0; $i < @ol; ++$i ) {
            next if $ol[ $i ] =~ /^\s*#/;
            $cpos -= length( $ol[ $i ] );
            last if $cpos < 0;
        }

        my $sline = $i - 2;
        my $eline = $i + 2;
        $sline = 0 if $sline < 0;
        $eline = @ol - 1 if $eline >= @ol;

        print "JSON Error in file $f near these lines:\n";
        for ( my $j = $sline; $j <= $eline; ++$j ) {
            my $uj = $j + 1;
            print "$uj: $ol[$j]";
            print "$uj: " .'^'x(length($ol[$j])) . "\n" if $j == $i;
        }
        die;
    };

    if ( $f2 ) {
        die "$0: get_file_json error $f2 does not exist\n" if !-e $f2;
        my $fh;
        open $fh, $f2 || die "$0: get_file_json error file open $f2 $!\n";
        my @l = <$fh>;
        close $fh;
        @l = grep !/^\s*#/ , @l;
        my $l = join '', @l;
        $json = merge( $json, decode_json( $l ) );
        $get_file_json_last .= " merged with $f2";
    }

    # remove tags with structures and store in last_json

    if ( $$json{ 'dependencies' } ) {
        my $js = JSON->new;
        $extra_subs{ '__dependencies__' } = $js->encode( $$json{ 'dependencies' } );
        delete $$json{ 'dependencies' };
    } else {
        delete $extra_subs{ '__dependencies__' };
    }
        
    $json;
}

sub get_lang_json {
    get_file_json( "$gap/languages/$_[0].json" );
}

#** @function public get_file_json_lang_specific (filename, language, replace )
# @brief opens json formatted file and returns the json decoded as a HASH
#
# opens json formatted file and returns the json decoded as a HASH
# checks first for language/filename and if it doesn't exist, tries filename
# if "replace" evalutes true, the language specific json replaces, otherwise, it is appended
# will die if file does not exist
#
# @param filename required the file to open
# @param language required the target language
# @param replace something that evaulates true if you wish use the language specific contents as a replacement
# @retval json the json decoded as a HASH
#*

sub get_file_json_lang_specific {
    my $f = $_[ 0 ];
    my $l = $_[ 1 ];
    my $r = $_[ 2 ];

#    print "get_file_json_lang_specific f='$f' l='$l' r='$r'\n";

    if ( $l && -e "$l/$f" ) {
        $get_file_json_lang_specific_used++;
        return replace_file_json_walk( $r ? get_file_json( "$l/$f" ) : get_file_json( "$f", "$l/$f" ), $l, $f );
    }

    replace_file_json_walk( get_file_json( "$f" ), $l, $f );
}

# $debugref++;

sub ref_match {
    my $arg   = $_[ 0 ];
    my $match = $_[ 1 ];
    my $tag   = $_[ 2 ];
    my $pos   = $_[ 3 ];

    my @ret;
    
    $tag = "base" if !length( $tag );

    if ( ref( $arg ) eq 'HASH' )
    {
        while ( my ($k, $v ) = each %$arg )
        {
            if ( $k eq $match )
            {
                push @ret, $v;
            }
            if ( ref( $v ) )
            {
                print '-'x$pos . "$k is a ref:\n" if $debugref;
                my $x = ref_match( $v, $match, $k, $pos + 1 );
                foreach my $k ( @$x )
                {
                    push @ret, $k;
                }
            } else {
                print '-'x$pos . "<[$tag]> <$k> is $v\n" if $debugref;
            }
        }
    }
    if ( ref( $arg ) eq 'ARRAY' )
    {
        for ( my $i = 0; $i < @$arg; ++$i )
        {
            my $v = $$arg[ $i ];
            if ( ref( $v ) )
            {
                print '-'x$pos . "[$i] is a ref:\n" if $debugref;
                my $x = ref_match( $v, $match, $tag, $pos + 1 );
                foreach my $k ( @$x )
                {
                    push @ret, $k;
                }
            } else {
                print '-'x$pos . "<[$tag]> [$i] is $v\n" if $debugref;
            }
        }
    }

    \@ret;
}    

sub hash_simple {
# for single pair info
    my $x = ref_match( $_[ 0 ], $_[ 1 ] );
    my %ret;
    foreach my $k ( @$x )
    {
        $ret{ $k }++ if !ref( $k );
        if ( ref( $k ) eq 'ARRAY' )
        {
            foreach my $j ( @$k )
            {
                $ret{ $j }++ if !ref( $j );
            }
        }
    }
    \%ret;
}

sub hash_sub {
    my $modules = ref_match( $_[ 0 ], $_[ 1 ], $_[ 2 ] );
    my %ret;

    foreach my $k ( @$modules )
    {
        if ( ref( $k ) eq 'ARRAY' )
        {
            foreach my $j ( @$k )
            {
                if ( ref( $j ) eq 'HASH' )
                {
                    while( my ( $k, $v ) = each %$j )
                    {
                        $ret{ $v }++ if !ref( $v ) && $k eq $_[ 2 ];
                    }
                }
            }
        }
    }
    \%ret;
}
    
sub valid_name {
    my $context = $_[ 0 ];
    my $ref     = $_[ 1 ];
    my $error;
    my %tmpref;

    if ( ref( $ref ) eq 'SCALAR' )
    {
        $ref = { $$ref => 1 };
    }

    if ( ref( $ref ) eq 'ARRAY' )
    {
        my $bref = $ref;
        $ref = {};
        foreach my $k ( @$bref )
        {
            $$ref{ $k }++;
        }
    }
    foreach my $k ( keys %$ref )
    {
        if ( $k !~ /^[A-Za-z]\w*$/ )
        {
            $error .= "in context $context: invalid name '$k' must alphabetic in first space and contain only alphanumeric or underscore\n";
        }
        if ( $reserved_words{ $k } )
        {
            $error .= "in context $context: invalid name '$k' reserved word\n";
        }
    }
    $error;
}


#** @function public svninfo ( path )
#
# @brief changes to the path and returns a nice svn info
#
# @param string path required the directory to check
# @retval string the info, empty if no svn there
#*

sub svninfo {
    my $path = $_[0];
    my $info = `cd $path; svn info 2> /dev/null`;
    ( my $rev ) = $info =~ /^Revision: (\d+)/m;
    ( my $revdate ) = $info =~ /^Last Changed Date: (.*)$/m;
#    print "svn path $path rev $rev date $revdate\n";
    my $ret = "";
    if ( length( $rev ) && length( $revdate ) ) {
        $ret = "Revision $rev on $revdate";
    }
    $ret;
}

sub module_exists {
    my $f     = $_[0];
    my $langs = $_[1];

    return 1 if -e $f;

    foreach my $k ( keys %$langs ) {
        return 1 if -e "$k/$f";
    }
    return 0;
}

sub add_special_directives {
    my $json = $_[0];

    foreach my $k ( keys %special_directives ) {
        $$json{ $k } = $special_directives{ $k };
    }
    $json;
}

sub get_available_module_files {
    my $f     = $_[0];
    my $langs = $_[1];

    my %avail_module_files;

    # ok, it's going to check them all... should really only check used ones based upon menu

    $avail_module_files{ $f }++ if -e $f;

    foreach my $k ( keys %$langs ) {
        $avail_module_files{ $f }++ if -e "$k/$f";
    }
    %avail_module_files;
}

sub check_files {
    print "genapp_util.pl version $gap_version\n";

    # global side-effects
    undef %langs;
    undef %icons;
    undef %types;
    undef $menu;
    undef $config;
    undef $configbase;
    undef $directives;
    undef %special_directives;
    undef %rpls;
    undef %module_to_file;
    undef %reserved_words;
    undef %module_layouts;

    $notice .= load_reserved_words();

#    my %modules;
    my %modules_by_language;

    my @req = (
        'directives.json'
#        ,'menu.json'
        ,'config.json'
        ,'configbase.json'
    );

    my $error;
    undef $warn;

#    $error .= valid_name( 'testing', [ "hi", "there", "interface" ] );

    my @further_checks;
    my $fh;
    foreach my $f ( @req )
    {
        if ( !-e $f )
        {
            if ( -e "$gap/modules/$f" )
            {
                $f = "$gap/modules/$f";
            } else {
                $error .= "$f does not exist\n";
                next;
            }
        }
        if ( ! open $fh, $f )
        {
            $error .= "$f can not be opened\n";
            next;
        }
        close $fh;
        push @further_checks, $f;
    }

    my %already_pushed_menus;

    foreach my $f ( @further_checks )
    {
        print '-'x60 . "\n";
        print "checking: $f\n";
        my $this_lang = $f =~ /^(.*)\/menu.json$/ ? $1 : "";

        my $json = get_file_json( $f );
        print "get json $f: json $json\n";
        {
            my $x = hash_simple( $json, 'languages' );
            print "languages:\n\t" . ( join "\n\t", keys %$x ) . "\n" if keys %$x;
            foreach my $k ( keys %$x )
            {
                $langs{ $k }++;
                my $this_menu = -e "$k/menu.json" ? "$k/menu.json" : "menu.json";
                print "language $k this menu $this_menu\n";
                if ( !$already_pushed_menus{ $this_menu } ) {
                    print "language $k this menu $this_menu pushed to further checks\n";
                    $already_pushed_menus{ $this_menu }++;
                    push @further_checks, $this_menu;
                }
                # check directives.json in language if exists to make sure there is no language definition
                if ( -e "$k/directives.json" ) {
                    my $d_json = get_file_json( "$k/directives.json" );
                    my $d_x = hash_simple( $d_json, 'languages' );
                    $error .= "$k/directives.json can not contain a languages tag. this is only allowed in your base directives.json\n" if keys %$d_x;
                }
            }
        }

        {
            my $x = hash_sub( $json, 'modules', 'id' );
            print "modules:\n\t" . ( join "\n\t", keys %$x ) . "\n" if keys %$x;
            $error .= valid_name( "$f modules:id", $x );
            foreach my $k ( keys %$x )
            {
                $modules_by_language{ $this_lang } = {} if !$modules_by_language{ $this_lang };
                $modules_by_language{ $this_lang }{ $k }++;
            }
        }

        {
            my $x = hash_simple( $json, 'icon' );
            print "icons:\n\t" . ( join "\n\t", keys %$x ) . "\n" if keys %$x;
            foreach my $k ( keys %$x )
            {
                $icons{ $k }++;
            }
        }

        # special file specific items
        if ( $f eq 'directives.json' )
        {
            $directives = $json;
            my @req = ( "title", "application", "version" );
            foreach my $k ( @req )
            {
                my $x = hash_simple( $json, $k );
                if ( keys %$x == 0 )
                {
                    $error .= "no $k found in $f\n";
                    next;
                }
                if ( keys %$x != 1 )
                {
                    $warn .= "multiple $k found: " . ( join ' ', keys %$x ) . " in $f\n";
                }
                $rpls{ $k } = each %$x;
                print "$k:\t". $rpls{$k} . "\n";
            }
            my @cnames = ( "application" );
            foreach my $k ( @cnames )
            {
                $error .= valid_name( "$f \"$k\"", \$rpls{$k} );
            }
            # add special tags
            {
                my $date = `date -u`;
                chomp $date;
                $special_directives{ 'generatedon' } = "Generated on $date";
                my $path = `pwd`;
                chomp $path;
                my $info = svninfo( $path );
                if ( length( $info ) ) {
                    $info = $$directives{ "title" } . " " . $info;
                }
                $special_directives{ 'apprevision' } = $info;
                print "info: $info\n";
                $info = "GenApp " . svninfo( $gap );
                $special_directives{ 'revision' } = $info;
                print "info: $info\n";
            }
        }

        if ( $f =~ 'menu.json' )
        {
            $menu = $json;
            # check for menu.json issues
            my $ref_menu = {};
            my $rplc_menu = start_json( $menu, $ref_menu );
            my $freq = "menu:id";
            my %used_menu_ids;
            my %used_module_ids;
            do {
                $used_menu_ids{ $$rplc_menu{ $freq } }++;
            } while( $rplc_menu = next_json( $ref_menu, $freq ) );
            my $rplc_menu = start_json( $menu, $ref_menu );
            $freq = "menu:modules:id";
            do {
                $error .= "menu.json error: menu:id \"$$rplc_menu{$freq}\" is duplicated as a module:id\n"
                    if $used_menu_ids{ $$rplc_menu{ $freq } };
                $error .= "menu.json error: menu:module:id \"$$rplc_menu{$freq}\" is duplicated\n"
                    if $used_module_ids{ $$rplc_menu{ $freq } }++;
            } while( $rplc_menu = next_json( $ref_menu, $freq ) );
        }

        if ( $f eq 'config.json' ||
             $f eq "$gap/modules/config.json" )
        {
            $config = $json;
        }

        if ( $f eq 'configbase.json' ||
             $f eq "$gap/modules/configbase.json" )
        {
            $configbase = $json;
        }
    } # end further_checks

#    print "modules_by_language:\n" . Dumper( \%modules_by_language );
#    print "keys modules_by_language:\n" . Dumper( keys  \%modules_by_language );

    foreach my $k ( keys %langs )
    {
        my $f = "$gap/languages/$k.json";
        if ( !-e $f )
        {
            $error .= "missing language '$k' in $f \n";
            next;
        }
    }

    my %module_files;

    foreach my $l ( keys %{\%modules_by_language} ) {
#        print "l in modules_by_language is $l\n";
#        print Dumper ( %$l );

        foreach my $k ( keys %{$modules_by_language{ $l }} ) {
# local dir modules take precedence
            my $f = "modules/$k.json";
            if ( !module_exists( $f, \%langs ) ) {
#            my $fg = "$gap/modules/" . $rpls{"application"} . "/$k.json";
                my $fg = "$gap/modules/$k.json";
                if ( !-e $fg )
                {
                    $error .= "missing module '$k' in $f or $fg\n";
                    next;
                } else {
                    $module_files{ $l } = {} if !$module_files{ $l };
                    $module_files{ $l }{ $fg }++;
                    $module_to_file{ $l } = {} if !$module_to_file{ $l };
                    $module_to_file{ $l }{ $k } = $fg;
                }
            } else {
                $module_files{ $l } = {} if !$module_files{ $l };
                $module_files{ $l }{ $f }++;
                $module_to_file{ $l } = {} if !$module_to_file{ $l };
                $module_to_file{ $l }{ $k } = $f;
            }
        }
    }

#    print "module_files:\n" . Dumper( \%module_files );
#    print "module_to_file:\n" . Dumper( \%module_to_file );

    foreach my $k ( keys %icons )
    {
        my $f = $k;
        if ( !-e $f )
        {
            $error .= "missing icon '$k' in $f \n" if !-e $f;
            next;
        }
    }

# check module types for validity

    my %types;

# we should redo this to check for "role"

    my %graphviz_repeaters;

    foreach my $l ( keys %{\%module_files} ) {
#        print "lang $l\n";
        foreach my $f ( keys %{$module_files{ $l }} )
        {
            my $json = get_file_json_lang_specific( $f, $l, 1 );
            print "checking " . ( $l ? "for language $l " : "" ) . "module file $get_file_json_last\n";
            
            # check types for valid registry
            {
                my $x = hash_simple( $json, 'type' );
                print "types:\n\t" . ( join "\n\t", keys %$x ) . "\n" if keys %$x && $debug;
                foreach my $k ( keys %$x )
                {
                    $types{ $k }++;
                }
            }
            # check reserved words
            {
                my $x = hash_simple( $json, 'id' );
                print "id:\n\t" . ( join "\n\t", keys %$x ) . "\n" if keys %$x && $debug;
                $error .= valid_name( "$f \"id\"", $x );
            }
            # check for duplicate id's and listbox values
            {
                my $ref_mod = {};
                my $mod_info = start_json( $json, $ref_mod );
                
                my %ids;

                do {
                    if ( !$$mod_info{ 'fields:id' } ) {
                        $error .= "Module $f has field without field id defined\n" if $$mod_info{ 'fields:type' } ne "info";
                    } else {
                        $error .= "Module $f has fields with duplicate id \"" . $$mod_info{ 'fields:id' } . "\"\n" if $ids{ $$mod_info{ 'fields:id' } }++;
                    }
                    $error .= "Module $f field " . $$mod_info{ 'fields:id' } . " is a listbox but is missing the required \"values\" tag\n" if $$mod_info{ 'fields:type' } eq 'listbox' && !$$mod_info{ 'fields:values' } && !$$mod_info{ 'fields:pull' };
                } while( $mod_info = next_json( $ref_mod, 'fields:id' ) );
            }
            # check repeaters & repeats
            {
                my $ref_mod = {};
                my $mod_info = start_json( $json, $ref_mod );
                my %repeater;
                my %repeat;
                my %repeattype;
                my $modname = $f;
                do {
                    if ( $$mod_info{ 'fields:repeater' } ||
                         $$mod_info{ 'fields:reverserepeater' } )
                    {
                        $repeater{ $$mod_info{ 'fields:id' } } = $$mod_info{ 'fields:type' };
                        if ( $$mod_info{ 'fields:type' } eq 'listbox' ) {
                            my @lbvalues = split '~', $$mod_info{ 'fields:values' };
                            $error .= "Module $f field " . $$mod_info{ 'fields:id' } . " is a listbox but the values are incorrect.  They must contain an even number of ~ separated words\n" if @lbvalues % 2;
                            for ( my $i = 1; $i < @lbvalues; $i += 2 ) {
                                my $k = $$mod_info{ 'fields:id' } . ":" . $lbvalues[ $i ];
                                $repeater  { $k } = $$mod_info{ 'fields:type' } . " choice " . ( 1 + ( ( $i - 1 ) / 2 ) );
                                $repeat    { $k } = $$mod_info{ 'fields:id' };
                                $repeattype{ $k } = $$mod_info{ 'fields:type' } . " choice " . ( 1 + ( ( $i - 1 ) / 2 ) );
                            }
                        }
                    }
                    if ( $$mod_info{ 'fields:repeat' } )
                    {
                        $repeat{ $$mod_info{ 'fields:id' } } = $$mod_info{ 'fields:repeat' };
#                        $repeat{ $$mod_info{ 'fields:id' } } =~ s/:.*$//;
                        $repeattype{ $$mod_info{ 'fields:id' } } = $$mod_info{ 'fields:type' };
                    }
                } while( $mod_info = next_json( $ref_mod, 'fields:id' ) );
                
                if ( $graphviz && keys %repeater )
                {
                    $modname =~ s/\.json$//;
                    $modname =~ s/^modules\///;
                    $graphviz_repeaters{$modname} = "digraph \{\n  rankdir=LR;\n  node [shape=box,style=rounded]\n  label=\"$modname repeaters\"\n";
                    $graphviz_cluster_no++;
#                foreach my $k ( keys %repeater )
#                {
#                    $graphviz_repeaters{$modname} .=  "  $k -> $repeater{$k};\n";
#                }
                }

                if ( ($show_repeaters || $debug ) && keys %repeater )
                {
                    print "-"x60 . "\n";
                    print "repeaters $f\n";
                    print "-"x60 . "\n";
                    foreach my $k ( keys %repeater )
                    {
                        print "$k => $repeater{$k}\n";
                    }
                }
                # current repeater rules:
                # integer, listbox & checkbox repeaters ok at level 1
                # nothing can repeat to a repeated integer or listbox
                if ( keys %repeat )
                {
                    print "-"x30 . "\nrepeat\n" . "-"x30 . "\n" if $debug || $show_repeaters;
                    foreach my $k ( keys %repeat )
                    {
                        print "$k => $repeat{$k}\n" if $debug || $show_repeaters;
                        if ( !$repeater{ $repeat{ $k } } )
                        {
                            $error .= "Module $f field '$k' repeat on '$repeat{ $k }' : missing repeater\n";
                        }
                        if ( $repeat{ $k } eq $k )
                        {
                            $error .= "Module $f field '$k' is a self referential repeater\n";
                        }
                        my $depth = 0;
                        my $me = $k;
                        while ( $me = $repeat{ $me } )
                        {
                            if ( $depth && $me eq $k )
                            {
                                $error .= "Module $f field '$k' has parent repeater which references '$k' as a repeater creating an infinite recursive loop of repeaters\n";
                                last;
                            }

                            $depth++;
                            if ( $depth > $max_repeater_depth )
                            {
                                $error .= "Module $f field '$k' exceeds maximum supported repeater depth\n";
                                last;
                            }
                        }
                    }
                    if ( $show_repeaters ) 
                    {
                        my $modname = $f;
                        $modname =~ s/\.json$//;
                        $modname =~ s/^modules\///;

                        my $fo =  "output/repeaters/${modname}_repeater.txt";
                        mkdir_for_file( $fo );
                        my $fh;
                        if ( !open $fh, ">$fo" )
                        {
                            $error .= "show repeaters: error opening output file $fo\n";
                            undef $fh;
                        }

                        # build a nice tree for display
                        print "-"x30 . "\nfull dependency\n" . "-"x30 . "\n";
                        foreach my $k ( keys %repeat )
                        {
                            my $depth = 0;
                            my $me    = $k;
                            my $line  = "$me\[$repeattype{$me}\]";
                            while ( $me = $repeat{ $me } )
                            {
                                $line .= " => $me\[$repeater{$me}\]";
                                $depth++;
                                if ( $depth > $max_repeater_depth )
                                {
                                    $error .= "Module $f field '$k' exceeds maximum supported repeater depth\n";
                                    last;
                                }
                            }
                            print "$line\n";
                            print $fh "$line\n" if $fh;
                        }
                        close $fh if $fh;
                        print "created: $fo\n" if $fh;
                    }
                    if ( $graphviz ) 
                    {
                        my %used_graph;
                        foreach my $k ( keys %repeat )
                        {
                            my $depth = 0;
                            my $me    = $k;
                            my $k1    = "\"$me\"";
                            my $lbl = $me;
                            $lbl =~ s/^.*://;
                            $graphviz_repeaters{$modname} .= "  $k1 \[label=\"$lbl\[" . $repeattype{$me} . "\]\"\]\n";
                            while ( $me = $repeat{ $me } )
                            {
                                my $k2  = "\"$me\"";
                                if ( !$used_graph{ "$k1:$k2" }++ ) 
                                {
                                    my $lbl = $me;
                                    $lbl =~ s/^.*://;
                                    $graphviz_repeaters{$modname} .= "  $k2 \[label=\"$lbl\[" . $repeater{$me} . "\]\"\]\n";
                                    $graphviz_repeaters{$modname} .= "  $k1 -> $k2\n";
                                    $depth++;
                                    if ( $depth > $max_repeater_depth )
                                    {
                                        $error .= "Module $f field '$k' exceeds maximum supported repeater depth\n";
                                        last;
                                    }
                                }
                                $k1 = $k2;
                            }
                        }
                        $graphviz_repeaters{$modname} .= "\}\n";
                    }
                }
                if ( $graphviz && keys %repeater )
                {
                    $graphviz_repeaters .=  "  }\n";
                }
                print "-"x30 . "\n" if keys %repeater && $show_repeaters;
            }
            # extract layout
            {
                my %layout;

                my $js = JSON->new;

                # check for panels
                {

                    if ( $$json{ 'panels' } ) {
                        print "$f has panels\n" if $debuglayout;
                        # leverage json to deep copy (i know, could use dclone or CPAN:clone), but we already have CPAN::JSON
                        $layout{ 'panels' } = decode_json( encode_json( $$json{ 'panels' } ) );

                    } else {
                        $layout{ 'panels' } = decode_json( "{}" );
                    }

                    # setup panel defaults (overrides in directives or somewhere else?)

                    if ( !exists $layout{ 'panels' }{ 'root' } ) {
                        $layout{ 'panels' }{ 'root' } = decode_json( "{}" );
                    }
                    if ( !exists $layout{ 'panels' }{ 'root' }{ 'columns' } ) {
                        $layout{ 'panels' }{ 'root' }{ 'columns' } = "auto";
                    }
                    if ( !exists $layout{ 'panels' }{ 'root' }{ 'rows' } ) {
                        $layout{ 'panels' }{ 'root' }{ 'rows' } = "auto";
                    }
                    if ( !exists $layout{ 'panels' }{ 'root' }{ 'align' } ) {
                        $layout{ 'panels' }{ 'root' }{ 'align' } = "left";
                    }
                    if ( !exists $layout{ 'panels' }{ 'root' }{ 'gap' } ) {
                        $layout{ 'panels' }{ 'root' }{ 'gap' } = "5px";
                    }
                }

                # extract field info & layout info
                
                if ( 0 ) {
                    # get it all
                    $layout{ 'fields' } = decode_json( encode_json( $$json{ 'fields' } ) );
                } else {
                    # extract specific fields:tags

                    my %keepids;
                    {
                        my @ids = ( "id",
                                    "role",
                                    "layout" );
                        @keepids{ @ids } = (1) x @ids;
                    }

                    $layout{ 'fields' } = [];
                    
                    for my $k ( @{$$json{ 'fields' }} ) {
                        my %pushfield;

                        print "dump of k\n" . Dumper( $k ) if $debuglayout;

                        foreach my $fk ( keys $k ) {
                            if ( $keepids{ $fk } ) {
                                $pushfield{ $fk } = $k->{$fk};
                            }
                        }
                        
                        print "dump of \%pushfield\n" . Dumper( %pushfield ) if $debuglayout;

                        push $layout{ 'fields' }, \%pushfield;
                    }
                        
                }

                print "$f panel json:\n" . $js->pretty->encode( \%layout ) . "\n" if $debuglayout;

                my $mname = $f;
                $mname =~ s/^.*\/([^\/]*)\.json$/\1/;

                if ( $l ) { 
                    # language specific json overrides
                    $module_layouts{ $l }{ $mname } = $js->pretty->encode( \%layout );
                } else {
                    # propagate to all defined languages that are not already defined for this module
                    for my $leach ( keys %langs ) {
                        if ( !$module_layouts{ $leach }{ $mname } ) {
                            $module_layouts{ $leach }{ $mname } = $js->pretty->encode( \%layout );
                        }
                    }
                }

                print Dumper( %module_layouts ) if $debuglayout;
            }            
        }
    } # end module_files (per language)
    
    foreach my $l ( keys %langs ) {
        # print "checking module to file for language $l\n";
        if ( !$module_to_file{ $l } ) {
            # print "no module_to_file for language $l\n";
            $module_to_file{ $l } = { %{$module_to_file{ '' }} };
        }
    }

    # print "after fixup module_to_file:\n" . Dumper( \%module_to_file );

    if ( $graphviz &&
         $get_file_json_lang_specific_used &&
         keys %langs > 1 ) {
        die "$0: -gd graphviz is currently not working with multiple languages with language specific files.  bother the developers to fix this if you need this capability\n" if $graphviz;
    }

    if ( $graphviz ) 
    {
        foreach my $k ( keys %graphviz_repeaters ) {
            next if $k =~ /\//;
            my $fo = "output/graphviz/${k}_repeater.dot";
            mkdir_for_file( $fo );
            my $fh;
            if ( !open $fh, ">$fo" )
            {
                $error .= "graphviz: error opening output file $fo\n";
            } else {
                print $fh $graphviz_repeaters{$k};
                close $fh;
            }
            print "created: $fo\n";
        }

# now build graphviz menu graph

        my $ref_directives = {};
        my $ref_menu       = {};
        my %used;
        $rplc_directives = start_json( $directives, $ref_directives );
        my $title = $$rplc_directives{'title'};
        $rplc_menu   = start_json( $menu,   $ref_menu );
        my $graphviz_modules = "digraph \{\n  rankdir=LR\n  node [shape=box,style=rounded]\n  label=\"$title\"\n";

        do 
        {
            my $menu   = $$rplc_menu{'menu:label'};
            my $module = $$rplc_menu{'menu:modules:label'};
            if ( !$used{ $menu }++ )
            {            
                $graphviz_modules .= "  \"$title\" -> \"$menu\"\n";
            }
            $graphviz_modules .= "  \"$menu\" -> \"$module\";\n";

#            while ( my ( $k, $v ) = each %$rplc_menu )
#            {
#                print "$k => $v\n";
#            }
        } while( $rplc_menu = next_json( $ref_menu, 'menu:modules:id') );

        $graphviz_modules .= "}\n";
        
        {
            my $fo = "output/graphviz/application.dot";
            mkdir_for_file( $fo );
            my $fh;
            if ( !open $fh, ">$fo" )
            {
                $error .= "graphviz: error opening output file $fo\n";
            } else {
                print $fh $graphviz_modules;
                close $fh;
            }
            print "created: $fo\n";
        }

        die "$0: -gd option terminates here\n" if $graphviz;
    }

    die "$0: -sr option terminates here\n" if $show_repeaters;


    foreach my $l ( keys %langs )
    {
        print "checking language types for language $l\n";
        foreach my $k ( keys %types )
        {
            print "checking language types for language $l type $k\n";
            my $b = "$gap/languages/$l/types/$k";
            {
                my $f = "$b.input";
                if ( !-e $f )
                {
                    $error .= "missing required file $f\n";
                }
            }
            {
                my $f = "$b.output";
                if ( !-e $f )
                {
                    $error .= "missing required file $f\n";
                }
            }
        }
    }
    

# ------------------------------------------------------------------


    my $retval = 1;
    if ( $warn )
    {
        print '-'x60 . "\nWarnings:\n$warn" . '-'x60 . "\n";
    }
    if ( $error )
    {
        print '-'x60 . "\nErrors:\n$error" . '-'x60 . "\n";
        $retval = 0;
    }
    return $retval;
}

return 1;
