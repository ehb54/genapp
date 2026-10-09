use strict;
use warnings;
use Test::More;
use JSON::PP qw(encode_json decode_json);
use File::Temp qw(tempdir);
use File::Spec;
use FindBin;
use lib File::Spec->catdir($FindBin::Bin, '..', 'lib');
use GenAppTest qw(repo_root read_file run_command php_executable);
my $root=repo_root(File::Spec->catdir($FindBin::Bin,'..'));
my $php=php_executable();
plan skip_all=>'PHP is required' unless $php;
my $tmp=tempdir(CLEANUP=>1);
sub put { my ($path,$value)=@_; open my $f,'>',$path or die $!; print {$f} $value; close $f; }
put("$tmp/config.json",encode_json({restricted=>{admin=>['fixture_admin']},resources=>{fixture=>''},messaging=>{zmqhostip=>'127.0.0.1',zmqport=>1}}));
# All database, process and transport effects are confined to this fixture.
put("$tmp/db.php", <<'PHP');
<?php
$GLOBALS['fixture']=json_decode($argv[2],true);
function trace_call($call) {file_put_contents($GLOBALS['fixture']['trace'],json_encode($call)."\n",FILE_APPEND);}
function ga_db_open(...$args) {return ['status'=>!($GLOBALS['fixture']['open_fail'] ?? false)];}
function ga_db_status($value) {return $value['status'] ?? true;}
function ga_db_output($value) {return $value['output'] ?? null;}
function ga_db_find($collection,$app='', $query=[], ...$args) {
 if (($GLOBALS['fixture']['find_fail'] ?? '') === $collection) return ['status'=>false,'output'=>null];
 $docs=$GLOBALS['fixture'][$collection] ?? [];
 if (isset($query['_id'])) $docs=array_values(array_filter($docs,fn($d)=>$d['_id']===$query['_id']));
 return ['status'=>true,'output'=>new ArrayIterator($docs)];
}
function ga_db_findOne($collection,$app='', $query=[], ...$args) {
 $docs=iterator_to_array(ga_db_output(ga_db_find($collection,$app,$query)),false);
 return ['status'=>true,'output'=>$docs[0] ?? null];
}
function ga_db_remove($collection,$app,$query) {
 trace_call(['remove',$app,$query['_id']]);
 $ok=!($GLOBALS['fixture']['remove_fail'] ?? false);
 if($ok) $GLOBALS['fixture'][$collection]=array_values(array_filter($GLOBALS['fixture'][$collection],fn($d)=>$d['_id']!==$query['_id']));
 return ['status'=>$ok];
}
function fixture_kill($pid,$signal) {trace_call(['kill',$pid]);return !($GLOBALS['fixture']['kill_fail'] ?? false);}
function ga_db_date($seconds) {return ['status'=>true,'output'=>$seconds];}
function ga_db_date_secs($seconds) {return $seconds;}
function fixture_proc() {
 $n=$GLOBALS['fixture']['proc_count'] ?? 0;$GLOBALS['fixture']['proc_count']=$n+1;
 return ['cpu  '.(100+20*$n).' 0 0 '.(100+70*$n).' '.(10+10*$n).' 0 0 0',
 'MemTotal: 1000 kB','MemFree: 250 kB','SwapTotal: 1000 kB','SwapFree: 500 kB','cut_here','header1','header2',
 '    eth0: '.(1000000+1000000*$n).' 0 0 0 0 0 0 0 '.(2000000+1000000*$n).' 0 0 0 0 0 0 0',
 'eth1: 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0',
 ' lo: 999 0 0 0 0 0 0 0 999 0 0 0 0 0 0 0', 'malformed network line'];
}
class ZMQ {const SOCKET_PUSH=1;}
class ZMQContext {function getSocket(...$args) {return new FixtureSocket();}}
class FixtureSocket {
 function connect(...$args) {}
 function send($json) {
  $n=($GLOBALS['fixture']['sent'] ?? 0)+1;$GLOBALS['fixture']['sent']=$n;
  if($n>=($GLOBALS['fixture']['samples'] ?? 1)) {echo $json;exit;}
 }
}
PHP
my %paths=(integrity=>'languages/html5/sys/sys_jobintegritycheck.php',monitor=>'languages/html5/sys/sys_jobmonitor.php',history=>'languages/html5/util/jobs_history_web.php');
for my $kind(keys %paths) {
 my $s=read_file("$root/$paths{$kind}");
 $s=~s/\A#![^\n]*\n//;
 $s=~s/__appconfig__/$tmp\/config.json/g;
 $s=~s{__docroot:html5__/__application__/ajax/ga_db_lib.php}{$tmp/db.php}g;
 if($kind eq 'integrity') {
  is(($s=~s/\$results = `\$cmd`;/\$results = \$GLOBALS['fixture']['ps'] ?? '';/g),1,'process listing replaced in disposable copy');
  is(($s=~s/posix_kill\(\$pid, SIGTERM\)/fixture_kill(\$pid, SIGTERM)/g),1,'process termination replaced in disposable copy');
 }
 if($kind eq 'monitor') {
  is(($s=~s/exec\( \$cmd, \$res \);/\$res = fixture_proc();/g),1,'proc access replaced in disposable copy');
  $s=~s/sleep\( [^)]* \);/\/\/ fixture has no sleeps/g;
 }
 put("$tmp/$kind.php",$s);
}
my $seq=0;
sub exercise {
 my($kind,$request,$fixture)=@_;$fixture||={};
 my $trace="$tmp/trace".(++$seq);$fixture->{trace}=$trace;
 my($status,$output)=run_command(cwd=>$tmp,cmd=>[$php,'-d','display_errors=stderr','-d','error_reporting=32767',"$tmp/$kind.php",encode_json({_uuid=>'fixture-run',_logon=>'fixture_admin',%$request}),encode_json($fixture)],env=>{TZ=>'UTC'});
 is($status,0,"$kind exits successfully");
 my $json=eval{decode_json($output)};
 ok($json,"$kind emits JSON without PHP notices") or die $output;
 my @trace=-f $trace ? map {decode_json($_)} split(/\n/,read_file($trace)) : ();
 return ($json,\@trace);
}
sub broken_integrity {return {apps=>[{_id=>'fixture'}],running=>[{_id=>'orphan-record'}],ps=>"43210:fixture:orphan-process\ninvalid\n"};}
for my $value (JSON::PP::false,'false',0,'0','','off','no') {
 my($json,$calls)=exercise('integrity',{fixerrors=>$value},broken_integrity());
 is_deeply($calls,[],"false checkbox form '".encode_json($value)."' never repairs");
 like($json->{jobintegrityreport},qr/Errors present/,'read-only check reports stale records');
 is($json->{integrity_details},$json->{_textarea},'diagnostics are declared persistent output');
}
my($missing,$missing_calls)=exercise('integrity',{},broken_integrity());is_deeply($missing_calls,[],'omitted checkbox never repairs');
for my $value(JSON::PP::true,'true',1,'1','on','yes') {
 my($json,$calls)=exercise('integrity',{fixerrors=>$value},broken_integrity());
 is_deeply($calls,[['kill',43210],['remove','fixture','orphan-record']],'explicit true repairs only disposable process and DB record');
 like($json->{integrity_details},qr/remove running fixture orphan-record: verified/,'repair verifies cursor is empty');
 ok(!$json->{error},'successful mocked repairs have no error');
 like($json->{jobintegrityreport},qr/termination requested/,'accepted signal is not claimed as confirmed process exit');
}
for my $value('mistyped',[],{}) {
 my($json,$calls)=exercise('integrity',{fixerrors=>$value},broken_integrity());
 like($json->{error},qr/Invalid Fix errors/,'malformed boolean fails closed');is_deeply($calls,[],'malformed boolean never mutates');
}
for my $failure('kill_fail','remove_fail') {
 my $fixture=broken_integrity();$fixture->{$failure}=JSON::PP::true;
 my($json)=exercise('integrity',{fixerrors=>JSON::PP::true},$fixture);
 like($json->{jobintegrityreport},qr/repairs failed/,'failed repair never claims fixed');ok($json->{error},'repair failure is actionable');
}
my($unauthorized,$no_calls)=exercise('integrity',{fixerrors=>JSON::PP::true,_logon=>'ordinary_user'},broken_integrity());
like($unauthorized->{error},qr/not an administrator/,'non-administrator rejected');is_deeply($no_calls,[],'unauthorized request never repairs');
for my $failure('open','apps','running') {
 my $fixture=broken_integrity();
 if($failure eq 'open') {$fixture->{open_fail}=JSON::PP::true;} else {$fixture->{find_fail}=$failure;}
 my($json,$calls)=exercise('integrity',{fixerrors=>JSON::PP::true},$fixture);
 like($json->{error},qr/no repairs performed/,'failed initial database scan prevents repairs');
 is_deeply($calls,[],'unreadable database never permits process or DB mutation');
}
my($empty_integrity)=exercise('integrity',{}, {apps=>[{_id=>'fixture'}]});like($empty_integrity->{integrity_details},qr/All ok/,'empty system reports healthy');
is($empty_integrity->{jobintegrityreport},'All ok.','healthy check has a visible status');

my($modern)=exercise('monitor',{interval=>5,plot_format=>'plotly'},{samples=>245});
for my $id(qw(jobhistory load iowait memused swapused net)) {
 ok(ref($modern->{$id}{data}) eq 'ARRAY',"$id uses ordinary Plotly");
 is(scalar @{$modern->{$id}{data}[0]{y}},240,"$id history remains bounded");
 is($modern->{$id}{layout}{xaxis}{type},'date',"$id retains UTC timestamps");
 ok($modern->{$id}{data}[0]{x}[0]>1e12,"$id x values are epoch milliseconds");
 ok(!exists($modern->{$id}{layout}{width}) && !exists($modern->{$id}{data}[0]{line}),"$id leaves display styling to UI2");
}
is($modern->{load}{data}[0]{y}[-1],20,'CPU load percent retained');
is($modern->{iowait}{data}[0]{y}[-1],10,'IO wait percent retained');
is($modern->{memused}{data}[0]{y}[-1],75,'memory percent retained');
is($modern->{swapused}{data}[0]{y}[-1],50,'swap percent retained');
is($modern->{net}{data}[0]{y}[-1],0.4,'RX and TX byte changes divided by interval in MB/s');
is(scalar @{$modern->{net}{data}},2,'both non-loopback interfaces retained, including zero counters');
is($modern->{net}{data}[1]{name},'fixture-eth1','unindented interface parsed correctly');
my($legacy)=exercise('monitor',{interval=>5},{});
ok(exists($legacy->{load}{options}),'legacy default preserves plot2d payload');
is($legacy->{load}{data}[0]{data}[0][1],$modern->{load}{data}[0]{y}[-1],'formats retain same operational values');
like($legacy->{monitordata},qr/No jobs running/,'monitor retains human report');
for my $request ({interval=>0},{interval=>5,plot_format=>'unsupported'}) {
 my($json)=exercise('monitor',$request,{});like($json->{error},qr/Invalid monitor/,'invalid monitor settings rejected');
}

for my $request ({},{input1=>'bad',input2=>'2026-10-09'},{input1=>'2026-02-30',input2=>'2026-10-09'},{input1=>[],input2=>'2026-10-09'},{input1=>'2026-10-10',input2=>'2026-10-09'}) {
 my($json)=exercise('history',$request,{});ok($json->{error},'invalid or reversed dates rejected without notices');
}
my $day=1791504000; # 2026-10-09 00:00:00 UTC
my $history_fixture={users=>[{name=>'fixture_admin',email=>'fixture@example.test',group=>'fixture'}], jobs=>[
 {_id=>'complete',user=>'fixture_admin',when=>[$day,$day+3600],status=>['complete'],numprocs=>2},
 {_id=>'stale',user=>'fixture_admin',when=>[$day+3600,$day+7200],status=>['running'],numprocs=>1},
 {_id=>'at-end',user=>'fixture_admin',when=>[$day+82800,$day+86400],status=>['complete'],numprocs=>100},
 {_id=>'before',user=>'fixture_admin',when=>[$day-3600,$day+100],status=>['complete']}
]};
my($history)=exercise('history',{input1=>'2026-10-09',input2=>'2026-10-09'},$history_fixture);
my $html=$history->{jobshisreport};
like($html,qr/<th>failed<\/th>/,'empty running cursor classifies stale job as failed');
like($html,qr{<strong>Totals</strong></td><td> <hr></td><td> <hr></td><td> 2</td><td> 3</td><td> 1</td><td> 1</td>},'end midnight excluded and duration/SU/status totals correct');
like($html,qr{<strong>Sub-totals</strong></td><td> fixture</td><td> <hr></td><td> 2</td><td> 3</td><td> 1</td><td> 1</td>},'group subtotal matches known fixture');
my($no_users)=exercise('history',{input1=>'2026-10-09',input2=>'2026-10-09'},{});
like($no_users->{jobshisreport},qr/Totals/,'empty database returns zero totals without warnings');
done_testing();
