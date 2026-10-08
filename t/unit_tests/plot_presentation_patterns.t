use strict;
use warnings;
use File::Spec;
use File::Temp qw(tempfile);
use FindBin;
use Test::More;
use lib File::Spec->catdir($FindBin::Bin, '..', 'lib');
use GenAppTest qw(repo_root run_command);
my $repo = repo_root(File::Spec->catdir($FindBin::Bin, '..'));
my ($fh, $script) = tempfile('patterns-XXXX', SUFFIX => '.js', TMPDIR => 1, UNLINK => 1);
print {$fh} <<'JS';
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const context={window:{}};vm.createContext(context);
vm.runInContext(fs.readFileSync(process.argv[2],'utf8'),context);
const p=context.window.GenAppPlotPresentation,plain=x=>JSON.parse(JSON.stringify(x));
const profile=p.resolveProfile('child',{base:{palette:{primary:'#2468ac'},
 styles:{patterned:{color:'primary',marker_pattern:'/'},solid:{color:'primary'}}},
 child:{inherits:'base',group_palettes:{members:{marker_pattern:['x']}}}});
for(const type of ['bar','histogram']) {
 const source={type,x:[1,2],y:[10,null],text:['State',''],meta:{series_role:'member'},
  marker:{line:{width:2}}};
 const before=JSON.stringify(source),policy={token:'patterned'};
 const display=p.styleTrace(source,policy,profile);
 assert.strictEqual(display.marker.color,'#2468ac');
 assert.strictEqual(display.marker.pattern.shape,'/');
 assert.strictEqual(display.marker.pattern.fillmode,'overlay','solid base retained');
 for(const key of ['x','y','text','meta']) assert.strictEqual(display[key],source[key]);
 assert.strictEqual(JSON.stringify(source),before,'source immutable');
 assert.deepStrictEqual(plain(p.styleTrace(JSON.parse(before),policy,profile)),plain(display),'reattach');
 assert.deepStrictEqual(plain(p.styleTrace(display,policy,profile)),plain(display),'idempotent');
 for(const fillmode of ['replace','overlay']) {
  const pattern={fillmode,bgcolor:'#fff',fgcolor:'#000',size:8,solidity:0.3};
  const explicit={...source,marker:{pattern}};
  const styled=p.styleTrace(explicit,policy,profile);
  assert.deepStrictEqual(plain(styled.marker.pattern),{...pattern,shape:'/'});
  assert.strictEqual(explicit.marker.pattern,pattern,'explicit settings immutable');
 }
 const grouped=p.styleTrace({...source,meta:{series_group:'family_0123456789abcdef01234567'}},
  {groupPalette:'members'},profile);
 assert.strictEqual(grouped.marker.pattern.shape,'x');
 assert.strictEqual(grouped.marker.pattern.fillmode,'overlay','group pattern shares default');
 assert.strictEqual(p.styleTrace(source,{token:'solid'},profile).marker.pattern,undefined);
 assert.strictEqual(p.styleTrace(source,{},profile),source,'not opted in');
}
const scatter=p.styleTrace({type:'scatter',x:[1],y:[2]}, {token:'patterned'},profile);
assert.strictEqual(scatter.marker.pattern,undefined,'unsupported trace untouched');
console.log('patterns, producer controls, lifecycle and source preservation passed');
JS
close $fh;
my ($status,$output)=run_command(cwd=>$repo,cmd=>['node',$script,
 File::Spec->catfile($repo,qw(languages ui2 add js plot-presentation.js))]);
is($status,0,'generic presentation pattern contract') or diag($output);
like($output,qr/source preservation passed/,'all pattern assertions completed');
done_testing();
