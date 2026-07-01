# Manual setup required

Everything in this repo that I can build, configure, or wire myself gets done
without asking.
This file is only for steps that genuinely require something only you can do:
an account only you can create, a credential only you can issue, a real-world
choice (domain name, billing plan) only you can make, or a physical machine
action (granting a permission dialog, plugging in a device).

Each entry says which issue it blocks and exactly what to do. Nothing in this
codebase currently depends on production hosting - the dev server is the only
target until you decide to deploy.

## Pending

### #47 - deploy self-hosted Nango + register the first OAuth apps

The code (`infra/nango/docker-compose.yml`, `services/lifeos-api/src/nango.rs`,
`/api/connections/*`) is built and tested against a mock. Bringing up a real
Nango instance and connecting a real account needs you:

1. **Generate secrets** (from `infra/nango/`):
   ```sh
   cp .env.example .env
   openssl rand -base64 32   # -> NANGO_ENCRYPTION_KEY (back this up outside git - immutable once real connections exist)
   openssl rand -hex 32      # -> NANGO_SECRET_KEY_DEV (and _PROD if you want a separate prod secret)
   ```
   Pick a Postgres password and dashboard username/password while you're in there.

2. **Bring it up**: `docker compose up -d` from `infra/nango/`. Dashboard at
   `http://localhost:3003` (basic-auth with the credentials you just set).

3. **Register a GitHub OAuth app** (developer settings -> OAuth Apps -> New):
   - Homepage URL: `http://localhost:3003`
   - Authorization callback URL: `http://localhost:3003/oauth/callback`
   - Copy the client id/secret into an "github" integration in the Nango dashboard.

4. **Register a Google Cloud OAuth client** (APIs & Services -> Credentials ->
   Create OAuth client ID, type "Web application" - covers Gmail+Calendar+Drive,
   issues #48/56/57/58):
   - Authorized redirect URI: `http://localhost:3003/oauth/callback`
   - Enable the Gmail, Calendar, and Drive APIs on the project.
   - Copy the client id/secret into a "google" integration in the Nango dashboard.

5. **Set `NANGO_SERVER_URL` and `NANGO_SECRET_KEY_DEV`** in lifeos-api's own
   env (not `infra/nango/.env` - the API process reads these directly) so
   `build_state()` wires the real client instead of leaving `/api/connections`
   at NotImplemented.

6. **Smoke test**: `POST /api/connections/session` with `{"provider": "github"}`,
   open the returned session in Nango's Connect UI (port 3009), complete the
   OAuth flow, then `POST /api/connections/complete` with the `connectionId`
   it gives you. Confirm the token never appears in `lifeos-api`'s logs or in
   the `/api/connections` response body - only `nango_connection_id`/
   `status`/`provider` should be visible.

This unblocks #48-55 (the rest of the integrations phase), which reuse this
same Nango deployment and only need their own provider app registered.

### #48 - Google app (Gmail + Calendar + Drive scopes)

Covered by step 4 above. Scopes to request on the OAuth consent screen:
`gmail.readonly` + `gmail.modify` (send stays gated at the API layer
regardless), `calendar` (read+write), `drive.readonly` + `drive.file`
(never blanket `drive` - `drive.file` only sees what the app itself creates).
No new code needed: `POST /api/connections/session {"provider": "google"}`
already works once the "google" integration exists in the Nango dashboard.

### #49 - Notion / Slack / GitHub / Figma apps

No new code needed - each is `POST /api/connections/session
{"provider": "<key>"}` once its integration is added in the Nango dashboard
(GitHub's OAuth app is already covered by #47 step 3). For each:

- **Notion**: notion.so/my-integrations -> New integration, capabilities
  "Read content" (+ "Update content" for the two-way sync #59 needs later).
  Redirect URI: `http://localhost:3003/oauth/callback`.
- **Slack**: api.slack.com/apps -> Create New App -> From scratch. OAuth
  scopes: `channels:read`, `channels:history`, `chat:write` (posting stays
  gated at the API layer). Redirect URL: `http://localhost:3003/oauth/callback`.
- **Figma**: figma.com/developers/apps -> Create new app. Callback:
  `http://localhost:3003/oauth/callback`. (Bulk of Figma access is via
  mcp-figma at runtime - this Nango connection is only for file *metadata*.)

### #50 - Meta (Instagram + WhatsApp) / X / Reddit apps

No new code needed for Instagram/X/Reddit - same pattern as #49. WhatsApp
Business Cloud is a native custom connector (not Nango), tracked separately
as #52.

- **Meta app** (developers.facebook.com/apps -> Create App -> type
  "Business"): add the Instagram Graph API product, request
  `instagram_basic` + `instagram_content_publish` (publish stays gated).
  Redirect URI: `http://localhost:3003/oauth/callback`.
- **X/Twitter app** (developer.x.com -> Projects & Apps -> Create App):
  OAuth 2.0, scopes `tweet.read` + `tweet.write` + `users.read` (write
  stays gated). Callback: `http://localhost:3003/oauth/callback`.
- **Reddit app** (reddit.com/prefs/apps -> create app, type "web app"):
  redirect URI `http://localhost:3003/oauth/callback`, scopes `read` +
  `submit` (submit stays gated).

### #51 - Zerodha Kite Connect app (read-only positions)

Kite doesn't fit Nango's OAuth model (daily request-token, not a refresh
token), so it's a native custom connector
(`services/lifeos-api/src/kite.rs`, `/api/connections/kite/*`,
`/api/broker/positions`). The code is built and tested against a mock -
trading stays read-only by construction (no place/modify/cancel/GTT route
exists anywhere on the router; `broker-guard` is the separate hook-layer
belt-and-suspenders). Bringing up a real connection needs you:

1. **Register a Kite Connect app** at developers.kite.trade -> Create new
   app. This is a *paid* Zerodha developer subscription (unlike every other
   integration in this doc) - check current pricing before registering.
   Redirect URL: point it at wherever the frontend will read the
   `request_token` query param and POST it to `/api/connections/kite/complete`
   (a local dev URL is fine to start, e.g. `http://localhost:5173/kite/callback`).

2. **Generate the shared secret-encryption key** (this key also covers #52's
   WhatsApp connector - generate it once):
   ```sh
   openssl rand -base64 32   # -> LIFEOS_SECRET_ENCRYPTION_KEY (back this up outside git - encrypted connections.secret_enc rows become unreadable if it's lost)
   ```

3. **Set lifeos-api's env**: `KITE_API_KEY`, `KITE_API_SECRET` (from the Kite
   Connect app), and `LIFEOS_SECRET_ENCRYPTION_KEY` from step 2. Until all
   three are set, `/api/connections/kite/*` and `/api/broker/positions`
   return 501.

4. **Daily login** (Kite's access_token expires every day around 6am IST -
   there is no way around re-logging in daily, by Kite's own design): visit
   `GET /api/connections/kite/login-url`, open it, log in, and the redirect
   will carry a `request_token` - POST that to `/api/connections/kite/complete`.

5. **Smoke test**: `GET /api/broker/positions` returns your real positions.
   Confirm the access token never appears in `lifeos-api`'s logs or in any
   `/api/connections`/`/api/broker/positions` response body - only
   `account_handle`/`status`/`provider` should be visible for the connection,
   and `positions` returns Kite's data with no token field.
