use strict;
use warnings;

use File::Spec;
use FindBin;
use Test::More;

my $php = find_executable('php');
plan skip_all => 'php is not available on PATH; backend execution contract tests are deferred' if !$php;

pass('php is available for future backend contract checks');
done_testing();

sub find_executable {
    my ($name) = @_;
    for my $dir ( split /:/, $ENV{PATH} || q{} ) {
        my $path = File::Spec->catfile( $dir, $name );
        return $path if -x $path;
    }
    return;
}
