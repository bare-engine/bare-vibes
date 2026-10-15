// A uniform grid of linked lists, rebuilt every fixed step. Building is O(n) with no
// allocations, so it stays cheap at thousands of items.
export interface GridItem
{
    x: number;
    y: number;
}

export class SpatialGrid<T extends GridItem>
{
    private heads: Int32Array;
    private next: Int32Array = new Int32Array(1024);
    private items: T[] = [];
    readonly cols: number;
    readonly rows: number;

    constructor(readonly width: number, readonly height: number, readonly cellSize: number)
    {
        this.cols = Math.max(1, Math.ceil(width / cellSize));
        this.rows = Math.max(1, Math.ceil(height / cellSize));
        this.heads = new Int32Array(this.cols * this.rows);
    }

    get count(): number
    {
        return this.items.length;
    }

    // Copies the list, so the caller may add or remove items before the next Build
    Build(items: T[]): void
    {
        this.items.length = items.length;
        for (let i = 0; i < items.length; i++)
            this.items[i] = items[i];

        this.heads.fill(-1);

        if (this.next.length < items.length)
            this.next = new Int32Array(items.length * 2);

        for (let i = 0; i < items.length; i++)
        {
            const cell = this.CellIndex(this.items[i].x, this.items[i].y);
            this.next[i] = this.heads[cell];
            this.heads[cell] = i;
        }
    }

    // Calls visit for every item whose cell overlaps the circle. Return true from visit to stop early.
    Query(x: number, y: number, radius: number, visit: (item: T) => boolean | void): void
    {
        const size = this.cellSize;
        const minCol = Math.max(0, Math.floor((x - radius) / size));
        const maxCol = Math.min(this.cols - 1, Math.floor((x + radius) / size));
        const minRow = Math.max(0, Math.floor((y - radius) / size));
        const maxRow = Math.min(this.rows - 1, Math.floor((y + radius) / size));

        for (let row = minRow; row <= maxRow; row++)
        {
            for (let col = minCol; col <= maxCol; col++)
            {
                for (let i = this.heads[row * this.cols + col]; i !== -1; i = this.next[i])
                {
                    if (visit(this.items[i]))
                        return;
                }
            }
        }
    }

    Nearest(x: number, y: number, maxRadius: number, filter?: (item: T) => boolean): T | null
    {
        let best: T | null = null;
        let bestDistSq = maxRadius * maxRadius;

        // Grow the search ring until something is found, so a crowd next to the player costs little.
        for (let radius = this.cellSize; ; radius = Math.min(radius * 2, maxRadius))
        {
            this.Query(x, y, radius, item => {
                const dx = item.x - x;
                const dy = item.y - y;
                const distSq = dx * dx + dy * dy;
                if (distSq < bestDistSq && (!filter || filter(item)))
                {
                    bestDistSq = distSq;
                    best = item;
                }
            });

            // A hit further away than the ring may still have a nearer item in an unvisited cell
            if ((best && bestDistSq <= radius * radius) || radius >= maxRadius)
                return best;
        }
    }

    private CellIndex(x: number, y: number): number
    {
        const col = Math.min(this.cols - 1, Math.max(0, Math.floor(x / this.cellSize)));
        const row = Math.min(this.rows - 1, Math.max(0, Math.floor(y / this.cellSize)));
        return row * this.cols + col;
    }
}
