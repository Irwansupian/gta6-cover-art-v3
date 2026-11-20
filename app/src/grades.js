// Vice Panel Studio — colour grades.
//
// A grade is a small bundle of numbers describing a film-stock mood: contrast,
// saturation, warmth, a magenta/green tint, how far the blacks are lifted
// ("fade"), and two split-tone colours that stain the shadows and the
// highlights. gradeCanvas() walks every pixel of a canvas once and pushes it
// through those numbers, so a flat phone photo comes out looking like it was
// shot on the strip at dusk.
//
// The math per pixel, all in 0..1:
//   1. contrast around mid grey
//   2. warmth (red up / blue down) and tint (magenta vs green)
//   3. saturation around the pixel's own luma
//   4. split tone: shadow colour weighted by (1-luma)^2, highlight colour by luma^2
//   5. fade: blacks lifted toward a floor, everything compressed a little
// and clamp. Nothing here touches the DOM; render.js feeds it canvases.

export const GRADES = {
  sunset: {
    label: 'Sunset Strip',
    contrast: 1.12, saturation: 1.28, warmth: 16, tint: 4, fade: 0.05,
    shadow: [58, 18, 92], shadowAmt: 0.38,
    highlight: [255, 148, 66], highlightAmt: 0.30,
  },
  neon: {
    label: 'Neon Nights',
    contrast: 1.19, saturation: 1.48, warmth: -8, tint: 13, fade: 0.02,
    shadow: [16, 38, 122], shadowAmt: 0.42,
    highlight: [255, 56, 178], highlightAmt: 0.34,
  },
  golden: {
    label: 'Golden Hour',
    contrast: 1.06, saturation: 1.16, warmth: 30, tint: 0, fade: 0.09,
    shadow: [74, 42, 10], shadowAmt: 0.26,
    highlight: [255, 192, 92], highlightAmt: 0.42,
  },
  pastel: {
    label: 'Vice Pastel',
    contrast: 0.92, saturation: 1.06, warmth: 6, tint: 6, fade: 0.24,
    shadow: [148, 118, 205], shadowAmt: 0.30,
    highlight: [255, 214, 232], highlightAmt: 0.30,
  },
  noir: {
    label: 'Midnight Noir',
    contrast: 1.27, saturation: 0.14, warmth: -4, tint: -2, fade: 0.03,
    shadow: [8, 10, 22], shadowAmt: 0.32,
    highlight: [228, 230, 242], highlightAmt: 0.16,
  },
};

export const GRADE_ORDER = ['sunset', 'neon', 'golden', 'pastel', 'noir'];

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Pushes every pixel of `canvas` (drawn already) through the named grade, in place. */
export function gradeCanvas(canvas, gradeKey) {
  const g = GRADES[gradeKey] ?? GRADES.sunset;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const { width, height } = canvas;
  if (width === 0 || height === 0) return;
  const frame = ctx.getImageData(0, 0, width, height);
  const px = frame.data;

  const warmR = g.warmth * 0.0016;
  const warmB = g.warmth * 0.0016;
  const tintG = g.tint * 0.0011;
  const tintM = g.tint * 0.0009;
  const shR = g.shadow[0] / 255, shG = g.shadow[1] / 255, shB = g.shadow[2] / 255;
  const hiR = g.highlight[0] / 255, hiG = g.highlight[1] / 255, hiB = g.highlight[2] / 255;
  const lift = g.fade * 0.55;
  const squeeze = 1 - g.fade * 0.35;

  for (let i = 0; i < px.length; i += 4) {
    let r = px[i] / 255;
    let gg = px[i + 1] / 255;
    let b = px[i + 2] / 255;

    // Contrast around mid grey.
    r = (r - 0.5) * g.contrast + 0.5;
    gg = (gg - 0.5) * g.contrast + 0.5;
    b = (b - 0.5) * g.contrast + 0.5;

    // Warmth and tint.
    r += warmR; b -= warmB;
    gg -= tintG; r += tintM; b += tintM;

    // Saturation around luma.
    const luma = 0.2126 * r + 0.7152 * gg + 0.0722 * b;
    r = luma + (r - luma) * g.saturation;
    gg = luma + (gg - luma) * g.saturation;
    b = luma + (b - luma) * g.saturation;

    // Split tone: stain the ends of the tonal range.
    const luma2 = 0.2126 * r + 0.7152 * gg + 0.0722 * b;
    const wShadow = (1 - luma2) * (1 - luma2) * g.shadowAmt;
    const wHigh = luma2 * luma2 * g.highlightAmt;
    r += (shR - 0.35) * wShadow + (hiR - 0.65) * wHigh;
    gg += (shG - 0.35) * wShadow + (hiG - 0.65) * wHigh;
    b += (shB - 0.35) * wShadow + (hiB - 0.65) * wHigh;

    // Fade: lifted blacks, gently compressed range.
    r = lift + r * squeeze;
    gg = lift + gg * squeeze;
    b = lift + b * squeeze;

    px[i] = clamp01(r) * 255;
    px[i + 1] = clamp01(gg) * 255;
    px[i + 2] = clamp01(b) * 255;
  }
  ctx.putImageData(frame, 0, 0);
}
