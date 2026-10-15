import { Component, ParticleComponent, SaveData } from "bare-engine";
import { ArcadeObject } from "bare-engine/arcade";
import { RoomGeometry } from "../world";

// A BLOCK THE WARHAMMER BREAKS. STAYS BROKEN: REMEMBERED IN THE SAVE BY ROOM AND POSITION
export class CrackedComponent extends Component<ArcadeObject>
{
    get key(): string
    {
        return `${bare.level.currentLevel?.name}:${this.go.x},${this.go.y}`;
    }

    override OnStart(): void
    {
        if (SaveData.broken.has(this.key))
        {
            RoomGeometry.Remove(this.go);
            this.go.Remove();
        }
    }

    async Break()
    {
        if (!this.go.collide)
            return;

        SaveData.broken.add(this.key);
        bare.storage.Save();
        RoomGeometry.Remove(this.go);

        this.go.collide = false;
        this.go.visible = false;
        this.go.GetComponent(ParticleComponent)?.Fire();
        bare.camera.StartShake(2, 0.15);
        bare.sound.Play("lose", { volume: 0.08, rate: 0.6 });

        if (!await this.scene.Wait(0.6))
            return;
        this.go.Remove();
    }
}
