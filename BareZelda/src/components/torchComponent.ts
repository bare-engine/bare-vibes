import { AnimationComponent, Component, SerializeField } from 'bare-engine';
import { ArcadeObject } from 'bare-engine/arcade';
import { Burst } from '../game/fx';
import { Center, HitInfo } from '../game/hit';
import { Sfx } from '../game/sfx';
import { World } from '../scenes/world';

// LIGHT EVERY TORCH OF A GROUP WITH THE FIRE ROD TO SOLVE IT
export class TorchComponent extends Component<ArcadeObject>
{
    @SerializeField group = '';

    lit = false;

    override OnHit(hit: HitInfo)
    {
        if (this.lit || hit.kind != 'fire')
            return;
        this.lit = true;
        this.go.GetComponent(AnimationComponent)?.Play('lit');
        Sfx('fire', 0.4);
        Burst(World.instance, 'fire', Center(this.go));

        const unlit = bare.component.GetAllByType(TorchComponent).filter(t => t.group == this.group && !t.lit);
        if (unlit.length == 0)
            World.instance.Solve(this.group);
    }
}
