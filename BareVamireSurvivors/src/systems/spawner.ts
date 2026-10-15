import { Data } from '../generated/assets';
import type { Game } from '../game';
import type { Enemy } from '../objects/enemy';

type Wave = { until: number; mix: [string, number][] };

// Which enemies spawn, by game time in seconds
const WAVES: Wave[] = [
    { until: 45, mix: [[Data.Prefab.BAT, 7], [Data.Prefab.ZOMBIE, 3]] },
    { until: 120, mix: [[Data.Prefab.BAT, 4], [Data.Prefab.ZOMBIE, 4], [Data.Prefab.SKELETON, 2]] },
    { until: 240, mix: [[Data.Prefab.BAT, 1], [Data.Prefab.ZOMBIE, 3], [Data.Prefab.SKELETON, 4], [Data.Prefab.GHOST, 3]] },
    { until: Infinity, mix: [[Data.Prefab.BAT, 2], [Data.Prefab.SKELETON, 3], [Data.Prefab.GHOST, 5]] },
];

const BOSS_INTERVAL = 60;

export class Spawner
{
    enabled = true;
    // Upper limit for the normal waves; the stress keys and the benchmark go past it
    cap = 1500;
    recycleDistanceSq = Infinity;

    private spawnBudget = 0;
    private nextBossTime = BOSS_INTERVAL;
    private viewRadius = 1000;

    constructor(private game: Game) {}

    get targetCount(): number
    {
        return Math.min(this.cap, Math.floor(25 + this.game.gameTime * 3.2));
    }

    // Runs every fixed step, while the game isn't paused
    FixedUpdate(dt: number)
    {
        const camera = this.game.camera;
        const scale = camera.GetScale();
        this.viewRadius = Math.hypot(bare.width, bare.height) / 2 / scale;
        // Further than this from the player, an enemy is moved back in front of it
        const recycle = this.viewRadius + 500;
        this.recycleDistanceSq = recycle * recycle;

        if (!this.enabled)
            return;

        const t = this.game.gameTime;
        const missing = this.targetCount - this.game.enemies.length;
        if (missing > 0)
        {
            // Fill up quickly when far below the target, like after a screen-clearing attack
            this.spawnBudget += dt * (3 + t * 0.12 + missing * 0.5);
            while (this.spawnBudget >= 1)
            {
                this.spawnBudget--;
                this.SpawnAtEdge(this.PickPrefab(t));
            }
        }

        if (t >= this.nextBossTime)
        {
            this.nextBossTime += BOSS_INTERVAL;
            this.SpawnBoss();
        }
    }

    SpawnAtEdge(prefab: string): Enemy
    {
        const angle = Math.random() * Math.PI * 2;
        return this.Spawn(prefab, ...this.RingPosition(angle));
    }

    Spawn(prefab: string, x: number, y: number): Enemy
    {
        const enemy = this.game.AddGameObject<Enemy>(prefab, Data.Layer.ENEMIES);
        enemy.SetPosition(x, y);
        return enemy;
    }

    // Adds many enemies at once, spread around the view's edge, for stress tests
    SpawnBurst(count: number)
    {
        const t = this.game.gameTime;
        for (let i = 0; i < count; i++)
            this.SpawnAtEdge(this.PickPrefab(t));
    }

    SpawnBoss()
    {
        this.SpawnAtEdge(Data.Prefab.OGRE);
        this.game.camera.StartShake(14, 0.8);
        this.game.hud?.Announce('A giant ogre approaches!');
    }

    // Puts an enemy that fell far behind back in front of the player, the way it's heading
    Relocate(enemy: Enemy)
    {
        const velocity = this.game.player.velocity;
        const heading = (velocity.x !== 0 || velocity.y !== 0)
            ? Math.atan2(velocity.y, velocity.x)
            : Math.random() * Math.PI * 2;
        const [x, y] = this.RingPosition(heading + (Math.random() - 0.5) * 2);

        enemy.SetPosition(x, y);
        enemy.knockX = 0;
        enemy.knockY = 0;
    }

    private RingPosition(angle: number): [number, number]
    {
        const center = this.game.camera.GetPosition();
        const distance = this.viewRadius + 40 + Math.random() * 80;
        const { width, height } = this.game.arena;
        const margin = 40;

        let x = center.x + Math.cos(angle) * distance;
        let y = center.y + Math.sin(angle) * distance;

        // Near the arena's edge the ring leaves the arena: mirror it to the other side of the view
        if (x < margin || x > width - margin)
            x = center.x - Math.cos(angle) * distance;
        if (y < margin || y > height - margin)
            y = center.y - Math.sin(angle) * distance;

        return [
            Math.min(Math.max(x, margin), width - margin),
            Math.min(Math.max(y, margin), height - margin),
        ];
    }

    private PickPrefab(t: number): string
    {
        const mix = WAVES.find(wave => t < wave.until)!.mix;
        let total = 0;
        for (const [, weight] of mix)
            total += weight;

        let roll = Math.random() * total;
        for (const [prefab, weight] of mix)
        {
            roll -= weight;
            if (roll <= 0)
                return prefab;
        }

        return mix[0][0];
    }
}
