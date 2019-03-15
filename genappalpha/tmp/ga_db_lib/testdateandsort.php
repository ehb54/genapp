<?php

require_once "/home/ehb/demo/output/html5/ajax/ga_db_lib.php";

# test new date routines

$start = ga_db_output( ga_db_date() );
sleep( 1 );
$end = ga_db_output( ga_db_date() );

echo "start is " . json_encode( $start, JSON_PRETTY_PRINT ) . "\n";
echo "end   is " . json_encode( $end  , JSON_PRETTY_PRINT ) . "\n";

$mindate = ga_db_date_add_secs( $start, -3 * 60 );
echo "mindate (start - 3 minutes) is " . json_encode( $mindate, JSON_PRETTY_PRINT ) . "\n";

echo "seconds of start  :" . ga_db_date_secs( $start ) . "\n";
echo "seconds of end    :" . ga_db_date_secs( $end ) . "\n";
echo "seconds of mindate:" . ga_db_date_secs( $mindate ) . "\n";

echo "ga_db_date_secs_diff start - mindate is " . ga_db_date_secs_diff( $start, $mindate ) . "\n";
echo "ga_db_date_secs_diff mindate - start is " . ga_db_date_secs_diff( $mindate, $start ) . "\n";
echo "ga_db_date_secs_diff end - start     is " . ga_db_date_secs_diff( $end, $start ) . "\n";



# test new sort
ga_db_open( true );

$usersbyname = 
    ga_db_output( 
        ga_db_find(
            'users',
            '',
            [],
            [ 'name' => 1 ],
            [ 'sort' => [ 'name' => 1 ] ]
        )
    );

$usersbyid = 
    ga_db_output( 
        ga_db_find(
            'users',
            '',
            [],
            [ 'name' => 1 ],
            [ 'sort' => [ '_id' => 1 ] ]
        )
    );

echo "---sorted by name-------\n";
foreach ( $usersbyname as $v ) {
    echo json_encode( $v, JSON_PRETTY_PRINT ) . "\n";
}

echo "---sorted by _id------\n";
foreach ( $usersbyid as $v ) {
    echo json_encode( $v, JSON_PRETTY_PRINT ) . "\n";
}

