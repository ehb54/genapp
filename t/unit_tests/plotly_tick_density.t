use strict;
use warnings;
use File::Spec;
use File::Temp qw(tempfile);
use FindBin;
use Test::More;
use JSON qw(decode_json);
use lib File::Spec->catdir($FindBin::Bin, '..', 'lib');
use GenAppTest qw(repo_root run_command);
my $repo = repo_root(File::Spec->catdir($FindBin::Bin, '..'));
my ($fh, $script) = tempfile('tick-density-XXXX', SUFFIX => '.js', TMPDIR => 1, UNLINK => 1);
print {$fh} <<'JS';
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const context={window:{}};vm.createContext(context);
vm.runInContext(fs.readFileSync(process.argv[2],'utf8'),context);
const api=context.window.GenAppPlotlyLayout, plain=x=>JSON.parse(JSON.stringify(x));
const rows=[
 {name:'xaxis',value:-1,priority:1,left:0,right:40,top:0,bottom:15,text:'first'},
 {name:'xaxis',value:0,priority:1,left:20,right:60,top:0,bottom:15,text:'second'},
 {name:'yaxis',value:1,priority:1,left:0,right:40,top:30,bottom:45,text:'third'}
];
assert.deepStrictEqual(plain(api.nonOverlappingTicks(rows)),[rows[0],rows[2]]);
const listeners={};let calls=0,spacing=20,inject=false;
const original={tickmode:'array',tickvals:[-1,0],ticktext:['first','second']};
const sourceTrace={type:'scatter',mode:'markers',x:[-1,0],y:[1,2],meta:{id:'neutral'},
 hovertemplate:'Coordinate %{x} units<br>Value %{y}<extra>authored</extra>'};
const displayTrace=plain(sourceTrace);
const plot={layout:{xaxis:plain(original)},data:[displayTrace],_fullData:[displayTrace],
 _fullLayout:{hovermode:'closest',xaxis:{type:'linear',l2d:v=>v,d2l:v=>v,range:[-2,2],...plain(original)}},
 on:(name,fn)=>{listeners[name]=fn;},removeListener:()=>{},
 querySelectorAll:()=>[-1,0].map((v,i)=>({__data__:{x:v,text:plot.layout.xaxis.ticktext[i]},
 getBoundingClientRect:()=>({left:i*spacing,right:i*spacing+40,top:0,bottom:15,width:40,height:15})}))};
let restyles=0;
context.window.Plotly={restyle:async(_plot,update,indices)=>{
 restyles++;assert(restyles<30,'bounded hover restyles');
 for(const index of indices)plot.data[index].hovertemplate=update.hovertemplate[0];
 listeners.plotly_afterplot?.();
},relayout:async(_plot,update)=>{
 calls++; assert(calls<30,'bounded relayouts');
 for(const [path,value] of Object.entries(update)){const [axis,key]=path.split('.');plot.layout[axis][key]=value;}
 listeners.plotly_afterplot?.();listeners.plotly_relayout?.(update);
 if(inject){inject=false;spacing=100;listeners.plotly_relayout?.({'xaxis.range':[-2,2]});}
}};
(async()=>{
 const saved=JSON.stringify(original);
 const update=api.tickDensityUpdate(plot);
 assert.deepStrictEqual(plain(update['xaxis.tickvals']),[-1,0],'all grid positions retained');
 assert.strictEqual(update['xaxis.ticktext'][0],'first');
 await api.applyTickDensity(plot);
 assert.strictEqual(calls,1,'one fit, no recursive relayout');
 assert.strictEqual(plot.data[0].hovertemplate[0],sourceTrace.hovertemplate,'visible point keeps authored template');
 assert(plot.data[0].hovertemplate[1].includes('second%{x} units'),'masked authored tick label restored only for hover');
 assert(plot.data[0].hovertemplate[1].includes('<extra>authored</extra>'),'authored hover body retained');
 assert.deepStrictEqual(plain(plot.data[0].x),sourceTrace.x,'scientific coordinates unchanged');
 assert.strictEqual(api.tickDensityUpdate(plot),null,'visible labels fit');
 spacing=100;listeners.plotly_relayout({'xaxis.range':[-2,2]});
 await api.settleTickDensity(plot);
 assert.deepStrictEqual(plain(plot.layout.xaxis),original,'labels restored when space returns');
 assert.strictEqual(plot.data[0].hovertemplate,sourceTrace.hovertemplate,'source hover restored when collision disappears');
 spacing=20;inject=true;await api.applyTickDensity(plot);await api.settleTickDensity(plot);
 assert.deepStrictEqual(plain(plot.layout.xaxis),original,'range event during fitting is not dropped');
 spacing=20;await api.applyTickDensity(plot);
 plot.layout.xaxis={tickmode:'array',tickvals:[-1,0],ticktext:['new one','new two']};spacing=100;
 listeners.plotly_afterplot();await api.settleTickDensity(plot);
 assert.deepStrictEqual(plain(plot.layout.xaxis.ticktext),['new one','new two'],'new figure wins over old baseline');
 plot.data[0].hovertemplate='Explicit %{x:.2e} units<extra></extra>';
 spacing=20;await api.applyTickDensity(plot);
 assert.strictEqual(plot.data[0].hovertemplate,'Explicit %{x:.2e} units<extra></extra>','explicit coordinate format never rewritten');
 delete plot._fullLayout;await api.applyTickDensity(plot);
 assert.strictEqual(JSON.stringify(original),saved,'source unchanged');
 // A real log conversion changes low bits. Geometry must remain the reason
 // for removing a label, including after array mode changes its rectangles.
 const nativeCoordinates=[.01,.02,.03,.3].map(v=>Math.log(v)/Math.LN10);
 const nativeTexts=['0.01','0.02','0.03','0.3'];
 let passes=0,firstValues;
 const axis={type:'log',l2d:v=>10**v,d2l:v=>Math.log(v)/Math.LN10,range:[-2.1,-.4],
  _vals:nativeCoordinates.map((x,i)=>({x,text:nativeTexts[i]}))};
 const roundTripPlot={layout:{xaxis:{}},_fullLayout:{xaxis:axis},on(){},removeListener(){},
  querySelectorAll:()=>axis._vals.map((tick,i)=>({
   __data__:{x:tick.x+(i===0?Number.EPSILON:0),text:tick.text},
   getBoundingClientRect:()=>{const left=(passes?[0,20,30,200]:[0,20,100,200])[i];
    return {left,right:left+40,top:0,bottom:15,width:40,height:15};}
  }))};
 context.window.Plotly={relayout:async(_plot,patch)=>{
  passes++;assert(passes<5,'round-trip fitting stays bounded');
  for(const [path,value] of Object.entries(patch))roundTripPlot.layout.xaxis[path.split('.')[1]]=value;
  const current=roundTripPlot.layout.xaxis;
  firstValues=firstValues||plain(current.tickvals);
  axis._vals=current.tickvals.map((v,i)=>({x:Math.log(v)/Math.LN10,text:current.ticktext[i]}));
 }};
 await api.applyTickDensity(roundTripPlot);
 assert(passes>=2,'test exercises the subsequent-pass correspondence');
 assert.deepStrictEqual(plain(roundTripPlot.layout.xaxis.tickvals),firstValues,'original native tick values are never rounded');
 assert.deepStrictEqual(plain(roundTripPlot.layout.xaxis.ticktext),['0.01','\u200b','\u200b','0.3'],
  'only geometric collisions hide labels through log round trips');
 // A close authored neighbor reserves its exact identity before approximation.
 const e=Number.EPSILON;
 const closeAxis={type:'linear',l2d:v=>v,_vals:[{x:1,text:'near first'},{x:1+8*e,text:'near second'},{x:2,text:'far'}]};
 const closePlot={_fullLayout:{xaxis:closeAxis},querySelectorAll:()=>[
  {x:1+e,text:'near first',left:0},{x:1+8*e,text:'near second',left:100},{x:2,text:'far',left:120}
 ].map(row=>({__data__:row,getBoundingClientRect:()=>({left:row.left,right:row.left+40,top:0,bottom:15,width:40,height:15})}))};
 const closeUpdate=api.tickDensityUpdate(closePlot);
 assert.deepStrictEqual(plain(closeUpdate['xaxis.ticktext']),['near first','near second','\u200b'],
  'nearby distinct ticks remain distinct; exact matches are reserved');
 console.log('general tick fitting, grid preservation, queued events and reconstruction passed');
})().catch(error=>{console.error(error);process.exit(1);});
JS
close $fh;
my ($status,$output)=run_command(cwd=>$repo,cmd=>['node',$script,File::Spec->catfile($repo,qw(languages ui2 add js plotly-layout.js))]);
is($status,0,'generic x/y tick collision fitting') or diag($output);
like($output,qr/reconstruction passed/,'bounded fitting and compatibility assertions completed');
SKIP: {
    skip 'Set GENAPP_TICK_BROWSER to Chrome for rendered tick retention', 2 unless $ENV{GENAPP_TICK_BROWSER};
    my ($browser_fh, $runner) = tempfile('tick-retention-XXXX', SUFFIX => '.py', TMPDIR => 1, UNLINK => 1);
    print {$browser_fh} <<'PYTHON';
import json, os, sys
from pathlib import Path
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ['GENAPP_TICK_BROWSER'],headless=True)
    try:
        page=browser.new_page(viewport={'width':1400,'height':900})
        page.goto(Path(sys.argv[1]).resolve().as_uri())
        page.wait_for_function('window.tickDensityAcceptance !== undefined',timeout=90000)
        result=page.evaluate('window.tickDensityAcceptance')
        if os.environ.get('GENAPP_TICK_REPORT'):
            Path(os.environ['GENAPP_TICK_REPORT']).write_text(json.dumps(result,indent=2)+'\n')
        if os.environ.get('GENAPP_TICK_PNG') and result.get('passed'):
            import base64
            url=page.evaluate('window.tickRetentionPNG')
            Path(os.environ['GENAPP_TICK_PNG']).write_bytes(base64.b64decode(url.split(',',1)[1]))
        print(json.dumps({'passed':result.get('passed',False),'error':result.get('error'),
            'checkCount':len(result.get('checks',[])),'retention':result.get('retention',[])}))
    finally:
        browser.close()
PYTHON
    close $browser_fh;
    my ($browser_status,$browser_output)=run_command(cwd=>$repo,cmd=>[
        $ENV{GENAPP_TICK_PYTHON} || 'python3', $runner,
        File::Spec->catfile($repo,qw(t fixtures plotly_tick_density.html))]);
    is($browser_status,0,'real-browser tick fixture completed') or diag($browser_output);
    my $report=eval { decode_json($browser_output) };
    ok($report && $report->{passed},'useful collision-free labels survive fitting and interactions') or diag($browser_output);
    note($report->{checkCount}.' rendered checks') if $report && $report->{passed};
}
done_testing();
