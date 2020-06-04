#!/usr/bin/perl

$notes = 
"usage: $0 {options} file
file is layout json
this test program \"fully populates\" layout fields in prep for layout testing
options: 
-d           debug layout
-dc          debug cursor implies debug layout
-df panels   debug fields for specified panels (comma separated, no spaces) or 'all' for all panels
";

$gap = $ENV{ "GENAPP" } || die "$0: error env variable GENAPP must be defined\n";

require "$gap/etc/perl/genapp_util.pl";

$f = shift || die $notes;

if ( $f =~ /^-d$/ ) {
    $debuglayout++;
    use Data::Dumper;
    $f = shift || die $notes;
}

if ( $f =~ /^-dc$/ ) {
    $debuglayout++;
    $debugcursor++;
    use Data::Dumper;
    $f = shift || die $notes;
}

if ( $f =~ /^-df$/ ) {
    $debugfields = shift || die $notes;
    $f = shift || die $notes;
}

my $error;
my $warn;
my $notice;

require "$gap/etc/perl/ga_layout.pm";

my $json = get_file_json( $f );

$layout = decode_json( $extra_subs{ '__layout__' } );

my $js = JSON->new;

print $js->pretty->encode( $layout ) . "\n";

print STDERR '-'x60 . "\nNotices:\n$notice" . '-'x60 . "\n"  if $notice;
print STDERR '-'x60 . "\nWarnings:\n$warn" . '-'x60 . "\n"   if $warn;
print STDERR '-'x60 . "\nErrors:\n$error" . '-'x60 . "\n"    if $error;
