import { Data } from '../generated/assets';
import type { Projectile } from '../objects/projectile';
import { Weapon } from '../weapons/weapon';

// Fireballs circling the player. They're projectiles that never expire and may hit the same
// enemy again after a short delay, so both collision modes handle them like any projectile.
export class OrbitComponent extends Weapon
{
    static readonly title = 'Fire Orbs';
    static readonly maxLevel = 8;
    static Describe(level: number): string
    {
        return level === 1 ? 'Orbs circle around you' : `Damage ${OrbitComponent.Damage(level)}, ${OrbitComponent.Count(level)} orbs`;
    }

    static Damage(level: number) { return 9 + 4 * (level - 1); }
    static Count(level: number) { return 2 + Math.floor(level / 2); }

    private orbs: Projectile[] = [];
    private angle = 0;
    private builtFor = '';

    protected get cooldown(): number
    {
        return Infinity;
    }

    protected Fire(): boolean
    {
        return true;
    }

    override OnFixedUpdate(dt: number)
    {
        const game = this.game;
        const count = game.weaponsEnabled ? OrbitComponent.Count(this.level) + this.stats.amount : 0;

        // Rebuild when the level or the stats change
        const key = `${count}/${this.level}/${this.stats.area}`;
        if (key !== this.builtFor)
            this.Rebuild(count, key);

        if (count === 0)
            return;

        const radius = (90 + 8 * this.level) * this.stats.area;
        this.angle += dt * (2.6 + 0.2 * this.level);

        for (let i = 0; i < this.orbs.length; i++)
        {
            const a = this.angle + i * Math.PI * 2 / this.orbs.length;
            this.orbs[i].SetPosition(this.go.x + Math.cos(a) * radius, this.go.y + Math.sin(a) * radius);
        }
    }

    override OnRemoved()
    {
        this.Rebuild(0, '');
    }

    private Rebuild(count: number, key: string)
    {
        for (const orb of this.orbs)
            orb.Remove();
        this.orbs.length = 0;
        this.builtFor = key;

        for (let i = 0; i < count; i++)
        {
            const orb = this.game.AddGameObject<Projectile>(Data.Prefab.ORB, Data.Layer.PROJECTILES);
            orb.SetScale(this.stats.area);
            orb.damage = OrbitComponent.Damage(this.level);
            orb.life = Infinity;
            orb.pierce = Infinity;
            orb.rehitDelay = 0.45;
            orb.knockback = 220;
            orb.spin = 360;
            orb.SetPosition(this.go.x, this.go.y);
            this.orbs.push(orb);
        }
    }
}
