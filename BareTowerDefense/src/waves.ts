import { Data } from './generated/assets';

export interface SpawnEntry
{
    prefab: string;
    delay: number; // seconds to wait before this spawn
}

export interface WaveInfo
{
    entries: SpawnEntry[];
    healthMultiplier: number;
}

function AddGroup(entries: SpawnEntry[], prefab: string, count: number, interval: number, gapBefore: number)
{
    for (let i = 0; i < count; i++)
        entries.push({ prefab, delay: i == 0 ? gapBefore : interval });
}

// WAVES ARE ENDLESS: EACH ONE ADDS MORE AND TOUGHER ENEMIES
export function BuildWave(wave: number): WaveInfo
{
    const entries: SpawnEntry[] = [];

    AddGroup(entries, Data.Prefab.ENEMY_GRUNT, Math.min(6 + wave * 2, 30), Math.max(0.35, 0.9 - wave * 0.03), 0);

    if (wave >= 3)
        AddGroup(entries, Data.Prefab.ENEMY_RUNNER, Math.floor(wave * 1.2), 0.45, 1.5);

    if (wave >= 5)
        AddGroup(entries, Data.Prefab.ENEMY_TANK, Math.floor((wave - 3) / 2), 1.6, 1.5);

    if (wave % 10 == 0)
        AddGroup(entries, Data.Prefab.ENEMY_BOSS, wave / 10, 3, 2.5);

    const n = wave - 1;
    return { entries, healthMultiplier: 1 + n * 0.12 + n * n * 0.012 };
}
