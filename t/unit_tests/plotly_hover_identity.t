use strict;
use warnings;
use File::Spec;
use File::Temp qw(tempfile tempdir);
use FindBin;
use JSON qw(decode_json);
use Test::More;
use lib File::Spec->catdir($FindBin::Bin, '..', 'lib');
use GenAppTest qw(repo_root run_command);
my $repo = repo_root(File::Spec->catdir($FindBin::Bin, '..'));
my ($fh, $script) = tempfile('hover-identity-XXXX', SUFFIX => '.js', TMPDIR => 1, UNLINK => 1);
print {$fh} <<'JS';
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const context={window:{}};vm.createContext(context);
vm.runInContext(fs.readFileSync(process.argv[2],'utf8'),context);
const surface=context.window.GenAppPlotlySurface;
for(const bg of ['#ffffff','#202725','#f7f8f6','#1a201f']){
 for(const hovermode of ['closest','x','y','x unified']){
  const layout={paper_bgcolor:bg,plot_bgcolor:bg,hovermode};surface.apply(layout);
  assert.strictEqual(layout.hoverlabel,undefined,'no plot-wide hover color defaults');
  assert.strictEqual(layout.hovermode,hovermode,'preserve hover mode');
 }
 for(const hoverlabel of [
  {bgcolor:'#004488',bordercolor:'#ffcc00',font:{color:'#fff',size:15}},
  {font:{family:'serif',size:12},namelength:-1,align:'left'},
  {bgcolor:['#dc2626','#0f766e'],bordercolor:['#fff','#000'],font:{color:['#fff','#000']}}
 ]){
  const source={paper_bgcolor:bg,plot_bgcolor:bg,hoverlabel};const saved=JSON.stringify(source);
  const layout=JSON.parse(saved);surface.apply(layout);
  assert.strictEqual(JSON.stringify(layout.hoverlabel),JSON.stringify(hoverlabel),'explicit scalar and array styles remain authoritative');
  const once=JSON.stringify(layout);surface.apply(layout);assert.strictEqual(JSON.stringify(layout),once,'idempotent surface application');
  assert.strictEqual(JSON.stringify(source),saved,'detached presentation leaves saved output unchanged');
 }
}
const template={layout:{hoverlabel:{bgcolor:'#004488',font:{color:'#fff'}}}};
const layout={paper_bgcolor:'#fff',plot_bgcolor:'#fff',template};surface.apply(layout);
assert.strictEqual(layout.hoverlabel,undefined,'layout defaults do not mask template hover styling');
assert.strictEqual(layout.template,template,'template untouched');
console.log('hover identity overrides, templates, surfaces and immutability passed');
JS
close $fh;
my ($status,$output)=run_command(cwd=>$repo,cmd=>['node',$script,File::Spec->catfile($repo,qw(languages ui2 add js plotly-surface.js))]);
is($status,0,'generic hover identity helper behavior') or diag($output);
like($output,qr/immutability passed/,'helper assertions completed');
SKIP: {
 skip 'Set GENAPP_HOVER_BROWSER to a Chrome executable for real Plotly acceptance', 2 unless $ENV{GENAPP_HOVER_BROWSER};
 my $profile=tempdir('hover-browser-XXXX',TMPDIR=>1,CLEANUP=>1);
 my $fixture=File::Spec->catfile($repo,qw(t fixtures plotly_hover_identity.html));
 my ($runner_fh,$runner)=tempfile('hover-browser-runner-XXXX',SUFFIX=>'.py',TMPDIR=>1,UNLINK=>1);
 print {$runner_fh} <<'PY';
import os, re, signal, subprocess, sys, tempfile, time
# Chrome on macOS can retain helper pipes after dump-dom. Read the completed
# fixture directly and clean up only this isolated browser process group.
with tempfile.TemporaryFile(mode='w+b') as output:
    process = subprocess.Popen(sys.argv[1:], stdout=output, stderr=subprocess.STDOUT, start_new_session=True)
    dom = ''
    completed = False
    try:
        deadline = time.monotonic() + 60
        while time.monotonic() < deadline:
            output.seek(0)
            dom = output.read().decode('utf-8', 'replace')
            if re.search(r'<pre id="results">\{.*?\}</pre>', dom, re.S):
                completed = True
                break
            if process.poll() is not None:
                break
            time.sleep(0.1)
    finally:
        if process.poll() is None:
            os.killpg(process.pid, signal.SIGTERM)
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                os.killpg(process.pid, signal.SIGKILL)
                process.wait()
    print(dom)
    sys.exit(0 if completed else 1)
PY
 close $runner_fh;
 my ($browser_status,$dom)=run_command(cwd=>$repo,cmd=>['python3',$runner,$ENV{GENAPP_HOVER_BROWSER},'--headless','--disable-gpu','--no-first-run','--no-default-browser-check','--use-mock-keychain','--disable-background-networking',"--user-data-dir=$profile",'--allow-file-access-from-files','--virtual-time-budget=25000','--dump-dom',"file://$fixture"]);
 is($browser_status,0,'real Plotly hover fixture produces a completed result');
 my ($json)=$dom=~m{<pre id="results">(.*?)</pre>}s;
 my $result=eval {decode_json($json || '{}')};
 ok($result && $result->{passed},'real Plotly trace, point, override and lifecycle acceptance') or diag($json || $dom);
}
done_testing();
