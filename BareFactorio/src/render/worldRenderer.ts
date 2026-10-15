import { Color, type Texture } from 'bare-engine';
import { Asset } from '../generated/assets';
import type { Building } from '../sim/building';
import { BELT_SPEED, type Colony } from '../sim/colony';
import { DX, DY } from '../sim/defs';
import { ITEM_TEXTURES } from './itemTextures';
import { TILE } from '../sim/world';

// the tiles on screen, inclusive
export interface TileView
{
    x0: number; y0: number; x1: number; y1: number;
}

const BLUEPRINT = new Color(150, 200, 255, 150);
const ARROW = new Color(255, 255, 255, 150);
const BAR_BACK = new Color(30, 30, 30, 160);
const BAR_FILL = new Color(120, 220, 120, 255);
const BAR_BUILD = new Color(120, 180, 255, 255);
const DESIGNATED = new Color(255, 230, 120, 70);
const AXE = new Color(255, 255, 255, 220);

// Buildings, belts and the items on them are drawn straight from the sim's data every frame, for
// the visible area only. Thousands of belts as GameObjects would all be updated and drawn, on
// screen or not, since the engine doesn't cull.
export class WorldRenderer
{
    private belt: Texture[];
    private items: Texture[];
    private farm: Texture[];
    private textures = new Map<string, Texture>();
    private arrow: Texture;
    private warn: Texture;
    private axe: Texture;

    stats = { buildings: 0, items: 0 };

    constructor(private colony: Colony)
    {
        const tex = (name: string) => bare.asset.GetTexture(name);
        this.belt = [tex(Asset.Image.BELT_0), tex(Asset.Image.BELT_1), tex(Asset.Image.BELT_2), tex(Asset.Image.BELT_3)];
        this.items = ITEM_TEXTURES.map(name => name ? tex(name) : null!);
        this.farm = [tex(Asset.Image.B_FARM_0), tex(Asset.Image.B_FARM_1), tex(Asset.Image.B_FARM_2)];
        this.arrow = tex(Asset.Image.UI_ARROW);
        this.warn = tex(Asset.Image.UI_WARN);
        this.axe = tex(Asset.Image.UI_AXE);
        for (const def of colony.defs)
            this.textures.set(def.key, tex(def.texture));
    }

    SetColony(colony: Colony)
    {
        this.colony = colony;
    }

    ItemTexture(item: number): Texture
    {
        return this.items[item];
    }

    BuildingTexture(key: string): Texture
    {
        return this.textures.get(key)!;
    }

    // below the workers: from the scene's OnPreRender
    DrawWorld(view: TileView, alpha: number)
    {
        const c = this.colony;
        const visible: Building[] = [];
        for (const b of c.buildings.values())
            if (b.x + b.def.w > view.x0 && b.y + b.def.h > view.y0 && b.x <= view.x1 && b.y <= view.y1)
                visible.push(b);
        this.stats.buildings = visible.length;

        const frame = Math.floor((c.tick + alpha) * BELT_SPEED * TILE / 2) & 3;
        for (const b of visible)
            if (b.def.kind === 'belt')
                this.DrawBelt(b, frame);

        for (const b of visible)
            if (b.def.kind !== 'belt')
                this.DrawBuilding(b);

        let items = 0;
        for (const b of visible)
            if (b.belt.length)
                items += this.DrawBeltItems(b, alpha);
        this.stats.items = items;

        // bars first, then the warning icons on top, each kind in one batch
        for (const b of visible)
            this.DrawBars(b);
        for (const b of visible)
            if (b.built && (b.depleted || (b.blockedOut && b.out >= 8)))
                rapid.drawSprite({ texture: this.warn, x: (b.x + b.def.w) * TILE - 8, y: b.y * TILE - 2 });
    }

    // above the workers: from the scene's OnRender
    DrawOverlay(view: TileView)
    {
        const c = this.colony;
        const w = c.world.w;
        const visible: number[] = [];
        for (const t of c.designations)
        {
            const x = t % w, y = (t / w) | 0;
            if (x >= view.x0 && y >= view.y0 && x <= view.x1 && y <= view.y1)
                visible.push(t);
        }
        // shapes and sprites are separate batches: switching between them costs a draw call, so draw
        // all of one kind, then all of the other
        for (const t of visible)
            rapid.drawRect({ x: (t % w) * TILE, y: ((t / w) | 0) * TILE, width: TILE, height: TILE, color: DESIGNATED });
        for (const t of visible)
            rapid.drawSprite({ texture: this.axe, x: (t % w) * TILE + 9, y: ((t / w) | 0) * TILE - 1, color: AXE });
    }

    private DrawBelt(b: Building, frame: number)
    {
        rapid.drawSprite({
            texture: this.belt[b.built ? frame : 0],
            x: b.x * TILE + TILE / 2,
            y: b.y * TILE + TILE / 2,
            rotation: b.dir * 90,
            origin: 0.5,
            color: b.built ? undefined : BLUEPRINT,
        });
    }

    private DrawBuilding(b: Building)
    {
        const texture = b.def.kind === 'farm' ? this.farm[b.built ? b.stage : 0] : this.textures.get(b.def.key)!;
        rapid.drawSprite({ texture, x: b.x * TILE, y: b.y * TILE, color: b.built ? undefined : BLUEPRINT });

        if (b.def.rotatable)
            this.DrawArrow(b.x * TILE, b.y * TILE, b.def.w, b.def.h, b.dir);
    }

    DrawArrow(px: number, py: number, w: number, h: number, dir: number, color = ARROW)
    {
        const cx = px + (w * TILE) / 2 + DX[dir] * (w * TILE / 2 - 2);
        const cy = py + (h * TILE) / 2 + DY[dir] * (h * TILE / 2 - 2);
        rapid.drawSprite({ texture: this.arrow, x: cx, y: cy, rotation: dir * 90, origin: 0.5, scale: 0.75, color });
    }

    private DrawBeltItems(b: Building, alpha: number): number
    {
        const cx = b.x + 0.5, cy = b.y + 0.5;
        const ox = DX[b.dir] * 0.5, oy = DY[b.dir] * 0.5;
        for (const item of b.belt)
        {
            // between ticks, keep moving at belt speed so items glide instead of stepping 20 times a second
            const p = Math.min(1, item.p + (item.moving ? BELT_SPEED * alpha : 0));
            let x: number, y: number;
            if (p < 0.5)
            {
                // from the edge it came in at towards the middle, which bends around corners
                const t = p * 2;
                x = cx - DX[item.from] * 0.5 * (1 - t);
                y = cy - DY[item.from] * 0.5 * (1 - t);
            }
            else
            {
                const t = (p - 0.5) * 2;
                x = cx + ox * t;
                y = cy + oy * t;
            }
            rapid.drawSprite({ texture: this.items[item.item], x: x * TILE, y: y * TILE, origin: 0.5 });
        }
        return b.belt.length;
    }

    private DrawBars(b: Building)
    {
        const px = b.x * TILE, py = b.y * TILE;
        const width = b.def.w * TILE;

        if (!b.built)
        {
            let have = b.buildWork / b.def.buildTicks * 0.3, need = 0;
            for (const [item, count] of b.def.cost)
            {
                have += b.delivered[item] / count * 0.7 / b.def.cost.length;
                need++;
            }
            if (need)
                this.DrawBar(px + 2, py + b.def.h * TILE - 3, width - 4, Math.min(1, have), BAR_BUILD);
            return;
        }

        if (b.def.kind === 'crafter' && b.progress >= 0)
            this.DrawBar(px + 2, py + TILE - 3, width - 4, b.progress / b.def.recipe!.ticks, BAR_FILL);
        else if (b.def.kind === 'farm' && b.stage < 2)
            this.DrawBar(px + 4, py + b.def.h * TILE - 4, width - 8, (b.stage + b.growth / b.def.growTicks) / 2, BAR_FILL);
    }

    private DrawBar(x: number, y: number, width: number, t: number, color: Color)
    {
        rapid.drawRect({ x, y, width, height: 2, color: BAR_BACK });
        rapid.drawRect({ x, y, width: Math.max(1, width * t), height: 2, color });
    }
}
