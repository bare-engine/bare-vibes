import { Easing, GameObject, LineTextureMode, Texture, Vec2 } from 'bare-engine';

/**
 * Snake drawn as one bendable rapid.drawLine() path.
 *
 * A direction key starts a quarter circle turn of a set radius right away.
 * Grow() scales a new body tile in from 0 to full length in front of the tail.
 *
 * The path is split by arc length into tail | body x N | head pieces, each piece its own
 * drawLine with its tile stretched over it. Tiles are horizontal: tail left, head right.
 */
export class Snake extends GameObject
{
    speed: number = 300;
    /** Rendered tile size (tiles are square, so this is both line width and tile length). */
    lineWidth: number = 128;
    /** Full body tiles between tail and head. */
    bodyCount: number = 1;
    /** Length of the body tile currently growing in, 0..1 of a tile. */
    growScale: number = 0;
    turnRadius: number = 48;
    /** How close the head's tip must get to the body's center line to hit it, 0..1 of a tile. Matches the visible body's half width, not the tile's. */
    selfHitRadius: number = .25;
    /** Min distance between recorded path points, lower = smoother bends. */
    spacing: number = 2;

    /** Stays put until the first direction key press. */
    moving: boolean = false;

    /** Path from head (index 0) to tail. */
    points: Vec2[] = [];

    private headTexture!: Texture;
    private bodyTexture!: Texture;
    private tailTexture!: Texture;

    private head: Vec2 = new Vec2();
    private dir: Vec2 = Vec2.RIGHT.clone();
    private turn: Turn | null = null;
    /** Direction pressed during a turn, taken once it's done. */
    private nextDir: Vec2 | null = null;

    private growing: boolean = false;
    /** Grows asked for while one is still scaling in. */
    private pendingGrows: number = 0;

    /** Front tip of the head. */
    get headPosition(): Vec2
    {
        return this.head;
    }

    /** Total snake length in pixels: tail + body tiles + growing tile + head. */
    get length(): number
    {
        return this.lineWidth * (2 + this.bodyCount + this.growScale);
    }

    Setup(x: number, y: number, direction: Vec2 = Vec2.RIGHT): this
    {
        this.headTexture = bare.asset.GetTexture('tile019');
        this.bodyTexture = bare.asset.GetTexture('tile024');
        this.tailTexture = bare.asset.GetTexture('tile030');

        // BODY LAID OUT STRAIGHT BEHIND THE HEAD
        this.head = new Vec2(x, y);
        this.dir = direction.clone();
        this.turn = null;
        this.nextDir = null;

        this.points = [];
        for (let d = 0; d <= this.length + this.spacing; d += this.spacing)
            this.points.push(this.head.subtract(direction.multiply(d)));

        this.SetPosition(x, y);
        return this;
    }

    override OnUpdate(deltaTime: number)
    {
        const keyboard = bare.keyboard;

        // A FRESH DIRECTION PRESS, NOT A CLICK (FOCUSING THE GAME IS A CLICK) OR A KEY STILL HELD FROM THE LAST RUN
        if (!this.moving)
        {
            if (!keyboard.IsAnyDirectionPressed())
                return;
            this.moving = true;
        }

        if (keyboard.IsRightPressed())
            this.Turn(Vec2.RIGHT);
        else if (keyboard.IsDownPressed())
            this.Turn(Vec2.DOWN);
        else if (keyboard.IsLeftPressed())
            this.Turn(Vec2.LEFT);
        else if (keyboard.IsUpPressed())
            this.Turn(Vec2.UP);

        this.Move(this.speed * deltaTime);
    }

    /** Scale a new body tile in just in front of the tail. */
    Grow()
    {
        if (this.growing)
        {
            this.pendingGrows++;
            return;
        }

        this.growing = true;
        this.growScale = 0;
        // GROW AT THE SNAKE'S SPEED, LINEARLY, SO THE TAIL STANDS STILL WHILE THE HEAD MOVES ON
        this.scene.tween.To(this, this.lineWidth / this.speed, {
            growScale: 1,
            ease: Easing.Linear.None,
            onComplete: () => {
                this.bodyCount++;
                this.growScale = 0;
                this.growing = false;

                if (this.pendingGrows > 0)
                {
                    this.pendingGrows--;
                    this.Grow();
                }
            },
        });
    }

    /** Whether the head's tip is over the snake's own body. */
    HitsSelf(): boolean
    {
        // SKIP THE HEAD AND NECK, A TIGHT TURN BRINGS THEM CLOSE TO THE TIP WITHOUT BEING A HIT
        const skip = this.lineWidth * 1.5;
        const hitDistance = this.lineWidth * this.selfHitRadius;

        let dist = 0;
        for (let i = 1; i < this.points.length; i++)
        {
            dist += this.points[i - 1].distanceTo(this.points[i]);
            if (dist > skip && this.head.distanceTo(this.points[i]) < hitDistance)
                return true;
        }
        return false;
    }

    /** Whether any recorded path point is within `distance` of `position`. */
    IsNear(position: Vec2, distance: number): boolean
    {
        return this.points.some(point => point.distanceTo(position) < distance);
    }

    Turn(direction: Vec2)
    {
        const current = this.turn?.dirOut ?? this.dir;

        // NO TURNING BACK INTO YOURSELF, NOR TURNING TO WHERE YOU'RE ALREADY GOING
        if (direction.equals(current) || direction.equals(current.inverted()))
            return;

        if (this.turn)
            this.nextDir = direction.clone();
        else
            this.turn = new Turn(this.head.clone(), this.dir.clone(), direction.clone(), this.turnRadius);
    }

    private Move(distance: number)
    {
        while (distance > 0)
        {
            // SMALL STEPS SO ARCS ARE RECORDED SMOOTHLY
            let step = Math.min(distance, this.spacing);

            const turn = this.turn;
            if (turn)
            {
                step = Math.min(step, turn.length - turn.traveled);
                turn.traveled += step;
                this.head = turn.PointAt(turn.traveled);

                if (turn.traveled >= turn.length - 1e-6)
                {
                    this.dir = turn.dirOut;
                    this.turn = null;

                    if (this.nextDir)
                    {
                        this.Turn(this.nextDir);
                        this.nextDir = null;
                    }
                }
            }
            else
            {
                this.head = this.head.add(this.dir.multiply(step));
            }

            distance -= step;
            this.SetHead(this.head);
        }

        this.SetPosition(this.head.x, this.head.y);
    }

    /** Move the head, the body follows the recorded path. */
    private SetHead(position: Vec2): void
    {
        // points[0] IS THE LIVE HEAD, ONCE IT'S FAR ENOUGH FROM THE LAST RECORDED POINT IT GETS RECORDED
        if (this.points.length >= 2 && position.distanceTo(this.points[1]) < this.spacing)
            this.points[0] = position;
        else if (this.points.length == 0 || !position.equals(this.points[0]))
            this.points.unshift(position);

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

    // WORLD SPACE, SO THE PATH ISN'T MOVED BY THIS OBJECT'S OWN POSITION
    override OnRenderWorld(): void
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

        // SQUASH ALL TILES IF THE PATH IS STILL SHORTER THAN THE SNAKE
        const tile = this.lineWidth * Math.min(1, total / this.length);

        let d = start;
        this.DrawPiece(path, dist, d, d += tile, this.tailTexture);

        // NEW TILE SCALING IN JUST IN FRONT OF THE TAIL, SO ONLY THE TAIL PAUSES WHILE THE REST KEEPS MOVING
        if (this.growScale > 0)
            this.DrawPiece(path, dist, d, d += tile * this.growScale, this.bodyTexture);

        for (let i = 0; i < this.bodyCount; i++)
            this.DrawPiece(path, dist, d, d += tile, this.bodyTexture);

        this.DrawPiece(path, dist, d, end, this.headTexture);
    }

    private DrawPiece(path: Vec2[], dist: number[], from: number, to: number, texture: Texture): void
    {
        // A ZERO LENGTH PIECE HAS NO DIRECTION TO DRAW ALONG
        if (to - from < .5)
            return;

        const points = Snake.SubPath(path, dist, from, to);
        if (points.length < 2)
            return;

        rapid.drawLine({
            points,
            width: this.lineWidth,
            texture,
            textureMode: LineTextureMode.STRETCH,
            color: this.color,
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
        const out: Vec2[] = [Snake.PointAt(path, dist, from)];

        for (let i = 0; i < path.length; i++)
        {
            if (dist[i] > from + EPSILON && dist[i] < to - EPSILON)
                out.push(path[i]);
        }

        out.push(Snake.PointAt(path, dist, to));
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

/**
 * A quarter circle from `start` (heading dirIn) to heading dirOut, ending `radius` px further
 * along dirIn and `radius` px along dirOut.
 */
class Turn
{
    traveled: number = 0;
    readonly length: number;

    constructor(
        readonly start: Vec2,
        readonly dirIn: Vec2,
        readonly dirOut: Vec2,
        readonly radius: number,
    )
    {
        this.length = Math.PI * .5 * radius;
    }

    PointAt(traveled: number): Vec2
    {
        const r = this.radius;
        const pivot = this.start.add(this.dirOut.multiply(r));
        const phi = traveled / r;
        return pivot
            .add(this.dirOut.multiply(-Math.cos(phi) * r))
            .add(this.dirIn.multiply(Math.sin(phi) * r));
    }
}
