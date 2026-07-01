import { execFile as execFileCb } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { scaffoldModule } from "../scaffold.js";

const execFile = promisify(execFileCb);
const REAL_TEMPLATE = path.resolve(import.meta.dirname, "..", "..", "modules", "_template");

let repoRoot;

async function git(args, cwd = repoRoot) {
  return execFile("git", args, { cwd });
}

beforeEach(async () => {
  repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "lifeos-scaffold-repo-"));
  await git(["init", "-b", "main"]);
  await git(["config", "user.email", "test@example.com"]);
  await git(["config", "user.name", "Test"]);

  await fs.mkdir(path.join(repoRoot, "modules"), { recursive: true });
  await fs.cp(REAL_TEMPLATE, path.join(repoRoot, "modules", "_template"), { recursive: true });
  await git(["add", "modules"]);
  await git(["commit", "-m", "seed _template"]);
});

afterEach(async () => {
  await fs.rm(repoRoot, { recursive: true, force: true });
});

// A benign mock agent that never touches the hook - the copy-the-template
// step in scaffold.js already seeds modules/<id>/module.js before the agent
// runs, so a well-behaved query() just needs to report success.
async function* benignQuery() {
  yield { type: "result", subtype: "success", is_error: false };
}

describe("scaffoldModule - happy path", () => {
  it("commits the scaffolded module to main and cleans up the worktree", async () => {
    const result = await scaffoldModule("add a reading list module", "ws_test", {
      repoRoot,
      queryFn: () => benignQuery(),
    });

    expect(result).toEqual({ success: true, moduleId: "add_a_reading_list_module", workspaceId: "ws_test" });

    const installed = await fs.readFile(path.join(repoRoot, "modules", "add_a_reading_list_module", "module.js"), "utf8");
    expect(installed).toContain("osRegisterModule");

    const { stdout: worktrees } = await git(["worktree", "list"]);
    expect(worktrees.split("\n").filter(Boolean)).toHaveLength(1); // only the main worktree remains
  });
});

describe("scaffoldModule - escape attempt", () => {
  it("aborts, merges nothing, and removes the worktree when the hook denies a write", async () => {
    // Simulates a compromised/misbehaving agent trying to write outside the
    // module dir - invokes the real PreToolUse hook it was given, exactly
    // as the SDK would when a tool_use targets an out-of-bounds file_path.
    async function* escapingQuery(params) {
      const hook = params.options.hooks.PreToolUse[0].hooks[0];
      await hook({ tool_input: { file_path: "/etc/passwd" } });
      yield { type: "result", subtype: "success", is_error: false };
    }

    const { stdout: before } = await git(["log", "--oneline", "main"]);

    const result = await scaffoldModule("try to escape the sandbox", "ws_test", {
      repoRoot,
      queryFn: (params) => escapingQuery(params),
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/PreToolUse hook denied/);

    const { stdout: after } = await git(["log", "--oneline", "main"]);
    expect(after).toBe(before); // nothing merged

    const { stdout: worktrees } = await git(["worktree", "list"]);
    expect(worktrees.split("\n").filter(Boolean)).toHaveLength(1); // discarded, not left behind
  });
});

describe("scaffoldModule - SDK error", () => {
  it("discards the worktree and merges nothing when the SDK call throws", async () => {
    const { stdout: before } = await git(["log", "--oneline", "main"]);

    const result = await scaffoldModule("this will blow up", "ws_test", {
      repoRoot,
      queryFn: () => {
        throw new Error("network unreachable");
      },
    });

    expect(result.success).toBe(false);

    const { stdout: after } = await git(["log", "--oneline", "main"]);
    expect(after).toBe(before);

    const { stdout: worktrees } = await git(["worktree", "list"]);
    expect(worktrees.split("\n").filter(Boolean)).toHaveLength(1);
  });
});
