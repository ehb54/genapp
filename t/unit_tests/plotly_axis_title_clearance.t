use strict;
use warnings;
use File::Spec;
use File::Temp qw(tempfile);
use FindBin;
use Test::More;
use lib File::Spec->catdir($FindBin::Bin, '..', 'lib');
use GenAppTest qw(repo_root run_command);
my $repo = repo_root(File::Spec->catdir($FindBin::Bin, '..'));
my ($fh, $script) = tempfile('tick-density-XXXX', SUFFIX => '.js', TMPDIR => 1, UNLINK => 1);
print {$fh} <<'JS';
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const context={window:{}};vm.createContext(context);
vm.runInContext(fs.readFileSync(process.argv[2],'utf8'),context);
const api=context.window.GenAppPlotlyLayout,clone=x=>JSON.parse(JSON.stringify(x));
const rect=(left,top,width,height)=>({left,top,width,height,right:left+width,bottom:top+height});
function graph(name='xaxis',side='bottom',scale=1){
 const horizontal=name.startsWith('x'),id=name.replace('axis',''),listeners={};let calls=0,collision=true;
 const source={ [name]:{type:'linear',side,title:{text:'Coordinate'},tickformat:'.4~g'},margin:{l:72,r:32,t:96,b:128},hovermode:'closest',hoverlabel:{namelength:0}};
 const g={layout:clone(source),_fullLayout:{width:600,height:480,margin:clone(source.margin),[name]:{...clone(source[name]),title:{text:'Coordinate',standoff:0},l2d:x=>x}},
 getBoundingClientRect:()=>rect(0,0,600*scale,480*scale),on:(e,f)=>listeners[e]=f,removeListener:()=>{},
 querySelector:sel=>sel===`.${id}title`?{textContent:'Coordinate',getBoundingClientRect:()=>{
 const shift=(g._fullLayout[name].title.standoff||0)*scale,base=collision?12:40;
 return horizontal?rect(90,(side==='bottom'?base+shift:-base-shift),60,16):rect(side==='right'?base+shift:-base-shift,90,16,60);
 }}:null,
 querySelectorAll:sel=>sel===`.${id}tick text`?[{textContent:'.0015',__data__:{x:.0015,text:'.0015'},getBoundingClientRect:()=>horizontal?rect(95,0,40,16):rect(0,95,16,40)}]:[]};
 const set=(object,path,value)=>{const parts=path.split('.');for(const k of parts.slice(0,-1))object=object[k]??={};if(value===null)delete object[parts.at(-1)];else object[parts.at(-1)]=value;};
 context.window.Plotly={relayout:async(p,u)=>{assert(++calls<80,'bounded relayout');for(const [k,v] of Object.entries(u)){set(g.layout,k,v);set(g._fullLayout,k,v);}listeners.plotly_afterplot?.();listeners.plotly_relayout?.(u);}};
 return {g,source,listeners,calls:()=>calls,release:()=>collision=false};
}
(async()=>{
 for(const [name,side] of [['xaxis','bottom'],['xaxis2','top'],['yaxis','left'],['yaxis2','right']])for(const scale of [1,.67]){
 const x=graph(name,side,scale),saved=JSON.stringify(x.source);
 assert(api.axisTitleClearanceUpdate(x.g),'neutral baseline collides');
 await api.applyTickDensity(x.g);await api.settleTickDensity(x.g);
 assert.strictEqual(api.axisTitleClearanceUpdate(x.g),null,'title clears ticks');
 assert.strictEqual(x.g.layout[name].tickformat,'.4~g');
 assert.strictEqual(x.g.layout[name].automargin,undefined,'explicit axis-margin contract unchanged');
 assert.strictEqual(x.g.layout.hovermode,'closest');assert.strictEqual(x.g.layout.hoverlabel.namelength,0);
 const fitted=JSON.stringify(x.g.layout);await api.applyTickDensity(x.g);assert.strictEqual(JSON.stringify(x.g.layout),fitted,'stable repeated fit');
 x.release();await api.applyTickDensity(x.g);assert.strictEqual(x.g.layout[name].title.standoff,undefined,'release owned standoff');
 assert.deepStrictEqual(x.g.layout.margin,x.source.margin,'release owned margin');assert.strictEqual(JSON.stringify(x.source),saved,'source unchanged');
 }
 const x=graph();await api.applyTickDensity(x.g);x.release();x.g.layout.xaxis.title.standoff=80;x.g._fullLayout.xaxis.title.standoff=80;await api.applyTickDensity(x.g);assert.strictEqual(x.g.layout.xaxis.title.standoff,80,'new explicit setting wins');
 for(const margin of [false,true,'left+right']){
 const z=graph();z.g.layout.xaxis.automargin=margin;z.g.layout.template={layout:{xaxis:{automargin:margin}}};z.g.layout.xaxis.range=[0,1];
 await api.applyTickDensity(z.g);assert.strictEqual(z.g.layout.xaxis.automargin,margin);assert.strictEqual(z.g.layout.template.layout.xaxis.automargin,margin);assert.deepStrictEqual(z.g.layout.xaxis.range,[0,1]);
 const fresh=clone(z.source);fresh.xaxis.title.standoff=70;z.g.layout=fresh;z.g._fullLayout.xaxis.title.standoff=70;z.release();await api.applyTickDensity(z.g);assert.strictEqual(z.g.layout.xaxis.title.standoff,70,'replacement figure owns its setting');
 }
 const y=graph();y.g.querySelector=()=>null;assert.strictEqual(api.axisTitleClearanceUpdate(y.g),null,'no title control');
 console.log('clearance, scaled bounds, four sides, release, explicit settings and hover preservation passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
JS
close $fh;
my ($status,$output)=run_command(cwd=>$repo,cmd=>['node',$script,File::Spec->catfile($repo,qw(languages ui2 add js plotly-layout.js))]);
is($status,0,'generic Cartesian axis-title clearance') or diag($output);
like($output,qr/preservation passed/,'bounded fitting and compatibility assertions completed');
done_testing();
