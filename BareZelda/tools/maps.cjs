// BUILDS THE LEVELS: THE OVERWORLD IS PAINTED WITH CODE, DUNGEONS ARE GRIDS OF ASCII ROOMS.
// FOR EACH MAP IT WRITES:
//   public/images/maps/<name>.webp   THE GROUND, ALL TILES BAKED INTO ONE IMAGE
//   public/data/levels/<name>.json   A BARE LEVEL: THE GROUND IMAGE, MERGED WALL COLLIDERS AND ALL ENTITIES
// RUN: npm run build:maps   (EDITS MADE TO THE LEVEL FILES IN THE LEVEL EDITOR ARE OVERWRITTEN BY THIS)

const fs = require('fs');
const path = require('path');
const { Pix, rng } = require('./pixel.cjs');
const { paintTile, SOLID, WATER, THEMES, T } = require('./tiles.cjs');

const ROOT = path.join(__dirname, '..');
const IMG_OUT = path.join(ROOT, 'public', 'images', 'maps');
const LEVEL_OUT = path.join(ROOT, 'public', 'data', 'levels');

class Grid
{
    constructor(w, h, fill)
    {
        this.w = w;
        this.h = h;
        this.rows = Array.from({ length: h }, () => Array(w).fill(fill));
        this.ground = null;
    }
    in(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
    at(x, y) { return this.in(x, y) ? this.rows[y][x] : null; }
    set(x, y, ch) { if (this.in(x, y)) this.rows[y][x] = ch; return this; }
    fill(x, y, w, h, ch) { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.set(xx, yy, ch); return this; }
    ellipse(cx, cy, rx, ry, ch, only = null)
    {
        for (let y = 0; y < this.h; y++)
            for (let x = 0; x < this.w; x++)
            {
                const dx = (x + .5 - cx) / rx, dy = (y + .5 - cy) / ry;
                if (dx * dx + dy * dy <= 1 && (!only || only.includes(this.at(x, y))))
                    this.set(x, y, ch);
            }
        return this;
    }
    // GROUND UNDER OBSTACLES, USED BY TILE PAINTERS
    region(x, y) { return this.ground ? this.ground[y][x] : '.'; }
    snapshotGround() { this.ground = this.rows.map(r => [...r]); }
    toString() { return this.rows.map(r => r.join('')).join('\n'); }
}

// ---------------------------------------------------------------------------------------------
// ENTITIES
// ---------------------------------------------------------------------------------------------

// POSITION OF AN ENTITY STANDING ON A TILE: BOTTOM CENTER, MATCHING THE PREFABS' PIVOT
function tilePos(tx, ty) { return { x: tx * T + T / 2, y: ty * T + T }; }

function makeEntity(level, tx, ty, def, theme)
{
    const ent = { extends: def.p, position: tilePos(tx, ty) };
    const id = `${level}:${tx},${ty}`;

    if (def.c)
    {
        ent.components = {};
        for (const [comp, values] of Object.entries(def.c))
        {
            const v = { ...values };
            if (v.id === true)
                v.id = id;
            ent.components[comp] = v;
        }
    }
    // DUNGEON DOORS AND WALLS TAKE THE DUNGEON'S COLOR
    if (def.tint && theme && THEMES[theme].tint)
        ent.color = THEMES[theme].tint;
    if (def.color)
        ent.color = def.color;

    return { layer: def.layer || 'objects', ent };
}

const E = {
    slime: (group) => ({ p: 'slime', c: group ? { enemy: { group } } : undefined }),
    bat: (group) => ({ p: 'bat', c: group ? { enemy: { group } } : undefined }),
    octo: (group) => ({ p: 'octo', c: group ? { enemy: { group } } : undefined }),
    skeleton: (group) => ({ p: 'skeleton', c: group ? { enemy: { group } } : undefined }),
    chest: (item, amount = 1) => ({ p: 'chest', c: { chest: { id: true, item, amount } } }),
    door: () => ({ p: 'lockedDoor', c: { door: { id: true } }, tint: true }),
    bossDoor: () => ({ p: 'bossDoor', c: { door: { id: true, boss: true } } }),
    gate: (group) => ({ p: 'gate', c: { gate: { id: true, group } }, tint: true }),
    crackedWall: () => ({ p: 'crackedWall', c: { breakable: { id: true } }, tint: true }),
    crackedRock: () => ({ p: 'crackedRock', c: { breakable: { id: true } } }),
    thorns: () => ({ p: 'thorns', c: { breakable: { id: true } } }),
    switch: (group) => ({ p: 'switch', c: { switch: { id: true, group } } }),
    eye: (group) => ({ p: 'eye', c: { switch: { id: true, group } } }),
    torch: (group) => ({ p: 'torch', c: { torch: { group } } }),
    pot: () => ({ p: 'pot' }),
    bush: () => ({ p: 'bush' }),
    sign: (text) => ({ p: 'sign', c: { npc: { who: 'sign', text } } }),
    npc: (prefab, extra = {}) => ({ p: prefab, c: { npc: { ...extra } } }),
    warp: (id, level, target, dir) => ({ p: 'warp', layer: 'floor', c: { warp: { id, level, target, dir } } }),
    boss: (prefab) => ({ p: prefab }),
    seal: () => ({ p: 'seal', c: { gate: { id: true, group: 'seal', requires: 4 } } }),
};

// ---------------------------------------------------------------------------------------------
// COLLIDERS: GREEDY MERGE OF SOLID TILES INTO AS FEW RECTANGLES AS POSSIBLE
// ---------------------------------------------------------------------------------------------

function mergeRects(grid, test)
{
    const used = grid.rows.map(r => r.map(() => false));
    const rects = [];
    for (let y = 0; y < grid.h; y++)
        for (let x = 0; x < grid.w; x++)
        {
            if (used[y][x] || !test(grid.at(x, y)))
                continue;
            let w = 1;
            while (x + w < grid.w && !used[y][x + w] && test(grid.at(x + w, y)))
                w++;
            let h = 1;
            grow: while (y + h < grid.h)
            {
                for (let xx = x; xx < x + w; xx++)
                    if (used[y + h][xx] || !test(grid.at(xx, y + h)))
                        break grow;
                h++;
            }
            for (let yy = y; yy < y + h; yy++)
                for (let xx = x; xx < x + w; xx++)
                    used[yy][xx] = true;
            rects.push({ x, y, w, h });
        }
    return rects;
}

async function writeMap(name, grid, theme, entities, customData)
{
    // GROUND IMAGE
    const img = new Pix(grid.w * T, grid.h * T);
    for (let y = 0; y < grid.h; y++)
        for (let x = 0; x < grid.w; x++)
            img.draw(paintTile(grid.at(x, y), theme, x, y, grid), x * T, y * T);
    await img.save(path.join(IMG_OUT, `${name}.webp`));

    const walls = mergeRects(grid, ch => SOLID.has(ch)).map(r => ({
        extends: 'wall', position: { x: r.x * T, y: r.y * T }, scale: { x: r.w * T, y: r.h * T },
    }));
    const water = mergeRects(grid, ch => WATER.has(ch)).map(r => ({
        extends: 'water', position: { x: r.x * T, y: r.y * T }, scale: { x: r.w * T, y: r.h * T },
    }));

    const byLayer = { ground: [{ extends: 'mapBg', imagePath: 'maps', texture: name }], walls: [...walls, ...water], floor: [], objects: [] };
    for (const e of entities)
        byLayer[e.layer].push(e.ent);

    // WALKABILITY FOR ENEMY AI: # SOLID, ~ WATER, . FREE
    const nav = grid.rows.map(r => r.map(ch => SOLID.has(ch) ? '#' : WATER.has(ch) ? '~' : '.').join(''));

    const level = {
        name,
        dimensions: { width: grid.w * T, height: grid.h * T },
        backgroundColor: theme == 'overworld' ? '#2f8a48' : '#0e0e16',
        customData: { ...customData, theme, nav },
        entitiesByLayer: byLayer,
    };
    fs.writeFileSync(path.join(LEVEL_OUT, `${name}.json`), JSON.stringify(level, null, 1));
    console.log(`${name}: ${grid.w}x${grid.h} tiles, ${walls.length} wall + ${water.length} water colliders, ${entities.length} entities`);
}

// ---------------------------------------------------------------------------------------------
// OVERWORLD
// ---------------------------------------------------------------------------------------------

function buildOverworld()
{
    const W = 64, H = 48;
    const g = new Grid(W, H, '.');
    const rand = rng(1234);
    const ents = [];
    const at = (x, y, def) => ents.push([x, y, def]);

    // REGION GROUNDS
    g.fill(0, 0, 18, 12, 'X');   // NORTH WEST: THE DARK CASTLE
    g.fill(48, 0, 16, 21, 'A');  // NORTH EAST: THE ASHEN LANDS
    g.snapshotGround();

    // BORDERS
    g.fill(0, 0, W, 2, 'T').fill(0, H - 2, W, 2, 'T').fill(0, 0, 2, H, 'T').fill(W - 2, 0, 2, H, 'T');
    g.fill(0, 0, 18, 1, 'Y').fill(0, 0, 1, 12, 'Y');
    g.fill(48, 0, 16, 2, 'M').fill(W - 2, 0, 2, 21, 'M');

    // ---- DARK CASTLE (NW) ----
    g.fill(2, 1, 15, 1, 'X');
    g.fill(4, 1, 11, 6, 'W');
    g.set(9, 6, 'C');
    g.fill(8, 7, 3, 2, 'S');
    for (const [x, y] of [[2, 3], [3, 8], [15, 3], [14, 9], [2, 10], [6, 10], [12, 10], [16, 6]])
        g.set(x, y, 'Y');
    g.fill(0, 12, 19, 1, 'T');
    g.fill(17, 0, 2, 13, 'T');
    g.set(9, 12, ':');
    g.fill(9, 9, 1, 3, ':');
    at(9, 6, E.warp('d5', 'd5', 'entrance', 'down'));
    at(9, 7, E.seal());
    at(9, 12, E.thorns());
    for (const [x, y] of [[4, 9], [13, 8], [6, 4]].filter(([x, y]) => g.at(x, y) == 'X'))
        at(x, y, E.skeleton());
    at(12, 9, E.bat()); at(5, 10, E.bat());

    // ---- WEST FOREST ----
    g.fill(18, 13, 2, 33, 'T');
    for (let y = 13; y < 46; y++)
        for (let x = 2; x < 18; x++)
            if (rand() < .42)
                g.set(x, y, 'T');
    const clear = (x, y, w, h, ch = '.') => g.fill(x, y, w, h, ch);
    clear(2, 32, 18, 1, ':');                 // PATH TO THE VILLAGE
    clear(2, 31, 16, 3);
    clear(9, 13, 1, 19, ':');                 // PATH NORTH TO THE CASTLE
    clear(8, 13, 3, 19);
    g.fill(9, 13, 1, 19, ':');
    clear(2, 17, 9, 3);                       // TEMPLE CLEARING
    g.fill(3, 14, 5, 3, 'M');
    g.set(5, 16, 'C');
    g.fill(5, 17, 5, 1, ':');
    g.fill(2, 13, 6, 1, 'T');
    clear(3, 37, 6, 6);                       // CAT CLEARING
    g.ellipse(5.5, 39.5, 3.5, 3, ',');
    g.fill(5, 33, 1, 5, ':');
    clear(12, 22, 5, 4);                      // HIDDEN CHEST CLEARING
    g.fill(10, 24, 3, 1, ':');
    at(5, 16, E.warp('d1', 'd1', 'entrance', 'down'));
    at(7, 18, E.sign('Forest Temple. Something stirs among the old stones.'));
    at(10, 14, E.sign('North: the Dark Castle. Thorns block the road, and only fire can clear them.'));
    at(14, 23, E.chest('rupees', 30));
    at(5, 40, E.npc('cat', { who: 'cat', hideIf: 'catFound' }));
    at(4, 25 + 2, E.slime());
    for (const [x, y] of [[12, 32], [15, 31], [9, 26], [8, 20], [4, 31]])
        at(x, y, E.slime());
    at(13, 24, E.bush()); at(15, 24, E.bush());

    // ---- LAKE (NORTH) ----
    g.fill(20, 0, 26, 2, 'M');
    g.ellipse(31.5, 10.5, 13, 8.5, '_', ['.']);
    g.ellipse(31.5, 10.5, 10.5, 6.5, '~');
    g.fill(28, 0, 7, 3, 'M');
    g.set(31, 2, 'C');
    g.fill(29, 3, 5, 1, '_');
    // A ROCK LINE SPLITS THE LAKE SHORE: THE NORTH HALF IS ONLY REACHED PAST THE CRACKED ROCKS
    for (let x = 19; x < 46; x++)
    {
        if (g.at(x, 10) == '~')
            continue;
        if (x >= 43)
            g.set(x, 10, '_');
        else
            g.set(x, 10, 'R');
    }
    for (const x of [43, 44, 45])
        at(x, 10, E.crackedRock());
    g.fill(43, 3, 3, 7, '_');
    g.fill(34, 3, 10, 1, '_');
    // PIER
    g.fill(31, 14, 1, 5, 'B');
    g.fill(31, 19, 1, 5, ':');
    at(31, 2, E.warp('d3', 'd3', 'entrance', 'down'));
    at(31, 14, E.npc('fisher', { who: 'fisher' }));
    at(33, 20, E.sign('Lake Serene. The shrine on the north shore is sealed behind cracked rocks.'));
    for (const [x, y] of [[23, 17], [40, 17], [24, 4], [38, 5]])
        at(x, y, E.octo());

    // ---- RIVER AND THE ASHEN LANDS (NORTH EAST) ----
    g.fill(46, 0, 2, 21, '~');
    g.fill(44, 21, 20, 3, 'M');
    g.fill(53, 1, 7, 4, 'M');
    g.set(56, 4, 'C');
    g.fill(56, 5, 1, 8, ':');
    g.fill(48, 12, 9, 1, ':');
    g.ellipse(51, 7, 2.5, 2, 'L');
    g.ellipse(60.5, 9.5, 2, 2.5, 'L');
    g.ellipse(52.5, 17, 3, 2, 'L');
    g.ellipse(59.5, 16.5, 2.5, 2, 'L');
    for (const [x, y] of [[49, 3], [58, 7], [55, 15], [62, 13], [50, 10]])
        if (g.at(x, y) == 'A') g.set(x, y, 'R');
    at(56, 4, E.warp('d4', 'd4', 'entrance', 'down'));
    at(54, 13, E.sign('Ember Fortress. Few who swim the river come back.'));
    for (const [x, y] of [[50, 14], [61, 5], [57, 19]])
        at(x, y, E.bat());
    at(54, 9, E.skeleton()); at(60, 18, E.skeleton());

    // ---- VILLAGE ----
    const house = (x, y) => {
        g.fill(x, y, 5, 2, '^').fill(x, y + 2, 5, 2, 'H').set(x + 2, y + 3, 'D');
    };
    house(22, 25); house(22, 34); house(36, 25); house(36, 35);
    g.fill(28, 29, 7, 6, 'S');
    g.set(31, 31, 'G');
    g.fill(20, 32, 8, 1, ':');
    g.fill(35, 32, 11, 1, ':');
    g.fill(31, 19, 1, 10, ':');
    g.fill(31, 35, 1, 10, ':');
    g.fill(24, 29, 1, 3, ':');
    g.fill(24, 33, 1, 1, ':');
    g.fill(38, 29, 1, 3, ':');
    g.fill(24, 38, 1, 1, ':');
    g.fill(38, 39, 1, 1, ':');
    for (let i = 0; i < 70; i++)
    {
        const x = 20 + Math.floor(rand() * 25), y = 24 + Math.floor(rand() * 22);
        if (g.at(x, y) == '.') g.set(x, y, ',');
    }
    g.fill(20, 44, 25, 1, 'F');
    g.set(31, 44, ':');
    at(26, 30, E.npc('elder', { who: 'elder' }));
    at(27, 39, E.npc('mina', { who: 'mina' }));
    at(28, 39, E.npc('cat', { who: 'catHome', showIf: 'catFound' }));
    at(40, 30, E.npc('merchant', { who: 'merchant' }));
    at(34, 37, E.npc('kid', { who: 'kid' }));
    at(29, 28, E.sign('Elmore Village. Talk to people with SPACE. ENTER opens your bag.'));
    for (const [x, y] of [[21, 29], [21, 30], [27, 26], [27, 27], [35, 26], [35, 27], [41, 29], [21, 38], [27, 35], [41, 38], [42, 38], [35, 40]])
        at(x, y, E.bush());
    for (const [x, y] of [[26, 29], [40, 29]])
        at(x, y, E.pot());

    // ---- SOUTH FIELDS ----
    for (let y = 45; y < 46; y++) g.fill(20, y, 25, 1, ',');
    at(30, 41, E.npc('guard', { who: 'guard' }));
    for (const [x, y] of [[23, 42], [27, 44 - 1], [36, 42], [41, 41], [25, 40]])
        at(x, y, E.slime());
    g.fill(20, 44, 25, 1, 'F');
    g.set(31, 44, ':');
    for (const [x, y] of [[22, 45], [26, 45], [35, 45], [40, 45]])
        at(x, y, E.slime());

    // ---- EAST HILLS ----
    g.fill(46, 24, 1, 22, 'M');
    g.set(46, 32, ':');
    g.set(46, 30, ':');
    at(46, 30, E.eye('eastGate'));
    at(46, 32, E.gate('eastGate'));
    at(44, 31, E.sign('The stone eye guards this gate. It only opens to one with a keen aim.'));
    g.fill(53, 25, 8, 4, 'M');
    g.set(56, 28, 'C');
    g.fill(47, 32, 10, 1, ':');
    g.fill(56, 29, 1, 3, ':');
    for (let i = 0; i < 26; i++)
    {
        const x = 47 + Math.floor(rand() * 15), y = 24 + Math.floor(rand() * 22);
        if (g.at(x, y) == '.' && !(y == 32 || x == 56) && !(x >= 58 && y >= 39))
            g.set(x, y, 'R');
    }
    // HIDDEN HEART CONTAINER BEHIND A CRACKED ROCK
    g.fill(58, 40, 4, 1, 'R').fill(58, 40, 1, 6, 'R');
    g.fill(59, 41, 3, 5, '.');
    g.set(58, 42, '.');
    at(58, 42, E.crackedRock());
    at(60, 43, E.chest('heartContainer'));
    at(56, 28, E.warp('d2', 'd2', 'entrance', 'down'));
    for (const [x, y] of [[50, 27], [52, 36], [60, 34], [49, 41]])
        at(x, y, E.octo());
    at(55, 38, E.bat()); at(51, 44, E.slime());

    const start = { x: 25, y: 31 };
    return { g, ents, start };
}

// ---------------------------------------------------------------------------------------------
// DUNGEONS: A GRID OF 11x9 ROOMS. WALLS ARE SHARED, DOORWAYS SIT IN THE MIDDLE OF A WALL
// ---------------------------------------------------------------------------------------------

const RW = 11, RH = 9;

const ROOM_MARKERS = {
    s: E.slime, b: E.bat, o: E.octo, k: E.skeleton, p: E.pot,
};

function buildDungeon(d)
{
    const W = d.cols * (RW + 1) + 1, H = d.rows * (RH + 1) + 1;
    const g = new Grid(W, H, ' ');
    const ents = [];

    const origin = (cx, cy) => [cx * (RW + 1) + 1, cy * (RH + 1) + 1];

    for (const [key, rows] of Object.entries(d.rooms))
    {
        const [cx, cy] = key.split(',').map(Number);
        const [x0, y0] = origin(cx, cy);
        g.fill(x0 - 1, y0 - 1, RW + 2, RH + 2, '#');
        if (rows.length != RH)
            throw new Error(`${d.name} room ${key} has ${rows.length} rows`);
        rows.forEach((row, ry) => {
            if (row.length != RW)
                throw new Error(`${d.name} room ${key} row ${ry} is ${row.length} wide: "${row}"`);
            for (let rx = 0; rx < RW; rx++)
            {
                const ch = row[rx];
                const x = x0 + rx, y = y0 + ry;
                const def = d.ents[ch] ?? (ROOM_MARKERS[ch] && ROOM_MARKERS[ch]());
                if (def)
                {
                    g.set(x, y, def.floor || '.');
                    ents.push([x, y, def]);
                }
                else
                    g.set(x, y, ch);
            }
        });
    }

    // DOORWAYS
    for (const [a, b, kind] of d.links)
    {
        const [ax, ay] = a.split(',').map(Number);
        const [bx, by] = b.split(',').map(Number);
        let x, y;
        if (ay == by)
        {
            const [x0, y0] = origin(Math.max(ax, bx), ay);
            x = x0 - 1; y = y0 + Math.floor(RH / 2);
        }
        else
        {
            const [x0, y0] = origin(ax, Math.max(ay, by));
            x = x0 + Math.floor(RW / 2); y = y0 - 1;
        }
        g.set(x, y, '.');
        if (kind == 'locked') ents.push([x, y, E.door()]);
        else if (kind == 'boss') ents.push([x, y, E.bossDoor()]);
        else if (kind == 'crack') ents.push([x, y, E.crackedWall()]);
        else if (kind.startsWith('gate:')) ents.push([x, y, E.gate(kind.slice(5))]);
        else if (kind != 'open') throw new Error(`Unknown link ${kind}`);
    }

    // ENTRANCE STAIRS IN THE BOTTOM WALL OF THE ENTRANCE ROOM
    const [ex, ey] = d.entrance.split(',').map(Number);
    const [x0, y0] = origin(ex, ey);
    const sx = x0 + Math.floor(RW / 2), sy = y0 + RH;
    g.set(sx, sy, '=');
    ents.push([sx, sy, E.warp('entrance', 'overworld', d.name, 'up')]);

    return { g, ents };
}

const DUNGEONS = [
    {
        name: 'd1', title: 'Forest Temple', theme: 'forest', sigil: '#7cf08a', boss: 'kingSlime',
        cols: 3, rows: 3, entrance: '1,2',
        ents: {
            '1': E.chest('key'), '2': E.chest('rupees', 50), '3': E.chest('bow'), '4': E.chest('bossKey'),
            'a': E.slime('a'), 'e': E.eye('b'), 'B': E.boss('kingSlime'),
        },
        links: [['1,2', '0,2', 'open'], ['1,2', '2,2', 'open'], ['1,2', '1,1', 'locked'], ['2,2', '2,1', 'gate:a'],
            ['1,1', '0,1', 'open'], ['0,1', '0,0', 'gate:b'], ['1,1', '1,0', 'boss']],
        rooms: {
            '1,2': ['...........', '.O.......O.', '...........', '....s......', '...........', '......s....', '...........', '.O.......O.', '...........'],
            '0,2': ['p.........p', '...........', '...b.......', '...........', '.....1.....', '...........', '.......b...', '...........', 'p.........p'],
            '2,2': ['...........', '..a.....a..', '...........', '.....O.....', '...a...a...', '.....O.....', '...........', '..a.....a..', '...........'],
            '2,1': ['...........', '.~~~...~~~.', '.~~~...~~~.', '....b.b....', '.....2.....', '...........', '.~~~...~~~.', '.~~~...~~~.', '...........'],
            '1,1': ['...........', '.O..O.O..O.', '...........', '..s.....s..', '...........', '...........', '....k......', '.O..O.O..O.', 'p.........p'],
            '0,1': ['...e.......', '...........', '..k......k.', '...........', '.....3.....', '...........', '..+++++++..', '...........', '...........'],
            '0,0': ['...........', '.O.......O.', '..k......k.', '...........', '.....4.....', '...........', '...........', '.O.......O.', '...........'],
            '1,0': ['...........', '.O.......O.', '...........', '...........', '.....B.....', '...........', '...........', '.O.......O.', '...........'],
        },
    },
    {
        name: 'd2', title: 'Stone Cavern', theme: 'cave', sigil: '#e0b070', boss: 'golem',
        cols: 3, rows: 3, entrance: '1,2',
        ents: {
            '1': E.chest('key'), '2': E.chest('key'), '3': E.chest('bombs'), '4': E.chest('bossKey'), '5': E.chest('rupees', 100),
            'w': E.switch('a'), 'B': E.boss('golem'),
        },
        links: [['1,2', '0,2', 'open'], ['1,2', '1,1', 'open'], ['1,2', '2,2', 'crack'], ['1,1', '0,1', 'locked'],
            ['0,1', '0,0', 'crack'], ['1,1', '2,1', 'locked'], ['2,1', '2,0', 'gate:a'], ['1,1', '1,0', 'boss']],
        rooms: {
            '1,2': ['...........', '..O.....O..', '...........', '...o...o...', '...........', '...........', '..O.....O..', '...........', '...........'],
            '0,2': ['...........', '.#.#...#.#.', '...........', '..k.....k..', '.....1.....', '...........', '.#.#...#.#.', '...........', 'p.........p'],
            '2,2': ['p.........p', '...........', '...b...b...', '...........', '.....5.....', '...........', '...........', '...........', 'p.........p'],
            '1,1': ['...........', '.O..O.O..O.', '...........', '..o.....o..', '...........', '....b......', '...........', '.O..O.O..O.', '...........'],
            '0,1': ['...........', '...........', '..k.....k..', '...........', '.....3.....', '...........', '...#####...', '...........', '...........'],
            '0,0': ['...........', '..b.....b..', '...........', '...........', '.....2.....', '...........', '...........', '.p.......p.', '...........'],
            '2,1': ['...........', '...........', '..k........', '...........', '........w..', '...........', '...k.......', '...........', '...........'],
            '2,0': ['...........', '.O.......O.', '...........', '...........', '.....4.....', '...........', '...........', '.O.......O.', '...........'],
            '1,0': ['p.........p', '...........', '...........', '...........', '.....B.....', '...........', '...........', '...........', 'p.........p'],
        },
    },
    {
        name: 'd3', title: 'Lake Shrine', theme: 'lake', sigil: '#70c8ff', boss: 'serpent',
        cols: 3, rows: 3, entrance: '1,2',
        ents: {
            '1': E.chest('key'), '3': E.chest('flippers'), '4': E.chest('bossKey'), '6': E.chest('ring'),
            'e': E.eye('a'), 'B': { ...E.boss('serpent'), floor: '~' },
        },
        links: [['1,2', '0,2', 'open'], ['1,2', '2,2', 'open'], ['1,2', '1,1', 'open'], ['2,2', '2,1', 'gate:a'],
            ['1,1', '0,1', 'locked'], ['0,1', '0,0', 'open'], ['1,1', '1,0', 'boss']],
        rooms: {
            '1,2': ['...........', '.~~.....~~.', '.~~.....~~.', '...........', '....o.o....', '...........', '.~~.....~~.', '.~~.....~~.', '...........'],
            '0,2': ['...........', '..o.....o..', '...........', '~~~~.....~.', '~~~~.1...~.', '~~~~.....~.', '...........', '...........', '...........'],
            '2,2': ['..e........', '...........', '...b...b...', '...........', '...........', '...~~~~~...', '...~~~~~...', '...........', '...........'],
            '2,1': ['...........', '...........', '..k.....k..', '...........', '.....3.....', '...........', '...........', '...........', '...........'],
            '1,1': ['...........', '...........', '..~~~~~~~..', '..~~~~~~~..', '..~~~~~~~..', '..~~~~~~~..', '...........', '..o.....o..', '...........'],
            '0,1': ['......~~...', '......~~...', '..k...~~...', '......~~...', '......~~...', '......~~...', '..k...~~...', '......~~...', '......~~...'],
            '0,0': ['...........', '.O.......O.', '...........', '...4...6...', '...........', '...........', '...b...b...', '.O.......O.', '...........'],
            '1,0': ['...........', '...........', '..~~~~~~~..', '..~~~~~~~..', '..~~~B~~~..', '..~~~~~~~..', '..~~~~~~~..', '...........', '...........'],
        },
    },
    {
        name: 'd4', title: 'Ember Fortress', theme: 'fire', sigil: '#ff7050', boss: 'flameKnight',
        cols: 3, rows: 3, entrance: '1,2',
        ents: {
            '1': E.chest('key'), '2': E.chest('key'), '3': E.chest('fireRod'), '4': E.chest('bossKey'),
            't': E.torch('a'), 'B': E.boss('flameKnight'),
        },
        links: [['1,2', '1,1', 'open'], ['1,2', '0,2', 'crack'], ['1,2', '2,2', 'open'], ['1,1', '0,1', 'locked'],
            ['1,1', '2,1', 'locked'], ['2,1', '2,0', 'gate:a'], ['1,1', '1,0', 'boss']],
        rooms: {
            '1,2': ['...........', '.LL.....LL.', '...........', '...k...k...', '...........', '...........', '.LL.....LL.', '...........', '...........'],
            '2,2': ['...........', '..b.....b..', '...........', '.LL.....LLL', '.LL..1..LLL', '.LL.....LLL', '...........', '...k...k...', '...........'],
            '0,2': ['p.........p', '...........', '..o.....o..', '...........', '.....2.....', '...........', '...........', '...........', 'p.........p'],
            '1,1': ['...........', '.LLL...LLL.', '.L.......L.', '...........', '....k......', '...........', '.L.......L.', '.LLL...LLL.', '...........'],
            '0,1': ['...........', '..k.....k..', '...........', '..LL...LL..', '..LL.3.LL..', '..LL...LL..', '...........', '..b.....b..', '...........'],
            '2,1': ['...........', '.t.......t.', '...........', '...k.......', '...........', '...........', '...........', '.....t.....', '...........'],
            '2,0': ['...........', '.LL.....LL.', '...........', '..b.....b..', '.....4.....', '...........', '...........', '.LL.....LL.', '...........'],
            '1,0': ['...........', '.LL.....LL.', '...........', '...........', '.....B.....', '...........', '...........', '.LL.....LL.', '...........'],
        },
    },
    {
        name: 'd5', title: 'Dark Castle', theme: 'dark', sigil: '#c080ff', boss: 'darkLord',
        cols: 3, rows: 3, entrance: '1,2',
        ents: {
            '1': E.chest('key'), '4': E.chest('bossKey'), '5': E.chest('rupees', 100),
            't': E.torch('a'), 'e': E.eye('b'), 'w': E.switch('c'), 'B': E.boss('darkLord'),
        },
        links: [['1,2', '1,1', 'gate:a'], ['1,2', '0,2', 'crack'], ['1,2', '2,2', 'open'], ['2,2', '2,1', 'gate:b'],
            ['1,1', '0,1', 'locked'], ['0,1', '0,0', 'gate:c'], ['2,1', '1,1', 'open'], ['1,1', '1,0', 'boss']],
        rooms: {
            '1,2': ['...........', '...........', '...t...t...', '...........', '..k.....k..', '...........', '...........', '.O.......O.', '...........'],
            '0,2': ['...........', '..b.....b..', '...........', '...........', '.....1.....', '...........', '...k.......', '...........', 'p.........p'],
            '2,2': ['.......e...', '...........', '..b........', '~~~~~~~~~~~', '~~~~~~~~~~~', '~~~~~~~~~~~', '...........', '..o.....o..', '...........'],
            '2,1': ['...........', '..k.....k..', '...........', '...........', '.....5.....', '...........', '...........', '...b.......', '...........'],
            '1,1': ['...........', '.O..O.O..O.', '...........', '..k.....k..', '...........', '....b......', '...........', '.O..O.O..O.', '...........'],
            '0,1': ['...........', '..o.....o..', '...........', '...........', '.......w...', '...........', '..k........', '...........', '...........'],
            '0,0': ['...........', '.O.......O.', '...b...b...', '...........', '.....4.....', '...........', '...........', '.O.......O.', '...........'],
            '1,0': ['...........', '.O...+...O.', '.....+.....', '.....+.....', '.....B.....', '.....+.....', '.....+.....', '.O...+...O.', '.....+.....'],
        },
    },
];

async function main()
{
    fs.mkdirSync(IMG_OUT, { recursive: true });
    fs.mkdirSync(LEVEL_OUT, { recursive: true });

    const ow = buildOverworld();
    const owEnts = ow.ents.map(([x, y, def]) => makeEntity('overworld', x, y, def, null));
    await writeMap('overworld', ow.g, 'overworld', owEnts, { title: 'Elmore', music: 'overworld', start: ow.start });
    if (process.argv.includes('--print'))
        console.log(ow.g.toString());

    for (const d of DUNGEONS)
    {
        const { g, ents } = buildDungeon(d);
        const list = ents.map(([x, y, def]) => makeEntity(d.name, x, y, def, d.theme));
        await writeMap(d.name, g, d.theme, list, { title: d.title, music: 'dungeon', dungeon: d.name, sigil: d.sigil });
        if (process.argv.includes('--print'))
            console.log(g.toString());
    }
}

main().catch(e => { console.error(e); process.exit(1); });
