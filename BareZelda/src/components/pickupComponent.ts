import { Component, GameObject, SaveData, SerializeField, TweenTo } from 'bare-engine';
import { ArcadeObject } from 'bare-engine/arcade';
import { Burst } from '../game/fx';
import { Center } from '../game/hit';
import { DUNGEONS, ItemText } from '../game/items';
import { Sfx } from '../game/sfx';
import { State } from '../game/state';
import { HUD } from '../scenes/hud';
import { World } from '../scenes/world';

// SOMETHING LYING ON THE FLOOR THAT YOU PICK UP BY WALKING OVER IT
export class PickupComponent extends Component<ArcadeObject>
{
    @SerializeField item = 'rupees';
    @SerializeField amount = 1;
    // SMALL DROPS VANISH AFTER A WHILE
    @SerializeField lifetime = 10;

    private age = 0;
    private taken = false;

    override OnStart()
    {
        // A LITTLE HOP WHEN IT APPEARS
        this.go.innerY = -6;
        TweenTo(this.go, 0.35, { innerY: 0, ease: (k: number) => 1 - Math.abs(Math.cos(k * Math.PI * 1.5)) * (1 - k) });

        if (this.item == 'sigil')
        {
            const info = DUNGEONS[World.instance.levelName];
            if (info)
                this.go.SetColor(info.color);
        }
    }

    get permanent(): boolean
    {
        return ['key', 'heartContainer', 'sigil', 'bossKey'].includes(this.item);
    }

    override OnFixedUpdate(dt: number)
    {
        if (this.permanent)
        {
            this.go.innerY = Math.sin(bare.time / 250) * 1.5 - 1.5;
            return;
        }
        this.age += dt;
        if (this.age > this.lifetime - 2)
            this.go.visible = Math.floor(this.age * 10) % 2 == 0;
        if (this.age > this.lifetime)
            this.go.Remove();
    }

    override OnCollisionStart(other: GameObject)
    {
        const world = World.instance;
        if (this.taken || other !== world.player || world.pc.dead)
            return;
        this.taken = true;
        this.Collect();
    }

    private async Collect()
    {
        const world = World.instance;
        const level = world.levelName;
        this.go.Remove();

        switch (this.item)
        {
            case 'heart':
                State.Give('heart', this.amount, level);
                Sfx('heart', 0.4);
                return;
            case 'rupees':
                State.Give('rupees', this.amount, level);
                Sfx('rupee', 0.35);
                return;
            case 'arrows':
            case 'bombRefill':
                State.Give(this.item, this.amount, level);
                Sfx('item', 0.35);
                return;
            case 'sigil':
                await this.CollectSigil();
                return;
        }

        // BIG FINDS: HOLD THEM UP
        State.Give(this.item, this.amount, level);
        State.Save();
        await world.pc.HoldUp(this.item, ItemText(this.item, this.amount));
    }

    private async CollectSigil()
    {
        const world = World.instance;
        const level = world.levelName;
        const info = DUNGEONS[level];
        SaveData.sigils.add(level);
        State.Save();

        Burst(world, 'magic', Center(world.player));
        const count = SaveData.sigils.size;
        await world.pc.HoldUp('sigil', `You got the ${info.sigilName}! (${count} of 5)`);

        if (level == 'd5')
        {
            world.FinishGame();
            return;
        }
        if (count == 4)
            await HUD.instance.Say('', 'Four sigils glow as one... Far to the north west, the seal on the Dark Castle trembles.');

        // LEAVE THE DUNGEON
        world.Warp('overworld', level);
    }
}
