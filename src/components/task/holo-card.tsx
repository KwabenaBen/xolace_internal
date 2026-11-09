import {
  BlurStyle,
  Canvas,
  ClipOp,
  PaintStyle,
  Picture,
  processTransform3d,
  Skia,
  useFont,
} from "@shopify/react-native-skia";
import { useEffect, useMemo, type JSX } from "react";
import { View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import {
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { HOLO_MARGIN, holoCardHeight, type HoloCardProps } from "./holo-shared";

/**
 * The task page's hero: a black card whose huge condensed wordmark (the task's status) is chrome
 * with a holographic foil, after Native Cook's "Holo Cash Card" block. It is drawn in Skia and
 * tilted there in 3D; drag it (after a short hold, so the page still scrolls) and the foil and
 * light band follow, let go and it wobbles back. Shaders, springs and sizes are the block's.
 * Web draws a still version (holo-card.web.tsx).
 */

// The block's foil: a chrome horizon moved by the tilt, a pastel hue (pink, lilac, sky, mint,
// butter) shifted by it, and a sharp light band that slides with it. `glow` makes it richer.
const HOLO = Skia.RuntimeEffect.Make(`
uniform float2 size;
uniform float2 tilt;
uniform float glow;
float3 hue(float h) {
  float3 a = float3(1.0, 0.70, 0.90);
  float3 b = float3(0.72, 0.66, 1.0);
  float3 c = float3(0.62, 0.92, 1.0);
  float3 d = float3(0.78, 1.0, 0.84);
  float3 e = float3(1.0, 0.95, 0.68);
  float x = fract(h) * 5.0;
  if (x < 1.0) return mix(a, b, x);
  if (x < 2.0) return mix(b, c, x - 1.0);
  if (x < 3.0) return mix(c, d, x - 2.0);
  if (x < 4.0) return mix(d, e, x - 3.0);
  return mix(e, a, x - 4.0);
}
half4 main(float2 xy) {
  float2 uv = xy / size;
  float y = uv.y + tilt.x * 0.9;
  float chrome = 0.86 - 0.62 * exp(-pow((y - 0.56) * 6.5, 2.0)) + 0.14 * smoothstep(0.62, 0.95, y);
  float3 foil = hue(uv.x * 0.9 + uv.y * 0.6 + tilt.y * 1.4 + tilt.x * 0.8);
  float3 col = mix(float3(chrome), foil * (0.55 + 0.5 * chrome), 0.62);
  float band = exp(-pow((uv.x + uv.y * 0.45 - 0.62 - tilt.y * 1.6) * 9.0, 2.0));
  col += band * (0.5 + 0.2 * glow);
  col = mix(col, foil * 1.08, 0.28 * glow);
  return half4(half3(min(col, 1.0)), 1.0);
}`);

// The 1.5 pt iridescent rim.
const RIM = Skia.RuntimeEffect.Make(`
uniform float2 size;
uniform float2 tilt;
half4 main(float2 xy) {
  float2 uv = xy / size;
  float h = fract(uv.x * 0.7 - uv.y * 0.4 + tilt.y * 1.2 + tilt.x);
  float3 c = 0.5 + 0.5 * cos(6.2831 * (h + float3(0.0, 0.33, 0.67)));
  return half4(half3(mix(c, float3(1.0), 0.45)), 1.0);
}`);

// Fine diagonal foil lines over the whole card, strongest under the light band.
const LINES = Skia.RuntimeEffect.Make(`
uniform float2 size;
uniform float2 tilt;
uniform float glow;
half4 main(float2 xy) {
  float2 uv = xy / size;
  float d = xy.x * 0.82 + xy.y * 0.57;
  float line = smoothstep(0.55, 1.0, sin(d * 1.15));
  float h = fract(uv.x * 0.6 + uv.y * 0.3 + tilt.y * 1.3 + tilt.x * 0.9);
  float3 c = 0.5 + 0.5 * cos(6.2831 * (h + float3(0.0, 0.33, 0.67)));
  float band = exp(-pow((uv.x + uv.y * 0.45 - 0.62 - tilt.y * 1.6) * 3.0, 2.0));
  float a = line * (0.05 + 0.22 * band) * (1.0 + 0.6 * glow);
  return half4(half3(c * a), a);
}`);

// The block's springs: stiff while a finger holds the card, wobbly when it lets go.
const HELD = { stiffness: 320, damping: 2 * Math.sqrt(320) * 0.9, mass: 1 };
const RELEASED = { stiffness: 170, damping: 2 * Math.sqrt(170) * 0.32, mass: 1 };
const MAX_TILT = 16; // degrees

/** Sum of glyph advances: the drawn width of `text` in `font`. */
function textWidth(font: NonNullable<ReturnType<typeof useFont>>, text: string): number {
  return font.getGlyphWidths(font.getGlyphIDs(text)).reduce((sum, w) => sum + w, 0);
}

export function HoloCard({
  width,
  word,
  footer,
  corner,
  glow = 0,
  accessibilityLabel,
}: HoloCardProps): JSX.Element {
  const CW = width;
  const CH = holoCardHeight(width);
  const M = HOLO_MARGIN;
  const reduceMotion = useReducedMotion();
  const wordFont = useFont(require("../../../assets/fonts/Anton-Regular.ttf"), CH * 0.58);
  const tagFont = useFont(require("../../../assets/fonts/Montserrat-Bold.ttf"), 10);

  const rx = useSharedValue(0); // degrees about x
  const ry = useSharedValue(0); // degrees about y

  // The word fills the card's width: stretched up to 15 % when short, narrowed down to 78 % when
  // long, then scaled down evenly if it still doesn't fit.
  const fit = useMemo(() => {
    if (wordFont === null) return null;
    const avail = CW - 28;
    const natural = textWidth(wordFont, word);
    const h = Math.min(1.15, Math.max(0.78, avail / natural));
    const u = Math.min(1, avail / (natural * h));
    return { sx: h * u, sy: u };
  }, [wordFont, word, CW]);
  const cornerWidth = useMemo(
    () => (tagFont === null ? 0 : textWidth(tagFont, corner)),
    [tagFont, corner]
  );

  const picture = useDerivedValue(() => {
    const rec = Skia.PictureRecorder();
    const c = rec.beginRecording(Skia.XYWHRect(0, 0, CW + 2 * M, CH + 2 * M));
    const tiltX = rx.get();
    const tiltY = ry.get();
    const tx = (tiltX * Math.PI) / 180;
    const ty = (tiltY * Math.PI) / 180;

    // Its shadow first, flat and shifted away from the tilt, then the card in perspective.
    c.translate(M, M);
    const shadow = Skia.Paint();
    shadow.setColor(Skia.Color("#000000"));
    shadow.setAlphaf(0.5);
    shadow.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, 12, true));
    c.drawRRect(
      Skia.RRectXY(Skia.XYWHRect(8 - tiltY * 0.5, 12 + tiltX * 0.5, CW - 16, CH - 10), 16, 16),
      shadow
    );
    c.concat(
      processTransform3d([
        { translateX: CW / 2 },
        { translateY: CH / 2 },
        { perspective: 700 },
        { rotateX: tx },
        { rotateY: ty },
        { translateX: -CW / 2 },
        { translateY: -CH / 2 },
      ])
    );
    const rr = Skia.RRectXY(Skia.XYWHRect(0, 0, CW, CH), 16, 16);
    const bg = Skia.Paint();
    bg.setColor(Skia.Color("#0b0b0d"));
    c.drawRRect(rr, bg);

    if (LINES) {
      const lines = Skia.Paint();
      lines.setShader(LINES.makeShader([CW, CH, tx, ty, glow]));
      c.save();
      c.clipRRect(rr, ClipOp.Intersect, true);
      c.drawRect(Skia.XYWHRect(0, 0, CW, CH), lines);
      c.restore();
    }
    if (RIM) {
      const rim = Skia.Paint();
      rim.setAntiAlias(true);
      rim.setStyle(PaintStyle.Stroke);
      rim.setStrokeWidth(1.5);
      rim.setShader(RIM.makeShader([CW, CH, tx, ty]));
      rim.setAlphaf(0.5 + 0.3 * glow);
      c.drawRRect(Skia.RRectXY(Skia.XYWHRect(0.75, 0.75, CW - 1.5, CH - 1.5), 15.5, 15.5), rim);
    }
    if (wordFont !== null && fit !== null && HOLO) {
      const paint = Skia.Paint();
      paint.setAntiAlias(true);
      paint.setShader(HOLO.makeShader([CW, CH, tx, ty, glow]));
      c.save();
      // A shrunk word moves up a little so it stays optically centred.
      c.translate(14, CH * 0.69 - (1 - fit.sy) * CH * 0.2);
      c.scale(fit.sx, fit.sy);
      c.drawText(word, 0, 0, paint, wordFont);
      c.restore();
    }
    if (tagFont !== null) {
      const tag = Skia.Paint();
      tag.setAntiAlias(true);
      tag.setColor(Skia.Color("#ffffff"));
      c.drawText(footer[0], 14, CH - 26, tag, tagFont);
      c.drawText(footer[1], 14, CH - 14, tag, tagFont);
      c.drawText(corner, CW - 14 - cornerWidth, CH - 14, tag, tagFont);
    }
    return rec.finishRecordingAsPicture();
  }, [CW, CH, M, wordFont, tagFont, fit, word, footer, corner, cornerWidth, glow]);

  // A gentle tilt-and-wobble once, so people find out the card moves.
  useEffect(() => {
    if (reduceMotion) return;
    rx.set(withDelay(500, withSequence(withTiming(6, { duration: 420 }), withSpring(0, RELEASED))));
    ry.set(
      withDelay(500, withSequence(withTiming(-10, { duration: 420 }), withSpring(0, RELEASED)))
    );
  }, [reduceMotion, rx, ry]);

  // A short hold before the drag, so a quick swipe on the card still scrolls the page.
  const tilt = Gesture.Pan()
    .activateAfterLongPress(120)
    .onUpdate((event) => {
      const x = Math.max(-MAX_TILT, Math.min(MAX_TILT, -event.translationY * 0.14));
      const y = Math.max(-MAX_TILT, Math.min(MAX_TILT, event.translationX * 0.12));
      rx.set(withSpring(x, HELD));
      ry.set(withSpring(y, HELD));
    })
    .onFinalize(() => {
      rx.set(withSpring(0, RELEASED));
      ry.set(withSpring(0, RELEASED));
    });

  return (
    <GestureDetector gesture={tilt}>
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={accessibilityLabel}
        style={{ width: CW + 2 * M, height: CH + 2 * M, margin: -M }}
      >
        <Canvas style={{ width: CW + 2 * M, height: CH + 2 * M }}>
          <Picture picture={picture} />
        </Canvas>
      </View>
    </GestureDetector>
  );
}
