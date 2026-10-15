import { Button, Color, Easing, GameObject, Scene, TextObject, TweenTo, Vec2 } from 'bare-engine';
import { Asset } from './generated/assets';
import type { Game } from './game';
import { Benchmark, type BenchRow } from './systems/benchmark';
import { perf } from './systems/perfMonitor';
import type { Upgrade } from './upgrades';

export type HudPayload = { game: Game };

const FONT = 'monospace';
// Two triangles of a unit square
const QUAD_CORNERS = [[0, 0], [1, 0], [1, 1], [0, 0], [1, 1], [0, 1]];
const WHITE = '#ffffff';

const HELP = [
    'WASD / arrows / hold mouse: move     mouse: aim knives',
    'wheel, - =: zoom   0: reset zoom   Z: overview   Esc: pause',
    'M: collision mode   B: benchmark   1/2/3: +100/+500/+2000 enemies',
    'K: kill all   G: god mode   U: level up   F: freeze spawner   V: decor on/off',
    'N: minimap   H: hide this help',
].join('\n');

// Screen-space UI on top of the game: bars, counters, perf stats, menus.
// Reads the game's camera to point at bosses that are off screen.
export class Hud extends Scene
{
    game!: Game;

    private levelText!: TextObject;
    private timeText!: TextObject;
    private killsText!: TextObject;
    private perfText!: TextObject;
    private helpText!: TextObject;
    private announceText!: TextObject;
    private centerText!: TextObject;

    private overlay: GameObject[] = [];
    private bossArrows: GameObject[] = [];
    private showMinimap = false;
    private textTimer = 0;
    private graphPoints: Vec2[] = [];
    private mapPoints: Vec2[] = [];
    private mapColors: Color[] = [];
    // Frame in which a menu closed: its key press must not also reach the game
    lastModalCloseFrame = -1;

    modalOpen = false;

    private static readonly xpBack = Color.fromHex('#1b1b2b');
    private static readonly xpFill = Color.fromHex('#3fa9ff');
    private static readonly panel = Color.fromHex('#000000a0');
    private static readonly graphLine = Color.fromHex('#7dff7a');
    private static readonly graphBudget = Color.fromHex('#ffffff40');
    private static readonly mapEnemy = Color.fromHex('#ff5a5a');
    private static readonly mapBoss = Color.fromHex('#ffd23a');
    private static readonly mapPlayer = Color.fromHex('#3fa9ff');
    private static readonly mapView = Color.fromHex('#ffffff60');

    constructor()
    {
        super({ UI: true });
    }

    override OnAwake(payload: HudPayload)
    {
        this.game = payload.game;
    }

    override OnStart()
    {
        this.levelText = this.AddText('LV 1', 22, 0, 0);
        this.timeText = this.AddText('00:00', 30, 0.5, 0);
        this.killsText = this.AddText('0 kills', 22, 1, 0);
        this.perfText = this.AddText('', 14, 0, 0);
        this.helpText = this.AddText(HELP, 13, 0, 1);
        this.helpText.alpha = 0.8;
        this.announceText = this.AddText('', 34, 0.5, 0.5);
        this.announceText.alpha = 0;
        this.centerText = this.AddText('', 48, 0.5, 0.5);

        this.Layout();
    }

    override OnResize()
    {
        this.Layout();
    }

    private Layout()
    {
        const w = bare.width;
        const h = bare.height;
        this.levelText.SetPosition(12, 18);
        this.timeText.SetPosition(w / 2, 16);
        this.killsText.SetPosition(w - 12, 18);
        this.perfText.SetPosition(12, 50);
        this.helpText.SetPosition(12, h - 10);
        this.announceText.SetPosition(w / 2, h * 0.25);
        this.centerText.SetPosition(w / 2, h * 0.4);
    }

    private AddText(text: string, fontSize: number, pivotX: number, pivotY: number): TextObject
    {
        const obj = new TextObject(this, {
            text,
            fontSize,
            fontFamily: FONT,
            fill: WHITE,
            stroke: '#000000',
            strokeThickness: 4,
        });
        this.AddGameObject(obj);
        // SetPivot treats 0 as pixels and anything up to 1 as a fraction, so 0 stays 0 either way
        obj.SetPivot(pivotX, pivotY);
        return obj;
    }

    override OnUpdate(dt: number)
    {
        const game = this.game;
        const keyboard = bare.keyboard;

        // The game scene is paused during menus, so its keys are read here
        if (keyboard.IsKeyPressed('escape') && !this.modalOpen && !game.isOver)
            this.SetPaused(!game.paused);
        if (keyboard.IsKeyPressed('h'))
            this.helpText.visible = !this.helpText.visible;
        if (keyboard.IsKeyPressed('n'))
            this.showMinimap = !this.showMinimap;

        this.PickByKey();

        this.textTimer -= dt;
        if (this.textTimer <= 0)
        {
            this.textTimer = 0.25;
            this.UpdateTexts();
        }
    }

    private SetPaused(paused: boolean)
    {
        this.game.paused = paused;
        this.centerText.SetText(paused ? 'PAUSED' : '');
    }

    private UpdateTexts()
    {
        const game = this.game;
        const player = game.playerComp;
        const minutes = Math.floor(game.gameTime / 60);
        const seconds = Math.floor(game.gameTime % 60);

        SetTextIfChanged(this.levelText, `LV ${player.level}   HP ${Math.ceil(player.hp)}/${game.playerStats.maxHp}`);
        SetTextIfChanged(this.timeText, `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
        SetTextIfChanged(this.killsText, `${game.kills} kills`);

        const p = perf.display;
        const flags = [game.godMode ? 'GOD' : '', game.spawner.enabled ? '' : 'SPAWN OFF', game.decorShown ? '' : 'NO DECOR']
            .filter(Boolean).join(' ');
        const lines = [
            `${p.fps.toFixed(0).padStart(3)} fps  ${p.frameMs.toFixed(1)}ms (p95 ${p.p95Ms.toFixed(1)}, worst ${p.worstMs.toFixed(0)})`,
            `fixed ${p.fixedMs.toFixed(2)}ms x${p.steps.toFixed(1)}  physics ${p.physicsMs.toFixed(2)}ms`,
            `update ${p.updateMs.toFixed(2)}ms  render ${p.renderMs.toFixed(2)}ms  ${p.drawCalls.toFixed(0)} draws`,
            `enemies ${game.enemies.length}  projectiles ${game.projectiles.length}  pickups ${game.pickups.length}`,
            `objects ${game.object.GetAll().length}  heap ${p.heapMB.toFixed(0)}MB`,
            `collisions: ${game.combat.mode.toUpperCase()}  zoom ${game.camera.GetZoom().toFixed(2)} ${flags}`,
            game.bench.status,
        ];
        SetTextIfChanged(this.perfText, lines.join('\n'));
    }

    override OnRender()
    {
        const game = this.game;
        const w = bare.width;
        const player = game.playerComp;

        // XP bar along the top
        rapid.drawRect({ position: new Vec2(0, 0), width: w, height: 10, color: Hud.xpBack });
        rapid.drawRect({ position: new Vec2(0, 0), width: w * Math.min(1, player.xp / player.xpToNext), height: 10, color: Hud.xpFill });

        this.DrawFrameGraph();
        this.UpdateBossArrows();

        if (this.showMinimap)
            this.DrawMinimap();
    }

    // Frame times of the last 240 frames; the faint line is 16.7ms (60 fps)
    private DrawFrameGraph()
    {
        const history = perf.history;
        const x0 = 12;
        const y0 = 190;
        const width = 240;
        const height = 50;
        const msToPixels = height / 50;

        rapid.drawRect({ position: new Vec2(x0, y0 - height), width, height, color: Hud.panel });
        rapid.drawRect({ position: new Vec2(x0, y0 - 16.7 * msToPixels), width, height: 1, color: Hud.graphBudget });

        if (this.graphPoints.length !== history.length)
            this.graphPoints = Array.from(history, () => new Vec2());

        for (let i = 0; i < history.length; i++)
        {
            const value = history[(perf.historyIndex + i) % history.length];
            this.graphPoints[i].set(x0 + i * width / history.length, y0 - Math.min(height, value * msToPixels));
        }

        rapid.drawLine({ points: this.graphPoints, width: 1.5, color: Hud.graphLine });
    }

    // Arrows at the screen's edge pointing at bosses outside the view.
    // WorldToScreen of the game's camera gives positions in this UI scene's units.
    private UpdateBossArrows()
    {
        const game = this.game;
        const camera = game.camera;
        const w = bare.width;
        const h = bare.height;
        const margin = 28;
        let used = 0;

        for (const enemy of game.enemies)
        {
            if (!enemy.boss)
                continue;

            const screen = camera.WorldToScreen(enemy.x, enemy.y);
            if (screen.x > 0 && screen.x < w && screen.y > 0 && screen.y < h)
                continue;

            if (used === this.bossArrows.length)
                this.bossArrows.push(this.AddGameObject(Asset.Image.ARROW).CenterPivot().SetColor(Hud.mapBoss));

            const arrow = this.bossArrows[used++];
            arrow.visible = true;
            arrow.SetPosition(
                Math.min(Math.max(screen.x, margin), w - margin),
                Math.min(Math.max(screen.y, margin), h - margin),
            );
            arrow.SetRotation(Math.atan2(screen.y - h / 2, screen.x - w / 2) * 180 / Math.PI);
        }

        for (let i = used; i < this.bossArrows.length; i++)
            this.bossArrows[i].visible = false;
    }

    // The whole arena, the camera's view rectangle, the player and (a sample of) the enemies
    private DrawMinimap()
    {
        const game = this.game;
        const size = 180;
        const x0 = bare.width - size - 12;
        const y0 = bare.height - size - 50;
        const scale = size / Math.max(game.arena.width, game.arena.height);

        rapid.drawRect({ position: new Vec2(x0, y0), width: size, height: size, color: Hud.panel });

        // Every bare.drawRect is its own draw call, so all dots go into one triangle list instead
        const enemies = game.enemies;
        const step = Math.max(1, Math.ceil(enemies.length / 3000));
        const points = this.mapPoints;
        const colors = this.mapColors;
        let n = 0;
        const quad = (x: number, y: number, size: number, color: Color) => {
            for (const [cx, cy] of QUAD_CORNERS)
            {
                if (n === points.length)
                    points.push(new Vec2());
                points[n].set(x + cx * size, y + cy * size);
                colors[n++] = color;
            }
        };

        for (let i = 0; i < enemies.length; i += step)
        {
            const enemy = enemies[i];
            const size = enemy.boss ? 5 : 2;
            quad(x0 + enemy.x * scale - size / 2, y0 + enemy.y * scale - size / 2, size, enemy.boss ? Hud.mapBoss : Hud.mapEnemy);
        }
        const player = game.player;
        quad(x0 + player.x * scale - 2, y0 + player.y * scale - 2, 4, Hud.mapPlayer);

        points.length = n;
        colors.length = n;
        rapid.drawGraphic({ points, color: colors });

        const view = game.GetViewRect();
        const vx = x0 + view.x * scale;
        const vy = y0 + view.y * scale;
        const vw = view.width * scale;
        const vh = view.height * scale;
        rapid.drawLine({
            points: [new Vec2(vx, vy), new Vec2(vx + vw, vy), new Vec2(vx + vw, vy + vh), new Vec2(vx, vy + vh)],
            closed: true,
            width: 1,
            color: Hud.mapView,
        });
    }

    Announce(message: string)
    {
        this.announceText.SetText(message);
        this.announceText.alpha = 1;
        TweenTo(this.announceText, 2.5, { alpha: 0, delay: 1.5, ease: Easing.Quadratic.In });
    }

    ShowLevelUp(level: number, upgrades: Upgrade[], OnPick: (upgrade: Upgrade) => void)
    {
        this.modalOpen = true;
        this.AddDim();

        const title = this.AddText(`LEVEL ${level}! Choose an upgrade`, 34, 0.5, 0.5);
        title.SetPosition(bare.width / 2, bare.height * 0.25);
        this.overlay.push(title);

        upgrades.forEach((upgrade, i) => {
            const button = this.AddButton(`${upgrade.title}\n${upgrade.text}`, () => {
                this.CloseOverlay();
                OnPick(upgrade);
            });
            button.SetPosition(bare.width / 2, bare.height * 0.4 + i * 95);
        });

        // Number keys also pick, so the menu works without a mouse
        this.pickOpenedFrame = bare.count;
        this.pickByKey = (index: number) => {
            if (upgrades[index])
            {
                this.CloseOverlay();
                OnPick(upgrades[index]);
            }
        };
    }

    private pickByKey: ((index: number) => void) | null = null;
    private pickOpenedFrame = 0;

    private PickByKey()
    {
        // Not in the frame the menu opened, so the key press that caused it can't also pick
        if (!this.pickByKey || bare.count === this.pickOpenedFrame)
            return;

        for (let i = 0; i < 3; i++)
            if (bare.keyboard.IsKeyPressed(String(i + 1)))
            {
                this.pickByKey(i);
                return;
            }
    }

    ShowGameOver(text: string, OnRestart: () => void)
    {
        this.modalOpen = true;
        this.AddDim();

        const title = this.AddText(text, 30, 0.5, 0.5);
        title.SetPosition(bare.width / 2, bare.height * 0.35);
        this.overlay.push(title);

        const button = this.AddButton('Play again', () => {
            this.CloseOverlay();
            OnRestart();
        });
        button.SetPosition(bare.width / 2, bare.height * 0.55);
    }

    private AddDim()
    {
        const dim = this.AddGameObject('PIXEL').SetScaleXY(bare.width, bare.height).SetColor(Color.Black).SetAlpha(0.55);
        this.overlay.push(dim);
    }

    private AddButton(text: string, OnPress: () => void): Button
    {
        const button = new Button(this, {
            text,
            fontSize: 22,
            fontFamily: FONT,
            align: 'center',
            buttonColor: Color.fromHex('#2b4c9b'),
            cornerRadius: 10,
            margin: 16,
            OnPress,
        });
        this.AddGameObject(button).CenterPivot();
        button.OnPointerEnter(() => button.SetScale(1.05));
        button.OnPointerLeave(() => button.SetScale(1));
        this.overlay.push(button);
        return button;
    }

    private CloseOverlay()
    {
        for (const obj of this.overlay)
            obj.Remove();
        this.overlay.length = 0;
        this.pickByKey = null;
        this.modalOpen = false;
        this.lastModalCloseFrame = bare.count;
    }

    ShowBenchmarkTable(text: string)
    {
        this.modalOpen = true;
        this.AddDim();
        const table = this.AddText(text, 13, 0.5, 0.5);
        table.SetPosition(bare.width / 2, bare.height * 0.45);
        this.overlay.push(table);
        const button = this.AddButton('Close', () => this.CloseOverlay());
        button.SetPosition(bare.width / 2, bare.height * 0.85);
    }

    static FormatBenchmark(rows: BenchRow[]): string
    {
        return ['Benchmark results (also in the console)', '', ...rows.map(row => Benchmark.FormatRow(row))].join('\n');
    }
}

function SetTextIfChanged(text: TextObject, value: string)
{
    // SetText re-renders the text into a texture, so skip it when nothing changed
    if (text.text !== value)
        text.SetText(value);
}
