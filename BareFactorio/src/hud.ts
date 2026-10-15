import { Button, Color, GameObject, Scene, TextObject } from 'bare-engine';
import { Controls, type Tool } from './controls';
import type { Game } from './game';
import { CurrentGoal } from './sim/goals';
import { ITEM_TEXTURES } from './render/itemTextures';
import { ITEM_COUNT, ITEM_LABELS } from './sim/items';
import { RES_LABELS, TERRAIN_LABELS } from './sim/world';

const FONT = 'Verdana, sans-serif';
const PANEL = new Color(28, 32, 40, 200);
const BUTTON = Color.fromHex('#3a4456');
const BUTTON_ACTIVE = Color.fromHex('#d88a3a');
const BUTTON_SPEED_ACTIVE = Color.fromHex('#4a8a5a');
const MARGIN = 10;

interface Rect { x: number; y: number; width: number; height: number }

export interface HudPayload
{
    game: Game;
}

// The interface on top of the game: a UI scene, so the camera doesn't move it
export class Hud extends Scene
{
    game!: Game;

    private stockIcons: GameObject[] = [];
    private stockTexts: TextObject[] = [];
    private popText!: TextObject;
    private goalText!: TextObject;
    private statsText!: TextObject;
    private infoText!: TextObject;
    private toastText!: TextObject;
    private toolButtons: { tool: Tool, button: Button }[] = [];
    private speedButtons: { speed: number, button: Button }[] = [];
    private sideButtons: Button[] = [];

    private panels: Rect[] = [];
    private toastTime = 0;
    private refreshTime = 0;
    private hoverTool: Tool | null = null;

    constructor()
    {
        super({ UI: true });
    }

    override OnStart(payload?: HudPayload)
    {
        this.game = payload!.game;
        const text = (size: number, fill = '#ffffff', align: 'left' | 'center' | 'right' = 'left') => {
            const t = new TextObject(this, { text: ' ', fontSize: size, fontFamily: FONT, fill, stroke: '#1a1d24', strokeThickness: 3, align, lineHeight: 1.3 });
            this.AddGameObject(t);
            return t;
        };

        for (let item = 1; item < ITEM_COUNT; item++)
        {
            this.stockIcons.push(this.AddGameObject(ITEM_TEXTURES[item]).SetScale(2.5));
            this.stockTexts.push(text(15));
        }
        this.popText = text(15);
        this.goalText = text(17, '#ffe9a8', 'center');
        this.statsText = text(12, '#cfe3ff');
        this.infoText = text(14);
        this.toastText = text(20, '#ffffff', 'center');
        this.toastText.visible = false;

        this.BuildToolbar();
        this.BuildSideButtons();
        this.Layout();
        this.Refresh();
    }

    private MakeButton(label: string, onPress: () => void, minWidth = 0, onEnter?: () => void, onLeave?: () => void): Button
    {
        const button = new Button(this, {
            OnEnter: onEnter,
            OnLeave: onLeave,
            text: label,
            fontSize: 14,
            fontFamily: FONT,
            buttonColor: BUTTON,
            cornerRadius: 6,
            margin: 7,
            minWidth,
            OnPress: onPress,
        });
        this.AddGameObject(button);
        return button;
    }

    private BuildToolbar()
    {
        for (const b of this.toolButtons)
            b.button.Remove();
        this.toolButtons = [];

        const controls = this.game.controls;
        controls.tools.forEach((tool, index) => {
            const button = this.MakeButton(`${Controls.ToolKey(index)} ${controls.ToolLabel(tool)}`, () => controls.SetTool(tool), 86,
                () => this.hoverTool = tool,
                () => { if (this.hoverTool === tool) this.hoverTool = null; });
            this.toolButtons.push({ tool, button });
        });
        this.OnToolChanged();
    }

    private BuildSideButtons()
    {
        for (const speed of [0, 1, 2, 4])
        {
            const button = this.MakeButton(speed === 0 ? 'Pause' : `${speed}x`, () => this.game.SetSpeed(speed), 52);
            this.speedButtons.push({ speed, button });
        }
        this.sideButtons = [
            this.MakeButton('Save', () => this.game.Save(), 70),
            this.MakeButton('Load', () => this.game.Load(), 70),
            this.MakeButton('New', () => this.game.NewGame(), 70),
            this.MakeButton('Stress', () => this.game.StressTest(), 70),
        ];
    }

    OnToolChanged()
    {
        for (const { tool, button } of this.toolButtons)
            button.buttonColor = this.game.controls.IsTool(tool) ? BUTTON_ACTIVE : BUTTON;
    }

    override OnResize()
    {
        this.Layout();
    }

    private Layout()
    {
        const w = bare.width, h = bare.height;

        // toolbar: centered rows along the bottom
        const gap = 6;
        const rows: Button[][] = [[]];
        let rowWidth = 0;
        for (const { button } of this.toolButtons)
        {
            if (rowWidth + button.width > w - MARGIN * 2 && rows[rows.length - 1].length)
            {
                rows.push([]);
                rowWidth = 0;
            }
            rows[rows.length - 1].push(button);
            rowWidth += button.width + gap;
        }
        const rowHeight = (this.toolButtons[0]?.button.height ?? 30) + gap;
        let y = h - MARGIN - rows.length * rowHeight + gap;
        this.toolbarTop = y - gap;
        for (const row of rows)
        {
            const total = row.reduce((sum, b) => sum + b.width + gap, -gap);
            let x = (w - total) / 2;
            for (const button of row)
            {
                button.SetPosition(x, y);
                x += button.width + gap;
            }
            y += rowHeight;
        }

        this.goalText.SetPosition(w / 2, MARGIN + 4).SetPivot(0.5, 0);
        this.toastText.SetPosition(w / 2, MARGIN + 44).SetPivot(0.5, 0);
    }

    private toolbarTop = 0;

    IsPointerOverUI(): boolean
    {
        if (this.hitbox.GetCurrentHover())
            return true;
        const p = bare.mouse.screen.position;
        return this.panels.some(r => p.x >= r.x && p.y >= r.y && p.x < r.x + r.width && p.y < r.y + r.height);
    }

    Toast(message: string)
    {
        this.toastText.SetText(message);
        this.toastText.visible = true;
        this.toastTime = 3;
    }

    override OnUpdate()
    {
        const dt = bare.unscaledDeltaTime;
        if (this.toastTime > 0)
        {
            this.toastTime -= dt;
            this.toastText.alpha = Math.min(1, this.toastTime * 2);
            this.toastText.visible = this.toastTime > 0;
        }

        this.refreshTime -= dt;
        if (this.refreshTime <= 0)
        {
            this.refreshTime = 0.2;
            this.Refresh();
        }
    }

    private Refresh()
    {
        const game = this.game;
        const colony = game.colony;
        if (!colony)
            return;

        // stock, top left
        let y = MARGIN + 8;
        for (let item = 1; item < ITEM_COUNT; item++)
        {
            this.stockIcons[item - 1].SetPosition(MARGIN + 8, y);
            this.stockTexts[item - 1].SetText(`${colony.stock[item]}  ${ITEM_LABELS[item]}`);
            this.stockTexts[item - 1].SetPosition(MARGIN + 36, y);
            y += 24;
        }
        this.popText.SetText(`Colonists ${colony.workers.length}/${colony.housing}`);
        this.popText.SetPosition(MARGIN + 8, y + 4);
        const stockPanel = { x: MARGIN, y: MARGIN, width: 170, height: y + 30 - MARGIN };

        const goal = CurrentGoal(colony);
        if (goal)
        {
            const [have, need] = goal.progress(colony);
            this.goalText.SetText(`Goal ${colony.goalIndex + 1}: ${goal.text}  (${Math.min(have, need)}/${need})`);
        }
        else
            this.goalText.SetText('All goals done. Enjoy your cozy colony!');

        // stats and buttons, top right
        this.statsText.SetText(game.StatsText());
        const right = bare.width - MARGIN;
        const statsX = right - 240;
        this.statsText.SetPosition(statsX + 8, MARGIN + 8);
        let by = MARGIN + 16 + this.statsText.height;
        let bx = statsX + 8;
        for (const { speed, button } of this.speedButtons)
        {
            button.SetPosition(bx, by);
            button.buttonColor = game.speed === speed ? BUTTON_SPEED_ACTIVE : BUTTON;
            bx += button.width + 4;
        }
        by += (this.speedButtons[0]?.button.height ?? 28) + 6;
        bx = statsX + 8;
        for (const button of this.sideButtons)
        {
            if (bx + button.width > right)
            {
                bx = statsX + 8;
                by += button.height + 6;
            }
            button.SetPosition(bx, by);
            bx += button.width + 6;
        }
        by += (this.sideButtons[0]?.height ?? 28) + 8;
        const statsPanel = { x: statsX, y: MARGIN, width: 240, height: by - MARGIN };

        // details on what's under the pointer, bottom left
        this.infoText.SetText(this.InfoText());
        const infoPanel = { x: MARGIN, y: 0, width: Math.max(220, this.infoText.width + 16), height: this.infoText.height + 16 };
        infoPanel.y = this.toolbarTop - infoPanel.height - 8;
        this.infoText.SetPosition(infoPanel.x + 8, infoPanel.y + 8);

        const goalPanel = { x: this.goalText.x - this.goalText.width / 2 - 10, y: MARGIN, width: this.goalText.width + 20, height: this.goalText.height + 10 };
        this.panels = [stockPanel, statsPanel, infoPanel, goalPanel];
    }

    override OnPreRender()
    {
        for (const r of this.panels)
            bare.drawRoundedRect({ x: r.x, y: r.y, width: r.width, height: r.height, radius: 8, color: PANEL });
    }

    private InfoText(): string
    {
        const game = this.game;
        const colony = game.colony;
        const controls = game.controls;

        if (this.hoverTool)
            return this.ToolInfo(this.hoverTool);

        const worker = controls.selectedWorker ?? (this.IsPointerOverUI() ? null : controls.WorkerAt(controls.pointerX, controls.pointerY));
        if (worker)
        {
            const lines = [`${worker.name}`, worker.Describe(colony), `Hunger ${worker.hunger}%${worker.hunger >= 90 ? ' (slow, needs berries)' : ''}`];
            if (worker.carryCount > 0)
                lines.push(`Carrying ${worker.carryCount} ${ITEM_LABELS[worker.carryItem].toLowerCase()}`);
            return lines.join('\n');
        }

        const world = colony.world;
        const b = controls.selectedBuilding ?? (this.IsPointerOverUI() ? null : colony.BuildingAt(controls.hoverX, controls.hoverY));
        if (b)
        {
            const lines = [b.def.label + (b.built ? '' : ' (planned)')];
            if (!b.built)
            {
                lines.push('Needs: ' + b.def.cost.map(([item, count]) => `${b.delivered[item]}/${count} ${ITEM_LABELS[item].toLowerCase()}`).join(', '));
                if (b.MaterialsComplete())
                    lines.push('Waiting for a builder');
            }
            else
            {
                lines.push(b.def.desc);
                const contents: string[] = [];
                for (let item = 1; item < ITEM_COUNT; item++)
                    if (b.inv[item] > 0)
                        contents.push(`${b.inv[item]} ${ITEM_LABELS[item].toLowerCase()}`);
                if (contents.length)
                    lines.push((b.def.kind === 'storage' ? 'Holds ' : 'Input: ') + contents.join(', '));
                if (b.out > 0)
                    lines.push(`Output: ${b.out} ${ITEM_LABELS[b.outItem].toLowerCase()}${b.blockedOut ? ' (waiting for a belt or hauler)' : ''}`);
                if (b.def.kind === 'drill')
                {
                    const i = world.Index(b.x, b.y);
                    lines.push(b.depleted ? 'Depleted' : `${world.resAmount[i]} left to mine`);
                }
                if (b.def.kind === 'farm')
                    lines.push(b.stage >= 2 ? 'Ripe, waiting for a picker' : `Growing (${b.stage + 1}/3)`);
                if (b.def.kind === 'belt')
                    lines.push(`${b.belt.length} item${b.belt.length === 1 ? '' : 's'} on it`);
            }
            return lines.join('\n');
        }

        if (this.IsPointerOverUI() || !world.InBounds(controls.hoverX, controls.hoverY))
            return 'WASD/arrows/right-drag: move   Wheel: zoom\nR: rotate   Space: pause   Esc: cancel';
        const i = world.Index(controls.hoverX, controls.hoverY);
        const lines = [TERRAIN_LABELS[world.terrain[i]]];
        if (world.res[i])
            lines.push(`${RES_LABELS[world.res[i]]} (${world.resAmount[i]})${world.designated[i] ? ' - marked for harvest' : ''}`);
        lines.push(`Tile ${controls.hoverX}, ${controls.hoverY}`);
        return lines.join('\n');
    }

    private ToolInfo(tool: Tool): string
    {
        switch (tool.kind)
        {
            case 'select': return 'Select\nClick colonists and buildings to see what they do.';
            case 'harvest': return 'Harvest\nDrag over trees, boulders, ore and bushes.\nShift-drag to unmark.';
            case 'remove': return 'Remove\nDrag to take down buildings and unmark tiles.\nMaterials go back to the HQ.';
            case 'build':
            {
                const def = tool.def;
                const cost = def.cost.map(([item, count]) => `${count} ${ITEM_LABELS[item].toLowerCase()}`).join(', ');
                return `${def.label}\n${def.desc}\nCost: ${cost}`;
            }
        }
    }
}
