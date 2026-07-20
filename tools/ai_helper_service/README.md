# GenApp AI Helper service

This is the small provider-neutral development service used by the UI2 AI
Helper bridge. It accepts GenApp context at `/ai-helper`, calls the configured
provider, and returns a JSON response with `message`, token usage, and optional
estimated cost data.

Keep API keys in the deployment-local `.env` file only. Do not commit keys.

Example OpenRouter configuration:

```bash
AI_HELPER_PROVIDER=openrouter
AI_HELPER_PROVIDER_URL=https://openrouter.ai/api/v1/chat/completions
AI_HELPER_API_KEY=sk-or-v1-...
AI_HELPER_AUTH_HEADER=Authorization
AI_HELPER_AUTH_SCHEME=Bearer
AI_HELPER_MODEL=deepseek/deepseek-v4-flash
AI_HELPER_TIMEOUT_SECONDS=45
AI_HELPER_MAX_OUTPUT_TOKENS=800
AI_HELPER_HTTP_REFERER=https://zazzie3.genapp.rocks
AI_HELPER_X_TITLE=SASSIE/ZAZZIE GenApp AI Helper
```

`AI_HELPER_TIMEOUT_SECONDS` controls the provider wait time. Keep it aligned
with the GenApp `appconfig.json` AI Helper `timeout_seconds` value when that is
set. `AI_HELPER_MAX_OUTPUT_TOKENS` keeps popup answers short enough for an
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
