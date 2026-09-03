# UI2 external authentication providers

UI2 applications may opt in to external sign-in controls by setting the
`ui2_auth_providers_url` directive to a same-origin JSON endpoint. With the
directive absent, UI2 makes no provider request and the existing password
login is unchanged.

The endpoint returns a public manifest:

```json
{
  "providers": [
    {
      "id": "example-idp",
      "label": "Sign in with Example",
      "start_url": "auth/example/start.php"
    }
  ]
}
```

Both the manifest URL and every `start_url` must resolve to the UI2 page's
origin. Provider ids use lowercase letters, digits, hyphens, or underscores;
labels are limited to 80 characters; and UI2 renders at most five providers.
Invalid entries are ignored. A missing, disabled, invalid, or unavailable
manifest leaves password login available and does not display an error.

UI2 adds the current GenApp window id as the `window` query parameter when a
provider link is followed. The application owns the sign-in endpoint,
protocol validation, account linking, callback, and session creation. After a
successful callback, the application must return that value in the
`ui2_auth_window` query parameter. UI2 validates and restores the per-tab
window name before the ordinary startup session refresh, then removes the
handoff parameter from the visible URL. This explicit handoff is required
because browsers may clear `window.name` during a cross-origin identity-provider
round trip.

GenApp core deliberately does not know provider names, identity claims,
secrets, database fields, or deployment policy. Applications must keep secret
configuration outside generated and version-controlled web content.
