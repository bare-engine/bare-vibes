import { Component, Easing, FlashShader, GameObject, Inspector, InspectorField, ParticleComponent, SaveData, SerializeField, TweenTo, Vec2 } from "bare-engine";
import { ArcadeObject } from "bare-engine/arcade";
import { HasAbility, HitboxRect, Rect, RectsOverlap, RoomGeometry } from "../world";
import { EnemyComponent } from "./enemyComponent";
import { CrackedComponent } from "./crackedComponent";

declare module "bare-engine"
{
    interface BareUserEvents
    {
        playerDied: void;
        playerHealthChanged: void;
        exitReached: void;
    }
}

// INPUT HELPERS: ARROWS/WASD TO MOVE, Z/SPACE/UP TO JUMP, X/J TO ATTACK, SHIFT/C/K TO DASH
export const Controls = {
    JumpPressed: () => bare.keyboard.IsKeyPressed("z") || bare.keyboard.IsKeyPressed("space") || bare.keyboard.IsUpPressed(),
    JumpDown: () => bare.keyboard.IsKeyDown("z") || bare.keyboard.IsKeyDown("space") || bare.keyboard.IsUpDown(),
    AttackPressed: () => bare.keyboard.IsKeyPressed("x") || bare.keyboard.IsKeyPressed("j"),
    DashPressed: () => bare.keyboard.IsKeyPressed("shift") || bare.keyboard.IsKeyPressed("c") || bare.keyboard.IsKeyPressed("k"),
};

export class PlayerComponent extends Component<ArcadeObject>
{
    @SerializeField @Inspector.Limit(0, 400) moveSpeed = 100;
    @SerializeField jumpSpeed = 330;
    @SerializeField maxFallSpeed = 420;
    @SerializeField dashSpeed = 300;
    @SerializeField dashTime = 0.18;
    @SerializeField wallSlideSpeed = 55;
    @SerializeField wallJumpSpeedX = 90;

    @InspectorField health = 5;

    facing = 1;
    controlsLocked = false;

    private coyoteTimer = 0;
    private jumpBuffer = 0;
    private airJumpsLeft = 0;
    private dashTimer = 0;
    private dashCooldown = 0;
    private canAirDash = true;
    private wallLockTimer = 0;
    private wallSliding = 0;
    private lastWallDir = 0;
    private wallCoyote = 0;
    private attackCooldown = 0;
    private invulnerable = 0;
    private dropThroughTimer = 0;
    private wasGrounded = true;
    private walkTime = 0;
    private attackQueued = false;
    private dashQueued = false;
    private lastSafe = new Vec2();

    slash!: GameObject;

    override OnAdded(): void
    {
        this.slash = this.go.AddChild("tile_0104");
        this.slash.SetPivot(0.5, 1);
        this.slash.visible = false;
        this.slash.save = false;
        this.ResetHealth();
    }

    ResetHealth()
    {
        this.health = SaveData.maxHealth;
        bare.events.emit("playerHealthChanged");
    }

    get dropThrough(): boolean
    {
        return this.dropThroughTimer > 0;
    }

    get isDashing(): boolean
    {
        return this.dashTimer > 0;
    }

    override OnUpdate(deltaTime: number): void
    {
        if (this.controlsLocked)
            return;

        // PRESSES ARE PER FRAME, SO THEY ARE READ HERE AND USED IN OnFixedUpdate
        if (Controls.JumpPressed())
            this.jumpBuffer = 0.12;
        if (Controls.AttackPressed())
            this.attackQueued = true;
        if (Controls.DashPressed() && HasAbility("dash"))
            this.dashQueued = true;

        // BLINK WHILE INVULNERABLE
        this.go.alpha = (this.invulnerable > 0 && Math.floor(this.invulnerable * 20) % 2 == 0) ? 0.35 : 1;
    }

    override OnFixedUpdate(dt: number): void
    {
        var go = this.go;
        var v = go.velocity;
        var grounded = go.IsGrounded();
        var gravity = this.scene.settingsData.gravity!;

        this.invulnerable -= dt;
        this.attackCooldown -= dt;
        this.dashCooldown -= dt;
        this.wallLockTimer -= dt;
        this.dropThroughTimer -= dt;
        this.jumpBuffer -= dt;

        if (this.controlsLocked)
        {
            v.x *= 0.8;
            return;
        }

        if (grounded)
        {
            this.coyoteTimer = 0.09;
            this.airJumpsLeft = HasAbility("double") ? 1 : 0;
            this.canAirDash = true;
            this.RememberSafeSpot();
        }
        else
        {
            this.coyoteTimer -= dt;
        }

        // LANDING SQUASH
        if (grounded && !this.wasGrounded)
        {
            this.go.innerScaleY = 0.75;
            this.go.innerScaleX = 1.2;
            TweenTo(this.go, 0.15, { innerScaleY: 1, innerScaleX: 1, ease: Easing.Back.Out });
        }
        this.wasGrounded = grounded;

        // DASH: STRAIGHT LINE, NO GRAVITY
        if (this.dashQueued)
        {
            this.dashQueued = false;
            if (this.dashCooldown <= 0 && (grounded || this.canAirDash))
            {
                this.dashTimer = this.dashTime;
                this.dashCooldown = this.dashTime + 0.25;
                if (!grounded) this.canAirDash = false;
                this.go.innerScaleX = 1.4;
                TweenTo(this.go, this.dashTime, { innerScaleX: 1 });
            }
        }
        if (this.dashTimer > 0)
        {
            this.dashTimer -= dt;
            v.x = this.facing * this.dashSpeed;
            v.y = -gravity * dt; // CANCELS THE GRAVITY THE PHYSICS ADDS NEXT STEP
            this.HandleAttack();
            return;
        }

        // RUN
        var input = 0;
        if (bare.keyboard.IsLeftDown()) input -= 1;
        if (bare.keyboard.IsRightDown()) input += 1;

        if (this.wallLockTimer <= 0)
        {
            v.x = input * this.moveSpeed;
            if (input != 0)
                this.facing = input;
        }

        // WALL SLIDE AND WALL JUMP
        var wallDir = HasAbility("wall") && !grounded ? this.WallDirection() : 0;
        // A SHORT GRACE TIME AFTER LEAVING A WALL, SO A SLIGHTLY LATE PRESS STILL WALL JUMPS
        this.wallCoyote -= dt;
        if (wallDir != 0) { this.lastWallDir = wallDir; this.wallCoyote = 0.1; }
        else if (this.wallCoyote > 0 && !grounded) wallDir = this.lastWallDir;
        this.wallSliding = (wallDir != 0 && input == wallDir && v.y > 0) ? wallDir : 0;
        if (this.wallSliding)
            v.y = Math.min(v.y, this.wallSlideSpeed);

        // JUMP
        if (this.jumpBuffer > 0)
        {
            var down = bare.keyboard.IsDownDown();
            if (grounded && down && this.IsOnPlank())
            {
                // DROP THROUGH A PLANK
                this.dropThroughTimer = 0.25;
                this.jumpBuffer = 0;
            }
            else if (grounded || this.coyoteTimer > 0)
            {
                this.Jump(this.jumpSpeed);
            }
            else if (wallDir != 0)
            {
                v.x = -wallDir * this.wallJumpSpeedX;
                this.wallCoyote = 0;
                this.facing = -wallDir;
                this.wallLockTimer = 0.1;
                this.Jump(this.jumpSpeed);
            }
            else if (this.airJumpsLeft > 0)
            {
                this.airJumpsLeft--;
                this.Jump(this.jumpSpeed * 0.92);
                this.go.innerRotation = 0;
                TweenTo(this.go, 0.3, { innerRotation: 360 * this.facing }).promise.then(() => this.go.innerRotation = 0);
            }
        }

        // SHORT HOP WHEN JUMP IS RELEASED EARLY
        if (!Controls.JumpDown() && v.y < -120)
            v.y *= 0.6;

        v.y = Math.min(v.y, this.maxFallSpeed);

        this.go.flipped = this.facing < 0;

        // WALK WOBBLE
        if (grounded && input != 0)
        {
            this.walkTime += dt;
            this.go.innerRotation = Math.sin(this.walkTime * 18) * 8;
        }
        else if (this.go.innerRotation != 0 && bare.tween.GetAllFrom(this.go).length == 0)
        {
            this.go.innerRotation = 0;
        }

        this.HandleAttack();
    }

    Jump(speed: number)
    {
        this.go.velocity.y = -speed;
        this.jumpBuffer = 0;
        this.coyoteTimer = 0;
        this.go.innerScaleY = 1.3;
        this.go.innerScaleX = 0.8;
        TweenTo(this.go, 0.2, { innerScaleY: 1, innerScaleX: 1 });
    }

    // -1 / 1 WHEN A WALL TOUCHES THE PLAYER'S LEFT / RIGHT SIDE, 0 OTHERWISE
    WallDirection(): number
    {
        var r = HitboxRect(this.go);
        var top = r.y + 3, bottom = r.y + r.h - 3;
        if (RoomGeometry.IsSolidAt(r.x - 3, top) || RoomGeometry.IsSolidAt(r.x - 3, bottom))
            return -1;
        if (RoomGeometry.IsSolidAt(r.x + r.w + 3, top) || RoomGeometry.IsSolidAt(r.x + r.w + 3, bottom))
            return 1;
        return 0;
    }

    IsOnPlank(): boolean
    {
        var r = HitboxRect(this.go);
        var feet = r.y + r.h + 2;
        var onPlank = RoomGeometry.oneways.some(p => RectsOverlap({ x: r.x, y: feet - 1, w: r.w, h: 2 }, HitboxRect(p)));
        var onSolid = RoomGeometry.IsSolidAt(r.x + 1, feet) || RoomGeometry.IsSolidAt(r.x + r.w - 1, feet);
        return onPlank && !onSolid;
    }

    RememberSafeSpot()
    {
        var r = HitboxRect(this.go);
        var around: Rect = { x: r.x - 14, y: r.y, w: r.w + 28, h: r.h + 4 };
        var nearHazard = bare.object.GetAll().some(o => o.tags.includes("hazard") && RectsOverlap(around, HitboxRect(o as ArcadeObject)));
        if (!nearHazard)
            this.lastSafe.set(this.go.x, this.go.y);
    }

    // ATTACK: A SWING IN FRONT, OR BELOW/ABOVE WITH DOWN/UP HELD
    HandleAttack()
    {
        if (!this.attackQueued)
            return;
        this.attackQueued = false;

        if (this.attackCooldown > 0)
            return;
        this.attackCooldown = 0.3;

        var hammer = HasAbility("hammer");
        var x = this.go.x, y = this.go.y;
        var area: Rect;
        var dir: "side" | "down" | "up" = "side";

        if (bare.keyboard.IsDownDown())
        {
            dir = "down";
            area = { x: x - 9, y: y - 4, w: 18, h: 18 };
        }
        else if (bare.keyboard.IsUpDown())
        {
            dir = "up";
            area = { x: x - 9, y: y - 32, w: 18, h: 20 };
        }
        else
        {
            area = { x: this.facing > 0 ? x + 2 : x - 22, y: y - 16, w: 20, h: 16 };
        }

        this.ShowSlash(dir, hammer);
        bare.sound.PlayWithRandomRate("coin", 0.3, { volume: 0.04, rate: 0.5 });

        var hitSomething = false;
        for (var enemy of bare.component.GetAllByType(EnemyComponent))
        {
            if (enemy.dead)
                continue;
            if (RectsOverlap(area, HitboxRect(enemy.go)))
            {
                enemy.Hit(hammer ? 2 : 1, x);
                hitSomething = true;
            }
        }

        if (hammer)
        {
            for (var cracked of bare.component.GetAllByType(CrackedComponent))
            {
                if (RectsOverlap(area, HitboxRect(cracked.go)))
                {
                    cracked.Break();
                    hitSomething = true;
                }
            }
        }

        // POGO OFF THINGS WHEN SWINGING DOWN IN THE AIR
        if (hitSomething && dir == "down" && !this.go.IsGrounded())
        {
            this.go.velocity.y = -this.jumpSpeed * 0.85;
            this.airJumpsLeft = HasAbility("double") ? 1 : 0;
            this.canAirDash = true;
        }
    }

    ShowSlash(dir: "side" | "down" | "up", hammer: boolean)
    {
        var s = this.slash;
        s.SetTexture(bare.asset.GetTexture(hammer ? "tile_0117" : "tile_0104")!);
        s.visible = true;
        s.flipped = false;
        bare.tween.RemoveAllFrom(s);

        var from: number, to: number;
        if (dir == "side")
        {
            s.SetPosition(8 + this.facing * 5, 14);
            from = this.facing * -30; to = this.facing * 110;
        }
        else if (dir == "down")
        {
            s.SetPosition(8, 10);
            from = 120; to = 220;
        }
        else
        {
            s.SetPosition(8, 4);
            from = -50; to = 50;
        }

        // THE PLAYER IS FLIPPED WHEN FACING LEFT, AND CHILDREN FLIP WITH IT
        if (this.go.flipped) { from = -from; to = -to; }

        s.rotation = from;
        s.AddShader(FlashShader);
        TweenTo(s, 0.12, { rotation: to, onComplete: () => s.visible = false });
    }

    TakeDamage(amount: number, fromX: number)
    {
        if (this.invulnerable > 0 || this.health <= 0 || this.controlsLocked)
            return;

        this.health = Math.max(0, this.health - amount);
        this.invulnerable = 1.1;
        this.dashTimer = 0;
        bare.events.emit("playerHealthChanged");

        this.go.AddShader(FlashShader);
        bare.camera.StartShake(4, 0.25);
        bare.sound.Play("lose", { volume: 0.12, rate: 1.8 });

        var away = this.go.x < fromX ? -1 : 1;
        this.go.velocity.x = away * 150;
        this.go.velocity.y = -200;
        this.wallLockTimer = 0.2;

        if (this.health <= 0)
            this.Die();
    }

    async HitHazard()
    {
        if (this.invulnerable > 0 || this.controlsLocked)
            return;

        this.TakeDamage(1, this.go.x);
        if (this.health <= 0)
            return;

        // BACK TO THE LAST SAFE SPOT
        this.controlsLocked = true;
        if (!await this.scene.Wait(0.3, true))
        {
            this.controlsLocked = false;
            return;
        }
        this.go.SetPosition(this.lastSafe.x, this.lastSafe.y);
        this.go.ResetVelocity();
        this.controlsLocked = false;
    }

    Die()
    {
        this.controlsLocked = true;
        this.go.ResetVelocity();
        this.go.GetComponent(ParticleComponent)?.Fire();
        TweenTo(this.go, 0.6, { innerRotation: 90 * this.facing, alpha: 0 });
        bare.events.emit("playerDied");
    }

    Revive()
    {
        bare.tween.RemoveAllFrom(this.go);
        this.go.innerRotation = 0;
        this.go.innerScaleX = this.go.innerScaleY = 1;
        this.go.alpha = 1;
        this.invulnerable = 0;
        this.dashTimer = 0;
        this.controlsLocked = false;
        this.ResetHealth();
    }

    Heal(amount: number)
    {
        this.health = Math.min(SaveData.maxHealth, this.health + amount);
        bare.events.emit("playerHealthChanged");
    }

    override OnCollisionUpdate(other: GameObject): void
    {
        if (other.tags.includes("hazard"))
            this.HitHazard();
        else if (other.tags.includes("enemy"))
        {
            var enemy = other.GetComponent(EnemyComponent);
            if (enemy && !enemy.dead)
                this.TakeDamage(enemy.damage, other.x);
        }
        else if (other.tags.includes("exit"))
            bare.events.emit("exitReached");
    }
}
