use strict;
use warnings;
use File::Spec;
use File::Temp qw(tempfile);
use FindBin;
use Test::More;
use lib File::Spec->catdir($FindBin::Bin, '..', 'lib');
use GenAppTest qw(repo_root run_command);
plan skip_all => 'Set GENAPP_LEGEND_BROWSER to an installed Chrome executable' unless $ENV{GENAPP_LEGEND_BROWSER};
my $repo=repo_root(File::Spec->catdir($FindBin::Bin,'..'));
my ($fh,$runner)=tempfile('legend-overflow-XXXX',SUFFIX=>'.py',TMPDIR=>1,UNLINK=>1);
print {$fh} <<'PYTHON';
import base64, functools, http.server, io, json, os, sys, threading
from PIL import Image
from playwright.sync_api import sync_playwright
class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*args): pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=sys.argv[1]))
threading.Thread(target=server.serve_forever,daemon=True).start()
checks=[]
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=sys.argv[2],headless=True,args=['--use-mock-keychain'])
    page=browser.new_page(viewport={'width':550,'height':900})
    if os.environ.get('GENAPP_LEGEND_BASELINE'):
        page.route('**/plotly-layout.js',lambda route:route.fulfill(path=os.environ['GENAPP_LEGEND_BASELINE'],content_type='text/javascript'))
    page.goto('http://127.0.0.1:%s/t/fixtures/plotly_legend_overflow.html'%server.server_port)
    page.evaluate('window.ready')
    for dark in [False,True]:
        page.evaluate('(dark)=>legendTest.render(8,dark)',dark)
        for width in [550,1050,550]:
            page.set_viewport_size({'width':width,'height':900})
            page.evaluate('legendTest.settle()')
            checks.append(page.evaluate('legendTest.inspect()'))
            image=page.evaluate('legendTest.exportPng()')
            png=Image.open(io.BytesIO(base64.b64decode(image.split(',',1)[1])))
            assert png.size==(checks[-1]['width']*2,checks[-1]['height']*2),'scale-2 PNG'
            if os.environ.get('GENAPP_LEGEND_ARTIFACTS'):
                os.makedirs(os.environ['GENAPP_LEGEND_ARTIFACTS'],exist_ok=True)
                png.save(os.path.join(os.environ['GENAPP_LEGEND_ARTIFACTS'],'legend-%s-%s.png'%(dark,width)))
        # Reconstruct the same normal source in a new Plotly instance.
        page.evaluate('(dark)=>legendTest.render(8,dark)',dark)
        checks.append(page.evaluate('legendTest.inspect()'))
    for count,multiple in [(2,False),(0,False),(4,True)]:
        page.evaluate('([n,m])=>legendTest.render(n,false,m)',[count,multiple])
        checks.append(page.evaluate('legendTest.inspect()'))
    # A short control returns to its original allocation after the narrow case.
    page.set_viewport_size({'width':1050,'height':900});page.evaluate('legendTest.settle()')
    checks.append(page.evaluate('legendTest.inspect()'))
    browser.close()
server.shutdown()
print(json.dumps({'passed':True,'cases':len(checks),'checks':checks}))
PYTHON
close $fh;
my ($status,$output)=run_command(cwd=>$repo,cmd=>[$ENV{GENAPP_TEST_PYTHON}||'python3',$runner,$repo,$ENV{GENAPP_LEGEND_BROWSER}]);
is($status,0,'complete narrow legends and scale-2 PNG through production geometry') or diag($output);
like($output,qr/"passed": true/,'rendered surfaces, resize, reconstruction and small controls pass');
diag($output) if $ENV{GENAPP_LEGEND_ARTIFACTS};
done_testing();
