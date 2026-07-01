// Naive module-id derivation from a self-extension prompt (issue #72). The
// PreToolUse hook (preToolUseHook.js) needs a concrete target directory
// BEFORE the agent runs, so something outside the LLM call has to pick the
// id first - real semantic id selection is #73's job (Zod structured
// output, docs/SELF-EXTENSION.md §3), which can replace this call in
// scaffold.js without touching the hook/sandbox/worktree wiring.
const MAX_LEN = 40;
const FALLBACK = "custom_module";

export function slugify(text) {
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, MAX_LEN)
    .replace(/_+$/g, "");

  return slug || FALLBACK;
}
