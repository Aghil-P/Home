# The Tropical Haven — interactive presentation website

An interactive walkthrough of the villa concept described in `readme.md`:
clickable floor plans, room-by-room detail, a cinematic guided tour, and a
navigable first-person 3D model.

## Opening it

**Double-click `index.html`.** That is all. No server, no build step, and no
internet connection is needed — the 3D library and every image are stored
locally in `assets/`.

If you would rather serve it (for example to test on your phone over the local
network):

```
python -m http.server 8000
```

then open `http://<your-computer's-ip>:8000`.

## What is in it

| Section | What it shows |
|---|---|
| Home | Hero view, key figures, the five guided routes, privacy zones, materials |
| Site Plan | The whole plot, clickable, with the original master site-plan render |
| Ground Floor / First Floor | Interactive vector plans, every space clickable |
| Courtyard · Living & Dining · Kitchen · Bedrooms · Master Suite · Home Theatre · Gym · Travel Room | Room-by-room detail and galleries |
| Pool · Gardens · Outdoor Living · Well | The landscape and outdoor rooms |
| Exterior | Elevations, night and aerial views |

Three ways to move through the house:

- **Interactive plans** — tap any room for its dimensions, purpose, key
  features, connected spaces, gallery and position on the plan. The mouse
  wheel scrolls the page as normal; **Ctrl + scroll (or a trackpad pinch)
  zooms the plan**, and the +/− buttons do the same. Drag to pan once zoomed.
  A "Privacy zones" toggle colours the plan by the four zones in
  `readme.md` §16.
- **Guided tour** — a full-screen cinematic sequence of the real renders along
  each circulation route, with a marker tracking your position on the plan.
- **3D walkthrough** — first person, in real time. Desktop: click to look,
  `W A S D` to move, `Shift` to run, click a room for its details. Phone and
  tablet: drag to look, joystick to move, tap a room for details. Walking into
  the stair moves you between floors; "Go to" jumps to any space.

A day/night toggle in the top bar changes the page, the plans and the 3D
lighting together.

## How it is built

Everything is generated from one file: **`js/data.villa.js`**. Each space is
defined exactly once — its rectangle in feet, floor, purpose, features,
connections and images — and that single definition drives the SVG plans, the
3D geometry and the written descriptions. Areas are computed from the
geometry rather than typed in, so a label cannot contradict the drawing. This
is `readme.md` §20 ("Design Consistency Rules") enforced structurally.

The 3D model is not hand-built either. Walls are found by scanning a
one-foot occupancy grid: wherever two neighbouring cells belong to different
spaces there is a wall, and wherever those two spaces list each other in
`connects` that wall gets a doorway.

```
index.html              page shell
css/style.css           mobile-first styling, day and night themes
js/data.villa.js        the canonical model — edit this to change the design
js/plan.svg.js          builds the interactive plans
js/explorer.js          sections, room panels, galleries, lightbox
js/tour.js              the guided tour
js/walk3d.js            the 3D walkthrough
assets/sheets/          the five concept sheets, extracted from the PDF
assets/renders/         the individual renders, sliced from those sheets
assets/vendor/          three.js r128
tools/                  the two Python scripts that produced the assets
```

To regenerate the images from the source PDF:

```
python tools/extract_sheets.py    # PDF -> assets/sheets/
python tools/slice_panels.py      # sheets -> assets/renders/ + a contact sheet
```

## Honest notes on the material

- **The photographic renders are real project imagery**, sliced out of the five
  concept sheets in `tropical_haven_villa_concept_book-1.pdf`. They are
  modest resolution — the sheets are presentation boards, so an individual
  room panel is only a few hundred pixels wide, which is the ceiling on how
  sharp they can be.
- **The 3D model is stylised, not photorealistic.** There was no 3D model or
  360° photography in the source material, so the walkthrough is generated
  from the floor-plan programme. The massing, room sizes, adjacencies and
  material palette are accurate, and the rooms are furnished — beds with
  headboards and nightstands, seating and rugs, kitchen counters and island,
  tiered theatre seating, bookshelves with books, sanitaryware, pendants,
  artwork, curtains and planting, with wood, tile or stone floors and a
  ceiling per room. They are still built from simple shapes and flat colours,
  so it reads as a clean architectural model rather than a photograph.
- **Floor assignment follows `readme.md` §10–11, not the concept sheets.**
  The sheets are internally inconsistent — they variously place the master
  suite, theatre and gym on the ground floor, and disagree on total built-up
  area (6,600 vs 6,800 sq ft). The written brief is the approved document
  (§26), so the two-storey split there wins. Room dimensions still come from
  the sheet schedules where they agree with it.
- **Some spaces have no render** (bathrooms, wardrobe, pantry, prayer room,
  utility). Rather than borrow another room's photograph, those cards show a
  close-up of the floor plan with the room picked out, and the room panel says
  so. `readme.md` §19 lists these as images still to be produced.

- **The renders are enlarged, not enhanced.** `tools/slice_panels.py` cleans
  each panel before resampling it - a chroma blur plus a small edge-preserving
  filter - then enlarges it and sharpens only where there are real edges.
  Order matters: sharpening first amplifies the renders' fine grain into
  visible speckle, which roughly triples the high-frequency energy in flat
  areas such as walls, sky and water. Cleaning first gives a picture that is
  both quieter in the flats and crisper on the edges than a plain resample,
  and every image on the site is displayed at or below its stored size rather
  than stretched. Upscaling still cannot invent detail that the presentation
  board never had.

All dimensions and areas are concept stage. They must be verified against the
actual site survey, local building rules, setbacks, structural design and the
final architectural drawings.
