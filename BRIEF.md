# Maps & Memories: BRIEF

Interviewed 2026-10-25. User answers are verbatim (typos kept). Where the user
delegated ("I'll let you decide that"), the decision is marked **Authored**.

## The interview

1. **What it is, who for.** "This is for Maps & Memories a 3D printed hike terrains map business that generates maps for hikes and trails for gifts."
2. **Belief by the end.** "believe the the trail they did deserves to be a phisical gift to always remember."
3. **Next action.** "Order your map." One label, used everywhere.
4. **Vibe + references.** "Banff, arcteryx, patagonia, nature."
5. **Journey, in their words.** "start with an animation of a map in 3d and the path of the animation is being carved in illuminated red until it completes from the bottom of the mountain to the top ... as you scroll the map becomes a fully finished map with the little badge and its covered with an acrylic lid with a black premium frame on the bottom. as the user scrool some countour lines and red path guides their storytelling."
6. **Energy curve.** "I'll let you decide that." **Authored:** near-silent open, rising through the carve, loudest at the moment the lid closes, calm and close-up for the details, active again at the GPX surface, still at the order.
7. **Feeling + the one moment.** "the moment the website loads it should feel misterious and then it opens up to the animation and conclusion of what the product really is then as the user scrolls it reveals more info about the product."
8. **The one thing no site does.** "a section where the user drags your GPX file onto the page and watch the terrain rise would be amazing ... with vegetation, forests, scree and water turned on and the path with red. ... elevation and path scale can be something the user can switch (currently at the treehouse loop is 1.5 and path scale 0.8)."
9. **Range.** "premium-minimal."
10. **One world or scenes.** Not answered directly; the journey answer describes one object transforming, then information. **Authored:** distinct scenes, with one persistent object (the map) as the hero.
11. **Assets.** Brand kit in `Logo and Brand Design/` (logo lockups, copper badge, palette F7F5F6 / 253946 / 95A7B5 / D2BDA2 / A76825, logo font reserved for the logo only). The Teahouse Loop TrailPrint3D model in Blender (250 mm, elevation scale 1.5, path scale 0.8, ASTER 30 m terrain, OSM water/forest/scree). The GPX. "use the chatgpt for image generation" (OPENAI_API_KEY in `Maps&Memories/.env`).

## Facts the page may state (sourced)

- Teahouse Loop GPX (komoot): 14.05 km, 555 m gain, 1,737 m low, 2,127 m high. Waypoints: Lake Louise Lakeshore, Lake Agnes Tea House, Plain of Six Glaciers Tea House.
- Model: 250 mm square, terrain from ASTER 30 m elevation via Terrain Tiles, map covers 8.79 km, elevation scale 1.5, path scale 0.8, forests, water and scree from OpenStreetMap (from the .blend's TrailPrint3D properties).
- Finished piece: black frame base, acrylic lid, brand badge (user's words).
- **Not known, never invented:** price, lead time, materials beyond the above, shipping, reviews.

## Grammar: Contour plate (new)

The page is a single cartographic plate. Structure: one persistent physical object
held on the first screens, a margin that reads like a map's collar, and a route
that is the page's only running line. Defined constraints:

- **Nav:** a map collar, not a bar. Wordmark top-left; the right margin carries the
  real elevation profile of the trail with a playhead at scroll position, and the
  three named waypoints are the jump links.
- **Hero:** darkness and contour, then the object. No photograph above the fold.
- **Sequence:** follows the trail. Each section is placed at a waypoint on the route.
- **Close:** an order plate typeset like a map legend, carrying the visitor's own trail.
- **Bans:** full-bleed photography, `scrub` video, kinetic headline stacks,
  `spotlight`, `magnet`, section counters, centred copy in more than one act.

## Feeling curve

```
1  Mystery     near-black navy, contour lines of the real terrain at three depths, one quiet line
2  Awe         the terrain rises out of the dark and the red line carves the trail upward
   (silence)   the camera settles, copy gone, the finished map turns once in raking light
3  Resolve     PEAK: the black frame rises under it, the badge sets, the acrylic lid lowers and closes
4  Intimacy    light ground, the piece up close: what is in it, said as plainly as a map legend
5  Recognition the three teahouse waypoints, as the trail would show them to someone who walked it
6  Wonder      your own GPX dropped on the page, the terrain rises, you tune it
7  Resolve     an order plate with your trail already on it
```

## The peak

> "The red line climbed all the way up the mountain and then a frame came up under it and the glass lid closed. It turned into a thing you could hold."

Lives in act 2 (the pinned 3D stage), second half. It gets the largest span on the page.

## Tell-someone sentence

> It's the site where you drop in the trail you hiked and watch your own mountain rise out of the page.

## Authored silence

Act 2, progress ~0.46 to ~0.56: no copy on screen while the carved map turns. Intentional, not dead scroll.

## Signature move and tell-someone, merged

The GPX surface ends with the same frame, badge and acrylic lid as the hero, so
the visitor's own trail gets the peak moment too. The peak (hero lid closing) and
the tell-someone sentence (your mountain rising) point at the same object.

## Feel check (done cold from the contact sheets, then diffed)

| Act | Intended | Felt | Change |
|---|---|---|---|
| 1 open | Mystery | Mystery (dark, contour square, one line) | none |
| 1 carve | Awe | Anticipation, then awe as the line climbs | head glow was garish; toned down |
| 1 assembly | Resolve (peak) | Resolve; largest visual change on the page | close copy never hit full opacity; retimed |
| 2 inside | Intimacy | Clarity (reads as information) | product image made sticky beside the legend; still more "clear" than "intimate" |
| 3 places | Recognition | Recognition | rail note moved so the rail ends on a photo, not an empty screen |
| 4 yours | Wonder | Invitation until a file goes in, then wonder | left as is: the wonder belongs to their action |
| 5 order | Resolve | Resolve, holds with content | plate made static so it never slides in empty |
