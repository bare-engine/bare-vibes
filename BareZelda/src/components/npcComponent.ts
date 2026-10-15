import { Component, SerializeField } from 'bare-engine';
import { ArcadeObject } from 'bare-engine/arcade';
import { Talk } from '../game/dialogue';
import { State } from '../game/state';

// SOMEONE (OR A SIGN) YOU TALK TO WITH SPACE. WHAT THEY SAY IS IN game/dialogue.ts
export class NpcComponent extends Component<ArcadeObject>
{
    @SerializeField who = '';
    // FOR SIGNS
    @SerializeField text = '';
    // ONLY THERE WHEN A FLAG IS SET, OR UNTIL IT IS
    @SerializeField showIf = '';
    @SerializeField hideIf = '';

    private talking = false;

    // CHECKED ALL THE TIME, SO MINA'S CAT SHOWS UP AT HOME AS SOON AS YOU FIND IT
    override OnFixedUpdate()
    {
        if (!this.showIf && !this.hideIf)
            return;
        const here = (!this.showIf || State.Flag(this.showIf)) && (!this.hideIf || !State.Flag(this.hideIf));
        this.go.visible = here;
        this.go.collide = here;
    }

    async Talk()
    {
        if (this.talking)
            return;
        this.talking = true;
        try
        {
            await Talk(this);
        }
        finally
        {
            this.talking = false;
        }
    }
}
