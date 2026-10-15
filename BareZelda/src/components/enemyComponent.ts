import { BlockedState, Component, FlashShader, GameObject, SerializeField, TweenTo, Vec2 } from 'bare-engine';
import { ArcadeObject } from 'bare-engine/arcade';
import { Burst } from '../game/fx';
import { Center, DIRS, HitInfo } from '../game/hit';
import { Sfx } from '../game/sfx';
import { Data } from '../generated/assets';
import { World } from '../scenes/world';

// ALL SMALL ENEMIES. kind PICKS THE BEHAVIOR:
//   slime     HOPS AROUND, SOMETIMES TOWARD YOU
//   bat       FLUTTERS IN SHORT DASHES
//   octo      WALKS IN STRAIGHT LINES AND SPITS ROCKS WHEN YOU LINE UP WITH IT
//   skeleton  CHASES YOU WHEN YOU COME CLOSE
export class EnemyComponent extends Component<ArcadeObject>
{
    @SerializeField kind = 'slime';
    @SerializeField hp = 2;
    @SerializeField speed = 30;
    @SerializeField damage = 1;
    // ENEMIES OF A GROUP OPEN THEIR GROUP'S GATE WHEN THEY'RE ALL DEFEATED
    @SerializeField group = '';

    private timer = 0;
    private moving = false;
    private dir = new Vec2();
    private knockTime = 0;
    private invulnTime = 0;
    private facing = 'down';
    private home = new Vec2();

    override OnStart()
    {
        this.timer = Math.random() * 1.2;
        this.home = this.go.position.clone();
    }

    private get world() { return World.instance; }

    override OnFixedUpdate(dt: number)
    {
        this.invulnTime -= dt;
        const world = this.world;
        const player = world.player;

        // ONLY MOVE WHEN THE PLAYER IS NEAR, AND IN DUNGEONS ONLY IN THE PLAYER'S ROOM
        const near = Math.abs(player.x - this.go.x) < 200 && Math.abs(player.y - this.go.y) < 130
            && (!world.isDungeon || world.InSameRoom(this.go.position, player.position));
        if (!near || world.pc.dead || world.calmTime > 0)
        {
            this.go.ResetVelocity();
            return;
        }

        if (this.knockTime > 0)
        {
            this.knockTime -= dt;
            this.go.velocity.x *= 0.85;
            this.go.velocity.y *= 0.85;
            return;
        }

        this.timer -= dt;
        const toPlayer = Center(player).subtract(Center(this.go));
        const dist = toPlayer.length();

        switch (this.kind)
        {
            case 'slime': this.Slime(toPlayer, dist); break;
            case 'bat': this.Bat(toPlayer, dist); break;
            case 'octo': this.Octo(toPlayer); break;
            case 'skeleton': this.Skeleton(toPlayer, dist); break;
        }

        if (this.go.velocity.x != 0)
            this.go.flipped = this.go.velocity.x < 0;
    }

    private RandomDir(): Vec2
    {
        const a = Math.random() * Math.PI * 2;
        return new Vec2(Math.cos(a), Math.sin(a));
    }

    private Slime(toPlayer: Vec2, dist: number)
    {
        if (this.timer > 0)
        {
            // SQUASH WHILE HOPPING
            this.go.innerScaleY = this.moving ? 0.85 + Math.abs(Math.sin(this.timer * 18)) * 0.25 : 1;
            if (this.moving && this.go.blocked != BlockedState.None)
                this.go.ResetVelocity();
            return;
        }
        this.moving = !this.moving;
        if (this.moving)
        {
            this.dir = dist < 90 && Math.random() < 0.6 ? toPlayer.normalized() : this.RandomDir();
            this.go.SetVelocityXY(this.dir.x * this.speed * 1.8, this.dir.y * this.speed * 1.8);
            this.timer = 0.35;
        }
        else
        {
            this.go.ResetVelocity();
            this.go.innerScaleY = 1;
            this.timer = 0.5 + Math.random() * 0.8;
        }
    }

    private Bat(toPlayer: Vec2, dist: number)
    {
        if (this.timer <= 0)
        {
            const rest = Math.random() < 0.2;
            this.dir = rest ? new Vec2() : (dist < 100 && Math.random() < 0.65 ? toPlayer.normalized().add(this.RandomDir().multiply(0.6)).normalized() : this.RandomDir());
            this.timer = rest ? 0.6 : 0.35 + Math.random() * 0.5;
        }
        const wobble = Math.sin(bare.time / 90) * 0.3;
        this.go.SetVelocityXY((this.dir.x - this.dir.y * wobble) * this.speed, (this.dir.y + this.dir.x * wobble) * this.speed);
        this.go.innerY = Math.sin(bare.time / 150) * 2;
    }

    private Octo(toPlayer: Vec2)
    {
        if (this.timer > 0)
        {
            if (this.moving && this.go.blocked != BlockedState.None)
                this.timer = 0;
            return;
        }

        if (this.moving)
        {
            // STOP, AND SHOOT IF THE PLAYER IS IN LINE
            this.moving = false;
            this.go.ResetVelocity();
            this.timer = 0.7;
            const aligned = Math.abs(toPlayer.x) < 10 || Math.abs(toPlayer.y) < 10;
            if (aligned && toPlayer.length() < 150)
            {
                this.facing = Math.abs(toPlayer.x) > Math.abs(toPlayer.y) ? (toPlayer.x < 0 ? 'left' : 'right') : (toPlayer.y < 0 ? 'up' : 'down');
                this.Spit();
            }
        }
        else
        {
            this.moving = true;
            this.facing = bare.util.Choose('up', 'down', 'left', 'right');
            const d = DIRS[this.facing];
            // DON'T WALK INTO WATER OR WALLS
            const ahead = Center(this.go).add(d.multiply(14));
            if (!this.world.IsWalkable(ahead.x, ahead.y))
            {
                this.timer = 0.2;
                return;
            }
            this.go.SetVelocityXY(d.x * this.speed, d.y * this.speed);
            this.timer = 0.8 + Math.random() * 1.2;
        }
    }

    private Spit()
    {
        const d = DIRS[this.facing];
        const from = Center(this.go).add(d.multiply(8));
        const rock = this.world.AddGameObject<ArcadeObject>({ extends: Data.Prefab.ENEMY_ROCK, position: { x: from.x, y: from.y } });
        rock.SetVelocityXY(d.x * 120, d.y * 120);
        TweenTo(this.go, 0.06, { innerScaleX: 1.25, innerScaleY: 1.25, yoyo: true, repeat: 1 });
    }

    private Skeleton(toPlayer: Vec2, dist: number)
    {
        if (dist < 110)
        {
            const d = toPlayer.normalized();
            this.go.SetVelocityXY(d.x * this.speed, d.y * this.speed);
            return;
        }
        if (this.timer <= 0)
        {
            const back = this.home.subtract(this.go.position);
            this.dir = back.length() > 48 ? back.normalized() : (Math.random() < 0.4 ? new Vec2() : this.RandomDir());
            this.timer = 0.8 + Math.random();
        }
        this.go.SetVelocityXY(this.dir.x * this.speed * 0.5, this.dir.y * this.speed * 0.5);
    }

    // TOUCHING THE PLAYER HURTS THEM
    override OnCollisionUpdate(other: GameObject)
    {
        if (other === this.world.player && this.hp > 0)
            this.world.pc.Hurt(this.damage, Center(this.go));
    }

    override OnHit(hit: HitInfo)
    {
        if (hit.kind == 'enemy' || this.invulnTime > 0 || this.hp <= 0)
            return;

        this.hp -= hit.damage;
        this.invulnTime = 0.25;
        this.go.AddShader(FlashShader);

        const away = Center(this.go).subtract(hit.from);
        const d = away.isZero() ? new Vec2(0, 1) : away.normalized();
        this.go.SetVelocityXY(d.x * 170, d.y * 170);
        this.knockTime = 0.16;

        if (this.hp <= 0)
            this.Die();
        else
            Sfx('hit', 0.4);
    }

    private Die()
    {
        const world = this.world;
        const center = Center(this.go);
        Sfx('kill', 0.45);
        Burst(world, 'puff', center);
        world.RandomDrop(this.go.position.clone());
        world.OnEnemyKilled(this);
        this.go.Remove();
    }
}
