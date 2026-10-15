// Builds every room into public/data/levels/<id>.json and the world layout into public/data/world.json.
// Run: node scripts/buildWorld.cjs
//
// The world is a grid of cells. A cell is one screen: 20 x 12 tiles of 16px. Each room covers
// one or more cells, so a room's position on the map is also its position in the world, and
// walking off one room's edge lands you in whichever room holds that spot.
//
// Rooms are generated: outer walls, a floor per cell, door openings for the connections below,
// the gate for that connection (spikes, high ledge, wall-jump shaft, cracked blocks), and then
// random platforms, spikes, enemies and decoration that stay clear of doors and gates.
// Levels can still be edited in the level editor afterwards, but running this again overwrites them.

const fs = require("fs");
const path = require("path");

const TILE = 16, CW = 20, CH = 12;
const LEVEL_DIR = path.join(__dirname, "..", "public", "data", "levels");
const WORLD_FILE = path.join(__dirname, "..", "public", "data", "world.json");

const AREAS = {
    halls:   { name: "Castle Halls",      wall: "#d8dcea", back: "#2b3047", bg: "#161a2a", map: "#7f8bb3", enemies: ["rat", "bat", "guard"] },
    crypt:   { name: "The Crypt",         wall: "#d9b49c", back: "#3a272c", bg: "#1c1215", map: "#a8735f", enemies: ["rat", "spider", "ghost"] },
    ruins:   { name: "Sunken Ruins",      wall: "#f2cf96", back: "#45362a", bg: "#211a12", map: "#c9a25a", enemies: ["crab", "slime", "bat"] },
    tower:   { name: "Storm Tower",       wall: "#b4cbff", back: "#232c4a", bg: "#0f1428", map: "#6d8fd8", enemies: ["bat", "guard", "ghost"] },
    depths:  { name: "The Depths",        wall: "#a6e6b8", back: "#1b3329", bg: "#0b1712", map: "#5aa978", enemies: ["spider", "slime", "ghost"] },
    sanctum: { name: "Crimson Sanctum",   wall: "#eba0ad", back: "#3a1c27", bg: "#1a0b10", map: "#c25a6e", enemies: ["guard", "ghost", "bat"] },
};

// id, name, area, x, y, w, h (cells), extras
const ROOMS = [
    // CASTLE HALLS - THE START
    ["h01", "Gatehouse",        "halls", 6, 4, 1, 1, { shrine: true, start: true }],
    ["h02", "Great Hall",       "halls", 7, 4, 2, 1],
    ["h03", "East Gallery",     "halls", 9, 4, 1, 1],
    ["h04", "West Wing",        "halls", 4, 4, 2, 1],
    ["h05", "Servants' Rooms",  "halls", 5, 5, 1, 1],
    ["h06", "Cellar Stair",     "halls", 6, 5, 1, 1],
    ["h07", "Wine Cellar",      "halls", 7, 5, 2, 1],
    ["h08", "Chapel",           "halls", 9, 5, 1, 1, { item: "vial" }],
    ["h09", "Courtyard",        "halls", 7, 3, 1, 1],
    ["h10", "Library",          "halls", 3, 4, 1, 1],
    // STORM TOWER - NEEDS DOUBLE JUMP
    ["t01", "Tower Foyer",      "tower", 8, 3, 1, 1],
    ["t02", "Spiral Stair",     "tower", 8, 1, 1, 2],
    ["t03", "Guard Room",       "tower", 7, 2, 1, 1],
    ["t04", "Armory",           "tower", 6, 2, 1, 1, { item: "wall" }],
    ["t05", "Clockwork",        "tower", 9, 2, 1, 1],
    ["t06", "Upper Landing",    "tower", 7, 1, 1, 1],
    ["t07", "Wind Shaft",       "tower", 6, 1, 1, 1],
    ["t08", "Gale Top",         "tower", 6, 0, 1, 1],
    ["t09", "Belfry",           "tower", 7, 0, 2, 1, { item: "hammer" }],
    ["t10", "Tower Shrine",     "tower", 9, 1, 1, 1, { shrine: true }],
    ["t11", "Battlement",       "tower", 9, 0, 1, 1, { item: "vial" }],
    // SUNKEN RUINS - NEEDS DASH
    ["r01", "Collapsed Bridge", "ruins", 10, 4, 2, 1],
    ["r02", "Sand Hall",        "ruins", 12, 4, 1, 1],
    ["r03", "Ruins Shrine",     "ruins", 12, 3, 1, 1, { shrine: true }],
    ["r04", "Sunken Temple",    "ruins", 13, 4, 1, 2],
    ["r05", "Dune Corridor",    "ruins", 10, 5, 2, 1],
    ["r06", "Pillar Garden",    "ruins", 12, 5, 1, 1],
    ["r07", "Scorpion Den",     "ruins", 14, 5, 1, 1],
    ["r08", "Altar of Sky",     "ruins", 14, 4, 1, 1, { item: "double" }],
    ["r09", "Quicksand Pit",    "ruins", 11, 6, 2, 1],
    ["r10", "Buried Vault",     "ruins", 13, 6, 1, 1, { item: "vial" }],
    ["r11", "Overlook",         "ruins", 13, 3, 2, 1, { item: "vial" }],
    // THE CRYPT - BELOW THE HALLS
    ["c01", "Crypt Stairs",     "crypt", 8, 6, 1, 1],
    ["c02", "Ossuary",          "crypt", 6, 6, 2, 1],
    ["c03", "Crypt Shrine",     "crypt", 5, 6, 1, 1, { shrine: true }],
    ["c04", "Bone Pit",         "crypt", 4, 6, 1, 2],
    ["c05", "Rat Warren",       "crypt", 9, 6, 1, 2],
    ["c06", "Catacomb Hall",    "crypt", 5, 7, 3, 1],
    ["c07", "Dash Altar",       "crypt", 4, 8, 1, 1, { item: "dash" }],
    ["c08", "Drowned Tombs",    "crypt", 5, 8, 2, 1],
    ["c09", "Spider Nest",      "crypt", 8, 7, 1, 1],
    ["c10", "Sealed Crypt",     "crypt", 7, 8, 2, 1],
    ["c11", "Forgotten Tomb",   "crypt", 9, 8, 1, 1],
    // THE DEPTHS - BEHIND A CRACKED FLOOR
    ["d01", "Abyss Entry",      "depths", 8, 9, 1, 1],
    ["d02", "Root Cavern",      "depths", 6, 9, 2, 1],
    ["d03", "Glowing Grotto",   "depths", 9, 9, 1, 2, { item: "vial" }],
    ["d04", "Abyss Floor",      "depths", 6, 10, 3, 1, { item: "vial" }],
    // CRIMSON SANCTUM - BEHIND A CRACKED WALL, THE BOSS
    ["s01", "Broken Gate",      "sanctum", 2, 4, 1, 1],
    ["s02", "Sanctum Shrine",   "sanctum", 1, 4, 1, 1, { shrine: true }],
    ["s03", "Hall of Kings",    "sanctum", 0, 3, 2, 1],
    ["s04", "Throne Approach",  "sanctum", 0, 4, 1, 2],
    ["s05", "Throne Room",      "sanctum", 1, 5, 2, 1, { boss: true }],
];

// [roomA, roomB, gate, roomWithObstacle]. The shared edge is found automatically.
// Gates: D = dash over a spike strip, J = double jump (high door or high ledge),
// W = wall jump up a shaft, H = hammer through cracked blocks.
const CONNECTIONS = [
    ["h01", "h02"], ["h01", "h04"], ["h02", "h03"], ["h01", "h06"], ["h06", "h07"],
    ["h07", "h08", "H", "h07"], ["h04", "h05"], ["h05", "h06"], ["h04", "h10"],
    ["h02", "h09", "J"], ["h03", "r01", "D", "r01"], ["h10", "s01", "H", "h10"], ["h07", "c01"],

    ["h09", "t01"], ["t01", "t02"], ["t02", "t03"], ["t03", "t04"], ["t02", "t05"], ["t02", "t06"],
    ["t06", "t07"], ["t07", "t08", "W"], ["t08", "t09"], ["t02", "t10"], ["t09", "t11"], ["t11", "t10"],

    ["r01", "r02"], ["r02", "r03"], ["r02", "r04"], ["r01", "r05"], ["r05", "r06"], ["r06", "r04"],
    ["r04", "r07"], ["r04", "r08", "J"], ["r07", "r08"], ["r05", "r09"], ["r09", "r10", "H", "r10"], ["r03", "r11", "J"],

    ["c01", "c02"], ["c02", "c03"], ["c03", "c04"], ["c01", "c05"], ["c02", "c06"], ["c04", "c06"],
    ["c06", "c09"], ["c09", "c05"], ["c04", "c07"], ["c07", "c08"], ["c08", "c10"], ["c10", "c11"],
    ["c05", "c11", "W"], ["c10", "d01", "H", "c10"],

    ["d01", "d02"], ["d01", "d03"], ["d02", "d04"], ["d04", "d03"],

    ["s01", "s02"], ["s02", "s03"], ["s03", "s04"], ["s04", "s05"],
];

// ---------------------------------------------------------------------------------------------

const rooms = ROOMS.map(([id, name, area, x, y, w, h, extra = {}]) => ({ id, name, area, x, y, w, h, ...extra }));
const byId = Object.fromEntries(rooms.map(r => [r.id, r]));

function RoomAtCell(cx, cy)
{
    return rooms.find(r => cx >= r.x && cx < r.x + r.w && cy >= r.y && cy < r.y + r.h);
}

// CHECK ROOMS DON'T OVERLAP
for (const r of rooms)
    for (let cx = r.x; cx < r.x + r.w; cx++)
        for (let cy = r.y; cy < r.y + r.h; cy++)
            if (RoomAtCell(cx, cy) !== r)
                throw new Error(`Room ${r.id} overlaps ${RoomAtCell(cx, cy).id} at ${cx},${cy}`);

// RESOLVE EACH CONNECTION TO A SHARED CELL EDGE: { a, b, ax, ay (cell of a), dir: "left"|"right"|"up"|"down" (from a) }.
// WHEN ROOMS SHARE SEVERAL CELL EDGES, PICK THE CELL WITH THE FEWEST OTHER DOORS, AND NEVER A CELL HOLDING A GATE.
// GATED CONNECTIONS ARE PLACED FIRST SO THE OTHERS AVOID THEM
const cellLoad = new Map();
const LoadKey = (cx, cy) => cx + "," + cy;
const order = CONNECTIONS.map((c, i) => i).sort((i, j) => (CONNECTIONS[j][2] ? 1 : 0) - (CONNECTIONS[i][2] ? 1 : 0));
const links = [];
for (const index of order)
{
    const [aId, bId, gate = "", obstacleRoom = ""] = CONNECTIONS[index];
    const a = byId[aId], b = byId[bId];
    if (!a || !b) throw new Error(`Unknown room in connection ${aId}-${bId}`);

    const dirs = { right: [1, 0], left: [-1, 0], down: [0, 1], up: [0, -1] };
    let best = null, bestLoad = Infinity;
    for (let cx = a.x; cx < a.x + a.w; cx++)
        for (let cy = a.y; cy < a.y + a.h; cy++)
            for (const [dir, [dx, dy]] of Object.entries(dirs))
                if (RoomAtCell(cx + dx, cy + dy) === b)
                {
                    const load = (cellLoad.get(LoadKey(cx, cy)) || 0) + (cellLoad.get(LoadKey(cx + dx, cy + dy)) || 0);
                    if (load < bestLoad) { bestLoad = load; best = { a: aId, b: bId, ax: cx, ay: cy, bx: cx + dx, by: cy + dy, dir, gate, obstacleRoom }; }
                }

    if (!best) throw new Error(`Rooms ${aId} and ${bId} don't touch`);
    if (gate && bestLoad >= 100) throw new Error(`Gate ${aId}-${bId} has to share a cell with another gate`);

    const weight = gate ? 100 : 1;
    for (const key of [LoadKey(best.ax, best.ay), LoadKey(best.bx, best.by)])
        cellLoad.set(key, (cellLoad.get(key) || 0) + weight);
    links[index] = best;
}

const OPPOSITE = { left: "right", right: "left", up: "down", down: "up" };

// THE CONNECTIONS SEEN FROM ONE ROOM: { cx, cy (local cell), dir, gate, obstacleHere }
function DoorsOf(room)
{
    const doors = [];
    for (const l of links)
    {
        if (l.a === room.id)
            doors.push({ cx: l.ax - room.x, cy: l.ay - room.y, dir: l.dir, gate: l.gate, obstacleHere: l.obstacleRoom === room.id, other: l.b });
        if (l.b === room.id)
            doors.push({ cx: l.bx - room.x, cy: l.by - room.y, dir: OPPOSITE[l.dir], gate: l.gate, obstacleHere: l.obstacleRoom === room.id, other: l.a });
    }
    return doors;
}

function Rng(seedStr)
{
    let h = 1779033703;
    for (const c of seedStr) h = Math.imul(h ^ c.charCodeAt(0), 3432918353), h = (h << 13) | (h >>> 19);
    let a = h >>> 0;
    const next = () => {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    return {
        next,
        int: (min, max) => min + Math.floor(next() * (max - min + 1)),
        pick: (list) => list[Math.floor(next() * list.length)],
        chance: (p) => next() < p,
    };
}

// ---------------------------------------------------------------------------------------------

function BuildRoom(room)
{
    const W = room.w * CW, H = room.h * CH;
    const area = AREAS[room.area];
    const rng = Rng(room.id);

    // '.' EMPTY, '#' SOLID, '=' ONE-WAY PLANK, '^' SPIKES, 'X' CRACKED
    const grid = Array.from({ length: H }, () => Array(W).fill("."));
    // CELLS (LOCAL) THAT HOLD A GATE OR CLIMB, SO RANDOM STUFF STAYS OUT OF THEM
    const busy = Array.from({ length: room.h }, () => Array(room.w).fill(false));
    // COLUMNS PER CELL THAT MUST STAY CLEAR (VERTICAL CONNECTIONS)
    const clearCols = Array.from({ length: room.h }, () => Array.from({ length: room.w }, () => new Set()));

    const set = (x, y, ch) => { if (x >= 0 && x < W && y >= 0 && y < H) grid[y][x] = ch; };
    const get = (x, y) => (x >= 0 && x < W && y >= 0 && y < H) ? grid[y][x] : "#";

    // OUTER WALLS, CEILING AND A FLOOR FOR EVERY CELL
    for (let y = 0; y < H; y++) { set(0, y, "#"); set(W - 1, y, "#"); }
    for (let x = 0; x < W; x++) set(x, 0, "#");
    for (let cy = 0; cy < room.h; cy++)
        for (let x = 0; x < W; x++)
            set(x, cy * CH + CH - 1, "#");

    // A CLIMB FROM CELL (cx, cy) UP THROUGH ITS CEILING. kind: "steps" | "J" | "W"
    const stepCells = new Set();
    const AddClimb = (cx, cy, kind) => {
        const ox = cx * CW, oy = cy * CH;
        busy[cy][cx] = true;
        if (kind === "steps") stepCells.add(cx + "," + cy);
        for (let c = 5; c <= 14; c++) clearCols[cy][cx].add(c);

        if (kind === "steps")
        {
            for (let x = 4; x <= 7; x++) set(ox + x, oy + 8, "=");
            for (let x = 12; x <= 15; x++) set(ox + x, oy + 5, "=");
            for (let x = 5; x <= 7; x++) set(ox + x, oy + 2, "=");
        }
        else if (kind === "J")
        {
            for (let x = 8; x <= 11; x++) set(ox + x, oy + 5, "=");
        }
        else if (kind === "W")
        {
            for (let y = 1; y <= 8; y++) { set(ox + 7, oy + y, "#"); set(ox + 12, oy + y, "#"); }
        }
    };

    // HOLE IN A FLOOR ROW, WITH ONE-WAY FLANKS SO YOU CAN JUMP UP ONTO IT FROM BELOW
    const AddHole = (cx, floorRow, cracked) => {
        const ox = cx * CW;
        for (let x = 8; x <= 11; x++) set(ox + x, floorRow, cracked ? "X" : ".");
        if (!cracked)
            for (const x of [5, 6, 7, 12, 13, 14]) set(ox + x, floorRow, "=");
    };

    // INTERNAL CONNECTIONS BETWEEN STACKED CELLS OF A TALL ROOM
    for (let cy = 1; cy < room.h; cy++)
    {
        const cx = rng.int(0, room.w - 1);
        AddHole(cx, cy * CH - 1, false);
        AddClimb(cx, cy, "steps");
        clearCols[cy - 1][cx].add(8).add(9).add(10).add(11);
    }

    const doors = DoorsOf(room);
    for (const d of doors)
    {
        const ox = d.cx * CW, oy = d.cy * CH;
        if (d.dir === "left" || d.dir === "right")
        {
            const edge = d.dir === "left" ? 0 : W - 1;
            const inward = d.dir === "left" ? 1 : -1;

            if (d.gate === "J")
            {
                // HIGH DOOR WITH A SHELF IN FRONT: 5 TILES UP FROM THE FLOOR
                for (let y = 3; y <= 5; y++) set(edge, oy + y, ".");
                for (let i = 0; i < 3; i++) set(edge + inward * i, oy + 6, "#");
                busy[d.cy][d.cx] = true;
            }
            else
            {
                for (let y = 8; y <= 10; y++) set(edge, oy + y, ".");

                if (d.gate === "H" && d.obstacleHere)
                {
                    for (let y = 8; y <= 10; y++) { set(edge + inward, oy + y, "X"); set(edge + inward * 2, oy + y, "X"); }
                    busy[d.cy][d.cx] = true;
                }
                if (d.gate === "D" && d.obstacleHere)
                {
                    // SIX TILES OF SPIKES: TOO WIDE TO JUMP, FINE TO DASH OVER
                    for (let i = 2; i <= 7; i++) set(edge + inward * i, oy + 10, "^");
                    busy[d.cy][d.cx] = true;
                }
            }
        }
        else if (d.dir === "up")
        {
            for (let x = 8; x <= 11; x++) set(ox + x, oy, ".");
            AddClimb(d.cx, d.cy, d.gate === "J" ? "J" : d.gate === "W" ? "W" : "steps");
        }
        else if (d.dir === "down")
        {
            AddHole(d.cx, oy + CH - 1, d.gate === "H" && d.obstacleHere);
            for (let c = 7; c <= 12; c++) clearCols[d.cy][d.cx].add(c);
            if (d.gate === "H") busy[d.cy][d.cx] = true;
        }
    }

    // GATES THAT ANOTHER DOOR IN THE SAME CELL WOULD BREAK: PLANKS OVER A DASH STRIP OR NEXT TO A HIGH SHELF,
    // OR A FLOOR HOLE IN FRONT OF A DASH STRIP
    for (let cy = 0; cy < room.h; cy++)
        for (let cx = 0; cx < room.w; cx++)
        {
            const here = doors.filter(d => d.cx === cx && d.cy === cy);
            const hasDash = here.some(d => d.gate === "D" && d.obstacleHere);
            const hasShelf = here.some(d => d.gate === "J" && (d.dir === "left" || d.dir === "right"));
            const hasSteps = stepCells.has(cx + "," + cy);
            const hasVertical = clearCols[cy][cx].size > 0;
            if ((hasDash && hasVertical) || (hasShelf && hasSteps))
                throw new Error(`Room ${room.id} cell ${cx},${cy}: a gate shares its cell with a vertical door`);
        }

    // ENTITIES
    const objects = [];
    const back = [];

    const isDoorZone = (x, cy) => {
        // KEEP 4 TILES IN FRONT OF SIDE DOORS FREE
        for (const d of doors)
        {
            if (d.cy !== cy) continue;
            if (d.dir === "left" && d.cx === 0 && x <= 4) return true;
            if (d.dir === "right" && d.cx === room.w - 1 && x >= W - 5) return true;
        }
        return false;
    };

    const special = room.shrine || room.item || room.boss || room.start;

    for (let cy = 0; cy < room.h; cy++)
    {
        for (let cx = 0; cx < room.w; cx++)
        {
            const ox = cx * CW, oy = cy * CH;
            const floorY = oy + 10; // ROW YOU STAND IN
            const isFree = (x) => !clearCols[cy][cx].has(x - ox) && !isDoorZone(x, cy) && get(x, floorY) === "." && get(x, floorY + 1) === "#";

            if (room.boss)
                continue;

            // FLOATING ONE-WAY PLANKS
            if (!busy[cy][cx])
            {
                const count = rng.int(1, 2);
                for (let i = 0; i < count; i++)
                {
                    const len = rng.int(3, 5);
                    const row = oy + rng.int(5, 7);
                    const start = ox + rng.int(3, CW - 3 - len);
                    let ok = true;
                    for (let x = start - 1; x <= start + len; x++)
                        if (clearCols[cy][cx].has(x - ox) || get(x, row) !== "." || get(x, row - 1) !== "." || get(x, row + 1) !== ".") ok = false;
                    if (ok)
                        for (let x = start; x < start + len; x++) set(x, row, "=");
                }

                // A LOW BLOCK TO HOP OVER
                if (rng.chance(0.35))
                {
                    const x = ox + rng.int(6, 13);
                    if (isFree(x) && isFree(x + 1)) { set(x, floorY, "#"); set(x + 1, floorY, "#"); }
                }
            }

            // SMALL SPIKE STRIPS, 1 OR 2 WIDE
            if (!busy[cy][cx] && !special && rng.chance(0.45))
            {
                const x = ox + rng.int(6, 13);
                const len = rng.int(1, 2);
                let ok = true;
                for (let i = -1; i <= len; i++) if (!isFree(x + i)) ok = false;
                if (ok) for (let i = 0; i < len; i++) set(x + i, floorY, "^");
            }

            // ENEMIES
            if (!room.shrine && !room.start)
            {
                const count = rng.int(1, 2);
                for (let i = 0; i < count; i++)
                {
                    const kind = rng.pick(area.enemies);
                    const flies = (kind === "bat" || kind === "ghost");
                    for (let tries = 0; tries < 12; tries++)
                    {
                        const x = ox + rng.int(4, CW - 5);
                        if (flies)
                        {
                            objects.push({ extends: kind, position: { x: x * TILE + 8, y: (oy + rng.int(3, 6)) * TILE + 8 } });
                            break;
                        }
                        if (isFree(x) && get(x, floorY - 1) === ".")
                        {
                            objects.push({ extends: kind, position: { x: x * TILE + 8, y: (floorY + 1) * TILE } });
                            break;
                        }
                    }
                }
            }

            // DECORATION ON THE BACK WALL
            const decoCount = rng.int(1, 3);
            for (let i = 0; i < decoCount; i++)
            {
                const x = ox + rng.int(2, CW - 3);
                const y = oy + rng.int(2, 7);
                if (get(x, y) === "." && get(x, y + 1) === ".")
                    back.push({ extends: rng.pick(["banner", "window", "banner", "torch"]), position: { x: x * TILE, y: y * TILE } });
            }
        }
    }

    // SHRINE, ITEM AND START GO ON SOLID FLOOR IN THE FIRST CELL, AWAY FROM HOLES AND SPIKES
    const takenCols = new Set();
    const FloorSpot = () => {
        for (const c of [10, 14, 5, 16, 3, 12, 7])
        {
            let ok = !takenCols.has(c);
            for (let i = -1; i <= 1; i++)
                if (get(c + i, 10) !== "." || get(c + i, 11) !== "#" || clearCols[0][0].has(c + i)) ok = false;
            if (ok)
            {
                for (let i = -2; i <= 2; i++) takenCols.add(c + i);
                return c;
            }
        }
        throw new Error("No floor spot in " + room.id);
    };
    if (room.shrine)
    {
        const c = FloorSpot();
        objects.push({ extends: "shrine", position: { x: c * TILE + 8, y: 11 * TILE } });
    }
    if (room.item)
    {
        const c = FloorSpot();
        set(c, 9, ".");
        objects.push({ extends: "item_" + room.item, position: { x: c * TILE + 8, y: 9 * TILE + 8 },
            components: { pickup: { itemId: room.id + "_" + room.item } } });
    }
    if (room.start)
    {
        const c = FloorSpot();
        objects.push({ name: "playerStart", texture: "tile_0098", visible: false, position: { x: c * TILE + 8, y: 11 * TILE } });
    }
    if (room.boss)
        objects.push({ extends: "boss", position: { x: (W - 10) * TILE, y: 11 * TILE } });

    // TURN THE GRID INTO OBJECTS: SOLID RUNS MERGED INTO RECTANGLES, PLANKS AND SPIKES INTO STRIPS
    const used = Array.from({ length: H }, () => Array(W).fill(false));
    for (let y = 0; y < H; y++)
    {
        for (let x = 0; x < W; x++)
        {
            const ch = grid[y][x];
            if (used[y][x] || ch === ".") continue;

            if (ch === "X")
            {
                used[y][x] = true;
                objects.push({ extends: "cracked", position: { x: x * TILE, y: y * TILE }, color: area.wall });
                continue;
            }

            let w = 0;
            while (x + w < W && grid[y][x + w] === ch && !used[y][x + w]) w++;

            let h = 1;
            if (ch === "#")
            {
                // EXTEND DOWN WHILE THE NEXT ROW HAS THE SAME RUN, AND NOT WIDER
                const rowMatches = (yy) => {
                    for (let i = 0; i < w; i++) if (grid[yy][x + i] !== "#" || used[yy][x + i]) return false;
                    const leftWider = x > 0 && grid[yy][x - 1] === "#" && !used[yy][x - 1];
                    const rightWider = x + w < W && grid[yy][x + w] === "#" && !used[yy][x + w];
                    return !leftWider && !rightWider;
                };
                while (y + h < H && rowMatches(y + h)) h++;
            }

            for (let yy = y; yy < y + h; yy++)
                for (let xx = x; xx < x + w; xx++)
                    used[yy][xx] = true;

            const prefab = ch === "#" ? "wall" : ch === "=" ? "plank" : "spikes";
            const entity = { extends: prefab, position: { x: x * TILE, y: y * TILE }, scale: { x: w, y: h } };
            if (ch === "#") entity.color = area.wall;
            objects.push(entity);
        }
    }

    const level = {
        name: room.id,
        dimensions: { width: W * TILE, height: H * TILE },
        backgroundColor: area.bg,
        customData: { room: room.id },
        entitiesByLayer: {
            background: [
                { extends: "backWall", position: { x: 0, y: 0 }, scale: { x: W, y: H }, color: area.back },
                ...back,
            ],
            objects,
        },
    };

    return { level, grid };
}

// ---------------------------------------------------------------------------------------------

fs.mkdirSync(LEVEL_DIR, { recursive: true });

const worldRooms = [];
for (const room of rooms)
{
    const { level, grid } = BuildRoom(room);
    fs.writeFileSync(path.join(LEVEL_DIR, room.id + ".json"), JSON.stringify(level, null, 1));

    if (process.argv.includes("--print"))
        console.log(`\n${room.id} ${room.name}\n` + grid.map(r => r.join("")).join("\n"));

    worldRooms.push({
        id: room.id, name: room.name, area: room.area, x: room.x, y: room.y, w: room.w, h: room.h,
        shrine: !!room.shrine, boss: !!room.boss,
        item: room.item ? { id: room.id + "_" + room.item, kind: room.item } : null,
    });
}

// SIDE DOOR OPENINGS MUST LINE UP ACROSS ROOMS: CHECK BOTH SIDES HAVE THE SAME GATE HEIGHT
for (const l of links)
{
    if ((l.dir === "left" || l.dir === "right") && l.gate === "W")
        throw new Error(`Wall-jump gate needs a vertical connection: ${l.a}-${l.b}`);
    if ((l.gate === "D" || l.gate === "H") && !l.obstacleRoom)
        throw new Error(`Gate ${l.gate} needs an obstacle room: ${l.a}-${l.b}`);
}

const world = {
    tile: TILE, cellWidth: CW, cellHeight: CH,
    areas: Object.fromEntries(Object.entries(AREAS).map(([k, a]) => [k, { name: a.name, color: a.map }])),
    rooms: worldRooms,
    links: links.map(l => ({ a: l.a, b: l.b, x: l.ax, y: l.ay, dir: l.dir, gate: l.gate })),
};
fs.writeFileSync(WORLD_FILE, JSON.stringify(world, null, 1));

console.log(`Built ${rooms.length} rooms, ${links.length} connections.`);
