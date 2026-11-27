/*
  Builds the shelf's own link preview:
    images/og-collage.gif   960x504 animated image: a loose scatter of round swatches of different sizes on
                            off-white. All at once, each swatch's flash or shift drifts a little, its own way, the
                            way it does on a phone, and settles back. The first frame is every swatch at rest, so previews that
                            only show one frame (iMessage) show the finished collage.

  Run:  node scripts/build-og-collage.js        (KEEP=1 keeps the frames; FIRST=1 writes only the first frame as PNG)
  The swatches are drawn by the site's own code (js/app.js) in a headless browser, so they match the shelf.
*/
const fs = require("fs"), path = require("path"), http = require("http"), os = require("os");
const { execFileSync } = require("child_process");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "..");
const W = 1200, H = 630, OUT_W = 960;
const BG = "#f1efe9";
const FRAME = 100;      // ms per frame
const WANDER = 4000;    // ms the swatches' light drifts
const STAGGER = 0;      // ms between one swatch starting and the next (0: all together)
const AMP = .13;        // how far the light drifts from the middle, 0 to .5 across the swatch
const SEED = 3;

// The swatches, in the order they light up, with their size. Chosen for a spread of color and finish.
const PICKS = [
  "anp-great-purple-emperor", "mooncat-dark-horse", "ilnp-bubbly", "mooncat-fake-halo", "cracked-lahar",
  "mooncat-jewel-beetle", "mooncat-into-the-abyss", "mooncat-garden-of-evil", "anp-sapphire-morpho",
  "mooncat-moonlight-lullaby", "beesknees-sprites", "mooncat-koi-whiskers", "mooncat-kafkaesque",
  "mooncat-pandoras-box", "cracked-taro-milk-tea", "beesknees-the-horror-of-the-truth", "mooncat-fields-of-lavender",
  "anp-yotsuya-kaidan",
];

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".jpg": "image/jpeg", ".png": "image/png", ".gif": "image/gif", ".webp": "image/webp", ".woff2": "font/woff2" };
function serve() {
  const server = http.createServer((req, res) => {
    let f = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
    if (!f.startsWith(ROOT)) return res.writeHead(403).end();
    if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html");
    if (!fs.existsSync(f)) return res.writeHead(404).end();
    res.writeHead(200, { "Content-Type": TYPES[path.extname(f)] || "application/octet-stream" });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise(r => server.listen(0, () => r(server)));
}

// A loose scatter: big swatches placed first, each where it clears the others by a gap, a seeded shuffle
// so the layout is the same every run.
function layout(n) {
  let s = SEED; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const sizes = Array.from({ length: n }, (_, i) => Math.round(220 - 115 * i / (n - 1)));
  const placed = [], GAP = 16, M = 14;
  for (const d of sizes) {
    let best = null;
    for (let t = 0; t < 6000; t++) {
      const x = M + d / 2 + rnd() * (W - 2 * M - d), y = M + d / 2 + rnd() * (H - 2 * M - d);
      let clear = Infinity;
      for (const q of placed) clear = Math.min(clear, Math.hypot(q.x - x, q.y - y) - (q.d + d) / 2);
      if (clear < GAP) continue;
      // Prefer spots that sit close to their neighbours, so the gaps stay even rather than leaving holes.
      const score = placed.length ? clear : 0;
      if (!best || score < best.score) best = { x, y, d, score };
    }
    if (best) placed.push(best);
  }
  return placed;
}

// The mean color (CIE Lab) and the spread of lightness inside each swatch, from a screenshot of the collage.
function lookOf(png, items) {
  const raw = execFileSync("ffmpeg", ["-loglevel", "error", "-i", "-", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], { input: png, maxBuffer: 64 << 20 });
  const lin = c => (c /= 255) <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4;
  const f = t => t > .008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
  return items.map(({ x, y, d }) => {
    let n = 0, L = 0, A = 0, B = 0, LL = 0;
    const r = d * .4;
    for (let py = Math.round(y - r); py <= y + r; py += 2) for (let px = Math.round(x - r); px <= x + r; px += 2) {
      if ((px - x) ** 2 + (py - y) ** 2 > r * r) continue;
      const o = (py * W + px) * 3, R = lin(raw[o]), G = lin(raw[o + 1]), Bl = lin(raw[o + 2]);
      const X = f((.4124 * R + .3576 * G + .1805 * Bl) / .9505), Y = f(.2126 * R + .7152 * G + .0722 * Bl), Z = f((.0193 * R + .1192 * G + .9505 * Bl) / 1.089);
      const l = 116 * Y - 16; L += l; LL += l * l; A += 500 * (X - Y); B += 200 * (Y - Z); n++;
    }
    L /= n; return { L, a: A / n, b: B / n, sd: Math.sqrt(Math.max(0, LL / n - L * L)) };
  });
}
const NEAR = 60;        // px between two swatches' edges for them to count as neighbours
const ALIKE = 45;       // how different (Lab distance, plus the lightness spread) two neighbours should be
function spread(items, looks) {
  const n = items.length, ids = items.map((_, i) => i);
  const near = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++)
    if (Math.hypot(items[i].x - items[j].x, items[i].y - items[j].y) - (items[i].d + items[j].d) / 2 < NEAR) near.push([i, j]);
  const diff = (p, q) => Math.hypot(p.L - q.L, p.a - q.a, p.b - q.b) + .5 * Math.abs(p.sd - q.sd);
  // at[spot] = which swatch (by its index in looks) sits there
  const cost = at => near.reduce((c, [i, j]) => c + Math.max(0, ALIKE - diff(looks[at[i]], looks[at[j]])) ** 2, 0);
  let s = SEED; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  let at = ids.slice(), c = cost(at);
  for (let t = 0; t < 40000 && c > 0; t++) {
    const i = Math.floor(rnd() * n), j = Math.floor(rnd() * n); if (i === j) continue;
    [at[i], at[j]] = [at[j], at[i]];
    const c2 = cost(at);
    if (c2 <= c) c = c2; else [at[i], at[j]] = [at[j], at[i]];
  }
  const close = near.map(([i, j]) => [items[at[i]].id, items[at[j]].id, Math.round(diff(looks[at[i]], looks[at[j]]))]).filter(x => x[2] < ALIKE);
  if (close.length) console.warn("still alike:", close);
  return items.map((it, k) => ({ ...it, id: items[at[k]].id }));
}

(async () => {
  const server = await serve();
  const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  await page.clock.install();
  await page.goto(`http://localhost:${server.address().port}/index.html`, { waitUntil: "load" });
  await page.clock.runFor(1500);

  const spots = layout(PICKS.length);
  if (spots.length < PICKS.length) console.warn(`only ${spots.length} of ${PICKS.length} swatches fit`);
  let items = spots.map((s, i) => ({ ...s, id: PICKS[i] }));
  const stageUp = async items => {
  const moves = await page.evaluate(({ items, W, H, BG }) => {
    document.getElementById("og-stage")?.remove();
    const stage = document.createElement("div"); stage.id = "og-stage";
    stage.style.cssText = `position:fixed;left:0;top:0;width:${W}px;height:${H}px;z-index:2147483647;background:${BG};overflow:hidden;`;
    document.body.appendChild(stage);
    window.og = [];
    for (const it of items) {
      const p = polishById(it.id);
      if (!p) throw new Error("no polish " + it.id);
      const box = document.createElement("div");
      const d = Math.round(it.d);
      box.style.cssText = `position:absolute;left:${Math.round(it.x - d / 2)}px;top:${Math.round(it.y - d / 2)}px;width:${d}px;height:${d}px;`;
      const cv = document.createElement("canvas"); cv.className = "swatch"; box.appendChild(cv);
      stage.appendChild(box);
      renderSwatch(cv, p, d, d);
      dropify(box, p.id, 1);
      window.og.push(cv);
    }
    window.ogMove = (i, x, y) => {
      const cv = og[i];
      if (cv.drift) return cv.drift(x, y);
      const r = cv.getBoundingClientRect();
      cv.onpointermove && cv.onpointermove({ clientX: r.left + x * r.width, clientY: r.top + y * r.height, pointerType: "touch" });
    };
    window.ogLeave = i => og[i].onpointerleave && og[i].onpointerleave({ pointerType: "touch" });
    // Glow swatches are left untouched: held at the middle, their glow blooms into a white spot, which doesn't
    // read as the swatch at rest.
    return og.map((cv, i) => cv.classList.contains("interactive") && polishById(items[i].id).effect !== "glow");
  }, { items, W, H, BG });
  // Rest is the light held at the middle of each swatch (where the loop starts and ends), so the loop has
  // no jump where the swatches are let go and drift back to their untouched look.
  await page.clock.runFor(1500);
  await page.evaluate(moves => og.forEach((_, i) => moves[i] && ogMove(i, .5, .5)), moves);
  await page.clock.runFor(2500);
  return moves;
  };

  // Look-alikes kept apart: each swatch's rendered color is measured, then the swatches are swapped between
  // the spots until no two neighbours (spots within NEAR px of each other) look too much alike.
  await stageUp(items);
  const looks = lookOf(await page.screenshot({ type: "png", clip: { x: 0, y: 0, width: W, height: H } }), items);
  items = spread(items, looks);
  const moves = await stageUp(items);
  console.log(items.map(it => `${it.id} ${Math.round(it.d)}`).join("\n"));

  const shot = () => page.screenshot({ type: "png", clip: { x: 0, y: 0, width: W, height: H } });
  const frames = [await shot()];
  if (process.env.FIRST) {
    fs.writeFileSync(path.join(ROOT, "images/og-collage-first.png"), frames[0]);
    await browser.close(); server.close(); return;
  }

  // Every swatch's light traces a small loop through the middle, easing out from rest and back, then it's let
  // go of at the middle. Each starts its loop at its own angle and some turn the other way, so they don't move in lockstep.
  const live = items.map((_, i) => i).filter(i => moves[i]);
  const total = STAGGER * (live.length - 1) + WANDER;
  const n = Math.round(total / FRAME);
  const done = new Set();
  for (let f = 1; f <= n; f++) {
    const t = f * FRAME;
    const pos = [];
    live.forEach((i, k) => {
      const u = (t - k * STAGGER) / WANDER;
      if (u <= 0) return;
      if (u >= 1) { if (!done.has(i)) { done.add(i); pos.push([i, [.5, .5]]); } return; }
      const e = Math.sin(Math.PI * u), dir = k % 2 ? -1 : 1, a = 2 * Math.PI * (u + k * .37);
      pos.push([i, [.5 + AMP * e * Math.cos(dir * a), .5 + AMP * .85 * e * Math.sin(dir * a)]]);
    });
    await page.evaluate(pos => pos.forEach(([i, xy]) => xy ? ogMove(i, xy[0], xy[1]) : ogLeave(i)), pos);
    await page.clock.runFor(FRAME);
    frames.push(await shot());
  }
  await page.evaluate(ids => ids.forEach(i => ogMove(i, .5, .5)), live.filter(i => !done.has(i)));
  for (let i = 0; i < 40; i++) {
    await page.clock.runFor(FRAME);
    const f = await shot();
    if (f.equals(frames[frames.length - 1])) break;
    frames.push(f);
  }
  // A short hold on the finished collage before it loops.
  for (let i = 0; i < 10; i++) frames.push(frames[0]);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ogc-"));
  frames.forEach((f, i) => fs.writeFileSync(path.join(tmp, `${String(i).padStart(4, "0")}.png`), f));
  const out = path.join(ROOT, "images/og-collage.gif");
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(1000 / FRAME), "-i", path.join(tmp, "%04d.png"),
    "-filter_complex", `[0]scale=${OUT_W}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=256:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`,
    "-loop", "0", out]);
  if (!process.env.KEEP) fs.rmSync(tmp, { recursive: true }); else console.log(tmp);
  console.log(`og-collage.gif  ${frames.length} frames, ${(fs.statSync(out).size / 1024).toFixed(0)} KB`);
  await browser.close(); server.close();
})().catch(e => { console.error(e); process.exit(1); });
