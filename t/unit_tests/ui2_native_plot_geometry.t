use strict;
use warnings;
use File::Spec;
use File::Temp qw(tempfile);
use FindBin;
use Test::More;
use lib File::Spec->catdir($FindBin::Bin, '..', 'lib');
use GenAppTest qw(repo_root run_command);
my $repo=repo_root(File::Spec->catdir($FindBin::Bin,'..'));
my ($fh,$script)=tempfile('native-geometry-XXXX',SUFFIX=>'.js',TMPDIR=>1,UNLINK=>1);
print {$fh} <<'JS';
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync(process.argv[2]+'/languages/ui2/add/js/ui2.js','utf8');
const code=source.slice(source.indexOf('  function plotPresentationForOutput('),source.indexOf('  function plotPresentationProfileForOutput('));
const c={window:{},state:{view:{}},reactWorkbenchRoot:null,cloneUi2Value:v=>JSON.parse(JSON.stringify(v))};vm.createContext(c);vm.runInContext(code,c);
vm.runInContext(fs.readFileSync(process.argv[2]+'/languages/ui2/add/js/plotly-layout.js','utf8'),c);
const clone=v=>JSON.parse(JSON.stringify(v)),get=o=>clone(c.plotGeometryForOutput(o));
const make=(id,host=null,parent=null)=>({isConnected:true,dataset:{outputFieldId:id},closest:s=>s==='[data-plot-presentation]'?host:parent});
const selected={axisTickFormats:{yaxis:'.4~g',xaxis:'.4~g'},figureTitleOverflow:'wrap',hoverNameDisplay:'full',profile:'unchanged',traceRoles:{role:'token'}};
const group={outputs:['ordinary','dynamic'],plotPresentation:selected};c.state.view={renderer:'react-workbench',results:{groups:[group]}};
const before=JSON.stringify(c.state.view),o=make('ordinary');
assert.deepStrictEqual(get(o),{axisTickFormats:selected.axisTickFormats,figureTitleOverflow:'wrap'});
assert.deepStrictEqual(clone(c.plotPresentationForOutput(o)),{},'hover/profile resolver unchanged');
const parent={dataset:{outputFieldId:'dynamic'}};assert.deepStrictEqual(get(make('opaque_child',null,parent)),get(o));
assert.deepStrictEqual(get(make('unassigned')),{});assert.deepStrictEqual(get({...o,isConnected:false}),{});
c.reactWorkbenchRoot={};assert.deepStrictEqual(get(o),{});c.reactWorkbenchRoot=null;
for(const raw of ['{}','null','[]','broken']) assert.deepStrictEqual(get(make('ordinary',{dataset:{plotPresentation:raw}})),{},'explicit host stays authoritative');
assert.deepStrictEqual(get(make('unassigned',{dataset:{plotPresentation:JSON.stringify(selected)}})),get(o));
const detached=get(o);detached.axisTickFormats.yaxis='bad';assert.strictEqual(selected.axisTickFormats.yaxis,'.4~g');
assert.strictEqual(JSON.stringify(c.state.view),before);
c.state.view.results.groups.push({outputs:['ordinary'],plotPresentation:{figureTitleOverflow:'wrap',axisTickFormats:{xaxis:'.4~g',yaxis:'.4~g'}}});assert.deepStrictEqual(get(o),{axisTickFormats:selected.axisTickFormats,figureTitleOverflow:'wrap'});
c.state.view.results.groups[1].plotPresentation.axisTickFormats.yaxis='.2g';assert.deepStrictEqual(get(o),{});
c.state.view.results.groups=[group];
const p=c.window.GenAppPlotlyLayout,scientific={yaxis:{type:'log'},xaxis:{type:'log'},hovermode:'x unified',hoverlabel:{namelength:0}},saved=JSON.stringify(scientific);
const prepared=p.prepareNumericTickFormat(scientific,get(o));assert.strictEqual(prepared.yaxis.tickformat,'.4~g');assert.strictEqual(prepared.hovermode,scientific.hovermode);assert.deepStrictEqual(prepared.hoverlabel,scientific.hoverlabel);assert.strictEqual(JSON.stringify(scientific),saved);
for(const override of [{tickformat:'.2r'},{tickformatstops:[{value:'.2r'}]},{tickmode:'array',ticktext:['a'],tickvals:[1]}]){const s={yaxis:{type:'log',...override}};assert.strictEqual(p.prepareNumericTickFormat(s,get(o)),s);}
const template={yaxis:{type:'log'},template:{layout:{yaxis:{tickformat:'.2r'}}}};assert.strictEqual(p.prepareNumericTickFormat(template,get(o)),template);
c.state.view={results:{groups:[]}};assert.deepStrictEqual(get(make('opaque_child',null,parent)),{},'new context cannot reuse selection');
for(const groups of [null,{},[null], [{outputs:'ordinary',plotPresentation:selected}], [{outputs:['ordinary'],plotPresentation:[]}]] ) {c.state.view={results:{groups}};assert.deepStrictEqual(get(o),{});}
// Production geometry consumers must use the new path; hover/style consumers must not.
assert(source.includes('hoverLayout, plotGeometryForOutput(output)'));
assert(source.includes('tickLayout, plotGeometryForOutput(output)'));
const geometry=source.slice(source.indexOf('  function fitPlotlyAxisTitles('),source.indexOf('  function plotlyOutputReadyForRelayout('));assert(!geometry.includes('plotPresentationForOutput(output)'));
const hover=source.slice(source.indexOf('const hoverLayout ='),source.indexOf('const tickLayout ='));assert(hover.includes('plotPresentationForOutput(output)'));
assert(source.includes('Shared fitting settles ticks and measured axis-title clearance together.'));
console.log('native geometry resolution, dynamic inheritance, conflicts, controls, tick precedence, context reset and hover preservation passed');
// Exercise production observer callbacks and resize promises, not manual fits.
const functions=['observeFitPlotlyOutput','disconnectPlotlyOutputObserver','resizePlotlyOutputWhenVisible','resizePlotlyOutputToVisibleBox','releasePlotlyOutputs','applyPlotlyModebarHooks'];
vm.runInContext(functions.map(n=>{const a=source.indexOf('  function '+n+'('),b=source.indexOf('\n  function ',a+1);return source.slice(a,b);}).join('\n'),c);
const frames=new Map(),timers=new Map(),observers=[];let next=1,fitCalls=0,resizeCalls=0,purges=0,releaseResize=null;
c.window.requestAnimationFrame=fn=>{const id=next++;frames.set(id,fn);return id;};c.window.cancelAnimationFrame=id=>frames.delete(id);
c.window.setTimeout=fn=>{const id=next++;timers.set(id,fn);return id;};c.window.clearTimeout=id=>timers.delete(id);
c.ResizeObserver=class{constructor(cb){this.cb=cb;observers.push(this)}observe(target){this.target=target}disconnect(){this.disconnected=true}};
c.debugPlotlyResize=()=>{};c.refreshPlotlyOutputIfNeeded=()=>null;c.fitPlotlyPresentationGeometry=async()=>{fitCalls++};
c.window.Plotly={Plots:{resize:async()=>{resizeCalls++;if(releaseResize)await new Promise(r=>releaseResize=r)}},purge:()=>purges++};
const output=(pane=false)=>({isConnected:true,dataset:{},data:[],parentElement:{native:true},closest:()=>pane?{pane:true}:null,offsetParent:{},getBoundingClientRect:()=>({width:488,height:480})});
const drain=()=>{const queued=[...frames.values()];frames.clear();queued.forEach(fn=>fn());};
const microtasks=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
(async()=>{
 for(const pane of [false,true]){
  const g=output(pane);c.observeFitPlotlyOutput(g);const o=g._ui2PlotlyResizeObserver;assert(o,'observer for both renderers');assert(pane?o.target.pane:o.target===g.parentElement);
  const notify=(w=488)=>o.cb([{contentRect:{width:w,height:480}}]);notify();notify(600);assert.strictEqual(frames.size,1,'coalesce notifications');drain();await g._ui2PlotlyResizePromise;const count=fitCalls;assert(count>0);
  notify(600);assert.strictEqual(frames.size,0,'unchanged allocation ignored');notify(700);c.disconnectPlotlyOutputObserver(g);assert.strictEqual(frames.size,0,'cancel queued frame');drain();await microtasks();assert.strictEqual(fitCalls,count,'cancelled callback cannot fit');
  c.observeFitPlotlyOutput(g);const current=g._ui2PlotlyResizeObserver;notify(800);drain();await microtasks();assert.strictEqual(fitCalls,count,'old observer callback cannot fit replacement');assert.strictEqual(g._ui2PlotlyResizeObserver,current);
  g.offsetParent=null;c.resizePlotlyOutputWhenVisible(g);assert.strictEqual(timers.size,1);c.disconnectPlotlyOutputObserver(g);assert.strictEqual(timers.size,0,'cancel hidden retry');
 }
 const g=output();c.observeFitPlotlyOutput(g);releaseResize=true;const pending=c.resizePlotlyOutputToVisibleBox(g,{});await microtasks();assert.strictEqual(typeof releaseResize,'function');const previous=fitCalls;c.disconnectPlotlyOutputObserver(g);releaseResize();releaseResize=null;await pending;assert.strictEqual(fitCalls,previous,'disconnect during resize prevents delayed fit');
 c.observeFitPlotlyOutput(g);const releaseScope={querySelectorAll:()=>[g]};c.releasePlotlyOutputs(releaseScope);assert.strictEqual(g._ui2PlotlyResizeObserver,null);assert.strictEqual(purges,1,'release purges rendered child');

 for(const name of ['updateDynamicOutput','clearRuntimeOutputs']){const a=source.indexOf('  function '+name+'('),b=source.indexOf('\n  function ',a+1);vm.runInContext(source.slice(a,b),c);}
 c.dynamicOutputItems=(group,payload)=>payload.items;c.el=()=>({});c.dynamicOutputPlaceholder=()=>'';c.clearRuntimeOutputAvailability=()=>{};c.HTMLProgressElement=class{};c.outputPlaceholderForType=()=>'';
 const child=output();child.dataset={outputType:'plotly',outputFieldId:'child'};child.classList={remove:()=>{}};
 c.observeFitPlotlyOutput(child);let removed=0;const instance={querySelector:()=>child,querySelectorAll:()=>[child],remove:()=>removed++};
 const groupNode={dataset:{},closest:()=>({hidden:false}),classList:{remove:()=>{},add:()=>{}},append:()=>{},querySelectorAll:s=>s==='[data-output-type="plotly"]'?[child]:s==='.ui2-dynamic-output-instance'?[instance]:[]};
 c.updateDynamicOutput(groupNode,{items:[]});assert.strictEqual(removed,1);assert.strictEqual(child._ui2PlotlyResizeObserver,null,'dynamic empty removes observer');
 c.observeFitPlotlyOutput(child);c.clearRuntimeOutputs({querySelectorAll:()=>[child]});assert.strictEqual(child._ui2PlotlyResizeObserver,null,'reset disconnects static output');
 const noObserver=c.ResizeObserver;c.ResizeObserver=undefined;c.observeFitPlotlyOutput(output());c.ResizeObserver=noObserver;
 const detached=output();detached.isConnected=false;c.observeFitPlotlyOutput(detached);assert.strictEqual(detached._ui2PlotlyResizeObserver,null);
 // Both existing modebar hooks must await real resize before transfer.
 let exported=0,opened=0;c.window.Plotly.Icons={camera:{},pencil:{}};c.window.Plotly.downloadImage=async()=>exported++;
 c.window.localStorage={setItem:()=>{}};c.window.open=()=>opened++;c.chartEditorLayout=x=>x;c.chartEditorUrl=()=>'/editor';
 c.window.GenAppPlotlyLayout.settleTickDensity=async()=>{};
 const cfg={genapp_chart_editor:{enabled:true,url:'/editor'}};c.applyPlotlyModebarHooks({config:{}},cfg);
 for(const name of ['fittedImage','editInChartEditor']){
  const graph=output();graph._fullLayout={width:488,height:480};releaseResize=true;
  const transfer=cfg.modeBarButtonsToAdd.find(b=>b.name===name).click(graph);await microtasks();const before=exported+opened;assert.strictEqual(typeof releaseResize,'function');await microtasks();assert.strictEqual(exported+opened,before,'transfer waits for resize');releaseResize();releaseResize=null;await transfer;assert.strictEqual(exported+opened,before+1);
 }
 console.log('native and pane resize events, coalescing, teardown, stale callbacks and export settlement passed');
})().catch(error=>{console.error(error);process.exitCode=1;});

JS
close $fh;
my ($status,$output)=run_command(cwd=>$repo,cmd=>['node',$script,$repo]);
is($status,0,'native plot geometry contract') or diag($output);
like($output,qr/hover preservation passed/,'all focused checks complete');
like($output,qr/export settlement passed/,'observer lifecycle and transfer checks complete');
ok(-f File::Spec->catfile($repo,qw(t fixtures ui2_native_plot_geometry.html)),'neutral browser fixture present');
done_testing();
