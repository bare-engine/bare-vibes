import type { World } from './world';

const SQRT2 = Math.SQRT2;
// neighbor offsets: 4 straight, then 4 diagonal
const NX = [1, -1, 0, 0, 1, 1, -1, -1];
const NY = [0, 0, 1, -1, 1, -1, 1, -1];
const NCOST = [1, 1, 1, 1, SQRT2, SQRT2, SQRT2, SQRT2];
const FLOW_MAX_DISTANCE = 120;

// A min-heap of tile indices keyed by a float priority, on typed arrays so a search allocates nothing
class TileHeap
{
    private nodes: Int32Array;
    private keys: Float32Array;
    size = 0;

    constructor(capacity: number)
    {
        this.nodes = new Int32Array(capacity);
        this.keys = new Float32Array(capacity);
    }

    Clear() { this.size = 0; }

    Push(node: number, key: number)
    {
        if (this.size >= this.nodes.length)
        {
            const nodes = new Int32Array(this.nodes.length * 2); nodes.set(this.nodes); this.nodes = nodes;
            const keys = new Float32Array(this.keys.length * 2); keys.set(this.keys); this.keys = keys;
        }
        let i = this.size++;
        const nodesArr = this.nodes, keysArr = this.keys;
        while (i > 0)
        {
            const parent = (i - 1) >> 1;
            if (keysArr[parent] <= key) break;
            nodesArr[i] = nodesArr[parent];
            keysArr[i] = keysArr[parent];
            i = parent;
        }
        nodesArr[i] = node;
        keysArr[i] = key;
    }

    PeekKey(): number { return this.keys[0]; }

    Pop(): number
    {
        const nodesArr = this.nodes, keysArr = this.keys;
        const top = nodesArr[0];
        const lastNode = nodesArr[--this.size];
        const lastKey = keysArr[this.size];
        let i = 0;
        const half = this.size >> 1;
        while (i < half)
        {
            let child = 2 * i + 1;
            if (child + 1 < this.size && keysArr[child + 1] < keysArr[child]) child++;
            if (keysArr[child] >= lastKey) break;
            nodesArr[i] = nodesArr[child];
            keysArr[i] = keysArr[child];
            i = child;
        }
        nodesArr[i] = lastNode;
        keysArr[i] = lastKey;
        return top;
    }
}

// A target area: reach a tile inside it, or (adjacent) a walkable tile touching it
export interface Goal
{
    x: number;
    y: number;
    w: number;
    h: number;
    adjacent: boolean;
}

export function GoalAt(x: number, y: number, w = 1, h = 1, adjacent = true): Goal
{
    return { x, y, w, h, adjacent };
}

export function IsAtGoal(x: number, y: number, goal: Goal): boolean
{
    const inside = x >= goal.x && y >= goal.y && x < goal.x + goal.w && y < goal.y + goal.h;
    if (!goal.adjacent)
        return inside;
    if (inside)
        return false;
    return x >= goal.x - 1 && y >= goal.y - 1 && x <= goal.x + goal.w && y <= goal.y + goal.h;
}

// diagonal steps may not cut a blocked corner
function CanStep(world: World, x: number, y: number, dir: number): boolean
{
    const nx = x + NX[dir], ny = y + NY[dir];
    if (nx < 0 || ny < 0 || nx >= world.w || ny >= world.h)
        return false;
    if (!world.Walkable(ny * world.w + nx))
        return false;
    if (dir >= 4)
        return world.Walkable(y * world.w + nx) && world.Walkable(ny * world.w + x);
    return true;
}

// Labels every walkable tile with the area it belongs to, so A* can refuse an unreachable target
// without searching the whole map. Opening a tile (a tree cut down) can only join areas, which a
// union-find does at once. Closing one (a building finished) may split an area; that's only known by
// labeling everything again, which runs in the background over several ticks. Until then the old
// labels are used: at worst they call two areas connected that no longer are, and A* finds out.
export class WalkableAreas
{
    private label: Int32Array;
    private union: number[] = [0];
    private work: Int32Array;
    private stack: Int32Array;
    private top = 0;
    private scan = 0;
    private nextLabel = 1;
    private initialized = false;
    private stale = false;
    private relabeling = false;
    private changedWhileRelabeling: number[] = [];

    stats = { relabels: 0, ms: 0, lastTicks: 0 };
    private relabelTicks = 0;

    constructor(private world: World)
    {
        this.label = new Int32Array(world.size);
        this.work = new Int32Array(world.size);
        this.stack = new Int32Array(world.size);
    }

    private Find(id: number): number
    {
        const union = this.union;
        let root = id;
        while (union[root] !== root)
            root = union[root];
        while (union[id] !== root)
        {
            const next = union[id];
            union[id] = root;
            id = next;
        }
        return root;
    }

    // the area of a tile, 0 when it's blocked
    Area(i: number): number
    {
        const l = this.label[i];
        return l === 0 ? 0 : this.Find(l);
    }

    // catch up on the tiles that changed since last time
    Sync()
    {
        const start = performance.now();
        if (!this.initialized)
        {
            this.initialized = true;
            this.world.navChanges.length = 0;
            this.RelabelAll();
        }
        const changes = this.world.navChanges;
        for (const i of changes)
        {
            this.Apply(i);
            if (this.relabeling)
                this.changedWhileRelabeling.push(i);
        }
        changes.length = 0;
        this.stats.ms += performance.now() - start;
    }

    private Apply(i: number)
    {
        const world = this.world;
        if (!world.Walkable(i))
        {
            if (this.label[i] !== 0)
            {
                this.label[i] = 0;
                this.stale = true;
            }
            return;
        }
        const x = i % world.w, y = (i / world.w) | 0;
        let area = 0;
        for (let d = 0; d < 4; d++)
        {
            const nx = x + NX[d], ny = y + NY[d];
            if (nx < 0 || ny < 0 || nx >= world.w || ny >= world.h)
                continue;
            const l = this.label[ny * world.w + nx];
            if (l === 0)
                continue;
            const root = this.Find(l);
            if (area === 0)
                area = root;
            else if (root !== area)
                this.union[root] = area;
        }
        if (area === 0)
        {
            area = this.union.length;
            this.union.push(area);
        }
        this.label[i] = area;
    }

    // spend up to `budget` tiles on relabeling, when an area may have split
    Step(budget: number)
    {
        this.Sync();
        if (!this.relabeling)
        {
            if (!this.stale)
                return;
            this.stale = false;
            this.relabeling = true;
            this.relabelTicks = 0;
            this.work.fill(0);
            this.scan = 0;
            this.top = 0;
            this.nextLabel = 1;
            this.changedWhileRelabeling.length = 0;
        }
        const start = performance.now();
        this.relabelTicks++;
        if (this.Flood(budget))
            this.Publish();
        this.stats.ms += performance.now() - start;
    }

    private RelabelAll()
    {
        this.work.fill(0);
        this.scan = 0;
        this.top = 0;
        this.nextLabel = 1;
        this.Flood(Infinity);
        this.Publish();
    }

    // flood fill into `work`, resumable. Returns true when every tile is labeled
    private Flood(budget: number): boolean
    {
        const world = this.world, w = world.w, h = world.h;
        const work = this.work, stack = this.stack;
        let done = 0;
        while (done < budget)
        {
            if (this.top === 0)
            {
                // start the next area at the next unlabeled walkable tile
                while (this.scan < world.size && (work[this.scan] !== 0 || !world.Walkable(this.scan)))
                    this.scan++;
                if (this.scan >= world.size)
                    return true;
                work[this.scan] = this.nextLabel++;
                stack[this.top++] = this.scan;
            }
            const t = stack[--this.top];
            const label = work[t];
            const x = t % w, y = (t / w) | 0;
            for (let d = 0; d < 4; d++)
            {
                const nx = x + NX[d], ny = y + NY[d];
                if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
                const n = ny * w + nx;
                if (work[n] === 0 && world.Walkable(n))
                {
                    work[n] = label;
                    stack[this.top++] = n;
                }
            }
            done++;
        }
        return false;
    }

    private Publish()
    {
        const old = this.label;
        this.label = this.work;
        this.work = old;
        this.union = Array.from({ length: this.nextLabel }, (_, i) => i);
        this.relabeling = false;
        this.stats.relabels++;
        this.stats.lastTicks = this.relabelTicks;
        // changes the flood may have seen half of: apply them again on the new labels
        for (const i of this.changedWhileRelabeling)
            this.Apply(i);
        this.changedWhileRelabeling.length = 0;
    }
}

export class Pathfinder
{
    private g: Float32Array;
    private parent: Int32Array;
    private seen: Uint32Array;
    private closed: Uint32Array;
    private generation = 0;
    private heap: TileHeap;

    // which tiles can reach each other, to give up at once on targets that can't be reached
    readonly areas: WalkableAreas;

    stats = { calls: 0, failures: 0, expanded: 0, ms: 0 };

    constructor(private world: World)
    {
        this.g = new Float32Array(world.size);
        this.parent = new Int32Array(world.size);
        this.seen = new Uint32Array(world.size);
        this.closed = new Uint32Array(world.size);
        this.heap = new TileHeap(1024);
        this.areas = new WalkableAreas(world);
    }

    // the walkable area a tile belongs to. A blocked tile (a worker standing in a new building) uses a free neighbor's
    private ComponentAt(x: number, y: number): number
    {
        const world = this.world;
        const own = this.areas.Area(y * world.w + x);
        if (own !== 0)
            return own;
        for (let d = 0; d < 8; d++)
        {
            const nx = x + NX[d], ny = y + NY[d];
            const area = world.InBounds(nx, ny) ? this.areas.Area(ny * world.w + nx) : 0;
            if (area !== 0)
                return area;
        }
        return 0;
    }

    private GoalReachable(startComp: number, goal: Goal): boolean
    {
        const world = this.world;
        const x0 = goal.adjacent ? goal.x - 1 : goal.x, y0 = goal.adjacent ? goal.y - 1 : goal.y;
        const x1 = goal.adjacent ? goal.x + goal.w : goal.x + goal.w - 1, y1 = goal.adjacent ? goal.y + goal.h : goal.y + goal.h - 1;
        for (let y = y0; y <= y1; y++)
        for (let x = x0; x <= x1; x++)
            if (world.InBounds(x, y) && IsAtGoal(x, y, goal) && this.areas.Area(y * world.w + x) === startComp)
                return true;
        return false;
    }

    // Returns the tiles to walk, without the start tile, or null when there is no way
    Find(sx: number, sy: number, goal: Goal, maxExpanded = 40000): Int32Array | null
    {
        const start = performance.now();
        this.stats.calls++;

        const result = this.Search(sx, sy, goal, maxExpanded);

        this.stats.ms += performance.now() - start;
        if (!result)
            this.stats.failures++;
        return result;
    }

    private Search(sx: number, sy: number, goal: Goal, maxExpanded: number): Int32Array | null
    {
        if (IsAtGoal(sx, sy, goal))
            return new Int32Array(0);

        this.areas.Sync();
        const startComp = this.ComponentAt(sx, sy);
        if (startComp === 0 || !this.GoalReachable(startComp, goal))
            return null;

        const world = this.world;
        const w = world.w;
        const gen = ++this.generation;
        const g = this.g, parent = this.parent, seen = this.seen, closed = this.closed;
        const heap = this.heap;
        heap.Clear();

        // aim at the nearest point of the goal area
        const gx0 = goal.x, gy0 = goal.y, gx1 = goal.x + goal.w - 1, gy1 = goal.y + goal.h - 1;
        const heuristic = (x: number, y: number) => {
            const dx = x < gx0 ? gx0 - x : x > gx1 ? x - gx1 : 0;
            const dy = y < gy0 ? gy0 - y : y > gy1 ? y - gy1 : 0;
            const octile = Math.max(dx, dy) + (SQRT2 - 1) * Math.min(dx, dy);
            return goal.adjacent ? Math.max(0, octile - 1) : octile;
        };

        const startIndex = sy * w + sx;
        g[startIndex] = 0;
        seen[startIndex] = gen;
        parent[startIndex] = -1;
        heap.Push(startIndex, heuristic(sx, sy));

        let expanded = 0;
        while (heap.size > 0)
        {
            const current = heap.Pop();
            if (closed[current] === gen)
                continue;
            closed[current] = gen;
            const x = current % w, y = (current / w) | 0;

            if (IsAtGoal(x, y, goal))
            {
                this.stats.expanded += expanded;
                return this.Rebuild(current);
            }

            if (++expanded > maxExpanded)
                break;

            const gCurrent = g[current];
            for (let d = 0; d < 8; d++)
            {
                if (!CanStep(world, x, y, d))
                    continue;
                const n = current + NY[d] * w + NX[d];
                if (closed[n] === gen)
                    continue;
                const cost = gCurrent + NCOST[d];
                if (seen[n] !== gen || cost < g[n])
                {
                    seen[n] = gen;
                    g[n] = cost;
                    parent[n] = current;
                    heap.Push(n, cost + heuristic(x + NX[d], y + NY[d]));
                }
            }
        }

        this.stats.expanded += expanded;
        return null;
    }

    private Rebuild(end: number): Int32Array
    {
        let length = 0;
        for (let n = end; this.parent[n] !== -1; n = this.parent[n])
            length++;
        const path = new Int32Array(length);
        for (let n = end, i = length - 1; this.parent[n] !== -1; n = this.parent[n], i--)
            path[i] = n;
        return path;
    }
}

// Distance from every tile to the nearest source (the tiles next to storage), so any number of
// workers can walk "home" by stepping downhill, without searching a path each. It's rebuilt over
// several ticks with a budget, and the previous field is used until the new one is done.
export class FlowField
{
    dist: Float32Array;
    private work: Float32Array;
    private heap: TileHeap;
    private computing = false;
    private dirty = true;

    stats = { rebuilds: 0, ms: 0, lastMs: 0, ticksForLast: 0 };
    private buildStartTick = 0;
    private buildMs = 0;

    constructor(private world: World, private GetSources: () => number[])
    {
        this.dist = new Float32Array(world.size).fill(Infinity);
        this.work = new Float32Array(world.size);
        this.heap = new TileHeap(4096);
    }

    Invalidate()
    {
        this.dirty = true;
    }

    get ready(): boolean
    {
        return !this.dirty && !this.computing;
    }

    // process up to `budget` tiles
    Step(budget: number, tick: number)
    {
        if (!this.computing)
        {
            if (!this.dirty)
                return;
            this.dirty = false;
            this.computing = true;
            this.buildStartTick = tick;
            this.buildMs = 0;
            this.work.fill(Infinity);
            this.heap.Clear();
            for (const s of this.GetSources())
            {
                this.work[s] = 0;
                this.heap.Push(s, 0);
            }
        }

        const start = performance.now();
        const world = this.world, w = world.w, work = this.work, heap = this.heap;
        let processed = 0;
        while (heap.size > 0 && processed < budget)
        {
            const key = heap.PeekKey();
            const current = heap.Pop();
            if (key > work[current])
                continue;
            processed++;
            const x = current % w, y = (current / w) | 0;
            for (let d = 0; d < 8; d++)
            {
                if (!CanStep(world, x, y, d))
                    continue;
                const n = current + NY[d] * w + NX[d];
                const cost = key + NCOST[d];
                // workers further away than this search their way home with A* instead
                if (cost < work[n] && cost <= FLOW_MAX_DISTANCE)
                {
                    work[n] = cost;
                    heap.Push(n, cost);
                }
            }
        }
        const ms = performance.now() - start;
        this.buildMs += ms;
        this.stats.ms += ms;

        if (heap.size === 0)
        {
            const done = this.dist;
            this.dist = this.work;
            this.work = done;
            this.computing = false;
            this.stats.rebuilds++;
            this.stats.lastMs = this.buildMs;
            this.stats.ticksForLast = tick - this.buildStartTick + 1;
        }
    }

    // the next tile to step to from (x, y), the tile itself when it's a source, or -1 when there's no way
    Next(x: number, y: number): number
    {
        const world = this.world, w = world.w;
        const i = y * w + x;
        const here = this.dist[i];
        if (here === 0)
            return i;

        let best = -1;
        let bestDist = here === Infinity ? Infinity : here;
        for (let d = 0; d < 8; d++)
        {
            if (!CanStep(world, x, y, d))
                continue;
            const n = i + NY[d] * w + NX[d];
            const nd = this.dist[n] + NCOST[d] * 0.001;
            if (nd < bestDist)
            {
                bestDist = nd;
                best = n;
            }
        }
        return best;
    }
}
