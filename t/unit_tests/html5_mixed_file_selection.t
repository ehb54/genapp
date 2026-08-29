use strict;
use warnings;

use File::Spec;
use File::Temp qw(tempdir);
use FindBin;
use JSON::PP qw(decode_json encode_json);
use MIME::Base64 qw(encode_base64);
use Test::More;

my $repo_root = File::Spec->rel2abs(
    File::Spec->catdir( $FindBin::Bin, File::Spec->updir, File::Spec->updir )
);
my $base_path = File::Spec->catfile( $repo_root, qw(languages html5 base.php) );
open my $base_handle, '<', $base_path or die "could not read $base_path: $!";
my $base_source = do { local $/; <$base_handle> };
close $base_handle;

my ($normalizer) = $base_source =~ m{
    //\ BEGIN\ GENAPP\ SERVER\ FILE\ NORMALIZATION\R
    (.*?)
    //\ END\ GENAPP\ SERVER\ FILE\ NORMALIZATION
}sx;

ok( defined $normalizer, 'server-file normalization block is marked for focused testing' );
like( $normalizer, qr/if \( !sizeof\( \$_FILES \) \).*?else \{/s,
    'normalizer preserves the legacy empty-upload branch and adds a mixed branch' );
like( $normalizer, qr/!array_key_exists\( \$tmp_key, \$_FILES \)/,
    'mixed normalization never replaces a real local upload' );
like( $normalizer, qr/isset\( \$_REQUEST\[ \$v \] \).*?is_array.*?count.*?== 1/s,
    'mixed normalization requires one complete server selection' );

my $php = qx{command -v php 2>/dev/null};
chomp $php;

SKIP: {
    skip 'php is not available on PATH; runtime behavior matrix is deferred', 10
        if !$php || !defined $normalizer;

    my $temporary_directory = tempdir( CLEANUP => 1 );
    my $script_path = File::Spec->catfile( $temporary_directory, 'normalize.php' );
    my $runtime_normalizer = $normalizer;
    $runtime_normalizer =~ s/^\s*error_log\(.*?;\R//mg;
    open my $script_handle, '>', $script_path or die "could not write $script_path: $!";
    print {$script_handle} "<?php\n";
    print {$script_handle} '$_REQUEST = json_decode(base64_decode($argv[1]), true);', "\n";
    print {$script_handle} '$_FILES = json_decode(base64_decode($argv[2]), true);', "\n";
    print {$script_handle} $runtime_normalizer, "\n";
    print {$script_handle} 'echo json_encode(array("request" => $_REQUEST, "files" => $_FILES));', "\n";
    close $script_handle;

    my $no_file = { name => '', type => '', tmp_name => '', error => 4, size => 0 };
    my $local_file = {
        name => 'local.dat', type => 'text/plain', tmp_name => '/tmp/local.dat',
        error => 0, size => 12,
    };
    my @cases = (
        [ 'empty request', {}, {}, [] ],
        [ 'local file only', {}, { local_file => $local_file }, { local_file => $local_file } ],
        [ 'server file only',
            { _selaltval_server_file => 'server_file_altval', server_file_altval => ['Li4uL3NlcnMvc2FzY2FsYy5oNQ=='] },
            {}, { server_file => $no_file } ],
        [ 'legacy incomplete server marker',
            { _selaltval_server_file => 'missing_altval' },
            {}, { server_file => $no_file } ],
        [ 'local file wins for the same field',
            { _selaltval_data_file => 'data_file_altval', data_file_altval => ['Li9zZXJ2ZXIuZGF0'] },
            { data_file => $local_file }, { data_file => $local_file } ],
        [ 'mixed local and distinct server files',
            { _selaltval_server_file => 'server_file_altval', server_file_altval => ['Li9zZXJ2ZXIuaDU='] },
            { local_file => $local_file }, { local_file => $local_file, server_file => $no_file } ],
        [ 'mixed incomplete marker is ignored',
            { _selaltval_server_file => 'missing_altval' },
            { local_file => $local_file }, { local_file => $local_file } ],
        [ 'mixed multi-value server selection is ignored',
            { _selaltval_server_file => 'server_file_altval', server_file_altval => ['one', 'two'] },
            { local_file => $local_file }, { local_file => $local_file } ],
        [ 'repeated rows preserve local and add server row',
            { '_selaltval_row_count-data_file-1' => 'row_count-data_file-1_altval',
              'row_count-data_file-1_altval' => ['Li9yb3cxLmRhdA=='] },
            { 'row_count-data_file-0' => $local_file },
            { 'row_count-data_file-0' => $local_file, 'row_count-data_file-1' => $no_file } ],
        [ 'unrelated decoded path is untouched',
            { _decodepath_output_path => 'output_path' },
            { local_file => $local_file }, { local_file => $local_file } ],
    );

    for my $case (@cases) {
        my ( $label, $request, $files, $expected_files ) = @{$case};
        my @command = (
            $php, $script_path,
            encode_base64( encode_json($request), '' ),
            encode_base64( encode_json($files), '' ),
        );
        open my $runtime_handle, '-|', @command
            or die "could not run PHP normalizer for $label: $!";
        my $runtime_output = do { local $/; <$runtime_handle> };
        close $runtime_handle;
        my $exit_status = $? >> 8;
        my $payload = $exit_status == 0 ? eval { decode_json($runtime_output) } : undef;
        is_deeply(
            $payload && $payload->{files},
            $expected_files,
            $label,
        ) or diag "PHP exit=$exit_status output=$runtime_output";
    }
}

done_testing();
