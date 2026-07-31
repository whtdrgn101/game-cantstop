// Public API of @game-hub/game-cantstop/engine. Consumers (backend, ui) import only from here.

// Domain types
export type { Action, ActionType } from './actions/index.js';
export type { CantStopPlayer, CantStopState, MoveRecord, Phase } from './core/index.js';

// Errors
export { GameError } from './core/index.js';
export type { CantStopErrorCode } from './core/index.js';

// Constants (rulebook-sourced values used by the UI + backend seat bounds)
export {
  COLUMN_HEIGHTS,
  COLUMNS,
  DICE_COUNT,
  DIE_FACES,
  MAX_PLAYERS,
  MAX_RUNNERS,
  MIN_PLAYERS,
  WIN_COLUMNS,
} from './core/index.js';

// Setup
export { createGame } from './createGame.js';
export type { CreateGameOptions, NewPlayer } from './createGame.js';

// Per-player view projection (a no-op here — Can't Stop has nothing to hide)
export { viewFor } from './view.js';
export type { CantStopView, Viewer } from './view.js';

// Mechanics + turn-aware entry point. `legalSelections` is exported so the UI/bot can enumerate
// pairings without re-deriving the rule; `roll` is server-only (the backend's roll route calls it).
export { legalSelections } from './internal/index.js';
export { applyAction, legalActions, roll, select, stop } from './actions/index.js';
