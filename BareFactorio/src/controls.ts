import { Color, type GameObject } from 'bare-engine';
import { Data } from './generated/assets';
import type { Game } from './game';
import type { Building } from './sim/building';
import type { BuildingDef } from './sim/defs';
import type { Worker } from './sim/worker';
import { TILE } from './sim/world';

export type Tool =
    | { kind: 'select' }
    | { kind: 'harvest' }
    | { kind: 'remove' }
    | { kind: 'build', def: BuildingDef };

const HOVER = new Color(255, 255, 255, 140);
const SELECT = new Color(255, 230, 120, 255);
const HARVEST_RECT = new Color(255, 220, 90, 60);
const REMOVE_RECT = new Color(255, 90, 80, 60);
const VALID = new Color(170, 255, 170, 170);
const INVALID = new Color(255, 120, 120, 170);
const MIN_ZOOM = 0.75;
const MAX_ZOOM = 6;
const DRAG_PAN_THRESHOLD = 5;

// Mouse and keyboard: moving the camera, picking tools, and turning clicks into sim commands.
// It has a `scene`, so `bare.mouse` and friends resolve to the game scene's modules here too.
export class Controls
{
    tool: Tool = { kind: 'select' };
    dir = 0;
    hoverX = 0;
    hoverY = 0;
    // the pointer in tiles, not rounded
    pointerX = 0;
    pointerY = 0;
    selectedBuilding: Building | null = null;
    selectedWorker: Worker | null = null;

    private dragStart: { x: number, y: number } | null = null;
    private ghost: GameObject | null = null;
    private ghostKey = '';
    private panFrom: { x: number, y: number } | null = null;
    private panMoved = false;

    constructor(readonly scene: Game) {}

    get tools(): Tool[]
    {
        return [
            { kind: 'select' },
            { kind: 'harvest' },
            { kind: 'remove' },
            ...this.scene.colony.defs.filter(def => def.tool).map(def => ({ kind: 'build', def }) as Tool),
        ];
    }

    ToolLabel(tool: Tool): string
    {
        switch (tool.kind)
        {
            case 'select': return 'Select';
            case 'harvest': return 'Harvest';
            case 'remove': return 'Remove';
            case 'build': return tool.def.label;
        }
    }

    static ToolKey(index: number): string
    {
        return ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='][index] ?? '';
    }

    SetTool(tool: Tool)
    {
        this.tool = tool;
        this.dragStart = null;
        this.scene.hud?.OnToolChanged();
    }

    IsTool(tool: Tool): boolean
    {
        return tool.kind === this.tool.kind && (tool.kind !== 'build' || (this.tool.kind === 'build' && tool.def === this.tool.def));
    }

    Update()
    {
        const overUI = this.scene.hud?.IsPointerOverUI() ?? false;
        this.UpdateCamera(overUI);
        this.UpdateKeys();

        const world = bare.mouse.world.position;
        this.pointerX = world.x / TILE;
        this.pointerY = world.y / TILE;
        this.hoverX = Math.floor(this.pointerX);
        this.hoverY = Math.floor(this.pointerY);

        if (bare.mouse.IsPressed() && !overUI)
            this.dragStart = { x: this.hoverX, y: this.hoverY };

        if (this.dragStart && !bare.mouse.IsDown())
        {
            this.Apply(this.dragStart.x, this.dragStart.y, this.hoverX, this.hoverY);
            this.dragStart = null;
        }

        this.UpdateGhost(overUI);
    }

    private UpdateKeys()
    {
        const keyboard = bare.keyboard;
        const tools = this.tools;
        for (let i = 0; i < tools.length; i++)
            if (keyboard.IsKeyPressed(Controls.ToolKey(i)))
                this.SetTool(tools[i]);

        if (keyboard.IsKeyPressed('r'))
            this.dir = (this.dir + (keyboard.IsKeyDown('shift') ? 3 : 1)) & 3;
        if (keyboard.IsKeyPressed('escape'))
            this.SetTool({ kind: 'select' });
        if (keyboard.IsKeyPressed(' '))
            this.scene.TogglePause();
    }

    private UpdateCamera(overUI: boolean)
    {
        const camera = bare.camera;
        const dt = bare.unscaledDeltaTime;
        const keyboard = bare.keyboard;
        const speed = 700 / camera.GetZoom() * dt;
        let dx = 0, dy = 0;
        if (keyboard.IsLeftDown()) dx -= speed;
        if (keyboard.IsRightDown()) dx += speed;
        if (keyboard.IsUpDown()) dy -= speed;
        if (keyboard.IsDownDown()) dy += speed;
        if (dx || dy)
            camera.AddPosition(dx, dy);

        // zoom around the pointer, so what's under it stays there
        if (bare.mouse.wheelDelta !== 0 && !overUI)
        {
            const screen = bare.mouse.screen.position;
            const before = camera.ScreenToWorld(screen.x, screen.y);
            const zoom = bare.util.Clamp(camera.GetZoom() * Math.pow(0.998, bare.mouse.wheelDelta), MIN_ZOOM, MAX_ZOOM);
            camera.SetZoom(zoom);
            const after = camera.ScreenToWorld(screen.x, screen.y);
            camera.AddPosition(before.x - after.x, before.y - after.y);
        }

        // drag with the middle or right button to pan. A right click without dragging cancels the tool
        const panning = bare.mouse.IsMiddleDown() || bare.mouse.IsRightDown();
        const screen = bare.mouse.screen.position;
        if (panning && !this.panFrom && !overUI)
        {
            this.panFrom = { x: screen.x, y: screen.y };
            this.panMoved = false;
        }
        else if (panning && this.panFrom)
        {
            const mx = screen.x - this.panFrom.x, my = screen.y - this.panFrom.y;
            if (this.panMoved || Math.abs(mx) + Math.abs(my) > DRAG_PAN_THRESHOLD)
            {
                this.panMoved = true;
                const scale = camera.GetScale();
                camera.AddPosition(-mx / scale, -my / scale);
                this.panFrom = { x: screen.x, y: screen.y };
            }
        }
        else if (!panning && this.panFrom)
        {
            if (!this.panMoved)
            {
                if (this.dragStart)
                    this.dragStart = null;
                else if (this.tool.kind !== 'select')
                    this.SetTool({ kind: 'select' });
                else
                    this.Deselect();
            }
            this.panFrom = null;
        }
    }

    Deselect()
    {
        this.selectedBuilding = null;
        this.selectedWorker = null;
    }

    private Apply(x0: number, y0: number, x1: number, y1: number)
    {
        const colony = this.scene.colony;
        const tool = this.tool;
        const shift = bare.keyboard.IsKeyDown('shift');

        if (tool.kind === 'select')
        {
            this.Deselect();
            this.selectedWorker = this.WorkerAt(this.pointerX, this.pointerY);
            if (!this.selectedWorker)
                this.selectedBuilding = colony.BuildingAt(x1, y1);
            return;
        }

        if (tool.kind === 'harvest' || tool.kind === 'remove')
        {
            const world = colony.world;
            for (let y = Math.max(0, Math.min(y0, y1)); y <= Math.min(world.h - 1, Math.max(y0, y1)); y++)
            for (let x = Math.max(0, Math.min(x0, x1)); x <= Math.min(world.w - 1, Math.max(x0, x1)); x++)
            {
                const i = world.Index(x, y);
                if (tool.kind === 'harvest')
                {
                    colony.Designate(i, !shift);
                }
                else
                {
                    colony.Designate(i, false);
                    const b = colony.BuildingAt(x, y);
                    if (b)
                        colony.Deconstruct(b);
                }
            }
            return;
        }

        const def = tool.def;
        if (def.kind === 'belt')
        {
            for (const [x, y, dir] of this.BeltLine(x0, y0, x1, y1))
                colony.Place(def, x, y, dir);
            return;
        }

        const [ax, ay] = this.Anchor(def, x1, y1);
        const reason = colony.CanPlace(def, ax, ay);
        if (reason)
            this.scene.hud?.Toast(reason);
        else
            colony.Place(def, ax, ay, this.dir);
    }

    // the top left tile, so the pointer is on the middle of bigger buildings
    private Anchor(def: BuildingDef, x: number, y: number): [number, number]
    {
        return [x - ((def.w - 1) >> 1), y - ((def.h - 1) >> 1)];
    }

    // an L-shaped line: along the longer axis first, every belt pointing the way it's dragged
    private BeltLine(x0: number, y0: number, x1: number, y1: number): [number, number, number][]
    {
        const dx = x1 - x0, dy = y1 - y0;
        if (dx === 0 && dy === 0)
            return [[x0, y0, this.dir]];

        const tiles: [number, number, number][] = [];
        const horizontalFirst = Math.abs(dx) >= Math.abs(dy);
        const hDir = dx >= 0 ? 0 : 2, vDir = dy >= 0 ? 1 : 3;
        if (horizontalFirst)
        {
            for (let x = x0; x !== x1; x += Math.sign(dx)) tiles.push([x, y0, hDir]);
            tiles.push([x1, y0, dy !== 0 ? vDir : hDir]);
            for (let y = y0 + Math.sign(dy); dy !== 0 && y !== y1 + Math.sign(dy); y += Math.sign(dy)) tiles.push([x1, y, vDir]);
        }
        else
        {
            for (let y = y0; y !== y1; y += Math.sign(dy)) tiles.push([x0, y, vDir]);
            tiles.push([x0, y1, dx !== 0 ? hDir : vDir]);
            for (let x = x0 + Math.sign(dx); dx !== 0 && x !== x1 + Math.sign(dx); x += Math.sign(dx)) tiles.push([x, y1, hDir]);
        }
        this.dir = tiles[tiles.length - 1][2];
        return tiles;
    }

    WorkerAt(x: number, y: number): Worker | null
    {
        let best: Worker | null = null;
        let bestDist = 0.8;
        for (const w of this.scene.colony.workers)
        {
            // the sprite stands above its position, so aim a little higher
            const d = Math.hypot(w.x - x, w.y - 0.3 - y);
            if (d < bestDist)
            {
                bestDist = d;
                best = w;
            }
        }
        return best;
    }

    // the building under the pointer, as a see-through prefab instance
    private UpdateGhost(overUI: boolean)
    {
        const tool = this.tool;
        const key = tool.kind === 'build' && !overUI && !(tool.def.kind === 'belt' && this.dragStart) ? tool.def.key : '';
        if (key !== this.ghostKey)
        {
            this.ghost?.Remove();
            this.ghost = key ? this.scene.AddGameObject(key, Data.Layer.OVERLAY) : null;
            this.ghostKey = key;
        }
        if (!this.ghost || tool.kind !== 'build')
            return;

        const def = tool.def;
        const [ax, ay] = this.Anchor(def, this.hoverX, this.hoverY);
        const valid = !this.scene.colony.CanPlace(def, ax, ay);
        this.ghost.SetColor(valid ? VALID : INVALID);
        if (def.kind === 'belt')
        {
            this.ghost.CenterPivot();
            this.ghost.SetPosition(ax * TILE + TILE / 2, ay * TILE + TILE / 2).SetRotation(this.dir * 90);
        }
        else
            this.ghost.SetPosition(ax * TILE, ay * TILE);
    }

    // drag previews and the hover box, above everything in the world
    DrawOverlay()
    {
        const tool = this.tool;
        const colony = this.scene.colony;

        if (this.dragStart && (tool.kind === 'harvest' || tool.kind === 'remove'))
        {
            const x = Math.min(this.dragStart.x, this.hoverX), y = Math.min(this.dragStart.y, this.hoverY);
            const w = Math.abs(this.dragStart.x - this.hoverX) + 1, h = Math.abs(this.dragStart.y - this.hoverY) + 1;
            rapid.drawRect({
                x: x * TILE, y: y * TILE, width: w * TILE, height: h * TILE,
                color: tool.kind === 'harvest' ? HARVEST_RECT : REMOVE_RECT,
                outline: { width: 1, color: tool.kind === 'harvest' ? Color.Yellow : Color.Red },
            });
        }
        else if (this.dragStart && tool.kind === 'build' && tool.def.kind === 'belt')
        {
            const texture = this.scene.worldRenderer.BuildingTexture(tool.def.key);
            for (const [x, y, dir] of this.BeltLine(this.dragStart.x, this.dragStart.y, this.hoverX, this.hoverY))
            {
                const valid = !colony.CanPlace(tool.def, x, y);
                rapid.drawSprite({ texture, x: x * TILE + TILE / 2, y: y * TILE + TILE / 2, rotation: dir * 90, origin: 0.5, color: valid ? VALID : INVALID });
            }
        }
        else if (tool.kind === 'build' && tool.def.rotatable && tool.def.kind !== 'belt')
        {
            const [ax, ay] = this.Anchor(tool.def, this.hoverX, this.hoverY);
            this.scene.worldRenderer.DrawArrow(ax * TILE, ay * TILE, tool.def.w, tool.def.h, this.dir, Color.White);
        }
        else
        {
            rapid.drawRect({ x: this.hoverX * TILE, y: this.hoverY * TILE, width: TILE, height: TILE, fill: false, outline: { width: 1, color: HOVER } });
        }

        const b = this.selectedBuilding;
        if (b && colony.buildings.has(b.id))
            rapid.drawRect({ x: b.x * TILE, y: b.y * TILE, width: b.def.w * TILE, height: b.def.h * TILE, fill: false, outline: { width: 1, color: SELECT } });
        else
            this.selectedBuilding = null;

        const w = this.selectedWorker;
        if (w && colony.workers.includes(w))
        {
            const a = this.scene.renderAlpha;
            rapid.drawCircle({ x: (w.px + (w.x - w.px) * a) * TILE, y: (w.py + (w.y - w.py) * a) * TILE + 4, radius: 6, fill: false, outline: { width: 1, color: SELECT } });
        }
        else
            this.selectedWorker = null;
    }
}
