import { SaveData } from 'bare-engine';

declare module 'bare-engine'
{
    namespace SaveData
    {
        // FEWEST CLICKS PER LEVEL NUMBER, FOR PASSED LEVELS ONLY
        let bestClicks: Record<number, number>;
    }
}

export const LEVEL_COUNT = 6;

// StartBare's OnInit: BEFORE THE FIRST SCENE, AND AGAIN ON bare.Restart()
export function InitSave()
{
    bare.storage.SetDefaults({
        bestClicks: {},
        musicEnabled: true,
    });
    bare.storage.Load();
}

export function SaveLevelPassed(level: number, clicks: number)
{
    const best = SaveData.bestClicks[level];
    if (best === undefined || clicks < best)
    {
        SaveData.bestClicks = { ...SaveData.bestClicks, [level]: clicks };
        bare.storage.Save();
    }
}

// LIKE THE ORIGINAL: A LEVEL IS OPEN ONCE THE ONE BEFORE IT IS PASSED
export function IsLevelOpen(level: number): boolean
{
    return level == 1 || SaveData.bestClicks[level - 1] !== undefined;
}
