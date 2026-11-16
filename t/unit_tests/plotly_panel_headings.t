use strict;
use warnings;
use File::Spec;
use File::Temp qw(tempfile);
use FindBin;
use Test::More;
use lib File::Spec->catdir($FindBin::Bin,'..','lib');
use GenAppTest qw(repo_root run_command);
my $repo=repo_root(File::Spec->catdir($FindBin::Bin,'..'));
my ($fh,$script)=tempfile('panel-headings-XXXX',SUFFIX=>'.js',TMPDIR=>1,UNLINK=>1);
print {$fh} <<'JS';
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const c={window:{}};vm.createContext(c);vm.runInContext(fs.readFileSync(process.argv[2]+'/languages/ui2/add/js/plotly-layout.js','utf8'),c);
const p=c.window.GenAppPlotlyLayout,clone=x=>JSON.parse(JSON.stringify(x));
assert(p.resolvePanelHeadings&&p.applyPanelHeadings,'MISSING_CAPABILITY: panel-relative headings');
const source={xaxis:{anchor:'y'},yaxis:{anchor:'x'},xaxis2:{anchor:'y2'},yaxis2:{anchor:'x2'},annotations:[
 {text:'Group A',xref:'paper',yref:'paper',x:.2,y:1.06,showarrow:false},
 {name:'group_b',text:'Group B',xref:'paper',yref:'paper',x:.8,y:1.06,showarrow:false}]};
const selection={panelHeadings:[{panel:'xy',annotation:{index:0,text:'Group A'}},{panel:'x2y2',annotation:{name:'group_b'}}]},saved=JSON.stringify(source);
assert.strictEqual(p.resolvePanelHeadings(source,selection).length,2);
for(const entries of [null,[],{},Array(17).fill(selection.panelHeadings[0]),
 [{panel:'unknown',annotation:{index:0,text:'Group A'}}],
 [{panel:'xy',annotation:{index:0,text:'Changed'}}],
 [{panel:'xy',annotation:{index:true,text:'Group A'}}],
 [{panel:'xy',annotation:{name:'missing'}}],
 [selection.panelHeadings[0],selection.panelHeadings[0]],
 [{panel:'xy',annotation:{index:0,text:'Group A',name:'other'}}]])assert.strictEqual(p.resolvePanelHeadings(source,{panelHeadings:entries}).length,0);
const conflict={...selection,annotationPlacement:{group_b:'above_plot'}};assert.strictEqual(p.resolvePanelHeadings(source,conflict).length,0);
const duplicate=clone(source);duplicate.annotations.push({...duplicate.annotations[1]});assert.strictEqual(p.resolvePanelHeadings(duplicate,selection).length,0);
for(const change of [{xref:'x'},{showarrow:true},{text:'<b>Group A</b>'}]){const value=clone(source);Object.assign(value.annotations[0],change);assert.strictEqual(p.resolvePanelHeadings(value,selection).length,0);}
const overlay=clone(source);overlay.yaxis.overlaying='y2';assert.strictEqual(p.resolvePanelHeadings(overlay,selection).length,0);
assert.strictEqual(p.resolvePanelHeadings(source,{}).length,0);
assert.strictEqual(p.prepareAnnotationPlacement(source,{annotationPlacement:{unmatched:'above_plot'}}),source,'Existing above_plot behavior unchanged');
assert.strictEqual(JSON.stringify(source),saved,'Source unchanged');
p.clearPanelHeadings({});
console.log('panel heading selectors, ambiguity, controls and source preservation passed');
JS
close $fh;
my ($status,$output)=run_command(cwd=>$repo,cmd=>['node',$script,$repo]);
is($status,0,'generic panel heading contract') or diag($output);
like($output,qr/source preservation passed/,'all helper assertions completed');
SKIP: {
 skip 'Set GENAPP_PANEL_HEADINGS_BROWSER and optionally GENAPP_BROWSER_PYTHON for browser acceptance',1 unless $ENV{GENAPP_PANEL_HEADINGS_BROWSER};
 my ($pyfh,$runner)=tempfile('panel-heading-browser-XXXX',SUFFIX=>'.py',TMPDIR=>1,UNLINK=>1);
 print {$pyfh} <<'PYCODE';
import json,sys
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
root=Path(sys.argv[1])
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path=sys.argv[2])
 context=browser.new_context(viewport={'width':694,'height':900})
 def route(req):
  parsed=urlparse(req.request.url);path=root/parsed.path.lstrip('/')
  if parsed.hostname=='offline.invalid' and path.is_file():req.fulfill(path=str(path))
  else:req.abort()
 context.route('**/*',route);page=context.new_page()
 page.goto('http://offline.invalid/t/fixtures/plotly_panel_headings.html')
 page.wait_for_function('window.panelHeadingReady||window.panelHeadingError')
 assert not page.evaluate('window.panelHeadingError'),page.evaluate('window.panelHeadingError')
 for width,height in [(694,522),(801,580),(694,522)]:
  page.set_viewport_size({'width':width,'height':900});page.locator('#plot').evaluate('(g,h)=>g.style.height=h+"px"',height);page.wait_for_timeout(700)
  row=page.evaluate('panelHeadingMeasure()')
  assert row['sourceUnchanged'] and row['arraysUnchanged'] and not row['collisions'],row
  assert all(h['intrusion']<=.75 for h in row['headings']),row
 assert all(page.evaluate('panelHeadingExtraChecks()').values())
 context.close();browser.close()
 print('Neutral browser panel headings passed')
PYCODE
 close $pyfh;
 my ($code,$out)=run_command(cwd=>$repo,cmd=>[$ENV{GENAPP_BROWSER_PYTHON}||'python3',$runner,$repo,$ENV{GENAPP_PANEL_HEADINGS_BROWSER}]);
 is($code,0,'real Plotly resize, removal, zoom and transfer checks') or diag($out);
}
done_testing();
