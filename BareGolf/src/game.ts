import { CameraScaleMode, Color, SaveData, Scene, StartBare, TextureFilterMode } from 'bare-engine';
import { ArcadePhysicsController } from 'bare-engine/arcade';
import settingsDataJson from '../public/data/settingsData.json';
import { BallComponent } from './components/ballComponent';
import { Asset } from './generated/assets';
import { Hud } from './hud';
import './golfEvents';

const HOLES = [
    Asset.Level.HOLE1,
    Asset.Level.HOLE2,
    Asset.Level.HOLE3,
    Asset.Level.HOLE4,
    Asset.Level.HOLE5,
    Asset.Level.HOLE6,
];

// the area shown around the ball while it rolls
const VIEW_WIDTH = 576;
const VIEW_HEIGHT = 400;

declare module 'bare-engine'
{
    namespace SaveData
    {
        let bestStrokes: Record<string, number>;
    }
}

export class Game extends Scene
{
    hud!: Hud;
    ball: BallComponent | null = null;

    holeIndex = 0;
    par = 3;
    strokes = 0;
    holeDone = false;
    courseDone = false;
    // strokes and par of every finished hole this round
    card: { strokes: number, par: number }[] = [];

    // camera zoom on top of the VIEW fit: 1 follows the ball, lower shows more of the course
    zoom = 1;

    constructor()
    {
        super({ settingsData: settingsDataJson });
    }

    override async OnAwake()
    {
        bare.AddClass(ArcadePhysicsController);

        // R retries the hole instead of restarting the game
        bare.SetDebugKey('r', null);

        bare.storage.SetDefaults({ bestStrokes: {} });
        bare.storage.Load();

        // persistent, so loading the next level doesn't drop them
        bare.events.persistent.on('ballShot', () => this.AddStroke());
        bare.events.persistent.on('ballInWater', () =>
        {
            this.AddStroke();
            this.hud.Flash('Splash! +1 stroke');
        });
        bare.events.persistent.on('ballSunk', () => this.FinishHole());

        this.hud = await bare.scene.Add(Hud);
    }

    override async OnStart()
    {
        await this.LoadLevel(HOLES[this.holeIndex]);
    }

    override OnPostLoadLevel()
    {
        this.ball = bare.component.GetAllByType(BallComponent)[0] ?? null;
        // set per level in its customData, editable in the extension's level inspector
        this.par = bare.level.currentLevel?.customData?.par ?? 3;
        this.strokes = 0;
        this.holeDone = false;

        bare.camera.SetScaleMode(CameraScaleMode.Contain);
        bare.camera.SetDimensions(VIEW_WIDTH, VIEW_HEIGHT);
        this.zoom = 1;
        bare.camera.SetZoom(this.zoom);
        if (this.ball)
            bare.camera.SetPosition(this.ball.go.x, this.ball.go.y).Follow(this.ball.go, 6);

        this.hud.ShowHole(this.holeIndex + 1, HOLES.length, this.par, SaveData.bestStrokes[HOLES[this.holeIndex]]);
        this.hud.ShowStrokes(this.strokes);
    }

    override OnUpdate(deltaTime: number)
    {
        if (this.holeDone)
        {
            if (bare.mouse.IsPressed() || bare.keyboard.IsKeyPressed('space') || bare.keyboard.IsKeyPressed('enter'))
                this.NextHole();
        }
        else if (bare.keyboard.IsKeyPressed('r'))
        {
            this.LoadLevel(HOLES[this.holeIndex]);
            return;
        }

        this.UpdateCamera(deltaTime);
    }

    // zoom out while aiming to see the course, follow the ball while it rolls
    private UpdateCamera(deltaTime: number)
    {
        const ball = this.ball;
        if (!ball)
            return;

        const targetZoom = ball.aiming ? this.GetOverviewZoom() : 1;
        this.zoom = bare.util.Lerp(this.zoom, targetZoom, 1 - Math.exp(-5 * deltaTime));
        bare.camera.SetZoom(this.zoom);
    }

    // the zoom that shows the whole level, but never closer than the follow view
    private GetOverviewZoom(): number
    {
        const level = bare.level.currentLevel?.dimensions;
        if (!level)
            return 1;

        return Math.min(1, bare.camera.GetZoomToFit(level.width, level.height));
    }

    private AddStroke()
    {
        this.strokes++;
        this.hud.ShowStrokes(this.strokes);
    }

    private FinishHole()
    {
        this.holeDone = true;
        this.card[this.holeIndex] = { strokes: this.strokes, par: this.par };

        const levelName = HOLES[this.holeIndex];
        const best = SaveData.bestStrokes[levelName];
        if (!best || this.strokes < best)
        {
            SaveData.bestStrokes[levelName] = this.strokes;
            bare.storage.Save();
        }

        const stars = Hud.Stars(Hud.StarCount(this.strokes, this.par));
        const strokesLine = `${this.strokes} ${this.strokes == 1 ? 'stroke' : 'strokes'}, par ${this.par}`;
        const newBest = (best && this.strokes < best) ? '\nNew best!' : '';

        this.hud.ShowResult(Game.ScoreName(this.strokes, this.par), `${stars}\n${strokesLine}${newBest}\n\nClick to continue`);
    }

    private NextHole()
    {
        if (this.courseDone)
        {
            this.courseDone = false;
            this.card = [];
            this.holeIndex = 0;
            this.LoadLevel(HOLES[this.holeIndex]);
            return;
        }

        if (this.holeIndex < HOLES.length - 1)
        {
            this.holeIndex++;
            this.LoadLevel(HOLES[this.holeIndex]);
            return;
        }

        // last hole: show the score card, and play again on the next click
        this.courseDone = true;
        const total = this.card.reduce((sum, hole) => sum + hole.strokes, 0);
        const totalPar = this.card.reduce((sum, hole) => sum + hole.par, 0);
        const diff = total - totalPar;
        const toPar = diff == 0 ? 'even par' : diff > 0 ? `${diff} over par` : `${-diff} under par`;
        const card = this.card.map((hole, i) => `${i + 1}: ${hole.strokes}`).join('  ');

        this.hud.ShowResult('Course complete!', `${card}\nTotal ${total} (${toPar})\n\nClick to play again`);
    }

    static ScoreName(strokes: number, par: number): string
    {
        if (strokes == 1)
            return 'Hole in one!';

        const names: Record<string, string> = { '-3': 'Albatross!', '-2': 'Eagle!', '-1': 'Birdie!', '0': 'Par', '1': 'Bogey', '2': 'Double bogey' };
        const diff = strokes - par;

        return names[diff] ?? `+${diff}`;
    }
}

StartBare(Game, {
    textureFilter: TextureFilterMode.NEAREST,
    backgroundColor: Color.fromHex('#1f3a24'),
    // bottom left, clear of the HUD
    editorButtonPosition: { x: 0, y: 1 },
});
