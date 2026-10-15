import { SaveData } from 'bare-engine';

// ONE GHOST SAMPLE EVERY GHOST_STEP FIXED UPDATES: x, y, gravity direction
export const GHOST_STEP = 2;

export interface LevelRecord
{
    bestTime: number;
    orbs: number;
    orbsTotal: number;
    ghost: number[];
}

declare module 'bare-engine'
{
    namespace SaveData
    {
        let records: Record<string, LevelRecord>;
        let unlocked: number;
        let deaths: number;
    }

    interface BareUserEvents
    {
        playerDied: void;
        playerFlipped: { direction: number };
        orbCollected: void;
        levelComplete: void;
    }
}

export const LEVELS = ['level1', 'level2', 'level3', 'level4', 'level5'];

export function InitProgress()
{
    bare.storage.SetDefaults({
        records: {},
        unlocked: 1,
        deaths: 0,
    });
    bare.storage.Load();
}

export function GetRecord(level: string): LevelRecord | undefined
{
    return SaveData.records[level];
}

// RETURNS true WHEN THIS RUN IS A NEW BEST TIME
export function SubmitRun(level: string, time: number, orbs: number, orbsTotal: number, ghost: number[]): boolean
{
    const old = SaveData.records[level];
    const isBest = !old || time < old.bestTime;

    SaveData.records[level] = {
        bestTime: isBest ? time : old.bestTime,
        orbs: Math.max(orbs, old?.orbs ?? 0),
        orbsTotal,
        ghost: isBest ? ghost : old.ghost,
    };

    const index = LEVELS.indexOf(level);
    SaveData.unlocked = Math.max(SaveData.unlocked, Math.min(LEVELS.length, index + 2));
    bare.storage.Save();
    return isBest;
}

export function FormatTime(seconds: number): string
{
    return seconds.toFixed(2) + 's';
}
