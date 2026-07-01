# @lifeos/worker

Cloudflare Worker hosting the Telegram bot (grammY, `webhookCallback(bot, "cloudflare-mod")`)
and, later, OAuth callbacks. See `docs/ARCHITECTURE.md` §3.1 and `docs/BUILD-PLAN.md` phase 4.

Scope as of issue #63: bot scaffold + `/start` and `/health` commands only. Workspace DB
access, capture/query commands, gated approve/deny keyboards, and the heavy-job enqueue
path land in #64-67 (`@lifeos/db` via `@libsql/client/web` is already available for that
work - see `../db/README.md`).

## Develop

```
npm install
npm test         # vitest, no network - bot commands tested via grammY's offline pattern
npm run typecheck
npm run dev       # wrangler dev, needs .dev.vars with BOT_TOKEN (see docs/MANUAL-SETUP.md)
```

## Deploy (manual, one-time - see `docs/MANUAL-SETUP.md`)

```
wrangler login                       # or set CLOUDFLARE_API_TOKEN
wrangler secret put BOT_TOKEN        # Telegram bot token from @BotFather
npm run deploy
# then register the webhook so Telegram forwards updates to the deployed Worker
curl "https://api.telegram.org/bot$BOT_TOKEN/setWebhook?url=https://<worker-subdomain>.workers.dev/telegram"
```
