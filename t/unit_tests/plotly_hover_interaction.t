use strict;
use warnings;
use File::Spec;
use File::Temp qw(tempfile);
use FindBin;
use JSON qw(decode_json);
use Test::More;
use lib File::Spec->catdir($FindBin::Bin, '..', 'lib');
use GenAppTest qw(repo_root run_command);

# #348 coordinates and #349 opt-in selection are required acceptance.
# Source mutation, broken controls and missing browser evidence are failures.
plan skip_all => 'Set GENAPP_HOVER_BROWSER to an isolated Chrome executable'
    unless $ENV{GENAPP_HOVER_BROWSER};
my $repo = repo_root(File::Spec->catdir($FindBin::Bin, '..'));
my ($fh, $runner) = tempfile('hover-interaction-XXXX', SUFFIX => '.py', TMPDIR => 1, UNLINK => 1);
print {$fh} <<'PY';
import json, os, sys
from pathlib import Path
from playwright.sync_api import sync_playwright

result = {'checks': [], 'formatting': [], 'overlap': [], 'gaps': {}}
def check(value, label):
    if not value:
        raise AssertionError(label)
    result['checks'].append(label)

def sample(page, target, dx=0, dy=0):
    page.mouse.move(1, 1)
    page.wait_for_timeout(65)
    page.mouse.move(target['x']+dx, target['y']+dy)
    page.wait_for_timeout(85)
    observed = page.evaluate('hoverInteractionFixture.snapshot()')
    check(observed['sourceUnchanged'] and observed['nativeDataUnchanged'], 'pointer preserves source')
    return observed

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ['GENAPP_HOVER_BROWSER'], headless=True)
    try:
        page = browser.new_page(viewport={'width': 1100, 'height': 650})
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(Path(sys.argv[1]).resolve().as_uri())
        page.wait_for_function('window.hoverInteractionFixture !== undefined')
        result['versions'] = page.evaluate('hoverInteractionFixture.versions()')
        # #350: compare labels must retain a nearby point's own x, not only
        # the shared-coordinate header. Use actual mouse movement throughout.
        result['compare_offset']=[]
        for axis in ['linear','log']:
            for kind in ['markers','line']:
                for fit in [False,True]:
                    mounted=page.evaluate('c=>hoverInteractionFixture.compare_offset(c)',
                        dict(axis=axis,kind=kind,fit=fit,width=511))
                    if fit:check(mounted['hiddenPointFound'],'compare point uses a collision-hidden tick')
                    observed=sample(page,mounted['target'])
                    check({p['curve'] for p in observed['points']}=={0,1},'compare selects both distinct-q traces')
                    check(abs(next(p['x'] for p in observed['points'] if p['curve']==0)-mounted['point_x'])<1e-10,
                          'compare selects the original nearby coordinate')
                    label=next(row['text'] for row in observed['labels'] if row['curve']==0)
                    check(str(mounted['point_x']) in label,'compare label displays actual nearby x '+axis+' '+kind)
                    if kind=='markers':check('0.808 ± 0.010' in label,'compare retains uncertainty precision')
                    check('Neutral nearby' not in label,'compare retains name suppression')
                    check(observed['hovermode']=='x','compare mode remains active')
                    if fit:check(observed['collisionFree'],'compare retains collision protection')
                    result['compare_offset'].append(dict(axis=axis,kind=kind,fit=fit,label=label))
                    page.evaluate('hoverInteractionFixture.lifecycle("reconstruct")')
                    reconstructed=sample(page,page.evaluate('hoverInteractionFixture.target(1,0)'))
                    restored_label=next(row['text'] for row in reconstructed['labels'] if row['curve']==0)
                    check(restored_label==label,'compare reconstructs the same nearby-point label')
                mounted=page.evaluate('c=>hoverInteractionFixture.compare_offset(c)',
                    dict(axis=axis,kind=kind,fit=True,width=511,same_x=True))
                shared=sample(page,mounted['target'])
                check({p['curve'] for p in shared['points']}=={0,1},'shared-q compare selects both traces')
                check(all(abs(p['x']-mounted['point_x'])<1e-10 for p in shared['points']),
                      'shared-q compare retains original coordinates')
                check(str(mounted['point_x']) in shared['text'],'shared-q coordinate remains displayed')
                check(shared['sourceUnchanged'] and shared['nativeDataUnchanged'],'shared-q sources unchanged')

        # Identify a tick actually hidden by the unchanged production fitter,
        # then inspect that same scientific coordinate in every control.
        for axis in ['linear', 'log']:
            for kind in ['markers', 'line']:
                fitted = page.evaluate('c => hoverInteractionFixture.formatting(c)',
                    {'axis': axis, 'kind': kind, 'width':511, 'fit': True, 'precision': 'uncertainty-2', 'suppress': True})
                check(fitted['hiddenPointFound'], 'production fitter hides a supplied '+axis+' coordinate')
                point = fitted['point']
                visible_target=page.evaluate('point=>hoverInteractionFixture.target(0,point)',fitted['unmaskedPoint'])
                unmasked=sample(page,visible_target)
                check(bool(unmasked['points']) and bool(unmasked['text']),'unmasked points retain native hover')
                missing = sample(page, fitted['target'])
                check(bool(missing['points']), 'real pointer selects fitted '+axis+' '+kind)
                item = {'axis':axis, 'kind':kind, 'x':fitted['x'], 'fitted':missing,
                        'hiddenValues':fitted['hiddenValues'], 'controls':[]}
                # For every rerender use the same point, not a different tick.
                for fit, precision, suppress in [(False,None,False),(False,'.6g',False),
                    (False,'uncertainty-2',False),(False,'uncertainty-2',True),
                    (True,None,False),(True,'.6g',False),(True,'uncertainty-2',False)]:
                    mounted = page.evaluate('c => hoverInteractionFixture.formatting(c)',
                        {'axis':axis,'kind':kind,'width':511,'fit':fit,'precision':precision,'suppress':suppress})
                    target = page.evaluate('''point => {
                        const p=document.getElementById('plot'),r=p.getBoundingClientRect(),
                        x=p._fullLayout.xaxis,y=p._fullLayout.yaxis;
                        return {x:r.left+x._offset+x.d2p(p.data[0].x[point]),
                                y:r.top+y._offset+y.d2p(p.data[0].y[point])};
                    }''', point)
                    observed = sample(page,target)
                    check(bool(observed['points']), 'real pointer selects clean '+axis+' '+kind)
                    # The native fallback format includes the visible coordinate.
                    visible = str(fitted['x'])
                    check(visible in observed['text'], 'coordinate visible '+axis+' '+kind)
                    if fit:check(observed['collisionFree'],'tick labels remain collision-free')
                    check(abs(observed['points'][0]['x']-fitted['x'])<1e-10, 'same scientific coordinate selected')
                    if suppress:
                        check('Neutral series' not in observed['text'], 'name suppression retained')
                    item['controls'].append({'fit':fit,'precision':precision,'suppress':suppress,
                        'coordinateMissing':visible not in observed['text'],'observed':observed})
                item['coordinateMissing'] = str(fitted['x']) not in missing['text']
                result['formatting'].append(item)
        result['gaps']['348'] = any(item['coordinateMissing'] for item in result['formatting'])
        result['compatibility']=[]
        for config in [
            {'axisFormat':'.2e','expectedFormat':'.2e'},
            {'traceFormat':'.3e','expectedFormat':'.3e'},
            {'template':'Q: %{x:.2e} units<br>Y: %{y}<extra></extra>','expectedFormat':'.2e','expectedPrefix':'Q: '},
            {'formatStops':[{'enabled':True,'dtickrange':[None,None],'value':'.2e'}],'expectedFormat':'.2e'},
            {'arrayLabels':True,'expected':'Authored sample'},
            {'errorX':True,'expected':'±'},
        ]:
            mounted=page.evaluate('c=>hoverInteractionFixture.formatting(c)',
                dict(config,axis='log',width=511,fit=True,suppress=True))
            observed=sample(page,mounted['target'])
            # Tick fitting may select a different masked point after a geometry
            # correction. Formatting expectations come from that actual value.
            expected=config.get('expected')
            if config.get('expectedFormat'):
                expected=config.get('expectedPrefix','')+format(mounted['x'],config['expectedFormat']).split('e')[0]+'e'
            check(expected in observed['text'],'authored/native formatting retained '+str(config))
            check('Neutral series' not in observed['text'],'compatibility names remain suppressed')
            result['compatibility'].append({'config':config,'observed':observed})
        # Intentional authored blank labels remain blank; they are not our mask.
        blank_controls=[]
        for fit in [False,True]:
            page.evaluate('c=>hoverInteractionFixture.formatting(c)',
                {'arrayLabels':True,'blankLabel':1,'width':511,'fit':fit,'suppress':True})
            blank_controls.append(sample(page,page.evaluate('hoverInteractionFixture.target(0,1)'))['text'])
        check(blank_controls[0].replace('\u200b','')==blank_controls[1].replace('\u200b',''),'intentional authored blank hover unchanged')
        for kind in ['markers','line']:
            mounted=page.evaluate('c=>hoverInteractionFixture.formatting(c)',
                {'denseY':True,'targetField':'y','axis':'linear','width':511,'fit':True,'kind':kind,'suppress':True})
            check(mounted['hiddenPointFound'],'production fitter hides a supplied y coordinate')
            observed=sample(page,mounted['target'])
            check(str(mounted['y']) in observed['text'],'masked y coordinate visible '+kind)
            if kind=='markers':check('±' in observed['text'],'native y error text retained')
        # Other supported 2D renderers consume the same repaired placeholders.
        for trace_type in ['scattergl','bar']:
            mounted=page.evaluate('c=>hoverInteractionFixture.formatting(c)',
                {'traceType':trace_type,'width':511,'fit':True,'precision':'uncertainty-2','suppress':True})
            observed=sample(page,mounted['target'],dy=3 if trace_type=='bar' else 0)
            check(str(mounted['x']) in observed['text'],'coordinate visible for '+trace_type)
        long_name='A very long neutral trace name that retains native clipping'
        for fit in [False,True]:
            mounted=page.evaluate('c=>hoverInteractionFixture.formatting(c)',
                {'kind':'line','width':511,'fit':fit,'name':long_name,'hoverinfo':'x+y+name'})
            observed=sample(page,mounted['target'])
            check(observed['nameLengths']==[15],'native/default name clipping retained')
            check(long_name not in observed['text'],'implicit-template repair does not reveal full names')
        mounted=page.evaluate('hoverInteractionFixture.formatting({axis:"log",width:511,fit:true,precision:"uncertainty-2",suppress:true})')
        result['lifecycle']=[]
        point=mounted['point']
        for action in ['wide','middle','restore','zoom','reset','update','reconstruct','editor','reconstruct']:
            changed=page.evaluate('c=>hoverInteractionFixture.lifecycle(c.action,c.point)',{'action':action,'point':point})
            observed=sample(page,changed['target'])
            check(str(mounted['x']) in observed['text'],'coordinate survives '+action)
            check(observed['collisionFree'],'collision protection survives '+action)
            if action in ['update','reconstruct','editor']:check('0.818 ± 0.010' in observed['text'],'precision refresh survives '+action)
            result['lifecycle'].append({'action':action,'observed':observed})
        exported=page.evaluate('hoverInteractionFixture.png()')
        check(exported['width']==1022 and exported['height']==960,'scale-2 PNG dimensions')
        check(exported['sourceUnchanged'] and exported['nativeDataUnchanged'],'PNG preserves source')
        result['png']={k:exported[k] for k in ['width','height','collisionFree']}
        page.evaluate('hoverInteractionFixture.lifecycle("clear")')
        repopulated=page.evaluate('c=>hoverInteractionFixture.lifecycle("repopulate",c)',point)
        check(str(mounted['x']) in sample(page,repopulated['target'])['text'],'clear/repopulate restores coordinate')
        # Compare retains its existing shared-coordinate/native presentation;
        # switching back to closest reinstates the display repair.
        for mode in ['x','closest']:
            page.evaluate('mode=>hoverInteractionFixture.hovermode(mode)',mode)
            target=page.evaluate('point=>hoverInteractionFixture.target(0,point)',point)
            observed=sample(page,target)
            check(observed['hovermode']==mode,'mode transition retained '+mode)
            if mode=='closest':check(str(mounted['x']) in observed['text'],'coordinate restored after compare')

        # Actual mouse movement around a line vertex and its overlapping marker.
        # Direct Fx.hover(curveNumber=...) is deliberately absent.
        for size in [6,11]:
            for reverse in [False,True]:
                for separation in [0,.0001]:
                    mounted=page.evaluate('c => hoverInteractionFixture.overlap(c)',
                        {'markerSize':size,'reverse':reverse,'separation':separation,'precision':'uncertainty-2'})
                    found=set(); examples=[]
                    for dx,dy in [(0,0),(-8,0),(8,0),(0,-8),(0,8),(-4,-4),(4,4)]:
                        observed=sample(page,mounted['target'],dx,dy)
                        found.update(point['curve'] for point in observed['points'])
                        examples.append({'dx':dx,'dy':dy,**observed})
                    check(bool(found),'closest hover remains usable')
                    check(mounted['legendGroups']==['paired','paired'] and mounted['groupclick']=='togglegroup',
                          'paired grouped legend preserved')
                    page.evaluate('mode => hoverInteractionFixture.hovermode(mode)','x')
                    compared=sample(page,mounted['target'])
                    curves={point['curve'] for point in compared['points']}
                    check(curves=={0,1},'compare exposes both original traces')
                    check('Neutral measured' not in compared['text'] and 'Neutral fitted' not in compared['text'],
                          'compare names remain suppressed')
                    result['overlap'].append({'markerSize':size,'reverse':reverse,'separation':separation,'closestCurves':sorted(found),
                        'lineCurve':mounted['lineCurve'],'markerCurve':mounted['markerCurve'],
                        'closest':examples,'compare':compared})
        # #349: actual controls select either trace without leaving closest mode.
        result['selection']=[]
        for width in [511,620,855]:
            for axis in ['linear','log']:
                for size in [6,11]:
                    for reverse in [False,True]:
                        for separation in [0,.0001]:
                            mounted=page.evaluate('c=>hoverInteractionFixture.overlap(c)',dict(
                                width=width,axis=axis,markerSize=size,reverse=reverse,separation=separation,
                                precision='uncertainty-2',selection=True,fit=True))
                            for kind,key in [('lines','lineCurve'),('markers','markerCurve')]:
                                page.get_by_role('button',name='Hover '+kind,exact=True).click()
                                page.evaluate('GenAppPlotlyLayout.settle_hover_trace_selection(document.getElementById("plot"))')
                                observed=sample(page,mounted['target'])
                                check(observed['hovermode']=='closest','selection remains closest '+kind)
                                check({p['curve'] for p in observed['points']}=={mounted[key]},'real pointer selects '+kind)
                                check(observed['selection'][kind]=='true','selected control is accessible '+kind)
                                check(observed['collisionFree'],'selection preserves collision fitting')
                                check('Neutral measured' not in observed['text'] and 'Neutral fitted' not in observed['text'],
                                      'selection preserves name suppression')
                                if kind=='markers':check('±' in observed['text'],'marker uncertainty survives selection')
                                check(observed['text'].count('0.0500000')==1,'coordinate appears once after selection')
                            page.get_by_role('button',name='Hover all traces',exact=True).click()
                            page.evaluate('GenAppPlotlyLayout.settle_hover_trace_selection(document.getElementById("plot"))')
                            restored=sample(page,mounted['target'])
                            check(restored['selection']['all']=='true','All restores native eligibility')
                            result['selection'].append(dict(width=width,axis=axis,size=size,reverse=reverse,separation=separation))
        # Mode changes release filters and editor handoff carries no exclusions.
        mounted=page.evaluate('hoverInteractionFixture.overlap({selection:true,fit:true,precision:"uncertainty-2"})')
        page.get_by_role('button',name='Hover lines',exact=True).click()
        page.evaluate('GenAppPlotlyLayout.settle_hover_trace_selection(document.getElementById("plot"))')
        handoff=page.evaluate('GenAppPlotlyLayout.hover_trace_selection_data(document.getElementById("plot"))')
        check(all(t.get('hoverinfo')!='skip' for t in handoff),'editor receives original hover eligibility')
        check(page.evaluate('hoverInteractionFixture.snapshot().selection.lines')=='true','handoff retains active user selection')
        page.evaluate('hoverInteractionFixture.hovermode("x")')
        page.evaluate('GenAppPlotlyLayout.settle_hover_trace_selection(document.getElementById("plot"))')
        compared=sample(page,mounted['target'])
        check({p['curve'] for p in compared['points']}=={0,1},'compare exposes both after filtering')
        check(compared['selection']['all']=='true','compare restores All')
        page.evaluate('hoverInteractionFixture.hovermode("closest")')
        page.evaluate('GenAppPlotlyLayout.settle_hover_trace_selection(document.getElementById("plot"))')
        check(page.evaluate('hoverInteractionFixture.snapshot().selection.all')=='true','return to closest starts All')
        for action in ['wide','middle','restore','zoom','reset']:
            page.get_by_role('button',name='Hover lines',exact=True).click()
            page.evaluate('GenAppPlotlyLayout.settle_hover_trace_selection(document.getElementById("plot"))')
            page.evaluate('a=>hoverInteractionFixture.lifecycle(a)',action)
            t=page.evaluate('hoverInteractionFixture.target(1,1)')
            check({p['curve'] for p in sample(page,t)['points']}=={1},'line selection survives '+action)
        page.evaluate('hoverInteractionFixture.lifecycle("reconstruct")')
        check(page.evaluate('hoverInteractionFixture.snapshot().selection.all')=='true','reconstruction resets All')
        page.get_by_role('button',name='Hover markers',exact=True).click()
        page.evaluate('GenAppPlotlyLayout.settle_hover_trace_selection(document.getElementById("plot"))')
        page.evaluate('GenAppPlotlyLayout.refresh_hover_trace_selection(document.getElementById("plot"),()=>GenAppPlotlyLayout.applyNumericHoverFormat(document.getElementById("plot"),"uncertainty-2"))')
        check(page.evaluate('hoverInteractionFixture.snapshot().selection.markers')=='true','precision refresh preserves selection')
        page.evaluate('hoverInteractionFixture.lifecycle("clear")')
        page.evaluate('hoverInteractionFixture.lifecycle("repopulate")')
        check(page.evaluate('hoverInteractionFixture.snapshot().selection.all')=='true','clear/repopulate resets All')
        page.evaluate('hoverInteractionFixture.overlap({selection:false,fit:true})')
        check(page.get_by_role('button',name='Hover lines',exact=True).count()==0,'non-opted plot has no new controls')

        # A separated pair must allow actual pointer selection of the line.
        mounted=page.evaluate('hoverInteractionFixture.overlap({separation:.025,precision:"uncertainty-2"})')
        separated=sample(page,mounted['target'])
        check(mounted['lineCurve'] in {pt['curve'] for pt in separated['points']},
              'spatially separated line is pointer selectable')
        result['separatedControl']=separated
        result['nativeClosestGap']=any(set(item['closestCurves'])!={0,1} for item in result['overlap'])
        result['gaps']['349']=len(result['selection'])!=48
        check(not errors,'no browser script errors')
        result['passed']=True
        page.evaluate('result => hoverInteractionFixture.publish(result)',result)
        if os.environ.get('GENAPP_HOVER_REPORT'):
            Path(os.environ['GENAPP_HOVER_REPORT']).write_text(json.dumps(result,indent=2)+'\n')
        # Keep stdout bounded for the harness pipe; detailed observations belong
        # in the optional JSON artifact, not a potentially blocking pipe write.
        print(json.dumps({'passed':result['passed'],'gaps':result['gaps'],
            'checkCount':len(result['checks']),
            'formatting':[{'axis':v['axis'],'kind':v['kind']} for v in result['formatting']],
            'overlap':[{'size':v['markerSize'],'reverse':v['reverse'],'separation':v['separation']}
                       for v in result['overlap']]}))
    finally:
        browser.close()
PY
close $fh;
my ($status, $output) = run_command(cwd => $repo, cmd => [
    $ENV{GENAPP_HOVER_PYTHON} || 'python3', $runner,
    File::Spec->catfile($repo, qw(t fixtures plotly_hover_interaction.html))]);
is($status, 0, 'neutral real-pointer diagnostic controls complete') or diag($output);
if ($status == 0) {
    my $report = eval { decode_json($output) };
    ok($report && $report->{passed}, 'browser diagnostic report is valid') or diag($output);
    if ($report) {
        cmp_ok(scalar @{$report->{formatting}}, '==', 4, 'linear/log and marker/line formatting cases');
        cmp_ok(scalar @{$report->{overlap}}, '==', 8, 'marker sizes, trace orders and near-overlap controls');
        note($report->{checkCount} . ' source, formatting and pointer-control checks');
        ok(!$report->{gaps}{348}, 'masked ticks retain numeric hover coordinates');
        ok(!$report->{gaps}{349}, 'closest pointer can inspect both traces through opt-in controls');
    }
}
done_testing();
