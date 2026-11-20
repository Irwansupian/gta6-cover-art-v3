// Vice Panel Studio — poster layouts.
//
// Each layout is a set of panels, and each panel is a polygon in normalised
// cover coordinates (0..1 on both axes, y pointing down). The slanted shared
// edges are the whole trick of the collage-poster look: neighbouring panels
// lean on the same diagonal, so the white keylines between them read as one
// cut. render.js clips each photo to its polygon, so a panel only needs to
// roughly tile the square — the deep-plum backdrop fills any hairline gap and
// the keyline stroke hides the seams.
//
// Panel order matters: panel 0 is the hero slot the editor selects first, and
// the shot scenes hand photos to panels in this order.

export const LAYOUTS = {
  hero: {
    label: 'Hero Splash',
    panels: [
      [[0, 0], [0.63, 0], [0.575, 0.615], [0, 0.665]],
      [[0.645, 0], [1, 0], [1, 0.335], [0.59, 0.615]],
      [[0.605, 0.63], [1, 0.35], [1, 0.665], [0.64, 0.705]],
      [[0, 0.685], [0.62, 0.635], [0.605, 1], [0, 1]],
      [[0.655, 0.715], [1, 0.68], [1, 1], [0.62, 1]],
    ],
  },
  quad: {
    label: 'Quad Riot',
    panels: [
      [[0, 0], [0.52, 0], [0.48, 0.48], [0, 0.52]],
      [[0.535, 0], [1, 0], [1, 0.50], [0.495, 0.48]],
      [[0, 0.535], [0.48, 0.495], [0.46, 1], [0, 1]],
      [[0.495, 0.495], [1, 0.515], [1, 1], [0.475, 1]],
    ],
  },
  triptych: {
    label: 'Triptych',
    panels: [
      [[0, 0], [0.355, 0], [0.315, 0.775], [0, 0.815]],
      [[0.37, 0], [0.675, 0], [0.645, 0.775], [0.33, 0.775]],
      [[0.69, 0], [1, 0], [1, 0.815], [0.66, 0.775]],
      [[0, 0.83], [1, 0.83], [1, 1], [0, 1]],
    ],
  },
  mosaic: {
    label: 'Neon Mosaic',
    panels: [
      [[0, 0], [0.42, 0], [0.40, 0.42], [0, 0.46]],
      [[0.435, 0], [1, 0], [1, 0.295], [0.415, 0.42]],
      [[0, 0.475], [0.40, 0.435], [0.38, 1], [0, 1]],
      [[0.415, 0.435], [0.70, 0.31], [0.715, 0.675], [0.42, 0.695]],
      [[0.715, 0.315], [1, 0.31], [1, 1], [0.73, 0.685]],
      [[0.395, 1], [0.42, 0.71], [0.715, 0.69], [0.725, 1]],
    ],
  },
  split: {
    label: 'Split Decision',
    panels: [
      [[0, 0], [1, 0], [0.575, 1], [0, 1]],
      [[1, 0.015], [1, 1], [0.595, 1]],
      [[0.055, 0.585], [0.345, 0.585], [0.345, 0.905], [0.055, 0.905]],
    ],
  },
  fullbleed: {
    label: 'Full Bleed',
    panels: [
      [[0, 0], [1, 0], [1, 1], [0, 1]],
      [[0.665, 0.075], [0.945, 0.075], [0.945, 0.415], [0.665, 0.415]],
    ],
  },
};

export const LAYOUT_ORDER = ['hero', 'quad', 'triptych', 'mosaic', 'split', 'fullbleed'];

/** The axis-aligned box a polygon spans, in normalised coordinates. */
export function panelBox(poly) {
  let x0 = 1, y0 = 1, x1 = 0, y1 = 0;
  for (const [x, y] of poly) {
    if (x < x0) x0 = x;
    if (y < y0) y0 = y;
    if (x > x1) x1 = x;
    if (y > y1) y1 = y;
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** True when the normalised point (x, y) falls inside the polygon (even-odd ray cast). */
export function pointInPanel(poly, x, y) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
