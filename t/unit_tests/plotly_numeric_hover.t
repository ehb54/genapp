use strict;
use warnings;
use File::Spec;
use File::Temp qw(tempfile);
use FindBin;
use Test::More;
use lib File::Spec->catdir($FindBin::Bin, '..', 'lib');
use GenAppTest qw(repo_root run_command);
my $repo = repo_root(File::Spec->catdir($FindBin::Bin, '..'));
my ($fh, $script) = tempfile('numeric-hover-XXXX', SUFFIX => '.js', TMPDIR => 1, UNLINK => 1);
print {$fh} <<'JS';
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const calls=[];
const window={Plotly:{
  PlotSchema:{get:()=>({traces:{heatmap:{attributes:{zhoverformat:{}}},scatter3d:{attributes:{zhoverformat:{}}},volume:{attributes:{valuehoverformat:{}}}}})},
  relayout:async(plot,update)=>{calls.push(['layout',update]);for(const [path,value] of Object.entries(update)){const keys=path.split('.');let target=plot._fullLayout;for(const key of keys.slice(0,-1))target=target[key];target[keys.at(-1)]=value;}},
  restyle:async(plot,update,indices)=>{calls.push(['trace',update,indices]);for(const index of indices)Object.assign(plot._fullData[index],update);}
}};
const context={window};vm.createContext(context);
vm.runInContext(fs.readFileSync(process.argv[2],'utf8'),context);
const policy=window.GenAppPlotlyLayout;
const plain=value=>JSON.parse(JSON.stringify(value));
(async()=>{
for(const format of ['.0e','.5e','.15e','.5g','.6g','.1g','.16r'])assert(policy.validNumericHoverFormat(format),format);
for(const format of [undefined,'','.5s','.0g','.16e','.17g','.5f','<script>'])assert(!policy.validNumericHoverFormat(format),String(format));
for(const format of ['.5g','.6g']) {
 const candidate={_fullLayout:{xaxis:{type:'linear'},yaxis:{type:'log'},yaxis2:{type:'linear',hoverformat:'.3e'},xaxis2:{type:'date'}},_fullData:[{type:'heatmap',z:[[0.0008006]],hovertemplate:'Producer %{z:.2f}<extra></extra>'},{type:'heatmap',z:[[1]],zhoverformat:'.2r'}]};
 await policy.applyNumericHoverFormat(candidate,format);
 assert.strictEqual(candidate._fullLayout.xaxis.hoverformat,format);
 assert.strictEqual(candidate._fullLayout.yaxis.hoverformat,format);
 assert.strictEqual(candidate._fullLayout.yaxis2.hoverformat,'.3e');
 assert.strictEqual(candidate._fullLayout.xaxis2.hoverformat,undefined);
 assert.strictEqual(candidate._fullData[0].zhoverformat,format);
 assert.strictEqual(candidate._fullData[1].zhoverformat,'.2r');
 assert.strictEqual(candidate._fullData[0].hovertemplate,'Producer %{z:.2f}<extra></extra>');
 calls.length=0;await policy.applyNumericHoverFormat(candidate,format);assert.strictEqual(calls.length,0);
}
const plot={_fullLayout:{xaxis:{type:'linear'},yaxis:{type:'log'},xaxis2:{type:'date'},yaxis2:{type:'category'},xaxis3:{type:'multicategory'},yaxis3:{type:'linear',hoverformat:'.3e'},scene:{xaxis:{type:'linear'},yaxis:{type:'linear',hoverformat:'.2g'},zaxis:{type:'linear'}}},_fullData:[
{type:'heatmap',z:[[0.0008006,null],[0.0004491,0]]},
{type:'heatmap',z:[[1]],zhoverformat:'.3e'},
{type:'scatter3d',scene:'scene',z:[0.0008006]},
{type:'heatmap',z:[['label']]},
{type:'heatmap',z:[]},
{type:'volume',scene:'scene2',value:new Float64Array([0.0004491])}
]};
assert.deepStrictEqual(plain(policy.numericHoverFormatUpdate(plot,'.5e')),{'xaxis.hoverformat':'.5e','yaxis.hoverformat':'.5e','scene.xaxis.hoverformat':'.5e','scene.zaxis.hoverformat':'.5e'});
assert.deepStrictEqual(plain(policy.numericHoverTraceUpdates(plot,'.5e')),[{update:{zhoverformat:'.5e'},indices:[0]},{update:{valuehoverformat:'.5e'},indices:[5]}]);
const saved={data:[{type:'heatmap',z:[[0.0008006]],hovertemplate:'Producer %{z:.2f}<extra></extra>'}],layout:{xaxis:{type:'linear'}}};
const before=JSON.stringify(saved);const display=JSON.parse(before);
const displayPlot={_fullLayout:display.layout,_fullData:display.data};
await policy.applyNumericHoverFormat(displayPlot,'.5e');
assert.strictEqual(JSON.stringify(saved),before,'display formatting leaves saved scientific output unchanged');
assert.strictEqual(displayPlot._fullData[0].hovertemplate,saved.data[0].hovertemplate,'template contents remain authoritative');
calls.length=0;await policy.applyNumericHoverFormat(plot,'');assert.strictEqual(calls.length,0,'non-opted-in no-op');
await policy.applyNumericHoverFormat(plot,'.5s');assert.strictEqual(calls.length,0,'invalid opt-in no-op');
await policy.applyNumericHoverFormat(plot,'.5e');assert.strictEqual(calls.length,3);
calls.length=0;await policy.applyNumericHoverFormat(plot,'.5e');assert.strictEqual(calls.length,0,'repeated application has no redundant redraw');
assert.strictEqual(plot._fullLayout.yaxis3.hoverformat,'.3e');
assert.strictEqual(plot._fullData[1].zhoverformat,'.3e');
assert.strictEqual(plot._fullData[2].zhoverformat,undefined,'scene coordinates follow scene axis policy');
window.Plotly.PlotSchema=undefined;assert.deepStrictEqual(plain(policy.numericHoverTraceUpdates(plot,'.5e')),[],'missing trace schema fails open');
// Issue 335: neutral metrological reporting examples and lifecycle controls.
assert.strictEqual(policy.formatUncertainValue(.0007922,.000338).text,'0.00079 ± 0.00034');
assert.strictEqual(policy.formatUncertainValue(1.3578,.5775).text,'1.36 ± 0.58');
assert.strictEqual(policy.formatUncertainValue(100.02147,.00070).text,'100.02147 ± 0.00070');
assert.strictEqual(policy.formatUncertainValue(1.225,.1).text,'1.22 ± 0.10','decimal ties to even');
assert.strictEqual(policy.formatUncertainValue(1.235,.1).text,'1.24 ± 0.10');
assert.strictEqual(policy.formatUncertainValue(-1.225,.1).text,'−1.22 ± 0.10');
assert.strictEqual(policy.formatUncertainValue(0,.00338).text,'0.0000 ± 0.0034');
assert.strictEqual(policy.formatUncertainValue(.12345,.00999).text,'0.123 ± 0.010','uncertainty carry keeps two digits');
assert.strictEqual(policy.formatUncertainValue(.0000007922,.000000338).text,'(7.9 ± 3.4)e-7');
assert.strictEqual(policy.formatUncertainValue(1e12,.0004491).text,'(1.00000000000000000 ± 0.00000000000000045)e12','source error survives extreme scale separation');
assert.strictEqual(policy.formatUncertainValue(1.2345,.1234,.01234).text,'1.234 +0.12/−0.012');
for (const uncertainty of [0,-1,null,undefined,NaN,Infinity,''])assert.strictEqual(policy.formatUncertainValue(1,uncertainty),null);
assert.strictEqual(policy.formatUncertainValue(null,.1),null);
assert.strictEqual(policy.formatUncertainValue(0,1e12).text,'(0.0 ± 1.0)e12');
const source335={data:[{type:'scatter',name:'neutral observation',x:[.227],y:[.0007922],error_y:{type:'data',array:[.000338],visible:true},customdata:[['identity',42]]}],layout:{xaxis:{type:'linear'},yaxis:{type:'log'}}};
const saved335=JSON.stringify(source335),display335=JSON.parse(saved335);
const plotted335={data:display335.data,_fullData:display335.data,_fullLayout:display335.layout};
const oldRestyle=window.Plotly.restyle;
window.Plotly.restyle=async(plot,update,indices)=>{calls.push(['precision',update]);for(const index of indices){for(const [key,value]of Object.entries(update))plot.data[index][key]=key==='hovertemplate'?value[0]:value;}};
await policy.applyNumericHoverFormat(plotted335,'uncertainty-2');
assert(plotted335.data[0].hovertemplate[0].includes('0.00079 ± 0.00034'));
assert(plotted335.data[0].hovertemplate[0].includes('%{x}'),'q has independent precision');
assert.strictEqual(plotted335._fullLayout.xaxis.hoverformat,'.6g');
assert.strictEqual(JSON.stringify(source335),saved335,'source/output immutable');
assert.deepStrictEqual(plotted335.data[0].y,source335.data[0].y);
assert.deepStrictEqual(plotted335.data[0].error_y,source335.data[0].error_y);
assert.deepStrictEqual(plotted335.data[0].customdata,source335.data[0].customdata);
calls.length=0;await policy.applyNumericHoverFormat(plotted335,'uncertainty-2');assert.strictEqual(calls.length,0,'precision application idempotent');
// Replacement, bounded append, clear/repopulate and saved-output reconstruction.
plotted335.data[0].x.push(.228);plotted335.data[0].y.push(.0008);plotted335.data[0].error_y.array.push(.0004);
await policy.applyNumericHoverFormat(plotted335,'uncertainty-2');
assert(plotted335.data[0].hovertemplate[1].includes('0.00080 ± 0.00040'));
for(const template of ['Named %{y:.8f}<extra>identity</extra>','Named %{y:.8f} ± %{error_y.array:.8f}<extra>identity</extra>']){
 const tr={...JSON.parse(saved335).data[0],hovertemplate:template};
 const p={data:[tr],_fullData:[tr],_fullLayout:JSON.parse(saved335).layout};
 await policy.applyNumericHoverFormat(p,'uncertainty-2');
 assert(tr.hovertemplate[0].includes('Named 0.00079 ± 0.00034<extra>identity</extra>'),'explicit numeric format cannot bypass coupled uncertainty');
}
const inferredTypeTrace=JSON.parse(saved335).data[0];delete inferredTypeTrace.error_y.type;
const inferredTypePlot={data:[inferredTypeTrace],_fullData:[{...inferredTypeTrace,error_y:{...inferredTypeTrace.error_y,type:'data'}}],_fullLayout:JSON.parse(saved335).layout};
await policy.applyNumericHoverFormat(inferredTypePlot,'uncertainty-2');
assert(inferredTypeTrace.hovertemplate[0].includes('0.00079 ± 0.00034'),'schema-resolved absolute data type');
const inheritedTrace=JSON.parse(saved335).data[0];
const inheritedPlot={data:[inheritedTrace],_fullData:[{...inheritedTrace,hovertemplate:'Inherited %{y:.8f} units<extra>name</extra>'}],_fullLayout:JSON.parse(saved335).layout};
await policy.applyNumericHoverFormat(inheritedPlot,'uncertainty-2');
assert(inheritedTrace.hovertemplate[0].includes('Inherited 0.00079 ± 0.00034 units<extra>name</extra>'),'inherited template identity and units remain');
const noError={...JSON.parse(saved335).data[0],error_y:undefined,hovertemplate:'Producer %{y:.5f}'};
const control335={data:[noError],_fullData:[noError],_fullLayout:JSON.parse(saved335).layout};
await policy.applyNumericHoverFormat(control335,'uncertainty-2');assert.strictEqual(noError.hovertemplate,'Producer %{y:.5f}','unknown reporting precision is not invented');
const dates={...JSON.parse(saved335).data[0],x:['2026-10-27'],error_x:{type:'data',array:[1]}};
const datePlot={data:[dates],_fullData:[dates],_fullLayout:{xaxis:{type:'date'},yaxis:{type:'linear'}}};
await policy.applyNumericHoverFormat(datePlot,'uncertainty-2');assert(dates.hovertemplate[0].includes('%{x}'),'date coordinate unchanged');
const empty335={data:[],_fullData:[],_fullLayout:{}};await policy.applyNumericHoverFormat(empty335,'uncertainty-2');
window.Plotly.restyle=oldRestyle;

console.log('numeric hover defaults, overrides, typed values, no-op behavior and immutability passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
JS
close $fh;
my ($status,$output,$quoted)=run_command(cwd=>$repo,cmd=>['node',$script,File::Spec->catfile($repo,qw(languages ui2 add js plotly-layout.js))]);
is($status,0,'generic numeric-hover behavior') or diag($output);
like($output,qr/immutability passed/,'all numeric-hover assertions completed');
done_testing();
