# Maps & Memories: scroll site

Run it locally: `node <scroll-craft>/scripts/serve.mjs --root . --port 4500`, then open http://localhost:4500.

## What to set before going live
- **Etsy shop link**: `js/app.js`, `const ETSY_URL`. Every "Order on Etsy" button on the page uses it (they open in a new tab).
- **Prices, lead times, other sizes**: not on the page because they were not provided. Only 250 mm is offered.

## Deploy these files only
`index.html`, `scrollcraft.css`, `scrollcraft.js`, `css/`, `js/`, `vendor/`, `assets/`, `data/`.
Do not upload `node_modules/`, `tools/`, `out/`, `lab/` or the `.env` one folder up.

## Where things come from
- `data/teahouse-*.bin`, `data/teahouse.json`: exported from `Treehouse loop.blend` (TrailPrint3D map, 512x512 heights + material map + trail).
- `data/profile.json`, `assets/contour-*.svg`: built from the GPX and the heightmap (`tools/wpstats.mjs`, `tools/contours.mjs`).
- `assets/wp*.webp`: generated with OpenAI gpt-image-2 (`tools/gen.mjs`, key read from `../../../.env`). Labelled illustrative on the page.
- `assets/detail-*.webp`, `assets/poster-*.webp`: rendered from the real model through the site's own renderer (`tools/capture.html` + `tools/capture.mjs`).
- Live GPX surface: elevation from AWS Terrain Tiles; lakes, rivers, streams, forest and scree from OpenStreetMap via OpenFreeMap vector tiles (`js/mvt.js` decodes them). Overpass is the backup, then an elevation/slope estimate (the page says so).

## Tooling
The scripts in `tools/` need `playwright-core` (and local Chrome) and read `OPENAI_API_KEY` from `Maps&Memories/.env`, which is outside this repo and never committed.
