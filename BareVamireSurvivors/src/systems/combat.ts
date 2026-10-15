import type { Game } from '../game';
import type { Enemy } from '../objects/enemy';

// 'arcade': the engine's ArcadePhysicsController resolves enemy crowding and reports hits as
//           collision events (layers + collidesWith in settingsData.json).
// 'grid':   engine collisions are switched off (velocity is still integrated by the engine),
//           and this class does the same work with the game's own spatial grid.
// Switching at runtime gives an A/B comparison of the engine's collision cost.
export type CollisionMode = 'arcade' | 'grid';

export class Combat
{
    mode: CollisionMode = 'arcade';

    // Largest enemy radius, so grid queries also find big enemies whose center is in another cell
    private static readonly MAX_ENEMY_RADIUS = 34;

    constructor(private game: Game) {}

    SetMode(mode: CollisionMode)
    {
        this.mode = mode;
        this.game.arcade.setCollisionsEnabled(mode === 'arcade');
    }

    // Runs after the engine's physics step
    FixedUpdate()
    {
        if (this.mode !== 'grid')
            return;

        this.SeparateEnemies();
        this.HitWithProjectiles();
        this.TouchPlayer();
        this.KeepInArena();
    }

    private SeparateEnemies()
    {
        const grid = this.game.grid;
        const enemies = this.game.enemies;
        const reach = Combat.MAX_ENEMY_RADIUS * 2;

        for (let i = 0; i < enemies.length; i++)
        {
            const a = enemies[i];

            grid.Query(a.x, a.y, a.radius + reach, b => {
                // Each pair once
                if (b.spawnId <= a.spawnId)
                    return;

                const dx = b.x - a.x;
                const dy = b.y - a.y;
                const minDist = a.radius + b.radius;
                const distSq = dx * dx + dy * dy;
                if (distSq >= minDist * minDist)
                    return;

                const dist = Math.sqrt(distSq) || 0.01;
                const push = (minDist - dist) * 0.5;
                const nx = dx / dist;
                const ny = dy / dist;
                // Heavy enemies (bosses) barely move
                const wa = 1 - a.knockbackResist * 0.9;
                const wb = 1 - b.knockbackResist * 0.9;
                const total = wa + wb || 1;

                a.x -= nx * push * 2 * wa / total;
                a.y -= ny * push * 2 * wa / total;
                b.x += nx * push * 2 * wb / total;
                b.y += ny * push * 2 * wb / total;
            });
        }
    }

    private HitWithProjectiles()
    {
        const grid = this.game.grid;
        const projectiles = this.game.projectiles;

        // Backwards: a projectile can be removed when it runs out of pierce
        for (let i = projectiles.length - 1; i >= 0; i--)
        {
            const projectile = projectiles[i];
            if (!projectile)
                continue;

            grid.Query(projectile.x, projectile.y, projectile.radius + Combat.MAX_ENEMY_RADIUS, enemy => {
                const dx = enemy.x - projectile.x;
                const dy = enemy.y - projectile.y;
                const r = enemy.radius + projectile.radius;
                if (dx * dx + dy * dy < r * r)
                    projectile.TryHit(enemy);

                return projectile.pierce <= 0;
            });
        }
    }

    private TouchPlayer()
    {
        const player = this.game.player;
        const playerRadius = this.game.playerRadius;

        this.game.grid.Query(player.x, player.y, playerRadius + Combat.MAX_ENEMY_RADIUS, (enemy: Enemy) => {
            const dx = enemy.x - player.x;
            const dy = enemy.y - player.y;
            const r = enemy.radius + playerRadius;
            if (dx * dx + dy * dy < r * r)
                this.game.playerComp.TouchedBy(enemy);
        });
    }

    private KeepInArena()
    {
        const { width, height } = this.game.arena;

        for (const enemy of this.game.enemies)
        {
            const r = enemy.radius;
            if (enemy.x < r) enemy.x = r;
            else if (enemy.x > width - r) enemy.x = width - r;
            if (enemy.y < r) enemy.y = r;
            else if (enemy.y > height - r) enemy.y = height - r;
        }

        const player = this.game.player;
        const pr = this.game.playerRadius;
        player.x = Math.min(Math.max(player.x, pr), width - pr);
        player.y = Math.min(Math.max(player.y, pr), height - pr);
    }
}
