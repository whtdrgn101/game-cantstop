/**
 * `@game-hub/game-cantstop/bot` — the AI for Can't Stop. THE public API; consumers import only from here.
 *
 * Like Container's bot: **engine = rules, bot = opinions**, and nothing here is authoritative — it only
 * ever produces an `Action` the engine then validates. The contrast with Container is instructive: Can't
 * Stop has no hidden information, so the bot is a pure risk model over public state (no opponent-card
 * estimation), and its one dependency on the caller is dice it cannot invent (`DecideOptions.rollDice`).
 */
export { decide } from './decide.js';
export { playSelfPlay } from './selfPlay.js';
export { benchmark, decideAt } from './bench.js';
export type { StrengthBenchOptions } from './bench.js';
export { bustProbability, pickPairing, scorePairing, shouldRoll, turnProgress, DIFFICULTIES } from './policy.js';
export type { CantStopDifficulty, DifficultyParams } from './policy.js';
export { BotError } from '@game-hub/kernel/bot';

export type { DecideFn, DecideOptions, PairingCandidate } from './types.js';
export type { SelfPlayOptions, SelfPlayResult } from './selfPlay.js';
