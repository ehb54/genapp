package GenAppTest;

use strict;
use warnings;

use Exporter 'import';
use Cwd qw(getcwd);
use File::Copy qw(copy);
use File::Find;
use File::Path qw(make_path);
use File::Spec;

our @EXPORT_OK = qw(copy_tree read_file run_command);

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

    chdir $cwd or die "chdir '$cwd' failed: $!";
    my $quoted = join q{ }, map { _shell_quote($_) } @{$cmd};
    my $output = qx{$quoted 2>&1};
    my $status = $? >> 8;
    chdir $old_cwd or die "chdir '$old_cwd' failed: $!";

    return ( $status, $output, $quoted );
}

sub _shell_quote {
    my ($value) = @_;
    return "''" if !defined $value || $value eq q{};

    $value =~ s/'/'"'"'/g;
    return "'$value'";
}

1;
