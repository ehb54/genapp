use strict;
use warnings;
use File::Spec;
use File::Temp qw(tempfile);
use FindBin;
use Test::More;
use lib File::Spec->catdir($FindBin::Bin, '..', 'lib');
use GenAppTest qw(repo_root run_command);
my $repo = repo_root(File::Spec->catdir($FindBin::Bin, '..'));
my ($fh, $script) = tempfile('legend-XXXX', SUFFIX => '.js', TMPDIR => 1, UNLINK => 1);
print {$fh} <<'JS';
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const context={window:{}};vm.createContext(context);
vm.runInContext(fs.readFileSync(process.argv[2],'utf8'),context);
const p=context.window.GenAppPlotPresentation, plain=x=>JSON.parse(JSON.stringify(x));
const policy={member:{token:'context',legend:{mode:'compact',title:'Repeated observations'}},summary:{legend:'show'}};
const profile={styles:{context:{legend:'hidden'}}};
const source=Array.from({length:100},(_,i)=>({type:'scatter',name:'observation '+i,
 meta:{series_role:'member',series_group:'neutral_'+i},x:[1,2],y:[i,i+1],showlegend:false}));
source.push({type:'scatter',name:'Summary',meta:{series_role:'summary'},x:[1],y:[3]});
const before=JSON.stringify(source),display=p.styleTraces(source,policy,profile);
assert.strictEqual(display.filter(t=>t.showlegend).length,2);
assert.strictEqual(display[0].legendgrouptitle.text,'Repeated observations (100 traces)');
assert.strictEqual(new Set(display.slice(0,100).map(t=>t.legendgroup)).size,1);
assert.strictEqual(display[100].legendgroup,undefined,'summary separate');
assert.strictEqual(JSON.stringify(source),before,'source immutable');
display.forEach((t,i)=>{assert.strictEqual(t.name,source[i].name);assert.strictEqual(t.meta,source[i].meta);
 assert.strictEqual(t.x,source[i].x);assert.strictEqual(t.y,source[i].y);});
assert.deepStrictEqual(plain(p.styleTraces(JSON.parse(before),policy,profile)),plain(display),'reattach');
assert.deepStrictEqual(plain(p.styleTraces(display,policy,profile)),plain(display),'idempotent');
assert.deepStrictEqual(plain(p.styleTraces([],policy,profile)),[],'cleared');
assert.deepStrictEqual(plain(p.styleTraces(source,policy,profile)),plain(display),'repopulated');
assert.strictEqual(p.styleTraces(null,policy),null);
assert.strictEqual(p.styleTraces([source[0]],{},profile)[0],source[0],'non opted in');
assert.strictEqual(p.styleTraces([source[0]],{member:{legend:'show'}})[0].showlegend,true,'existing show');
const single=p.styleTraces([source[100]],policy,profile);
assert.strictEqual(single[0].showlegend,true,'single named trace');
for(const legend of [{mode:'unknown',title:'x'},{mode:'compact',title:''},{mode:'compact',title:3},{mode:'compact',title:'x'.repeat(201)}]) {
 const control=p.styleTraces([source[0]],{member:{token:'context',legend}},profile)[0];
 assert.strictEqual(control.showlegend,false);assert.strictEqual(control.legendgroup,undefined);
}
const separated=[{...source[0],visible:false},{...source[1],legend:'legend2'},
 {...source[2],legendgroup:'producer-a'},{...source[3],legendgroup:'producer-b'}];
const separate=p.styleTraces(separated,policy,profile);
assert.strictEqual(separate[0].showlegend,false,'invisible excluded');
assert.strictEqual(separate[1].legend,'legend2');assert.strictEqual(separate[1].showlegend,true);
assert.strictEqual(separate[2].legendgroup,'producer-a');assert.strictEqual(separate[3].legendgroup,'producer-b');
assert.strictEqual(separate[2].legendgrouptitle.text,'Repeated observations (1 traces)');
const ui2=fs.readFileSync(process.argv[3],'utf8');assert(ui2.includes('GenAppPlotPresentation?.styleTraces?.('));
console.log('compact, controls, groups, lifecycle, identity and reconstruction passed');
JS
close $fh;
my ($status,$output)=run_command(cwd=>$repo,cmd=>['node',$script,
 File::Spec->catfile($repo,qw(languages ui2 add js plot-presentation.js)),
 File::Spec->catfile($repo,qw(languages ui2 add js ui2.js))]);
is($status,0,'generic compact legend contract') or diag($output);
like($output,qr/reconstruction passed/,'all legend assertions completed');
done_testing();
