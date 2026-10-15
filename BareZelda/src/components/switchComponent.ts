import { Component, SerializeField } from 'bare-engine';
import { ArcadeObject } from 'bare-engine/arcade';
import { Burst } from '../game/fx';
import { Center, HitInfo } from '../game/hit';
import { Sfx } from '../game/sfx';
import { State } from '../game/state';
import { World } from '../scenes/world';

// A CRYSTAL YOU HIT, OR A STONE EYE YOU SHOOT. TURNING IT ON SOLVES ITS GROUP
export class SwitchComponent extends Component<ArcadeObject>
{
    @SerializeField id = '';
    @SerializeField group = '';
    // 'any' FOR SWORD, ARROWS AND FIRE, 'arrow' FOR ARROWS ONLY
    @SerializeField by = 'any';
    @SerializeField onTexture = 'switch_on';

    on = false;

    override OnStart()
    {
        if (State.Flag(this.id))
        {
            this.on = true;
            this.go.InitTexture(this.onTexture);
        }
    }

    override OnHit(hit: HitInfo)
    {
        if (this.on || hit.kind == 'enemy' || (this.by == 'arrow' && hit.kind != 'arrow'))
            return;
        this.on = true;
        this.go.InitTexture(this.onTexture);
        State.SetFlag(this.id);
        Sfx('hit', 0.4);
        Burst(World.instance, 'sparks', Center(this.go));
        World.instance.Solve(this.group);
    }
}
