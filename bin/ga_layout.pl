#!/usr/bin/perl

$notes = 
"usage: $0 file
file is layout json
this test program \"fully populates\" layout fields in prep for layout testing

";

$gap = $ENV{ "GENAPP" } || die "$0: error env variable GENAPP must be defined\n";

require "$gap/etc/perl/genapp_util.pl";

$f = shift || die $notes;

my $json = get_file_json( $f );
 
my $error;
my $warn;
my $notice;

sub get_inherited_value {
    my $json  = $_[0];
    my $panel = $_[1];
    my $inh   = $_[2];

    return $$json{'panels'}{$panel}{$inh} if $$json{'panels'}{$panel}{$inh};

    die "root panel missing essential key $inh\n" if $panel eq 'root';

    die "unexpected missing parent panel $panel\n" if !$$json{'panels'}{$panel}{'parent'};

    return get_inherited_value( $json, $$json{'panels'}{$panel}{'parent'}, $inh );
}

sub layout_expand {
    my $json = shift;

# phase 1 panels

## step 1 check for missing parent panels & assign parent panels

    my %parents;
    $parents{ 'root' }++;

### pass 1 : collect parent names

    for my $k ( keys %{$$json{ 'panels' }} ) {
        print "panel $k found\n";
        $parents{ $k }++;
    }

### pass 2 : validate parents & set default parent if not specified

    for my $k ( keys %{$$json{ 'panels' }} ) {
        if ( $$json{'panels'}{ $k }{ 'parent' } ) {
            print "panel $k has parent $$json{'panels'}{$k}{'parent'}\n";
            $error .= "$f panel $k parent '$$json{'panels'}{$k}{'parent'}' not defined\n" if !$parents{$$json{'panels'}{$k}{'parent'}};
        } else {
            $$json{'panels'}{$k}{'parent'} = 'root';
        }
    }

## step 2 propagate parent keys

    my %inherit;
    {
        my @ikeys = ( 
            "gap",
            "align"
            );
        @inherit{ @ikeys } = (1) x @ikeys;
    }

    for my $k ( keys %{$$json{ 'panels' }} ) {
        for my $inh ( keys %inherit ) {
            $$json{'panels'}{$k}{$inh} = get_inherited_value( $json, $k, $inh );
        }
    }


## step 3 assign CSS grid info (row column, spans etc in parent div)

## step 4 check for clobbering (possibly included with previous step)

# phase 2 fields

## step 1 check for missing parent panels & assign parent panels

## step 2 propagate parent keys

## step 3 assign CSS grid info (row column, spans etc in parent div)

## step 4 check for clobbering (possibly included with previous step)

}

layout_expand( $json );

my $js = JSON->new;

print $js->pretty->encode( $json ) . "\n";

print '-'x60 . "\nNotices:\n$notice" . '-'x60 . "\n"  if $notice;
print '-'x60 . "\nWarnings:\n$warn" . '-'x60 . "\n"   if $warn;
print '-'x60 . "\nErrors:\n$error" . '-'x60 . "\n"    if $error;
