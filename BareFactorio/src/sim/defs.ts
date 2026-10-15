import { ItemId } from './items';

export const TICKS_PER_SECOND = 20;

// directions: east, south, west, north. Index * 90 degrees is the rotation
export const DX = [1, 0, -1, 0];
export const DY = [0, 1, 0, -1];

export function Opposite(dir: number): number
{
    return (dir + 2) & 3;
}

export type BuildingKind = 'storage' | 'belt' | 'crafter' | 'drill' | 'farm' | 'house';

export interface Recipe
{
    inputs: [item: number, count: number][];
    output: number;
    outputCount: number;
    ticks: number;
}

export interface BuildingDef
{
    index: number;
    key: string;
    label: string;
    desc: string;
    texture: string;
    kind: BuildingKind;
    w: number;
    h: number;
    cost: [item: number, count: number][];
    buildTicks: number;
    rotatable: boolean;
    walkable: boolean;
    tool: boolean;
    recipe: Recipe | null;
    mineTicks: number;
    needsResource: string[];
    growTicks: number;
    yieldCount: number;
    housing: number;
}

// the subset of a prefab this reads, so the sim doesn't depend on engine types
export interface PrefabLike
{
    name?: string;
    texture?: string;
    tags?: string[];
    customData?: Record<string, any>;
}

function Pairs(map: Record<string, number> | undefined): [number, number][]
{
    return Object.entries(map ?? {}).map(([key, count]) => [ItemId(key), count]);
}

// Building data lives in settingsData.json prefabs, with the sim values in customData. Recognized by
// customData.kind rather than the "building" tag, since raw JSON (tools/simBench.ts) has no inherited tags
export function ParseBuildingDefs(prefabs: PrefabLike[]): BuildingDef[]
{
    const defs: BuildingDef[] = [];

    for (const prefab of prefabs)
    {
        if (!prefab.customData?.kind)
            continue;

        const data = prefab.customData;
        let recipe: Recipe | null = null;
        if (data.recipe)
        {
            const [[outKey, outCount]] = Object.entries(data.recipe.out as Record<string, number>);
            recipe = {
                inputs: Pairs(data.recipe.in),
                output: ItemId(outKey),
                outputCount: outCount,
                ticks: Math.round(data.recipe.seconds * TICKS_PER_SECOND),
            };
        }

        defs.push({
            index: defs.length,
            key: prefab.name!,
            label: data.label ?? prefab.name,
            desc: data.desc ?? '',
            texture: prefab.texture ?? '',
            kind: data.kind,
            w: data.size?.[0] ?? 1,
            h: data.size?.[1] ?? 1,
            cost: Pairs(data.cost),
            buildTicks: Math.max(1, Math.round((data.buildSeconds ?? 1) * TICKS_PER_SECOND)),
            rotatable: !!data.rotatable,
            walkable: !!data.walkable,
            tool: data.tool !== false,
            recipe,
            mineTicks: Math.round((data.mineSeconds ?? 3) * TICKS_PER_SECOND),
            needsResource: data.needsResource ?? [],
            growTicks: Math.round((data.growSeconds ?? 10) * TICKS_PER_SECOND),
            yieldCount: data.yield ?? 0,
            housing: data.housing ?? 0,
        });
    }

    return defs;
}
