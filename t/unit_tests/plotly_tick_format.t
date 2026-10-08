use strict;
use warnings;
use File::Spec;
use File::Temp qw(tempfile);
use FindBin;
use Test::More;
use lib File::Spec->catdir($FindBin::Bin, '..', 'lib');
use GenAppTest qw(repo_root run_command);
my $repo = repo_root(File::Spec->catdir($FindBin::Bin, '..'));
my ($fh, $script) = tempfile('tick-format-XXXX', SUFFIX => '.js', TMPDIR => 1, UNLINK => 1);
print {$fh} <<'JS';
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const context={window:{}};vm.createContext(context);
vm.runInContext(fs.readFileSync(process.argv[2],'utf8'),context);
const p=context.window.GenAppPlotlyLayout,plain=x=>JSON.parse(JSON.stringify(x));
const selection={axisTickFormats:{xaxis:'.4~g',yaxis:'.4~g',xaxis2:'.3r'}};
for(const format of ['.4~g','.1g','.16~r','.0e','.15~e'])assert(p.validNumericTickFormat(format));
for(const format of [null,'','.0g','.17g','.16e','.4s','.4f','<script>',4])assert(!p.validNumericTickFormat(format));
const source={title:'Neutral observation',xaxis:{type:'log',range:[-4,-1]},yaxis:{type:'linear',hoverformat:'.5e'},xaxis2:{type:'linear'}};
const before=JSON.stringify(source),display=p.prepareNumericTickFormat(source,selection);
assert.strictEqual(display.xaxis.tickformat,'.4~g');assert.strictEqual(display.yaxis.tickformat,'.4~g');
assert.strictEqual(display.xaxis2.tickformat,'.3r');assert.strictEqual(display.yaxis.hoverformat,'.5e');
assert.strictEqual(JSON.stringify(source),before,'source unchanged');assert.strictEqual(display.xaxis.type,'log');
assert.deepStrictEqual(plain(display.xaxis.range),[-4,-1]);
assert.strictEqual(p.prepareNumericTickFormat(display,selection),display,'idempotent');
assert.strictEqual(p.prepareNumericTickFormat(source,{}),source,'not opted in');
for(const type of ['date','category','multicategory',undefined]){
 const control={xaxis:{type}};assert.strictEqual(p.prepareNumericTickFormat(control,selection),control);
}
for(const ticks of [{tickformat:'.2f'},{tickformatstops:[{value:'.3e'}]},{tickmode:'array',ticktext:['low','high']}]){
 const explicit={xaxis:{type:'log',...ticks}};
 assert.strictEqual(p.prepareNumericTickFormat(explicit,selection),explicit,'producer ticks preserved');
 const templated={xaxis:{type:'log'},template:{layout:{xaxis:ticks}}};
 assert.strictEqual(p.prepareNumericTickFormat(templated,selection),templated,'template ticks preserved');
}
assert.strictEqual(p.prepareNumericTickFormat(source,{axisTickFormats:{xaxis:'.4s',zaxis:'.4~g'}}),source);
assert.strictEqual(p.prepareNumericTickFormat(source,{axisTickFormats:[]}),source);
assert.strictEqual(p.prepareNumericTickFormat(undefined,selection),undefined);
assert.deepStrictEqual(plain(p.prepareNumericTickFormat(JSON.parse(before),selection)),plain(display),'saved-output reconstruction');
const pending={_fullLayout:{xaxis:{type:'log'},yaxis:{type:'linear'}}};
assert.deepStrictEqual(plain(p.numericHoverFormatUpdate(pending,'.5e')),{'xaxis.hoverformat':'.5e','yaxis.hoverformat':'.5e'});
const ui2=fs.readFileSync(process.argv[3],'utf8');
assert(ui2.includes('prepareNumericTickFormat?.('),'ordinary UI2 uses shared helper');
console.log('tick opt-in, overrides, controls, immutability and reconstruction passed');
JS
close $fh;
my ($status,$output)=run_command(cwd=>$repo,cmd=>['node',$script,File::Spec->catfile($repo,qw(languages ui2 add js plotly-layout.js)),File::Spec->catfile($repo,qw(languages ui2 add js ui2.js))]);
is($status,0,'generic tick presentation contract') or diag($output);
like($output,qr/reconstruction passed/,'all tick-format assertions completed');
done_testing();
