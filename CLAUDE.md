# CLAUDE.md — @game-hub/game-cantstop

Working agreement for this repo. It is the lean, repo-scoped version of the Game Hub platform's own
`CLAUDE.md`; read this, then [`ROADMAP.md`](./ROADMAP.md) (rules digest, slice history, the one open
slice CS3) and [`README.md`](./README.md).

## What this repo is

Can't Stop (Sid Sackson's push-your-luck dice game) as a **Game Hub game package**, built **outside** the
hub monorepo against the *published* `@game-hub/kernel` and `@game-hub/ui-kit` — the same out-of-repo
shape the Labyrinth pilot proved (Track D). It was extracted from the platform's `packages/games/cantstop`.

⚠️ **The platform monorepo is a reference, never a dependency.** This repo must contain **no** path, link,
`file:`/`workspace:` dep or import that reaches into it. Its conventions are worth copying; its filesystem
is not available. Two platform packages, from the registry, are the entire coupling:

| Package            | Version  | Why                                                                     |
| ------------------ | -------- | ----------------------------------------------------------------------- |
| `@game-hub/kernel` | `^1.2.0` | contracts + primitives (`GameError`, `record`, `makeSeating`, `Viewer`) |
| `@game-hub/ui-kit` | `^1.0.0` | the shared board chrome + the game-facing REST helpers (`./client`)     |

Both are **peer** dependencies (the host provides one copy) and **dev** dependencies (so this repo builds
and tests standalone). The ui-kit and `react` are marked **optional** peers: only `./client` needs them,
and a backend host that installs this game for `./module` alone must not be told it owes React. Never add a
dependency on the hub's backend or UI packages — that's an unpublishable package.

⚠️ **The kernel's major version _is_ the host↔game contract version.** `./module` declares
`kernelContract: KERNEL_CONTRACT_VERSION` imported from the kernel it compiled against — **never a
literal** — so a game that ends up resolving a different kernel copy is caught at registration instead of
mid-game.

## Non-negotiables

- **Read the rulebook page before implementing a rule, and cite it in a comment** (`// pg. 9: "as many as
  you are able"`). Never from memory, never a guess at something checkable. The PDF is local-only
  (gitignored, copyrighted — see `reference_materials/README.md`); page numbers in comments are how the
  citation survives.
- **Tests ship with the code.** A feature without tests isn't finished. `src/engine/**` is gated at
  **100%** (every branch of a rule is a rule and deserves a test); `src/bot/**` at **90%** (heuristics get
  retuned; a 100% bar on judgement calls buys churn). Never weaken a gate to make a change land —
  including by widening `coverage.exclude`.
- **The engine is pure.** No `Date`, no `Math.random`, no mutation, no I/O. Randomness is **injected**:
  Can't Stop has **no setup randomness** at all (`createGame` takes no `rng`) — its only randomness is the
  per-turn dice roll, which the **server** rolls (`./module`'s roll route, from the injected `ctx.rng`)
  and hands to the engine's pure `roll(state, playerId, dice)`. An engine or module file reaching for
  `Math.random` is a bug.
- **Only `record()` touches `version`/`log`** (`internal/record.ts`, the kernel's). Never bump or append
  by hand.
- **Everything logged is public** — and in Can't Stop *everything* is public: no hidden information, so
  `viewFor` redacts nothing. Preserve that as the game's defining counter-example; don't invent secrets.
- **No new patterns where an established one fits.** Typed error codes on a `GameError` subclass,
  immutable state, one mechanic per file with one matching test file, kernel helpers over
  re-implementations.

## Conventions

- **Unit tests live in `src/<subpath>/tests/`**, not beside the source. `src/engine/**` and `src/bot/**`
  are gated; `src/module/**` and `src/client/**` are not (they are host bindings, exercised for real by
  the hub's backend/UI suites once this game is registered).
- **`viewFor` and the view types live in the *engine* (`src/engine/view.ts`), not the module** — as in
  every hub game. What a player may see is as much a rule as what they may do; `./client`/`./bot` must be
  able to name the projection type without importing `./module`. The module just delegates.
- **The board asks the engine; it never re-derives a rule.** Affordances come from `legalActions` /
  `legalSelections`; the client never invents dice or legality.
- Import siblings by direct path (`./roll.js`), cross-folder via the barrel (`../core/index.js`), the
  kernel by package specifier (`@game-hub/kernel`). Under `tests/`, reach the engine as `../`.
- ⚠️ **Relative imports in shipped sources carry an explicit `.js` extension** — `'./roll.js'`,
  `'../core/index.js'`, and `import('./Board.js')` — including the folder barrels, which need the
  `/index.js` spelled out. This is the platform's D2a lesson, re-learned in the Labyrinth pilot at D2d:
  `tsc` emits relative specifiers **verbatim**, and Node ESM does neither extension nor directory
  resolution, so an extensionless `from '../engine'` produces a tarball that throws `ERR_MODULE_NOT_FOUND`
  on a host's first import while every check in this repo is green. A `.js` specifier resolves to the
  `.ts`/`.tsx` source in-workspace (TS, Vite and Vitest all do the mapping) *and* to the emitted `.js` in
  `dist/`, so one spelling serves both. Files under `tests/` are excluded from the build; they keep the
  same `.js` style for consistency. `pnpm pack:smoke` is what catches a regression — do not "tidy" the
  extensions away.
- One mechanic = one file in the relevant folder + one matching test file. Reuse `internal/` helpers.
- Prettier owns formatting (single quotes, semicolons, trailing commas, width 120). **`*.md` is
  Prettier-ignored — hand-wrap docs to ~110–120 columns.** ESLint catches hazards, not style, and is *not*
  a second typechecker.
- Comments explain **why**, and cite the rulebook page or the decision. If a decision isn't obvious from
  the code, it goes in `ROADMAP.md` — a decision that isn't written down didn't happen.

## Before you call a slice done

```bash
pnpm typecheck && pnpm lint && pnpm format:check && pnpm test
pnpm pack:smoke   # slower; run it whenever you touch imports, exports, package.json or the build
```

`pack:smoke` is the only check that runs against **`dist/`** rather than TS source: it packs the tarball,
installs it plus its declared peers **from the public registry** into a throwaway project outside this
repo, plays a game through all four subpaths under plain `node`, and typechecks a consumer against the
shipped `.d.ts` under `nodenext` resolution. Everything else here would stay green while the published
package was unusable.

- **Verify, don't infer.** Green tests are not evidence a feature works — drive the real thing where one
  exists. If you didn't verify it, say so plainly.
- **Surface problems instead of routing around them** — a wrong rule, a bad assumption, a platform-side
  gap in the published contract. Out-of-repo friction is a first-class finding, not a quiet workaround.
- **Keep `ROADMAP.md` and this file current as decisions land**, not in a later cleanup pass.
- Commit at working checkpoints (green gates, coherent slice). **Don't commit or push unless asked.**
