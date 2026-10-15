import { Component, SerializeField } from 'bare-engine';
import { CarComponent } from './carComponent';
import { RacerComponent } from './racerComponent';

// follows the track's centerline: steers at a point ahead, and slows down when the road
// further ahead bends
export class AiDriverComponent extends Component
{
    // fraction of the car's top speed this driver dares to use
    @SerializeField skill = 0.93;
    // sideways offset from the centerline, so the cars don't all drive in one line
    @SerializeField lane = 0;

    private car!: CarComponent;
    private racer!: RacerComponent;
    private stuckTime = 0;
    private reverseTime = 0;

    override OnStart()
    {
        this.car = this.go.GetComponent(CarComponent)!;
        this.racer = this.go.GetComponent(RacerComponent)!;
        this.car.maxSpeed *= this.skill;
    }

    override OnUpdate(deltaTime: number)
    {
        const car = this.car;
        const track = this.racer.track;
        if (car.locked)
            return;

        if (this.reverseTime > 0)
        {
            this.reverseTime -= deltaTime;
            car.throttle = -1;
            return;
        }

        const next = track.waypoints[this.racer.nextWaypoint];
        const prev = track.waypoints[track.Prev(this.racer.nextWaypoint)];

        // the car's spot on the centerline
        const sx = next.x - prev.x, sy = next.y - prev.y;
        const segment = Math.hypot(sx, sy);
        const t = Math.max(0, Math.min(1, ((this.go.x - prev.x) * sx + (this.go.y - prev.y) * sy) / (segment * segment)));
        const onLine = { x: prev.x + sx * t, y: prev.y + sy * t };

        const speed = car.speed;
        const target = track.PointAhead(onLine, this.racer.nextWaypoint, 80 + speed * 0.3);
        const far = track.PointAhead(onLine, this.racer.nextWaypoint, 180 + speed * 0.55);

        // shift the aim point sideways for this driver's lane
        const dirX = far.x - target.x, dirY = far.y - target.y;
        const dirLength = Math.hypot(dirX, dirY) || 1;
        const aimX = target.x - dirY / dirLength * this.lane;
        const aimY = target.y + dirX / dirLength * this.lane;

        const desired = Math.atan2(aimY - this.go.y, aimX - this.go.x) * 180 / Math.PI;
        const offAngle = AngleBetween(car.heading, desired);
        car.steer = Math.max(-1, Math.min(1, offAngle / 22));
        car.handbrake = false;

        // how much the road turns between the aim point and further ahead
        const roadNow = Math.atan2(target.y - onLine.y, target.x - onLine.x) * 180 / Math.PI;
        const roadLater = Math.atan2(far.y - target.y, far.x - target.x) * 180 / Math.PI;
        const bend = Math.min(1, Math.abs(AngleBetween(roadNow, roadLater)) / 90);

        let targetSpeed = car.maxSpeed * (1 - bend * 0.42);
        if (Math.abs(offAngle) > 50)
            targetSpeed *= 0.55;

        car.throttle = speed < targetSpeed ? 1 : speed > targetSpeed + 30 ? -1 : 0;

        // wedged against something: back out
        this.stuckTime = speed < 25 ? this.stuckTime + deltaTime : 0;
        if (this.stuckTime > 1.2)
        {
            this.stuckTime = 0;
            this.reverseTime = 0.7;
            // reversing turns the nose the other way, toward the road
            car.steer = -Math.sign(offAngle);
        }
    }
}

// from angle a to angle b, between -180 and 180 degrees
function AngleBetween(a: number, b: number): number
{
    return ((b - a) % 360 + 540) % 360 - 180;
}
