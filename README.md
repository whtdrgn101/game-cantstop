# @game-hub/game-cantstop

Sid Sackson's **_Can't Stop_** as a [Game Hub](https://github.com/whtdrgn101/game-hub) game package: the
classic 2–4 player push-your-luck dice game where you climb the number columns with three temporary
runners, pressing your luck for one more roll — until a roll that can advance nothing **busts** you and
wipes out the turn's progress. **Stop** in time to bank your runners as permanent squares; **first to
claim the top of three columns wins.**

**And it is built outside the platform monorepo.** Every Game Hub game began life inside the platform's
workspace; this one is a standalone repository that depends on `@game-hub/kernel` and `@game-hub/ui-kit`
**from the public npm registry**, exactly as any third-party consumer would — following the pattern the
Labyrinth pilot proved (Track D). If the published contract has a hole in it, this repo's CI is where it
shows up.

## The package shape

A Game Hub game is **additive** — four subpath exports behind game-agnostic hosts, so adding one touches
no shared core:

```
src/
  engine/     the pure rules core — no I/O, no Date, no Math.random. 100% coverage gate.
    core/       constants (rulebook-sourced), domain types, typed errors
    actions/    the turn: roll (server-injected dice), select a pairing, stop, applyAction, legalActions
    internal/   shared helpers (columns/runners maths, seating, the kernel record() binding)
    view.ts     viewFor — a no-op projection (Can't Stop hides nothing) kept for contract parity
    tests/      one file per concern
  module/     the backend seam — the GameModule: createGame wiring, the dice-roll route (server rolls the
              dice from injected randomness), parseAction, the error→HTTP map, the bot runner
  client/     the UI seam — the GameClient + the lazily-loaded board
    Board.tsx     the column board, the dice, the affordances (the board is React.lazy so the home
                  screen doesn't ship it)
    Status.tsx    the turn/status panel
    art/Die.tsx   a rendered die
  bot/        the AI — a pure risk model over public state, difficulty tiers, self-play + bench. 90% gate.
```

`./engine` is authoritative and pure; `./module` and `./client` are host bindings; `./bot` only ever
proposes an `Action` the engine then validates. There is **no hidden information** in Can't Stop — every
square, runner and die is public — so `viewFor` redacts nothing, the one property that makes this game a
useful counter-example to the games that do redact.

## Why it lives out here

Game Hub's whole design bet is that a game is a **package**, not a special case in a monorepo. That bet is
easy to fool in-workspace, where TypeScript source is consumed directly, Vite aliases stand in for a real
build, and `workspace:*` resolves everything. None of that survives `node_modules`. So this package
consumes the platform's two shareable pieces the way a stranger would:

| Package            | Version  | Why                                                                     |
| ------------------ | -------- | ----------------------------------------------------------------------- |
| `@game-hub/kernel` | `^1.2.0` | contracts + primitives (`GameError`, `record`, `makeSeating`, `Viewer`) |
| `@game-hub/ui-kit` | `^1.0.0` | the shared board chrome + the game-facing REST helpers (`./client`)     |

Both are **peer** dependencies (the host provides one copy) and **dev** dependencies (so this repo builds
and tests standalone). The ui-kit and `react` are **optional** peers: only `./client` needs them, so a
backend-only host installing this game for `./module` alone is never told it owes React. There are **no
references to the platform repository** — no path, no `file:` dep, no import. CI installs with
`--frozen-lockfile`, so the lockfile can only resolve `@game-hub/*` to registry tarballs.

## Running it

Requires **Node 22** (`.nvmrc`) and **pnpm** (the version is pinned in `packageManager`).

```bash
pnpm install         # resolves @game-hub/* from the public registry
pnpm test            # vitest + the coverage gates (engine 100%; bot 90%)
pnpm test:watch
pnpm typecheck       # strict TS across all four subpaths
pnpm lint            # ESLint 9 flat config — real hazards, not a second typecheck
pnpm format:check    # Prettier (hand-wrap Markdown; *.md is Prettier-ignored)
pnpm build           # tsc → dist/ (JS + .d.ts + inline-source maps), what publishConfig points at
pnpm pack:smoke      # pack, install outside this repo, play a game under plain node, typecheck a consumer
```

⚠️ **Relative imports in the shipped sources carry an explicit `.js` extension** (`'../engine/index.js'`) —
`tsc` emits them verbatim and Node ESM resolves neither extensions nor directories, so extensionless ones
would produce a tarball that throws on a host's first import while every command above stayed green.
`pack:smoke` is the honest check: it packs the tarball, installs it plus its peers from the public
registry into a throwaway project outside this repo, plays a whole turn through all four subpaths under
plain `node`, and typechecks a consumer against the shipped `.d.ts` under `nodenext` resolution.

CI (`.github/workflows/ci.yml`) runs exactly those, in that order, on a runner with no access to the
platform monorepo.

**Using this package in a host, before it is published:** `pnpm pack` here, then depend on the tarball —
the hub does exactly that from a committed `vendor/` directory for the Labyrinth game.

## Rules, and what's original

The rulebook PDF is **not** in this repository — it is copyrighted, so it stays local (gitignored) and the
code cites page numbers instead. See [`reference_materials/README.md`](./reference_materials/README.md)
for how to place it. Mechanics aren't copyrightable; the artwork here (the board, the dice) is drawn fresh.

## Status

Complete: the engine, the backend module (with its dice-roll route and bot runner), the client, and the
bot (CS1 + the difficulty tiers CS4). **CS3 — the rulebook's optional Sackson variants** (win at 4/5
columns; the "landing on an opponent's square" rules) — is the one remaining slice; see
[`ROADMAP.md`](./ROADMAP.md), which holds the rules digest and the slice history.

## Licence

BSD-3-Clause (see [`LICENSE`](./LICENSE)). Can't Stop is a game by Sid Sackson; this is an independent
implementation, not affiliated with or endorsed by its publishers.
