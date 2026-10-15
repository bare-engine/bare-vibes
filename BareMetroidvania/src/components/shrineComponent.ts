import { Component, GameObject, ParticleComponent, SaveData } from "bare-engine";
import { ArcadeObject } from "bare-engine/arcade";
import { PlayerComponent } from "./playerComponent";

declare module "bare-engine"
{
    interface BareUserEvents
    {
        shrineUsed: void;
    }
}

// TOUCH TO HEAL, SAVE AND SET THE RESPAWN POINT
export class ShrineComponent extends Component<ArcadeObject>
{
    override OnCollisionStart(other: GameObject): void
    {
        if (other.name != "player")
            return;

        other.GetComponent(PlayerComponent)?.Heal(99);
        SaveData.shrineRoom = bare.level.currentLevel!.name;
        bare.storage.Save();

        this.go.GetComponent(ParticleComponent)?.Fire();
        bare.sound.Play("coin", { volume: 0.1, rate: 0.8 });
        bare.events.emit("shrineUsed");
    }
}
