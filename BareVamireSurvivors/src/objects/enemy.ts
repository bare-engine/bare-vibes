import { InspectorBaseClass, SerializeField } from 'bare-engine';
import { ArcadeObject, type ArcadeObjectEntity } from 'bare-engine/arcade';
import type { Game } from '../game';

export interface EnemyEntity extends ArcadeObjectEntity
{
    maxHp?: number;
    speed?: number;
    damage?: number;
    xp?: number;
    knockbackResist?: number;
    boss?: boolean;
}

// A custom class rather than a component: there are thousands of enemies, and every one
// needs the same fields. Registered classes are pooled, so spawning and dying don't allocate.
@InspectorBaseClass
export class Enemy extends ArcadeObject
{
    declare entity: EnemyEntity | null;

    static nextSpawnId = 1;

    @SerializeField maxHp = 10;
    @SerializeField speed = 80;
    @SerializeField damage = 5;
    @SerializeField xp = 1;
    @SerializeField knockbackResist = 0;
    @SerializeField boss = false;

    hp = 10;
    radius = 12;
    // Unique per life, so a pooled enemy that respawns isn't mistaken for its previous life
    spawnId = 0;
    listIndex = -1;
    knockX = 0;
    knockY = 0;
    hitFlash = 0;
    private phase = 0;

    get game(): Game
    {
        return this.scene as Game;
    }

    override OnAwake()
    {
        // Pooled: reset everything a previous life (or another prefab) may have changed.
        // Prefab values are applied after this.
        this.maxHp = 10;
        this.speed = 80;
        this.damage = 5;
        this.xp = 1;
        this.knockbackResist = 0;
        this.boss = false;
        this.knockX = 0;
        this.knockY = 0;
        this.hitFlash = 0;
    }

    override OnAdded()
    {
        this.hp = this.maxHp;
        this.spawnId = Enemy.nextSpawnId++;
        this.phase = Math.random() * Math.PI * 2;
        this.radius = this.physicsHitbox.GetRadius() * Math.abs(this.scaleX);
        this.stayInBounds = true;
        this.game.RegisterEnemy(this);
    }

    override OnRemoved()
    {
        this.game.UnregisterEnemy(this);
    }

    override OnFixedUpdate(dt: number)
    {
        const game = this.game;
        const target = game.player;
        const dx = target.x - this.x;
        const dy = target.y - this.y;
        const distSq = dx * dx + dy * dy;

        // Like Vampire Survivors: enemies left far behind reappear ahead of the player
        if (distSq > game.spawner.recycleDistanceSq && !this.boss)
        {
            game.spawner.Relocate(this);
            return;
        }

        const dist = Math.sqrt(distSq) || 1;
        const speed = this.speed * game.enemySpeedMultiplier;

        this.velocity.x = dx / dist * speed + this.knockX;
        this.velocity.y = dy / dist * speed + this.knockY;

        const decay = Math.pow(0.0001, dt); // knockback fades out in about a second
        this.knockX *= decay;
        this.knockY *= decay;

        this.flipped = dx < 0;
        this.phase += dt * (6 + this.speed * 0.04);
        this.innerRotation = Math.sin(this.phase) * 7;

        if (this.hitFlash > 0)
        {
            this.hitFlash -= dt;
            if (this.hitFlash <= 0)
                this.color.setRGBA(255, 255, 255, 255);
        }
    }

    // Returns true when this hit killed the enemy
    Hit(damage: number, knockX: number, knockY: number): boolean
    {
        if (this.hp <= 0)
            return false;

        this.hp -= damage;
        const knockScale = 1 - this.knockbackResist;
        this.knockX += knockX * knockScale;
        this.knockY += knockY * knockScale;

        this.hitFlash = 0.08;
        this.color.setRGBA(255, 90, 90, 255);

        return this.hp <= 0;
    }
}
