import { gsap } from "gsap";
import { useId, useLayoutEffect, useRef, type JSX } from "react";
import { useReducedMotion } from "react-native-reanimated";

import { webFont } from "./web-theme";

/** Same props as the native fallback (liquid-button.tsx). */
type LiquidButtonProps = {
  label: string;
  fill: string;
  ink: string;
  active: boolean;
  size?: number;
};

/**
 * The "liquid arrow" button, after the Pinterest pin the team picked: a pill with the words and a
 * round arrow. At rest the circle is fused into the end of the pill, one liquid shape, its arrow
 * pointing up-right (↗). When it's active (hovered or focused, by itself or the card it sits in) the
 * circle pulls away: a neck stretches, thins and snaps, the circle settles with a little wobble a
 * gap away, and the arrow turns to point right (→). Let go and it's drawn quickly back in. Timed
 * frame by frame against the reference video (about a quarter of a second to split, less to join).
 *
 * How: the two shapes sit in a layer with an SVG "goo" filter (a blur, then an alpha threshold,
 * which joins shapes that come close), and the words and arrow sit sharp in a layer above. GSAP
 * moves the circle (and its arrow) and turns the arrow. Reduce Motion: it switches state at once.
 * Decorative: the card or button around it carries the role and the name.
 */
export function LiquidButton({
  label,
  fill,
  ink,
  active,
  size = 36,
}: LiquidButtonProps): JSX.Element {
  const filterId = `goo-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const reduceMotion = useReducedMotion();
  const blob = useRef<HTMLDivElement>(null);
  const dot = useRef<HTMLDivElement>(null);
  const arrow = useRef<SVGSVGElement>(null);
  const ctx = useRef<gsap.Context | null>(null);
  // The state last put on screen; null until set up (so the first one is instant).
  const shown = useRef<boolean | null>(null);

  const gap = Math.round(size * 0.26);
  // Far enough into the pill for the two to read as one shape.
  const reach = gap + Math.round(size * 0.34);
  const pad = Math.round(size * 0.5);
  const fontSize = Math.round(size * 0.38);

  useLayoutEffect(() => {
    ctx.current = gsap.context(() => {});
    return () => {
      ctx.current?.revert();
      ctx.current = null;
      shown.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    const context = ctx.current;
    if (context === null || blob.current === null || dot.current === null || !arrow.current) {
      return;
    }
    if (shown.current === active) return;
    const instant = shown.current === null || reduceMotion;
    shown.current = active;
    const circle = [blob.current, dot.current];
    const turn = arrow.current;

    context.add(() => {
      const x = active ? 0 : -reach;
      const rotation = active ? 0 : -45;
      if (instant) {
        gsap.set(circle, { x });
        gsap.set(turn, { rotation, transformOrigin: "50% 50%" });
        return;
      }
      gsap.to(circle, {
        x,
        // Split: the neck stretches and snaps, the circle wobbling to a stop. Join: drawn back in.
        duration: active ? 0.6 : 0.3,
        ease: active ? "elastic.out(1, 0.6)" : "power3.out",
        overwrite: true,
      });
      gsap.to(turn, {
        rotation,
        transformOrigin: "50% 50%",
        duration: 0.26,
        ease: "power2.out",
        delay: active ? 0.08 : 0.06,
        overwrite: true,
      });
    });
  });

  const pillStyle = {
    height: size,
    padding: `0 ${pad}px`,
    borderRadius: size,
    display: "flex",
    alignItems: "center",
    fontFamily: webFont,
    fontSize,
    fontWeight: 700,
    whiteSpace: "nowrap",
  } as const;
  const circleStyle = { width: size, height: size, borderRadius: size, flexShrink: 0 } as const;

  return (
    <div aria-hidden style={{ position: "relative", display: "inline-flex", height: size }}>
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden>
        <defs>
          <filter id={filterId} x="-20%" y="-60%" width="140%" height="220%">
            <feGaussianBlur in="SourceGraphic" stdDeviation={size * 0.11} result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -10"
              result="goo"
            />
            <feComposite in="SourceGraphic" in2="goo" operator="atop" />
          </filter>
        </defs>
      </svg>

      {/* The shapes, joined by the goo filter. The hidden words size the pill. */}
      <div style={{ display: "flex", gap, filter: `url(#${filterId})` }}>
        <div style={{ ...pillStyle, background: fill, color: "transparent" }}>{label}</div>
        <div ref={blob} style={{ ...circleStyle, background: fill }} />
      </div>

      {/* The words and the arrow, sharp, on top. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          gap,
          pointerEvents: "none",
        }}
      >
        <div style={{ ...pillStyle, color: ink }}>{label}</div>
        <div
          ref={dot}
          style={{
            ...circleStyle,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg
            ref={arrow}
            width={size * 0.44}
            height={size * 0.44}
            viewBox="0 0 24 24"
            fill="none"
            stroke={ink}
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </div>
      </div>
    </div>
  );
}
