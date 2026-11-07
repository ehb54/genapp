use strict;
use warnings;
use File::Spec;
use File::Temp qw(tempfile);
use FindBin;
use JSON qw(decode_json);
use Test::More;
use lib File::Spec->catdir($FindBin::Bin, '..', 'lib');
use GenAppTest qw(repo_root run_command);
my $repo=repo_root(File::Spec->catdir($FindBin::Bin,'..'));
my $fixture=File::Spec->catfile($repo,qw(t fixtures plotly_subplot_height.html));
ok(-f $fixture,'neutral height fixture exists');
open my $html,'<',$fixture or die $!;local $/;my $source=<$html>;close $html;
like($source,qr/GenAppUi2Workbench\.mount\(/,'actual React workbench is mounted');
like($source,qr/runtime\.render\(g,source\)/,'production Plotly render function is exercised');
like($source,qr/async function resize\(width,height\).*?await settle\(\)/s,'resize checks wait for production observation');
SKIP: {
 skip 'Set GENAPP_SUBPLOT_HEIGHT_BROWSER to an isolated Chrome executable',2 unless $ENV{GENAPP_SUBPLOT_HEIGHT_BROWSER};
 my ($fh,$runner)=tempfile('subplot-height-XXXX',SUFFIX=>'.py',TMPDIR=>1,UNLINK=>1);
 print {$fh} <<'PY';
import base64, functools, http.server, json, os, pathlib, sys, threading, traceback
from playwright.sync_api import sync_playwright
root=pathlib.Path(sys.argv[1]); artifact=pathlib.Path(os.environ['SUBPLOT_HEIGHT_ARTIFACT_DIR']) if os.environ.get('SUBPLOT_HEIGHT_ARTIFACT_DIR') else None
if artifact:artifact.mkdir(parents=True,exist_ok=True)
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(root)))
threading.Thread(target=server.serve_forever,daemon=True).start()
report={'phase':'B validation','candidate_ready':False,'checks':[],'cases':[],'gaps':['Linux execution requires a separately available Linux browser runtime','Actual browser chrome zoom and actual Chart Editor application are not emulated by this fixture']}
fixed=os.environ.get('GENAPP_SUBPLOT_HEIGHT_EXPECT_FIXED')=='1'
def check(value,label):
 if not value:raise AssertionError(label)
 report['checks'].append(label)
def clear(s):return not any(s[k] for k in ['titleCollisions','panelIntrusions','legendCollisions','missingTitles'])
def science(s,label):check(s['sourceUnchanged'] and s['scientificDataUnchanged'],label+' source and scientific parity')
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=os.environ['GENAPP_SUBPLOT_HEIGHT_BROWSER'],headless=True)
  page=browser.new_page(viewport={'width':1700,'height':800});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(f'http://127.0.0.1:{server.server_port}/t/fixtures/plotly_subplot_height.html')
  page.wait_for_function('window.subplotHeightHarness || window.heightHarnessError')
  check(page.evaluate('!window.heightHarnessError'),'production function harness initialized')
  for mode in ['native','react']:
   baseline=page.evaluate('(mode)=>subplotHeightHarness.mount({mode,width:699.5,height:480})',mode)
   science(baseline,mode+' short baseline');check(baseline['observerRegistered'],mode+' uses production allocation observer')
   check(mode!='react' or baseline['actualReactMounted'],'actual React bundle mounted')
   check(not clear(baseline),mode+' legacy short-height control reproduces collision')
   report['cases'].append(dict(label='short-baseline',**baseline))
   if artifact:page.locator('#allocation').screenshot(path=str(artifact/(mode+'-480.png')))
   idle=page.evaluate('subplotHeightHarness.idle()');check(idle['settled'],mode+' no idle relayout loop')
   control=page.evaluate('(mode)=>subplotHeightHarness.mount({mode,width:699.5,height:480,selection:{}})',mode)
   check(control['status']['status']=='not-selected',mode+' absent opt-in unchanged');science(control,mode+' control')
   # Candidate schema is a test input only; no production view is changed.
   candidate=page.evaluate('(mode)=>subplotHeightHarness.mount({mode,width:699.5,height:480,selection:{axisTitleOverflow:"wrap",subplotSpacing:"avoid-overlap",subplotHeight:"content-minimum"}})',mode)
   if fixed:
    check(clear(candidate),mode+' candidate opt-in clears collisions');check(candidate['status']['status']=='fitted',mode+' candidate fit settled');check(all(p['height']>=79.5 for p in candidate['panels']),mode+' candidate minimum readable panel height')
   else:
    check(candidate['ownedMinHeight']=='',mode+' proposed height opt-in not implemented')
    check(not clear(candidate),mode+' candidate remains a baseline failure')
   report['cases'].append(dict(label='candidate-opt-in',**candidate))
   for width,height in [(480,416),(699.5,448),(699.5,480),(1200,626),(699.5,480)]:
    s=page.evaluate('([w,h])=>subplotHeightHarness.resize(w,h)',[width,height]);science(s,mode+' resize');report['cases'].append(dict(label='resize',requestedHeight=height,**s))
    check(abs(s['width']-width)<2,mode+' actual host width follows allocation')
    check(all(r==[0,100] for k,r in s['ranges'].items() if k.startswith('xaxis')),mode+' explicit x ranges retained')
    if fixed:check(clear(s),mode+' resize geometry clear')
   tall=page.evaluate('subplotHeightHarness.resize(1200,626)');check(clear(tall),mode+' taller control clears collisions')
   before=tall['domains'];again=page.evaluate('subplotHeightHarness.idle()');check(again['settled'],mode+' tall allocation settles')
   page.evaluate('subplotHeightHarness.visibility(true)');shown=page.evaluate('subplotHeightHarness.visibility(false)');science(shown,mode+' hidden-to-visible');check(clear(shown),mode+' visibility observer fits without a manual call')
   for value in ['closest','x']:
    page.evaluate('(m)=>subplotHeightHarness.hoverMode(m)',value);page.locator('#plot').scroll_into_view_if_needed();pos=page.evaluate('subplotHeightHarness.target()');page.mouse.move(1,1);page.mouse.move(pos['x'],pos['y']);page.wait_for_timeout(90)
    s=page.evaluate('subplotHeightHarness.snapshot()');check(bool(s['points']) and all(t['x']==100 for t in s['points']),mode+' native '+value+' point coordinates');science(s,mode+' hover')
   zoomed=page.evaluate('subplotHeightHarness.zoom()');resized=page.evaluate('subplotHeightHarness.resize(1000,626)');check(zoomed['ranges']['xaxis']==resized['ranges']['xaxis']==[10,90],mode+' zoom retained through real resize')
   transfer=page.evaluate('subplotHeightHarness.transfer()');science(transfer['snapshot'],mode+' transfer');check(abs(transfer['width']-2*transfer['layoutWidth'])<=1 and abs(transfer['height']-2*transfer['layoutHeight'])<=1,mode+' scale-2 PNG uses displayed dimensions')
   check('height' not in transfer['editor']['layout'] and 'width' not in transfer['editor']['layout'],mode+' editor handoff stays autosized')
   if artifact:(artifact/(mode+'-626.png')).write_bytes(base64.b64decode(transfer['png'].split(',',1)[1]))
   if fixed:
    short=page.evaluate('subplotHeightHarness.resize(699.5,480)');high=short['height']
    fewer=page.evaluate('subplotHeightHarness.redraw("two")');science(fewer,mode+' fewer rows');check(clear(fewer) and fewer['height']<high,mode+' fewer rows release excess height')
    removed=page.evaluate('subplotHeightHarness.select({axisTitleOverflow:"wrap",subplotSpacing:"avoid-overlap"})');check(removed['ownedMinHeight']=='',mode+' selection removal releases owned minimum')
   for kind in ['one','two','overlay','unsupported']:
    s=page.evaluate('([mode,kind,fixed])=>subplotHeightHarness.mount({mode,kind,width:699.5,height:480,selection:{axisTitleOverflow:"wrap",subplotSpacing:"avoid-overlap",...(fixed?{subplotHeight:"content-minimum"}:{})}})',[mode,kind,fixed]);science(s,mode+' '+kind);report['cases'].append(dict(label=kind,**s))
    if fixed and kind!='unsupported':check(clear(s),mode+' optional/overlay geometry clear')
   replaced=page.evaluate('subplotHeightHarness.redraw("one")');science(replaced,mode+' completion-shaped replacement');check(len(replaced['panels'])==1,mode+' removed rows absent')
   if fixed:check(replaced['ownedMinHeight']=='',mode+' single row releases minimum')
   idle=page.evaluate('subplotHeightHarness.idle()');check(idle['settled'],mode+' row removal settles')
   removed=page.evaluate('subplotHeightHarness.release()');check(not removed['observerRemaining'],mode+' teardown disconnects observer')
   if fixed:
    authored=page.evaluate('(mode)=>subplotHeightHarness.mount({mode,width:699.5,height:480,minHeight:"510px",priority:"important",selection:{axisTitleOverflow:"wrap",subplotSpacing:"avoid-overlap",subplotHeight:"content-minimum"}})',mode);science(authored,mode+' authored style')
    restored=page.evaluate('subplotHeightHarness.select({})');check(restored['ownedMinHeight']=='510px' and restored['minHeightPriority']=='important',mode+' authored minimum and priority restored')
    page.evaluate('subplotHeightHarness.release()')
  report['browserErrors']=errors
  check(not errors,'no browser exceptions: '+repr(errors));browser.close();report['passed']=True
except Exception:report['passed']=False;report['error']=traceback.format_exc()
finally:server.shutdown();server.server_close()
if artifact:(artifact/'neutral-results.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report))
PY
 close $fh;
 my ($status,$text)=run_command(cwd=>$repo,cmd=>[$ENV{GENAPP_SUBPLOT_HEIGHT_PYTHON}||'python3',$runner,$repo]);
 is($status,0,'local browser runner completed') or diag($text);
 my $result=eval{decode_json($text)};
 ok($result && $result->{passed},$ENV{GENAPP_SUBPLOT_HEIGHT_EXPECT_FIXED}?'height candidate meets assertions':'Phase A baseline reproduced; controls and lifecycle verified') or diag($text);
}
done_testing();
