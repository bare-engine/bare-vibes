import { Component, GameObject, SaveData, SerializeField, TweenTo } from 'bare-engine';
import { ArcadeObject } from 'bare-engine/arcade';
import { Burst } from '../game/fx';
import { Center } from '../game/hit';
import { Sfx } from '../game/sfx';
import { State } from '../game/state';
import { HUD } from '../scenes/hud';
import { World } from '../scenes/world';

// BARS THAT OPEN WHEN THEIR GROUP IS SOLVED: A SWITCH, TORCHES OR A ROOM OF ENEMIES.
// WITH requires, IT'S THE CASTLE SEAL, WHICH OPENS FOR THAT MANY SIGILS
export class GateComponent extends Component<ArcadeObject>
{
    @SerializeField id = '';
    @SerializeField group = '';
    @SerializeField requires = 0;

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
        if (this.requires <= 0 || this.opening || other !== World.instance.player)
            return;

        if (SaveData.sigils.size >= this.requires)
        {
            HUD.instance.Toast('The sigils shine... the seal breaks!');
            this.Open();
        }
        else if (this.nagTime <= 0)
        {
            this.nagTime = 3;
            Sfx('error', 0.3);
            HUD.instance.Toast(`A seal of shadow. It needs ${this.requires} sigils (you have ${SaveData.sigils.size}).`);
        }
    }

    Open()
    {
        if (this.opening)
            return;
        this.opening = true;
        State.SetFlag(this.id);
        Sfx('door', 0.5);
        this.go.collide = false;
        Burst(World.instance, 'puff', Center(this.go));
        TweenTo(this.go, 0.4, { innerScaleY: 0.05, alpha: 0.3 }).promise.then(() => this.go.Remove());
    }
}
