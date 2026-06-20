use strict;
use warnings;

use File::Path qw(make_path);
use File::Spec;
use File::Temp qw(tempdir);
use FindBin;
use Test::More;

use lib File::Spec->catdir( $FindBin::Bin, '..', 'lib' );
use GenAppTest qw(read_file repo_root run_command);

my $repo_root = repo_root( File::Spec->catdir( $FindBin::Bin, '..' ) );
my %env       = ( GENAPP => $repo_root );

{
    my $app = _make_app();
    _write( File::Spec->catfile( $app, 'commented.json' ), "# comment line\n{\"ok\":true}\n" );
    my ( $status, $output ) = run_command(
        cwd => $app,
        env => \%env,
        cmd => [ File::Spec->catfile( $repo_root, qw(bin check_json.pl) ), 'commented.json' ],
    );
    is( $status, 0, 'check_json accepts full-line comments before JSON' )
        or diag($output);
}

{
    my $app = _make_app();
    _write( File::Spec->catfile( $app, 'broken.json' ), "{ \"bad\": true,\n" );
    my ( $status, $output ) = run_command(
        cwd => $app,
        env => \%env,
        cmd => [ File::Spec->catfile( $repo_root, qw(bin check_json.pl) ), 'broken.json' ],
    );
    isnt( $status, 0, 'check_json rejects malformed JSON' );
    like( $output, qr/error|malformed|unexpected|JSON/i, 'malformed JSON failure is diagnostic' );
}

_invalid_app(
    'missing menu module JSON is rejected',
    menu_modules => [ 'ghost_module' ],
    modules      => {},
    pattern      => qr/ghost_module|module/i,
);

_invalid_app(
    'moduleid/file mismatch is rejected',
    menu_modules => [ 'declared_as_other' ],
    modules      => {
        declared_as_other => _module_json( moduleid => 'actual_id' ),
    },
    pattern => qr/declared_as_other|actual_id|moduleid/i,
);

_invalid_app(
    'duplicate menu module ids are rejected',
    menu_modules => [ 'dup_mod', 'dup_mod' ],
    modules      => {
        dup_mod => _module_json(),
    },
    pattern => qr/duplicate|dup_mod/i,
);

_invalid_app(
    'bad repeat parent is rejected',
    menu_modules => [ 'bad_repeat' ],
    modules      => {
        bad_repeat => _module_json(
            fields => [
                _text_field('child', repeat => 'missing_parent'),
            ],
        ),
    },
    pattern => qr/missing_parent|repeat/i,
);

_invalid_app(
    'bad option-qualified repeat choice is rejected',
    menu_modules => [ 'bad_option_repeat' ],
    modules      => {
        bad_option_repeat => _module_json(
            fields => [
                {
                    role     => 'input',
                    id       => 'mode',
                    label    => 'Mode',
                    type     => 'listbox',
                    values   => 'One~one~Two~two',
                    default  => 'one',
                    repeater => 'true',
                },
                _text_field( 'child', repeat => 'mode:missing' ),
            ],
        ),
    },
    pattern => qr/missing|choice|repeat/i,
);

_invalid_app(
    'listbox without values is rejected',
    menu_modules => [ 'bad_listbox' ],
    modules      => {
        bad_listbox => _module_json(
            fields => [
                {
                    role  => 'input',
                    id    => 'mode',
                    label => 'Mode',
                    type  => 'listbox',
                },
            ],
        ),
    },
    pattern => qr/listbox|values/i,
);

_invalid_app(
    'unknown field type without templates is rejected',
    menu_modules => [ 'bad_type' ],
    modules      => {
        bad_type => _module_json(
            fields => [
                {
                    role  => 'input',
                    id    => 'mystery',
                    label => 'Mystery',
                    type  => 'definitely_missing_type',
                },
            ],
        ),
    },
    pattern => qr/definitely_missing_type|types/i,
);

done_testing();

sub _invalid_app {
    my ( $name, %args ) = @_;
    my $app = _make_app( menu_modules => $args{menu_modules}, modules => $args{modules} );
    my ( $status, $output ) = run_command(
        cwd => $app,
        env => \%env,
        cmd => [ File::Spec->catfile( $repo_root, qw(bin genapp_check.pl) ) ],
    );
    isnt( $status, 0, $name );
    like( $output, $args{pattern}, "$name reports useful context" );
}

sub _make_app {
    my (%args) = @_;
    my $root = tempdir( CLEANUP => 1 );
    my $app  = File::Spec->catdir( $root, 'negative_contract' );
    make_path( File::Spec->catdir( $app, 'modules' ), File::Spec->catdir( $app, 'bin' ) );

    _write(
        File::Spec->catfile( $app, 'directives.json' ),
        qq({\n  "title": "Negative Contract",\n  "application": "negative_contract",\n  "version": "0.01",\n  "languages": [ "html5" ]\n}\n)
    );

    my @menu_modules = @{ $args{menu_modules} || ['valid_mod'] };
    my $module_items = join ",\n", map { qq(        { "id": "$_", "label": "$_" }) } @menu_modules;
    _write(
        File::Spec->catfile( $app, 'menu.json' ),
        qq({\n  "menu": [\n    {\n      "id": "demo",\n      "label": "Demo",\n      "modules": [\n$module_items\n      ]\n    }\n  ]\n}\n)
    );

    my %modules = %{ $args{modules} || { valid_mod => _module_json() } };
    for my $file ( keys %modules ) {
        _write( File::Spec->catfile( $app, 'modules', "$file.json" ), $modules{$file} );
        _write( File::Spec->catfile( $app, 'bin', $file ), "#!/usr/bin/env perl\nprint qq({}\\n);\n" );
        chmod 0755, File::Spec->catfile( $app, 'bin', $file );
    }

    return $app;
}

sub _module_json {
    my (%args) = @_;
    my $moduleid = $args{moduleid} || 'valid_mod';
    my $fields   = $args{fields} || [ _text_field('message') ];
    my $fields_json = join ",\n", map { _field_json($_) } @{$fields};
    return qq({\n  "moduleid": "$moduleid",\n  "label": "$moduleid",\n  "executable": "$moduleid",\n  "fields": [\n$fields_json\n  ]\n}\n);
}

sub _text_field {
    my ( $id, %extra ) = @_;
    return {
        role    => 'input',
        id      => $id,
        label   => $id,
        type    => 'text',
        default => 'value',
        %extra,
    };
}

sub _field_json {
    my ($field) = @_;
    my @pairs;
    for my $key ( sort keys %{$field} ) {
        push @pairs, qq(      "$key": "$field->{$key}");
    }
    return "{\n" . join( ",\n", @pairs ) . "\n    }";
}

sub _write {
    my ( $path, $content ) = @_;
    open my $fh, '>', $path or die "open '$path' failed: $!";
    print {$fh} $content;
    close $fh;
}
