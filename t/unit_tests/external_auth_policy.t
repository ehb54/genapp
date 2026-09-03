use strict;
use warnings;

use File::Spec;
use FindBin;
use Test::More;

use lib File::Spec->catdir( $FindBin::Bin, '..', 'lib' );
use GenAppTest qw(generate_fixture_app read_file repo_root);

my $repo_root = repo_root( File::Spec->catdir( $FindBin::Bin, '..' ) );
my $generated = generate_fixture_app(
    repo_root    => $repo_root,
    fixture_name => 'minimal_html5',
    test_dir     => File::Spec->catdir( $FindBin::Bin, '..' ),
);

is( $generated->{status}, 0, 'non-opted-in HTML5 fixture generates successfully' )
    or diag("command failed ($generated->{status}): $generated->{quoted}\n$generated->{output}");

my $handlers = File::Spec->catdir(
    $generated->{app_dir}, qw(output html5 ajax sys_config)
);
for my $name (qw(sys_login.php sys_register.php sys_user_config.php)) {
    my $source = read_file( File::Spec->catfile( $handlers, $name ) );
    unlike(
        $source,
        qr/ga_external_auth_enforce/,
        "$name retains legacy behavior when external_auth_policy is absent",
    );
}

done_testing();
