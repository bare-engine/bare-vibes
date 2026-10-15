import type { GameObject } from 'bare-engine';
import { Data } from '../generated/assets';
import { Weapon } from '../weapons/weapon';

// Damages every enemy within an aura around the player
export class GarlicComponent extends Weapon
{
    static readonly title = 'Garlic';
    static readonly maxLevel = 8;
    static Describe(level: number): string
    {
        return level === 1 ? 'Hurts enemies close to you' : `Damage ${GarlicComponent.Damage(level)}, radius ${GarlicComponent.Radius(level)}`;
    }

    static Damage(level: number) { return 4 + 2 * (level - 1); }
    static Radius(level: number) { return 70 + 12 * (level - 1); }

    private aura: GameObject | null = null;
    private pulse = 0;

    protected get cooldown(): number
    {
        return 0.6 - 0.025 * (this.level - 1);
    }

    override OnStart()
    {
        // Child space starts at the parent's texture top left, so move the aura onto the player's pivot
        this.aura = this.go.AddChild(Data.Prefab.AURA);
        this.aura.SetPosition(this.go.pivotX, this.go.pivotY);
        this.aura.SetAlpha(0.5);
    }

    override OnRemoved()
    {
        this.aura?.Remove();
        this.aura = null;
    }

    override OnUpdate(dt: number)
    {
        if (!this.aura)
            return;

        // The aura is a child of the player, so its scale is relative to the player's
        const radius = this.Radius();
        this.aura.SetScale(radius * 2 / this.aura.texture!.width / this.go.scaleX);
        this.aura.visible = this.game.weaponsEnabled;

        this.pulse = Math.max(0, this.pulse - dt * 3);
        this.aura.alpha = 0.35 + this.pulse * 0.5;
        this.aura.rotation += dt * 20;
    }

    protected Fire(): boolean
    {
        const game = this.game;
        const go = this.go;
        const radius = this.Radius();
        const damage = GarlicComponent.Damage(this.level);

        // DamageEnemy can remove enemies, so collect first
        const hits = game.QueryEnemies(go.x, go.y, radius);
        for (const enemy of hits)
        {
            const dx = enemy.x - go.x;
            const dy = enemy.y - go.y;
            const dist = Math.hypot(dx, dy) || 1;
            game.DamageEnemy(enemy, damage, dx / dist * 90, dy / dist * 90);
        }

        if (hits.length > 0)
            this.pulse = 1;

        return true;
    }

    private Radius(): number
    {
        return GarlicComponent.Radius(this.level) * this.stats.area;
    }
}
