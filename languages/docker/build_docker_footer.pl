# process each module with dependencies

# process each module with dependencies

my $warn;
my $error;

foreach my $mod ( keys %dependencies ) {
    print "checking $mod\n";
    if ( $dependencies{ $mod } =~ /^__dependencies__/ ) {
        print "no dependencies\n";
        $error .= "Module '$mod' has no 'dependencies' defined, can not create docker container.\n";
        next;
    }
    $depjson = decode_json( $dependencies{ $mod } );
    $modjson = decode_json( $module_json{ $mod } );
    if ( !$$modjson{'executable'} ) {
        $error .= "Module '$mod' has no 'executable' defined.\n";
        next;
    }
    print "executable is $$modjson{'executable'}\n";


    # mkdir for dockerfile

    # build up and output docker file based upon dependencies
    # executable needs copying

    # create command to build and post (?) dockerfile
}



    
print "Warnings:\n$warn" if $warn;
print "Errors:\n$error" if $error;
