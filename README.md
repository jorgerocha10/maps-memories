# Maps & Memories: scroll site

Run it locally: `node <scroll-craft>/scripts/serve.mjs --root . --port 4500`, then open http://localhost:4500.

## What to set before going live
- **Etsy shop link**: `js/app.js`, `const ETSY_URL = ''`. Empty (now): buttons read "Order your map", lead to the closing plate, which says the Etsy shop opens soon. Paste the shop URL and every button becomes "Order on Etsy" and opens the shop in a new tab.
- **Prices, lead times, other sizes**: not on the page because they were not provided. Only 250 mm is offered.

## Deploy these files only
`index.html`, `scrollcraft.css`, `scrollcraft.js`, `css/`, `js/`, `vendor/`, `assets/`, `data/`.
Do not upload `node_modules/`, `tools/`, `out/`, `lab/` or the `.env` one folder up.

## Where things come from
- `data/teahouse-*.bin`, `data/teahouse.json`: exported from `Treehouse loop.blend` (TrailPrint3D map, 512x512 heights + material map + trail).
- `data/profile.json`, `assets/contour-*.svg`: built from the GPX and the heightmap (`tools/wpstats.mjs`, `tools/contours.mjs`).
- `assets/il*.webp` (shown) and `assets/wp*.webp` (photo set, `?art=photo`): generated with OpenAI gpt-image-2 (`tools/gen.mjs`, `illus` / `photo` styles, key read from `../../../.env`). Labelled on the page.
- `assets/detail-*.webp`, `assets/poster-*.webp`: rendered from the real model through the site's own renderer (`tools/capture.html` + `tools/capture.mjs`).
- Live GPX surface: elevation from AWS Terrain Tiles; lakes, rivers, streams, forest and scree from OpenStreetMap via OpenFreeMap vector tiles (`js/mvt.js` decodes them). Overpass is the backup, then an elevation/slope estimate (the page says so).

## Tooling
The scripts in `tools/` need `playwright-core` (and local Chrome) and read `OPENAI_API_KEY` from `Maps&Memories/.env`, which is outside this repo and never committed.
