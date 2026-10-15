import { CameraScaleMode, LevelData, Scene, Vec2 } from 'bare-engine';
import { Settings, SopiroPhysicsController } from 'bare-engine/sopiro';
import settingsData from '../../public/data/settingsData.json';
import { ShapeComponent } from '../components/shapeComponent';
import { BOUNDS, CHECK_TIME_LIMIT, MIN_LEVEL_TIME, STABLE_SPEED, STILL_TIME_TO_PASS } from '../physics';
import { SaveLevelPassed } from '../save';
import { Hud } from './hud';

export interface LevelInfo
{
    title: string;
    author: string;
    par: number;
    background: string;
    originalLevel: number;
}

type LevelState = 'playing' | 'checking' | 'passed' | 'failed';

export class Level extends Scene
{
    levelNumber = 1;
    info!: LevelInfo;
    hud!: Hud;

    state: LevelState = 'playing';
    clicks = 0;
    private levelTime = 0;
    private stillTime = 0;
    private checkTime = 0;

    constructor()
    {
        super({ settingsData: settingsData });
    }

    override OnAwake(payload: { level: number })
    {
        bare.AddClass(SopiroPhysicsController);
        this.levelNumber = payload.level;
    }

    override async OnStart()
    {
        this.state = 'playing';
        this.clicks = 0;
        this.levelTime = 0;
        this.stillTime = 0;
        this.checkTime = 0;

        await this.LoadLevel('level' + this.levelNumber);

        // DEV ONLY: REACH THE LEVEL FROM THE BROWSER CONSOLE
        if (isDev)
            (window as any).level = this;
            (window as any).sopiroSettings = Settings; // TEMP: PHYSICS EXPERIMENTS

        this.hud = await bare.scene.Add(Hud, { game: this });
    }

    override OnPostLoadLevel(level: LevelData)
    {
        this.info = level.customData as LevelInfo;

        bare.camera.SetScaleMode(CameraScaleMode.Contain);
        bare.camera.SetDimensionsToLevel();

        // BACKGROUNDS ARE 2X, LIKE ALL THE ART
        this.AddGameObject(this.info.background, 'background').SetScale(0.5);
    }

    get shapes(): ShapeComponent[]
    {
        return bare.component.GetAllByType(ShapeComponent);
    }

    // CALLED BY THE HUD, WHICH KNOWS WHETHER THE CLICK HIT ONE OF ITS BUTTONS
    Click()
    {
        if (this.state != 'playing' && this.state != 'checking')
            return;

        const mouse = bare.mouse.world.position;
        const body = this.sopiro.world.queryPoint(new Vec2(mouse.x, mouse.y))[0];
        const shape = body?.GetComponent(ShapeComponent);

        // GREEN AND DARK RED JUST SQUEAK IN THE ORIGINAL - AND DON'T COUNT AS A CLICK
        if (!shape || !shape.clickable)
            return;

        this.clicks++;
        this.hud.UpdateClicks();

        this.AddGameObject('pop', 'effects').SetPosition(body.x, body.y);
        bare.sound.Play('pop');
        body.Remove();
    }

    override OnFixedUpdate(dt: number)
    {
        // THE ORIGINAL KEEPS SIMULATING AFTER A FAIL, SO THE GREEN SHAPE CAN BE SEEN FALLING AWAY
        if (this.state == 'passed' || this.state == 'failed')
            return;

        if (this.state == 'playing')
            this.levelTime += dt;

        let allRemoved = true;
        let allStill = true;
        let greenLost = false;

        for (const shape of this.shapes)
        {
            if (shape.speed > STABLE_SPEED)
                allStill = false;

            if (shape.mustRemove)
                allRemoved = false;

            const { x, y } = shape.go;
            if (x < BOUNDS.left || x > BOUNDS.right || y < BOUNDS.top || y > BOUNDS.bottom)
            {
                if (shape.kind == 'save')
                    greenLost = true;

                shape.go.Remove();
            }
        }

        if (greenLost)
        {
            this.Fail();
            return;
        }

        if (this.state == 'playing' && allRemoved && allStill && this.levelTime > MIN_LEVEL_TIME)
        {
            this.state = 'checking';
            this.hud.ShowChecking(true);
        }

        if (this.state == 'checking')
        {
            if (allStill)
                this.stillTime += dt;

            this.checkTime += dt;
            this.hud.SetCheckProgress(this.checkTime / CHECK_TIME_LIMIT);

            if (this.stillTime > STILL_TIME_TO_PASS || this.checkTime > CHECK_TIME_LIMIT)
                this.Pass();
        }
    }

    private Pass()
    {
        this.state = 'passed';

        for (const shape of this.shapes)
            shape.Cheer();

        // THE ORIGINAL STOPS STEPPING THE WORLD ONCE A LEVEL IS PASSED
        this.paused = true;

        SaveLevelPassed(this.levelNumber, this.clicks);
        bare.sound.Play('pass');
        this.hud.ShowPassed();
    }

    private Fail()
    {
        this.state = 'failed';
        bare.sound.Play('fail');
        this.hud.ShowFailed();
    }
}
