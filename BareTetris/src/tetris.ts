// PURE TETRIS RULES - NO ENGINE DEPENDENCIES, SO IT CAN BE TESTED/REASONED ABOUT ON ITS OWN

export type PieceType = "I" | "O" | "T" | "S" | "Z" | "J" | "L";
export const PIECE_TYPES: PieceType[] = ["I", "O", "T", "S", "Z", "J", "L"];

export const COLS = 10;
export const ROWS = 22;          // 2 HIDDEN ROWS ON TOP
export const HIDDEN_ROWS = 2;

const SHAPES: Record<PieceType, number[][]> = {
    I: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
    O: [[1,1],[1,1]],
    T: [[0,1,0],[1,1,1],[0,0,0]],
    S: [[0,1,1],[1,1,0],[0,0,0]],
    Z: [[1,1,0],[0,1,1],[0,0,0]],
    J: [[1,0,0],[1,1,1],[0,0,0]],
    L: [[0,0,1],[1,1,1],[0,0,0]],
};

export type Cell = { x: number, y: number };

// CELLS FOR EACH OF THE 4 ROTATION STATES, ROTATED CLOCKWISE INSIDE THE SHAPE'S BOUNDING BOX
const ROTATIONS: Record<PieceType, Cell[][]> = {} as any;
for (const type of PIECE_TYPES)
{
    let matrix = SHAPES[type];
    ROTATIONS[type] = [];
    for (let r = 0; r < 4; r++)
    {
        const cells: Cell[] = [];
        matrix.forEach((row, y) => row.forEach((v, x) => { if (v) cells.push({ x, y }); }));
        ROTATIONS[type].push(cells);

        const n = matrix.length;
        matrix = matrix.map((row, y) => row.map((_, x) => matrix[n - 1 - x][y]));
    }
}

// SRS WALL KICKS, Y FLIPPED TO SCREEN SPACE (DOWN IS POSITIVE). KEY: "from>to"
const KICKS_JLSTZ: Record<string, [number, number][]> = {
    "0>1": [[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
    "1>0": [[0,0],[1,0],[1,1],[0,-2],[1,-2]],
    "1>2": [[0,0],[1,0],[1,1],[0,-2],[1,-2]],
    "2>1": [[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
    "2>3": [[0,0],[1,0],[1,-1],[0,2],[1,2]],
    "3>2": [[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
    "3>0": [[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
    "0>3": [[0,0],[1,0],[1,-1],[0,2],[1,2]],
};

const KICKS_I: Record<string, [number, number][]> = {
    "0>1": [[0,0],[-2,0],[1,0],[-2,1],[1,-2]],
    "1>0": [[0,0],[2,0],[-1,0],[2,-1],[-1,2]],
    "1>2": [[0,0],[-1,0],[2,0],[-1,-2],[2,1]],
    "2>1": [[0,0],[1,0],[-2,0],[1,2],[-2,-1]],
    "2>3": [[0,0],[2,0],[-1,0],[2,-1],[-1,2]],
    "3>2": [[0,0],[-2,0],[1,0],[-2,1],[1,-2]],
    "3>0": [[0,0],[1,0],[-2,0],[1,2],[-2,-1]],
    "0>3": [[0,0],[-1,0],[2,0],[-1,-2],[2,1]],
};

export class Piece
{
    constructor(public type: PieceType, public x: number, public y: number, public rotation: number = 0) {}

    get cells(): Cell[]
    {
        return ROTATIONS[this.type][this.rotation].map(c => ({ x: c.x + this.x, y: c.y + this.y }));
    }

    static CellsOf(type: PieceType, rotation: number = 0): Cell[]
    {
        return ROTATIONS[type][rotation];
    }
}

// 7-BAG RANDOMIZER: EVERY PIECE ONCE PER BAG
export class Bag
{
    private queue: PieceType[] = [];

    Next(): PieceType
    {
        this.Fill();
        return this.queue.shift()!;
    }

    Peek(count: number): PieceType[]
    {
        this.Fill(count);
        return this.queue.slice(0, count);
    }

    private Fill(min: number = 1)
    {
        while (this.queue.length < min + 1)
        {
            const bag = PIECE_TYPES.slice();
            for (let i = bag.length - 1; i > 0; i--)
            {
                const j = Math.floor(Math.random() * (i + 1));
                [bag[i], bag[j]] = [bag[j], bag[i]];
            }
            this.queue.push(...bag);
        }
    }
}

const LINE_SCORES = [0, 100, 300, 500, 800];
const LOCK_DELAY = 0.5;
const MAX_LOCK_RESETS = 15;

export class Tetris
{
    board: (PieceType | null)[][] = [];
    bag = new Bag();
    current!: Piece;
    hold: PieceType | null = null;
    holdUsed = false;

    score = 0;
    lines = 0;
    level = 1;
    gameOver = false;

    clearingRows: number[] = [];     // ROWS FLASHING BEFORE BEING REMOVED
    clearTimer = 0;
    lastClearText = "";
    lastClearTimer = 0;

    private gravityTimer = 0;
    private lockTimer = 0;
    private lockResets = 0;
    private lowestY = 0;

    constructor()
    {
        this.Reset();
    }

    Reset()
    {
        this.board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
        this.bag = new Bag();
        this.hold = null;
        this.holdUsed = false;
        this.score = 0;
        this.lines = 0;
        this.level = 1;
        this.gameOver = false;
        this.clearingRows = [];
        this.lastClearText = "";
        this.Spawn(this.bag.Next());
    }

    get next(): PieceType[] { return this.bag.Peek(5); }

    // SECONDS PER ROW, GUIDELINE GRAVITY CURVE
    get gravityInterval(): number
    {
        return Math.pow(0.8 - (this.level - 1) * 0.007, this.level - 1);
    }

    private Spawn(type: PieceType)
    {
        const width = type == "O" ? 2 : type == "I" ? 4 : 3;
        // BOTTOM OF EVERY SPAWNED PIECE LANDS ON THE FIRST VISIBLE ROW
        this.current = new Piece(type, Math.floor((COLS - width) / 2), 1);
        this.gravityTimer = 0;
        this.lockTimer = 0;
        this.lockResets = 0;
        this.lowestY = this.current.y;

        if (!this.Fits(this.current))
            this.gameOver = true;
    }

    Fits(piece: Piece, dx: number = 0, dy: number = 0, rotation: number = piece.rotation): boolean
    {
        for (const c of ROTATIONS[piece.type][rotation])
        {
            const x = c.x + piece.x + dx;
            const y = c.y + piece.y + dy;
            if (x < 0 || x >= COLS || y >= ROWS)
                return false;
            if (y >= 0 && this.board[y][x])
                return false;
        }
        return true;
    }

    get busy(): boolean { return this.gameOver || this.clearingRows.length > 0; }

    get grounded(): boolean { return !this.Fits(this.current, 0, 1); }

    get ghostY(): number
    {
        let dy = 0;
        while (this.Fits(this.current, 0, dy + 1))
            dy++;
        return this.current.y + dy;
    }

    Move(dx: number): boolean
    {
        if (this.busy || !this.Fits(this.current, dx, 0))
            return false;
        this.current.x += dx;
        this.OnMovedOrRotated();
        return true;
    }

    Rotate(dir: 1 | -1): boolean
    {
        if (this.busy || this.current.type == "O")
            return false;

        const from = this.current.rotation;
        const to = (from + dir + 4) % 4;
        const kicks = (this.current.type == "I" ? KICKS_I : KICKS_JLSTZ)[`${from}>${to}`];

        for (const [kx, ky] of kicks)
        {
            if (this.Fits(this.current, kx, ky, to))
            {
                this.current.x += kx;
                this.current.y += ky;
                this.current.rotation = to;
                this.OnMovedOrRotated();
                return true;
            }
        }
        return false;
    }

    SoftDrop(): boolean
    {
        if (this.busy || !this.Fits(this.current, 0, 1))
            return false;
        this.current.y++;
        this.score += 1;
        this.gravityTimer = 0;
        this.TrackLowest();
        return true;
    }

    HardDrop()
    {
        if (this.busy)
            return;
        const target = this.ghostY;
        this.score += (target - this.current.y) * 2;
        this.current.y = target;
        this.Lock();
    }

    Hold()
    {
        if (this.busy || this.holdUsed)
            return;
        const type = this.current.type;
        if (this.hold)
            this.Spawn(this.hold);
        else
            this.Spawn(this.bag.Next());
        this.hold = type;
        this.holdUsed = true;
    }

    Update(dt: number, softDropping: boolean)
    {
        if (this.lastClearTimer > 0)
            this.lastClearTimer -= dt;

        if (this.gameOver)
            return;

        if (this.clearingRows.length > 0)
        {
            this.clearTimer -= dt;
            if (this.clearTimer <= 0)
                this.FinishClear();
            return;
        }

        if (this.grounded)
        {
            this.lockTimer += dt;
            if (this.lockTimer >= LOCK_DELAY)
                this.Lock();
            return;
        }

        // SOFT DROP IS HANDLED BY THE CALLER (REPEATING SoftDrop), SO NO GRAVITY WHILE HELD
        if (softDropping)
            return;

        this.gravityTimer += dt;
        const interval = this.gravityInterval;
        while (this.gravityTimer >= interval)
        {
            this.gravityTimer -= interval;
            if (!this.Fits(this.current, 0, 1))
                break;
            this.current.y++;
            this.TrackLowest();
        }
    }

    // LOCK DELAY RESETS ON MOVE/ROTATE, BUT ONLY A LIMITED NUMBER OF TIMES PER ROW REACHED
    private OnMovedOrRotated()
    {
        if (this.lockResets < MAX_LOCK_RESETS)
        {
            this.lockTimer = 0;
            this.lockResets++;
        }
        this.TrackLowest();
    }

    private TrackLowest()
    {
        if (this.current.y > this.lowestY)
        {
            this.lowestY = this.current.y;
            this.lockResets = 0;
            this.lockTimer = 0;
        }
    }

    private Lock()
    {
        let aboveVisible = true;
        for (const c of this.current.cells)
        {
            if (c.y >= 0)
                this.board[c.y][c.x] = this.current.type;
            if (c.y >= HIDDEN_ROWS)
                aboveVisible = false;
        }

        // LOCK OUT: PIECE LOCKED COMPLETELY ABOVE THE VISIBLE FIELD
        if (aboveVisible)
        {
            this.gameOver = true;
            return;
        }

        this.clearingRows = [];
        for (let y = 0; y < ROWS; y++)
        {
            if (this.board[y].every(c => c))
                this.clearingRows.push(y);
        }

        if (this.clearingRows.length > 0)
        {
            const count = this.clearingRows.length;
            this.score += LINE_SCORES[count] * this.level;
            this.lastClearText = ["", "SINGLE", "DOUBLE", "TRIPLE", "TETRIS!"][count];
            this.lastClearTimer = 1.2;
            this.clearTimer = 0.25;
        }
        else
        {
            this.SpawnNext();
        }
    }

    private FinishClear()
    {
        for (const y of this.clearingRows)
        {
            this.board.splice(y, 1);
            this.board.unshift(Array(COLS).fill(null));
        }
        this.lines += this.clearingRows.length;
        this.level = Math.floor(this.lines / 10) + 1;
        this.clearingRows = [];
        this.SpawnNext();
    }

    private SpawnNext()
    {
        this.holdUsed = false;
        this.Spawn(this.bag.Next());
    }
}
