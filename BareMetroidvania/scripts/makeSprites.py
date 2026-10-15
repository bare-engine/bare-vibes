# Generates the few sprites the Tiny Dungeon tileset lacks, in its palette.
# Run: python scripts/makeSprites.py
from PIL import Image
import os

OUT = os.path.join(os.path.dirname(__file__), "..", "texturePackImages")
PAL = {
    ".": (0, 0, 0, 0),
    "L": (192, 203, 220, 255),
    "M": (139, 155, 180, 255),
    "D": (82, 96, 124, 255),
    "O": (63, 38, 49, 255),
    "K": (38, 43, 68, 255),
    "R": (232, 69, 55, 255),
    "r": (255, 112, 109, 255),
    "W": (255, 255, 255, 255),
    "B": (189, 108, 74, 255),
    "b": (234, 165, 108, 255),
    "y": (247, 194, 130, 255),
}

def save(name, rows):
    h = len(rows); w = len(rows[0])
    im = Image.new("RGBA", (w, h))
    for y, row in enumerate(rows):
        assert len(row) == w, (name, y)
        for x, ch in enumerate(row):
            im.putpixel((x, y), PAL[ch])
    im.save(os.path.join(OUT, name + ".png"))

save("spikes", [
    "................",
    "................",
    "................",
    "................",
    "................",
    "...OO......OO...",
    "..OLMO....OLMO..",
    "..OLMO....OLMO..",
    ".OLLMDO..OLLMDO.",
    ".OLLMDO..OLLMDO.",
    "OLLMMDDOOLLMMDDO",
    "OLLMMDDOOLLMMDDO",
    "OLMMMDDOOLMMMDDO",
    "OOOOOOOOOOOOOOOO",
    "ODDDDDDDDDDDDDDO",
    "OOOOOOOOOOOOOOOO",
])

save("platform", [
    "OOOOOOOOOOOOOOOO",
    "ObbbbbbbObbbbbbO",
    "OBBBBBBBOBBBBBBO",
    "OOOOOOOOOOOOOOOO",
    ".OB.........BO..",
    ".OO.........OO..",
])

save("heart", [
    ".OO...OO.",
    "OrrO.ORRO",
    "OrRRORRRO",
    "ORRRRRRRO",
    ".ORRRRRO.",
    "..ORRRO..",
    "...ORO...",
    "....O....",
])

save("heartEmpty", [
    ".OO...OO.",
    "ODDO.ODDO",
    "ODKKOKKDO",
    "OKKKKKKKO",
    ".OKKKKKO.",
    "..OKKKO..",
    "...OKO...",
    "....O....",
])

# CRACKED STONE: THE BRICK WALL WITH CRACKS CUT INTO IT
base = Image.open(os.path.join(OUT, "tile_0040.png")).convert("RGBA")
cracks = [
    "................",
    "......K.........",
    ".......K........",
    ".......K.....K..",
    "......K.K...K...",
    ".....K...K.K....",
    "....K.....K.....",
    "..........K.....",
    "...K......K.....",
    "....K....K.K....",
    ".....K..K...K...",
    "......KK.....K..",
    "......K.........",
    ".....K..........",
    "....K...........",
    "................",
]
for y, row in enumerate(cracks):
    for x, ch in enumerate(row):
        if ch == "K":
            base.putpixel((x, y), PAL["K"])
base.save(os.path.join(OUT, "cracked.png"))
print("sprites written")
