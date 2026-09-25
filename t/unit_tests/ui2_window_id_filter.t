use strict;
use warnings;

use File::Spec;
use FindBin;
use JSON::PP qw(decode_json);
use Test::More;

my $repo_root = File::Spec->catdir( $FindBin::Bin, '..', '..' );
my $filter_path = File::Spec->catfile( $repo_root, qw(languages html5 sys ga_filter_type.json) );

open my $filter_fh, '<', $filter_path or die "cannot read $filter_path: $!";
local $/;
my $filter = decode_json(<$filter_fh>);
close $filter_fh;

my ($window_field) = grep { ($_->{id} // '') eq '_window' } @{ $filter->{fields} || [] };
ok( $window_field, 'global request filter declares the UI window field' );

my $pattern = qr/$window_field->{pattern}/;
like( '123e4567-e89b-12d3-a456-426614174000', $pattern, 'window filter accepts UUID identifiers' );
like( 'ui2-1790346540395-1d318125a6fb18', $pattern, 'window filter accepts the bounded legacy UI2 identifier' );
unlike( 'ui2-returned-window', $pattern, 'window filter rejects an unstructured UI2 identifier' );
unlike( '../unsafe/window', $pattern, 'window filter rejects unsafe path characters' );
unlike( 'ui2-1790346540395-' . ('a' x 80), $pattern, 'window filter rejects oversized legacy identifiers' );

done_testing();
