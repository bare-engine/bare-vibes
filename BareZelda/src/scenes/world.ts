import { GameObject, LevelData, ParticleController, SaveData, Scene, Vec2 } from 'bare-engine';
import { ArcadeObject, ArcadePhysicsController } from 'bare-engine/arcade';
import settingsData from '../../public/data/settingsData.json';
import { EnemyComponent } from '../components/enemyComponent';
import { GateComponent } from '../components/gateComponent';
import { PlayerComponent } from '../components/playerComponent';
import { WarpComponent } from '../components/warpComponent';
import { Burst } from '../game/fx';
import { DUNGEONS } from '../game/items';
import { Music, Sfx } from '../game/sfx';
import { State } from '../game/state';
import { Data } from '../generated/assets';
import { Ending } from './ending';
import { HUD } from './hud';

const T = 16;

// THE GAMEPLAY SCENE: LOADS LEVELS, OWNS THE PLAYER AND CAMERA, AND TIES PUZZLES TOGETHER
export class World extends Scene
{
    static instance: World;

    player!: ArcadeObject;
    pc!: PlayerComponent;
    hud!: HUD;

    levelName = '';
    nav: string[] = [];
    warping = false;
    private warpCooldown = 0;
    // ENEMIES WAIT A MOMENT AFTER YOU ARRIVE, SO THEY CAN'T PUSH YOU STRAIGHT BACK OUT
    calmTime = 0;

    constructor()
    {
        super({ settingsData: settingsData });
    }

    override OnAwake()
    {
        World.instance = this;
        bare.AddClass(ArcadePhysicsController);
        // Burst is a standalone helper; production controller detection only scans class bodies.
        bare.AddClass(ParticleController);
    }

    override async OnStart()
    {
        this.hud = await bare.scene.Add(HUD);

        // SWIM THROUGH WATER WITH THE FLIPPERS: SKIP PUSHING THE PLAYER OUT OF WATER COLLIDERS
        this.arcade.OnPreCollisionResolve = (a, b) => {
            if ((a === this.player && b.tags.includes('water')) || (b === this.player && a.tags.includes('water')))
                return !State.Has('flippers');
            return true;
        };

        this.player = this.AddGameObject<ArcadeObject>(Data.Prefab.PLAYER);
        this.pc = this.player.GetComponent(PlayerComponent)!;

        // A NEW GAME STARTS IN THE VILLAGE, A SAVED ONE WHERE YOU LAST ENTERED A LEVEL
        this.EnterLevel(SaveData.level || 'overworld', SaveData.level ? SaveData.spawn : '', false);
    }

    get isDungeon(): boolean
    {
        return this.levelName.startsWith('d');
    }

    async EnterLevel(level: string, spawn: string, fade = true)
    {
        if (this.warping)
            return;
        this.warping = true;
        this.pc.Freeze(true);

        if (fade)
            await this.hud.Fade(1, 0.25);
        else
            this.hud.SetFade(1);

        const data = await this.LoadLevel(level);
        if (!data)
        {
            this.warping = false;
            this.pc.Freeze(false);
            return;
        }

        this.PlacePlayer(data, spawn);

        SaveData.level = level;
        SaveData.spawn = spawn;
        State.Save();

        Music(data.customData?.music == 'dungeon' ? 'music_dungeon' : 'music_overworld');
        bare.camera.SetPosition(this.player.x, this.player.y - 8);

        this.warpCooldown = 0.4;
        this.calmTime = 1.2;
        await this.hud.Fade(0, 0.3);
        this.hud.ShowBanner(data.customData?.title ?? '');
        this.pc.Freeze(false);
        this.warping = false;
    }

    // OBJECTS START WHILE THE LEVEL LOADS, SO THEY NEED TO KNOW WHICH LEVEL THIS IS BEFORE THAT
    override OnPreLoadLevel(level: LevelData)
    {
        this.levelName = level.name;
        this.nav = level.customData?.nav ?? [];
    }

    private PlacePlayer(level: LevelData, spawn: string)
    {
        const warp = bare.component.GetAllByType(WarpComponent).find(w => w.id == spawn);
        if (warp)
        {
            // STEP OUT OF THE DOORWAY, SO THE WARP DOESN'T FIRE AGAIN
            const out = warp.dir == 'up' ? new Vec2(0, -T - 2) : new Vec2(0, T + 4);
            this.player.SetPosition(warp.go.x + out.x, warp.go.y + out.y);
            this.pc.Face(warp.dir == 'up' ? 'up' : 'down');
        }
        else
        {
            const start = level.customData?.start ?? { x: level.dimensions.width / T / 2, y: level.dimensions.height / T / 2 };
            this.player.SetPosition(start.x * T + T / 2, start.y * T + T);
            this.pc.Face('down');
        }
        this.player.ResetVelocity();
    }

    Warp(level: string, target: string)
    {
        if (this.warping || this.warpCooldown > 0)
            return;
        Sfx('stairs', 0.4);
        this.EnterLevel(level, target);
    }

    // WHERE THE PLAYER COMES BACK AFTER A GAME OVER: THE LAST DOOR THEY CAME THROUGH
    async Respawn()
    {
        SaveData.hp = Math.min(SaveData.maxHp, 6);
        this.pc.Revive();
        this.warping = false;
        await this.EnterLevel(SaveData.level || 'overworld', SaveData.spawn);
    }

    override OnUpdate(deltaTime: number)
    {
        SaveData.playTime += deltaTime;
        this.warpCooldown -= deltaTime;
        this.calmTime -= deltaTime;

        // SMOOTH CAMERA FOLLOW
        const cam = bare.camera.GetPosition();
        const t = 1 - Math.exp(-8 * deltaTime);
        bare.camera.SetPosition(
            bare.util.Lerp(cam.x, this.player.x, t),
            bare.util.Lerp(cam.y, this.player.y - 8, t),
        );
    }

    override OnPreRender()
    {
        // DRAW OBJECTS FURTHER DOWN THE SCREEN ON TOP. THEY ALL STAND ON THEIR FEET, SO y IS WHERE THEY TOUCH THE GROUND
        bare.object.GetLayer(Data.Layer.OBJECTS).sort((a, b) => a.y - b.y);
    }

    // ---- NAVIGATION GRID, FROM THE LEVEL FILE ----

    TileAt(x: number, y: number): string
    {
        const row = this.nav[Math.floor(y / T)];
        return row?.[Math.floor(x / T)] ?? '#';
    }

    IsWalkable(x: number, y: number): boolean
    {
        return this.TileAt(x, y) == '.';
    }

    IsWater(x: number, y: number): boolean
    {
        return this.TileAt(x, y) == '~';
    }

    // ---- PUZZLES ----

    // OPENS EVERY GATE OF A GROUP, AFTER A SWITCH, TORCHES OR A ROOM OF ENEMIES
    async Solve(group: string)
    {
        const gates = bare.component.GetAllByType(GateComponent).filter(g => g.group == group);
        if (gates.length == 0)
            return;
        if (!await this.Wait(0.3))
            return;
        Sfx('secret', 0.6);
        for (const gate of gates)
            gate.Open();
    }

    OnEnemyKilled(enemy: EnemyComponent)
    {
        if (enemy.kind == 'slime')
            SaveData.slimesDefeated++;

        if (enemy.group)
        {
            const left = bare.component.GetAllByType(EnemyComponent).filter(e => e !== enemy && e.group == enemy.group && e.hp > 0);
            if (left.length == 0)
                this.Solve(enemy.group);
        }
    }

    // ---- DUNGEON ROOMS: 11x9 TILES INSIDE, WALLS EVERY 12 COLUMNS AND 10 ROWS ----

    RoomBounds(position: Vec2): { x: number; y: number; width: number; height: number }
    {
        if (!this.isDungeon)
            return { x: position.x - 120, y: position.y - 80, width: 240, height: 160 };
        const cx = Math.floor((position.x / T - 1) / 12);
        const cy = Math.floor((position.y / T - 1) / 10);
        return { x: (cx * 12 + 1) * T, y: (cy * 10 + 1) * T, width: 11 * T, height: 9 * T };
    }

    InSameRoom(a: Vec2, b: Vec2): boolean
    {
        const ra = this.RoomBounds(a);
        return b.x >= ra.x && b.x <= ra.x + ra.width && b.y >= ra.y && b.y <= ra.y + ra.height;
    }

    // ---- LOOT ----

    // DROPS A PICKUP ON THE FLOOR
    Drop(item: string, position: Vec2, amount = 1): GameObject
    {
        const textures: Record<string, string> = {
            heart: 'heart', rupees: amount >= 20 ? 'rupee_red' : amount >= 5 ? 'rupee_blue' : 'rupee', arrows: 'arrow', bombRefill: 'bomb',
            key: 'key', heartContainer: 'heart_container', sigil: 'sigil',
        };
        const obj = this.AddGameObject({
            extends: Data.Prefab.PICKUP,
            texture: textures[item] ?? item,
            position: { x: position.x, y: position.y },
            components: { pickup: { item, amount } },
        }, Data.Layer.FLOOR);
        Burst(this, 'sparks', new Vec2(position.x, position.y - 4));
        return obj;
    }

    RandomDrop(position: Vec2)
    {
        if (Math.random() > 0.4)
            return;
        const options: string[] = ['rupees', 'rupees', 'heart'];
        if (SaveData.hp < SaveData.maxHp) options.push('heart', 'heart');
        if (State.Has('bow')) options.push('arrows');
        if (State.Has('bombs')) options.push('bombRefill');
        const item = bare.util.Choose(...options);
        const amount = item == 'rupees' ? (Math.random() < 0.2 ? 5 : 1) : item == 'arrows' ? 5 : item == 'bombRefill' ? 3 : 1;
        this.Drop(item, position, amount);
    }

    DungeonInfo()
    {
        return DUNGEONS[this.levelName];
    }

    // THE DARK LORD IS BEATEN
    async FinishGame()
    {
        this.pc.Freeze(true);
        State.SetFlag('gameComplete');
        State.Save();
        Music(null);
        await this.hud.Fade(1, 1.2);
        bare.scene.Goto(Ending);
    }
}
