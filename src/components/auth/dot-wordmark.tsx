import type { JSX } from "react";
import Svg, { Circle } from "react-native-svg";

import { WORD, WORD_GRID, wordCells } from "./dot-formations";

const CELLS = wordCells();

/** Static dot-matrix "cadence" — the small brand mark on the sign-in and sign-up screens. */
export function DotWordmark({
  width = 132,
  color,
}: {
  width?: number;
  color: string;
}): JSX.Element {
  const spacing = width / WORD_GRID.columns;
  const height = spacing * WORD_GRID.rows;
  const radius = spacing * 0.36;

  return (
    <Svg width={width} height={height} accessibilityRole="image" accessibilityLabel={WORD}>
      {CELLS.map(({ col, row }) => (
        <Circle
          key={`${col}-${row}`}
          cx={(col + 0.5) * spacing}
          cy={(row + 0.5) * spacing}
          r={radius}
          fill={color}
        />
      ))}
    </Svg>
  );
}
