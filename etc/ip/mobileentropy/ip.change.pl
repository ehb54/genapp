#!/usr/bin/perl

$f = "/etc/ip.json";
#$debug++;
#$commit++;

use JSON;

$notes = "usage: $0 
changes all relevant ip info based upon /etc/ip.json
"
    ;

die "$0: $f does not exist\n" if !-e $f;

open IN, $f || die "$0: $f open error $!\n";
@json = <IN>;
close IN;
@json = grep !/^\s*#.*$/, @json;
$json = join '', @json;
$ip = decode_json( $json );

$vmname = $$ip{'vm'}{'name'};
$vmip   = $$ip{'vm'}{'ip'};
$vmbc   = $$ip{'vm'}{'broadcast'};
$vmgw   = $$ip{'vm'}{'gateway'};
$vmnm   = $$ip{'vm'}{'netmask'};

$hostname = $$ip{'host'}{'name'};
$hostip   = $$ip{'host'}{'ip'};

@out = (

# ----------------------------------------

    "/usr/local/bin/etherup"
    ,"run"
    ,"umount /state/partition1 2> /dev/null
route del default 2> /dev/null
ifconfig eth0 up $vmip netmask $vmnm broadcast $vmbc
route add default gw $vmgw
sleep 5
mount $hostip:/share /state/partition1
"

# ----------------------------------------

    ,"/etc/hosts"
    ,""
    ,"127.0.0.1\tlocalhost
$hostip\t$hostname
$vmip\t$vmname
"

# ----------------------------------------

    ,"/tmp/appconfig.json.sassie2"
    ,"copy /share/apps/genapp/sassie2/appconfig.json"
    ,qq/{
  "mail"     : {
                "admin"    : "emre\@biochem.uthscsa.edu,curtisj\@nist.gov"
                ,"feedback" : "madscatt\@googlegroups.com,emre\@biochem.uthscsa.edu,curtisj\@nist.gov"
                ,"from"     : "sassie-web.chem.utk.edu"
               }
  ,"feedbackmail" : "madscatt\@googlegroups.com,emre\@biochem.uthscsa.edu,curtisj\@nist.gov"
  ,"hostip" : "$vmip"
  ,"messaging" : {
                  "wsport"     : 8080
                  ,"zmqhostip" : "$vmip"
                  ,"zmqport"   : 37778
                  ,"udphostip" : "$vmip"
                  ,"udpport"   : 37779
                 }
  ,"resources" : {
                  "local"     : ""
                  ,"compute0" : "ssh $hostname"
                  ,"compute1" : "ssh $hostname"
                 }
  ,"resourcedefault" : "compute1"
  ,"submitpolicy"    : "login"
}
/
    
# ----------------------------------------

    ,"/tmp/appconfig.json.sassie2test"
    ,"copy /share/apps/genapp/sassie2test/appconfig.json"
    ,qq/{
  "mail"     : {
                "admin"    : "emre\@biochem.uthscsa.edu,curtisj\@nist.gov"
                ,"feedback" : "sassie2_test\@googlegroups.com,emre\@biochem.uthscsa.edu,curtisj\@nist.gov"
                ,"from"     : "sassie-web.chem.utk.edu"
               }
  ,"hostip" : "$vmip"
  ,"messaging" : {
                  "wsport"     : 8080
                  ,"zmqhostip" : "$vmip"
                  ,"zmqport"   : 37778
                  ,"udphostip" : "$vmip"
                  ,"udpport"   : 37779
                 }
  ,"resources" : {
                  "local"     : ""
                  ,"compute0" : "ssh $hostname"
                  ,"compute1" : "ssh $hostname"
                 }
  ,"resourcedefault" : "compute1"
  ,"submitpolicy"    : "login"
}
/

# ----------------------------------------

    ,"/tmp/appconfig.json.genapptest"
    ,"copy /share/apps/genapp/genapptest/appconfig.json"
    ,qq/{
  "mail"     : {
                "admin"    : "emre\@biochem.uthscsa.edu"
                ,"feedback" : "emre\@biochem.uthscsa.edu"
                ,"from"     : "sassie-web.chem.utk.edu"
                ,"nosmtp"     : {
                    "host"     : "vownet.net"
                    ,"user"     : "emre.brookes\@vownet.net"
                    ,"password" : "dGVtcDEyMzQK"
                             }
               }
  ,"hostip" : "$vmip"
  ,"messaging" : {
                  "wsport"     : 8080
                  ,"zmqhostip" : "$vmip"
                  ,"zmqport"   : 37778
                  ,"udphostip" : "$vmip"
                  ,"udpport"   : 37779
                 }
  ,"resources" : {
                  "local"     : ""
                  ,"compute0" : "ssh $hostname"
                  ,"compute1" : "ssh $hostname"
                 }
  ,"resourcedefault" : "compute0"
  ,"submitpolicy"    : "login"
}
/
    
)
    ;
for ( my $i = 0; $i < @out; ++$i ) {
    $fo   = $out[$i];
    $fo  .= ".trial" unless $commit;
    $mode = $out[++$i];
    $ft   = $out[++$i];

    print
        '-'x40 . "\n" .
        "out: $fo\n" .
        '-'x40 . "\n" .
        "mode: $mode\n" .
        '-'x40 . "\n" .
        $ft
        if $debug;

    open OUT, ">$fo" || die "$0: >$fo error $!\n";
    print OUT $ft;
    close OUT;
    print "created $fo\n";

    if ( $mode eq 'run' ) {
        push @run, $fo;
        print `chmod +x $fo`;
    }

    if ( $mode =~ /^copy\s+(\S+)\s*$/ ) {
        push @copy, "cp $fo $1";
    }
}

foreach my $k ( @run ) {
    if ( $commit ) {
        print "run: $k\n";
        print `$k`;
    } else {
        print "not running: $k\n";
    }
}

foreach my $k ( @copy ) {
    print "copy: $k\n";
    print `$k`;
}
