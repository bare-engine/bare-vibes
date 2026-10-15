import { Component, GameObject, SerializeField } from 'bare-engine';
import { ArcadeObject } from 'bare-engine/arcade';
import { World } from '../scenes/world';

// A DOORWAY TO ANOTHER LEVEL. target IS THE id OF THE WARP YOU ARRIVE AT
export class WarpComponent extends Component<ArcadeObject>
{
    @SerializeField id = '';
    @SerializeField level = '';
    @SerializeField target = '';
    // WHICH WAY YOU STEP OUT WHEN ARRIVING HERE
    @SerializeField dir = 'down';

    // ONLY WHILE WALKING, SO A PLAYER KNOCKED ONTO THE WARP DOESN'T LEAVE THE LEVEL
    override OnCollisionUpdate(other: GameObject)
    {
        const world = World.instance;
        if (other === world.player && !world.pc.dead && !world.pc.knockedBack && world.player.IsMoving())
            world.Warp(this.level, this.target);
    }
}
