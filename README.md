# Polish Shelf

A place to browse my nail polishes and try layering them.

## Structure

- `index.html` — page markup
- `css/style.css` — all styles; shelf and pills follow the Figma design
- `js/polishes.js` — the polish collection (edit this to add polishes)
- `images/<polish id>/` — photos saved from each polish's product page
- `js/app.js` — shelf, effect filters, polish swatches, layering pane
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

- The zoom control at the end of the effect pills switches between 2 (default), 3 and 4 swatches per row on a phone (desktop cards shrink to match). At 3 only names show; at 4 only swatches. The choice is kept in this browser.
- Polishes live in `js/polishes.js`. The current layers are stored in this browser's localStorage, so they stay on this computer and browser only.
