// Generates the game's pixel art into texturePackImages/, which the engine packs into its atlas.
// Run with: node tools/generateSprites.cjs
// Uses the sharp that ships inside bare-engine, so no extra dependency is needed.

const path = require("path");
const fs = require("fs");

let sharp;
try { sharp = require("sharp"); }
catch { sharp = require(path.join(__dirname, "../node_modules/bare-engine/node_modules/sharp")); }

const OUT = path.join(__dirname, "../texturePackImages");

const PALETTE = {
    ".": null,
    k: "#3a2f2a", d: "#2f5d34", G: "#4f8a3c", g: "#78b85a",
    b: "#5a3a22", B: "#8a5a32", T: "#c89a5a", t: "#a87a42",
    s: "#00000038",
    L: "#a8a8a0", l: "#d4d4cc", D: "#7a7a74",
    O: "#857a72", o: "#d0763a",
    r: "#e8445a", R: "#a8203a",
    P: "#dcb47e", p: "#b88a52", q: "#8a6238",
    I: "#b8c4cc", i: "#eef4f8",
    M: "#5a6470", m: "#9aa4b0",
    F: "#ff8a2a", f: "#ffd84a",
    w: "#f4f4f4", v: "#c4c4c4",
    S: "#f1c27d", e: "#2a2a2a", h: "#6a3a1a", n: "#3a4a6a",
    W: "#e2d6be", x: "#d0583e", X: "#9a3a28", y: "#ffe89a",
    c: "#6a4a36", C: "#8e6a4c", z: "#ffffff", Y: "#f0c030",
};

function hex(c)
{
    const h = c.replace("#", "");
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), h.length > 6 ? parseInt(h.slice(6, 8), 16) : 255];
}

class Canvas
{
    constructor(w, h) { this.w = w; this.h = h; this.data = Buffer.alloc(w * h * 4); }
    set(x, y, rgba)
    {
        if (x < 0 || y < 0 || x >= this.w || y >= this.h || !rgba) return;
        const i = (y * this.w + x) * 4;
        const a = rgba[3] / 255;
        if (a >= 1 || this.data[i + 3] === 0)
        {
            this.data[i] = rgba[0]; this.data[i + 1] = rgba[1]; this.data[i + 2] = rgba[2]; this.data[i + 3] = rgba[3];
            return;
        }
        // blend over what is there
        for (let c = 0; c < 3; c++) this.data[i + c] = Math.round(this.data[i + c] * (1 - a) + rgba[c] * a);
        this.data[i + 3] = Math.max(this.data[i + 3], rgba[3]);
    }
    rect(x, y, w, h, rgba) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, rgba); }
    ascii(rows, ox = 0, oy = 0)
    {
        rows.forEach((row, y) => [...row].forEach((ch, x) => {
            if (!(ch in PALETTE)) throw new Error(`Unknown palette char '${ch}'`);
            const c = PALETTE[ch];
            if (c) this.set(ox + x, oy + y, hex(c));
        }));
        return this;
    }
    save(name) { return sharp(this.data, { raw: { width: this.w, height: this.h, channels: 4 } }).png().toFile(path.join(OUT, name + ".png")); }
}

// small deterministic random, so regenerating gives the same art
let seed = 1234;
function rand() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
function jitter(rgb, amount) { const j = (rand() - 0.5) * amount; return [rgb[0] + j, rgb[1] + j, rgb[2] + j, 255].map(v => Math.max(0, Math.min(255, Math.round(v)))); }

function terrain(name, base, opts = {})
{
    const c = new Canvas(16, 16);
    const b = hex(base);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) c.set(x, y, jitter(b, opts.noise ?? 10));
    if (opts.speck) for (let n = 0; n < opts.speckCount; n++)
    {
        const x = Math.floor(rand() * 16), y = Math.floor(rand() * 15);
        const col = hex(opts.speck[Math.floor(rand() * opts.speck.length)]);
        c.set(x, y, col);
        if (opts.blades) c.set(x, y + 1, col);
    }
    if (opts.waves) for (let n = 0; n < 3; n++)
    {
        const x = Math.floor(rand() * 12), y = 2 + Math.floor(rand() * 12);
        for (let i = 0; i < 4; i++) c.set(x + i, y, hex(opts.waves));
    }
    if (opts.flowers) for (let n = 0; n < opts.flowers; n++)
    {
        const x = 1 + Math.floor(rand() * 14), y = 1 + Math.floor(rand() * 14);
        const col = hex(["#f4f0ff", "#ffd84a", "#ff9ab8"][Math.floor(rand() * 3)]);
        c.set(x, y, col); c.set(x + 1, y, col); c.set(x, y + 1, col); c.set(x + 1, y + 1, col); c.set(x, y, hex("#fff6c0"));
    }
    return c.save(name);
}

function belt(frame)
{
    const c = new Canvas(16, 16);
    c.rect(0, 0, 16, 16, hex("#4d4a52"));
    c.rect(0, 0, 16, 2, hex("#2c2a30")); c.rect(0, 14, 16, 2, hex("#2c2a30"));
    c.rect(0, 2, 16, 1, hex("#6e6a76")); c.rect(0, 13, 16, 1, hex("#3a383e"));
    for (let y = 3; y < 13; y++) for (let x = 0; x < 16; x++)
    {
        const dy = Math.floor(Math.abs(y - 7.5));
        const m = ((x + dy - frame * 2) % 8 + 8) % 8;
        if (m < 2) c.set(x, y, hex("#8a8494"));
    }
    return c.save("belt_" + frame);
}

function hq()
{
    const c = new Canvas(32, 32);
    const k = hex("#3a2f2a");
    // shadow and walls
    c.rect(2, 30, 29, 2, hex("#00000038"));
    c.rect(3, 14, 26, 16, k); c.rect(4, 15, 24, 14, hex(PALETTE.W));
    for (let y = 15; y < 29; y += 3) c.rect(4, y, 24, 1, hex("#cfc2a6"));
    // roof
    for (let y = 2; y < 15; y++)
    {
        const half = Math.round((y - 2) * 1.25) + 2;
        c.rect(16 - half - 1, y, half * 2 + 2, 1, k);
        c.rect(16 - half, y, half * 2, 1, hex(y % 3 == 0 ? PALETTE.X : PALETTE.x));
    }
    // door and windows
    c.rect(13, 21, 6, 9, k); c.rect(14, 22, 4, 8, hex(PALETTE.B)); c.set(17, 26, hex(PALETTE.f));
    for (const wx of [6, 21]) { c.rect(wx, 18, 6, 5, k); c.rect(wx + 1, 19, 4, 3, hex(PALETTE.y)); c.rect(wx + 3, 19, 1, 3, k); }
    // chimney and flag
    c.rect(22, 3, 4, 7, k); c.rect(23, 4, 2, 6, hex(PALETTE.D));
    c.rect(6, 0, 1, 9, k); c.rect(7, 0, 6, 4, hex("#5aa0e0")); c.rect(7, 1, 6, 1, hex("#ffffff"));
    return c.save("b_hq");
}

function farm(stage)
{
    const c = new Canvas(32, 32);
    c.rect(0, 0, 32, 32, hex("#8a5a32"));
    c.rect(1, 1, 30, 30, hex(PALETTE.C));
    for (let y = 3; y < 30; y += 5)
    {
        c.rect(2, y, 28, 3, hex(PALETTE.c));
        for (let x = 4; x < 29; x += 4)
        {
            c.set(x, y, hex(PALETTE.g)); c.set(x, y - 1, hex(PALETTE.G));
            if (stage >= 1) { c.set(x - 1, y - 1, hex(PALETTE.G)); c.set(x + 1, y - 1, hex(PALETTE.G)); c.set(x, y - 2, hex(PALETTE.g)); }
            if (stage >= 2) { c.set(x - 1, y - 2, hex(PALETTE.r)); c.set(x + 1, y - 2, hex(PALETTE.R)); c.set(x, y - 3, hex(PALETTE.r)); }
        }
    }
    // fence posts
    for (let i = 0; i < 32; i += 6) { c.rect(i, 0, 2, 2, hex(PALETTE.b)); c.rect(i, 30, 2, 2, hex(PALETTE.b)); c.rect(0, i, 2, 2, hex(PALETTE.b)); c.rect(30, i, 2, 2, hex(PALETTE.b)); }
    return c.save("b_farm_" + stage);
}

const ASCII = {
    r_tree: [
        ".......dd.......",
        "......dGGd......",
        ".....dGgGGd.....",
        ".....dGGgGd.....",
        "....dGGGGgGd....",
        "....dGgGGGGd....",
        "...dGGGGgGGGd...",
        "...dGGgGGGGGd...",
        "..dGGGGGGgGGGd..",
        "..dGgGGGGGGGGd..",
        ".dGGGGGgGGGGGGd.",
        ".ddGGGGGGGGGGdd.",
        "...dddGGGGddd...",
        "......bBBb......",
        "......bBBb......",
        ".....ssssss.....",
    ],
    r_tree2: [
        ".....dddddd.....",
        "...ddGGGGGGdd...",
        "..dGGgGGGGGGGd..",
        ".dGGgggGGGGGGGd.",
        ".dGGggGGGGgGGGd.",
        "dGGGGGGGGgggGGGd",
        "dGGGGGGGGGgGGGGd",
        "dGGgGGGGGGGGGGGd",
        "dGgggGGGGGGGGGdd",
        ".dGgGGGGGGGGGGd.",
        ".ddGGGGGGGGGddd.",
        "...dddGBBGddd...",
        "......bBBb......",
        "......bBBb......",
        ".....sbBBbs.....",
        ".....ssssss.....",
    ],
    r_rock: [
        "................",
        "................",
        "................",
        ".....kkkkk......",
        "....kLLLLLkk....",
        "...kLlLLLLLLk...",
        "...kLLLLLLLLLk..",
        "..kLLLLLLDLLLk..",
        "..kLLLLLDDLLLLk.",
        ".kLLDLLLLLLLLLk.",
        ".kLLLDDLLLLLDDk.",
        ".kDLLLLLLLLDDDk.",
        "..kDDDDDDDDDDk..",
        "...kkkkkkkkkk...",
        "..ssssssssssss..",
        "................",
    ],
    r_iron: [
        "................",
        "................",
        "....kk......kk..",
        "...kOOk....kOok.",
        "...kOoOk..kOOOk.",
        "....kkk...kkkk..",
        ".......kk.......",
        "......kOOk......",
        "..kk..kOoOk..kk.",
        ".kOOk..kkk..kOOk",
        ".kOoOk......kOok",
        "..kkk...kk...kk.",
        ".......kOOk.....",
        "......kOOoOk....",
        ".......kkkk.....",
        "................",
    ],
    r_berry: [
        "................",
        "................",
        ".....dddddd.....",
        "...ddGGGGGGdd...",
        "..dGGrGGGGrGGd..",
        "..dGrRrGGGRrGd..",
        ".dGGGrGGrGGrGGd.",
        ".dGGGGGrRrGGGGd.",
        ".dGrGGGGrGGGrGd.",
        ".dRrGGrGGGGrRrd.",
        "..dGGrRrGGGGrd..",
        "..ddGGrGGGGGdd..",
        "....dddddddd....",
        "...ssssssssss...",
        "................",
        "................",
    ],
    b_crate: [
        "................",
        ".kkkkkkkkkkkkkk.",
        ".kTTTTTTTTTTTTk.",
        ".kBtBBBBBBBBtBk.",
        ".kBBtBBBBBBtBBk.",
        ".kBBBtBBBBtBBBk.",
        ".kBBBBtBBtBBBBk.",
        ".kBBBBBttBBBBBk.",
        ".kBBBBBttBBBBBk.",
        ".kBBBBtBBtBBBBk.",
        ".kBBBtBBBBtBBBk.",
        ".kBBtBBBBBBtBBk.",
        ".kBtBBBBBBBBtBk.",
        ".kTTTTTTTTTTTTk.",
        ".kkkkkkkkkkkkkk.",
        "..sssssssssssss.",
    ],
    b_sawmill: [
        "................",
        "..kkkkkkkkkkkk..",
        ".kXXXXXXXXXXXXk.",
        "kxxxxxxxxxxxxxxk",
        "kkkkkkkkkkkkkkkk",
        ".kBBBBBBBBBBBBk.",
        ".kBbBBBkkkBBBBk.",
        ".kBBBBkmmmkBBBk.",
        ".kBBBkmmMmmkBBk.",
        ".kBBBkmMzMmkBBk.",
        ".kBBBkmmMmmkBBk.",
        ".kBbBBkmmmkBBbk.",
        ".kBBBBBkkkBBBBk.",
        ".kPPPPPPPPPPPPk.",
        ".kkkkkkkkkkkkkk.",
        "..ssssssssssss..",
    ],
    b_smelter: [
        "................",
        "......kkkk......",
        "......kDDk......",
        "......kDDk......",
        "...kkkkDDkkkk...",
        "..kLLLLLLLLLLk..",
        ".kLlLLDLLLDLLLk.",
        ".kLLDLLLLLLLDLk.",
        ".kLLLkkkkkkLLLk.",
        ".kLDkFFfFFFkLLk.",
        ".kLLkFfffFFkDLk.",
        ".kLLkFFfFFFkLLk.",
        ".kDLkkkkkkkkLDk.",
        ".kLLLLDLLLLLLLk.",
        "..kkkkkkkkkkkk..",
        "..ssssssssssss..",
    ],
    b_workshop: [
        "................",
        "................",
        "..kkkkkkkkkkkk..",
        ".kxxxxxxxxxxxxk.",
        "kXXXXXXXXXXXXXXk",
        "kkkkkkkkkkkkkkkk",
        ".kWWWWWWWWWWWWk.",
        ".kWWkkWWWWWWWWk.",
        ".kWkmmkWWkkkWWk.",
        ".kWkmmkWkMMMkWk.",
        ".kWWkkWWkMzMkWk.",
        ".kWWWWWWkMMMkWk.",
        ".kWWWWWWWkkkWWk.",
        ".kBBBBBBBBBBBBk.",
        ".kkkkkkkkkkkkkk.",
        "..ssssssssssss..",
    ],
    b_drill: [
        "................",
        "..kkkkkkkkkkkk..",
        ".kmmmmmmmmmmmmk.",
        ".kmMMMMMMMMMMmk.",
        ".kmMYYMMMMMMMmk.",
        ".kmMMMMMMMMMMmk.",
        ".kmmmmmkkmmmmmk.",
        "..kkkkkmmkkkkk..",
        ".....kmMMmk.....",
        ".....kmMMmk.....",
        "......kmmk......",
        "......kMMk......",
        ".......kk.......",
        "....oOoOoOo.....",
        "...OoOOoOOoO....",
        "..ssssssssssss..",
    ],
    b_hut: [
        ".......kk.......",
        "......kxxk......",
        ".....kxxxXk.....",
        "....kxxxxxXk....",
        "...kxxxxxxxXk...",
        "..kxxxxxxxxxXk..",
        ".kkkkkkkkkkkkkk.",
        "..kWWWWWWWWWWk..",
        "..kWkkkWWWWWWk..",
        "..kWkykWWkkkWk..",
        "..kWkkkWWkBkWk..",
        "..kWWWWWWkBkWk..",
        "..kWWWWWWkBkWk..",
        "..kkkkkkkkkkkk..",
        "..ssssssssssss..",
        "................",
    ],
    worker_body: [
        "................",
        "......hhhh......",
        ".....hhhhhh.....",
        ".....hSSSSh.....",
        ".....SeSSeS.....",
        ".....SSSSSS.....",
        "......SSSS......",
        "................",
        "...S........S...",
        "...S........S...",
        "................",
        "....nnnnnnnn....",
        "....nn....nn....",
        "....nn....nn....",
        "....kk....kk....",
        "................",
    ],
    worker_shirt: [
        "................",
        "................",
        "................",
        "................",
        "................",
        "................",
        "................",
        "....wwwwwwww....",
        "....wwwwwwww....",
        "....wvwwwwvw....",
        "....wwwwwwww....",
        "................",
        "................",
        "................",
        "................",
        "................",
    ],
    i_wood: [
        "........",
        "..bbbbb.",
        ".bBBBBTb",
        "bBBBBTtT",
        "bBBBBTtT",
        ".bBBBBTb",
        "..bbbbb.",
        "........",
    ],
    i_plank: [
        "........",
        "........",
        "kkkkkkkk",
        "PPPPPPPP",
        "pPPpPPPp",
        "qqqqqqqq",
        "kkkkkkkk",
        "........",
    ],
    i_stone: [
        "........",
        "..kkkk..",
        ".kLLlLk.",
        "kLlLLLLk",
        "kLLLLDLk",
        "kLLLDDLk",
        ".kkkkkk.",
        "........",
    ],
    i_ironOre: [
        "........",
        "..kkk...",
        ".kOoOk..",
        "kOOOoOk.",
        "kOoOOOOk",
        ".kOOoOk.",
        "..kkkk..",
        "........",
    ],
    i_ironPlate: [
        "........",
        "........",
        ".kkkkkk.",
        "kIIIIIIk",
        "kIiiiIIk",
        "kIIIIIIk",
        ".kkkkkk.",
        "........",
    ],
    i_gear: [
        "...kk...",
        ".k.mm.k.",
        ".kmmmmk.",
        "kmmkkmmk",
        "kmmkkmmk",
        ".kmmmmk.",
        ".k.mm.k.",
        "...kk...",
    ],
    i_berries: [
        "........",
        "...dd...",
        "..rRd...",
        ".rRRrRr.",
        ".RRrRRR.",
        ".rRRRRr.",
        "..rRRr..",
        "........",
    ],
    ui_arrow: [
        "........",
        "....z...",
        "....zz..",
        "zzzzzzz.",
        "zzzzzzz.",
        "....zz..",
        "....z...",
        "........",
    ],
    ui_axe: [
        "..kkk...",
        ".kmmmk..",
        "kmmmmkk.",
        "kmmkkBk.",
        ".kk.kBk.",
        "....kBk.",
        "....kBk.",
        ".....k..",
    ],
    ui_warn: [
        "...kk...",
        "..kYYk..",
        "..kYYk..",
        ".kYkkYk.",
        ".kYkkYk.",
        "kYYYYYYk",
        "kYYkkYYk",
        ".kkkkkk.",
    ],
};

// a light 2 pixel line on the sides of a water tile that touch land. mask: 1 north, 2 east, 4 south, 8 west
function shore(mask)
{
    const c = new Canvas(16, 16);
    const foam = [220, 240, 255, 110];
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++)
        if ((mask & 1 && y < 2) || (mask & 2 && x >= 14) || (mask & 4 && y >= 14) || (mask & 8 && x < 2))
            c.set(x, y, foam);
    return c.save(`shore_${mask}`);
}

async function main()
{
    fs.mkdirSync(OUT, { recursive: true });
    const jobs = [];

    // terrain, two variants each so the ground doesn't look like a grid
    const t = (name, base, opts) => { for (let v = 0; v < 2; v++) jobs.push(terrain(`t_${name}_${v}`, base, { ...opts, flowers: v == 1 ? opts.flowers : 0 })); };
    t("water", "#4a90d0", { noise: 6, waves: "#7ab8ea" });
    t("sand", "#e6d29a", { noise: 14, speck: ["#cdb880", "#f4e6b8"], speckCount: 10 });
    t("grass", "#7cb658", { noise: 10, speck: ["#6aa24a", "#90c86a"], speckCount: 14, blades: true, flowers: 2 });
    t("forest", "#5e9446", { noise: 10, speck: ["#4e8038", "#6ea456"], speckCount: 16, blades: true, flowers: 0 });
    t("dirt", "#a07a54", { noise: 14, speck: ["#8a6644", "#b48c64"], speckCount: 12 });
    t("stone", "#8e8c88", { noise: 12, speck: ["#7a7874", "#a6a4a0"], speckCount: 12 });

    for (let f = 0; f < 4; f++) jobs.push(belt(f));
    jobs.push(hq());
    for (let s = 0; s < 3; s++) jobs.push(farm(s));

    for (const [name, rows] of Object.entries(ASCII))
        jobs.push(new Canvas(rows[0].length, rows.length).ascii(rows).save(name));

    // shoreline foam over water, one tile per combination of land sides
    for (let mask = 1; mask < 16; mask++)
        jobs.push(shore(mask));

    await Promise.all(jobs);
    console.log(`Wrote ${jobs.length} sprites to ${OUT}`);
}

main().catch(e => { console.error(e); process.exit(1); });
