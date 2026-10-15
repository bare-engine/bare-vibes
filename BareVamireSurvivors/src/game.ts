import { Color, GameObject, ParticleEmitter, Scene, StartBare, Vec2 } from 'bare-engine';
import { ArcadeObject } from 'bare-engine/arcade';
import settingsDataJson from '../public/data/settingsData.json';
import { PlayerComponent } from './components/playerComponent';
import { Asset, Data } from './generated/assets';
import { Hud } from './hud';
import { Enemy } from './objects/enemy';
import { Pickup } from './objects/pickup';
import { Projectile } from './objects/projectile';
import { Benchmark } from './systems/benchmark';
import { Combat, type CollisionMode } from './systems/combat';
import { perf } from './systems/perfMonitor';
import { SpatialGrid } from './systems/spatialGrid';
import { Spawner } from './systems/spawner';
import { RollUpgrades } from './upgrades';
import { PlayerStats } from './weapons/weapon';

export type GamePayload = {
    mode?: CollisionMode;
};

const MAX_PICKUPS = 1200;
const DECOR = { [Data.Prefab.FLOWER]: 700, [Data.Prefab.ROCK]: 260, [Data.Prefab.TREE]: 220 };

const hpBack = Color.fromHex('#000000a0');
const hpFill = Color.fromHex('#ff3b5c');

export class Game extends Scene
{
    player!: ArcadeObject;
    playerComp!: PlayerComponent;
    playerRadius = 14;
    hud: Hud | null = null;

    // Live lists, kept by the objects themselves (OnAdded / OnRemoved), with swap-removal
    readonly enemies: Enemy[] = [];
    readonly projectiles: Projectile[] = [];
    readonly pickups: Pickup[] = [];

    arena = { width: 6000, height: 6000 };
    grid!: SpatialGrid<Enemy>;
    readonly combat = new Combat(this);
    readonly spawner = new Spawner(this);
    readonly bench = new Benchmark(this);
    readonly playerStats = new PlayerStats();

    gameTime = 0;
    kills = 0;
    godMode = false;
    weaponsEnabled = true;
    autopilot = false;
    enemySpeedMultiplier = 1;
    isOver = false;
    decorShown = true;

    private decor: GameObject[] = [];
    private deathFx!: ParticleEmitter;
    private pendingLevelUps = 0;
    private queryResult: Enemy[] = [];

    constructor()
    {
        super({ settingsData: settingsDataJson });
    }

    override OnAwake()
    {
        // L reloads the level, which would remove the player
        bare.DisableDebugKey('l');

        // Auto-registered classes get a pool of 1, so fill the pools up front instead of
        // creating objects one by one mid-game
        bare.RegisterGameObjectPool(Enemy, 1000);
        bare.RegisterGameObjectPool(Projectile, 200);
        bare.RegisterGameObjectPool(Pickup, 500);
    }

    override async OnStart(payload?: GamePayload)
    {
        await this.LoadLevel(Asset.Level.ARENA);

        const dimensions = this.currentLevel!.dimensions;
        this.arena = { width: dimensions.width, height: dimensions.height };
        this.grid = new SpatialGrid<Enemy>(this.arena.width, this.arena.height, 64);

        const ground = this.AddGameObject(Data.Prefab.GROUND, Data.Layer.GROUND);
        ground.SetScaleXY(this.arena.width / ground.texture!.width, this.arena.height / ground.texture!.height);
        this.AddDecor();

        this.player = this.AddGameObject<ArcadeObject>(Data.Prefab.PLAYER, Data.Layer.PLAYER)
            .SetPosition(this.arena.width / 2, this.arena.height / 2);
        this.playerComp = this.player.GetComponent(PlayerComponent)!;
        this.playerRadius = this.player.physicsHitbox.GetRadius();

        const presets = this.settingsData.presets as Record<string, { particle: object }>;
        this.deathFx = bare.particle.CreateEmitter(presets.DEATH_BURST.particle);
        bare.particle.Add(this.deathFx);

        this.combat.SetMode(payload?.mode ?? 'arcade');
        perf.WatchPhysics(this.arcade);

        this.hud = await bare.scene.Add(Hud, { game: this });

        // For poking at the game from the browser console, also in production builds for benchmarking
        Object.assign(window, { game: this, perf });
    }

    override OnFixedUpdate(dt: number)
    {
        this.gameTime += dt;

        // After the engine's physics step: index the enemies for weapons and grid collisions
        this.grid.Build(this.enemies);
        this.combat.FixedUpdate();
        this.spawner.FixedUpdate(dt);
    }

    override OnUpdate()
    {
        const keyboard = bare.keyboard;
        if (this.hud?.lastModalCloseFrame === bare.count)
            return;

        if (keyboard.IsKeyPressed('m'))
        {
            this.combat.SetMode(this.combat.mode === 'arcade' ? 'grid' : 'arcade');
            this.hud?.Announce(`Collisions: ${this.combat.mode}`);
        }
        if (keyboard.IsKeyPressed('1')) this.spawner.SpawnBurst(100);
        if (keyboard.IsKeyPressed('2')) this.spawner.SpawnBurst(500);
        if (keyboard.IsKeyPressed('3')) this.spawner.SpawnBurst(2000);
        if (keyboard.IsKeyPressed('k')) this.ClearEnemies();
        if (keyboard.IsKeyPressed('g'))
        {
            this.godMode = !this.godMode;
            this.hud?.Announce(`God mode ${this.godMode ? 'on' : 'off'}`);
        }
        if (keyboard.IsKeyPressed('u')) this.playerComp.AddXp(this.playerComp.xpToNext - this.playerComp.xp);
        if (keyboard.IsKeyPressed('f'))
        {
            this.spawner.enabled = !this.spawner.enabled;
            this.hud?.Announce(`Spawner ${this.spawner.enabled ? 'on' : 'off'}`);
        }
        if (keyboard.IsKeyPressed('v'))
        {
            this.ToggleDecor();
            this.hud?.Announce(`Decor ${this.decorShown ? 'on' : 'off'}`);
        }
        if (keyboard.IsKeyPressed('b')) this.RunBenchmark();
    }

    // Above the objects, in world space: the player's health bar
    override OnRender()
    {
        const width = 40;
        const x = this.player.x - width / 2;
        const y = this.player.y + 32;
        const ratio = Math.max(0, this.playerComp.hp / this.playerStats.maxHp);

        rapid.drawRect({ position: new Vec2(x, y), width, height: 5, color: hpBack });
        rapid.drawRect({ position: new Vec2(x, y), width: width * ratio, height: 5, color: hpFill });
    }

    override OnClear()
    {
        if (this.deathFx)
            bare.particle.Remove(this.deathFx);
    }

    // --- registries, called by the objects themselves ---

    RegisterEnemy(enemy: Enemy) { enemy.listIndex = this.enemies.push(enemy) - 1; }
    UnregisterEnemy(enemy: Enemy) { SwapRemove(this.enemies, enemy); }
    RegisterProjectile(projectile: Projectile) { projectile.listIndex = this.projectiles.push(projectile) - 1; }
    UnregisterProjectile(projectile: Projectile) { SwapRemove(this.projectiles, projectile); }
    RegisterPickup(pickup: Pickup) { pickup.listIndex = this.pickups.push(pickup) - 1; }
    UnregisterPickup(pickup: Pickup) { SwapRemove(this.pickups, pickup); }

    // --- combat ---

    // Enemies whose hitbox overlaps the circle. The array is reused, copy it to keep it.
    QueryEnemies(x: number, y: number, radius: number): Enemy[]
    {
        const result = this.queryResult;
        result.length = 0;
        this.grid.Query(x, y, radius + 34, enemy => {
            const dx = enemy.x - x;
            const dy = enemy.y - y;
            const r = radius + enemy.radius;
            if (dx * dx + dy * dy < r * r && enemy.hp > 0)
                result.push(enemy);
        });
        return result;
    }

    DamageEnemy(enemy: Enemy, damage: number, knockX: number, knockY: number)
    {
        if (enemy.Hit(damage * this.playerStats.damage, knockX, knockY))
            this.Kill(enemy);
    }

    private Kill(enemy: Enemy)
    {
        this.kills++;
        bare.particle.OneShot(this.deathFx, { position: enemy.position });

        if (enemy.boss)
        {
            this.Drop(Data.Prefab.HEART, enemy.x - 20, enemy.y);
            this.Drop(Data.Prefab.GEM_RED, enemy.x + 20, enemy.y, enemy.xp);
            this.camera.StartShake(10, 0.4);
        }
        else if (Math.random() < 0.004)
            this.Drop(Data.Prefab.HEART, enemy.x, enemy.y);
        else
            this.DropXp(enemy.x, enemy.y, enemy.xp);

        enemy.Remove();
    }

    private DropXp(x: number, y: number, value: number)
    {
        // Too many gems on the ground: add the value to an existing one instead
        if (this.pickups.length >= MAX_PICKUPS)
        {
            this.pickups[Math.floor(Math.random() * this.pickups.length)].value += value;
            return;
        }

        const prefab = value >= 25 ? Data.Prefab.GEM_RED : value >= 5 ? Data.Prefab.GEM_GREEN : Data.Prefab.GEM_BLUE;
        this.Drop(prefab, x, y, value);
    }

    private Drop(prefab: string, x: number, y: number, value?: number)
    {
        const pickup = this.AddGameObject<Pickup>(prefab, Data.Layer.PICKUPS).SetPosition(x, y);
        if (value !== undefined)
            pickup.value = value;
    }

    Collect(pickup: Pickup)
    {
        if (pickup.heal > 0)
            this.playerComp.Heal(pickup.heal);
        // No level-up menus interrupting god mode testing; U still levels up by hand
        if (pickup.value > 0 && !this.godMode)
            this.playerComp.AddXp(pickup.value);
    }

    ClearEnemies()
    {
        for (let i = this.enemies.length - 1; i >= 0; i--)
            this.enemies[i].Remove();
    }

    // --- progression ---

    QueueLevelUp()
    {
        this.pendingLevelUps++;
        if (this.pendingLevelUps === 1)
            this.ShowLevelUp();
    }

    private ShowLevelUp()
    {
        if (!this.hud)
            return;

        this.paused = true;
        this.hud.ShowLevelUp(this.playerComp.level - this.pendingLevelUps + 1, RollUpgrades(this), upgrade => {
            upgrade.Apply();
            this.pendingLevelUps--;
            if (this.pendingLevelUps > 0)
                this.ShowLevelUp();
            else
                this.paused = false;
        });
    }

    GameOver()
    {
        if (this.isOver)
            return;

        this.isOver = true;
        this.paused = true;
        const minutes = Math.floor(this.gameTime / 60);
        const seconds = String(Math.floor(this.gameTime % 60)).padStart(2, '0');
        this.hud?.ShowGameOver(
            `You survived ${minutes}:${seconds}\nlevel ${this.playerComp.level}, ${this.kills} kills`,
            () => bare.scene.Goto(Game, { mode: this.combat.mode }),
        );
    }

    async RunBenchmark()
    {
        if (this.bench.running)
            return;

        await this.bench.Run();
        this.hud?.ShowBenchmarkTable(Hud.FormatBenchmark(this.bench.results));
    }

    // --- camera helpers ---

    // The world rectangle the camera shows, grown by margin on every side
    GetViewRect(margin = 0): { x: number; y: number; width: number; height: number }
    {
        const scale = this.camera.GetScale();
        const center = this.camera.GetPosition();
        const width = bare.width / scale + margin * 2;
        const height = bare.height / scale + margin * 2;
        return { x: center.x - width / 2, y: center.y - height / 2, width, height };
    }

    // --- scenery ---

    private AddDecor()
    {
        const { width, height } = this.arena;
        const centerX = width / 2;
        const centerY = height / 2;

        for (const [prefab, count] of Object.entries(DECOR))
        {
            for (let i = 0; i < count; i++)
            {
                const x = 40 + Math.random() * (width - 80);
                const y = 40 + Math.random() * (height - 80);
                if (Math.hypot(x - centerX, y - centerY) < 150)
                    continue;

                const obj = this.AddGameObject(prefab, Data.Layer.DECOR).SetPosition(x, y);
                obj.flipped = Math.random() < 0.5;
                this.decor.push(obj);
            }
        }
    }

    // Removes the decor objects instead of hiding them, so both their render cost and
    // their effect on layer lookups (see the notes on GetLayerOf) go away
    private ToggleDecor()
    {
        this.decorShown = !this.decorShown;
        if (this.decorShown)
            this.AddDecor();
        else
        {
            for (const obj of this.decor)
                obj.Remove();
            this.decor.length = 0;
        }
    }
}

function SwapRemove<T extends { listIndex: number }>(list: T[], item: T)
{
    const index = item.listIndex;
    if (index < 0 || list[index] !== item)
        return;

    const last = list.pop()!;
    if (last !== item)
    {
        list[index] = last;
        last.listIndex = index;
    }
    item.listIndex = -1;
}

const params = new URLSearchParams(location.search);

StartBare(Game, {
    backgroundColor: new Color(20, 28, 20, 255),
    editorButtonPosition: { x: 1, y: 1 },
    // Headless browsers and background tabs report no focus; keep running for benchmarks
    freezeOnUnfocus: !params.has('bench'),
    OnInit: () => perf.Install(),
}).then(game => {
    // ?bench runs the benchmark right away, eg in a headless browser
    if (params.has('bench'))
        (game as Game).RunBenchmark();
});
