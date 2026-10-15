import type { BuildingDef } from './defs';
import { NewInventory } from './items';

export interface BeltItem
{
    item: number;
    // 0 at the edge it came in, 1 at the edge it leaves
    p: number;
    // the direction it was moving when it came onto this belt, to draw it around corners
    from: number;
    moving: boolean;
    // last tick it moved, so an item handed forward isn't moved twice in one tick
    tick: number;
}

export class Building
{
    built = false;
    buildWork = 0;

    // construction materials that arrived, and that workers are bringing
    readonly delivered = NewInventory();
    readonly incoming = NewInventory();

    // storage contents, or crafter inputs
    readonly inv = NewInventory();

    // finished products waiting to leave (crafters, drills)
    out = 0;
    outItem = 0;
    blockedOut = false;

    // crafting progress in ticks, -1 while idle
    progress = -1;
    timer = 0;
    depleted = false;

    // farms
    growth = 0;
    stage = 0;

    belt: BeltItem[] = [];

    builderId = 0;
    haulerId = 0;
    lastBeltInput = -1e9;

    constructor(
        readonly id: number,
        readonly def: BuildingDef,
        readonly x: number,
        readonly y: number,
        readonly dir: number,
    ) {}

    MaterialNeeded(item: number): number
    {
        for (const [costItem, count] of this.def.cost)
            if (costItem === item)
                return count - this.delivered[item] - this.incoming[item];
        return 0;
    }

    MaterialsComplete(): boolean
    {
        for (const [item, count] of this.def.cost)
            if (this.delivered[item] < count)
                return false;
        return true;
    }

    // the tile in front of the building, where its products go
    FrontTile(): [number, number]
    {
        switch (this.dir)
        {
            case 0: return [this.x + this.def.w, this.y];
            case 1: return [this.x, this.y + this.def.h];
            case 2: return [this.x - 1, this.y];
            default: return [this.x, this.y - 1];
        }
    }
}
