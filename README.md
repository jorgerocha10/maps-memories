# Maps & Memories: scroll site

Run it locally: `node <scroll-craft>/scripts/serve.mjs --root . --port 4500`, then open http://localhost:4500.

## What to set before going live
- **Etsy shop link**: `js/app.js`, `const ETSY_URL = ''`. Empty (now): buttons read "Order your map", lead to the closing plate, which says the Etsy shop opens soon. Paste the shop URL and every button becomes "Order on Etsy" and opens the shop in a new tab.
- **Prices, lead times, other sizes**: not on the page because they were not provided. Only 250 mm is offered.

## Deploy on Vercel
Static site, no build step. `vercel.json` sets security headers (including a Content-Security-Policy) and caching; `.vercelignore` keeps `tools/`, `lab/`, `out/` and the markdown notes out of the deploy.

1. vercel.com → Add New → Project → import `jorgerocha10/maps-memories`.
2. Framework Preset: **Other**. Leave Build Command, Output Directory and Install Command empty. Root Directory: `./`.
3. Deploy. Every push to `main` redeploys.

Test the deploy locally first: `node tools/prodserve.mjs` (serves only the deployed files with the `vercel.json` headers on :4600), then `node tools/prodtest.mjs`.

**If you edit the import map in `index.html`**, update its sha256 in the CSP `script-src` in `vercel.json`, or three.js will be blocked. If the GPX feature gains a new data source, add its host to `connect-src` (fetch) or `img-src` (image tiles).

## Phone hero (pre-rendered frames)
Phones (up to 860px wide) play the hero as 97 frames in `assets/hero-seq/` instead of live WebGL, which ran phones out of GPU memory. The timing and camera path live in `js/hero-timeline.js`, shared by the live 3D and the frame renderer. **If you change the hero animation or the model, re-render the frames:** start the dev server on :4500, then `node tools/frames.mjs` (about a minute).

## Where things come from
- `data/teahouse-*.bin`, `data/teahouse.json`: exported from `Treehouse loop.blend` (TrailPrint3D map, 512x512 heights + material map + trail).
- `data/profile.json`, `assets/contour-*.svg`: built from the GPX and the heightmap (`tools/wpstats.mjs`, `tools/contours.mjs`).
- `assets/il*.webp` (shown) and `assets/wp*.webp` (photo set, `?art=photo`): generated with OpenAI gpt-image-2 (`tools/gen.mjs`, `illus` / `photo` styles, key read from `../../../.env`). Labelled on the page.
- `assets/detail-*.webp`, `assets/poster-*.webp`: rendered from the real model through the site's own renderer (`tools/capture.html` + `tools/capture.mjs`).
- Live GPX surface: elevation from AWS Terrain Tiles; lakes, rivers, streams, forest and scree from OpenStreetMap via OpenFreeMap vector tiles (`js/mvt.js` decodes them). Overpass is the backup, then an elevation/slope estimate (the page says so).

## Tooling
The scripts in `tools/` need `playwright-core` (and local Chrome) and read `OPENAI_API_KEY` from `Maps&Memories/.env`, which is outside this repo and never committed.
