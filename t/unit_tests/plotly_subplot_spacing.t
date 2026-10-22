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
my ($fh, $script) = tempfile('subplot-spacing-XXXX', SUFFIX => '.js', TMPDIR => 1, UNLINK => 1);
print {$fh} <<'JS';
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const context={window:{}};vm.createContext(context);vm.runInContext(fs.readFileSync(process.argv[2],'utf8'),context);
const p=context.window.GenAppPlotlyLayout,selection={subplotSpacing:'avoid-overlap'};
const source={grid:{rows:2,columns:1,subplots:[['xy'],['x2y2']]},xaxis:{title:'Observation'},xaxis2:{title:'Observation'},yaxis:{range:[0,2]},yaxis2:{range:[-1,1]}};
const saved=JSON.stringify(source),full={_size:{h:236},xaxis:{},xaxis2:{},yaxis:{_offset:96,_length:98,domain:[.588,1]},yaxis2:{_offset:235,_length:97,domain:[0,.412]}};
const plot={_fullLayout:full,getBoundingClientRect:()=>({top:0}),querySelector:()=>({getBoundingClientRect:()=>({bottom:250,height:18})}),querySelectorAll:()=>[]};
const update=p.subplotSpacingUpdate(plot,source,selection);assert(update);assert(update['yaxis.domain'][0]>full.yaxis.domain[0]);
assert(update['yaxis2.domain'][1]<full.yaxis2.domain[1]);assert.strictEqual(JSON.stringify(source),saved);
for(const s of [{},null,{subplotSpacing:'fixed'},{subplotSpacing:true}])assert.strictEqual(p.subplotSpacingUpdate(plot,source,s),null);
for(const grid of [{columns:2,subplots:[['xy'],['x2y2']]},{columns:1,subplots:[['xy']]},{columns:1,subplots:[['xy'],['xy2']]},{columns:1,subplots:[['xy'],['bad']]}])assert.strictEqual(p.subplotSpacingUpdate(plot,{...source,grid},selection),null);
assert.strictEqual(p.subplotSpacingUpdate({...plot,_fullLayout:{...full,_size:{h:20}}},source,selection),null);
const weighted={...source,yaxis:{domain:[.6,1]},yaxis2:{domain:[0,.2]}};
const u=p.subplotSpacingUpdate(plot,weighted,selection);const a=u['yaxis.domain'],b=u['yaxis2.domain'];assert(Math.abs((a[1]-a[0])/(b[1]-b[0])-2)<1e-10);
const ui2=fs.readFileSync(process.argv[3],'utf8');assert(ui2.includes('applySubplotSpacing?.('));
console.log('subplot opt-in, controls, weighting, immutability and reconstruction passed');
JS
close $fh;
my ($status,$output)=run_command(cwd=>$repo,cmd=>['node',$script,File::Spec->catfile($repo,qw(languages ui2 add js plotly-layout.js)),File::Spec->catfile($repo,qw(languages ui2 add js ui2.js))]);
is($status,0,'generic subplot spacing contract') or diag($output);
like($output,qr/reconstruction passed/,'all helper assertions completed');
SKIP: {
 skip 'Set GENAPP_SUBPLOT_BROWSER to a Chrome executable for real Plotly acceptance', 2 unless $ENV{GENAPP_SUBPLOT_BROWSER};
 my $profile=tempdir('subplot-browser-XXXX',TMPDIR=>1,CLEANUP=>1);
 my $fixture=File::Spec->catfile($repo,qw(t fixtures plotly_subplot_spacing.html));
 my ($runner_fh,$runner)=tempfile('subplot-browser-runner-XXXX',SUFFIX=>'.py',TMPDIR=>1,UNLINK=>1);
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
 my ($browser_status,$dom)=run_command(cwd=>$repo,cmd=>['python3',$runner,$ENV{GENAPP_SUBPLOT_BROWSER},'--headless','--disable-gpu','--no-first-run','--no-default-browser-check','--use-mock-keychain','--disable-background-networking',"--user-data-dir=$profile",'--allow-file-access-from-files','--virtual-time-budget=25000','--dump-dom',"file://$fixture"]);
 is($browser_status,0,'real Plotly subplot fixture produces a completed result');
 my ($json)=$dom=~m{<pre id="results">(.*?)</pre>}s;
 my $result=eval {decode_json($json || '{}')};
 ok($result && $result->{passed},'real Plotly subplot spacing and lifecycle acceptance') or diag($json || $dom);
}
done_testing();
