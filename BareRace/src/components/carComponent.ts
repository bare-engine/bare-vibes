import { Component, SerializeField } from 'bare-engine';
import type { Track } from '../track';

// top-down car handling: the velocity is split into a forward part, driven by the throttle,
// and a sideways part that the tires grip away. Less grip lets the car slide.
export class CarComponent extends Component
{
    @SerializeField maxSpeed = 540;
    @SerializeField offRoadMaxSpeed = 200;
    @SerializeField acceleration = 420;
    @SerializeField braking = 900;
    @SerializeField reverseSpeed = 160;
    @SerializeField turnRate = 210;     // degrees per second at speed
    @SerializeField grip = 9;
    @SerializeField offRoadGrip = 4;
    @SerializeField handbrakeGrip = 1.5;

    // set by a driver component, -1 to 1
    throttle = 0;
    steer = 0;
    handbrake = false;

    // no driving during the countdown
    locked = true;

    // degrees, 0 points right. The sprite points up, so it's drawn 90 degrees further
    heading = 0;
    vx = 0;
    vy = 0;

    // read by the skidmarks and the HUD
    sideSpeed = 0;
    onRoad = true;

    track!: Track;

    get speed(): number
    {
        return Math.hypot(this.vx, this.vy);
    }

    get forwardSpeed(): number
    {
        const rad = this.heading * Math.PI / 180;
        return this.vx * Math.cos(rad) + this.vy * Math.sin(rad);
    }

    SetHeading(heading: number)
    {
        this.heading = heading;
        this.go.rotation = heading + 90;
    }

    override OnUpdate(deltaTime: number)
    {
        // small steps keep the handling the same at low frame rates, and a cap stops a long
        // frame (a tab switch) from launching cars through each other
        let remaining = Math.min(deltaTime, 0.1);
        while (remaining > 0)
        {
            const dt = Math.min(remaining, 1 / 60);
            this.Step(dt);
            remaining -= dt;
        }
    }

    private Step(dt: number)
    {
        const throttle = this.locked ? 0 : this.throttle;
        const steer = this.locked ? 0 : this.steer;

        this.onRoad = this.track.IsOnRoad(this.go.x, this.go.y);

        const rad = this.heading * Math.PI / 180;
        const fx = Math.cos(rad), fy = Math.sin(rad);
        let forward = this.vx * fx + this.vy * fy;
        let side = -this.vx * fy + this.vy * fx;

        const top = this.onRoad ? this.maxSpeed : this.offRoadMaxSpeed;

        if (throttle > 0)
        {
            if (forward < top)
                forward = Math.min(top, forward + this.acceleration * throttle * dt);
        }
        else if (throttle < 0)
        {
            if (forward > 0)
                forward = Math.max(0, forward + this.braking * throttle * dt);
            else
                forward = Math.max(-this.reverseSpeed, forward + this.acceleration * 0.6 * throttle * dt);
        }
        else
        {
            forward = MoveTowards(forward, 0, 140 * dt);
        }

        // over the top speed, like after leaving the road: slow down hard but not instantly
        if (forward > top)
            forward = Math.max(top, forward - 700 * dt);

        if (this.handbrake)
            forward = MoveTowards(forward, 0, 260 * dt);

        // steering needs speed, and turns the other way in reverse
        const steerFactor = Math.max(-1, Math.min(1, forward / 120));
        const highSpeedDamping = 1 - 0.25 * Math.min(1, Math.abs(forward) / this.maxSpeed);
        const turn = steer * this.turnRate * steerFactor * highSpeedDamping * (this.handbrake ? 1.35 : 1);

        const grip = this.handbrake ? this.handbrakeGrip : this.onRoad ? this.grip : this.offRoadGrip;
        side *= Math.exp(-grip * dt);

        this.vx = fx * forward - fy * side;
        this.vy = fy * forward + fx * side;
        this.sideSpeed = side;

        // turning after building the velocity leaves part of it pointing the old way, which reads as a slide
        this.SetHeading(this.heading + turn * dt);

        this.go.x += this.vx * dt;
        this.go.y += this.vy * dt;
    }
}

function MoveTowards(value: number, target: number, step: number): number
{
    return value < target ? Math.min(target, value + step) : Math.max(target, value - step);
}
