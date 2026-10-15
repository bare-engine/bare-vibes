import { GameObject, Scene } from 'bare-engine';
import { AiDriverComponent } from './components/aiDriverComponent';
import { CarComponent } from './components/carComponent';
import { PlayerDriverComponent } from './components/playerDriverComponent';
import { RacerComponent } from './components/racerComponent';
import { Asset, Data } from './generated/assets';
import { Track } from './track';

declare module 'bare-engine'
{
    interface CustomData
    {
        driver: string;
    }
}

export const LAPS = 3;
const COUNTDOWN_SECONDS = 3;

// cars collide as two circles each, one at the front and one at the back
const CAR_CIRCLE_RADIUS = 19;
const CAR_CIRCLE_OFFSET = 15;
const BOUNCE = 0.35;

const SKID_SIDE_SPEED = 110;
const SKID_INTERVAL = 0.025;
const SKID_LIFETIME = 4;
const MAX_SKIDS = 500;

export type RaceState = 'countdown' | 'racing' | 'finished';

type Racer = { car: CarComponent, racer: RacerComponent, skidTimer: number };
type Skid = { obj: GameObject, age: number };

export class RaceManager
{
    state: RaceState = 'countdown';
    countdown = COUNTDOWN_SECONDS;
    raceTime = 0;

    readonly racers: Racer[] = [];
    player!: Racer;

    private skids: Skid[] = [];

    constructor(private scene: Scene, readonly track: Track)
    {
    }

    // the player starts last, behind four opponents
    SpawnCars()
    {
        const grid = [Data.Prefab.BLUE_CAR, Data.Prefab.GREEN_CAR, Data.Prefab.YELLOW_CAR, Data.Prefab.BLACK_CAR, Data.Prefab.PLAYER_CAR];
        const finish = this.track.waypoints[0];
        const heading = this.track.startHeading;
        const rad = heading * Math.PI / 180;
        const fx = Math.cos(rad), fy = Math.sin(rad);

        grid.forEach((prefab, i) => {
            const back = 70 + i * 78;
            const side = i % 2 == 0 ? -26 : 26;
            const obj = this.scene.AddGameObject(prefab, Data.Layer.OBJECTS)
                .SetPosition(finish.x - fx * back - fy * side, finish.y - fy * back + fx * side);

            const car = obj.GetComponent(CarComponent)!;
            const racer = obj.GetComponent(RacerComponent)!;
            car.track = this.track;
            car.SetHeading(heading);
            racer.track = this.track;
            racer.laps = LAPS;

            const entry = { car, racer, skidTimer: 0 };
            this.racers.push(entry);
            if (obj.HasComponent(PlayerDriverComponent))
                this.player = entry;
        });
    }

    Update(deltaTime: number)
    {
        if (this.state == 'countdown')
        {
            this.countdown -= deltaTime;
            if (this.countdown <= 0)
            {
                this.state = 'racing';
                for (const { car } of this.racers)
                    car.locked = false;
            }
        }
        else
        {
            this.raceTime += deltaTime;
        }

        this.CollideCars();
        this.CollideSolids();
        this.KeepInsideTrack();

        for (const entry of this.racers)
        {
            if (this.state == 'countdown')
                continue;

            if (entry.racer.CheckProgress(this.raceTime) && entry == this.player)
                this.OnPlayerFinished();

            this.UpdateSkids(entry, deltaTime);
        }
        this.FadeSkids(deltaTime);
    }

    // finished cars by finish time, then the rest by how far they got
    GetStandings(): RacerComponent[]
    {
        return this.racers.map(r => r.racer).sort((a, b) => {
            if (a.finished && b.finished)
                return a.finishTime! - b.finishTime!;
            if (a.finished != b.finished)
                return a.finished ? -1 : 1;
            return b.progress - a.progress;
        });
    }

    GetPosition(racer: RacerComponent): number
    {
        return this.GetStandings().indexOf(racer) + 1;
    }

    private OnPlayerFinished()
    {
        this.state = 'finished';

        // the computer takes over the player's car for a lap of honor
        const go = this.player.car.go;
        go.RemoveComponent(PlayerDriverComponent);
        go.AddComponent(AiDriverComponent);
    }

    private CollideCars()
    {
        for (let i = 0; i < this.racers.length; i++)
            for (let j = i + 1; j < this.racers.length; j++)
                this.CollideCarPair(this.racers[i].car, this.racers[j].car);
    }

    private CollideCarPair(a: CarComponent, b: CarComponent)
    {
        const minDistance = CAR_CIRCLE_RADIUS * 2;
        for (const ca of CarCircles(a))
            for (const cb of CarCircles(b))
            {
                let nx = ca.x - cb.x;
                let ny = ca.y - cb.y;
                const distance = Math.hypot(nx, ny);
                if (distance >= minDistance || distance == 0)
                    continue;

                nx /= distance;
                ny /= distance;

                const push = (minDistance - distance) / 2;
                a.go.x += nx * push;
                a.go.y += ny * push;
                b.go.x -= nx * push;
                b.go.y -= ny * push;

                // equal masses: swap the part of the velocity along the normal, minus some lost to the bump
                const closing = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
                if (closing < 0)
                {
                    const impulse = -(1 + BOUNCE) * closing / 2;
                    a.vx += nx * impulse;
                    a.vy += ny * impulse;
                    b.vx -= nx * impulse;
                    b.vy -= ny * impulse;

                    if (impulse > 120 && (a == this.player.car || b == this.player.car))
                        bare.camera.StartShake(Math.min(10, impulse / 40), 0.25);
                }
                return;
            }
    }

    private CollideSolids()
    {
        for (const { car } of this.racers)
            for (const circle of CarCircles(car))
                for (const solid of this.track.solids)
                {
                    let nx = circle.x - solid.x;
                    let ny = circle.y - solid.y;
                    const distance = Math.hypot(nx, ny);
                    const minDistance = CAR_CIRCLE_RADIUS + solid.radius;
                    if (distance >= minDistance || distance == 0)
                        continue;

                    nx /= distance;
                    ny /= distance;
                    car.go.x += nx * (minDistance - distance);
                    car.go.y += ny * (minDistance - distance);

                    const closing = car.vx * nx + car.vy * ny;
                    if (closing < 0)
                    {
                        car.vx -= (1 + BOUNCE) * closing * nx;
                        car.vy -= (1 + BOUNCE) * closing * ny;
                    }
                }
    }

    private KeepInsideTrack()
    {
        const margin = 30;
        for (const { car } of this.racers)
        {
            const x = Math.max(margin, Math.min(this.track.width - margin, car.go.x));
            const y = Math.max(margin, Math.min(this.track.height - margin, car.go.y));
            if (x != car.go.x) car.vx = 0;
            if (y != car.go.y) car.vy = 0;
            car.go.SetPosition(x, y);
        }
    }

    // sliding tires leave marks on the asphalt
    private UpdateSkids(entry: Racer, deltaTime: number)
    {
        const { car } = entry;
        entry.skidTimer -= deltaTime;
        const sliding = Math.abs(car.sideSpeed) > SKID_SIDE_SPEED || (car.handbrake && car.speed > 120);
        if (!sliding || !car.onRoad || entry.skidTimer > 0)
            return;

        entry.skidTimer = SKID_INTERVAL;
        const rad = car.heading * Math.PI / 180;
        const obj = this.scene.AddGameObject(Asset.Image.SKIDMARK_SHORT_1, Data.Layer.SKIDS)
            .CenterPivot()
            .SetPosition(car.go.x - Math.cos(rad) * 24, car.go.y - Math.sin(rad) * 24)
            .SetRotation(car.heading + 90)
            .SetScaleXY(0.62, 0.7)
            .SetAlpha(0.45);
        this.skids.push({ obj, age: 0 });

        if (this.skids.length > MAX_SKIDS)
            this.skids.shift()!.obj.Remove();
    }

    private FadeSkids(deltaTime: number)
    {
        for (const skid of this.skids)
        {
            skid.age += deltaTime;
            skid.obj.alpha = 0.45 * Math.max(0, 1 - skid.age / SKID_LIFETIME);
        }
        while (this.skids.length && this.skids[0].age >= SKID_LIFETIME)
            this.skids.shift()!.obj.Remove();
    }
}

function CarCircles(car: CarComponent)
{
    const rad = car.heading * Math.PI / 180;
    const ox = Math.cos(rad) * CAR_CIRCLE_OFFSET;
    const oy = Math.sin(rad) * CAR_CIRCLE_OFFSET;
    return [
        { x: car.go.x + ox, y: car.go.y + oy },
        { x: car.go.x - ox, y: car.go.y - oy },
    ];
}

