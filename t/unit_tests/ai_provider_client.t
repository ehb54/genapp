use strict;
use warnings;

use File::Spec;
use File::Temp qw(tempfile);
use FindBin;
use Test::More;

use lib File::Spec->catdir( $FindBin::Bin, '..', 'lib' );
use GenAppTest qw(repo_root);

my $repo_root = repo_root( File::Spec->catdir( $FindBin::Bin, '..' ) );
my $client = File::Spec->catfile( $repo_root, qw(tools ai_provider_client client.py) );
ok( -f $client, 'shared provider client exists' );

my ( $fh, $script ) = tempfile( 'ai-provider-client-XXXX', SUFFIX => '.py', TMPDIR => 1, UNLINK => 1 );
print {$fh} <<"PY";
import importlib.util
import os

spec = importlib.util.spec_from_file_location("ai_provider_client", r"$client")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

os.environ["AI_HELPER_PROVIDER_URL"] = "https://openrouter.ai/api/v1/chat/completions"
os.environ["AI_HELPER_API_KEY"] = "redacted"
os.environ["AI_HELPER_MODEL"] = "fixture/model"
config = module.ProviderConfig.from_env("AI_HELPER")
assert config.configured
assert config.kind == "openrouter"
assert config.model == "fixture/model"
assert config.headers("session-1")["X-Session-Id"] == "session-1"
assert config.api_key not in repr(config.headers("session-1").keys())

captured = {}
def fake_post(url, payload, headers, timeout=120, max_response_bytes=0):
    captured.update({"url": url, "payload": payload, "headers": headers})
    return '{"id":"response-1","choices":[{"message":{"role":"assistant","content":"ok","tool_calls":[]}}],"usage":{"total_tokens":3}}'

module.post_json = fake_post
result = module.ProviderClient(config).chat(
    [{"role": "user", "content": "hello"}],
    tools=[{"type": "function", "function": {"name": "run_analysis_cell", "parameters": {"type": "object"}}}],
    session_id="session-1",
)
assert result["message"]["content"] == "ok"
assert result["usage"]["total_tokens"] == 3
assert captured["payload"]["tools"][0]["function"]["name"] == "run_analysis_cell"
assert captured["payload"]["session_id"] == "session-1"
PY
close $fh;

my $status = system( 'python3', $script );
is( $status, 0, 'shared provider client preserves messages and tool calls' );

done_testing();
