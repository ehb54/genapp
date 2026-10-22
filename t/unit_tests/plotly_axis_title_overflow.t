use strict;
use warnings;
use File::Spec;
use File::Temp qw(tempfile);
use FindBin;
use Test::More;
use lib File::Spec->catdir($FindBin::Bin, '..', 'lib');
use GenAppTest qw(repo_root run_command);
my $repo=repo_root(File::Spec->catdir($FindBin::Bin, '..'));
my ($fh,$script)=tempfile('axis-title-margin-XXXX',SUFFIX=>'.js',TMPDIR=>1,UNLINK=>1);
print {$fh} <<'JS';
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const clone=x=>JSON.parse(JSON.stringify(x));
const context={window:{}};vm.createContext(context);
vm.runInContext(fs.readFileSync(process.argv[2],'utf8'),context);
const w=context.window,p=w.GenAppPlotlyLayout,selection={axisTitleOverflow:'wrap'},options={measureText:t=>t.length*10};
let calls=0;
w.Plotly={relayout(g,u){calls++;for(const [key,value] of Object.entries(u)){let o=g.layout;const parts=key.split('.');for(const part of parts.slice(0,-1)){if(typeof o[part]==='string')o[part]={text:o[part]};o=o[part]??=( {} );}if(value===null)delete o[parts.at(-1)];else o[parts.at(-1)]=value;}return Promise.resolve();}};
const source={yaxis2:{title:'Observed samples / retained observation',range:[-1,1]}};
const saved=JSON.stringify(source);
const graph=()=>({layout:clone(source),_fullLayout:{yaxis2:{_length:128}}});
(async()=>{
let g=graph();await p.applyAxisTitleOverflow(g,source,selection,options);
assert.strictEqual(g.layout.yaxis2.automargin,true);assert(g.layout.yaxis2.title.text.includes('<br>'));
const oldCalls=calls;await p.applyAxisTitleOverflow(g,source,selection,options);assert.strictEqual(calls,oldCalls,'idempotent');
g._fullLayout.yaxis2._length=600;await p.applyAxisTitleOverflow(g,source,selection,options);
assert.strictEqual(g.layout.yaxis2.automargin,undefined,'expand releases helper margin');assert.strictEqual(g.layout.yaxis2.title.text,source.yaxis2.title);
g._fullLayout.yaxis2._length=128;await p.applyAxisTitleOverflow(g,source,selection,options);await p.applyAxisTitleOverflow(g,source,{},options);
assert.strictEqual(g.layout.yaxis2.automargin,undefined,'remove opt-in releases helper margin');assert.strictEqual(g.layout.yaxis2.title.text,source.yaxis2.title);
for(const value of [false,true,'left+right'])for(const place of ['axis','numbered-template','base-template']){
 const s=clone(source);if(place==='axis')s.yaxis2.automargin=value;else s.template={layout:{[place==='base-template'?'yaxis':'yaxis2']:{automargin:value}}};
 const u=p.axisTitleWrapUpdate(graph(),s,selection,options)||{};assert(!('yaxis2.automargin' in u),place+' setting preserved');
}
for(const template of ['registered-profile',{layout:{yaxis:{automargin:false}}}]){
 const s={...clone(source),template};assert(!('yaxis2.automargin' in (p.axisTitleWrapUpdate(graph(),s,selection,options)||{})));
}
g=graph();await p.applyAxisTitleOverflow(g,source,selection,options);
const explicit=clone(source);explicit.yaxis2.automargin=false;await p.applyAxisTitleOverflow(g,explicit,selection,options);assert.strictEqual(g.layout.yaxis2.automargin,false,'new producer override wins');
for(const title of ['Short','Energy <sup>2</sup>']){
 const s={yaxis2:{title}};const u=p.axisTitleWrapUpdate(graph(),s,selection,options)||{};assert(!('yaxis2.automargin' in u));
}
assert.strictEqual(p.axisTitleWrapUpdate(graph(),source,{},options),null);
g=graph();g.layout.yaxis2.automargin=true;await p.applyAxisTitleOverflow(g,source,selection,options);await p.applyAxisTitleOverflow(g,source,{},options);assert.strictEqual(g.layout.yaxis2.automargin,true,'pre-existing display setting not helper-owned');
assert.strictEqual(JSON.stringify(source),saved,'source immutable');
assert.deepStrictEqual(graph().layout.yaxis2.range,[-1,1]);
console.log('wrapped margin opt-in, overrides, release, idempotence and reconstruction passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
JS
close $fh;
my ($status,$output)=run_command(cwd=>$repo,cmd=>['node',$script,File::Spec->catfile($repo,qw(languages ui2 add js plotly-layout.js))]);
is($status,0,'narrow wrapped-title margin contract') or diag($output);
like($output,qr/reconstruction passed/,'all lifecycle and override assertions completed');
ok(-f File::Spec->catfile($repo,qw(t fixtures plotly_axis_title_overflow.html)),'neutral real-Plotly fixture available for browser acceptance');
done_testing();
