use strict;
use warnings;

use File::Spec;
use FindBin;
use Test::More;

use lib File::Spec->catdir( $FindBin::Bin, '..', 'lib' );
use GenAppTest qw(read_file repo_root);

my $repo_root = repo_root( File::Spec->catdir( $FindBin::Bin, '..' ) );
my $source = read_file( File::Spec->catfile( $repo_root, qw(languages html5 sys sys_feedback.php) ) );

like( $source, qr/_args_.*\$jobid/s, 'feedback derives optional artifacts from the selected job arguments' );
like( $source, qr/\$job_root.*\$run_name.*\$module/s, 'feedback scopes artifact discovery to runname and selected module' );
like( $source, qr/realpath[\s\S]*ga_feedback_path_is_within/, 'feedback resolves and contains artifact paths' );
like( $source, qr/isLink\(\)[\s\S]*fnmatch/, 'feedback rejects links and matches only declared filename patterns' );
like( $source, qr/\$maximum_depth = 4.*\$maximum_files = 16.*8 \* 1024 \* 1024.*16 \* 1024 \* 1024/s, 'feedback defines bounded depth, count, and byte limits' );
like( $source, qr/filemtime\( \$path \) < \$args_mtime/, 'feedback omits stale artifacts from a reused run name' );
like( $source, qr/\$jobid \. "__" \. \$basename/, 'feedback gives selected-job artifacts collision-safe attachment names' );
like( $source, qr/feedbackjobattachmentpatterns.*feedbackjobattachmentrunfield.*feedbackjobattachmentmaxdepth/s, 'applications opt in through generic directives' );
unlike( $source, qr/sascalc|multi_component_analysis|sassie_log|sassie_json/i, 'generic GenApp core contains no SASSIE-specific identifiers' );

done_testing();
