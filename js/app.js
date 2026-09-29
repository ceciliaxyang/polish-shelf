/* ---------- vocabulary ---------- */
const EFFECTS = {
  sheer:     "Sheer",
  magnetic:  "Magnetic",
  holo:      "Holographic",
  shimmer:   "Shimmer",
  chrome:    "Chrome",
  creme:     "Creme",
  glitter:   "Glitter",
  flakies:   "Flakies",
  duochrome: "Duochrome",
  multichrome: "Multichrome",
  thermal:   "Thermal",
};
// Filter pills always shown, in this order; other effects get a pill once a polish uses them.
const PILL_EFFECTS = ["sheer", "magnetic", "holo", "shimmer", "chrome"];
const SKIN = "#f3d4c2";
const NATURAL = "#f2d6cf";

/* ---------- color helpers ---------- */
function rgb(hex) { hex = (hex || "#cccccc").replace("#", ""); if (hex.length === 3) hex = hex.split("").map(c => c + c).join(""); const n = parseInt(hex, 16) || 0; return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function toHex(r, g, b) { return "#" + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join(""); }
function shade(hex, t) { const [r, g, b] = rgb(hex); return t >= 0 ? toHex(r + (255 - r) * t, g + (255 - g) * t, b + (255 - b) * t) : toHex(r * (1 + t), g * (1 + t), b * (1 + t)); }
function rgba(hex, a) { const [r, g, b] = rgb(hex); return `rgba(${r},${g},${b},${a})`; }
// Color at position t (0 to 1) along a list of colors, blending between neighbors.
function palette(cols, t) {
  if (cols.length === 1) return cols[0];
  const f = Math.max(0, Math.min(1, t)) * (cols.length - 1), i = Math.min(cols.length - 2, Math.floor(f)), k = f - i;
  const A = rgb(cols[i]), B = rgb(cols[i + 1]);
  return toHex(A[0] + (B[0] - A[0]) * k, A[1] + (B[1] - A[1]) * k, A[2] + (B[2] - A[2]) * k);
}

/* ---------- nail rendering ---------- */
// Seeded random so each polish's glitter lands in the same place every render.
function rng(seed) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) { h = Math.imul(h ^ seed.charCodeAt(i), 3432918353); h = h << 13 | h >>> 19; }
  let a = h >>> 0;
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function gauss(R) { return Math.sqrt(-2 * Math.log(R() + 1e-9)) * Math.cos(2 * Math.PI * R()); }
// Opacity after n coats of a polish with single-coat opacity a.
function coat(a, n) { return 1 - Math.pow(1 - a, n); }

function nailPath(ctx, x, y, w, h) {
  const X = v => x + v * w / 100, Y = v => y + v * h / 150;
  ctx.beginPath(); ctx.moveTo(X(0), Y(128));
  ctx.lineTo(X(0), Y(60)); ctx.bezierCurveTo(X(0), Y(24), X(38), Y(0), X(50), Y(0)); ctx.bezierCurveTo(X(62), Y(0), X(100), Y(24), X(100), Y(60));
  ctx.lineTo(X(100), Y(128)); ctx.bezierCurveTo(X(100), Y(154), X(0), Y(154), X(0), Y(128)); ctx.closePath();
}

function sprinkle(ctx, R, b, count, cols, rmin, rmax, amin, amax) {
  for (let i = 0; i < count; i++) {
    ctx.globalAlpha = amin + R() * (amax - amin); ctx.fillStyle = cols[(R() * cols.length) | 0];
    const r = (rmin + R() * (rmax - rmin)) * b.s;
    ctx.beginPath(); ctx.arc(b.x + R() * b.w, b.y + R() * b.H, r, 0, 7); ctx.fill();
  }
  ctx.globalAlpha = 1;
}
function poly(ctx, cx, cy, r, sides, rot, R, jitter) {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const a = rot + i * 2 * Math.PI / sides, rr = r * (1 - jitter + R() * jitter * 2);
    i ? ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr) : ctx.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  ctx.closePath();
}

function drawLayer(ctx, L, b, R) {
  const p = L.polish, c = (p.colors && p.colors.length ? p.colors : ["#cccccc"]), n = L.coats || 2, { x, y, w, h, H, s } = b;
  const fill = (col, a) => { ctx.globalAlpha = a; ctx.fillStyle = col; ctx.fillRect(x, y, w, H); ctx.globalAlpha = 1; };
  ctx.globalCompositeOperation = "source-over";
  switch (p.effect) {
    case "sheer": {
      fill(c[0], coat(.38, n));
      const g = ctx.createRadialGradient(x + w / 2, y + h * .55, w * .1, x + w / 2, y + h * .55, w * .95);
      g.addColorStop(0, rgba(c[0], 0)); g.addColorStop(1, rgba(shade(c[0], -.4), .4 * coat(.5, n)));
      ctx.fillStyle = g; ctx.fillRect(x, y, w, H); break;
    }
    case "shimmer": {
      fill(c[0], coat(.72, n)); sprinkle(ctx, R, b, Math.round(w * h / 9), [c[1] || shade(c[0], .5)], .25, .8, .25, .9); break;
    }
    case "glitter": {
      fill(c[0], coat(.14, n));
      const cols = c.length > 1 ? c.slice(1) : [c[0]], count = Math.round(w * h / 120 * n);
      for (let i = 0; i < count; i++) {
        const col = cols[(R() * cols.length) | 0], r = (1.3 + R() * 2.4) * s, px = x + R() * w, py = y + R() * H;
        ctx.globalAlpha = .9; ctx.fillStyle = shade(col, (R() - .5) * .5); poly(ctx, px, py, r, 6, R() * Math.PI, R, 0); ctx.fill();
        if (R() < .45) { ctx.globalAlpha = .8; ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.arc(px - r * .3, py - r * .3, r * .3, 0, 7); ctx.fill(); }
      }
      ctx.globalAlpha = 1; break;
    }
    case "flakies": {
      fill(c[0], coat(.14, n));
      const cols = c.length > 1 ? c.slice(1) : [shade(c[0], .5)], count = Math.round(12 * n * (w / 100));
      for (let i = 0; i < count; i++) {
        const col = cols[(R() * cols.length) | 0], r = (4 + R() * 8) * s, px = x + R() * w, py = y + R() * H;
        const g = ctx.createLinearGradient(px - r, py - r, px + r, py + r); g.addColorStop(0, rgba(col, .85)); g.addColorStop(1, rgba(shade(col, .55), .35));
        ctx.fillStyle = g; poly(ctx, px, py, r, 5 + ((R() * 3) | 0), R() * 6, R, .45); ctx.fill();
      }
      break;
    }
    case "chrome": {
      const g = ctx.createLinearGradient(x, y, x + w, y + h), d = shade(c[0], -.5), l = shade(c[0], .7);
      [[0, l], [.16, c[0]], [.33, d], [.48, l], [.6, c[0]], [.78, d], [1, shade(c[0], .3)]].forEach(([o, col]) => g.addColorStop(o, col));
      ctx.globalAlpha = coat(.9, n); ctx.fillStyle = g; ctx.fillRect(x, y, w, H); ctx.globalAlpha = 1; break;
    }
    case "magnetic": {
      // colors = [base, ...flash]; several flash colors make a multichrome that shifts from the band's core to its edges.
      fill(c[0], coat(.75, n));
      const flashes = c.length > 1 ? c.slice(1) : [shade(c[0], .65)], a = Math.PI / 2, cx = x + w / 2, cy = y + h * .5, dx = Math.cos(a), dy = Math.sin(a), nx = -dy, ny = dx, sig = w * .13;
      const g = ctx.createLinearGradient(cx - nx * w * .7, cy - ny * w * .7, cx + nx * w * .7, cy + ny * w * .7);
      g.addColorStop(0, rgba(palette(flashes, .6), 0)); g.addColorStop(.35, rgba(palette(flashes, .5), .35)); g.addColorStop(.5, rgba(palette(flashes, 0), .7));
      g.addColorStop(.65, rgba(palette(flashes, .5), .35)); g.addColorStop(1, rgba(palette(flashes, .6), 0));
      ctx.globalCompositeOperation = "screen"; ctx.fillStyle = g; ctx.fillRect(x, y, w, H); ctx.globalCompositeOperation = "source-over";
      const count = Math.round(w * h / 4);
      for (let i = 0; i < count; i++) {
        const t = (R() - .5) * h * 1.6, d = gauss(R) * sig;
        ctx.fillStyle = shade(palette(flashes, Math.min(1, Math.abs(d) / (2.5 * sig))), .3);
        ctx.globalAlpha = Math.exp(-(d * d) / (2 * sig * sig)) * .85;
        ctx.fillRect(cx + dx * t + nx * d, cy + dy * t + ny * d, (.4 + R() * .8) * s, (.4 + R() * .8) * s);
      }
      ctx.globalAlpha = 1; sprinkle(ctx, R, b, Math.round(w * h / 30), flashes, .2, .6, .1, .35); break;
    }
    case "holo": {
      fill(c[0], coat(.8, n));
      const g = ctx.createLinearGradient(x, y + h, x + w, y);
      ["#ff5f6d", "#ffc371", "#f9f871", "#6bffb8", "#4facfe", "#b06bff", "#ff5f6d"].forEach((col, i, arr) => g.addColorStop(i / (arr.length - 1), col));
      ctx.globalCompositeOperation = "soft-light"; ctx.globalAlpha = .9; ctx.fillStyle = g; ctx.fillRect(x, y, w, H);
      ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
      sprinkle(ctx, R, b, Math.round(w * h / 10), ["#ff8fa3", "#ffe08a", "#8affc8", "#8ac7ff", "#d59bff"], .2, .7, .35, .9); break;
    }
    case "duochrome": {
      const a = Math.PI / 4, cx = x + w / 2, cy = y + h / 2, r = h * .6, c2 = c[1] || shade(c[0], .4);
      const g = ctx.createLinearGradient(cx - Math.cos(a) * r, cy - Math.sin(a) * r, cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      g.addColorStop(0, c[0]); g.addColorStop(.5, c2); g.addColorStop(1, c[0]);
      ctx.globalAlpha = coat(.8, n); ctx.fillStyle = g; ctx.fillRect(x, y, w, H); ctx.globalAlpha = 1;
      sprinkle(ctx, R, b, Math.round(w * h / 14), [shade(c2, .4)], .2, .6, .1, .4); break;
    }
    default: fill(c[0], coat(.82, n));
  }
  ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
}

function renderNail(cv, layers, o) {
  o = Object.assign({ W: 80, H: 120, finger: false }, o);
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.round(o.W * dpr); cv.height = Math.round(o.H * dpr); cv.style.width = o.W + "px"; cv.style.height = o.H + "px";
  const ctx = cv.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, o.W, o.H);
  let w, h, x, y;
  if (o.finger) {
    w = o.W * .46; h = w * 1.5; x = (o.W - w) / 2; y = o.H * .07;
    const fx = x - w * .24, fw = w * 1.48, fy = y + h * .3;
    const fg = ctx.createLinearGradient(fx, 0, fx + fw, 0);
    fg.addColorStop(0, shade(SKIN, -.18)); fg.addColorStop(.3, SKIN); fg.addColorStop(.7, SKIN); fg.addColorStop(1, shade(SKIN, -.2));
    ctx.fillStyle = fg; ctx.beginPath(); ctx.roundRect(fx, fy, fw, o.H - fy + 40, [fw / 2, fw / 2, 0, 0]); ctx.fill();
    ctx.fillStyle = rgba(shade(SKIN, -.3), .25); nailPath(ctx, x - 2, y + 2, w + 4, h + 4); ctx.fill();
  } else { h = Math.min(o.H * .9, o.W * .8 * 1.5); w = h / 1.5; x = (o.W - w) / 2; y = (o.H - h) / 2; }
  const b = { x, y, w, h, H: h * 1.05, s: w / 100 };
  ctx.save(); nailPath(ctx, x, y, w, h); ctx.clip();
  ctx.fillStyle = NATURAL; ctx.fillRect(x, y, w, b.H);
  layers.forEach((L, i) => drawLayer(ctx, L, b, rng((L.polish.id || "p") + ":" + i)));
  // Cuticle shadow and gloss highlight
  const cut = ctx.createLinearGradient(0, y + h * .82, 0, y + h); cut.addColorStop(0, "rgba(0,0,0,0)"); cut.addColorStop(1, "rgba(0,0,0,.14)");
  ctx.fillStyle = cut; ctx.fillRect(x, y + h * .8, w, h * .3);
  const g = ctx.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(.14, "rgba(255,255,255,.42)"); g.addColorStop(.26, "rgba(255,255,255,0)");
  g.addColorStop(.85, "rgba(255,255,255,0)"); g.addColorStop(.92, "rgba(255,255,255,.12)"); g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g; ctx.fillRect(x, y, w, b.H);
  ctx.restore();
  ctx.lineWidth = 1; ctx.strokeStyle = "rgba(0,0,0,.16)"; nailPath(ctx, x, y, w, h); ctx.stroke();
}


// Close-up of one polish filling the whole card, like a zoomed-in photo of a painted nail.
// Drawn at 3x pixel density so it stays sharp on retina screens.
// Card swatches use the screen's pixel density (at least 2x, at most 3x); the big swatch in the detail
// view uses 2x to stay smooth while animating.
function swatchDpr(W) { return W > 400 ? 2 : Math.min(3, Math.max(2, window.devicePixelRatio || 1)); }

function renderSwatch(cv, p, W, H) {
  if (p.effect === "magnetic") return magneticSwatch(cv, p, W, H);
  if (p.effect === "holo") return holoSwatch(cv, p, W, H);
  if (p.effect === "thermal") return thermalSwatch(cv, p, W, H);
  if (p.effect === "multichrome") return multichromeSwatch(cv, p, W, H);
  const dpr = swatchDpr(W);
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  const ctx = cv.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = NATURAL; ctx.fillRect(0, 0, W, H);
  drawLayer(ctx, { polish: p, coats: 3 }, { x: 0, y: 0, w: W, h: H, H, s: 2.4 }, rng(p.id || "p"));
}

/*
  Magnetic swatch. At rest it shows a glass bead finish: the magnet pulls the flash into a soft,
  rounded glow in the middle that fades evenly to a darker rim, so the nail looks domed like light
  inside a glass marble. On hover the glow tightens into a cat eye: a narrow, sharp stripe that
  follows the pointer, with the rest of the nail dropping back to the base color.

  Colors: the first flash color sits at the glow's heart and later ones toward its edges.
  Optional per-polish tuning in js/polishes.js:
    grad     [across, down] colors also slide this far along the flash list across the swatch
    shadow   the deep color the edges of the dome fall into (default: a darker shade of the base)
    bead     overrides for the glass bead look: { r: [w, h], span, glow }
    catEye   overrides for the cat eye look: { width, span, glow }
    flakes   colors of iridescent flakies suspended in the polish (they shift through the list on hover)
    sparkle  { density, floor }: more sparkles, and how lit they stay outside the flash (defaults 1 and .1)
    glitter  color of small hex glitter suspended in the polish
*/
// Smooth random field (value noise, two octaves), 0 to 1, fixed per seed. Used to make the flash
// gather into uneven patches the way magnetic particles clump.
function clumpField(R, cw, ch, cell) {
  const out = new Float32Array(cw * ch);
  const octave = (size, amp) => {
    const gx = Math.ceil(cw / size) + 2, gy = Math.ceil(ch / size) + 2, lat = new Float32Array(gx * gy);
    for (let i = 0; i < lat.length; i++) lat[i] = R();
    for (let y = 0; y < ch; y++) {
      const fy = y / size, iy = fy | 0, ty = fy - iy, sy = ty * ty * (3 - 2 * ty);
      for (let x = 0; x < cw; x++) {
        const fx = x / size, ix = fx | 0, tx = fx - ix, sx = tx * tx * (3 - 2 * tx), o = iy * gx + ix;
        const top = lat[o] + (lat[o + 1] - lat[o]) * sx, bot = lat[o + gx] + (lat[o + gx + 1] - lat[o + gx]) * sx;
        out[y * cw + x] += (top + (bot - top) * sy) * amp;
      }
    }
  };
  octave(cell, .65); octave(cell * .4, .35);
  return out;
}

function magneticSwatch(cv, p, W, H) {
  const dpr = swatchDpr(W), cw = Math.round(W * dpr), ch = Math.round(H * dpr);
  cv.width = cw; cv.height = ch;
  const ctx = cv.getContext("2d");
  // The polish body is computed pixel by pixel on an offscreen canvas, then drawn slightly softened
  // so the crisp sparkles on top read as sitting under a clear top coat.
  const body = document.createElement("canvas"); body.width = cw; body.height = ch;
  const bctx = body.getContext("2d", { willReadFrequently: true });
  const base = rgb(p.colors[0]), flashes = p.colors.length > 1 ? p.colors.slice(1) : [shade(p.colors[0], .65)];
  const sh = p.shimmer ? rgb(p.shimmer) : null; // optional shimmer suspended in the base
  // Color the polish falls into at the edges of the dome: the polish's own deep shade, not black.
  const shadow = rgb(p.shadow || shade(p.colors[0], -.3));
  const R = rng(p.id || "p");
  const bead = { r: [.34, .36], span: .75, glow: 1, ...p.bead };
  const cat = { width: .075, span: .8, glow: 1, ...p.catEye };
  const [gX, gY] = p.grad || [0, 0];

  // Fixed fine grain (2x2 device pixels) so the polish reads as shimmer, not flat paint.
  const gw = Math.ceil(cw / 2), grain = new Float32Array(gw * Math.ceil(ch / 2));
  for (let i = 0; i < grain.length; i++) grain[i] = R();
  const clump = clumpField(R, cw, ch, 95 * dpr);

  // Optional flakies (irregular iridescent flakes) and glitter (small hex pieces), suspended in the
  // polish rather than pulled by the magnet, so they stay put as the glow moves.
  const flakes = (p.flakes ? Array.from({ length: Math.round(W * H / 1500) }, () => {
    const r = 2 + Math.pow(R(), 2) * 5, n = 5 + ((R() * 3) | 0), rot = R() * 6.3;
    return { x: R() * W, y: R() * H, phase: R(), pts: Array.from({ length: n }, (_, i) => {
      const a = rot + i / n * 6.283, rr = r * (.55 + R() * .6); return [Math.cos(a) * rr, Math.sin(a) * rr]; }) };
  }) : []);
  const glitter = (p.glitter ? Array.from({ length: Math.round(W * H / 450) }, () => ({ x: R() * W, y: R() * H, r: 1 + R() * 1.1, rot: R(), b: R() })) : []);

  // Sparkles: many fine glints, a few larger ones, gathered where the particles clump.
  // Each is [x, y, radius, brightness] in CSS pixels.
  const sparkles = [];
  // Optional per polish: sparkle: { density, floor } (density multiplies the count; floor keeps them lit outside the flash).
  const spk = { density: 1, floor: .1, mix: .7, size: 1, ...p.sparkle };
  // Optional sparkle.colors: each particle gets its own color from this list (a multichrome that flashes many colors).
  const spkCols = spk.colors ? spk.colors.map(rgb) : null;
  for (let tries = 0; sparkles.length < W * H / 28 * spk.density && tries < W * H * 3; tries++) {
    const x = R() * W, y = R() * H, c = clump[((y * dpr) | 0) * cw + ((x * dpr) | 0)];
    if (R() > .25 + c * .9) continue;
    const big = R() < .03;
    sparkles.push([x, y, (big ? .5 + R() * .4 : .16 + Math.pow(R(), 2) * .3) * spk.size, big ? .85 + R() * .15 : .3 + R() * .6, R()]);
  }

  // h: 0 = glass bead, 1 = cat eye, in between blends the two. x/y: pointer, 0 to 1 across the swatch.
  // The resting shape comes from the Glass bead / Cat eye pills; with neither picked it sits in between.
  let restH = finishH();
  const cur = { x: .5, y: .5, h: restH }, target = { ...cur };
  const ELUT = 1024, eI = new Float32Array(ELUT), eT = new Float32Array(ELUT);
  const PLUT = 256, pal = new Float32Array(PLUT * 3);
  for (let i = 0; i < PLUT; i++) pal.set(rgb(palette(flashes, i / (PLUT - 1))), i * 3);
  const imgFull = bctx.createImageData(cw, ch), imgHalf = bctx.createImageData(Math.ceil(cw / 2), Math.ceil(ch / 2));
  let raf = 0;

  function draw(fast = false) {
    const h = cur.h, k = 1 - h;
    // Glow shape: round and centered for the bead, a long thin stripe through the pointer for the cat eye.
    const cx = (.5 * k + cur.x * h) * cw, cy = (.5 * k + cur.y * h) * ch;
    const rot = 1.0 + (cur.x - .5) * .5; // cat eye runs diagonally, tilting a little as it moves
    const rx = (bead.r[0] * k + 1.1 * h) * cw, ry = (bead.r[1] * k + cat.width * h) * ch;
    const cos = Math.cos(rot), sin = Math.sin(rot);
    const span = bead.span * k + cat.span * h, peak = bead.glow * k + cat.glow * h;
    const gx = gX / cw, gy = gY / ch;

    for (let i = 0; i < ELUT; i++) {
      const e = i / ELUT * 3;
      const beadI = Math.exp(-e * e);                      // silky falloff
      const catI = 1 / (1 + Math.pow(e / .9, 4)) + .05 * Math.exp(-e * .5); // sharp stripe, faint haze
      eI[i] = Math.min(1, peak * (beadI * k + catI * h));
      eT[i] = Math.pow(Math.min(1, e / 1.3), 1.4) * span;
    }
    // Flash strength and color position at a device pixel, with the clumping applied.
    const field = (x, y) => {
      const dx = x - cx, dy = y - cy, u = (dx * cos + dy * sin) / rx, v = (dy * cos - dx * sin) / ry, e = Math.sqrt(u * u + v * v);
      const ki = Math.min(ELUT - 1, (e / 3 * ELUT) | 0), c = clump[(y | 0) * cw + (x | 0)];
      let t = eT[ki] + dx * gx + dy * gy; t = t < 0 ? 0 : t > 1 ? 1 : t;
      return [Math.min(1, eI[ki] * (.62 + .76 * c)), t];
    };

    // While animating, the body is computed at half resolution (it's softened anyway); the final
    // resting frame is computed at full resolution.
    const st = fast ? 2 : 1, img = fast ? imgHalf : imgFull, px8 = img.data;
    const grainAmt = .06 + .14 * h;
    for (let y = 0, o = 0; y < ch; y += st) {
      const dy = y - cy, grow = (y >> 1) * gw, vy = (y / ch - .5) * 2, crow = y * cw;
      for (let x = 0; x < cw; x += st, o += 4) {
        const dx = x - cx, u = (dx * cos + dy * sin) / rx, v = (dy * cos - dx * sin) / ry, e = Math.sqrt(u * u + v * v);
        const ki = Math.min(ELUT - 1, (e / 3 * ELUT) | 0), I = Math.min(1, eI[ki] * (.62 + .76 * clump[crow + x]));
        let t = eT[ki] + dx * gx + dy * gy; t = t < 0 ? 0 : t > 1 ? 1 : t;
        const pi = ((t * (PLUT - 1)) | 0) * 3, n = grain[grow + (x >> 1)];
        // Deeper rim all around the edge for the domed bead look.
        const vx = (x / cw - .5) * 2, r2 = vx * vx + vy * vy, rim = .75 * k * (r2 > .35 ? Math.min(1, (r2 - .35) / .9) : 0);
        const lum = 1 - grainAmt / 2 + n * grainAmt;
        let b0 = base[0], b1 = base[1], b2 = base[2];
        if (sh && n > .9) { const m = (n - .9) * 10; b0 += (sh[0] - b0) * m; b1 += (sh[1] - b1) * m; b2 += (sh[2] - b2) * m; }
        const c0 = (b0 + (pal[pi] - b0) * I) * lum, c1 = (b1 + (pal[pi + 1] - b1) * I) * lum, c2 = (b2 + (pal[pi + 2] - b2) * I) * lum;
        px8[o] = c0 + (shadow[0] - c0) * rim;
        px8[o + 1] = c1 + (shadow[1] - c1) * rim;
        px8[o + 2] = c2 + (shadow[2] - c2) * rim;
        px8[o + 3] = 255;
      }
    }
    bctx.putImageData(img, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.filter = `blur(${.8 * dpr}px)`;
    if (fast) ctx.drawImage(body, 0, 0, img.width, img.height, 0, 0, cw, ch); else ctx.drawImage(body, 0, 0);
    ctx.filter = "none";

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Flakes shift color with the viewing angle (the pointer), like iridescent foil.
    for (const f of flakes) {
      let t = (f.phase + cur.x * .5 + cur.y * .3) % 2; if (t > 1) t = 2 - t;
      const a = .42 + .38 * Math.sin(f.phase * 12 + cur.x * 5 + cur.y * 3);
      ctx.globalAlpha = a; ctx.fillStyle = palette(p.flakes, t);
      ctx.beginPath(); f.pts.forEach(([dx, dy], i) => i ? ctx.lineTo(f.x + dx, f.y + dy) : ctx.moveTo(f.x + dx, f.y + dy)); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = a * .5; ctx.strokeStyle = "rgba(255,240,200,.6)"; ctx.lineWidth = .4; ctx.stroke();
    }
    for (const g of glitter) {
      ctx.globalAlpha = .6 + .4 * Math.sin(g.b * 20 + cur.x * 6 - cur.y * 4) ** 2; ctx.fillStyle = shade(p.glitter, (g.b - .5) * .5);
      ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = g.rot + i * 1.047; i ? ctx.lineTo(g.x + Math.cos(a) * g.r, g.y + Math.sin(a) * g.r) : ctx.moveTo(g.x + Math.cos(a) * g.r, g.y + Math.sin(a) * g.r); }
      ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // Sparkles on top, crisp, tinted by the flash around them; bright near the flash, faint in the base.
    // Multicolored particles are painted over (not added) so each keeps its own hue instead of washing to white.
    ctx.globalCompositeOperation = spkCols ? "source-over" : "lighter";
    for (const [x, y, r, b, c] of sparkles) {
      const [I, t] = field(x * dpr, y * dpr), pi = ((t * (PLUT - 1)) | 0) * 3;
      const a = b * (spk.floor + (1 - spk.floor) * I) * (1 - .5 * k * Math.max(0, Math.hypot(x / W - .5, y / H - .5) * 2 - .6));
      if (a < .03) continue;
      const w = r > .5 ? .6 : spkCols ? 0 : .2; // bigger glints burn toward white at their core; colored particles stay saturated
      ctx.globalAlpha = Math.min(1, spkCols ? a * 1.2 : a); // colored particles read as distinct flecks
      let s0 = pal[pi], s1 = pal[pi + 1], s2 = pal[pi + 2];
      if (spkCols) { const q = spkCols[(c * spkCols.length) | 0], m = spk.mix; s0 += (q[0] - s0) * m; s1 += (q[1] - s1) * m; s2 += (q[2] - s2) * m; }
      ctx.fillStyle = `rgb(${s0 + (255 - s0) * w | 0},${s1 + (255 - s1) * w | 0},${s2 + (255 - s2) * w | 0})`;
      ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
      if (r > .5) { ctx.globalAlpha = a * .12; ctx.beginPath(); ctx.arc(x, y, r * 2.2, 0, 7); ctx.fill(); } // faint halo
    }
    ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
  }

  function tick() {
    cur.x += (target.x - cur.x) * .2; cur.y += (target.y - cur.y) * .2; cur.h += (target.h - cur.h) * .14;
    const moving = Math.abs(target.x - cur.x) + Math.abs(target.y - cur.y) + Math.abs(target.h - cur.h) > .002;
    draw(moving);
    raf = moving ? requestAnimationFrame(tick) : 0;
  }
  function aim(x, y, hh) {
    target.x = x; target.y = y; target.h = hh;
    if (!raf) raf = requestAnimationFrame(tick);
  }
  // Hovering moves the glow with the pointer. With no finish picked it also tightens into a cat eye;
  // with Glass bead or Cat eye picked it keeps that shape.
  cv.onpointermove = e => { const r = cv.getBoundingClientRect(); aim((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height, state.finish ? restH : 1); };
  cv.onpointerleave = () => aim(.5, .5, restH);
  cv.setFinish = () => { restH = finishH(); aim(.5, .5, restH); };
  cv.classList.add("interactive");
  draw();
}

/*
  Holographic swatch (linear holo). The polish is packed with tiny reflective particles over a
  metallic base. Most particles are dim copper; at any moment only some face the light, and those
  flash bright with rainbow color. Near the light the glints line up into a streak along the nail:
  warm white at the center, then orange, yellow, green, blue and violet outward on both sides.
  Elsewhere, glints are sparser and take random colors. The brightest ones bloom slightly.
  On hover the light follows the pointer and each particle turns on and off at its own angle,
  so the glints twinkle as you move.
  Optional in js/polishes.js: shadow (edge color), holo: { strength, width, angle }.
*/
function holoSwatch(cv, p, W, H) {
  const dpr = swatchDpr(W), cw = Math.round(W * dpr), ch = Math.round(H * dpr);
  cv.width = cw; cv.height = ch;
  const ctx = cv.getContext("2d", { willReadFrequently: true });
  const base = rgb(p.colors[0]), warm = rgb(shade(p.colors[0], .35)), shadow = rgb(p.shadow || shade(p.colors[0], -.35));
  const opt = { strength: 1, width: .09, angle: 1.15, ...p.holo };
  const R = rng(p.id || "p");

  // Particles about one CSS pixel each: brightness, hue jitter, the angle at which it catches the light, and size.
  const CELL = Math.max(2, Math.round(dpr)), gx = Math.ceil(cw / CELL), gy = Math.ceil(ch / CELL), N = gx * gy;
  const pb = new Float32Array(N), ph = new Float32Array(N), pa = new Float32Array(N), big = new Uint8Array(N);
  for (let i = 0; i < N; i++) { pb[i] = R(); ph[i] = R(); pa[i] = R(); big[i] = R() < .06 ? 1 : 0; }
  // Spectrum from the center of the streak outward, and a full wheel for stray glints.
  const SPEC = ["#fff4e2", "#ffb060", "#ffe84a", "#6cf07a", "#40c8ff", "#5a6cff", "#c060ff"];
  const RAIN = 256, rain = new Float32Array(RAIN * 3), wheel = new Float32Array(RAIN * 3);
  for (let i = 0; i < RAIN; i++) {
    rain.set(rgb(palette(SPEC, i / (RAIN - 1))), i * 3);
    const h = i / RAIN * 6, x = 1 - Math.abs(h % 2 - 1), [r, g, b] = h < 1 ? [1, x, 0] : h < 2 ? [x, 1, 0] : h < 3 ? [0, 1, x] : h < 4 ? [0, x, 1] : h < 5 ? [x, 0, 1] : [1, 0, x];
    wheel.set([70 + 185 * r, 70 + 185 * g, 70 + 185 * b], i * 3);
  }
  const img = ctx.createImageData(cw, ch), px = img.data;
  const rest = { x: .45, y: .45 }, cur = { ...rest }, target = { ...rest };
  const blooms = [];
  let raf = 0;

  function draw() {
    const lx = cur.x, ly = cur.y * H / W, rot = opt.angle + (cur.x - .5) * .4, cos = Math.cos(rot), sin = Math.sin(rot);
    const turn = cur.x * 2.3 + cur.y * 1.7; // moving the light turns every particle's facet a little
    blooms.length = 0;
    for (let cy = 0; cy < gy; cy++) {
      const ny = (cy + .5) * CELL / cw, vy = ((cy + .5) * CELL / ch - .5) * 2;
      for (let cx = 0; cx < gx; cx++) {
        const i = cy * gx + cx, b = pb[i], nx = (cx + .5) * CELL / cw;
        const dx = nx - lx, dy = ny - ly, u = dx * cos + dy * sin, v = -dx * sin + dy * cos; // u along the streak, v across it
        const along = Math.exp(-u * u * 7), across = Math.abs(v) / opt.width, streak = along * Math.exp(-across * across / 9);
        // Dim metallic base, a little warmer near the light.
        const glow = Math.exp(-(u * u * 3 + v * v * 40));
        const lum = .72 + b * .28;
        let r = (base[0] + (warm[0] - base[0]) * glow * .6) * lum, g = (base[1] + (warm[1] - base[1]) * glow * .6) * lum, bl = (base[2] + (warm[2] - base[2]) * glow * .6) * lum;
        // Is this particle facing the light right now? Sharp peak, so only some are lit at a time.
        const f = Math.sin((pa[i] + turn) * 6.283), face = f > 0 ? f ** 10 : 0;
        const lit = face * (.25 + .75 * Math.min(1, streak * 1.6 + glow * .5)) * opt.strength;
        if (lit > .02) {
          // Color: position across the streak near the light, random elsewhere; near the center it's almost white.
          const k = ((Math.max(0, Math.min(1, across / 3 + (ph[i] - .5) * .15)) * (RAIN - 1)) | 0) * 3, w = ((ph[i] * RAIN) | 0) * 3;
          const m = Math.min(1, streak * 1.8);
          const c0 = rain[k] * m + wheel[w] * (1 - m), c1 = rain[k + 1] * m + wheel[w + 1] * (1 - m), c2 = rain[k + 2] * m + wheel[w + 2] * (1 - m);
          const a = Math.min(1, lit * 1.4);
          r += (c0 * 1.05 - r) * a; g += (c1 * 1.05 - g) * a; bl += (c2 * 1.05 - bl) * a;
          if (lit > .5 || (big[i] && lit > .25)) blooms.push((cx + .5) * CELL / dpr, (cy + .5) * CELL / dpr, c0, c1, c2, lit, big[i]);
        }
        // Hot spot where the light reflects.
        const hot = Math.exp(-(u * u * 60 + v * v * 300)) * .6;
        r += (255 - r) * hot; g += (246 - g) * hot; bl += (232 - bl) * hot;
        const vx = (nx - .5) * 2, r2 = vx * vx + vy * vy, rim = r2 > .5 ? Math.min(1, (r2 - .5) / 1.1) * .45 : 0;
        r += (shadow[0] - r) * rim; g += (shadow[1] - g) * rim; bl += (shadow[2] - bl) * rim;
        const x0 = cx * CELL, y0 = cy * CELL, x1 = Math.min(cw, x0 + CELL), y1 = Math.min(ch, y0 + CELL);
        for (let y = y0; y < y1; y++) for (let x = x0, o = (y * cw + x0) * 4; x < x1; x++, o += 4) { px[o] = r; px[o + 1] = g; px[o + 2] = bl; px[o + 3] = 255; }
      }
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.putImageData(img, 0, 0);
    // Bloom: the brightest glints get a crisp core and a soft halo, and the big flakes look bigger.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = "lighter";
    for (let j = 0; j < blooms.length; j += 7) {
      const x = blooms[j], y = blooms[j + 1], lit = blooms[j + 5], isBig = blooms[j + 6];
      const col = `rgb(${blooms[j + 2] | 0},${blooms[j + 3] | 0},${blooms[j + 4] | 0})`;
      ctx.fillStyle = col;
      ctx.globalAlpha = .1 * lit; ctx.beginPath(); ctx.arc(x, y, isBig ? 3.2 : 2.2, 0, 7); ctx.fill();
      ctx.globalAlpha = .45 * lit; ctx.beginPath(); ctx.arc(x, y, isBig ? 1.2 : .75, 0, 7); ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
  }

  function tick() {
    cur.x += (target.x - cur.x) * .2; cur.y += (target.y - cur.y) * .2;
    draw();
    raf = Math.abs(target.x - cur.x) + Math.abs(target.y - cur.y) > .002 ? requestAnimationFrame(tick) : 0;
  }
  function aim(x, y) { target.x = x; target.y = y; if (!raf) raf = requestAnimationFrame(tick); }
  cv.onpointermove = e => { const r = cv.getBoundingClientRect(); aim((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height); };
  cv.onpointerleave = () => aim(rest.x, rest.y);
  cv.classList.add("interactive");
  draw();
}

/*
  Thermal swatch. Thermal polish changes color with temperature: colors = [cold, warm]. At rest it
  shows the in-between state real nails sit in: the thin tip (top) stays cold and dark while the
  area near the cuticle (bottom) is warm and light, and the change between them is streaky, like
  brush strokes, rather than a clean fade. The gradient runs diagonally across the swatch. Hovering changes the temperature
  of the whole nail: toward the top-left it goes colder and darker, toward the bottom-right warmer
  and lighter.
  Optional in js/polishes.js: thermal: { rest, streaks } where rest (0 to 1) moves the resting
  line down (colder) or up (warmer) and streaks sets how brushy the transition is; flakes (list of
  colors, shifting with temperature) and shimmer (one color of fine sparkle) suspended in the polish.
*/
function thermalSwatch(cv, p, W, H) {
  const dpr = swatchDpr(W), cw = Math.round(W * dpr), ch = Math.round(H * dpr);
  cv.width = cw; cv.height = ch;
  const ctx = cv.getContext("2d");
  const cold = rgb(p.colors[0]), warm = rgb(p.colors[1] || shade(p.colors[0], .5));
  const opt = { rest: .5, streaks: 1, ...p.thermal };
  const R = rng(p.id || "p");

  // Work on a coarse grid of heat (one cell per 2 CSS pixels) and let the canvas smooth it when scaled up.
  const gw = Math.ceil(W / 2), gh = Math.ceil(H / 2), N = gw * gh;
  const small = document.createElement("canvas"); small.width = gw; small.height = gh;
  const sctx = small.getContext("2d"), img = sctx.createImageData(gw, gh), px = img.data;
  const tmp = new Uint8ClampedArray(px.length);
  // Brush streaks: slow random variation across the width, stretched top to bottom.
  const streak = new Float32Array(N);
  { const cols = Math.ceil(gw / 7) + 2, rows = 5, lat = Array.from({ length: cols * rows }, () => R() - .5);
    for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
      const fx = x / 7, ix = fx | 0, tx = fx - ix, fy = y / gh * (rows - 2), iy = fy | 0, ty = fy - iy;
      const a = lat[iy * cols + ix] + (lat[iy * cols + ix + 1] - lat[iy * cols + ix]) * tx;
      const b = lat[(iy + 1) * cols + ix] + (lat[(iy + 1) * cols + ix + 1] - lat[(iy + 1) * cols + ix]) * tx;
      streak[y * gw + x] = (a + (b - a) * ty) * .05 * opt.streaks;
    } }

  // Glossy top coat, drawn once: the soft reflection of a large light (like a window) on the
  // curved surface, plus a slight darkening at the very edges where the curve turns away from the
  // light. The reflection is a radial gradient squashed into an ellipse, so its edges are soft by
  // construction (canvas blur filters aren't supported in Safari).
  const gloss = document.createElement("canvas"); gloss.width = cw; gloss.height = ch;
  { const g = gloss.getContext("2d"); g.scale(dpr, dpr);
    g.translate(W * .3, H * .3); g.rotate(-.2); g.scale(1, 2.1);
    const rg = g.createRadialGradient(0, 0, 0, 0, 0, W * .26);
    rg.addColorStop(0, "rgba(255,236,255,.24)"); rg.addColorStop(.45, "rgba(255,236,255,.12)"); rg.addColorStop(1, "rgba(255,236,255,0)");
    g.fillStyle = rg; g.fillRect(-W, -H, W * 2, H * 2); }
  // Optional suspended bits, fixed in the polish: flakes (iridescent, shifting color with temperature)
  // and shimmer (fine sparkle of one color).
  const flakes = p.flakes ? Array.from({ length: Math.round(W * H / 420) }, () => {
    const r = 1.5 + Math.pow(R(), 2) * 4.5, n = 5 + ((R() * 3) | 0), rot = R() * 6.3;
    return { x: R() * W, y: R() * H, phase: R(), pts: Array.from({ length: n }, (_, i) => {
      const a = rot + i / n * 6.283, rr = r * (.55 + R() * .6); return [Math.cos(a) * rr, Math.sin(a) * rr]; }) };
  }) : [];
  const shimmer = p.shimmer ? Array.from({ length: Math.round(W * H / 40) }, () => [R() * W, R() * H, .3 + R() * .5, R()]) : [];
  const shimCol = p.shimmer || "#fff";
  // Edges darken slightly where the curve turns away from the light.
  const edge = ctx.createRadialGradient(cw / 2, ch / 2, Math.min(cw, ch) * .42, cw / 2, ch / 2, Math.max(cw, ch) * .75);
  // Tinted with the polish's own cold shade rather than black, so light polishes stay bright and clean.
  const ec = rgb(shade(p.colors[0], -.25)); edge.addColorStop(0, `rgba(${ec},0)`); edge.addColorStop(1, `rgba(${ec},.22)`);
  let raf = 0;

  function draw() {
    for (let y = 0, i = 0; y < gh; y++) {
      for (let x = 0; x < gw; x++, i++) {
        // Diagonal: coldest at the top-left tip corner, warmest toward the bottom-right.
        const t = (x / (gw - 1) + y / (gh - 1)) / 2;
        const T = t - (1 - opt.rest) + .5 + streak[i] + temp.cur;
        let f = (T + .05) / .95; f = f < 0 ? 0 : f > 1 ? 1 : f * f * f * (f * (6 * f - 15) + 10); // smootherstep over a wide band
        // Jelly depth: a touch darker toward the sides.
        const vx = (x / gw - .5) * 2, shadeK = 1 - .08 * vx * vx;
        px[i * 4] = (cold[0] + (warm[0] - cold[0]) * f) * shadeK;
        px[i * 4 + 1] = (cold[1] + (warm[1] - cold[1]) * f) * shadeK;
        px[i * 4 + 2] = (cold[2] + (warm[2] - cold[2]) * f) * shadeK;
        px[i * 4 + 3] = 255;
      }
    }
    // Extra softening so the gradient reads as one smooth pour: a small box blur on the grid itself
    // (done in code rather than with a canvas filter so it looks the same in Safari).
    for (let pass = 0; pass < 2; pass++) {
      tmp.set(px);
      for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
        let r = 0, g = 0, b = 0, n = 0;
        for (let yy = Math.max(0, y - 2); yy <= Math.min(gh - 1, y + 2); yy++)
          for (let xx = Math.max(0, x - 2); xx <= Math.min(gw - 1, x + 2); xx++) { const o = (yy * gw + xx) * 4; r += tmp[o]; g += tmp[o + 1]; b += tmp[o + 2]; n++; }
        const o = (y * gw + x) * 4; px[o] = r / n; px[o + 1] = g / n; px[o + 2] = b / n;
      }
    }
    sctx.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
    ctx.drawImage(small, 0, 0, cw, ch);
    ctx.globalCompositeOperation = "screen"; ctx.drawImage(gloss, 0, 0); ctx.globalCompositeOperation = "source-over"; // screen keeps the shine luminous, not grey
    ctx.fillStyle = edge; ctx.fillRect(0, 0, cw, ch);
    if (flakes.length || shimmer.length) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = shimCol;
      for (const [x, y, r, b] of shimmer) { ctx.globalAlpha = .25 + .45 * b; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); }
      for (const f of flakes) {
        let t = (f.phase + temp.cur * .6 + 2) % 2; if (t > 1) t = 2 - t;
        ctx.globalAlpha = .6 + .3 * Math.sin(f.phase * 12 + temp.cur * 4);
        ctx.fillStyle = palette(p.flakes, t);
        ctx.beginPath(); f.pts.forEach(([dx, dy], i) => i ? ctx.lineTo(f.x + dx, f.y + dy) : ctx.moveTo(f.x + dx, f.y + dy)); ctx.closePath(); ctx.fill();
      }
      ctx.globalAlpha = 1; ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
  }

  // Hover sets the temperature of the whole nail: toward the top-left it cools (darker), toward the
  // bottom-right it warms (lighter). Moving off returns it to the resting gradient.
  const temp = { cur: 0, target: 0 };
  function tick() {
    temp.cur += (temp.target - temp.cur) * .12;
    draw();
    raf = Math.abs(temp.target - temp.cur) > .002 ? requestAnimationFrame(tick) : 0;
  }
  const wake = () => { if (!raf) raf = requestAnimationFrame(tick); };
  cv.onpointermove = e => { const r = cv.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height; temp.target = ((x + y) / 2 - .5) * 1.8; wake(); };
  cv.onpointerleave = () => { temp.target = 0; wake(); };
  cv.classList.add("interactive");
  draw();
}

/*
  Multichrome swatch (non-magnetic). The color depends on the angle you see the surface at, and a
  nail curves across its width, so the colors run in bands down its length: the part facing you
  shows the first color, and the sides, turning away, shift through the rest of the list. It is
  packed with fine shimmer, like a metallic. Hovering tilts the nail: left and right move where the
  facing band sits, up and down slide the whole range of colors, so it shifts like turning your hand.
  colors = [facing, ..., edge]. Optional in js/polishes.js: shadow (edge color), chrome: { spread, jitter,
  along, base }: how far the colors spread, how much each particle varies, how much they drift along
  the length, how dark the base between particles is (lower is darker), and grain (particle size in
  CSS pixels).
*/
function multichromeSwatch(cv, p, W, H) {
  const dpr = swatchDpr(W), cw = Math.round(W * dpr), ch = Math.round(H * dpr);
  cv.width = cw; cv.height = ch;
  const ctx = cv.getContext("2d", { willReadFrequently: true });
  const opt = { spread: 1, jitter: .22, along: .3, base: .55, grain: 1.7, ...p.chrome };
  const shadow = rgb(p.shadow || shade(p.colors[p.colors.length - 1], -.55));
  const R = rng(p.id || "p");
  const PL = 256, pal = new Float32Array(PL * 3);
  for (let i = 0; i < PL; i++) pal.set(rgb(palette(p.colors, i / (PL - 1))), i * 3);

  // Shimmer particles about grain CSS pixels across, each a little brighter or darker and nudged in hue.
  const CELL = Math.max(2, Math.round(dpr * opt.grain)), gx = Math.ceil(cw / CELL), gy = Math.ceil(ch / CELL), N = gx * gy;
  const pb = new Float32Array(N), ph = new Float32Array(N);
  for (let i = 0; i < N; i++) { pb[i] = R(); ph[i] = R() - .5; }
  const img = ctx.createImageData(cw, ch), px = img.data;
  const rest = { x: .5, y: .5 }, cur = { ...rest }, target = { ...rest };
  let raf = 0;

  function draw() {
    const axis = .5 + (cur.x - .5) * .7;          // where the facing band sits
    const shift = (cur.y - .5) * .5;               // slide the whole range of colors
    for (let cy = 0; cy < gy; cy++) {
      const ny = (cy + .5) / gy, dome = (ny - .5) * (ny - .5) * .6; // the nail also curves top to bottom, so bands bend near the ends
      const along = (.5 - ny) * opt.along; // colors drift along the length (e.g. greener toward the tip)
      for (let cx = 0; cx < gx; cx++) {
        const i = cy * gx + cx, nx = (cx + .5) / gx;
        // Angle of the surface: 0 facing you, 1 at the far edge of the curve.
        const u = Math.min(1, Math.abs(nx - axis) / .62), ang = Math.sqrt(u * u + dome);
        let t = ang * opt.spread + shift + along + ph[i] * opt.jitter; // each particle catches a slightly different angle
        t = t < 0 ? -t : t; t = t > 1 ? 1 : t;           // colors mirror on both sides of the facing band
        const k = ((t * (PL - 1)) | 0) * 3;
        // Metallic light: brightest where the surface faces you, darker toward the edges; shimmer on top.
        // Particles over a dark base: most are dim, some bright, so it reads as dense metallic shimmer with depth.
        const light = .64 + .5 * Math.exp(-ang * ang * 3), sparkle = pb[i] > .97 ? (pb[i] - .97) * 20 : 0;
        const g = light * (opt.base + pb[i] * pb[i] * (1.25 - opt.base));
        let r = pal[k] * g, gg = pal[k + 1] * g, bl = pal[k + 2] * g;
        r += (255 - r) * sparkle * .5; gg += (255 - gg) * sparkle * .5; bl += (255 - bl) * sparkle * .5;
        const edge = Math.max(0, u - .8) * 2.5;          // falls into shadow right at the rim
        r += (shadow[0] - r) * edge; gg += (shadow[1] - gg) * edge; bl += (shadow[2] - bl) * edge;
        const x0 = cx * CELL, y0 = cy * CELL, x1 = Math.min(cw, x0 + CELL), y1 = Math.min(ch, y0 + CELL);
        for (let y = y0; y < y1; y++) for (let x = x0, o = (y * cw + x0) * 4; x < x1; x++, o += 4) { px[o] = r; px[o + 1] = gg; px[o + 2] = bl; px[o + 3] = 255; }
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  function tick() {
    cur.x += (target.x - cur.x) * .15; cur.y += (target.y - cur.y) * .15;
    draw();
    raf = Math.abs(target.x - cur.x) + Math.abs(target.y - cur.y) > .002 ? requestAnimationFrame(tick) : 0;
  }
  function aim(x, y) { target.x = x; target.y = y; if (!raf) raf = requestAnimationFrame(tick); }
  cv.onpointermove = e => { const r = cv.getBoundingClientRect(); aim((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height); };
  cv.onpointerleave = () => aim(rest.x, rest.y);
  cv.classList.add("interactive");
  draw();
}

/* ---------- state ---------- */
const $ = s => document.querySelector(s);
const KEY = { combos: "polish-shelf:combos", bench: "polish-shelf:bench" };
function load(key, fallback) { try { const v = JSON.parse(localStorage.getItem(key)); return v ?? fallback; } catch (e) { return fallback; } }
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); }
  catch (e) { toast("Couldn't save. Your browser storage may be full."); }
}
function newId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

// Polishes come from js/polishes.js; combos and the bench are saved in this browser.
const state = { polishes: typeof POLISHES !== "undefined" ? POLISHES : [], combos: load(KEY.combos, []), fx: new Set(), finish: null };
const bench = { layers: load(KEY.bench, []) };
const saveCombos = () => save(KEY.combos, state.combos);
const saveBench = () => save(KEY.bench, bench.layers);

function toast(msg) { const t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => t.hidden = true, 2600); }

/* ---------- shelf ---------- */
// How magnetic swatches rest: 0 = glass bead, 1 = cat eye, in between when no finish pill is picked.
function finishH() { return state.finish === "bead" ? 0 : state.finish === "cat" ? 1 : .5; }
function buildFinishPills() {
  const box = $("#finishPills");
  [["bead", "Glass bead"], ["cat", "Cat eye"]].forEach(([k, label]) => {
    const b = document.createElement("button"); b.type = "button"; b.className = "pill"; b.textContent = label; b.setAttribute("aria-pressed", "false");
    b.onclick = () => {
      state.finish = state.finish === k ? null : k;
      box.querySelectorAll(".pill").forEach((x, i) => x.setAttribute("aria-pressed", state.finish === ["bead", "cat"][i]));
      document.querySelectorAll(".swatch").forEach(cv => cv.setFinish && cv.setFinish());
    };
    box.appendChild(b);
  });
}

function buildPills() {
  const used = state.polishes.flatMap(effectsOf).filter(k => EFFECTS[k] && !PILL_EFFECTS.includes(k));
  const box = $("#fxPills");
  [...new Set([...PILL_EFFECTS, ...used])].forEach(k => {
    const b = document.createElement("button"); b.type = "button"; b.className = "pill"; b.textContent = EFFECTS[k]; b.setAttribute("aria-pressed", "false");
    b.dataset.fx = k; b.onclick = () => toggleFx(k);
    box.appendChild(b);
  });
}

function toggleFx(k) {
  state.fx.has(k) ? state.fx.delete(k) : state.fx.add(k);
  document.querySelectorAll("#fxPills .pill").forEach(b => b.setAttribute("aria-pressed", state.fx.has(b.dataset.fx)));
  renderShelf();
}
// A polish's rendering uses `effect`; `effects` (optional) lists everything it should be found under.
function effectsOf(p) { return p.effects || [p.effect]; }

const HEART = `<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="M10 17.92c4.48-3.06 8.96-6.8 8.96-11.32 0-1.16-.44-2.31-1.31-3.19a4.42 4.42 0 0 0-3.17-1.33c-1.15 0-2.3.44-3.17 1.33L10 4.73 8.69 3.41a4.42 4.42 0 0 0-3.17-1.33c-1.15 0-2.3.44-3.17 1.33a4.51 4.51 0 0 0-1.31 3.19c0 4.52 4.48 8.26 8.96 11.32Z" stroke="currentColor" stroke-width="1.25"/></svg>`;

function emptyMsg(title, body) { return `<div class="empty"><strong>${title}</strong>${body}</div>`; }

function renderShelf() {
  const grid = $("#grid"); grid.innerHTML = "";
  if (!state.polishes.length) { grid.innerHTML = emptyMsg("Your shelf is empty", "Add your polishes to js/polishes.js and they will show up here."); return; }
  const list = state.polishes.filter(p => !state.fx.size || effectsOf(p).some(k => state.fx.has(k)));
  if (!list.length) { grid.innerHTML = emptyMsg("No matches", "No polishes with that effect yet."); return; }
  for (const p of list) {
    const card = document.createElement("article"); card.className = "card";
    const wrap = document.createElement("div"); wrap.className = "swatch-wrap";
    const sw = document.createElement("canvas"); sw.className = "swatch";
    const add = document.createElement("button"); add.type = "button"; add.className = "swatch-btn"; add.innerHTML = HEART; add.dataset.pid = p.id;
    add.setAttribute("aria-label", `Add ${p.name} to layers`); add.title = "Add to layers";
    add.classList.toggle("on", bench.layers.some(l => l.pid === p.id));
    add.onclick = () => addLayer(p);
    wrap.append(sw, add);
    sw.tabIndex = 0; sw.setAttribute("role", "button"); sw.setAttribute("aria-label", `View ${p.name}`);
    sw.onclick = () => openDetail(p, wrap);
    sw.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openDetail(p, wrap); } };
    const text = document.createElement("div"); text.className = "card-text";
    const title = document.createElement("div"); title.className = "card-title";
    const br = document.createElement("p"); br.className = "brand"; br.textContent = p.brand || ""; br.title = br.textContent;
    const nm = document.createElement("p"); nm.className = "name"; nm.textContent = p.name || "Untitled"; nm.title = nm.textContent;
    title.append(br, nm);
    const fx = document.createElement("div"); fx.className = "card-fx";
    effectsOf(p).forEach(k => {
      const b = document.createElement("button"); b.type = "button"; b.className = "pill tiny"; b.textContent = EFFECTS[k] || k;
      b.setAttribute("aria-pressed", state.fx.has(k)); b.onclick = () => toggleFx(k);
      fx.appendChild(b);
    });
    text.append(title, fx);
    card.append(wrap, text); grid.appendChild(card);
    sw._p = p; drawCard(sw);
  }
}

/* ---------- detail view ---------- */
// Tapping a swatch opens it large over a blurred shelf, with a gallery of the product photos below.
// The first gallery item is the swatch itself; the link button opens the product page.
const detail = { p: null, card: null, cv: null };
const EASE = "cubic-bezier(.2, .8, .2, 1)";

function openDetail(p, card) {
  detail.p = p; detail.card = card;
  $("#mBrand").textContent = p.brand || "";
  $("#mName").textContent = p.name || "Untitled";
  const link = $("#mLink");
  link.hidden = !p.url; if (p.url) link.href = p.url;

  // Show the dialog first so the swatch can be drawn at the size it will actually appear.
  const m = $("#modal"); m.hidden = false; document.body.style.overflow = "hidden"; document.body.classList.add("detail-open");
  sizeDetail();
  const stage = $("#mStage"); stage.innerHTML = "";
  const cv = document.createElement("canvas"); cv.className = "swatch";
  stage.appendChild(cv); detail.cv = cv;
  const sr = stage.getBoundingClientRect();
  renderSwatch(cv, p, Math.round(sr.width), Math.round(sr.height));

  // Gallery: the swatch first, then the saved photos.
  const car = $("#mCarousel"); car.innerHTML = "";
  const thumb = document.createElement("button"); thumb.type = "button"; thumb.className = "m-thumb"; thumb.setAttribute("aria-label", "Swatch");
  const tc = document.createElement("canvas"); tc.width = 167; tc.height = 160;
  // Cover-crop the swatch into the thumbnail.
  const sx = cv.width * .04, sw = cv.width * .92, sh = sw * 160 / 167, sy = (cv.height - sh) / 2;
  tc.getContext("2d").drawImage(cv, sx, sy, sw, sh, 0, 0, 167, 160);
  thumb.appendChild(tc); thumb.onclick = () => show(null); car.appendChild(thumb);
  (p.photos || []).slice(0, 4).forEach((src, i) => {
    const b = document.createElement("button"); b.type = "button"; b.className = "m-thumb"; b.setAttribute("aria-label", `Photo ${i + 1}`);
    const im = document.createElement("img"); im.src = src; im.alt = ""; im.loading = "lazy";
    b.appendChild(im); b.onclick = () => show(src); car.appendChild(b);
  });

  // Grow the swatch out of its card.
  const from = card.getBoundingClientRect(), to = stage.getBoundingClientRect();
  stage.style.transition = "none";
  stage.style.transformOrigin = "0 0";
  stage.style.transform = `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width}, ${from.height / to.height})`;
  stage.style.borderRadius = `${48 * to.width / from.width}px`;
  m.classList.remove("open"); void m.offsetWidth;
  stage.style.transition = `transform .45s ${EASE}, border-radius .45s ${EASE}`;
  stage.style.transform = ""; stage.style.borderRadius = "";
  m.classList.add("open");
  card.style.visibility = "hidden";
  m.focus({ preventScroll: true }); // keyboard focus moves into the dialog (Tab reaches the buttons)
}

// The gallery area starts below the header, whose height depends on the text; measure it.
function sizeDetail() { $("#modal").style.setProperty("--head", $(".modal-head").offsetHeight + "px"); }
addEventListener("resize", () => { if (!$("#modal").hidden) sizeDetail(); });

function show(src) {
  const stage = $("#mStage"); stage.querySelector("img")?.remove();
  if (src) { const im = document.createElement("img"); im.src = src; im.alt = `${detail.p.name} photo`; stage.appendChild(im); }
}

function closeDetail() {
  const m = $("#modal"); if (m.hidden) return;
  const stage = $("#mStage"), card = detail.card;
  const done = () => { m.hidden = true; m.classList.remove("open"); stage.style.transform = ""; document.body.style.overflow = ""; if (card) card.style.visibility = ""; };
  m.classList.remove("open"); document.body.classList.remove("detail-open");
  if (card && card.isConnected) {
    show(null);
    const from = stage.getBoundingClientRect(), to = card.getBoundingClientRect();
    stage.style.transform = `translate(${to.left - from.left}px, ${to.top - from.top}px) scale(${to.width / from.width}, ${to.height / from.height})`;
    stage.style.borderRadius = `${48 * from.width / to.width}px`;
    setTimeout(done, 450);
  } else done();
}
$("#mClose").onclick = closeDetail;
document.addEventListener("keydown", e => { if (e.key === "Escape") closeDetail(); });

/* ---------- layering bench ---------- */
function polishById(id) { return state.polishes.find(p => p.id === id); }
function liveLayers(layers) { return layers.map(l => ({ ...l, polish: polishById(l.pid) })).filter(l => l.polish); }
function setBenchOpen(open) { $("#bench").hidden = !open; $("#layout").classList.toggle("closed", !open); }
$("#closeBench").onclick = () => setBenchOpen(false);

function addLayer(p) {
  const wasHidden = $("#bench").hidden;
  setBenchOpen(true);
  if (wasHidden && innerWidth <= 760) setTimeout(() => $("#bench").scrollIntoView({ block: "start" }), 0);
  // Toppers look right with one coat; everything else defaults to two.
  bench.layers.push({ pid: p.id, coats: ["glitter", "flakies", "chrome"].includes(p.effect) ? 1 : 2 });
  saveBench(); renderBench();
  toast(`Added ${p.name || "polish"} as layer ${bench.layers.length}`);
}
function move(i, d) { const a = bench.layers; [a[i], a[i + d]] = [a[i + d], a[i]]; saveBench(); renderBench(); }

// Swatch buttons show filled while that polish is on the bench.
function syncSwatchButtons() {
  document.querySelectorAll(".swatch-btn").forEach(b => b.classList.toggle("on", bench.layers.some(l => l.pid === b.dataset.pid)));
}

function renderBench() {
  syncSwatchButtons();
  renderNail($("#bigNail"), liveLayers(bench.layers), { W: 240, H: 320, finger: true });
  const ol = $("#layers"); ol.innerHTML = "";
  if (!bench.layers.length) { ol.innerHTML = `<li class="hint">Nothing layered yet. Press “Add to layers” on a polish to start with a base color, then add effects on top.</li>`; return; }
  bench.layers.forEach((l, i) => {
    const p = polishById(l.pid);
    const li = document.createElement("li"); li.className = "layer";
    const num = document.createElement("span"); num.className = "n"; num.textContent = String(i + 1).padStart(2, "0");
    const nm = document.createElement("div"); nm.className = "nm"; nm.textContent = p ? (p.name || "Untitled") : "Removed polish";
    const sm = document.createElement("small"); sm.textContent = p ? (EFFECTS[p.effect] || "Creme") : "No longer on your shelf"; nm.appendChild(sm);
    const acts = document.createElement("div"); acts.className = "acts";
    const mk = (txt, label, fn, dis) => { const b = document.createElement("button"); b.type = "button"; b.className = "icon"; b.textContent = txt; b.setAttribute("aria-label", label); b.disabled = !!dis; b.onclick = fn; return b; };
    acts.append(
      mk("↑", "Move earlier", () => move(i, -1), i === 0),
      mk("↓", "Move later", () => move(i, 1), i === bench.layers.length - 1),
      mk("×", "Remove layer", () => { bench.layers.splice(i, 1); saveBench(); renderBench(); })
    );
    li.append(num, nm, acts);
    if (p) {
      const ctl = document.createElement("div"); ctl.className = "ctl";
      const cl = document.createElement("label"); cl.textContent = "Coats ";
      const cs = document.createElement("select");
      [1, 2, 3].forEach(v => { const o = document.createElement("option"); o.value = v; o.textContent = v; if (v === (l.coats || 2)) o.selected = true; cs.appendChild(o); });
      cs.onchange = () => { l.coats = +cs.value; saveBench(); renderBench(); };
      cl.appendChild(cs); ctl.appendChild(cl); li.appendChild(ctl);
    }
    ol.appendChild(li);
  });
}

function renderCombos() {
  const box = $("#combos"); box.innerHTML = "";
  if (!state.combos.length) { box.innerHTML = `<p class="hint">Combos you save show up here so you can pull them back onto the bench.</p>`; return; }
  [...state.combos].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")).forEach(c => {
    const row = document.createElement("div"); row.className = "combo";
    const loadBtn = document.createElement("button"); loadBtn.type = "button"; loadBtn.className = "load";
    const cv = document.createElement("canvas");
    const txt = document.createElement("span"); txt.textContent = c.name || "Untitled combo";
    const names = c.layers.map(l => polishById(l.pid)?.name).filter(Boolean);
    const sm = document.createElement("small"); sm.textContent = names.join(" + ") || "Polishes no longer on your shelf"; txt.appendChild(sm);
    loadBtn.append(cv, txt);
    loadBtn.onclick = () => { bench.layers = c.layers.map(l => ({ ...l })); saveBench(); renderBench(); toast(`Loaded ${c.name || "combo"}`); };
    const del = document.createElement("button"); del.type = "button"; del.className = "icon"; del.textContent = "×"; del.setAttribute("aria-label", "Delete combo " + (c.name || ""));
    // Two presses to delete, so a stray click doesn't lose a combo.
    del.onclick = () => {
      if (!del.dataset.armed) { del.dataset.armed = "1"; del.textContent = "✓"; del.setAttribute("aria-label", "Confirm delete"); setTimeout(() => { del.dataset.armed = ""; del.textContent = "×"; }, 3000); return; }
      state.combos = state.combos.filter(x => x.id !== c.id); saveCombos(); renderCombos(); toast("Combo deleted");
    };
    row.append(loadBtn, del); box.appendChild(row);
    renderNail(cv, liveLayers(c.layers), { W: 34, H: 48 });
  });
}

$("#saveCombo").onclick = () => {
  if (!bench.layers.length) { toast("Add at least one layer first"); return; }
  const name = $("#comboName").value.trim() || `Combo ${state.combos.length + 1}`;
  state.combos.push({ id: newId(), name, layers: bench.layers.map(({ pid, coats }) => ({ pid, coats: coats || 2 })), createdAt: new Date().toISOString() });
  saveCombos(); renderCombos();
  $("#comboName").value = ""; toast(`Saved ${name}`);
};

/* ---------- grid fit ---------- */
// Fill the full width: use the column count whose cards come closest to the breakpoint size, then
// size the cards to exactly fill the row (never above 1.4x the design, 336px). Phones use CSS.
const GAP = 40, MAX_CARD = 336;
// Card swatches are drawn at the size they're actually shown (cards grow on bigger screens), so they
// stay sharp instead of being stretched.
function drawCard(cv) {
  const w = Math.round(cv.parentElement.clientWidth) || 240;
  cv._w = w; renderSwatch(cv, cv._p, w, Math.round(w * 260 / 240));
}
let redrawTimer = 0;
function redrawCards() {
  clearTimeout(redrawTimer);
  redrawTimer = setTimeout(() => document.querySelectorAll("#grid .swatch").forEach(cv => {
    if (Math.abs(cv.parentElement.clientWidth - cv._w) > 2) drawCard(cv);
  }), 150);
}

function fitGrid() {
  const grid = $("#grid");
  if (innerWidth <= 600) { grid.style.removeProperty("--card"); redrawCards(); return; }
  const base = parseFloat(getComputedStyle(grid).getPropertyValue("--card-base")) || 240, avail = grid.clientWidth;
  const n = Math.max(1, Math.round((avail + GAP) / (base + GAP)));
  const card = Math.min(MAX_CARD, (avail - (n - 1) * GAP) / n);
  grid.style.setProperty("--card", Math.floor(card) + "px");
  redrawCards();
}
new ResizeObserver(fitGrid).observe($("#grid"));

/* ---------- boot ---------- */
buildPills();
buildFinishPills();
renderShelf();
renderBench();
renderCombos();
