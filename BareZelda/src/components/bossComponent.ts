import { BlockedState, Component, FlashShader, GameObject, SaveData, SerializeField, TweenTo, Vec2 } from 'bare-engine';
import { ArcadeObject } from 'bare-engine/arcade';
import { Burst } from '../game/fx';
import { Center, HitInfo } from '../game/hit';
import { Music, Sfx } from '../game/sfx';
import { State } from '../game/state';
import { Data } from '../generated/assets';
import { HUD } from '../scenes/hud';
import { World } from '../scenes/world';
import { EnemyComponent } from './enemyComponent';

const NAMES: Record<string, string> = {
    slime: 'King Slime',
    golem: 'Stone Golem',
    serpent: 'Lake Serpent',
    knight: 'Flame Knight',
    lord: 'The Dark Lord',
};

type Rect = { x: number; y: number; width: number; height: number };

// THE MASTER OF EACH DUNGEON. kind PICKS THE BEHAVIOR:
//   slime    HOPS AT YOU, CALLS SMALL SLIMES WHEN HURT
//   golem    CHARGES. ONLY HURT WHILE DAZED FROM HITTING A WALL, OR BY BOMBS
//   serpent  SURFACES IN THE POOL TO SPIT FIRE. ONLY HURT WHILE UP
//   knight   MARCHES AT YOU AND SENDS OUT RINGS OF FIRE. FIRE CAN'T HURT IT
//   lord     TELEPORTS AND FIRES MAGIC, SUMMONS BATS WHEN HURT
export class BossComponent extends Component<ArcadeObject>
{
    @SerializeField kind = 'slime';
    @SerializeField hp = 12;

    maxHp = 12;
    private state = 'idle';
    private timer = 1;
    private count = 0;
    private dir = new Vec2();
    private invulnTime = 0;
    private active = false;
    private dying = false;
    private room!: Rect;

    private get world() { return World.instance; }

    override OnStart()
    {
        const world = this.world;
        const level = world.levelName;
        this.room = world.RoomBounds(this.go.position);
        this.maxHp = this.hp;

        if (State.Flag(`boss:${level}`))
        {
            // BEATEN BEFORE. IF THE SIGIL WASN'T TAKEN, IT'S STILL HERE
            this.go.Remove();
            if (!SaveData.sigils.has(level))
                world.Drop('sigil', this.RoomCenter());
            return;
        }

        if (this.kind == 'serpent')
            this.Submerge(true);
    }

    private RoomCenter(): Vec2
    {
        return new Vec2(this.room.x + this.room.width / 2, this.room.y + this.room.height / 2 + 8);
    }

    private RandomSpot(test: (x: number, y: number) => boolean, awayFrom?: Vec2): Vec2
    {
        for (let i = 0; i < 40; i++)
        {
            const x = this.room.x + 24 + Math.random() * (this.room.width - 48);
            const y = this.room.y + 32 + Math.random() * (this.room.height - 40);
            if (!test(x, y - 8))
                continue;
            if (awayFrom && Math.hypot(awayFrom.x - x, awayFrom.y - y) < 56)
                continue;
            return new Vec2(x, y);
        }
        return this.RoomCenter();
    }

    override OnFixedUpdate(dt: number)
    {
        if (this.dying)
            return;
        const world = this.world;
        const player = world.player;
        this.invulnTime -= dt;

        if (!this.active)
        {
            if (world.InSameRoom(this.go.position, player.position) && player.y < this.room.y + this.room.height - 20)
                this.Activate();
            return;
        }
        if (world.pc.dead)
        {
            this.go.ResetVelocity();
            return;
        }

        this.timer -= dt;
        const toPlayer = Center(player).subtract(Center(this.go));
        switch (this.kind)
        {
            case 'slime': this.KingSlime(toPlayer); break;
            case 'golem': this.Golem(toPlayer); break;
            case 'serpent': this.Serpent(toPlayer); break;
            case 'knight': this.Knight(toPlayer); break;
            case 'lord': this.Lord(toPlayer); break;
        }
    }

    private Activate()
    {
        this.active = true;
        this.timer = 1.2;
        Music('music_boss');
        HUD.instance.ShowBanner(NAMES[this.kind]);
        HUD.instance.bossName = NAMES[this.kind];
        this.UpdateBar();
    }

    private UpdateBar()
    {
        HUD.instance.bossHp = Math.max(0, this.hp);
        HUD.instance.bossMaxHp = this.maxHp;
    }

    // ---- BEHAVIORS ----

    private KingSlime(toPlayer: Vec2)
    {
        if (this.state == 'hop')
        {
            const t = 1 - this.timer / 0.5;
            this.go.innerY = -Math.sin(Math.min(1, t) * Math.PI) * 14;
            if (this.timer <= 0)
            {
                this.state = 'idle';
                this.timer = this.hp <= this.maxHp / 2 ? 0.5 : 0.9;
                this.go.ResetVelocity();
                this.go.innerY = 0;
                bare.camera.StartShake(3, 0.15);
                Sfx('bomb', 0.3);
                this.count++;
                if (this.hp <= this.maxHp / 2 && this.count % 3 == 0)
                    this.SummonMinions('slime', 2);
            }
            return;
        }
        this.go.innerScaleY = 1 - Math.max(0, 0.3 - this.timer) * 0.6;
        if (this.timer <= 0)
        {
            this.go.innerScaleY = 1;
            this.state = 'hop';
            this.timer = 0.5;
            const d = toPlayer.normalized();
            this.go.SetVelocityXY(d.x * 95, d.y * 95);
        }
    }

    private Golem(toPlayer: Vec2)
    {
        switch (this.state)
        {
            case 'idle':
                this.go.ResetVelocity();
                this.go.innerX = Math.sin(this.timer * 40) * (this.timer < 0.4 ? 1 : 0);
                if (this.timer <= 0)
                {
                    this.state = 'charge';
                    this.timer = 1.8;
                    this.dir = toPlayer.normalized();
                    Sfx('clank', 0.3);
                }
                break;
            case 'charge':
                this.go.SetVelocityXY(this.dir.x * 160, this.dir.y * 160);
                if (this.go.blocked != BlockedState.None && this.timer < 1.7)
                {
                    this.state = 'stunned';
                    this.timer = 2.2;
                    this.go.ResetVelocity();
                    bare.camera.StartShake(6, 0.3);
                    Sfx('explode', 0.4);
                    Burst(this.world, 'puff', Center(this.go));
                }
                else if (this.timer <= 0)
                {
                    this.state = 'idle';
                    this.timer = 1;
                }
                break;
            case 'stunned':
                this.go.innerRotation = Math.sin(this.timer * 12) * 6;
                if (this.timer <= 0)
                {
                    this.go.innerRotation = 0;
                    this.state = 'idle';
                    this.timer = this.hp <= this.maxHp / 2 ? 0.7 : 1.1;
                }
                break;
        }
    }

    private Submerge(instant = false)
    {
        this.state = 'under';
        this.timer = instant ? 1.5 : 1.1;
        this.go.collide = false;
        if (instant)
            this.go.alpha = 0;
        else
        {
            Sfx('splash', 0.4);
            Burst(this.world, 'splash', Center(this.go));
            TweenTo(this.go, 0.3, { alpha: 0 });
        }
    }

    private Serpent(toPlayer: Vec2)
    {
        switch (this.state)
        {
            case 'under':
                if (this.timer <= 0)
                {
                    const spot = this.RandomSpot((x, y) => this.world.IsWater(x, y), this.world.player.position);
                    this.go.SetPosition(spot.x, spot.y);
                    this.go.collide = true;
                    this.state = 'up';
                    this.timer = this.hp <= this.maxHp / 2 ? 2 : 2.6;
                    this.count = 0;
                    Sfx('splash', 0.4);
                    Burst(this.world, 'splash', Center(this.go));
                    TweenTo(this.go, 0.3, { alpha: 1 });
                }
                break;
            case 'up':
            {
                const shots = this.hp <= this.maxHp / 2 ? 4 : 3;
                const next = 2.2 - this.count * 0.55;
                if (this.count < shots && this.timer < next)
                {
                    this.count++;
                    this.Shoot(Data.Prefab.ENEMY_FIRE, toPlayer.normalized(), 105);
                }
                if (this.timer <= 0)
                    this.Submerge();
                break;
            }
        }
    }

    private Knight(toPlayer: Vec2)
    {
        const angry = this.hp <= this.maxHp / 2;
        if (this.state == 'idle')
        {
            const d = toPlayer.normalized();
            const speed = angry ? 58 : 38;
            this.go.SetVelocityXY(d.x * speed, d.y * speed);
            this.go.flipped = d.x < 0;
            this.go.innerY = -Math.abs(Math.sin(bare.time / 120)) * 2;
            if (this.timer <= 0)
            {
                this.state = 'cast';
                this.timer = 0.6;
                this.go.ResetVelocity();
                this.go.SetColor('#ffb090');
            }
        }
        else if (this.timer <= 0)
        {
            this.go.SetColor('#ffffff');
            const n = angry ? 12 : 8;
            const offset = Math.random() * Math.PI;
            for (let i = 0; i < n; i++)
            {
                const a = offset + i / n * Math.PI * 2;
                this.Shoot(Data.Prefab.ENEMY_FIRE, new Vec2(Math.cos(a), Math.sin(a)), 85);
            }
            Sfx('fire', 0.5);
            this.state = 'idle';
            this.timer = angry ? 2.2 : 3;
        }
    }

    private Lord(toPlayer: Vec2)
    {
        const angry = this.hp <= this.maxHp / 2;
        switch (this.state)
        {
            case 'idle':
                this.go.innerY = Math.sin(bare.time / 200) * 3 - 4;
                if (this.timer <= 0)
                {
                    this.state = 'vanish';
                    this.timer = 0.4;
                    this.go.collide = false;
                    Burst(this.world, 'magic', Center(this.go));
                    TweenTo(this.go, 0.3, { alpha: 0 });
                }
                break;
            case 'vanish':
                if (this.timer <= 0)
                {
                    const spot = this.RandomSpot((x, y) => this.world.IsWalkable(x, y), this.world.player.position);
                    this.go.SetPosition(spot.x, spot.y);
                    TweenTo(this.go, 0.3, { alpha: 1 });
                    this.state = 'cast';
                    this.timer = 0.6;
                }
                break;
            case 'cast':
                if (this.timer <= 0)
                {
                    this.go.collide = true;
                    const n = angry ? 7 : 5;
                    const base = Math.atan2(toPlayer.y, toPlayer.x);
                    for (let i = 0; i < n; i++)
                    {
                        const a = base + (i - (n - 1) / 2) * 0.28;
                        this.Shoot(Data.Prefab.ENEMY_MAGIC, new Vec2(Math.cos(a), Math.sin(a)), angry ? 120 : 100);
                    }
                    Sfx('fire', 0.5);
                    this.count++;
                    if (angry && this.count % 2 == 0)
                        this.SummonMinions('bat', 2);
                    this.state = 'idle';
                    this.timer = angry ? 1.8 : 2.6;
                }
                break;
        }
    }

    private Shoot(prefab: string, dir: Vec2, speed: number)
    {
        const from = Center(this.go).add(dir.multiply(10));
        const shot = this.world.AddGameObject<ArcadeObject>({ extends: prefab, position: { x: from.x, y: from.y } });
        shot.SetVelocityXY(dir.x * speed, dir.y * speed);
    }

    private SummonMinions(prefab: string, count: number)
    {
        const alive = bare.component.GetAllByType(EnemyComponent).filter(e => this.world.InSameRoom(e.go.position, this.go.position)).length;
        for (let i = 0; i < Math.min(count, 4 - alive); i++)
        {
            const spot = this.RandomSpot((x, y) => this.world.IsWalkable(x, y), this.world.player.position);
            this.world.AddGameObject({ extends: prefab, position: { x: spot.x, y: spot.y } });
            Burst(this.world, 'magic', spot);
        }
    }

    // ---- DAMAGE ----

    override OnCollisionUpdate(other: GameObject)
    {
        if (other === this.world.player && this.active && !this.dying && this.go.alpha > 0.5)
            this.world.pc.Hurt(2, Center(this.go));
    }

    private Vulnerable(hit: HitInfo): boolean
    {
        switch (this.kind)
        {
            case 'golem': return hit.kind == 'bomb' || this.state == 'stunned';
            case 'serpent': return this.state == 'up';
            case 'knight': return hit.kind != 'fire';
            case 'lord': return this.state != 'vanish' && hit.kind != 'fire';
        }
        return true;
    }

    override OnHit(hit: HitInfo)
    {
        if (!this.active || this.dying || hit.kind == 'enemy' || this.invulnTime > 0)
            return;

        if (!this.Vulnerable(hit))
        {
            Sfx('clank', 0.4);
            Burst(this.world, 'sparks', Center(this.go));
            return;
        }

        this.hp -= hit.kind == 'bomb' ? 3 : hit.damage;
        this.invulnTime = 0.5;
        this.go.AddShader(FlashShader);
        bare.camera.StartShake(3, 0.15);
        this.UpdateBar();

        if (this.hp <= 0)
            this.Die();
        else
            Sfx('bossHit', 0.5);
    }

    private async Die()
    {
        this.dying = true;
        const world = this.world;
        const level = world.levelName;
        this.go.ResetVelocity();
        this.go.collide = false;
        State.SetFlag(`boss:${level}`);
        State.Save();

        // CLEAR THE MINIONS
        for (const e of [...bare.component.GetAllByType(EnemyComponent)])
            if (world.InSameRoom(e.go.position, this.go.position))
            {
                Burst(world, 'puff', Center(e.go));
                e.go.Remove();
            }

        Sfx('bossDie', 0.6);
        for (let i = 0; i < 8; i++)
        {
            const c = Center(this.go).add(new Vec2((Math.random() - 0.5) * 28, (Math.random() - 0.5) * 28));
            Burst(world, 'explosion', c);
            bare.camera.StartShake(4, 0.15);
            if (i % 2 == 0) Sfx('explode', 0.35);
            this.go.alpha = i % 2 ? 1 : 0.4;
            if (!await this.scene.Wait(0.18, true))
                return;
        }
        HUD.instance.bossMaxHp = 0;
        // THE PLAYER LEFT DURING THE EXPLOSIONS. THE LOOT WAITS FOR THEM, SEE OnStart
        if (world.levelName != level)
            return;
        const position = this.go.position.clone();
        this.go.Remove();
        Music('music_dungeon');

        // THE HEART CONTAINER FIRST, THEN THE SIGIL APPEARS IN THE MIDDLE OF THE ROOM
        world.Drop('heartContainer', position);
        if (!await this.scene.Wait(0.6, true))
            return;
        if (world.levelName == level)
            world.Drop('sigil', this.RoomCenter());
        Sfx('secret', 0.6);
    }
}
