import { Color, GameObject, SerializeField, Texture, TiledComponent } from 'bare-engine';
import { ArcadeObject } from 'bare-engine/arcade';

// Tiles for walls and hazards: a plain fill, with the shaded tile only along the bottom where it
// faces open ground. Where another wall or hazard sits right below, the edge isn't visible.
export class WallTilesComponent extends TiledComponent
{
    // plain texture stretched over everything but the open bottom edge
    @SerializeField
    fillTexture = '';

    override RenderTiles(color: Color, matrixIndex: number)
    {
        const texture = this.go.texture;
        const fill = this.fillTexture ? bare.asset.GetTexture(this.fillTexture) : null;
        if (!texture || !fill)
        {
            super.RenderTiles(color, matrixIndex);
            return;
        }

        // drawn in texture space: the object covers 0..w, 0..h
        const w = texture.width;
        const h = texture.height;
        const tilesY = Math.abs(this.go.scale.y) / this.tileScale;
        const rowTop = h - h / Math.max(1, tilesY);

        this.DrawQuad(fill, 0, 0, w, h, color, matrixIndex);

        // stretched sideways, since every row of the tile is a single color
        for (const [x1, x2] of this.GetOpenEdges())
            this.DrawQuad(texture, x1 * w, rowTop, x2 * w, h, color, matrixIndex);
    }

    // parts of the bottom edge, as fractions of the width, with no other wall, hazard or pad right below
    private GetOpenEdges(): [number, number][]
    {
        const bounds = this.go.GetBounds();
        const bottom = bounds.y + bounds.height + 0.5;
        let open: [number, number][] = [[bounds.x, bounds.x + bounds.width]];

        for (const other of bare.object.GetAll())
        {
            if (other === this.go || !WallTilesComponent.IsTiledBlock(other))
                continue;

            const o = other.GetBounds();
            if (o.y > bottom || o.y + o.height <= bottom)
                continue;

            const next: [number, number][] = [];
            for (const [x1, x2] of open)
            {
                if (o.x > x1) next.push([x1, Math.min(x2, o.x)]);
                if (o.x + o.width < x2) next.push([Math.max(x1, o.x + o.width), x2]);
            }
            open = next.filter(([x1, x2]) => x2 - x1 > 0.01);
        }

        return open.map(([x1, x2]) => [(x1 - bounds.x) / bounds.width, (x2 - bounds.x) / bounds.width]);
    }

    // walls, hazards and boost pads, but not the grass, which lies under everything
    static IsTiledBlock(obj: GameObject): boolean
    {
        return obj instanceof ArcadeObject && (obj.HasComponent(WallTilesComponent) || obj.HasComponent(TiledComponent));
    }

    private DrawQuad(texture: Texture, x1: number, y1: number, x2: number, y2: number, color: Color, matrixIndex: number)
    {
        bare.drawGraphic({
            points: [
                { x: x1, y: y1 }, { x: x2, y: y1 }, { x: x2, y: y2 },
                { x: x1, y: y1 }, { x: x2, y: y2 }, { x: x1, y: y2 },
            ],
            uv: [
                { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 },
                { x: 0, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 },
            ],
            texture,
            color,
            customMatrix: matrixIndex,
        });
    }
}
