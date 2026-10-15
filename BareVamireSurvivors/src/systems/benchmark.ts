import type { Game } from '../game';
import type { CollisionMode } from './combat';
import { perf, type PerfStats } from './perfMonitor';

export type BenchRow = PerfStats & {
    mode: CollisionMode;
    enemies: number;
    spawnUsPerEnemy: number;
};

declare global
{
    interface Window
    {
        benchResults?: BenchRow[];
    }
}

// Ramps the enemy count and measures each step, once per collision mode. The player is
// invincible, weapons are off and it walks in a circle, so the camera keeps moving and
// enemies keep being recycled to the front, like in a real run.
export class Benchmark
{
    running = false;
    results: BenchRow[] = [];

    static readonly COUNTS = [250, 500, 1000, 2000, 3000, 4000, 6000, 8000];
    static readonly SETTLE_SECONDS = 1.5;
    static readonly MEASURE_SECONDS = 3;
    // Below this frame rate, larger counts of the same mode are skipped
    static readonly MIN_FPS = 12;

    constructor(private game: Game) {}

    async Run(modes: CollisionMode[] = ['arcade', 'grid'])
    {
        if (this.running)
            return;

        const game = this.game;
        const saved = {
            god: game.godMode,
            weapons: game.weaponsEnabled,
            spawner: game.spawner.enabled,
            autopilot: game.autopilot,
            mode: game.combat.mode,
        };

        this.running = true;
        this.results = [];
        game.godMode = true;
        game.weaponsEnabled = false;
        game.spawner.enabled = false;
        game.autopilot = true;

        let completed = false;
        let sampling = false;
        try
        {
            for (const mode of modes)
            {
                game.combat.SetMode(mode);
                game.ClearEnemies();
                if (!await game.Wait(0.5))
                    return;

                for (const count of Benchmark.COUNTS)
                {
                    game.hud?.Announce(`Benchmark (${mode}): ${count} enemies`);

                    const toSpawn = count - game.enemies.length;
                    const t0 = performance.now();
                    game.spawner.SpawnBurst(toSpawn);
                    const spawnUs = toSpawn > 0 ? (performance.now() - t0) * 1000 / toSpawn : 0;

                    if (!await game.Wait(Benchmark.SETTLE_SECONDS))
                        return;
                    perf.BeginSample();
                    sampling = true;
                    if (!await game.Wait(Benchmark.MEASURE_SECONDS))
                        return;
                    const stats = perf.EndSample();
                    sampling = false;

                    const row: BenchRow = { mode, enemies: game.enemies.length, spawnUsPerEnemy: spawnUs, ...stats };
                    this.results.push(row);
                    console.log(`BENCH ${Benchmark.FormatRow(row)}`);

                    if (stats.fps < Benchmark.MIN_FPS)
                        break;
                }
            }

            game.ClearEnemies();
            completed = true;
        }
        finally
        {
            if (sampling) perf.EndSample();
            game.combat.SetMode(saved.mode);
            game.godMode = saved.god;
            game.weaponsEnabled = saved.weapons;
            game.spawner.enabled = saved.spawner;
            game.autopilot = saved.autopilot;
            this.running = false;
            if (!completed)
                game.hud?.Announce('Benchmark cancelled');
        }

        window.benchResults = this.results;
        console.table(this.results.map(row => Benchmark.Rounded(row)));
        console.log('BENCH_RESULTS ' + JSON.stringify(this.results.map(row => Benchmark.Rounded(row))));
    }

    static FormatRow(row: BenchRow): string
    {
        return `${row.mode.padEnd(6)} ${String(row.enemies).padStart(5)} enemies | ${row.fps.toFixed(1).padStart(5)} fps`
            + ` | frame ${row.frameMs.toFixed(1)}ms p95 ${row.p95Ms.toFixed(1)}ms`
            + ` | fixed ${row.fixedMs.toFixed(1)} (physics ${row.physicsMs.toFixed(1)}) update ${row.updateMs.toFixed(1)} render ${row.renderMs.toFixed(1)}`
            + ` | ${row.drawCalls.toFixed(0)} draws | spawn ${row.spawnUsPerEnemy.toFixed(0)}us/enemy`;
    }

    private static Rounded(row: BenchRow): Record<string, string | number>
    {
        const out: Record<string, string | number> = {};
        for (const [key, value] of Object.entries(row))
            out[key] = typeof value === 'number' ? Math.round(value * 100) / 100 : value;
        return out;
    }
}
