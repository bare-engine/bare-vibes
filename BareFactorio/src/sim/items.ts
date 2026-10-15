// Items are small numbers, so inventories are plain typed arrays indexed by item id. 0 is "nothing".
export const ITEM_KEYS = ['', 'wood', 'stone', 'ironOre', 'plank', 'ironPlate', 'gear', 'berries'] as const;
export type ItemKey = Exclude<typeof ITEM_KEYS[number], ''>;

export const ITEM_COUNT = ITEM_KEYS.length;

export const WOOD = 1;
export const STONE = 2;
export const IRON_ORE = 3;
export const PLANK = 4;
export const IRON_PLATE = 5;
export const GEAR = 6;
export const BERRIES = 7;

export const ITEM_LABELS = ['', 'Wood', 'Stone', 'Iron ore', 'Planks', 'Iron plates', 'Gears', 'Berries'];

export function ItemId(key: string): number
{
    const id = ITEM_KEYS.indexOf(key as ItemKey);
    if (id <= 0)
        throw new Error(`Unknown item '${key}'`);
    return id;
}

export function NewInventory(): Int32Array
{
    return new Int32Array(ITEM_COUNT);
}
