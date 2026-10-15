import { Color, Easing, GameObject, Scene, StartBare, TextObject, TweenTo } from 'bare-engine';
import settingsDataJson from '../public/data/settingsData.json';
import { Levels } from './levels';
import { Dir, Dirs, Sokoban } from './sokoban';

const Colors = {
    background: Color.fromHex('#1d1f27'),
    floor: '#2c2f3a',
    wall: '#5a6072',
    goal: '#e0b04a',
    box: '#c47a3a',
    boxOnGoal: '#5fbf6a',
    player: '#4aa8e0',
};

const MOVE_TIME = 0.08;     // seconds for a tile-to-tile slide
const REPEAT_DELAY = 0.22;  // hold a direction this long before it repeats
const REPEAT_RATE = 0.11;

export class Game extends Scene
{
    game!: Sokoban;
    levelIndex = 0;
    isSolved = false;

    tileSize = 32;
    originX = 0;
    originY = 0;

    levelObjects: GameObject[] = [];
    boxObjects: GameObject[] = [];
    playerObject!: GameObject;
    title!: TextObject;
    status!: TextObject;
    help!: TextObject;

    heldDir: Dir | null = null;
    heldTime = 0;

    constructor()
    {
        super({ settingsData: settingsDataJson });
    }

    override OnAwake()
    {
        // DEFAULT DEBUG KEYS THAT ARE GAME CONTROLS HERE: R RESTARTS THE GAME, P PAUSES
        bare.DisableDebugKey('r');
        bare.DisableDebugKey('p');
    }

    override OnStart()
    {
        const text = { fontFamily: 'monospace', fill: '#ffffff' };
        this.title = new TextObject(this, { ...text, fontSize: 32, fontWeight: 'bold' });
        this.status = new TextObject(this, { ...text, fontSize: 20 });
        this.help = new TextObject(this, { ...text, fontSize: 16, fill: '#9aa0b0',
            text: 'Arrows/WASD move · Z undo · R restart · N/P next/prev level' });
        for (const label of [this.title, this.status, this.help])
            this.AddGameObject(label);

        this.StartLevel(this.levelIndex);
    }

    override OnUpdate(deltaTime: number)
    {
        const kb = bare.keyboard;

        if (this.isSolved)
        {
            if (kb.IsKeyPressed('space') || kb.IsKeyPressed('enter') || kb.IsAnyDirectionPressed())
                this.StartLevel((this.levelIndex + 1) % Levels.length);
            return;
        }

        if (kb.IsKeyPressed('z') || kb.IsKeyPressed('backspace'))
            this.Undo();
        else if (kb.IsKeyPressed('r'))
            this.StartLevel(this.levelIndex);
        else if (kb.IsKeyPressed('n'))
            this.StartLevel((this.levelIndex + 1) % Levels.length);
        else if (kb.IsKeyPressed('p'))
            this.StartLevel((this.levelIndex - 1 + Levels.length) % Levels.length);

        this.UpdateMovement(deltaTime);
    }

    override OnResize()
    {
        this.Layout();
        this.SnapToState();
    }

    // INPUT

    UpdateMovement(deltaTime: number)
    {
        const kb = bare.keyboard;

        const pressed = kb.IsUpPressed() ? Dirs.up : kb.IsDownPressed() ? Dirs.down
            : kb.IsLeftPressed() ? Dirs.left : kb.IsRightPressed() ? Dirs.right : null;
        if (pressed)
        {
            this.heldDir = pressed;
            this.heldTime = -REPEAT_DELAY;
            this.TryMove(pressed);
            return;
        }

        if (!this.heldDir || !this.IsDirHeld(this.heldDir))
        {
            this.heldDir = null;
            return;
        }

        this.heldTime += deltaTime;
        if (this.heldTime >= REPEAT_RATE)
        {
            this.heldTime -= REPEAT_RATE;
            this.TryMove(this.heldDir);
        }
    }

    IsDirHeld(dir: Dir): boolean
    {
        const kb = bare.keyboard;
        return dir === Dirs.up ? kb.IsUpDown() : dir === Dirs.down ? kb.IsDownDown()
            : dir === Dirs.left ? kb.IsLeftDown() : kb.IsRightDown();
    }

    TryMove(dir: Dir)
    {
        const result = this.game.Move(dir);
        if (!result.moved)
        {
            // BUMP INTO THE WALL: START NUDGED TOWARDS IT AND WOBBLE BACK
            // innerX IS IN THE OBJECT'S UNSCALED UNITS: THE 1x1 PIXEL IS SCALED UP, SO DIVIDE BY ITS SCALE
            const nudge = (dir.dx + dir.dy) * this.tileSize * 0.1 / this.playerObject.scaleX;
            bare.tween.Shake(this.playerObject, dir.dx !== 0 ? 'innerX' : 'innerY', 0.25, nudge, 6, 3);
            return;
        }

        this.SlideTo(this.playerObject, this.game.player);
        if (result.pushedBox >= 0)
        {
            const box = this.boxObjects[result.pushedBox];
            this.SlideTo(box, this.game.boxes[result.pushedBox]);
            this.ColorBox(result.pushedBox);
        }

        this.UpdateStatus();

        if (this.game.IsSolved())
            this.OnSolved();
    }

    Undo()
    {
        if (!this.game.Undo())
            return;
        this.SnapToState();
        this.UpdateStatus();
    }

    OnSolved()
    {
        this.isSolved = true;
        this.heldDir = null;
        this.status.SetText(`Solved in ${this.game.moves} moves!  Press Space for the next level`);
        this.PlaceText(this.status, 56, 0);

        for (const box of this.boxObjects)
            TweenTo(box, 0.15, { innerScaleX: 1.25, innerScaleY: 1.25, yoyo: true, repeat: 1, ease: Easing.Quadratic.Out, delay: MOVE_TIME });
    }

    // LEVEL VIEW

    StartLevel(index: number)
    {
        for (const obj of this.levelObjects)
            obj.Remove();
        this.levelObjects = [];
        this.boxObjects = [];

        this.levelIndex = index;
        this.isSolved = false;
        this.heldDir = null;
        this.game = new Sokoban(Levels[index]);

        const g = this.game;
        for (let i = 0; i < g.width * g.height; i++)
        {
            if (g.walls.has(i))
                this.AddTile(i, Colors.wall, 1);
            else if (g.floor.has(i))
                this.AddTile(i, Colors.floor, 1);
        }
        for (const goal of g.goals)
            this.AddTile(goal, Colors.goal, 0.3);

        this.boxObjects = g.boxes.map(box => this.AddTile(box, Colors.box, 0.8));
        this.boxObjects.forEach((_, i) => this.ColorBox(i));
        this.playerObject = this.AddTile(g.player, Colors.player, 0.6);

        this.title.SetText(`Level ${index + 1} / ${Levels.length}`);
        this.Layout();
        this.SnapToState();
        this.UpdateStatus();
    }

    // ADDS A CENTERED SQUARE ON A CELL. size IS A FRACTION OF THE TILE; tileSize IS STORED IN customData FOR LAYOUT
    AddTile(cell: number, color: string, size: number): GameObject
    {
        const obj = this.AddGameObject('PIXEL').SetColor(color).CenterPivot();
        obj.customData = { cell, size };
        this.levelObjects.push(obj);
        return obj;
    }

    ColorBox(i: number)
    {
        const onGoal = this.game.goals.has(this.game.boxes[i]);
        this.boxObjects[i].SetColor(onGoal ? Colors.boxOnGoal : Colors.box);
    }

    Layout()
    {
        const g = this.game;
        const top = 90, bottom = 40, margin = 20;
        this.tileSize = Math.floor(Math.min(
            (bare.width - margin * 2) / g.width,
            (bare.height - top - bottom) / g.height,
            64));
        this.originX = Math.floor((bare.width - this.tileSize * g.width) / 2);
        this.originY = Math.floor(top + (bare.height - top - bottom - this.tileSize * g.height) / 2);

        for (const obj of this.levelObjects)
        {
            const { cell, size } = obj.customData as { cell: number, size: number };
            obj.SetScale(Math.round(this.tileSize * size));
            obj.SetPosition(this.CellX(cell), this.CellY(cell));
        }

        this.PlaceText(this.title, 16, 0);
        this.PlaceText(this.status, 56, 0);
        this.PlaceText(this.help, bare.height - 10, 1);
    }

    // CENTERS TEXT HORIZONTALLY AND SHRINKS IT TO FIT NARROW SCREENS. CALL AFTER SetText, WHICH CHANGES THE WIDTH
    PlaceText(text: TextObject, y: number, pivotY: number)
    {
        text.SetScale(1);
        text.SetScale(Math.min(1, (bare.width - 20) / text.width));
        text.SetPosition(bare.width / 2, y).SetPivot(0.5, pivotY);
    }

    // MOVES EVERY OBJECT TO ITS CELL IN THE CURRENT STATE, WITHOUT ANIMATING (LOAD, UNDO, RESIZE)
    SnapToState()
    {
        const g = this.game;
        const place = (obj: GameObject, cell: number) =>
        {
            bare.tween.RemoveAllFrom(obj);
            obj.innerX = obj.innerY = 0;
            obj.innerScaleX = obj.innerScaleY = 1;
            obj.SetPosition(this.CellX(cell), this.CellY(cell));
        };

        place(this.playerObject, g.player);
        this.boxObjects.forEach((box, i) =>
        {
            place(box, g.boxes[i]);
            this.ColorBox(i);
        });
    }

    SlideTo(obj: GameObject, cell: number)
    {
        TweenTo(obj, MOVE_TIME, { x: this.CellX(cell), y: this.CellY(cell), ease: Easing.Linear.None });
    }

    CellX(cell: number): number { return this.originX + (this.game.X(cell) + 0.5) * this.tileSize; }
    CellY(cell: number): number { return this.originY + (this.game.Y(cell) + 0.5) * this.tileSize; }

    UpdateStatus()
    {
        this.status.SetText(`Moves: ${this.game.moves}   Pushes: ${this.game.pushes}`);
        this.PlaceText(this.status, 56, 0);
    }
}

StartBare(Game, { backgroundColor: Colors.background });
