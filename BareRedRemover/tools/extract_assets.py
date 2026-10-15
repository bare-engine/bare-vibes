"""
Pulls the art, sounds and levels out of redRemover.swf and turns them into Bare assets.

    python tools/extract_assets.py <path to ffdec-cli.jar>

Needs Java (for JPEXS FFDec), Pillow, and ImageMagick's `magick` for the webp backgrounds.

Writes:
    texturePackImages/   shape textures (one per kind), faces, pop frames, title
    public/images/bg/    level backgrounds (streamed)
    public/sounds/       pop, pass, fail, music
    public/data/levels/  level1..level6.json, converted from the SWF's level XML

Art is rendered at 2x or more, so it stays sharp on a scaled-up canvas. Faces, pops and backgrounds get a
scale of 0.5. Shapes are SHAPE_TEXTURE pixels, drawn at SHAPE_UNITS, and get scaled to their size: rects
through NineSliceComponent, so their outline and corner ticks keep their size, circles evenly.

    python tools/extract_assets.py <path to ffdec-cli.jar> --shapes

only redraws the shape textures.
"""

import json
import math
import os
import re
import shutil
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET

from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SWF = os.path.join(ROOT, "redRemover.swf")
TEX_DIR = os.path.join(ROOT, "texturePackImages")
BG_DIR = os.path.join(ROOT, "public", "images", "bg")
SOUND_DIR = os.path.join(ROOT, "public", "sounds")
LEVEL_DIR = os.path.join(ROOT, "public", "data", "levels")

RES = 2         # texture pixels per game unit
SHAPE_TEXTURE = 200  # SIZE OF EVERY SHAPE TEXTURE, IN PIXELS
# GAME UNITS EACH SHAPE TEXTURE IS DRAWN AT. THE ORIGINAL STRETCHES ITS 20 UNIT RECT SPRITE, SO ITS CORNER
# TICKS GROW WITH THE SHAPE; DRAWING IT AT 50 UNITS (THE MOST COMMON SIZE, 4X) KEEPS THEIR DETAIL.
# NINE-SLICE BORDERS OF 32 PX AT borderScale 0.25 HOLD THE TICKS, WHICH SPAN 7.5 UNITS AT THAT SIZE
SHAPE_UNITS = {"r": 50.0, "c": 25.0}
SS = 4          # supersampling when rasterizing shapes
STROKE = 1.0    # Flash hairline, in game units

# ORIGINAL LEVEL NUMBERS (1-BASED, OUT OF 45) THAT BECOME level1..level5
PICKED_LEVELS = [1, 2, 3, 4, 8, 12]

# PER-SHAPE GRAVITY DIRECTION "d": 0 FIXED, 1 DOWN, 2 LEFT, 3 UP, 4 RIGHT. 10 m/s² IN THE ORIGINAL,
# 341.33 px/s² HERE (SEE src/physics.ts). DOWN IS LEFT OUT: IT'S THE gravity IN settingsData.json
GRAVITY = 10 * 30 * (40 * 0.8 / 30) ** 2
GRAVITY_DIRECTIONS = {2: (-1, 0), 3: (0, -1), 4: (1, 0)}

# SPRITE IDS IN THE SWF
SPRITE_BG = 58        # level backgrounds, one frame per label
SPRITE_CIRCLE = 246   # "c"
SPRITE_RECT = 260     # "r"
SPRITE_FACE = 398     # face (save / neutral shapes)
SPRITE_ANGRY = 401    # face_angry (kill / hardkill shapes)
SPRITE_POP = 403      # pop_mc
SPRITE_TITLE = 188    # title_37

# FRAME ORDER OF THE "r" AND "c" SPRITES
SHAPE_FRAMES = ["neutral", "save", "kill", "hardkill", "fneutral", "fsave", "fkill", "fhardkill"]

# FRAME LABELS OF THE BACKGROUND SPRITE (frame numbers are 1-based)
BG_FRAMES = {**{c: i + 1 for i, c in enumerate("abcdefghijklmno")},
             "jb": 16, "jp": 17, "jr": 18, "tut1": 24, "tut2": 25, "tut3": 26, "tut4": 27, "tutgrav2": 28}

# WHERE THE 640x480 STAGE SITS INSIDE AN EXPORTED BACKGROUND FRAME, AT ZOOM 1
BG_STAGE_OFFSET = (378, 198)

# FACE / POP REGISTRATION POINTS, FROM THE SVG EXPORT: (origin x, origin y, width, height) IN FLASH PIXELS
REG = {
    SPRITE_FACE: (10.0, 6.0, 20.0, 16.5),
    SPRITE_ANGRY: (16.7, 7.8, 34.3, 19.3),
    SPRITE_POP: (16.9, 16.65, 33.25, 33.25),
}


def ffdec(jar, out_dir, args):
    subprocess.run(["java", "-jar", jar, *args, out_dir, SWF], check=True, stdout=subprocess.DEVNULL)


# ---------------------------------------------------------------- SVG SHAPES

def parse_matrix(s):
    if not s:
        return (1, 0, 0, 1, 0, 0)
    nums = [float(n) for n in re.findall(r"-?[\d.]+(?:e-?\d+)?", s)]
    return tuple(nums)


def apply(m, x, y):
    a, b, c, d, e, f = m
    return a * x + c * y + e, b * x + d * y + f


def parse_path(d):
    """M/L/Q/Z path data into a list of polylines (lists of points). Quads are flattened."""
    tokens = re.findall(r"[MLQZ]|-?[\d.]+", d)
    polys, cur, cmd, i = [], [], None, 0
    while i < len(tokens):
        t = tokens[i]
        if t in "MLQZ":
            cmd = t
            i += 1
            if t == "Z":
                if cur:
                    cur.append(cur[0])
            continue
        if cmd == "M":
            if len(cur) > 1:
                polys.append(cur)
            cur = [(float(tokens[i]), float(tokens[i + 1]))]
            i += 2
            cmd = "L"
        elif cmd == "L":
            cur.append((float(tokens[i]), float(tokens[i + 1])))
            i += 2
        elif cmd == "Q":
            cx, cy = float(tokens[i]), float(tokens[i + 1])
            ex, ey = float(tokens[i + 2]), float(tokens[i + 3])
            sx, sy = cur[-1]
            for s in range(1, 9):
                u = s / 8
                cur.append(((1 - u) ** 2 * sx + 2 * (1 - u) * u * cx + u * u * ex,
                            (1 - u) ** 2 * sy + 2 * (1 - u) * u * cy + u * u * ey))
            i += 4
    if len(cur) > 1:
        polys.append(cur)
    return polys


def load_svg_frame(path):
    """Returns [(kind, color, polylines)] in drawing order, in the sprite's own coordinates."""
    ns = {"svg": "http://www.w3.org/2000/svg", "xlink": "http://www.w3.org/1999/xlink"}
    tree = ET.parse(path)
    root = tree.getroot()
    defs = {g.get("id"): g for g in root.iter("{http://www.w3.org/2000/svg}g") if g.get("id")}
    out = []
    top = root.find("svg:g", ns)
    for use in top.findall("svg:use", ns):
        ref = use.get("{http://www.w3.org/1999/xlink}href")[1:]
        m = parse_matrix(use.get("transform"))
        for p in defs[ref].findall("svg:path", ns):
            polys = [[apply(m, x, y) for x, y in poly] for poly in parse_path(p.get("d"))]
            if p.get("fill") not in (None, "none"):
                out.append(("fill", p.get("fill"), polys))
            if p.get("stroke") not in (None, "none"):
                out.append(("stroke", p.get("stroke"), polys))
    return out


def render_shape(frame, half, w, h, res):
    """Draws a frame of the r/c sprite (spanning -half..half) stretched to w x h game units, at res pixels
    per unit. Strokes are one game unit wide, like Flash hairlines. Edges are inset half a stroke so the
    outline stays inside the texture, whose size is also the physics size."""
    W, H = round(w * res), round(h * res)
    k = res * SS
    inset = STROKE * 0.5

    def tx(x, y):
        return (((x / half) * (w * 0.5 - inset) + w * 0.5) * k,
                ((y / half) * (h * 0.5 - inset) + h * 0.5) * k)

    img = Image.new("RGBA", (W * SS, H * SS), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    for kind, color, polys in frame:
        for poly in polys:
            pts = [tx(x, y) for x, y in poly]
            if kind == "fill":
                draw.polygon(pts, fill=color)
            else:
                draw.line(pts, fill=color, width=max(1, round(STROKE * k)), joint="curve")
    return img.resize((W, H), Image.LANCZOS)


# ---------------------------------------------------------------- LEVELS

def load_levels():
    src = open(os.path.join(TMP, "scripts", "scripts", "Levels.as"), encoding="utf-8").read()
    xml = src[src.index("<levels>"):src.index("</levels>") + len("</levels>")]
    return ET.fromstring(xml.replace("&#x27;", "'")).findall("level")


def main():
    global TMP
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    jar = sys.argv[1]
    shapes_only = "--shapes" in sys.argv
    TMP = tempfile.mkdtemp(prefix="redremover_")

    print("exporting from SWF...")
    ffdec(jar, os.path.join(TMP, "svg"), ["-format", "sprite:svg", "-selectid", f"{SPRITE_RECT},{SPRITE_CIRCLE}", "-export", "sprite"])
    if not shapes_only:
        ffdec(jar, os.path.join(TMP, "scripts"), ["-export", "script"])
        ffdec(jar, os.path.join(TMP, "z2"), ["-zoom", str(RES), "-selectid", f"{SPRITE_BG},{SPRITE_TITLE}", "-export", "sprite"])
        ffdec(jar, os.path.join(TMP, "z4"), ["-zoom", str(RES * 2), "-selectid", f"{SPRITE_FACE},{SPRITE_ANGRY},{SPRITE_POP}", "-export", "sprite"])
        ffdec(jar, os.path.join(TMP, "sounds"), ["-export", "sound"])

    def sprite_dir(base, sid):
        d = os.path.join(TMP, base)
        return os.path.join(d, next(n for n in os.listdir(d) if n.startswith(f"DefineSprite_{sid}")))

    # SHAPE FRAMES
    shape_svgs = {}
    for letter, sid, half in (("r", SPRITE_RECT, 10.0), ("c", SPRITE_CIRCLE, 20.0)):
        d = sprite_dir("svg", sid)
        for i, label in enumerate(SHAPE_FRAMES):
            shape_svgs[(letter, label)] = (load_svg_frame(os.path.join(d, f"{i + 1}.svg")), half)

    # OLD PER-SIZE TEXTURES, FROM BEFORE NINE-SLICING
    for f in os.listdir(TEX_DIR):
        if re.match(r"^(r|c)_\w+_\d+x\d+\.png$", f):
            os.remove(os.path.join(TEX_DIR, f))

    # ONE TEXTURE PER KIND, SHAPE_TEXTURE PIXELS SQUARE
    for (letter, label), (frame, half) in shape_svgs.items():
        units = SHAPE_UNITS[letter]
        render_shape(frame, half, units, units, SHAPE_TEXTURE / units).save(os.path.join(TEX_DIR, f"{letter}_{label}.png"))

    if shapes_only:
        shutil.rmtree(TMP, ignore_errors=True)
        print("done")
        return

    # FACES AND POP, EXPORTED AT 2 * RES, HALVED FOR SMOOTH EDGES
    pivots = {}
    for sid, prefix, frames in ((SPRITE_FACE, "face", 4), (SPRITE_ANGRY, "angry", 4), (SPRITE_POP, "pop", 8)):
        d = sprite_dir("z4", sid)
        for i in range(1, frames + 1):
            im = Image.open(os.path.join(d, f"{i}.png")).convert("RGBA")
            im = im.resize((round(im.width / 2), round(im.height / 2)), Image.LANCZOS)
            im.save(os.path.join(TEX_DIR, f"{prefix}{i}.png"))
        ox, oy, sw, sh = REG[sid]
        pivots[prefix] = {"x": round(ox / sw, 4), "y": round(oy / sh, 4)}
    print("face pivots:", json.dumps(pivots))

    title = Image.open(os.path.join(sprite_dir("z2", SPRITE_TITLE), "1.png")).convert("RGBA")
    title.crop(title.getbbox()).save(os.path.join(TEX_DIR, "title.png"))

    # LEVELS
    os.makedirs(LEVEL_DIR, exist_ok=True)
    levels = load_levels()
    bgs = {"d"}  # MENU BACKGROUND
    for n, orig in enumerate(PICKED_LEVELS, 1):
        lx = levels[orig - 1]
        entities = []
        for s in lx.find("shapes"):
            letter = s.findtext("s")
            kind = s.findtext("t")
            d = int(s.findtext("d"))
            w, h = round(float(s.findtext("w"))), round(float(s.findtext("h")))
            label = kind if d else "f" + kind
            entity = {
                "extends": f"{letter}_{label}",
                "position": {"x": float(s.findtext("x")), "y": float(s.findtext("y"))},
                "scale": {"x": round(w / SHAPE_TEXTURE, 5), "y": round(h / SHAPE_TEXTURE, 5)},
            }
            if d in GRAVITY_DIRECTIONS:
                gx, gy = GRAVITY_DIRECTIONS[d]
                entity["gravity"] = {"x": round(gx * GRAVITY, 2), "y": round(gy * GRAVITY, 2)}
            a = float(s.findtext("a"))
            if a:
                entity["rotation"] = a
            entities.append(entity)
        bg = lx.findtext("bg")
        bgs.add(bg)
        level = {
            "name": f"level{n}",
            "dimensions": {"width": 640, "height": 480},
            "customData": {
                "title": lx.findtext("title"),
                "author": lx.findtext("author"),
                "par": int(lx.findtext("par")),
                "background": f"bg/{bg}",
                "originalLevel": orig,
            },
            "entitiesByLayer": {"objects": entities},
        }
        with open(os.path.join(LEVEL_DIR, f"level{n}.json"), "w", encoding="utf-8") as f:
            json.dump(level, f, indent=2)
        print(f"level{n}: {lx.findtext('title')} ({len(entities)} shapes)")

    # BACKGROUNDS
    os.makedirs(BG_DIR, exist_ok=True)
    bg_dir = sprite_dir("z2", SPRITE_BG)
    ox, oy = BG_STAGE_OFFSET
    for bg in sorted(bgs):
        src = os.path.join(bg_dir, f"{BG_FRAMES[bg]}.png")
        dst = os.path.join(BG_DIR, f"{bg}.webp")
        subprocess.run(["magick", src, "-crop", f"{640 * RES}x{480 * RES}+{ox * RES}+{oy * RES}", "+repage",
                        "-background", "white", "-flatten", "-quality", "90", dst], check=True)

    # SOUNDS
    os.makedirs(SOUND_DIR, exist_ok=True)
    sounds = os.path.join(TMP, "sounds")
    for f in os.listdir(sounds):
        for key, name in (("sfx_pop", "pop"), ("sfx_pass", "pass"), ("sfx_fail", "fail"), ("sfx_piano", "music")):
            if key in f:
                shutil.copy(os.path.join(sounds, f), os.path.join(SOUND_DIR, name + ".mp3"))

    shutil.rmtree(TMP, ignore_errors=True)
    print("done")


if __name__ == "__main__":
    main()
