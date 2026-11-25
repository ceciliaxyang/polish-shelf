/* ---------- droplet swatches ---------- */
// Swatches can be drawn as rectangles (the original cards) or as droplets: each one a small poured puddle
// of polish, round but a little irregular, the shape picked from the polish (or combo) so it stays the
// same every visit. The live swatch canvas is masked to the drop, so every effect (magnetic flash,
// multichrome shift, holo, shimmer...) still moves. On top sits a "soft sheen": the polish lies flat, so
// there's no dome shading, just a faint broad sheen, a few swirl marks where it settled, a thin bright
// line where the edge catches the light (from the upper left) and a hairline meniscus; a tight contact
// shadow sits underneath.
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
  const f = v => v.toFixed(2);
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < N; i++) {
    const p0 = pts[(i - 1 + N) % N], p1 = pts[i], p2 = pts[(i + 1) % N], p3 = pts[(i + 2) % N];
    d += `C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`;
  }
  const shape = { d: d + "Z", cx: 50 - mx * k, cy: vh / 2 - my * k, vh, R,
    mask: `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='${DROP_NS}' viewBox='0 0 100 ${vh}' preserveAspectRatio='none'><path d='${d}Z'/></svg>`)}")` };
  dropCache.set(id, shape);
  return shape;
}

let dropUid = 0;
function dropSvg(cls, vh, inner) {
  const s = document.createElementNS(DROP_NS, "svg");
  s.setAttribute("class", cls); s.setAttribute("viewBox", `0 0 100 ${vh}`);
  s.setAttribute("preserveAspectRatio", "none"); s.setAttribute("aria-hidden", "true");
  s.innerHTML = inner; return s;
}

// Turn a box holding a swatch canvas into a droplet. `aspect` is the box's height / width. Safe to call
// again after the box's canvas is replaced. Options: small (no swirls or shadow blur, for thumbnails),
// ring (a ring in the page color around the drop, for overlapping thumbnails), shadow (default on).
function dropify(box, key, aspect = 1, opt = {}) {
  if (!DROPS || !box) return box;
  const vh = 100 * aspect, s = dropShape(String(key), vh), id = "dp" + (++dropUid);
  box.classList.add("drop");
  box.style.setProperty("--drop-mask", s.mask);
  box.querySelectorAll(":scope > .drop-under, :scope > .drop-gloss").forEach(el => el.remove());
  // Seeded per drop (the same each time), but not from the outline's own random stream.
  const R = dropRand(dropHash(key + "#gloss")), sc = (k, dx = 0, dy = 0) => `translate(${(s.cx * (1 - k) + dx).toFixed(2)} ${(s.cy * (1 - k) + dy).toFixed(2)}) scale(${k})`;
  let under = "";
  if (opt.ring) under += `<path d="${s.d}" fill="none" style="stroke: var(--bg)" stroke-width="${opt.ring}"/>`;
  if (opt.shadow !== false) under += opt.small
    ? `<path d="${s.d}" transform="translate(0 1.4)" fill="rgba(40,30,20,.14)"/>`
    : `<defs><filter id="${id}s" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation=".8"/></filter>
        <filter id="${id}a" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3"/></filter></defs>
      <path d="${s.d}" transform="translate(.4 1.6)" fill="rgba(40,30,20,.07)" filter="url(#${id}a)"/>
      <path d="${s.d}" transform="translate(.25 .7)" fill="rgba(40,30,20,.2)" filter="url(#${id}s)"/>`;
  let swirl = "";
  if (!opt.small) for (let i = 0; i < 3; i++) {
    const k = .42 + R() * .4, dx = (R() - .5) * 8, dy = (R() - .5) * 8, len = 10 + R() * 16, off = R() * 100;
    swirl += `<path d="${s.d}" transform="${sc(k, dx, dy)}" pathLength="100" stroke-dasharray="${len.toFixed(1)} 100" stroke-dashoffset="${off.toFixed(1)}" fill="none" stroke="#fff" stroke-opacity=".1" stroke-width="${(1.2 / k).toFixed(2)}" stroke-linecap="round" filter="url(#${id}b2)"/>
      <path d="${s.d}" transform="${sc(k, dx + .5, dy + .9)}" pathLength="100" stroke-dasharray="${len.toFixed(1)} 100" stroke-dashoffset="${off.toFixed(1)}" fill="none" stroke="#000" stroke-opacity=".07" stroke-width="${(.9 / k).toFixed(2)}" stroke-linecap="round" filter="url(#${id}b2)"/>`;
  }
  const edgeW = opt.small ? 2.4 : 1.3, rimW = opt.small ? 1.4 : .7;
  const gloss = `<defs>
      <clipPath id="${id}c"><path d="${s.d}"/></clipPath>
      <linearGradient id="${id}e" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".32" stop-color="#fff" stop-opacity="0"/>
        <stop offset=".85" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity=".18"/>
      </linearGradient>
      <radialGradient id="${id}h" cx=".36" cy=".3" r=".5"><stop offset="0" stop-color="#fff" stop-opacity=".1"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
      <filter id="${id}b1"><feGaussianBlur stdDeviation=".3"/></filter>
      <filter id="${id}b2"><feGaussianBlur stdDeviation=".9"/></filter>
    </defs>
    <g clip-path="url(#${id}c)">
      <rect width="100" height="${vh}" fill="url(#${id}h)"/>
      ${swirl}
      <path d="${s.d}" fill="none" stroke="url(#${id}e)" stroke-width="${edgeW}" ${opt.small ? "" : `filter="url(#${id}b1)"`} transform="${sc(.988)}"/>
      <path d="${s.d}" fill="none" stroke="#000" stroke-opacity=".2" stroke-width="${rimW}" ${opt.small ? "" : `filter="url(#${id}b1)"`}/>
    </g>`;
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

/* Card text alignment at 3 per row: centered under the swatch (default) or left-aligned. */
const ALIGN_KEY = "polish-shelf:card-align";
let CARD_ALIGN = "center";
try { if (JSON.parse(localStorage.getItem(ALIGN_KEY)) === "left") CARD_ALIGN = "left"; } catch (e) {}
document.documentElement.dataset.cardAlign = CARD_ALIGN;

/* Developer settings: five quick taps on the page title open a small panel to switch the swatch shape
   and the card text alignment. */
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
        <div class="dev-row"><span id="devAlignLabel">Card text</span>
          <div class="dev-seg" role="radiogroup" aria-labelledby="devAlignLabel">
            <button type="button" role="radio" data-align="left">Left</button>
            <button type="button" role="radio" data-align="center">Center</button>
          </div></div>
        <button type="button" class="dev-close">Done</button>`;
      // Alignment applies right away (no reload).
      const alignBtns = panel.querySelectorAll("[data-align]");
      const syncAlign = () => alignBtns.forEach(b => b.setAttribute("aria-checked", b.dataset.align === CARD_ALIGN));
      alignBtns.forEach(b => {
        b.onclick = () => {
          CARD_ALIGN = b.dataset.align; document.documentElement.dataset.cardAlign = CARD_ALIGN; syncAlign();
          try { localStorage.setItem(ALIGN_KEY, JSON.stringify(CARD_ALIGN)); } catch (e) {}
        };
      });
      syncAlign();
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
