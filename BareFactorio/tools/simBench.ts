// Runs the simulation without the engine or a browser:
//  1. a scripted player works through the goals, to check the game can be finished
//  2. a stress world, to measure ticks per second
// Run with: npm run sim-bench
import settings from '../public/data/settingsData.json';
import { Colony } from '../src/sim/colony';
import { ParseBuildingDefs, TICKS_PER_SECOND, type BuildingDef } from '../src/sim/defs';
import { CheckGoals, GOALS } from '../src/sim/goals';
import { IRON_PLATE, ITEM_LABELS, PLANK, STONE, WOOD } from '../src/sim/items';
import { LoadColony, SaveColony } from '../src/sim/save';
import { StressTest } from '../src/sim/stress';
import { R_IRON, R_ROCK, R_TREE } from '../src/sim/world';

const defs = ParseBuildingDefs(settings.prefabs);

function Minutes(c: Colony): string
{
    return (c.tick / TICKS_PER_SECOND / 60).toFixed(1) + ' min';
}

// the first free spot on a spiral around the HQ, on a grid so buildings keep walkways between them
function FindSpot(c: Colony, def: BuildingDef, step = 3): [number, number] | null
{
    const hq = c.hq;
    for (let r = 1; r < 30; r++)
    for (let dy = -r; dy <= r; dy++)
    for (let dx = -r; dx <= r; dx++)
    {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r)
            continue;
        const x = hq.x + dx * step, y = hq.y + dy * step;
        if (!c.CanPlace(def, x, y))
            return [x, y];
    }
    return null;
}

function Count(c: Colony, key: string): number
{
    let n = 0;
    for (const b of c.buildings.values())
        if (b.def.key === key)
            n++;
    return n;
}

function DesignateNearest(c: Colony, res: number, count: number)
{
    const world = c.world, hq = c.hq;
    const tiles: [number, number][] = [];
    for (let y = Math.max(0, hq.y - 40); y < Math.min(world.h, hq.y + 40); y++)
    for (let x = Math.max(0, hq.x - 40); x < Math.min(world.w, hq.x + 40); x++)
    {
        const i = world.Index(x, y);
        if (world.res[i] === res && !world.designated[i] && !world.building[i])
            tiles.push([i, Math.abs(x - hq.x) + Math.abs(y - hq.y)]);
    }
    tiles.sort((a, b) => a[1] - b[1]);
    for (const [i] of tiles.slice(0, count))
        c.Designate(i, true);
}

// drill on ore -> belts -> smelter -> belt -> crate, or a long dead-end belt to back items up
function PlaceChain(c: Colony, deadEnd: boolean): boolean
{
    const world = c.world, hq = c.hq;
    const ores: [number, number, number][] = [];
    for (let y = hq.y - 40; y < hq.y + 40; y++)
    for (let x = hq.x - 40; x < hq.x + 40; x++)
        if (world.InBounds(x, y) && world.res[world.Index(x, y)] === R_IRON && !world.building[world.Index(x, y)])
            ores.push([x, y, Math.abs(x - hq.x) + Math.abs(y - hq.y)]);
    ores.sort((a, b) => a[2] - b[2]);

    const belt = c.Def('belt');
    for (const [x, y] of ores)
    {
        const plan: [BuildingDef, number, number][] = [[c.Def('drill'), x, y]];
        const length = deadEnd ? 16 : 2;
        for (let i = 1; i <= length; i++)
            plan.push([belt, x + i, y]);
        if (!deadEnd)
            plan.push([c.Def('smelter'), x + 3, y], [belt, x + 4, y], [c.Def('crate'), x + 5, y]);
        if (plan.every(([def, px, py]) => !c.CanPlace(def, px, py)))
        {
            for (const [def, px, py] of plan)
                c.Place(def, px, py, 0);
            return true;
        }
    }
    return false;
}

function Bot(c: Colony)
{
    const s = c.stock;
    const place = (key: string) => {
        const def = c.Def(key);
        const spot = FindSpot(c, def);
        if (spot)
            c.Place(def, spot[0], spot[1], 0);
    };

    if (c.designations.size < 8)
    {
        DesignateNearest(c, R_TREE, 10);
        if (c.produced[STONE] < 40) DesignateNearest(c, R_ROCK, 3);
        if (c.goalIndex >= 2) DesignateNearest(c, R_IRON, 4);
    }
    if (c.sites.length > 3)
        return;
    if (Count(c, 'sawmill') === 0 && s[WOOD] >= 6) place('sawmill');
    else if (Count(c, 'smelter') === 0 && s[STONE] >= 10) place('smelter');
    else if (Count(c, 'farm') === 0 && s[WOOD] >= 6) place('farm');
    else if (Count(c, 'drill') === 0 && s[IRON_PLATE] >= 3 && s[PLANK] >= 8) PlaceChain(c, false);
    else if (Count(c, 'hut') < 2 && s[PLANK] >= 8 && s[STONE] >= 4) place('hut');
    else if (Count(c, 'workshop') === 0 && s[IRON_PLATE] >= 4 && s[PLANK] >= 6) place('workshop');
    else if (Count(c, 'drill') < 4 && c.goalIndex >= 8 && s[IRON_PLATE] >= 3 && s[PLANK] >= 20) PlaceChain(c, true);
    else if (Count(c, 'farm') < 2 && c.workers.length >= 6 && s[WOOD] >= 6) place('farm');
}

function Playthrough()
{
    console.log('== Playthrough (scripted player) ==');
    const c = Colony.NewGame(defs, 256, 256, 42);
    c.onMessage = text => console.log(`  [${Minutes(c)}] ${text}`);
    const limit = 60 * 60 * TICKS_PER_SECOND;
    while (c.tick < limit && c.goalIndex < GOALS.length)
    {
        if (c.tick % 20 === 0)
        {
            Bot(c);
            const done = CheckGoals(c);
            if (done)
                console.log(`  [${Minutes(c)}] goal ${c.goalIndex}: ${done.text}`);
        }
        c.Tick();
    }
    const stock = [...c.stock].map((n, i) => i ? `${ITEM_LABELS[i]} ${n}` : '').filter(Boolean).join(', ');
    console.log(`  ${c.goalIndex}/${GOALS.length} goals in ${Minutes(c)}, ${c.workers.length} colonists, ${c.buildings.size} buildings`);
    console.log(`  stock: ${stock}`);
    console.log(`  avg hunger ${(c.workers.reduce((a, w) => a + w.hunger, 0) / c.workers.length).toFixed(0)}`);
    console.log(`  sim ${(c.stats.tickMs / c.stats.ticks).toFixed(3)} ms/tick, A* ${c.pathfinder.stats.calls} searches (${c.pathfinder.stats.failures} failed) ${c.pathfinder.stats.ms.toFixed(0)} ms total`);
    return c;
}

async function Stress(size: number)
{
    console.log(`== Stress ${size}x${size} ==`);
    let start = performance.now();
    const c = Colony.NewGame(defs, size, size, 7);
    console.log(`  worldgen ${(performance.now() - start).toFixed(0)} ms`);
    start = performance.now();
    const report = StressTest(c, size >= 512 ? 400 : 150, 300);
    console.log(`  setup ${(performance.now() - start).toFixed(0)} ms: ${report.belts} belts, ${report.items} items, ${report.workers} colonists, ${report.designated} trees`);

    const ticks = 1200;
    const times: number[] = [];
    for (let i = 0; i < ticks; i++)
    {
        const t = performance.now();
        c.Tick();
        times.push(performance.now() - t);
    }
    times.sort((a, b) => a - b);
    const avg = times.reduce((a, b) => a + b, 0) / ticks;
    console.log(`  ${ticks} ticks: avg ${avg.toFixed(2)} ms, p50 ${times[ticks >> 1].toFixed(2)}, p99 ${times[Math.floor(ticks * 0.99)].toFixed(2)}, max ${times[ticks - 1].toFixed(2)} ms`);
    console.log(`  => headroom ${(1000 / TICKS_PER_SECOND / avg).toFixed(0)}x at ${TICKS_PER_SECOND} tps`);
    const p = c.pathfinder.stats;
    console.log(`  A* ${p.calls} searches, ${p.failures} failed, ${(p.expanded / Math.max(1, p.calls)).toFixed(0)} nodes avg, ${p.ms.toFixed(0)} ms`);
    const areas = c.pathfinder.areas.stats;
    console.log(`  areas: ${areas.relabels} relabels, last over ${areas.lastTicks} ticks, ${areas.ms.toFixed(0)} ms total`);
    console.log(`  flow ${c.flow.stats.rebuilds} builds, last ${c.flow.stats.lastMs.toFixed(1)} ms over ${c.flow.stats.ticksForLast} ticks`);
    console.log(`  harvested ${c.produced[WOOD]} wood`);

    start = performance.now();
    const save = await SaveColony(c);
    console.log(`  save ${(performance.now() - start).toFixed(0)} ms: ${(save.data.length / 1024).toFixed(0)} KB base64 (${(save.rawBytes / 1024).toFixed(0)} KB raw)`);
    start = performance.now();
    const loaded = await LoadColony(save.data, defs);
    console.log(`  load ${(performance.now() - start).toFixed(0)} ms: ${loaded.buildings.size} buildings, ${loaded.workers.length} colonists`);
}

const playthrough = Playthrough();
if (playthrough.goalIndex < GOALS.length)
    process.exitCode = 1;
await Stress(256);
await Stress(512);
await Stress(1024);
