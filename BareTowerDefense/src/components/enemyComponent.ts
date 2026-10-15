import { Color, Component, FlashShader, Inspector, InspectorField, SerializeField, Vec2 } from 'bare-engine';
import type { Game } from '../game';

const BAR_WIDTH = 36;
const BAR_BACK = Color.fromHex('#000000aa');
const BAR_FULL = Color.fromHex('#4cd964');
const BAR_LOW = Color.fromHex('#ff3b30');
const SLOWED_TINT = Color.fromHex('#9fdcff');

export class EnemyComponent extends Component
{
    @SerializeField @Inspector.Limit(1, Infinity)
    maxHealth = 30;

    @SerializeField @Inspector.Limit(0, Infinity)
    speed = 70;

    @SerializeField
    reward = 5;

    @SerializeField
    damage = 1;

    @InspectorField
    health = 30;

    // DISTANCE WALKED ALONG THE PATH, TOWERS TARGET THE ENEMY THAT GOT FURTHEST
    progress = 0;
    alive = false;

    private waypoints: Vec2[] = [];
    private nextWaypoint = 1;
    private slowFactor = 1;
    private slowTimer = 0;
    private bobTime = 0;

    get game(): Game { return this.scene as Game; }

    // CALLED BY THE GAME RIGHT AFTER SPAWNING, THE COMPONENT HAS ALREADY STARTED BY THEN
    Spawn(waypoints: Vec2[], healthMultiplier: number)
    {
        this.waypoints = waypoints;
        this.nextWaypoint = 1;
        this.progress = 0;
        this.maxHealth = Math.round(this.maxHealth * healthMultiplier);
        this.health = this.maxHealth;
        this.alive = true;
        this.bobTime = Math.random() * 10;
        this.go.SetPosition(waypoints[0].x, waypoints[0].y);
    }

    override OnRemoved()
    {
        this.alive = false;
    }

    override OnFixedUpdate(dt: number)
    {
        if (!this.alive || this.game.isGameOver)
            return;

        if (this.slowTimer > 0)
        {
            this.slowTimer -= dt;
            if (this.slowTimer <= 0)
            {
                this.slowFactor = 1;
                this.go.SetColor(Color.White);
            }
        }

        let move = this.speed * this.slowFactor * dt;
        while (move > 0 && this.nextWaypoint < this.waypoints.length)
        {
            const target = this.waypoints[this.nextWaypoint];
            const dx = target.x - this.go.x;
            const dy = target.y - this.go.y;
            const distance = Math.hypot(dx, dy);

            if (Math.abs(dx) > 0.01)
                this.go.flipped = dx < 0;

            if (distance <= move)
            {
                this.go.SetPosition(target.x, target.y);
                this.nextWaypoint++;
                this.progress += distance;
                move -= distance;
            }
            else
            {
                this.go.x += dx / distance * move;
                this.go.y += dy / distance * move;
                this.progress += move;
                move = 0;
            }
        }

        this.bobTime += dt;
        this.go.innerY = Math.sin(this.bobTime * 10) * 2;

        if (this.nextWaypoint >= this.waypoints.length)
            this.game.OnEnemyLeaked(this);
    }

    TakeDamage(amount: number)
    {
        if (!this.alive)
            return;

        this.health -= amount;
        // A FLASH ON EVERY HIT REPLACES THE RUNNING ONE
        this.go.AddShader(FlashShader, { duration: 0.12, fadePreDuration: 0.03 });

        if (this.health <= 0)
            this.game.OnEnemyKilled(this);
    }

    Slow(factor: number, duration: number)
    {
        if (!this.alive)
            return;

        this.slowFactor = Math.min(this.slowFactor, factor);
        this.slowTimer = Math.max(this.slowTimer, duration);
        this.go.SetColor(SLOWED_TINT);
    }

    override OnPostRender()
    {
        if (!this.alive || this.health >= this.maxHealth)
            return;

        const ratio = Math.max(0, this.health / this.maxHealth);
        const x = this.go.x - BAR_WIDTH / 2;
        const y = this.go.y - this.go.height / 2 - 10;

        bare.drawRect({ position: new Vec2(x - 1, y - 1), width: BAR_WIDTH + 2, height: 6, color: BAR_BACK });
        bare.drawRect({ position: new Vec2(x, y), width: BAR_WIDTH * ratio, height: 4, color: ratio > 0.35 ? BAR_FULL : BAR_LOW });
    }
}
