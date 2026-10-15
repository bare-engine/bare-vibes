import { BareEvent, Component, FlashShader, GameObject, SaveData, SerializeField, Vec2 } from 'bare-engine';
import { ArcadeObject } from 'bare-engine/arcade';
import { Burst } from '../game/fx';
import { CanBeHit, Center, DIRS, Facing, Hit, HitInfo } from '../game/hit';
import { ITEMS } from '../game/items';
import { Sfx } from '../game/sfx';
import { State } from '../game/state';
import { Data } from '../generated/assets';
import { HUD } from '../scenes/hud';
import { World } from '../scenes/world';
import { ChestComponent } from './chestComponent';
import { NpcComponent } from './npcComponent';

const SWING_TIME = 0.22;

export class PlayerComponent extends Component<ArcadeObject>
{
    @SerializeField speed = 78;

    facing: Facing = 'down';

    private sword!: ArcadeObject;
    private swingTime = 0;
    private swordHits = new Set<GameObject>();

    private moveInput = new Vec2();
    private attackQueued = false;
    private itemQueued = false;

    private walkTime = 0;
    private knockTime = 0;
    private invulnTime = 0;
    private itemCooldown = 0;
    private inputBlock = 0;
    private frozen = false;
    private holding = false;
    dead = false;
    swimming = false;

    private heldItem: GameObject | null = null;

    override OnAdded()
    {
        this.sword = this.go.AddChild<ArcadeObject>(Data.Prefab.SWORD);
        this.sword.visible = false;
        this.sword.physicsHitbox.active = false;
        this.sword.events.on(BareEvent.collision_start, (other: GameObject) => this.OnSwordTouch(other));
    }

    // ---- STATE FROM OUTSIDE ----

    Face(facing: Facing)
    {
        this.facing = facing;
        this.UpdateTexture(false);
    }

    Freeze(frozen: boolean)
    {
        this.frozen = frozen;
        if (frozen)
            this.go.ResetVelocity();
    }

    BlockInput(seconds: number)
    {
        this.inputBlock = Math.max(this.inputBlock, seconds);
        this.attackQueued = false;
        this.itemQueued = false;
    }

    get knockedBack(): boolean
    {
        return this.knockTime > 0;
    }

    // WHETHER THE PLAYER IS FREE TO WALK, OPEN THE BAG, AND SO ON
    CanAct(): boolean
    {
        return !this.frozen && !this.dead && !this.holding && this.inputBlock <= 0;
    }

    Revive()
    {
        this.dead = false;
        this.go.alpha = 1;
        this.go.rotation = 0;
        this.invulnTime = 1.5;
        this.knockTime = 0;
        this.Freeze(false);
    }

    // HOLD AN ITEM OVER YOUR HEAD WHILE ITS TEXT SHOWS, LIKE YOU DO
    async HoldUp(item: string, text: string)
    {
        this.holding = true;
        this.go.ResetVelocity();
        this.EndSwing();
        this.go.InitTexture('hero_hold');
        this.go.flipped = false;
        const sprite = ITEMS[item]?.sprite ?? item;
        this.heldItem = this.go.AddChild('/' + sprite);
        this.heldItem.SetPivot(0.5, 1).SetPosition(8, -1);
        Sfx(item == 'heartContainer' || item == 'rupees' || item == 'key' ? 'item' : 'fanfare', 0.5);
        await HUD.instance.Say('', text, sprite);
        this.heldItem?.Remove();
        this.heldItem = null;
        this.holding = false;
        this.UpdateTexture(false);
    }

    // ---- INPUT, READ EVERY FRAME ----

    override OnUpdate(deltaTime: number)
    {
        this.inputBlock -= deltaTime;

        const kb = bare.keyboard;
        this.moveInput.set(
            (kb.IsRightDown() ? 1 : 0) - (kb.IsLeftDown() ? 1 : 0),
            (kb.IsDownDown() ? 1 : 0) - (kb.IsUpDown() ? 1 : 0),
        );

        if (!this.CanAct())
            return;

        if (kb.IsKeyPressed('space') || kb.IsCodePressed('KeyJ'))
            this.attackQueued = true;
        if (kb.IsCodePressed('KeyK') || kb.IsCodePressed('KeyX'))
            this.itemQueued = true;
        if (kb.IsCodePressed('KeyQ'))
        {
            State.CycleEquipped(-1);
            Sfx('menu', 0.3);
        }
        if (kb.IsCodePressed('KeyE'))
        {
            State.CycleEquipped(1);
            Sfx('menu', 0.3);
        }
    }

    // ---- MOVEMENT AND ACTIONS, AT A FIXED RATE ----

    override OnFixedUpdate(dt: number)
    {
        const world = World.instance;
        this.invulnTime -= dt;
        this.itemCooldown -= dt;

        // BLINK WHILE INVULNERABLE
        this.go.alpha = this.invulnTime > 0 && !this.dead ? (Math.floor(this.invulnTime * 20) % 2 ? 0.35 : 1) : 1;

        if (this.dead || this.holding)
            return;

        if (this.frozen)
        {
            this.go.ResetVelocity();
            return;
        }

        const feet = new Vec2(this.go.x, this.go.y - 3);
        this.swimming = world.IsWater(feet.x, feet.y) && State.Has('flippers');

        if (this.knockTime > 0)
        {
            this.knockTime -= dt;
            this.go.velocity.x *= 0.82;
            this.go.velocity.y *= 0.82;
            return;
        }

        if (this.swingTime > 0)
        {
            this.swingTime -= dt;
            this.UpdateSwing();
            this.go.ResetVelocity();
            if (this.swingTime <= 0)
                this.EndSwing();
            return;
        }

        if (this.attackQueued)
        {
            this.attackQueued = false;
            if (!this.TryInteract() && !this.swimming && State.Has('sword'))
            {
                this.StartSwing();
                return;
            }
        }

        if (this.itemQueued)
        {
            this.itemQueued = false;
            if (!this.swimming)
                this.UseItem();
        }

        // WALK
        const move = this.moveInput.clone();
        if (move.x != 0 || move.y != 0)
        {
            // KEEP FACING THE SAME WAY WHILE MOVING DIAGONALLY, IF THAT'S ONE OF THE TWO DIRECTIONS
            const facingStill = (this.facing == 'left' && move.x < 0) || (this.facing == 'right' && move.x > 0)
                || (this.facing == 'up' && move.y < 0) || (this.facing == 'down' && move.y > 0);
            if (!facingStill)
                this.facing = move.x != 0 ? (move.x < 0 ? 'left' : 'right') : (move.y < 0 ? 'up' : 'down');

            const speed = this.speed * (this.swimming ? 0.65 : 1);
            const len = move.length();
            this.go.SetVelocityXY(move.x / len * speed, move.y / len * speed);
            this.walkTime += dt;
        }
        else
        {
            this.go.ResetVelocity();
            this.walkTime = 0;
        }

        this.UpdateTexture(move.x != 0 || move.y != 0);
    }

    private UpdateTexture(moving: boolean)
    {
        if (this.holding || this.dead)
            return;
        if (this.swimming)
        {
            this.go.InitTexture('hero_swim');
            this.go.flipped = this.facing == 'left';
            return;
        }
        const frame = moving && Math.floor(this.walkTime * 7) % 2 ? 2 : 1;
        const side = this.facing == 'left' || this.facing == 'right';
        this.go.InitTexture(`hero_${side ? 'side' : this.facing}${frame}`);
        this.go.flipped = this.facing == 'left';
    }

    // ---- SWORD ----

    private StartSwing()
    {
        this.swingTime = SWING_TIME;
        this.swordHits.clear();
        this.sword.visible = true;
        this.sword.physicsHitbox.active = true;
        this.go.ResetVelocity();
        this.UpdateTexture(false);
        Sfx('sword', 0.35);
        this.UpdateSwing();
    }

    private EndSwing()
    {
        this.swingTime = 0;
        if (!this.sword)
            return;
        this.sword.visible = false;
        this.sword.physicsHitbox.active = false;
    }

    // THE SWORD SWEEPS A QUARTER CIRCLE IN FRONT OF THE PLAYER
    private UpdateSwing()
    {
        const t = 1 - Math.max(0, this.swingTime) / SWING_TIME;
        // THE PLAYER IS FLIPPED WHEN FACING LEFT AND ITS CHILDREN FOLLOW, SO LEFT SWINGS LIKE RIGHT
        const facing = this.facing == 'left' ? 'right' : this.facing;
        const base = { up: 0, right: 90, down: 180 }[facing];
        this.sword.rotation = base - 70 + 140 * Math.min(1, t * 1.6);
        // THE HILT IN THE PLAYER'S HAND, IN THE PLAYER'S TEXTURE SPACE
        const hand = { up: new Vec2(10, 7), down: new Vec2(6, 11), right: new Vec2(10, 10) }[facing];
        this.sword.SetPosition(hand.x, hand.y);
    }

    private OnSwordTouch(other: GameObject)
    {
        if (this.swingTime <= 0 || this.swordHits.has(other) || other === this.go)
            return;
        if (!CanBeHit(other))
            return;
        this.swordHits.add(other);
        Hit(other, { kind: 'sword', damage: 1, from: Center(this.go) });
    }

    // ---- TALKING AND OPENING CHESTS ----

    private TryInteract(): boolean
    {
        const probe = Center(this.go).add(DIRS[this.facing].multiply(12));
        const near = (obj: GameObject) => Math.abs(Center(obj).x - probe.x) < 13 && Math.abs(Center(obj).y - probe.y) < 13;

        for (const npc of bare.component.GetAllByType(NpcComponent))
            if (npc.go.visible && near(npc.go))
            {
                npc.Talk();
                return true;
            }
        for (const chest of bare.component.GetAllByType(ChestComponent))
            if (!chest.opened && near(chest.go))
            {
                chest.Open();
                return true;
            }
        return false;
    }

    // ---- ITEMS ----

    private UseItem()
    {
        if (this.itemCooldown > 0)
            return;
        const world = World.instance;
        const center = Center(this.go);
        const dir = DIRS[this.facing];

        switch (SaveData.equipped)
        {
            case 'bow':
                if (SaveData.arrows <= 0) { Sfx('error', 0.3); return; }
                SaveData.arrows--;
                this.Shoot(Data.Prefab.ARROW, 230, center.add(dir.multiply(6)), dir);
                Sfx('arrow', 0.4);
                this.itemCooldown = 0.35;
                break;
            case 'fireRod':
                this.Shoot(Data.Prefab.FIREBALL, 150, center.add(dir.multiply(8)), dir);
                Sfx('fire', 0.4);
                this.itemCooldown = 0.5;
                break;
            case 'bombs':
            {
                const placed = bare.object.GetLayerByName('objects').filter(o => o.name == Data.Prefab.BOMB_LIT).length;
                if (SaveData.bombs <= 0 || placed >= 2) { Sfx('error', 0.3); return; }
                SaveData.bombs--;
                const spot = new Vec2(this.go.x, this.go.y).add(dir.multiply(12));
                world.AddGameObject({ extends: Data.Prefab.BOMB_LIT, position: { x: spot.x, y: spot.y } });
                Sfx('bomb', 0.4);
                this.itemCooldown = 0.3;
                break;
            }
            case 'potion':
                if (SaveData.potions <= 0 || SaveData.hp >= SaveData.maxHp) { Sfx('error', 0.3); return; }
                SaveData.potions--;
                SaveData.hp = SaveData.maxHp;
                Burst(world, 'magic', center);
                Sfx('heart', 0.5);
                this.itemCooldown = 0.5;
                break;
        }
        this.go.ResetVelocity();
    }

    // THE PREFAB'S projectile COMPONENT SAYS WHO IT HURTS
    private Shoot(prefab: string, speed: number, from: Vec2, dir: Vec2)
    {
        const shot = World.instance.AddGameObject<ArcadeObject>({ extends: prefab, position: { x: from.x, y: from.y } });
        shot.SetVelocityXY(dir.x * speed, dir.y * speed);
        shot.rotation = { up: -90, down: 90, left: 180, right: 0 }[this.facing];
    }

    // ---- GETTING HURT ----

    override OnHit(hit: HitInfo)
    {
        if (hit.kind != 'enemy' && hit.kind != 'bomb')
            return;
        this.Hurt(hit.damage, hit.from);
    }

    Hurt(damage: number, from: Vec2)
    {
        if (this.invulnTime > 0 || this.dead || this.frozen || this.holding)
            return;

        SaveData.hp = Math.max(0, SaveData.hp - damage);
        this.invulnTime = 1.1;
        this.EndSwing();
        this.go.AddShader(FlashShader);
        bare.camera.StartShake(3, 0.2);

        const away = Center(this.go).subtract(from);
        const dir = away.isZero() ? DIRS[this.facing].multiply(-1) : away.normalized();
        this.go.SetVelocityXY(dir.x * 190, dir.y * 190);
        this.knockTime = 0.18;

        if (SaveData.hp <= 0)
            this.Die();
        else
            Sfx('hurt', 0.5);
    }

    private async Die()
    {
        this.dead = true;
        this.go.ResetVelocity();
        Sfx('die', 0.6);
        // SPIN AROUND AND FALL OVER
        for (let i = 0; i < 12; i++)
        {
            this.facing = (['down', 'left', 'up', 'right'] as Facing[])[i % 4];
            this.go.InitTexture(`hero_${this.facing == 'left' || this.facing == 'right' ? 'side' : this.facing}1`);
            this.go.flipped = this.facing == 'left';
            if (!await this.scene.Wait(0.08, true))
                return;
        }
        Burst(World.instance, 'puff', Center(this.go));
        HUD.instance.ShowGameOver();
    }
}
