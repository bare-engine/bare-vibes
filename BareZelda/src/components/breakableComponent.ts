import { Component, SerializeField } from 'bare-engine';
import { ArcadeObject } from 'bare-engine/arcade';
import { Burst } from '../game/fx';
import { Center, HitInfo } from '../game/hit';
import { Sfx } from '../game/sfx';
import { State } from '../game/state';
import { World } from '../scenes/world';

// BUSHES AND POTS (SWORD), CRACKED WALLS AND ROCKS (BOMBS), THORNS (FIRE)
export class BreakableComponent extends Component<ArcadeObject>
{
    // AN id MAKES IT STAY BROKEN
    @SerializeField id = '';
    // WHAT BREAKS IT, COMMA SEPARATED: sword, arrow, bomb, fire
    @SerializeField by = 'sword';
    @SerializeField drops = false;
    @SerializeField effect = 'puff';

    private broken = false;

    override OnStart()
    {
        if (this.id && State.Flag(this.id))
            this.go.Remove();
    }

    override OnHit(hit: HitInfo)
    {
        if (this.broken || !this.by.split(',').includes(hit.kind))
            return;
        this.broken = true;

        const world = World.instance;
        const center = Center(this.go);
        if (this.id)
        {
            State.SetFlag(this.id);
            Sfx('secret', 0.5);
        }
        Sfx(this.effect == 'leaves' ? 'hit' : 'kill', 0.35);
        Burst(world, this.effect as 'puff' | 'leaves' | 'fire', center);
        if (this.drops)
            world.RandomDrop(this.go.position.clone());
        this.go.Remove();
    }
}
