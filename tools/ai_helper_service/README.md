# GenApp AI Helper service

This is the small provider-neutral service used by the UI2 AI Helper bridge. It
accepts GenApp context at `/ai-helper`, calls the configured provider, and
returns a JSON response with `message`, token usage, and optional estimated cost
data.

Keep API keys in the deployment-local `.env` file only. Do not commit keys.

Example OpenRouter configuration:

```bash
AI_HELPER_PROVIDER=openrouter
AI_HELPER_PROVIDER_URL=https://openrouter.ai/api/v1/chat/completions
AI_HELPER_API_KEY=sk-or-v1-...
AI_HELPER_AUTH_HEADER=Authorization
AI_HELPER_AUTH_SCHEME=Bearer
AI_HELPER_MODEL=deepseek/deepseek-v4-flash
AI_HELPER_TIMEOUT_SECONDS=40
AI_HELPER_MAX_OUTPUT_TOKENS=800
AI_HELPER_HTTP_REFERER=https://zazzie3.genapp.rocks
AI_HELPER_X_TITLE=SASSIE/ZAZZIE GenApp AI Helper
```

`AI_HELPER_TIMEOUT_SECONDS` controls the provider wait time. Keep it slightly
below the GenApp `appconfig.json` AI Helper `timeout_seconds` value when that
is set, so the service can return a clear timeout message before the UI bridge
gives up. `AI_HELPER_MAX_OUTPUT_TOKENS` keeps popup answers short enough for an
interactive UI; set it to `0` to omit the provider output cap.

For `deepseek/deepseek-v4-flash`, the service has default OpenRouter list-price
cost estimates of `$0.084 / 1M` input tokens and `$0.168 / 1M` output tokens,
checked on 2026-07-20. Override them when pricing changes:

```bash
AI_HELPER_INPUT_USD_PER_1M=0.084
AI_HELPER_OUTPUT_USD_PER_1M=0.168
```

The cumulative token and cost counters are local observed totals for this helper
service, stored in `usage.json`; they are not authoritative provider account
balances.

## Service management

The service is intended to run as a deployment-local backend on loopback
(`127.0.0.1:8765` by default). The frontend never receives the provider URL or
API key.

Production-style container deployment uses:

- `run_forever.sh` — a tiny supervisor loop that restarts the Python backend if
  it exits.
- `start.sh` / `stop.sh` — start and stop the supervisor, with health checks.
- `restart_if_needed.sh` — a safe health check/restart command.
- `ai-helper-service.init` — an init.d wrapper exposing
  `start|stop|restart|status|check`.
- `install_service.sh` — installs `/etc/init.d/ai-helper-service` and
  `/etc/default/ai-helper-service`.

For ZAZZIE3, `tools/zazzie3_update_genapp_core.sh --generate-all` copies these
tracked files into `/opt/genapp/sassie3/.local/ai_helper_service`, preserves the
deployment-local `.env`, installs the init.d service, starts it, and verifies
health.

Manual commands inside the container:

```bash
cd /opt/genapp/sassie3/.local/ai_helper_service
./install_service.sh --service-dir /opt/genapp/sassie3/.local/ai_helper_service
/etc/init.d/ai-helper-service status
```

If the backend process exits, the supervisor restarts it. If the supervisor is
not running, `/etc/init.d/ai-helper-service check` starts it again.
