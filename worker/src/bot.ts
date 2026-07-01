// grammY bot definition - issue #63. Only /start and /health for now; DB
// access, capture/query commands, and gated approve/deny land in #64-67.
import { Bot } from "grammy";
import type { UserFromGetMe } from "grammy/types";

export function healthMessage(): string {
  return "ok";
}

// `botInfo` lets tests construct a Bot without a network call to Telegram's
// getMe (grammY's documented pattern for testing bots offline).
export function createBot(token: string, botInfo?: UserFromGetMe): Bot {
  const bot = new Bot(token, botInfo ? { botInfo } : undefined);

  bot.command("start", async (ctx) => {
    await ctx.reply("Life OS bot is online.");
  });

  bot.command("health", async (ctx) => {
    await ctx.reply(healthMessage());
  });

  return bot;
}
