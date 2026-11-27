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
  "mooncat-jewel-beetle", "mooncat-into-the-abyss", "prettydiva-mermaid-pink-chrome-powder", "anp-sapphire-morpho",
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

(async () => {
  const server = await serve();
  const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  await page.clock.install();
  await page.goto(`http://localhost:${server.address().port}/index.html`, { waitUntil: "load" });
  await page.clock.runFor(1500);

  const spots = layout(PICKS.length);
  if (spots.length < PICKS.length) console.warn(`only ${spots.length} of ${PICKS.length} swatches fit`);
  const items = spots.map((s, i) => ({ ...s, id: PICKS[i] }));
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
