import { Color, Component, type GameObject } from 'bare-engine';
import { SHIRT_COLORS } from '../sim/colony';
import { ITEM_TEXTURES } from '../render/itemTextures';
import type { Worker } from '../sim/worker';
import { TILE } from '../sim/world';

// whatever knows how far we are between two sim ticks (the Game scene)
export interface TickClock
{
    renderAlpha: number;
}

const HUNGRY = new Color(200, 200, 235, 255);

// Shows a sim worker: follows its position between ticks and animates walking and working.
// The worker itself lives in the sim, so this view has no state that needs saving.
export class WorkerViewComponent extends Component
{
    worker: Worker | null = null;
    private clock: TickClock | null = null;
    private shirt: GameObject | null = null;
    private carry: GameObject | null = null;
    private carriedItem = -1;
    private time = 0;

    Bind(worker: Worker, clock: TickClock)
    {
        this.worker = worker;
        this.clock = clock;
        this.time = (worker.id * 0.37) % 1;
        this.shirt = this.go.GetChildByName('shirt');
        this.carry = this.go.GetChildByName('carry');
        this.shirt?.SetColor(SHIRT_COLORS[worker.shirt % SHIRT_COLORS.length]);
        this.carriedItem = -1;
        this.OnUpdate(0);
    }

    override OnUpdate(deltaTime: number)
    {
        const w = this.worker;
        if (!w)
            return;

        const a = this.clock?.renderAlpha ?? 1;
        const x = (w.px + (w.x - w.px) * a) * TILE;
        const y = (w.py + (w.y - w.py) * a) * TILE;
        this.go.SetPosition(x, y + 4);
        this.go.flipped = w.facing < 0;
        this.time += deltaTime;

        if (w.moving)
        {
            this.go.innerY = -Math.abs(Math.sin(this.time * 14)) * 1.5;
            this.go.innerRotation = 0;
        }
        else if (w.working)
        {
            this.go.innerY = 0;
            this.go.innerRotation = Math.sin(this.time * 18) * 10;
        }
        else
        {
            this.go.innerY = 0;
            this.go.innerRotation = 0;
        }
        this.go.SetColor(w.hunger >= 90 ? HUNGRY : Color.White);

        const carrying = w.carryCount > 0 ? w.carryItem : 0;
        if (carrying !== this.carriedItem && this.carry)
        {
            this.carriedItem = carrying;
            this.carry.visible = carrying > 0;
            if (carrying > 0)
                this.carry.SetTexture(bare.asset.GetTexture(ITEM_TEXTURES[carrying]));
        }
    }
}
