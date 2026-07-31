import { defineConfig } from 'vitest/config';

/**
 * Coverage gates for the Can't Stop game package, built out of the platform monorepo (Track D) against
 * the published `@game-hub/kernel` + `@game-hub/ui-kit`. It carries **both** gates the game answers to —
 * the platform's engine 100% gate and the bot 90% gate — locally, since neither the hub's engine nor its
 * bot vitest config reaches a package that lives out here; this file is what keeps that discipline honest.
 *
 * The two gates are enforced with **per-glob thresholds**: `src/engine/**` at 100% (rules — every branch
 * is a rule and deserves a test) and `src/bot/**` at 90% (opinions — heuristic weights get retuned, so a
 * 100% bar on judgement calls buys churn, not correctness; what must stay covered is that every decision
 * is legal and every policy is reachable). The module and client are host bindings tested by the
 * backend/UI suites, the same division every game uses. The bot's self-play + bench tests move with the
 * bot and run here.
 */
export default defineConfig({
  test: {
    include: ['src/engine/**/*.test.ts', 'src/bot/**/*.test.ts'],
    // The bot's bench/self-play tests run whole seeded games (CPU-bound), and CI caps vitest to one fork
    // (`VITEST_MAX_FORKS`), so the default 5s timeout starves them under contention (observed: 14s, fine
    // alone). Headroom, not a hang-mask: a genuinely wedged test still dies here.
    testTimeout: 30_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/engine/**/*.ts', 'src/bot/**/*.ts'],
      exclude: [
        // Engine excludes (ported verbatim from engine/vitest.config.ts).
        'src/engine/**/tests/**', // test files + shared helpers
        'src/engine/**/index.ts', // public + folder barrels (re-exports only)
        'src/engine/core/types.ts', // compile-time only (domain interfaces)
        'src/engine/actions/action.ts', // compile-time only (the Action union)
        // Bot excludes (ported from bot/vitest.config.ts; the aggregator src/bench.ts stays in bot/).
        'src/bot/**/tests/**', // test files + shared helpers
        'src/bot/**/index.ts', // public barrel (re-exports only)
        'src/bot/types.ts', // compile-time only (options/context interfaces)
      ],
      thresholds: {
        // The pure rules core — every rule and every rejection path tested.
        'src/engine/**': {
          statements: 100,
          branches: 100,
          functions: 100,
          lines: 100,
        },
        // The AI opinions — legal + reachable, not exhaustive (the bot package's standing 90% bar).
        'src/bot/**': {
          statements: 90,
          branches: 90,
          functions: 90,
          lines: 90,
        },
      },
    },
  },
});
