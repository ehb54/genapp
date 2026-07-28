#!/usr/bin/env perl

use strict;
use warnings;

use File::Basename qw(basename);
use File::Spec;
use JSON::PP qw(decode_json);

my $app_dir = shift @ARGV;
$app_dir = File::Spec->catdir('..', 'genapp_zazzie')
    unless defined $app_dir && length $app_dir;

my $registry_file = File::Spec->catfile(
    $app_dir, 'plotting_migration.json');
my $modules_dir = File::Spec->catdir($app_dir, 'modules');

my @errors;
my @plot_modules;

sub read_text {
    my ($path) = @_;
    open my $handle, '<', $path
        or die "cannot read $path: $!\n";
    local $/;
    my $text = <$handle>;
    close $handle;
    return $text;
}

sub snake_case {
    my ($value) = @_;
    return defined $value && $value =~ /\A[a-z][a-z0-9]*(?:_[a-z0-9]+)*\z/;
}

sub collect_plot_specs {
    my ($text, $path) = @_;
    my @specs;
    while ($text =~ /"plot_spec"\s*:\s*\{/g) {
        my $start = pos($text) - 1;
        my $depth = 0;
        my $quoted = 0;
        my $escaped = 0;
        my $end;
        for (my $index = $start; $index < length($text); $index++) {
            my $character = substr($text, $index, 1);
            if ($quoted) {
                if ($escaped) {
                    $escaped = 0;
                } elsif ($character eq '\\') {
                    $escaped = 1;
                } elsif ($character eq '"') {
                    $quoted = 0;
                }
                next;
            }
            if ($character eq '"') {
                $quoted = 1;
            } elsif ($character eq '{') {
                $depth++;
            } elsif ($character eq '}') {
                $depth--;
                if ($depth == 0) {
                    $end = $index;
                    last;
                }
            }
        }
        if (!defined $end) {
            push @errors, "$path contains an unterminated plot_spec";
            last;
        }
        my $json = substr($text, $start, $end - $start + 1);
        my $spec = eval { decode_json($json) };
        if ($@) {
            push @errors, "$path contains an invalid plot_spec: $@";
        } else {
            push @specs, $spec;
        }
        pos($text) = $end + 1;
    }
    return @specs;
}

my %forbidden_keys = map { $_ => 1 } qw(
    color colors config data domain font height hoverinfo hovertemplate
    layout line margin marker mode modebarbuttons modebarbuttonstoadd
    modebarbuttonstoremove plotly traces width xaxis yaxis
);

sub inspect_spec {
    my ($value, $path, $location) = @_;
    if (ref $value eq 'HASH') {
        for my $key (sort keys %{$value}) {
            my $normalized = lc $key;
            $normalized =~ s/[^a-z0-9]//g;
            if ($forbidden_keys{$normalized}
                    || $normalized =~ /\A[xy]axis\d+\z/
                    || $normalized =~ /plotly/) {
                push @errors,
                    "$path accepted plot_spec contains prohibited key "
                    . "$location.$key";
            }
            if ($normalized eq 'type'
                    && defined $value->{$key}
                    && !ref $value->{$key}
                    && $value->{$key} =~ /\A(?:bar|scatter|scatter3d)\z/i) {
                push @errors,
                    "$path accepted plot_spec contains renderer type "
                    . "$location.$key=$value->{$key}";
            }
            inspect_spec($value->{$key}, $path, "$location.$key");
        }
    } elsif (ref $value eq 'ARRAY') {
        for my $index (0 .. $#{$value}) {
            inspect_spec($value->[$index], $path, "$location\[$index\]");
        }
    }
}

die "missing plotting registry $registry_file\n"
    unless -f $registry_file;
die "missing module directory $modules_dir\n"
    unless -d $modules_dir;

my $registry = eval { decode_json(read_text($registry_file)) };
die "invalid plotting registry $registry_file: $@\n" if $@;

push @errors, 'plotting registry schema_version must be 1'
    unless ($registry->{schema_version} // 0) == 1;
push @errors, 'plotting registry must govern ehb54/zazzie issue 193'
    unless ($registry->{governing_issue} // '') eq
        'https://github.com/ehb54/zazzie/issues/193';

my %allowed_status = map { $_ => 1 } qw(
    not_migrated semantic_data_ready harness_candidate accepted
);
my %shared_harness_status = map { $_ => 1 } qw(
    harness_candidate accepted
);
my $registered = $registry->{modules};
push @errors, 'plotting registry modules must be an object'
    unless ref $registered eq 'HASH';
$registered = {} unless ref $registered eq 'HASH';

sub tracked_module_json_files {
    my ($app_dir, $modules_dir) = @_;
    my @files;
    my $quoted_app = $app_dir;
    $quoted_app =~ s/'/'\\''/g;
    my $command = "git -C '$quoted_app' ls-files modules/*.json";
    if (open my $handle, '-|', $command) {
        while (my $relative = <$handle>) {
            chomp $relative;
            next unless length $relative;
            push @files, File::Spec->catfile($app_dir, $relative);
        }
        close $handle;
    }
    if (!@files) {
        opendir my $dir, $modules_dir
            or die "cannot read $modules_dir: $!\n";
        @files = map { File::Spec->catfile($modules_dir, $_) }
            grep {
                /\.json\z/
                    && $_ !~ /(?:_new|_old|\.before|\.pre|backup)/i
                    && -f File::Spec->catfile($modules_dir, $_)
            }
            readdir $dir;
        closedir $dir;
    }
    return @files;
}

@plot_modules = ();
for my $path (tracked_module_json_files($app_dir, $modules_dir)) {
    my $text = read_text($path);
    next unless $text =~ /"type"\s*:\s*"(?:plotly|semantic_plot)"/
        || $text =~ /"plot_spec"\s*:/;
    my $module = basename($path, '.json');
    push @plot_modules, $module;
}
my %plot_module = map { $_ => 1 } @plot_modules;
for my $module (sort @plot_modules) {
    push @errors, "plot module $module is missing from the migration registry"
        unless exists $registered->{$module};
}
for my $module (sort keys %{$registered}) {
    push @errors, "registry module $module is not snake_case"
        unless snake_case($module);
    push @errors,
        "registry module $module has no declared plot output module file"
        unless $plot_module{$module};
    my $entry = $registered->{$module};
    if (ref $entry ne 'HASH') {
        push @errors, "registry module $module entry must be an object";
        next;
    }
    my $status = $entry->{status} // '';
    push @errors, "registry module $module has invalid status '$status'"
        unless $allowed_status{$status};
    next unless $shared_harness_status{$status};

    my @required_acceptance = qw(
        dataset_schema plot_spec_schema shared_reducer native_react_renderer
        initial_snapshot bounded_updates resynchronization completion failure
        reattach scientific_value_parity responsive accessibility
        non_color_cues
    );
    if ($status eq 'accepted') {
        my $acceptance = $entry->{acceptance};
        if (ref $acceptance ne 'HASH') {
            push @errors,
                "accepted module $module is missing acceptance evidence";
        } else {
            for my $gate (@required_acceptance) {
                push @errors,
                    "accepted module $module has not passed $gate"
                    unless exists $acceptance->{$gate}
                        && $acceptance->{$gate};
            }
        }
    }

    my $module_file = File::Spec->catfile(
        $modules_dir, "$module.json");
    my $module_text = read_text($module_file);
    push @errors,
        "$status module $module still declares renderer-specific type plotly"
        if $module_text =~ /"type"\s*:\s*"plotly"/;
    my @specs = collect_plot_specs($module_text, $module_file);
    push @errors, "$status module $module has no plot_spec"
        unless @specs;
    inspect_spec($_, $module_file, 'plot_spec') for @specs;

    my $driver_paths = $entry->{driver_paths};
    if (ref $driver_paths ne 'ARRAY' || !@{$driver_paths}) {
        push @errors,
            "$status module $module must list every application driver/helper path";
        next;
    }
    for my $relative (@{$driver_paths}) {
        my $path = File::Spec->catfile($app_dir, $relative);
        if (!-f $path) {
            push @errors,
                "$status module $module implementation path does not exist: "
                . $relative;
            next;
        }
        my $text = read_text($path);
        push @errors,
            "$status module $module implementation mentions Plotly: $relative"
            if $text =~ /plotly/i;
    }
}

if (@errors) {
    print STDERR "plotting architecture check failed:\n";
    print STDERR "  - $_\n" for @errors;
    exit 1;
}

my %count;
$count{$registered->{$_}{status}}++ for sort keys %{$registered};
print "plotting architecture registry valid\n";
print "  governed plot modules: " . scalar(@plot_modules) . "\n";
for my $status (qw(
        accepted harness_candidate semantic_data_ready not_migrated)) {
    print "  $status: " . ($count{$status} // 0) . "\n";
}

exit 0;
