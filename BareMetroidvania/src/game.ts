import { CanvasScale, LevelData, plugin, SaveData, Scene, StartBare, TextureFilterMode, Vec2 } from 'bare-engine';
import { ArcadeObject, ArcadePhysicsController } from 'bare-engine/arcade';
import settingsDataJson from '../public/data/settingsData.json';
import { PlayerComponent } from './components/playerComponent';
import { BossComponent } from './components/bossComponent';
import { Hud } from './ui/hud';
import { MapScene } from './ui/mapScene';
import { TitleScene } from './ui/titleScene';
import { EndingScene } from './ui/endingScene';
import { CELL_H, CELL_W, GetRoom, GetRoomAt, HitboxRect, LINKS, ROOMS, RoomGeometry, RoomInfo, SetSaveDefaults } from './world';

export class Game extends Scene
{
    player!: ArcadeObject;
    playerComp!: PlayerComponent;
    hud!: Hud;
    room!: RoomInfo;

    private changingRoom = false;
    private ended = false;
    private static titleShown = false;

    constructor()
    {
        super({ settingsData: settingsDataJson });
    }

    override async OnAwake()
    {
        bare.AddClass(ArcadePhysicsController);

        // C IS DASH, SO THE "RESTART WITH CLEARED SAVE" DEBUG KEY MOVES TO 0
        bare.DisableDebugKey('c');
        bare.SetDebugKey('0', () => bare.Restart({ clearSaveData: true }));

        await bare.LoadFont('Pixellari');
        bare.defaultFont = 'Pixellari';

        this.player = this.AddGameObject<ArcadeObject>('player');
        this.playerComp = this.player.GetComponent(PlayerComponent)!;

        this.hud = await bare.scene.Add(Hud);
        this.hud.SetPlayer(this.playerComp);

        // CHARACTERS PASS THROUGH EACH OTHER (CONTACT DAMAGE USES THE COLLISION EVENTS, WHICH STILL FIRE),
        // AND PLANKS ONLY HOLD WHAT FALLS ONTO THEM FROM ABOVE
        this.arcade.OnPreCollisionResolve = (a, b) => this.ShouldCollide(a, b);

        this.events.persistent.on('playerDied', () => this.Respawn());
        this.events.persistent.on('exitReached', () => this.End());

        if (isDev)
        {
            (window as any).game = this;
            (window as any).SaveData = SaveData;
            plugin?.AddDebugAction('Give all abilities', () => {
                for (var ability of ['dash', 'double', 'wall', 'hammer'])
                    SaveData.abilities.add(ability);
                this.hud.RefreshAbilities();
            });
            plugin?.AddDebugAction('Reveal map', () => ROOMS.forEach(r => SaveData.visited.add(r.id)));
            var defeatBoss = () => bare.component.GetAllByType(BossComponent).forEach(boss => boss.enemy.Hit(999, 0));
            plugin?.AddDebugAction('Defeat boss', defeatBoss);
            (window as any).defeatBoss = defeatBoss;
        }
    }

    override async OnStart()
    {
        await this.EnterRoom(SaveData.shrineRoom, null);

        if (!Game.titleShown)
        {
            Game.titleShown = true;
            this.paused = true;
            await bare.scene.Add(TitleScene, { onPlay: () => this.paused = false });
        }
    }

    ShouldCollide(a: ArcadeObject, b: ArcadeObject): boolean
    {
        if (!a.static && !b.static)
            return false;

        var plank = a.tags.includes('oneway') ? a : b.tags.includes('oneway') ? b : null;
        if (!plank)
            return true;

        var mover = plank == a ? b : a;
        if (mover.velocity.y < 0)
            return false;
        if (mover == this.player && this.playerComp.dropThrough)
            return false;

        var r = HitboxRect(mover);
        var previousBottom = r.y + r.h - mover.velocity.y * bare.fixedTimestep;
        return previousBottom <= plank.y + 1;
    }

    // LOADS A ROOM. worldPos: WHERE THE PLAYER IS IN WORLD PIXELS, OR null TO STAND AT THE SHRINE / START
    async EnterRoom(roomId: string, worldPos: Vec2 | null)
    {
        var room = GetRoom(roomId) ?? GetRoom('h01')!;
        var newArea = !this.room || this.room.area != room.area;

        this.changingRoom = true;
        await this.LoadLevel(room.id);
        this.room = room;

        if (worldPos)
        {
            this.player.SetPosition(worldPos.x - room.x * CELL_W, worldPos.y - room.y * CELL_H);
        }
        else
        {
            var spot = bare.object.GetByName('shrine') ?? bare.object.GetByName('playerStart');
            var level = this.currentLevel!;
            this.player.SetPosition(spot ? spot.x : level.dimensions.width / 2, spot ? spot.y : level.dimensions.height - 16);
            this.player.ResetVelocity();
        }
        bare.object.GetByName('playerStart')?.Remove();

        SaveData.room = room.id;
        SaveData.visited.add(room.id);
        bare.storage.Save();

        this.hud.OnRoomEntered(room, newArea);
        this.SnapCamera();
        this.changingRoom = false;

        this.PreloadNeighbours(room);
    }

    override OnPostLoadLevel(level: LevelData): void
    {
        RoomGeometry.Collect(bare.object.GetAll());
    }

    PreloadNeighbours(room: RoomInfo)
    {
        for (var link of LINKS)
        {
            if (link.a == room.id) bare.level.LoadData(link.b);
            if (link.b == room.id) bare.level.LoadData(link.a);
        }
    }

    override OnUpdate(deltaTime: number): void
    {
        if (this.changingRoom || !this.currentLevel)
            return;

        SaveData.playTime += deltaTime;

        this.CheckRoomExit();
        this.FollowCamera(deltaTime);

        if (bare.keyboard.IsKeyPressed('m') || bare.keyboard.IsKeyPressed('tab'))
            this.OpenMap();
    }

    // WALKING OFF AN EDGE: FIND THE ROOM AT THAT WORLD POSITION
    CheckRoomExit()
    {
        var dims = this.currentLevel!.dimensions;
        var x = this.player.x, y = this.player.y - 8;
        if (x >= 0 && x <= dims.width && y >= 0 && y <= dims.height)
            return;

        var worldX = this.room.x * CELL_W + x;
        var worldY = this.room.y * CELL_H + y;
        var next = GetRoomAt(worldX, worldY);

        if (!next || next == this.room)
        {
            // NOTHING THERE: KEEP THE PLAYER IN
            this.player.x = Math.max(4, Math.min(dims.width - 4, this.player.x));
            this.player.y = Math.max(16, Math.min(dims.height, this.player.y));
            return;
        }

        var goingUp = y < 0;
        var worldPos = new Vec2(worldX, worldY + 8);

        // NUDGE INTO THE NEW ROOM, AND JUMP UP THROUGH FLOOR HOLES WITH A LITTLE BOOST
        if (x < 0) worldPos.x -= 6;
        if (x > dims.width) worldPos.x += 6;
        if (goingUp)
            this.player.velocity.y = Math.min(this.player.velocity.y, -300);

        this.EnterRoom(next.id, worldPos);
    }

    FollowCamera(deltaTime: number)
    {
        var camera = bare.camera.GetPosition();
        var t = 1 - Math.exp(-10 * deltaTime);
        bare.camera.SetPosition(
            bare.util.Lerp(camera.x, this.player.x, t),
            bare.util.Lerp(camera.y, this.player.y - 24, t),
        );
    }

    SnapCamera()
    {
        bare.camera.SetPosition(this.player.x, this.player.y - 24);
    }

    async OpenMap()
    {
        this.paused = true;
        var map: MapScene;
        map = await bare.scene.Add(MapScene, {
            room: this.room,
            playerWorld: new Vec2(this.room.x * CELL_W + this.player.x, this.room.y * CELL_H + this.player.y - 8),
            onClose: () => {
                bare.scene.Remove(map);
                this.paused = false;
            },
            onWarp: async () => {
                bare.scene.Remove(map);
                this.paused = false;
                await this.EnterRoom(SaveData.shrineRoom, null);
            },
        });
    }

    async Respawn()
    {
        SaveData.deaths++;
        if (!await this.Wait(1.2, true))
            return;
        await this.EnterRoom(SaveData.shrineRoom, null);
        this.playerComp.Revive();
    }

    async End()
    {
        if (this.ended)
            return;
        this.ended = true;
        this.paused = true;
        bare.sound.Play('win', { volume: 0.3 });
        await bare.scene.Add(EndingScene);
    }
}

StartBare(Game, {
    textureFilter: TextureFilterMode.NEAREST,
    antiAlias: false,
    roundPixels: true,
    editorButtonPosition: { x: 0.5, y: 0 },
    resolution: {
        width: 320,
        height: 180,
        scale: CanvasScale.Fit,
    },
    OnInit: () => {
        SetSaveDefaults();
        bare.storage.Load();
    },
});
