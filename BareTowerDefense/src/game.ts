import { CanvasScale, Color, Easing, InspectorButton, InspectorClass, InspectorField, ParticleEmitter, plugin, SaveData, Scene, StartBare, TextObject, TweenTo, Vec2 } from 'bare-engine';
import settingsDataJson from '../public/data/settingsData.json';
import { EnemyComponent } from './components/enemyComponent';
import { TowerComponent } from './components/towerComponent';
import { MAP_WIDTH, TILE, TOWER_TYPES } from './constants';
import { Data } from './generated/assets';
import { Hud } from './hud';
import { BuildWave, SpawnEntry } from './waves';

declare module 'bare-engine'
{
    interface BareUserEvents
    {
        hudChanged: void;
        message: { text: string };
    }

    namespace SaveData
    {
        let bestWave: number;
    }
}

// S = SPAWN, E = EXIT, # = PATH, . = BUILDABLE GRASS
const MAP = [
    '................',
    'S#####..........',
    '.....#..#######.',
    '.....#..#.....#.',
    '.....#..#.....#.',
    '.....#..#.....#.',
    '.....####.....#.',
    '..............#.',
    '..#############.',
    '..#.............',
    '..#############E',
    '................',
];

const START_GOLD = 150;
const START_LIVES = 20;

const HOVER_OK = Color.fromHex('#ffffff30');
const HOVER_BAD = Color.fromHex('#ff303040');
const RANGE_FILL = Color.fromHex('#ffffff18');
const RANGE_LINE = Color.fromHex('#ffffffaa');

class WaveManager
{
    @InspectorField
    wave = 0;

    @InspectorField
    active = false;

    private queue: SpawnEntry[] = [];
    private timer = 0;
    private healthMultiplier = 1;

    constructor(private game: Game) {}

    Reset()
    {
        this.wave = 0;
        this.active = false;
        this.queue = [];
    }

    @InspectorField
    get queued(): number { return this.queue.length; }

    @InspectorButton
    StartNext()
    {
        if (this.active || this.game.isGameOver)
            return;

        this.wave++;
        const info = BuildWave(this.wave);
        this.queue = info.entries;
        this.healthMultiplier = info.healthMultiplier;
        this.timer = this.queue[0]?.delay ?? 0;
        this.active = true;
        this.game.Changed();
    }

    Update(dt: number)
    {
        if (!this.active)
            return;

        this.timer -= dt;
        while (this.queue.length > 0 && this.timer <= 0)
        {
            const entry = this.queue.shift()!;
            this.game.SpawnEnemy(entry.prefab, this.healthMultiplier);
            this.timer += this.queue[0]?.delay ?? 0;
        }

        if (this.queue.length == 0 && this.game.enemyCount == 0)
        {
            this.active = false;
            this.game.OnWaveCleared(this.wave);
        }
    }
}

export class Game extends Scene
{
    @InspectorClass
    waves = new WaveManager(this);

    @InspectorField
    gold = START_GOLD;

    @InspectorField
    lives = START_LIVES;

    isGameOver = false;
    buildPrefab: string | null = null;
    selected: TowerComponent | null = null;

    private waypoints: Vec2[] = [];
    private towers = new Map<string, TowerComponent>();
    private hoverCell: { col: number, row: number } | null = null;
    private deathFx!: ParticleEmitter;
    private explosionFx!: ParticleEmitter;
    private floatTexts: TextObject[] = [];
    private nextFloatText = 0;

    constructor()
    {
        super({ settingsData: settingsDataJson });
    }

    get enemyCount(): number { return bare.component.GetAllByType(EnemyComponent).length; }

    override async OnAwake()
    {
        await bare.scene.Add(Hud, this);

        plugin?.AddDebugAction('Give 500 gold', () => { this.gold += 500; this.Changed(); });
        plugin?.AddDebugAction('Skip 5 waves', () => { this.waves.wave += 5; this.Changed(); });
    }

    override OnStart()
    {
        this.gold = START_GOLD;
        this.lives = START_LIVES;
        this.isGameOver = false;
        bare.timeScale = 1;
        this.buildPrefab = null;
        this.selected = null;
        this.towers.clear();
        this.waves.Reset();

        this.BuildMap();
        this.CreateEffects();
        this.Changed();
    }

    private BuildMap()
    {
        // ONE TILED OBJECT FOR ALL THE GRASS, PATH TILES ON TOP
        this.AddGameObject(Data.Prefab.GRASS_FIELD, 'ground');

        let spawn = { col: 0, row: 0 };
        for (let row = 0; row < MAP.length; row++)
        for (let col = 0; col < MAP[row].length; col++)
        {
            const cell = MAP[row][col];
            if (cell == '.')
                continue;

            this.AddGameObject(Data.Prefab.PATH, 'ground').SetPosition(col * TILE, row * TILE);

            if (cell == 'S')
                spawn = { col, row };
            if (cell == 'S' || cell == 'E')
                this.AddGameObject(cell == 'S' ? Data.Prefab.PORTAL : Data.Prefab.CASTLE).SetPosition(this.CellCenter(col), this.CellCenter(row));
        }

        this.waypoints = this.TracePath(spawn.col, spawn.row);
    }

    // WALK FROM THE SPAWN ALONG NEIGHBOURING PATH CELLS UNTIL THE EXIT
    private TracePath(col: number, row: number): Vec2[]
    {
        const points: Vec2[] = [];
        const visited = new Set<string>();

        while (true)
        {
            points.push(new Vec2(this.CellCenter(col), this.CellCenter(row)));
            visited.add(col + ',' + row);

            if (MAP[row][col] == 'E')
                break;

            const next = [[1, 0], [-1, 0], [0, 1], [0, -1]]
                .map(([dc, dr]) => ({ col: col + dc, row: row + dr }))
                .find(n => this.IsPath(n.col, n.row) && !visited.has(n.col + ',' + n.row));

            assert(next, `Path is broken at ${col},${row}`);
            col = next!.col;
            row = next!.row;
        }

        // START JUST OFF SCREEN, SO ENEMIES WALK OUT OF THE PORTAL
        points.unshift(new Vec2(points[0].x - TILE, points[0].y));
        return points;
    }

    private CreateEffects()
    {
        this.deathFx = bare.particle.CreateEmitter({
            texture: 'spark',
            life: [0.3, 0.6],
            emitRate: 14,
            emitShape: 'CIRCLE',
            emitRadius: 6,
            origin: { x: 0.5, y: 0.5 },
            animation: {
                scale: { start: [0.5, 0.9], end: 0.05 },
                speed: { start: [80, 220], damping: 0.9 },
                color: { start: '#ffe680', end: '#ff450000' },
            },
        });

        this.explosionFx = bare.particle.CreateEmitter({
            texture: 'spark',
            life: [0.25, 0.5],
            emitRate: 26,
            emitShape: 'CIRCLE',
            emitRadius: 10,
            origin: { x: 0.5, y: 0.5 },
            animation: {
                scale: { start: [0.8, 1.4], end: 0.1 },
                speed: { start: [120, 260], damping: 0.88 },
                color: { start: '#fff2b0', end: '#60300000' },
            },
        });

        this.floatTexts = [];
        for (let i = 0; i < 12; i++)
        {
            const text = new TextObject(this, { text: '', fontSize: 18, fontWeight: 'bold', fill: '#ffe14a', stroke: '#000000', strokeThickness: 4 });
            this.AddGameObject(text, 'projectiles').CenterPivot();
            text.visible = false;
            this.floatTexts.push(text);
        }
    }

    CellCenter(index: number): number
    {
        return index * TILE + TILE / 2;
    }

    IsPath(col: number, row: number): boolean
    {
        const cell = MAP[row]?.[col];
        return cell != undefined && cell != '.';
    }

    CanBuild(col: number, row: number): boolean
    {
        return MAP[row]?.[col] == '.' && !this.towers.has(col + ',' + row);
    }

    // PREFAB DATA OF A TOWER'S COMPONENT, TO SHOW COSTS AND RANGE BEFORE IT EXISTS
    GetTowerData(prefab: string): Pick<TowerComponent, 'displayName' | 'cost' | 'range'>
    {
        return this.settings.prefabs.find(entity => entity.name == prefab)!.components.tower;
    }

    Changed()
    {
        bare.SendEvent('hudChanged');
    }

    Message(text: string)
    {
        bare.SendEvent('message', { text });
    }

    override OnUpdate()
    {
        this.HandleInput();
    }

    override OnFixedUpdate(dt: number)
    {
        if (!this.isGameOver)
            this.waves.Update(dt);
    }

    private HandleInput()
    {
        const mouse = bare.mouse.world.position;
        const col = Math.floor(mouse.x / TILE);
        const row = Math.floor(mouse.y / TILE);
        this.hoverCell = mouse.x >= 0 && mouse.x < MAP_WIDTH && row >= 0 && row < MAP.length ? { col, row } : null;

        if (this.isGameOver)
            return;

        if (bare.mouse.IsPressed() && this.hoverCell)
            this.ClickCell(col, row);

        for (let i = 0; i < TOWER_TYPES.length; i++)
            if (bare.keyboard.IsKeyPressed(String(i + 1)))
                this.SelectBuild(TOWER_TYPES[i]);

        if (bare.keyboard.IsKeyPressed('escape'))
            this.Deselect();
        if (bare.keyboard.IsKeyPressed('space'))
            this.waves.StartNext();
        if (bare.keyboard.IsKeyPressed('u'))
            this.UpgradeSelected();
        if (bare.keyboard.IsKeyPressed('x'))
            this.SellSelected();
        if (bare.keyboard.IsKeyPressed('f'))
            this.ToggleSpeed();
    }

    private ClickCell(col: number, row: number)
    {
        const tower = this.towers.get(col + ',' + row);
        if (tower)
        {
            this.buildPrefab = null;
            this.selected = tower;
            this.Changed();
            return;
        }

        if (this.buildPrefab && this.CanBuild(col, row))
        {
            this.BuildTower(this.buildPrefab, col, row);
            return;
        }

        this.Deselect();
    }

    SelectBuild(prefab: string)
    {
        this.buildPrefab = this.buildPrefab == prefab ? null : prefab;
        this.selected = null;
        this.Changed();
    }

    Deselect()
    {
        this.buildPrefab = null;
        this.selected = null;
        this.Changed();
    }

    private BuildTower(prefab: string, col: number, row: number)
    {
        const cost = this.GetTowerData(prefab).cost;
        if (this.gold < cost)
        {
            this.Message('Not enough gold');
            return;
        }

        this.gold -= cost;

        const tower = this.AddGameObject(prefab, 'objects').SetPosition(this.CellCenter(col), this.CellCenter(row));
        tower.SetScale(0.3);
        TweenTo(tower, 0.35, { scaleX: 1, scaleY: 1, ease: Easing.Back.Out });

        this.towers.set(col + ',' + row, tower.GetComponent(TowerComponent)!);

        // KEEP BUILDING THE SAME TOWER WHILE IT'S AFFORDABLE
        if (this.gold < cost)
            this.buildPrefab = null;

        this.Changed();
    }

    UpgradeSelected()
    {
        const tower = this.selected;
        if (!tower || !tower.canUpgrade)
            return;

        if (this.gold < tower.upgradeCost)
        {
            this.Message('Not enough gold');
            return;
        }

        this.gold -= tower.upgradeCost;
        tower.Upgrade();
        TweenTo(tower.go, 0.12, { innerScaleX: 1.25, innerScaleY: 1.25, yoyo: true, repeat: 1 });
        this.Changed();
    }

    SellSelected()
    {
        const tower = this.selected;
        if (!tower)
            return;

        this.gold += tower.sellValue;
        this.FloatText(tower.go.position, '+' + tower.sellValue);

        for (const [key, value] of this.towers)
            if (value == tower)
                this.towers.delete(key);

        tower.go.Remove();
        this.selected = null;
        this.Changed();
    }

    ToggleSpeed()
    {
        bare.timeScale = bare.timeScale == 1 ? 2 : 1;
        this.Changed();
    }

    SpawnEnemy(prefab: string, healthMultiplier: number)
    {
        const enemy = this.AddGameObject(prefab, 'enemies');
        enemy.GetComponent(EnemyComponent)!.Spawn(this.waypoints, healthMultiplier);
    }

    OnEnemyKilled(enemy: EnemyComponent)
    {
        this.gold += enemy.reward;
        bare.particle.OneShot(this.deathFx, { position: enemy.go.position.clone() });
        this.FloatText(enemy.go.position, '+' + enemy.reward);
        enemy.go.Remove();
        this.Changed();
    }

    OnEnemyLeaked(enemy: EnemyComponent)
    {
        this.lives = Math.max(0, this.lives - enemy.damage);
        enemy.go.Remove();
        bare.camera.StartShake(6, 0.25);

        if (this.lives <= 0)
            this.GameOver();

        this.Changed();
    }

    OnWaveCleared(wave: number)
    {
        const bonus = 20 + wave * 3;
        this.gold += bonus;
        this.Message(`Wave ${wave} cleared! +${bonus} gold`);

        if (wave > SaveData.bestWave)
        {
            SaveData.bestWave = wave;
            bare.storage.Save();
        }

        this.Changed();
    }

    Explosion(position: Vec2, radius: number)
    {
        bare.particle.OneShot(this.explosionFx, { position: position.clone() });

        // A QUICK EXPANDING RING SHOWS THE AREA THAT WAS HIT
        const ring = this.AddGameObject('spark', 'projectiles').SetPosition(position.x, position.y).CenterPivot();
        ring.SetScale(radius / 8 * 0.3).SetAlpha(0.5);
        TweenTo(ring, 0.25, { scaleX: radius / 8, scaleY: radius / 8, alpha: 0, onComplete: () => ring.Remove() });
    }

    private FloatText(position: Vec2, text: string)
    {
        const label = this.floatTexts[this.nextFloatText];
        this.nextFloatText = (this.nextFloatText + 1) % this.floatTexts.length;

        label.SetText(text);
        label.SetPosition(position.x, position.y - 10).SetAlpha(1);
        label.visible = true;
        TweenTo(label, 0.8, { y: position.y - 45, alpha: 0, onComplete: () => label.visible = false });
    }

    private GameOver()
    {
        this.isGameOver = true;
        this.buildPrefab = null;
        this.selected = null;

        const reached = this.waves.wave;
        if (reached > SaveData.bestWave)
        {
            SaveData.bestWave = reached;
            bare.storage.Save();
        }
    }

    override OnRender()
    {
        if (this.selected)
            this.DrawRange(this.selected.go.position, this.selected.range);

        const hover = this.hoverCell;
        if (!hover || !this.buildPrefab || this.isGameOver)
            return;

        const canBuild = this.CanBuild(hover.col, hover.row);
        bare.drawRect({ position: new Vec2(hover.col * TILE, hover.row * TILE), width: TILE, height: TILE, color: canBuild ? HOVER_OK : HOVER_BAD });

        if (canBuild)
            this.DrawRange(new Vec2(this.CellCenter(hover.col), this.CellCenter(hover.row)), this.GetTowerData(this.buildPrefab).range);
    }

    private DrawRange(center: Vec2, radius: number)
    {
        bare.drawCircle({ position: center, radius, color: RANGE_FILL, segments: 48, outline: { width: 2, color: RANGE_LINE } });
    }
}

StartBare(Game, {
    backgroundColor: Color.fromHex('#14161f'),
    resolution: { width: 1280, height: 720, scale: CanvasScale.Fit },
    OnInit: () => {
        bare.storage.SetDefaults({ bestWave: 0 });
        bare.storage.Load();
    },
});
