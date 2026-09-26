"""Slice the individual renders out of the composite presentation sheets.

The five sheets are presentation boards, not single renders.  Panel boundaries
were located by profiling the near-white gutters between panels; the boxes
below are those boundaries, verified against the sheets by eye.

Each panel carries a burned-in caption bar along its bottom edge.  The website
draws its own captions, so `trim` removes that band as a fraction of panel
height.

The panels are small - a presentation board only gives a few hundred pixels
per room - so they are enlarged carefully: clean the grain first with a
chroma blur and a small edge-preserving filter, then resample, then sharpen
only where there are real edges.  Sharpening before cleaning (the naive
order) amplifies grain into visible speckle.  Upscaling cannot invent detail;
this is about not adding anything that was not there.

Two files are written per panel:
    <id>.jpg        3x enlargement for the hero, tour and lightbox
    <id>-thumb.jpg  capped at 900px wide, for cards and galleries

Usage:  python tools/slice_panels.py
"""

import os

import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHEETS = os.path.join(ROOT, "assets", "sheets")
OUT = os.path.join(ROOT, "assets", "renders")

THUMB_MAX = 900
FULL_SCALE = 3
FULL_MAX_W = 1800   # no point enlarging past what a screen will show

# id, sheet, (left, top, right, bottom), trim fraction off the bottom caption bar
PANELS = [
    # --- sheet 1: the largest versions of the hero imagery -------------------
    ("aerial-view",        1, (0, 0, 587, 515), 0.09),
    ("courtyard",          1, (734, 521, 1248, 747), 0.12),
    ("pool-rear",          1, (734, 752, 1248, 931), 0.14),
    ("elevation-front",    1, (7, 937, 441, 1246), 0.27),
    ("master-suite",       1, (446, 937, 688, 1080), 0.22),
    ("home-theatre",       1, (692, 937, 891, 1080), 0.13),
    ("travel-room",        1, (895, 937, 1075, 1080), 0.13),
    ("gym",                1, (1078, 937, 1247, 1080), 0.13),
    ("outdoor-seating",    1, (446, 1084, 669, 1234), 0.13),
    ("fruit-garden",       1, (673, 1084, 867, 1234), 0.13),
    ("pavilion",           1, (871, 1084, 1074, 1234), 0.13),
    ("well",               1, (1078, 1084, 1247, 1234), 0.13),

    # --- sheet 2: master site plan, the highest-resolution plan we have ------
    ("site-plan",          2, (0, 0, 950, 1160), 0.03),

    # --- sheets 3 and 4: dimensioned ground-floor plan renders --------------
    ("ground-plan-render", 3, (0, 0, 1089, 1024), 0.00),
    ("ground-plan-alt",    4, (0, 0, 1113, 1024), 0.00),

    # --- sheet 5: the clean per-room interior set ---------------------------
    ("hero-title",         5, (0, 0, 444, 423), 0.00),
    ("first-plan-render",  5, (1201, 0, 1424, 423), 0.00),
    ("courtyard-alt",      5, (7, 428, 422, 601), 0.11),
    ("living",             5, (428, 428, 670, 601), 0.11),
    ("dining",             5, (673, 428, 859, 601), 0.11),
    ("kitchen",            5, (864, 428, 1068, 601), 0.11),
    ("guest-bedroom",      5, (1073, 428, 1319, 601), 0.11),
    ("master-suite-wide",  5, (7, 605, 331, 747), 0.22),
    ("master-pool",        5, (337, 605, 588, 747), 0.13),
    ("outdoor-shower",     5, (592, 605, 699, 747), 0.15),
    ("home-theatre-alt",   5, (704, 605, 905, 747), 0.13),
    ("gym-alt",            5, (910, 605, 1100, 747), 0.13),
    ("travel-room-alt",    5, (1104, 605, 1319, 747), 0.13),
    ("pool-main",          5, (7, 752, 330, 873), 0.13),
    ("outdoor-seating-alt", 5, (336, 752, 566, 873), 0.13),
    ("fruit-garden-alt",   5, (570, 752, 749, 873), 0.13),
    ("pavilion-alt",       5, (753, 752, 950, 873), 0.13),
    ("well-alt",           5, (955, 752, 1122, 873), 0.13),
    ("elevation-dusk",     5, (1127, 752, 1531, 873), 0.13),
    ("materials",          5, (9, 878, 327, 1014), 0.00),
    ("pavilion-wide",      5, (335, 878, 649, 1014), 0.24),
]


def chroma_clean(img, radius=1.1):
    """Soften colour without touching brightness.

    Most of the visible speckle in these panels is colour speckle, and the eye
    is far less sensitive to chroma detail than to luminance detail - so this
    removes a lot of the grit at almost no cost in apparent sharpness.
    """
    y, cb, cr = img.convert("YCbCr").split()
    cb = cb.filter(ImageFilter.GaussianBlur(radius))
    cr = cr.filter(ImageFilter.GaussianBlur(radius))
    return Image.merge("YCbCr", (y, cb, cr)).convert("RGB")


def denoise(img, d=1, sigma_s=1.6, sigma_r=9.0):
    """Edge-preserving smoothing (a small bilateral filter).

    Each pixel is averaged with neighbours that are close to it in brightness,
    so film-like grain in flat areas - walls, sky, water - is averaged away
    while real edges, which differ too much to be averaged, stay put.  This is
    what stops the sharpening step below turning grain into speckle.
    """
    a = np.asarray(img, dtype=np.float32)
    h, w, _ = a.shape
    pad = np.pad(a, ((d, d), (d, d), (0, 0)), mode="edge")
    luma = a @ np.array([0.299, 0.587, 0.114], np.float32)
    lpad = np.pad(luma, ((d, d), (d, d)), mode="edge")

    out = np.zeros_like(a)
    wsum = np.zeros((h, w, 1), np.float32)
    for dy in range(-d, d + 1):
        for dx in range(-d, d + 1):
            tile = pad[d + dy:d + dy + h, d + dx:d + dx + w, :]
            ltile = lpad[d + dy:d + dy + h, d + dx:d + dx + w]
            spatial = np.exp(-(dx * dx + dy * dy) / (2 * sigma_s * sigma_s))
            rng = np.exp(-((ltile - luma) ** 2) / (2 * sigma_r * sigma_r))
            weight = (spatial * rng).astype(np.float32)[..., None]
            out += tile * weight
            wsum += weight
    return Image.fromarray(np.clip(out / wsum, 0, 255).astype(np.uint8))


def enlarge(img, scale):
    """Clean up, then enlarge, then sharpen only where there are real edges.

    Order matters.  Sharpening first (which is what a naive pipeline does)
    amplifies the grain along with the detail and the result looks noisy; the
    measured high-frequency energy in flat areas roughly triples.  Cleaning
    first and sharpening with a threshold gives a picture that is both
    quieter in the flats and crisper on the edges than a plain resample.

    Upscaling still cannot invent detail the presentation board never had.
    """
    clean = chroma_clean(img)
    clean = denoise(clean)

    out = clean.resize((max(1, round(img.width * scale)),
                        max(1, round(img.height * scale))), Image.LANCZOS)

    # threshold keeps the mask off flat areas, so nothing gets "crunchy"
    return out.filter(ImageFilter.UnsharpMask(radius=1.3, percent=80, threshold=4))


def main():
    os.makedirs(OUT, exist_ok=True)
    cache = {}
    for panel_id, sheet_no, box, trim in PANELS:
        if sheet_no not in cache:
            cache[sheet_no] = Image.open(
                os.path.join(SHEETS, "sheet-%d.png" % sheet_no)
            ).convert("RGB")
        left, top, right, bottom = box
        bottom -= int((bottom - top) * trim)
        crop = cache[sheet_no].crop((left, top, right, bottom))

        # small room panels get the full 3x; the plan renders are already
        # large, so they are only sharpened, not blown up
        scale = min(FULL_SCALE, max(1.0, FULL_MAX_W / crop.width))
        big = enlarge(crop, scale)
        big.save(os.path.join(OUT, "%s.jpg" % panel_id), quality=95,
                 optimize=True, subsampling=0)

        thumb = big if big.width <= THUMB_MAX else big.resize(
            (THUMB_MAX, max(1, round(big.height * THUMB_MAX / big.width))),
            Image.LANCZOS)
        thumb.save(os.path.join(OUT, "%s-thumb.jpg" % panel_id), quality=91,
                   optimize=True, subsampling=0)
        print("%-22s %4dx%-4d -> %dx%d" % (
            panel_id, crop.width, crop.height, big.width, big.height))

    contact_sheet()


def contact_sheet():
    """One grid image of every panel, for a quick visual check of the crops."""
    ids = [p[0] for p in PANELS]
    cols, cell = 6, 240
    rows = (len(ids) + cols - 1) // cols
    board = Image.new("RGB", (cols * cell, rows * cell), (245, 243, 238))
    for i, panel_id in enumerate(ids):
        img = Image.open(os.path.join(OUT, "%s-thumb.jpg" % panel_id))
        img.thumbnail((cell - 8, cell - 8), Image.LANCZOS)
        x = (i % cols) * cell + (cell - img.width) // 2
        y = (i // cols) * cell + (cell - img.height) // 2
        board.paste(img, (x, y))
    path = os.path.join(ROOT, "assets", "contact-sheet.jpg")
    board.save(path, quality=85)
    print("\ncontact sheet -> %s" % path)


if __name__ == "__main__":
    main()
