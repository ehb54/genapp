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
const rows=[
 {name:'xaxis',value:-1,priority:1,left:0,right:40,top:0,bottom:15,text:'first'},
 {name:'xaxis',value:0,priority:1,left:20,right:60,top:0,bottom:15,text:'second'},
 {name:'yaxis',value:1,priority:1,left:0,right:40,top:30,bottom:45,text:'third'}
];
assert.deepStrictEqual(plain(api.nonOverlappingTicks(rows)),[rows[0],rows[2]]);
const listeners={};let calls=0,spacing=20,inject=false;
const original={tickmode:'array',tickvals:[-1,0],ticktext:['first','second']};
const plot={layout:{xaxis:plain(original)},_fullLayout:{xaxis:{type:'linear',l2d:v=>v}},
 on:(name,fn)=>{listeners[name]=fn;},removeListener:()=>{},
 querySelectorAll:()=>[-1,0].map((v,i)=>({__data__:{x:v,text:plot.layout.xaxis.ticktext[i]},
 getBoundingClientRect:()=>({left:i*spacing,right:i*spacing+40,top:0,bottom:15,width:40,height:15})}))};
context.window.Plotly={relayout:async(_plot,update)=>{
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
 assert.strictEqual(api.tickDensityUpdate(plot),null,'visible labels fit');
 spacing=100;listeners.plotly_relayout({'xaxis.range':[-2,2]});
 await api.settleTickDensity(plot);
 assert.deepStrictEqual(plain(plot.layout.xaxis),original,'labels restored when space returns');
 spacing=20;inject=true;await api.applyTickDensity(plot);await api.settleTickDensity(plot);
 assert.deepStrictEqual(plain(plot.layout.xaxis),original,'range event during fitting is not dropped');
 spacing=20;await api.applyTickDensity(plot);
 plot.layout.xaxis={tickmode:'array',tickvals:[-1,0],ticktext:['new one','new two']};spacing=100;
 listeners.plotly_afterplot();await api.settleTickDensity(plot);
 assert.deepStrictEqual(plain(plot.layout.xaxis.ticktext),['new one','new two'],'new figure wins over old baseline');
 assert.strictEqual(JSON.stringify(original),saved,'source unchanged');
 console.log('general tick fitting, grid preservation, queued events and reconstruction passed');
})().catch(error=>{console.error(error);process.exit(1);});
JS
close $fh;
my ($status,$output)=run_command(cwd=>$repo,cmd=>['node',$script,File::Spec->catfile($repo,qw(languages ui2 add js plotly-layout.js))]);
is($status,0,'generic x/y tick collision fitting') or diag($output);
like($output,qr/reconstruction passed/,'bounded fitting and compatibility assertions completed');
done_testing();
