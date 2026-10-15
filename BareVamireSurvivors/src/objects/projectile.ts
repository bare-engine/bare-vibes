import { InspectorBaseClass, SerializeField } from 'bare-engine';
import { ArcadeObject, type ArcadeObjectEntity } from 'bare-engine/arcade';
import type { Game } from '../game';
import { Enemy } from './enemy';

export interface ProjectileEntity extends ArcadeObjectEntity
{
    damage?: number;
    pierce?: number;
    life?: number;
    knockback?: number;
    rehitDelay?: number;
}

@InspectorBaseClass
export class Projectile extends ArcadeObject
{
    declare entity: ProjectileEntity | null;

    @SerializeField damage = 5;
    // Enemies it can hit before it's removed
    @SerializeField pierce = 1;
    // Seconds before it's removed. Infinity for orbiting projectiles, which their weapon removes
    @SerializeField life = 2;
    @SerializeField knockback = 150;
    // 0: hit each enemy once. Above 0: may hit the same enemy again after this many seconds
    @SerializeField rehitDelay = 0;

    spin = 0;
    radius = 8;
    listIndex = -1;
    // Enemy spawnId -> game time at which it may be hit again
    private hits = new Map<number, number>();

    get game(): Game
    {
        return this.scene as Game;
    }

    override OnAwake()
    {
        this.damage = 5;
        this.pierce = 1;
        this.life = 2;
        this.knockback = 150;
        this.rehitDelay = 0;
        this.spin = 0;
        this.hits.clear();
    }

    override OnAdded()
    {
        this.radius = this.physicsHitbox.GetRadius() * Math.abs(this.scaleX);
        this.game.RegisterProjectile(this);
    }

    override OnRemoved()
    {
        this.game.UnregisterProjectile(this);
    }

    override OnFixedUpdate(dt: number)
    {
        if (this.spin !== 0)
            this.rotation += this.spin * dt;

        this.life -= dt;
        if (this.life <= 0)
            this.Remove();
    }

    // Arcade collision mode: the engine reports overlaps with enemies every step
    override OnCollisionUpdate(other: ArcadeObject)
    {
        if (other instanceof Enemy)
            this.TryHit(other);
    }

    TryHit(enemy: Enemy)
    {
        if (this.pierce <= 0 || enemy.hp <= 0)
            return;

        const now = this.game.gameTime;
        const allowedAt = this.hits.get(enemy.spawnId);
        if (allowedAt !== undefined && now < allowedAt)
            return;

        this.hits.set(enemy.spawnId, this.rehitDelay > 0 ? now + this.rehitDelay : Infinity);
        if (this.hits.size > 256)
            this.ForgetOldHits(now);

        const dx = enemy.x - this.x;
        const dy = enemy.y - this.y;
        const dist = Math.hypot(dx, dy) || 1;
        this.game.DamageEnemy(enemy, this.damage, dx / dist * this.knockback, dy / dist * this.knockback);

        if (this.life !== Infinity && --this.pierce <= 0)
            this.Remove();
    }

    private ForgetOldHits(now: number)
    {
        for (const [spawnId, allowedAt] of this.hits)
            if (allowedAt <= now)
                this.hits.delete(spawnId);
    }
}
