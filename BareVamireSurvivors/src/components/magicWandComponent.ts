import { Data } from '../generated/assets';
import type { Projectile } from '../objects/projectile';
import { Weapon } from '../weapons/weapon';

// Fires bolts at the nearest enemies
export class MagicWandComponent extends Weapon
{
    static readonly title = 'Magic Wand';
    static readonly maxLevel = 8;
    static Describe(level: number): string
    {
        return level === 1 ? 'Fires at the nearest enemy' : `Damage ${MagicWandComponent.Damage(level)}, ${MagicWandComponent.Count(level)} bolts`;
    }

    static Damage(level: number) { return 10 + 4 * (level - 1); }
    static Count(level: number) { return 1 + Math.floor(level / 3); }

    static readonly RANGE = 900;
    static readonly SPEED = 650;

    protected get cooldown(): number
    {
        return 1.1 - 0.07 * (this.level - 1);
    }

    protected Fire(): boolean
    {
        const game = this.game;
        const go = this.go;
        const target = game.grid.Nearest(go.x, go.y, MagicWandComponent.RANGE);
        if (!target)
            return false;

        const count = MagicWandComponent.Count(this.level) + this.stats.amount;
        const baseAngle = Math.atan2(target.y - go.y, target.x - go.x);

        for (let i = 0; i < count; i++)
        {
            const angle = baseAngle + (i - (count - 1) / 2) * 0.12;
            const bolt = game.AddGameObject<Projectile>(Data.Prefab.BOLT, Data.Layer.PROJECTILES);
            bolt.SetPosition(go.x, go.y);
            bolt.SetVelocityXY(Math.cos(angle) * MagicWandComponent.SPEED, Math.sin(angle) * MagicWandComponent.SPEED);
            bolt.SetScale(this.stats.area);
            bolt.damage = MagicWandComponent.Damage(this.level);
            bolt.pierce = 1 + Math.floor(this.level / 4);
            bolt.life = 1.6;
        }

        return true;
    }
}
