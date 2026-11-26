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
- Favorite combos is a frosted "Combos" pill (with the two newest combos as thumbnails) that floats just right of the zoom bar (centered together with it on phones); it appears once a combo is saved and switches the page between the shelf and the saved combos. The pill shows how many combos are saved ("Combos 5"). Saving a combo shows "Saving…" on the button, then the Layers pane slides out to the right and the Combos pill grows a little as the new combo appears in its thumbnails and the count ticks up; the layers then clear.
- At 4 per row on desktop, hovering a swatch shows a small + to add it to the layers.
- Polishes live in `js/polishes.js`. The current layers are stored in this browser's localStorage, so they stay on this computer and browser only.
- Swatches show as droplets (poured puddles with a soft sheen) by default, everywhere: shelf, polish page, Layers, combos and thumbnails. A developer setting switches back to rectangles: tap the "Polish shelf" title five times, or add `?swatch=rect` (or `?swatch=drop`) to the address. The choice is kept in this browser. Link preview images are still drawn as rectangles.
