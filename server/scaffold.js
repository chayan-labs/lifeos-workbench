// Self-extension builder (issue #72, docs/SELF-EXTENSION.md). Drives the
// Claude Agent SDK, tool-restricted by all three defense-in-depth layers
// (§2), in an isolated git worktree, and commits the result as the install
// (§5).
//
// Deliberately NOT wired in here (separate issues, matches this project's
// incremental pattern - e.g. #66 enqueueing a job before a drain existed):
// - Structured-output schema/id selection (§3, issue #73) - `slugify()` is a
//   naive stand-in for picking the module id ahead of the agent call, since
//   Layer B's hook needs a concrete target directory before `query()` runs.
// - The two real validators (§4, issues #74/#75) - `server/validators/
//   structural.js`/`render.js` are still fakes (string-includes checks / an
//   unconditional `return true`) left over from an earlier prototype commit;
//   calling them here would just give false confidence, so this file does
//   not import them. Gating the merge on real validators is #74/#75's job.
import fs from "node:fs/promises";
import path from "node:path";
import { query as defaultQuery } from "@anthropic-ai/claude-agent-sdk";
import { buildSandboxConfig } from "./lib/sandbox.js";
import { createPreToolUseHook } from "./lib/preToolUseHook.js";
import { slugify } from "./lib/slugify.js";
import { commitAndMerge, createWorktree, removeWorktree } from "./lib/worktree.js";

const DEFAULT_REPO_ROOT = path.resolve(import.meta.dirname, "..");

// Layer A (docs/SELF-EXTENSION.md §2) - the primary gate. `dontAsk` denies
// anything not pre-approved instead of prompting, which is what makes this
// safe to run headless/unattended. Never `bypassPermissions` - it isn't
// constrained by `allowedTools` at all.
const ALLOWED_TOOLS = ["Read", "Glob", "Grep", "Edit", "Write", "Bash"];
const DISALLOWED_TOOLS = ["WebFetch", "WebSearch", "Bash(rm -rf *)", "Bash(git push *)", "Bash(curl *)"];

async function copyTemplate(repoRoot, worktreePath, moduleId) {
  const templateDir = path.join(repoRoot, "modules", "_template");
  const targetModuleDir = path.join(worktreePath, "modules", moduleId);
  await fs.cp(templateDir, targetModuleDir, { recursive: true });
  return targetModuleDir;
}

function buildPrompt(userPrompt, moduleId) {
  return [
    `Edit modules/${moduleId}/module.js (already seeded from the _template scaffold) so it satisfies this request:`,
    userPrompt,
    `Keep it a single osRegisterModule({...}) call, id: "${moduleId}". Only edit files under modules/${moduleId}/.`,
  ].join("\n\n");
}

// Consumes the SDK's async-generator result stream, watching for a denied
// tool call (tracked via the hook wrapper below, not by re-parsing SDK
// messages - the hook already knows the ground truth) and a terminal
// success/error `result` message.
async function runAgent(queryFn, prompt, options, hookState) {
  const stream = queryFn({ prompt, options });
  let sawSuccess = false;

  for await (const message of stream) {
    if (message.type === "result") {
      sawSuccess = message.subtype === "success" && !message.is_error;
    }
  }

  if (hookState.denied) {
    throw new Error(`PreToolUse hook denied a write outside the module dir: ${hookState.reason}`);
  }
  if (!sawSuccess) {
    throw new Error("Agent SDK query did not complete successfully");
  }
}

export async function scaffoldModule(prompt, workspaceId, opts = {}) {
  const repoRoot = opts.repoRoot ?? DEFAULT_REPO_ROOT;
  const queryFn = opts.queryFn ?? defaultQuery;

  const moduleId = slugify(prompt);
  const { worktreePath, branch } = await createWorktree(repoRoot, moduleId);

  try {
    const targetModuleDir = await copyTemplate(repoRoot, worktreePath, moduleId);

    // Wraps Layer B's hook so scaffold.js can observe a denial directly,
    // rather than inferring it from the SDK's message stream.
    const hookState = { denied: false, reason: null };
    const baseHook = createPreToolUseHook(targetModuleDir);
    const trackedHook = async (input) => {
      const result = await baseHook(input);
      if (result.hookSpecificOutput?.permissionDecision === "deny") {
        hookState.denied = true;
        hookState.reason = result.hookSpecificOutput.permissionDecisionReason;
      }
      return result;
    };

    const options = {
      cwd: worktreePath,
      allowedTools: ALLOWED_TOOLS,
      disallowedTools: DISALLOWED_TOOLS,
      permissionMode: "dontAsk",
      hooks: { PreToolUse: [{ matcher: "Write|Edit", hooks: [trackedHook] }] },
      ...buildSandboxConfig(),
    };

    await runAgent(queryFn, buildPrompt(prompt, moduleId), options, hookState);

    await commitAndMerge(repoRoot, worktreePath, branch, moduleId);
    await removeWorktree(repoRoot, worktreePath, branch);

    return { success: true, moduleId, workspaceId };
  } catch (error) {
    await removeWorktree(repoRoot, worktreePath, branch).catch(() => {});
    return { success: false, moduleId, workspaceId, error: error.message };
  }
}

// Manual local smoke run - not exercised by the test suite (needs a real
// ANTHROPIC_API_KEY and mutates real git state), see docs/SELF-EXTENSION.md's
// "Implemented (issue #72)" note.
if (process.argv[1] === import.meta.filename) {
  const result = await scaffoldModule("add a reading list module", "default-personal-workspace");
  console.log(result);
}
