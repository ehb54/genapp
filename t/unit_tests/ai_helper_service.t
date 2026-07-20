use strict;
use warnings;

use File::Spec;
use File::Temp qw(tempfile);
use FindBin;
use Test::More;

use lib File::Spec->catdir( $FindBin::Bin, '..', 'lib' );
use GenAppTest qw(repo_root);

my $repo_root = repo_root( File::Spec->catdir( $FindBin::Bin, '..' ) );
my $service = File::Spec->catfile( $repo_root, qw(tools ai_helper_service ai_helper_server.py) );
ok( -f $service, 'tracked AI Helper service script exists' );

my ( $fh, $script ) = tempfile( 'ai-helper-service-XXXX', SUFFIX => '.py', TMPDIR => 1, UNLINK => 1 );
print {$fh} <<"PY";
import importlib.util
import json
import os
import sys
import tempfile
from pathlib import Path

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location("ai_helper_server", r"$service")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

os.environ["AI_HELPER_MODEL"] = "deepseek/deepseek-v4-flash"
assert module.provider_kind("https://openrouter.ai/api/v1/chat/completions") == "openrouter"
assert module.cost_rates() == (0.084, 0.168, "openrouter_list_price_2026-07-20")

request = module.provider_request_body("openrouter", {
    "application": "sassie3",
    "module": "pdbrx",
    "user_question": "Hello"
})
assert request["model"] == "deepseek/deepseek-v4-flash"
assert request["messages"][0]["role"] == "user"
assert "GenApp context JSON" in request["messages"][0]["content"]

response = json.dumps({
    "choices": [
        {"message": {"content": "Hello from OpenRouter"}}
    ],
    "usage": {
        "prompt_tokens": 1000,
        "completion_tokens": 500,
        "total_tokens": 1500
    }
})
parsed = module.parse_provider_response("openrouter", response)
assert parsed["message"] == "Hello from OpenRouter"
assert parsed["usage"]["input_tokens"] == 1000
assert parsed["usage"]["output_tokens"] == 500
assert parsed["usage"]["total_tokens"] == 1500

with tempfile.TemporaryDirectory() as tmpdir:
    module.USAGE_PATH = Path(tmpdir) / "usage.json"
    tracked = module.add_cumulative_usage(parsed)
    assert tracked["usage"]["estimated_cost_usd"] == 0.000168
    assert tracked["usage"]["account_cumulative_tokens"] == 1500
    assert tracked["usage"]["account_cumulative_cost_usd"] == 0.000168
PY
close $fh;

my $status = system( 'python3', $script );
is( $status, 0, 'tracked AI Helper service handles OpenRouter usage and cost estimates' );

done_testing();
