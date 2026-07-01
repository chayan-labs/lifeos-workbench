// Cloudflare Worker entrypoint - issue #63 (docs/ARCHITECTURE.md §3.1).
// Routes Telegram's webhook POSTs into grammY via the native Workers
// adapter (`webhookCallback(bot, "cloudflare-mod")`); everything else is a
// bare liveness check for `wrangler deploy` smoke-testing.
import { webhookCallback } from "grammy";
import { createBot } from "./bot.js";

export interface Env {
  BOT_TOKEN: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/") {
      return new Response("ok", { status: 200 });
    }

    if (url.pathname === "/telegram" && request.method === "POST") {
      const bot = createBot(env.BOT_TOKEN);
      const handleUpdate = webhookCallback(bot, "cloudflare-mod");
      return handleUpdate(request);
    }

    return new Response("not found", { status: 404 });
  },
};
