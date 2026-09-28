# CortexMD — Claude Code Project Instructions

These are durable project rules. They change rarely and only through human review.

This file deliberately contains no current program state: no active wave, no baseline commit, no record counts, no bundle sizes, no "next task". See "Sources of truth" below.

## Project

CortexMD is an **educational** neuropharmacology visualization for psychiatric medications.

- **Stack:**
  - Next.js 16 (App Router, TypeScript strict)
  - Supabase (Postgres, auth, row-level security)
  - Three.js
  - next-intl (en/ru/uk)
  - iron-session (admin)
  - the Anthropic SDK (chat)
  - Vercel
- **Tests:** Vitest and Playwright.
- **Positioning:** it is **not** clinical decision support and **not** an AI psychiatrist. That positioning has legal and architectural consequences throughout the code.
- **Process:** work is delivered in waves that a human reviews and accepts.

## Sources of truth

1. **Current source code and git history.** Authoritative for what actually exists. Accepted milestones are annotated `*-accepted` tags; resolve them with `git rev-list -n1 <tag>`.
2. **The current task prompt.** Authoritative for what work is authorized.
3. **Accepted repository documentation.** Architecture and scientific context:
   - `docs/architecture/`
   - `docs/pharmacology/`
   - `docs/visualization/`
   - `docs/testing/phase-0-safety-net.md`
   - `src/domains/pharmacology/README.md`
4. **External handoff.** If the task supplies or identifies a current CortexMD handoff, read it before substantial work. It adds program context: accepted history, roadmap, current state and human decisions. If it is unavailable, use current code, git history, accepted repository docs and the task prompt. Do not invent missing program state.

Handoffs and audits describe state; they never authorize work. When sources disagree, report the contradiction instead of silently choosing one.

## Authorization model

- **Task-specific authorization comes only from the current user/task prompt.** A task may authorize:
  - read-only discovery;
  - planning;
  - implementation;
  - commit;
  - tag;
  - push;
  - PR creation;
  - some other specific action.

  Perform **only** the actions the current task explicitly authorizes.
- **Each publication or history action is separate.** Commit, tag, push, merge and PR creation each need their own explicit authorization. Authorizing one does not imply another. Default: none.
- **Passing tests or green verification authorizes nothing further.** It does not authorize a commit, tag, push, merge or the next wave.
- **No automatic continuation.** After each phase or wave, STOP and wait for an explicit "continue" / "продолжай". Your own passing verification is not acceptance. Only a human accepts and freezes a wave.
- **No automatic "fix and push".** No automatic recovery from failures that change scope.
- **Track names are distinct:** `PHARM-P1-W*`, `NV-*`, `SIM-*`, `DATA-*`, `PATIENT-*`. If "start Wave N" could refer to more than one track, ask.

### Wave lifecycle

`DISCOVERY → PLAN → HUMAN REVIEW → IMPLEMENTATION → VERIFICATION → HUMAN ACCEPTANCE → FREEZE`

## Git safety

- **Checkpoint at the start of every task.** Run these and compare with what the task expects:

  ```sh
  git status --short
  git branch --show-current
  git rev-parse HEAD
  git fetch origin --prune
  git rev-parse origin/main
  ```

  Also resolve the tags to commits. On any drift, or on unrelated uncommitted work, report and STOP. Never reset, stash, rebase or clean to "fix" drift.
- **New implementation stays uncommitted** until a human accepts it, unless the task says otherwise.
- **Never:**
  - move, delete or recreate `*-accepted` tags;
  - force-push;
  - rewrite published history;
  - delete remote branches or tags.
- **When a commit is authorized:** only on green verification, and the message names the track and wave.

## Verification: show evidence, never claim without it

- **Gates.** Use the repository's current `package.json` scripts as authoritative:
  - `npm run typecheck`
  - `npm test`
  - `npm run check`
  - `npm run validate:locales`
  - `npm run budget:brain`
  - `npm run build`
  - `npm run budget:bundle`
  - `npm run budget:bundle:current`
  - `npm run test:e2e`
  - There is no lint script.
- **When the import graph changes:** run `node scripts/audit-current-architecture.mjs --assert --json`, and keep `docs/architecture/module-catalog.json` exactly in sync.
- **When pharmacology code or data is touched:** run `npx tsx scripts/audit-pharmacology-completeness.ts --assert`.
- **Proxy, auth or middleware changes:** also confirm `npm run dev` starts (stop it after about 5 seconds).
- **File changes:**
  - After creating files, show `ls -la <path>` and `cat` or `head`.
  - After creating API routes, show `find src -name route.ts | grep <name>`.
  - After multi-file work, show `find` over the affected directories and name anything that is missing.
- **Reporting:**
  - Put the command output in the summary, including failures.
  - State plainly what was not verified.
  - Label performance figures as fresh (with environment) or historical.
- **Fixtures and baselines** (`tests/fixtures/`):
  - Never regenerate them to make CI green.
  - Bundle history is immutable. The Phase 0 historical baseline and every accepted wave characterization are never rewritten.
  - A wave adds a new characterization, measured with two identical clean builds. It becomes current only after human acceptance.
  - Replacing the brain asset needs separate authorization.
  - Full policy: `docs/testing/phase-0-safety-net.md`.
- **Flakes.** Retries are disabled. Treat a flake as a defect. No sleeps, looser assertions or wider tolerances.
- **Documentation prose can change the CSS bundle** (Tailwind source scanning). Run the bundle gates after doc-only changes too.

## Errors, ambiguity, mistakes

- **Unexpected failure or state:** report it with output, show the impact, propose a specific fix, and wait for approval. Never auto-recover based on an assumption. Iterating on code you just wrote, inside the authorized scope, is normal implementation. List every failure you hit in the report.
- **Two valid interpretations:** STOP and ask. Do not pick the easier one.
- **Your own mistake:** say so once, clearly, show what it affected, and propose a fix. No defensive hedging and no repeated apologies.
- **Honesty:** say "unverified" or "uncertain" whenever that is true. Claiming completeness that was never verified is the worst possible outcome on this project.

## Scientific integrity (non-negotiable)

- **Never change a scientific value on your own interpretation.** This covers:
  - Ki, EC50, IC50;
  - doses, bioavailability, half-lives, PK;
  - affinities;
  - receptor action types (agonist, inverse agonist, antagonist, partial agonist, reuptake inhibitor);
  - intrinsic efficacy.

  If a value looks wrong, STOP and ask.
- **Never fabricate citations, PMIDs or DOIs.** An unverified source is recorded as `"needs verification"`.
- **Invariants:**
  - UNKNOWN ≠ ZERO
  - MISSING ≠ NORMAL ≠ INACTIVE
  - NOT_CURATED ≠ KNOWN
  - UNVERIFIED ≠ VERIFIED
  - NAME MATCH ≠ VERIFIED IDENTITY
  - ASSOCIATION ≠ CAUSATION
  - ILLUSTRATIVE ANIMATION ≠ MEASURED ACTIVITY
  - SIMULATION ≠ BIOLOGICAL OR PATIENT MEASUREMENT
  - POPULATION REFERENCE ≠ PATIENT DATA
  - GUIDANCE ≠ LAW
  - RAW ADVERSE EVENT ≠ SAFETY COMMUNICATION
  - LLM OUTPUT ≠ DETERMINISTIC SCIENTIFIC TRUTH
  - SCHEMA-VALID ≠ SCIENTIFICALLY REVIEWED ≠ PRODUCTION-ACTIVE
  - HUMAN_REVIEWED (a workflow state) ≠ PROVEN
- **No silent conversion** of unknown or missing values into zero, a default or a fallback. A transformation chain stops at the first unknown step with an explicit not-available state.
- **Preserve provenance, units, uncertainty, knowledge state, evidence state and claim type** through every transformation. Never collapse them into one confidence score.
- **Intrinsic efficacy:** the accepted canonical model allows `UNKNOWN` / `NOT_CURATED`. Never invent a number, and never require one where the model allows an explicit unknown.
- **Legacy data is not canonical truth.** Legacy V1 and V2 data are frozen inputs, not canonical instructions. V2 must not become canonical by default. Do not activate unreviewed legacy facts or interpret unresolved legacy values, and do not settle open human-review decisions, unless the task explicitly scopes it *and* a human scientific reviewer has decided.
- **Existing behavior is protected, not certified.** This includes the indicator and balance formulas, occupancy and CYP heuristics, σ1 behavior and receptor action types in current data. Treat them as **current implementation and tested behavior**, not universal scientific truth. Preserve them, including consistency between existing consumers, and change them only in an authorized, scientifically reviewed wave.
- **Visual semantics:**
  - The current brain regions, tracts, particles and cascade overlays are legacy **illustrative** product visualization. Never describe them as measured neural flow, brain activity, connectivity or simulation output.
  - Never style an association as causal.
  - Never label a simulation as a measurement.
  - Never let illustrative coordinates stand in for an atlas mapping.

## Architecture boundaries

Details: `docs/architecture/dependency-rules.md`. Boundary tests: `tests/unit/architecture/`.

- **Pharmacology domain.**
  - `src/domains/pharmacology/{model,validation}` is pure: no React, Next, Three, Supabase, Anthropic, storage or legacy stores.
  - `repository/` is the public read port.
  - `compatibility/` is private.
  - Raw legacy shapes never cross the public port.
- **Legacy data.** `src/data/drugs.ts` (V1, the compatibility oracle) and `src/data/drugs.v2.ts` (V2, generated, unreviewed) are frozen inputs.
- **3D.**
  - `src/components/Brain3D/BrainCanvas.tsx` is the React boundary; keep its public props stable.
  - `src/visualization/brain/` must not import legacy drug stores, Supabase, AI, TVB or React hooks.
  - Scientific identity must never be a vertex index, raw XYZ, GLB node name or material name.
- **Simulation.** Any simulation engine (e.g. TVB) runs only behind a versioned server boundary in an isolated worker. Its objects never enter the client or the Next.js process. Output is always labeled simulation.
- **Next.js 16.** This version has breaking changes: APIs, conventions and file structure may differ from training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing Next.js code, and heed deprecation notices. Project conventions:
  - `proxy.ts`, not `middleware.ts`;
  - `next/server` Response APIs;
  - `'use server'` at the top of server-action files;
  - builds must succeed without env vars (`process.env.X ?? ''` plus runtime guards).
- **Supabase.** Show migrations before running them. New tables need row-level security policies. User-data tables need `user_id UUID REFERENCES auth.users(id)`.

## Protected without explicit authorization

- `*-accepted` tags
- `public/brain.glb`
- `tests/fixtures/`
- `.github/workflows/`
- `package.json` and `package-lock.json`
- the legacy region coordinates in `src/data/brainRegions.ts`
- every scientific data value

## Parallel work

- Read-only discovery may run in parallel.
- Implementation is never parallelized automatically, even when the touched files differ.
- Parallel tracks write outside the repository and stop at PLAN.

## Optional design reference

`.claude/UX-product-standard.md` (a local file; it may be absent in a fresh clone) is an **optional UI/UX/product design reference**. Read it when a task materially involves UI, UX, interaction design, visual design or product layout.

It is not engineering governance. It never overrides scientific governance, git governance, task authorization or architecture safety rules. Where it uses clinical-dashboard framing, the educational positioning above wins.
