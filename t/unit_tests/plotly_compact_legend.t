use strict;
use warnings;
use File::Spec;
use File::Temp qw(tempfile);
use FindBin;
use Test::More;
use lib File::Spec->catdir($FindBin::Bin, '..', 'lib');
use GenAppTest qw(repo_root run_command);
my $repo = repo_root(File::Spec->catdir($FindBin::Bin, '..'));
plan skip_all => 'Set GENAPP_LEGEND_BROWSER to an installed Chrome executable' unless $ENV{GENAPP_LEGEND_BROWSER};
my ($fh,$runner)=tempfile('compact-legend-XXXX',SUFFIX=>'.py',TMPDIR=>1,UNLINK=>1);
print {$fh} <<'PY';
import base64, io, json, os, sys
from PIL import Image
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=sys.argv[2],headless=True,args=['--no-first-run','--no-default-browser-check','--use-mock-keychain'])
    page=browser.new_page(viewport={'width':1000,'height':900})
    page.set_content('<div id="plot" style="width:960px;height:800px"></div>')
    for path in ['languages/html5/add/js/plotly-2.35.2.min.js','languages/ui2/add/js/plotly-surface.js','languages/ui2/add/js/plot-presentation.js']:
        page.add_script_tag(path=os.path.join(sys.argv[1],path))
    result=page.evaluate(r'''async()=>{
      const plot=document.getElementById('plot'),api=GenAppPlotPresentation;
      const policy={member:{token:'members',legend:{mode:'compact',title:'Individual observations'}},average:{legend:'show'}};
      const profile={palette:{members:'#517d94'},styles:{members:{color:'members',line_width:1,opacity:0.25,legend:'hidden'}}};
      const source=n=>Array.from({length:n},(_,i)=>({type:'scatter',mode:'lines',name:'Observation '+(i+1),x:[1,2],y:[i+1,i+2],meta:{series_role:'member'}}));
      const checks=[],images=[];const check=(ok,label)=>{if(!ok)throw Error(label);checks.push(label);};
      for(const n of [1,2,4,5,100])for(const [paper,bg,text] of [['#fff','#202725','rgb(238, 244, 241)'],['#202725','#fff','rgb(23, 32, 29)']]){
        const data=source(n),saved=JSON.stringify(data);
        const layout={paper_bgcolor:paper,plot_bgcolor:paper,showlegend:true,hoverlabel:{namelength:-1},legend:{bgcolor:bg},margin:{b:160}};
        GenAppPlotlySurface.apply(layout);
        const display=api.styleTraces(data,policy,profile);
        await Plotly.react(plot,display,layout,{displayModeBar:false});
        const legendText=[...plot.querySelectorAll('.legendtext')];
        const heading='Individual observations ('+n+' traces)';
        const labels=legendText.map(node=>node.textContent).filter(text=>n>4||text!==heading);
        check(labels.length===(n>4?1:n),'bounded entries '+n);
        check(n>4?labels[0]==='Individual observations ('+n+' traces)':labels.every((name,i)=>name===data[i].name),'unambiguous names '+n);
        if(n<=4)check(getComputedStyle(legendText.find(node=>node.textContent===heading)).fill===text,'heading follows legend surface');
        check(plot._fullLayout.xaxis.range[0]>0&&plot._fullLayout.xaxis.range[1]<3,'proxy adds no x extent');
        Plotly.Fx.hover(plot,[{curveNumber:0,pointNumber:0}]);
        await new Promise(resolve=>setTimeout(resolve,80));
        check(plot._fullData[0].name==='Observation 1' && (n===1?plot.querySelector('.hoverlayer').textContent.includes('(1, 1)'):plot.querySelector('.hoverlayer').textContent.includes('Observation 1')),'real hover identity '+n);
        if(n===2){Plotly.Fx.hover(plot,[{curveNumber:1,pointNumber:0}]);await new Promise(resolve=>setTimeout(resolve,80));check(plot.querySelector('.hoverlayer').textContent.includes('Observation 2'),'second member hover identity');}
        check(JSON.stringify(data)===saved,'source immutable');
        check(JSON.stringify(api.styleTraces(display,policy,profile))===JSON.stringify(display),'idempotent display');
        images.push(await Plotly.toImage(plot,{format:'png',width:960,height:800}));
      }
      // Reproduce a member exactly overlapping the selected average.
      const overlap=source(2);overlap.push({...overlap[1],name:'Selected average',meta:{series_role:'average'}});
      await Plotly.react(plot,api.styleTraces(overlap,policy,profile),{showlegend:true});
      check([...plot.querySelectorAll('.legendtext')].map(n=>n.textContent).filter(name=>!name.startsWith('Individual observations')).join('|')==='Observation 1|Observation 2|Selected average','overlap remains named');
      const many=source(5),saved=JSON.stringify(many);
      await Plotly.react(plot,api.styleTraces(many,policy,profile),{showlegend:true});
      return {checks,images,saved};
    }''')
    # Exercise native legend interaction, not an emulated group update.
    page.locator('.legendtoggle').click()
    page.wait_for_timeout(400)
    assert page.evaluate("document.getElementById('plot').data.slice(0,5).every(t=>t.visible==='legendonly')"), 'generic key toggles all real members'
    page.locator('.legendtoggle').click()
    page.wait_for_timeout(400)
    assert page.evaluate("document.getElementById('plot').data.slice(0,5).every(t=>t.visible===true)"), 'generic key restores all real members'
    page.evaluate("async()=>{const p=document.getElementById('plot');await Plotly.react(p,GenAppPlotPresentation.styleTraces([],{}),{showlegend:true});}")
    assert page.locator('.legendtext').count()==0, 'empty clears legend'
    for image in result.pop('images'):
        png=base64.b64decode(image.split(',',1)[1]);img=Image.open(io.BytesIO(png))
        assert img.format=='PNG' and img.size==(960,800), 'real PNG export'
    browser.close()
    print(json.dumps({'passed':True,'checks':len(result['checks']),'png_exports':10,'interaction':'hide/restore passed'}))
PY
close $fh;
my ($status,$output)=run_command(cwd=>$repo,cmd=>[$ENV{GENAPP_TEST_PYTHON} || 'python3',$runner,$repo,$ENV{GENAPP_LEGEND_BROWSER}]);
is($status,0,'real Plotly compact legends, hover, surfaces, lifecycle and group interaction') or diag($output);
like($output,qr/"passed": true/,'real renderer and ten PNG exports passed');
done_testing();
