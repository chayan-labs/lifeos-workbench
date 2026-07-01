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
