#!/usr/bin/perl
use JSON;
use Data::Dumper;





$json = '
{
 "header" : "Sassie 2",
 "menu" : [
           { 
            "id"      : "Build",
            "icon"    : "sassie_build.png",
            "modules" : [ 
                         { 
                          "id"    : "sassie_build_1",
                          "label" : "Build 1",
                          "views" : [ "Input", "Output", "Plots", "OpenGL" ]
                         },
                         { 
                          "id"    : "sassie_build_2",
                          "label" : "Build 2",
                          "views" : [ "Input", "Output", "Plots", "OpenGL" ]
                         }
                        ]
            },
           { 
            "id"      : "Tools",
            "icon"    : "sassie_tools.png",
            "modules" : [ 
                         { 
                          "id"    : "sassie_center",
                          "label" : "Center",
                          "views" : [ "Input", "Output", "Plots", "OpenGL" ]
                         },
                         { 
                          "id"    : "sassie_align",
                          "label" : "Align",
                          "views" : [ "Input", "Output", "Plots", "OpenGL" ]
                         },
                         { 
                          "id"    : "sassie_data_interpolation",
                          "label" : "Data Interpolation",
                          "views" : [ "Input", "Output", "Plots", "OpenGL" ]
                         }
                        ]
            }
          ]
}
';

$json =~ s/\n//g;

$ref = decode_json($json);

sub expand {
    my $arg = $_[ 0 ];
    my $pos = $_[ 1 ];
    if ( ref( $arg ) eq 'HASH' )
    {
        while ( my ($k, $v ) = each %$arg )
        {
            if ( ref( $v ) )
            {
                print '-'x$pos . "$k is a ref:\n";
                expand( $v, $pos + 1 );
            } else {
                print '-'x$pos . "$k is $v\n";
            }
        }
    }
    if ( ref( $arg ) eq 'ARRAY' )
    {
        for ( my $i = 0; $i < @$arg; ++$i )
        {
            my $v = $$arg[ $i ];
            if ( ref( $v ) )
            {
                print '-'x$pos . "[$i] is a ref:\n";
                expand( $v, $pos + 1 );
            } else {
                print '-'x$pos . "[$i] is $v\n";
            }
        }
    }
}    
        

expand( $ref );

__END__


# check something

if ( 0 ) {
    $l1 = $$ref{ 'menu' };
    $l2 = $$ref{ 'menu' }{ 'items' };
# $l2 = $$l1 { 'items' };
    $l3 = $$l2 [ 3 ];
    $l4 = $$l3 { 'id' };
}

%x = %$ref;

# $l2 = $x{ 'menu' }{ 'items' };
# $l3 = $$l2[ 3 ];
# $l4 = $$l3{ 'id' };

# $l4 = $x{ 'menu' }{ 'items' }[ 3 ]{ 'id' };
$l4 = $$ref{ 'menu' }{ 'items' }[ 3 ]{ 'id' };

print "menu item 3rd entry id: " . $$ref{ 'menu' }{ 'items' }[ 3 ]{ 'id' } . "\n";

__END__
while ( ($k, $v ) = each %$ref )
{
    print "hi <$k> <$v>\n";
    if ( ref( $v ) )
    {
        print "$k points to a ref " . ref( $v ) . "\n";
    } else {
        print "$k is $v\n";
    }
}


# $json = '{"a":1,"b":2,"c":3,"d":4,"e":5}';

open IN, "/root/ultrascan/etc/somo.config" || die "$0: argh $!\n";
@j = <IN>;
close IN;

shift @j;
$json = join '', @j;
$json =~ s/\n/,/g;

$text = decode_json($json);
print  Dumper($text);
