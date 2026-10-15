import { Component, SerializeField } from 'bare-engine';
import { ArcadeObject } from 'bare-engine/arcade';
import { Burst } from '../game/fx';
import { Center } from '../game/hit';
import { ItemText } from '../game/items';
import { Sfx } from '../game/sfx';
import { State } from '../game/state';
import { World } from '../scenes/world';

// OPENED BY PRESSING SPACE IN FRONT OF IT. REMEMBERS BEING OPENED
export class ChestComponent extends Component<ArcadeObject>
{
    @SerializeField id = '';
    @SerializeField item = 'rupees';
    @SerializeField amount = 1;

    opened = false;

    override OnStart()
    {
        if (State.Flag(this.id))
            this.SetOpened();
    }

    private SetOpened()
    {
        this.opened = true;
        this.go.InitTexture('chest_open');
    }

    async Open()
    {
        if (this.opened)
            return;
        const world = World.instance;
        this.SetOpened();
        State.SetFlag(this.id);
        Sfx('door', 0.4);
        Burst(world, 'sparks', Center(this.go));

        State.Give(this.item, this.amount, world.levelName);
        State.Save();
        await world.pc.HoldUp(this.item, ItemText(this.item, this.amount));
    }
}
