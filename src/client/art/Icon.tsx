import { cn } from '@game-hub/ui-kit';

/**
 * The game's "box lid" mark (kernel 1.3.0's optional `GameClient.Icon`): a pair of tumbling dice, drawn
 * in `Die.tsx`'s visual language — rounded faces, pips on a 3×3 grid, theme-aware (the face is the
 * background, the border and pips are `currentColor`). The shell renders it in the Card Table game
 * picker and sizes/tints it through `className`; it is wired **lazily** (`React.lazy`) exactly like the
 * board, so the home screen doesn't ship it. Square viewBox, one square affordance for the shell.
 *
 * Original art — a plain pair of dotted dice, not any published game's illustration.
 */

/** Pip layout per face on a 3×3 grid (cols/rows 1–3), reused verbatim from `Die.tsx`. */
const PIPS: Record<number, ReadonlyArray<readonly [number, number]>> = {
  1: [[2, 2]],
  2: [
    [1, 1],
    [3, 3],
  ],
  3: [
    [1, 1],
    [2, 2],
    [3, 3],
  ],
  4: [
    [1, 1],
    [3, 1],
    [1, 3],
    [3, 3],
  ],
  5: [
    [1, 1],
    [3, 1],
    [2, 2],
    [1, 3],
    [3, 3],
  ],
  6: [
    [1, 1],
    [3, 1],
    [1, 2],
    [3, 2],
    [1, 3],
    [3, 3],
  ],
};

/**
 * One die face, drawn in its own 0..4 local box — the same rounded rect + pip geometry as `Die.tsx` —
 * then placed into the lid by `transform` (rotate about the die's centre, scale, translate).
 */
function DieFace({ value, transform }: { value: number; transform: string }) {
  return (
    <g transform={transform}>
      <rect
        x="0.28"
        y="0.28"
        width="3.44"
        height="3.44"
        rx="0.7"
        fill="var(--color-background)"
        stroke="currentColor"
        strokeOpacity="0.35"
        strokeWidth="0.14"
      />
      {(PIPS[value] ?? []).map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="0.38" fill="currentColor" />
      ))}
    </g>
  );
}

/** The box-lid mark: two dice mid-tumble, each a 4×4 face rotated + scaled into the 12×12 square lid. */
export default function Icon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 12 12"
      className={cn('block text-foreground', className)}
      role="img"
      aria-label="a pair of tumbling dice"
    >
      <DieFace value={5} transform="translate(0.8 4.1) scale(1.6) rotate(-14 2 2)" />
      <DieFace value={3} transform="translate(4.7 1.5) scale(1.45) rotate(15 2 2)" />
    </svg>
  );
}
