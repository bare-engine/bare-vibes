import { Entity, GameObject, InspectorBaseClass, SerializeField } from 'bare-engine';
import type { Game } from '../game';

export interface PickupEntity extends Entity
{
    value?: number;
    heal?: number;
}

// XP gems and hearts. No physics: they only check their distance to the player.
@InspectorBaseClass
export class Pickup extends GameObject
{
    declare entity: PickupEntity | null;

    @SerializeField value = 1;
    @SerializeField heal = 0;

    listIndex = -1;
    attracted = false;
    private speed = 0;
    private bob = 0;

    get game(): Game
    {
        return this.scene as Game;
    }

    override OnAwake()
    {
        this.value = 1;
        this.heal = 0;
        this.attracted = false;
        this.speed = 0;
    }

    override OnAdded()
    {
        this.bob = Math.random() * 10;
        this.game.RegisterPickup(this);
    }

    override OnRemoved()
    {
        this.game.UnregisterPickup(this);
    }

    override OnUpdate(dt: number)
    {
        const game = this.game;
        const player = game.player;
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const distSq = dx * dx + dy * dy;
        const magnet = game.playerStats.magnet;

        if (!this.attracted && distSq < magnet * magnet)
            this.attracted = true;

        if (this.attracted)
        {
            const dist = Math.sqrt(distSq);
            if (dist < 20)
            {
                game.Collect(this);
                this.Remove();
                return;
            }

            this.speed = Math.min(this.speed + 1600 * dt, 1400);
            const step = Math.min(dist, this.speed * dt);
            this.x += dx / dist * step;
            this.y += dy / dist * step;
            this.innerY = 0;
        }
        else
        {
            this.bob += dt * 4;
            this.innerY = Math.sin(this.bob) * 2;
        }
    }
}
