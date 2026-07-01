import { describe, expect, it } from "vitest";
import type { UserFromGetMe } from "grammy/types";
import { createBot, healthMessage } from "../src/bot.js";

const FAKE_BOT_INFO: UserFromGetMe = {
  id: 1,
  is_bot: true,
  first_name: "Life OS",
  username: "lifeos_test_bot",
  can_join_groups: true,
  can_read_all_group_messages: false,
  supports_inline_queries: false,
  can_connect_to_business: false,
  has_main_web_app: false,
  has_topics_enabled: false,
  allows_users_to_create_topics: false,
  can_manage_bots: false,
  supports_join_request_queries: false,
};

function textUpdate(text: string) {
  return {
    update_id: 1,
    message: {
      message_id: 1,
      date: 0,
      chat: { id: 1, type: "private" as const, first_name: "tester" },
      from: { id: 1, is_bot: false, first_name: "tester" },
      text,
      entities: [{ offset: 0, length: text.split(" ")[0].length, type: "bot_command" as const }],
    },
  };
}

// grammY's documented offline-testing pattern: pass `botInfo` so `bot.init()`
// never calls Telegram's getMe, and intercept outgoing API calls via
// `bot.api.config.use` instead of hitting the network.
function repliesFrom(bot: ReturnType<typeof createBot>) {
  const sent: string[] = [];
  bot.api.config.use((prev, method, payload, signal) => {
    if (method === "sendMessage" && typeof (payload as { text?: string }).text === "string") {
      sent.push((payload as { text: string }).text);
      return Promise.resolve({ ok: true, result: {} } as never);
    }
    return prev(method, payload, signal);
  });
  return sent;
}

describe("healthMessage", () => {
  it("returns a fixed ok string", () => {
    expect(healthMessage()).toBe("ok");
  });
});

describe("createBot", () => {
  it("replies to /start with an online message", async () => {
    const bot = createBot("fake-token", FAKE_BOT_INFO);
    const sent = repliesFrom(bot);

    await bot.init();
    await bot.handleUpdate(textUpdate("/start"));

    expect(sent).toEqual(["Life OS bot is online."]);
  });

  it("replies to /health with the health message", async () => {
    const bot = createBot("fake-token", FAKE_BOT_INFO);
    const sent = repliesFrom(bot);

    await bot.init();
    await bot.handleUpdate(textUpdate("/health"));

    expect(sent).toEqual([healthMessage()]);
  });

  it("does not reply to unrelated text", async () => {
    const bot = createBot("fake-token", FAKE_BOT_INFO);
    const sent = repliesFrom(bot);

    await bot.init();
    await bot.handleUpdate({
      update_id: 2,
      message: {
        message_id: 2,
        date: 0,
        chat: { id: 1, type: "private" as const, first_name: "tester" },
        from: { id: 1, is_bot: false, first_name: "tester" },
        text: "hello there",
      },
    });

    expect(sent).toEqual([]);
  });
});
