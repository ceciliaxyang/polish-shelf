# Polish Shelf

A place to browse my nail polishes and try layering them.

## Structure

- `index.html` — page markup
- `css/style.css` — all styles; shelf and pills follow the Figma design
- `js/polishes.js` — the polish collection (edit this to add polishes)
- `images/<polish id>/` — photos saved from each polish's product page
- `js/app.js` — shelf, effect filters, polish swatches, layering pane

## Develop

```bash
npm install
npm run dev
```

Opens a static server at http://localhost:3001.

## Notes

- Polishes live in `js/polishes.js`. The current layers are stored in this browser's localStorage, so they stay on this computer and browser only.
