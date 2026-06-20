package GenAppTest;

use strict;
use warnings;

use Exporter 'import';
use Cwd qw(abs_path getcwd);
use File::Copy qw(copy);
use File::Find;
use File::Path qw(make_path);
use File::Spec;
use File::Temp qw(tempdir);

our @EXPORT_OK = qw(assert_command copy_tree generate_fixture_app read_file repo_root run_command);

sub repo_root {
    my ($test_dir) = @_;
    $test_dir ||= File::Spec->catdir( getcwd(), 't' );
    return abs_path( File::Spec->catdir( $test_dir, '..' ) );
}

sub generate_fixture_app {
    my (%args) = @_;

    my $repo_root    = $args{repo_root} || die "generate_fixture_app requires repo_root\n";
    my $fixture_name = $args{fixture_name} || die "generate_fixture_app requires fixture_name\n";
    my $test_dir     = $args{test_dir} || File::Spec->catdir( $repo_root, 't' );
    my $genapp_args  = $args{genapp_args} || [];

    my $fixture_root = File::Spec->catdir( $repo_root, 't', 'fixtures', 'apps', $fixture_name );
    die "fixture app directory '$fixture_root' does not exist\n" if !-d $fixture_root;

    my $temp_root = tempdir( CLEANUP => 1 );
    my $app_dir   = File::Spec->catdir( $temp_root, $fixture_name );

    copy_tree( $fixture_root, $app_dir );

    my %env = ( GENAPP => $repo_root );
    my @cmd = ( File::Spec->catfile( $repo_root, 'bin', 'genapp' ), @{$genapp_args} );
    my $ga_min_path   = File::Spec->catfile( $repo_root, 'languages', 'html5', 'add', 'js', 'ga.min.js' );
    my $ga_min_before = -f $ga_min_path ? read_file($ga_min_path) : undef;

    my ( $status, $output, $quoted ) = run_command(
        cwd => $app_dir,
        env => \%env,
        cmd => \@cmd,
    );

    my $restored_side_effect = 0;
    if ( defined $ga_min_before && -f $ga_min_path ) {
        my $ga_min_after = read_file($ga_min_path);
        if ( $ga_min_after ne $ga_min_before ) {
            open my $fh, '>', $ga_min_path or die "restore '$ga_min_path' failed: $!";
            print {$fh} $ga_min_before;
            close $fh;
            $restored_side_effect = 1;
        }
    }

    return {
        app_dir      => $app_dir,
        fixture_root => $fixture_root,
        output       => $output,
        quoted       => $quoted,
        repo_root    => $repo_root,
        restored_side_effect => $restored_side_effect,
        status       => $status,
        temp_root    => $temp_root,
        test_dir     => $test_dir,
    };
}

sub assert_command {
    my ( $name, %args ) = @_;
    my ( $status, $output, $quoted ) = run_command(%args);

    Test::More::ok( $status == 0, $name )
        or Test::More::diag("command failed ($status): $quoted\n$output");

    return ( $status, $output, $quoted );
}

sub copy_tree {
    my ( $src, $dst ) = @_;

    die "copy_tree requires source and destination\n" if !defined $src || !defined $dst;
    die "copy_tree source '$src' is not a directory\n" if !-d $src;

    find(
        {
            no_chdir => 1,
            wanted   => sub {
                my $path = $File::Find::name;
                return if $path eq $src;

                my $rel  = File::Spec->abs2rel( $path, $src );
                my $dest = File::Spec->catfile( $dst, $rel );

                if ( -d $path ) {
                    make_path( $dest );
                    return;
                }

                my ( $vol, $dir ) = File::Spec->splitpath( $dest );
                make_path( File::Spec->catpath( $vol, $dir, q{} ) );
                copy( $path, $dest ) or die "copy '$path' -> '$dest' failed: $!";
                chmod( ( stat($path) )[2] & 07777, $dest );
            },
        },
        $src
    );
}

sub read_file {
    my ($path) = @_;
    open my $fh, '<', $path or die "open '$path' failed: $!";
    local $/;
    my $content = <$fh>;
    close $fh;
    return $content;
}

sub run_command {
    my (%args) = @_;

    my $cmd = $args{cmd} || die "run_command requires cmd\n";
    my $cwd = $args{cwd} || die "run_command requires cwd\n";
    my $env = $args{env} || {};

    my $old_cwd = getcwd();
    local %ENV = ( %ENV, %{$env} );

    my $ga_min_path;
    my $ga_min_before;
    if ( $env->{GENAPP} ) {
        $ga_min_path = File::Spec->catfile( $env->{GENAPP}, 'languages', 'html5', 'add', 'js', 'ga.min.js' );
        $ga_min_before = -f $ga_min_path ? read_file($ga_min_path) : undef;
    }

    chdir $cwd or die "chdir '$cwd' failed: $!";
    my $quoted = join q{ }, map { _shell_quote($_) } @{$cmd};
    my $output = qx{$quoted 2>&1};
    my $status = $? >> 8;
    chdir $old_cwd or die "chdir '$old_cwd' failed: $!";

    if ( defined $ga_min_before && -f $ga_min_path ) {
        my $ga_min_after = read_file($ga_min_path);
        if ( $ga_min_after ne $ga_min_before ) {
            open my $fh, '>', $ga_min_path or die "restore '$ga_min_path' failed: $!";
            print {$fh} $ga_min_before;
            close $fh;
        }
    }

    return ( $status, $output, $quoted );
}

sub _shell_quote {
    my ($value) = @_;
    return "''" if !defined $value || $value eq q{};

    $value =~ s/'/'"'"'/g;
    return "'$value'";
}

1;
