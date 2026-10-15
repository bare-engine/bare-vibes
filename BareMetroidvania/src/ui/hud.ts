import { Color, GameObject, SaveData, Scene, TextObject, TweenTo, Vec2 } from "bare-engine";
import { PlayerComponent } from "../components/playerComponent";
import { BossComponent } from "../components/bossComponent";
import { AREAS, CELL_H, CELL_W, ITEM_INFO, ITEM_TOTAL, ItemKind, RoomInfo } from "../world";
import { MapRenderer } from "./mapRenderer";

const ABILITY_ORDER: ItemKind[] = ["dash", "double", "wall", "hammer"];

// HEARTS, ABILITIES, MINIMAP, ROOM NAMES, MESSAGES AND THE BOSS BAR
export class Hud extends Scene
{
    hearts: GameObject[] = [];
    abilityIcons: GameObject[] = [];
    roomText!: TextObject;
    messageTitle!: TextObject;
    messageHint!: TextObject;
    itemsText!: TextObject;

    player: PlayerComponent | null = null;
    room: RoomInfo | undefined;
    playerWorld = new Vec2();
    boss: BossComponent | null = null;
    private messageVersion = 0;

    constructor()
    {
        super({ UI: true, persistent: true });
    }

    override OnStart(): void
    {
        var text = (size: number, color: string) => {
            var t = new TextObject(this, { text: "", fontSize: size, fill: color, stroke: "#10121c", strokeThickness: 3 });
            this.AddGameObject(t);
            return t;
        };

        this.roomText = text(16, "#e8ecf8");
        this.roomText.SetPivot(0, 1).SetPosition(6, bare.height - 4);
        this.roomText.alpha = 0;

        this.messageTitle = text(16, "#ffd84a");
        this.messageTitle.SetPivot(0.5, 0).SetPosition(bare.width / 2, 34);
        this.messageTitle.alpha = 0;

        this.messageHint = text(16, "#e8ecf8");
        this.messageHint.SetPivot(0.5, 0).SetPosition(bare.width / 2, 50);
        this.messageHint.alpha = 0;

        this.itemsText = text(16, "#ffd84a");
        this.itemsText.SetPivot(1, 0).SetPosition(bare.width - 4, 41);
        this.RefreshItems();

        bare.events.persistent.on("playerHealthChanged", () => this.RefreshHearts());
        bare.events.persistent.on("itemCollected", ({ kind }) => {
            this.RefreshAbilities();
            this.RefreshHearts();
            this.RefreshItems();
            var info = ITEM_INFO[kind as ItemKind];
            this.ShowMessage(info.name.toUpperCase(), info.hint, 4);
        });
        bare.events.persistent.on("shrineUsed", () => this.ShowMessage("SHRINE", "Health restored, game saved", 2));
        bare.events.persistent.on("bossStarted", ({ boss }) => {
            this.boss = boss;
            this.ShowMessage("THE CYCLOPS KING", "", 2.5);
        });
        bare.events.persistent.on("bossDefeated", () => {
            this.boss = null;
            this.ShowMessage("THE KING HAS FALLEN", "A door has opened", 4);
        });
    }

    SetPlayer(player: PlayerComponent)
    {
        this.player = player;
        this.RefreshHearts();
        this.RefreshAbilities();
    }

    // CALLED BY THE GAME AFTER EVERY ROOM CHANGE
    OnRoomEntered(room: RoomInfo, newArea: boolean)
    {
        this.room = room;
        this.boss = null;
        this.roomText.SetText(newArea ? `${AREAS[room.area].name} - ${room.name}` : room.name);
        bare.tween.RemoveAllFrom(this.roomText);
        this.roomText.alpha = 1;
        TweenTo(this.roomText, 0.6, { delay: 2, alpha: 0 });
    }

    async ShowMessage(title: string, hint: string, seconds: number)
    {
        var version = ++this.messageVersion;
        this.messageTitle.SetText(title);
        this.messageHint.SetText(hint);
        for (var t of [this.messageTitle, this.messageHint])
        {
            bare.tween.RemoveAllFrom(t);
            t.alpha = 0;
            TweenTo(t, 0.25, { alpha: 1 });
        }
        if (!await this.Wait(seconds, true))
            return;
        if (version != this.messageVersion)
            return;
        for (var t of [this.messageTitle, this.messageHint])
            TweenTo(t, 0.5, { alpha: 0 });
    }

    RefreshHearts()
    {
        if (!this.player)
            return;

        while (this.hearts.length < SaveData.maxHealth)
            this.hearts.push(this.AddGameObject("heart").SetScale(1));

        this.hearts.forEach((heart, i) => {
            heart.visible = i < SaveData.maxHealth;
            heart.SetTexture(bare.asset.GetTexture(i < this.player!.health ? "heart" : "heartEmpty")!);
            heart.SetPosition(5 + i * 11, 5);
        });
    }

    RefreshAbilities()
    {
        for (var icon of this.abilityIcons)
            icon.Remove();
        this.abilityIcons = [];

        var x = 4;
        for (var kind of ABILITY_ORDER)
        {
            if (!SaveData.abilities.has(kind))
                continue;
            this.abilityIcons.push(this.AddGameObject(ITEM_INFO[kind].texture).SetPosition(x, 16));
            x += 15;
        }
    }

    RefreshItems()
    {
        this.itemsText.SetText(`${SaveData.items.size}/${ITEM_TOTAL}`);
    }

    override OnUpdate(deltaTime: number): void
    {
        var player = this.player?.go;
        if (player && this.room)
            this.playerWorld.set(this.room.x * CELL_W + player.x, this.room.y * CELL_H + player.y - 8);
    }

    override OnRender(): void
    {
        // MINIMAP, TOP RIGHT
        var view = { x: bare.width - 64, y: 4, width: 60, height: 36, cellW: 9, cellH: 6, centerX: 0, centerY: 0 };
        bare.drawRect({ position: new Vec2(view.x - 1, view.y - 1), width: view.width + 2, height: view.height + 2, color: new Color(16, 18, 28, 200) });
        if (this.room)
        {
            view.centerX = this.playerWorld.x / CELL_W;
            view.centerY = this.playerWorld.y / CELL_H;
            MapRenderer.Draw(view, this.room, this.playerWorld, Math.floor(bare.time / 300) % 2 == 0);
        }

        // BOSS HEALTH
        if (this.boss && !this.boss.enemy.dead)
        {
            var w = 160, x = (bare.width - w) / 2, y = bare.height - 12;
            bare.drawRect({ position: new Vec2(x - 1, y - 1), width: w + 2, height: 6, color: new Color(16, 18, 28, 255) });
            bare.drawRect({ position: new Vec2(x, y), width: w * this.boss.enemy.health / this.boss.maxHealth, height: 4, color: new Color(232, 69, 55, 255) });
        }
    }

}
