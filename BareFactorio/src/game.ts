import { CameraScaleMode, Color, SaveData, Scene, StartBare, TextureFilterMode, type GameObject } from 'bare-engine';
import settingsDataJson from '../public/data/settingsData.json';
import { WorkerViewComponent, type TickClock } from './components/workerViewComponent';
import { Controls } from './controls';
import { Data } from './generated/assets';
import { Hud, type HudPayload } from './hud';
import { GroundRenderer } from './render/groundRenderer';
import { WorldRenderer, type TileView } from './render/worldRenderer';
import { Colony } from './sim/colony';
import { ParseBuildingDefs, TICKS_PER_SECOND, type BuildingDef } from './sim/defs';
import { CheckGoals } from './sim/goals';
import { LoadColony, SaveColony } from './sim/save';
import { StressTest } from './sim/stress';
import { TILE } from './sim/world';

declare module 'bare-engine'
{
    namespace SaveData
    {
        let colonySave: string;
    }
}

// ?size=512 for a bigger world, ?seed=7 for a fixed one, ?new to ignore the save,
// ?stress to start with the stress test, ?test to keep running without focus (headless browsers)
const params = new URLSearchParams(location.search);
const WORLD_SIZE = Math.max(64, Math.min(2048, parseInt(params.get('size') ?? '256') || 256));
const AUTOSAVE_SECONDS = 120;

export class Game extends Scene implements TickClock
{
    colony!: Colony;
    defs: BuildingDef[] = [];
    ground!: GroundRenderer;
    worldRenderer!: WorldRenderer;
    controls = new Controls(this);
    hud: Hud | null = null;

    // how far we are between the last sim tick and the next, 0..1, to draw moving things smoothly
    get renderAlpha() { return bare.fixedAlpha; }
    speed = 1;
    private pausedSpeed = 1;

    private views = new Map<number, GameObject>();
    private view: TileView = { x0: 0, y0: 0, x1: 0, y1: 0 };
    private autosaveTimer = AUTOSAVE_SECONDS;
    private busy = false;

    private statsTimer = 0;
    private statsText = '';
    private frames = 0;
    private lastSample = { ticks: 0, tickMs: 0, pathCalls: 0, pathMs: 0, pathFails: 0, pathExpanded: 0, areasMs: 0, synced: 0 };

    constructor()
    {
        super({ settingsData: settingsDataJson });
    }

    override OnAwake()
    {
        // right-drag pans, so keep the engine's dev right-click select off it
        bare.DisableRightClick();
        this.defs = ParseBuildingDefs(this.settings.prefabs ?? []);
    }

    override async OnStart()
    {
        let colony: Colony | null = null;
        if (SaveData.colonySave && !params.has('new'))
        {
            try
            {
                colony = await LoadColony(SaveData.colonySave, this.defs);
            }
            catch (error)
            {
                console.warn('Could not load the save, starting fresh', error);
            }
        }
        colony ??= Colony.NewGame(this.defs, WORLD_SIZE, WORLD_SIZE, this.NewSeed());

        this.ground = new GroundRenderer(this, colony.world);
        this.worldRenderer = new WorldRenderer(colony);
        this.SetColony(colony);

        this.hud = await bare.scene.Add(Hud, { game: this } satisfies HudPayload);

        if (params.has('stress'))
            this.StressTest();
    }

    override OnClear()
    {
        this.ground?.Destroy();
    }

    private NewSeed(): number
    {
        return params.has('seed') ? parseInt(params.get('seed')!) : Math.floor(Math.random() * 1e9);
    }

    private SetColony(colony: Colony)
    {
        this.colony = colony;
        colony.onMessage = text => this.hud?.Toast(text);
        this.ground.SetWorld(colony.world);
        this.worldRenderer.SetColony(colony);

        for (const view of this.views.values())
            view.Remove();
        this.views.clear();
        this.controls.Deselect();

        const world = colony.world;
        const hq = colony.hq;
        bare.camera
            .SetScaleMode(CameraScaleMode.None)
            .SetBounds({ x: 0, y: 0, width: world.w * TILE, height: world.h * TILE })
            .SetZoom(3)
            .SetPosition((hq.x + 1) * TILE, (hq.y + 1) * TILE);
    }

    // ---- the fixed-tick simulation ----

    override OnFixedUpdate()
    {
        this.colony.Tick();

        if (this.colony.tick % TICKS_PER_SECOND === 0)
        {
            const done = CheckGoals(this.colony);
            if (done)
                this.hud?.Toast(`Goal complete: ${done.text.split(' (')[0]}`);
        }
    }

    override OnUpdate()
    {
        this.controls.Update();
        this.SyncWorkerViews();

        // draw colonists further down the screen on top
        bare.object.GetLayer(Data.Layer.OBJECTS).sort((a, b) => a.y - b.y);

        this.autosaveTimer -= bare.unscaledDeltaTime;
        if (this.autosaveTimer <= 0)
        {
            this.autosaveTimer = AUTOSAVE_SECONDS;
            this.Save(true);
        }

        this.frames++;
        this.statsTimer -= bare.unscaledDeltaTime;
        if (this.statsTimer <= 0)
            this.SampleStats(1 - this.statsTimer);
    }

    private SyncWorkerViews()
    {
        const workers = this.colony.workers;
        if (this.views.size !== workers.length || workers.some(w => !this.views.has(w.id)))
        {
            const alive = new Set(workers.map(w => w.id));
            for (const [id, view] of this.views)
            {
                if (!alive.has(id))
                {
                    view.Remove();
                    this.views.delete(id);
                }
            }
            for (const worker of workers)
            {
                if (this.views.has(worker.id))
                    continue;
                const view = this.AddGameObject(Data.Prefab.WORKER);
                view.GetComponent(WorkerViewComponent)!.Bind(worker, this);
                this.views.set(worker.id, view);
            }
        }
    }

    // ---- drawing ----

    override OnPreRender()
    {
        const topLeft = this.ScreenToWorld(0, 0);
        const bottomRight = this.ScreenToWorld(bare.width, bare.height);
        this.view.x0 = Math.floor(topLeft.x / TILE) - 1;
        this.view.y0 = Math.floor(topLeft.y / TILE) - 1;
        this.view.x1 = Math.ceil(bottomRight.x / TILE) + 1;
        this.view.y1 = Math.ceil(bottomRight.y / TILE) + 1;

        this.ground.Draw();
        this.worldRenderer.DrawWorld(this.view, this.renderAlpha);
    }

    override OnRender()
    {
        this.worldRenderer.DrawOverlay(this.view);
        this.controls.DrawOverlay();
    }

    // ---- commands from the HUD ----

    SetSpeed(speed: number)
    {
        if (speed > 0)
            this.pausedSpeed = speed;
        this.speed = speed;
        bare.timeScale = speed;
    }

    TogglePause()
    {
        this.SetSpeed(this.speed === 0 ? this.pausedSpeed : 0);
    }

    async Save(auto = false)
    {
        if (this.busy)
            return;
        this.busy = true;
        try
        {
            const result = await SaveColony(this.colony);
            SaveData.colonySave = result.data;
            const start = performance.now();
            bare.storage.Save();
            const writeMs = performance.now() - start;
            const kb = (n: number) => (n / 1024).toFixed(0);
            this.hud?.Toast(`${auto ? 'Autosaved' : 'Saved'}: ${kb(result.data.length)} KB (${kb(result.rawBytes)} KB raw), ${(result.ms + writeMs).toFixed(0)} ms`);
        }
        catch (error)
        {
            console.error(error);
            this.hud?.Toast('Saving failed: ' + (error instanceof Error ? error.message : error));
        }
        finally
        {
            this.busy = false;
        }
    }

    async Load()
    {
        if (this.busy)
            return;
        if (!SaveData.colonySave)
        {
            this.hud?.Toast('No save yet');
            return;
        }
        this.busy = true;
        try
        {
            const start = performance.now();
            this.SetColony(await LoadColony(SaveData.colonySave, this.defs));
            this.hud?.Toast(`Loaded in ${(performance.now() - start).toFixed(0)} ms`);
        }
        catch (error)
        {
            console.error(error);
            this.hud?.Toast('Loading failed: ' + (error instanceof Error ? error.message : error));
        }
        finally
        {
            this.busy = false;
        }
    }

    NewGame()
    {
        this.SetColony(Colony.NewGame(this.defs, WORLD_SIZE, WORLD_SIZE, Math.floor(Math.random() * 1e9)));
        this.hud?.Toast('A new colony begins');
    }

    StressTest()
    {
        const start = performance.now();
        const report = StressTest(this.colony);
        this.hud?.Toast(`Stress: ${report.belts} belts, ${report.items} items, +${report.workers} colonists, ${report.designated} trees (${(performance.now() - start).toFixed(0)} ms)`);
        bare.camera.SetZoom(1);
    }

    // ---- numbers for the HUD ----

    private SampleStats(seconds: number)
    {
        this.statsTimer = 1;
        const c = this.colony;
        const path = c.pathfinder.stats;
        const flow = c.flow.stats;
        const areas = c.pathfinder.areas.stats;
        const ground = this.ground.stats;
        const last = this.lastSample;

        const ticks = c.stats.ticks - last.ticks;
        const tickMs = ticks ? (c.stats.tickMs - last.tickMs) / ticks : 0;
        const pathCalls = path.calls - last.pathCalls;
        const lines = [
            `fps ${(this.frames / seconds).toFixed(0)}   draws ${rapid.drawcallCount}`,
            `sim ${(ticks / seconds).toFixed(1)} tps   ${tickMs.toFixed(2)} ms/tick`,
            `A* ${pathCalls}/s  ${(path.ms - last.pathMs).toFixed(1)} ms/s  fail ${path.failures - last.pathFails}`,
            `   avg ${pathCalls ? ((path.expanded - last.pathExpanded) / pathCalls).toFixed(0) : 0} nodes, areas ${(areas.ms - last.areasMs).toFixed(1)} ms/s`,
            `flow ${flow.rebuilds} builds, last ${flow.lastMs.toFixed(1)} ms/${flow.ticksForLast} ticks`,
            `ground ${ground.synced - last.synced} chunks synced/s`,
            `belts ${c.belts.length}  items ${c.itemsOnBelts}`,
            `world ${c.world.w}x${c.world.h}  colonists ${c.workers.length}`,
            `buildings ${c.buildings.size}  on screen ${this.worldRenderer.stats.buildings}`,
        ];
        this.statsText = lines.join('\n');
        this.frames = 0;
        this.lastSample = {
            ticks: c.stats.ticks, tickMs: c.stats.tickMs, pathCalls: path.calls, pathMs: path.ms, pathFails: path.failures,
            pathExpanded: path.expanded, areasMs: areas.ms, synced: ground.synced,
        };
    }

    StatsText(): string
    {
        return this.statsText || 'measuring...';
    }
}

StartBare(Game, {
    backgroundColor: new Color(36, 52, 40, 255),
    textureFilter: TextureFilterMode.NEAREST,
    fixedTimestep: 1 / TICKS_PER_SECOND,
    freezeOnUnfocus: !params.has('test'),
    OnInit: () => {
        bare.storage.SetDefaults({ colonySave: '' });
        bare.storage.Load();
    },
});
