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
    'duplicate field ids are rejected',
    menu_modules => [ 'dup_fields' ],
    modules      => {
        dup_fields => _module_json(
            moduleid => 'dup_fields',
            fields   => [
                _text_field('same_id'),
                _text_field('same_id'),
            ],
        ),
    },
    pattern => qr/duplicate|same_id/i,
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
    'checkbox false-qualified repeat is rejected',
    menu_modules => [ 'bad_checkbox_false_repeat' ],
    modules      => {
        bad_checkbox_false_repeat => _module_json(
            fields => [
                {
                    role     => 'input',
                    id       => 'gate',
                    label    => 'Gate',
                    type     => 'checkbox',
                    checked  => 'false',
                    repeater => 'true',
                },
                _text_field( 'child', repeat => 'gate:false' ),
            ],
        ),
    },
    pattern => qr/gate:false|repeat/i,
);

_invalid_app(
    'unknown compound repeat dependency is rejected',
    menu_modules => [ 'bad_repeat_condition_unknown' ],
    modules      => {
        bad_repeat_condition_unknown => _module_json(
            fields => [
                {
                    role     => 'input',
                    id       => 'gate',
                    label    => 'Gate',
                    type     => 'checkbox',
                    checked  => 'false',
                },
                _text_field( 'child', repeat => 'gate && missing_gate' ),
            ],
        ),
    },
    pattern => qr/missing_gate|repeat condition/i,
);

_invalid_app(
    'malformed compound repeat condition is rejected',
    menu_modules => [ 'bad_repeat_condition_syntax' ],
    modules      => {
        bad_repeat_condition_syntax => _module_json(
            fields => [
                {
                    role     => 'input',
                    id       => 'gate',
                    label    => 'Gate',
                    type     => 'checkbox',
                    checked  => 'false',
                },
                _text_field( 'child', repeat => 'gate &&' ),
            ],
        ),
    },
    pattern => qr/invalid syntax|repeat condition/i,
);

_invalid_app(
    'bare non-checkbox repeat condition atom is rejected',
    menu_modules => [ 'bad_repeat_condition_bare_text' ],
    modules      => {
        bad_repeat_condition_bare_text => _module_json(
            fields => [
                _text_field('mode'),
                _text_field( 'child', repeat => '!mode' ),
            ],
        ),
    },
    pattern => qr/bare non-checkbox|repeat condition/i,
);

_invalid_app(
    'checkbox false atom inside repeat condition is rejected',
    menu_modules => [ 'bad_repeat_condition_checkbox_false' ],
    modules      => {
        bad_repeat_condition_checkbox_false => _module_json(
            fields => [
                {
                    role     => 'input',
                    id       => 'gate',
                    label    => 'Gate',
                    type     => 'checkbox',
                    checked  => 'false',
                },
                _text_field( 'child', repeat => 'gate:false && gate' ),
            ],
        ),
    },
    pattern => qr/unsupported choice 'false'|repeat condition/i,
);

_valid_app(
    'row-local repeatcondition on a shared integer repeater is accepted',
    menu_modules => [ 'row_condition' ],
    modules      => {
        row_condition => _module_json(
            moduleid => 'row_condition',
            fields   => [
                {
                    role     => 'input',
                    id       => 'row_count',
                    label    => 'Rows',
                    type     => 'integer',
                    default  => '1',
                    repeater => 'true',
                },
                {
                    role    => 'input',
                    id      => 'source_kind',
                    label   => 'Source kind',
                    type    => 'listbox',
                    values  => 'Prepared~prepared~Raw~raw',
                    default => 'prepared',
                    repeat  => 'row_count',
                },
                _text_field( 'prepared_file', repeat => 'row_count', repeatcondition => 'source_kind:prepared' ),
            ],
        ),
    },
);

_invalid_app(
    'repeatcondition requires a structural repeat controller',
    menu_modules => [ 'bad_repeatcondition_parent' ],
    modules      => {
        bad_repeatcondition_parent => _module_json(
            fields => [
                _text_field( 'child', repeatcondition => 'mode:one' ),
            ],
        ),
    },
    pattern => qr/repeatcondition.*repeat controller/i,
);

_invalid_app(
    'repeatcondition dependency must share the row controller',
    menu_modules => [ 'bad_repeatcondition_scope' ],
    modules      => {
        bad_repeatcondition_scope => _module_json(
            fields => [
                {
                    role     => 'input',
                    id       => 'row_count',
                    label    => 'Rows',
                    type     => 'integer',
                    default  => '1',
                    repeater => 'true',
                },
                {
                    role     => 'input',
                    id       => 'other_count',
                    label    => 'Other rows',
                    type     => 'integer',
                    default  => '1',
                    repeater => 'true',
                },
                {
                    role    => 'input',
                    id      => 'source_kind',
                    label   => 'Source kind',
                    type    => 'listbox',
                    values  => 'Prepared~prepared~Raw~raw',
                    default => 'prepared',
                    repeat  => 'other_count',
                },
                _text_field( 'child', repeat => 'row_count', repeatcondition => 'source_kind:prepared' ),
            ],
        ),
    },
    pattern => qr/repeatcondition.*must repeat on 'row_count'/i,
);

_invalid_app(
    'repeatcondition validates listbox choices',
    menu_modules => [ 'bad_repeatcondition_choice' ],
    modules      => {
        bad_repeatcondition_choice => _module_json(
            fields => [
                {
                    role     => 'input',
                    id       => 'row_count',
                    label    => 'Rows',
                    type     => 'integer',
                    default  => '1',
                    repeater => 'true',
                },
                {
                    role    => 'input',
                    id      => 'source_kind',
                    label   => 'Source kind',
                    type    => 'listbox',
                    values  => 'Prepared~prepared~Raw~raw',
                    default => 'prepared',
                    repeat  => 'row_count',
                },
                _text_field( 'child', repeat => 'row_count', repeatcondition => 'source_kind:missing' ),
            ],
        ),
    },
    pattern => qr/repeatcondition.*missing listbox choice/i,
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

_invalid_app(
    'dynamic output requires role output',
    menu_modules => [ 'bad_dynamic_role' ],
    modules      => {
        bad_dynamic_role => _module_json(
            moduleid => 'bad_dynamic_role',
            fields   => [
                _text_field( 'dyn_in', dynamicoutput => 'true', idprefix => 'dyn_in', max => '2' ),
            ],
        ),
    },
    pattern => qr/dynamicoutput|role output/i,
);

_invalid_app(
    'dynamic output requires supported type',
    menu_modules => [ 'bad_dynamic_type' ],
    modules      => {
        bad_dynamic_type => _module_json(
            moduleid => 'bad_dynamic_type',
            fields   => [
                _output_field( 'dyn_button', type => 'button', dynamicoutput => 'true', idprefix => 'dyn_button', max => '2' ),
            ],
        ),
    },
    pattern => qr/dynamicoutput|button|not supported/i,
);

_invalid_app(
    'dynamic output requires max',
    menu_modules => [ 'bad_dynamic_max' ],
    modules      => {
        bad_dynamic_max => _module_json(
            moduleid => 'bad_dynamic_max',
            fields   => [
                _output_field( 'dyn_html', type => 'html', dynamicoutput => 'true', idprefix => 'dyn_html' ),
            ],
        ),
    },
    pattern => qr/dynamicoutput|positive integer max/i,
);

_invalid_app(
    'dynamic output requires idprefix',
    menu_modules => [ 'bad_dynamic_missing_prefix' ],
    modules      => {
        bad_dynamic_missing_prefix => _module_json(
            moduleid => 'bad_dynamic_missing_prefix',
            fields   => [
                _output_field( 'dyn_html', type => 'html', dynamicoutput => 'true', max => '2' ),
            ],
        ),
    },
    pattern => qr/dynamicoutput|idprefix/i,
);

_invalid_app(
    'dynamic output requires safe idprefix',
    menu_modules => [ 'bad_dynamic_prefix' ],
    modules      => {
        bad_dynamic_prefix => _module_json(
            moduleid => 'bad_dynamic_prefix',
            fields   => [
                _output_field( 'dyn_html', type => 'html', dynamicoutput => 'true', idprefix => '../bad', max => '2' ),
            ],
        ),
    },
    pattern => qr/idprefix|invalid name/i,
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

sub _valid_app {
    my ( $name, %args ) = @_;
    my $app = _make_app( menu_modules => $args{menu_modules}, modules => $args{modules} );
    my ( $status, $output ) = run_command(
        cwd => $app,
        env => \%env,
        cmd => [ File::Spec->catfile( $repo_root, qw(bin genapp_check.pl) ) ],
    );
    is( $status, 0, $name ) or diag($output);
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

sub _output_field {
    my ( $id, %extra ) = @_;
    return {
        role  => 'output',
        id    => $id,
        label => $id,
        type  => 'html',
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
