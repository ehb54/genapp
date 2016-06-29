#!/usr/bin/perl

# $debug++;

use POSIX;

sub daemonize {
    my $logfile = $_[0];
    chdir '/'               or die "$0: Can't chdir to /: $!";
    open STDIN, "/dev/null";
    open STDOUT, ">/dev/null";
    defined(my $pid = fork) or die "$0: Can't fork: $!";
    if ( $pid ) {
        exit();
    }
    open STDOUT, ">>$logfile";
    open STDERR, '>&STDOUT' or die "$0: Can't dup stdout: $!";
    setsid                  or die "$0: Can't start a new session: $!";
}

$notes = "usage: $0 logdir resource all|child pids
kills all or all descendents of each pid in list
first tries SIGTERM then after x seconds, goes for -9
";

$logdir   = shift || die $notes;
$resource = shift || die $notes;
$type = shift || die $notes;
die $notes if $type !~/^(all|child)$/;

if ( !-d $logdir ) {
    print "mkdir $logdir\n" if $debug;
    mkdir $logdir;
}

if ( !-d $logdir ) {
    die "$0 could not mkdir $logdir\n";
}

if ( !-w $logdir ) {
    die "$0 can not write to $logdir\n";
}

$logfile = "$logdir/killprocs_$resource.out";

$name = POSIX::cuserid();

print "name is $name\n" if $debug;
print "logs into $logfile\n" if $debug;

daemonize( $logfile );

# get ps once 

@procs = `ps h -u $name -o ppid,pid`;
print "procs are :\n" . ( join '', @procs ) . "\n" if $debug;
grep chomp, @procs;

# make all or child list 

foreach $p ( @procs ) {
    ( $ppid, $pid ) = $p =~ /^\s*(\d+)\s+(\d+)\s*$/;
    if ( $child{ $ppid } ) {
        $child{ $ppid } .= " $pid";
    } else {
        $child{ $ppid } = "$pid";
    }
}

sub getchildren {
    my $pid = $_[0];
    my $result = "";

    if ( $child{ $pid } ) {
        $result .= $child{ $pid };
        my @k = split ' ', $child{ $pid };
        foreach $k ( @k ) {
            my $children = getchildren( $k );
            if ( $children ) {
                $result .= " $children";
            }
        }
    }
    return $result;
}

while ( my $p = shift ) {
    $tokill{ $p } = 1 if $type eq 'all';
    my $children = getchildren( $p );
    my @k = split ' ', $children;
    foreach $k ( @k ) {
        $tokill{ $k } = 1;
    }
}

foreach my $k ( keys %tokill ) {
    if ( kill 0, $k ) {
        push @tokill, $k;
    }
}

print "tokill " . ( join " ", @tokill ) . "\n" if $debug;

# terminate 15
foreach my $k ( @tokill ) {
    print "kill 15 $k\n" if $debug;
    kill 15, $k;
}

sleep 5;

# terminate 9 if still alive
foreach my $k ( @tokill ) {
    if ( kill 0, $k ) {
        push @tokill9, $k;
    }
}

# terminate 9
foreach my $k ( @tokill9 ) {
    print "kill 9 $k\n" if $debug;
    kill 9, $k;
}

