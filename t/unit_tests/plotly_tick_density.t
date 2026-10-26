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
const api=context.window.GenAppPlotlyLayout, plain=x=>JSON.parse(JSON.stringify(x));
const selection={axisTickDensity:{xaxis:'avoid-overlap',xaxis2:'avoid-overlap'}};
const source={xaxis:{type:'log'},xaxis2:{type:'log'},yaxis:{type:'linear'}};
assert(api.automaticLogAxis(source,'xaxis',selection));
assert(api.automaticLogAxis(source,'xaxis2',selection));
for(const type of ['linear','date','category',undefined])assert(!api.automaticLogAxis({xaxis:{type}},'xaxis',selection));
for(const value of [undefined,'dense',false,[],{}])assert(!api.automaticLogAxis(source,'xaxis',{axisTickDensity:value}));
for(const override of [{dtick:1},{nticks:5},{tick0:0},{tickmode:'auto'},{tickvals:[.1]},{ticktext:['a']},{ticklabelstep:2},{overlaying:'x2'}]){
 assert(!api.automaticLogAxis({xaxis:{type:'log',...override}},'xaxis',selection));
 assert(!api.automaticLogAxis({xaxis:{type:'log'},template:{layout:{xaxis:override}}},'xaxis',selection));
}
const rows=[{value:.009,start:0,end:35,text:'0.009'},{value:.01,start:20,end:48,text:'0.01'},{value:.02,start:70,end:98,text:'0.02'}];
assert.deepStrictEqual(plain(api.nonOverlappingTicks(rows)),rows.slice(1));
assert.strictEqual(rows.length,3);
const nodes=rows.map(row=>({__data__:{x:Math.log10(row.value)},textContent:row.text,getBoundingClientRect:()=>({left:row.start,right:row.end,top:0,bottom:12})}));
const plot={_fullLayout:{xaxis:{type:'log'}},querySelectorAll:selector=>selector==='.xtick text'?nodes:[]};
const saved=JSON.stringify(source),update=api.tickDensityUpdate(plot,source,selection);
assert.strictEqual(update['xaxis.tickmode'],'array');
assert.deepStrictEqual(plain(update['xaxis.ticktext']),['0.01','0.02']);
assert(Math.abs(update['xaxis.tickvals'][0]-.01)<1e-15);
assert.strictEqual(api.tickDensityUpdate(plot,source,{}),null);
assert.strictEqual(JSON.stringify(source),saved);
// Invalid or unmeasurable DOM data leaves native Plotly untouched.
assert.strictEqual(api.tickDensityUpdate({...plot,querySelectorAll:()=>nodes.map(n=>({...n,__data__:{}}))},source,selection),null);
nodes[1].__data__.text='10<sup>−2</sup>';
assert.strictEqual(api.tickDensityUpdate(plot,source,selection)['xaxis.ticktext'][0],'10<sup>−2</sup>');
let calls=0,listener;
plot.on=(name,fn)=>{listener=fn;};plot.removeListener=()=>{};
context.window.Plotly={relayout:async(_plot,updates)=>{calls++;if(listener)listener(updates);}};
(async()=>{
 await api.applyTickDensity(plot,source,selection);
 assert.strictEqual(calls,1,'one bounded fitting relayout');
 await api.applyTickDensity(plot,source,{});
 assert.strictEqual(calls,2,'removal restores native placement once');
 assert.strictEqual(JSON.stringify(source),saved);
 console.log('neutral log density, overrides, bounded fitting and rollback passed');
})().catch(error=>{console.error(error);process.exit(1);});
JS
close $fh;
my ($status,$output)=run_command(cwd=>$repo,cmd=>['node',$script,File::Spec->catfile($repo,qw(languages ui2 add js plotly-layout.js))]);
is($status,0,'generic automatic logarithmic tick density') or diag($output);
like($output,qr/rollback passed/,'bounded fitting and compatibility assertions completed');
done_testing();
