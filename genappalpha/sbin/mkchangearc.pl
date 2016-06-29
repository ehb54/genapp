#!/usr/bin/perl

# $debug++;

my $gb   = $ENV{ "GENAPP" } || die "$0: environment variable GENAPP must be set\n";

$notes = "usage: $0 arcname
will make arcname.txz for all M or A svn stat files
useful for backing up changes without committing them to the svn
";

$an = shift || die $notes;

$an =~ s/\.txz//i;
$date = `date +\%Y\%m\%d\%H\%M\%S`;
chomp $date;
$an .= "-$date.txz";

die "$0: $an exists
rm $an
and try again\n" if -e $an;

@files = `cd $gb; svn stat | grep '^[AM]' | awk '{ print \$2 }'`;
grep chomp, @files;

$files = join " ", @files;

$cmd = "cd $gb; tar Jcf $an $files\n";
print $cmd;
print `$cmd` if !$debug;
print "$an\n";

