use strict;
use warnings;

use File::Spec;
use File::Temp qw(tempfile);
use FindBin;
use Test::More;

use lib File::Spec->catdir( $FindBin::Bin, '..', 'lib' );
use GenAppTest qw(read_file repo_root);

my $repo_root   = repo_root( File::Spec->catdir( $FindBin::Bin, '..' ) );
my $service_dir = File::Spec->catdir( $repo_root, qw(tools ai_helper_service) );
my $service     = File::Spec->catfile( $service_dir, 'ai_helper_server.py' );

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
os.environ.pop("AI_HELPER_MAX_OUTPUT_TOKENS", None)
os.environ.pop("AI_HELPER_TIMEOUT_SECONDS", None)
assert module.provider_kind("https://openrouter.ai/api/v1/chat/completions") == "openrouter"
assert module.cost_rates() == (0.084, 0.168, "openrouter_list_price_2026-07-20")
assert module.env_int("AI_HELPER_TIMEOUT_SECONDS", module.DEFAULT_PROVIDER_TIMEOUT_SECONDS, 5, 120) == 120

with tempfile.TemporaryDirectory() as context_tmpdir:
    context_path = Path(context_tmpdir) / "sassie_ai_helper_context.md"
    context_path.write_text("SASSIE AI context includes golden vector guidance.", encoding="utf-8")
    os.environ["AI_HELPER_CONTEXT_PATH"] = str(context_path)
    module.AI_CONTEXT_CACHE.update({"path": None, "mtime": None, "text": "", "sha256": "", "words": 0})

    request = module.provider_request_body("openrouter", {
        "application": "sassie3",
        "module": "pdbrx",
        "user_question": "Hello"
    })
    assert request["model"] == "deepseek/deepseek-v4-flash"
    assert request["session_id"].startswith("sassie-ai-helper-sassie3-context-")
    assert request["max_tokens"] == 800
    assert request["messages"][0]["role"] == "system"
    assert "golden vector" in request["messages"][0]["content"]
    assert request["messages"][1]["role"] == "user"
    assert "Live GenApp context JSON" in request["messages"][1]["content"]
    context_status = module.ai_context_metadata()
    assert context_status["loaded"] is True
    assert context_status["words"] == 7
    assert len(context_status["revision"]) == 12
    assert request["session_id"].endswith(context_status["revision"])
    headers = module.provider_headers("redacted-key", "openrouter", request["session_id"])
    assert headers["X-Session-Id"] == request["session_id"]

os.environ["AI_HELPER_MAX_OUTPUT_TOKENS"] = "0"
uncapped_request = module.provider_request_body("openrouter", {
    "application": "sassie3",
    "module": "pdbrx",
    "user_question": "Hello"
})
assert "max_tokens" not in uncapped_request

response = json.dumps({
    "choices": [
        {"message": {"content": "Hello from OpenRouter"}}
    ],
    "usage": {
        "prompt_tokens": 1000,
        "completion_tokens": 500,
        "total_tokens": 1500,
        "prompt_tokens_details": {
            "cached_tokens": 900,
            "cache_write_tokens": 100
        },
        "completion_tokens_details": {
            "reasoning_tokens": 25
        },
        "cost": 0.0002
    }
})
parsed = module.parse_provider_response("openrouter", response)
assert parsed["message"] == "Hello from OpenRouter"
assert parsed["usage"]["input_tokens"] == 1000
assert parsed["usage"]["output_tokens"] == 500
assert parsed["usage"]["total_tokens"] == 1500
assert parsed["usage"]["cached_input_tokens"] == 900
assert parsed["usage"]["cache_write_tokens"] == 100
assert parsed["usage"]["reasoning_tokens"] == 25
assert parsed["usage"]["provider_cost_credits"] == 0.0002

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

my $server      = read_file( File::Spec->catfile( $service_dir, 'ai_helper_server.py' ) );
my $run_forever = read_file( File::Spec->catfile( $service_dir, 'run_forever.sh' ) );
my $start       = read_file( File::Spec->catfile( $service_dir, 'start.sh' ) );
my $stop        = read_file( File::Spec->catfile( $service_dir, 'stop.sh' ) );
my $restart     = read_file( File::Spec->catfile( $service_dir, 'restart_if_needed.sh' ) );
my $init        = read_file( File::Spec->catfile( $service_dir, 'ai-helper-service.init' ) );
my $install     = read_file( File::Spec->catfile( $service_dir, 'install_service.sh' ) );
my $deploy      = read_file( File::Spec->catfile( $repo_root, qw(tools zazzie3_update_genapp_core.sh) ) );

like( $server, qr/ThreadingHTTPServer\(\(host, port\), Handler\)/, 'AI Helper backend serves through the threaded local HTTP server' );
like( $server, qr/AI_HELPER_BIND_HOST", "127\.0\.0\.1"/, 'AI Helper backend defaults to loopback binding' );

like( $run_forever, qr/AI Helper supervisor started/, 'AI Helper supervisor announces startup' );
like( $run_forever, qr/python3 "\$SERVICE_DIR\/ai_helper_server\.py" &/, 'AI Helper supervisor starts the Python backend as a child process' );
like( $run_forever, qr/AI Helper backend exited with status \$status; restarting after/, 'AI Helper supervisor restarts the backend after exit' );
like( $run_forever, qr/trap shutdown TERM INT/, 'AI Helper supervisor handles termination cleanly' );

like( $start, qr/run_forever\.sh/, 'AI Helper start script launches the supervisor rather than a one-shot backend' );
like( $start, qr/ai_helper_supervisor\.pid/, 'AI Helper start script records a supervisor pid' );
like( $start, qr/AI Helper service did not become healthy/, 'AI Helper start script fails if health does not come up' );

like( $stop, qr/ai_helper_supervisor\.pid/, 'AI Helper stop script stops the supervisor' );
like( $stop, qr/pkill -f "\$SERVICE_DIR\/ai_helper_server\.py"/, 'AI Helper stop script cleans up backend children as a fallback' );
like( $restart, qr/AI Helper service unhealthy; restarting/, 'AI Helper health-check script restarts when unhealthy' );

like( $init, qr/Provides:\s+ai-helper-service/, 'AI Helper init script declares the service name' );
like( $init, qr/\/etc\/default\/ai-helper-service/, 'AI Helper init script reads deployment defaults' );
like( $init, qr/start\|stop\|restart\|status\|check/, 'AI Helper init script exposes lifecycle commands' );

like( $install, qr/cp "\$SERVICE_DIR\/ai-helper-service\.init" \/etc\/init\.d\/ai-helper-service/, 'AI Helper installer installs the init.d wrapper' );
like( $install, qr/\/etc\/default\/ai-helper-service/, 'AI Helper installer writes non-secret service defaults' );
unlike( $install, qr/AI_HELPER_API_KEY/, 'AI Helper installer does not write API keys' );

like( $deploy, qr/AI Helper service deployment/, 'ZAZZIE deploy helper has an AI Helper service deployment step' );
like( $deploy, qr/! -name "\.env"/, 'ZAZZIE deploy helper preserves deployment-local AI Helper env file' );
like( $deploy, qr/install_service\.sh" --service-dir "\$service_dir"/, 'ZAZZIE deploy helper installs the AI Helper service from tracked files' );
like( $deploy, qr/\/etc\/init\.d\/ai-helper-service status/, 'ZAZZIE deploy helper verifies AI Helper service health' );

done_testing();
