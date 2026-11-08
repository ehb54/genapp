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
assert.strictEqual(display.length,102);
assert.strictEqual(display[101].name,'Repeated observations (100 traces)');
assert.strictEqual(display[101]._genappCompactLegendProxy,true);
assert.deepStrictEqual(plain(display[101].x),[null]);
assert.deepStrictEqual(plain(display[101].y),[null]);
assert.strictEqual(display[101].hoverinfo,'skip');
assert.strictEqual(display[101].meta,undefined);
assert.strictEqual(display[0].showlegend,false);
assert.strictEqual(new Set(display.slice(0,100).map(t=>t.legendgroup)).size,1);
assert.strictEqual(display[100].legendgroup,undefined,'summary separate');
assert.strictEqual(JSON.stringify(source),before,'source immutable');
display.slice(0,source.length).forEach((t,i)=>{assert.strictEqual(t.name,source[i].name);assert.strictEqual(t.meta,source[i].meta);
 assert.strictEqual(t.x,source[i].x);assert.strictEqual(t.y,source[i].y);});
assert.deepStrictEqual(plain(p.styleTraces(JSON.parse(before),policy,profile)),plain(display),'reattach');
assert.deepStrictEqual(plain(p.styleTraces(display,policy,profile)),plain(display),'idempotent');
assert.deepStrictEqual(plain(p.styleTraces([],policy,profile)),[],'cleared');
assert.deepStrictEqual(plain(p.styleTraces(source,policy,profile)),plain(display),'repopulated');
assert.strictEqual(p.styleTraces(null,policy),null);
assert.strictEqual(p.styleTraces([source[0]],{},profile)[0],source[0],'non opted in');
assert.strictEqual(p.styleTraces([source[0]],{member:{legend:'show'}})[0].showlegend,true,'existing show');
for(const count of [1,2,4,5]) {
 const result=p.styleTraces(source.slice(0,count),policy,profile);
 assert.strictEqual(result.length,count+(count>4?1:0));
 assert.strictEqual(result.filter(t=>t.showlegend).length,count>4?1:count);
 result.slice(0,count).forEach((t,i)=>assert.strictEqual(t.name,source[i].name));
 if(count>4)assert.strictEqual(result[count].name,'Repeated observations (5 traces)');
}
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

vm.runInContext(fs.readFileSync(require('path').join(require('path').dirname(process.argv[2]),'plotly-layout.js'),'utf8'),context);
const layoutPolicy=context.window.GenAppPlotlyLayout;
assert.strictEqual(typeof layoutPolicy.prepareLegendLayout,'function','MISSING_CAPABILITY: view-selected compact legend layout');
const legendSelection={legendLayout:{columns:2,order:'row',groupTitles:'hidden'}};
const legendSource={legend:{font:{size:12},title:{text:'Keep title'}}};
const legendBefore=JSON.stringify(legendSource);
const legendDisplay=layoutPolicy.prepareLegendLayout(legendSource,legendSelection);
assert.strictEqual(legendDisplay.legend.entrywidth,.5);
assert.strictEqual(legendDisplay.legend.entrywidthmode,'fraction');
assert.strictEqual(legendDisplay.legend.traceorder,'normal');
assert.strictEqual(legendDisplay.legend.font.size,12);
assert.strictEqual(JSON.stringify(legendSource),legendBefore);
assert.strictEqual(layoutPolicy.prepareLegendLayout(legendSource,{}),legendSource);
const named=[{name:'Observation 1',x:[1,2],y:[3,4],legendgroup:'observations',legendgrouptitle:{text:'Observations'}},
 {name:'Observations (50 traces)',x:[null],y:[null],_genappCompactLegendProxy:true}];
const namesBefore=JSON.stringify(named);
const namedDisplay=layoutPolicy.prepareLegendData(named,legendSelection);
assert.strictEqual(namedDisplay[0].legendgrouptitle.text,'');
assert.strictEqual(namedDisplay[0].name,named[0].name);
assert.strictEqual(namedDisplay[0].x,named[0].x);
assert.strictEqual(namedDisplay[1],named[1]);
assert.strictEqual(JSON.stringify(named),namesBefore);
assert.strictEqual(layoutPolicy.prepareLegendData(named,{}),named);


const aliasSource={yaxis:{title:{text:'Long observation name',font:{size:12}},range:[0,1]}};
const aliases={axisTitleAliases:{yaxis:{from:'Long observation name',to:'Observation'}}};
const aliasDisplay=layoutPolicy.prepareAxisTitleAliases(aliasSource,aliases);
assert.strictEqual(aliasDisplay.yaxis.title.text,'Observation');
assert.strictEqual(aliasSource.yaxis.title.text,'Long observation name');
assert.strictEqual(aliasDisplay.yaxis.range,aliasSource.yaxis.range);
assert.strictEqual(aliasDisplay.yaxis.title.font,aliasSource.yaxis.title.font);
assert.strictEqual(layoutPolicy.prepareAxisTitleAliases(aliasSource,{}),aliasSource);
assert.strictEqual(layoutPolicy.prepareAxisTitleAliases(aliasSource,
 {axisTitleAliases:{yaxis:{from:'Different name',to:'Observation'}}}).yaxis,aliasSource.yaxis);
const narrowLegend={_fullLayout:{_size:{w:250},legend:{entrywidth:.5}},
 querySelectorAll:()=>[{getBBox:()=>({width:100})}]};
assert.strictEqual(layoutPolicy.responsiveLegendUpdate(narrowLegend,legendSelection)['legend.entrywidth'],1);
assert.strictEqual(layoutPolicy.responsiveLegendUpdate(narrowLegend,{}),null);
assert.strictEqual(layoutPolicy.responsiveLegendUpdate({...narrowLegend,_fullLayout:{_size:{w:600},legend:{entrywidth:1}}},
 legendSelection)['legend.entrywidth'],.5);


const from='sample %{x:.0f}<br>observation value %{y:.3f}<extra>details</extra>';
const to='sample %{x:.0f}<br>observation<br>value %{y:.3f}<extra>details</extra>';
const hoverSource=[{x:[1],y:[2],name:'Observation',hovertemplate:from}];
const breaks={hoverTemplateLineBreaks:[{from,to}]};
const wrapped=layoutPolicy.prepareHoverTemplateLineBreaks(hoverSource,breaks);
assert.strictEqual(wrapped[0].hovertemplate,to);
assert.strictEqual(hoverSource[0].hovertemplate,from);
assert.strictEqual(wrapped[0].x,hoverSource[0].x);
assert.strictEqual(wrapped[0].y,hoverSource[0].y);
assert.strictEqual(layoutPolicy.prepareHoverTemplateLineBreaks(hoverSource,{}),hoverSource);
for(const bad of [to.replace('.3f','.2f'),to.replace('observation','different'),to.replace('details','other')]){
 assert.strictEqual(layoutPolicy.prepareHoverTemplateLineBreaks(hoverSource,{hoverTemplateLineBreaks:[{from,to:bad}]}),hoverSource);
}
const suppressed=[{...hoverSource[0],hovertemplate:from.replace('details','')}];
assert.strictEqual(layoutPolicy.prepareHoverTemplateLineBreaks(suppressed,breaks)[0].hovertemplate,to.replace('details',''));

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
