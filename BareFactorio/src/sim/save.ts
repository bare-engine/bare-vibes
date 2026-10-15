import { Building, type BeltItem } from './building';
import { Colony } from './colony';
import type { BuildingDef } from './defs';
import { Worker } from './worker';
import { World } from './world';

// A save is one binary blob: a JSON header with buildings and workers, then the tile arrays raw.
// It's gzipped and base64'd, so it fits in a string for SaveData/localStorage.

const VERSION = 1;

interface BuildingSave
{
    id: number; key: string; x: number; y: number; dir: number; built: boolean;
    delivered: number[]; inv: number[]; out: number; outItem: number; progress: number; timer: number;
    depleted: boolean; growth: number; stage: number; buildWork: number;
    // item, p, from per belt item
    belt: number[];
}

interface WorkerSave
{
    id: number; name: string; shirt: number; x: number; y: number; hunger: number; carryItem: number; carryCount: number;
}

interface Header
{
    version: number;
    w: number; h: number; seed: number;
    tick: number; nextId: number; hqId: number; rng: number;
    produced: number[]; drillMined: number; goalIndex: number;
    designations: number[];
    buildings: BuildingSave[];
    workers: WorkerSave[];
}

export interface SaveResult
{
    data: string;
    rawBytes: number;
    ms: number;
}

export async function SaveColony(c: Colony): Promise<SaveResult>
{
    const start = performance.now();
    const world = c.world;

    const header: Header = {
        version: VERSION,
        w: world.w, h: world.h, seed: world.seed,
        tick: c.tick, nextId: c.nextId, hqId: c.hqId, rng: c.rng.state,
        produced: [...c.produced], drillMined: c.drillMined, goalIndex: c.goalIndex,
        designations: [...c.designations],
        buildings: [...c.buildings.values()].map(b => ({
            id: b.id, key: b.def.key, x: b.x, y: b.y, dir: b.dir, built: b.built,
            delivered: [...b.delivered], inv: [...b.inv], out: b.out, outItem: b.outItem, progress: b.progress,
            timer: b.timer, depleted: b.depleted, growth: b.growth, stage: b.stage, buildWork: b.buildWork,
            belt: b.belt.flatMap(item => [item.item, Math.round(item.p * 1000) / 1000, item.from]),
        })),
        workers: c.workers.map(w => ({
            id: w.id, name: w.name, shirt: w.shirt, x: Math.round(w.x * 100) / 100, y: Math.round(w.y * 100) / 100,
            hunger: w.hunger, carryItem: w.carryItem, carryCount: w.carryCount,
        })),
    };

    const json = new TextEncoder().encode(JSON.stringify(header));
    const arrays = [world.terrain, world.res, new Uint8Array(world.resAmount.buffer)];
    const total = 4 + json.length + arrays.reduce((sum, a) => sum + a.length, 0);
    const blob = new Uint8Array(total);
    new DataView(blob.buffer).setUint32(0, json.length, true);
    blob.set(json, 4);
    let offset = 4 + json.length;
    for (const a of arrays)
    {
        blob.set(a, offset);
        offset += a.length;
    }

    const data = ToBase64(await Gzip(blob));
    return { data, rawBytes: total, ms: performance.now() - start };
}

export async function LoadColony(data: string, defs: BuildingDef[]): Promise<Colony>
{
    const blob = await Gunzip(FromBase64(data));
    const view = new DataView(blob.buffer, blob.byteOffset, blob.byteLength);
    const jsonLength = view.getUint32(0, true);
    const header = JSON.parse(new TextDecoder().decode(blob.subarray(4, 4 + jsonLength))) as Header;
    if (header.version !== VERSION)
        throw new Error(`Save version ${header.version} isn't supported`);

    const world = new World(header.w, header.h, header.seed);
    let offset = 4 + jsonLength;
    world.terrain.set(blob.subarray(offset, offset + world.size)); offset += world.size;
    world.res.set(blob.subarray(offset, offset + world.size)); offset += world.size;
    // copy, since the Uint16Array needs an aligned buffer
    new Uint8Array(world.resAmount.buffer).set(blob.subarray(offset, offset + world.size * 2));

    const c = new Colony(world, defs, 0);
    c.rng.state = header.rng;
    c.tick = header.tick;
    c.hqId = header.hqId;
    c.produced.set(header.produced);
    c.drillMined = header.drillMined;
    c.goalIndex = header.goalIndex;

    // rebuild buildings through the normal placement path, then restore their state
    for (const s of header.buildings)
    {
        const def = c.Def(s.key);
        c.nextId = s.id;
        const b = c.Place(def, s.x, s.y, s.dir, true)!;
        if (s.built && !b.built)
            c.CompleteBuilding(b);
        RestoreBuilding(c, b, s);
    }

    for (const t of header.designations)
        c.Designate(t, true);

    for (const s of header.workers)
    {
        const w = new Worker(s.id, s.name, s.shirt, 0, 0);
        w.x = w.px = s.x;
        w.y = w.py = s.y;
        w.hunger = s.hunger;
        w.carryItem = s.carryItem;
        w.carryCount = s.carryCount;
        c.workers.push(w);
    }

    c.nextId = header.nextId;
    world.chunkVersion.fill(1);
    world.navVersion++;
    c.flow.Invalidate();
    return c;
}

function RestoreBuilding(c: Colony, b: Building, s: BuildingSave)
{
    if (b.def.kind === 'storage')
        for (let item = 1; item < s.inv.length; item++)
            c.StoreAt(b, item, s.inv[item] - b.inv[item]);
    else
        b.inv.set(s.inv);
    b.delivered.set(s.delivered);
    b.out = s.out;
    b.outItem = s.outItem || b.outItem;
    b.progress = s.progress;
    b.timer = s.timer;
    b.depleted = s.depleted;
    b.growth = s.growth;
    b.stage = s.stage;
    b.buildWork = s.buildWork;
    const items: BeltItem[] = [];
    for (let i = 0; i < s.belt.length; i += 3)
        items.push({ item: s.belt[i], p: s.belt[i + 1], from: s.belt[i + 2], moving: false, tick: -1 });
    b.belt = items;
}

async function Gzip(data: Uint8Array): Promise<Uint8Array>
{
    if (typeof CompressionStream === 'undefined')
        return data;
    const stream = new Blob([data as BlobPart]).stream().pipeThrough(new CompressionStream('gzip'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function Gunzip(data: Uint8Array): Promise<Uint8Array>
{
    // gzip starts with 1f 8b, anything else was saved without compression
    if (data[0] !== 0x1f || data[1] !== 0x8b)
        return data;
    const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
}

function ToBase64(data: Uint8Array): string
{
    let binary = '';
    const CHUNK = 0x8000;
    for (let i = 0; i < data.length; i += CHUNK)
        binary += String.fromCharCode.apply(null, data.subarray(i, i + CHUNK) as unknown as number[]);
    return btoa(binary);
}

function FromBase64(text: string): Uint8Array
{
    const binary = atob(text);
    const data = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++)
        data[i] = binary.charCodeAt(i);
    return data;
}
