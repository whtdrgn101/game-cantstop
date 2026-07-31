import { lazy } from 'react';
import type { CantStopView } from '../engine/index.js';
import type { GameClient } from './types.js';
import { GAME_TYPE } from './api.js';
import { CantStopStatus } from './Status.js';

/**
 * Can't Stop, as a `GameClient` (roadmap C3) — the second game in the room, and the proof the shell
 * really is game-agnostic: a completely different board plugs into the same seam Container uses.
 *
 * The board is **lazy** so the home screen doesn't ship it (it carries the Can't Stop engine slice).
 * Keep this file tiny — importing anything heavy here would defeat the point of the plugin being lazy.
 */
export const cantstopClient: GameClient<CantStopView> = {
  id: GAME_TYPE,
  name: "Can't Stop",
  blurb: 'A push-your-luck dice game: climb the number columns, but bank your progress before you bust.',
  rules: [
    '2–4 players. Roll four dice and split them into two column sums.',
    'Advance up to three runners up those columns; keep rolling to climb higher.',
    'If a roll can’t advance anything, you bust and lose this turn’s progress.',
    'Stop to bank your runners as permanent squares. First to the top of three columns wins.',
  ],
  // The game's "box lid" mark (kernel 1.3.0). Lazy, exactly like the board — the picker shows every
  // hosted game, so an eager icon would ship every game's art to the home screen. See art/Icon.tsx.
  Icon: lazy(() => import('./art/Icon.js')),
  Board: lazy(() => import('./Board.js')),
  Status: CantStopStatus,
};

// The package-contract entry point (Track D / D0): the generated registry imports each game's client
// as a default. Still tiny/non-lazy — the default is the same light object, board import unchanged.
export default cantstopClient;

// The settled bindings, re-exported so a host (and this package's own tests) can name what they are
// holding without reaching into ./api or ./types (the standardized ./client surface — game-creation §4).
export type { BoardProps, GameClient } from './types.js';
export { act, getGameAs, roll, GAME_TYPE } from './api.js';
export type { CantStopPayload } from './api.js';
export type { CantStopView } from '../engine/index.js';
