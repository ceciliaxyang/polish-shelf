/* Background drawing for the shelf's swatches (computers with a mouse; see "background drawing" in app.js).
   Each shelf swatch is drawn here, on its own thread, by the same code the page uses (swatch-render.js),
   into an offscreen canvas that stays alive here with its hover animation. The page forwards the pointer
   to it; every time a swatch redraws, a copy of its picture is sent back and the page just pastes it into
   the real canvas. So drawing a swatch at a new size (after a zoom) or animating one on hover no longer
   holds up the page: scrolling, the zoom glide and everything else keep moving while it works. */

// The page's version (?v=...) is passed on, so a new release never pairs with an old cached copy.
importScripts("swatch-render.js" + self.location.search);

// What the drawing code expects of a page, as far as it uses one here.
self.window = self;
const canvasOf = () => {
  const c = new OffscreenCanvas(1, 1);
  c.classList = { add() {}, remove() {}, contains() { return false; } };
  c.matches = () => false;
  return c;
};
self.document = { createElement: canvasOf };
if (!self.requestAnimationFrame) { // older browsers without animation frames in workers
  self.requestAnimationFrame = fn => setTimeout(() => fn(performance.now()), 16);
  self.cancelAnimationFrame = id => clearTimeout(id);
}
const state = { finish: null };
let restH = .5;
function finishH() { return restH; }

const live = new Map(); // id -> { cv, v: the picture version last sent }
// Send each swatch whose picture changed since it was last sent. (Each swatch counts its redraws in cv._v.)
let shipping = false;
function ship() {
  shipping = false;
  live.forEach((s, id) => {
    if (s.cv._v === s.v) return;
    const v = s.v = s.cv._v;
    createImageBitmap(s.cv).then(b => { if (live.get(id) === s) self.postMessage({ id, bmp: b, v }, [b]); else b.close(); });
  });
}
const shipSoon = () => { if (!shipping) { shipping = true; queueMicrotask(ship); } };
// The swatches' animations run on this worker's own frames; after each, their new pictures are sent.
const rafHere = self.requestAnimationFrame.bind(self);
self.requestAnimationFrame = fn => rafHere(t => { fn(t); shipSoon(); });

self.onmessage = e => {
  const m = e.data;
  if (m.type === "draw") {
    self.devicePixelRatio = m.dpr; restH = m.restH; state.finish = m.finish;
    const cv = canvasOf();
    cv.getBoundingClientRect = () => cv._rect || { left: 0, top: 0, width: m.W, height: m.H };
    renderSwatch(cv, m.p, m.W, m.H);
    live.set(m.id, { cv, v: -1 });
    ship();
  } else if (m.type === "pointer") {
    const s = live.get(m.id); if (!s) return;
    s.cv._rect = m.rect; state.finish = m.finish;
    const h = m.leave ? s.cv.onpointerleave : s.cv.onpointermove;
    if (h) h({ clientX: m.x, clientY: m.y, pointerType: m.pointerType });
  } else if (m.type === "drop") {
    m.ids.forEach(id => live.delete(id));
  }
};
