// Vice Panel Studio — the cover renderer.
//
// renderCover() paints a whole poster onto any 2D context at any size, from a
// plain state object:
//
//   state = {
//     layout, grade,                // keys into layouts.js / grades.js
//     title, subtitle, tagline,     // the words
//     grain, vignette, halftone,    // finish switches
//     panels: [{ photo, zoom, ox, oy }, ...],  // photo = index into `photos`
//   }
//   photos = [HTMLImageElement, ...]           // every picture the user has
//
// Painting order: backdrop, each panel's photo (graded per pixel on its own
// offscreen canvas, clipped to the panel polygon, white keyline), the finish
// passes (halftone, grain, vignette), then the masthead — tagline, the big
// gradient title, the script subtitle — and the corner furniture (rating
// badge, barcode, frame). Everything decorative is drawn from seeded
// randomness keyed to the title, so the same state always paints the same
// cover: screenshots and exports are reproducible.

import { LAYOUTS, panelBox } from './layouts.js';
import { gradeCanvas } from './grades.js';

/** A tiny deterministic PRNG (mulberry32): same seed, same stream, every run. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A stable 32-bit hash of a string, for seeding decoration from the title. */
function seedOf(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const BACKDROP = '#1c0b2e';

/** Paints one panel: the photo cover-fitted into the polygon's box, graded, clipped, keylined. */
function paintPanel(ctx, W, H, poly, slot, photos, gradeKey) {
  const box = panelBox(poly);
  const bx = Math.round(box.x * W), by = Math.round(box.y * H);
  const bw = Math.max(2, Math.round(box.w * W)), bh = Math.max(2, Math.round(box.h * H));

  const layer = document.createElement('canvas');
  layer.width = bw; layer.height = bh;
  const lctx = layer.getContext('2d');

  const img = slot && slot.photo >= 0 ? photos[slot.photo] : null;
  if (img && img.naturalWidth > 0) {
    const zoom = slot.zoom || 1;
    const scale = Math.max(bw / img.naturalWidth, bh / img.naturalHeight) * zoom;
    const dw = img.naturalWidth * scale, dh = img.naturalHeight * scale;
    const dx = (bw - dw) / 2 + (slot.ox || 0) * bw;
    const dy = (bh - dh) / 2 + (slot.oy || 0) * bh;
    lctx.drawImage(img, dx, dy, dw, dh);
  } else {
    // An empty slot still has to look like a poster: dusk gradient and a low sun.
    const sky = lctx.createLinearGradient(0, 0, 0, bh);
    sky.addColorStop(0, '#3a1160');
    sky.addColorStop(0.55, '#a1236b');
    sky.addColorStop(1, '#ff8c42');
    lctx.fillStyle = sky;
    lctx.fillRect(0, 0, bw, bh);
    lctx.fillStyle = 'rgba(255, 214, 140, 0.9)';
    lctx.beginPath();
    lctx.arc(bw * 0.5, bh * 0.62, Math.min(bw, bh) * 0.2, 0, Math.PI * 2);
    lctx.fill();
    lctx.fillStyle = 'rgba(20, 4, 36, 0.85)';
    lctx.fillRect(0, bh * 0.62, bw, bh * 0.38);
  }
  gradeCanvas(layer, gradeKey);

  ctx.save();
  ctx.beginPath();
  poly.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x * W, y * H) : ctx.lineTo(x * W, y * H)));
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(layer, bx, by);
  ctx.restore();

  // The white keyline that makes the collage read as one cut poster.
  ctx.save();
  ctx.beginPath();
  poly.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x * W, y * H) : ctx.lineTo(x * W, y * H)));
  ctx.closePath();
  ctx.strokeStyle = 'rgba(255, 248, 238, 0.96)';
  ctx.lineWidth = Math.max(3, W * 0.0055);
  ctx.shadowColor = 'rgba(10, 0, 24, 0.45)';
  ctx.shadowBlur = W * 0.006;
  ctx.stroke();
  ctx.restore();
}

/** A tile of seeded monochrome noise, drawn once and repeated as the grain pass. */
function grainTile(seed) {
  const tile = document.createElement('canvas');
  tile.width = 256; tile.height = 256;
  const tctx = tile.getContext('2d');
  const frame = tctx.createImageData(256, 256);
  const next = rng(seed);
  for (let i = 0; i < frame.data.length; i += 4) {
    const v = Math.floor(next() * 256);
    frame.data[i] = v; frame.data[i + 1] = v; frame.data[i + 2] = v; frame.data[i + 3] = 255;
  }
  tctx.putImageData(frame, 0, 0);
  return tile;
}

/** A halftone pass: dots that grow where the cover is dark, sampled off the painted cover itself. */
function halftonePass(ctx, W, H) {
  const step = Math.max(6, Math.round(W / 150));
  const sample = document.createElement('canvas');
  sample.width = Math.ceil(W / step); sample.height = Math.ceil(H / step);
  sample.getContext('2d').drawImage(ctx.canvas, 0, 0, sample.width, sample.height);
  const data = sample.getContext('2d').getImageData(0, 0, sample.width, sample.height).data;
  ctx.save();
  ctx.fillStyle = 'rgba(16, 2, 30, 0.5)';
  for (let y = 0; y < sample.height; y++) {
    for (let x = 0; x < sample.width; x++) {
      const i = (y * sample.width + x) * 4;
      const luma = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
      const r = (1 - luma) * step * 0.42;
      if (r < 0.6) continue;
      ctx.beginPath();
      ctx.arc(x * step + step / 2, y * step + step / 2, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** The masthead: tagline, gradient title with stroke and shadow, script subtitle. */
function masthead(ctx, W, H, state) {
  // A soft scrim so the words sit on busy photos.
  const scrim = ctx.createLinearGradient(0, 0, 0, H * 0.34);
  scrim.addColorStop(0, 'rgba(12, 2, 26, 0.58)');
  scrim.addColorStop(1, 'rgba(12, 2, 26, 0)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, 0, W, H * 0.34);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  const tagline = (state.tagline || '').trim().toUpperCase();
  if (tagline) {
    ctx.save();
    ctx.font = `600 ${Math.round(H * 0.021)}px Verdana, sans-serif`;
    ctx.fillStyle = '#ffd98c';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = H * 0.006;
    // Letter-space by hand: canvas has no tracking, so spread the glyphs.
    const spread = tagline.split('').join('  ');
    ctx.fillText(spread, W / 2, H * 0.055);
    ctx.restore();
  }

  const title = (state.title || '').trim().toUpperCase();
  if (title) {
    let size = H * 0.128;
    ctx.save();
    ctx.translate(W / 2, 0);
    ctx.transform(1, 0, -0.055, 1, 0, 0); // a whisper of poster italic
    const setFont = () => { ctx.font = `${Math.round(size)}px Anton, sans-serif`; };
    setFont();
    while (ctx.measureText(title).width > W * 0.92 && size > 14) { size -= 3; setFont(); }
    const baseline = H * 0.075 + size;
    const fill = ctx.createLinearGradient(0, baseline - size, 0, baseline + size * 0.12);
    fill.addColorStop(0, '#ffffff');
    fill.addColorStop(0.45, '#ffe9b8');
    fill.addColorStop(0.78, '#ff9d5c');
    fill.addColorStop(1, '#ff4f9a');
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#18041f';
    ctx.lineWidth = size * 0.17;
    ctx.shadowColor = 'rgba(8, 0, 20, 0.65)';
    ctx.shadowBlur = size * 0.13;
    ctx.shadowOffsetY = size * 0.055;
    ctx.strokeText(title, 0, baseline);
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    ctx.fillStyle = fill;
    ctx.fillText(title, 0, baseline);
    ctx.restore();

    const subtitle = (state.subtitle || '').trim();
    if (subtitle) {
      ctx.save();
      ctx.translate(W * 0.635, H * 0.075 + size * 1.24);
      ctx.rotate(-0.045);
      let sub = H * 0.047;
      ctx.font = `${Math.round(sub)}px Pacifico, cursive`;
      while (ctx.measureText(subtitle).width > W * 0.44 && sub > 10) { sub -= 2; ctx.font = `${Math.round(sub)}px Pacifico, cursive`; }
      ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(16, 2, 28, 0.9)';
      ctx.lineWidth = sub * 0.14;
      ctx.strokeText(subtitle, 0, 0);
      ctx.fillStyle = '#8df6ff';
      ctx.fillText(subtitle, 0, 0);
      ctx.restore();
    }
  }
}

/** Corner furniture: the studio's own rating badge and a barcode, plus the frame line. */
function furniture(ctx, W, H, state) {
  const seed = seedOf((state.title || '') + '|' + (state.layout || ''));
  const next = rng(seed);

  // Rating badge, bottom left: white box, black rules, our own mark.
  const bw = W * 0.088, bh = bw * 1.18;
  const bx = W * 0.028, by = H - bh - H * 0.028;
  ctx.save();
  ctx.fillStyle = '#fdfdf8';
  ctx.strokeStyle = '#101010';
  ctx.lineWidth = Math.max(2, W * 0.0035);
  ctx.beginPath();
  ctx.roundRect(bx, by, bw, bh, W * 0.006);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#101010';
  ctx.textAlign = 'center';
  ctx.font = `${Math.round(bh * 0.44)}px Anton, sans-serif`;
  ctx.fillText('18+', bx + bw / 2, by + bh * 0.52);
  ctx.font = `700 ${Math.round(bh * 0.115)}px Verdana, sans-serif`;
  ctx.fillText('VICE PANEL', bx + bw / 2, by + bh * 0.74);
  ctx.fillText('STUDIO', bx + bw / 2, by + bh * 0.90);
  ctx.restore();

  // Barcode, bottom right: seeded bar widths on a white ticket.
  const cw = W * 0.135, ch = H * 0.052;
  const cx = W - cw - W * 0.028, cy = H - ch - H * 0.028;
  ctx.save();
  ctx.fillStyle = '#fdfdf8';
  ctx.fillRect(cx, cy, cw, ch);
  ctx.fillStyle = '#101010';
  let x = cx + cw * 0.07;
  const top = cy + ch * 0.12, bottom = cy + ch * 0.68;
  while (x < cx + cw * 0.9) {
    const wdt = (0.4 + next() * 1.9) * (cw / 46);
    if (next() > 0.34) ctx.fillRect(x, top, wdt, bottom - top);
    x += wdt + (0.4 + next() * 1.4) * (cw / 46);
  }
  ctx.font = `${Math.round(ch * 0.21)}px Verdana, sans-serif`;
  ctx.textAlign = 'center';
  let digits = '';
  for (let i = 0; i < 12; i++) digits += Math.floor(next() * 10);
  ctx.fillText(digits.split('').join(' '), cx + cw / 2, cy + ch * 0.92);
  ctx.restore();

  // The frame: one hairline inside the edge, like a printed poster border.
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 248, 238, 0.85)';
  ctx.lineWidth = Math.max(2, W * 0.0028);
  const inset = W * 0.008;
  ctx.strokeRect(inset, inset, W - inset * 2, H - inset * 2);
  ctx.restore();
}

/** Paints the whole cover described by `state` onto `ctx` at W x H. */
export function renderCover(ctx, W, H, state, photos) {
  ctx.save();
  ctx.fillStyle = BACKDROP;
  ctx.fillRect(0, 0, W, H);

  const layout = LAYOUTS[state.layout] ?? LAYOUTS.hero;
  layout.panels.forEach((poly, i) => {
    paintPanel(ctx, W, H, poly, state.panels[i], photos, state.grade);
  });

  if (state.halftone) halftonePass(ctx, W, H);
  if (state.grain) {
    ctx.save();
    ctx.globalAlpha = 0.08;
    ctx.globalCompositeOperation = 'overlay';
    const pattern = ctx.createPattern(grainTile(seedOf(state.title || 'vice')), 'repeat');
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  if (state.vignette) {
    const rad = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.36, W / 2, H / 2, Math.max(W, H) * 0.78);
    rad.addColorStop(0, 'rgba(8, 0, 18, 0)');
    rad.addColorStop(1, 'rgba(8, 0, 18, 0.44)');
    ctx.fillStyle = rad;
    ctx.fillRect(0, 0, W, H);
  }

  masthead(ctx, W, H, state);
  furniture(ctx, W, H, state);
  ctx.restore();
}
