// Vice Panel Studio — the editor.
//
// One state object describes the poster (see render.js); this file owns the
// DOM around it: the photo tray, the panel picker, the layout and grade
// chips, the word fields, the finish switches, and the canvas gestures
// (click a panel to select it, drag to reframe its photo, scroll to zoom).
// Every change simply repaints. On a ?shot= URL the same editor boots into a
// pinned scene instead (shots.js) and flags window.__shotReady when painted.

import { LAYOUTS, LAYOUT_ORDER, panelBox, pointInPanel } from './layouts.js';
import { GRADES, GRADE_ORDER } from './grades.js';
import { renderCover } from './render.js';
import { CROP_STYLES, readShot } from './shots.js';

const $ = (id) => document.getElementById(id);
const canvas = $('cover');
const ctx = canvas.getContext('2d');

const state = {
  layout: 'hero',
  grade: 'sunset',
  title: 'Sunset Heist',
  subtitle: 'a vice panel story',
  tagline: 'Where the neon never sleeps',
  grain: true,
  vignette: true,
  halftone: false,
  panels: [],
};

/** Every picture on the tray: { name, img } with img a loaded HTMLImageElement. */
const photos = [];
let selected = 0;

const panelCount = () => LAYOUTS[state.layout].panels.length;

/** Grows/shrinks the panel slots to the layout, keeping choices already made. */
function syncPanels() {
  const n = panelCount();
  while (state.panels.length < n) {
    const i = state.panels.length;
    state.panels.push({ photo: photos.length ? i % photos.length : -1, ...CROP_STYLES[i % CROP_STYLES.length] });
  }
  state.panels.length = n;
  if (selected >= n) selected = 0;
}

function paint() {
  renderCover(ctx, canvas.width, canvas.height, state, photos.map((p) => p.img));
  markUsedPhotos();
}

function say(text) { $('status').textContent = text; }

/* ---------------------------------------------------------- photo tray */

function markUsedPhotos() {
  const used = new Set(state.panels.map((s) => s.photo));
  [...$('tray').children].forEach((el, i) => el.classList.toggle('used', used.has(i)));
}

function addPhoto(name, img) {
  photos.push({ name, img });
  const thumb = document.createElement('img');
  thumb.src = img.src;
  thumb.alt = name;
  thumb.title = `${name} — click to place in the selected panel`;
  thumb.addEventListener('click', () => {
    state.panels[selected].photo = photos.length - 1;
    paint();
    say(`Panel ${selected + 1} now shows ${name}.`);
  });
  $('tray').appendChild(thumb);
  // A fresh photo fills any slot still waiting for one.
  state.panels.forEach((slot) => { if (slot.photo < 0) slot.photo = photos.length - 1; });
}

function loadPhoto(src, name) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => { addPhoto(name, img); resolve(img); };
    img.onerror = reject;
    img.src = src;
  });
}

$('upload').addEventListener('change', async (event) => {
  const files = [...event.target.files];
  for (const file of files) {
    const url = URL.createObjectURL(file);
    try { await loadPhoto(url, file.name); } catch { say(`Could not read ${file.name}.`); }
  }
  if (files.length) { syncPanels(); paint(); say(`${files.length} photo(s) added to the tray.`); }
  event.target.value = '';
});

/* ---------------------------------------------------------- panel picker */

function buildPanelList() {
  const list = $('panel-list');
  list.innerHTML = '';
  for (let i = 0; i < panelCount(); i++) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = `Panel ${i + 1}`;
    if (i === selected) b.classList.add('active');
    b.addEventListener('click', () => { selected = i; buildPanelList(); syncZoom(); });
    list.appendChild(b);
  }
}

function syncZoom() { $('zoom').value = state.panels[selected]?.zoom ?? 1; }

$('zoom').addEventListener('input', (event) => {
  state.panels[selected].zoom = Number(event.target.value);
  paint();
});

/* ---------------------------------------------------------- chips */

function buildChips(el, order, labels, current, onPick) {
  el.innerHTML = '';
  for (const key of order) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = labels[key];
    if (key === current) b.classList.add('active');
    b.addEventListener('click', () => onPick(key));
    el.appendChild(b);
  }
}

function buildLayoutChips() {
  buildChips($('layouts'), LAYOUT_ORDER, Object.fromEntries(LAYOUT_ORDER.map((k) => [k, LAYOUTS[k].label])), state.layout, (key) => {
    state.layout = key;
    syncPanels(); buildPanelList(); buildLayoutChips(); syncZoom(); paint();
  });
}

function buildGradeChips() {
  buildChips($('grades'), GRADE_ORDER, Object.fromEntries(GRADE_ORDER.map((k) => [k, GRADES[k].label])), state.grade, (key) => {
    state.grade = key;
    buildGradeChips(); paint();
  });
}

/* ---------------------------------------------------------- words + finish */

for (const [id, key] of [['title', 'title'], ['subtitle', 'subtitle'], ['tagline', 'tagline']]) {
  $(id).addEventListener('input', (event) => { state[key] = event.target.value; paint(); });
}
for (const [id, key] of [['fin-grain', 'grain'], ['fin-vignette', 'vignette'], ['fin-halftone', 'halftone']]) {
  $(id).addEventListener('change', (event) => { state[key] = event.target.checked; paint(); });
}

/* ---------------------------------------------------------- canvas gestures */

function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) / rect.width,
    y: (event.clientY - rect.top) / rect.height,
    px: (event.clientX - rect.left) * (canvas.width / rect.width),
    py: (event.clientY - rect.top) * (canvas.height / rect.height),
  };
}

let drag = null;

canvas.addEventListener('pointerdown', (event) => {
  const p = canvasPoint(event);
  const polys = LAYOUTS[state.layout].panels;
  for (let i = polys.length - 1; i >= 0; i--) {
    if (pointInPanel(polys[i], p.x, p.y)) {
      selected = i;
      buildPanelList(); syncZoom();
      drag = { x: p.px, y: p.py };
      canvas.setPointerCapture(event.pointerId);
      paint();
      return;
    }
  }
});

canvas.addEventListener('pointermove', (event) => {
  if (!drag) return;
  const p = canvasPoint(event);
  const slot = state.panels[selected];
  const box = panelBox(LAYOUTS[state.layout].panels[selected]);
  slot.ox += (p.px - drag.x) / (box.w * canvas.width);
  slot.oy += (p.py - drag.y) / (box.h * canvas.height);
  drag = { x: p.px, y: p.py };
  paint();
});

canvas.addEventListener('pointerup', () => { drag = null; });
canvas.addEventListener('pointercancel', () => { drag = null; });

canvas.addEventListener('wheel', (event) => {
  event.preventDefault();
  const slot = state.panels[selected];
  slot.zoom = Math.min(3.2, Math.max(1, slot.zoom * Math.exp(-event.deltaY * 0.0012)));
  syncZoom();
  paint();
}, { passive: false });

/* ---------------------------------------------------------- export */

for (const button of document.querySelectorAll('[data-export]')) {
  button.addEventListener('click', () => {
    const [w, h] = button.dataset.export.split('x').map(Number);
    const out = document.createElement('canvas');
    out.width = w; out.height = h;
    renderCover(out.getContext('2d'), w, h, state, photos.map((p) => p.img));
    out.toBlob((blob) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `vice-panel-cover-${w}x${h}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      say(`Exported a ${w} × ${h} PNG.`);
    }, 'image/png');
  });
}

/* ---------------------------------------------------------- boot */

async function boot() {
  const query = new URLSearchParams(location.search);
  const shot = readShot(query);

  buildLayoutChips();
  buildGradeChips();

  if (shot) {
    state.layout = shot.layout;
    state.grade = shot.grade;
    state.title = shot.caption;
    state.subtitle = shot.subtitle;
    state.halftone = shot.halftone;
    $('title').value = shot.caption;
    $('subtitle').value = shot.subtitle;
    $('fin-halftone').checked = shot.halftone;
    if (shot.mode === 'cover') {
      document.body.classList.add('shot-cover');
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    await loadPhoto(`samples/${shot.photo}.jpg`, shot.photo);
    syncPanels();
    // One photo, many crops: every panel shows the scene photo in its own crop.
    state.panels.forEach((slot, i) => { slot.photo = 0; Object.assign(slot, CROP_STYLES[i % CROP_STYLES.length]); });
    buildLayoutChips(); buildGradeChips(); buildPanelList();
    await document.fonts.ready;
    paint();
    requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
    return;
  }

  await loadPhoto('samples/pier.jpg', 'The Pier');
  await loadPhoto('samples/boulevard.jpg', 'The Boulevard');
  syncPanels();
  buildPanelList();
  syncZoom();
  await document.fonts.ready;
  paint();
}

boot();
