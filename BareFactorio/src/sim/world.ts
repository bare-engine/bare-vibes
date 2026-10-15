import { BERRIES, IRON_ORE, STONE, WOOD } from './items';
import { Hash2, ValueNoise } from './rng';

export const TILE = 16;
export const CHUNK = 32;

export const T_WATER = 0;
export const T_SAND = 1;
export const T_GRASS = 2;
export const T_FOREST = 3;
export const T_DIRT = 4;
export const T_STONE = 5;
export const TERRAIN_LABELS = ['Water', 'Sand', 'Grass', 'Forest floor', 'Dirt', 'Stony ground'];

export const R_NONE = 0;
export const R_TREE = 1;
export const R_ROCK = 2;
export const R_IRON = 3;
export const R_BERRY = 4;
export const RES_KEYS = ['', 'tree', 'rock', 'iron', 'berry'];
export const RES_LABELS = ['', 'Tree', 'Boulder', 'Iron ore', 'Berry bush'];
export const RES_ITEM = [0, WOOD, STONE, IRON_ORE, BERRIES];
// items a worker gets per harvesting trip, and how long the trip's work takes in ticks
export const RES_YIELD = [0, 4, 3, 3, 3];
export const RES_WORK_TICKS = [0, 50, 60, 70, 25];

// The world is a set of flat typed arrays, one value per tile. Chunks only exist for rendering:
// each tile change bumps its chunk's version, so the renderer knows what to bake again.
export class World
{
    readonly size: number;
    readonly chunksX: number;
    readonly chunksY: number;

    terrain: Uint8Array;
    res: Uint8Array;
    resAmount: Uint16Array;
    // building id per tile, 0 for none
    building: Int32Array;
    // 1 where a building blocks walking
    solid: Uint8Array;
    designated: Uint8Array;

    chunkVersion: Uint32Array;
    // bumped whenever walkability changes, so path caches know to refresh
    navVersion = 0;
    // tiles whose walkability changed, for the pathfinder to catch up on. Cleared by whoever reads it
    navChanges: number[] = [];

    constructor(readonly w: number, readonly h: number, public seed: number)
    {
        this.size = w * h;
        this.chunksX = Math.ceil(w / CHUNK);
        this.chunksY = Math.ceil(h / CHUNK);
        this.terrain = new Uint8Array(this.size);
        this.res = new Uint8Array(this.size);
        this.resAmount = new Uint16Array(this.size);
        this.building = new Int32Array(this.size);
        this.solid = new Uint8Array(this.size);
        this.designated = new Uint8Array(this.size);
        this.chunkVersion = new Uint32Array(this.chunksX * this.chunksY);
    }

    Index(x: number, y: number): number
    {
        return y * this.w + x;
    }

    InBounds(x: number, y: number): boolean
    {
        return x >= 0 && y >= 0 && x < this.w && y < this.h;
    }

    Walkable(i: number): boolean
    {
        if (this.terrain[i] === T_WATER || this.solid[i])
            return false;
        const r = this.res[i];
        return r === R_NONE || r === R_IRON;
    }

    ChunkOf(i: number): number
    {
        const x = i % this.w, y = (i / this.w) | 0;
        return ((y / CHUNK) | 0) * this.chunksX + ((x / CHUNK) | 0);
    }

    // call after changing a tile, for rendering and pathfinding
    TouchTile(i: number, navChanged: boolean)
    {
        this.chunkVersion[this.ChunkOf(i)]++;
        if (navChanged)
        {
            this.navVersion++;
            this.navChanges.push(i);
        }
    }

    SetResource(i: number, res: number, amount: number)
    {
        const wasWalkable = this.Walkable(i);
        this.res[i] = res;
        this.resAmount[i] = amount;
        if (res === R_NONE)
            this.designated[i] = 0;
        this.TouchTile(i, wasWalkable !== this.Walkable(i));
    }

    Generate()
    {
        const s = this.seed;
        const elevation = new ValueNoise(s + 1);
        const moisture = new ValueNoise(s + 2);
        const rocky = new ValueNoise(s + 3);
        const ore = new ValueNoise(s + 4);
        const dirt = new ValueNoise(s + 5);
        const cx = this.w >> 1, cy = this.h >> 1;

        for (let y = 0; y < this.h; y++)
        for (let x = 0; x < this.w; x++)
        {
            const i = this.Index(x, y);
            const e = elevation.Fbm(x / 48, y / 48, 5);
            const m = moisture.Fbm(x / 32, y / 32, 4);
            const r = rocky.Fbm(x / 22, y / 22, 3);
            const o = ore.Fbm(x / 14, y / 14, 3);
            const d = dirt.Fbm(x / 20, y / 20, 3);
            const h = Hash2(x, y, s);

            let terrain = T_GRASS;
            let res = R_NONE;
            let amount = 0;

            if (e < 0.34)
                terrain = T_WATER;
            else if (e < 0.375)
                terrain = T_SAND;
            else if (r > 0.66)
            {
                terrain = T_STONE;
                if (h < 0.3) { res = R_ROCK; amount = 12 + Math.floor(Hash2(y, x, s) * 20); }
            }
            else if (o > 0.7)
            {
                terrain = T_DIRT;
                res = R_IRON;
                amount = 120 + Math.floor(Hash2(y, x, s + 7) * 280);
            }
            else if (m > 0.56)
            {
                terrain = T_FOREST;
                if (h < 0.5) { res = R_TREE; amount = RES_YIELD[R_TREE]; }
            }
            else
            {
                if (d > 0.68) terrain = T_DIRT;
                if (h < 0.025) { res = R_TREE; amount = RES_YIELD[R_TREE]; }
                else if (h < 0.035) { res = R_BERRY; amount = RES_YIELD[R_BERRY]; }
            }

            this.terrain[i] = terrain;
            this.res[i] = res;
            this.resAmount[i] = amount;
        }

        this.PrepareSpawn(cx, cy);
        this.chunkVersion.fill(1);
        this.navVersion++;
    }

    // a dry clearing around the HQ, with a little of everything close by
    private PrepareSpawn(cx: number, cy: number)
    {
        const s = this.seed;
        for (let y = cy - 16; y <= cy + 16; y++)
        for (let x = cx - 16; x <= cx + 16; x++)
        {
            if (!this.InBounds(x, y))
                continue;
            const i = this.Index(x, y);
            const dist = Math.hypot(x - cx, y - cy);
            if (dist <= 7)
            {
                this.terrain[i] = T_GRASS;
                this.res[i] = R_NONE;
                this.resAmount[i] = 0;
            }
            else if (dist <= 16 && this.terrain[i] === T_WATER)
                this.terrain[i] = dist < 13 ? T_GRASS : T_SAND;
        }

        const patch = (px: number, py: number, radius: number, terrain: number, res: number, amount: () => number, density: number) => {
            for (let y = py - radius; y <= py + radius; y++)
            for (let x = px - radius; x <= px + radius; x++)
            {
                if (!this.InBounds(x, y) || Math.hypot(x - px, y - py) > radius + 0.3)
                    continue;
                const i = this.Index(x, y);
                this.terrain[i] = terrain;
                if (Hash2(x, y, s + 99) < density)
                {
                    this.res[i] = res;
                    this.resAmount[i] = amount();
                }
            }
        };

        patch(cx + 11, cy - 7, 3, T_DIRT, R_IRON, () => 250, 1);
        patch(cx - 12, cy + 6, 3, T_STONE, R_ROCK, () => 25, 0.5);
        patch(cx - 9, cy - 10, 4, T_FOREST, R_TREE, () => RES_YIELD[R_TREE], 0.55);
        patch(cx + 10, cy + 10, 4, T_FOREST, R_TREE, () => RES_YIELD[R_TREE], 0.55);
        patch(cx + 2, cy + 12, 2, T_GRASS, R_BERRY, () => RES_YIELD[R_BERRY], 0.4);
    }
}
