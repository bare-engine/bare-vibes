// Checks that every level can be finished, using a simplified copy of the runner's physics.
// Run: node tools/checkLevels.cjs [--json]
// For each level it finds the x positions to flip at, and how much room each flip has
// (the "window": how far the flip can move and still work). Small windows mean hard jumps.

const fs = require('fs');
const path = require('path');

const settings = JSON.parse(fs.readFileSync(path.join(__dirname, '../public/data/settingsData.json'), 'utf8'));
const prefabs = Object.fromEntries(settings.prefabs.map(p => [p.name, p]));

// KEEP IN SYNC WITH RunnerComponent
const GRAVITY = 5200, MAX_FALL = 1700, FLIP_PUSH = 250, COYOTE = 0.08, DT = 1 / 60;
const HALF = 19; // PLAYER HITBOX IS 38x38 AROUND ITS CENTER

function LoadLevel(file)
{
    const level = JSON.parse(fs.readFileSync(file, 'utf8'));
    const solids = [], hazards = [];
    let start, goal;
    for (const e of level.entitiesByLayer.objects)
    {
        const sx = e.scale?.x ?? 1, sy = e.scale?.y ?? 1;
        const { x, y } = e.position;
        if (e.extends == 'block')
            solids.push({ x1: x, y1: y, x2: x + 64 * sx, y2: y + 64 * sy });
        else if (e.extends == 'spikeUp' || e.extends == 'spikeDown')
        {
            const hb = prefabs[e.extends].hitbox;
            hazards.push({ x1: x + hb.x1 * sx, y1: y + hb.y1 * sy, x2: x + hb.x2 * sx, y2: y + hb.y2 * sy });
        }
        else if (e.extends == 'player')
            start = { x, y };
        else if (e.extends == 'goal')
            goal = { x1: x, y1: y, x2: x + 64, y2: y + 128 };
    }
    return { level, solids, hazards, start, goal, speed: level.customData.speed, height: level.dimensions.height };
}

const Overlap = (a, b) => a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1;
const Box = (s) => ({ x1: s.x - HALF, y1: s.y - HALF, x2: s.x + HALF, y2: s.y + HALF });

// RUNS THE LEVEL, FLIPPING AT THE GIVEN x POSITIONS (AS SOON AS ALLOWED AFTER REACHING EACH ONE).
// RETURNS { ok, x, flipsUsed }
let simulations = 0;
function Simulate(L, flips)
{
    simulations++;
    const s = { x: L.start.x, y: L.start.y, vy: 0, dir: 1, sinceGrounded: 99 };
    let next = 0;
    for (let frame = 0; frame < 60 * 120; frame++)
    {
        const wants = next < flips.length && s.x >= flips[next];
        if (wants && s.sinceGrounded <= COYOTE)
        {
            s.dir *= -1;
            s.vy = s.dir * FLIP_PUSH;
            s.sinceGrounded = 99;
            next++;
        }
        s.vy = Math.max(-MAX_FALL, Math.min(MAX_FALL, s.vy + GRAVITY * s.dir * DT));

        const prev = Box(s);
        s.x += L.speed * DT;
        s.y += s.vy * DT;

        let grounded = false;
        for (const b of L.solids)
        {
            const box = Box(s);
            if (!Overlap(box, b)) continue;
            if (prev.y2 <= b.y1 + 0.01) { s.y = b.y1 - HALF; if (s.vy > 0) s.vy = 0; grounded ||= s.dir > 0; }
            else if (prev.y1 >= b.y2 - 0.01) { s.y = b.y2 + HALF; if (s.vy < 0) s.vy = 0; grounded ||= s.dir < 0; }
            else return { ok: false, x: s.x, why: 'wall', flipsUsed: next };
        }
        s.sinceGrounded = grounded ? 0 : s.sinceGrounded + DT;

        const box = Box(s);
        if (L.hazards.some(h => Overlap(box, h))) return { ok: false, x: s.x, why: 'spike', flipsUsed: next };
        if (s.y < -48 || s.y > L.height + 48) return { ok: false, x: s.x, why: 'fell', flipsUsed: next };
        if (Overlap(box, L.goal)) return { ok: true, x: s.x, flipsUsed: next };
    }
    return { ok: false, why: 'timeout' };
}

// GREEDY SEARCH: RUN WITHOUT MORE FLIPS; WHEN IT DIES, TRY ADDING ONE FLIP BEFORE THE DEATH, LATEST FIRST
function Solve(L, flips = [], depth = 0)
{
    const result = Simulate(L, flips);
    if (result.ok) return flips;
    if (depth > 40 || simulations > 200000) return null;

    const from = flips.length ? flips[flips.length - 1] + 8 : L.start.x;
    for (let x = Math.floor(result.x); x >= from; x -= 8)
    {
        const attempt = [...flips, x];
        const r = Simulate(L, attempt);
        // ONLY KEEP FLIPS THAT GET FURTHER THAN BEFORE
        if (r.ok || (r.x > result.x + 1 && r.flipsUsed == attempt.length))
        {
            const solved = Solve(L, attempt, depth + 1);
            if (solved) return solved;
        }
    }
    return null;
}

// MOVE EVERY FLIP TO THE MIDDLE OF THE RANGE THAT STILL WORKS, AND REPORT THAT RANGE
function Center(L, flips)
{
    const windows = [];
    for (let pass = 0; pass < 2; pass++)
    {
        for (let i = 0; i < flips.length; i++)
        {
            const works = (x) => Simulate(L, flips.map((f, j) => (j == i ? x : f))).ok;
            let lo = flips[i], hi = flips[i];
            while (lo - 2 > (i ? flips[i - 1] : L.start.x) && works(lo - 2)) lo -= 2;
            while ((i + 1 >= flips.length || hi + 2 < flips[i + 1]) && works(hi + 2)) hi += 2;
            flips[i] = Math.round((lo + hi) / 2);
            windows[i] = hi - lo;
        }
    }
    return windows;
}

module.exports = { LoadLevel, Simulate, Solve, Center };

if (require.main === module)
{
    const dir = path.join(__dirname, '../public/data/levels');
    const report = {};
    let failed = false;
    for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort())
    {
        const L = LoadLevel(path.join(dir, file));
        simulations = 0;
        const flips = Solve(L);
        if (!flips)
        {
            failed = true;
            console.log(`${L.level.name}: NO SOLUTION FOUND (dies at x=${Math.round(Simulate(L, []).x)})`);
            continue;
        }
        const windows = Center(L, flips);
        report[L.level.name] = flips;
        if (!process.argv.includes('--json'))
            console.log(`${L.level.name} (${L.level.customData.title}, speed ${L.speed}): ${flips.length} flips, tightest window ${Math.min(...windows)}px\n  ` +
                flips.map((f, i) => `${f}±${windows[i] / 2}`).join('  '));
    }
    if (process.argv.includes('--json'))
        console.log(JSON.stringify(report));
    process.exit(failed ? 1 : 0);
}
