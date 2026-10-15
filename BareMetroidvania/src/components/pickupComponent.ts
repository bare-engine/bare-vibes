import { Component, Dropdown, Easing, GameObject, ParticleComponent, SaveData, SerializeField, TweenTo } from "bare-engine";
import { ArcadeObject } from "bare-engine/arcade";
import { ItemKind } from "../world";
import { PlayerComponent } from "./playerComponent";

declare module "bare-engine"
{
    interface BareUserEvents
    {
        itemCollected: { kind: ItemKind };
    }
}

// AN ABILITY OR HEART VIAL. COLLECTED ONCE, REMEMBERED BY itemId IN THE SAVE
export class PickupComponent extends Component<ArcadeObject>
{
    @SerializeField @Dropdown(["dash", "double", "wall", "hammer", "vial"]) kind = "vial";
    @SerializeField itemId = "";

    private collected = false;

    override OnStart(): void
    {
        if (SaveData.items.has(this.itemId))
        {
            this.go.Remove();
            return;
        }

        TweenTo(this.go, 0.8, { innerY: -4, ease: Easing.Sinusoidal.InOut, yoyo: true, repeat: -1 });
    }

    override OnCollisionStart(other: GameObject): void
    {
        if (this.collected || other.name != "player")
            return;
        this.collected = true;

        var kind = this.kind as ItemKind;
        SaveData.items.add(this.itemId);
        if (kind == "vial")
            SaveData.maxHealth++;
        else
            SaveData.abilities.add(kind);
        bare.storage.Save();

        other.GetComponent(PlayerComponent)?.Heal(99);
        bare.sound.Play("win", { volume: 0.15 });
        bare.events.emit("itemCollected", { kind });

        this.Vanish();
    }

    async Vanish()
    {
        this.go.collide = false;
        this.go.GetComponent(ParticleComponent)?.Fire();
        await TweenTo(this.go, 0.8, { innerY: -30, alpha: 0, scale: 2 }).promise;
        this.go.Remove();
    }
}
