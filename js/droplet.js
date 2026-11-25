/* ---------- droplet swatches ---------- */
// Swatches can be drawn as rectangles (the original cards) or as droplets: each one a small poured puddle
// of polish, round but a little irregular, the shape picked from the polish (or combo) so it stays the
// same every visit. The live swatch canvas is clipped to the drop, so every effect (magnetic flash,
// multichrome shift, holo, shimmer...) still moves. On top sits a "soft sheen": the polish lies flat, so
// there's no dome shading, just a faint broad sheen, a thin bright line where the edge catches the
// light (from the upper left) and a hairline meniscus; a tight contact shadow sits underneath.
//
// Which one shows is a developer setting, kept in this browser: tap the "Polish shelf" title five times
// to open it, or add ?swatch=drop / ?swatch=rect to the address. Droplets are the default.
// app.js calls dropify() on every box that holds a swatch canvas and dropThumb() for small thumbnails.

const SHAPE_KEY = "polish-shelf:swatch-shape";
const SHAPE = (() => {
  const q = new URLSearchParams(location.search).get("swatch");
  if (q === "drop" || q === "rect") { try { localStorage.setItem(SHAPE_KEY, JSON.stringify(q)); } catch (e) {} return q; }
  try { const v = JSON.parse(localStorage.getItem(SHAPE_KEY)); if (v === "rect" || v === "drop") return v; } catch (e) {}
  return "drop";
})();
const DROPS = SHAPE === "drop";
document.documentElement.classList.toggle("drops", DROPS);

const DROP_NS = "http://www.w3.org/2000/svg";
function dropHash(s) { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function dropRand(seed) { let a = seed || 1; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// The outline: a circle with a few low waves on its radius (a slight lean and lumpiness) plus tiny fast
// ripples (where the edge settled), grown to touch the sides of a box 100 wide and `vh` tall.
const dropCache = new Map();
function dropShape(key, vh) {
  const id = key + "|" + vh.toFixed(3);
  if (dropCache.has(id)) return dropCache.get(id);
  const R = dropRand(dropHash(key)), lerp = (a, b) => a + (b - a) * R();
  const waves = [[2, lerp(.015, .045)], [3, lerp(.008, .03)], [4, lerp(0, .018)], [5, lerp(0, .01)], [7, lerp(0, .005)],
    [9, lerp(.002, .006)], [13, lerp(.001, .003)], [17, lerp(0, .0015)]].map(([k, a]) => [k, a, R() * Math.PI * 2]);
  const N = 72, pts = [];
  for (let i = 0; i < N; i++) {
    const t = i / N * Math.PI * 2, r = 1 + waves.reduce((s, [k, a, p]) => s + a * Math.sin(k * t + p), 0);
    pts.push([Math.cos(t) * r, Math.sin(t) * r]);
  }
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const k = Math.min(99 / (x1 - x0), (vh - 1) / (y1 - y0)), mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
  pts.forEach(p => { p[0] = 50 + (p[0] - mx) * k; p[1] = vh / 2 + (p[1] - my) * k; });
  // Catmull-Rom through the points, as cubic Béziers
  // segs: each curve's two control points and end point, in the 100 x vh box.
  const segs = [];
  for (let i = 0; i < N; i++) {
    const p0 = pts[(i - 1 + N) % N], p1 = pts[i], p2 = pts[(i + 1) % N], p3 = pts[(i + 2) % N];
    segs.push([p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]]);
  }
  const path = (sx, sy) => {
    const f = (v, i) => (v * (i % 2 ? sy : sx)).toFixed(2);
    return `M${f(pts[0][0], 0)} ${f(pts[0][1], 1)}` + segs.map(c => "C" + c.map(f).join(" ")).join("") + "Z";
  };
  const shape = { d: path(1, 1), cx: 50 - mx * k, cy: vh / 2 - my * k, vh, R,
    // The outline in CSS pixels for an element w x h, as a clip-path. A clip-path (unlike a mask image)
    // applies on the very first paint and is cheap for the browser to keep applying while the swatch animates.
    clip: (w, h) => `path("${path(w / 100, h / vh)}")` };
  dropCache.set(id, shape);
  return shape;
}

// Keep each drop's clip-path in step with its box's size (cards resize with the zoom and the screen).
function dropClip(box) {
  const w = box.clientWidth, h = box.clientHeight;
  if (w && h && box._drop) box.style.setProperty("--drop-clip", box._drop.clip(w, h));
}
const dropRO = new ResizeObserver(entries => entries.forEach(e => dropClip(e.target)));

let dropUid = 0;
function dropSvg(cls, vh, inner) {
  const s = document.createElementNS(DROP_NS, "svg");
  s.setAttribute("class", cls); s.setAttribute("viewBox", `0 0 100 ${vh}`);
  s.setAttribute("preserveAspectRatio", "none"); s.setAttribute("aria-hidden", "true");
  s.innerHTML = inner; return s;
}

/* The poured look, after photos of real polish pours: crisp tapered light streaks along the upper left
   edge (and a small one lower right), an edge band, and in shimmer and magnetic polishes a faint
   marbled swirl, as if the shimmer settled where it flowed. Tuned by Cecilia in the mockup's sliders. */
const POLISH_BY_ID = new Map((typeof POLISHES !== "undefined" ? POLISHES : []).map(p => [p.id, p]));
const dropHex = c => { c = String(c).replace("#", ""); if (c.length === 3) c = [...c].map(x => x + x).join(""); return [0, 2, 4].map(i => parseInt(c.slice(i, i + 2), 16) / 255); };
const dropToHex = a => "#" + a.map(v => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, "0")).join("");
function dropHsl([r, g, b]) { const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; let h = 0, s = 0;
  if (mx !== mn) { const d = mx - mn; s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h /= 6; } return [h, s, l]; }
function dropRgb([h, s, l]) { if (!s) return [l, l, l]; const q = l < .5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = t => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < .5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; }; return [f(h + 1 / 3), f(h), f(h - 1 / 3)]; }
// The edge band and swirl for a drop's key: a polish id, or a stack ("combo:a+b"), shaped by its top layer.
function pouredLook(key) {
  key = String(key);
  const p = POLISH_BY_ID.get(key.startsWith("combo:") ? key.slice(6).split("+").pop() : key);
  if (!p || !p.colors) return null;
  const base = p.baseColor || p.colors[0], [h, s, l] = dropHsl(dropHex(base)), fx = p.effect;
  // See-through polishes glow lighter and richer where the pour thins at its edge; opaque ones get a deeper band.
  const clear = fx === "sheer" || fx === "sheermag" || (p.effects || []).includes("jelly") || !!p.sheer || (!!p.baseColor && l < .35);
  return {
    rim: clear ? dropToHex(dropRgb([h, Math.min(1, s * 1.25 + .1), Math.min(.85, l * 1.6 + .14)])) : dropToHex(dropRgb([h, Math.min(1, s * 1.1), l * .62])),
    rimA: clear ? .75 : .45, rimW: clear ? 9 : 7,
    swirly: ["shimmer", "magnetic", "sheermag", "multichrome"].includes(fx), swirl: .85 * .19 * (fx === "shimmer" ? 1.35 : 1),
  };
}
// The swirl: a small grey pattern (lighter where the shimmer gathered, darker between), laid over the
// swatch with soft light. Drawn once per drop shape, a little after the page settles, and kept.
const swirlCache = new Map(), swirlQueue = [];
function swirlPattern(key, s) {
  const id = key + "|" + s.vh.toFixed(2);
  if (swirlCache.has(id)) return swirlCache.get(id);
  const W = 128, H = Math.round(W * s.vh / 100), cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const x = cv.getContext("2d"), img = x.createImageData(W, H), R = dropRand(dropHash(key + "#sw2"));
  const g = new Float32Array(64 * 64), RN = dropRand(dropHash(key + "#swirl")); for (let i = 0; i < g.length; i++) g[i] = RN();
  const at = (a, b) => g[((b & 63) << 6) | (a & 63)];
  const n1 = (px, py) => { const xi = Math.floor(px), yi = Math.floor(py), fx = px - xi, fy = py - yi, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1); return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy; };
  const N = (px, py) => n1(px, py) * .55 + n1(px * 2.1 + 7, py * 2.1 + 3) * .3 + n1(px * 4.3 + 1, py * 4.3 + 9) * .15;
  const cx = s.cx / 100, cy = s.cy / s.vh, turns = (2.2 + R() * 1.6) * .69, dir = R() < .5 ? -1 : 1, ox = (R() - .5) * .25, oy = (R() - .5) * .25;
  const lo = -.2 + .48 * .75, span = 1.2 - .48 * 1.1;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    let u = i / W - cx - ox, v = j / H - cy - oy;
    const wx = N(u * 1.6 + 4, v * 1.6) - .5, wy = N(u * 1.6, v * 1.6 + 8) - .5; u += wx * .38; v += wy * .38;
    const r = Math.hypot(u, v), a = Math.atan2(v, u);
    const band = Math.sin(dir * a + r * turns * 6.28 + N(u * 2 + 2, v * 2 + 5) * 3);
    const t = Math.max(0, Math.min(1, (band - lo) / span)), hi = t * t * (3 - 2 * t);
    const val = .5 + .3 * hi - .14 + (N(u * 7 + 3, v * 7 + 1) - .5) * .11 * .5;
    const q = (j * W + i) * 4, c = Math.round(Math.max(0, Math.min(1, val)) * 255);
    img.data[q] = img.data[q + 1] = img.data[q + 2] = c; img.data[q + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  swirlCache.set(id, cv); return cv;
}
function swirlInto(box, key, s) {
  const cv = document.createElement("canvas"); cv.className = "drop-swirl"; cv.setAttribute("aria-hidden", "true");
  cv.style.setProperty("--swirl", pouredLook(key).swirl.toFixed(3));
  const canvas = box.querySelector(":scope > canvas:not(.drop-swirl)");
  if (canvas) canvas.after(cv); else box.appendChild(cv);
  swirlQueue.push([cv, key, s]);
  if (swirlQueue.length === 1) (window.requestIdleCallback || (fn => setTimeout(fn, 50)))(function paint(deadline) {
    while (swirlQueue.length && (!deadline || deadline.timeRemaining() > 2)) {
      const [c, k, sh] = swirlQueue.shift(); if (!c.isConnected) continue;
      const src = swirlPattern(k, sh); c.width = src.width; c.height = src.height; c.getContext("2d").drawImage(src, 0, 0);
    }
    if (swirlQueue.length) (window.requestIdleCallback || (fn => setTimeout(fn, 50)))(paint);
  });
}

// Turn a box holding a swatch canvas into a droplet. `aspect` is the box's height / width. Safe to call
// again after the box's canvas is replaced. Options: small (no shadow blur, for thumbnails),
// ring (a ring in the page color around the drop, for overlapping thumbnails), shadow (default on).
function dropify(box, key, aspect = 1, opt = {}) {
  if (!DROPS || !box) return box;
  const vh = 100 * aspect, s = dropShape(String(key), vh), id = "dp" + (++dropUid);
  box.classList.add("drop");
  box._drop = s; dropClip(box);
  if (!box._dropSized) { box._dropSized = true; dropRO.observe(box); }
  box.querySelectorAll(":scope > .drop-under, :scope > .drop-gloss, :scope > .drop-swirl").forEach(el => el.remove());
  const sc = (k, dx = 0, dy = 0) => `translate(${(s.cx * (1 - k) + dx).toFixed(2)} ${(s.cy * (1 - k) + dy).toFixed(2)}) scale(${k})`;
  let under = "", gloss;
  if (opt.ring) under += `<path d="${s.d}" fill="none" style="stroke: var(--bg)" stroke-width="${opt.ring}"/>`;
  if (opt.small) {
    // Thumbnails: a flat contact shadow, the bright edge and a hairline rim.
    if (opt.shadow !== false) under += `<path d="${s.d}" transform="translate(0 1.4)" fill="rgba(40,30,20,.14)"/>`;
    gloss = `<defs>
        <clipPath id="${id}c"><path d="${s.d}"/></clipPath>
        <linearGradient id="${id}e" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".32" stop-color="#fff" stop-opacity="0"/>
          <stop offset=".85" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity=".18"/>
        </linearGradient>
      </defs>
      <g clip-path="url(#${id}c)">
        <path d="${s.d}" fill="none" stroke="url(#${id}e)" stroke-width="2.4" transform="${sc(.988)}"/>
        <path d="${s.d}" fill="none" stroke="#000" stroke-opacity=".2" stroke-width="1.4"/>
      </g>`;
  } else {
    const look = pouredLook(key);
    if (opt.shadow !== false) under += `<defs><filter id="${id}u" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation=".7"/></filter>
        <filter id="${id}v" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.4"/></filter></defs>
      <path d="${s.d}" transform="translate(.2 1.1)" fill="rgba(40,30,20,.125)" filter="url(#${id}v)"/>
      <path d="${s.d}" transform="translate(.15 .45)" fill="rgba(40,30,20,.35)" filter="url(#${id}u)"/>`;
    // Light streaks: each is three overlapping strokes along the outline (pulled in a little), shorter
    // and bolder toward the middle, so it tapers at both ends.
    const streak = (c, len, k, w, op, f) => [1, .6, .3].map((m, i) =>
      `<path d="${s.d}" transform="${sc(k)}" pathLength="100" fill="none" stroke="#fff" stroke-linecap="round"
        stroke-dasharray="${(len * m).toFixed(2)} 200" stroke-dashoffset="${(-(c * 100 - len * m / 2)).toFixed(2)}"
        stroke-width="${(w * (.55 + i * .35)).toFixed(2)}" stroke-opacity="${Math.min(1, op * (.45 + i * .3)).toFixed(3)}" filter="url(#${id}${f})"/>`).join("");
    const R = dropRand(dropHash(key + "#spec")), c1 = .6 + (R() - .5) * .06, l1 = (9 + R() * 6) * .78, c2 = .12 + (R() - .5) * .06, l2 = (3 + R() * 3) * .78;
    gloss = `<defs>
        <clipPath id="${id}c"><path d="${s.d}"/></clipPath>
        <radialGradient id="${id}h" cx=".34" cy=".26" r=".55"><stop offset="0" stop-color="#fff" stop-opacity=".03"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
        <filter id="${id}r" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="2.2"/></filter>
        <filter id="${id}k"><feGaussianBlur stdDeviation=".215"/></filter>
        <filter id="${id}w"><feGaussianBlur stdDeviation=".85"/></filter>
        <filter id="${id}l"><feGaussianBlur stdDeviation=".22"/></filter>
      </defs>
      <g clip-path="url(#${id}c)">
        <rect width="100" height="${vh}" fill="url(#${id}h)"/>
        ${look ? `<path d="${s.d}" fill="none" stroke="${look.rim}" stroke-opacity="${look.rimA}" stroke-width="${look.rimW}" filter="url(#${id}r)"/>` : ""}
        ${streak(c1, l1 * 1.5, .9, 2.56, .09, "w")}
        ${streak(c1, l1, .935, 1.2, .39, "k")}
        ${streak(c2, l2, .94, .88, .7, "k")}
        <path d="${s.d}" transform="${sc(.975)}" pathLength="100" fill="none" stroke="#fff" stroke-opacity=".2" stroke-width=".45"
          stroke-dasharray="17.16 200" stroke-dashoffset="${(-(c1 * 100 - 8.58)).toFixed(2)}" filter="url(#${id}l)"/>
      </g>`;
    if (look && look.swirly) swirlInto(box, key, s);
  }
  if (under) box.prepend(dropSvg("drop-under", vh, under));
  box.append(dropSvg("drop-gloss", vh, gloss));
  return box;
}

// Small thumbnails are bare canvases; as droplets each goes in a box of its own (taking the canvas's
// class, so it keeps its size and place). Returns what to put in the page.
function dropThumb(cv, key, opt = {}) {
  if (!DROPS) return cv;
  const box = document.createElement("span");
  box.className = (cv.className ? cv.className + " " : "") + "drop-thumb";
  if (cv.title) { box.title = cv.title; cv.removeAttribute("title"); }
  cv.className = "";
  box.appendChild(cv);
  return dropify(box, key, 1, { small: true, ...opt });
}

// The key a stack of layers is shaped by: its polishes, bottom to top. The Layers preview, the peek bar,
// a saved combo's card and its thumbnail on the Favorite combos button share it, so a combo keeps its shape.
function dropKeyFor(layers) { return "combo:" + (layers || []).map(l => l.pid).join("+"); }

/* ---------- pouring in ---------- */
// As droplets, each swatch lands like a drop of polish as it comes on screen. First a puddle in the
// polish's base color: one flat layer, so it costs nothing and shows right away. It lands in one springy
// motion, starting small, swelling about 6% past its size and settling back, its edge jiggling unevenly
// before it calms into the drop's exact outline. The real swatch (shimmer, magnetic flash...) fades in on
// top while it's still settling, as soon as it has been drawn. Drops land loosely from top to bottom:
// each row a beat after the one above, and every drop with its own extra wait and speed, fixed per polish.
const POUR = DROPS && !matchMedia("(prefers-reduced-motion: reduce)").matches;
const POUR_MS = 1300;
const pourSpring = t => t >= 1 ? 1 : 1 - Math.exp(-7 * t) * Math.cos(8 * t); // from nothing, so drops still waiting show no dot
function pourRand(key) { const h = [...String(key)].reduce((a, ch) => a * 31 + ch.charCodeAt(0) >>> 0, 11); return [(h % 1000) / 1000, ((h >> 10) % 1000) / 1000]; }

// The puddle's outline at each moment, as clip-path keyframes. Every frame is the drop's own outline
// pulled toward its middle by a different amount at each angle, with the spring baked in (the
// keyframes play linearly), so the motion is one smooth curve. The puddle layer is 10% larger than the
// swatch on every side so the overshoot isn't cut off.
function pourFrames(s, key, w, h) {
  const d = s.clip(w, h).slice(6, -2), nums = d.match(/-?\d+(\.\d+)?/g).map(Number), cmds = d.replace(/-?\d+(\.\d+)?/g, "#");
  const lx = s.cx / 100 * w, ly = s.cy / s.vh * h, R = dropRand(dropHash(key + "#pour")), ph = [R(), R(), R()].map(v => v * 6.28);
  const frames = [];
  for (let i = 0, N = 48; i <= N; i++) {
    const t = i / N, e = pourSpring(t), lump = .2 * Math.exp(-3.2 * t) * (1 - t), out = [];
    for (let j = 0; j < nums.length; j += 2) {
      const dx = nums[j] - lx, dy = nums[j + 1] - ly, a = Math.atan2(dy, dx);
      const n = .55 * Math.sin(2 * a + ph[0] + 1.6 * t) + .3 * Math.sin(3 * a + ph[1] - 2.1 * t) + .15 * Math.sin(5 * a + ph[2] + 3 * t);
      const f = Math.min(1.09, Math.max(0, e * (1 + lump * n)));
      out.push((lx + dx * f + w * .1).toFixed(2), (ly + dy * f + h * .1).toFixed(2));
    }
    let k = 0;
    frames.push({ clipPath: `path("${cmds.replace(/#/g, () => out[k++])}")`, offset: t });
  }
  return frames;
}

let pourIO = null, pourFirst = true;
// app.js calls this for each shelf card (droplets only). Returns false if cards should just appear.
function pourIn(card, key, color) {
  if (!POUR) return false;
  const wrap = card.querySelector(".swatch-wrap"), base = document.createElement("div");
  base.className = "pour-base"; base.style.backgroundColor = color;
  base.style.backgroundImage = `radial-gradient(120% 120% at 38% 32%, color-mix(in srgb, ${color} 84%, white), ${color} 55%, color-mix(in srgb, ${color} 82%, black))`;
  wrap.insertBefore(base, wrap.querySelector("canvas"));
  card._pourKey = String(key); card.classList.add("pour-wait");
  if (!pourIO) pourIO = new IntersectionObserver(entries => {
    const cards = entries.filter(e => e.isIntersecting).map(e => e.target);
    if (!cards.length) return;
    const top = c => Math.round(c.getBoundingClientRect().top);
    cards.sort((a, b) => top(a) - top(b) || a.getBoundingClientRect().left - b.getBoundingClientRect().left);
    const rows = [...new Set(cards.map(top))];
    // The first screen lands at a relaxed pace; drops scrolled into view later land a bit sooner.
    const [rowGap, wait] = pourFirst ? [150, 380] : [110, 220];
    pourFirst = false;
    cards.forEach(c => { pourIO.unobserve(c); const [r1, r2] = pourRand(c._pourKey); pourStart(c, rows.indexOf(top(c)) * rowGap + r1 * wait, POUR_MS * (.85 + r2 * .3)); });
  }, { threshold: .2 });
  pourIO.observe(card);
  return true;
}

function pourStart(card, delay, dur) {
  const wrap = card.querySelector(".swatch-wrap"), base = wrap.querySelector(".pour-base");
  card.classList.replace("pour-wait", "pouring");
  const anim = base.animate(pourFrames(wrap._drop, card._pourKey, wrap.clientWidth, wrap.clientHeight), { duration: dur, delay, easing: "linear", fill: "both" });
  const fade = (el, at, from = { opacity: 0 }, to = { opacity: 1 }, ms = 650) =>
    el && el.animate([from, to], { duration: ms, delay: delay + dur * at, easing: "cubic-bezier(.4, 0, .2, 1)", fill: "backwards" });
  wrap.querySelectorAll(".drop-under, .drop-gloss").forEach(el => fade(el, .22));
  fade(wrap.querySelector(".swatch-btn"), .45);
  fade(card.querySelector(".card-text"), .35, { opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }, 700);
  // The real swatch fades in once the drop has mostly landed and the swatch has been drawn, whichever is later.
  setTimeout(() => { card._pourLanded = true; pourLight(card); }, delay + dur * .28);
  anim.onfinish = () => { card._pourSettled = true; pourDone(card); };
}
// app.js calls this after drawing a swatch.
function pourDrawn(cv) { const card = cv.closest(".card"); if (card && card.classList.contains("pouring")) pourLight(card); }
function pourLight(card) {
  const cv = card.querySelector("canvas.swatch");
  if (!card._pourLanded || !cv._w || card.classList.contains("pour-lit")) return;
  card.classList.add("pour-lit");
  cv.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 650, easing: "cubic-bezier(.4, 0, .2, 1)" }).onfinish = () => { card._pourShown = true; pourDone(card); };
}
// Once the drop has settled and the swatch is fully shown, the puddle underneath is no longer needed.
function pourDone(card) {
  if (!card._pourSettled || !card._pourShown) return;
  card.classList.remove("pouring", "pour-lit");
  const base = card.querySelector(".pour-base"); if (base) base.remove();
}

/* Developer settings: five quick taps on the page title open a small panel to switch the swatch shape.
   (Card text follows the shape: centered under droplets, left-aligned under rectangles.) */
(() => {
  const title = document.getElementById("shelfTitle");
  if (!title) return;
  let taps = 0, timer = 0;
  title.addEventListener("click", () => {
    taps++; clearTimeout(timer); timer = setTimeout(() => { taps = 0; }, 600);
    if (taps >= 5) { taps = 0; openDev(); }
  });
  function openDev() {
    let panel = document.getElementById("devPanel");
    if (!panel) {
      panel = document.createElement("div"); panel.id = "devPanel"; panel.className = "dev-panel";
      panel.setAttribute("role", "dialog"); panel.setAttribute("aria-label", "Developer settings");
      panel.innerHTML = `<p class="dev-title">Developer settings</p>
        <div class="dev-row"><span id="devShapeLabel">Swatch shape</span>
          <div class="dev-seg" role="radiogroup" aria-labelledby="devShapeLabel">
            <button type="button" role="radio" data-shape="drop">Droplet</button>
            <button type="button" role="radio" data-shape="rect">Rectangle</button>
          </div></div>
        <button type="button" class="dev-close">Done</button>`;
      panel.querySelectorAll("[data-shape]").forEach(b => {
        b.setAttribute("aria-checked", b.dataset.shape === SHAPE);
        b.onclick = () => {
          if (b.dataset.shape === SHAPE) return;
          try { localStorage.setItem(SHAPE_KEY, JSON.stringify(b.dataset.shape)); } catch (e) {}
          // Drop a ?swatch= override so the saved choice is what loads.
          const u = new URL(location.href); u.searchParams.delete("swatch"); location.replace(u);
        };
      });
      panel.querySelector(".dev-close").onclick = () => { panel.hidden = true; };
      document.body.appendChild(panel);
    }
    panel.hidden = false;
    panel.querySelector('[data-shape][aria-checked="true"]').focus();
  }
})();
