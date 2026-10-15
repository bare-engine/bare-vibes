import { Component, SerializeField, Vec2 } from 'bare-engine';
import type { Game } from '../game';
import { EnemyComponent } from './enemyComponent';

export class ProjectileComponent extends Component
{
    @SerializeField
    speed = 500;

    private target: EnemyComponent | null = null;
    private aim = new Vec2();
    private damage = 0;
    private splash = 0;
    private slow = 0;
    private slowDuration = 0;
    private launched = false;

    get game(): Game { return this.scene as Game; }

    Launch(target: EnemyComponent, damage: number, splash: number, slow: number, slowDuration: number)
    {
        this.target = target;
        this.aim.set(target.go.x, target.go.y);
        this.damage = damage;
        this.splash = splash;
        this.slow = slow;
        this.slowDuration = slowDuration;
        this.launched = true;
    }

    override OnRemoved()
    {
        this.launched = false;
        this.target = null;
    }

    override OnFixedUpdate(dt: number)
    {
        if (!this.launched)
            return;

        // KEEP HOMING WHILE THE TARGET LIVES, OTHERWISE FLY TO WHERE IT WAS
        if (this.target?.alive)
            this.aim.set(this.target.go.x, this.target.go.y);
        else
            this.target = null;

        const move = this.speed * dt;
        const dx = this.aim.x - this.go.x;
        const dy = this.aim.y - this.go.y;
        const distance = Math.hypot(dx, dy);

        this.go.rotation = bare.util.Direction(this.go.position, this.aim);

        if (distance <= move)
        {
            this.Impact();
            return;
        }

        this.go.x += dx / distance * move;
        this.go.y += dy / distance * move;
    }

    private Impact()
    {
        this.launched = false;

        if (this.splash > 0)
        {
            const splashSquared = this.splash * this.splash;
            for (const enemy of [...bare.component.GetAllByType(EnemyComponent)])
            {
                const dx = enemy.go.x - this.aim.x;
                const dy = enemy.go.y - this.aim.y;
                if (dx * dx + dy * dy <= splashSquared)
                    this.Hit(enemy);
            }
            this.game.Explosion(this.aim, this.splash);
        }
        else if (this.target)
        {
            this.Hit(this.target);
        }

        this.go.Remove();
    }

    private Hit(enemy: EnemyComponent)
    {
        if (this.slow > 0)
            enemy.Slow(this.slow, this.slowDuration);

        enemy.TakeDamage(this.damage);
    }
}
