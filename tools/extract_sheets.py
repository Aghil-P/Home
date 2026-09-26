"""Extract the five concept-presentation sheets from the source PDF.

The PDF stores each sheet as a single full-bleed XObject image, RGB, encoded
ASCII85 -> Flate.  No PDF library is needed: we locate the image objects by
number, decode the stream and hand the raw bytes to Pillow.

Usage:  python tools/extract_sheets.py
"""

import base64
import os
import re
import zlib

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PDF = os.path.join(ROOT, "tropical_haven_villa_concept_book-1.pdf")
OUT = os.path.join(ROOT, "assets", "sheets")

# (pdf object number, width, height) -> sheet-1 .. sheet-5, in page order.
SHEETS = [
    (5, 1254, 1254),
    (7, 1254, 1254),
    (9, 1536, 1024),
    (11, 1536, 1024),
    (13, 1536, 1024),
]


def read_pdf():
    with open(PDF, "rb") as fh:
        return fh.read()


def object_body(data, num):
    m = re.search((r"(?<![0-9])%d\s+0\s+obj" % num).encode(), data)
    if not m:
        raise LookupError("object %d not found" % num)
    end = data.find(b"endobj", m.end())
    return data[m.end():end]


def decode_stream(body):
    start = body.find(b"stream")
    raw = body[start + 6:].lstrip(b"\r\n")
    raw = raw[:raw.find(b"endstream")].strip()
    if raw.endswith(b"~>"):
        raw = raw[:-2]
    return zlib.decompress(base64.a85decode(raw))


def main():
    os.makedirs(OUT, exist_ok=True)
    data = read_pdf()
    for index, (num, width, height) in enumerate(SHEETS, start=1):
        pixels = decode_stream(object_body(data, num))
        expected = width * height * 3
        if len(pixels) != expected:
            raise ValueError(
                "sheet %d: got %d bytes, expected %d" % (index, len(pixels), expected)
            )
        image = Image.frombytes("RGB", (width, height), pixels)
        path = os.path.join(OUT, "sheet-%d.png" % index)
        image.save(path)
        print("sheet-%d.png  %dx%d" % (index, width, height))


if __name__ == "__main__":
    main()
