use strict;
use warnings;
use File::Spec;
use File::Temp qw(tempfile);
use FindBin;
use Test::More;
use lib File::Spec->catdir($FindBin::Bin,'..','lib');
use GenAppTest qw(repo_root run_command);
my $repo=repo_root(File::Spec->catdir($FindBin::Bin,'..'));
SKIP: {
 skip 'Set GENAPP_EDITOR_BROWSER and optionally GENAPP_BROWSER_PYTHON for editor acceptance',1 unless $ENV{GENAPP_EDITOR_BROWSER};
 my ($fh,$runner)=tempfile('editor-canvas-XXXX',SUFFIX=>'.py',TMPDIR=>1,UNLINK=>1);
 print {$fh} <<'PYCODE';
import json,sys
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
root=Path(sys.argv[1]); phase=sys.argv[3];checks=0
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path=sys.argv[2])
 ctx=browser.new_context(viewport={'width':760,'height':900},accept_downloads=True)
 def route(req):
  url=urlparse(req.request.url);p=root/url.path.lstrip('/')
  if url.hostname=='offline.invalid' and p.is_file():req.fulfill(path=str(p))
  else:req.abort()
 ctx.route('**/*',route)
 for kind in ('single','two','four'):
  page=ctx.new_page();page.goto('http://offline.invalid/t/fixtures/chart_editor_canvas.html?kind='+kind)
  page.wait_for_function("document.querySelector('.js-plotly-plot')?._fullLayout")
  page.wait_for_timeout(400)
  width=page.locator('.js-plotly-plot').evaluate('g=>g._fullLayout.width')
  if phase=='baseline':
   assert width<700,(kind,width);checks+=1;page.close();continue
  assert abs(width-700)<2,(kind,width);checks+=1
  for size in (1440,760,550,760):
   page.set_viewport_size({'width':size,'height':900});page.wait_for_timeout(120)
   for _ in range(2):
    page.get_by_role('button',name='Show controls' if page.get_by_role('button',name='Show controls').count() else 'Hide controls',exact=True).click()
    page.wait_for_timeout(100)
    assert abs(page.locator('.js-plotly-plot').evaluate('g=>g._fullLayout.width')-700)<2;checks+=1
  original=page.evaluate('neutralSource')
  page.evaluate("""()=>{const p=neutralEditorProps,l=JSON.parse(JSON.stringify(p.layout));
    l.title={text:'Deliberate user title'};l.width=850;l.height=500;
    l.xaxis={...l.xaxis,range:[1.25,2.75],autorange:false};
    l.legend={...l.legend,x:.75,y:-.2};const d=JSON.parse(JSON.stringify(p.data));d[0].line={...d[0].line,width:3,dash:'dash'};d[0].marker={...d[0].marker,symbol:'diamond'};p.onUpdate(d,l);}""")
  page.wait_for_timeout(200)
  page.set_viewport_size({'width':550,'height':900});page.wait_for_timeout(150)
  page.get_by_role('button',name='Show controls' if page.get_by_role('button',name='Show controls').count() else 'Hide controls',exact=True).click()
  with page.expect_download() as pending:page.get_by_role('button',name='Download JSON',exact=False).click()
  value=json.loads(Path(pending.value.path()).read_text())
  expected=json.loads(json.dumps(original['data']));expected[0]['line']={**expected[0].get('line',{}),'width':3,'dash':'dash'};expected[0]['marker']={**expected[0].get('marker',{}),'symbol':'diamond'}
  assert value['data']==expected;assert value['layout']['title']['text']=='Deliberate user title'
  assert value['layout']['width']==850 and value['layout']['height']==500
  assert value['layout']['xaxis']['range']==[1.25,2.75] and value['layout']['legend']['x']==.75
  assert 'editor_viewport' not in value;checks+=6
  with page.expect_download() as pending:page.get_by_role('button',name='Download CSV',exact=False).click()
  csv=Path(pending.value.path()).read_text();assert '0.125' in csv and '0.875' in csv;checks+=1
  page.close()
 for hint in ('none','invalid'):
  page=ctx.new_page();page.goto('http://offline.invalid/t/fixtures/chart_editor_canvas.html?hint='+hint)
  page.wait_for_function("document.querySelector('.js-plotly-plot')?._fullLayout")
  initial=page.locator('.js-plotly-plot').evaluate('g=>g._fullLayout.width');assert initial<700;checks+=1
  page.set_viewport_size({'width':1440,'height':900});page.wait_for_timeout(150)
  assert page.locator('.js-plotly-plot').evaluate('g=>g._fullLayout.width')==initial;checks+=1;page.close()
 browser.close()
print(json.dumps({'phase':phase,'checks':checks,'passed':True}))
PYCODE
 close $fh;
 my ($status,$output)=run_command(cwd=>$repo,cmd=>[$ENV{GENAPP_BROWSER_PYTHON}||'python3',$runner,$repo,$ENV{GENAPP_EDITOR_BROWSER},$ENV{GENAPP_EDITOR_PHASE}||'candidate']);
 is($status,0,'neutral real editor canvas, old envelopes, user edits and download parity') or diag($output);
 diag($output);
}
done_testing();
