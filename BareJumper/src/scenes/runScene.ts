import { Color, Easing, GameObject, LevelData, Scene, TweenTo } from 'bare-engine';
import { ArcadePhysicsController } from 'bare-engine/arcade';
import settingsDataJson from '../../public/data/settingsData.json';
import { OrbComponent } from '../components/orbComponent';
import { RunnerComponent, RunnerState } from '../components/runnerComponent';
import { Asset } from '../generated/assets';
import { Ghost } from '../ghost';
import { Hud } from '../hud';
import { FormatTime, GetRecord, InitProgress, LEVELS, SubmitRun } from '../progress';
import { MenuScene } from './menuScene';
import { SaveData } from 'bare-engine';

export interface RunPayload
{
    level: string;
}

export class RunScene extends Scene
{
    hud!: Hud;
    levelName = LEVELS[0];

    runner?: RunnerComponent;
    private ghost?: Ghost;
    private stars?: GameObject;
    private time = 0;
    private orbs = 0;
    private orbsTotal = 0;
    private baseZoom = 1;

    constructor()
    {
        super({ settingsData: settingsDataJson });
    }

    override async OnAwake(payload?: RunPayload)
    {
        bare.AddClass(ArcadePhysicsController);
        InitProgress();

        // LETS BROWSER TESTS DRIVE THE GAME, SEE tools/checkLevels.cjs
        if (isDev)
            (globalThis as any).flipside = this;
        this.levelName = payload?.level ?? LEVELS[0];
        this.hud = await bare.scene.Add(Hud);

        bare.events.persistent.on('playerDied', () => this.OnDied());
        bare.events.persistent.on('levelComplete', () => this.OnComplete());
        bare.events.persistent.on('playerFlipped', ({ direction }) => this.OnFlipped(direction));
        bare.events.persistent.on('orbCollected', () =>
        {
            this.orbs++;
            this.hud.SetOrbs(this.orbs, this.orbsTotal);
        });
    }

    override async OnStart()
    {
        await this.LoadLevel(this.levelName);
    }

    override OnPostLoadLevel(level: LevelData)
    {
        this.runner = bare.component.GetAllByType(RunnerComponent)[0];
        this.orbsTotal = bare.component.GetAllByType(OrbComponent).length;
        this.orbs = 0;
        this.time = 0;

        const record = GetRecord(level.name);
        this.ghost = record?.ghost.length ? new Ghost(this, record.ghost) : undefined;

        this.hud.ShowLevel(level.customData?.title ?? level.name, level.customData?.index ?? 1, record?.bestTime);
        this.hud.SetOrbs(0, this.orbsTotal);

        this.AddStars(level);
        // THE COVER SCALE MODE ZOOMS IN UNTIL THE LEVEL'S HEIGHT FILLS THE SCREEN. START FROM THAT ZOOM, SO TWEENS ON IT DON'T JUMP
        bare.camera.SetZoom(1);
        this.baseZoom = bare.camera.GetZoom();
        bare.camera.SetZoom(this.baseZoom);
        this.FollowPlayer(1);
    }

    // A PARALLAX STARFIELD BEHIND THE LEVEL, ON A LAYER THAT ISN'T SAVED
    private AddStars(level: LevelData)
    {
        this.stars = this.AddGameObject(undefined, 'background');
        const width = bare.width * 2 + level.dimensions.width * 0.3;
        for (let i = 0; i < 160; i++)
        {
            const depth = Math.random();
            this.stars.AddChild('/star')
                .SetPosition(Math.random() * width, Math.random() * level.dimensions.height)
                .SetScale(0.5 + depth)
                .alpha = 0.2 + depth * 0.5;
        }
    }

    override OnUpdate(deltaTime: number)
    {
        if (bare.keyboard.IsKeyPressed('escape'))
            bare.scene.Goto(MenuScene);

        if (this.runner?.state == RunnerState.Running)
            this.hud.HidePrompt();

        this.FollowPlayer(1 - Math.exp(-10 * deltaTime));
    }

    private FollowPlayer(t: number)
    {
        if (!this.runner)
            return;

        const level = bare.level.currentLevel;
        const camera = bare.camera.GetPosition();
        // KEEP THE PLAYER LEFT OF CENTER, SO MORE OF WHAT'S COMING IS ON SCREEN
        const targetX = this.runner.go.x + bare.width * 0.22;
        bare.camera.SetPosition(bare.util.Lerp(camera.x, targetX, t), (level?.dimensions.height ?? bare.height) / 2);

        if (this.stars)
            this.stars.x = (bare.camera.GetPosition().x - bare.width / 2) * 0.7;
    }

    override OnFixedUpdate(dt: number)
    {
        if (this.runner?.state != RunnerState.Running)
            return;

        this.time += dt;
        this.hud.SetTime(this.time);
        this.ghost?.Advance();
    }

    private OnFlipped(direction: number)
    {
        this.hud.Flash(direction > 0 ? Color.fromHex('#3ee0ff') : Color.fromHex('#ff7ad9'), 0.12);
        bare.camera.StartShake({ x: 0, y: 4 }, 0.12);
        bare.sound.PlayWithRandomRate(Asset.Sound.FLIP, 0.08, { volume: 0.6 });
    }

    private async OnDied()
    {
        const go = this.runner!.go;
        const burst = bare.particle.CreateEmitter({
            texture: 'spark',
            life: [0.4, 0.8],
            emitRate: 40,
            emitShape: 'CIRCLE',
            emitRadius: 6,
            origin: { x: 0.5, y: 0.5 },
            animation: {
                scale: { start: [1.5, 2.5], end: 0.1 },
                color: { start: '#ffffff', end: '#ff4d6d00' },
                speed: { start: [300, 700], damping: 0.9 },
            },
        });
        bare.particle.OneShot(burst, { position: go.position });
        bare.camera.StartShake(14, 0.35);
        bare.sound.Play(Asset.Sound.DEATH);
        this.hud.Flash(Color.fromHex('#ff4d6d'), 0.3);

        SaveData.deaths++;
        bare.storage.Save();

        if (!await this.Wait(0.7))
            return;
        await bare.level.Restart();
    }

    private async OnComplete()
    {
        const level = bare.level.currentLevel!.name;
        const isBest = SubmitRun(level, this.time, this.orbs, this.orbsTotal, this.runner!.ghost);

        bare.sound.Play(Asset.Sound.CLEAR);
        TweenTo(bare.camera, 0.6, { zoom: this.baseZoom * 1.25, ease: Easing.Quadratic.InOut });
        const orbs = this.orbsTotal ? `  -  orbs ${this.orbs}/${this.orbsTotal}` : '';
        this.hud.ShowBanner('CLEAR!', `${FormatTime(this.time)}${isBest ? '  NEW BEST' : ''}${orbs}`);

        if (!await this.Wait(2.2))
            return;

        const next = LEVELS[LEVELS.indexOf(level) + 1];
        if (next)
        {
            this.levelName = next;
            await this.LoadLevel(next);
        }
        else
            await bare.scene.Goto(MenuScene, { finished: true });
    }
}
