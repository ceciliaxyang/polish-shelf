# Polish Shelf

A place to browse my nail polishes and try layering them.

## Structure

- `index.html` — page markup
- `css/style.css` — all styles; shelf and pills follow the Figma design
- `js/polishes.js` — the polish collection (edit this to add polishes)
- `images/<polish id>/` — photos saved from each polish's product page
- `js/app.js` — shelf, effect filters, polish swatches, layering pane
- `js/droplet.js` — droplet swatch shape and the developer setting that switches it
- `p/<polish id>/` — each polish's share link, with its link preview (generated)
- `images/og/<polish id>.jpg` — link preview images: the swatch next to the first photo (generated)

## Develop

```bash
npm install
npm run dev
```

Opens a static server at http://localhost:3001.

## Link previews

Opening a polish puts its share link (`/polish-shelf/p/<id>/`) in the address bar. After adding or changing a polish, rebuild the previews:

```bash
npm install
npm run previews            # every polish
npm run previews -- <id>    # just one
```

## Notes

- The floating zoom bar at the bottom (three icons) switches between 2, 3 and 4 (default) swatches per row on a phone (desktop cards shrink to match). At 3 each card shows the name and its effect types in small text, centered (switch to left-aligned in developer settings: tap the title 5 times); at 4 only swatches. The site opens at the middle zoom (3 per row) on larger screens and at 4 per row (the most zoomed out) on phones; a choice isn't remembered between visits. Switching zoom glides the cards into the new grid (skipped with reduced motion); swatches are redrawn at their new size after they land, a few per frame, fading over their old picture.
- Favorite combos is a frosted "Combos" pill (with the two newest combos as thumbnails) that floats just right of the zoom bar (centered together with it on phones); it appears once a combo is saved and switches the page between the shelf and the saved combos. The pill shows how many combos are saved ("Combos 5"), the number in Foggy grey (#6a6a6a). Saving a combo shows "Saving…" on the button, then the combo's swatch flies into the Combos pill (like a shopping cart), which grows a little as the new combo appears in its thumbnails and the count ticks up; then the Layers pane slides out to the right and the layers clear.
- On the Favorite combos page each combo's layered swatch sits in the middle with its polishes scattered around it as smaller drops, then its name and the polishes it's made of. The scatter (sides, distance, height, big or small drops) is picked from the combo's id, so each combo looks a little different but stays the same on every visit. All of them shimmer and move like the shelf's swatches. The page is always at the most zoomed in level (2 per row on desktop, Figma node 2406:3621; 1 per row on phones) and hides the zoom bar, with the Favorite combos button moving to the center. It opens as a full-screen takeover: tapping the pill slides it up over the dimmed shelf, and the close button in the top right (or the pill again) drops it back down to the shelf where you left it. A developer setting (tap the title five times, or `?combos=dark`) shows it dark: black page, light text (Figma node 2406:3849).
- At 4 per row on desktop, hovering a swatch shows a small + to add it to the layers.
- On touch screens (phones and tablets), pressing and holding a shelf swatch adds it to the Layers without opening its page, at every zoom: the swatch squishes in a little during the hold (about 0.4s), then springs back as a copy flies into the Layers peek bar, which pulses as it lands. Holding one that's already in the Layers takes it out again. A normal tap still opens the polish page, and scrolling cancels the hold.
- Polishes live in `js/polishes.js`. The current layers are stored in this browser's localStorage, so they stay on this computer and browser only.
- Swatches show as droplets (poured puddles with a soft sheen) by default, everywhere: shelf, polish page, Layers, combos and thumbnails. A developer setting switches back to rectangles: tap the "Polish shelf" title five times, or add `?swatch=rect` (or `?swatch=drop`) to the address. The choice is kept in this browser. Link preview images are still drawn as rectangles.
