use strict;
use warnings;

use File::Spec;
use File::Temp qw(tempdir);
use FindBin;
use Test::More;

use lib File::Spec->catdir( $FindBin::Bin, '..', 'lib' );
use GenAppTest qw(read_file repo_root run_command);

# genapp.pl runs the designer's builder (etc/perl/dd_make_ga_fdb.pl) for an application whose directives set
# "designer": it writes ga_fdb_t.js, the html5 types and their attributes, and ga_fdb_d.js, a definition of each of
# those attributes from dd_make_ga_fdb_d.pl's list. An attribute missing from that list stops the generation of the
# whole application. The 2026 dynamic output and UI2 work added six attributes without definitions, so no
# application with the designer generated until they were added.

plan skip_all => 'perl JSON and Hash::Merge are required, as for genapp.pl'
    unless eval { require JSON; require Hash::Merge; 1 };

my $root = repo_root( File::Spec->catdir( $FindBin::Bin, '..' ) );
my $out  = tempdir( CLEANUP => 1 );
my ( $status, $output, $quoted ) = run_command(
    cmd => [ 'perl', File::Spec->catfile( $root, qw(etc perl dd_make_ga_fdb.pl) ), $out ],
    cwd => $out,
    env => { GENAPP => $root },
);
is( $status, 0, 'the designer builder writes its files' ) or diag("$quoted\n$output");
unlike( $output, qr/missing definition for attribute/, 'every attribute of the html5 types has a designer definition' )
    or diag($output);

sub assigned {
    my ( $name, $var ) = @_;
    my $text = read_file( File::Spec->catfile( $out, $name ) );
    $text =~ s/\A\s*\Q$var\E\s*=\s*//;
    $text =~ s/;\s*\z//;
    return length $text ? JSON::decode_json($text) : {};
}

my $types = assigned( 'ga_fdb_t.js', 'ga.fdb.t' );
my $defs  = assigned( 'ga_fdb_d.js', 'ga.fdb.d' );
my %used;
for my $type ( values %{$types} ) {
    for my $role (qw(input output)) {
        $used{$_}++ for @{ $type->{$role}{attrib} || [] };
    }
}
cmp_ok( scalar keys %used, '>', 50, 'ga_fdb_t.js lists the attributes of the html5 types' );
is_deeply( [ grep { !$defs->{$_} } sort keys %used ], [], 'ga_fdb_d.js defines each of them' );
is( $defs->{disabled}{type},  'checkbox', 'disabled is a checkbox in the designer' );
is( $defs->{maxvalue}{type},  'float',    'maxvalue is a number in the designer' );
is( $defs->{actiondata}{type}, 'text',    'actiondata is text in the designer' );

done_testing;
