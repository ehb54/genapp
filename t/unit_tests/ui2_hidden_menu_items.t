use strict;
use warnings;
use File::Spec;
use File::Temp qw(tempfile);
use FindBin;
use JSON qw(decode_json encode_json);
use Test::More;
use lib File::Spec->catdir($FindBin::Bin, '..', 'lib');
use GenAppTest qw(generate_fixture_app read_file repo_root run_command find_executable);

my $repo = repo_root(File::Spec->catdir($FindBin::Bin, '..'));
my $node = find_executable($ENV{NODE} || 'node');
plan skip_all => 'Node is required to execute generated navigation maps' if !$node;
my $generated = generate_fixture_app(repo_root => $repo, fixture_name => 'ui2_views');
is($generated->{status}, 0, 'non-opted-in UI2 fixture generates') or diag($generated->{output});
my $app = $generated->{app_dir};
my $directives_file = File::Spec->catfile($app, 'directives.json');
my $original = decode_json(read_file($directives_file));
my $map_file = File::Spec->catfile($app, qw(output ui2 js app-map.js));
my $map_without_option = read_file($map_file);
my @all_ids = qw(shared plain typed workbench_layout);

sub write_json {
    my ($path, $value) = @_;
    open my $fh, '>', $path or die "write $path: $!";
    print {$fh} encode_json($value);
    close $fh;
}
sub generate {
    my ($hidden, $present) = @_;
    my %directives = %$original;
    $directives{ui2_hidden_menu_items} = $hidden if $present;
    write_json($directives_file, \%directives);
    return run_command(cwd => $app, env => {GENAPP => $repo},
        cmd => [File::Spec->catfile($repo, qw(bin genapp)), '--language', 'ui2']);
}
sub map_ids {
    my ($source) = @_;
    my ($fh, $script) = tempfile(SUFFIX => '.js', TMPDIR => 1, UNLINK => 1);
    print {$fh} 'const vm=require("vm");const sandbox={window:{}};';
    print {$fh} 'vm.runInNewContext('.encode_json($source).',sandbox);';
    print {$fh} 'console.log(JSON.stringify(sandbox.window.GenAppUi2App.menus.map(function(m){return m.modules.map(function(x){return x.id;});})));';
    close $fh;
    my ($status, $output) = run_command(cwd => $app, cmd => [$node, $script]);
    is($status, 0, 'generated app map executes without application runtime');
    return decode_json($output);
}
is_deeply(map_ids($map_without_option), [\@all_ids], 'omitted setting retains the complete neutral menu');
for my $case (
    [[], \@all_ids, 'empty'],
    [['plain'], [qw(shared typed workbench_layout)], 'single'],
    [['plain', 'typed'], [qw(shared workbench_layout)], 'multiple'],
    [['plain', 'plain'], [qw(shared typed workbench_layout)], 'duplicate'],
    [[@all_ids], [], 'entire group'],
) {
    my ($hidden, $expected, $label) = @$case;
    # Remove old summaries so retained metadata assertions prove fresh generation.
    for my $id (@all_ids) {
        my $summary = File::Spec->catfile($app, 'output', 'ui2', 'modules', "$id.json");
        unlink $summary or die "remove disposable summary $summary: $!" if -f $summary;
    }
    my ($status, $output) = generate($hidden, 1);
    is($status, 0, "$label selection generates") or diag($output);
    is_deeply(map_ids(read_file($map_file)), [$expected], "$label selection changes only requested registrations");
    for my $id (@all_ids) {
        ok(-f File::Spec->catfile($app, 'output', 'ui2', 'modules', "$id.json"), "$label retains module metadata for $id");
    }
    my $embedded = decode_json(read_file(File::Spec->catfile($app, qw(output ui2 modules sysuserslist.json))));
    is($embedded->{modulejson}{embedded_page}{url}, 'admin/protected.php', "$label preserves the embedded administrator declaration");
    if ($label eq 'empty') {
        unlike(read_file($map_file), qr/hiddenMenuItems/, 'empty list emits no filtering code, just like omission');
    }
}
for my $bad ('plain', {}, undef, [undef], [{}], [JSON::true], ['plain";throw 1;//'], ['missing_module']) {
    my ($status, $output) = generate($bad, 1);
    isnt($status, 0, 'invalid or unknown selection fails generation');
    like($output, qr/ui2_hidden_menu_items (?:must be|contains)/, 'failure names the invalid directive');
}
# A target override must be validated against the effective target menu/directives.
my $menu = decode_json(read_file(File::Spec->catfile($app, 'menu.json')));
$menu->{menu}[0]{modules} = [grep {$_->{id} eq 'shared'} @{$menu->{menu}[0]{modules}}];
my $target_menu = File::Spec->catfile($app, 'ui2', 'menu.json');
write_json($target_menu, $menu);
my ($status, $output) = generate(['plain'], 1);
isnt($status, 0, 'ID removed by target menu is rejected');
like($output, qr/unknown menu module ID 'plain'/, 'validation uses effective menu');
write_json(File::Spec->catfile($app, qw(ui2 directives.json)), {ui2_hidden_menu_items => ['shared']});
($status, $output) = generate(undef, 0);
is($status, 0, 'target-only directive selects its module') or diag($output);
is_deeply(map_ids(read_file($map_file)), [[]], 'target selection removes its entry');
unlink $target_menu or die "remove disposable target menu: $!";
($status, $output) = generate(['plain'], 1);
is($status, 0, 'base and target directives retain ordinary additive array merging') or diag($output);
is_deeply(map_ids(read_file($map_file)), [[qw(typed workbench_layout)]], 'both effective selections are omitted');
unlink File::Spec->catfile($app, qw(ui2 directives.json)) or die "remove disposable target directives: $!";
($status, $output) = generate(undef, 0);
is($status, 0, 'removing the directive restores generation') or diag($output);
is_deeply(map_ids(read_file($map_file)), [\@all_ids], 'rollback restores original navigation');

my $html5 = generate_fixture_app(repo_root => $repo, fixture_name => 'minimal_html5');
is($html5->{status}, 0, 'HTML5 control generates') or diag($html5->{output});
my $html_app = $html5->{app_dir};
my $login = File::Spec->catfile($html_app, qw(output html5 ajax sys_config sys_login.php));
my $login_before = read_file($login);
my $html_directives = decode_json(read_file(File::Spec->catfile($html_app, 'directives.json')));
$html_directives->{ui2_hidden_menu_items} = {intentionally => 'not a UI2 array'};
write_json(File::Spec->catfile($html_app, 'directives.json'), $html_directives);
($status, $output) = run_command(cwd => $html_app, env => {GENAPP => $repo},
    cmd => [File::Spec->catfile($repo, qw(bin genapp)), '--language', 'html5']);
is($status, 0, 'HTML5 ignores the UI2-specific option') or diag($output);
is(read_file($login), $login_before, 'generated password-login handler is byte-for-byte unchanged');
done_testing();
