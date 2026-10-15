import { Color, Component, GameObject, SerializeField, TweenTo, Vec2 } from 'bare-engine';
import { ArcadeObject } from 'bare-engine/arcade';

const AIM_COLOR_WEAK = Color.fromHex('#7dff7a');
const AIM_COLOR_STRONG = Color.fromHex('#ff4a3d');

// Drag back from anywhere and let go to launch the ball like a slingshot.
export class BallComponent extends Component<ArcadeObject>
{
    @SerializeField
    maxSpeed = 950;

    // speed lost every second on top of drag, so the ball comes to a clean stop
    @SerializeField
    rollingResistance = 45;

    aiming = false;
    sunk = false;

    // launch velocity the current drag would give
    private aim = new Vec2();
    // where the last shot was taken from, to return to after water
    private shotPosition = new Vec2();

    get canShoot(): boolean
    {
        return !this.sunk && !this.go.IsMoving();
    }

    get aimPower(): number
    {
        return this.aim.length() / this.maxSpeed;
    }

    // screen pixels of drag for a full-power shot
    private get pullRange(): number
    {
        return Math.min(bare.width, bare.height) * 0.35;
    }

    override OnStart()
    {
        this.shotPosition.set(this.go.x, this.go.y);
    }

    override OnUpdate()
    {
        const mouse = bare.mouse;

        if (!this.aiming)
        {
            if (mouse.IsPressed() && this.canShoot)
                this.aiming = true;

            return;
        }

        if (mouse.IsRightDown() || bare.keyboard.IsKeyPressed('escape'))
        {
            this.aiming = false;
            return;
        }

        // screen space, since the camera zooms while aiming and would shift world positions
        const pull = mouse.screen.positionOnDown.subtract(mouse.screen.position);
        const pullLength = pull.length();
        const power = Math.min(1, pullLength / this.pullRange);

        if (pullLength < 1)
            this.aim.set(0, 0);
        else
            this.aim = pull.normalized().multiply(power * this.maxSpeed);

        if (mouse.IsReleased())
        {
            this.aiming = false;

            // a plain click doesn't count as a stroke
            if (power > 0.05)
                this.Shoot();
        }
    }

    Shoot()
    {
        this.shotPosition.set(this.go.x, this.go.y);
        this.go.SetVelocity(this.aim);
        this.aim.set(0, 0);
        bare.events.emit('ballShot');
    }

    override OnFixedUpdate(fixedDeltaTime: number)
    {
        if (this.sunk || !this.go.IsMoving())
            return;

        const velocity = this.go.velocity;
        const speed = velocity.length();
        const newSpeed = speed - this.rollingResistance * fixedDeltaTime;

        if (newSpeed <= 0)
            this.go.ResetVelocity();
        else
            velocity.set(velocity.x * newSpeed / speed, velocity.y * newSpeed / speed);
    }

    override OnCollisionStart(other: GameObject)
    {
        if (!(other instanceof ArcadeObject) || other.sensor || !other.static)
            return;

        const speed = this.go.velocity.length();
        if (speed > 250)
            bare.camera.StartShake(Math.min(14, speed / 70), 0.25);
    }

    // back to where the shot was taken, the caller adds the penalty stroke
    Splash()
    {
        this.go.ResetVelocity();
        this.go.SetPosition(this.shotPosition.x, this.shotPosition.y);
        this.go.alpha = 0;
        TweenTo(this.go, 0.4, { alpha: 1 });
        bare.events.emit('ballInWater');
    }

    Sink(holeX: number, holeY: number)
    {
        this.sunk = true;
        this.aiming = false;
        this.go.ResetVelocity();
        this.go.collide = false;

        TweenTo(this.go, 0.3, { x: holeX, y: holeY, scaleX: 0.6, scaleY: 0.6, alpha: 0.4 })
            .promise.then(() => bare.events.emit('ballSunk'));
    }

    override OnPostRender()
    {
        if (!this.aiming || this.aim.isZero())
            return;

        // sizes in screen pixels, so the guide reads the same at any zoom
        const px = 1 / bare.camera.GetScale();
        const power = this.aimPower;
        const dir = this.aim.normalized();
        const color = new Color(
            bare.util.Lerp(AIM_COLOR_WEAK.r, AIM_COLOR_STRONG.r, power),
            bare.util.Lerp(AIM_COLOR_WEAK.g, AIM_COLOR_STRONG.g, power),
            bare.util.Lerp(AIM_COLOR_WEAK.b, AIM_COLOR_STRONG.b, power),
        );

        // the slingshot band, pulled back behind the ball
        const back = dir.multiply(-(12 + power * 50) * px);
        bare.drawLine({
            position: new Vec2(this.go.x, this.go.y),
            points: [new Vec2(0, 0), back],
            width: 3 * px,
            roundCap: true,
            color: new Color(255, 255, 255, 160),
        });

        // dotted power line in the launch direction, ending in an arrow
        const length = (30 + power * 230) * px;
        for (let d = 14 * px; d < length; d += 14 * px)
        {
            bare.drawCircle({
                position: new Vec2(this.go.x + dir.x * d, this.go.y + dir.y * d),
                radius: 2.5 * px,
                color,
            });
        }

        const tip = new Vec2(this.go.x + dir.x * length, this.go.y + dir.y * length);
        const side = new Vec2(-dir.y, dir.x).multiply(8 * px);
        const base = dir.multiply(-12 * px);
        bare.drawGraphic({
            points: [tip, tip.add(base).add(side), tip.add(base).subtract(side)],
            color,
        });
    }
}
