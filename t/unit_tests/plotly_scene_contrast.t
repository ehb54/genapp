use strict;
use warnings;
use File::Spec;
use File::Temp qw(tempfile);
use FindBin;
use Test::More;
use lib File::Spec->catdir($FindBin::Bin, '..', 'lib');
use GenAppTest qw(repo_root run_command);
my $repo = repo_root(File::Spec->catdir($FindBin::Bin, '..'));
my ($fh, $script) = tempfile('scene-contrast-XXXX', SUFFIX => '.js', TMPDIR => 1, UNLINK => 1);
print {$fh} <<'JS';
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const context={window:{}};vm.createContext(context);
vm.runInContext(fs.readFileSync(process.argv[2],'utf8'),context);
const api=context.window.GenAppPlotlySurface,copy=x=>JSON.parse(JSON.stringify(x));
const contrast=(fg,bg)=>{const a=api.luminance(fg,bg),b=api.luminance(bg);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);};
for(const paper of ['#ffffff','#202725'])for(const canvas of ['#ffffff','#202725']) {
 const template={layout:{scene3:{bgcolor:canvas,xaxis:{backgroundcolor:paper,title:{text:'Template X (units)',font:{family:'serif',size:16}},tickfont:{size:11}}}}};
 const source={paper_bgcolor:paper,plot_bgcolor:canvas,xaxis:{title:'2D control (units)',range:[1,9]},
  scene:{aspectmode:'data',camera:{eye:{x:1.3,y:1.2,z:.9}},xaxis:{title:{text:'X (units)',font:{size:14}},range:[1,9],type:'log'},yaxis:{title:'Y (units)',showgrid:false},zaxis:{title:'Z (units)'}},
  scene2:{bgcolor:paper,xaxis:{backgroundcolor:canvas},yaxis:{backgroundcolor:canvas,showbackground:false},zaxis:{backgroundcolor:'rgba(0,0,0,0)'}},scene3:{},template};
 const saved=JSON.stringify(source),display=api.apply(copy(source));
 for(const name of ['scene','scene2','scene3'])for(const axis of ['xaxis','yaxis','zaxis']){
  const scene=display[name],a=scene[axis];
  const backdrop=scene.bgcolor;
  const effective=a.showbackground===false?backdrop:a.backgroundcolor;
  assert(contrast(a.tickfont.color,effective==='rgba(0,0,0,0)'?backdrop:effective)>=4.5,'readable ticks');
  for(const key of ['gridcolor','linecolor','zerolinecolor'])assert(contrast(a[key],effective==='rgba(0,0,0,0)'?backdrop:effective)>=3,'discernible '+key);
 }
 assert.strictEqual(display.scene.xaxis.title.text,'X (units)');
 assert.strictEqual(display.scene.xaxis.title.font.size,14);
 assert.strictEqual(display.scene.yaxis.title.text,'Y (units)');
 assert.strictEqual(display.scene.yaxis.showgrid,false);
 assert.strictEqual(display.scene.xaxis.type,'log');
 assert.deepStrictEqual(display.scene.xaxis.range,[1,9]);
 assert.deepStrictEqual(display.scene.camera,source.scene.camera);
 assert.strictEqual(display.scene.aspectmode,'data');
 assert.strictEqual(display.scene3.xaxis.title.text,'Template X (units)');
 assert.strictEqual(display.scene3.xaxis.tickfont.size,11);
 assert.strictEqual(display.scene3.xaxis.title.font.family,'serif');
 assert.deepStrictEqual(display.template,template);
 assert.strictEqual(display.xaxis.color,api.tokensFor(canvas,paper).text,'2D control unchanged');
 const once=JSON.stringify(display);api.apply(display);assert.strictEqual(JSON.stringify(display),once,'idempotent');
 assert.strictEqual(JSON.stringify(source),saved,'saved source unchanged');
}
const empty=api.apply({paper_bgcolor:'#202725'});assert.strictEqual(empty.scene,undefined,'no fabricated 3D scene');
const invalid={scene:null,scene2:[],scene3:'invalid'};api.apply(invalid);assert.strictEqual(invalid.scene,null);assert(Array.isArray(invalid.scene2));
console.log('3D surface contrast, mixed planes, templates, controls and immutability passed');
JS
close $fh;
my ($status,$output)=run_command(cwd=>$repo,cmd=>['node',$script,File::Spec->catfile($repo,qw(languages ui2 add js plotly-surface.js))]);
is($status,0,'neutral 3D contrast behavior') or diag($output);
like($output,qr/immutability passed/,'all scene assertions completed');
SKIP: {
 skip 'Set GENAPP_SCENE_BROWSER to Chrome for real 3D rendering acceptance', 2 unless $ENV{GENAPP_SCENE_BROWSER};
 my ($runner_fh,$runner)=tempfile('scene-browser-XXXX',SUFFIX=>'.py',TMPDIR=>1,UNLINK=>1);
 print {$runner_fh} <<'PYTHON';
import json, pathlib, sys
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=sys.argv[2], headless=True,
        args=['--no-first-run', '--no-default-browser-check', '--use-mock-keychain',
              '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'])
    page = browser.new_page(viewport={'width':1100, 'height':800})
    page.goto((pathlib.Path(sys.argv[1]) / 't/fixtures/plotly_scene_contrast.html').as_uri())
    page.wait_for_function("document.getElementById('results').textContent !== 'pending'", timeout=60000)
    result = json.loads(page.locator('#results').inner_text())
    if result.get('passed'):
        result['png_bytes'] = len(page.screenshot())
    browser.close()
    print(json.dumps(result))
    sys.exit(0 if result.get('passed') else 1)
PYTHON
 close $runner_fh;
 my ($browser_status,$dom)=run_command(cwd=>$repo,cmd=>[$ENV{GENAPP_TEST_PYTHON} || 'python3',$runner,$repo,$ENV{GENAPP_SCENE_BROWSER}]);
 is($browser_status,0,'real Plotly 3D rotation and lifecycle acceptance') or diag($dom);
 like($dom,qr/"passed": true/,'real renderer scene assertions completed');
}
done_testing();
