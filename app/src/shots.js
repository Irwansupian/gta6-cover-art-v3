// Vice Panel Studio — fixed scenes for screenshots.
//
// The screenshot harness loads the app with a query like
//   ?shot=cover&photo=pier&caption=Sunset%20Heist
// and expects one exact, reproducible frame: `photo` picks a bundled sample,
// `caption` becomes the poster title, and the scene table below pins the
// layout, grade and crops so the same URL always paints the same cover.
// window.__shotReady is set by main.js once the scene is painted.

/** Per-panel crop styles, cycled across panels so one photo reads as a collage. */
export const CROP_STYLES = [
  { zoom: 1.0, ox: 0, oy: 0 },
  { zoom: 1.38, ox: 0.07, oy: -0.05 },
  { zoom: 1.62, ox: -0.09, oy: 0.04 },
  { zoom: 1.22, ox: 0.11, oy: 0.09 },
  { zoom: 1.85, ox: 0, oy: -0.11 },
  { zoom: 1.48, ox: -0.06, oy: 0.11 },
];

/** The pinned look of each photographed scene, keyed by mode then caption. */
const SCENES = {
  cover: {
    'Sunset Heist': { layout: 'hero', grade: 'sunset', subtitle: 'a vice panel story', halftone: false },
    'Boulevard Queen': { layout: 'triptych', grade: 'golden', subtitle: 'queen of the strip', halftone: false },
    'Neon Vice': { layout: 'split', grade: 'neon', subtitle: 'after dark', halftone: true },
  },
  editor: {
    'Boulevard Queen': { layout: 'mosaic', grade: 'neon', subtitle: 'queen of the strip', halftone: false },
  },
};

/**
 * Reads the shot query, or returns null for a normal visit. The result names
 * the sample photo, the caption, and the scene's pinned style (with a sane
 * default look for a caption the table does not know).
 */
export function readShot(query) {
  const mode = query.get('shot');
  if (mode !== 'cover' && mode !== 'editor') return null;
  const photo = query.get('photo') ?? 'pier';
  const caption = query.get('caption') ?? 'Sunset Heist';
  const style = SCENES[mode][caption] ?? { layout: 'hero', grade: 'sunset', subtitle: 'a vice panel story', halftone: false };
  return { mode, photo, caption, ...style };
}
