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
  glow:      "Glow in the dark",
  powder:    "Chrome powder",
};
// Some effects share a category (one filter pill and one card label): chrome counts as multichrome
// (which has no category of its own; see effectsOf), glitter as Shimmer, and sheer magnetic as Magnetic
// (sheer magnetic polishes list both Sheer and Magnetic in their effects). Swatches still draw by the
// polish's own effect.
const CATEGORY = { chrome: "multichrome", glitter: "shimmer", sheermag: "magnetic" };
const category = k => CATEGORY[k] || k;
// Filter pills always shown, in this order; other effects get a pill once a polish uses them.
const PILL_EFFECTS = ["sheer", "magnetic", "holo", "shimmer"];
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
    case "sheermag":
    case "magnetic": {
      // colors = [base, ...flash]; several flash colors make a multichrome that shifts from the band's core to its edges.
      // Sheer magnetic lets the layer underneath show through the base.
      fill(c[0], coat(p.effect === "sheermag" ? .4 : .75, n));
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

// Close-up of one polish filling the whole card, like a zoomed-in photo of a painted nail.
// Drawn at 3x pixel density so it stays sharp on retina screens.
// Card swatches use the screen's pixel density (at least 2x, at most 3x); the big swatch in the detail
// view uses 2x to stay smooth while animating.
function swatchDpr(W) { return W > 400 ? 2 : Math.min(3, Math.max(2, window.devicePixelRatio || 1)); }

function renderSwatch(cv, p, W, H) {
  if (p.effect === "powder") return powderSwatch(cv, p, W, H);
  if (p.effect === "magnetic" || p.effect === "sheermag") return magneticSwatch(cv, p, W, H); // sheer magnetic: a pale, see-through base
  if (p.effect === "holo") return holoSwatch(cv, p, W, H);
  if (p.effect === "thermal") return thermalSwatch(cv, p, W, H);
  if (p.effect === "glow") return glowSwatch(cv, p, W, H);
  if (p.effect === "multichrome") return p.glow ? magneticSwatch(cv, p, W, H) : multichromeSwatch(cv, p, W, H);
  // Shimmer: a colored base with shimmer that catches the light where the nail faces you. It uses the
  // multichrome swatch with a base color and a sheen that fades toward the sides.
  if (p.effect === "shimmer" && p.glow) return magneticSwatch(cv, p, W, H); // shimmer that gathers into a glowing spot
  if (p.effect === "shimmer" && p.baseColor) return multichromeSwatch(cv, p, W, H);
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
    sparkle  { density, floor, dark }: more sparkles, how lit they stay outside the flash (defaults 1 and .1),
             and the share of them that face away and show as dark flecks (default 0)
    glitter  color of small hex glitter suspended in the polish
    grain    how strong the fine light/dark speckle in the body is (default .06, up to .2 as a cat eye)
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
  // Sheer magnetic: the polish is thin (lighter, more see-through) in the middle and pools at the sides
  // and cuticle, so the color gathers toward the rim. pool is 0 in the thin middle and 1 at the edge.
  const sheer = p.effect === "sheermag";
  const pool = sheer ? new Float32Array(cw * ch) : null;
  const thinC = sheer ? rgb(shade(p.colors[0], .1)) : null, poolC = sheer ? rgb(shade(p.colors[0], -.2)) : null;
  if (sheer) for (let y = 0; y < ch; y++) {
    const vy = Math.abs(y / ch - .5) * 2;
    for (let x = 0; x < cw; x++) {
      const vx = Math.abs(x / cw - .5) * 2, se = Math.sqrt(Math.sqrt(vx ** 4 + vy ** 4)); // rounded-square distance from the middle
      const q = Math.min(1, Math.max(0, (se - .5) / .5)); pool[y * cw + x] = q * q * (3 - 2 * q);
    }
  }

  // Optional flakies (irregular iridescent flakes) and glitter (small hex pieces), suspended in the
  // polish rather than pulled by the magnet, so they stay put as the glow moves.
  // Optional flakeShine { size, density }: foil flakes that catch the light, with a bright edge-to-edge
  // gradient and a white glint that flashes on as the angle (pointer or drift) changes.
  const shine = p.flakeShine ? { size: 1, density: 1, ...p.flakeShine } : null;
  const flakes = (p.flakes ? Array.from({ length: Math.round(W * H / 1500 * (shine ? shine.density : 1)) }, () => {
    const r = (2 + Math.pow(R(), 2) * 5) * (shine ? shine.size : 1), n = 5 + ((R() * 3) | 0), rot = R() * 6.3;
    return { x: R() * W, y: R() * H, phase: R(), r, pts: Array.from({ length: n }, (_, i) => {
      const a = rot + i / n * 6.283, rr = r * (.55 + R() * .6); return [Math.cos(a) * rr, Math.sin(a) * rr]; }) };
  }) : []);
  const glitter = (p.glitter ? Array.from({ length: Math.round(W * H / 450) }, () => ({ x: R() * W, y: R() * H, r: 1 + R() * 1.1, rot: R(), b: R() })) : []);

  // Sparkles: many fine glints, a few larger ones, gathered where the particles clump.
  // Each is [x, y, radius, brightness] in CSS pixels.
  const sparkles = [];
  // Optional per polish: sparkle: { density, floor } (density multiplies the count; floor keeps them lit outside the flash).
  // sparkle.dark: this share of particles face away from the light and read as darker flecks (depth in dense glitter).
  // sparkle.deep: this share of particles sit deeper inside a sheer polish: drawn into the softened body, dimmer and larger.
  const spk = { density: 1, floor: .1, mix: .7, size: 1, dark: 0, deep: 0, ...p.sparkle };
  const hasDeep = spk.deep > 0;
  const packed = spk.density > 3; // densely packed glitter: tiny particles go into a pixel layer (see draw)
  const spkCanvas = packed ? document.createElement("canvas") : null, spkCtx = spkCanvas && spkCanvas.getContext("2d");
  if (packed) { spkCanvas.width = cw; spkCanvas.height = ch; }
  const spkLayer = packed ? spkCtx.createImageData(cw, ch) : null;
  // Optional sparkle.colors: each particle gets its own color from this list (a multichrome that flashes many colors).
  const spkCols = spk.colors ? spk.colors.map(rgb) : null;
  for (let tries = 0; sparkles.length < W * H / 28 * spk.density && tries < W * H * 3; tries++) {
    const x = R() * W, y = R() * H, c = clump[((y * dpr) | 0) * cw + ((x * dpr) | 0)];
    if (R() > .25 + c * .9) continue;
    const big = R() < .03;
    sparkles.push([x, y, (big ? .5 + R() * .4 : .16 + Math.pow(R(), 2) * .3) * spk.size, big ? .85 + R() * .15 : .3 + R() * .6, R(), spk.dark > 0 && R() < spk.dark, spk.deep > 0 && R() < spk.deep]);
  }

  // h: 0 = glass bead, 1 = cat eye, in between blends the two. x/y: pointer, 0 to 1 across the swatch.
  // The resting shape comes from the Glass bead / Cat eye pills; with neither picked it sits in between.
  // A multichrome drawn with this swatch (p.glow) keeps one fixed shape: no glass bead / cat eye.
  const fixedH = p.glow ? (p.glow.shape ?? .3) : null;
  let restH = fixedH ?? finishH();
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
    const rot = fixedH !== null && p.glow.rot != null ? p.glow.rot + (cur.x - .5) * .3 // fixed-shape glow: its own angle
      : 1.0 + (cur.x - .5) * .5; // cat eye runs diagonally, tilting a little as it moves
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
    // A sparkle's color and opacity: tinted by the flash around it, bright near the flash, faint in the base.
    const sparkColor = (x, y, r, b, c) => {
      const [I, t] = field(x * dpr, y * dpr), pi = ((t * (PLUT - 1)) | 0) * 3;
      const a = b * (spk.floor + (1 - spk.floor) * I) * (1 - .5 * k * Math.max(0, Math.hypot(x / W - .5, y / H - .5) * 2 - .6));
      if (a < .03) return null;
      const w = r > .5 ? .6 : spkCols ? 0 : .2; // bigger glints burn toward white at their core; colored particles stay saturated
      let s0 = pal[pi], s1 = pal[pi + 1], s2 = pal[pi + 2];
      if (spkCols) { const q = spkCols[(c * spkCols.length) | 0], m = spk.mix; s0 += (q[0] - s0) * m; s1 += (q[1] - s1) * m; s2 += (q[2] - s2) * m; }
      return [s0 + (255 - s0) * w, s1 + (255 - s1) * w, s2 + (255 - s2) * w, Math.min(1, spkCols ? a * 1.2 : a), a]; // colored particles read as distinct flecks
    };
    const grainAmt = p.grain ?? .06 + .14 * h; // optional per polish: a stronger grain reads as dense, multidimensional glitter
    for (let y = 0, o = 0; y < ch; y += st) {
      const dy = y - cy, grow = (y >> 1) * gw, vy = (y / ch - .5) * 2, crow = y * cw;
      for (let x = 0; x < cw; x += st, o += 4) {
        const dx = x - cx, u = (dx * cos + dy * sin) / rx, v = (dy * cos - dx * sin) / ry, e = Math.sqrt(u * u + v * v);
        const ki = Math.min(ELUT - 1, (e / 3 * ELUT) | 0), I = Math.min(1, eI[ki] * (.62 + .76 * clump[crow + x]));
        let t = eT[ki] + dx * gx + dy * gy; t = t < 0 ? 0 : t > 1 ? 1 : t;
        const pi = ((t * (PLUT - 1)) | 0) * 3, n = grain[grow + (x >> 1)];
        // Deeper rim all around the edge for the domed bead look.
        const vx = (x / cw - .5) * 2, r2 = vx * vx + vy * vy, rim = (sheer ? .3 : .75) * k * (r2 > .35 ? Math.min(1, (r2 - .35) / .9) : 0);
        const lum = 1 - grainAmt / 2 + n * grainAmt;
        let b0 = base[0], b1 = base[1], b2 = base[2];
        if (sheer) { const q = pool[crow + x]; b0 = thinC[0] + (poolC[0] - thinC[0]) * q; b1 = thinC[1] + (poolC[1] - thinC[1]) * q; b2 = thinC[2] + (poolC[2] - thinC[2]) * q; }
        if (sh && n > .9) { const m = (n - .9) * 10; b0 += (sh[0] - b0) * m; b1 += (sh[1] - b1) * m; b2 += (sh[2] - b2) * m; }
        const c0 = (b0 + (pal[pi] - b0) * I) * lum, c1 = (b1 + (pal[pi + 1] - b1) * I) * lum, c2 = (b2 + (pal[pi + 2] - b2) * I) * lum;
        px8[o] = c0 + (shadow[0] - c0) * rim;
        px8[o + 1] = c1 + (shadow[1] - c1) * rim;
        px8[o + 2] = c2 + (shadow[2] - c2) * rim;
        px8[o + 3] = 255;
      }
    }
    // Deep particles go into the body before it's softened, so they read as suspended inside the polish.
    if (hasDeep) for (const [x, y, r, b, c, dk, dp] of sparkles) {
      if (!dp) continue;
      const q = dk ? [shadow[0] * .8, shadow[1] * .8, shadow[2] * .8, .4 * b] : sparkColor(x, y, r, b, c);
      if (!q) continue;
      const A = q[3] * .5, iw = img.width, ih = img.height, rr = r * 1.6 * dpr / st;
      const x0 = Math.max(0, (x * dpr / st - rr) | 0), x1 = Math.min(iw, Math.max(x0 + 1, Math.ceil(x * dpr / st + rr)));
      const y0 = Math.max(0, (y * dpr / st - rr) | 0), y1 = Math.min(ih, Math.max(y0 + 1, Math.ceil(y * dpr / st + rr)));
      for (let yy = y0; yy < y1; yy++) for (let xx = x0, o = (yy * iw + x0) * 4; xx < x1; xx++, o += 4) {
        px8[o] += (q[0] - px8[o]) * A; px8[o + 1] += (q[1] - px8[o + 1]) * A; px8[o + 2] += (q[2] - px8[o + 2]) * A;
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
      if (shine) {
        const col = palette(p.flakes, t), lit = Math.sin(f.phase * 23 + cur.x * 7 - cur.y * 5);
        const g = ctx.createLinearGradient(f.x - f.r, f.y - f.r, f.x + f.r, f.y + f.r);
        g.addColorStop(0, shade(col, .6)); g.addColorStop(.45, col); g.addColorStop(1, shade(col, .2));
        ctx.globalAlpha = .7 + .3 * lit; ctx.fillStyle = g;
        ctx.beginPath(); f.pts.forEach(([dx, dy], i) => i ? ctx.lineTo(f.x + dx, f.y + dy) : ctx.moveTo(f.x + dx, f.y + dy)); ctx.closePath(); ctx.fill();
        if (lit > .35) { // the flake faces the light: a white glint with a soft halo
          const k2 = (lit - .35) / .65; ctx.globalCompositeOperation = "lighter";
          ctx.globalAlpha = k2 * .2; ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * 1.1, 0, 7); ctx.fill();
          ctx.globalAlpha = k2; ctx.beginPath(); ctx.arc(f.x, f.y, Math.max(.5, f.r * .28), 0, 7); ctx.fill();
          ctx.globalCompositeOperation = "source-over";
        }
        continue;
      }
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
    // Packed glitter writes its tiny particles straight into a pixel layer (tens of thousands of
    // canvas calls per frame would be too slow); larger glints are still drawn as soft circles.
    const L = packed ? spkLayer.data : null;
    if (L) L.fill(0);
    const put = (x, y, r, c0, c1, c2, a) => {
      const x0 = Math.max(0, ((x - r) * dpr) | 0), x1 = Math.min(cw, Math.max(x0 + 1, Math.ceil((x + r) * dpr)));
      const y0 = Math.max(0, ((y - r) * dpr) | 0), y1 = Math.min(ch, Math.max(y0 + 1, Math.ceil((y + r) * dpr))), A = Math.min(255, a * 255);
      for (let yy = y0; yy < y1; yy++) for (let xx = x0, o = (yy * cw + x0) * 4; xx < x1; xx++, o += 4) { L[o] = c0; L[o + 1] = c1; L[o + 2] = c2; L[o + 3] = A; }
    };
    const dk0 = shadow[0] * .8, dk1 = shadow[1] * .8, dk2 = shadow[2] * .8;
    for (const [x, y, r, b, c, dk, dp] of sparkles) {
      if (dp) continue; // already drawn inside the body
      if (dk) { // a flake turned away from the light: a dark speck of the shadow color
        if (L) { put(x, y, r, dk0, dk1, dk2, .4 * b); continue; }
        ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = .4 * b; ctx.fillStyle = `rgb(${dk0 | 0},${dk1 | 0},${dk2 | 0})`;
        ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.globalCompositeOperation = spkCols ? "source-over" : "lighter"; continue;
      }
      const q = sparkColor(x, y, r, b, c);
      if (!q) continue;
      const [s0, s1, s2, al, a] = q;
      if (L && r <= .5) { put(x, y, r, s0, s1, s2, al); continue; }
      ctx.globalAlpha = al; ctx.fillStyle = `rgb(${s0 | 0},${s1 | 0},${s2 | 0})`;
      ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
      if (r > .5) { ctx.globalAlpha = a * .12; ctx.beginPath(); ctx.arc(x, y, r * 2.2, 0, 7); ctx.fill(); } // faint halo
    }
    if (L) {
      spkCtx.putImageData(spkLayer, 0, 0);
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
      ctx.drawImage(spkCanvas, 0, 0);
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
  let hovering = false;
  // With a mouse, the shape follows the pointer's height on the swatch: cat eye near the top and bottom
  // edges, glass bead through the middle, so sweeping across it plays cat eye > glass bead > cat eye
  // (phones get the same sequence from scrolling instead; see shapeForScroll).
  const shapeAt = y => { const d = Math.min(1, Math.abs(y - .5) * 2); return d * d * (3 - 2 * d); };
  cv.onpointermove = e => {
    hovering = true; const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    aim(x, y, fixedH ?? (state.finish ? restH : e.pointerType === "mouse" ? shapeAt(y) : 1));
  };
  cv.onpointerleave = () => { hovering = false; aim(.5, .5, restH); };
  if (fixedH === null) {
    cv.setFinish = () => { restH = finishH(); aim(.5, .5, restH); };
    // The shelf sets the resting shape from where the swatch sits on screen (see shapeForScroll): cat eye
    // near the top and bottom of the window, glass bead in the middle. instant skips the ease.
    cv.setRest = (hh, instant) => {
      if (hovering && !cv.matches(":hover")) hovering = false; // the pointer left while the page scrolled under it
      restH = hh; if (hovering) return;
      if (instant) { cur.h = target.h = hh; draw(); } else aim(target.x, target.y, hh);
    };
    // The touch-screen drift moves the glow around without forcing it into a cat eye.
    cv.drift = (x, y) => { if (!hovering) aim(x, y, restH); };
  }
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
  the length, how dark the base between particles is (lower is darker), grain (particle size in
  CSS pixels) and cover (with baseColor: how much of the base the shimmer covers).
  baseColor: optional colored base (like a burgundy jelly) that shows between the particles; sheen
  (with baseColor) makes the shimmer fade toward the sides so the base shows there (used for shimmers);
  smooth (0 to 1) evens out the particles for a soft gleam rather than glitter.
  glimmer: optional { color, share } bright colored glints scattered through the shimmer.
*/
function multichromeSwatch(cv, p, W, H) {
  const dpr = swatchDpr(W), cw = Math.round(W * dpr), ch = Math.round(H * dpr);
  cv.width = cw; cv.height = ch;
  const ctx = cv.getContext("2d", { willReadFrequently: true });
  const opt = { spread: 1, jitter: .22, along: .3, base: .55, grain: 1.7, cover: .75, sheen: 0, smooth: 0, ...p.chrome };
  const tint = p.baseColor ? rgb(p.baseColor) : null; // optional polish color between the shimmer particles
  const isShimmer = p.effect === "shimmer";
  const shadow = rgb(p.shadow || shade(p.colors[p.colors.length - 1], -.55));
  const R = rng(p.id || "p");
  const PL = 256, pal = new Float32Array(PL * 3);
  for (let i = 0; i < PL; i++) pal.set(rgb(palette(p.colors, i / (PL - 1))), i * 3);

  // Shimmer particles about grain CSS pixels across, each a little brighter or darker and nudged in hue.
  const CELL = Math.max(2, Math.round(dpr * opt.grain)), gx = Math.ceil(cw / CELL), gy = Math.ceil(ch / CELL), N = gx * gy;
  const pb = new Float32Array(N), ph = new Float32Array(N);
  for (let i = 0; i < N; i++) { pb[i] = R(); ph[i] = R() - .5; }
  // Optional glimmer { color, share }: that share of the particles are bright colored glints (e.g. electric
  // teal) scattered through the shimmer; each flashes on and off as the nail tilts. Uses its own random
  // stream so polishes without it keep their exact look.
  const gl = p.glimmer ? { share: .04, ...p.glimmer } : null;
  const glC = gl ? rgb(gl.color) : null, gp = gl ? new Float32Array(N) : null;
  if (gl) { const R2 = rng((p.id || "p") + ":glimmer"); for (let i = 0; i < N; i++) gp[i] = R2(); }
  const img = ctx.createImageData(cw, ch), px = img.data;
  const rest = { x: .5, y: .5 }, cur = { ...rest }, target = { ...rest };
  let raf = 0;

  function draw() {
    const axis = .5 + (cur.x - .5) * (isShimmer ? 1.1 : .7); // where the facing band sits
    const shift = (cur.y - .5) * .5;               // slide the whole range of colors
    for (let cy = 0; cy < gy; cy++) {
      const ny = (cy + .5) / gy, dome = (ny - .5) * (ny - .5) * .6; // the nail also curves top to bottom, so bands bend near the ends
      const along = (.5 - ny) * opt.along; // colors drift along the length (e.g. greener toward the tip)
      for (let cx = 0; cx < gx; cx++) {
        const i = cy * gx + cx, nx = (cx + .5) / gx;
        // Angle of the surface: 0 facing you, 1 at the far edge of the curve.
        const u = Math.min(1, Math.abs(nx - axis) / .62), ang = Math.sqrt(u * u + dome);
        // smooth (0 to 1) evens out the particles so the shimmer gleams like a satin sheen instead of glittering.
        const q = opt.smooth ? .6 + (pb[i] - .6) * (1 - opt.smooth) : pb[i];
        let t = ang * opt.spread + shift + along + ph[i] * opt.jitter * (1 - opt.smooth); // each particle catches a slightly different angle
        t = t < 0 ? -t : t; t = t > 1 ? 1 : t;           // colors mirror on both sides of the facing band
        const k = ((t * (PL - 1)) | 0) * 3;
        // Metallic light: brightest where the surface faces you, darker toward the edges; shimmer on top.
        // Particles over a dark base: most are dim, some bright, so it reads as dense metallic shimmer with depth.
        const light = .64 + .5 * Math.exp(-ang * ang * 3), sparkle = pb[i] > .97 ? (pb[i] - .97) * 20 * (1 - opt.smooth) : 0;
        // With a colored base, shimmer particles are never dimmer than full color (dim ones would read as
        // grey on light polishes); otherwise dim particles let the dark base show between them.
        const g = tint ? light * (.95 + q * q * .45) : light * (opt.base + q * q * (1.25 - opt.base));
        let r = pal[k] * g, gg = pal[k + 1] * g, bl = pal[k + 2] * g;
        if (tint) { // a colored base (e.g. burgundy) shows between the dimmer particles
          // Shimmers: the light catches most strongly at the pointer's height along the nail, so the
          // flash visibly follows the cursor rather than only sliding sideways.
          const catchY = isShimmer ? .55 + .75 * Math.exp(-(ny - cur.y) * (ny - cur.y) * 7) : 1;
          const a = Math.min(1, opt.cover * catchY * (.25 + q * q * 1.1) * (light / 1.14) * (opt.sheen ? Math.exp(-ang * ang * opt.sheen) : 1));
          r = tint[0] + (r - tint[0]) * a; gg = tint[1] + (gg - tint[1]) * a; bl = tint[2] + (bl - tint[2]) * a;
        }
        r += (255 - r) * sparkle * .5; gg += (255 - gg) * sparkle * .5; bl += (255 - bl) * sparkle * .5;
        if (gl && gp[i] < gl.share) { // a colored glint, lit at its own tilt angle
          const on = .5 + .5 * Math.sin(gp[i] * 900 + cur.x * 7 - cur.y * 5), m = .35 + .65 * on, hot = on > .8 ? (on - .8) * 2.5 : 0;
          r += (glC[0] - r) * m; gg += (glC[1] - gg) * m; bl += (glC[2] - bl) * m;
          r += (255 - r) * hot * .6; gg += (255 - gg) * hot * .6; bl += (255 - bl) * hot * .6;
        }
        const edge = Math.max(0, Math.abs(nx - .5) * 2 - .82) * 2.8; // falls into shadow at the nail's actual edges
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

/*
  Chrome powder swatch. Chrome powder is a fine mirror pigment rubbed over a finished manicure. It's
  smooth rather than glittery and very reflective: bright color bands run down the nail and shift a lot
  with the angle, and a sharp white highlight runs along the curve. Hovering tilts the nail: sideways
  moves the bands and highlight across, up and down slides through the colors.
  colors = [base the powder is shown over on the shelf, ...band colors]. Optional powder: { spread, spec, cover, light }:
  how many bands fit across the nail, how strong the highlight is, how much of the base it covers (.8), and
  [base, extra] brightness (pastel powders use a high base).
*/
function powderSwatch(cv, p, W, H) {
  const dpr = swatchDpr(W), cw = Math.round(W * dpr), ch = Math.round(H * dpr);
  cv.width = cw; cv.height = ch;
  const ctx = cv.getContext("2d");
  const opt = { spread: .8, spec: 1, cover: .8, light: [.5, .55], ...p.powder };
  const [L0, L1] = opt.light; // brightness away from / at the facing part of the curve
  const base = rgb(p.colors[0]), PL = 256, pal = new Float32Array(PL * 3);
  for (let i = 0; i < PL; i++) pal.set(rgb(palette(p.colors.slice(1), i / (PL - 1))), i * 3);
  // Computed at full resolution so the mirror bands and highlights stay crisp. While moving, every other
  // pixel is computed and doubled for speed; the resting frame is full detail.
  const img = ctx.createImageData(cw, ch), px = img.data;
  // Fixed micro-glints: the finest flecks of the powder catching the light.
  const R = rng(p.id || "p"), glint = new Float32Array(cw * ch);
  for (let i = 0; i < glint.length; i++) { const v = R(); glint[i] = v > .996 ? (v - .996) * 250 : 0; }
  const rest = { x: .5, y: .5 }, cur = { ...rest }, target = { ...rest };
  let raf = 0;
  function draw(fast = false) {
    const axis = .5 + (cur.x - .5) * .9, shift = (cur.y - .5) * .9, hi = axis + .13, st = fast ? 2 : 1;
    for (let y = 0; y < ch; y += st) {
      const ny = y / ch, dome = (ny - .5) * (ny - .5) * .08, along = (.5 - ny) * .15; // bands run down the nail
      for (let x = 0; x < cw; x += st) {
        const nx = x / cw, u = (nx - axis) / .55, ang = Math.sqrt(u * u + dome);
        let t = ang * opt.spread + shift + along; t -= Math.floor(t); t = t < .5 ? t * 2 : (1 - t) * 2; // bands repeat and mirror
        t = t * t * (3 - 2 * t); t = t * t * (3 - 2 * t); // steeper transitions: crisp mirror bands rather than soft gradients
        const k = ((t * (PL - 1)) | 0) * 3, light = L0 + L1 * Math.exp(-ang * ang * 2);
        // A sharp main highlight, a thin echo beside it, and a softer one on the far side of the curve.
        const d = (nx - hi) / .007, d1 = (nx - hi - .03) / .004, d2 = (nx - (axis - .3)) / .02;
        const fall = 1 - Math.abs(ny - .5) * .6;
        let spec = opt.spec * (Math.exp(-d * d) + .45 * Math.exp(-d1 * d1) + .4 * Math.exp(-d2 * d2)) * fall;
        const o = (y * cw + x) * 4, gl = glint[y * cw + x] * light;
        spec = Math.min(1, spec + gl);
        const edge = Math.max(0, Math.abs(nx - .5) * 2 - .86) * 2.4;
        let r = pal[k] * light, g = pal[k + 1] * light, b = pal[k + 2] * light;
        r += (255 - r) * spec; g += (255 - g) * spec; b += (255 - b) * spec;
        r *= 1 - edge * .5; g *= 1 - edge * .5; b *= 1 - edge * .5;
        // The mirror film mostly covers its base, which shows through a little (cover).
        r = base[0] + (Math.min(255, r) - base[0]) * opt.cover;
        g = base[1] + (Math.min(255, g) - base[1]) * opt.cover;
        b = base[2] + (Math.min(255, b) - base[2]) * opt.cover;
        px[o] = r; px[o + 1] = g; px[o + 2] = b; px[o + 3] = 255;
        if (st === 2) { // fill the skipped neighbours while animating
          const o2 = o + 4, o3 = o + cw * 4, o4 = o3 + 4;
          if (x + 1 < cw) { px[o2] = r; px[o2 + 1] = g; px[o2 + 2] = b; px[o2 + 3] = 255; }
          if (y + 1 < ch) { px[o3] = r; px[o3 + 1] = g; px[o3 + 2] = b; px[o3 + 3] = 255; if (x + 1 < cw) { px[o4] = r; px[o4 + 1] = g; px[o4 + 2] = b; px[o4 + 3] = 255; } }
        }
      }
    }
    ctx.putImageData(img, 0, 0);
  }
  function tick() {
    cur.x += (target.x - cur.x) * .15; cur.y += (target.y - cur.y) * .15;
    const moving = Math.abs(target.x - cur.x) + Math.abs(target.y - cur.y) > .002;
    draw(moving);
    raf = moving ? requestAnimationFrame(tick) : 0;
  }
  const aim = (x, y) => { target.x = x; target.y = y; if (!raf) raf = requestAnimationFrame(tick); };
  cv.onpointermove = e => { const r = cv.getBoundingClientRect(); aim((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height); };
  cv.onpointerleave = () => aim(rest.x, rest.y);
  cv.classList.add("interactive");
  draw();
}

/*
  Glow-in-the-dark swatch. At rest it shows the daylight look: colors[0] is the base, the rest are its
  shimmer. Hovering is like cupping your hands around the nail: it goes dark around the cursor and the
  glow (glowColor) comes up. When you move away the glow lingers and fades over a few seconds, the way
  real glow-in-the-dark polish dims once the light is gone.
  Optional in js/polishes.js: glowColor, glowCore (brightest glow), glow: { fade } (seconds to fade).
*/
function glowSwatch(cv, p, W, H) {
  const dpr = swatchDpr(W), cw = Math.round(W * dpr), ch = Math.round(H * dpr);
  cv.width = cw; cv.height = ch;
  const ctx = cv.getContext("2d", { willReadFrequently: true });
  const day = rgb(p.colors[0]), shim = (p.colors.length > 1 ? p.colors.slice(1) : [shade(p.colors[0], -.2)]).map(rgb);
  const glowC = rgb(p.glowColor || "#3cf0dc"), core = rgb(p.glowCore || shade(p.glowColor || "#3cf0dc", .6));
  const dark = [8, 14, 18];
  const opt = { fade: 3.2, sparkle: .14, ...p.glowOpts }; // sparkle: share of particles that glint
  const R = rng(p.id || "p");
  const CELL = Math.max(2, Math.round(dpr)), gx = Math.ceil(cw / CELL), gy = Math.ceil(ch / CELL), N = gx * gy;
  const pb = new Float32Array(N), pc = new Uint8Array(N);
  for (let i = 0; i < N; i++) { pb[i] = R(); pc[i] = (R() * shim.length) | 0; }
  const img = ctx.createImageData(cw, ch), px = img.data;
  // night: 0 = daylight, 1 = fully dark and glowing. cup: where the hand shade is centered.
  const st = { night: 0, target: 0, cx: .5, cy: .5 };
  let raf = 0, last = 0;

  function draw() {
    const n = st.night;
    for (let y = 0; y < gy; y++) {
      const ny = (y + .5) / gy;
      for (let x = 0; x < gx; x++) {
        const i = y * gx + x, nx = (x + .5) / gx, b = pb[i];
        // Daylight: sheer milky base, shimmer catching the light down the middle.
        const sheen = Math.exp(-((nx - .5) * (nx - .5)) * 9), c = shim[pc[i]];
        const sa = (.08 + b * b * .5) * (.4 + .6 * sheen);
        const lit = .96 + b * .06;
        let r = (day[0] + (c[0] - day[0]) * sa) * lit, g = (day[1] + (c[1] - day[1]) * sa) * lit, bl = (day[2] + (c[2] - day[2]) * sa) * lit;
        const rim = Math.max(0, Math.abs(nx - .5) * 2 - .8) * 1.2;
        r *= 1 - rim * .12; g *= 1 - rim * .12; bl *= 1 - rim * .1;
        // Sparkles: the brightest particles glint in a deeper, more saturated version of their shimmer
        // color, so they show up against the pale base instead of disappearing into it.
        const sp = b > 1 - opt.sparkle ? (b - (1 - opt.sparkle)) / opt.sparkle : 0;
        if (sp) {
          // More saturated, not darker: push the color away from grey while keeping its lightness.
          const k = sp * .85 * (.5 + .5 * sheen), avg = (c[0] + c[1] + c[2]) / 3;
          r += (c[0] + (c[0] - avg) * 1.4 - r) * k; g += (c[1] + (c[1] - avg) * 1.4 - g) * k; bl += (c[2] + (c[2] - avg) * 1.4 - bl) * k;
        }
        if (n > .002) {
          // Hand shade: darkest around the cup, falling off toward the far edges.
          const dx = nx - st.cx, dy = (ny - st.cy) * .8, cup = Math.exp(-(dx * dx + dy * dy) * 2.2);
          const d = Math.min(1, n * (.8 + .5 * cup));
          // Glow: even across the nail, a little brighter in the middle, with a soft grain; fades with n.
          const center = Math.exp(-((nx - .5) ** 2 + (ny - .5) ** 2) * 2.5);
          // Fades toward the edges so the nail reads as a light source glowing in the dark.
          const ex = (nx - .5) * 2, ey = (ny - .5) * 2, e = Math.sqrt(ex * ex + ey * ey) / 1.3; // smooth, rounded falloff
          const ff = Math.min(1, Math.max(0, (e - .35) / .65)), falloff = 1 - .55 * ff * ff * (3 - 2 * ff);
          const gl = Math.min(1, (.82 + .3 * center + (b - .5) * .1 + sp * .25) * Math.pow(n, .6)) * falloff; // glints glow a touch brighter
          const hot = Math.pow(center, 2) * gl * .75;
          const gr = dark[0] + (glowC[0] - dark[0]) * gl + (core[0] - glowC[0]) * hot;
          const gg2 = dark[1] + (glowC[1] - dark[1]) * gl + (core[1] - glowC[1]) * hot;
          const gb = dark[2] + (glowC[2] - dark[2]) * gl + (core[2] - glowC[2]) * hot;
          r += (gr - r) * d; g += (gg2 - g) * d; bl += (gb - bl) * d;
        }
        const x0 = x * CELL, y0 = y * CELL, x1 = Math.min(cw, x0 + CELL), y1 = Math.min(ch, y0 + CELL);
        for (let yy = y0; yy < y1; yy++) for (let xx = x0, o = (yy * cw + x0) * 4; xx < x1; xx++, o += 4) { px[o] = r; px[o + 1] = g; px[o + 2] = bl; px[o + 3] = 255; }
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  function tick(now) {
    const dt = Math.min(.05, (now - (last || now)) / 1000); last = now;
    // Goes dark quickly under your hand; the glow fades slowly once you move away.
    const rate = st.target > st.night ? 1 - Math.exp(-dt / .35) : 1 - Math.exp(-dt / (opt.fade / 3));
    st.night += (st.target - st.night) * rate;
    draw();
    if (Math.abs(st.target - st.night) > .003) raf = requestAnimationFrame(tick);
    else { st.night = st.target; draw(); raf = 0; last = 0; }
  }
  const wake = () => { if (!raf) raf = requestAnimationFrame(tick); };
  cv.onpointermove = e => { const r = cv.getBoundingClientRect(); st.cx = (e.clientX - r.left) / r.width; st.cy = (e.clientY - r.top) / r.height; st.target = 1; wake(); };
  cv.onpointerleave = () => { st.target = 0; wake(); };
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

// Polishes come from js/polishes.js; the bench is saved in this browser. (Saved combos were removed for now;
// any saved earlier stay in this browser's storage under KEY.combos.)
const state = { polishes: typeof POLISHES !== "undefined" ? POLISHES : [], fx: new Set(), finish: null };
const bench = { layers: load(KEY.bench, []) };
const saveBench = () => save(KEY.bench, bench.layers);

function toast(msg) { const t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => t.hidden = true, 2600); }

/* ---------- shelf ---------- */
// How magnetic swatches rest: 0 = glass bead, 1 = cat eye, in between when no finish is picked (the finish pills were removed, so always in between).
function finishH() { return state.finish === "bead" ? 0 : state.finish === "cat" ? 1 : .5; }
function buildPills() {
  const used = state.polishes.flatMap(effectsOf).filter(k => EFFECTS[k] && !PILL_EFFECTS.includes(k));
  const box = $("#fxPills");
  [...new Set([...PILL_EFFECTS, ...used])].forEach(k => {
    const b = document.createElement("button"); b.type = "button"; b.className = "scope"; b.textContent = EFFECTS[k]; b.setAttribute("aria-pressed", "false");
    b.dataset.fx = k; b.onclick = () => toggleFx(k);
    box.appendChild(b);
  });
}

function toggleFx(k) {
  state.fx.has(k) ? state.fx.delete(k) : state.fx.add(k);
  document.querySelectorAll("#fxPills .scope").forEach(b => b.setAttribute("aria-pressed", state.fx.has(b.dataset.fx)));
  renderShelf();
}
// A polish's rendering uses `effect`; `effects` (optional) lists everything it should be found under.
// There's no Multichrome category (chrome counts as multichrome): those labels are dropped, and a polish
// left with no label is filed under Shimmer.
function effectsOf(p) {
  const fx = [...new Set((p.effects || [p.effect]).map(category))].filter(k => k !== "multichrome");
  return fx.length ? fx : ["shimmer"];
}

// Plus while the polish is off the bench; it spins away and a checkmark draws in once it's added.
const PLUS_CHECK = `<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"><path class="plus" d="M10 3.5v13M3.5 10h13"/><path class="check" pathLength="1" d="M4.5 10.5l3.5 3.5 7.5-8"/></svg>`;

function emptyMsg(title, body) { return `<div class="empty"><strong>${title}</strong>${body}</div>`; }

function renderShelf() {
  const grid = $("#grid"); grid.innerHTML = "";
  if (!state.polishes.length) { grid.innerHTML = emptyMsg("Your shelf is empty", "Add your polishes to js/polishes.js and they will show up here."); return; }
  const list = state.polishes.filter(p => !state.fx.size || effectsOf(p).some(k => state.fx.has(k)));
  if (!list.length) { grid.innerHTML = emptyMsg("No matches", "No polishes with that effect yet."); return; }
  for (const p of list) {
    const card = document.createElement("article"); card.className = "card rise"; riseIn(card);
    const wrap = document.createElement("div"); wrap.className = "swatch-wrap";
    const sw = document.createElement("canvas"); sw.className = "swatch";
    const add = document.createElement("button"); add.type = "button"; add.className = "swatch-btn"; add.innerHTML = PLUS_CHECK; add.dataset.pid = p.id;
    add.dataset.name = p.name;
    add.onclick = () => bench.layers.some(l => l.pid === p.id) ? removePolish(p) : addLayer(p);
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
    sw._p = p; queueDraw(sw);
    if (autoIO) autoIO.observe(sw);
  }
  syncSwatchButtons();
  fillIdle();
}

/* ---------- detail view ---------- */
// Tapping a swatch opens the detail view over a blurred shelf: the live swatch moves into the header's
// upper-left slot and the product photos run in a row across the page; the link button opens the product page.
const detail = { p: null, card: null, cv: null };
const EASE = "cubic-bezier(.2, .8, .2, 1)";

function openDetail(p, card) {
  detail.p = p; detail.card = card;
  $("#mBrand").textContent = p.brand || "";
  $("#mName").textContent = p.name || "Untitled";
  // The dialog's add button does what the swatch's + does, and shows the same + / check state.
  const addBtn = $("#mAdd");
  if (!addBtn.firstChild) addBtn.innerHTML = PLUS_CHECK;
  addBtn.dataset.pid = p.id; addBtn.dataset.name = p.name;
  addBtn.onclick = () => bench.layers.some(l => l.pid === p.id) ? removePolish(p) : addLayer(p);
  syncSwatchButtons();
  const link = $("#mLink");
  link.hidden = !p.url; if (p.url) link.href = p.url;

  // Show the dialog first so the swatch can be drawn at the size it will actually appear.
  const m = $("#modal"); m.hidden = false; document.body.style.overflow = "hidden"; document.body.classList.add("detail-open");
  m.scrollTop = 0; m.classList.remove("scrolled");
  sizeDetail();
  const stage = $("#mStage"); stage.innerHTML = "";
  const cv = document.createElement("canvas"); cv.className = "swatch";
  stage.appendChild(cv); detail.cv = cv;
  const sr = stage.getBoundingClientRect();
  renderSwatch(cv, p, Math.round(sr.width), Math.round(sr.height));
  if (autoIO) autoIO.observe(cv);

  // Photos: a plain row of the saved product photos (not interactive).
  const row = $("#mPhotos"); row.innerHTML = "";
  (p.photos || []).slice(0, 4).forEach((src, i) => {
    // Photos load lazily: the ones near the top of the dialog right away, the rest as you scroll to them.
    const im = document.createElement("img"); im.loading = "lazy"; im.decoding = "async"; im.src = src; im.alt = `${p.name} photo ${i + 1}`;
    // Staggered entry: each photo a beat after the last, with a little randomness so it feels organic.
    // It starts once the photo has loaded, so the rise is actually seen.
    im.style.setProperty("--d", (.12 + i * .1 + Math.random() * .05).toFixed(3) + "s");
    const reveal = () => requestAnimationFrame(() => requestAnimationFrame(() => im.classList.add("in")));
    if (im.complete && im.naturalWidth) reveal(); else im.addEventListener("load", reveal, { once: true });
    row.appendChild(im);
  });

  // Grow the swatch out of its card.
  const from = card.getBoundingClientRect(), to = stage.getBoundingClientRect();
  stage.style.transition = "none";
  stage.style.transformOrigin = "0 0";
  stage.style.transform = `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width}, ${from.height / to.height})`;
  m.classList.remove("open"); void m.offsetWidth;
  stage.style.transition = `transform .45s ${EASE}`;
  stage.style.transform = "";
  m.classList.add("open");
  card.style.visibility = "hidden";
  m.focus({ preventScroll: true }); // keyboard focus moves into the dialog (Tab reaches the buttons)
}

// The photo row must stay below the header, whose height depends on the text; measure it.
$("#modal").addEventListener("scroll", e => e.currentTarget.classList.toggle("scrolled", e.currentTarget.scrollTop > 4), { passive: true });
function sizeDetail() { $("#modal").style.setProperty("--head", $(".modal-head").offsetHeight + "px"); }
addEventListener("resize", () => { if (!$("#modal").hidden) sizeDetail(); });

function closeDetail() {
  const m = $("#modal"); if (m.hidden) return;
  const stage = $("#mStage"), card = detail.card;
  const done = () => { m.hidden = true; m.classList.remove("open"); stage.style.transform = ""; document.body.style.overflow = ""; if (card) card.style.visibility = ""; };
  m.classList.remove("open"); document.body.classList.remove("detail-open");
  if (card && card.isConnected) {
    const from = stage.getBoundingClientRect(), to = card.getBoundingClientRect();
    stage.style.transform = `translate(${to.left - from.left}px, ${to.top - from.top}px) scale(${to.width / from.width}, ${to.height / from.height})`;
    setTimeout(done, 450);
  } else done();
}
$("#mClose").onclick = closeDetail;
document.addEventListener("keydown", e => { if (e.key === "Escape") closeDetail(); });

/* ---------- layering bench ---------- */
function polishById(id) { return state.polishes.find(p => p.id === id); }
function liveLayers(layers) { return layers.map(l => ({ ...l, polish: polishById(l.pid) })).filter(l => l.polish); }
// On desktop the pane slides in from the right while the shelf column narrows to make room (both in
// CSS); on close it slides out and is hidden once the slide is done.
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const benchIsOpen = () => $("#bench").classList.contains("open");
function setBenchOpen(open) {
  const b = $("#bench");
  clearTimeout(b._hideT);
  if (open) { b.hidden = false; void b.offsetWidth; b.classList.add("open"); }
  else { b.classList.remove("open"); b._hideT = setTimeout(() => { if (!benchIsOpen()) b.hidden = true; }, sheetMQ.matches || reduceMotion ? 0 : 450); }
  $("#layout").classList.toggle("closed", !open);
  document.body.classList.toggle("bench-open", open);
  setSheet(false);
  if (open) renderBench();
}
// Layering is always available: every swatch has a + button, and adding a polish opens the Layers pane.
// Closing the pane clears the layers, so every swatch goes back to its + button.
$("#closeBench").onclick = () => { bench.layers = []; saveBench(); setBenchOpen(false); syncSwatchButtons(); };

function addLayer(p) {
  // Toppers look right with one coat; everything else defaults to two.
  const layer = { pid: p.id, coats: ["glitter", "flakies", "chrome"].includes(p.effect) ? 1 : 2 };
  // Order from the top: chrome powders always on top, then sheers, then everything else. A powder goes on
  // the very top; a sheer goes just under the powders; anything else just under the sheers and powders.
  const kinds = bench.layers.map(l => polishById(l.pid));
  let at = bench.layers.length;
  if (isPowder(p)) at = bench.layers.length;
  else if (isSheer(p)) { const k = kinds.findIndex(q => q && isPowder(q)); if (k >= 0) at = k; }
  else { at = 0; kinds.forEach((q, i) => { if (q && !isOverlay(q)) at = i + 1; }); }
  bench.layers.splice(at, 0, layer);
  saveBench();
  if (!benchIsOpen()) setBenchOpen(true); else renderBench();
  pulsePeek();
  toast(`Added ${p.name || "polish"} as layer ${at + 1}`);
}
// Pressing a checked swatch button takes that polish back off the bench.
function removePolish(p) {
  bench.layers = bench.layers.filter(l => l.pid !== p.id);
  saveBench(); renderBench();
  toast(`Removed ${p.name || "polish"} from layers`);
}

// Swatch buttons show a checkmark while that polish is on the bench.
function syncSwatchButtons() {
  document.querySelectorAll(".swatch-btn, #mAdd").forEach(b => {
    const on = bench.layers.some(l => l.pid === b.dataset.pid);
    b.classList.toggle("on", on);
    b.title = on ? "Remove from layers" : "Add to layers";
    b.setAttribute("aria-label", `${on ? "Remove" : "Add"} ${b.dataset.name} ${on ? "from" : "to"} layers`);
  });
}

const TRASH = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 4h11M6.25 4V2.5h3.5V4M4 4l.6 9.1a1 1 0 0 0 1 .9h4.8a1 1 0 0 0 1-.9L12 4M6.75 6.75v4.5M9.25 6.75v4.5"/></svg>`;
// A sheer polish lets what's underneath show through; anything else covers it completely.
const isSheer = p => p.effect === "sheer" || p.effect === "sheermag" || effectsOf(p).includes("sheer");
// Chrome powders are rubbed onto the top of a manicure: always the topmost layer, over whatever is below.
const isPowder = p => p.effect === "powder";
const isOverlay = p => isSheer(p) || isPowder(p);

// The big preview. Each polish paints over everything below it, so the preview starts from the topmost
// polish that isn't sheer. Sheer layers above it combine with it: they tint it (multiply) and add their
// own shimmer and sparkle (screen).
const GRIP = `<svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor" aria-hidden="true"><circle cx="2.5" cy="3" r="1.4"/><circle cx="7.5" cy="3" r="1.4"/><circle cx="2.5" cy="8" r="1.4"/><circle cx="7.5" cy="8" r="1.4"/><circle cx="2.5" cy="13" r="1.4"/><circle cx="7.5" cy="13" r="1.4"/></svg>`;

// Drag to reorder the layer rows. With a mouse, any part of a row can be dragged (the cursor shows a
// grab hand); on touch screens, drag by the grip so the list still scrolls normally. The row follows the
// pointer and the others slide aside to show where it will land.
{
  const ol = $("#layers");
  let drag = null;
  ol.addEventListener("pointerdown", e => {
    const li = e.target.closest(".layer");
    if (!li || e.target.closest(".layer-del") || (e.pointerType !== "mouse" && !e.target.closest(".layer-grip"))) return;
    const rows = [...ol.querySelectorAll(".layer")];
    drag = { li, rows, from: rows.indexOf(li), to: rows.indexOf(li), y0: e.clientY, h: li.offsetHeight, started: false };
    li.setPointerCapture(e.pointerId);
  });
  ol.addEventListener("pointermove", e => {
    if (!drag) return;
    const dy = e.clientY - drag.y0;
    if (!drag.started) { if (Math.abs(dy) < 4) return; drag.started = true; drag.li.classList.add("dragging"); ol.classList.add("reordering"); }
    e.preventDefault();
    const n = drag.rows.length, to = Math.max(0, Math.min(n - 1, drag.from + Math.round(dy / drag.h)));
    drag.to = to;
    drag.li.style.transform = `translateY(${Math.max(-drag.from * drag.h, Math.min((n - 1 - drag.from) * drag.h, dy))}px)`;
    drag.rows.forEach((r, k) => {
      if (r === drag.li) return;
      const s = drag.from < to && k > drag.from && k <= to ? -drag.h : drag.from > to && k < drag.from && k >= to ? drag.h : 0;
      r.style.transform = s ? `translateY(${s}px)` : "";
    });
  });
  const end = () => {
    if (!drag) return;
    const d = drag; drag = null;
    if (!d.started) return;
    ol.classList.remove("reordering");
    if (d.to !== d.from) { // rows are listed top layer first, the reverse of the stack order
      const shown = [...bench.layers].reverse(), [m] = shown.splice(d.from, 1);
      shown.splice(d.to, 0, m); bench.layers = shown.reverse(); saveBench();
    }
    renderBench();
  };
  ol.addEventListener("pointerup", end); ol.addEventListener("pointercancel", end);
}

// A sheer layered over another polish goes on in up to three passes:
//   1. tint: its base color multiplies with the polish below (skipped for clear toppers like Bubbly),
//      so darker sheers deepen what's underneath instead of veiling it grey;
//   2. glow: its shimmer or magnetic flash drawn on black and added as light (screen);
//   3. glitter: its sparkle drawn on black at full strength, packed densely and gathered into the flash,
//      so the reflective part stays concentrated and bright.
// Each layer becomes a list of drawing steps: { cv, op, alpha } draws a rendered swatch, { fill, op, alpha }
// fills a flat color. The swatch canvases stay live, so the stack can be redrawn as they animate.
function sheerOps(q, W, H) {
  const ops = [], draw = (p, op, alpha) => { const cv = document.createElement("canvas"); renderSwatch(cv, p, W, H); ops.push({ cv, op, alpha }); };
  // A chrome powder is a mirror film that mostly covers what's below (its cover share), letting a little show through.
  if (isPowder(q)) { draw({ ...q, powder: { ...q.powder, cover: 1 } }, "source-over", (q.powder && q.powder.cover) || .8); return ops; }
  const magnetic = q.effect === "magnetic" || q.effect === "sheermag" || !!q.glow; // drawn by the magnetic swatch
  if (!q.clear) ops.push({ fill: q.baseColor || q.colors[0], op: "multiply", alpha: .6 });
  if (magnetic) {
    // Magnetic sheers rest in the same in-between shape as the shelf swatches: an organic glow between a
    // glass bead and a cat eye, following the pointer as you hover.
    const shape = q.effect === "sheermag" || q.effect === "magnetic" ? { glow: { shape: .5 } } : {};
    const blk = { ...q, ...shape, colors: ["#000000", ...q.colors.slice(1)], shadow: "#000000" };
    const sp = { density: 1, floor: .1, ...q.sparkle };
    draw({ ...blk, sparkle: { ...sp, density: 0 }, flakes: null }, "screen", .6);
    draw({ ...blk, colors: q.colors.map(() => "#000000"), sparkle: { ...sp, density: sp.density * 2.2, floor: .04, mix: 1, dark: 0 } }, "screen", 1);
  } else {
    // Other sheers (shimmers, glow in the dark): their shimmer on a black base, added as light.
    draw({ ...q, colors: q.baseColor ? q.colors : ["#000000", ...q.colors.slice(1)], baseColor: q.baseColor ? "#000000" : undefined, shadow: "#000000" }, "screen", .95);
  }
  return ops;
}
function stackOps(W, H) {
  const live = liveLayers(bench.layers);
  if (!live.length || !W || !H) return null;
  let start = 0;
  live.forEach((L, i) => { if (!isOverlay(L.polish)) start = i; });
  const ops = [];
  live.slice(start).forEach((L, i) => {
    if (!i) { const cv = document.createElement("canvas"); renderSwatch(cv, L.polish, W, H); ops.push({ cv, op: "source-over", alpha: 1 }); }
    else ops.push(...sheerOps(L.polish, W, H));
  });
  return ops;
}
function composeOps(ctx, ops, ow, oh) {
  ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1; ctx.clearRect(0, 0, ow, oh);
  for (const o of ops) {
    ctx.globalCompositeOperation = o.op; ctx.globalAlpha = o.alpha;
    if (o.fill) { ctx.fillStyle = o.fill; ctx.fillRect(0, 0, ow, oh); } else ctx.drawImage(o.cv, 0, 0, ow, oh);
  }
  ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
}
function stackCanvas(W, H) {
  const ops = stackOps(W, H);
  if (!ops) return null;
  const out = document.createElement("canvas"), dpr = swatchDpr(W);
  out.width = Math.round(W * dpr); out.height = Math.round(H * dpr);
  composeOps(out.getContext("2d"), ops, out.width, out.height);
  return out;
}
// The big preview is interactive: the pointer (or the touch-screen drift) is passed to every layer's own
// swatch, each animates the way it does on the shelf (magnetic glow following, thermal shifting, glints
// flashing), and the stack is recomposed every frame while any of them is moving.
function renderStage() {
  const box = $("#stage"); box.innerHTML = "";
  const W = Math.round(box.clientWidth), H = Math.round(box.clientHeight), ops = stackOps(W, H);
  if (ops) {
    const out = document.createElement("canvas"), dpr = swatchDpr(W);
    out.width = Math.round(W * dpr); out.height = Math.round(H * dpr);
    const ctx = out.getContext("2d");
    // The layer canvases sit hidden under the preview at the same size, so their own pointer maths work.
    const holder = document.createElement("div"); holder.className = "stage-layers"; holder.setAttribute("aria-hidden", "true");
    ops.forEach(o => o.cv && holder.appendChild(o.cv));
    box.append(holder, out);
    composeOps(ctx, ops, out.width, out.height);
    let until = 0, raf = 0;
    const loop = now => { composeOps(ctx, ops, out.width, out.height); raf = now < until ? requestAnimationFrame(loop) : 0; };
    const kick = () => { until = performance.now() + 3500; if (!raf) raf = requestAnimationFrame(loop); }; // long enough for glow fades
    out.onpointermove = e => { ops.forEach(o => o.cv && o.cv.onpointermove && o.cv.onpointermove(e)); kick(); };
    out.onpointerleave = e => { ops.forEach(o => o.cv && o.cv.onpointerleave && o.cv.onpointerleave(e)); kick(); };
    out.classList.add("interactive");
    if (autoIO) autoIO.observe(out);
  }
  renderPeek();
}

/* Phones: the Layers pane is a bottom sheet that rests collapsed as a peek bar (combined swatch, layer
   count, small thumbnails) and expands to the full pane when tapped or dragged up. */
const sheetMQ = matchMedia("(max-width: 760px)");
function renderPeek() {
  if (!sheetMQ.matches) return;
  const n = bench.layers.length, mini = $("#peekMini"); mini.innerHTML = "";
  $("#peekSub").textContent = n ? `${n} layer${n > 1 ? "s" : ""}` : "Start adding polishes to see how they layer together.";
  const cv = stackCanvas(44, 44); if (cv) mini.appendChild(cv);
  const th = $("#peekThumbs"); th.innerHTML = "";
  [...bench.layers].reverse().slice(0, 4).forEach(l => {
    const p = polishById(l.pid); if (!p) return;
    const c = document.createElement("canvas"); renderSwatch(c, p, 24, 24); th.appendChild(c);
  });
}
function setSheet(expanded) {
  const b = $("#bench");
  b.classList.toggle("expanded", expanded); b.style.transform = "";
  $("#peek").setAttribute("aria-expanded", expanded);
  if (!expanded) b.scrollTop = 0;
}
function pulsePeek() {
  if (!sheetMQ.matches || $("#bench").classList.contains("expanded")) return;
  const m = $("#peekMini"); m.classList.remove("pulse"); void m.offsetWidth; m.classList.add("pulse");
}
{
  const peek = $("#peek"), head = $("#benchHead"), b = $("#bench");
  const syncRole = () => { if (sheetMQ.matches) { peek.setAttribute("role", "button"); peek.tabIndex = 0; } else { peek.removeAttribute("role"); peek.removeAttribute("tabindex"); setSheet(false); } };
  sheetMQ.addEventListener("change", () => { syncRole(); renderBench(); });
  syncRole();
  peek.onkeydown = e => { if (sheetMQ.matches && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); setSheet(!b.classList.contains("expanded")); } };
  // Drag the header to move the sheet with your finger; a short tap toggles it.
  let drag = null;
  head.addEventListener("pointerdown", e => {
    if (!sheetMQ.matches || e.target.closest("#closeBench")) return;
    drag = { y: e.clientY, moved: 0, open: b.classList.contains("expanded"), rest: b.offsetHeight - head.offsetHeight - 24 };
    head.setPointerCapture(e.pointerId); b.style.transition = "none";
  });
  head.addEventListener("pointermove", e => {
    if (!drag) return;
    const dy = e.clientY - drag.y; drag.moved = dy;
    const base = drag.open ? 0 : drag.rest, y = Math.min(drag.rest, Math.max(0, base + dy));
    b.style.transform = `translateY(${y}px)`;
  });
  const end = () => {
    if (!drag) return;
    const { moved, open } = drag; drag = null; b.style.transition = "";
    if (Math.abs(moved) < 6) setSheet(!open);
    else setSheet(moved < 0 ? (open || moved < -40) : (open && moved < 40));
  };
  head.addEventListener("pointerup", end); head.addEventListener("pointercancel", end);
}

function renderBench() {
  syncSwatchButtons();
  if (!benchIsOpen()) return;
  $("#bench").classList.toggle("no-layers", !liveLayers(bench.layers).length);
  renderStage();
  const ol = $("#layers"); ol.innerHTML = "";
  if (!bench.layers.length) { ol.innerHTML = `<li class="hint">Start adding polishes to see how they layer together.</li>`; return; }
  // Listed top layer first, like a stack seen from above.
  bench.layers.map((l, i) => [l, i]).reverse().forEach(([l, i]) => {
    const p = polishById(l.pid);
    const li = document.createElement("li"); li.className = "layer";
    const th = document.createElement("canvas"); th.className = "layer-thumb";
    const mid = document.createElement("div"); mid.className = "layer-text";
    const nm = document.createElement("p"); nm.className = "layer-name"; nm.textContent = p ? (p.name || "Untitled") : "Removed polish";
    const fx = document.createElement("p"); fx.className = "layer-fx"; fx.textContent = p ? effectsOf(p).map(k => EFFECTS[k] || k).join(" · ") : "No longer on your shelf";
    mid.append(nm, fx);
    const del = document.createElement("button"); del.type = "button"; del.className = "layer-del"; del.innerHTML = TRASH;
    del.setAttribute("aria-label", `Remove ${p ? p.name : "layer"}`);
    del.onclick = () => { bench.layers.splice(i, 1); saveBench(); renderBench(); };
    const grip = document.createElement("span"); grip.className = "layer-grip"; grip.innerHTML = GRIP; grip.setAttribute("aria-hidden", "true");
    li.append(grip, th, mid, del); ol.appendChild(li);
    if (p) renderSwatch(th, p, 48, 48);
  });
}

/* ---------- grid fit ---------- */
// Fill the full width: use the column count whose cards come closest to the breakpoint size, then
// size the cards to exactly fill the row (never above 1.4x the design, 336px). Phones use CSS.
const GAP = 40, MAX_CARD = 336;
// Card swatches are drawn at the size they're actually shown (cards grow on bigger screens), so they
// stay sharp instead of being stretched.
// Cards rise into view as they're scrolled to. Cards arriving together (a new row, or the first screen)
// are staggered left to right, top to bottom.
let riseIO = null;
function riseIn(card) {
  if (!riseIO) riseIO = new IntersectionObserver(entries => {
    const arriving = entries.filter(e => e.isIntersecting).map(e => e.target);
    arriving.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top || a.getBoundingClientRect().left - b.getBoundingClientRect().left);
    arriving.forEach((c, k) => { riseIO.unobserve(c); c.style.setProperty("--d", (k * .07).toFixed(2) + "s"); c.classList.add("in"); });
  }, { threshold: .15 });
  riseIO.observe(card);
}

/* Swatches are drawn lazily: each one as it comes within about a screen of view, and the rest one at a
   time in idle moments, so the page is usable right away however many polishes there are. */
let drawIO = null;
const idle = window.requestIdleCallback || (fn => setTimeout(() => fn({ timeRemaining: () => 8 }), 60));
// Swatches coming into view are drawn a frame at a time (as many as fit in ~12 ms, at least one), so
// the page keeps painting and responding while the first screen fills in.
const drawQueue = [];
let pumping = 0;
function pump() {
  const t = performance.now(); let drew = false;
  while (drawQueue.length && (!drew || performance.now() - t < 12)) {
    const cv = drawQueue.shift();
    if (!cv._w && cv.isConnected) { drawCard(cv); drew = true; }
  }
  if (drew) shapeForScroll(true);
  pumping = drawQueue.length ? requestAnimationFrame(pump) : 0;
}
function queueDraw(cv) {
  if (!drawIO) drawIO = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { drawIO.unobserve(e.target); drawQueue.push(e.target); } });
    if (drawQueue.length && !pumping) pumping = requestAnimationFrame(pump);
  }, { rootMargin: "50% 0px" });
  drawIO.observe(cv);
}
function fillIdle() {
  idle(deadline => {
    const next = [...document.querySelectorAll("#grid .swatch")].find(cv => !cv._w);
    if (!next) return;
    if (deadline.timeRemaining() > 4) { drawIO && drawIO.unobserve(next); drawCard(next); shapeForScroll(true); }
    fillIdle();
  });
}
function drawCard(cv) {
  const w = Math.round(cv.parentElement.clientWidth) || 240;
  cv._w = w; renderSwatch(cv, cv._p, w, Math.round(w * 260 / 240));
}
let redrawTimer = 0;
// After a resize, only swatches on screen are redrawn right away; the others are marked undrawn and
// go back into the lazy queue, so resizing (or the scrollbar appearing) doesn't redraw the whole shelf.
function redrawCards() {
  clearTimeout(redrawTimer);
  redrawTimer = setTimeout(() => {
    const vh = innerHeight;
    document.querySelectorAll("#grid .swatch").forEach(cv => {
      if (!cv._w || Math.abs(cv.parentElement.clientWidth - cv._w) <= 2) return;
      const r = cv.getBoundingClientRect();
      if (r.bottom > -40 && r.top < vh + 40) drawCard(cv); else { cv._w = 0; queueDraw(cv); }
    });
    shapeForScroll(true); fillIdle();
  }, 150);
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

/* ---------- auto-animate on touch screens ---------- */
// Phones and tablets have no hover, so swatches move on their own, as if a finger were hovering over
// them. Only the ones whose center sits in the middle third of the screen move, so motion follows
// what you're looking at while scrolling; the large swatch in the detail view always moves. Each one
// wanders on its own slow path (two sine waves per axis with random speeds and phases), so no two
// swatches follow the same motion.
const noHover = matchMedia("(hover: none)").matches;
const drifting = new Map(); // canvas -> its path
const autoIO = noHover ? new IntersectionObserver(entries => entries.forEach(e => {
  if (e.isIntersecting) { if (!drifting.has(e.target)) drifting.set(e.target, newPath()); }
  else drifting.delete(e.target);
}), { threshold: .35 }) : null;

function newPath() {
  const r = Math.random;
  return { t: r() * 100, fx: [.05 + r() * .05, .13 + r() * .1], fy: [.04 + r() * .05, .11 + r() * .09],
           px: [r() * 6.28, r() * 6.28], py: [r() * 6.28, r() * 6.28], ax: .26 + r() * .1, ay: .24 + r() * .1 };
}
let lastDrift = 0;
function drift(now) {
  const dt = Math.min(.1, (now - (lastDrift || now)) / 1000); lastDrift = now;
  const detailOpen = document.body.classList.contains("detail-open");
  for (const [cv, p] of drifting) {
    if (!cv.isConnected) { drifting.delete(cv); continue; }
    const inDetail = !!cv.closest("#mStage");
    if (detailOpen && !inDetail) continue; // the shelf is hidden behind the dialog
    const r = cv.getBoundingClientRect();
    const mid = r.top + r.height / 2, h = innerHeight;
    if (!inDetail && (mid < h / 3 || mid > h * 2 / 3)) continue; // outside the middle third: hold still
    p.t += dt;
    const w = (f, ph, t) => Math.sin(t * f * 6.283 + ph);
    const x = .5 + p.ax * w(p.fx[0], p.px[0], p.t) + p.ax * .45 * w(p.fx[1], p.px[1], p.t);
    const y = .5 + p.ay * w(p.fy[0], p.py[0], p.t) + p.ay * .45 * w(p.fy[1], p.py[1], p.t);
    if (cv.drift) cv.drift(x, y);
    else cv.onpointermove && cv.onpointermove({ clientX: r.left + x * r.width, clientY: r.top + y * r.height });
  }
  requestAnimationFrame(drift);
}
if (noHover) requestAnimationFrame(drift);

/* ---------- scroll: magnetic shapes ---------- */
// On touch screens, as the shelf scrolls, each magnetic swatch shifts with its place on screen: a cat eye as it comes in at
// the bottom, easing into a glass bead in the middle of the window, and back to a cat eye as it leaves.
function shapeForScroll(instant) {
  if (!noHover) return; // phones and tablets only; with a mouse, hovering plays it instead
  const vh = innerHeight;
  document.querySelectorAll("#grid .swatch").forEach(cv => {
    if (!cv.setRest) return;
    const r = cv.getBoundingClientRect();
    if (r.bottom < -40 || r.top > vh + 40) return;
    const d = Math.min(1, Math.abs((r.top + r.bottom) / 2 - vh / 2) / (vh / 2));
    cv.setRest(d * d * (3 - 2 * d), instant);
  });
}
let shapeRaf = 0;
addEventListener("scroll", () => { if (!shapeRaf) shapeRaf = requestAnimationFrame(() => { shapeRaf = 0; shapeForScroll(); }); }, { passive: true });

/* ---------- boot ---------- */
buildPills();
renderShelf();
renderBench();
