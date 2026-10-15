import { CanvasPosition, CanvasScale, Color, SaveData, Scene, StartBare, TextObject } from 'bare-engine';
import settingsDataJson from '../public/data/settingsData.json';
import { COLS, HIDDEN_ROWS, Piece, PieceType, ROWS, Tetris } from './tetris';

declare module 'bare-engine'
{
    namespace SaveData
    {
        let highScore: number;
    }
}

const WIDTH = 760;
const HEIGHT = 800;

const CELL = 34;
const BOARD_X = 210;
const BOARD_Y = 80;
const VISIBLE_ROWS = ROWS - HIDDEN_ROWS;
const BOARD_W = COLS * CELL;
const BOARD_H = VISIBLE_ROWS * CELL;

const MINI = 22;
const LEFT_X = 30;
const RIGHT_X = BOARD_X + BOARD_W + 30;
const PANEL_W = 150;

// INPUT TIMING (SECONDS)
const DAS = 0.16;
const ARR = 0.045;
const SOFT_DROP_RATE = 0.03;

const PIECE_COLORS: Record<PieceType, Color> = {
    I: Color.fromHex("#2fd6f5"),
    O: Color.fromHex("#f7d02c"),
    T: Color.fromHex("#a55cf0"),
    S: Color.fromHex("#4cd55a"),
    Z: Color.fromHex("#f0484a"),
    J: Color.fromHex("#3d6ff2"),
    L: Color.fromHex("#f58a2a"),
};

const BG = Color.fromHex("#14161f");
const PANEL = Color.fromHex("#1d2030");
const GRID = Color.fromHex("#252a3d");
const FRAME = Color.fromHex("#3a4160");
const TEXT_DIM = "#8a93b8";
const TEXT = "#e8ecff";

function Shade(color: Color, factor: number, alpha: number = 255): Color
{
    const f = (v: number) => factor >= 0 ? v + (255 - v) * factor : v * (1 + factor);
    return new Color(f(color.r), f(color.g), f(color.b), alpha);
}

// PRECOMPUTED BEVEL COLORS, NOT ALLOCATING COLORS EVERY FRAME
const BLOCK_STYLES = Object.fromEntries(Object.entries(PIECE_COLORS).map(([type, c]) => [type, {
    base: c,
    light: Shade(c, 0.35),
    dark: Shade(c, -0.35),
    ghost: new Color(c.r, c.g, c.b, 55),
}])) as Record<PieceType, { base: Color, light: Color, dark: Color, ghost: Color }>;

const FLASH = Color.fromHex("#ffffff");
const OVERLAY = new Color(10, 12, 18, 190);

export class Game extends Scene
{
    tetris = new Tetris();
    isPaused = false;

    // HORIZONTAL AUTO-REPEAT
    heldDir = 0;
    dasTimer = 0;
    arrTimer = 0;
    softDropTimer = 0;

    scoreText!: TextObject;
    levelText!: TextObject;
    linesText!: TextObject;
    bestText!: TextObject;
    clearText!: TextObject;
    overlayTitle!: TextObject;
    overlaySub!: TextObject;

    constructor()
    {
        super({ settingsData: settingsDataJson });
    }

    override OnAwake()
    {
        bare.SetBackgroundColorHTML(BG);

        bare.storage.SetDefaults({ highScore: 0 });
        bare.storage.Load();
    }

    override OnStart()
    {
        this.AddText("TETRIS", WIDTH / 2, 22, 36, TEXT, "bold");

        this.AddText("HOLD", LEFT_X + PANEL_W / 2, BOARD_Y, 20, TEXT_DIM, "bold");
        this.AddText("NEXT", RIGHT_X + PANEL_W / 2, BOARD_Y, 20, TEXT_DIM, "bold");

        const statsY = BOARD_Y + 170;
        this.AddText("SCORE", LEFT_X + PANEL_W / 2, statsY, 18, TEXT_DIM, "bold");
        this.scoreText = this.AddText("0", LEFT_X + PANEL_W / 2, statsY + 26, 26, TEXT, "bold");
        this.AddText("LEVEL", LEFT_X + PANEL_W / 2, statsY + 80, 18, TEXT_DIM, "bold");
        this.levelText = this.AddText("1", LEFT_X + PANEL_W / 2, statsY + 106, 26, TEXT, "bold");
        this.AddText("LINES", LEFT_X + PANEL_W / 2, statsY + 160, 18, TEXT_DIM, "bold");
        this.linesText = this.AddText("0", LEFT_X + PANEL_W / 2, statsY + 186, 26, TEXT, "bold");
        this.AddText("BEST", LEFT_X + PANEL_W / 2, statsY + 240, 18, TEXT_DIM, "bold");
        this.bestText = this.AddText(String(SaveData.highScore), LEFT_X + PANEL_W / 2, statsY + 266, 26, TEXT, "bold");

        this.AddText(
            "←/→  move\n↑ / X  rotate\nZ  rotate ccw\n↓  soft drop\nSPACE  hard drop\nC / SHIFT  hold\nESC  pause",
            LEFT_X + PANEL_W / 2, BOARD_Y + BOARD_H - 170, 15, TEXT_DIM, "normal");

        this.clearText = this.AddText("", BOARD_X + BOARD_W / 2, BOARD_Y + BOARD_H * 0.3, 34, TEXT, "bold");
        this.clearText.strokeThickness = 6;
        this.clearText.stroke = "#000000";

        this.overlayTitle = this.AddText("", BOARD_X + BOARD_W / 2, BOARD_Y + BOARD_H * 0.42, 40, TEXT, "bold");
        this.overlaySub = this.AddText("", BOARD_X + BOARD_W / 2, BOARD_Y + BOARD_H * 0.42 + 56, 18, TEXT_DIM, "normal");

        this.NewGame();
    }

    AddText(text: string, x: number, y: number, fontSize: number, fill: string, fontWeight: string): TextObject
    {
        const obj = new TextObject(this, { text, fontSize, fill, fontWeight, fontFamily: "monospace", align: "center" });
        this.AddGameObject(obj).SetPosition(x, y).SetPivot(0.5, 0);
        return obj;
    }

    // NOT NAMED Restart OR paused: Scene ALREADY HAS THOSE AND THE ENGINE CALLS/READS THEM
    NewGame()
    {
        this.tetris.Reset();
        this.isPaused = false;
        this.heldDir = 0;
    }

    // ================ INPUT + LOGIC ================

    override OnUpdate(dt: number)
    {
        const kb = bare.keyboard;
        const t = this.tetris;

        if (t.gameOver)
        {
            if (kb.IsKeyPressed("enter") || kb.IsKeyPressed("r"))
                this.NewGame();
            this.UpdateTexts();
            return;
        }

        if (kb.IsKeyPressed("escape") || kb.IsKeyPressed("p"))
            this.isPaused = !this.isPaused;

        if (this.isPaused)
        {
            this.UpdateTexts();
            return;
        }

        if (kb.IsKeyPressed("r"))
            this.NewGame();

        // ROTATE / HOLD / HARD DROP
        if (kb.IsKeyPressed("arrowUp") || kb.IsKeyPressed("x") || kb.IsKeyPressed("w"))
            t.Rotate(1);
        if (kb.IsKeyPressed("z") || kb.IsKeyPressed("control"))
            t.Rotate(-1);
        if (kb.IsKeyPressed("c") || kb.IsKeyPressed("shift"))
            t.Hold();
        if (kb.IsKeyPressed("space"))
            t.HardDrop();

        this.HandleHorizontal(dt);

        // SOFT DROP
        const softDropping = kb.IsKeyDown("arrowDown") || kb.IsKeyDown("s");
        if (softDropping)
        {
            if (kb.IsKeyPressed("arrowDown") || kb.IsKeyPressed("s"))
                this.softDropTimer = 0;

            this.softDropTimer -= dt;
            while (this.softDropTimer <= 0)
            {
                this.softDropTimer += SOFT_DROP_RATE;
                if (!t.SoftDrop())
                    break;
            }
        }

        t.Update(dt, softDropping);

        if (t.gameOver && t.score > SaveData.highScore)
        {
            SaveData.highScore = t.score;
            bare.storage.Save();
        }

        this.UpdateTexts();
    }

    // DAS/ARR: MOVE ONCE ON PRESS, THEN AFTER DAS REPEAT EVERY ARR. LAST PRESSED DIRECTION WINS
    HandleHorizontal(dt: number)
    {
        const kb = bare.keyboard;
        const leftDown = kb.IsKeyDown("arrowLeft") || kb.IsKeyDown("a");
        const rightDown = kb.IsKeyDown("arrowRight") || kb.IsKeyDown("d");
        const leftPressed = kb.IsKeyPressed("arrowLeft") || kb.IsKeyPressed("a");
        const rightPressed = kb.IsKeyPressed("arrowRight") || kb.IsKeyPressed("d");

        let dir = this.heldDir;
        if (leftPressed) dir = -1;
        if (rightPressed) dir = 1;
        if (dir == -1 && !leftDown) dir = rightDown ? 1 : 0;
        if (dir == 1 && !rightDown) dir = leftDown ? -1 : 0;

        if (dir != this.heldDir || leftPressed || rightPressed)
        {
            this.heldDir = dir;
            this.dasTimer = DAS;
            this.arrTimer = 0;
            if (dir != 0)
                this.tetris.Move(dir);
            return;
        }

        if (dir == 0)
            return;

        if (this.dasTimer > 0)
        {
            this.dasTimer -= dt;
            if (this.dasTimer > 0)
                return;
            this.arrTimer = this.dasTimer; // CARRY LEFTOVER INTO ARR
        }

        this.arrTimer -= dt;
        while (this.arrTimer <= 0)
        {
            this.arrTimer += ARR;
            if (!this.tetris.Move(dir))
                break;
        }
    }

    UpdateTexts()
    {
        const t = this.tetris;
        this.scoreText.SetText(String(t.score));
        this.levelText.SetText(String(t.level));
        this.linesText.SetText(String(t.lines));
        this.bestText.SetText(String(Math.max(SaveData.highScore, t.score)));

        this.clearText.SetText(t.lastClearTimer > 0 ? t.lastClearText : "");
        this.clearText.alpha = Math.min(1, Math.max(0, t.lastClearTimer * 2));

        if (t.gameOver)
        {
            this.overlayTitle.SetText("GAME OVER");
            this.overlaySub.SetText("press ENTER to play again");
        }
        else if (this.isPaused)
        {
            this.overlayTitle.SetText("PAUSED");
            this.overlaySub.SetText("press ESC to resume");
        }
        else
        {
            this.overlayTitle.SetText("");
            this.overlaySub.SetText("");
        }
    }

    // ================ RENDERING ================
    // DRAWN IN OnPreRender SO THE TEXT OBJECTS RENDER ON TOP OF THE BOARD

    override OnPreRender()
    {
        const t = this.tetris;

        this.Rect(0, 0, WIDTH, HEIGHT, BG);

        // PANELS
        this.Panel(LEFT_X, BOARD_Y + 30, PANEL_W, 110);
        this.Panel(RIGHT_X, BOARD_Y + 30, PANEL_W, 5 * 78 + 20);

        // BOARD FRAME + GRID
        this.Rect(BOARD_X - 4, BOARD_Y - 4, BOARD_W + 8, BOARD_H + 8, FRAME);
        this.Rect(BOARD_X, BOARD_Y, BOARD_W, BOARD_H, PANEL);
        for (let x = 1; x < COLS; x++)
            this.Rect(BOARD_X + x * CELL, BOARD_Y, 1, BOARD_H, GRID);
        for (let y = 1; y < VISIBLE_ROWS; y++)
            this.Rect(BOARD_X, BOARD_Y + y * CELL, BOARD_W, 1, GRID);

        // LOCKED BLOCKS
        const flashOn = Math.floor(t.clearTimer * 20) % 2 == 0;
        for (let y = HIDDEN_ROWS; y < ROWS; y++)
        {
            const clearing = t.clearingRows.includes(y);
            for (let x = 0; x < COLS; x++)
            {
                const type = t.board[y][x];
                if (!type)
                    continue;

                const px = BOARD_X + x * CELL;
                const py = BOARD_Y + (y - HIDDEN_ROWS) * CELL;
                if (clearing && flashOn)
                    this.Rect(px, py, CELL, CELL, FLASH);
                else
                    this.Block(px, py, CELL, type, t.gameOver);
            }
        }

        // GHOST + CURRENT PIECE
        if (!t.busy)
        {
            const ghostY = t.ghostY;
            const style = BLOCK_STYLES[t.current.type];
            for (const c of Piece.CellsOf(t.current.type, t.current.rotation))
            {
                const y = ghostY + c.y - HIDDEN_ROWS;
                if (y < 0) continue;
                const px = BOARD_X + (t.current.x + c.x) * CELL;
                const py = BOARD_Y + y * CELL;
                this.Rect(px + 1, py + 1, CELL - 2, CELL - 2, style.ghost);
            }

            for (const c of t.current.cells)
            {
                if (c.y < HIDDEN_ROWS) continue;
                this.Block(BOARD_X + c.x * CELL, BOARD_Y + (c.y - HIDDEN_ROWS) * CELL, CELL, t.current.type);
            }
        }

        // HOLD
        if (t.hold)
            this.MiniPiece(t.hold, LEFT_X, BOARD_Y + 30, PANEL_W, 110, t.holdUsed);

        // NEXT QUEUE
        t.next.forEach((type, i) => this.MiniPiece(type, RIGHT_X, BOARD_Y + 40 + i * 78, PANEL_W, 78, false, i == 0 ? 1 : 0.8));

        // DIM BOARD WHEN PAUSED / GAME OVER
        if (t.gameOver || this.isPaused)
            this.Rect(BOARD_X, BOARD_Y, BOARD_W, BOARD_H, OVERLAY);
    }

    Rect(x: number, y: number, width: number, height: number, color: Color)
    {
        bare.drawRect({ x, y, width, height, color });
    }

    Panel(x: number, y: number, w: number, h: number)
    {
        this.Rect(x - 2, y - 2, w + 4, h + 4, FRAME);
        this.Rect(x, y, w, h, PANEL);
    }

    Block(px: number, py: number, size: number, type: PieceType, dimmed: boolean = false)
    {
        const s = BLOCK_STYLES[type];
        const bevel = Math.max(2, Math.round(size * 0.12));
        if (dimmed)
        {
            this.Rect(px, py, size, size, s.dark);
            return;
        }
        this.Rect(px, py, size, size, s.dark);
        this.Rect(px, py, size - bevel, size - bevel, s.light);
        this.Rect(px + bevel, py + bevel, size - bevel * 2, size - bevel * 2, s.base);
    }

    // DRAW A PIECE CENTERED IN A BOX
    MiniPiece(type: PieceType, boxX: number, boxY: number, boxW: number, boxH: number, dimmed: boolean, scale: number = 1)
    {
        const cells = Piece.CellsOf(type);
        const size = Math.round(MINI * scale);
        const minX = Math.min(...cells.map(c => c.x)), maxX = Math.max(...cells.map(c => c.x));
        const minY = Math.min(...cells.map(c => c.y)), maxY = Math.max(...cells.map(c => c.y));
        const ox = boxX + (boxW - (maxX - minX + 1) * size) / 2;
        const oy = boxY + (boxH - (maxY - minY + 1) * size) / 2;

        for (const c of cells)
            this.Block(ox + (c.x - minX) * size, oy + (c.y - minY) * size, size, type, dimmed);
    }
}

StartBare(Game, {
    backgroundColor: BG,
    resolution: { width: WIDTH, height: HEIGHT, scale: CanvasScale.Fit, position: CanvasPosition.Center },
    // DEFAULT DEBUG KEYS (P/R/C...) CLASH WITH TETRIS CONTROLS - ONLY KEEP E FOR DEBUG DRAWING
    debugKeys: [{ e: () => bare.debug = !bare.debug }],
});
