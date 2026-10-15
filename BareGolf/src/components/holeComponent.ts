import { Color, Component, GameMode, GameObject, Run, SerializeField, Vec2 } from 'bare-engine';
import { ArcadeObject } from 'bare-engine/arcade';
import { BallComponent } from './ballComponent';

const POLE_COLOR = Color.fromHex('#f4f1e8');
const FLAG_COLOR = Color.fromHex('#e8423f');

// The cup. A slow ball that reaches it drops in, a fast one rolls over the lip.
@Run(GameMode.Edit, GameMode.Play)
export class HoleComponent extends Component<ArcadeObject>
{
    // faster than this, the ball skips over the cup
    @SerializeField
    maxSinkSpeed = 420;

    // how hard the lip pulls a ball toward the middle
    @SerializeField
    pull = 1400;

    override OnCollisionUpdate(other: GameObject)
    {
        const ball = other.GetComponent(BallComponent);
        if (!ball || ball.sunk)
            return;

        const radius = this.go.GetBounds().width / 2;
        const toHole = new Vec2(this.go.x - other.x, this.go.y - other.y);
        const distance = toHole.length();

        if (distance > radius)
            return;

        if (distance < radius * 0.7 && ball.go.velocity.length() < this.maxSinkSpeed)
        {
            ball.Sink(this.go.x, this.go.y);
            return;
        }

        if (distance > 0)
        {
            const step = this.pull * bare.fixedTimestep / distance;
            ball.go.velocity.set(ball.go.velocity.x + toHole.x * step, ball.go.velocity.y + toHole.y * step);
        }
    }

    override OnPostRender()
    {
        const foot = new Vec2(this.go.x, this.go.y);
        const top = foot.add(new Vec2(0, -48));

        bare.drawLine({ position: foot, points: [new Vec2(0, 0), new Vec2(0, -48)], width: 2.5, color: POLE_COLOR });
        bare.drawGraphic({
            points: [top, top.add(new Vec2(22, 7)), top.add(new Vec2(0, 14))],
            color: FLAG_COLOR,
        });
    }
}
