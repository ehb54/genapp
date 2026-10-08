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
my ($fh, $script) = tempfile('hover-names-XXXX', SUFFIX => '.js', TMPDIR => 1, UNLINK => 1);
print {$fh} <<'JS';
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const context={window:{}};vm.createContext(context);
vm.runInContext(fs.readFileSync(process.argv[2],'utf8'),context);
const p=context.window.GenAppPlotlyLayout,selection={hoverNameDisplay:'full'};
const source={title:'Neutral',xaxis:{type:'log',range:[-3,0]},hoverlabel:{align:'left',font:{size:14},bgcolor:'#004488'}};
const saved=JSON.stringify(source),display=p.prepareHoverNameDisplay(source,selection);
assert.strictEqual(display.hoverlabel.namelength,-1);
assert.strictEqual(display.hoverlabel.bgcolor,source.hoverlabel.bgcolor);
assert.strictEqual(display.hoverlabel.font,source.hoverlabel.font);
assert.strictEqual(display.xaxis,source.xaxis);
assert.strictEqual(JSON.stringify(source),saved,'source immutable');
assert.strictEqual(p.prepareHoverNameDisplay(display,selection),display,'idempotent');
for(const value of [undefined,null,{},'full',[],{hoverNameDisplay:true},{hoverNameDisplay:'short'}])
 assert.strictEqual(p.prepareHoverNameDisplay(source,value),source,'non-opted-in control');
for(const value of [undefined,null,[],4])assert.strictEqual(p.prepareHoverNameDisplay(value,selection),value);
for(const length of [-1,0,3,15,100]){
 const explicit={hoverlabel:{namelength:length}};
 assert.strictEqual(p.prepareHoverNameDisplay(explicit,selection),explicit,'layout override');
 const templated={template:{layout:{hoverlabel:{namelength:length}}}};
 assert.strictEqual(p.prepareHoverNameDisplay(templated,selection),templated,'template override');
}
const templated={template:{layout:{hoverlabel:{font:{size:18}}}}};
assert.strictEqual(p.prepareHoverNameDisplay(templated,selection).hoverlabel.namelength,-1,'other template styling does not suppress opt-in');
assert.deepStrictEqual(JSON.parse(JSON.stringify(p.prepareHoverNameDisplay(JSON.parse(saved),selection))),JSON.parse(JSON.stringify(display)),'saved-output reconstruction');
const ui2=fs.readFileSync(process.argv[3],'utf8');
assert(ui2.includes('prepareHoverNameDisplay?.('),'ordinary UI2 uses shared helper');
console.log('hover name opt-in, overrides, controls, immutability and reconstruction passed');
JS
close $fh;
my ($status,$output)=run_command(cwd=>$repo,cmd=>['node',$script,File::Spec->catfile($repo,qw(languages ui2 add js plotly-layout.js)),File::Spec->catfile($repo,qw(languages ui2 add js ui2.js))]);
is($status,0,'generic full hover-name presentation contract') or diag($output);
like($output,qr/reconstruction passed/,'all helper assertions completed');
SKIP: {
 skip 'Set GENAPP_HOVER_BROWSER to a Chrome executable for real Plotly acceptance', 2 unless $ENV{GENAPP_HOVER_BROWSER};
 my $profile=tempdir('hover-browser-XXXX',TMPDIR=>1,CLEANUP=>1);
 my $fixture=File::Spec->catfile($repo,qw(t fixtures plotly_hover_names.html));
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
 ok($result && $result->{passed},'real Plotly full-name, override and lifecycle acceptance') or diag($json || $dom);
}
done_testing();
