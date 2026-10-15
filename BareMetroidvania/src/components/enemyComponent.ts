import { Component, Dropdown, FlashShader, Inspector, ParticleComponent, SerializeField, TweenTo } from "bare-engine";
import { ArcadeObject } from "bare-engine/arcade";
import { HitboxRect, RoomGeometry } from "../world";

declare module "bare-engine"
{
    interface BareUserEvents
    {
        enemyDied: { enemy: ArcadeObject };
    }
}

// walk: PATROLS, TURNS AT WALLS AND LEDGES. hop: JUMPS TOWARDS THE PLAYER.
// fly: HOVERS, SWOOPS AT THE PLAYER WHEN CLOSE. ghost: DRIFTS AFTER THE PLAYER THROUGH WALLS.
// none: NO MOVEMENT OF ITS OWN (THE BOSS MOVES ITSELF)
export class EnemyComponent extends Component<ArcadeObject>
{
    @SerializeField @Dropdown(["walk", "hop", "fly", "ghost", "none"]) mode = "walk";
    @SerializeField @Inspector.Int health = 2;
    @SerializeField speed = 35;
    @SerializeField @Inspector.Int damage = 1;
    @SerializeField knockback = true;

    dead = false;
    dir = 1;
    private stun = 0;
    private timer = 0;
    private homeX = 0;
    private homeY = 0;
    private time = Math.random() * 10;

    override OnStart(): void
    {
        this.homeX = this.go.x;
        this.homeY = this.go.y;
        this.dir = Math.random() < 0.5 ? -1 : 1;
        this.timer = 0.5 + Math.random();
    }

    get player(): ArcadeObject | null
    {
        return bare.object.GetByName<ArcadeObject>("player");
    }

    override OnFixedUpdate(dt: number): void
    {
        if (this.dead)
            return;

        this.time += dt;
        this.stun -= dt;
        var go = this.go;

        if (this.stun > 0)
        {
            if (!go.static) go.velocity.x *= 0.85;
            return;
        }

        var player = this.player;
        var dx = player ? player.x - go.x : 0;
        var dy = player ? (player.y - 8) - go.y : 0;
        var dist = Math.hypot(dx, dy);

        switch (this.mode)
        {
            case "walk":
            {
                var r = HitboxRect(go);
                var frontX = this.dir > 0 ? r.x + r.w + 1 : r.x - 1;
                var wallAhead = RoomGeometry.IsSolidAt(frontX, r.y + r.h - 4);
                var groundAhead = RoomGeometry.IsSolidAt(frontX, r.y + r.h + 3, true);
                if (go.IsGrounded() && (wallAhead || !groundAhead || frontX < 2 || frontX > bare.level.width - 2))
                    this.dir = -this.dir;
                go.velocity.x = this.dir * this.speed;
                go.flipped = this.dir < 0;
                go.innerRotation = Math.sin(this.time * 14) * 6;
                break;
            }
            case "hop":
            {
                if (go.IsGrounded())
                {
                    go.velocity.x = 0;
                    this.timer -= dt;
                    if (this.timer <= 0)
                    {
                        this.timer = 1 + Math.random() * 0.8;
                        if (player && dist < 130)
                            this.dir = Math.sign(dx) || 1;
                        else if (Math.random() < 0.4)
                            this.dir = -this.dir;
                        go.velocity.y = -230;
                        go.velocity.x = this.dir * this.speed;
                        go.innerScaleY = 1.3;
                        TweenTo(go, 0.25, { innerScaleY: 1 });
                    }
                }
                go.flipped = this.dir < 0;
                break;
            }
            case "fly":
            {
                // STATIC SENSOR, MOVED BY HAND: ARCADE PHYSICS HAS NO WAY TO TURN GRAVITY OFF PER OBJECT
                var tx = this.homeX + Math.sin(this.time * 1.3) * 24;
                var ty = this.homeY + Math.sin(this.time * 3.1) * 8;
                if (player && dist < 110)
                {
                    tx = player.x;
                    ty = player.y - 8;
                }
                this.MoveTowards(tx, ty, this.speed * dt);
                go.innerScaleY = 1 + Math.sin(this.time * 20) * 0.15;
                break;
            }
            case "ghost":
            {
                if (player && dist < 200)
                    this.MoveTowards(player.x, player.y - 8 + Math.sin(this.time * 2) * 10, this.speed * dt);
                go.alpha = 0.55 + Math.sin(this.time * 3) * 0.2;
                break;
            }
        }
    }

    MoveTowards(x: number, y: number, step: number)
    {
        var dx = x - this.go.x, dy = y - this.go.y;
        var d = Math.hypot(dx, dy);
        if (d < 0.5)
            return;
        var s = Math.min(step, d);
        this.go.x += dx / d * s;
        this.go.y += dy / d * s;
        if (Math.abs(dx) > 1)
            this.go.flipped = dx < 0;
    }

    Hit(damage: number, fromX: number)
    {
        if (this.dead)
            return;

        this.health -= damage;
        this.go.AddShader(FlashShader);
        this.go.GetComponent(ParticleComponent)?.Fire();

        var away = this.go.x < fromX ? -1 : 1;
        if (this.knockback)
        {
            this.stun = 0.25;
            if (this.go.static)
                this.go.x += away * 10;
            else
            {
                this.go.velocity.x = away * 140;
                this.go.velocity.y = -120;
            }
        }

        if (this.health <= 0)
            this.Die();
    }

    async Die()
    {
        this.dead = true;
        this.go.collide = false;
        this.go.GetComponent(ParticleComponent)?.Fire();
        bare.events.emit("enemyDied", { enemy: this.go });
        bare.sound.Play("coin", { volume: 0.06, rate: 0.6 });

        // THE OBJECT STAYS A MOMENT LONGER, OTHERWISE ITS PARTICLES ARE REMOVED WITH IT
        TweenTo(this.go, 0.3, { alpha: 0, innerScaleY: 0.2, innerScaleX: 1.6 });
        if (!await this.scene.Wait(0.5))
            return;
        this.go.Remove();
    }
}
