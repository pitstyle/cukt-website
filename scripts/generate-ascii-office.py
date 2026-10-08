#!/usr/bin/env python3
"""Project a 3D office into a dense ASCII grid (one-point perspective).

Fits the room's 8 corners to the character canvas so walls, ceiling and
floor fill the frame. Mockup only.
"""

from __future__ import annotations

import math
from pathlib import Path

COLS = 88
ROWS = 36
CHAR_ASPECT = 0.55
FOCAL = 3.2
CAM_Y = 1.02

# Room (x left/right, y floor/ceil, z near/far).
# Keep ZF/ZN ~1.9 so the back wall is large enough for furniture to read.
XL, XR = -2.35, 2.35
YF, YC = 0.0, 2.18
ZN, ZF = 1.45, 2.75


def raw_project(x: float, y: float, z: float) -> tuple[float, float]:
    z = max(z, 0.4)
    sx = (x * FOCAL / z) / CHAR_ASPECT
    sy = -((y - CAM_Y) * FOCAL / z)
    return sx, sy


def fit_transform() -> tuple[float, float, float, float]:
    corners = [
        (XL, YF, ZN), (XR, YF, ZN), (XL, YC, ZN), (XR, YC, ZN),
        (XL, YF, ZF), (XR, YF, ZF), (XL, YC, ZF), (XR, YC, ZF),
    ]
    pts = [raw_project(*p) for p in corners]
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    minx, maxx, miny, maxy = min(xs), max(xs), min(ys), max(ys)
    mx, my = 1.0, 1.0
    sx = (COLS - 1 - 2 * mx) / (maxx - minx)
    sy = (ROWS - 1 - 2 * my) / (maxy - miny)
    # Use uniform-ish scale; allow sy a bit different because of cell aspect
    return -minx, -miny, sx, sy, mx, my


OX, OY, SX, SY, MX, MY = fit_transform()


def project(x: float, y: float, z: float) -> tuple[float, float]:
    rx, ry = raw_project(x, y, z)
    return MX + (rx + OX) * SX, MY + (ry + OY) * SY


class Grid:
    def __init__(self) -> None:
        self.ch = [[" "] * COLS for _ in range(ROWS)]
        self.depth = [[1e9] * COLS for _ in range(ROWS)]

    def plot(self, x: float, y: float, ch: str, z: float = 5.0) -> None:
        c, r = int(round(x)), int(round(y))
        if 0 <= r < ROWS and 0 <= c < COLS and z <= self.depth[r][c] + 0.04:
            self.depth[r][c] = z
            self.ch[r][c] = ch

    def line(self, a, b, ch: str | None = None) -> None:
        pa, pb = project(*a), project(*b)
        x0, y0 = pa
        x1, y1 = pb
        n = int(max(abs(x1 - x0), abs(y1 - y0), 1) * 1.6) + 1
        dx, dy = x1 - x0, y1 - y0
        if ch is None:
            if abs(dx) < 0.45:
                glyph = "|"
            else:
                slope = dy / (dx if dx else 1e-6)
                if abs(slope) < 0.22:
                    glyph = "-"
                elif abs(slope) > 2.2:
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

    def box(self, x0, y0, z0, x1, y1, z1) -> None:
        p = [
            (x0, y0, z0), (x1, y0, z0), (x1, y0, z1), (x0, y0, z1),
            (x0, y1, z0), (x1, y1, z0), (x1, y1, z1), (x0, y1, z1),
        ]
        for i, j in [
            (0, 1), (1, 2), (2, 3), (3, 0),
            (4, 5), (5, 6), (6, 7), (7, 4),
            (0, 4), (1, 5), (2, 6), (3, 7),
        ]:
            self.line(p[i], p[j])

    def fill_quad(self, tl, tr, br, bl, ch: str, step: float = 0.03) -> None:
        un, vn = int(1 / step), int(1 / step)
        for iu in range(un + 1):
            u = iu / un
            for iv in range(vn + 1):
                v = iv / vn
                x = (1 - u) * (1 - v) * tl[0] + u * (1 - v) * tr[0] + u * v * br[0] + (1 - u) * v * bl[0]
                y = (1 - u) * (1 - v) * tl[1] + u * (1 - v) * tr[1] + u * v * br[1] + (1 - u) * v * bl[1]
                z = (1 - u) * (1 - v) * tl[2] + u * (1 - v) * tr[2] + u * v * br[2] + (1 - u) * v * bl[2]
                p = project(x, y, z)
                self.plot(p[0], p[1], ch, z + 0.02)

    def to_string(self) -> str:
        # Keep full width so the perspective does not collapse.
        return "\n".join("".join(row) for row in self.ch)


FACE = [
    "....................",
    "......::::::::......",
    "....::::::::::::....",
    "...:::::....:::::...",
    "...::::.@@..@@.:::..",
    "...::::.@@..@@.:::..",
    "...::::........:::..",
    "....::::.====.::::..",
    "....::::::::::::....",
    ".....::::::::::.....",
    "......::::::::......",
    ".....:::....:::.....",
    "....:::......:::....",
    "....:::......:::....",
    "....:::......:::....",
    ".....::::::::::.....",
    "......::::::::......",
]


def stamp_face(g: Grid, x0, y0, x1, y1, z) -> None:
    h, w = len(FACE), max(len(r) for r in FACE)
    un, vn = 32, 40
    for iu in range(un + 1):
        u = iu / un
        for iv in range(vn + 1):
            v = iv / vn
            col = min(w - 1, int(u * (w - 1)))
            row = min(h - 1, int(v * (h - 1)))
            ch = FACE[row][col] if col < len(FACE[row]) else "."
            if ch in (".", " "):
                continue
            x = x0 + (x1 - x0) * u
            y = y1 - (y1 - y0) * v
            p = project(x, y, z)
            g.plot(p[0], p[1], ch, z - 0.03)


def draw_room(clerk: bool) -> Grid:
    g = Grid()

    # Corners: n = near (camera), f = far (back wall)
    nfl, nfr = (XL, YF, ZN), (XR, YF, ZN)
    ncl, ncr = (XL, YC, ZN), (XR, YC, ZN)
    ffl, ffr = (XL, YF, ZF), (XR, YF, ZF)
    fcl, fcr = (XL, YC, ZF), (XR, YC, ZF)

    # Floor, ceiling, four walls — this is the readable room volume
    g.polyline([nfl, nfr, ncr, ncl, nfl])  # near opening
    g.polyline([ffl, ffr, fcr, fcl, ffl])  # back wall
    g.line(nfl, ffl)
    g.line(nfr, ffr)
    g.line(ncl, fcl)
    g.line(ncr, fcr)

    # Floor rays only near the walls (do not cut through the desk)
    for t in (-1.85, -1.15, 1.15, 1.85):
        g.line((t, YF, ZF), (t * 1.08, YF, ZN + 0.02), ".")

    # Portrait on BACK wall (dotted mat + bust), high enough to sit above the desk
    pz = ZF - 0.01
    px0, px1, py0, py1 = -1.12, 0.18, 1.10, 2.04
    g.polyline([(px0, py0, pz), (px1, py0, pz), (px1, py1, pz), (px0, py1, pz), (px0, py0, pz)])
    g.fill_quad(
        (px0 + 0.06, py1 - 0.06, pz),
        (px1 - 0.06, py1 - 0.06, pz),
        (px1 - 0.06, py0 + 0.06, pz),
        (px0 + 0.06, py0 + 0.06, pz),
        ".",
        step=0.04,
    )
    stamp_face(g, px0 + 0.12, py0 + 0.12, px1 - 0.12, py1 - 0.12, pz - 0.02)

    # Filing (///) on back-right, clear of the portrait
    fx0, fx1, fy0, fy1 = 1.05, 1.58, 1.18, 1.82
    g.polyline([(fx0, fy0, pz), (fx1, fy0, pz), (fx1, fy1, pz), (fx0, fy1, pz), (fx0, fy0, pz)])
    for k in range(5):
        yy = fy0 + (fy1 - fy0) * (0.15 + k * 0.16)
        g.line((fx0 + 0.07, yy, pz), (fx1 - 0.07, yy, pz), "/")

    g.polyline([
        (1.72, 1.32, pz), (2.05, 1.32, pz), (2.05, 1.72, pz), (1.72, 1.72, pz), (1.72, 1.32, pz),
    ])

    # Desk — a 3/4 box in the foreground, in front of the back wall
    dx0, dx1 = -1.12, 1.12
    dy0, dy1 = 0.0, 0.68
    dz0, dz1 = 1.55, 2.48
    g.fill_quad(
        (dx0, dy1, dz1), (dx1, dy1, dz1), (dx1, dy1, dz0), (dx0, dy1, dz0),
        " ",
        step=0.022,
    )
    g.fill_quad(
        (dx0, dy1, dz0), (dx1, dy1, dz0), (dx1, dy0 + 0.10, dz0), (dx0, dy0 + 0.10, dz0),
        " ",
        step=0.03,
    )
    g.polyline([
        (dx0, dy1, dz0), (dx1, dy1, dz0), (dx1, dy1, dz1), (dx0, dy1, dz1), (dx0, dy1, dz0),
    ])
    g.polyline([
        (dx0, dy1, dz0), (dx0, dy0 + 0.10, dz0), (dx1, dy0 + 0.10, dz0), (dx1, dy1, dz0),
    ])
    g.polyline([
        (dx1, dy1, dz0), (dx1, dy0 + 0.10, dz0), (dx1, dy0 + 0.10, dz1), (dx1, dy1, dz1),
    ])
    g.line((dx0 + 0.08, dy1, dz0 + 0.04), (dx0 + 0.08, dy0, dz0 + 0.04), "|")
    g.line((dx1 - 0.08, dy1, dz0 + 0.04), (dx1 - 0.08, dy0, dz0 + 0.04), "|")
    g.line((dx1 - 0.06, dy1, dz1 - 0.06), (dx1 - 0.06, dy0, dz1 - 0.06), "|")
    g.line((dx0 + 0.10, dy1, dz1 - 0.08), (dx0 + 0.10, dy0, dz1 - 0.08), "|")

    # CRT sitting on the right half of the desk — fill so the wall does not show through
    mx0, mx1, my0, my1 = 0.38, 1.08, dy1, 1.28
    mz0, mz1 = 1.86, 2.24
    g.fill_quad(
        (mx0, my1, mz0), (mx1, my1, mz0), (mx1, my0, mz0), (mx0, my0, mz0),
        " ",
        step=0.03,
    )
    g.box(mx0, my0, mz0, mx1, my1, mz1)
    g.polyline([
        (mx0 + 0.06, my0 + 0.08, mz0),
        (mx1 - 0.06, my0 + 0.08, mz0),
        (mx1 - 0.06, my1 - 0.08, mz0),
        (mx0 + 0.06, my1 - 0.08, mz0),
        (mx0 + 0.06, my0 + 0.08, mz0),
    ])
    g.polyline([
        (0.40, dy1, 1.94), (0.78, dy1, 1.94), (0.82, dy1, 2.14), (0.36, dy1, 2.14), (0.40, dy1, 1.94),
    ])
    # CRT screen glyph (also the animation target)
    sp = project(0.70, 1.02, mz0 - 0.01)
    g.plot(sp[0], sp[1], ">", mz0 - 0.05)
    g.plot(sp[0] + 1, sp[1], "_", mz0 - 0.05)

    g.polyline([
        (-0.35, dy1 + 0.03, 1.68),
        (0.32, dy1 + 0.03, 1.68),
        (0.40, dy1 + 0.03, 1.86),
        (-0.26, dy1 + 0.03, 1.86),
        (-0.35, dy1 + 0.03, 1.68),
    ])
    g.line((-0.22, dy1 + 0.03, 1.74), (0.22, dy1 + 0.03, 1.74), "=")
    g.line((-0.20, dy1 + 0.03, 1.80), (0.24, dy1 + 0.03, 1.80), "=")

    if clerk:
        cz = 1.78
        g.polyline([
            (-0.88, 0.48, cz), (-0.88, 1.08, cz),
            (-0.48, 1.08, cz + 0.12), (-0.48, 0.48, cz + 0.12),
        ])
        g.polyline([
            (-0.90, 0.48, cz - 0.08), (-0.38, 0.48, cz + 0.04),
            (-0.34, 0.48, cz + 0.28), (-0.86, 0.48, cz + 0.16), (-0.90, 0.48, cz - 0.08),
        ])
        g.fill_quad(
            (-0.78, 0.98, cz), (-0.44, 0.98, cz + 0.10),
            (-0.44, 0.52, cz + 0.10), (-0.78, 0.52, cz),
            ":",
            step=0.05,
        )
        g.polyline([
            (-0.78, 0.52, cz), (-0.44, 0.52, cz + 0.10),
            (-0.44, 0.98, cz + 0.10), (-0.78, 0.98, cz), (-0.78, 0.52, cz),
        ])
        hx, hy, hz = -0.62, 1.10, cz - 0.04
        for ang in range(0, 360, 10):
            a0, a1 = math.radians(ang), math.radians(ang + 10)
            g.line(
                (hx + 0.13 * math.cos(a0), hy + 0.15 * math.sin(a0), hz),
                (hx + 0.13 * math.cos(a1), hy + 0.15 * math.sin(a1), hz),
                "@",
            )
        g.plot(*project(hx - 0.045, hy + 0.02, hz - 0.02), "o", hz - 0.04)
        g.plot(*project(hx + 0.045, hy + 0.02, hz - 0.02), "o", hz - 0.04)
        g.plot(*project(hx, hy - 0.05, hz - 0.02), "-", hz - 0.04)
        g.line((-0.72, 0.82, cz), (-0.22, dy1 + 0.04, 1.84), "/")
        g.line((-0.50, 0.82, cz + 0.08), (0.02, dy1 + 0.04, 1.92), "\\")
        g.plot(*project(-0.20, dy1 + 0.05, 1.84), "o", 1.83)
        g.plot(*project(0.04, dy1 + 0.05, 1.92), "o", 1.91)

    return g


def screen_cells() -> list[tuple[int, int]]:
    cells = []
    p = project(0.70, 1.02, 1.85)
    c, r = int(round(p[0])), int(round(p[1]))
    for dc, dr in ((0, 0), (1, 0), (2, 0), (0, 1), (1, 1)):
        cc, rr = c + dc, r + dr
        if 0 <= rr < ROWS and 0 <= cc < COLS:
            cells.append((rr, cc))
    return cells


def apply_patch(text: str, cells: list[tuple[int, int]], glyphs: str) -> str:
    rows = [list(line) for line in text.split("\n")]
    for (r, c), ch in zip(cells, glyphs):
        if 0 <= r < len(rows) and 0 <= c < len(rows[r]):
            rows[r][c] = ch
    return "\n".join("".join(row) for row in rows)


def ts_string(s: str) -> str:
    return "`" + s.replace("\\", "\\\\").replace("`", "\\`") + "`"


def main() -> None:
    empty = draw_room(False).to_string()
    clerk = draw_room(True).to_string()
    cells = screen_cells()
    print("screen cells", cells)
    print(empty)
    print("--- clerk head ---")
    print("\n".join(clerk.split("\n")[8:28]))

    # Animation is a few CRT glyphs, not four copies of the whole room.
    patch_glyphs = [">_   ", ">_#  ", ">    ", ">#   "]
    patches = [[list(cell) + [ch] for cell, ch in zip(cells, glyphs)] for glyphs in patch_glyphs]

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
        "export const ROOM_BANNER_LINES = 16;",
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
