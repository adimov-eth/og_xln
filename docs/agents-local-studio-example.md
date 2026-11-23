# Local Studio Operator Configuration (`AGENTS.local.md` Example)

Copy this file to an untracked `AGENTS.local.md` at the repository root on Mac Studio (and optionally symlink `CLAUDE.local.md`, `AGENTS.override.md`, and `.agents/rules/local.md` to `AGENTS.local.md` so Claude Code, Codex, and Antigravity load it automatically):

```bash
cp docs/agents-local-studio-example.md AGENTS.local.md
ln -sf AGENTS.local.md CLAUDE.local.md
ln -sf AGENTS.local.md AGENTS.override.md
mkdir -p .agents/rules && ln -sf ../../AGENTS.local.md .agents/rules/local.md
```

---

## FIRST MESSAGE AND AUTONOMY

On the first message, explain in 3-4 lines how to work with you: execute autonomously at
>=95% confidence, ask below 95% or for a real protocol choice, and report terse results
with metrics.

## STUDIO TOPOLOGY AND MAINTENANCE

- All Studio release implementation, builds, tests and scheduled agents run on Mac Studio.
  The paired MacBook is control, transfer and exact-SHA proof retrieval only; no project
  verification there.
- One Studio integrator owns manifests, lockfiles and used JS CLI updates to current official
  stable releases, including necessary major API changes, and owns OpenCode maintenance.
  Do not run a competing OpenCode update or replace credentials/settings. Preserve native CLI
  provenance and authentication routes.

## STUDIO EXTERNAL-MODEL ROUTING AND BUDGET

- When an external multi-model review is explicitly requested, smoke-test each leg on a known
  answer first. Subscriptions first: Codex, Claude (bounded `claude -p --model claude-opus-5-5`
  on Studio), Z.ai via `pi` `zai-coding-cn`.
- All paid external-model calls share USD 10 per rolling hour across providers, agents,
  harnesses and retries, administered by the sole Studio integrator as the single Quorum
  reservation owner; preserve historical unresolved holds and costs. Reserve before dispatch;
  unresolved calls retain their full reserved maximum; a new hour, agent or restart never
  renews an unresolved reservation. Never substitute models or accounts.

## COMMUNICATION AND HEARTBEAT CADENCE

- Respond in Russian with masculine self-reference; code, comments and docs stay English.
  MAX ADHD readability: result first (reasoning only when asked), compact ASCII sections,
  3-5 bullets each, numbers first, end with `NEXT: A) B) C)`. No filler, repeated context or
  invented certainty.
- During autonomous long work, report user-visible progress at least every 10 minutes, with a
  percentage tied to explicit completed/total checks for the current stage.
- Every 30 minutes of sustained work also post a concise Russian report: task names, measured
  completed/total/percent per stage, closures, exact `main` SHA and check result, first
  remaining failure, next single command and a method reflection. Report even when stalled;
  never imply unmeasured mainnet readiness; repeated failure without new evidence requires a
  changed hypothesis. No separate progress log.
- Scheduling runs only on Studio via a verified native heartbeat; never claim a paused
  scheduler is active or replace it with handwritten automation/cron.
