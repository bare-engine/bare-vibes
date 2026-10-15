import { TileMap, type Scene } from 'bare-engine';
import { Asset } from '../generated/assets';
import { Hash2 } from '../sim/rng';
import { CHUNK, R_BERRY, R_IRON, R_NONE, R_ROCK, R_TREE, T_WATER, TILE, type World } from '../sim/world';

const SHORE = [
    Asset.Image.SHORE_1, Asset.Image.SHORE_2, Asset.Image.SHORE_3, Asset.Image.SHORE_4, Asset.Image.SHORE_5,
    Asset.Image.SHORE_6, Asset.Image.SHORE_7, Asset.Image.SHORE_8, Asset.Image.SHORE_9, Asset.Image.SHORE_10,
    Asset.Image.SHORE_11, Asset.Image.SHORE_12, Asset.Image.SHORE_13, Asset.Image.SHORE_14, Asset.Image.SHORE_15,
];

// Draws the ground, the shorelines and the resources as three tile maps. The maps keep their
// tiles on the GPU and only draw what's on screen. The sim bumps a chunk's version when a tile in
// it changes; that chunk's cells are then copied into the maps again.
// The maps aren't added to a layer: the scene draws them from OnPreRender, under the buildings.
export class GroundRenderer
{
    private terrain: TileMap;
    private shore: TileMap;
    private resources: TileMap;
    private seen = new Uint32Array(0);
    // tileset indices of each resource's variants
    private resourceTiles: number[][] = [];

    stats = { synced: 0 };

    constructor(scene: Scene, private world: World)
    {
        const map = (tileset: string[]) => {
            const tiles = new TileMap(scene).SetTileSize(TILE);
            tiles.tileset = tileset;
            return tiles;
        };

        // indexed by terrain id * 2 + variant
        this.terrain = map([
            Asset.Image.T_WATER_0, Asset.Image.T_WATER_1,
            Asset.Image.T_SAND_0, Asset.Image.T_SAND_1,
            Asset.Image.T_GRASS_0, Asset.Image.T_GRASS_1,
            Asset.Image.T_FOREST_0, Asset.Image.T_FOREST_1,
            Asset.Image.T_DIRT_0, Asset.Image.T_DIRT_1,
            Asset.Image.T_STONE_0, Asset.Image.T_STONE_1,
        ]);
        // indexed by which sides touch land, minus one
        this.shore = map(SHORE);
        this.resources = map([Asset.Image.R_TREE, Asset.Image.R_TREE2, Asset.Image.R_ROCK, Asset.Image.R_IRON, Asset.Image.R_BERRY]);
        this.resourceTiles[R_TREE] = [0, 1];
        this.resourceTiles[R_ROCK] = [2];
        this.resourceTiles[R_IRON] = [3];
        this.resourceTiles[R_BERRY] = [4];

        this.SetWorld(world);
    }

    SetWorld(world: World)
    {
        this.world = world;
        const terrain = new Int32Array(world.size);
        const shore = new Int32Array(world.size);
        const resources = new Int32Array(world.size);
        for (let y = 0; y < world.h; y++)
            for (let x = 0; x < world.w; x++)
            {
                const i = world.Index(x, y);
                terrain[i] = this.TerrainTile(x, y);
                shore[i] = this.ShoreTile(x, y);
                resources[i] = this.ResourceTile(x, y);
            }
        this.terrain.SetTiles(terrain, world.w);
        this.shore.SetTiles(shore, world.w);
        this.resources.SetTiles(resources, world.w);
        this.seen = world.chunkVersion.slice();
    }

    // call from the scene's OnPreRender, so the camera transform is applied
    Draw()
    {
        this.SyncChangedChunks();
        this.terrain.Render();
        this.shore.Render();
        this.resources.Render();
    }

    Destroy()
    {
        this.terrain.ReleaseResources();
        this.shore.ReleaseResources();
        this.resources.ReleaseResources();
    }

    // only resources change while playing; terrain is set when a world is made or loaded
    private SyncChangedChunks()
    {
        const world = this.world;
        for (let ci = 0; ci < this.seen.length; ci++)
        {
            if (this.seen[ci] === world.chunkVersion[ci])
                continue;
            this.seen[ci] = world.chunkVersion[ci];
            this.stats.synced++;

            const x0 = (ci % world.chunksX) * CHUNK, y0 = Math.floor(ci / world.chunksX) * CHUNK;
            const x1 = Math.min(world.w, x0 + CHUNK), y1 = Math.min(world.h, y0 + CHUNK);
            for (let y = y0; y < y1; y++)
                for (let x = x0; x < x1; x++)
                    this.resources.SetTile(x, y, this.ResourceTile(x, y));
        }
    }

    private TerrainTile(x: number, y: number): number
    {
        const world = this.world;
        return world.terrain[world.Index(x, y)] * 2 + (Hash2(x, y, world.seed) < 0.8 ? 0 : 1);
    }

    private ShoreTile(x: number, y: number): number
    {
        const world = this.world;
        if (world.terrain[world.Index(x, y)] !== T_WATER)
            return -1;

        const land = (nx: number, ny: number) => world.InBounds(nx, ny) && world.terrain[world.Index(nx, ny)] !== T_WATER;
        const mask = (land(x, y - 1) ? 1 : 0) | (land(x + 1, y) ? 2 : 0) | (land(x, y + 1) ? 4 : 0) | (land(x - 1, y) ? 8 : 0);
        return mask - 1;
    }

    private ResourceTile(x: number, y: number): number
    {
        const world = this.world;
        const res = world.res[world.Index(x, y)];
        if (res === R_NONE)
            return -1;
        const variants = this.resourceTiles[res];
        return variants[Hash2(y, x, world.seed) < 0.5 ? 0 : variants.length - 1];
    }
}
