import { Building } from './building';
import { DX, DY, Opposite, type BuildingDef } from './defs';
import { BERRIES, ITEM_LABELS, NewInventory, PLANK, STONE, WOOD } from './items';
import { FlowField, Pathfinder } from './pathfinding';
import { Rng } from './rng';
import { CARRY_CAP, Worker, type Job, type JobType } from './worker';
import { RES_ITEM, RES_KEYS, R_NONE, World } from './world';

export const BELT_SPEED = 0.08;
export const BELT_SPACING = 0.25;
const INPUT_CAP = 8;
const OUT_CAP = 8;
const START_WORKERS = 4;
const BASE_HOUSING = 4;
const GROWTH_INTERVAL = 200;
const GROWTH_FOOD = 5;
const PATH_SEARCHES_PER_TICK = 12;
const JOB_SEARCHES_PER_TICK = 16;
// a node count, not a time budget, so the field finishes on the same tick on every machine
const FLOW_NODES_PER_TICK = 6000;
const AREA_TILES_PER_TICK = 20000;
const UNREACHABLE_RETRY_TICKS = 400;

const NAMES = ['Ada', 'Bram', 'Cleo', 'Dirk', 'Elif', 'Fenna', 'Gus', 'Hana', 'Ivo', 'Juno', 'Kees', 'Lotte', 'Milo', 'Noor',
    'Otis', 'Pip', 'Quinn', 'Roos', 'Sem', 'Tess', 'Uma', 'Vince', 'Wren', 'Xan', 'Yara', 'Zep'];
export const SHIRT_COLORS = ['#e8645a', '#5aa0e8', '#f0c040', '#7ad070', '#c080e0', '#f09040', '#60d0d0', '#f0a0c0'];

export class Colony
{
    readonly defByKey = new Map<string, BuildingDef>();
    readonly buildings = new Map<number, Building>();
    readonly belts: Building[] = [];
    readonly machines: Building[] = [];
    readonly storages: Building[] = [];
    readonly sites: Building[] = [];
    readonly workers: Worker[] = [];

    readonly stock = NewInventory();
    readonly produced = NewInventory();
    readonly designations = new Set<number>();
    readonly harvestClaims = new Map<number, number>();
    // targets nobody could walk to, and the tick to try again: a tile, or minus a building id
    private readonly unreachable = new Map<number, number>();

    readonly pathfinder: Pathfinder;
    readonly flow: FlowField;
    readonly rng: Rng;

    nextId = 1;
    tick = 0;
    hqId = 0;
    housing = BASE_HOUSING;
    drillMined = 0;
    itemsOnBelts = 0;
    goalIndex = 0;

    pathBudget = 0;
    jobBudget = 0;
    stats = { tickMs: 0, ticks: 0, jobSearches: 0 };

    onMessage: (text: string) => void = () => {};

    constructor(readonly world: World, readonly defs: BuildingDef[], rngSeed: number)
    {
        for (const def of defs)
            this.defByKey.set(def.key, def);
        this.rng = new Rng(rngSeed);
        this.pathfinder = new Pathfinder(world);
        this.flow = new FlowField(world, () => this.FlowSources());
    }

    static NewGame(defs: BuildingDef[], w: number, h: number, seed: number): Colony
    {
        const world = new World(w, h, seed);
        world.Generate();
        const colony = new Colony(world, defs, seed ^ 0x5bd1e995);

        const cx = w >> 1, cy = h >> 1;
        const hq = colony.Place(colony.Def('hq'), cx - 1, cy - 1, 0)!;
        colony.StoreAt(hq, PLANK, 30);
        colony.StoreAt(hq, STONE, 20);
        colony.StoreAt(hq, WOOD, 10);
        colony.StoreAt(hq, BERRIES, 20);

        for (let i = 0; i < START_WORKERS; i++)
            colony.SpawnWorker();
        return colony;
    }

    Def(key: string): BuildingDef
    {
        const def = this.defByKey.get(key);
        if (!def)
            throw new Error(`No building '${key}' in settingsData.json`);
        return def;
    }

    ItemLabel(item: number): string
    {
        return ITEM_LABELS[item];
    }

    get hq(): Building
    {
        return this.buildings.get(this.hqId)!;
    }

    Tick()
    {
        const start = performance.now();
        this.tick++;
        this.pathBudget = PATH_SEARCHES_PER_TICK;
        this.jobBudget = JOB_SEARCHES_PER_TICK;

        this.flow.Step(FLOW_NODES_PER_TICK, this.tick);
        this.pathfinder.areas.Step(AREA_TILES_PER_TICK);

        for (const worker of this.workers)
            worker.Update(this);

        for (const machine of this.machines)
            this.UpdateMachine(machine);

        for (const belt of this.belts)
            this.UpdateBelt(belt);
        // counted afterwards: an item handed to a belt that already updated would be missed
        let onBelts = 0;
        for (const belt of this.belts)
            onBelts += belt.belt.length;
        this.itemsOnBelts = onBelts;

        if (this.tick % GROWTH_INTERVAL === 0)
            this.TryGrow();

        const ms = performance.now() - start;
        this.stats.tickMs += ms;
        this.stats.ticks++;
    }

    // ---- placing and removing ----

    CanPlace(def: BuildingDef, x: number, y: number): string | null
    {
        const world = this.world;
        for (let ty = y; ty < y + def.h; ty++)
        for (let tx = x; tx < x + def.w; tx++)
        {
            if (!world.InBounds(tx, ty))
                return 'Outside the world';
            const i = world.Index(tx, ty);
            if (world.terrain[i] === 0)
                return 'Can\'t build on water';
            if (world.building[i])
                return 'Something is already here';
            const res = world.res[i];
            if (def.needsResource.length)
            {
                if (!def.needsResource.includes(RES_KEYS[res]))
                    return 'Needs iron ore or a boulder underneath';
            }
            else if (res !== R_NONE && RES_KEYS[res] !== 'iron')
                return 'Harvest this first';
        }
        for (const worker of this.workers)
            if (!def.walkable && worker.tileX >= x && worker.tileY >= y && worker.tileX < x + def.w && worker.tileY < y + def.h && worker.working)
                return 'Someone is working here';
        return null;
    }

    // `force` skips the checks, for loading saves (a drill may stand on ore that ran out)
    Place(def: BuildingDef, x: number, y: number, dir: number, force = false): Building | null
    {
        if (!force && this.CanPlace(def, x, y))
            return null;

        const b = new Building(this.nextId++, def, x, y, def.rotatable ? dir : 0);
        this.buildings.set(b.id, b);
        if (def.key === 'hq')
            this.hqId = b.id;

        const world = this.world;
        for (let ty = y; ty < y + def.h; ty++)
        for (let tx = x; tx < x + def.w; tx++)
        {
            const i = world.Index(tx, ty);
            world.building[i] = b.id;
            if (world.designated[i])
                this.Designate(i, false);
            world.TouchTile(i, false);
        }

        if (def.cost.length === 0)
            this.CompleteBuilding(b);
        else
            this.sites.push(b);
        return b;
    }

    CompleteBuilding(b: Building)
    {
        b.built = true;
        b.builderId = 0;
        b.delivered.fill(0);
        Remove(this.sites, b);

        const def = b.def;
        if (!def.walkable)
            this.SetSolid(b, 1);

        switch (def.kind)
        {
            case 'storage': this.storages.push(b); this.flow.Invalidate(); break;
            case 'belt': this.belts.push(b); break;
            case 'crafter': case 'drill': case 'farm': this.machines.push(b); break;
            case 'house': this.housing += def.housing; break;
        }
        if (def.recipe)
            b.outItem = def.recipe.output;
    }

    Deconstruct(b: Building): boolean
    {
        if (b.id === this.hqId)
        {
            this.onMessage('The HQ stays.');
            return false;
        }

        const hq = this.hq;
        // everything goes back to the HQ, so nothing is lost
        if (b.built)
        {
            for (const [item, count] of b.def.cost)
                this.StoreAt(hq, item, count);
        }
        else
        {
            for (let item = 1; item < b.delivered.length; item++)
                this.StoreAt(hq, item, b.delivered[item]);
        }
        for (let item = 1; item < b.inv.length; item++)
        {
            const count = b.def.kind === 'storage' ? this.TakeFrom(b, item, b.inv[item]) : b.inv[item];
            this.StoreAt(hq, item, count);
        }
        if (b.out > 0)
            this.StoreAt(hq, b.outItem, b.out);
        for (const item of b.belt)
            this.StoreAt(hq, item.item, 1);

        if (b.built && !b.def.walkable)
            this.SetSolid(b, 0);

        const world = this.world;
        for (let ty = b.y; ty < b.y + b.def.h; ty++)
        for (let tx = b.x; tx < b.x + b.def.w; tx++)
        {
            const i = world.Index(tx, ty);
            world.building[i] = 0;
            world.TouchTile(i, false);
        }

        this.buildings.delete(b.id);
        Remove(this.sites, b);
        Remove(this.belts, b);
        Remove(this.machines, b);
        if (Remove(this.storages, b))
            this.flow.Invalidate();
        if (b.built && b.def.kind === 'house')
            this.housing -= b.def.housing;
        return true;
    }

    private SetSolid(b: Building, solid: number)
    {
        const world = this.world;
        for (let ty = b.y; ty < b.y + b.def.h; ty++)
        for (let tx = b.x; tx < b.x + b.def.w; tx++)
        {
            const i = world.Index(tx, ty);
            world.solid[i] = solid;
            world.TouchTile(i, true);
        }
        this.flow.Invalidate();
    }

    BuildingAt(x: number, y: number): Building | null
    {
        if (!this.world.InBounds(x, y))
            return null;
        const id = this.world.building[this.world.Index(x, y)];
        return id ? this.buildings.get(id) ?? null : null;
    }

    Designate(i: number, on: boolean)
    {
        const world = this.world;
        if (on)
        {
            if (world.res[i] === R_NONE || world.building[i])
                return;
            world.designated[i] = 1;
            this.designations.add(i);
        }
        else
        {
            world.designated[i] = 0;
            this.designations.delete(i);
        }
    }

    Harvest(i: number, amount: number)
    {
        const world = this.world;
        const res = world.res[i];
        this.produced[RES_ITEM[res]] += amount;
        const left = world.resAmount[i] - amount;
        if (left <= 0)
        {
            world.SetResource(i, R_NONE, 0);
            this.designations.delete(i);
            // a cleared tile can open a shorter way home
            this.flow.Invalidate();
        }
        else
            world.resAmount[i] = left;
    }

    // ---- items ----

    StoreAt(storage: Building, item: number, count: number)
    {
        if (count <= 0)
            return;
        storage.inv[item] += count;
        this.stock[item] += count;
    }

    TakeFrom(storage: Building, item: number, count: number): number
    {
        const taken = Math.min(count, storage.inv[item]);
        storage.inv[item] -= taken;
        this.stock[item] -= taken;
        return taken;
    }

    // take from any storage, eg food for newcomers
    TakeAnywhere(item: number, count: number): number
    {
        let taken = 0;
        for (const storage of this.storages)
        {
            taken += this.TakeFrom(storage, item, count - taken);
            if (taken >= count)
                break;
        }
        return taken;
    }

    // a worker hands over what it carries. Returns how many were accepted
    DeliverTo(b: Building, item: number, count: number): number
    {
        if (!b.built)
        {
            let need = 0;
            for (const [costItem, costCount] of b.def.cost)
                if (costItem === item)
                    need = costCount - b.delivered[item];
            const accepted = Math.max(0, Math.min(need, count));
            b.delivered[item] += accepted;
            return accepted;
        }
        if (b.def.kind === 'storage')
        {
            this.StoreAt(b, item, count);
            return count;
        }
        if (b.def.kind === 'crafter' && b.def.recipe!.inputs.some(([input]) => input === item))
        {
            b.inv[item] += count;
            return count;
        }
        return 0;
    }

    // a belt or machine hands one item into a tile. `dir` is the direction it travels in
    PushInto(x: number, y: number, dir: number, item: number, overflow: number): boolean
    {
        const target = this.BuildingAt(x, y);
        if (!target)
            return false;

        if (!target.built)
        {
            // belts can deliver construction materials straight to a site
            if (target.MaterialNeeded(item) <= 0)
                return false;
            target.delivered[item]++;
            return true;
        }

        switch (target.def.kind)
        {
            case 'belt':
            {
                if (target.dir === Opposite(dir))
                    return false;
                const items = target.belt;
                const last = items[items.length - 1];
                if (last && last.p < BELT_SPACING)
                    return false;
                const p = Math.max(0, Math.min(overflow, last ? last.p - BELT_SPACING : 1));
                items.push({ item, p, from: dir, moving: true, tick: this.tick });
                return true;
            }
            case 'storage':
                this.StoreAt(target, item, 1);
                return true;
            case 'crafter':
            {
                const recipe = target.def.recipe!;
                if (!recipe.inputs.some(([input]) => input === item) || target.inv[item] >= INPUT_CAP)
                    return false;
                target.inv[item]++;
                target.lastBeltInput = this.tick;
                return true;
            }
            default:
                return false;
        }
    }

    NearestStorageWith(x: number, y: number, item: number): Building | null
    {
        let best: Building | null = null;
        let bestDist = Infinity;
        for (const storage of this.storages)
        {
            if (storage.inv[item] <= 0)
                continue;
            const dist = Math.abs(storage.x - x) + Math.abs(storage.y - y);
            if (dist < bestDist)
            {
                bestDist = dist;
                best = storage;
            }
        }
        return best;
    }

    NearestStorage(x: number, y: number): Building | null
    {
        let best: Building | null = null;
        let bestDist = Infinity;
        for (const storage of this.storages)
        {
            const dist = Math.abs(storage.x - x) + Math.abs(storage.y - y);
            if (dist < bestDist)
            {
                bestDist = dist;
                best = storage;
            }
        }
        return best;
    }

    StorageNextTo(x: number, y: number): Building | null
    {
        for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++)
        {
            const b = this.BuildingAt(x + dx, y + dy);
            if (b && b.built && b.def.kind === 'storage')
                return b;
        }
        return null;
    }

    // the walkable tiles around every storage, where the flow field starts
    private FlowSources(): number[]
    {
        const world = this.world;
        const sources: number[] = [];
        for (const s of this.storages)
        for (let y = s.y - 1; y <= s.y + s.def.h; y++)
        for (let x = s.x - 1; x <= s.x + s.def.w; x++)
        {
            if (!world.InBounds(x, y))
                continue;
            const i = world.Index(x, y);
            if (world.Walkable(i))
                sources.push(i);
        }
        return sources;
    }

    // ---- machines and belts ----

    private UpdateMachine(b: Building)
    {
        const def = b.def;
        if (def.kind === 'crafter')
        {
            const recipe = def.recipe!;
            if (b.progress < 0)
            {
                if (b.out + recipe.outputCount <= OUT_CAP && recipe.inputs.every(([item, count]) => b.inv[item] >= count))
                {
                    for (const [item, count] of recipe.inputs)
                        b.inv[item] -= count;
                    b.progress = 0;
                }
            }
            else if (++b.progress >= recipe.ticks)
            {
                b.out += recipe.outputCount;
                this.produced[recipe.output] += recipe.outputCount;
                b.progress = -1;
            }
        }
        else if (def.kind === 'drill')
        {
            if (b.out < OUT_CAP && !b.depleted && ++b.timer >= def.mineTicks)
            {
                b.timer = 0;
                const world = this.world;
                const i = world.Index(b.x, b.y);
                if (world.resAmount[i] > 0)
                {
                    b.outItem = RES_ITEM[world.res[i]];
                    b.out++;
                    this.produced[b.outItem]++;
                    this.drillMined++;
                    world.resAmount[i]--;
                    if (world.resAmount[i] === 0)
                    {
                        world.SetResource(i, R_NONE, 0);
                        b.depleted = true;
                    }
                }
                else
                    b.depleted = true;
            }
        }
        else if (def.kind === 'farm')
        {
            if (b.stage < 2 && ++b.growth >= def.growTicks)
            {
                b.stage++;
                b.growth = 0;
            }
            return;
        }

        if (b.out > 0)
        {
            const [fx, fy] = b.FrontTile();
            if (this.PushInto(fx, fy, b.dir, b.outItem, 0))
            {
                b.out--;
                b.blockedOut = false;
            }
            else
                b.blockedOut = true;
        }
    }

    private UpdateBelt(b: Building)
    {
        const items = b.belt;
        if (items.length === 0)
            return;

        const front = items[0];
        if (front.tick !== this.tick && front.p + BELT_SPEED >= 1)
        {
            if (this.PushInto(b.x + DX[b.dir], b.y + DY[b.dir], b.dir, front.item, front.p + BELT_SPEED - 1))
                items.shift();
        }

        for (let i = 0; i < items.length; i++)
        {
            const item = items[i];
            if (item.tick === this.tick)
                continue;
            item.tick = this.tick;
            const limit = i === 0 ? 1 : items[i - 1].p - BELT_SPACING;
            const p = Math.max(item.p, Math.min(item.p + BELT_SPEED, limit));
            item.moving = p > item.p;
            item.p = p;
        }
    }

    // ---- workers and jobs ----

    SpawnWorker(): Worker | null
    {
        const hq = this.hq;
        const world = this.world;
        // the first free tile around the HQ
        for (let ring = 1; ring < 6; ring++)
        for (let y = hq.y - ring; y <= hq.y + hq.def.h - 1 + ring; y++)
        for (let x = hq.x - ring; x <= hq.x + hq.def.w - 1 + ring; x++)
        {
            if (!world.InBounds(x, y) || !world.Walkable(world.Index(x, y)))
                continue;
            const id = this.nextId++;
            const worker = new Worker(id, NAMES[(id * 7) % NAMES.length], this.rng.Int(SHIRT_COLORS.length), x, y);
            worker.hunger = this.rng.Int(30);
            this.workers.push(worker);
            return worker;
        }
        return null;
    }

    private TryGrow()
    {
        if (this.workers.length >= this.housing || this.stock[BERRIES] < GROWTH_FOOD * 2)
            return;
        this.TakeAnywhere(BERRIES, GROWTH_FOOD);
        const worker = this.SpawnWorker();
        if (worker)
            this.onMessage(`${worker.name} moved in!`);
    }

    MarkUnreachable(job: Job)
    {
        const key = job.type === 'harvest' || job.type === 'wander' ? job.target : -job.target;
        this.unreachable.set(key, this.tick + UNREACHABLE_RETRY_TICKS);
    }

    private IsUnreachable(key: number): boolean
    {
        const until = this.unreachable.get(key);
        if (until === undefined)
            return false;
        if (until > this.tick)
            return true;
        this.unreachable.delete(key);
        return false;
    }

    MakeJob(type: JobType, target: number, item = 0, count = 0, storage = 0): Job
    {
        return { type, target, item, count, storage, stage: 0, work: 0 };
    }

    // pick the best job for an idle worker and reserve it
    FindJob(worker: Worker): Job | null
    {
        this.stats.jobSearches++;
        const wx = worker.tileX, wy = worker.tileY;

        if (worker.hunger >= 60 && this.stock[BERRIES] > 0)
        {
            const storage = this.NearestStorageWith(wx, wy, BERRIES);
            if (storage)
                return this.MakeJob('eat', 0, BERRIES, 0, storage.id);
        }

        let best: Job | null = null;
        let bestScore = Infinity;
        const consider = (score: number, make: () => Job) => {
            if (score < bestScore)
            {
                bestScore = score;
                best = make();
            }
        };
        const dist = (b: Building) => Math.abs(b.x - wx) + Math.abs(b.y - wy);

        for (const site of this.sites)
        {
            if (this.IsUnreachable(-site.id))
                continue;
            const d = dist(site);
            if (site.MaterialsComplete())
            {
                if (site.builderId === 0)
                    consider(d, () => this.MakeJob('construct', site.id));
                continue;
            }
            for (const [item] of site.def.cost)
            {
                const need = site.MaterialNeeded(item);
                if (need > 0 && this.stock[item] > 0)
                {
                    consider(d + 2, () => this.MakeJob('supply', site.id, item, Math.min(need, CARRY_CAP, this.stock[item])));
                    break;
                }
            }
        }

        for (const m of this.machines)
        {
            if (this.IsUnreachable(-m.id))
                continue;
            const d = dist(m);
            if (m.def.kind === 'farm')
            {
                if (m.stage >= 2 && m.haulerId === 0)
                    consider(d + 6, () => this.MakeJob('farm', m.id));
                continue;
            }
            if (m.out > 0 && m.blockedOut && m.haulerId === 0 && (m.out >= 3 || m.progress < 0))
                consider(d + 6, () => this.MakeJob('haul', m.id));

            const recipe = m.def.recipe;
            // workers only feed crafters that belts aren't feeding
            if (recipe && this.tick - m.lastBeltInput > 200)
            for (const [item] of recipe.inputs)
            {
                const have = m.inv[item] + m.incoming[item];
                if (have < 3 && this.stock[item] > 0)
                {
                    const count = Math.min(INPUT_CAP - have, CARRY_CAP, this.stock[item]);
                    consider(d + 12, () => this.MakeJob('supply', m.id, item, count));
                }
            }
        }

        if (this.designations.size > 0)
        {
            const w = this.world.w;
            let bestTile = -1, bestDist = Infinity;
            for (const t of this.designations)
            {
                if (this.harvestClaims.has(t) || this.IsUnreachable(t))
                    continue;
                const d = Math.abs((t % w) - wx) + Math.abs(((t / w) | 0) - wy);
                if (d < bestDist)
                {
                    bestDist = d;
                    bestTile = t;
                    if (d <= 2)
                        break;
                }
            }
            if (bestTile >= 0)
                consider(bestDist + 20, () => this.MakeJob('harvest', bestTile));
        }

        const job = best as Job | null;
        if (!job)
            return this.WanderJob(worker);

        this.ClaimJob(worker, job);
        return job;
    }

    // a short stroll now and then, so idle colonists don't stand frozen
    private WanderJob(worker: Worker): Job | null
    {
        if (this.rng.Next() > 0.25)
            return null;
        const world = this.world;
        const hq = this.hq;
        // drift back towards home when far away
        const far = Math.abs(worker.tileX - hq.x) + Math.abs(worker.tileY - hq.y) > 12;
        const bx = far ? hq.x : worker.tileX, by = far ? hq.y : worker.tileY;
        for (let tries = 0; tries < 6; tries++)
        {
            const x = bx + this.rng.Int(9) - 4, y = by + this.rng.Int(9) - 4;
            if (world.InBounds(x, y) && world.Walkable(world.Index(x, y)))
                return this.MakeJob('wander', world.Index(x, y));
        }
        return null;
    }

    private ClaimJob(worker: Worker, job: Job)
    {
        const b = this.buildings.get(job.target);
        switch (job.type)
        {
            case 'harvest': this.harvestClaims.set(job.target, worker.id); break;
            case 'supply': b!.incoming[job.item] += job.count; break;
            case 'construct': b!.builderId = worker.id; break;
            case 'haul': case 'farm': b!.haulerId = worker.id; break;
        }
    }

    ReleaseJob(worker: Worker, job: Job)
    {
        const b = this.buildings.get(job.target);
        switch (job.type)
        {
            case 'harvest':
                if (this.harvestClaims.get(job.target) === worker.id)
                    this.harvestClaims.delete(job.target);
                break;
            case 'supply':
                if (b) b.incoming[job.item] -= job.count;
                job.count = 0;
                break;
            case 'construct':
                if (b && b.builderId === worker.id) b.builderId = 0;
                break;
            case 'haul': case 'farm':
                if (b && b.haulerId === worker.id) b.haulerId = 0;
                break;
        }
    }
}

function Remove<T>(list: T[], item: T): boolean
{
    const index = list.indexOf(item);
    if (index < 0)
        return false;
    list.splice(index, 1);
    return true;
}
