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
 

# phase 1 panels

## step 1 check for missing parent panels

## step 2 assign parent panels 

## step 3 assign CSS grid info (row column, spans etc in parent div)

# phase 2 fields

## step 1 check for missing parent panels

## step 2 assign parent panels 

## step 3 assign CSS grid info (row column, spans etc in parent div)


