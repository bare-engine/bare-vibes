import { Component, GameObject, Range, SerializeField } from 'bare-engine';
import { ArcadeObject } from 'bare-engine/arcade';
import { ContainsPoint } from '../golfEvents';
import { BallComponent } from './ballComponent';

// Slows the ball down a lot while its center is in the sand.
export class SandComponent extends Component<ArcadeObject>
{
    // fraction of the speed lost every fixed step
    @SerializeField
    @Range(0, 1)
    drag = 0.07;

    override OnCollisionUpdate(other: GameObject)
    {
        const ball = other.GetComponent(BallComponent);
        if (!ball || ball.sunk || !ContainsPoint(this.go, other.x, other.y))
            return;

        const velocity = ball.go.velocity;
        velocity.set(velocity.x * (1 - this.drag), velocity.y * (1 - this.drag));
    }
}
