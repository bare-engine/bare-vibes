import { Component, SerializeField, Vec2 } from 'bare-engine';
import { ArcadeObject } from 'bare-engine/arcade';
import { Burst } from '../game/fx';
import { Center, Hit } from '../game/hit';
import { Sfx } from '../game/sfx';
import { World } from '../scenes/world';

// A LIT BOMB: BLINKS, THEN HITS EVERYTHING AROUND IT
export class BombComponent extends Component<ArcadeObject>
{
    @SerializeField fuse = 1.6;
    @SerializeField radius = 28;

    private time = 0;

    override OnFixedUpdate(dt: number)
    {
        this.time += dt;
        const left = this.fuse - this.time;
        // BLINK FASTER AS IT'S ABOUT TO GO
        this.go.SetColor(left < 0.8 && Math.floor(left * (left < 0.4 ? 20 : 10)) % 2 ? '#ff7050' : '#ffffff');
        this.go.innerScale = 1 + Math.max(0, 0.6 - left) * 0.4;

        if (left <= 0)
            this.Explode();
    }

    private Explode()
    {
        const world = World.instance;
        const center = Center(this.go);
        this.go.Remove();

        Sfx('explode', 0.6);
        bare.camera.StartShake(5, 0.3);
        Burst(world, 'explosion', center);

        const targets = [...world.object.GetLayerByName('objects')];
        for (const obj of targets)
        {
            if (obj === this.go || !obj.addedToScene)
                continue;
            const c = Center(obj);
            // MEASURE TO THE NEAREST EDGE, SO BIG THINGS LIKE BOSSES ARE HIT TOO
            const dx = Math.max(0, Math.abs(c.x - center.x) - obj.width / 2);
            const dy = Math.max(0, Math.abs(c.y - center.y) - obj.height / 2);
            if (dx * dx + dy * dy < this.radius * this.radius)
                Hit(obj, { kind: 'bomb', damage: 2, from: new Vec2(center.x, center.y) });
        }
    }
}
