#!/usr/bin/perl

$notes = "usage: $0 files
lists contents of files in json format [with optional # comment lines]
note: env variable GENAPP must be defined
" ;

die $notes if !@ARGV;
$gap = $ENV{ "GENAPP" } || die "$0: error env variable GENAPP must be defined\n";

require "$gap/etc/perl/genapp_util.pl";

while ( $f = shift )
{
    $json = get_file_json( $f );    
    print "$f:\n";
    print_json_expand( $json );
}
