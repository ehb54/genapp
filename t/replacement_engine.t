use strict;
use warnings;

use Cwd qw(abs_path);
use File::Spec;
use FindBin;
use JSON qw(decode_json);
use Test::More;

use lib File::Spec->catdir( $FindBin::Bin, 'lib' );
use GenAppTest qw(read_file repo_root);

my $repo_root = repo_root($FindBin::Bin);
local $ENV{GENAPP} = $repo_root;

require File::Spec->catfile( $repo_root, 'etc', 'perl', 'genapp_util.pl' );

my $tokens = get_replacements(
    [
        '__alpha__ plain text __beta__',
        '__alpha__ repeated __menu:modules:id__',
        '__gamma____beta__',
    ]
);
is_deeply(
    $tokens,
    [qw(alpha beta menu:modules:id gamma)],
    'get_replacements returns unique replacement tokens in encounter order'
);

my $cond = get_cond_replacements(
    [
        '__~fields:help{<span>__fields:help__</span>}',
        '__!debug:job{quiet path}',
        '__~nested{{"a":{"b":1}}}',
    ]
);
is( $cond->{'fields:help'}, '<span>__fields:help__</span>', 'positive conditional replacement body is captured' );
is( $cond->{'!debug:job'},  'quiet path',                    'negative conditional replacement body is captured' );
is( $cond->{nested},        '{"a":{"b":1}}',                 'nested brace conditional body is captured' );

my $json_file = File::Spec->catfile( $repo_root, 't', 'fixtures', 'json_flatten', 'menu_modules.json' );
my $json      = decode_json( read_file($json_file) );
my %iter;
my $row = start_json( $json, \%iter );

is( $row->{'menu:id'},            'm1',    'start_json begins at first menu id' );
is( $row->{'menu:modules:id'},    'alpha', 'start_json begins at first module id' );
is( $row->{'menu:modules:label'}, 'Alpha', 'start_json includes sibling module values' );

$row = next_json( \%iter, 'menu:modules:id' );
is( $row->{'menu:id'},         'm1',   'next_json preserves current parent while module changes' );
is( $row->{'menu:modules:id'}, 'beta', 'next_json advances to second module' );

$row = next_json( \%iter, 'menu:modules:id' );
is( $row->{'menu:id'},         'm2',    'next_json advances parent when child sequence is exhausted' );
is( $row->{'menu:modules:id'}, 'gamma', 'next_json reaches third module' );

$row = rewind_json( \%iter );
is( $row->{'menu:modules:id'}, 'alpha', 'rewind_json returns to first flattened row' );

done_testing();
