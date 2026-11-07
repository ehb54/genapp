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
(async()=>{
 await p.applySubplotSpacing(plot,source,selection);
 // No relayout implementation in this pure helper context: browser checks own status lifecycle.
 const missing={xaxis:{anchor:'y',domain:[0,1]},yaxis:{anchor:'x',domain:[.7,1]},xaxis2:{anchor:'y2',domain:[0,1]},yaxis2:{anchor:'x2',domain:[0,.3]}};
 const modern={_fullLayout:{width:600,height:626,_size:{w:440,h:400},...JSON.parse(JSON.stringify(missing))},getBoundingClientRect:()=>({left:0,top:0,width:600,height:626}),querySelector:()=>null,querySelectorAll:()=>[]};
 const before=JSON.stringify(missing),fitted=p.subplotSpacingUpdate(modern,missing,selection);
 assert(fitted && Object.keys(fitted).every(k=>/^[xy]axis\d*\.domain$/.test(k)));
 assert.strictEqual(JSON.stringify(missing),before);
 assert.strictEqual(p.subplotSpacingUpdate({...modern,_fullLayout:{...modern._fullLayout,_size:{w:20,h:20}}},missing,selection),null);
})().catch(e=>{console.error(e);process.exitCode=1;});
const ui2=fs.readFileSync(process.argv[3],'utf8');assert(ui2.includes('applySubplotSpacing?.('));
console.log('subplot opt-in, controls, weighting, immutability and reconstruction passed');
JS
close $fh;
my ($status,$output)=run_command(cwd=>$repo,cmd=>['node',$script,File::Spec->catfile($repo,qw(languages ui2 add js plotly-layout.js)),File::Spec->catfile($repo,qw(languages ui2 add js ui2.js))]);
is($status,0,'generic subplot spacing contract') or diag($output);
like($output,qr/reconstruction passed/,'all helper assertions completed');
SKIP: {
 skip 'Set GENAPP_SUBPLOT_BROWSER to a Chrome executable for real Plotly acceptance', 2 unless $ENV{GENAPP_SUBPLOT_BROWSER};
 my $fixture=File::Spec->catfile($repo,qw(t fixtures plotly_subplot_spacing.html));
 my ($runner_fh,$runner)=tempfile('subplot-browser-runner-XXXX',SUFFIX=>'.py',TMPDIR=>1,UNLINK=>1);
 print {$runner_fh} <<'PY';
import json,os,sys,traceback
from pathlib import Path
from playwright.sync_api import sync_playwright
result={'passed':False,'checks':[]}
def check(value,label):
 if not value:raise AssertionError(label)
 result['checks'].append(label)
def clear(s,label):
 if s['collisions'] or s['dataIntrusions']:raise AssertionError(label+': '+json.dumps(s))
 check(True,label+': clear titles')
 check(s['sourceUnchanged'] and s['scientificDataUnchanged'],label+': science unchanged')
 check(s['status']['status']=='fitted',label+': settled fitting '+str(s['status']))
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=os.environ['GENAPP_SUBPLOT_BROWSER'],headless=True,args=['--allow-file-access-from-files'])
  page=browser.new_page(viewport={'width':1600,'height':1100})
  page.goto(Path(sys.argv[1]).resolve().as_uri());page.wait_for_function('window.subplotAcceptance !== undefined')
  original=page.evaluate('subplotAcceptance');check(original['passed'],'existing one-column lifecycle '+json.dumps(original))
  result['legacy']=original
  for kind in ['stacked','overlay']:
   control=page.evaluate('(k)=>subplot352Fixture.mount(k,600,626,false)',kind)
   check(control['status']['status']=='not-selected','non-opted-in control remains unselected '+kind)
   check(bool(control['collisions'] or control['dataIntrusions']),'neutral control reproduces the reported collision '+kind)
   for w,h,label in [(600,626,'narrow'),(1200,626,'wide'),(1500,900,'expanded'),(600,626,'restored')]:
    if label=='narrow':s=page.evaluate('(k)=>subplot352Fixture.mount(k)',kind)
    else:s=page.evaluate('([w,h])=>subplot352Fixture.resize(w,h)',[w,h])
    clear(s,kind+' '+label)
    again=page.evaluate('subplot352Fixture.refit()');check(s['domains']==again['domains'],'idempotent domains '+kind+' '+label)
   if kind=='overlay':
    for mode in ['closest','x']:
     page.evaluate('(m)=>subplot352Fixture.mode(m)',mode)
     target=page.evaluate('subplot352Fixture.target()');page.mouse.move(1,1);page.mouse.move(target['x'],target['y']);page.wait_for_timeout(120)
     hovered=page.evaluate('subplot352Fixture.snapshot()');check(bool(hovered['labels']),'native hover labels exist '+mode)
     check(not hovered['hoverIntrusions'],'native labels do not obscure another panel '+mode+' '+json.dumps(hovered))
     check(all(p['x']==100 and p['y']==6.3 and p['curve'] in [0,1] for p in hovered['points']), 'native hover retains original point values '+mode)
     check(len(hovered['points'])==(1 if mode=='closest' else 2),'native closest/compare count '+mode)
     check(hovered['sourceUnchanged'] and hovered['scientificDataUnchanged'],'hover preserves science '+mode)
   zoom=page.evaluate('subplot352Fixture.zoom()');check(zoom['before']==zoom['after'],'zoom ranges retained '+kind)
   check(page.evaluate('subplot352Fixture.image()'),'scale-2 PNG '+kind)
   editor=page.evaluate('subplot352Fixture.editor()');clear(editor,'initial editor handoff '+kind)
   reconstructed=page.evaluate('(k)=>subplot352Fixture.mount(k)',kind);clear(reconstructed,'saved-source reconstruction '+kind)
  result['passed']=True;browser.close()
except Exception:
 result['error']=traceback.format_exc()
print(json.dumps(result))
PY
 close $runner_fh;
 my ($browser_status,$json)=run_command(cwd=>$repo,cmd=>['python3',$runner,$fixture]);
 is($browser_status,0,'real Plotly subplot fixture produces a completed result');
 my $result=eval {decode_json($json || '{}')};
 ok($result && $result->{passed},'real Plotly subplot title, hover and lifecycle acceptance') or diag($json);

}
done_testing();
