# Self-extension - "Ask AI to add a module"

> The system grows itself: an in-app affordance that, on request, writes a brand-new declarative module, validates it, and hot-loads it - as a revertable git commit.
> Built on the **Claude Agent SDK** (not a raw `claude -p` subprocess), so tool-locking, structured output, and hooks are first-class.

---

## 1. Flow (Mac online, synchronous)

1. `POST /api/module-request { prompt, workspace_id }` → `module_requests` row + `events('module.requested')`.
2. `server/scaffold.js` drives the **Claude Agent SDK** (`@anthropic-ai/claude-agent-sdk`, `query({prompt, options})`), tool-restricted (see §2), given `modules/_template/` and existing manifests as examples.
3. The agent copies `modules/_template` → `modules/<id>/`, fills the manifest (entity types, attrs, views, integrations, bot commands, light color), and emits a **schema-validated manifest summary** as structured output (§3).
4. **Two validators** run (§4). Both must pass.
5. Insert `modules` row + `events('module.installed')`; **SSE hot-reload** - the new tile appears, no restart.
6. On failure → `status='failed'` surfaced in-app, one retry.

## 1b. Flow (Mac offline, queued)
Telegram `/addmodule …` → the bot writes `module_requests(status='queued')` to cloud Turso, replies "queued".
A `launchd` poller on the Mac drains on wake, runs the **identical** local build, commits to git, bot notifies "✅ live".
**Codegen only ever runs on the trusted Mac; the cloud bot only enqueues.**

---

## 2. Tool restriction - defense in depth (3 layers)

Restricting writes to one subdir is not a single switch; layer all three.

**Layer A - locked tool surface (primary gate):**
```ts
options = {
  allowedTools: ["Read","Glob","Grep","Edit","Write","Bash"],
  disallowedTools: ["WebFetch","WebSearch","Bash(rm -rf *)","Bash(git push *)","Bash(curl *)"],
  permissionMode: "dontAsk",   // anything not pre-approved is DENIED, never prompts (headless-safe)
}
```
Do **not** use `bypassPermissions` - `allowedTools` does not constrain it.

**Layer B - PreToolUse hook that fails closed on path (the dir scope):**
`allowedTools` cannot express "Write only under `modules/<id>/`". A hook matching `Write|Edit` (and `Bash`) denies when `tool_input.file_path` resolves outside the target dir:
```ts
hooks: { PreToolUse: [{ matcher: "Write|Edit", hooks: [async (input) => {
  const p = path.resolve(input.tool_input.file_path);
  if (!p.startsWith(targetModuleDir + path.sep))
    return { hookSpecificOutput: { hookEventName:"PreToolUse",
      permissionDecision:"deny", permissionDecisionReason:"writes confined to the new module dir" } };
  return {};
}] }] }
```
Hooks run first; a deny is absolute - it holds even under `bypassPermissions`. This is the code-level guarantee.

**Layer C - OS sandbox (kernel backstop for Bash):**
Enable the built-in macOS Seatbelt sandbox so any shell child is physically confined:
```json
{ "sandbox": { "enabled": true, "failIfUnavailable": true, "allowUnsandboxedCommands": false,
  "filesystem": { "allowWrite": ["./modules"] },
  "credentials": { "files":[{"path":"~/.aws","mode":"deny"},{"path":"~/.ssh","mode":"deny"}],
                   "envVars":[{"name":"GITHUB_TOKEN","mode":"deny"},{"name":"NPM_TOKEN","mode":"deny"}] } } }
```
In a linked git worktree the sandbox auto-allows the shared `.git` so `git commit` works, while denying `.git/hooks` and `.git/config`. `failIfUnavailable:true` makes the build refuse to run if Seatbelt can't init. Note: built-in Read/Edit/Write bypass the sandbox - that is why Layer B's hook is required; the sandbox only confines Bash.

---

## 3. Structured output - schema-validated manifest with auto-retry

The SDK does natively what would otherwise be a hand-rolled ajv + retry loop:
```ts
options.outputFormat = { type: "json_schema", schema };  // schema from Zod: z.toJSONSchema(ModuleManifest)
```
The SDK **validates the output and re-prompts on mismatch**. On success the result carries `structured_output`; on exhaustion `subtype === "error_max_structured_output_retries"`.
Define the manifest schema in **Zod** (one source of truth), end with `ModuleManifest.safeParse(structured_output)` for end-to-end type safety.
The agent emits the manifest summary (entityTypes/attrs/views/botCommands/agentTools ids) as structured output → it becomes the input to Validator 1 without re-reading files.

---

## 4. The two validators

**Validator 1 - structural (pure Node, no LLM):**
- Load the written `module.js` in a `vm`/worker, capture the `osRegisterModule({...})` argument.
- ajv-check against `module.schema.json`.
- Assert: schema-valid; no duplicate `type` ids across existing modules (query the registry); every `view.type` / ref resolves to a known core renderer; every `botCommand`/`agentTool` id unique.
- Fail → discard the worktree.

**Validator 2 - render smoke (headless Playwright):**
- Boot the app against a **scratch derived/replica DB** (never canonical `lifeos.db`), on an **ephemeral port**.
- Mount the new tile; assert **0 console/page JS errors** for the full session (`page.on('console'|'pageerror')`); assert each declared view mounts a node; assert an app-emitted **`module-mounted:<id>`** ready event (not arbitrary timeouts).
- **One bounded retry** before declaring failure (a single transient render error shouldn't burn a valid module).
- Fail → discard the worktree.

---

## 5. Isolation & commit (use Claude Code's own worktree feature)

Pipeline: create worktree `.claude/worktrees/scaffold-<id>` on a fresh branch → `query()` with Layers A/B/C → Validator 1 → Validator 2 → if both green, `git commit` in the worktree and merge to main (revertable single commit) → SSE push the new tile → remove worktree.
Any failure: remove the worktree; nothing touches main.

---

## 6. Reuse & risk

- **Port from** `anthropics/claude-agent-sdk-demos` (canonical `query()` + hooks + structured-output wiring). SDK repos: `claude-agent-sdk-typescript`, `…-python`. OS sandbox primitives standalone as `@anthropic-ai/sandbox-runtime`.
- Reuse `knowledge-atlas/tools/server.js` + `memory.js` as the app-boot/DB harness Validator 2 drives.
- **Biggest reliability risk: Validator 2 (render smoke) flakiness**, not the LLM. Mitigate with the ephemeral-port + fresh-scratch-DB + explicit ready-event + full-session error capture + one bounded retry already specified above. Keep the SDK's structured-output retry (free) separate from the render retry.

---

## 7. Marketplace tie-in
The same validated, signed manifests are the unit the **module marketplace** distributes; an install runs the *same two validators* locally before register. See [PLATFORM-SYSTEMS.md](./PLATFORM-SYSTEMS.md) §4.
