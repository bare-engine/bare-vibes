// Pure Sokoban rules, no engine code. Levels use the standard text format:
// # wall, @ player, + player on goal, $ box, * box on goal, . goal, space floor.

export type Dir = { dx: number, dy: number };

export const Dirs = {
    up: { dx: 0, dy: -1 },
    down: { dx: 0, dy: 1 },
    left: { dx: -1, dy: 0 },
    right: { dx: 1, dy: 0 },
} as const;

export type MoveResult = { moved: boolean, pushedBox: number }; // pushedBox: index into boxes, -1 for none

export class Sokoban
{
    width = 0;
    height = 0;
    walls = new Set<number>();
    goals = new Set<number>();
    floor = new Set<number>(); // cells reachable from the player, used to draw only the inside
    boxes: number[] = [];
    player = 0;
    moves = 0;
    pushes = 0;

    private history: { player: number, boxes: number[], moves: number, pushes: number }[] = [];

    constructor(level: string)
    {
        const rows = level.split('\n').filter(row => row.trim() !== '');
        this.height = rows.length;
        this.width = Math.max(...rows.map(row => row.length));

        rows.forEach((row, y) => [...row].forEach((ch, x) =>
        {
            const i = this.Index(x, y);
            if (ch === '#') this.walls.add(i);
            if (ch === '.' || ch === '*' || ch === '+') this.goals.add(i);
            if (ch === '$' || ch === '*') this.boxes.push(i);
            if (ch === '@' || ch === '+') this.player = i;
        }));

        this.FillFloor();
    }

    Index(x: number, y: number): number { return y * this.width + x; }
    X(i: number): number { return i % this.width; }
    Y(i: number): number { return Math.floor(i / this.width); }

    IsSolved(): boolean
    {
        return this.boxes.every(box => this.goals.has(box));
    }

    Move(dir: Dir): MoveResult
    {
        const next = this.Step(this.player, dir);
        if (next < 0 || this.walls.has(next))
            return { moved: false, pushedBox: -1 };

        const boxIndex = this.boxes.indexOf(next);
        if (boxIndex >= 0)
        {
            const beyond = this.Step(next, dir);
            if (beyond < 0 || this.walls.has(beyond) || this.boxes.includes(beyond))
                return { moved: false, pushedBox: -1 };

            this.SaveHistory();
            this.boxes[boxIndex] = beyond;
            this.pushes++;
        }
        else
            this.SaveHistory();

        this.player = next;
        this.moves++;
        return { moved: true, pushedBox: boxIndex };
    }

    Undo(): boolean
    {
        const prev = this.history.pop();
        if (!prev)
            return false;

        this.player = prev.player;
        this.boxes = prev.boxes;
        this.moves = prev.moves;
        this.pushes = prev.pushes;
        return true;
    }

    private SaveHistory(): void
    {
        this.history.push({ player: this.player, boxes: [...this.boxes], moves: this.moves, pushes: this.pushes });
    }

    private Step(i: number, dir: Dir): number
    {
        const x = this.X(i) + dir.dx;
        const y = this.Y(i) + dir.dy;
        if (x < 0 || y < 0 || x >= this.width || y >= this.height)
            return -1;
        return this.Index(x, y);
    }

    private FillFloor(): void
    {
        const stack = [this.player];
        while (stack.length > 0)
        {
            const i = stack.pop()!;
            if (i < 0 || this.floor.has(i) || this.walls.has(i))
                continue;
            this.floor.add(i);
            for (const dir of Object.values(Dirs))
                stack.push(this.Step(i, dir));
        }
    }
}
