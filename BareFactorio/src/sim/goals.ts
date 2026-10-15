import type { Colony } from './colony';
import { GEAR, IRON_ORE, IRON_PLATE, PLANK, WOOD } from './items';

export interface Goal
{
    text: string;
    progress(c: Colony): [number, number];
}

const built = (c: Colony, key: string) => {
    let count = 0;
    for (const b of c.buildings.values())
        if (b.built && b.def.key === key)
            count++;
    return count;
};

// a gentle path through everything the colony can do
export const GOALS: Goal[] = [
    { text: 'Mark trees with Harvest (2), then gather wood', progress: c => [c.produced[WOOD], 20] },
    { text: 'Build a Sawmill (6) next to the HQ and make planks', progress: c => [c.produced[PLANK], 20] },
    { text: 'Harvest the rusty iron ore patches', progress: c => [c.produced[IRON_ORE], 15] },
    { text: 'Build a Smelter (7) and make iron plates', progress: c => [c.produced[IRON_PLATE], 15] },
    { text: 'Plant a Berry farm (9) so nobody goes hungry', progress: c => [built(c, 'farm'), 1] },
    { text: 'Automate: Drill (8) on ore -> Belts (4) -> Smelter', progress: c => [c.drillMined, 25] },
    { text: 'Build Huts (0) and grow to 8 colonists', progress: c => [c.workers.length, 8] },
    { text: 'Build a Workshop (-) and make gears', progress: c => [c.produced[GEAR], 25] },
    { text: 'Keep 60 items moving on belts at once', progress: c => [c.itemsOnBelts, 60] },
];

export function CurrentGoal(c: Colony): Goal | null
{
    return GOALS[c.goalIndex] ?? null;
}

// returns the goal that was just completed, if any
export function CheckGoals(c: Colony): Goal | null
{
    const goal = CurrentGoal(c);
    if (!goal)
        return null;
    const [have, need] = goal.progress(c);
    if (have < need)
        return null;
    c.goalIndex++;
    return goal;
}
