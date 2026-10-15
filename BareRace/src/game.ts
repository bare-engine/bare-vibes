import { Color, Scene, StartBare } from 'bare-engine';
import settingsDataJson from '../public/data/settingsData.json';
import { Asset } from './generated/assets';
import { Hud } from './hud';
import { RaceManager } from './race';
import { Decoration, Track, TRACK_LAYOUT } from './track';

// positions in tiles, see TRACK_LAYOUT
const DECORATIONS: Decoration[] = [
    // grandstands and start lights along the main straight
    { image: Asset.Image.TRIBUNE_FULL, x: 3.4, y: 1.05, scale: 0.9 },
    { image: Asset.Image.TRIBUNE_FULL, x: 8.5, y: 0.6, scale: 0.6 },
    { image: Asset.Image.TRIBUNE_FULL, x: 13.6, y: 1.05, scale: 0.9 },
    { image: Asset.Image.LIGHTS, x: 8.5, y: 1.7 },
    { image: Asset.Image.TREE_SMALL, x: 0.8, y: 0.9, scale: 0.9 },
    { image: Asset.Image.TREE_LARGE, x: 17.1, y: 0.9, scale: 0.8 },

    // infield
    { image: Asset.Image.TREE_SMALL, x: 2.5, y: 3.5, scale: 0.75 },
    { image: Asset.Image.TIRES_RED, x: 4.4, y: 3.45, solid: 26 },
    { image: Asset.Image.TIRES_WHITE, x: 4.85, y: 3.55, solid: 26 },
    { image: Asset.Image.TENT_BLUE, x: 6.5, y: 3.5, scale: 0.8, solid: 45 },
    { image: Asset.Image.TREE_LARGE, x: 10.5, y: 4.6, scale: 0.9 },
    { image: Asset.Image.TREE_LARGE, x: 14.0, y: 3.9, scale: 0.8 },
    { image: Asset.Image.TREE_SMALL, x: 12.4, y: 3.5, scale: 0.6 },
    { image: Asset.Image.TREE_LARGE, x: 3.0, y: 5.6, scale: 0.85 },
    { image: Asset.Image.TIRES_RED_ALT, x: 3.5, y: 7.6, solid: 26 },
    { image: Asset.Image.TIRES_WHITE, x: 3.5, y: 8.5, solid: 26 },
    { image: Asset.Image.BARREL_RED, x: 9.6, y: 6.4, solid: 26 },
    { image: Asset.Image.BARREL_BLUE, x: 10.0, y: 6.6, solid: 26 },
    { image: Asset.Image.CONE_STRAIGHT, x: 11.4, y: 6.4 },
    { image: Asset.Image.CONE_DOWN, x: 11.0, y: 6.2, rotation: 40 },

    // the paddock in the loop
    { image: Asset.Image.TENT_RED_LARGE, x: 6.5, y: 6.3, scale: 0.85, solid: 95 },
    { image: Asset.Image.TENT_BLUE, x: 5.6, y: 7.9, scale: 0.6, solid: 34 },
    { image: Asset.Image.BARRIER_RED_RACE, x: 7.3, y: 8.5, scale: 0.9 },
    { image: Asset.Image.BARRIER_WHITE_RACE, x: 10.5, y: 8.5, scale: 0.9 },
    { image: Asset.Image.TIRES_RED, x: 13.3, y: 8.5, solid: 26 },
    { image: Asset.Image.TREE_LARGE, x: 15.3, y: 7.0, scale: 0.95 },
    { image: Asset.Image.TREE_SMALL, x: 17.0, y: 6.1, scale: 0.8 },
    { image: Asset.Image.ROCK1, x: 13.6, y: 6.5, solid: 32 },

    // between the two bottom straights
    { image: Asset.Image.TIRES_WHITE, x: 4.0, y: 10.5, solid: 26 },
    { image: Asset.Image.BARRIER_WHITE_RACE, x: 6.2, y: 10.5, scale: 0.9 },
    { image: Asset.Image.BARRIER_RED_RACE, x: 9.0, y: 10.5, scale: 0.9 },
    { image: Asset.Image.TIRES_RED, x: 11.2, y: 10.5, solid: 26 },
    { image: Asset.Image.TREE_SMALL, x: 13.4, y: 10.5, scale: 0.7 },

    // around the outside
    { image: Asset.Image.TREE_SMALL, x: 0.5, y: 4.2, scale: 0.7 },
    { image: Asset.Image.ROCK2, x: 0.5, y: 6.3, solid: 30 },
    { image: Asset.Image.TREE_LARGE, x: 1.0, y: 9.6, scale: 0.9 },
    { image: Asset.Image.TREE_SMALL, x: 0.8, y: 12.0, scale: 0.9 },
    { image: Asset.Image.TREE_SMALL, x: 4.0, y: 12.5, scale: 0.75 },
    { image: Asset.Image.ROCK1, x: 6.5, y: 12.5, solid: 32 },
    { image: Asset.Image.TREE_LARGE, x: 9.5, y: 12.6, scale: 0.75 },
    { image: Asset.Image.TREE_SMALL, x: 13.0, y: 12.5, scale: 0.75 },
    { image: Asset.Image.TREE_LARGE, x: 17.0, y: 10.5, scale: 0.9 },
    { image: Asset.Image.TREE_SMALL, x: 16.5, y: 12.4, scale: 0.8 },
    { image: Asset.Image.TREE_SMALL, x: 17.5, y: 3.6, scale: 0.65 },
];

// how much of the world the camera shows across, whatever the window size
const VIEW_WIDTH = 1150;
const VIEW_HEIGHT = 650;

export class Game extends Scene
{
    race!: RaceManager;
    hud!: Hud;

    // the camera follows a point a little ahead of the player's car
    private cameraTarget = { x: 0, y: 0 };

    constructor()
    {
        super({ settingsData: settingsDataJson });
    }

    override async OnAwake()
    {
        this.hud = await bare.scene.Add(Hud);
    }

    override OnStart()
    {
        const track = new Track(TRACK_LAYOUT);
        track.Build(this, DECORATIONS);

        this.race = new RaceManager(this, track);
        this.race.SpawnCars();
        this.hud.race = this.race;

        const car = this.race.player.car.go;
        this.cameraTarget.x = car.x;
        this.cameraTarget.y = car.y;
        bare.camera
            .SetDimensions(VIEW_WIDTH, VIEW_HEIGHT)
            .SetBounds({ x: 0, y: 0, width: track.width, height: track.height })
            .SetPosition(car.x, car.y)
            .Follow(this.cameraTarget, 3.5);
    }

    override OnUpdate(deltaTime: number)
    {
        this.race.Update(deltaTime);

        const { car } = this.race.player;
        this.cameraTarget.x = car.go.x + car.vx * 0.35;
        this.cameraTarget.y = car.go.y + car.vy * 0.35;

        if (this.race.state == 'finished' && bare.keyboard.IsKeyPressed('enter'))
            this.Restart();
    }
}

StartBare(Game, {
    backgroundColor: Color.fromHex('#3fb06a'),
    freezeOnUnfocus: !location.search.includes('test'),
});
