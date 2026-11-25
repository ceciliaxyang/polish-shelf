/* ---------- droplet swatches ---------- */
// Swatches can be drawn as rectangles (the original cards) or as droplets: each one a small poured puddle
// of polish, round but a little irregular, the shape picked from the polish (or combo) so it stays the
// same every visit. The live swatch canvas is clipped to the drop, so every effect (magnetic flash,
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

// Turn a box holding a swatch canvas into a droplet. `aspect` is the box's height / width. Safe to call
// again after the box's canvas is replaced. Options: small (no swirls or shadow blur, for thumbnails),
// ring (a ring in the page color around the drop, for overlapping thumbnails), shadow (default on).
function dropify(box, key, aspect = 1, opt = {}) {
  if (!DROPS || !box) return box;
  const vh = 100 * aspect, s = dropShape(String(key), vh), id = "dp" + (++dropUid);
  box.classList.add("drop");
  box._drop = s; dropClip(box);
  if (!box._dropSized) { box._dropSized = true; dropRO.observe(box); }
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
