import type { Colony } from './colony';
import { R_NONE, R_TREE, T_WATER } from './world';

export interface StressReport
{
    loops: number;
    belts: number;
    items: number;
    workers: number;
    designated: number;
}

// Fills the map with work to see how the engine and sim scale: closed belt loops packed with
// items, a crowd of colonists, and every tree around the HQ marked for harvest.
export function StressTest(c: Colony, loops = 150, workers = 150): StressReport
{
    const world = c.world;
    const belt = c.Def('belt');
    const hq = c.hq;
    const report: StressReport = { loops: 0, belts: 0, items: 0, workers: 0, designated: 0 };

    const SIZE = 10, SPACING = 13;
    // walk outwards in a square spiral of loop slots around the HQ, skipping the home clearing
    const slots: [number, number][] = [];
    const reach = Math.floor(Math.min(world.w, world.h) / 2 / SPACING);
    for (let gy = -reach; gy <= reach; gy++)
    for (let gx = -reach; gx <= reach; gx++)
        if (Math.max(Math.abs(gx), Math.abs(gy)) >= 2)
            slots.push([gx, gy]);
    slots.sort((a, b) => Math.max(Math.abs(a[0]), Math.abs(a[1])) - Math.max(Math.abs(b[0]), Math.abs(b[1])));

    for (const [gx, gy] of slots)
    {
        if (report.loops >= loops)
            break;
        const x0 = hq.x + gx * SPACING, y0 = hq.y + gy * SPACING;
        const ring = Ring(x0, y0, SIZE, SIZE);
        if (!ring.every(([x, y]) => world.InBounds(x, y) && world.terrain[world.Index(x, y)] !== T_WATER && !world.building[world.Index(x, y)]))
            continue;

        for (const [x, y, dir] of ring)
        {
            const i = world.Index(x, y);
            if (world.res[i] !== R_NONE)
                world.SetResource(i, R_NONE, 0);
            const b = c.Place(belt, x, y, dir)!;
            c.CompleteBuilding(b);
            // two items per belt, spaced so they never block
            for (let k = 0; k < 2; k++)
            {
                const item = 1 + ((x * 7 + y * 3 + k) % 7);
                b.belt.push({ item, p: 0.75 - k * 0.5, from: dir, moving: true, tick: -1 });
                report.items++;
            }
            report.belts++;
        }
        report.loops++;
    }

    c.housing += workers;
    for (let i = 0; i < workers; i++)
        if (c.SpawnWorker())
            report.workers++;

    const radius = 60;
    for (let y = Math.max(0, hq.y - radius); y < Math.min(world.h, hq.y + radius); y++)
    for (let x = Math.max(0, hq.x - radius); x < Math.min(world.w, hq.x + radius); x++)
    {
        const i = world.Index(x, y);
        if (world.res[i] === R_TREE && !world.designated[i])
        {
            c.Designate(i, true);
            report.designated++;
        }
    }
    return report;
}

// the tiles around a rectangle, clockwise, each pointing to the next
function Ring(x: number, y: number, w: number, h: number): [number, number, number][]
{
    const tiles: [number, number, number][] = [];
    for (let i = x; i < x + w - 1; i++) tiles.push([i, y, 0]);
    for (let j = y; j < y + h - 1; j++) tiles.push([x + w - 1, j, 1]);
    for (let i = x + w - 1; i > x; i--) tiles.push([i, y + h - 1, 2]);
    for (let j = y + h - 1; j > y; j--) tiles.push([x, j, 3]);
    return tiles;
}
