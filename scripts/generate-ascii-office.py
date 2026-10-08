#!/usr/bin/env python3
"""Project a 3D office into a dense ASCII grid (one-point perspective).

Camera sits close: the back wall fills most of the frame; side walls,
ceiling and floor are narrow bands. Desk, CRT and keyboard are 3D boxes.
Portrait and clerk are silhouettes rasterised to dots. Mockup only.
"""

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw

COLS = 108
ROWS = 46
CHAR_ASPECT = 0.55
FOCAL = 3.6
CAM_Y = 2.12  # look down so the desk top is a parallelogram, not an edge

# Room. ZF/ZN ~ 1.2 so the back wall is large after we fit *it* to the canvas.
XL, XR = -2.05, 2.05
YF, YC = 0.0, 2.20
ZN, ZF = 2.90, 3.85

# Desk (axis-aligned box in front of the back wall)
DX0, DX1 = -1.22, 1.28
DY_TOP = 0.44
DZ0, DZ1 = 2.96, 3.72  # front (closer) .. back
APRON = 0.16

# CRT on the right of the desk (leaves the left of the top visible)
MX0, MX1 = 0.50, 1.10
MY0, MY1 = DY_TOP, 1.02
MZ0, MZ1 = 3.14, 3.38  # screen face .. back of box

# Portrait on the back wall (large bust), above the desk
PX0, PX1 = -1.22, 0.22
PY0, PY1 = 1.12, 2.12


def raw_project(x: float, y: float, z: float) -> tuple[float, float]:
    z = max(z, 0.5)
    sx = (x * FOCAL / z) / CHAR_ASPECT
    sy = -((y - CAM_Y) * FOCAL / z)
    return sx, sy


def fit_from_back_wall():
    """Map the back wall to ~80% of the canvas so furniture in front reads large."""
    corners = [
        (XL, YF, ZF), (XR, YF, ZF), (XL, YC, ZF), (XR, YC, ZF),
    ]
    pts = [raw_project(*p) for p in corners]
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    minx, maxx, miny, maxy = min(xs), max(xs), min(ys), max(ys)
    # Inset: 9% left/right, 8% top, 18% bottom (desk lives in the lower third)
    mx0, mx1 = COLS * 0.08, COLS * 0.92
    my0, my1 = ROWS * 0.07, ROWS * 0.80
    sx = (mx1 - mx0) / (maxx - minx)
    sy = (my1 - my0) / (maxy - miny)
    return -minx, -miny, sx, sy, mx0, my0


OX, OY, SX, SY, MX, MY = fit_from_back_wall()


def project(x: float, y: float, z: float) -> tuple[float, float]:
    rx, ry = raw_project(x, y, z)
    return MX + (rx + OX) * SX, MY + (ry + OY) * SY


BAYER = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5],
]


def dither_char(value: int, col: int, row: int) -> str:
    """value 0..255 → `. : @` only, so a face does not turn into pipes."""
    if value < 22:
        return " "
    t = BAYER[row % 4][col % 4] / 16.0
    v = value / 255.0
    if v < 0.42:
        return "." if v > 0.14 + t * 0.18 else " "
    if v < 0.82:
        return ":" if v > 0.55 + t * 0.10 else "."
    return "@"


class Grid:
    def __init__(self) -> None:
        self.ch = [[" "] * COLS for _ in range(ROWS)]
        self.depth = [[1e9] * COLS for _ in range(ROWS)]

    def plot(self, x: float, y: float, ch: str, z: float = 5.0) -> None:
        c, r = int(round(x)), int(round(y))
        if 0 <= r < ROWS and 0 <= c < COLS and z <= self.depth[r][c] + 0.015:
            self.depth[r][c] = z
            self.ch[r][c] = ch

    def line(self, a, b, ch: str | None = None) -> None:
        pa, pb = project(*a), project(*b)
        x0, y0 = pa
        x1, y1 = pb
        n = int(max(abs(x1 - x0), abs(y1 - y0), 1) * 1.7) + 1
        dx, dy = x1 - x0, y1 - y0
        if ch is None:
            if abs(dx) < 0.45:
                glyph = "|"
            else:
                slope = dy / (dx if abs(dx) > 1e-6 else 1e-6)
                if abs(slope) < 0.18:
                    glyph = "-"
                elif abs(slope) < 0.45:
                    glyph = "_"
                elif abs(slope) > 2.4:
                    glyph = "|"
                else:
                    glyph = "\\" if slope > 0 else "/"
        else:
            glyph = ch
        for i in range(n + 1):
            t = i / n
            z = a[2] + (b[2] - a[2]) * t
            self.plot(x0 + dx * t, y0 + dy * t, glyph, z)

    def polyline(self, pts, ch: str | None = None) -> None:
        for i in range(len(pts) - 1):
            self.line(pts[i], pts[i + 1], ch)

    def dashed_rect(self, x0, y0, x1, y1, z, dash: str = ".") -> None:
        """Screen-space dashed frame with + corners, on a wall-aligned rect."""
        corners = [
            (x0, y0, z), (x1, y0, z), (x1, y1, z), (x0, y1, z),
        ]
        for a, b in zip(corners, corners[1:] + corners[:1]):
            pa, pb = project(*a), project(*b)
            n = int(max(abs(pb[0] - pa[0]), abs(pb[1] - pa[1]), 1) * 1.5) + 1
            for i in range(n + 1):
                t = i / n
                sx = pa[0] + (pb[0] - pa[0]) * t
                sy = pa[1] + (pb[1] - pa[1]) * t
                gch = "+" if i in (0, n) or i % 5 == 0 else dash
                self.plot(sx, sy, gch, z - 0.01)
        # extra corner marks, slightly outside
        for cx, cy in ((x0, y0), (x1, y0), (x1, y1), (x0, y1)):
            p = project(cx, cy, z)
            self.plot(p[0], p[1], "+", z - 0.02)

    def occlude_quad(self, tl, tr, br, bl, z_bias: float = 0.0) -> None:
        """Fill a quad with spaces so the wall does not show through."""
        un, vn = 36, 28
        for iu in range(un + 1):
            u = iu / un
            for iv in range(vn + 1):
                v = iv / vn
                x = (1 - u) * (1 - v) * tl[0] + u * (1 - v) * tr[0] + u * v * br[0] + (1 - u) * v * bl[0]
                y = (1 - u) * (1 - v) * tl[1] + u * (1 - v) * tr[1] + u * v * br[1] + (1 - u) * v * bl[1]
                z = (1 - u) * (1 - v) * tl[2] + u * (1 - v) * tr[2] + u * v * br[2] + (1 - u) * v * bl[2]
                p = project(x, y, z)
                self.plot(p[0], p[1], " ", z + z_bias)

    def stamp_image(self, im: Image.Image, x0, y0, x1, y1, z, flip_v: bool = True) -> None:
        w, h = im.size
        pix = im.load()
        # Over-sample so the face does not go sparse
        un, vn = w * 2, h * 2
        for iu in range(un + 1):
            u = iu / un
            for iv in range(vn + 1):
                v = iv / vn
                col = min(w - 1, int(u * (w - 1)))
                row = min(h - 1, int((v if not flip_v else v) * (h - 1)))
                val = pix[col, row]
                ch = dither_char(val, col, row)
                if ch == " ":
                    continue
                x = x0 + (x1 - x0) * u
                y = y1 - (y1 - y0) * v  # v down
                p = project(x, y, z)
                self.plot(p[0], p[1], ch, z - 0.03)

    def to_string(self) -> str:
        return "\n".join("".join(row) for row in self.ch)


def render_bust(w: int = 64, h: int = 84) -> Image.Image:
    """Front-facing bust: hair, face, collar, tie. White = denser dots."""
    im = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(im)
    cx, head_y = w // 2, int(h * 0.30)
    hr_x, hr_y = int(w * 0.22), int(h * 0.20)

    # shoulders / jacket  (darker → `.` so the head stays a `:` oval)
    d.polygon(
        [
            (int(w * 0.04), h - 1),
            (int(w * 0.10), int(h * 0.58)),
            (int(w * 0.28), int(h * 0.54)),
            (int(w * 0.42), int(h * 0.56)),
            (cx, int(h * 0.62)),
            (int(w * 0.58), int(h * 0.56)),
            (int(w * 0.72), int(h * 0.54)),
            (int(w * 0.90), int(h * 0.58)),
            (int(w * 0.96), h - 1),
        ],
        fill=88,
    )
    # lapels
    d.polygon(
        [
            (int(w * 0.28), int(h * 0.54)),
            (cx - 2, int(h * 0.78)),
            (int(w * 0.18), h - 1),
            (int(w * 0.10), int(h * 0.58)),
        ],
        fill=110,
    )
    d.polygon(
        [
            (int(w * 0.72), int(h * 0.54)),
            (cx + 2, int(h * 0.78)),
            (int(w * 0.82), h - 1),
            (int(w * 0.90), int(h * 0.58)),
        ],
        fill=110,
    )
    # shirt
    d.polygon(
        [
            (int(w * 0.42), int(h * 0.56)),
            (cx, int(h * 0.52)),
            (int(w * 0.58), int(h * 0.56)),
            (int(w * 0.62), h - 1),
            (int(w * 0.38), h - 1),
        ],
        fill=130,
    )
    # tie
    d.polygon(
        [
            (cx - 3, int(h * 0.56)),
            (cx + 3, int(h * 0.56)),
            (cx + 5, int(h * 0.78)),
            (cx, int(h * 0.98)),
            (cx - 5, int(h * 0.78)),
        ],
        fill=40,
    )
    # neck
    d.rectangle(
        [cx - int(w * 0.07), int(h * 0.46), cx + int(w * 0.07), int(h * 0.58)],
        fill=175,
    )
    # collar
    d.polygon(
        [
            (cx - int(w * 0.12), int(h * 0.50)),
            (cx, int(h * 0.58)),
            (cx - int(w * 0.04), int(h * 0.50)),
        ],
        fill=200,
    )
    d.polygon(
        [
            (cx + int(w * 0.12), int(h * 0.50)),
            (cx, int(h * 0.58)),
            (cx + int(w * 0.04), int(h * 0.50)),
        ],
        fill=200,
    )
    # head
    d.ellipse(
        [cx - hr_x, head_y - hr_y, cx + hr_x, head_y + hr_y + 2],
        fill=180,
        outline=230,
    )
    # hair cap
    d.pieslice(
        [cx - hr_x - 1, head_y - hr_y - 3, cx + hr_x + 1, head_y + 4],
        200,
        340,
        fill=250,
    )
    d.arc(
        [cx - hr_x - 1, head_y - hr_y - 3, cx + hr_x + 1, head_y + hr_y],
        200,
        340,
        fill=255,
        width=2,
    )
    # ears
    d.ellipse([cx - hr_x - 3, head_y - 4, cx - hr_x + 3, head_y + 8], fill=165)
    d.ellipse([cx + hr_x - 3, head_y - 4, cx + hr_x + 3, head_y + 8], fill=165)
    # eyes (dark holes so they stay empty in the dotted fill)
    d.ellipse([cx - 10, head_y - 3, cx - 3, head_y + 4], fill=0)
    d.ellipse([cx + 3, head_y - 3, cx + 10, head_y + 4], fill=0)
    d.ellipse([cx - 8, head_y - 1, cx - 5, head_y + 2], fill=40)
    d.ellipse([cx + 5, head_y - 1, cx + 8, head_y + 2], fill=40)
    # brows
    d.line([cx - 11, head_y - 6, cx - 3, head_y - 7], fill=30, width=2)
    d.line([cx + 3, head_y - 7, cx + 11, head_y - 6], fill=30, width=2)
    # nose
    d.line([cx, head_y + 2, cx, head_y + 9], fill=40, width=2)
    d.line([cx, head_y + 9, cx + 4, head_y + 10], fill=40, width=1)
    # mouth
    d.arc([cx - 7, head_y + 11, cx + 7, head_y + 18], 15, 165, fill=25, width=2)
    return im


def render_clerk(w: int = 48, h: int = 56) -> Image.Image:
    """Seated clerk, 3/4-ish: head, shoulders, arms toward the keyboard."""
    im = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(im)
    cx = int(w * 0.42)
    # torso / jacket
    d.polygon(
        [
            (int(w * 0.12), h - 1),
            (int(w * 0.18), int(h * 0.42)),
            (int(w * 0.38), int(h * 0.36)),
            (int(w * 0.62), int(h * 0.40)),
            (int(w * 0.72), int(h * 0.70)),
            (int(w * 0.70), h - 1),
        ],
        fill=95,
    )
    # shirt / collar
    d.polygon(
        [
            (int(w * 0.36), int(h * 0.38)),
            (cx + 2, int(h * 0.34)),
            (int(w * 0.52), int(h * 0.40)),
            (int(w * 0.48), int(h * 0.70)),
            (int(w * 0.34), int(h * 0.70)),
        ],
        fill=150,
    )
    # head
    d.ellipse([cx - 9, 2, cx + 10, 24], fill=185)
    # hair
    d.pieslice([cx - 10, 0, cx + 11, 16], 200, 340, fill=250)
    # eyes
    d.ellipse([cx - 5, 10, cx - 2, 13], fill=25)
    d.ellipse([cx + 3, 10, cx + 6, 13], fill=25)
    # mouth
    d.arc([cx - 3, 15, cx + 4, 20], 20, 160, fill=50, width=1)
    # left arm (our left = clerk's right) down to desk
    d.polygon(
        [
            (int(w * 0.18), int(h * 0.44)),
            (int(w * 0.28), int(h * 0.44)),
            (int(w * 0.22), int(h * 0.78)),
            (int(w * 0.08), int(h * 0.82)),
            (int(w * 0.06), int(h * 0.74)),
        ],
        fill=100,
    )
    # right arm reaching toward keyboard (right)
    d.polygon(
        [
            (int(w * 0.58), int(h * 0.42)),
            (int(w * 0.70), int(h * 0.46)),
            (int(w * 0.92), int(h * 0.72)),
            (int(w * 0.84), int(h * 0.80)),
            (int(w * 0.60), int(h * 0.58)),
        ],
        fill=100,
    )
    # hands
    d.ellipse([int(w * 0.04), int(h * 0.74), int(w * 0.16), int(h * 0.86)], fill=210)
    d.ellipse([int(w * 0.82), int(h * 0.70), int(w * 0.96), int(h * 0.84)], fill=210)
    return im


def draw_room_shell(g: Grid) -> None:
    nfl, nfr = (XL, YF, ZN), (XR, YF, ZN)
    ncl, ncr = (XL, YC, ZN), (XR, YC, ZN)
    ffl, ffr = (XL, YF, ZF), (XR, YF, ZF)
    fcl, fcr = (XL, YC, ZF), (XR, YC, ZF)

    g.polyline([nfl, nfr, ncr, ncl, nfl])
    g.polyline([ffl, ffr, fcr, fcl, ffl])
    g.line(nfl, ffl)
    g.line(nfr, ffr)
    g.line(ncl, fcl)
    g.line(ncr, fcr)
    # a couple of floor ticks in the corners only
    g.line((XL + 0.15, YF, ZF), (XL + 0.25, YF, ZN + 0.02), ".")
    g.line((XR - 0.15, YF, ZF), (XR - 0.25, YF, ZN + 0.02), ".")


def draw_portrait(g: Grid) -> None:
    pz = ZF - 0.02
    g.dashed_rect(PX0, PY0, PX1, PY1, pz, dash=".")
    # inner mat of light dots
    inset = 0.06
    bust = render_bust()
    g.stamp_image(
        bust,
        PX0 + inset,
        PY0 + inset,
        PX1 - inset,
        PY1 - inset,
        pz - 0.03,
    )


def draw_filing(g: Grid) -> None:
    pz = ZF - 0.02
    fx0, fx1, fy0, fy1 = 0.78, 1.28, 1.28, 1.88
    g.polyline([(fx0, fy0, pz), (fx1, fy0, pz), (fx1, fy1, pz), (fx0, fy1, pz), (fx0, fy0, pz)])
    for k in range(6):
        yy = fy0 + (fy1 - fy0) * (0.12 + k * 0.13)
        g.line((fx0 + 0.06, yy, pz), (fx1 - 0.06, yy, pz), "/")
    # small empty frame further right
    g.polyline([
        (1.48, 1.38, pz), (1.78, 1.38, pz), (1.78, 1.78, pz), (1.48, 1.78, pz), (1.48, 1.38, pz),
    ])


def draw_desk(g: Grid) -> None:
    yb = DY_TOP - APRON  # bottom of front panel
    # Occlude wall through the solid desk body (front + side + top)
    g.occlude_quad(
        (DX0, DY_TOP, DZ1), (DX1, DY_TOP, DZ1), (DX1, DY_TOP, DZ0), (DX0, DY_TOP, DZ0),
        z_bias=0.0,
    )
    g.occlude_quad(
        (DX0, DY_TOP, DZ0), (DX1, DY_TOP, DZ0), (DX1, yb, DZ0), (DX0, yb, DZ0),
    )
    g.occlude_quad(
        (DX1, DY_TOP, DZ0), (DX1, DY_TOP, DZ1), (DX1, yb, DZ1), (DX1, yb, DZ0),
    )

    # Top parallelogram (closer edge longer). Force glyphs so the 3/4 reads.
    g.line((DX0, DY_TOP, DZ1), (DX1, DY_TOP, DZ1), "-")  # far
    g.line((DX0, DY_TOP, DZ0), (DX1, DY_TOP, DZ0), "-")  # near
    g.line((DX0, DY_TOP, DZ0), (DX0, DY_TOP, DZ1), "/")
    g.line((DX1, DY_TOP, DZ0), (DX1, DY_TOP, DZ1), "\\")
    # Front panel
    g.polyline([
        (DX0, DY_TOP, DZ0),
        (DX0, yb, DZ0),
        (DX1, yb, DZ0),
        (DX1, DY_TOP, DZ0),
    ])
    # Right side panel (depth)
    g.polyline([
        (DX1, DY_TOP, DZ0),
        (DX1, yb, DZ0),
        (DX1, yb, DZ1),
        (DX1, DY_TOP, DZ1),
    ])
    # Drawer block on the front
    g.polyline([
        (DX0 + 0.18, DY_TOP - 0.05, DZ0),
        (DX1 - 0.18, DY_TOP - 0.05, DZ0),
        (DX1 - 0.18, yb + 0.04, DZ0),
        (DX0 + 0.18, yb + 0.04, DZ0),
        (DX0 + 0.18, DY_TOP - 0.05, DZ0),
    ])
    g.plot(*project((DX0 + DX1) / 2, DY_TOP - 0.12, DZ0 - 0.01), "o", DZ0 - 0.02)

    # Legs
    for lx, lz in (
        (DX0 + 0.10, DZ0 + 0.03),
        (DX1 - 0.10, DZ0 + 0.03),
        (DX1 - 0.08, DZ1 - 0.06),
        (DX0 + 0.12, DZ1 - 0.06),
    ):
        g.line((lx, yb, lz), (lx, YF + 0.02, lz), "|")
        g.line((lx - 0.04, YF + 0.02, lz), (lx + 0.04, YF + 0.02, lz), "_")


def draw_crt(g: Grid) -> None:
    # Occlude through the monitor body
    g.occlude_quad(
        (MX0, MY1, MZ0), (MX1, MY1, MZ0), (MX1, MY0, MZ0), (MX0, MY0, MZ0),
    )
    g.occlude_quad(
        (MX1, MY1, MZ0), (MX1, MY1, MZ1), (MX1, MY0, MZ1), (MX1, MY0, MZ0),
    )
    # Front box
    g.polyline([
        (MX0, MY0, MZ0), (MX1, MY0, MZ0), (MX1, MY1, MZ0), (MX0, MY1, MZ0), (MX0, MY0, MZ0),
    ])
    # Depth: right side
    g.polyline([
        (MX1, MY0, MZ0), (MX1, MY0, MZ1), (MX1, MY1, MZ1), (MX1, MY1, MZ0),
    ])
    # Back bulge (CRT tube)
    bx0, bx1 = MX0 + 0.12, MX1 - 0.04
    by0, by1 = MY0 + 0.10, MY1 - 0.10
    bz = MZ1 + 0.10
    g.polyline([
        (MX1, MY0 + 0.08, MZ1),
        (bx1, by0, bz),
        (bx1, by1, bz),
        (MX1, MY1 - 0.08, MZ1),
    ])
    g.line((bx0, by0, bz), (bx1, by0, bz), ".")
    g.line((bx0, by1, bz), (bx1, by1, bz), ".")
    # Screen rectangle
    sx0, sx1 = MX0 + 0.08, MX1 - 0.08
    sy0, sy1 = MY0 + 0.10, MY1 - 0.10
    g.polyline([
        (sx0, sy0, MZ0 - 0.01),
        (sx1, sy0, MZ0 - 0.01),
        (sx1, sy1, MZ0 - 0.01),
        (sx0, sy1, MZ0 - 0.01),
        (sx0, sy0, MZ0 - 0.01),
    ])
    # Stand
    g.line(( (MX0+MX1)/2, MY0, MZ0 + 0.04 ), ( (MX0+MX1)/2, DY_TOP, MZ0 + 0.06 ), "|")
    g.polyline([
        (MX0 + 0.18, DY_TOP, MZ0),
        (MX1 - 0.18, DY_TOP, MZ0),
        (MX1 - 0.12, DY_TOP, MZ0 + 0.12),
        (MX0 + 0.12, DY_TOP, MZ0 + 0.12),
        (MX0 + 0.18, DY_TOP, MZ0),
    ])
    # Cursor on the screen
    sp = project((sx0 + sx1) / 2, (sy0 + sy1) / 2, MZ0 - 0.04)
    g.plot(sp[0], sp[1], ">", MZ0 - 0.06)
    g.plot(sp[0] + 1, sp[1], "_", MZ0 - 0.06)


def draw_keyboard(g: Grid) -> None:
    kx0, kx1 = -0.28, 0.62
    kz0, kz1 = 3.08, 3.20
    ky = DY_TOP + 0.015
    g.polyline([
        (kx0, ky, kz0),
        (kx1, ky, kz0),
        (kx1 + 0.08, ky, kz1),
        (kx0 + 0.08, ky, kz1),
        (kx0, ky, kz0),
    ])
    g.line((kx0 + 0.10, ky, (kz0 + kz1) / 2), (kx1 + 0.02, ky, (kz0 + kz1) / 2), ":")


def draw_small_gadget(g: Grid) -> None:
    """Small box on the left of the desk (phone / second terminal in the reference)."""
    x0, x1 = -0.98, -0.48
    y0, y1 = DY_TOP, DY_TOP + 0.18
    z0, z1 = 3.28, 3.42
    g.occlude_quad((x0, y1, z0), (x1, y1, z0), (x1, y0, z0), (x0, y0, z0))
    g.polyline([
        (x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0), (x0, y0, z0),
    ])
    g.polyline([
        (x1, y0, z0), (x1, y0, z1), (x1, y1, z1), (x1, y1, z0),
    ])
    g.plot(*project((x0 + x1) / 2 - 0.06, (y0 + y1) / 2, z0 - 0.02), ":", z0 - 0.03)
    g.plot(*project((x0 + x1) / 2 + 0.06, (y0 + y1) / 2, z0 - 0.02), ":", z0 - 0.03)


def draw_clerk(g: Grid) -> None:
    # Head and shoulders ABOVE the desk; the desk hides the rest.
    cx0, cx1 = -0.70, 0.16
    cy0, cy1 = DY_TOP + 0.02, 1.08
    cz = 3.36
    g.stamp_image(render_clerk(), cx0, cy0, cx1, cy1, cz)
    # Arms reaching across the desk to the keyboard (3D, so they sit on the top)
    g.line((-0.35, DY_TOP + 0.22, cz), (-0.05, DY_TOP + 0.03, 3.22), "/")
    g.line((-0.10, DY_TOP + 0.20, cz + 0.04), (0.22, DY_TOP + 0.03, 3.26), "\\")
    g.plot(*project(-0.04, DY_TOP + 0.04, 3.22), "o", 3.20)
    g.plot(*project(0.24, DY_TOP + 0.04, 3.26), "o", 3.24)


def draw_room(clerk: bool) -> Grid:
    g = Grid()
    draw_room_shell(g)
    draw_portrait(g)
    draw_filing(g)
    if clerk:
        draw_clerk(g)
    draw_desk(g)
    draw_small_gadget(g)
    draw_crt(g)
    draw_keyboard(g)
    return g


def screen_cells() -> list[tuple[int, int]]:
    sx0, sx1 = MX0 + 0.08, MX1 - 0.08
    sy0, sy1 = MY0 + 0.10, MY1 - 0.10
    p = project((sx0 + sx1) / 2, (sy0 + sy1) / 2, MZ0 - 0.04)
    c, r = int(round(p[0])), int(round(p[1]))
    cells = []
    for dc, dr in ((0, 0), (1, 0), (2, 0), (0, 1), (1, 1)):
        cc, rr = c + dc, r + dr
        if 0 <= rr < ROWS and 0 <= cc < COLS:
            cells.append((rr, cc))
    return cells


def ts_string(s: str) -> str:
    return "`" + s.replace("\\", "\\\\").replace("`", "\\`") + "`"


def main() -> None:
    empty = draw_room(False).to_string()
    clerk = draw_room(True).to_string()
    cells = screen_cells()
    print("back-wall proj L", project(XL, YF, ZF), "R", project(XR, YC, ZF))
    print("desk front L", project(DX0, DY_TOP, DZ0), "R", project(DX1, DY_TOP, DZ0))
    print("desk back  L", project(DX0, DY_TOP, DZ1), "R", project(DX1, DY_TOP, DZ1))
    print("crt", project(MX0, MY1, MZ0), project(MX1, MY0, MZ0))
    print("portrait", project(PX0, PY1, ZF), project(PX1, PY0, ZF))
    print("screen cells", cells)
    print(empty)
    print("--- CLERK ---")
    print(clerk)

    patch_glyphs = [">_   ", ">_#  ", ">    ", ">#   "]
    patches = []
    for glyphs in patch_glyphs:
        patches.append([[r, c, ch] for (r, c), ch in zip(cells, glyphs)])

    def patch_lit(rows: list) -> str:
        items = ", ".join(f"[{r}, {c}, {ch!r}]" for r, c, ch in rows)
        return f"  [{items}],"

    out = Path("/workspace/src/components/mockups/ascii-room-frames.ts")
    body = "\n".join([
        "/**",
        " * Generated one-point-perspective office (scripts/generate-ascii-office.py).",
        " * Do not hand-edit the grids. Mockup only.",
        " */",
        f"export const ROOM_COLS = {COLS};",
        f"export const ROOM_ROWS = {ROWS};",
        "export const ROOM_FRAME_0 = " + ts_string(empty) + ";",
        "export const CLERK_FRAME_0 = " + ts_string(clerk) + ";",
        "/** [row, col, char] patches applied onto FRAME_0. */",
        "export const ROOM_PATCHES: [number, number, string][][] = [",
        *[patch_lit(p) for p in patches],
        "];",
        "export const ROOM_BANNER_LINES = 22;",
        "export const ROOM_ALT =",
        '  "ASCII drawing of an agent room in one-point perspective: walls, ceiling and floor, a dotted portrait on the back wall, a desk and CRT, and a filing cabinet.";',
        "export const CLERK_ALT =",
        '  "The same agent room with a clerk seated at the desk.";',
        "",
    ])
    out.write_text(body)
    print("wrote", out, "bytes", out.stat().st_size)


if __name__ == "__main__":
    main()
