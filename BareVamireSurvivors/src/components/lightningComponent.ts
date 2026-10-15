import { Color, Vec2 } from 'bare-engine';
import type { Enemy } from '../objects/enemy';
import { Weapon } from '../weapons/weapon';

type Strike = { x: number; y: number; time: number; points: Vec2[] };

// Strikes random enemies that are on screen. Uses the camera to find what's visible.
export class LightningComponent extends Weapon
{
    static readonly title = 'Lightning Ring';
    static readonly maxLevel = 8;
    static Describe(level: number): string
    {
        return level === 1 ? 'Strikes enemies on screen' : `Damage ${LightningComponent.Damage(level)}, ${LightningComponent.Count(level)} strikes`;
    }

    static Damage(level: number) { return 22 + 8 * (level - 1); }
    static Count(level: number) { return 2 + level; }

    static readonly FLASH_SECONDS = 0.18;
    private static readonly color = Color.fromHex('#bfe6ff');
    private static readonly glow = Color.fromHex('#4fa8ff80');

    private strikes: Strike[] = [];

    protected get cooldown(): number
    {
        return 2.2 - 0.12 * (this.level - 1);
    }

    protected Fire(): boolean
    {
        const game = this.game;
        const view = game.GetViewRect(-40);
        const visible: Enemy[] = [];

        for (const enemy of game.enemies)
            if (enemy.x > view.x && enemy.x < view.x + view.width && enemy.y > view.y && enemy.y < view.y + view.height)
                visible.push(enemy);

        if (visible.length === 0)
            return false;

        const count = Math.min(visible.length, LightningComponent.Count(this.level) + this.stats.amount);
        const damage = LightningComponent.Damage(this.level);
        const splash = 45 * this.stats.area;

        for (let i = 0; i < count; i++)
        {
            // Partial shuffle: pick a random one of the remaining
            const pick = i + Math.floor(Math.random() * (visible.length - i));
            [visible[i], visible[pick]] = [visible[pick], visible[i]];
            const target = visible[i];
            const x = target.x;
            const y = target.y;

            for (const enemy of game.QueryEnemies(x, y, splash))
                game.DamageEnemy(enemy, damage, 0, 0);

            this.strikes.push({ x, y, time: game.gameTime, points: LightningComponent.Bolt(x, y) });
        }

        game.camera.StartShake(3, 0.12);
        return true;
    }

    // Drawn above the objects
    override OnPostRender()
    {
        const now = this.game.gameTime;
        this.strikes = this.strikes.filter(strike => now - strike.time < LightningComponent.FLASH_SECONDS);

        for (const strike of this.strikes)
        {
            const position = new Vec2(0, 0);
            bare.drawLine({ position, points: strike.points, width: 9, color: LightningComponent.glow });
            bare.drawLine({ position, points: strike.points, width: 3, color: LightningComponent.color });
            bare.drawCircle({ position: new Vec2(strike.x, strike.y), radius: 18, color: LightningComponent.glow });
        }
    }

    override OnRemoved()
    {
        this.strikes.length = 0;
    }

    // A jagged line from above the screen down to the target
    private static Bolt(x: number, y: number): Vec2[]
    {
        const points: Vec2[] = [];
        const top = y - 500;
        const segments = 9;
        for (let i = 0; i <= segments; i++)
        {
            const t = i / segments;
            const jitter = i === 0 || i === segments ? 0 : (Math.random() - 0.5) * 50;
            points.push(new Vec2(x + jitter, top + (y - top) * t));
        }
        return points;
    }
}
