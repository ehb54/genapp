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
for(const format of ['.0e','.5e','.15e','.1g','.16r'])assert(policy.validNumericHoverFormat(format),format);
for(const format of [undefined,'','.5s','.0g','.16e','.17g','.5f','<script>'])assert(!policy.validNumericHoverFormat(format),String(format));
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
console.log('numeric hover defaults, overrides, typed values, no-op behavior and immutability passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
JS
close $fh;
my ($status,$output,$quoted)=run_command(cwd=>$repo,cmd=>['node',$script,File::Spec->catfile($repo,qw(languages ui2 add js plotly-layout.js))]);
is($status,0,'generic numeric-hover behavior') or diag($output);
like($output,qr/immutability passed/,'all numeric-hover assertions completed');
done_testing();
