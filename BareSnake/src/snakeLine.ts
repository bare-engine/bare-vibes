import { LineTextureMode, Texture, Vec2 } from 'bare-engine';

/**
 * A bendable snake drawn with rapid.drawLine().
 * The path is split by arc length into tail | body x N | head pieces,
 * each piece is its own drawLine with its tile stretched over it.
 *
 * Tiles are expected horizontal: tail pointing left, head pointing right.
 */
export class SnakeLine
{
    /** Path from head (index 0) to tail. */
    points: Vec2[] = [];

    /** Rendered tile size (tiles are square, so this is both line width and tile length). */
    width: number;

    /** Total snake length in pixels. */
    length: number;

    /** Min distance between recorded path points, lower = smoother bends. */
    spacing: number = 2;

    private head: Texture;
    private body: Texture;
    private tail: Texture;

    constructor(head: Texture, body: Texture, tail: Texture, width: number = 64, length: number = 400)
    {
        // drawLine puts v=0 on the +normal side, which is screen-down for a left->right line.
        // Swap the vertical uv range so the tiles aren't drawn upside down.
        this.head = SnakeLine.FlipV(head);
        this.body = SnakeLine.FlipV(body);
        this.tail = SnakeLine.FlipV(tail);
        this.width = width;
        this.length = length;
    }

    private static FlipV(texture: Texture): Texture
    {
        const t = texture.clone();
        [t.uvY, t.uvH] = [t.uvH, t.uvY];
        return t;
    }

    /** Lay the snake out straight, head at position, body trailing in direction. */
    Reset(position: Vec2, direction: Vec2 = Vec2.LEFT): void
    {
        const dir = direction.normalized();
        this.points = [];
        for (let d = 0; d <= this.length + this.spacing; d += this.spacing)
            this.points.push(position.add(dir.multiply(d)));
    }

    /** Move the head, the body follows the recorded path. */
    SetHead(position: Vec2): void
    {
        if (this.points.length == 0)
        {
            this.Reset(position);
            return;
        }

        // points[0] IS THE LIVE HEAD, ONCE IT'S FAR ENOUGH FROM THE LAST RECORDED POINT IT GETS RECORDED
        if (this.points.length >= 2 && position.distanceTo(this.points[1]) < this.spacing)
            this.points[0] = position.clone();
        else if (!position.equals(this.points[0]))
            this.points.unshift(position.clone());

        this.Trim();
    }

    /** Drop path points beyond the snake's length. */
    private Trim(): void
    {
        let dist = 0;
        for (let i = 1; i < this.points.length; i++)
        {
            dist += this.points[i - 1].distanceTo(this.points[i]);
            if (dist >= this.length)
            {
                this.points.length = i + 1;
                return;
            }
        }
    }

    Render(): void
    {
        // DRAW ORDER IS TAIL -> HEAD, MATCHING THE TILES' LEFT -> RIGHT
        const path = this.points.slice().reverse();
        if (path.length < 2)
            return;

        const dist: number[] = [0];
        for (let i = 1; i < path.length; i++)
            dist.push(dist[i - 1] + path[i - 1].distanceTo(path[i]));

        // ONLY RENDER THE LAST `length` PX OF THE PATH (THE PART BEHIND THE HEAD)
        const end = dist[dist.length - 1];
        const start = Math.max(0, end - this.length);
        const total = end - start;
        if (total <= 0)
            return;

        // SHRINK THE END TILES IF THE SNAKE IS SHORTER THAN 3 TILES
        const capLen = Math.min(this.width, total / 3);
        const bodyTotal = total - capLen * 2;
        const bodyCount = Math.max(1, Math.round(bodyTotal / this.width));
        const bodyLen = bodyTotal / bodyCount;

        let d = start;
        this.DrawPiece(path, dist, d, d += capLen, this.tail);
        for (let i = 0; i < bodyCount; i++)
            this.DrawPiece(path, dist, d, d += bodyLen, this.body);
        this.DrawPiece(path, dist, d, end, this.head);
    }

    private DrawPiece(path: Vec2[], dist: number[], from: number, to: number, texture: Texture): void
    {
        const points = SnakeLine.SubPath(path, dist, from, to);
        if (points.length < 2)
            return;

        rapid.drawLine({
            points,
            width: this.width,
            texture,
            textureMode: LineTextureMode.STRETCH,
        });
    }

    /**
     * Cut the path between two arc-length distances.
     * Cut points are interpolated on the original segment, so neighbouring pieces
     * share the same end direction and their edges line up without gaps.
     */
    private static SubPath(path: Vec2[], dist: number[], from: number, to: number): Vec2[]
    {
        const EPSILON = .01;
        const out: Vec2[] = [SnakeLine.PointAt(path, dist, from)];

        for (let i = 0; i < path.length; i++)
        {
            if (dist[i] > from + EPSILON && dist[i] < to - EPSILON)
                out.push(path[i]);
        }

        out.push(SnakeLine.PointAt(path, dist, to));
        return out;
    }

    private static PointAt(path: Vec2[], dist: number[], d: number): Vec2
    {
        for (let i = 1; i < path.length; i++)
        {
            if (dist[i] >= d)
            {
                const segLen = dist[i] - dist[i - 1];
                const t = segLen > 0 ? (d - dist[i - 1]) / segLen : 0;
                const a = path[i - 1];
                const b = path[i];
                return new Vec2(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
            }
        }
        return path[path.length - 1].clone();
    }
}
