import { Component, GameObject, SerializeField, Vec2 } from 'bare-engine';
import { ArcadeObject } from 'bare-engine/arcade';
import { ContainsPoint } from '../golfEvents';
import { BallComponent } from './ballComponent';

// Pushes the ball the way the pad points while its center is on it. The arrows point right
// at rotation 0, so rotate the pad to aim it, in steps of 90 degrees to keep its hitbox exact.
export class BoostComponent extends Component<ArcadeObject>
{
    // speed added every second
    @SerializeField
    force = 2600;

    override OnCollisionUpdate(other: GameObject)
    {
        const ball = other.GetComponent(BallComponent);
        if (!ball || ball.sunk || !ContainsPoint(this.go, other.x, other.y))
            return;

        const push = Vec2.fromAngle(this.go.rotation).multiply(this.force * bare.fixedTimestep);
        ball.go.velocity.set(ball.go.velocity.x + push.x, ball.go.velocity.y + push.y);
    }
}
