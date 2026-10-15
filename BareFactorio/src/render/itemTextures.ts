import { Asset } from '../generated/assets';

// image per item id, kept out of the sim so it runs without the engine (see tools/simBench.ts)
export const ITEM_TEXTURES: string[] = [
    '',
    Asset.Image.I_WOOD,
    Asset.Image.I_STONE,
    Asset.Image.I_IRON_ORE,
    Asset.Image.I_PLANK,
    Asset.Image.I_IRON_PLATE,
    Asset.Image.I_GEAR,
    Asset.Image.I_BERRIES,
];
