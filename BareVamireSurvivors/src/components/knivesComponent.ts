import { Data } from '../generated/assets';
import type { Projectile } from '../objects/projectile';
import { Weapon } from '../weapons/weapon';

// Throws knives at the mouse pointer, or where the player walks on touch screens.
// Aiming uses bare.mouse.world, so it has to stay right while the camera moves and zooms.
export class KnivesComponent extends Weapon
{
    static readonly title = 'Knives';
    static readonly maxLevel = 8;
    static Describe(level: number): string
    {
        return level === 1 ? 'Thrown at the mouse pointer' : `Damage ${KnivesComponent.Damage(level)}, ${KnivesComponent.Count(level)} knives`;
    }

    static Damage(level: number) { return 7 + 3 * (level - 1); }
    static Count(level: number) { return 1 + Math.floor(level / 2); }

    static readonly SPEED = 1000;

    protected get cooldown(): number
    {
        return 0.85 - 0.05 * (this.level - 1);
    }

    protected Fire(): boolean
    {
        const game = this.game;
        const go = this.go;
        const player = game.playerComp;

        let angle: number;
        if (!bare.mobile)
        {
            const mouse = bare.mouse.world.position;
            angle = Math.atan2(mouse.y - go.y, mouse.x - go.x);
        }
        else
            angle = Math.atan2(player.facingY, player.facingX);

        const count = KnivesComponent.Count(this.level) + this.stats.amount;
        for (let i = 0; i < count; i++)
        {
            const spread = (i - (count - 1) / 2) * 0.09;
            const a = angle + spread;
            const knife = game.AddGameObject<Projectile>(Data.Prefab.KNIFE, Data.Layer.PROJECTILES);
            knife.SetPosition(go.x + Math.cos(a) * 10, go.y + Math.sin(a) * 10);
            knife.SetRotation(a * 180 / Math.PI);
            knife.SetVelocityXY(Math.cos(a) * KnivesComponent.SPEED, Math.sin(a) * KnivesComponent.SPEED);
            knife.SetScale(this.stats.area);
            knife.damage = KnivesComponent.Damage(this.level);
            knife.pierce = 1 + Math.floor(this.level / 3);
            knife.knockback = 60;
            knife.life = 0.9;
        }

        return true;
    }
}
