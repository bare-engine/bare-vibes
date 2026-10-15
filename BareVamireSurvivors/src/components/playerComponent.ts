import { Component, FlashShader, GameObject, Inspector, InspectorField, SerializeField } from 'bare-engine';
import type { ArcadeObject } from 'bare-engine/arcade';
import type { Game } from '../game';
import { Enemy } from '../objects/enemy';

export class PlayerComponent extends Component<ArcadeObject>
{
    @SerializeField
    @Inspector.Limit(0, Infinity)
    moveSpeed = 230;

    // Seconds of invincibility after being hit
    @SerializeField
    invulnerableTime = 0.35;

    @InspectorField hp = 100;
    @InspectorField level = 1;
    @InspectorField xp = 0;
    xpToNext = 5;

    facingX = 1;
    facingY = 0;
    private invulnerable = 0;

    get game(): Game
    {
        return this.scene as Game;
    }

    override OnStart()
    {
        this.hp = this.game.playerStats.maxHp;
    }

    override OnUpdate(dt: number)
    {
        const game = this.game;
        const go = this.go;
        let dx = Number(bare.keyboard.IsRightDown()) - Number(bare.keyboard.IsLeftDown());
        let dy = Number(bare.keyboard.IsDownDown()) - Number(bare.keyboard.IsUpDown());

        if (game.autopilot)
        {
            // Walk in a big circle, for the benchmark
            const t = game.gameTime * 0.35;
            dx = -Math.sin(t);
            dy = Math.cos(t);
        }
        else if (dx === 0 && dy === 0 && bare.mouse.IsDown())
        {
            // Touch and mouse: walk towards the pointer
            const target = bare.mouse.world.position;
            const tx = target.x - go.x;
            const ty = target.y - go.y;
            if (tx * tx + ty * ty > 20 * 20)
            {
                dx = tx;
                dy = ty;
            }
        }

        const length = Math.hypot(dx, dy);
        if (length > 0)
        {
            dx /= length;
            dy /= length;
            this.facingX = dx;
            this.facingY = dy;
            if (dx !== 0)
                go.flipped = dx < 0;
        }

        const speed = this.moveSpeed * game.playerStats.speed;
        go.SetVelocityXY(dx * speed, dy * speed);

        // Bob while walking
        go.innerRotation = length > 0 ? Math.sin(game.gameTime * 14) * 5 : 0;

        if (this.invulnerable > 0)
        {
            this.invulnerable -= dt;
            go.alpha = this.invulnerable > 0 && Math.floor(this.invulnerable * 20) % 2 === 0 ? 0.5 : 1;
        }

        const regen = game.playerStats.regen;
        if (regen > 0)
            this.Heal(regen * dt);
    }

    // Arcade collision mode: enemies push the player around and hurt on contact
    override OnCollisionUpdate(other: GameObject)
    {
        if (other instanceof Enemy)
            this.TouchedBy(other);
    }

    TouchedBy(enemy: Enemy)
    {
        if (this.invulnerable > 0 || this.game.godMode || this.hp <= 0)
            return;

        this.hp -= enemy.damage;
        this.invulnerable = this.invulnerableTime;
        this.game.camera.StartShake(enemy.boss ? 16 : 7, 0.25);

        this.go.AddShader(FlashShader, { duration: 0.15, fadePreDuration: 0 });

        if (this.hp <= 0)
        {
            this.hp = 0;
            this.game.GameOver();
        }
    }

    Heal(amount: number)
    {
        this.hp = Math.min(this.game.playerStats.maxHp, this.hp + amount);
    }

    AddXp(amount: number)
    {
        this.xp += amount;
        while (this.xp >= this.xpToNext)
        {
            this.xp -= this.xpToNext;
            this.level++;
            this.xpToNext = Math.floor(5 + this.level * 4 + this.level * this.level * 0.35);
            this.game.QueueLevelUp();
        }
    }
}
