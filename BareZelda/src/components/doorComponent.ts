import { Component, GameObject, SerializeField, TweenTo } from 'bare-engine';
import { ArcadeObject } from 'bare-engine/arcade';
import { Burst } from '../game/fx';
import { Center } from '../game/hit';
import { Sfx } from '../game/sfx';
import { State } from '../game/state';
import { HUD } from '../scenes/hud';
import { World } from '../scenes/world';

// A LOCKED DOOR. WALK INTO IT WITH A SMALL KEY, OR THE BIG KEY FOR THE BOSS DOOR
export class DoorComponent extends Component<ArcadeObject>
{
    @SerializeField id = '';
    @SerializeField boss = false;

    private opening = false;
    private nagTime = 0;

    override OnStart()
    {
        if (State.Flag(this.id))
            this.go.Remove();
    }

    override OnFixedUpdate(dt: number)
    {
        this.nagTime -= dt;
    }

    override OnCollisionUpdate(other: GameObject)
    {
        const world = World.instance;
        if (this.opening || other !== world.player)
            return;

        const level = world.levelName;
        if (this.boss ? State.HasBossKey(level) : State.Keys(level) > 0)
        {
            if (!this.boss)
                State.AddKeys(level, -1);
            this.Open();
        }
        else if (this.nagTime <= 0)
        {
            this.nagTime = 3;
            Sfx('error', 0.3);
            HUD.instance.Toast(this.boss ? 'This door needs the Big Key.' : 'Locked. You need a Small Key.');
        }
    }

    private Open()
    {
        this.opening = true;
        State.SetFlag(this.id);
        State.Save();
        Sfx('door', 0.5);
        this.go.collide = false;
        Burst(World.instance, 'puff', Center(this.go));
        TweenTo(this.go, 0.25, { alpha: 0, innerScaleY: 0.1 }).promise.then(() => this.go.Remove());
    }
}
