#!/usr/bin/perl

$gb = $ENV{ "GENAPP" } || die "$0: error env variable GENAPP must be defined\n";

$notes = "usage: $0 version
gets bokeh js and css of said version
and installs
";

$rev = shift || die $notes;

$d = "$gb/languages/html5/add/js";
chdir $d || die "can't change to directory $d $!\n";

$cmd = "wget http://cdn.pydata.org/bokeh/release/bokeh-$rev.min.js
wget http://cdn.pydata.org/bokeh/release/bokeh-widgets-$rev.min.js
wget http://cdn.pydata.org/bokeh/release/bokeh-tables-$rev.min.js
";

print $cmd;
print `$cmd`;

$d = "$gb/languages/html5/add/css";
chdir $d || die "can't change to directory $d $!\n";

$cmd = "wget http://cdn.pydata.org/bokeh/release/bokeh-$rev.min.css
wget http://cdn.pydata.org/bokeh/release/bokeh-widgets-$rev.min.css
wget http://cdn.pydata.org/bokeh/release/bokeh-tables-$rev.min.css
";

print $cmd;
print `$cmd`;

