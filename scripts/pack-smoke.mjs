#!/usr/bin/env node
/**
 * Pack smoke test for `@game-hub/game-cantstop` (Track D).
 *
 * Adapted from the Labyrinth pilot's `scripts/pack-smoke.mjs`, itself descended from
 * `@game-hub/kernel`'s D2a script — the check that exists because the platform learned this lesson the
 * hard way. Every other check in this repo runs against **TypeScript source**: `pnpm typecheck`,
 * `pnpm test`, even the client's types. None of them says anything about the artefact a host actually
 * installs, which is a tarball whose `exports` resolve to `dist/`. Its failure modes are invisible from
 * in here:
 *
 *   1. **Extensionless / directory relative imports.** `tsc` emits `from '../engine'` verbatim; Node ESM
 *      does neither extension nor directory resolution, so the installed package throws
 *      `ERR_MODULE_NOT_FOUND` on first import while every suite in this repo is green. Hence the `.js`
 *      specifiers in the shipped sources (see `CLAUDE.md`) — and hence this script, which is what stops
 *      somebody helpfully "tidying" them away.
 *   2. **A lazily-imported file that never made it into the tarball.** `./client` code-splits its board
 *      with `lazy(() => import('./Board.js'))`. Nothing loads that file until a player opens a game, so a
 *      missing or unresolvable `dist/client/Board.js` would ship silently and only break in production.
 *   3. **A dependency that leaked from `devDependencies`.** Only `@game-hub/kernel`, `@game-hub/ui-kit`
 *      and `react` are declared (as peers). If a shipped file ever imports `vitest`, `fastify`, a
 *      testing-library, or anything else that is dev-only in here, the install below has no way to
 *      satisfy it.
 *
 * So: pack it, install the tarball plus its **real peers from the public registry** into a throwaway
 * project outside this repo, and drive it two ways — plain `node` for the runtime surface (a game is
 * created, rolled, a pairing selected and banked, and redacted), and `tsc --noEmit` under `nodenext`
 * resolution (the strictest mode: it honours the `exports` map exactly as Node does and refuses
 * extensionless relative specifiers inside the shipped `.d.ts`) for the type surface.
 *
 * Run: `pnpm pack:smoke`   (CI runs it after the unit tests.)
 * Set `KEEP_SMOKE_DIR=1` to leave the temp project behind for inspection.
 */
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * What plain Node must be able to do with the installed package: reach all four subpaths through the
 * `exports` map and get a *working* game out of them, not merely importable modules.
 */
const RUNTIME_SMOKE = `import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

import {
  applyAction, createGame, legalActions, roll, viewFor, GameError,
  COLUMNS, COLUMN_HEIGHTS, WIN_COLUMNS, MAX_RUNNERS, DICE_COUNT, MIN_PLAYERS, MAX_PLAYERS,
} from '@game-hub/game-cantstop/engine';
import cantStopModule from '@game-hub/game-cantstop/module';
import cantstopClient from '@game-hub/game-cantstop/client';
import * as bot from '@game-hub/game-cantstop/bot';

const require = createRequire(import.meta.url);

// --- ./engine — the pure rules core, driven for real. ---
assert.equal(DICE_COUNT, 4);
assert.equal(WIN_COLUMNS, 3);
assert.equal(MAX_RUNNERS, 3);
assert.equal(MIN_PLAYERS, 2);
assert.equal(MAX_PLAYERS, 4);
assert.equal(COLUMNS.length, 11);
assert.equal(COLUMN_HEIGHTS[7], 13, 'the 7-column is the tallest — the board\\'s core risk/reward shape');

const engineGame = createGame({ id: 'e', players: [{ name: 'Ann' }, { name: 'Bob' }] });
assert.equal(engineGame.players.length, 2);
assert.equal(engineGame.phase, 'rolling');
assert.equal(engineGame.status, 'active');

// A turn: server-rolled dice (injected — the engine stays pure) -> pick a legal pairing -> bank it.
let s = roll(engineGame, 'p1', [1, 1, 2, 2]);
assert.equal(s.phase, 'selecting');
const select = legalActions(s, 'p1').find((action) => action.type === 'SELECT');
assert.ok(select, 'a legal SELECT must exist after a rollable roll');
s = applyAction(s, 'p1', select);
assert.equal(s.phase, 'rolling', 'advancing never ends the turn');
assert.ok(Object.keys(s.runners).length > 0, 'runners are out after a SELECT');
const stopAction = legalActions(s, 'p1').find((action) => action.type === 'STOP');
assert.ok(stopAction, 'STOP is offered once a runner is out');
s = applyAction(s, 'p1', stopAction);
assert.equal(s.phase, 'rolling');

// --- ./module — the backend seam: identity, then a real turn through parse -> apply -> redact. ---
assert.equal(cantStopModule.id, 'cantstop');
assert.equal(cantStopModule.name, "Can't Stop");
assert.equal(cantStopModule.minPlayers, 2);
assert.equal(cantStopModule.maxPlayers, 4);
assert.equal(cantStopModule.kernelContract, 1);
assert.equal(cantStopModule.colors.length, 4);
assert.deepEqual([...cantStopModule.botDifficulties], ['easy', 'normal', 'hard']);

let state = cantStopModule.createGame({ id: 'g', players: [{ name: 'Ann' }, { name: 'Bob' }], rng: () => 0.5 });
assert.equal(cantStopModule.versionOf(state), 0);

// parseAction: the player's real choices are accepted; ROLL is refused (server-only), junk is refused.
assert.equal(cantStopModule.parseAction({ type: 'STOP' }).ok, true);
assert.equal(cantStopModule.parseAction({ type: 'ROLL', dice: [1, 2, 3, 4] }).ok, false);
assert.equal(cantStopModule.parseAction({ type: 'NOPE' }).ok, false);

// A move exactly as the backend takes it: the server rolls, then a client's SELECT is parsed + applied.
state = roll(state, 'p1', [1, 1, 2, 2]);
const parsed = cantStopModule.parseAction(
  JSON.parse(JSON.stringify(legalActions(state, 'p1').find((action) => action.type === 'SELECT'))),
);
assert.equal(parsed.ok, true);
state = cantStopModule.applyAction(state, 'p1', parsed.action);
assert.equal(cantStopModule.versionOf(state), 2, 'ROLL then SELECT are two recorded moves');
assert.equal(cantStopModule.movesOf(state).length, 2);

// viewFor is a no-op redaction (Can't Stop hides nothing) but must still tag the viewer, and ./engine
// and ./module must agree on it.
const view = cantStopModule.viewFor(state, 'p1');
assert.equal(view.viewerId, 'p1');
assert.equal(view.id, 'g');
assert.deepEqual(viewFor(state, 'p1'), view, './engine and ./module agree on the projection');

// mapError turns a domain error into a status, and declines anything it does not own.
assert.equal(cantStopModule.mapError(new GameError('WRONG_PHASE', 'x')).status, 409);
assert.equal(cantStopModule.mapError(new Error('not mine')), null);
assert.equal(cantStopModule.summarize(state).id, 'g');

// --- ./client — the UI seam. React must be resolvable from here; the board must stay code-split. ---
assert.equal(cantstopClient.id, 'cantstop');
assert.equal(cantstopClient.name, "Can't Stop");
assert.ok(cantstopClient.rules.length >= 4);
assert.equal(typeof cantstopClient.Status, 'function');
assert.equal(
  cantstopClient.Board.$$typeof,
  Symbol.for('react.lazy'),
  'the board must still be a React.lazy — losing the split is an invisible regression',
);
// …and the file that lazy import points at must actually be in the tarball and loadable by plain Node.
const clientDir = dirname(require.resolve('@game-hub/game-cantstop/client'));
const board = await import(pathToFileURL(join(clientDir, 'Board.js')).href);
assert.equal(typeof board.default, 'function', 'dist/client/Board.js must load and default-export the board');

// --- ./bot — the risk model + difficulty tiers, resolvable and callable at runtime. ---
assert.equal(typeof bot.decide, 'function');
assert.equal(typeof bot.shouldRoll, 'function');
assert.deepEqual(Object.keys(bot.DIFFICULTIES).sort(), ['easy', 'hard', 'normal']);
assert.equal(typeof bot.BotError, 'function');

// The package declares no runtime dependencies — everything it needs is a peer the host already has.
assert.deepEqual(require('@game-hub/game-cantstop/package.json').dependencies ?? {}, {});

console.log('runtime smoke ok — ./engine ./module ./client ./bot all resolve, and a game plays');
`;

/** What a consumer's compiler must see: the exported type surface, through the published `exports`. */
const TYPE_CONSUMER = `import { createGame, viewFor, type Action, type CantStopState, type CantStopView, type NewPlayer } from '@game-hub/game-cantstop/engine';
import cantStopModule from '@game-hub/game-cantstop/module';
import cantstopClient from '@game-hub/game-cantstop/client';
import { decide, type CantStopDifficulty } from '@game-hub/game-cantstop/bot';
import type { GameModule as KernelGameModule } from '@game-hub/kernel';

// The one assignment that matters: what ./module exports really is a kernel GameModule, checked through
// the *published* .d.ts of both packages rather than through the workspace's source. The Ctx/App generics
// are recovered from the module's own hooks — they are bound internally to the kernel's structural host
// types + Fastify (never re-exported), so a consumer reads them back off the value.
type Ctx = Parameters<NonNullable<typeof cantStopModule.createBotDriver>>[0];
type App = Parameters<NonNullable<typeof cantStopModule.routes>>[0];
const asContract: KernelGameModule<CantStopState, Action, Ctx, App> = cantStopModule;

const players: NewPlayer[] = [{ name: 'Ann' }, { name: 'Bob' }];

export const surface = {
  id: asContract.id,
  // The engine's rules + its typed projection, through the published .d.ts. (The module's own viewFor
  // is opaque — the kernel contract types it as returning \`unknown\`, since the host projects views
  // opaquely — so the *typed* view comes from the engine, exactly as ./client and ./bot read it.)
  engine: createGame({ id: 'g', players }).turn,
  view: viewFor(createGame({ id: 'g', players }), 'p1') satisfies CantStopView,
  client: cantstopClient.name,
  bot: typeof decide,
  difficulty: 'hard' satisfies CantStopDifficulty,
};
`;

const CONSUMER_TSCONFIG = {
  compilerOptions: {
    target: 'ES2022',
    lib: ['ES2022', 'DOM', 'DOM.Iterable'],
    jsx: 'react-jsx',
    // The strictest resolution mode on purpose: `nodenext` honours the `exports` map exactly as Node
    // does and rejects extensionless relative specifiers inside the shipped `.d.ts` files. If this
    // passes, a consumer on `bundler` resolution (which is what the hub uses) is safe by construction.
    module: 'nodenext',
    moduleResolution: 'nodenext',
    strict: true,
    noEmit: true,
    // Third-party declarations (lucide-react, csstype, …) arrive transitively through `@game-hub/ui-kit`
    // and their health is not this script's business — what we are checking is that *our* .d.ts files
    // resolve and typecheck, which they must do before skipLibCheck ever applies.
    skipLibCheck: true,
    types: [],
  },
  include: ['consumer.ts'],
};

const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(packageDir, 'package.json'));
const manifest = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8'));

/** Run a command, streaming its output; a non-zero exit throws and fails the script. */
const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, stdio: 'inherit' });
const step = (message) => console.log(`\n▶ ${message}`);

// A temp dir under the OS temp root, deliberately **outside** this repo: inside it, pnpm/npm would
// resolve the package back to its own source and prove nothing.
const projectDir = mkdtempSync(join(tmpdir(), 'game-cantstop-pack-smoke-'));
let ok = false;
try {
  step(`packing @game-hub/game-cantstop → ${projectDir}`);
  // `prepack` runs the tsc build, so this also proves the build is wired to the publish path.
  run('pnpm', ['pack', '--pack-destination', projectDir], packageDir);
  const tarball = readdirSync(projectDir).find((name) => name.endsWith('.tgz'));
  if (!tarball) throw new Error('pnpm pack produced no .tgz');

  step(`installing ${tarball} + its declared peers into a throwaway project`);
  writeFileSync(
    join(projectDir, 'package.json'),
    `${JSON.stringify({ name: 'cantstop-pack-smoke', version: '0.0.0', private: true, type: 'module' }, null, 2)}\n`,
  );
  // npm rather than pnpm: no workspace inference, and — crucially — the peers come from the **public
  // registry**, which is the honest version of "a host installs this game". The ranges are read from
  // this package's own `peerDependencies` so the smoke can never test a version it doesn't declare.
  // `--ignore-scripts` because nothing here should need to run a lifecycle script.
  const peers = Object.entries(manifest.peerDependencies).map(([name, range]) => `${name}@${range}`);
  run(
    'npm',
    ['install', `./${tarball}`, ...peers, '--no-audit', '--no-fund', '--no-package-lock', '--ignore-scripts'],
    projectDir,
  );

  step('runtime: driving a game through all four subpaths with plain node');
  writeFileSync(join(projectDir, 'smoke.mjs'), RUNTIME_SMOKE);
  run(process.execPath, ['smoke.mjs'], projectDir);

  step('types: tsc --noEmit against the installed package (nodenext resolution)');
  // `./client`'s `.d.ts` names React types, so the type check needs `@types/react` present. Copy it (and
  // its one dependency) out of this repo's store rather than hitting the network again — pnpm's strict
  // store only exposes `csstype` *from* `@types/react`, so resolve it through a require rooted there.
  const typesReactDir = dirname(require.resolve('@types/react/package.json'));
  const fromTypesReact = createRequire(join(typesReactDir, 'package.json'));
  for (const [pkg, sourceDir] of [
    ['@types/react', typesReactDir],
    ['csstype', dirname(fromTypesReact.resolve('csstype/package.json'))],
  ]) {
    cpSync(sourceDir, join(projectDir, 'node_modules', pkg), { recursive: true });
  }
  writeFileSync(join(projectDir, 'consumer.ts'), TYPE_CONSUMER);
  writeFileSync(join(projectDir, 'tsconfig.json'), `${JSON.stringify(CONSUMER_TSCONFIG, null, 2)}\n`);
  run(process.execPath, [require.resolve('typescript/bin/tsc'), '-p', 'tsconfig.json'], projectDir);

  ok = true;
  console.log('\n✅ pack smoke passed — the published tarball plays a game and typechecks outside this repo.');
} finally {
  if (process.env['KEEP_SMOKE_DIR'] === '1') {
    console.log(`\n(kept ${projectDir}${ok ? '' : ' — the failure is reproducible there'})`);
  } else {
    rmSync(projectDir, { recursive: true, force: true });
  }
}
