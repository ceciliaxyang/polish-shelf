/* ---------- page address ---------- */
// While a polish is open the address bar shows its share link (p/<id>/, which carries its link preview).
// Pin the base URL first so the site's relative paths (photos, saved data) still resolve from there.
(() => {
  const b = document.querySelector("base") || document.head.appendChild(document.createElement("base"));
  b.setAttribute("href", new URL(".", location.href).href);
})();
const SITE_ROOT = document.baseURI;
const SITE_TITLE = document.title;
const peekLanding = new Set(); // phones: polishes still flying into the Layers peek bar's stack (see quickAdd)

/* ---------- vocabulary ---------- */
const EFFECTS = {
  sheer:     "Sheer",
  jelly:     "Jelly",
  magnetic:  "Magnetic",
  magtopper: "Magnetic topper",
  holo:      "Holographic",
  shimmer:   "Shimmer",
  chrome:    "Chrome",
  creme:     "Creme",
  glitter:   "Glitter",
  flakies:   "Flakies",
  duochrome: "Duochrome",
  multichrome: "Multichrome",
  thermal:   "Thermal",
  solar:     "Solar",
  glow:      "Glow-in-the-dark",
  powder:    "Chrome powder",
};
// Some effects share a category (one filter pill and one card label): chrome counts as multichrome
// (which has no category of its own; see effectsOf), glitter as Shimmer, and sheer magnetic as Magnetic
// topper. Swatches still draw by the polish's own effect.
const CATEGORY = { chrome: "multichrome", glitter: "shimmer", sheermag: "magtopper" };
const category = k => CATEGORY[k] || k;
// Filter pills always shown; other effects get a pill once a polish uses them (see buildPills for the order).
const PILL_EFFECTS = ["magnetic", "holo", "shimmer"];
// Brand filter pills come first in this order (Figma node 2384:82743), then any other brand on the shelf,
// most polishes first. A few brands go by a shorter name on their pill.
const PILL_BRANDS = ["Mooncat", "ILNP", "Awesome Nail Polish", "Bee's Knees"];
const BRAND_LABELS = { "Awesome Nail Polish": "ANLAC", "Bee's Knees": "Bee’s Knees" };

/* ---------- state ---------- */
const $ = s => document.querySelector(s);
const KEY = { combos: "polish-shelf:combos", saved: "polish-shelf:saved-combos", bench: "polish-shelf:bench", zoom: "polish-shelf:zoom-v3" }; // zoom-v3: 4 per row (the most zoomed out) became the default, so earlier saved choices start over
function load(key, fallback) { try { const v = JSON.parse(localStorage.getItem(key)); return v ?? fallback; } catch (e) { return fallback; } }
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); }
  catch (e) { console.warn("Couldn't save combos", e); }
}
function newId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

// Polishes come from js/polishes.js; the bench and saved combos are kept in this browser. (Combos saved by
// an older version, under KEY.combos, are left alone.) `view` is the shelf or the saved combos page.
const state = { polishes: typeof POLISHES !== "undefined" ? POLISHES : [], fx: new Set(), brands: new Set(), finish: null, view: "shelf" };
const combos = load(KEY.saved, []).filter(c => c && Array.isArray(c.layers));
const saveCombos = () => save(KEY.saved, combos);
const bench = { layers: load(KEY.bench, []) };
const saveBench = () => save(KEY.bench, bench.layers);


/* ---------- shelf ---------- */
// How magnetic swatches rest: 0 = glass bead, 1 = cat eye, in between when no finish is picked (the finish pills were removed, so always in between).
function finishH() { return state.finish === "bead" ? 0 : state.finish === "cat" ? 1 : .5; }
function buildPills() {
  // Effects in the order they first turn up on the shelf, so the pills read like the swatches below them
  // (the always-shown ones go last if no polish has them yet).
  const used = state.polishes.flatMap(filterKeysOf).filter(k => EFFECTS[k]);
  const box = $("#fxPills");
  [...new Set([...used, ...PILL_EFFECTS])].forEach(k => {
    const b = document.createElement("button"); b.type = "button"; b.className = "scope"; b.setAttribute("aria-pressed", "false");
    // Icon first, then the label (Figma "Filters", node 2383:2326); see js/icons.js.
    if (EFFECT_ICONS[k]) b.innerHTML = `<svg class="scope-icon" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><g>${EFFECT_ICONS[k]}</g></svg>`;
    b.append(EFFECTS[k]);
    b.dataset.fx = k; b.onclick = () => toggleFx(k);
    box.appendChild(b);
  });
  // Brands: same pill, with an icon after each brand's logo (js/brand-icons.js).
  const count = {};
  state.polishes.forEach(p => { if (p.brand) count[p.brand] = (count[p.brand] || 0) + 1; });
  const brands = [...PILL_BRANDS.filter(b => count[b]), ...Object.keys(count).filter(b => !PILL_BRANDS.includes(b)).sort((a, b) => count[b] - count[a])];
  brands.forEach(k => {
    const b = document.createElement("button"); b.type = "button"; b.className = "scope"; b.setAttribute("aria-pressed", "false");
    if (typeof BRAND_ICONS !== "undefined" && BRAND_ICONS[k]) b.innerHTML = `<svg class="scope-icon" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><g>${BRAND_ICONS[k]}</g></svg>`;
    b.append(BRAND_LABELS[k] || k);
    b.dataset.brand = k; b.onclick = () => toggleBrand(k);
    $("#brandPills").appendChild(b);
  });
}

// Pill icons are drawn to fill their 24px box in different ways (a tall thermometer, a wide prism, a full
// circle), so side by side some looked much bigger than others. Each one is scaled and centered so its
// drawing has about the same visual size as the Magnetic icon: close to the same area (about 15.7px
// square), and no taller or wider than 19px. Lines keep their 1.5px weight: stroke widths are scaled back up, and
// solid shapes (the Figma icons are drawn as outlines filled in) get a thin stroke to make up for shrinking.
const ICON_SIZE = 15.7, ICON_MAX = 19, ICON_LINE = 1.5, ICON_EASE = .6;
function fitIcon(svg) {
  const g = svg.firstElementChild; if (!g) return;
  // Parts that only show while the icon animates (sparks, a ripple) don't count toward its size.
  const extras = [...g.querySelectorAll(".ia-x")]; extras.forEach(el => el.style.display = "none");
  let bb; try { bb = g.getBBox(); } catch { return; } finally { extras.forEach(el => el.style.display = ""); }
  if (!bb.width || !bb.height) return;
  // Solar is redrawn in lines with square ends, so its lines don't reach past its outline: no padding.
  const stroked = !!g.querySelector("[stroke]:not([stroke=none])") && !g.querySelector("[data-fit-nopad]"), pad = stroked ? ICON_LINE : 0;
  const w = bb.width + pad, h = bb.height + pad;
  // Shrinking all the way to the same area made open, airy drawings (Flakies, the two ANLAC hearts) look
  // smaller than the solid Magnetic one, so big icons come only most of the way down.
  const k = Math.min((ICON_SIZE / Math.sqrt(w * h)) ** ICON_EASE, ICON_MAX / Math.max(w, h));
  const cx = bb.x + bb.width / 2, cy = bb.y + bb.height / 2;
  g.setAttribute("transform", `translate(12 12) scale(${k.toFixed(4)}) translate(${(-cx).toFixed(3)} ${(-cy).toFixed(3)})`);
  g.querySelectorAll("[stroke-width]").forEach(el => el.setAttribute("stroke-width", (+el.getAttribute("stroke-width") / k).toFixed(3)));
  if (k < 1) g.querySelectorAll('[fill="currentColor"]').forEach(el => {
    if (el.closest("[stroke]")) return;
    el.setAttribute("stroke", "currentColor"); el.setAttribute("stroke-linejoin", "round");
    el.setAttribute("stroke-width", (ICON_LINE * (1 - k) / k).toFixed(3));
  });
}
// Favorite combos switches the page between the shelf and your saved combos (Figma node 2201:98964).
$("#comboBtn").onclick = () => {
  if (document.body.classList.contains("detail-open")) closeDetail(); // tapped over the polish page (phones)
  if (state.view === "combos") closeCombos(); else openCombos();
};
$("#combosClose").onclick = () => closeCombos();
// Favorite combos opens as a full-screen takeover. Only frozen copies of the page move, never the live
// page (Safari left a live page that was moved this way half drawn): on open, a copy of the shelf goes on top
// of everything, the combos are built and drawn underneath, and a copy of them slides up over the dimmed
// shelf; then the copies go, leaving the live combos page exactly where the sheet stopped. Closing does
// the reverse: the shelf comes back underneath (where you left it) and a copy of the combos drops away.
const SHEET = { up: 580, down: 420, shelfY: 0, Z: 45 }; // above the filter bar (40), below the Layers pane (60)
function freezePage() {
  const page = $(".page");
  // Swatches still pouring in (or waiting to) are landed first: the copy can't carry the pour's animations,
  // so copied mid-pour they showed as square puddles, flat grey blobs, or nothing at all. One still undrawn
  // is drawn now, so it's in the copy too.
  page.querySelectorAll(".card.pour-wait, .card.pouring").forEach(card => {
    const r = card.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) return;
    const cv = card.querySelector("canvas.swatch");
    if (cv && !cv._w && (cv._p || cv._combo)) { if (drawIO) drawIO.unobserve(cv); try { drawCard(cv); } catch (e) {} }
    if (typeof pourFinish === "function") pourFinish(card);
  });
  const copy = page.cloneNode(true), wrap = document.createElement("div");
  // The real elements keep their ids. Ids inside the droplets' SVG stay: their gloss, rim and shadow point
  // to them (an SVG url(#id) finds the live twin, which is identical), and without them the copy goes matte.
  copy.querySelectorAll("[id]").forEach(e => { if (!e.closest("svg")) e.removeAttribute("id"); });
  const from = page.querySelectorAll("canvas"), to = copy.querySelectorAll("canvas");
  from.forEach((c, i) => {
    const r = c.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight || !c.width) return;
    try { to[i].getContext("2d").drawImage(c, 0, 0); } catch (e) {}
  });
  // Cards in the copy show as they are (no rise-in), and the close button only on a copy of the combos.
  copy.querySelectorAll(".card.rise").forEach(c => c.classList.add("in"));
  copy.querySelectorAll(".combos-close").forEach(x => { if (state.view === "combos") x.style.display = "flex"; else x.remove(); });
  wrap.className = "page-ghost"; wrap.inert = true; wrap.setAttribute("aria-hidden", "true");
  wrap.style.setProperty("--gy", -scrollY + "px");
  wrap.style.background = getComputedStyle(document.body).backgroundColor;
  wrap.append(copy);
  return wrap;
}
// The combos' first screen is drawn and shown at once (not as they rise into view), so the copy that
// slides up has them.
function revealNow() {
  const limit = innerHeight * 1.5;
  $("#grid").querySelectorAll(".card").forEach(card => {
    if (card.offsetTop > limit) return;
    if (card.classList.contains("rise") && !card.classList.contains("in")) {
      if (riseIO) riseIO.unobserve(card);
      card.style.setProperty("--d", "0s"); card.classList.add("in");
    }
    // Droplet outlines are normally fitted a frame later, once their size is known; fit them now so the
    // copy that slides up (and the page under it) has the right shapes rather than plain ovals.
    if (typeof dropClip === "function") card.querySelectorAll(".drop").forEach(dropClip);
    card.querySelectorAll("canvas").forEach(cv => {
      if (cv._w || !(cv._p || cv._combo)) return;
      if (drawIO) drawIO.unobserve(cv);
      try { drawCard(cv); } catch (e) {}
      if (autoIO && !drifting.has(cv)) drifting.set(cv, newPath()); // start drifting now, not once it's seen
    });
  });
  shapeForScroll(true); // magnetic swatches take their resting shape for where they sit, without easing into it
}
// Pins the copies and dim to the part of the page on screen (they scroll with it; see .page-ghost).
function pinToScreen(...els) { els.forEach(el => { el.style.top = scrollY + "px"; }); }
function sheetDim(z) { const d = document.createElement("div"); d.className = "sheet-dim"; d.style.zIndex = z; return d; }
// The shelf's cards (swatches already drawn) are set aside while the combos are up and put back on close, so
// returning is instant instead of redrawing every swatch. Nothing on the shelf can change meanwhile.
function showView(v, y) {
  const grid = $("#grid");
  if (v === "combos") SHEET.cards = [...grid.childNodes];
  setView(v);
  if (v === "shelf" && SHEET.cards) { grid.replaceChildren(...SHEET.cards); syncSwatchButtons(); } else renderShelf();
  SHEET.cards = v === "combos" ? SHEET.cards : null;
  scrollTo({ top: y, behavior: "instant" });
}
// Removes the copies once the move ends, or after a moment in case the animation never reports back.
function afterSheet(ms, anim, ...els) {
  let done = false;
  const end = () => { if (done) return; done = true; els.forEach(e => e.remove()); };
  anim.finished.then(end, end); setTimeout(end, ms + 250);
}
async function openCombos() {
  SHEET.shelfY = scrollY;
  if (reduceMotion) return showView("combos", 0);
  const body = document.body, under = freezePage(), dim = sheetDim(SHEET.Z + 1);
  under.style.zIndex = SHEET.Z; dim.style.opacity = 0;
  pinToScreen(under, dim);
  body.append(under, dim); // the shelf, frozen, covers the page while it changes underneath
  SHEET.shelfCopy = under; // kept (off the page) for swiping the combos back down to it: see the gestures below
  let sheet = null;
  try {
    showView("combos", 0);
    pinToScreen(under, dim); // the page is now at the top
    revealNow();
    // Two frames for the moving swatches (magnetic, shimmer...) to start, so the copy shows them as they'll be.
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    sheet = freezePage(); sheet.style.zIndex = SHEET.Z + 2; sheet.style.transform = "translateY(100%)";
    pinToScreen(sheet); body.append(sheet);
    // One frame with the copy in place below the screen, so painting it doesn't eat the start of the slide.
    await new Promise(r => requestAnimationFrame(r));
  } catch (e) { under.remove(); dim.remove(); if (sheet) sheet.remove(); throw e; }
  dim.animate([{ opacity: 0 }, { opacity: 1 }], { duration: SHEET.up, easing: "ease-out", fill: "forwards" });
  const move = sheet.animate([{ transform: "translateY(100%)" }, { transform: "none" }], { duration: SHEET.up, easing: "cubic-bezier(.32, .72, 0, 1)", fill: "forwards" }); // iOS's sheet curve: visibly rises from the bottom
  afterSheet(SHEET.up, move, under, dim);
  // Once it lands, the copy fades into the live page (whose swatches have started moving) instead of
  // swapping in one frame.
  const fade = () => sheet.isConnected && sheet.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, easing: "ease-out", fill: "forwards" });
  afterSheet(SHEET.up + 260, { finished: move.finished.then(() => { const f = fade(); return f && f.finished; }) }, sheet);
}
async function closeCombos() {
  if (state.view !== "combos") return;
  SHEET.shelfCopy = null;
  if (reduceMotion) return showView("shelf", SHEET.shelfY);
  const sheet = freezePage(), dim = sheetDim(SHEET.Z + 1);
  sheet.style.zIndex = SHEET.Z + 2;
  pinToScreen(dim, sheet); document.body.append(dim, sheet);
  try { showView("shelf", SHEET.shelfY); pinToScreen(dim, sheet); } catch (e) { sheet.remove(); dim.remove(); throw e; }
  await new Promise(r => requestAnimationFrame(r)); // the shelf paints under the copy before it drops
  dim.animate([{ opacity: 1 }, { opacity: 0 }], { duration: SHEET.down, easing: "ease-in", fill: "forwards" });
  const move = sheet.animate([{ transform: "none" }, { transform: "translateY(100%)" }], { duration: SHEET.down, easing: "cubic-bezier(.4, 0, .7, .2)", fill: "forwards" });
  afterSheet(SHEET.down, move, dim, sheet);
}
// The button's two thumbnails: the two newest saved combos, or the first polishes on the shelf until
// there are any.
// Favorite combos only appears once a combo is saved, rising in the first time.
// Deleting the last combo while on the combos page goes back to the shelf.
// The filters belong to the shelf: on the combos page they're hidden (and don't
// filter the combos); the picks come back when you return to the shelf.
function setView(v) {
  state.view = v;
  $("#comboBtn").setAttribute("aria-pressed", v === "combos");
  $(".shelf-head").classList.toggle("combos-view", v === "combos");
  $("#shelfTitle").textContent = v === "combos" ? "Favorite combos" : "Polish shelf";
  $("#filters").inert = v === "combos";
  $("#grid").classList.toggle("combos-grid", v === "combos");
  // The combos page always shows at the most zoomed in level (zoom bar hidden); the shelf keeps its own zoom.
  document.documentElement.classList.toggle("view-combos", v === "combos");
  $("#grid").dataset.zoom = zoomLevel();
  fitGrid();
  if (miniReady) syncMiniNav(); // the mini nav belongs to the shelf: hide or show it for the new view
}
function syncComboBtn() {
  const btn = $("#comboBtn"), none = !combos.length;
  if (!none && btn.hidden) { btn.classList.remove("rise-in"); void btn.offsetWidth; btn.classList.add("rise-in"); }
  btn.hidden = none;
  if (none && state.view === "combos") { setView("shelf"); renderShelf(); }
}
function renderComboThumbs() {
  if (renderComboThumbs.hold) return; // a combo is still being saved; the button updates when it's done
  syncComboBtn();
  rollCount(combos.length);
  const picks = combos.slice(-2).reverse().map(c => ({ layers: c.layers }));
  for (const p of state.polishes) { if (picks.length >= 2) break; picks.push({ p }); }
  [".tp-front", ".tp-back"].forEach((sel, i) => {
    const box = $("#comboThumbs " + sel), pick = picks[i]; box.innerHTML = "";
    if (!pick) return;
    const c = document.createElement("canvas");
    if (pick.p) renderSwatch(c, pick.p, 40, 40); else drawStack(c, pick.layers, 40, 40);
    box.appendChild(c);
    dropify(box, pick.p ? pick.p.id : dropKeyFor(pick.layers), 1, { small: true });
  });
}

// The count after the label ("Combos 5"). When it changes it rolls like an odometer: the old number slides up
// and out while the new one rolls up from below (down, when one is deleted). Timed to land at the top of the pill's pop when a combo is saved.
function rollCount(n) {
  // With no combos there's no number at all, so the first save doesn't roll a 0 into a 1: the 1 just appears
  // (its badge fading and growing in). Every later change rolls inside the badge.
  const box = $("#comboCount"), cur = box.querySelector(".cc-num"), was = cur ? +cur.textContent : 0;
  const first = !box.dataset.ready; box.dataset.ready = "1";
  if (was === n) return;
  if (!n) { box.replaceChildren(); return; }
  const next = Object.assign(document.createElement("span"), { className: "cc-num", textContent: n });
  if (first || reduceMotion || box.closest("[hidden]")) { box.replaceChildren(next); return; }
  if (!cur) {
    box.replaceChildren(next); // the badge itself grows in, circle and number together
    box.animate([{ transform: "scale(.5)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 380, delay: 90, easing: "cubic-bezier(.3, 1.4, .5, 1)", fill: "backwards" });
    return;
  }
  box.querySelectorAll(".cc-num.out").forEach(el => el.remove());
  cur.classList.add("out"); box.appendChild(next);
  const dir = n > was ? 1 : -1, opts = { duration: 480, delay: 90, easing: "cubic-bezier(.3, 1.3, .4, 1)", fill: "backwards" };
  cur.animate([{ transform: "none", opacity: 1 }, { transform: `translateY(${-dir * 110}%)`, opacity: 0 }], { ...opts, easing: "cubic-bezier(.4, 0, .6, 1)", fill: "forwards" }).onfinish = () => cur.remove();
  next.animate([{ transform: `translateY(${dir * 110}%)`, opacity: 0 }, { transform: "none", opacity: 1 }], opts);
}

function toggleFx(k) {
  state.fx.has(k) ? state.fx.delete(k) : state.fx.add(k);
  document.querySelectorAll("#fxPills .scope").forEach(b => b.setAttribute("aria-pressed", state.fx.has(b.dataset.fx)));
  showFilterCounts();
  filterShelf();
}
// A magnetic topper also counts as Magnetic for the filter (its card still reads just "Magnetic topper").
const filterKeysOf = p => { const l = labelsOf(p); return l.includes("magtopper") ? [...l, "magnetic"] : l; };
// Pick several effects or several brands to see any of them; an effect and a brand together narrow it down.
const matchesFx = p => (!state.fx.size || filterKeysOf(p).some(k => state.fx.has(k))) && (!state.brands.size || state.brands.has(p.brand));
function toggleBrand(k) {
  state.brands.has(k) ? state.brands.delete(k) : state.brands.add(k);
  document.querySelectorAll("#brandPills .scope").forEach(b => b.setAttribute("aria-pressed", state.brands.has(b.dataset.brand)));
  showFilterCounts();
  filterShelf();
}
// "Effects (2)" / "Brands (1)": how many pills are picked in each row, in grey like "Layers (2)" on the phone sheet.
// On phones the label sits right next to its pills, so a count showing up (or going) makes the label wider (or
// narrower) and the pill row would jump sideways under your finger. The row is scrolled by the same amount
// instead, so every pill stays exactly where it was. (On wider screens the count sits in the gap, see style.css.)
function showFilterCounts() {
  [["#fxCount", "#fxPills", state.fx.size], ["#brandCount", "#brandPills", state.brands.size]].forEach(([c, row, n]) => {
    const el = $(c), box = $(row), x = box.getBoundingClientRect().left, text = n ? `(${n})` : "";
    if (el.textContent === text) return;
    el.textContent = text;
    const dx = box.getBoundingClientRect().left - x;
    if (dx) box.scrollLeft += dx;
  });
  fadeScopes();
}

/* Filtering keeps the shelf as it is: no card is rebuilt and no swatch redrawn. Polishes that don't
   match fade and shrink away where they stand, the ones that stay glide to their new places, and ones
   that match again fade back in. Cards are hidden, not removed, so a swatch that comes back is already drawn. */
const FILTER_MS = { out: 220, move: 480, in: 380 };
function filterShelf() {
  const grid = $("#grid");
  const cards = [...grid.children].filter(c => c._p);
  if (state.view !== "shelf" || !cards.length) return renderShelf();
  // Settle any filter animation still running from a quick earlier tap, so positions are measured at rest.
  cards.forEach(c => c.getAnimations().forEach(a => { if (a.id === "filter") a.finish(); }));
  grid.querySelectorAll(".card-fx .pill").forEach(b => b.setAttribute("aria-pressed", state.fx.has(b.dataset.fx)));
  const animate = !reduceMotion, gr = grid.getBoundingClientRect();
  const before = new Map(cards.filter(c => !c.hidden).map(c => [c, c.getBoundingClientRect()]));
  const leaving = cards.filter(c => !c.hidden && !matchesFx(c._p));
  const entering = cards.filter(c => c.hidden && matchesFx(c._p));
  const staying = cards.filter(c => !c.hidden && matchesFx(c._p));

  // Leaving cards come out of the layout at once (so the rest can move) but stay where they are while they fade.
  leaving.forEach(c => {
    const r = before.get(c);
    if (!animate) { c.hidden = true; return; }
    Object.assign(c.style, { position: "absolute", left: r.left - gr.left + "px", top: r.top - gr.top + "px", width: r.width + "px", pointerEvents: "none", zIndex: 0 });
    const a = c.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "scale(.9)" }], { duration: FILTER_MS.out, easing: "ease-in", fill: "forwards" });
    a.id = "filter";
    a.onfinish = () => { c.hidden = true; ["position", "left", "top", "width", "pointerEvents", "zIndex"].forEach(k => c.style[k] = ""); a.cancel(); };
  });
  entering.forEach(c => { c.hidden = false; c.classList.add("in"); });

  let empty = grid.querySelector(":scope > .empty");
  const none = !staying.length && !entering.length;
  if (none && !empty) grid.insertAdjacentHTML("beforeend", emptyMsg("No matches", "No polishes match those filters yet."));
  if (!none && empty) empty.remove();

  // The cards that stay glide from where they were to where they now sit.
  if (animate) staying.forEach(c => {
    const a = before.get(c), b = c.getBoundingClientRect(), dx = a.left - b.left, dy = a.top - b.top;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
    c.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], { duration: FILTER_MS.move, easing: EASE }).id = "filter";
  });
  if (animate) entering.forEach(c => {
    c.animate([{ opacity: 0, transform: "scale(.9)" }, { opacity: 1, transform: "none" }], { duration: FILTER_MS.in, delay: FILTER_MS.out * .6, easing: EASE, fill: "backwards" }).id = "filter";
  });
  // A swatch shown again is drawn only if it never was, or the card's size changed while it was hidden.
  entering.forEach(c => {
    const cv = c.querySelector(".swatch");
    if (cv._w && sizeStillFits(cv)) return;
    cv._w = 0; drawIO && drawIO.unobserve(cv); queueDraw(cv);
  });
  shapeForScroll(true);
}
// A polish's rendering uses `effect`; `effects` (optional) lists everything it should be found under.
// There's no Multichrome category (chrome counts as multichrome): those labels are dropped, and a polish
// left with no label is filed under Shimmer.
// Sheer isn't a category (no filter pill or label); a sheer polish still layers as one (see isSheer).
function effectsOf(p) {
  const fx = [...new Set((p.effects || [p.effect]).map(category))].filter(k => k !== "multichrome" && k !== "sheer");
  return fx.length ? fx : ["shimmer"];
}
// What a polish is called on its card, detail view and layer: a magnetic polish's shimmer is part of being
// magnetic, so "Magnetic · Shimmer" reads just "Magnetic" (the same for Magnetic topper), and it is left out
// of the Shimmer filter.
function labelsOf(p) {
  const fx = effectsOf(p);
  return fx.includes("magnetic") || fx.includes("magtopper") ? fx.filter(k => k !== "shimmer") : fx;
}

// Plus while the polish is off the bench; it spins away and a checkmark draws in once it's added.
const PLUS_CHECK = `<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"><path class="plus" d="M10 3.5v13M3.5 10h13"/><path class="check" pathLength="1" d="M4.5 10.5l3.5 3.5 7.5-8"/></svg>`;
// The dialog's add button sits beside the 16px link and close icons, so its + is drawn shorter (11px, not
// 13px) at the same 1.5px stroke as them, rather than scaled down, which thinned the stroke.
const MODAL_PLUS_CHECK = PLUS_CHECK.replace("M10 3.5v13M3.5 10h13", "M10 4.5v11M4.5 10h11");

function emptyMsg(title, body) { return `<div class="empty"><strong>${title}</strong>${body}</div>`; }

function renderShelf() {
  if (state.view === "combos") return renderCombos();
  const grid = $("#grid"); grid.innerHTML = "";
  if (!state.polishes.length) { grid.innerHTML = emptyMsg("Your shelf is empty", "Add your polishes to js/polishes.js and they will show up here."); return; }
  // Every polish gets a card; ones the effect filters leave out are hidden (see filterShelf).
  if (!state.polishes.some(matchesFx)) grid.innerHTML = emptyMsg("No matches", "No polishes match those filters yet.");
  for (const p of state.polishes) {
    const card = document.createElement("article"); card.className = "card";
    card._p = p; card.hidden = !matchesFx(p);
    const wrap = document.createElement("div"); wrap.className = "swatch-wrap";
    const sw = document.createElement("canvas"); sw.className = "swatch";
    const add = document.createElement("button"); add.type = "button"; add.className = "swatch-btn"; add.innerHTML = PLUS_CHECK; add.dataset.pid = p.id;
    add.dataset.name = p.name;
    add.onclick = () => bench.layers.some(l => l.pid === p.id) ? removePolish(p) : addLayer(p);
    wrap.append(sw, add);
    dropify(wrap, p.id, 260 / 240);
    sw.tabIndex = 0; sw.setAttribute("role", "button"); sw.setAttribute("aria-label", `View ${p.name}`);
    sw.onclick = () => openDetail(p, wrap);
    sw.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openDetail(p, wrap); } };
    const text = document.createElement("div"); text.className = "card-text";
    const title = document.createElement("div"); title.className = "card-title";
    const br = document.createElement("p"); br.className = "brand"; br.textContent = p.brand || ""; br.title = br.textContent;
    const nm = document.createElement("p"); nm.className = "name"; nm.textContent = p.name || "Untitled"; nm.title = nm.textContent;
    // The effect types as one line of small text (shown at 3 per row, in place of the pills).
    const ty = document.createElement("p"); ty.className = "card-type"; ty.textContent = labelsOf(p).map(k => EFFECTS[k] || k).join(" · "); ty.title = ty.textContent;
    title.append(br, nm, ty);
    const fx = document.createElement("div"); fx.className = "card-fx";
    labelsOf(p).forEach(k => {
      const b = document.createElement("button"); b.type = "button"; b.className = "pill tiny"; b.textContent = EFFECTS[k] || k;
      b.setAttribute("aria-pressed", state.fx.has(k)); b.dataset.fx = k; b.onclick = () => toggleFx(k);
      fx.appendChild(b);
    });
    text.append(title, fx);
    card.append(wrap, text); grid.appendChild(card);
    // Droplets pour in as they come on screen; rectangles rise in.
    if (!pourIn(card, p.id, p.baseColor || p.colors[0])) { card.classList.add("rise"); riseIn(card); }
    sw._p = p; queueDraw(sw);
    if (autoIO) autoIO.observe(sw);
  }
  syncSwatchButtons();
  fillIdle();
}

/* ---------- saved combos ---------- */
// Combos page (Figma node 2406:3621): one card per saved combo, newest first. The layered swatch sits in
// the middle with the combo's polishes scattered around it as smaller droplets, then the name and the
// polishes it's made of (base first). Every combo scatters its polishes a little differently: which side
// each one lands on, how far out, how high and how big are picked from the combo's id, so a combo always
// looks the same from one visit to the next.
// Tapping a combo's swatch loads it into the Layers pane, where it can be deleted.
// The scattered polishes, in units of the middle swatch's width, measured from its center: x, y (down) and
// size s. They sit off the swatch's left and right edges (above would run into the row above, below into
// the name), the big ones 27% of the swatch's width and the small ones 21% (Figma: 84px and 64px drops
// beside a 310px one), never on top of each other.
function comboScatter(c, n) {
  const R = dropRand(dropHash("scatter:" + (c.id || layerKey(c.layers)))), out = [];
  for (let i = 0; i < n; i++) {
    let pick;
    for (let t = 0; t < 60; t++) {
      const right = R() < .5, deg = right ? -40 + R() * 85 : 135 + R() * 90, a = deg * Math.PI / 180;
      const s = R() < .5 ? .27 : .21, r = .64 + R() * .14;
      pick = { x: Math.cos(a) * r, y: Math.sin(a) * r * .95, s };
      if (out.every(o => Math.hypot(o.x - pick.x, o.y - pick.y) > (o.s + pick.s) * .6 + .03)) break;
    }
    out.push(pick);
  }
  return out;
}
function renderCombos() {
  const grid = $("#grid"); grid.innerHTML = "";
  // Empty state (Figma node 2212:1478): three cards (the outer two tilted) over a line of copy, each showing
  // a polish picked at random from the whole shelf (a new mix each time) as a placeholder swatch.
  if (!combos.length) {
    grid.innerHTML = `<div class="combos-empty"><div class="ce-cards" aria-hidden="true"><span class="ce-card ce-1"></span><span class="ce-card ce-2"></span><span class="ce-card ce-3"></span></div><p class="ce-text">Layer different polishes to make custom creations</p></div>`;
    const pool = [...state.polishes];
    grid.querySelectorAll(".ce-card").forEach(card => {
      if (!pool.length) return;
      const p = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
      const w = Math.round(card.getBoundingClientRect().width) || 235, cv = document.createElement("canvas");
      renderSwatch(cv, p, w, w); card.appendChild(cv);
      dropify(card, p.id, 1);
    });
    return;
  }
  const list = [...combos].reverse(), H = 260 / 240;
  for (const c of list) {
    const card = document.createElement("article"); card.className = "card rise combo-card"; riseIn(card);
    const art = document.createElement("div"); art.className = "combo-art";
    const wrap = document.createElement("div"); wrap.className = "swatch-wrap";
    const sw = document.createElement("canvas"); sw.className = "swatch";
    wrap.append(sw);
    dropify(wrap, dropKeyFor(c.layers), H);
    sw.tabIndex = 0; sw.setAttribute("role", "button"); sw.setAttribute("aria-label", `Open ${c.name} in Layers`);
    sw.onclick = () => loadCombo(c);
    sw.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); loadCombo(c); } };
    art.append(wrap);
    // Each polish once, base first (a polish used in two layers shows once).
    const polishes = [...new Map(liveLayers(c.layers).map(L => [L.polish.id, L.polish])).values()];
    comboScatter(c, polishes.length).forEach((at, i) => {
      const p = polishes[i], sat = document.createElement("span"); sat.className = "combo-sat";
      sat.style.left = (50 + (at.x - at.s / 2) * 100).toFixed(2) + "%";
      sat.style.top = (50 + (at.y - at.s * H / 2) / H * 100).toFixed(2) + "%";
      sat.style.width = (at.s * 100).toFixed(2) + "%";
      // Drawn like a shelf swatch (lazily, at its real size), so it shimmers on hover and drifts on touch screens.
      const t = document.createElement("canvas"); t.className = "swatch";
      sat.append(t); dropify(sat, p.id, H);
      art.append(sat);
      t._p = p; queueDraw(t);
      if (autoIO) autoIO.observe(t);
    });
    const text = document.createElement("div"); text.className = "card-text";
    const title = document.createElement("div"); title.className = "card-title";
    const nm = document.createElement("p"); nm.className = "name"; nm.textContent = c.name; nm.title = c.name;
    // One line per polish, base first: "Base: Fields of Lavender", "Topper: Pandora's Box". With more than one
    // topper they're numbered in the order they go on ("Topper 1", "Topper 2").
    const made = document.createElement("div"); made.className = "combo-polishes";
    polishes.forEach((p, i) => {
      const label = i === 0 ? "Base" : polishes.length > 2 ? `Topper ${i}` : "Topper";
      const line = document.createElement("p"); line.textContent = `${label}: ${p.name}`; line.title = line.textContent;
      made.append(line);
    });
    title.append(nm, made);
    text.append(title);
    card.append(art, text); grid.appendChild(card);
    sw._combo = c; queueDraw(sw);
    if (autoIO) autoIO.observe(sw);
  }
  fillIdle();
}
// Deleting (from the Layers pane) is immediate. The layers stay on the bench, so it can be saved again.
function deleteCombo(c) {
  const at = combos.indexOf(c); if (at < 0) return;
  combos.splice(at, 1); saveCombos(); renderShelf(); renderBench();
}
function loadCombo(c) {
  bench.layers = c.layers.map(l => ({ ...l })); saveBench();
  if (!benchIsOpen()) setBenchOpen(true); else renderBench();
  if (sheetMQ.matches) setSheet(true);
}
// The saved combo that matches what's on the bench right now, if any (same polishes, coats and order).
const layerKey = layers => layers.map(l => l.pid + ":" + l.coats).join("|");
const benchCombo = () => bench.layers.length ? combos.find(c => layerKey(c.layers) === layerKey(bench.layers)) : null;
// Saved combos are named like a new polish, mixing the base polish's name with a "flavor" polish: the highest
// upper layer that isn't a sheer topper ("Pandora's Box" under "Bubbly" over "Banished Prince" makes "Pandora's Prince").
// In order, the first rule that fits wins:
// - A flavor shaped "X of Y" lends its "of": a plural base takes the tail ("Sprites of all Evil"), any other base
//   becomes the object ("Garden of Nobody").
// - A base starting with a possessive keeps it with the flavor's noun: "Pandora's Nobody".
// - A flavor that reads as a sentence follows the base as "-ing": "Jasmine Dragon Not Drowning".
// - A base that reads as a sentence keeps its last clause behind the flavor: "Teddy You Fear",
//   "Dark Horse Will Not Drown" (only "will", "not" and the like are kept before the last word).
// - A base shaped "X of Y" keeps its shape with the flavor's first word, or its whole name when that starts with an
//   adjective: "Fields of Sin", "Root of Dark Horse". "Fake" is dropped: "Queen of the Halo".
// - A one-word base goes in front of the whole flavor name: "Moonlit Koi Whiskers".
// - A one-word flavor goes in front if it's a color ("Sunset Omens"), fuses if it's a compound ("Ragejelly"),
//   and otherwise follows the base's name ("Knight Lily", "Memento Mori Sprites").
// - Otherwise a flavor word goes in front of the base's noun: a color the name ends in ("Pink Beetle"), every word
//   before its noun ("Green-eyed Soul"), or its noun made singular ("Petal Viper").
// Numbers, punctuation and phrases after "of", "for", "not" and the like are skipped. Names get "No. 2" if taken.
const NAME_STOP = new Set(["a", "an", "the", "of", "for", "and", "in", "on", "to", "my", "by", "not", "will", "have", "is", "am", "are", "i", "you", "all"]);
const PRONOUNS = new Set(["i", "you", "we", "they"]);
const KEEP_IN_CLAUSE = new Set(["will", "not", "can", "cannot", "won't", "don't", "never", "shall", "must"]);
const DROPPED_ADJECTIVES = new Set(["fake"]);
const ADJECTIVES = new Set(["dark", "deadly", "bottled", "banished", "sweet", "bright", "little", "wild", "golden", "holy", "broken", "lost", "green", "eyed"]);
const COLOR_WORDS = new Set(["pink", "red", "blue", "green", "purple", "violet", "lilac", "lavender", "gold", "golden", "silver", "orange", "yellow", "teal", "white", "black", "rose", "coral", "peach", "plum", "berry", "ruby", "jade", "bronze", "copper", "sunset", "aurora"]);
const COMPOUND_HEADS = ["moon", "sun", "star", "sky", "sea", "snow", "fire", "rain"];
const cap = w => w.charAt(0).toUpperCase() + w.slice(1);
const plural = w => /[^s]s$/i.test(w);
const gerund = w => w.replace(/e$/i, "") + (/[^aeiou][aeiou][bdgmnpt]$/i.test(w) && w.length < 5 ? w.slice(-1) : "") + "ing";
const isSentence = n => n.pronoun >= 0 && n.pronoun < n.words.length - 1;
const possessive = w => /['’]s$/i.test(w || "");
function nameParts(p) {
  const s = ((p && p.name) || "").replace(/^[^\p{L}]*\d[^\p{L}]*/u, "").split(",")[0];  // "404: Soul…" → "Soul…"; "Knight, Knave…" → "Knight"
  const words = s.split(/\s+/).map(w => w.replace(/[^\p{L}'’-]/gu, "")).filter(w => /\p{L}/u.test(w));
  const stop = words.findIndex((w, i) => i > 0 && NAME_STOP.has(w.toLowerCase()));
  const head = stop > 0 ? words.slice(0, stop) : words.filter(w => !NAME_STOP.has(w.toLowerCase()));
  const isOf = stop > 0 && words[stop].toLowerCase() === "of", the = isOf && (words[stop + 1] || "").toLowerCase() === "the";
  return {
    words, head, noun: head[head.length - 1] || "",
    ofHead: isOf ? words.slice(0, stop + (the ? 2 : 1)).join(" ") : "",              // "Queen of the"
    ofTail: isOf ? words.slice(stop + 1).map(w => NAME_STOP.has(w.toLowerCase()) ? w.toLowerCase() : w).join(" ") : "",  // "all Evil"
    pronoun: words.reduce((at, w, i) => PRONOUNS.has(w.toLowerCase()) ? i : at, -1),
  };
}
function flavorWord(f) {
  const last = f.head[f.head.length - 1] || "";
  if (f.head.length > 1 && COLOR_WORDS.has(last.toLowerCase())) return last;
  if (f.head.length > 1) return f.head.slice(0, -1).map((w, i) => i ? w.toLowerCase() : w).join("-");
  return plural(last) ? last.slice(0, -1) : last;
}
function comboName(layers) {
  const live = layers.filter(l => polishById(l.pid));
  const baseP = polishById((live[0] || layers[0] || {}).pid), uppers = live.slice(1).map(l => polishById(l.pid));
  const flavorP = [...uppers].reverse().find(p => p.effect !== "sheermag") || uppers[uppers.length - 1];
  const base = nameParts(baseP), fl = nameParts(flavorP), flName = fl.head.join(" ");
  let name;
  if (!base.noun || !fl.noun) name = base.noun || fl.noun || "Untitled";
  else if (fl.ofHead) name = plural(base.noun) ? `${base.noun} of ${fl.ofTail}` : `${fl.ofHead} ${base.noun}`;
  else if (possessive(base.head[0]) && base.head.length > 1) name = `${base.head[0]} ${fl.noun}`;
  else if (isSentence(fl)) {
    const rest = fl.words.slice(fl.pronoun + 1), last = rest[rest.length - 1];
    name = [base.head.join(" "), rest.some(w => w.toLowerCase() === "not") ? "Not" : "", cap(gerund(last.toLowerCase()))].filter(Boolean).join(" ");
  }
  else if (isSentence(base)) {
    const rest = base.words.slice(base.pronoun + 1);
    name = rest.length === 1 ? `${flName} ${base.words[base.pronoun]} ${rest[0]}`
      : [flName, ...rest.slice(0, -1).filter(w => KEEP_IN_CLAUSE.has(w.toLowerCase())), rest[rest.length - 1]].join(" ");
  }
  else if (base.ofHead) {
    const h = fl.head.filter(w => !DROPPED_ADJECTIVES.has(w.toLowerCase()));
    name = `${base.ofHead} ${h.length && ADJECTIVES.has(h[0].toLowerCase()) ? h.join(" ") : h[0] || fl.noun}`;
  }
  else if (base.words.length === 1) name = `${base.words[0]} ${flName}`;
  else if (fl.words.length === 1) {
    const w = fl.words[0], pre = COMPOUND_HEADS.find(h => w.toLowerCase().startsWith(h) && w.length > h.length + 2);
    name = COLOR_WORDS.has(w.toLowerCase()) ? `${w} ${base.noun}` : pre ? base.noun + w.slice(pre.length).toLowerCase() : `${base.head.join(" ")} ${w}`;
  } else name = `${cap(flavorWord(fl))} ${base.noun}`;
  if (baseP === flavorP || name.toLowerCase() === base.noun.toLowerCase()) name = `${base.noun} Remix`;
  const taken = new Set(combos.map(c => c.name));
  let out = name, n = 2;
  while (taken.has(out)) out = `${name} No. ${n++}`;
  return out;
}
function saveCombo() {
  if (liveLayers(bench.layers).length < 2 || benchCombo() || renderComboThumbs.hold) return;
  const c = { id: newId(), name: comboName(bench.layers), layers: bench.layers.map(l => ({ pid: l.pid, coats: l.coats })), createdAt: new Date().toISOString() };
  // The Combos button keeps showing the old combos until the pane is gone (see below).
  renderComboThumbs.hold = true;
  combos.push(c); saveCombos();
  saveSequence(c.layers, () => { if (state.view === "combos") renderShelf(); });
}
// Saving, in four beats, each moving only transform and opacity (nothing is laid out again until the end):
// 1. the button reads "Saving…" for a moment (on phones the sheet tucks down to its peek bar meanwhile);
// 2. like dropping something into a shopping cart, a copy of the combo's swatch arcs from the Layers
//    preview (or the peek bar) into the Combos button;
// 3. the Combos button grows a little and settles as the new combo appears in its thumbnails and the count
//    ticks up;
// 4. the Layers pane slides out to the right and disappears (on phones the sheet slides down off the screen).
// Only then does the shelf take back the pane's room and the dock recenter, and the layers clear (as with Close).
const wait = ms => new Promise(r => setTimeout(r, ms));
async function saveSequence(layers, after) {
  const b = $("#bench"), save = $("#saveCombo"), btn = $("#comboBtn");
  const T = reduceMotion ? { saving: 0, pop: 0, exit: 0 } : { saving: 550, pop: 460, exit: 450 };
  b.inert = true; // nothing in the pane can be pressed while it saves
  save.textContent = "Saving…"; save.classList.add("saving");
  document.body.classList.add("saving-combo"); // shows the Combos pill over the polish page, if that's open
  if (sheetMQ.matches) setSheet(false);
  await wait(T.saving);
  // The first save is what makes the button appear: show it right away (no rise, which would move the
  // landing spot) so it's there to catch the swatch.
  syncComboBtn(); btn.classList.remove("rise-in");
  if (!reduceMotion) await flySwatch(layers);
  renderComboThumbs.hold = false; renderComboThumbs();
  if (!reduceMotion) btn.animate([{ transform: "scale(1)" }, { transform: "scale(1.14)", offset: .4 }, { transform: "scale(.97)", offset: .75 }, { transform: "scale(1)" }], { duration: T.pop, easing: "cubic-bezier(.2, .8, .2, 1)" });
  await wait(T.pop);
  // On desktop this is the pane's usual slide out to the right; on phones the sheet slides straight down
  // off the bottom of the screen.
  if (!sheetMQ.matches) b.classList.remove("open");
  else if (!reduceMotion) {
    b.style.transition = `transform ${T.exit}ms cubic-bezier(.4, 0, .6, 1)`;
    b.style.transform = "translateY(calc(100% + 24px))";
  }
  await wait(T.exit);
  // Hand the pane back to its normal closed state (hidden, no inline styles) and clear the layers.
  b.hidden = true;
  b.style.transition = "none"; b.style.transform = ""; b.style.opacity = ""; b.classList.remove("open", "expanded");
  void b.offsetWidth; b.style.transition = "";
  b.inert = false; save.classList.remove("saving");
  document.body.classList.remove("saving-combo");
  clearBench();
  after();
}
// The cart flight. The flying copy is a flat picture (its outline, edge and shadow drawn into one canvas up
// front) animated only by transform and opacity, so the browser can run it on the graphics card without
// redrawing anything, and nothing else on the page moves while it flies. Resolves once it has landed.
function flySwatch(layers) {
  const tr = $("#comboThumbs").getBoundingClientRect();
  const src = [$("#stage"), $("#peekMini")].find(el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.top < innerHeight && r.bottom > 0; });
  if (!src || !tr.width) return Promise.resolve();
  const from = src.getBoundingClientRect(), W = from.width, H = from.height;
  // The picture: reuse the combined picture already on screen when there is one, otherwise draw the stack
  // once. (Only a canvas directly in the preview: the preview also keeps each layer's own canvas hidden
  // inside it, and those come first, so a plain first-canvas lookup flew just the bottom layer.)
  let pic = src.querySelector(":scope > canvas:not(.drop-swirl)");
  if (!pic || !pic.width) { pic = document.createElement("canvas"); if (!drawStack(pic, layers, Math.round(W), Math.round(H))) return Promise.resolve(); }
  const PAD = 28, dpr = Math.min(2, devicePixelRatio || 1), cv = document.createElement("canvas");
  cv.width = Math.round((W + PAD * 2) * dpr); cv.height = Math.round((H + PAD * 2) * dpr);
  const g = cv.getContext("2d");
  g.scale(dpr, dpr); g.translate(PAD, PAD);
  const shape = new Path2D();
  if (DROPS) { const d = dropShape(dropKeyFor(layers), 100 * H / W); shape.addPath(new Path2D(d.d), new DOMMatrix().scale(W / 100, H / d.vh)); }
  else shape.roundRect(0, 0, W, H, parseFloat(getComputedStyle(src).borderTopLeftRadius) || 12);
  g.save(); g.shadowColor = "rgba(0, 0, 0, .2)"; g.shadowBlur = 24; g.shadowOffsetY = 10; g.fillStyle = "#fff"; g.fill(shape); g.restore();
  g.save(); g.clip(shape); g.drawImage(pic, 0, 0, W, H); g.restore();
  cv.className = "fly-swatch";
  Object.assign(cv.style, { left: from.left - PAD + "px", top: from.top - PAD + "px", width: W + PAD * 2 + "px", height: H + PAD * 2 + "px" });
  document.body.appendChild(cv);
  const s = tr.width / W;
  const dx = tr.left + tr.width / 2 - (from.left + W / 2), dy = tr.top + tr.height / 2 - (from.top + H / 2);
  // One continuous arc that heads for the button from the first frame: it drops toward the button's height
  // first and then sweeps across into it, shrinking at an even visual rate (geometrically), easing in and
  // out over the whole flight, and fading a little at the very end so it melts into the thumbnails.
  const cx = dx * .3, cy = dy, N = 30, frames = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, u = 1 - t;
    const x = 2 * u * t * cx + t * t * dx, y = 2 * u * t * cy + t * t * dy;
    frames.push({ transform: `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) scale(${Math.pow(s, t).toFixed(4)})`, opacity: t < .8 ? 1 : 1 - (t - .8) * 2 });
  }
  const fly = cv.animate(frames, { duration: 620, easing: "cubic-bezier(.45, 0, .2, 1)", fill: "forwards" });
  return new Promise(res => { const done = () => { cv.remove(); res(); }; fly.onfinish = done; fly.oncancel = done; });
}
$("#saveCombo").onclick = () => { const saved = benchCombo(); saved ? deleteCombo(saved) : saveCombo(); };
/* ---------- detail view ---------- */
// Tapping a swatch opens the detail view over a blurred shelf (Figma "Polish detail / Desktop (1440)",
// node 2398:3167): the live swatch grows out of its card into a centered hero, with "Brand — Name" in
// Instrument Serif, the one-line description and the effect pills under it, then the product photos.
// The swatch and the add / link / close buttons stay pinned while the photos scroll under them; the name,
// description and pills fade away once the page scrolls. The link button opens the product page.
const detail = { p: null, card: null, cv: null };
const EASE = "cubic-bezier(.2, .8, .2, 1)";

// The swatch's flight out of its card, as a liquid rather than a rigid card. While it moves the polish
// stretches a little along the direction of travel (most at the start, when it's fastest) and eases back
// as it slows, with no bounce or wobble on landing. The stretch keeps the area the same (1 + a one way,
// 1 / (1 + a) the other). Its outline flows at the same time (liquidPool, below). Returns keyframes for
// element.animate, sampled finely and played linearly so every frame follows these curves exactly.
const LIQUID = { total: 850, flight: 520, stretch: .07 };
function liquidFlight(from, to) {
  const w = to.width, h = to.height;
  const dx = (from.left + from.width / 2) - (to.left + w / 2), dy = (from.top + from.height / 2) - (to.top + h / 2);
  const kx0 = from.width / w, ky0 = from.height / h;
  const ang = Math.atan2(-dy, -dx) * 180 / Math.PI; // the direction of travel
  const still = reduceMotion, N = 60, frames = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N * LIQUID.total, u = Math.min(1, t / LIQUID.flight);
    const e = 1 - Math.pow(1 - u, 3.5);                 // position: a strong ease-out, like the old flight
    const v = u < 1 ? Math.pow(1 - u, 2.5) : 0;         // its speed, 1 at the start and 0 on landing
    const a = still ? 0 : LIQUID.stretch * v;
    const kx = kx0 + (1 - kx0) * e, ky = ky0 + (1 - ky0) * e;
    frames.push({ transformOrigin: "0 0", transform:
      `translate(${(w / 2 + dx * (1 - e)).toFixed(2)}px, ${(h / 2 + dy * (1 - e)).toFixed(2)}px) rotate(${ang.toFixed(2)}deg) ` +
      `scale(${(1 + a).toFixed(4)}, ${(1 / (1 + a)).toFixed(4)}) rotate(${(-ang).toFixed(2)}deg) ` +
      `scale(${kx.toFixed(4)}, ${ky.toFixed(4)}) translate(${(-w / 2).toFixed(2)}px, ${(-h / 2).toFixed(2)}px)` });
  }
  return frames;
}

// The polish pooling as it's carried: its outline lags behind the motion, gathering into a soft lobe on the
// trailing side and thinning at the front, while slow ripples run round the rim; all of it melts back into the
// polish's own resting outline as it lands. Drives the drop's clip and sheen outlines frame by frame and
// returns a function that stops it (and puts the resting outline back).
function liquidPool(stage, from, to) {
  const s = stage._drop; if (!DROPS || !s || reduceMotion) return () => {};
  const w = to.width, h = to.height;
  const dx = (from.left + from.width / 2) - (to.left + w / 2), dy = (from.top + from.height / 2) - (to.top + h / 2);
  const back = Math.atan2(dy, dx); // toward where it came from: the side that trails
  const paths = [...stage.querySelectorAll(":scope > svg path")].filter(el => el.getAttribute("d") === s.d);
  const lobe = (x, n) => Math.pow(Math.max(0, Math.cos(x)), n);
  const t0 = performance.now(); let raf = 0;
  const set = (clip, d) => { stage.style.setProperty("--drop-clip", clip); paths.forEach(el => el.setAttribute("d", d)); };
  const stop = () => { cancelAnimationFrame(raf); set(s.clip(stage.clientWidth || w, stage.clientHeight || h), s.d); };
  const frame = now => {
    const t = Math.max(0, now - t0) / LIQUID.total; // a frame's time can be a touch before t0
    if (t >= 1) return stop();
    const env = Math.pow(t, .45) * Math.pow(1 - t, 2.2) / .29; // swells as it sets off, then slowly lets go
    const sec = t * LIQUID.total / 1000;
    const push = th => {
      const r = th - back;
      return .075 * lobe(r, 2) - .04 * lobe(r - Math.PI, 3) + .02 * Math.cos(2 * r)
        + .022 * Math.sin(3 * th + 5.5 * sec + 1.3) + .012 * Math.sin(5 * th - 4 * sec + .4);
    };
    // Kept inside the drop's box (the canvas ends there), so the whole outline draws in by its largest push.
    let top = 0; for (let i = 0; i < 24; i++) top = Math.max(top, push(i / 24 * 2 * Math.PI));
    const m = dropMorph(s, th => env * (push(th) - top), stage.clientWidth || w, stage.clientHeight || h);
    set(m.clip, m.d);
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return stop;
}

// The polish page's photos start downloading as soon as its swatch looks about to be opened: when the
// pointer rests on it (desktop) or presses it (phone), and at the latest when it opens. Only the download
// happens early; the photos are still decoded and shown once the swatch has landed (openDetail), so the
// flight stays smooth, but by then they're usually already here. Each is kept so it stays in the cache.
const prefetched = new Map();
function prefetchPhotos(p) {
  (p && p.photos || []).slice(0, 4).forEach(src => {
    if (prefetched.has(src)) return;
    const im = new Image(); im.decoding = "async"; im.src = src; prefetched.set(src, im);
  });
}
(() => {
  const grid = $("#grid"); let hover = 0;
  const polishAt = e => { const sw = e.target.closest && e.target.closest(".swatch-wrap"); return sw && sw.closest(".card")?._p; };
  // A short rest first, so sweeping the pointer across the shelf doesn't fetch everything it passes over.
  grid.addEventListener("pointerover", e => {
    if (e.pointerType !== "mouse") return;
    const p = polishAt(e); clearTimeout(hover); if (p) hover = setTimeout(() => prefetchPhotos(p), 120);
  });
  grid.addEventListener("pointerout", () => clearTimeout(hover));
  grid.addEventListener("pointerdown", e => prefetchPhotos(polishAt(e)), { passive: true });
  grid.addEventListener("focusin", e => prefetchPhotos(polishAt(e)));
})();

// The polish page's content for one polish: name, description, pills, buttons, swatch and photos. The
// dialog must already be showing (the swatch is drawn at the size it appears). Used when it opens and when
// swiping to the next or previous polish.
function fillDetail(p) {
  // One line: the brand's short name (as on its filter pill), an em dash, then the polish's name.
  const brand = BRAND_LABELS[p.brand] || p.brand || "";
  $("#mName").textContent = (brand ? brand + " — " : "") + (p.name || "Untitled");
  // One line on color and finish, from the product page (polishes.js desc), under the name.
  $("#mDesc").textContent = p.desc || ""; $("#mDesc").hidden = !p.desc;
  // Effect pills under the description (Figma "Pill / Magnetic"): the filter pill's icon and label, same
  // labels as on the card. Not clickable here. Icons are fitted once the dialog is showing (see below).
  $("#mPills").innerHTML = "";
  labelsOf(p).forEach(k => {
    const t = document.createElement("span"); t.className = "mh-pill";
    if (EFFECT_ICONS[k]) t.innerHTML = `<svg class="scope-icon" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><g>${EFFECT_ICONS[k]}</g></svg>`;
    t.append(EFFECTS[k] || k); $("#mPills").appendChild(t);
  });
  // The dialog's add button does what the swatch's + does, and shows the same + / check state.
  const addBtn = $("#mAdd");
  if (!addBtn.firstChild) addBtn.innerHTML = MODAL_PLUS_CHECK;
  addBtn.dataset.pid = p.id; addBtn.dataset.name = p.name;
  addBtn.onclick = () => bench.layers.some(l => l.pid === p.id) ? removePolish(p) : addLayer(p);
  syncSwatchButtons();
  const link = $("#mLink");
  link.hidden = !p.url; if (p.url) link.href = p.url;

  $("#mPills").querySelectorAll(".scope-icon").forEach(fitIcon);
  const stage = $("#mStage");
  if (detail.cv && autoIO) { autoIO.unobserve(detail.cv); drifting.delete(detail.cv); }
  stage.innerHTML = "";
  const cv = document.createElement("canvas"); cv.className = "swatch";
  stage.appendChild(cv); detail.cv = cv;
  dropify(stage, p.id, 260 / 240); // the card's shape (180 x 195 here), so it grows out of the card cleanly
  const sr = stage.getBoundingClientRect();
  renderSwatch(cv, p, Math.round(sr.width), Math.round(sr.height));
  if (autoIO) autoIO.observe(cv);

  // Photos: a plain row of the saved product photos (not interactive).
  const row = $("#mPhotos"); row.innerHTML = "";
  const photoImgs = [];
  (p.photos || []).slice(0, 4).forEach((src, i) => {
    // Photos load lazily: the ones near the top of the dialog right away, the rest as you scroll to them.
    // The source is set once the swatch has landed (below), so loading and decoding them doesn't stall the flight.
    const im = document.createElement("img"); im.loading = "lazy"; im.decoding = "async"; im.dataset.src = src; im.alt = `${p.name} photo ${i + 1}`;
    // Staggered entry: each photo a beat after the last, with a little randomness so it feels organic.
    // It starts once the photo has loaded, so the rise is actually seen.
    im.style.setProperty("--d", (.06 + i * .08 + Math.random() * .04).toFixed(3) + "s");
    const reveal = () => requestAnimationFrame(() => requestAnimationFrame(() => im.classList.add("in")));
    im.addEventListener("load", reveal, { once: true });
    row.appendChild(im); photoImgs.push(im);
  });
  return { stage, photoImgs };
}

function openDetail(p, card) {
  if (detail.closing) detail.closing(); // a close still flying: land it first
  prefetchPhotos(p); // (if nothing fetched them yet: a keyboard open or a share link)
  detail.p = p; detail.card = card; detail.swiped = false;
  prefetchNeighbours(p);
  // Show the dialog first so the swatch can be drawn at the size it will actually appear.
  // The dialog's backdrop (body.detail-open) starts with the swatch's flight, below, not now: starting it in
  // the same frame as all this setup used to eat the flight before it was ever painted.
  const m = $("#modal"); m.hidden = false; document.body.style.overflow = "hidden";
  m.scrollTop = 0;
  const { stage, photoImgs } = fillDetail(p);
  // Grow the swatch out of its card (a shared element). First paint it sitting exactly over its card, with
  // the rest of the dialog still invisible, so nothing seems to change; the flight, the shelf's blur and the
  // text fade start on the frame after that, once the setup above has been painted, so the whole flight is seen.
  roomAroundPage(true);
  const from = card.getBoundingClientRect(), to = stage.getBoundingClientRect();
  stage.style.transition = "none";
  stage.style.transformOrigin = "0 0";
  stage.style.transform = `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width}, ${from.height / to.height})`;
  m.classList.remove("open"); void m.offsetWidth;
  card.style.visibility = "hidden";
  shelfBackdrop(); // drawn now, with the rest of the setup, so it doesn't hold up the flight's first frame
  const token = detail.token = {};
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (detail.token !== token || m.hidden) return; // closed (or another polish opened) meanwhile
    document.body.classList.add("detail-open");
    stage.style.transform = "";
    detail.anim = stage.animate(liquidFlight(from, to), { duration: LIQUID.total, easing: "linear" });
    detail.pool = liquidPool(stage, from, to);
    m.classList.add("open");
    // The photos load once it has landed, so decoding them doesn't stall the flight.
    setTimeout(() => { if (detail.token === token) photoImgs.forEach(im => { im.src = im.dataset.src; }); }, 520);
  }));
  m.focus({ preventScroll: true }); // keyboard focus moves into the dialog (Tab reaches the buttons)
  history.replaceState(null, "", SITE_ROOT + "p/" + encodeURIComponent(p.id) + "/");
  document.title = `${p.name} · ${p.brand} · ${SITE_TITLE}`;
}


/* Safari on iOS 26 shows the page just above the screen under the status bar (and just below it under the
   toolbar). With the shelf at its top there is no page up there, only the plain background, so while the
   polish page is up the shelf gets extra empty room above and below it (as much as the backdrop's blur
   reaches past the screen), scrolled so nothing on screen moves. The blurred, washed backdrop then runs on
   under the status bar, continuous with the rest of the page. It's taken away again (same trick) on close. */
const ROOM = 184; // = the blur's margin past the screen in shelfBackdrop (BACKDROP.blur * 3, rounded to whole 1/8 px)
function roomAroundPage(on) {
  const page = $(".page"), st = page.style;
  if (on) {
    if (page._room != null) return;
    const y = scrollY, top = Math.max(0, ROOM - y), pad = parseFloat(getComputedStyle(page).paddingTop) || 0;
    st.paddingBottom = `calc(${getComputedStyle(page).paddingBottom} + ${ROOM}px)`;
    st.paddingTop = pad + top + "px"; scrollTo(0, y + top);
    const got = scrollY - y; // a short page can't always scroll the whole way: only keep what was scrolled
    if (got !== top) st.paddingTop = pad + got + "px";
    page._room = got;
  } else {
    if (page._room == null) return;
    const y = scrollY, got = page._room; page._room = null;
    st.paddingTop = ""; st.paddingBottom = ""; scrollTo(0, Math.max(0, y - got));
  }
}

/* The polish page's backdrop: the shelf, heavily blurred (60px) under a white wash. Blurring the live page
   with a CSS filter redid a full-screen 60px blur on every frame of the fade (slow on older computers), so
   instead the part of the shelf on screen is drawn once into a small picture (1/8 size: the swatches as
   they are right now, the pills and text as soft blocks of their color), blurred once, and faded in. At that
   blur nothing finer than the colors survives, so it looks the same. The wash is still .page::after. */
const BACKDROP = { blur: 60, scale: 1 / 8 };
function shelfBackdrop() {
  const page = $(".page");
  let cv = page.querySelector(":scope > .shelf-blur");
  if (!cv) { cv = document.createElement("canvas"); cv.className = "shelf-blur"; cv.setAttribute("aria-hidden", "true"); page.appendChild(cv); }
  // The picture covers the screen plus a margin (the blur reaches in this far from offscreen); only the
  // screen's part is kept, so the page doesn't grow wider.
  const S = BACKDROP.scale, vw = innerWidth, vh = innerHeight, m = Math.ceil(BACKDROP.blur * 3 * S), M = m / S;
  const w = Math.ceil(vw * S) + 2 * m, h = Math.ceil(vh * S) + 2 * m;
  const work = document.createElement("canvas"); work.width = w; work.height = h;
  const g = work.getContext("2d", { willReadFrequently: true });
  g.setTransform(S, 0, 0, S, M * S, M * S); // draw in screen coordinates
  g.fillStyle = getComputedStyle(document.body).backgroundColor || "#fff"; g.fillRect(-M, -M, vw + 2 * M, vh + 2 * M);
  const onScreen = r => r.width > 0 && r.height > 0 && r.right > -M && r.left < vw + M && r.bottom > -M && r.top < vh + M;
  // Pills: their fill. Text: a soft block of its color, about as dark as its ink averages out to.
  page.querySelectorAll(".scope, .pill").forEach(el => {
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el); if (!onScreen(r) || cs.visibility === "hidden") return;
    g.fillStyle = cs.backgroundColor; g.beginPath(); g.roundRect(r.left, r.top, r.width, r.height, r.height / 2); g.fill();
  });
  page.querySelectorAll(".shelf-title, .filter-label, .scope, .card-text .name, .card-text .brand, .card-fx").forEach(el => {
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el); if (!onScreen(r) || cs.visibility === "hidden" || !el.textContent.trim()) return;
    const big = parseFloat(cs.fontSize) > 30;
    g.globalAlpha = big ? .3 : .18; g.fillStyle = cs.color;
    if (el.classList.contains("scope") || el.classList.contains("card-fx")) { const pad = Math.min(16, r.width * .2); g.fillRect(r.left + pad, r.top + r.height * .35, r.width - pad * 2, r.height * .3); }
    else g.fillRect(r.left, r.top + r.height * .2, r.width, r.height * .6);
    g.globalAlpha = 1;
  });
  // Swatches: the picture each one is showing right now, in its drop shape. (The one being opened is hidden.)
  page.querySelectorAll(".swatch-wrap, .combo-sat").forEach(wrap => {
    const r = wrap.getBoundingClientRect(); if (!onScreen(r)) return;
    const card = wrap.closest(".card"); if (card && (card.hidden || card.style.visibility === "hidden")) return;
    if (getComputedStyle(wrap).visibility === "hidden") return;
    const sw = wrap.querySelector(":scope > canvas.swatch");
    g.save(); g.translate(r.left, r.top);
    if (wrap._drop) g.clip(new Path2D(wrap._drop.clip(r.width, r.height).slice(6, -2)));
    else { g.beginPath(); g.roundRect(0, 0, r.width, r.height, parseFloat(getComputedStyle(wrap).borderTopLeftRadius) || 0); g.clip(); }
    g.fillStyle = getComputedStyle(wrap).backgroundColor; g.fillRect(0, 0, r.width, r.height);
    if (sw && sw.width) try { g.drawImage(sw, 0, 0, r.width, r.height); } catch (e) {}
    g.restore();
  });
  // A gaussian blur, as three box blurs (radius 7 at 1/8 size is a 60px gaussian at full size).
  const img = g.getImageData(0, 0, w, h), d = img.data, rad = Math.round((Math.sqrt(4 * (BACKDROP.blur * S) ** 2 + 1) - 1) / 2);
  const tmp = new Float32Array(Math.max(w, h) * 3);
  const pass = (n, len, stride, step) => { // blur `n` lines of `len` pixels each
    for (let k = 0; k < n; k++) {
      const o0 = k * stride;
      for (let i = 0; i < len; i++) { const o = o0 + i * step; tmp[i * 3] = d[o]; tmp[i * 3 + 1] = d[o + 1]; tmp[i * 3 + 2] = d[o + 2]; }
      let r = 0, gg = 0, b = 0; const at = i => (i < 0 ? 0 : i >= len ? len - 1 : i) * 3;
      for (let i = -rad; i <= rad; i++) { const q = at(i); r += tmp[q]; gg += tmp[q + 1]; b += tmp[q + 2]; }
      const n2 = 2 * rad + 1;
      for (let i = 0; i < len; i++) {
        const o = o0 + i * step; d[o] = r / n2; d[o + 1] = gg / n2; d[o + 2] = b / n2;
        const add = at(i + rad + 1), sub = at(i - rad); r += tmp[add] - tmp[sub]; gg += tmp[add + 1] - tmp[sub + 1]; b += tmp[add + 2] - tmp[sub + 2];
      }
    }
  };
  for (let p = 0; p < 3; p++) { pass(h, w, w * 4, 4); pass(w, h, 4, w * 4); }
  // Above and below the screen, the margin is kept too (as far as the page reaches): Safari on iOS 26 shows
  // the page just above the screen under the status bar, and just below it under the toolbar, so the blur
  // has to run on under them, not stop at the screen's edge. Sideways it's cut off, so the page doesn't grow wider.
  const pr = page.getBoundingClientRect();
  const mt = Math.min(m, Math.floor(Math.max(0, -pr.top) * S)), mb = Math.min(m, Math.floor(Math.max(0, pr.bottom - vh) * S));
  cv.width = w - 2 * m; cv.height = h - 2 * m + mt + mb;
  cv.getContext("2d").putImageData(img, -m, mt - m);
  Object.assign(cv.style, { left: -pr.left + "px", top: -pr.top - mt / S + "px", width: vw + "px", height: vh + (mt + mb) / S + "px" }); // (the picture is a few pixels larger: drawn just squeezed)
}
let lastW = innerWidth;
addEventListener("resize", () => {
  if (document.body.classList.contains("detail-open")) shelfBackdrop();
  if (innerWidth !== lastW) { lastW = innerWidth; SHEET.shelfCopy = null; } // the kept copy of the shelf no longer matches it
});

function closeDetail() {
  const m = $("#modal"); if (m.hidden || detail.closing) return;
  detail.token = null; // cancels an opening flight or photo load still waiting to start
  if (detail.anim) { detail.anim.finish(); detail.anim = null; } // closing mid-flight: from where it lands
  if (detail.pool) { detail.pool(); detail.pool = null; }
  const stage = $("#mStage"), card = detail.card;
  // The swatch flies back into its card from wherever it has scrolled to (a shared element, both ways).
  // The dialog stops catching the pointer and the shelf can scroll again right away. If the shelf does
  // scroll mid-flight, the card moves out from under the swatch's landing spot, so the flight finishes at
  // once (the swatch hands straight back to its card) instead of being left behind where the card was.
  // Keyboard focus goes back to the swatch that opened the page (it was left on the hidden dialog otherwise),
  // once the swatch is visible again.
  const refocus = m.contains(document.activeElement);
  const done = () => {
    if (detail.closing !== done) return;
    detail.closing = null; clearTimeout(done.t); removeEventListener("scroll", done.scroll);
    m.hidden = true; m.classList.remove("open"); m.style.pointerEvents = ""; m.style.transform = "";
    stage.style.transition = "none"; stage.style.transform = "";
    if (card) card.style.visibility = "";
    const opener = refocus && card && card.isConnected && card.querySelector(".swatch");
    if (opener) opener.focus({ preventScroll: true });
  };
  detail.closing = done;
  m.classList.remove("open"); document.body.classList.remove("detail-open");
  m.style.pointerEvents = "none"; document.body.style.overflow = "";
  history.replaceState(null, "", SITE_ROOT); document.title = SITE_TITLE;
  // The blurred backdrop stays exactly where it is on screen while it fades out, whatever the scrolling below
  // does to the page under it (it's part of the page, so taking the room away used to drop it down a little).
  const blur = $(".page > .shelf-blur"), blurTop = blur && blur.getBoundingClientRect().top;
  roomAroundPage(false); // before measuring the card, which this scrolls back to where it was
  // Swiped to a polish whose card is off screen: the shelf scrolls to it first, so the swatch has somewhere to
  // fly back to.
  if (card && card.isConnected && detail.swiped) {
    const r = card.getBoundingClientRect(), top = sheetMQ.matches ? 80 : 120;
    if (r.top < top || r.bottom > innerHeight - 40) {
      scrollTo({ top: Math.max(0, scrollY + r.top - (innerHeight - r.height) / 2), behavior: "instant" });
    }
  }
  if (blur) blur.style.top = parseFloat(blur.style.top) + blurTop - blur.getBoundingClientRect().top + "px";
  if (card && card.isConnected) {
    const from = stage.getBoundingClientRect(), to = card.getBoundingClientRect();
    stage.style.transition = `transform .45s ${EASE}`; stage.style.transformOrigin = "0 0";
    stage.style.transform = `translate(${to.left - from.left}px, ${to.top - from.top}px) scale(${to.width / from.width}, ${to.height / from.height})`;
    done.t = setTimeout(done, 450);
    // (The scroll roomAroundPage just made fires an event too, a little later: that one is skipped.)
    const y = scrollY; done.scroll = () => { if (scrollY !== y) done(); };
    addEventListener("scroll", done.scroll, { passive: true });
  } else done();
}
$("#mClose").onclick = closeDetail;
document.addEventListener("keydown", e => { if (e.key === "Escape") closeDetail(); });

/* ---------- phone gestures ---------- */
// On touch screens the polish page and Favorite combos close with a swipe down (from the top of the page), and
// the polish page swipes left and right to the next and previous polish on the shelf, in the shelf's current
// order and filters. The page follows the finger; letting go past a third of the way (or with a flick) finishes
// the move, anything less springs back. Each gesture is picked from the finger's first movement: across is a
// swipe between polishes, down from the top is a dismiss, anything else scrolls as usual. Touches that start at
// the screen's left or right edge are left to Safari's own back and forward swipes.
const GESTURE = { edge: 24, flick: .5, back: 320, spring: "cubic-bezier(.2, .8, .2, 1)" };

// The polishes before and after this one on the shelf, as it's filtered and ordered right now.
function shelfNeighbours(p) {
  if (state.view !== "shelf") return {};
  const cards = [...$("#grid").children].filter(c => c._p && !c.hidden && c.style.position !== "absolute");
  const i = cards.findIndex(c => c._p === p);
  return i < 0 ? {} : { prev: cards[i - 1], next: cards[i + 1] };
}
// The neighbours' photos download a moment after a polish page opens (so they don't hold up its own), ready
// for a swipe to them.
function prefetchNeighbours(p) {
  clearTimeout(prefetchNeighbours.t);
  prefetchNeighbours.t = setTimeout(() => {
    if (detail.p !== p) return;
    const n = shelfNeighbours(p); [n.next, n.prev].forEach(c => c && prefetchPhotos(c._p));
  }, 900);
}

// Moves the polish page to the next (dir 1) or previous (-1) polish. The page as it is slides off with the
// swipe (a frozen copy), while the page itself, filled with the new polish, slides in from the other side.
// `x` is where the swipe left the page; `v` its speed (px per ms), so a flick carries on as fast.
function switchDetail(dir, x = 0, v = 0) {
  const m = $("#modal"), n = shelfNeighbours(detail.p), card = dir > 0 ? n.next : n.prev;
  if (!card || m.hidden || detail.closing || detail.switching) return false;
  if (detail.anim) { detail.anim.finish(); detail.anim = null; } // still landing from its card: land it now
  if (detail.pool) { detail.pool(); detail.pool = null; }
  detail.token = null; // the old polish's photos (if they hadn't started loading) never will
  const body = $("#modal .modal-body"), W = innerWidth, sy = m.scrollTop;
  // The copy keeps its swatch's picture (a canvas copies blank) and its photos as they were.
  const copy = body.cloneNode(true);
  copy.querySelectorAll("[id]").forEach(e => { if (!e.closest("svg")) e.removeAttribute("id"); });
  const from = body.querySelector("canvas"), to = copy.querySelector("canvas");
  if (from && to && from.width) try { to.getContext("2d").drawImage(from, 0, 0); } catch (e) {}
  copy.classList.add("modal-body-ghost"); copy.setAttribute("aria-hidden", "true"); copy.inert = true;
  copy.style.transform = `translate(${x}px, 0)`;
  body.before(copy);
  // The new polish.
  const old = detail.card, p = card._p, wrap = card.querySelector(".swatch-wrap");
  if (old) old.style.visibility = "";
  detail.p = p; detail.card = wrap; detail.swiped = true; wrap.style.visibility = "hidden";
  body.style.transform = `translate(${dir * W}px, 0)`; body.style.opacity = "";
  const stage = $("#mStage"); stage.style.transition = "none"; stage.style.transform = "";
  m.scrollTop = 0;
  copy.style.marginTop = -sy + "px"; // (it was scrolled with the page)
  const { photoImgs } = fillDetail(p);
  photoImgs.forEach(im => { im.loading = "eager"; im.src = im.dataset.src; });
  history.replaceState(null, "", SITE_ROOT + "p/" + encodeURIComponent(p.id) + "/");
  document.title = `${p.name} · ${p.brand} · ${SITE_TITLE}`;
  prefetchNeighbours(p);
  // As fast as the flick, but never slower than a normal page turn.
  const rest = W - Math.abs(x), ms = reduceMotion ? 1 : Math.round(Math.max(220, Math.min(380, Math.abs(v) > .3 ? rest / Math.abs(v) * 1.6 : 380)));
  const ease = "cubic-bezier(.25, .8, .25, 1)";
  const outA = copy.animate([{ transform: `translate(${x}px, 0)`, opacity: 1 }, { transform: `translate(${-dir * W}px, 0)`, opacity: .4 }], { duration: ms, easing: ease, fill: "forwards" });
  const inA = body.animate([{ transform: `translate(${dir * W + x}px, 0)` }, { transform: "none" }], { duration: ms, easing: ease });
  body.style.transform = "";
  const done = () => { if (detail.switching !== done) return; detail.switching = null; copy.remove(); };
  detail.switching = done;
  Promise.all([outA.finished, inA.finished]).then(done, done); setTimeout(done, ms + 200);
  return true;
}

(() => {
  if (!matchMedia("(hover: none)").matches) return; // touch screens only
  const m = $("#modal");
  let g = null; // the gesture in progress: { x0, y0, mode, samples, ... }
  const track = (t, x, y) => { g.samples.push({ t, x, y }); while (g.samples.length > 2 && t - g.samples[0].t > 80) g.samples.shift(); };
  const speed = k => { const s = g.samples, a = s[0], b = s[s.length - 1]; return b.t > a.t ? (b[k] - a[k]) / (b.t - a.t) : 0; };
  // Past the first or last polish the page still moves, but less and less (like the end of a scroll).
  const rubber = d => { const L = innerWidth * .5; return Math.sign(d) * L * (1 - 1 / (Math.abs(d) / L * .55 + 1)); };

  /* The polish page. */
  const body = () => $("#modal .modal-body");
  const setWash = o => document.body.style.setProperty("--wash", o.toFixed(3));
  m.addEventListener("touchstart", e => {
    if (e.touches.length > 1) { if (g) cancel(); return; }
    if (detail.closing || detail.switching || !document.body.classList.contains("detail-open")) { g = null; return; }
    const t = e.touches[0];
    g = { x0: t.clientX, y0: t.clientY, mode: null, samples: [], edge: t.clientX < GESTURE.edge || t.clientX > innerWidth - GESTURE.edge };
    track(e.timeStamp, t.clientX, t.clientY);
  }, { passive: true });
  m.addEventListener("touchmove", e => {
    if (!g) return;
    if (e.touches.length > 1) return cancel();
    const t = e.touches[0], dx = t.clientX - g.x0, dy = t.clientY - g.y0;
    if (!g.mode) {
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      if (Math.abs(dx) > Math.abs(dy) && !g.edge && state.view === "shelf") g.mode = "x";
      else if (dy > 0 && Math.abs(dy) >= Math.abs(dx) && m.scrollTop <= 0) g.mode = "down";
      else { g = null; return; } // a scroll: the page's own
      document.body.classList.add("detail-drag");
      if (g.mode === "x") g.n = shelfNeighbours(detail.p);
    }
    if (e.cancelable) e.preventDefault(); // no scroll, bounce or Safari page swipe while the page follows the finger
    track(e.timeStamp, t.clientX, t.clientY);
    if (g.mode === "x") {
      const open = dx < 0 ? g.n.next : g.n.prev, x = open ? dx : rubber(dx);
      g.x = x; body().style.transform = `translate(${x}px, 0)`;
    } else {
      const y = Math.max(0, dy) + Math.min(0, dy) * .2; g.y = y;
      m.style.transform = `translate(0, ${y}px)`;
      setWash(Math.max(0, 1 - y / (innerHeight * .7)));
    }
  }, { passive: false });
  const settle = (el, from) => {
    el.style.transform = "";
    if (!reduceMotion) el.animate([{ transform: from }, { transform: "none" }], { duration: GESTURE.back, easing: GESTURE.spring });
  };
  function cancel() {
    if (!g) return;
    const was = g; g = null;
    document.body.classList.remove("detail-drag"); document.body.style.removeProperty("--wash");
    if (was.mode === "x") settle(body(), `translate(${was.x || 0}px, 0)`);
    if (was.mode === "down") settle(m, `translate(0, ${was.y || 0}px)`);
  }
  const end = e => {
    if (!g || !g.mode) { g = null; return; }
    const was = g, W = innerWidth;
    if (was.mode === "x") {
      const vx = speed("x"), dir = was.x < 0 ? 1 : -1;
      const far = Math.abs(was.x) > W * .3 || (Math.abs(vx) > GESTURE.flick && Math.sign(vx) === -dir && Math.abs(was.x) > 12);
      const target = dir > 0 ? was.n.next : was.n.prev;
      if (e.type === "touchend" && far && target) {
        g = null; document.body.classList.remove("detail-drag");
        if (switchDetail(dir, was.x, vx)) return;
      }
      g = was; return cancel();
    }
    const vy = speed("y");
    if (e.type === "touchend" && (was.y > Math.min(140, innerHeight * .2) || (vy > GESTURE.flick && was.y > 12))) {
      // Let go: the page fades from where it is and the swatch flies back to its card (closeDetail).
      g = null; document.body.classList.remove("detail-drag"); document.body.style.removeProperty("--wash");
      return closeDetail();
    }
    cancel();
  };
  m.addEventListener("touchend", end); m.addEventListener("touchcancel", end);
})();

(() => {
  if (!matchMedia("(hover: none)").matches) return;
  /* Favorite combos: pulled down from the top of the page, a copy of it follows the finger over the dimmed
     shelf (the copy of the shelf kept from opening it); let go far enough and it drops away as the close
     button does, otherwise it springs back up and the copies go. The live page never moves (see openCombos). */
  let g = null;
  const blocked = t => t.closest && t.closest(".bench, .dock, .modal, .mini-nav");
  document.addEventListener("touchstart", e => {
    g = null;
    if (state.view !== "combos" || e.touches.length > 1 || SHEET.busy || reduceMotion) return;
    if (scrollY > 0 || blocked(e.target) || document.documentElement.classList.contains("sheet-lock")) return;
    const t = e.touches[0]; g = { y0: t.clientY, x0: t.clientX, samples: [{ t: e.timeStamp, y: t.clientY }] };
  }, { passive: true });
  document.addEventListener("touchmove", e => {
    if (!g) return;
    if (e.touches.length > 1) return back();
    const t = e.touches[0], dy = t.clientY - g.y0, dx = t.clientX - g.x0;
    if (!g.sheet) {
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      if (!(dy > 0 && dy >= Math.abs(dx)) || scrollY > 0) { g = null; return; }
      // The copies, as openCombos stacks them: shelf, dim, then the combos on top.
      const sheet = freezePage(), dim = sheetDim(SHEET.Z + 1), under = SHEET.shelfCopy;
      sheet.style.zIndex = SHEET.Z + 2;
      if (under) { under.style.zIndex = SHEET.Z; pinToScreen(under); document.body.append(under); }
      pinToScreen(dim, sheet); document.body.append(dim, sheet);
      Object.assign(g, { sheet, dim, under });
    }
    if (e.cancelable) e.preventDefault();
    g.samples.push({ t: e.timeStamp, y: t.clientY }); while (g.samples.length > 2 && e.timeStamp - g.samples[0].t > 80) g.samples.shift();
    g.y = Math.max(0, dy);
    g.sheet.style.transform = `translate(0, ${g.y}px)`;
    g.dim.style.opacity = Math.max(0, 1 - g.y / innerHeight).toFixed(3);
  }, { passive: false });
  function back() {
    const was = g; g = null; if (!was || !was.sheet) return;
    const { sheet, dim, under } = was, from = `translate(0, ${was.y}px)`, o = dim.style.opacity;
    SHEET.busy = true;
    const a = sheet.animate([{ transform: from }, { transform: "none" }], { duration: GESTURE.back, easing: GESTURE.spring, fill: "forwards" });
    dim.animate([{ opacity: o }, { opacity: 1 }], { duration: GESTURE.back, easing: "ease-out", fill: "forwards" });
    const done = () => { if (!sheet.isConnected) return; sheet.remove(); dim.remove(); if (under) under.remove(); SHEET.busy = false; };
    a.finished.then(done, done); setTimeout(done, GESTURE.back + 250);
  }
  const end = e => {
    const was = g; if (!was || !was.sheet) { g = null; return; }
    const s = was.samples, a = s[0], b = s[s.length - 1], v = b.t > a.t ? (b.y - a.y) / (b.t - a.t) : 0;
    if (e.type !== "touchend" || !(was.y > Math.min(160, innerHeight * .22) || (v > GESTURE.flick && was.y > 12))) return back();
    g = null;
    // Let go: the shelf comes back underneath (where you left it) and the copy of the combos drops away.
    const { sheet, dim, under } = was, H = innerHeight;
    try { showView("shelf", SHEET.shelfY); pinToScreen(dim, sheet); } catch (err) { sheet.remove(); dim.remove(); if (under) under.remove(); throw err; }
    if (under) requestAnimationFrame(() => under.remove()); // the live shelf is painted under it by then
    SHEET.shelfCopy = null;
    const ms = Math.round(Math.max(180, Math.min(SHEET.down, v > .3 ? (H - was.y) / v * 1.4 : SHEET.down)));
    dim.animate([{ opacity: dim.style.opacity }, { opacity: 0 }], { duration: ms, easing: "ease-out", fill: "forwards" });
    const move = sheet.animate([{ transform: `translate(0, ${was.y}px)` }, { transform: `translate(0, ${H}px)` }], { duration: ms, easing: "cubic-bezier(.3, .6, .5, 1)", fill: "forwards" });
    afterSheet(ms, move, dim, sheet);
  };
  document.addEventListener("touchend", end); document.addEventListener("touchcancel", end);
})();

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
  setSheet(false);
  // On phones the sheet rises up from below the screen to its peek bar, and drops back down out of view.
  const phone = sheetMQ.matches && !reduceMotion;
  if (open) {
    b.style.transform = ""; b.hidden = false;
    if (phone) { b.style.transition = "none"; b.style.transform = "translateY(calc(100% + 24px))"; void b.offsetWidth; b.style.transition = ""; b.style.transform = ""; }
    void b.offsetWidth; b.classList.add("open");
  } else {
    b.classList.remove("open");
    if (phone && !b.hidden) b.style.transform = "translateY(calc(100% + 24px))";
    b._hideT = setTimeout(() => { if (!benchIsOpen()) { b.hidden = true; b.style.transform = ""; } }, reduceMotion ? 0 : sheetMQ.matches ? 380 : 450);
  }
  // On desktop the shelf makes or gives back room for the pane: note where the cards are, switch the
  // column, then glide them to their new places (the same animation as changing the zoom).
  const settle = sheetMQ.matches || $("#layout").classList.contains("closed") === !open ? null : zoomFlip();
  $("#layout").classList.toggle("closed", !open);
  if (settle) { fitGrid(); settle(); }
  document.body.classList.toggle("bench-open", open);
  if (open) renderBench();
}
// Layering is always available: every swatch has a + button, and adding a polish opens the Layers pane.
// Closing the pane clears the layers, so every swatch goes back to its + button.
function clearBench() { bench.layers = []; saveBench(); setBenchOpen(false); syncSwatchButtons(); }
$("#closeBench").onclick = clearBench;

function addLayer(p) {
  // Toppers look right with one coat; everything else defaults to two.
  // added: when it was added, so the peek bar's thumbnails can run oldest to newest (see renderPeek).
  const layer = { pid: p.id, coats: ["glitter", "flakies", "chrome"].includes(p.effect) ? 1 : 2, added: Date.now() };
  // Default order, base to top (see LAYER_RANK): a new layer goes just above the last layer that ranks the same
  // or lower, so cremes and jellies stay at the base and chrome powder on top. Layers can still be dragged.
  const rank = layerRank(p);
  let at = 0;
  bench.layers.forEach((l, i) => { const q = polishById(l.pid); if (!q || layerRank(q) <= rank) at = i + 1; });
  bench.layers.splice(at, 0, layer);
  saveBench();
  if (!benchIsOpen()) setBenchOpen(true); else renderBench();
  if (!peekLanding.has(p.id)) pulsePeek(); // one flying in pops its own thumbnail instead (see quickAdd)
}
// Pressing a checked swatch button takes that polish back off the bench.
function removePolish(p) {
  bench.layers = bench.layers.filter(l => l.pid !== p.id);
  saveBench(); renderBench();
}

/* ---------- quick add: press and hold ---------- */
// On touch screens, pressing and holding a shelf swatch adds it to the Layers without opening its page
// (the touch version of the + that shows on hover at 4 per row on desktop). While the finger stays down the
// swatch squishes in a little; at the end of the hold it springs back and a copy flies into the Layers peek
// bar (or the pane on wider screens), which pulses as it lands. Holding a polish that's already in the
// Layers takes it back out, like its + / check button. A plain tap still opens the polish page, and moving
// the finger (scrolling) cancels the hold.
const HOLD = { ms: 420, squish: .92, slop: 10 };
// Flies a picture of the shelf swatch into the Layers. The target is read every frame, so the flight follows
// the peek bar while the sheet is still rising. Resolves once it has landed.
// On phones it heads for the polish's own thumbnail in the peek bar's stack (looked up by its id each frame, as
// the bar can be drawn again mid-flight), not the combined swatch.
const peekThumb = pid => pid && $("#peekThumbs").querySelector(`[data-pid="${CSS.escape(pid)}"]`);
function flyToLayers(wrap, sw, landPid) {
  const shown = el => { if (!el) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const target = () => [peekThumb(landPid), landPid && $("#peekThumbs").lastElementChild, $("#peekMini"), $("#stage")].find(shown) || $("#bench");
  const from = wrap.getBoundingClientRect(), W = from.width, H = from.height;
  if (!W || !sw.width) return Promise.resolve();
  const PAD = 28, dpr = Math.min(2, devicePixelRatio || 1), cv = document.createElement("canvas");
  cv.width = Math.round((W + PAD * 2) * dpr); cv.height = Math.round((H + PAD * 2) * dpr);
  const g = cv.getContext("2d"); g.scale(dpr, dpr); g.translate(PAD, PAD);
  const shape = new Path2D();
  if (wrap._drop) shape.addPath(new Path2D(wrap._drop.d), new DOMMatrix().scale(W / 100, H / wrap._drop.vh));
  else shape.roundRect(0, 0, W, H, parseFloat(getComputedStyle(wrap).borderTopLeftRadius) || 12);
  g.save(); g.shadowColor = "rgba(0, 0, 0, .22)"; g.shadowBlur = 24; g.shadowOffsetY = 10; g.fillStyle = "#fff"; g.fill(shape); g.restore();
  g.save(); g.clip(shape); g.drawImage(sw, 0, 0, W, H); g.restore();
  cv.className = "fly-swatch";
  Object.assign(cv.style, { left: from.left - PAD + "px", top: from.top - PAD + "px", width: W + PAD * 2 + "px", height: H + PAD * 2 + "px" });
  document.body.appendChild(cv);
  const ox = from.left + W / 2, oy = from.top + H / 2, DUR = 560, t0 = performance.now();
  const ease = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  return new Promise(res => {
    const step = now => {
      const t = Math.min(1, (now - t0) / DUR), e = ease(t), u = 1 - e;
      const r = target().getBoundingClientRect(), dx = r.left + r.width / 2 - ox, dy = r.top + r.height / 2 - oy;
      // An arc: a little lift first, then down and across into the bar, shrinking evenly to the thumbnail's size.
      const cx = dx * .25, cy = Math.min(0, dy) - 60;
      const x = 2 * u * e * cx + e * e * dx, y = 2 * u * e * cy + e * e * dy, s = Math.pow(Math.max(.05, r.width / W), e);
      cv.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) scale(${(s * (e < .12 ? HOLD.squish + (1 - HOLD.squish) * e / .12 : 1)).toFixed(4)})`;
      // Into the stack it fades out completely (the thumbnail takes over); elsewhere it melts in to 20%.
      cv.style.opacity = e < .85 ? 1 : 1 - (e - .85) / .15 * (landPid ? 1 : .8);
      // The thumbnail it lands in fades up underneath over the same last stretch, so the two cross over.
      const land = peekThumb(landPid); if (land) land.style.opacity = e < .85 ? 0 : (e - .85) / .15;
      if (t < 1) requestAnimationFrame(step); else { cv.remove(); res(); }
    };
    requestAnimationFrame(step);
  });
}
function quickAdd(p, wrap, sw) {
  if (bench.layers.some(l => l.pid === p.id)) { removePolish(p); pulsePeek(); return; }
  if (reduceMotion) { addLayer(p); return; }
  // With the Layers closed, they open right away (the sheet rises while the swatch flies down to it);
  // already open, the polish joins them as it lands.
  const open = benchIsOpen();
  // Phones: the polish joins the Layers right away, its thumbnail held invisible in the peek bar's stack
  // (the rest move aside for it), and the copy flies into that spot; the thumbnail pops as it lands.
  if (sheetMQ.matches && !$("#bench").classList.contains("expanded")) {
    peekLanding.add(p.id); addLayer(p);
    flyToLayers(wrap, sw, p.id).then(() => {
      peekLanding.delete(p.id);
      const t = peekThumb(p.id) || $("#peekThumbs").lastElementChild;
      if (!t) return pulsePeek();
      t.style.opacity = "";
      t.animate([{ transform: "scale(1)" }, { transform: "scale(1.25)", offset: .4 }, { transform: "scale(1)" }], { duration: 420, easing: "cubic-bezier(.2, .8, .2, 1)" });
    });
    return;
  }
  if (!open) addLayer(p);
  flyToLayers(wrap, sw).then(() => { if (open) addLayer(p); else pulsePeek(); });
}
{
  const grid = $("#grid");
  let hold = null, swallowClick = 0, held = null; // held: the finger of a hold that went through, until it lifts
  const release = (fired) => {
    if (!hold) return;
    const { wrap, timer, squish } = hold; hold = null; clearTimeout(timer);
    if (squish) {
      // Springs back: a little past its size when the hold went through, straight back when it was let go early.
      const now = getComputedStyle(wrap).transform; squish.cancel();
      if (!reduceMotion) wrap.animate(fired ? [{ transform: now }, { transform: "scale(1.04)", offset: .45 }, { transform: "none" }]
        : [{ transform: now }, { transform: "none" }], { duration: fired ? 360 : 180, easing: "cubic-bezier(.2, .8, .2, 1)" });
    }
  };
  grid.addEventListener("pointerdown", e => {
    if (e.pointerType === "mouse" || !e.isPrimary || state.view === "combos") return;
    const sw = e.target.closest(".card .swatch"), wrap = sw && sw.parentElement, card = sw && sw.closest(".card");
    if (!sw || !card._p) return;
    release(false);
    hold = { wrap, x: e.clientX, y: e.clientY, id: e.pointerId };
    // The squish waits a beat, so a quick tap doesn't flinch.
    if (!reduceMotion) hold.squish = wrap.animate([{ transform: "none" }, { transform: "none", offset: .25 }, { transform: `scale(${HOLD.squish})` }],
      { duration: HOLD.ms, easing: "cubic-bezier(.3, 0, .4, 1)", fill: "forwards" });
    hold.timer = setTimeout(() => {
      const h = hold; release(true);
      held = h.id; // the tap that ends the hold isn't also a tap on the swatch (see click, below)
      if (navigator.vibrate) try { navigator.vibrate(8); } catch (_) {}
      quickAdd(card._p, h.wrap, sw);
    }, HOLD.ms);
  });
  grid.addEventListener("pointermove", e => {
    if (hold && e.pointerId === hold.id && Math.hypot(e.clientX - hold.x, e.clientY - hold.y) > HOLD.slop) release(false);
  });
  ["pointerup", "pointercancel"].forEach(t => addEventListener(t, e => {
    if (hold && e.pointerId === hold.id) release(false);
    if (held === e.pointerId) { held = null; swallowClick = performance.now() + 400; }
  }, true));
  addEventListener("scroll", () => release(false), { passive: true, capture: true });
  // No callout menu, text selection or context menu on a held swatch.
  grid.addEventListener("contextmenu", e => { if (e.target.closest(".card .swatch")) e.preventDefault(); });
  grid.addEventListener("click", e => {
    if ((held !== null || performance.now() < swallowClick) && e.target.closest(".card .swatch")) { e.stopPropagation(); e.preventDefault(); swallowClick = 0; }
  }, true);
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
const isSheer = p => p.sheer || p.effect === "sheer" || p.effect === "sheermag";
// Chrome powders are rubbed onto the top of a manicure: always the topmost layer, over whatever is below.
const isPowder = p => p.effect === "powder";
const isOverlay = p => isSheer(p) || isPowder(p);
// Default layer order, base to top: creme, jelly, opaque effect finishes (magnetic, multichrome, shimmer, holo,
// thermal, glow), sheer shimmers and sheer glows, magnetic toppers (tinted, then clear), chrome powder.
function layerRank(p) {
  if (isPowder(p)) return 6;
  if (p.effect === "sheermag") return p.clear ? 5 : 4;
  if (p.effect === "creme") return 0;
  if (p.effect === "sheer") return 1; // jelly
  if (p.sheer) return p.effect === "shimmer" || p.effect === "glow" ? 3 : 1;
  return 2;
}

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
function sheerOps(q, W, H, under) {
  const ops = [], draw = (p, op, alpha) => { const cv = document.createElement("canvas"); renderSwatch(cv, p, W, H); ops.push({ cv, op, alpha }); };
  // A chrome powder is a thin, see-through mirror film: strong in its reflection, a pearly veil on the sides
  // that lets the color below show through (veil and peak in its powder settings).
  // Its reflection also glows (screen), so it reads brighter and paler than the film's color alone.
  if (isPowder(q)) {
    draw({ ...q, powder: { ...q.powder, film: true } }, "source-over", 1);
    draw({ ...q, powder: { ...q.powder, light: true } }, "screen", (q.powder && q.powder.glow) ?? .45);
    return ops;
  }
  const magnetic = q.effect === "magnetic" || q.effect === "sheermag" || !!q.glow; // drawn by the magnetic swatch
  if (!q.clear) ops.push({ fill: q.baseColor || q.colors[0], op: "multiply", alpha: .6 });
  if (magnetic) {
    // Magnetic sheers rest in the same in-between shape as the shelf swatches: an organic glow between a
    // glass bead and a cat eye, following the pointer as you hover.
    const shape = q.effect === "sheermag" || q.effect === "magnetic" ? { glow: { shape: .5 } } : {};
    const blk = { ...q, ...shape, colors: ["#000000", ...q.colors.slice(1)], shadow: "#000000" };
    const sp = { density: 1, floor: .1, ...q.sparkle };
    if (q.effect === "sheermag") {
      // Magnetic toppers: where the particles line up they cover what's below, so the flash goes on as its
      // own color with its own brightness as coverage (see flashCover), not screened and faded at 60%.
      // The sheer base still tints the rest; the flash stays as bright and saturated as on the shelf.
      draw({ ...blk, sparkle: { ...sp, density: 0 }, flakes: null }, "source-over", 1);
      ops[ops.length - 1].cover = true;
    } else draw({ ...blk, sparkle: { ...sp, density: 0 }, flakes: null }, "screen", .6);
    // Under a chrome powder the glitter is buried beneath the mirror film and barely shows.
    draw({ ...blk, colors: q.colors.map(() => "#000000"), sparkle: { ...sp, density: sp.density * 2.2, floor: .04, mix: 1, dark: 0 } }, "screen", under ? .35 : 1);
  } else {
    // Other sheers (shimmers, glow in the dark): their shimmer on a black base, added as light.
    draw({ ...q, colors: q.baseColor ? q.colors : ["#000000", ...q.colors.slice(1)], baseColor: q.baseColor ? "#000000" : undefined, shadow: "#000000" }, "screen", .95);
  }
  return ops;
}
function stackOps(W, H, layers = bench.layers) {
  const live = liveLayers(layers);
  if (!live.length || !W || !H) return null;
  // Start from the topmost polish that fully covers what's below: a creme, or the base. Opaque effect finishes
  // above it let the layer below peek through a little (see PEEK and peekCover).
  let start = 0;
  live.forEach((L, i) => { if (!isOverlay(L.polish) && !peeks(L.polish)) start = i; });
  const ops = [];
  live.slice(start).forEach((L, i, top) => {
    if (!i || !isOverlay(L.polish)) { const cv = document.createElement("canvas"); renderSwatch(cv, L.polish, W, H); ops.push({ cv, op: "source-over", alpha: 1, peek: i > 0 }); }
    else ops.push(...sheerOps(L.polish, W, H, top.slice(i + 1).some(M => isPowder(M.polish))));
  });
  return ops;
}
// Opaque effect finishes (magnetic, multichrome, shimmer, holo, thermal, glow) layered over another polish let it
// peek through a little: cover is how much they hide overall, and dark gathers the see-through part into their
// darker areas, so the bright flash or shimmer stays solid (values from the layering tuner).
const PEEK = { cover: .85, dark: .7 };
const peeks = p => !isOverlay(p) && layerRank(p) === 2;
function peekCover(o) {
  const src = o.cv, w = src.width, h = src.height;
  if (!w || !h) return src;
  const c = o._peek || (o._peek = document.createElement("canvas"));
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  const img = src.getContext("2d").getImageData(0, 0, w, h), d = img.data, see = 1 - PEEK.cover;
  for (let i = 0; i < d.length; i += 4) {
    const lum = Math.max(d[i], d[i + 1], d[i + 2]) / 255;
    d[i + 3] *= 1 - see * (1 - PEEK.dark * lum);
  }
  c.getContext("2d").putImageData(img, 0, 0);
  return c;
}
// A flash drawn on black, turned into a see-through layer: each pixel keeps its hue at full brightness and
// its brightness becomes how much it covers (eased, so the dim edges stay sheer and the core stays solid).
function flashCover(o) {
  const src = o.cv, w = src.width, h = src.height;
  if (!w || !h) return src;
  const c = o._cover || (o._cover = document.createElement("canvas"));
  // The flash hasn't been redrawn since the last time: the cover made then is still right. (Reading the
  // pixels back every frame was the most expensive part of hovering a stack.)
  if (o._covered && o._coverV === src._v && c.width === w && c.height === h) return c;
  o._covered = true; o._coverV = src._v;
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  const img = src.getContext("2d").getImageData(0, 0, w, h), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const m = Math.max(d[i], d[i + 1], d[i + 2]);
    if (!m) { d[i + 3] = 0; continue; }
    const a = m / 255, k = Math.pow(255 / m, .5); // lift the hue partway, so the grain in the flash still shows
    d[i] *= k; d[i + 1] *= k; d[i + 2] *= k; d[i + 3] = 255 * Math.min(.8, a * Math.sqrt(a)) * (d[i + 3] / 255);
  }
  c.getContext("2d").putImageData(img, 0, 0);
  return c;
}
function composeOps(ctx, ops, ow, oh) {
  ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1; ctx.clearRect(0, 0, ow, oh);
  for (const o of ops) {
    ctx.globalCompositeOperation = o.op; ctx.globalAlpha = o.alpha;
    if (o.fill) { ctx.fillStyle = o.fill; ctx.fillRect(0, 0, ow, oh); } else ctx.drawImage(o.cover ? flashCover(o) : o.peek ? peekCover(o) : o.cv, 0, 0, ow, oh);
  }
  ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
}
// A number that changes whenever any of a stack's live layer canvases has been redrawn (each swatch counts
// its own redraws in cv._v). The stack is only recomposed when it changes: once every layer has settled,
// recomposing again would paint exactly the same picture.
function opsVersion(ops) { let v = 0; for (const o of ops) if (o.cv) v += o.cv._v || 0; return v; }
function stackCanvas(W, H) {
  const out = document.createElement("canvas");
  return drawStack(out, bench.layers, W, H) ? out : null;
}
// Draws a layered stack (the bench, or a saved combo) into a canvas, as a still.
function drawStack(out, layers, W, H) {
  const ops = stackOps(W, H, layers);
  if (!ops) return false;
  const dpr = swatchDpr(W);
  out.width = Math.round(W * dpr); out.height = Math.round(H * dpr);
  composeOps(out.getContext("2d"), ops, out.width, out.height);
  return true;
}
// A saved combo's swatch on the combos page moves like the shelf's: each layer is its own live swatch (hidden
// under the card's canvas at the same size, so their pointer maths work), the pointer or the touch-screen
// drift is passed to all of them, and the stack is recomposed every frame while any of them is moving.
function liveStack(out, layers, W, H) {
  const ops = stackOps(W, H, layers), box = out.parentElement;
  box.querySelectorAll(":scope > .stage-layers").forEach(el => el.remove());
  if (!ops) return false;
  const dpr = swatchDpr(W);
  out.width = Math.round(W * dpr); out.height = Math.round(H * dpr);
  const ctx = out.getContext("2d"), mine = claim(out);
  const holder = document.createElement("div"); holder.className = "stage-layers"; holder.setAttribute("aria-hidden", "true");
  ops.forEach(o => o.cv && holder.appendChild(o.cv));
  box.append(holder);
  composeOps(ctx, ops, out.width, out.height);
  let until = 0, raf = 0, drawn = opsVersion(ops);
  const loop = now => {
    if (!mine()) { raf = 0; return; }
    const v = opsVersion(ops); if (v !== drawn) { drawn = v; composeOps(ctx, ops, out.width, out.height); }
    raf = now < until ? requestAnimationFrame(loop) : 0;
  };
  const kick = () => { until = performance.now() + 3500; if (!raf) raf = requestAnimationFrame(loop); };
  out.onpointermove = e => { ops.forEach(o => o.cv && o.cv.onpointermove && o.cv.onpointermove(e)); kick(); };
  out.onpointerleave = e => { ops.forEach(o => o.cv && o.cv.onpointerleave && o.cv.onpointerleave(e)); kick(); };
  // Magnetic layers turn from cat eye to glass bead with their place on screen while scrolling (touch screens).
  const resting = ops.filter(o => o.cv && o.cv.setRest);
  out.setRest = resting.length ? (h, instant) => { resting.forEach(o => o.cv.setRest(h, instant)); kick(); } : null;
  out.classList.add("interactive");
  return true;
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
    dropify(box, dropKeyFor(bench.layers), box.clientHeight / box.clientWidth || 360 / 348);
    composeOps(ctx, ops, out.width, out.height);
    let until = 0, raf = 0, drawn = opsVersion(ops);
    const loop = now => {
      const v = opsVersion(ops); if (v !== drawn) { drawn = v; composeOps(ctx, ops, out.width, out.height); }
      raf = now < until ? requestAnimationFrame(loop) : 0;
    };
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
  $("#peekCount").textContent = n ? `(${n})` : ""; // "Layers (2)", Figma node 2412:20759
  $("#peekSub").textContent = n ? `${n} layer${n > 1 ? "s" : ""}` : "Start adding polishes to see how they layer together.";
  const cv = stackCanvas(44, 44); if (cv) { mini.appendChild(cv); dropify(mini, dropKeyFor(bench.layers), 1, { small: true }); }
  // The thumbnails run in the order the polishes were added, oldest on the left and the newest on the right
  // (layers from a saved combo, which carry no time, count as added base first), showing the last four.
  // A polish that's still flying in (see quickAdd) keeps its spot but stays invisible until it lands; the
  // others glide over rather than jumping, and one pushed off the left end fades away.
  const th = $("#peekThumbs"), old = [...th.children].filter(t => t.dataset.pid), was = new Map(old.map(t => [t.dataset.pid, t.getBoundingClientRect()]));
  th.innerHTML = "";
  const order = bench.layers.map((l, i) => ({ l, k: l.added || i })).sort((a, b) => a.k - b.k).map(o => o.l);
  order.slice(-4).forEach(l => {
    const p = polishById(l.pid); if (!p) return;
    const c = document.createElement("canvas"); renderSwatch(c, p, 24, 24);
    const t = dropThumb(c, p.id, { ring: 16 }); t.dataset.pid = p.id; // a 2px ring
    if (peekLanding.has(p.id)) t.style.opacity = 0;
    th.appendChild(t);
  });
  if (reduceMotion) return;
  const now = new Set([...th.children].map(t => t.dataset.pid));
  [...th.children].forEach(t => {
    const dx = was.has(t.dataset.pid) ? was.get(t.dataset.pid).left - t.getBoundingClientRect().left : 0;
    if (Math.abs(dx) > .5) t.animate([{ transform: `translateX(${dx}px)` }, { transform: "none" }], { duration: 300, easing: "cubic-bezier(.2, .8, .2, 1)" });
  });
  // Still in the Layers but pushed out of the last four: it fades and shrinks away where it was.
  if (bench.layers.length) old.forEach(t => {
    const r = was.get(t.dataset.pid);
    if (now.has(t.dataset.pid) || !bench.layers.some(l => l.pid === t.dataset.pid) || !r.width) return;
    const box = th.getBoundingClientRect();
    delete t.dataset.pid;
    Object.assign(t.style, { position: "absolute", margin: 0, left: r.left - box.left + "px", top: r.top - box.top + "px", pointerEvents: "none" });
    th.prepend(t);
    t.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "scale(.6)" }], { duration: 260, easing: "ease-out", fill: "forwards" }).onfinish = () => t.remove();
  });
}
function setSheet(expanded) {
  const b = $("#bench");
  b.classList.toggle("expanded", expanded); b.style.transform = "";
  $("#peek").setAttribute("aria-expanded", expanded);
  if (!expanded) { b.scrollTop = 0; $(".bench-title").blur(); }
  // Wait out the tap that opened the sheet, so it doesn't also start editing the name.
  clearTimeout(setSheet.t); setSheet.t = setTimeout(syncTitleEditing, expanded ? 400 : 0);
}
// While the phone sheet is expanded, the page behind it doesn't scroll: the html element stops scrolling, and
// touch drags outside the sheet are cancelled (iOS can still pan a page with overflow hidden). Kept in sync with
// the sheet's classes, so every way it collapses or closes unlocks the page.
{
  const b = $("#bench"), root = document.documentElement;
  const sync = () => root.classList.toggle("sheet-lock", sheetMQ.matches && !b.hidden && b.classList.contains("expanded"));
  new MutationObserver(sync).observe(b, { attributes: true, attributeFilter: ["class", "hidden"] });
  sheetMQ.addEventListener("change", sync);
  document.addEventListener("touchmove", e => {
    if (root.classList.contains("sheet-lock") && !b.contains(e.target)) e.preventDefault();
  }, { passive: false });
}
// A saved combo's name is edited in place by tapping it, with nothing on screen saying so. It saves when focus
// leaves (Enter does the same, Escape cancels). On phones the collapsed sheet's header only opens the sheet.
function syncTitleEditing() {
  const t = $(".bench-title"), on = !!benchCombo() && (!sheetMQ.matches || $("#bench").classList.contains("expanded"));
  if (on) { t.contentEditable = "plaintext-only"; t.spellcheck = false; } else t.removeAttribute("contenteditable");
}
{
  const t = $(".bench-title");
  t.addEventListener("keydown", e => {
    if (e.key === "Enter") { e.preventDefault(); t.blur(); }
    else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); t.textContent = (benchCombo() || {}).name || ""; t.blur(); }
  });
  t.addEventListener("blur", () => {
    const c = benchCombo(), name = t.textContent.replace(/\s+/g, " ").trim();
    if (c && name && name !== c.name) { c.name = name; saveCombos(); renderShelf(); }
    renderBench();
  });
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
  peek.onkeydown = e => { if (sheetMQ.matches && !e.target.isContentEditable && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); setSheet(!b.classList.contains("expanded")); } };
  // Drag the header to move the sheet with your finger; a short tap toggles it.
  let drag = null;
  head.addEventListener("pointerdown", e => {
    if (!sheetMQ.matches || e.target.closest("#closeBench")) return;
    if (e.target.closest(".bench-title[contenteditable]")) return;  // editing the combo's name, not dragging
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
  renderComboThumbs();
  if (!benchIsOpen()) return;
  $("#bench").classList.toggle("no-layers", !liveLayers(bench.layers).length);
  renderStage();
  // A saved combo's name replaces the "Layers" headline. Save combo only appears (rising in) once there's a second
  // layer; while the bench matches a saved combo the button becomes Delete combo instead.
  const saved = benchCombo(), btn = $("#saveCombo");
  const title = $(".bench-title");
  if (document.activeElement !== title) title.textContent = saved ? saved.name : "Layers";
  syncTitleEditing();
  const show = !!saved || liveLayers(bench.layers).length >= 2;
  if (show && btn.hidden) { btn.classList.remove("rise-in"); void btn.offsetWidth; btn.classList.add("rise-in"); }
  btn.hidden = !show;
  btn.textContent = saved ? "Delete combo" : "Save combo";
  const ol = $("#layers"); ol.innerHTML = "";
  if (!bench.layers.length) { ol.innerHTML = `<li class="hint">Start adding polishes to see how they layer together.</li>`; return; }
  // Listed top layer first, like a stack seen from above.
  bench.layers.map((l, i) => [l, i]).reverse().forEach(([l, i]) => {
    const p = polishById(l.pid);
    const li = document.createElement("li"); li.className = "layer";
    const th = document.createElement("canvas"); th.className = "layer-thumb";
    const mid = document.createElement("div"); mid.className = "layer-text";
    const nm = document.createElement("p"); nm.className = "layer-name"; nm.textContent = p ? (p.name || "Untitled") : "Removed polish";
    const fx = document.createElement("p"); fx.className = "layer-fx"; fx.textContent = p ? labelsOf(p).map(k => EFFECTS[k] || k).join(" · ") : "No longer on your shelf";
    mid.append(nm, fx);
    const del = document.createElement("button"); del.type = "button"; del.className = "layer-del"; del.innerHTML = TRASH;
    del.setAttribute("aria-label", `Remove ${p ? p.name : "layer"}`);
    del.onclick = () => { bench.layers.splice(i, 1); saveBench(); renderBench(); };
    const grip = document.createElement("span"); grip.className = "layer-grip"; grip.innerHTML = GRIP; grip.setAttribute("aria-hidden", "true");
    li.append(grip, dropThumb(th, p ? p.id : "removed"), mid, del); ol.appendChild(li);
    if (p) renderSwatch(th, p, 48, 48);
  });
}

/* ---------- grid fit ---------- */
// Fill the full width: use the column count whose cards come closest to the breakpoint size, then
// size the cards to exactly fill the row (never above 1.4x the design, 336px). Phones use CSS.
const GAP = 40, MAX_CARD = 336, COMBO_CARD = 600, COMBO_MIN = 420;
// Zoom levels (see "zoom" below): swatches per row on a phone, and how much smaller desktop cards get.
const ZOOMS = [2, 3, 4], ZOOM_SCALE = { 2: 1, 3: 2 / 3, 4: 1 / 2 };
// The shelf opens at the middle zoom (3 per row) on larger screens and the most zoomed out (4 per row) on
// phones (600px and narrower, where the grid switches to its phone layout). A zoom picked during a visit isn't remembered.
const zoom = { level: matchMedia("(max-width: 600px)").matches ? 4 : 3 };
// The zoom actually showing: Favorite combos is always at the most zoomed in level.
function zoomLevel() { return state.view === "combos" ? ZOOMS[0] : zoom.level; }
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
  if (zoomBusy()) { pumping = requestAnimationFrame(pump); return; } // wait for the zoom animation to finish first
  const t = performance.now(); let drew = false;
  while (drawQueue.length && (!drew || performance.now() - t < 12)) {
    // A swatch that's only being sharpened at its new size (after a zoom or the Layers pane opening) waits
    // while the page is being scrolled or a swatch hovered: its old picture is already showing, scaled.
    let i = 0;
    if (t - activeAt < 300) { i = drawQueue.findIndex(c => !c._soft); if (i < 0) break; }
    const cv = drawQueue.splice(i, 1)[0];
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
// Background drawing waits while the page is being scrolled or a swatch is being hovered: one draw can
// take longer than a frame on a slower computer, and landing in the middle of a scroll or a hover
// animation made it stutter. (Swatches coming into view are still drawn right away, by the queue above.)
let activeAt = 0;
const markActive = () => { activeAt = performance.now(); };
addEventListener("scroll", markActive, { passive: true });
addEventListener("wheel", markActive, { passive: true });
document.addEventListener("pointermove", e => { if (e.target.classList && e.target.classList.contains("swatch")) markActive(); }, { passive: true });
function fillIdle() {
  idle(deadline => {
    const next = [...document.querySelectorAll("#grid .swatch")].find(cv => !cv._w && cv.parentElement.clientWidth); // hidden cards wait until shown
    if (!next) return;
    if (deadline.timeRemaining() > 4 && !zoomBusy() && performance.now() - activeAt > 300) { drawIO && drawIO.unobserve(next); drawCard(next); shapeForScroll(true); }
    fillIdle();
  });
}
function drawCard(cv) {
  const w = Math.round(cv.parentElement.clientWidth);
  if (!w) { cv._w = 0; queueDraw(cv); return; } // its card is hidden by a filter: draw once it's shown
  cv._w = w;
  // Redrawn at a new size (after a zoom or resize): the old picture fades out over the new one, so the
  // swatch sharpens up instead of popping (glitter and sparkles land in new places at each size).
  const soft = !!(cv._soft && cv.width && !reduceMotion); cv._soft = false;
  // (Drawn on the background thread, the old picture is copied when the new one arrives, not now.)
  if (cv._p && !cv._combo && swatchWorker()) { askWorker(cv, w, soft); return; }
  const ghost = soft ? ghostOf(cv) : null;
  if (cv._combo) liveStack(cv, cv._combo.layers, w, Math.round(w * 260 / 240));
  else renderSwatch(cv, cv._p, w, Math.round(w * 260 / 240));
  if (cv._p) pourDrawn(cv); // its drop may be waiting to fade the swatch in (see pourIn)
  if (ghost) fadeGhost(ghost);
}
function fadeGhost(ghost) { ghost.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 280, easing: "ease-out", fill: "forwards" }).onfinish = () => ghost.remove(); }

/* ---------- background drawing ---------- */
// On computers with a mouse, the shelf's swatches are drawn on a background thread (js/swatch-worker.js),
// by the same drawing code (js/swatch-render.js). Drawing one swatch can take longer than a frame on an older
// computer, and after a zoom every swatch on screen is drawn again at its new size, one after another; on
// the page's own thread that stalled the zoom glide, scrolling and hovering. In the worker, each swatch
// keeps its live canvas and hover animation: the pointer is passed to it, and each new picture comes back
// and is pasted into the swatch's canvas. Pictures are identical; they just don't hold up the page.
// Phones and tablets keep drawing on the page (their swatches drift and change shape as the page scrolls,
// which talks to the swatch directly), as does any browser without workers that can draw offscreen.
let swWorker, swNext = 0;
// Safari gets each picture as plain pixels (see "pixels" in js/swatch-worker.js).
const isSafari = /AppleWebKit/.test(navigator.userAgent) && !/Chrome|Chromium|CriOS|Edg\//.test(navigator.userAgent);
const swCanvas = new Map(); // request id -> the swatch canvas waiting for (or showing) its pictures
function swatchWorker() {
  if (swWorker !== undefined) return swWorker;
  swWorker = null;
  if (noHover || typeof OffscreenCanvas === "undefined" || typeof Worker === "undefined" || typeof createImageBitmap === "undefined") return null;
  try {
    const tag = document.querySelector('script[src*="swatch-render.js"]'), q = tag ? tag.getAttribute("src").split("?")[1] : "";
    swWorker = new Worker(new URL("js/swatch-worker.js" + (q ? "?" + q : ""), SITE_ROOT));
    swWorker.onmessage = e => landPicture(e.data);
    // If the worker can't draw here after all, everything goes back to drawing on the page.
    swWorker.onerror = () => {
      swWorker = null;
      swCanvas.forEach(cv => { if (cv.isConnected) { cv._swId = 0; cv._pending = null; cv._w = 0; queueDraw(cv); } });
      swCanvas.clear();
    };
  } catch (e) { swWorker = null; }
  return swWorker;
}
function askWorker(cv, w, soft) {
  // Let go of this canvas's earlier swatch, and of any for canvases that have left the page.
  const drop = [];
  swCanvas.forEach((c, id) => { if (c === cv || !c.isConnected) { drop.push(id); swCanvas.delete(id); } });
  if (drop.length) swWorker.postMessage({ type: "drop", ids: drop });
  const id = ++swNext, H = Math.round(w * 260 / 240);
  cv._swId = id; cv._swV = -1; cv._pending = { soft };
  swCanvas.set(id, cv);
  swWorker.postMessage({ type: "draw", id, pixels: isSafari, p: cv._p, W: w, H, dpr: window.devicePixelRatio || 1, restH: finishH(), finish: state.finish });
  cv.onpointermove = e => pointerToWorker(cv, e, false);
  cv.onpointerleave = e => pointerToWorker(cv, e, true);
  cv.classList.add("interactive");
}
function pointerToWorker(cv, e, leave) {
  if (!swWorker || !cv._swId) return;
  const r = cv.getBoundingClientRect();
  swWorker.postMessage({ type: "pointer", id: cv._swId, x: e.clientX, y: e.clientY, pointerType: e.pointerType, leave, finish: state.finish,
    rect: { left: r.left, top: r.top, width: r.width, height: r.height, right: r.right, bottom: r.bottom } });
}
function landPicture({ id, bmp, img, v }) {
  const cv = swCanvas.get(id);
  if (!cv || cv._swId !== id || v <= cv._swV) { if (bmp) bmp.close(); return; }
  cv._swV = v;
  const first = cv._pending; cv._pending = null;
  const ghost = first && first.soft && cv.width ? ghostOf(cv) : null; // the old picture fades out over the new one
  const pic = bmp || img;
  if (cv.width !== pic.width || cv.height !== pic.height) { cv.width = pic.width; cv.height = pic.height; }
  claim(cv); // an animation from when this canvas was drawn on the page stops painting into it
  const g = cv.getContext("2d");
  if (img) g.putImageData(img, 0, 0); // (replaces every pixel, whatever the canvas's drawing settings)
  else {
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.filter = "none"; g.globalCompositeOperation = "copy";
    g.drawImage(bmp, 0, 0);
    g.globalCompositeOperation = "source-over"; bmp.close();
  }
  if (first) { if (cv._p) pourDrawn(cv); if (ghost) fadeGhost(ghost); }
}
// A still copy of a swatch's current picture, laid over it.
function ghostOf(cv) {
  const g = document.createElement("canvas"); g.className = "swatch-ghost"; g.setAttribute("aria-hidden", "true");
  g.width = cv.width; g.height = cv.height;
  try { g.getContext("2d").drawImage(cv, 0, 0); } catch (e) { return null; }
  cv.after(g); return g;
}
let redrawTimer = 0;
// After a resize or a zoom, swatches on screen are redrawn first, top to bottom, a frame's worth at a
// time (one redraw can take tens of milliseconds, so doing them all at once froze the page); the old
// picture stays up, scaled, until each one's turn. The others are marked undrawn and go back into the
// lazy queue, so resizing (or the scrollbar appearing) doesn't redraw the whole shelf. Nothing is
// redrawn while the zoom animation plays.
// A swatch keeps the picture it has when its card is within 10% of the size it was drawn at (the Layers pane
// opening or closing changes card sizes by about 8%): the picture is just scaled, instead of drawing the
// whole swatch again, which was the stutter after the pane slid. Bigger changes (zooming) still redraw.
// cv._w stays the size it was drawn at, so small changes that add up past 10% redraw too.
function sizeStillFits(cv) { const w = cv.parentElement.clientWidth; return Math.abs(w - cv._w) <= Math.max(2, cv._w * .1); }
function redrawCards() {
  clearTimeout(redrawTimer);
  redrawTimer = setTimeout(function go() {
    if (zoomBusy()) { redrawTimer = setTimeout(go, zoomBusyUntil - performance.now() + 30); return; }
    const vh = innerHeight, now = [];
    document.querySelectorAll("#grid .swatch").forEach(cv => {
      if (!cv._w || sizeStillFits(cv)) return;
      const r = cv.getBoundingClientRect();
      cv._w = 0;
      if (r.bottom > -40 && r.top < vh + 40) { cv._soft = true; now.push([r.top, r.left, cv]); } else queueDraw(cv);
    });
    now.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    drawQueue.unshift(...now.map(e => e[2]));
    if (drawQueue.length && !pumping) pumping = requestAnimationFrame(pump);
    fillIdle();
  }, 150);
}

function fitGrid() {
  const grid = $("#grid");
  if (innerWidth <= 600) { grid.style.removeProperty("--card"); redrawCards(); return; }
  // Zooming out (3 or 4 per row on a phone) makes desktop cards 2/3 or 1/2 their usual size.
  const cs = getComputedStyle(grid), scale = ZOOM_SCALE[zoomLevel()] || 1;
  const base = (parseFloat(cs.getPropertyValue("--card-base")) || 240) * scale, gap = parseFloat(cs.columnGap) || GAP, avail = grid.clientWidth;
  // Favorite combos: cards are 600px across at 2 per row (Figma node 2406:3621, room for the polishes
  // scattered around each swatch), 2/3 and 1/2 of that zoomed out, spread across the row.
  const combos = grid.classList.contains("combos-grid"), size = combos ? COMBO_CARD * scale : base;
  let n = Math.max(1, Math.round((avail + gap) / (size + gap)));
  // Combos between two and three full-size cards wide (about 1400 to 1750px windows) left a wide empty
  // middle at 2 per row: they go 3 across instead, shrinking the cards, as long as each stays 420px or more.
  if (combos && n === 2 && (avail - 2 * gap) / 3 >= COMBO_MIN * scale) n = 3;
  const card = Math.min(combos ? size : MAX_CARD * scale, (avail - (n - 1) * gap) / n);
  grid.style.setProperty("--card", Math.floor(card) + "px");
  grid.style.setProperty("--cols", n);
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
    if (!cv.setRest || cv.closest(".card[hidden]")) return;
    const r = cv.getBoundingClientRect();
    if (r.bottom < -40 || r.top > vh + 40) return;
    const d = Math.min(1, Math.abs((r.top + r.bottom) / 2 - vh / 2) / (vh / 2));
    cv.setRest(d * d * (3 - 2 * d), instant);
  });
}
let shapeRaf = 0;
addEventListener("scroll", () => { if (!shapeRaf) shapeRaf = requestAnimationFrame(() => { shapeRaf = 0; shapeForScroll(); }); }, { passive: true });

/* ---------- zoom ---------- */
// The zoom control is a floating bar at the bottom of the screen with three icons: 2 (big), 3 and
// 4 (dense, the default) swatches per row on a phone. Tap one to switch; the selected one sits on a dark circle. Arrow
// keys move between them. Each icon is a grid of dots (droplet swatches) or rounded squares (rectangles).
// At 3 per row the cards show the name and effect types; at 4, only the swatch (no + button: add from the
// polish's page). The choice is kept in this browser.
function zoomIcon(n) {
  const icon = document.createElement("span"); icon.className = "zi"; icon.style.setProperty("--n", n); icon.dataset.n = n; icon.setAttribute("aria-hidden", "true");
  for (let i = 0; i < n * n; i++) icon.appendChild(document.createElement("i"));
  return icon;
}
function buildZoom() {
  const box = $("#zoom"); box.innerHTML = "";
  box.classList.toggle("dots", typeof DROPS !== "undefined" && DROPS);
  // The dark circle holds white copies of the icons (see .z-thumb in style.css).
  const thumb = Object.assign(document.createElement("span"), { className: "z-thumb" }), row = Object.assign(document.createElement("span"), { className: "z-thumb-row" });
  ZOOMS.forEach(n => { const slot = document.createElement("span"); slot.appendChild(zoomIcon(n)); row.appendChild(slot); });
  thumb.appendChild(row); box.appendChild(thumb);
  ZOOMS.forEach(n => {
    const b = document.createElement("button"); b.type = "button"; b.className = "z-opt"; b.dataset.n = n;
    b.setAttribute("role", "radio"); b.setAttribute("aria-label", `${n} per row`);
    b.appendChild(zoomIcon(n));
    b.onclick = () => setZoom(n);
    box.appendChild(b);
  });
  box.addEventListener("keydown", e => {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    setZoom(ZOOMS[Math.max(0, Math.min(ZOOMS.length - 1, ZOOMS.indexOf(zoom.level) + step))]);
    box.querySelector('[aria-checked="true"]').focus();
  });
  setZoom(zoom.level, true);
}
function setZoom(n, quiet) {
  const changed = n !== zoom.level;
  const settle = changed && !quiet ? zoomFlip() : null; // note where every card is before the grid changes
  zoom.level = n;
  $("#grid").dataset.zoom = zoomLevel();
  const box = $("#zoom"); box.style.setProperty("--i", ZOOMS.indexOf(n));
  box.querySelectorAll(".z-opt").forEach(b => { const on = +b.dataset.n === n; b.setAttribute("aria-checked", on); b.tabIndex = on ? 0 : -1; });
  if (changed && !quiet) { fitGrid(); settle(); }
}

/* Switching zoom animates the shelf from the old grid to the new one: each card on screen glides and
   scales from where it was to where it lands (a "FLIP": the new layout is applied at once, then each
   card is moved back to its old place with a transform and let go). Only transforms and opacity
   animate, so the browser moves the cards on the graphics card without redrawing anything; the
   swatches keep their current pictures, scaled, and are redrawn at their new size once the cards have
   landed (see redrawCards). Card text fades in at its new size, and cards that only come into view at
   the new zoom fade in. The card nearest the middle of the screen stays put (unless the shelf's top is
   in view), so you stay where you were. With reduced motion, the grid just switches. */
const ZOOM_MS = 420, ZOOM_EASE = "cubic-bezier(.2, .8, .2, 1)";
let zoomBusyUntil = 0, zoomAnims = [];
function zoomBusy() { return performance.now() < zoomBusyUntil; }
function zoomFlip() {
  const grid = $("#grid"), vh = innerHeight, wrapOf = c => c.querySelector(".swatch-wrap");
  const near = r => r.bottom > -vh * .2 && r.top < vh * 1.2;
  const cards = [...grid.querySelectorAll(":scope > .card:not([hidden])")].filter(wrapOf);
  const before = new Map();
  cards.forEach(c => { const r = wrapOf(c).getBoundingClientRect(); if (near(r)) before.set(c, r); });
  // Which cards show their + button now (it's hidden at 4 per row), so one that appears fades in with the text.
  const btnOf = c => c.querySelector(".swatch-btn"), hadBtn = new Set(cards.filter(c => btnOf(c) && btnOf(c).offsetParent));
  // Stay with the card in the middle of the screen, unless the top of the shelf is showing.
  let anchor = null, anchorY = vh / 2;
  if (grid.getBoundingClientRect().top < 0) {
    let best = Infinity;
    before.forEach((r, c) => { const d = Math.abs(r.top + r.height / 2 - vh / 2); if (d < best) { best = d; anchor = c; anchorY = r.top + r.height / 2; } });
  }
  zoomAnims.forEach(a => a.cancel()); zoomAnims = [];
  return () => {
    if (anchor) { const r = wrapOf(anchor).getBoundingClientRect(), dy = r.top + r.height / 2 - anchorY; if (Math.abs(dy) > 1) scrollTo({ top: scrollY + dy, behavior: "instant" }); }
    if (reduceMotion) return;
    zoomBusyUntil = performance.now() + ZOOM_MS;
    const opts = { duration: ZOOM_MS, easing: ZOOM_EASE };
    cards.forEach(c => {
      const a = before.get(c), cr = c.getBoundingClientRect(), b = wrapOf(c).getBoundingClientRect();
      if (!a && !near(b)) return;
      if (c.classList.contains("pour-wait") || (c.classList.contains("rise") && !c.classList.contains("in"))) return; // it hasn't arrived yet: it pours or rises in on its own
      if (a) {
        const s = a.width / b.width, ox = b.left - cr.left, oy = b.top - cr.top;
        zoomAnims.push(c.animate([
          { transformOrigin: `${ox}px ${oy}px`, transform: `translate(${a.left - b.left}px, ${a.top - b.top}px) scale(${s})` },
          { transformOrigin: `${ox}px ${oy}px`, transform: "none" }], opts));
        const text = c.querySelector(".card-text");
        if (text && text.offsetParent) zoomAnims.push(text.animate([{ opacity: 0 }, { opacity: 1 }], { duration: ZOOM_MS * .55, delay: ZOOM_MS * .45, easing: "ease-out", fill: "backwards" }));
        const btn = btnOf(c);
        if (btn && !hadBtn.has(c) && btn.offsetParent && getComputedStyle(btn).opacity !== "0") zoomAnims.push(btn.animate([{ opacity: 0 }, { opacity: 1 }], { duration: ZOOM_MS * .55, delay: ZOOM_MS * .45, easing: "ease-out", fill: "backwards" }));
      } else {
        zoomAnims.push(c.animate([{ opacity: 0, transform: "scale(.94)" }, { opacity: 1, transform: "none" }], { ...opts, delay: ZOOM_MS * .25, fill: "backwards" }));
      }
    });
  };
}

/* ---------- boot ---------- */
buildPills();
document.querySelectorAll("#filters .scope-icon").forEach(fitIcon);
// Pill icons play a short animation when the pointer comes onto the pill, or when it's pressed (the animations
// are in css/style.css, under "Pill icon animations", and are off with Reduce Motion). Each plays through
// ICON_CYCLES times, to the end even if the pointer leaves, and starts over on the next hover or press.
// Delegated, so the mini nav's copies of the pills play too.
const ICON_CYCLES = 3, ICON_REST = 120; // ms between cycles
function playIcon(btn) {
  clearTimeout(btn._ia); cancelAnimationFrame(btn._moon);
  btn.classList.remove("ia-play"); void btn.offsetWidth; btn.classList.add("ia-play");
  // One cycle lasts as long as the icon's longest part (delay included). Each later cycle rewinds the same
  // animations and plays them again, so the parts stay in step with each other.
  const anims = btn.getAnimations ? btn.getAnimations({ subtree: true }).filter(a => a.animationName) : [];
  const cycle = anims.reduce((m, a) => Math.max(m, a.effect.getComputedTiming().endTime || 0), 0) || 1000;
  let left = ICON_CYCLES - 1;
  const again = () => {
    if (left-- <= 0) { btn.classList.remove("ia-play"); return; }
    anims.forEach(a => { a.currentTime = 0; a.play(); });
    btn._ia = setTimeout(again, cycle + ICON_REST);
  };
  btn._ia = setTimeout(again, cycle + ICON_REST);
  // Glow-in-the-dark: the moon's shadow slides off (waxing to full) and back (waning), over 1s, each cycle.
  const moon = btn.querySelector(".ia-glow .moon");
  if (moon && !reduceMotion) {
    const t0 = performance.now(), far = 2 * MOON_R + 1, per = 1000 + ICON_REST;
    const step = now => {
      const t = Math.max(0, now - t0), k = Math.min(1, (t % per) / 1000), e = (1 - Math.cos(k * 2 * Math.PI)) / 2;
      moon.setAttribute("d", moonPath(MOON_REST + (far - MOON_REST) * (t >= per * ICON_CYCLES ? 0 : e)));
      if (t < per * ICON_CYCLES) btn._moon = requestAnimationFrame(step);
    };
    btn._moon = requestAnimationFrame(step);
  }
}
// Pressing a pill filters the shelf, and laying the shelf out again can hold up the page for a few frames.
// The icon (an SVG, which Safari animates on the page's main thread) would sit still through that and only
// catch up at the end, so after a press it starts once frames are flowing again (at most about 1/3s later).
function playIconAfterFilter(btn) {
  cancelAnimationFrame(btn._wait);
  const t0 = performance.now(); let last = 0;
  const tick = now => {
    if (last && (now - last < 40 || now - t0 > 350)) return playIcon(btn);
    last = now; btn._wait = requestAnimationFrame(tick);
  };
  btn._wait = requestAnimationFrame(tick);
}
const iconPill = e => { const b = e.target.closest && e.target.closest(".scope"); return b && b.querySelector(".ia") ? b : null; };
document.addEventListener("pointerover", e => {
  const b = iconPill(e); if (b && e.pointerType === "mouse" && !b.contains(e.relatedTarget)) playIcon(b);
});
// A press (a tap, or a click if the hover's animation has already finished) plays it, once the filter is applied.
document.addEventListener("click", e => {
  const b = iconPill(e); if (b && !(b.classList.contains("ia-play") && b.matches(":hover") && matchMedia("(hover: hover)").matches)) playIconAfterFilter(b);
});
// A filter row with more pills than fit fades out at the edge that has more to scroll to.
function fadeScopes() {
  document.querySelectorAll(".filter-row .scopes").forEach(el => {
    const max = el.scrollWidth - el.clientWidth;
    el.classList.toggle("more-start", max > 1 && el.scrollLeft > 1);
    el.classList.toggle("more-end", max > 1 && el.scrollLeft < max - 1);
  });
}
document.querySelectorAll(".filter-row .scopes").forEach(el => el.addEventListener("scroll", fadeScopes, { passive: true }));
addEventListener("resize", fadeScopes);
fadeScopes();
// Mini nav: once the filters have scrolled out of view, the same pills slide in at the top of the window in
// one row (.mini-nav in style.css). Each mini pill is a copy that presses the real pill, and mirrors its
// pressed state, so the filters stay the one source of truth.
const filtersEl = $("#filters"), miniNav = $("#miniNav"), miniRow = $("#miniRow");
(() => {
  const groups = ["#fxPills", "#brandPills"].map(sel => [...document.querySelectorAll(sel + " .scope")]);
  groups.forEach((pills, gi) => {
    if (gi) { const gap = document.createElement("span"); gap.className = "mini-gap"; miniRow.appendChild(gap); }
    pills.forEach(orig => {
      const copy = orig.cloneNode(true); copy.removeAttribute("id");
      copy.onclick = () => orig.click();
      new MutationObserver(() => copy.setAttribute("aria-pressed", orig.getAttribute("aria-pressed"))).observe(orig, { attributes: true, attributeFilter: ["aria-pressed"] });
      miniRow.appendChild(copy);
    });
  });
})();
function placeMiniNav() {
  const r = $("main").getBoundingClientRect();
  miniNav.style.left = r.left + "px"; miniNav.style.width = r.width + "px";
}
function syncMiniNav() {
  // Only once the last filter row (Brands), hairline included, has scrolled fully off the top, plus a little
  // more, so the two never show at once.
  const rows = filtersEl.querySelectorAll(".filter-row"), last = rows[rows.length - 1] || filtersEl;
  const show = state.view !== "combos" && last.getBoundingClientRect().bottom < -16;
  if (show === document.body.classList.contains("show-mini")) return;
  clearTimeout(miniNav._hide);
  if (show) {
    placeMiniNav();
    // Back in the layout first, with a style flush, so the slide in still runs from its hidden state.
    if (miniNav.hidden) { miniNav.hidden = false; void miniNav.offsetWidth; }
  } else {
    // Once the fade out is over, the mini nav leaves the layout altogether (display: none). Desktop Safari could
    // keep showing the faded-out nav's layer over the headline, and leave the Effects row (a sideways scroller
    // too) blank; taking the nav's layers away and re-layering the filter rows makes it draw them afresh.
    miniNav._hide = setTimeout(() => {
      if (document.body.classList.contains("show-mini")) return;
      miniNav.hidden = true;
      filtersEl.querySelectorAll(".scopes").forEach(el => {
        el.style.willChange = "transform";
        requestAnimationFrame(() => requestAnimationFrame(() => { el.style.willChange = ""; }));
      });
    }, 340);
  }
  document.body.classList.toggle("show-mini", show);
  miniNav.inert = !show;
}
// Checked on every scroll event, not batched into a requestAnimationFrame: Safari can leave a requested frame
// unrun (a tab or window in the background, momentum scrolling), and a batch flag that never cleared ignored
// every later scroll, so the mini nav stayed up over the headline. The check is one rect read and returns early
// when nothing changes. scrollend and an IntersectionObserver on the Brands row back it up, so the end of a
// fast or momentum scroll back to the top always hides it.
addEventListener("scroll", syncMiniNav, { passive: true });
addEventListener("scrollend", syncMiniNav);
addEventListener("pageshow", syncMiniNav);
document.addEventListener("visibilitychange", syncMiniNav);
{ const rows = filtersEl.querySelectorAll(".filter-row");
  new IntersectionObserver(syncMiniNav, { rootMargin: "16px 0px 0px 0px" }).observe(rows[rows.length - 1] || filtersEl); }
addEventListener("resize", () => { placeMiniNav(); syncMiniNav(); });
if (!document.body.classList.contains("show-mini")) miniNav.hidden = true;
var miniReady = true; // var, so setView (which can run before this point) sees undefined rather than throwing
// The shelf column narrows when the Layers pane opens; keep the mini nav over it.
new ResizeObserver(placeMiniNav).observe($("main"));
syncMiniNav();
buildZoom();
renderShelf();
renderBench();
// A share link (p/<id>/) sends visitors here as ?p=<id>: open that polish.
(() => {
  const id = new URLSearchParams(location.search).get("p"), p = id && polishById(id);
  if (!p) return;
  const card = [...document.querySelectorAll("#grid .swatch")].find(cv => cv._p === p);
  if (card) openDetail(p, card.parentElement);
})();
