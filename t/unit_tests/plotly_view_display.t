use strict;
use warnings;
use FindBin;
use File::Spec;
use File::Temp qw(tempfile);
use Test::More;
my $repo=File::Spec->rel2abs(File::Spec->catdir($FindBin::Bin,'..','..'));
my ($fh,$runner)=tempfile('view-display-XXXX',SUFFIX=>'.py',TMPDIR=>1,UNLINK=>1);
print {$fh} <<'PYRUN';
import functools,http.server,json,os,pathlib,sys,threading
from playwright.sync_api import sync_playwright
class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=sys.argv[1]))
threading.Thread(target=server.serve_forever,daemon=True).start()
errors=[]
try:
    with sync_playwright() as pw:
        browser=pw.chromium.launch(headless=True,args=['--disable-dev-shm-usage'])
        page=browser.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(f'http://127.0.0.1:{server.server_port}/t/fixtures/plotly_view_display.html')
        page.wait_for_function('window.viewDisplayAcceptance',timeout=30000)
        result=page.evaluate('window.viewDisplayAcceptance');result['browserErrors']=errors
        if errors:result['passed']=False
        dest=os.environ.get('VIEW_DISPLAY_EVIDENCE')
        if dest:pathlib.Path(dest).write_text(json.dumps(result,indent=2))
        print(json.dumps(result));browser.close()
finally:server.shutdown();server.server_close()
sys.exit(0 if result.get('passed') else 1)
PYRUN
close $fh;
my $status=system('python3','-B',$runner,$repo);
is($status,0,'neutral opt-in display, controls, preservation and lifecycle');
done_testing();
