import { useEffect, useRef, type JSX } from "react";

import {
  DOT_COUNT,
  DOT_FIELD_ASPECT,
  dotFieldScale,
  dotPosition,
  dotRadius,
  WORD,
  WORD_HOLD_TIME,
} from "./dot-formations";
import type { DotFieldProps } from "./dot-field";

/**
 * Web: the same animation drawn on a 2D canvas. Skia would work on web too, but it needs a
 * multi-megabyte WebAssembly download, which the planning web app doesn't need.
 */
export function DotField({ width }: DotFieldProps): JSX.Element {
  const height = Math.round(width * DOT_FIELD_ASPECT);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const pixelRatio = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

    const scale = dotFieldScale(width);
    const radius = dotRadius(width);
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const start = performance.now();
    let frame = 0;

    const draw = (now: number) => {
      // With reduced motion, draw one frame where the dots spell the word.
      const t = reduceMotion ? WORD_HOLD_TIME : (now - start) / 1000;
      context.clearRect(0, 0, width, height);
      context.fillStyle = "#ffffff";
      context.beginPath();
      for (let i = 0; i < DOT_COUNT; i++) {
        const [x, y] = dotPosition(i, t);
        const px = width / 2 + x * scale;
        const py = height / 2 + y * scale;
        context.moveTo(px + radius, py);
        context.arc(px, py, radius, 0, Math.PI * 2);
      }
      context.fill();
      if (!reduceMotion) frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [width, height]);

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={WORD}
      style={{ width, height, display: "block" }}
    />
  );
}
