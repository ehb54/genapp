#!/usr/bin/perl

# compress javascript into a one liner

@l = <>;
grep chomp @l;
$l = join ' ', @l;
$l =~ s/\s+/ /g;
$l =~ s/\s*([{};:+<,=()&?'"])\s*/$1/g;
print "$l\n";

