import { Component, Easing, InspectorField, SaveData, TweenTo } from "bare-engine";
import { ArcadeObject } from "bare-engine/arcade";
import { EnemyComponent } from "./enemyComponent";

declare module "bare-engine"
{
    interface BareUserEvents
    {
        bossStarted: { boss: BossComponent };
        bossDefeated: void;
    }
}

// THE CYCLOPS KING: STOMPS TOWARDS YOU, LEAPS AT YOU, AND CALLS BATS ONCE HURT
export class BossComponent extends Component<ArcadeObject>
{
    @InspectorField state = "sleeping";

    enemy!: EnemyComponent;
    maxHealth = 0;
    private timer = 2;
    private wasGrounded = true;
    private leaping = false;

    override OnStart(): void
    {
        this.enemy = this.go.GetComponent(EnemyComponent)!;
        this.maxHealth = this.enemy.health;

        if (SaveData.bossDefeated)
        {
            this.SpawnExit();
            this.go.Remove();
            return;
        }

        bare.events.on("enemyDied", ({ enemy }) => {
            if (enemy == this.go)
                this.Defeated();
        });
    }

    override OnFixedUpdate(dt: number): void
    {
        if (this.enemy.dead)
            return;

        var player = bare.object.GetByName<ArcadeObject>("player");
        if (!player)
            return;

        var dx = player.x - this.go.x;
        var grounded = this.go.IsGrounded();

        if (this.state == "sleeping")
        {
            if (Math.abs(dx) < 200)
            {
                this.state = "fight";
                bare.camera.StartShake(6, 0.6);
                bare.events.emit("bossStarted", { boss: this });
            }
            return;
        }

        var angry = this.enemy.health < this.maxHealth / 2;
        this.go.flipped = dx < 0;

        if (grounded && this.leaping)
        {
            // LANDED FROM A LEAP
            this.leaping = false;
            bare.camera.StartShake(5, 0.3);
            this.go.innerScaleY = 0.7;
            TweenTo(this.go, 0.3, { innerScaleY: 1, ease: Easing.Back.Out });
            if (angry)
                this.CallBats();
        }
        this.wasGrounded = grounded;

        if (!grounded)
            return;

        this.timer -= dt;
        if (this.timer <= 0)
        {
            // LEAP AT THE PLAYER
            this.timer = angry ? 1.6 : 2.4;
            this.leaping = true;
            this.go.velocity.y = -380;
            this.go.velocity.x = Math.max(-170, Math.min(170, dx * 1.1));
        }
        else
        {
            this.go.velocity.x = Math.sign(dx) * (angry ? 45 : 30);
            this.go.innerRotation = Math.sin(bare.time * 0.012) * 5;
        }
    }

    CallBats()
    {
        var bats = bare.object.GetAll().filter(o => o.name == "bat").length;
        if (bats >= 3)
            return;
        for (var side of [-1, 1])
            this.scene.AddGameObject({ extends: "bat", position: { x: this.go.x + side * 60, y: this.go.y - 90 } });
    }

    Defeated()
    {
        SaveData.bossDefeated = true;
        bare.storage.Save();
        bare.camera.StartShake(10, 1);
        for (var bat of bare.object.GetAll().filter(o => o.name == "bat"))
            bat.GetComponent(EnemyComponent)?.Die();
        bare.events.emit("bossDefeated");
        this.SpawnExit();
    }

    SpawnExit()
    {
        var level = bare.level.currentLevel!;
        var door = this.scene.AddGameObject("exitDoor");
        door.SetPosition(level.dimensions.width / 2, level.dimensions.height - 16);
        door.alpha = 0;
        TweenTo(door, 1, { alpha: 1 });
    }
}
