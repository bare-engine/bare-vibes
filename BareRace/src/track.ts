import { TileMap, type Scene } from 'bare-engine';
import { Asset, Data } from './generated/assets';

export const TILE = 128;

// half the drivable width of a road tile, curbs included
const ROAD_HALF_WIDTH = 60;

type Point = { x: number, y: number };

// directions: 0 = north, 1 = east, 2 = south, 3 = west
const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];

type TileKind = { texture: string, dirs: [number, number] };

// each road character and the two sides it connects
const TILE_KINDS: Record<string, TileKind> = {
    '-': { texture: Asset.Image.ROAD_ASPHALT02, dirs: [1, 3] },
    '|': { texture: Asset.Image.ROAD_ASPHALT01, dirs: [0, 2] },
    'F': { texture: Asset.Image.ROAD_ASPHALT43, dirs: [1, 3] },
    '┌': { texture: Asset.Image.ROAD_ASPHALT03, dirs: [1, 2] },
    '┐': { texture: Asset.Image.ROAD_ASPHALT05, dirs: [3, 2] },
    '└': { texture: Asset.Image.ROAD_ASPHALT39, dirs: [0, 1] },
    '┘': { texture: Asset.Image.ROAD_ASPHALT41, dirs: [0, 3] },
};

// the race runs clockwise, starting east over the finish line F
export const TRACK_LAYOUT = [
    '..................',
    '..................',
    '.┌------F-------┐.',
    '.|..............|.',
    '.|..┌---┐.......|.',
    '.|..|...|...┌---┘.',
    '.|..|...|...|.....',
    '.└┐.|...└---┘.....',
    '..|.|.............',
    '..|.└----------┐..',
    '..|............|..',
    '..└------------┘..',
    '..................',
];

type RoadTile = {
    col: number,
    row: number,
    kind: TileKind,
    // set on corners: the tile corner the curve bends around
    arcCenter?: Point,
};

export type Decoration = {
    image: string,
    x: number,       // in tiles
    y: number,
    rotation?: number,
    scale?: number,
    // radius in game units of a solid circle cars bump into
    solid?: number,
};

export type SolidCircle = { x: number, y: number, radius: number };

export class Track
{
    readonly cols: number;
    readonly rows: number;
    readonly width: number;
    readonly height: number;

    // the centerline, one point per road tile, starting on the finish line
    readonly waypoints: Point[] = [];
    readonly solids: SolidCircle[] = [];

    private tiles = new Map<string, RoadTile>();
    private startDir = 1;

    constructor(private layout: string[])
    {
        // spread into code points, so the box drawing characters count as one column
        const grid = layout.map(line => [...line]);
        this.rows = grid.length;
        this.cols = Math.max(...grid.map(row => row.length));
        this.width = this.cols * TILE;
        this.height = this.rows * TILE;

        let start: RoadTile | undefined;
        grid.forEach((line, row) => line.forEach((char, col) => {
            const kind = TILE_KINDS[char];
            if (!kind)
                return;

            const tile: RoadTile = { col, row, kind };
            if (char == '┌' || char == '┐' || char == '└' || char == '┘')
            {
                const [a, b] = kind.dirs;
                tile.arcCenter = {
                    x: (col + 0.5 + (DX[a] + DX[b]) * 0.5) * TILE,
                    y: (row + 0.5 + (DY[a] + DY[b]) * 0.5) * TILE,
                };
            }
            this.tiles.set(`${col},${row}`, tile);
            if (char == 'F')
                start = tile;
        }));

        assert(start != undefined, 'The track needs a finish line tile F');
        this.BuildWaypoints(start!);
    }

    // walk the loop from the finish line, adding a point per tile
    private BuildWaypoints(start: RoadTile)
    {
        let tile = start;
        let dir = this.startDir;

        do
        {
            this.waypoints.push(this.GetTileMidpoint(tile));

            const exit = tile.kind.dirs.find(d => d != (dir + 2) % 4);
            assert(exit != undefined && tile.kind.dirs.includes((dir + 2) % 4), `Track tile ${tile.col},${tile.row} doesn't connect`);

            dir = exit!;
            const next = this.tiles.get(`${tile.col + DX[dir]},${tile.row + DY[dir]}`);
            assert(next != undefined, `Track breaks off after tile ${tile.col},${tile.row}`);
            tile = next!;
        }
        while (tile != start);
    }

    private GetTileMidpoint(tile: RoadTile): Point
    {
        const cx = (tile.col + 0.5) * TILE;
        const cy = (tile.row + 0.5) * TILE;
        if (!tile.arcCenter)
            return { x: cx, y: cy };

        // halfway along the curve
        const dx = cx - tile.arcCenter.x;
        const dy = cy - tile.arcCenter.y;
        const length = Math.hypot(dx, dy);
        return {
            x: tile.arcCenter.x + dx / length * TILE / 2,
            y: tile.arcCenter.y + dy / length * TILE / 2,
        };
    }

    Build(scene: Scene, decorations: Decoration[])
    {
        // grass everywhere, then the road on top: the curves are see-through outside the asphalt
        const grass = scene.AddGameObject(TileMap, Data.Layer.GROUND)
            .SetTileSize(TILE)
            .Resize(this.cols, this.rows)
            .Fill(0, 0, this.cols, this.rows, Asset.Image.LAND_GRASS11);

        const road = scene.AddGameObject(TileMap, Data.Layer.GROUND)
            .SetTileSize(TILE)
            .Resize(this.cols, this.rows);
        for (const tile of this.tiles.values())
            road.SetTile(tile.col, tile.row, tile.kind.texture);

        for (const deco of decorations)
        {
            scene.AddGameObject(deco.image, Data.Layer.DECOR)
                .CenterPivot()
                .SetPosition(deco.x * TILE, deco.y * TILE)
                .SetRotation(deco.rotation ?? 0)
                .SetScale(deco.scale ?? 1);

            if (deco.solid)
                this.solids.push({ x: deco.x * TILE, y: deco.y * TILE, radius: deco.solid });
        }
    }

    IsOnRoad(x: number, y: number): boolean
    {
        const tile = this.tiles.get(`${Math.floor(x / TILE)},${Math.floor(y / TILE)}`);
        if (!tile)
            return false;

        if (tile.arcCenter)
            return Math.abs(Math.hypot(x - tile.arcCenter.x, y - tile.arcCenter.y) - TILE / 2) <= ROAD_HALF_WIDTH;

        const vertical = tile.kind.dirs.includes(0);
        const offset = vertical ? x - (tile.col + 0.5) * TILE : y - (tile.row + 0.5) * TILE;
        return Math.abs(offset) <= ROAD_HALF_WIDTH;
    }

    // the waypoint before index i, wrapping around
    Prev(i: number): number
    {
        return (i - 1 + this.waypoints.length) % this.waypoints.length;
    }

    Next(i: number): number
    {
        return (i + 1) % this.waypoints.length;
    }

    // the point `distance` further along the centerline, starting from `from` on the segment toward waypoint `nextIndex`
    PointAhead(from: Point, nextIndex: number, distance: number): Point
    {
        let point = from;
        let index = nextIndex;
        for (let guard = 0; guard < this.waypoints.length; guard++)
        {
            const target = this.waypoints[index];
            const segment = Math.hypot(target.x - point.x, target.y - point.y);
            if (segment >= distance)
            {
                const t = distance / segment;
                return { x: point.x + (target.x - point.x) * t, y: point.y + (target.y - point.y) * t };
            }
            distance -= segment;
            point = target;
            index = this.Next(index);
        }
        return point;
    }

    // the direction of travel at the finish line, in degrees
    get startHeading(): number
    {
        return Math.atan2(DY[this.startDir], DX[this.startDir]) * 180 / Math.PI;
    }
}
